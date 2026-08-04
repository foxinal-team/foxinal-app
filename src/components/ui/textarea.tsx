import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "box-border min-h-24 w-full min-w-0 max-w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--field-bg)] px-3 py-2 text-base font-medium text-foreground transition-colors outline-none",
        "placeholder:text-[var(--placeholder)]",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        "md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
