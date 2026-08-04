import { useEffect, useState, type CSSProperties } from "react";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconLoader,
  IconX,
} from "@tabler/icons-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function useDocumentTheme(): ToasterProps["theme"] {
  const [theme, setTheme] = useState<ToasterProps["theme"]>(() => {
    const stored = document.documentElement.dataset.theme;
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const next = root.dataset.theme;
      setTheme(
        next === "light" || next === "dark" || next === "system"
          ? next
          : "system",
      );
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-right"
      offset={20}
      gap={10}
      visibleToasts={4}
      closeButton
      duration={5200}
      icons={{
        success: <IconCircleCheck size={20} stroke={1.75} />,
        info: <IconInfoCircle size={20} stroke={1.75} />,
        warning: <IconAlertTriangle size={20} stroke={1.75} />,
        error: <IconAlertOctagon size={20} stroke={1.75} />,
        loading: <IconLoader size={20} stroke={1.75} className="animate-spin" />,
        close: <IconX size={14} stroke={2} />,
      }}
      style={
        {
          "--normal-bg": "var(--toast-bg)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--toast-border)",
          "--success-bg": "var(--toast-bg)",
          "--success-text": "var(--ink)",
          "--success-border": "var(--toast-border)",
          "--error-bg": "var(--toast-bg)",
          "--error-text": "var(--ink)",
          "--error-border": "var(--toast-border)",
          "--warning-bg": "var(--toast-bg)",
          "--warning-text": "var(--ink)",
          "--warning-border": "var(--toast-border)",
          "--info-bg": "var(--toast-bg)",
          "--info-text": "var(--ink)",
          "--info-border": "var(--toast-border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "fox-toast",
          title: "fox-toast-title",
          description: "fox-toast-description",
          content: "fox-toast-content",
          icon: "fox-toast-icon",
          actionButton: "fox-toast-action",
          cancelButton: "fox-toast-cancel",
          closeButton: "fox-toast-close",
          success: "fox-toast-success",
          error: "fox-toast-error",
          warning: "fox-toast-warning",
          info: "fox-toast-info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
