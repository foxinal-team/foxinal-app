import {
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  theme: string;
  label: string;
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
  label,
  onCycle,
  className,
}: ThemeToggleProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onCycle}
      aria-label={`Theme: ${label}`}
      title={`Theme: ${label}`}
      className={cn(
        "h-[var(--control-h)] gap-1.5 bg-[var(--toggle-bg)] px-3.5 backdrop-blur-[var(--blur-sm)]",
        className
      )}
    >
      <ThemeIcon theme={theme} />
      <span className="inline-block min-w-12.5 text-left" data-mode={theme} aria-hidden>
        {label}
      </span>
    </Button>
  );
}
