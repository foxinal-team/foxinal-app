import { beforeEach, describe, expect, it } from "vitest";
import {
  changeMasterPassword,
  disableMasterPassword,
  enableMasterPassword,
  unlockApp,
} from "./session";
import { hasMasterPassword } from "./masterPassword";
import { hasEncryptedInventory } from "./vault";
import type { HostItem } from "@/inventory/types";

const mockHost: HostItem = {
  id: "host-1",
  kind: "host",
  name: "Web 01",
  address: "10.0.0.1",
  port: 22,
  username: "admin",
  authMethod: "password",
  password: "super-secret-pw",
  privateKey: "",
  parentId: null,
  createdAt: 1000,
};

describe("Security Session Lifecycle (Hardened Invariant Tests)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enables master password, encrypts items, and unlocks successfully", async () => {
    const res = await enableMasterPassword("password-1234", [mockHost]);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("Expected enableMasterPassword to succeed");

    expect(hasMasterPassword()).toBe(true);
    expect(hasEncryptedInventory()).toBe(true);

    const unlockRes = await unlockApp("password-1234");
    expect(unlockRes.ok).toBe(true);
    if (!unlockRes.ok) throw new Error("Expected unlockApp to succeed");

    expect(unlockRes.items).toHaveLength(1);
    expect(unlockRes.items[0].name).toBe("Web 01");
    expect((unlockRes.items[0] as HostItem).password).toBe("super-secret-pw");
    expect(unlockRes.key).toBeDefined();
  });

  it("fails to enable master password if password does not meet min length", async () => {
    const res = await enableMasterPassword("short", [mockHost]);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("Expected short password to fail");
    expect(hasMasterPassword()).toBe(false);
    expect(hasEncryptedInventory()).toBe(false);
  });

  it("fails to unlock with wrong password and does not return items or keys", async () => {
    await enableMasterPassword("password-1234", [mockHost]);
    const unlockRes = await unlockApp("wrong-password-here");
    expect(unlockRes.ok).toBe(false);
    if (unlockRes.ok) throw new Error("Expected unlockApp to fail");
    expect(unlockRes.error).toBe("Incorrect master password.");
  });

  it("changes master password successfully and updates encryption key", async () => {
    await enableMasterPassword("old-password-123", [mockHost]);

    const changeRes = await changeMasterPassword(
      "old-password-123",
      "new-password-456",
      [mockHost],
    );
    expect(changeRes.ok).toBe(true);
    if (!changeRes.ok) throw new Error("Expected changeMasterPassword to succeed");

    // Old password MUST now fail
    const oldUnlock = await unlockApp("old-password-123");
    expect(oldUnlock.ok).toBe(false);

    // New password MUST succeed and decrypt the inventory
    const newUnlock = await unlockApp("new-password-456");
    expect(newUnlock.ok).toBe(true);
    if (!newUnlock.ok) throw new Error("Expected new password to unlock");
    expect(newUnlock.items).toHaveLength(1);
    expect(newUnlock.items[0].name).toBe("Web 01");
  });

  it("rejects password change if current password is incorrect, leaving old password intact", async () => {
    await enableMasterPassword("correct-old-password", [mockHost]);

    const changeRes = await changeMasterPassword(
      "WRONG-old-password",
      "new-password-valid",
      [mockHost],
    );
    expect(changeRes.ok).toBe(false);
    if (changeRes.ok) throw new Error("Expected change with wrong old password to fail");
    expect(changeRes.error).toBe("Incorrect master password.");

    // INVARIANT: Old password must still be fully functional!
    const unlockOld = await unlockApp("correct-old-password");
    expect(unlockOld.ok).toBe(true);
  });

  it("rejects password change if new password is too short", async () => {
    await enableMasterPassword("correct-old-password", [mockHost]);

    const changeRes = await changeMasterPassword(
      "correct-old-password",
      "short",
      [mockHost],
    );
    expect(changeRes.ok).toBe(false);
    if (changeRes.ok) throw new Error("Expected short new password to fail");

    // Old password still works
    const unlockOld = await unlockApp("correct-old-password");
    expect(unlockOld.ok).toBe(true);
  });

  it("disables master password and migrates inventory to plaintext", async () => {
    await enableMasterPassword("password-to-remove", [mockHost]);
    expect(hasMasterPassword()).toBe(true);
    expect(hasEncryptedInventory()).toBe(true);

    const disableRes = await disableMasterPassword("password-to-remove", [mockHost]);
    expect(disableRes.ok).toBe(true);
    if (!disableRes.ok) throw new Error("Expected disableMasterPassword to succeed");

    expect(hasMasterPassword()).toBe(false);
    expect(hasEncryptedInventory()).toBe(false);

    // After disable, unlockApp should report no master password set
    const unlockAttempt = await unlockApp("password-to-remove");
    expect(unlockAttempt.ok).toBe(false);
    if (unlockAttempt.ok) throw new Error("Expected unlockApp to fail when disabled");
    expect(unlockAttempt.error).toBe("No master password is set.");
  });

  it("rejects disabling master password with incorrect password", async () => {
    await enableMasterPassword("protected-password", [mockHost]);

    const disableRes = await disableMasterPassword("wrong-attempt", [mockHost]);
    expect(disableRes.ok).toBe(false);
    if (disableRes.ok) throw new Error("Expected wrong password disable to fail");
    expect(disableRes.error).toBe("Incorrect master password.");

    // Vault remains intact and encrypted
    expect(hasMasterPassword()).toBe(true);
    expect(hasEncryptedInventory()).toBe(true);
    const unlock = await unlockApp("protected-password");
    expect(unlock.ok).toBe(true);
  });
});
