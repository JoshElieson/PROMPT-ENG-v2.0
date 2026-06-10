import { useEffect, useMemo, useState } from "react";
import { ChevronDown, GitBranch, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGit } from "@/contexts/GitContext";
import { cn } from "@/lib/utils";

interface GitBranchSelectorProps {
  disabled?: boolean;
}

export function GitBranchSelector({ disabled }: GitBranchSelectorProps) {
  const {
    status,
    branches,
    isLoadingBranches,
    isOperating,
    checkoutBranch,
    syncBranch,
    loadBranches,
  } = useGit();

  const currentBranch = status?.branch ?? branches.find((b) => b.isCurrent)?.name ?? null;
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (currentBranch) {
      setSelectedBranch(currentBranch);
    }
  }, [currentBranch]);

  const filteredBranches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return branches;
    return branches.filter((branch) =>
      branch.name.toLowerCase().includes(query),
    );
  }, [branches, search]);

  const localBranches = filteredBranches.filter((branch) => !branch.isRemote);
  const remoteBranches = filteredBranches.filter((branch) => branch.isRemote);
  const showSearch = branches.length > 9;

  const busy = disabled || isOperating;
  const displayBranch = selectedBranch || currentBranch || "Select branch…";

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    if (branch !== currentBranch) {
      void checkoutBranch(branch);
    }
  };

  const handlePullLatest = () => {
    const target = selectedBranch || currentBranch;
    if (!target) return;
    void syncBranch(target);
  };

  return (
    <div className="border-border-subtle shrink-0 border-t px-2 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 px-1">
        <GitBranch className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          Branch
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <DropdownMenu
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              void loadBranches();
            } else {
              setSearch("");
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              className={cn(
                "flex h-8 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-lg border border-border/60",
                "bg-panel-elevated/80 px-2.5 text-xs shadow-elevated-sm",
                "outline-none transition-colors hover:border-border-subtle",
                "focus-visible:border-[#6366f1]/60 focus-visible:ring-1 focus-visible:ring-[#6366f1]/25",
                "data-[state=open]:border-[#6366f1]/50 data-[state=open]:ring-1 data-[state=open]:ring-[#6366f1]/20",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
              aria-label="Select git branch"
            >
              <span className="min-w-0 truncate text-left font-medium text-foreground">
                {displayBranch}
              </span>
              {isLoadingBranches ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="w-[var(--radix-dropdown-menu-trigger-width)] p-0"
          >
            {showSearch && (
              <div className="border-border-subtle border-b p-2">
                <label className="relative block">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search branches…"
                    className="border-border-subtle bg-panel text-foreground focus:border-accent h-8 w-full rounded-md border pr-2 pl-7 text-xs outline-none"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </label>
              </div>
            )}
            <ScrollArea className="max-h-56">
              {filteredBranches.length === 0 ? (
                <p className="text-muted px-3 py-4 text-center text-xs">
                  {showSearch && branches.length > 0
                    ? "No branches match your search."
                    : "No branches found."}
                </p>
              ) : (
                <DropdownMenuRadioGroup
                  value={selectedBranch}
                  onValueChange={handleBranchChange}
                  className="p-1.5"
                >
                  {localBranches.length > 0 && (
                    <>
                      <p className="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wide uppercase">
                        Local
                      </p>
                      {localBranches.map((branch) => (
                        <DropdownMenuRadioItem
                          key={`local-${branch.name}`}
                          value={branch.name}
                          className="rounded-md py-2 text-xs leading-snug"
                        >
                          <span className="truncate">{branch.name}</span>
                          {branch.isCurrent && (
                            <span className="text-muted ml-auto text-[10px]">
                              current
                            </span>
                          )}
                        </DropdownMenuRadioItem>
                      ))}
                    </>
                  )}
                  {localBranches.length > 0 && remoteBranches.length > 0 && (
                    <DropdownMenuSeparator className="my-1" />
                  )}
                  {remoteBranches.length > 0 && (
                    <>
                      <p className="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wide uppercase">
                        Remote
                      </p>
                      {remoteBranches.map((branch) => (
                        <DropdownMenuRadioItem
                          key={`remote-${branch.name}`}
                          value={branch.name}
                          className="rounded-md py-2 text-xs leading-snug"
                        >
                          <span className="truncate">{branch.name}</span>
                          <span className="text-muted ml-auto text-[10px]">
                            origin
                          </span>
                        </DropdownMenuRadioItem>
                      ))}
                    </>
                  )}
                </DropdownMenuRadioGroup>
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="border-border-subtle bg-panel-elevated/80 h-8 w-8 shrink-0"
          title="Pull latest from selected branch"
          disabled={busy || !(selectedBranch || currentBranch)}
          onClick={handlePullLatest}
        >
          {isOperating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      {status && (status.ahead > 0 || status.behind > 0) && (
        <p className="text-muted mt-1.5 px-1 text-[10px] leading-snug">
          {status.ahead > 0 && `${status.ahead} ahead`}
          {status.ahead > 0 && status.behind > 0 && " · "}
          {status.behind > 0 && `${status.behind} behind remote`}
        </p>
      )}
    </div>
  );
}
