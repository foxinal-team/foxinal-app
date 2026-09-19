import { beforeEach, describe, expect, it } from "vitest";
import {
  base64ToBytes,
  bytesToBase64,
  clearMasterPasswordRecord,
  createMasterPassword,
  deriveVaultKey,
  hasMasterPassword,
  loadMasterPasswordRecord,
  MASTER_PASSWORD_MIN_LENGTH,
  MASTER_PASSWORD_STORAGE_KEY,
  restoreMasterPasswordRecord,
  unlockWithPassword,
  validateMasterPasswordInput,
} from "./masterPassword";

describe("masterPassword security module (Hardened Invariant Tests)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("base64 and bytes conversion", () => {
    it("round-trips arbitrary byte sequences including edge bytes (0, 255)", () => {
      const bytes = new Uint8Array([0, 1, 255, 128, 42, 99, 0, 0, 254]);
      const encoded = bytesToBase64(bytes);
      expect(typeof encoded).toBe("string");
      const decoded = base64ToBytes(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(bytes));
    });

    it("round-trips empty byte array", () => {
      const empty = new Uint8Array([]);
      expect(bytesToBase64(empty)).toBe("");
      expect(Array.from(base64ToBytes(""))).toEqual([]);
    });
  });

  describe("validateMasterPasswordInput", () => {
    it("rejects passwords shorter than MIN_LENGTH", () => {
      expect(validateMasterPasswordInput("1234567")).toBe(
        `Use at least ${MASTER_PASSWORD_MIN_LENGTH} characters.`,
      );
      expect(validateMasterPasswordInput("")).toBe(
        `Use at least ${MASTER_PASSWORD_MIN_LENGTH} characters.`,
      );
    });

    it("accepts valid length passwords", () => {
      expect(validateMasterPasswordInput("12345678")).toBeNull();
      expect(validateMasterPasswordInput("super-secret-master-pass")).toBeNull();
      expect(validateMasterPasswordInput("  spaced-password  ")).toBeNull();
    });
  });

  describe("createMasterPassword & unlockWithPassword", () => {
    it("fails when password is too short and creates no record", async () => {
      const res = await createMasterPassword("short");
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error("Expected short password to fail");
      expect(res.error).toBe(`Use at least ${MASTER_PASSWORD_MIN_LENGTH} characters.`);
      expect(hasMasterPassword()).toBe(false);
      expect(loadMasterPasswordRecord()).toBeNull();
    });

    it("creates master password record with distinct random salts for each invocation", async () => {
      const res1 = await createMasterPassword("password-number-one");
      expect(res1.ok).toBe(true);
      const rec1 = loadMasterPasswordRecord()!;
      expect(rec1).toBeDefined();

      localStorage.clear();
      const res2 = await createMasterPassword("password-number-one");
      expect(res2.ok).toBe(true);
      const rec2 = loadMasterPasswordRecord()!;
      expect(rec2).toBeDefined();

      // INVARIANT: Even with the identical password, salt and hash MUST be different (random IV/salt)
      expect(rec1.salt).not.toBe(rec2.salt);
      expect(rec1.hash).not.toBe(rec2.hash);
      expect(rec1.iterations).toBeGreaterThanOrEqual(100_000);
    });

    it("unlocks cleanly with correct password and derives a usable AES-GCM key", async () => {
      const createRes = await createMasterPassword("correct-horse-battery-staple");
      expect(createRes.ok).toBe(true);
      if (!createRes.ok) throw new Error("Creation failed");

      // Verify unlocking with incorrect password fails loud and clear
      const wrongRes = await unlockWithPassword("wrong-password-here");
      expect(wrongRes.ok).toBe(false);
      if (wrongRes.ok) throw new Error("Expected wrong password to fail");
      expect(wrongRes.error).toBe("Incorrect master password.");

      // Verify unlocking with correct password succeeds and yields AES-GCM CryptoKey
      const rightRes = await unlockWithPassword("correct-horse-battery-staple");
      expect(rightRes.ok).toBe(true);
      if (!rightRes.ok) throw new Error("Expected correct password to succeed");
      expect(rightRes.key).toBeDefined();
      expect(rightRes.key.algorithm.name).toBe("AES-GCM");
      expect((rightRes.key.algorithm as AesKeyAlgorithm).length).toBe(256);
    });

    it("returns error when unlocking with no master password set", async () => {
      const res = await unlockWithPassword("any-password");
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error("Expected failure when no record exists");
      expect(res.error).toBe("No master password is set.");
    });

    it("handles corrupt, tampered, or invalid master password records in storage", async () => {
      // Missing fields
      localStorage.setItem(
        MASTER_PASSWORD_STORAGE_KEY,
        JSON.stringify({ version: 1, salt: "abc" }), // missing hash and iterations
      );
      expect(loadMasterPasswordRecord()).toBeNull();
      const resBad = await unlockWithPassword("any-pass");
      expect(resBad.ok).toBe(false);
      if (resBad.ok) throw new Error("Expected corrupt record to fail");
      expect(resBad.error).toBe("No master password is set.");

      // Invalid JSON
      localStorage.setItem(MASTER_PASSWORD_STORAGE_KEY, "{ bad json string");
      expect(loadMasterPasswordRecord()).toBeNull();

      // Wrong version
      localStorage.setItem(
        MASTER_PASSWORD_STORAGE_KEY,
        JSON.stringify({ version: 99, salt: "a", hash: "b", iterations: 1000 }),
      );
      expect(loadMasterPasswordRecord()).toBeNull();
    });

    it("supports atomic clearing and restoring master password records", () => {
      const dummyRecord = {
        version: 1 as const,
        salt: bytesToBase64(new Uint8Array(16).fill(1)),
        hash: bytesToBase64(new Uint8Array(32).fill(2)),
        iterations: 100_000,
      };
      restoreMasterPasswordRecord(dummyRecord);
      expect(loadMasterPasswordRecord()).toEqual(dummyRecord);
      clearMasterPasswordRecord();
      expect(hasMasterPassword()).toBe(false);
      expect(loadMasterPasswordRecord()).toBeNull();
    });
  });

  describe("deriveVaultKey", () => {
    it("derives deterministic key bits for identical password and salt", async () => {
      const salt = new Uint8Array(16).fill(7);
      const key1 = await deriveVaultKey("same-pass", salt, 1000);
      const key2 = await deriveVaultKey("same-pass", salt, 1000);

      expect(key1.bits).toEqual(key2.bits);
      expect(key1.bits.length).toBe(32); // 256 bits
    });

    it("derives different key bits if password differs by even a single character", async () => {
      const salt = new Uint8Array(16).fill(7);
      const keyA = await deriveVaultKey("password-a", salt, 1000);
      const keyB = await deriveVaultKey("password-b", salt, 1000);

      expect(keyA).not.toEqual(keyB);
    });

    it("derives different key bits if salt differs", async () => {
      const salt1 = new Uint8Array(16).fill(1);
      const salt2 = new Uint8Array(16).fill(2);
      const key1 = await deriveVaultKey("same-pass", salt1, 1000);
      const key2 = await deriveVaultKey("same-pass", salt2, 1000);

      expect(key1).not.toEqual(key2);
    });
  });
});
