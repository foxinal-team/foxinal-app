import {
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  theme: string;
  label?: string;
  onCycle: () => void;
  className?: string;
};

function ThemeIcon({ theme }: { theme: string }) {
  const props = { size: 18, stroke: 1.75, "aria-hidden": true as const };
  if (theme === "dark") return <IconMoon {...props} />;
  if (theme === "system") return <IconDeviceDesktop {...props} />;
  return <IconSun {...props} />;
}

export function ThemeToggle({
  theme,
  label = theme,
  onCycle,
  className,
}: ThemeToggleProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onCycle}
      aria-label={`Theme: ${label}`}
      title={`Theme: ${label}`}
      className={cn(
        "size-[var(--control-h)] bg-[var(--toggle-bg)] backdrop-blur-[var(--blur-sm)] shrink-0",
        className
      )}
    >
      <ThemeIcon theme={theme} />
    </Button>
  );
}
