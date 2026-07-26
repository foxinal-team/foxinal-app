import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Accent icon badge used in dialog headers. */
export function DialogIcon({
  children,
  tone = "fox",
  className,
}: {
  children: ReactNode;
  tone?: "fox" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mb-0.5 grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)]",
        tone === "danger"
          ? "bg-destructive/12 text-destructive"
          : "bg-fox/12 text-fox",
        className
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}
