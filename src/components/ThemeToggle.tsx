import {
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";

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
  className = "",
}: ThemeToggleProps) {
  return (
    <button
      type="button"
      className={["theme-toggle", className].filter(Boolean).join(" ")}
      onClick={onCycle}
      aria-label={`Theme: ${label}`}
      title={`Theme: ${label}`}
    >
      <ThemeIcon theme={theme} />
      <span className="theme-toggle__mode" data-mode={theme} aria-hidden="true">
        {label}
      </span>
    </button>
  );
}
