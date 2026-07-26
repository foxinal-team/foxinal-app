import { toast as sonner } from "sonner";

/** App-wide toast helpers with typed variants. */
export const toast = {
  success(message: string, description?: string) {
    return sonner.success(message, { description });
  },
  error(message: string, description?: string) {
    return sonner.error(message, { description });
  },
  info(message: string, description?: string) {
    return sonner.info(message, { description });
  },
  warning(message: string, description?: string) {
    return sonner.warning(message, { description });
  },
  message(message: string, description?: string) {
    return sonner.message(message, { description });
  },
};
