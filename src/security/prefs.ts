const STORAGE_KEY = "foxinal-security-prefs";

export type SecurityPrefs = {
  /** Lock after idle time while unlocked (requires master password). */
  autoLockEnabled: boolean;
  autoLockMinutes: number;
  /** Lock when the app window loses focus / is hidden (requires master password). */
  lockOnBlurEnabled: boolean;
};

export const AUTO_LOCK_MINUTE_OPTIONS = [1, 5, 15, 30, 60] as const;

export const DEFAULT_SECURITY_PREFS: SecurityPrefs = {
  autoLockEnabled: false,
  autoLockMinutes: 15,
  lockOnBlurEnabled: false,
};

export function loadSecurityPrefs(): SecurityPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SECURITY_PREFS };
    const parsed = JSON.parse(raw) as Partial<SecurityPrefs>;
    const minutes =
      typeof parsed.autoLockMinutes === "number" &&
      AUTO_LOCK_MINUTE_OPTIONS.includes(
        parsed.autoLockMinutes as (typeof AUTO_LOCK_MINUTE_OPTIONS)[number],
      )
        ? parsed.autoLockMinutes
        : DEFAULT_SECURITY_PREFS.autoLockMinutes;
    return {
      autoLockEnabled: Boolean(parsed.autoLockEnabled),
      autoLockMinutes: minutes,
      lockOnBlurEnabled: Boolean(parsed.lockOnBlurEnabled),
    };
  } catch {
    return { ...DEFAULT_SECURITY_PREFS };
  }
}

export function saveSecurityPrefs(prefs: SecurityPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
