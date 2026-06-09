import { useEffect, useRef } from "react";
import {
  matchesAgentCompletionTrigger,
  matchesBranchFilter,
  matchesFilePattern,
  parseGitHubRepo,
} from "@/lib/automation-match";
import { runAutomationTask } from "@/lib/automation-runner";
import { shouldRunScheduledAutomation } from "@/lib/automation-schedule";
import * as git from "@/lib/git";
import { listenProjectFsChanged } from "@/lib/fs-watch";
import { isPathUnderRoot, pathsEqual } from "@/lib/project-paths";
import { isTauri } from "@/lib/tauri";
import type { AutomationDraft } from "@/types/automation";
import type { Chat } from "@/types/chat";
import type { Project } from "@/types/project";

const SCHEDULE_POLL_MS = 15_000;
const GIT_POLL_MS = 30_000;
const PR_POLL_MS = 60_000;

interface GitRepoSnapshot {
  head: string;
  branch: string | null;
  ahead: number;
}

interface AutomationEngineOptions {
  automations: AutomationDraft[];
  chats: Chat[];
  projects: Project[];
  githubToken: string | null;
  onAutomationRun: (automationId: string, timestamp: number) => void;
}

export function useAutomationEngine({
  automations,
  chats,
  projects,
  githubToken,
  onAutomationRun,
}: AutomationEngineOptions): void {
  const runningRef = useRef(new Set<string>());
  const lastScheduleRunRef = useRef(new Map<string, number>());
  const gitSnapshotsRef = useRef(new Map<string, GitRepoSnapshot>());
  const knownPullRequestsRef = useRef(new Map<string, Set<number>>());
  const automationsRef = useRef(automations);
  const chatsRef = useRef(chats);
  const projectsRef = useRef(projects);
  const githubTokenRef = useRef(githubToken);
  const onAutomationRunRef = useRef(onAutomationRun);

  automationsRef.current = automations;
  chatsRef.current = chats;
  projectsRef.current = projects;
  githubTokenRef.current = githubToken;
  onAutomationRunRef.current = onAutomationRun;

  useEffect(() => {
    for (const automation of automations) {
      if (automation.lastRunAt != null) {
        lastScheduleRunRef.current.set(automation.id, automation.lastRunAt);
      } else {
        lastScheduleRunRef.current.delete(automation.id);
      }
    }
  }, [automations]);

  const resolveLastRunAt = (automation: AutomationDraft): number | undefined =>
    lastScheduleRunRef.current.get(automation.id) ?? automation.lastRunAt;

  const markScheduleRun = (automationId: string, timestamp: number) => {
    lastScheduleRunRef.current.set(automationId, timestamp);
    onAutomationRunRef.current(automationId, timestamp);
  };

  const triggerAutomation = async (
    automationId: string,
    context?: {
      chatId?: string;
      projectId?: string;
      projectRootPath?: string;
    },
  ) => {
    const automation = automationsRef.current.find(
      (item) => item.id === automationId,
    );
    if (!automation?.enabled || automation.task.trim().length === 0) return;
    if (runningRef.current.has(automationId)) return;

    runningRef.current.add(automationId);
    try {
      await runAutomationTask(
        automation,
        chatsRef.current,
        projectsRef.current,
        context,
      );
    } finally {
      runningRef.current.delete(automationId);
    }
  };

  useEffect(() => {
    if (!isTauri()) return;

    const onAgentComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId: string; threadId: string }>)
        .detail;
      if (!detail?.chatId || !detail.threadId) return;

      for (const automation of automationsRef.current) {
        if (
          matchesAgentCompletionTrigger(
            automation,
            detail.chatId,
            detail.threadId,
          )
        ) {
          void triggerAutomation(automation.id, { chatId: detail.chatId });
        }
      }
    };

    window.addEventListener("forge:agent-complete", onAgentComplete);
    return () => {
      window.removeEventListener("forge:agent-complete", onAgentComplete);
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    const tick = () => {
      const now = new Date();
      for (const automation of automationsRef.current) {
        if (automation.triggerType !== "schedule" || !automation.enabled) {
          continue;
        }

        const lastRunAt = resolveLastRunAt(automation);

        if (
          automation.scheduleFrequency === "custom" &&
          lastRunAt == null
        ) {
          markScheduleRun(automation.id, now.getTime());
          continue;
        }

        if (!shouldRunScheduledAutomation(automation, now, lastRunAt)) {
          continue;
        }

        markScheduleRun(automation.id, now.getTime());
        void triggerAutomation(automation.id);
      }
    };

    tick();
    const timer = window.setInterval(tick, SCHEDULE_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isTauri() || projects.length === 0) return;

    let cancelled = false;

    const pollGitEvents = async () => {
      for (const project of projectsRef.current) {
        if (cancelled) return;
        try {
          const [headInfo, status] = await Promise.all([
            git.gitHeadInfo(project.rootPath),
            git.gitStatus(project.rootPath),
          ]);
          if (!status.isRepo) continue;

          const previous = gitSnapshotsRef.current.get(project.id);
          const snapshot: GitRepoSnapshot = {
            head: headInfo.head,
            branch: headInfo.branch,
            ahead: status.ahead,
          };

          if (previous) {
            for (const automation of automationsRef.current) {
              if (!automation.enabled || automation.triggerType !== "event") {
                continue;
              }

              if (
                automation.eventType === "git-commit" &&
                previous.head !== snapshot.head &&
                matchesBranchFilter(automation.eventBranch, snapshot.branch)
              ) {
                void triggerAutomation(automation.id, {
                  projectId: project.id,
                  projectRootPath: project.rootPath,
                });
              }

              if (
                automation.eventType === "branch-push" &&
                previous.ahead > 0 &&
                snapshot.ahead === 0 &&
                matchesBranchFilter(automation.eventBranch, snapshot.branch)
              ) {
                void triggerAutomation(automation.id, {
                  projectId: project.id,
                  projectRootPath: project.rootPath,
                });
              }
            }
          }

          gitSnapshotsRef.current.set(project.id, snapshot);
        } catch {
          // ignore repos that fail to read
        }
      }
    };

    void pollGitEvents();
    const timer = window.setInterval(() => {
      void pollGitEvents();
    }, GIT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [projects]);

  useEffect(() => {
    if (!isTauri() || projects.length === 0) return;

    let cancelled = false;

    const pollPullRequests = async () => {
      const token = githubTokenRef.current;
      if (!token) return;

      for (const project of projectsRef.current) {
        if (cancelled) return;
        try {
          const remoteUrl = await git.gitRemoteOriginUrl(project.rootPath);
          if (!remoteUrl) continue;
          const repo = parseGitHubRepo(remoteUrl);
          if (!repo) continue;

          const repoKey = `${repo.owner}/${repo.repo}`;
          const response = await fetch(
            `https://api.github.com/repos/${repo.owner}/${repo.repo}/pulls?state=open&sort=created&direction=desc&per_page=20`,
            {
              headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
              },
            },
          );
          if (!response.ok) continue;

          const pulls = (await response.json()) as Array<{
            number: number;
            base?: { ref?: string };
          }>;
          const known = knownPullRequestsRef.current.get(repoKey) ?? new Set<number>();
          const currentNumbers = new Set<number>();

          for (const pull of pulls) {
            currentNumbers.add(pull.number);
            if (known.has(pull.number)) continue;

            for (const automation of automationsRef.current) {
              if (
                !automation.enabled ||
                automation.triggerType !== "event" ||
                automation.eventType !== "pr-opened"
              ) {
                continue;
              }
              if (
                !matchesBranchFilter(
                  automation.eventBranch,
                  pull.base?.ref ?? null,
                )
              ) {
                continue;
              }
              void triggerAutomation(automation.id, {
                projectId: project.id,
                projectRootPath: project.rootPath,
              });
            }
          }

          knownPullRequestsRef.current.set(
            repoKey,
            new Set([...known, ...currentNumbers]),
          );
        } catch {
          // ignore polling failures
        }
      }
    };

    void pollPullRequests();
    const timer = window.setInterval(() => {
      void pollPullRequests();
    }, PR_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [projects, githubToken]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listenProjectFsChanged((event) => {
      const project = projectsRef.current.find((item) =>
        pathsEqual(item.rootPath, event.rootPath),
      );
      if (!project) return;

      for (const automation of automationsRef.current) {
        if (
          !automation.enabled ||
          automation.triggerType !== "event" ||
          automation.eventType !== "file-change"
        ) {
          continue;
        }
        const matched = event.paths.some((path) => {
          const relative = toRelativeProjectPath(project.rootPath, path);
          return matchesFilePattern(automation.eventFilePattern, relative);
        });
        if (!matched) continue;
        void triggerAutomation(automation.id, {
          projectId: project.id,
          projectRootPath: project.rootPath,
        });
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [projects]);
}

function toRelativeProjectPath(rootPath: string, changedPath: string): string {
  const normalizedRoot = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedPath = changedPath.replace(/\\/g, "/");
  if (isPathUnderRoot(normalizedRoot, normalizedPath)) {
    const prefix = `${normalizedRoot}/`;
    if (normalizedPath.toLowerCase().startsWith(prefix.toLowerCase())) {
      return normalizedPath.slice(prefix.length);
    }
    if (normalizedPath.toLowerCase() === normalizedRoot.toLowerCase()) {
      return "";
    }
  }
  return normalizedPath;
}
