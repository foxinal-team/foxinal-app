import {
  IconAlertCircle,
  IconCheck,
  IconFile,
  IconFolder,
  IconLock,
  IconShieldLock,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { DialogIcon } from "@/components/DialogIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecretInput } from "@/components/ui/secret-input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HostItem } from "@/inventory/types";
import {
  fsGetProperties,
  fsSetPermissions,
  invokeErrorMessage,
  matrixToMode,
  modeToMatrix,
  modeToOctal,
  modeToSymbolic,
  parseOctalInput,
  sftpGetProperties,
  sftpSetOwnership,
  sftpSetPermissions,
  sftpSudoExec,
} from "../api";
import type {
  FilePermissionsInfo,
  FsEntry,
  PaneConnection,
  PermissionMatrix,
} from "../types";

type SftpPropertiesModalProps = {
  open: boolean;
  onClose: () => void;
  entry: FsEntry | null;
  connection: PaneConnection;
  hostItem?: HostItem;
  onPropertiesUpdated?: () => void;
};

const COMMON_FILE_PRESETS = [
  { label: "644 (Standard)", mode: 0o644 },
  { label: "755 (Executable)", mode: 0o755 },
  { label: "600 (Private)", mode: 0o600 },
  { label: "777 (Full Access)", mode: 0o777 },
];

const COMMON_DIR_PRESETS = [
  { label: "755 (Standard)", mode: 0o755 },
  { label: "700 (Private)", mode: 0o700 },
  { label: "775 (Group Shared)", mode: 0o775 },
  { label: "777 (Full Access)", mode: 0o777 },
];

export function SftpPropertiesModal({
  open,
  onClose,
  entry,
  connection,
  hostItem,
  onPropertiesUpdated,
}: SftpPropertiesModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Loaded metadata
  const [info, setInfo] = useState<FilePermissionsInfo | null>(null);

  // Form states
  const [activeTab, setActiveTab] = useState<"permissions" | "general">(
    "permissions",
  );
  const [matrix, setMatrix] = useState<PermissionMatrix>({
    owner: { read: true, write: true, exec: false },
    group: { read: true, write: false, exec: false },
    others: { read: true, write: false, exec: false },
  });
  const [octalText, setOctalText] = useState("0644");
  const [recursive, setRecursive] = useState(false);

  // Ownership form states
  const [ownerUser, setOwnerUser] = useState("");
  const [ownerGroup, setOwnerGroup] = useState("");

  // Sudo elevation states
  const [showSudoPrompt, setShowSudoPrompt] = useState(false);
  const [sudoPassword, setSudoPassword] = useState("");
  const [sudoRunning, setSudoRunning] = useState(false);
  const [sudoError, setSudoError] = useState<string | null>(null);

  // Load properties when modal opens
  useEffect(() => {
    if (!open || !entry) {
      setInfo(null);
      setError(null);
      setSuccessMsg(null);
      setShowSudoPrompt(false);
      setSudoPassword("");
      setSudoError(null);
      return;
    }

    const targetPath = entry.path;
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      setShowSudoPrompt(false);
      try {
        const data =
          connection.kind === "local"
            ? await fsGetProperties(targetPath)
            : await sftpGetProperties(connection.sessionId, targetPath);

        if (!isMounted) return;
        setInfo(data);
        setMatrix(modeToMatrix(data.mode));
        setOctalText(modeToOctal(data.mode));
        setOwnerUser(data.user || (data.uid !== undefined ? String(data.uid) : ""));
        setOwnerGroup(
          data.group || (data.gid !== undefined ? String(data.gid) : ""),
        );
      } catch (err) {
        if (!isMounted) return;
        setError(invokeErrorMessage(err, "Failed to load file properties."));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [open, entry?.path, connection.kind, connection.kind === "remote" ? connection.sessionId : "local"]);

  // Keep matrix and octal in sync
  function handleMatrixChange(
    role: "owner" | "group" | "others",
    perm: "read" | "write" | "exec",
    checked: boolean,
  ) {
    const nextMatrix: PermissionMatrix = {
      ...matrix,
      [role]: {
        ...matrix[role],
        [perm]: checked,
      },
    };
    setMatrix(nextMatrix);
    const special = (info?.mode ?? 0) & 0o7000;
    const nextMode = matrixToMode(nextMatrix, special);
    setOctalText(modeToOctal(nextMode));
    setError(null);
    setSuccessMsg(null);
  }

  function handleOctalChange(text: string) {
    setOctalText(text);
    const parsed = parseOctalInput(text, info?.mode ?? 0);
    if (parsed !== null) {
      setMatrix(modeToMatrix(parsed));
      setError(null);
    }
  }

  function handlePresetClick(presetMode: number) {
    const special = (info?.mode ?? 0) & 0o7000;
    const finalMode = special | (presetMode & 0o777);
    setMatrix(modeToMatrix(finalMode));
    setOctalText(modeToOctal(finalMode));
    setError(null);
    setSuccessMsg(null);
  }

  const currentComputedMode = useMemo(() => {
    const special = (info?.mode ?? 0) & 0o7000;
    return matrixToMode(matrix, special);
  }, [matrix, info?.mode]);

  const symbolicPreview = useMemo(() => {
    return modeToSymbolic(
      currentComputedMode,
      info?.isDir ?? entry?.kind === "dir",
      info?.isSymlink,
    );
  }, [currentComputedMode, info?.isDir, info?.isSymlink, entry?.kind]);

  const hasPermissionsChanged = useMemo(() => {
    if (!info) return false;
    return (currentComputedMode & 0o7777) !== (info.mode & 0o7777);
  }, [info, currentComputedMode]);

  const hasOwnershipChanged = useMemo(() => {
    if (!info) return false;
    const initialUser =
      info.user || (info.uid !== undefined ? String(info.uid) : "");
    const initialGroup =
      info.group || (info.gid !== undefined ? String(info.gid) : "");
    return (
      ownerUser.trim() !== initialUser.trim() ||
      ownerGroup.trim() !== initialGroup.trim()
    );
  }, [info, ownerUser, ownerGroup]);

  async function handleApply() {
    if (!entry || !info) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const octalClean = parseOctalInput(octalText, info.mode);
    if (octalClean === null) {
      setError("Please enter a valid 3 or 4-digit octal permission (e.g. 0755 or 644).");
      setSaving(false);
      return;
    }

    try {
      if (connection.kind === "local") {
        if (hasPermissionsChanged) {
          await fsSetPermissions(entry.path, octalClean, recursive);
        }
      } else {
        // Remote SFTP
        if (hasPermissionsChanged) {
          await sftpSetPermissions(
            connection.sessionId,
            entry.path,
            octalClean,
            recursive,
          );
        }
        if (hasOwnershipChanged) {
          await sftpSetOwnership(
            connection.sessionId,
            entry.path,
            ownerUser.trim() || undefined,
            ownerGroup.trim() || undefined,
            recursive,
          );
        }
      }

      setSuccessMsg("Permissions and properties updated successfully.");
      onPropertiesUpdated?.();

      // Refresh info state
      const refreshed =
        connection.kind === "local"
          ? await fsGetProperties(entry.path)
          : await sftpGetProperties(connection.sessionId, entry.path);
      setInfo(refreshed);
      setMatrix(modeToMatrix(refreshed.mode));
      setOctalText(modeToOctal(refreshed.mode));
    } catch (err) {
      const msg = invokeErrorMessage(err, "Failed to update permissions.");
      setError(msg);

      // If remote and permission denied, automatically reveal the Sudo Elevation banner
      if (
        connection.kind === "remote" &&
        (msg.toLowerCase().includes("permission denied") ||
          msg.toLowerCase().includes("operation not permitted") ||
          msg.toLowerCase().includes("status 1"))
      ) {
        setShowSudoPrompt(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleApplySudo() {
    if (!entry || connection.kind !== "remote" || !info) return;
    setSudoRunning(true);
    setSudoError(null);

    const octalClean = parseOctalInput(octalText, info.mode) ?? currentComputedMode;
    const octalStr = modeToOctal(octalClean);
    const recFlag = recursive && info.isDir ? "-R " : "";

    const commands: string[] = [];
    if (hasPermissionsChanged) {
      commands.push(`chmod ${recFlag}${octalStr} "${entry.path}"`);
    }
    if (hasOwnershipChanged) {
      const u = ownerUser.trim();
      const g = ownerGroup.trim();
      const spec =
        u && g ? `${u}:${g}` : u ? u : g ? `:${g}` : "";
      if (spec) {
        commands.push(`chown ${recFlag}${spec} "${entry.path}"`);
      }
    }

    if (commands.length === 0) {
      commands.push(`chmod ${recFlag}${octalStr} "${entry.path}"`);
    }

    try {
      const fullCmd = commands.join(" && ");
      await sftpSudoExec(
        connection.sessionId,
        fullCmd,
        sudoPassword || undefined,
      );

      setSuccessMsg("Updated with elevated privileges (sudo).");
      setShowSudoPrompt(false);
      setError(null);
      onPropertiesUpdated?.();

      const refreshed = await sftpGetProperties(
        connection.sessionId,
        entry.path,
      );
      setInfo(refreshed);
      setMatrix(modeToMatrix(refreshed.mode));
      setOctalText(modeToOctal(refreshed.mode));
    } catch (err) {
      setSudoError(
        invokeErrorMessage(err, "Sudo execution failed. Please check password."),
      );
    } finally {
      setSudoRunning(false);
    }
  }

  const isDir = info?.isDir ?? entry?.kind === "dir";
  const presets = isDir ? COMMON_DIR_PRESETS : COMMON_FILE_PRESETS;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent size="wide" showCloseButton className="max-w-[32rem]">
        {/* Standard Foxinal Dialog Header */}
        <DialogHeader>
          <DialogIcon tone="fox">
            {isDir ? (
              <IconFolder size={20} stroke={1.75} />
            ) : (
              <IconFile size={20} stroke={1.75} />
            )}
          </DialogIcon>
          <div className="min-w-0 flex-1 pr-6">
            <DialogTitle className="truncate text-base font-semibold">
              {info?.name ?? entry?.name ?? "File Properties"}
            </DialogTitle>
            <DialogDescription className="truncate text-xs font-mono select-all">
              {entry?.path ?? (connection.kind === "local" ? "Local Filesystem" : "Remote SFTP Host")}
            </DialogDescription>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <Spinner className="h-5 w-5 text-fox" />
            <span className="text-xs">Reading file properties...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {/* Feedback Alerts */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                <IconAlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{error}</p>
                  {connection.kind === "remote" && !showSudoPrompt && (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 mt-1 text-xs text-destructive underline"
                      onClick={() => setShowSudoPrompt(true)}
                    >
                      Try with elevated privileges (sudo)...
                    </Button>
                  )}
                </div>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-500">
                <IconCheck className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "permissions" | "general")}
              className="w-full flex flex-col gap-3"
            >
              <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-muted">
                <TabsTrigger value="permissions" className="text-xs h-7">
                  Permissions (chmod)
                </TabsTrigger>
                <TabsTrigger value="general" className="text-xs h-7">
                  Ownership & Details
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: PERMISSIONS */}
              <TabsContent value="permissions" className="flex flex-col gap-3.5 focus-visible:outline-none">
                {/* Symbolic Badge & Octal Inputs */}
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--field-bg)] px-3.5 py-2.5">
                  <div>
                    <span className="text-[0.7rem] uppercase tracking-wider font-semibold text-muted-foreground block">
                      Symbolic Notation
                    </span>
                    <div className="mt-0.5 font-mono text-sm font-bold text-fox tracking-wider">
                      {symbolicPreview}
                    </div>
                  </div>

                  <div className="w-24 text-right">
                    <Label htmlFor="octal-input" className="text-[0.7rem] uppercase tracking-wider font-semibold text-muted-foreground block">
                      Octal
                    </Label>
                    <Input
                      id="octal-input"
                      value={octalText}
                      onChange={(e) => handleOctalChange(e.target.value)}
                      maxLength={4}
                      className="mt-0.5 h-8 text-center font-mono font-bold text-sm bg-[var(--surface-solid)]"
                      placeholder="0755"
                    />
                  </div>
                </div>

                {/* 3x3 Permission Matrix */}
                <div className="rounded-[var(--radius-sm)] border border-[var(--line)] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--line)] bg-[var(--field-bg)] text-muted-foreground">
                        <th className="py-2 px-3 text-left font-semibold">Role</th>
                        <th className="py-2 px-3 text-center font-semibold">Read (r)</th>
                        <th className="py-2 px-3 text-center font-semibold">Write (w)</th>
                        <th className="py-2 px-3 text-center font-semibold">Execute (x)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)] bg-[var(--surface-solid)]">
                      {/* Owner */}
                      <tr className="hover:bg-muted/40 transition-colors">
                        <td className="py-2 px-3 font-medium flex items-center gap-1.5">
                          <IconUser size={14} className="text-fox" />
                          Owner (User)
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Checkbox
                            checked={matrix.owner.read}
                            onCheckedChange={(c) =>
                              handleMatrixChange("owner", "read", Boolean(c))
                            }
                            aria-label="Owner Read"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Checkbox
                            checked={matrix.owner.write}
                            onCheckedChange={(c) =>
                              handleMatrixChange("owner", "write", Boolean(c))
                            }
                            aria-label="Owner Write"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Checkbox
                            checked={matrix.owner.exec}
                            onCheckedChange={(c) =>
                              handleMatrixChange("owner", "exec", Boolean(c))
                            }
                            aria-label="Owner Execute"
                          />
                        </td>
                      </tr>

                      {/* Group */}
                      <tr className="hover:bg-muted/40 transition-colors">
                        <td className="py-2 px-3 font-medium flex items-center gap-1.5">
                          <IconUsers size={14} className="text-muted-foreground" />
                          Group
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Checkbox
                            checked={matrix.group.read}
                            onCheckedChange={(c) =>
                              handleMatrixChange("group", "read", Boolean(c))
                            }
                            aria-label="Group Read"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Checkbox
                            checked={matrix.group.write}
                            onCheckedChange={(c) =>
                              handleMatrixChange("group", "write", Boolean(c))
                            }
                            aria-label="Group Write"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Checkbox
                            checked={matrix.group.exec}
                            onCheckedChange={(c) =>
                              handleMatrixChange("group", "exec", Boolean(c))
                            }
                            aria-label="Group Execute"
                          />
                        </td>
                      </tr>

                      {/* Others */}
                      <tr className="hover:bg-muted/40 transition-colors">
                        <td className="py-2 px-3 font-medium flex items-center gap-1.5">
                          <IconLock size={14} className="text-muted-foreground" />
                          Others (Public)
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Checkbox
                            checked={matrix.others.read}
                            onCheckedChange={(c) =>
                              handleMatrixChange("others", "read", Boolean(c))
                            }
                            aria-label="Others Read"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Checkbox
                            checked={matrix.others.write}
                            onCheckedChange={(c) =>
                              handleMatrixChange("others", "write", Boolean(c))
                            }
                            aria-label="Others Write"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Checkbox
                            checked={matrix.others.exec}
                            onCheckedChange={(c) =>
                              handleMatrixChange("others", "exec", Boolean(c))
                            }
                            aria-label="Others Execute"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Common Presets */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[0.7rem] uppercase tracking-wider font-semibold text-muted-foreground">
                    Quick Presets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((preset) => (
                      <Button
                        key={preset.mode}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5 py-0 border-[var(--line)] bg-[var(--field-bg)] hover:bg-muted"
                        onClick={() => handlePresetClick(preset.mode)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Recursive Toggle for Directories */}
                {isDir && (
                  <div className="flex items-center space-x-2 pt-1 border-t border-[var(--line)]">
                    <Checkbox
                      id="recursive-toggle"
                      checked={recursive}
                      onCheckedChange={(c) => setRecursive(Boolean(c))}
                    />
                    <Label
                      htmlFor="recursive-toggle"
                      className="text-xs font-medium cursor-pointer select-none"
                    >
                      Apply recursively to all enclosed files and subfolders
                    </Label>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: GENERAL & DETAILS */}
              <TabsContent value="general" className="flex flex-col gap-3 focus-visible:outline-none text-xs">
                {/* Ownership Management */}
                <div className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3 flex flex-col gap-2.5 bg-[var(--field-bg)]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <IconUser size={15} className="text-fox" />
                      Ownership (chown)
                    </span>
                    {connection.kind === "local" && (
                      <span className="text-[0.7rem] text-muted-foreground">Read-only on local</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label htmlFor="owner-user" className="text-[0.7rem] text-muted-foreground font-medium">
                        Owner / User
                      </Label>
                      <Input
                        id="owner-user"
                        value={ownerUser}
                        onChange={(e) => setOwnerUser(e.target.value)}
                        disabled={connection.kind === "local"}
                        placeholder="e.g. ubuntu or 1000"
                        className="mt-1 h-8 text-xs bg-[var(--surface-solid)]"
                      />
                    </div>

                    <div>
                      <Label htmlFor="owner-group" className="text-[0.7rem] text-muted-foreground font-medium">
                        Group
                      </Label>
                      <Input
                        id="owner-group"
                        value={ownerGroup}
                        onChange={(e) => setOwnerGroup(e.target.value)}
                        disabled={connection.kind === "local"}
                        placeholder="e.g. www-data or 33"
                        className="mt-1 h-8 text-xs bg-[var(--surface-solid)]"
                      />
                    </div>
                  </div>
                </div>

                {/* File Information Specs */}
                <div className="rounded-[var(--radius-sm)] border border-[var(--line)] divide-y divide-[var(--line)] bg-[var(--surface-solid)]">
                  <div className="flex justify-between py-2 px-3">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium font-mono text-[0.72rem] truncate ml-2 select-all text-right max-w-[20rem]" title={entry?.path}>
                      {entry?.path}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 px-3">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">
                      {info?.isSymlink ? "Symbolic Link" : isDir ? "Directory" : "Regular File"}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 px-3">
                    <span className="text-muted-foreground">Size:</span>
                    <span className="font-medium">
                      {info?.sizeLabel} ({info?.size.toLocaleString()} bytes)
                    </span>
                  </div>

                  <div className="flex justify-between py-2 px-3">
                    <span className="text-muted-foreground">Last Modified:</span>
                    <span className="font-medium">{info?.modifiedLabel}</span>
                  </div>

                  <div className="flex justify-between py-2 px-3">
                    <span className="text-muted-foreground">Last Accessed:</span>
                    <span className="font-medium">{info?.accessedLabel}</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Sudo Elevation Section */}
            {showSudoPrompt && connection.kind === "remote" && (
              <div className="rounded-[var(--radius-sm)] border border-fox/40 bg-fox/5 p-3 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <IconShieldLock className="h-5 w-5 text-fox shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold">
                        Elevate with Sudo (Root)
                      </h4>
                      <p className="text-[0.72rem] text-muted-foreground">
                        Execute permission/owner changes with superuser privileges.
                      </p>
                    </div>
                  </div>
                </div>

                {sudoError && (
                  <div className="rounded-[var(--radius-xs)] border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                    {sudoError}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sudo-password" className="text-[0.7rem] text-muted-foreground">
                      Sudo Password {hostItem?.username ? `(for ${hostItem.username})` : ""}
                    </Label>
                    {hostItem?.authMethod === "password" && hostItem.password && (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-[0.7rem] text-fox hover:underline"
                        onClick={() => setSudoPassword(hostItem.password || "")}
                      >
                        Use session password
                      </Button>
                    )}
                  </div>
                  <SecretInput
                    id="sudo-password"
                    value={sudoPassword}
                    onChange={(e) => setSudoPassword(e.target.value)}
                    placeholder="Enter sudo password (optional if passwordless)"
                    className="h-8 text-xs bg-[var(--surface-solid)]"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1.5 bg-fox hover:bg-fox/90 text-white"
                    onClick={() => void handleApplySudo()}
                    disabled={sudoRunning}
                  >
                    {sudoRunning ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <IconShieldLock size={14} />
                    )}
                    Apply with Sudo
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DialogFooter */}
        <DialogFooter className="mt-2 flex items-center justify-between sm:justify-between">
          <div>
            {connection.kind === "remote" && !showSudoPrompt && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                onClick={() => setShowSudoPrompt(true)}
              >
                <IconShieldLock size={14} />
                Elevate...
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8 text-xs font-semibold gap-1.5 bg-fox hover:bg-fox/90 text-white"
              onClick={() => void handleApply()}
              disabled={loading || saving || sudoRunning}
            >
              {saving ? <Spinner className="h-3.5 w-3.5" /> : <IconCheck size={14} stroke={2} />}
              Apply Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
