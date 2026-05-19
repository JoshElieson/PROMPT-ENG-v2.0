import type { NodePermissions, Project } from "@/types/project";

const PROJECTS_KEY = "prompt:projects:v1";
const PERMISSIONS_KEY = "prompt:permissions:v1";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadPermissions(): Record<string, NodePermissions> {
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, NodePermissions>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePermissions(permissions: Record<string, NodePermissions>): void {
  localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
}
