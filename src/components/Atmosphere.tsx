import { cn } from "@/lib/utils";

const GRAIN_LIGHT =
  'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IGZpbGw9IiMwMDAiIG9wYWNpdHk9IjAuMDMiLz48L3N2Zz4=")';
const GRAIN_DARK =
  'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuMDIiLz48L3N2Zz4=")';

type AtmosphereProps = {
  /** fixed fullscreen (login) vs absolute behind dashboard content */
  variant?: "fixed" | "absolute";
  className?: string;
};

/** Mist + fox/cool glows + grain behind login and dashboard. */
export function Atmosphere({
  variant = "fixed",
  className,
}: AtmosphereProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none overflow-hidden bg-mist",
        variant === "fixed" ? "fixed inset-0 z-0" : "absolute inset-0 -z-1",
        className
      )}
    >
      <div
        className="absolute inset-[-10%] blur-[72px] motion-safe:animate-atmosphere-drift"
        style={{
          background: `
            radial-gradient(circle at 12% 8%, var(--glow-fox), transparent 40%),
            radial-gradient(circle at 88% 30%, var(--glow-cool), transparent 42%),
            radial-gradient(circle at 50% 100%, var(--glow-fox), transparent 48%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-35 dark:hidden"
        style={{
          backgroundImage: GRAIN_LIGHT,
          backgroundSize: "4px 4px",
        }}
      />
      <div
        className="absolute inset-0 hidden opacity-45 dark:block"
        style={{
          backgroundImage: GRAIN_DARK,
          backgroundSize: "4px 4px",
        }}
      />
    </div>
  );
}
