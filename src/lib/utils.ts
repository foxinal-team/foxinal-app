import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isMac =
  typeof navigator !== "undefined" &&
  (/mac|iphone|ipad|ipod/i.test(navigator.platform) ||
    /mac/i.test(navigator.userAgent));

export const modKey = isMac ? "⌘" : "Ctrl+";
export const altKey = isMac ? "⌥" : "Alt+";
