import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indeterminate?: boolean;
};

function Progress({
  className,
  value,
  indeterminate = false,
  ...props
}: ProgressProps) {
  if (indeterminate) {
    return (
      <div
        data-slot="progress"
        role="progressbar"
        aria-valuetext="In progress"
        className={cn(
          "relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/10",
          className
        )}
        {...(props as React.ComponentProps<"div">)}
      >
        <div
          data-slot="progress-indicator"
          className="absolute inset-y-0 w-[35%] rounded-full bg-primary motion-safe:animate-fox-indeterminate"
        />
      </div>
    );
  }

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-foreground/10",
        className
      )}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
