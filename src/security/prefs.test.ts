import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTO_LOCK_MINUTE_OPTIONS,
  DEFAULT_SECURITY_PREFS,
  loadSecurityPrefs,
  saveSecurityPrefs,
  type SecurityPrefs,
} from "./prefs";

describe("security prefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default prefs when storage is empty", () => {
    const prefs = loadSecurityPrefs();
    expect(prefs).toEqual(DEFAULT_SECURITY_PREFS);
  });

  it("saves and loads valid security preferences", () => {
    const customPrefs: SecurityPrefs = {
      autoLockEnabled: true,
      autoLockMinutes: 30,
      lockOnBlurEnabled: true,
    };
    saveSecurityPrefs(customPrefs);

    const loaded = loadSecurityPrefs();
    expect(loaded).toEqual(customPrefs);
  });

  it("falls back to default autoLockMinutes if an invalid duration is in storage", () => {
    localStorage.setItem(
      "foxinal-security-prefs",
      JSON.stringify({
        autoLockEnabled: true,
        autoLockMinutes: 999, // not in allowed options
        lockOnBlurEnabled: false,
      }),
    );

    const loaded = loadSecurityPrefs();
    expect(loaded.autoLockMinutes).toBe(DEFAULT_SECURITY_PREFS.autoLockMinutes);
    expect(loaded.autoLockEnabled).toBe(true);
  });

  it("exports valid minute options", () => {
    expect(AUTO_LOCK_MINUTE_OPTIONS).toContain(15);
    expect(AUTO_LOCK_MINUTE_OPTIONS).toContain(1);
    expect(AUTO_LOCK_MINUTE_OPTIONS).toContain(60);
  });
});
