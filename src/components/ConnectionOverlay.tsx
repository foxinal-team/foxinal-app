import {
  IconAlertTriangle,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ConnectionOverlayProps = {
  variant: "connecting" | "error";
  title: string;
  hostLabel?: string;
  meta?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Flush into a pane (no card border / radius). */
  embedded?: boolean;
  className?: string;
};

export function ConnectionOverlay({
  variant,
  title,
  hostLabel,
  meta,
  message,
  onRetry,
  retryLabel = "Retry",
  onDismiss,
  dismissLabel = "Close",
  embedded = false,
  className,
}: ConnectionOverlayProps) {
  const connecting = variant === "connecting";

  return (
    <div
      className={cn(
        "absolute inset-0 z-2 grid place-items-center overflow-hidden",
        "bg-[radial-gradient(110%_70%_at_15%_0%,color-mix(in_srgb,var(--fox)_16%,transparent),transparent_55%),var(--surface-solid)]",
        "motion-safe:animate-[panel-rise_0.35s_var(--ease-fox)_both]",
        !embedded && "rounded-md border border-line",
        className
      )}
      role={connecting ? "status" : "alert"}
      aria-live={connecting ? "polite" : "assertive"}
    >
      {connecting ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="size-56 rounded-full bg-fox/15 blur-[30px] motion-safe:animate-fox-pulse" />
        </div>
      ) : null}

      <div className="relative z-1 flex w-[min(20rem,calc(100%-2rem))] flex-col items-center gap-1 px-5 py-5 text-center">
        <span
          aria-hidden
          className={cn(
            "mb-1.5 grid size-11 place-items-center rounded-full",
            connecting
              ? "bg-fox/12 text-fox"
              : "bg-destructive/12 text-destructive"
          )}
        >
          {connecting ? (
            <Spinner size={28} />
          ) : (
            <IconAlertTriangle size={28} stroke={1.75} />
          )}
        </span>

        <p className="m-0 font-(family-name:--font-brand) text-[1.05rem] font-bold tracking-tight text-ink">
          {title}
        </p>

        {hostLabel ? (
          <p className="m-0 mt-0.5 text-[0.9rem] font-semibold text-ink">
            {hostLabel}
          </p>
        ) : null}

        {connecting && meta ? (
          <p className="m-0 text-[0.78rem] leading-snug text-ink-muted">{meta}</p>
        ) : null}

        {!connecting && message ? (
          <p className="mt-1.5 max-w-68 text-[0.78rem] leading-snug text-ink-muted">
            {message}
          </p>
        ) : null}

        {connecting ? (
          <Progress indeterminate aria-hidden className="mt-3.5 h-1" />
        ) : (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {onRetry ? (
              <Button type="button" size="sm" onClick={onRetry}>
                <IconRefresh size={16} stroke={1.75} aria-hidden />
                <span>{retryLabel}</span>
              </Button>
            ) : null}
            {onDismiss ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDismiss}
              >
                <IconX size={16} stroke={1.75} aria-hidden />
                <span>{dismissLabel}</span>
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
