import { IconEye, IconEyeOff } from "@tabler/icons-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SecretInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /** Extra classes for the outer relative wrapper. */
  wrapperClassName?: string;
};

function SecretToggle({
  visible,
  onToggle,
  disabled,
  className,
}: {
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "shrink-0 text-ink-muted hover:bg-transparent hover:text-ink",
        className,
      )}
      disabled={disabled}
      aria-label={visible ? "Hide secret" : "Show secret"}
      aria-pressed={visible}
      onClick={onToggle}
      tabIndex={-1}
    >
      {visible ? (
        <IconEyeOff size={18} stroke={1.75} aria-hidden />
      ) : (
        <IconEye size={18} stroke={1.75} aria-hidden />
      )}
    </Button>
  );
}

function SecretInput({
  className,
  wrapperClassName,
  disabled,
  ...props
}: SecretInputProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className={cn("relative", wrapperClassName)}>
      <Input
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-10", className)}
        {...props}
      />
      <SecretToggle
        visible={visible}
        disabled={disabled}
        onToggle={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1 -translate-y-1/2"
      />
    </div>
  );
}

type SecretTextareaProps = React.ComponentProps<"textarea"> & {
  wrapperClassName?: string;
};

const SecretTextarea = React.forwardRef<
  HTMLTextAreaElement,
  SecretTextareaProps
>(function SecretTextarea(
  { className, wrapperClassName, disabled, style, ...props },
  ref,
) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className={cn("relative", wrapperClassName)}>
      <Textarea
        ref={ref}
        disabled={disabled}
        spellCheck={false}
        className={cn("pr-10", className)}
        style={{
          ...style,
          ...(visible
            ? undefined
            : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)),
        }}
        {...props}
      />
      <SecretToggle
        visible={visible}
        disabled={disabled}
        onToggle={() => setVisible((v) => !v)}
        className="absolute top-1.5 right-1"
      />
    </div>
  );
});

export { SecretInput, SecretTextarea, SecretToggle };
