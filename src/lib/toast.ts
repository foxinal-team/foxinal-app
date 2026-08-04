import type { ReactNode } from "react";
import { toast as sonner, type ExternalToast } from "sonner";

type ToastOptions = {
  description?: ReactNode;
  action?: ExternalToast["action"];
  duration?: number;
};

function resolveOpts(
  descriptionOrOpts?: string | ToastOptions,
): ToastOptions | undefined {
  if (descriptionOrOpts === undefined) return undefined;
  if (typeof descriptionOrOpts === "string") {
    return { description: descriptionOrOpts };
  }
  return descriptionOrOpts;
}

/** App-wide toast helpers with typed variants. */
export const toast = {
  success(message: string, descriptionOrOpts?: string | ToastOptions) {
    return sonner.success(message, resolveOpts(descriptionOrOpts));
  },
  error(message: string, descriptionOrOpts?: string | ToastOptions) {
    return sonner.error(message, resolveOpts(descriptionOrOpts));
  },
  info(message: string, descriptionOrOpts?: string | ToastOptions) {
    return sonner.info(message, resolveOpts(descriptionOrOpts));
  },
  warning(message: string, descriptionOrOpts?: string | ToastOptions) {
    return sonner.warning(message, resolveOpts(descriptionOrOpts));
  },
  message(message: string, descriptionOrOpts?: string | ToastOptions) {
    return sonner.message(message, resolveOpts(descriptionOrOpts));
  },
};
