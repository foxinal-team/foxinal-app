import { IconLoader2, type IconProps } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

function Spinner({
  className,
  size = 16,
  ...props
}: IconProps) {
  return (
    <IconLoader2
      role="presentation"
      aria-hidden
      size={size}
      stroke={1.75}
      data-slot="spinner"
      className={cn("animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Spinner };
