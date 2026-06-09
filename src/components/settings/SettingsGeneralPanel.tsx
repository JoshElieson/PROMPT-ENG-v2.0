import { Check, ExternalLink } from "lucide-react";
import type { HTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { cn } from "@/lib/utils";

interface SettingsToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  targetId?: string;
}

function SettingsToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  targetId,
}: SettingsToggleRowProps) {
  return (
    <div
      className="flex items-start justify-between gap-6 py-3"
      data-ai-target={targetId}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {description}
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SettingsSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide">
      {children}
    </p>
  );
}

function SettingsCard({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "border-border-subtle bg-panel/60 rounded-xl border px-4 py-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

const SETTINGS_SELECT_CLASS =
  "border-border-subtle bg-panel-elevated/80 text-foreground focus:border-[#6366f1]/60 h-9 w-full rounded-md border px-2 text-xs outline-none";

export function SettingsGeneralPanel() {
  const { settings, setSetting } = useAppSettings();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <SettingsSectionLabel>Account</SettingsSectionLabel>
      <SettingsCard
        className="flex items-center justify-between gap-4"
        data-ai-target="settings.general.account"
      >
        <div>
          <p className="text-sm font-medium text-foreground">Forge Account</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Manage your account and billing
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0">
          Open
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </SettingsCard>

      <div>
        <SettingsSectionLabel>Notifications</SettingsSectionLabel>
        <div className="border-border-subtle divide-border-subtle divide-y rounded-xl border px-4">
          <SettingsToggleRow
            title="System Notifications"
            description="Show system notifications when Agent completes or needs attention"
            checked={settings.systemNotifications}
            onCheckedChange={(checked) => setSetting("systemNotifications", checked)}
            targetId="settings.general.system-notifications"
          />
          <SettingsToggleRow
            title="Automation Notifications"
            description="Show system notifications when an automation completes"
            checked={settings.automationNotifications}
            onCheckedChange={(checked) =>
              setSetting("automationNotifications", checked)
            }
            targetId="settings.general.automation-notifications"
          />
          <SettingsToggleRow
            title="Warning Notifications"
            description="Show warning-level in-app toasts"
            checked={settings.warningNotifications}
            onCheckedChange={(checked) => setSetting("warningNotifications", checked)}
            targetId="settings.general.warning-notifications"
          />
          <SettingsToggleRow
            title="System Tray Icon"
            description="Show Forge in system tray"
            checked={settings.systemTrayIcon}
            onCheckedChange={(checked) => setSetting("systemTrayIcon", checked)}
            targetId="settings.general.system-tray"
          />
          <SettingsToggleRow
            title="Completion Sound"
            description="Play a sound when Agent finishes responding"
            checked={settings.completionSound}
            onCheckedChange={(checked) => setSetting("completionSound", checked)}
            targetId="settings.general.completion-sound"
          />
        </div>
      </div>

      <div>
        <SettingsSectionLabel>Privacy</SettingsSectionLabel>
        <SettingsCard data-ai-target="settings.general.data-sharing">
          <div className="flex items-start gap-2">
            <Check
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                settings.dataSharingEnabled
                  ? "text-emerald-400"
                  : "text-muted-foreground",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Data Sharing</p>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                Your prompts, edits, and usage data may be stored and used to
                improve Forge models and product experience. You can change this
                anytime.
              </p>
              <select
                value={settings.dataSharingEnabled ? "enabled" : "disabled"}
                onChange={(event) =>
                  setSetting("dataSharingEnabled", event.target.value === "enabled")
                }
                className={cn(SETTINGS_SELECT_CLASS, "mt-3 max-w-sm")}
                aria-label="Data sharing preference"
              >
                <option value="enabled">Share data to improve Forge</option>
                <option value="disabled">Don't share my data</option>
              </select>
            </div>
          </div>
        </SettingsCard>
      </div>

      <Button type="button" variant="outline" className="w-fit">
        Log Out
      </Button>
    </div>
  );
}
