import { useEffect, useRef } from "react";
import type { SecurityPrefs } from "./prefs";

type UseLockGuardsOptions = {
  enabled: boolean;
  /** Pause locking while dialogs/menus need focus (e.g. Settings). */
  suspended?: boolean;
  prefs: SecurityPrefs;
  onLock: () => void;
};

/**
 * Auto-lock on idle and/or when the app is hidden.
 * Only active when `enabled` (master password on) and the matching prefs are set.
 */
export function useLockGuards({
  enabled,
  suspended = false,
  prefs,
  onLock,
}: UseLockGuardsOptions) {
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;

  useEffect(() => {
    if (!enabled || suspended || !prefs.autoLockEnabled) return;

    const ms = Math.max(1, prefs.autoLockMinutes) * 60_000;
    let timer = window.setTimeout(() => {
      if (!suspendedRef.current) onLockRef.current();
    }, ms);

    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!suspendedRef.current) onLockRef.current();
      }, ms);
    };

    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", bump, opts);
    window.addEventListener("keydown", bump, opts);
    window.addEventListener("mousemove", bump, opts);
    window.addEventListener("wheel", bump, opts);
    window.addEventListener("touchstart", bump, opts);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("wheel", bump);
      window.removeEventListener("touchstart", bump);
    };
  }, [enabled, suspended, prefs.autoLockEnabled, prefs.autoLockMinutes]);

  useEffect(() => {
    if (!enabled || !prefs.lockOnBlurEnabled) return;

    // Prefer visibility (minimize / sleep / app switch). Avoid window.blur —
    // it false-triggers inside Tauri when focusing inputs/selects in dialogs.
    const onVisibility = () => {
      if (suspendedRef.current) return;
      if (document.visibilityState === "hidden") {
        onLockRef.current();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, prefs.lockOnBlurEnabled]);
}
