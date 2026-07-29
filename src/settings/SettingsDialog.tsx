import {
  IconCheck,
  IconDownload,
  IconInfoCircle,
  IconLock,
  IconRefresh,
  IconSettings,
  IconShieldLock,
  IconTerminal2,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DialogIcon } from "@/components/DialogIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SecretInput } from "@/components/ui/secret-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { InventoryItem } from "@/inventory/types";
import { toast } from "@/lib/toast";
import {
  checkForUpdates,
  openReleasePage,
  skipVersion,
  type UpdateCheckResult,
} from "@/lib/updates";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_VERSION } from "@/lib/version";
import {
  hasMasterPassword,
  MASTER_PASSWORD_MIN_LENGTH,
} from "@/security/masterPassword";
import {
  AUTO_LOCK_MINUTE_OPTIONS,
  saveSecurityPrefs,
  type SecurityPrefs,
} from "@/security/prefs";
import {
  changeMasterPassword,
  disableMasterPassword,
  enableMasterPassword,
} from "@/security/session";
import {
  DEFAULT_TERMINAL_PREFS,
  TERMINAL_FONTS,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
  TERMINAL_THEMES,
  fontFamilyForId,
  resolveTerminalTheme,
  type TerminalPrefs,
  type TerminalThemeId,
} from "./terminalPrefs";

type SettingsSection = "terminal" | "account" | "security" | "about";

/** Keep Foxinal segmented control inside the rail (reset shadcn Tabs chrome). */
const SETTINGS_TAB_TRIGGER_CLASS = cn(
  "!h-auto min-h-0 min-w-[4.5rem] flex-1 shrink",
  "inline-flex items-center justify-center gap-[0.35rem]",
  "rounded-[calc(var(--radius-md)-0.2rem)] border-0 bg-transparent",
  "px-2 py-[0.55rem] text-[0.78rem] leading-none font-semibold",
  "text-ink-muted shadow-none",
  "after:!hidden after:content-none",
  "hover:bg-transparent hover:text-ink",
  "data-active:!bg-surface-solid data-active:!text-ink data-active:!shadow-(--shadow-sm)",
  "dark:data-active:!border-transparent dark:data-active:!bg-surface-solid dark:data-active:!text-ink",
  "max-[720px]:[&>span]:hidden",
);

const SETTINGS_SECTION_CLASS = cn(
  "mt-0 flex flex-col gap-[0.85rem]",
  "motion-safe:animate-[panel-rise_0.28s_var(--ease)_both]",
  "data-[state=inactive]:!hidden",
);

const THEME_SWATCH_BG: Record<string, string> = {
  system: "bg-[linear-gradient(135deg,#f7f6fa_50%,#0f0e14_50%)]",
  dark: "bg-[#0f0e14]",
  light: "bg-[#f7f6fa]",
  fox: "bg-[linear-gradient(135deg,#ea580c,#1a100c)]",
};

type SettingsDialogProps = {
  open: boolean;
  appTheme: string;
  terminalPrefs: TerminalPrefs;
  inventoryItems: InventoryItem[];
  securityEnabled: boolean;
  securityPrefs: SecurityPrefs;
  onChangeTerminalPrefs: (prefs: TerminalPrefs) => void;
  onSecurityChange: () => void;
  onVaultKeyChange: (key: CryptoKey | null) => void;
  onSecurityPrefsChange: (prefs: SecurityPrefs) => void;
  onClose: () => void;
};

export function SettingsDialog({
  open,
  appTheme,
  terminalPrefs,
  inventoryItems,
  securityEnabled,
  securityPrefs,
  onChangeTerminalPrefs,
  onSecurityChange,
  onVaultKeyChange,
  onSecurityPrefsChange,
  onClose,
}: SettingsDialogProps) {
  const [section, setSection] = useState<SettingsSection>("terminal");
  const [draft, setDraft] = useState<TerminalPrefs>(terminalPrefs);
  const [securityOn, setSecurityOn] = useState(securityEnabled);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [removePassword, setRemovePassword] = useState("");
  const [securityBusy, setSecurityBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(
    null,
  );
  const [bodyHeight, setBodyHeight] = useState<number | undefined>(undefined);
  const bodyInnerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSection("terminal");
    setDraft(terminalPrefs);
    setSecurityOn(hasMasterPassword());
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    setRemovePassword("");
    setUpdateResult(null);
    setUpdateBusy(false);
    setBodyHeight(undefined);
  }, [open, terminalPrefs]);

  useLayoutEffect(() => {
    if (!open) return;
    const node = bodyInnerRef.current;
    if (!node) return;

    const syncHeight = () => {
      setBodyHeight(node.scrollHeight);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, section, securityOn, updateResult, updateBusy]);

  const dirty =
    draft.fontId !== terminalPrefs.fontId ||
    draft.fontSize !== terminalPrefs.fontSize ||
    draft.theme !== terminalPrefs.theme;

  const previewTheme = resolveTerminalTheme(draft.theme, appTheme);

  function updateDraft<K extends keyof TerminalPrefs>(
    key: K,
    value: TerminalPrefs[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyTerminal() {
    onChangeTerminalPrefs(draft);
  }

  function resetTerminal() {
    setDraft({ ...DEFAULT_TERMINAL_PREFS });
    onChangeTerminalPrefs({ ...DEFAULT_TERMINAL_PREFS });
  }

  function clearSecurityForm() {
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    setRemovePassword("");
  }

  function updateSecurityPrefs(patch: Partial<SecurityPrefs>) {
    const next = { ...securityPrefs, ...patch };
    saveSecurityPrefs(next);
    onSecurityPrefsChange(next);
  }

  async function handleSetMasterPassword(e: FormEvent) {
    e.preventDefault();

    if (securityOn && !currentPassword) {
      toast.error("Enter your current master password.");
      return;
    }

    if (nextPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setSecurityBusy(true);
    try {
      const result = securityOn
        ? await changeMasterPassword(
            currentPassword,
            nextPassword,
            inventoryItems,
          )
        : await enableMasterPassword(nextPassword, inventoryItems);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSecurityOn(true);
      onVaultKeyChange(result.key);
      clearSecurityForm();
      toast.success(
        securityOn
          ? "Master password updated. Inventory re-encrypted."
          : "Master password set. Inventory is encrypted on this device.",
      );
      onSecurityChange();
    } finally {
      setSecurityBusy(false);
    }
  }

  async function handleRemoveMasterPassword(e?: FormEvent) {
    e?.preventDefault();

    if (!removePassword) {
      toast.error("Enter your master password to remove it.");
      return;
    }

    setSecurityBusy(true);
    try {
      const result = await disableMasterPassword(
        removePassword,
        inventoryItems,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSecurityOn(false);
      onVaultKeyChange(null);
      clearSecurityForm();
      updateSecurityPrefs({
        autoLockEnabled: false,
        lockOnBlurEnabled: false,
      });
      toast.success(
        "Master password removed. Inventory stored in plaintext again.",
      );
      onSecurityChange();
    } finally {
      setSecurityBusy(false);
    }
  }

  async function handleCheckForUpdates() {
    if (updateBusy) return;
    setUpdateBusy(true);
    setUpdateResult(null);
    try {
      const result = await checkForUpdates({ force: true });
      setUpdateResult(result);
      if (result.status === "up-to-date") {
        toast.success("You’re up to date.", `Foxinal v${APP_VERSION}`);
      } else if (result.status === "available") {
        toast.info(`Update available: v${result.latest.version}`);
      } else if (result.status === "error") {
        toast.error(result.error);
      }
    } finally {
      setUpdateBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !securityBusy && !updateBusy) onClose();
      }}
    >
      <DialogContent
        size="settings"
        showCloseButton={false}
        className="gap-0"
        aria-busy={securityBusy || undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <DialogHeader>
            <DialogIcon>
              <IconSettings size={22} stroke={1.75} />
            </DialogIcon>
            <div>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Preferences for this app instance.
              </DialogDescription>
            </div>
          </DialogHeader>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0 rounded-[var(--radius-xs)] text-ink-muted hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink"
            aria-label="Close settings"
            onClick={onClose}
          >
            <IconX size={18} stroke={1.75} aria-hidden />
          </Button>
        </div>

        <Tabs
          value={section}
          onValueChange={(value) => setSection(value as SettingsSection)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <TabsList
            aria-label="Settings sections"
            className="!mt-4 !mb-[0.95rem] !flex !h-auto min-h-0 w-full flex-wrap items-stretch justify-stretch gap-1 overflow-hidden rounded-[var(--radius-md)] border border-line bg-[var(--field-bg)] !p-[0.2rem] group-data-horizontal/tabs:!h-auto"
          >
            <TabsTrigger value="terminal" className={SETTINGS_TAB_TRIGGER_CLASS}>
              <IconTerminal2 size={16} stroke={1.75} aria-hidden />
              <span>Terminal</span>
            </TabsTrigger>
            <TabsTrigger value="account" className={SETTINGS_TAB_TRIGGER_CLASS}>
              <IconUser size={16} stroke={1.75} aria-hidden />
              <span>Account</span>
            </TabsTrigger>
            <TabsTrigger value="security" className={SETTINGS_TAB_TRIGGER_CLASS}>
              <IconShieldLock size={16} stroke={1.75} aria-hidden />
              <span>Security</span>
            </TabsTrigger>
            <TabsTrigger value="about" className={SETTINGS_TAB_TRIGGER_CLASS}>
              <IconInfoCircle size={16} stroke={1.75} aria-hidden />
              <span>About</span>
            </TabsTrigger>
          </TabsList>

          <div
            className={cn(
              "min-h-0 max-h-full flex-[0_1_auto] overflow-x-hidden overflow-y-auto pr-[0.15rem] [scrollbar-width:thin]",
              bodyHeight !== undefined &&
                "motion-safe:transition-[height] motion-safe:duration-300 motion-safe:ease-[var(--ease)]",
            )}
            style={
              bodyHeight !== undefined ? { height: bodyHeight } : undefined
            }
          >
            <div ref={bodyInnerRef} className="block">
              <TabsContent value="terminal" className={SETTINGS_SECTION_CLASS}>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="term-font"
                    className="text-[0.78rem] font-semibold"
                  >
                    Font
                  </Label>
                  <Select
                    value={draft.fontId}
                    onValueChange={(value) => updateDraft("fontId", value)}
                  >
                    <SelectTrigger
                      id="term-font"
                      className="!h-10 w-full min-w-0 rounded-[var(--radius-sm)] border-line bg-[var(--field-bg)]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMINAL_FONTS.map((font) => (
                        <SelectItem key={font.id} value={font.id}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2.5">
                  <Label
                    htmlFor="term-size"
                    className="text-[0.78rem] font-semibold"
                  >
                    Size{" "}
                    <em className="ml-[0.35rem] not-italic font-bold text-fox">
                      {draft.fontSize}px
                    </em>
                  </Label>
                  <Slider
                    id="term-size"
                    min={TERMINAL_FONT_SIZE_MIN}
                    max={TERMINAL_FONT_SIZE_MAX}
                    step={1}
                    value={[draft.fontSize]}
                    onValueChange={(value) =>
                      updateDraft("fontSize", value[0] ?? draft.fontSize)
                    }
                    className="py-1"
                  />
                </div>

                <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
                  <legend className="mb-[0.35rem] inline-flex items-center gap-[0.3rem] text-[0.78rem] font-semibold text-ink">
                    Theme
                  </legend>
                  <div
                    className="grid grid-cols-2 gap-[0.45rem]"
                    role="group"
                    aria-label="Terminal theme"
                  >
                    {TERMINAL_THEMES.map((theme) => (
                      <Button
                        key={theme.id}
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-auto justify-start gap-2 rounded-[var(--radius-sm)] border-line bg-[var(--field-bg)] px-[0.65rem] py-[0.55rem] text-left text-[0.8rem] font-semibold text-ink-muted shadow-none",
                          draft.theme === theme.id &&
                            "border-[color-mix(in_srgb,var(--fox)_45%,var(--line))] bg-[color-mix(in_srgb,var(--fox)_8%,var(--field-bg))] text-ink hover:bg-[color-mix(in_srgb,var(--fox)_8%,var(--field-bg))]",
                        )}
                        aria-pressed={draft.theme === theme.id}
                        onClick={() =>
                          updateDraft("theme", theme.id as TerminalThemeId)
                        }
                      >
                        <span
                          className={cn(
                            "size-[1.15rem] shrink-0 rounded-[0.3rem] border border-line",
                            THEME_SWATCH_BG[theme.id],
                          )}
                          aria-hidden
                        />
                        <span>{theme.label}</span>
                      </Button>
                    ))}
                  </div>
                </fieldset>

                <p
                  className="m-0 overflow-hidden rounded-[var(--radius-sm)] border border-line px-[0.85rem] py-3 font-mono leading-[1.45] text-ellipsis whitespace-nowrap transition-[background-color,color,border-color] duration-150 ease-[var(--ease)]"
                  style={{
                    fontFamily: fontFamilyForId(draft.fontId),
                    fontSize: draft.fontSize,
                    background: previewTheme.background,
                    color: previewTheme.foreground,
                    borderColor: previewTheme.selectionBackground,
                  }}
                >
                  <span style={{ color: previewTheme.green }}>user</span>
                  <span style={{ color: previewTheme.foreground }}>@</span>
                  <span style={{ color: previewTheme.cyan }}>foxinal</span>
                  <span style={{ color: previewTheme.foreground }}>:</span>
                  <span style={{ color: previewTheme.blue }}>~</span>
                  <span style={{ color: previewTheme.foreground }}>$ </span>
                  <span style={{ color: previewTheme.foreground }}>echo </span>
                  <span style={{ color: previewTheme.yellow }}>
                    &quot;preview&quot;
                  </span>
                </p>

                <div className="mt-[0.35rem] flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetTerminal}>
                    <span>Reset</span>
                  </Button>
                  <Button
                    type="button"
                    disabled={!dirty}
                    onClick={applyTerminal}
                  >
                    <IconCheck size={16} stroke={1.75} aria-hidden />
                    <span>Apply</span>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="account" className={SETTINGS_SECTION_CLASS}>
                <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-line bg-[var(--field-bg)] p-[0.85rem]">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-fox/12 text-fox"
                    aria-hidden
                  >
                    <IconLock size={18} stroke={1.75} />
                  </span>
                  <div>
                    <p className="m-0 font-bold tracking-tight text-ink">
                      Local mode
                    </p>
                    <p className="mt-[0.2rem] mb-0 text-[0.8125rem] leading-snug text-ink-muted">
                      Data stays on this device. Server sync is not enabled yet.
                    </p>
                  </div>
                </div>
                <p className="m-0 text-[0.78rem] leading-[1.45] text-ink-muted">
                  Account sync and profile options will show up here in a later
                  release. Use the Security tab for master password and lock
                  behavior.
                </p>
              </TabsContent>

              <TabsContent value="security" className={SETTINGS_SECTION_CLASS}>
                <div className="flex items-start gap-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--leaf)_12%,transparent)] text-[var(--leaf)]"
                    aria-hidden
                  >
                    <IconShieldLock size={18} stroke={1.75} />
                  </span>
                  <div>
                    <h3
                      id="security-heading"
                      className="m-0 text-[0.95rem] font-bold tracking-tight text-ink"
                    >
                      Master password
                    </h3>
                    <p className="mt-[0.2rem] mb-0 text-[0.8125rem] leading-snug text-ink-muted">
                      {securityOn
                        ? "Encrypts your inventory and unlocks Foxinal on this device."
                        : "Optional. Encrypt inventory and require unlock on launch."}
                    </p>
                  </div>
                </div>

                <form
                  className="flex flex-col gap-3"
                  onSubmit={handleSetMasterPassword}
                >
                  {securityOn ? (
                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor="mp-current"
                        className="text-[0.78rem] font-semibold"
                      >
                        Current master password
                      </Label>
                      <SecretInput
                        id="mp-current"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) =>
                          setCurrentPassword(e.currentTarget.value)
                        }
                        placeholder="••••••••"
                        disabled={securityBusy}
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="mp-new"
                      className="text-[0.78rem] font-semibold"
                    >
                      {securityOn ? "New master password" : "Master password"}
                    </Label>
                    <SecretInput
                      id="mp-new"
                      autoComplete="new-password"
                      value={nextPassword}
                      onChange={(e) => setNextPassword(e.currentTarget.value)}
                      placeholder={`At least ${MASTER_PASSWORD_MIN_LENGTH} characters`}
                      disabled={securityBusy}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="mp-confirm"
                      className="text-[0.78rem] font-semibold"
                    >
                      Confirm master password
                    </Label>
                    <SecretInput
                      id="mp-confirm"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) =>
                        setConfirmPassword(e.currentTarget.value)
                      }
                      placeholder="••••••••"
                      disabled={securityBusy}
                    />
                  </div>

                  <div className="flex flex-wrap gap-[0.45rem]">
                    <Button
                      type="submit"
                      disabled={
                        securityBusy ||
                        !nextPassword ||
                        !confirmPassword ||
                        (securityOn && !currentPassword)
                      }
                    >
                      <IconCheck size={16} stroke={1.75} aria-hidden />
                      <span>
                        {securityBusy
                          ? "Saving…"
                          : securityOn
                            ? "Update password"
                            : "Set master password"}
                      </span>
                    </Button>
                  </div>
                </form>

                <div
                  className={cn(
                    "flex flex-col gap-3 rounded-[var(--radius-md)] border border-line bg-field/50 p-3",
                    !securityOn && "opacity-60",
                  )}
                >
                  <div>
                    <p className="m-0 text-[0.85rem] font-bold tracking-tight text-ink">
                      Lock behavior
                    </p>
                    <p className="mt-[0.2rem] mb-0 text-[0.8125rem] leading-snug text-ink-muted">
                      {securityOn
                        ? "Choose when Foxinal should lock and require your master password again."
                        : "Available after you set a master password."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor="auto-lock-enabled"
                      className="text-[0.8125rem] font-semibold"
                    >
                      Auto-lock after inactivity
                    </Label>
                    <Switch
                      id="auto-lock-enabled"
                      checked={securityPrefs.autoLockEnabled}
                      disabled={!securityOn}
                      onCheckedChange={(checked) =>
                        updateSecurityPrefs({
                          autoLockEnabled: checked,
                        })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="auto-lock-minutes"
                      className="text-[0.78rem] font-semibold"
                    >
                      Idle timeout
                    </Label>
                    <Select
                      value={String(securityPrefs.autoLockMinutes)}
                      onValueChange={(value) =>
                        updateSecurityPrefs({
                          autoLockMinutes: Number(value),
                        })
                      }
                      disabled={!securityOn || !securityPrefs.autoLockEnabled}
                    >
                      <SelectTrigger
                        id="auto-lock-minutes"
                        className="!h-10 w-full min-w-0"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUTO_LOCK_MINUTE_OPTIONS.map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)}>
                            {minutes} minute{minutes === 1 ? "" : "s"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor="lock-on-blur"
                      className="text-[0.8125rem] font-semibold"
                    >
                      Lock when app is hidden
                    </Label>
                    <Switch
                      id="lock-on-blur"
                      checked={securityPrefs.lockOnBlurEnabled}
                      disabled={!securityOn}
                      onCheckedChange={(checked) =>
                        updateSecurityPrefs({
                          lockOnBlurEnabled: checked,
                        })
                      }
                    />
                  </div>
                </div>

                {securityOn ? (
                  <form
                    className="flex flex-col gap-3 border-t border-line pt-3"
                    onSubmit={(e) => void handleRemoveMasterPassword(e)}
                  >
                    <p className="m-0 text-[0.8125rem] leading-snug text-ink-muted">
                      Removing the master password decrypts inventory to
                      plaintext and opens Foxinal unlocked.
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor="mp-remove"
                        className="text-[0.78rem] font-semibold"
                      >
                        Confirm master password
                      </Label>
                      <SecretInput
                        id="mp-remove"
                        autoComplete="current-password"
                        value={removePassword}
                        onChange={(e) =>
                          setRemovePassword(e.currentTarget.value)
                        }
                        placeholder="••••••••"
                        disabled={securityBusy}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={securityBusy || !removePassword.trim()}
                    >
                      <span>
                        {securityBusy ? "Removing…" : "Remove master password"}
                      </span>
                    </Button>
                  </form>
                ) : null}
              </TabsContent>

              <TabsContent
                value="about"
                className={cn(
                  SETTINGS_SECTION_CLASS,
                  "items-center px-2 py-6 text-center",
                )}
              >
                <p className="m-0 font-(family-name:--font-brand) text-2xl font-bold tracking-tight text-ink">
                  {APP_NAME}
                </p>
                <p className="mt-[0.35rem] mb-0 text-[0.95rem] font-semibold text-fox">
                  v{APP_VERSION}
                </p>
                <p className="m-0 text-[0.78rem] leading-[1.45] text-ink-muted">
                  Manage local terminals and SSH hosts in one place.
                </p>

                <div className="mt-5 flex w-full max-w-72 flex-col items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full"
                    disabled={updateBusy}
                    onClick={() => void handleCheckForUpdates()}
                  >
                    <IconRefresh size={16} stroke={1.75} aria-hidden />
                    <span>
                      {updateBusy ? "Checking…" : "Check for updates"}
                    </span>
                  </Button>

                  {updateResult?.status === "up-to-date" ? (
                    <p className="m-0 text-[0.78rem] font-semibold text-ink-muted">
                      You’re up to date.
                    </p>
                  ) : null}

                  {updateResult?.status === "available" ? (
                    <div className="flex w-full flex-col items-center gap-2">
                      <p className="m-0 text-[0.78rem] font-semibold text-ink">
                        v{updateResult.latest.version} is available
                        {updateResult.skipped ? " (skipped)" : ""}.
                      </p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            void openReleasePage(
                              updateResult.latest.htmlUrl,
                            ).catch(() => {
                              toast.error("Could not open the release page.");
                            });
                          }}
                        >
                          <IconDownload size={16} stroke={1.75} aria-hidden />
                          <span>Open release</span>
                        </Button>
                        {!updateResult.skipped ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              skipVersion(updateResult.latest.version);
                              setUpdateResult({
                                ...updateResult,
                                skipped: true,
                              });
                              toast.message(
                                `Skipped v${updateResult.latest.version}`,
                              );
                            }}
                          >
                            Skip this version
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {updateResult?.status === "error" ? (
                    <p className="m-0 text-[0.78rem] font-semibold text-destructive">
                      {updateResult.error}
                    </p>
                  ) : null}
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
