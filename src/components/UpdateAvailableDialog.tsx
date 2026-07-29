import {
  IconArrowRight,
  IconDownload,
  IconSparkles,
} from "@tabler/icons-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LatestRelease } from "@/lib/updates";

type UpdateAvailableDialogProps = {
  open: boolean;
  currentVersion: string;
  latest: LatestRelease | null;
  onOpenRelease: () => void;
  onLater: () => void;
  onSkip: () => void;
};

export function UpdateAvailableDialog({
  open,
  currentVersion,
  latest,
  onOpenRelease,
  onLater,
  onSkip,
}: UpdateAvailableDialogProps) {
  const version = latest?.version ?? "";
  const releaseLabel = latest?.name?.trim() || `Foxinal v${version}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onLater();
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[min(100%-2.5rem,24rem)]">
        <div
          className="relative overflow-hidden border-b border-line px-5 pt-5 pb-4"
          style={{
            background:
              "radial-gradient(120% 90% at 12% -10%, color-mix(in srgb, var(--fox) 28%, transparent), transparent 55%), radial-gradient(90% 70% at 100% 0%, color-mix(in srgb, var(--fox) 12%, transparent), transparent 50%), var(--surface-solid)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 -right-6 size-28 rounded-full bg-fox/20 blur-2xl"
          />
          <DialogHeader className="relative gap-3 text-left">
            <div className="flex items-center gap-3">
              <BrandMark className="size-11 shrink-0 rounded-[22%] shadow-[0_8px_22px_color-mix(in_srgb,var(--fox)_28%,transparent)]" />
              <div className="min-w-0">
                <p className="m-0 inline-flex items-center gap-1.5 text-[0.72rem] font-bold tracking-wide text-fox uppercase">
                  <IconSparkles size={14} stroke={1.75} aria-hidden />
                  New release
                </p>
                <DialogTitle className="mt-0.5 font-(family-name:--font-brand) text-[1.2rem] tracking-tight">
                  {releaseLabel}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border border-line bg-field/55 p-2.5"
            aria-label={`Upgrade from v${currentVersion} to v${version}`}
          >
            <div className="rounded-sm bg-surface-solid/80 px-2.5 py-2 text-center">
              <p className="m-0 text-[0.65rem] font-bold tracking-wide text-ink-muted uppercase">
                Current
              </p>
              <p className="m-0 mt-0.5 font-mono text-[0.9rem] font-bold tabular-nums text-ink">
                v{currentVersion}
              </p>
            </div>
            <IconArrowRight
              className="shrink-0 text-fox"
              size={18}
              stroke={1.75}
              aria-hidden
            />
            <div className="rounded-sm border border-fox/25 bg-fox/10 px-2.5 py-2 text-center">
              <p className="m-0 text-[0.65rem] font-bold tracking-wide text-fox uppercase">
                Latest
              </p>
              <p className="m-0 mt-0.5 font-mono text-[0.9rem] font-bold tabular-nums text-fox">
                v{version}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="button" className="h-10 w-full" onClick={onOpenRelease}>
              <IconDownload size={16} stroke={1.75} aria-hidden />
              <span>Open release page</span>
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 flex-1"
                onClick={onLater}
              >
                Later
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 flex-1 text-ink-muted"
                onClick={onSkip}
              >
                Skip this version
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
