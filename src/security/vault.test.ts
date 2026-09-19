import { beforeEach, describe, expect, it } from "vitest";
import {
  clearVaultRecord,
  decryptInventory,
  encryptInventory,
  hasEncryptedInventory,
  INVENTORY_VAULT_KEY,
  loadInventoryState,
  migrateToEncrypted,
  migrateToPlaintext,
  readVaultRecord,
  saveInventoryState,
  writeVaultRecord,
} from "./vault";
import { importAesKey } from "./masterPassword";
import {
  INVENTORY_STORAGE_KEY,
  type HostItem,
  type InventoryState,
} from "@/inventory/types";

const mockHost: HostItem = {
  id: "host-1",
  kind: "host",
  name: "DB Primary",
  address: "192.168.1.100",
  port: 22,
  username: "root",
  authMethod: "password",
  password: "super-secret-pw",
  privateKey: "MY_PRIVATE_KEY_PAYLOAD",
  parentId: null,
  createdAt: 1000,
};

describe("Vault Security Module (Hardened Cryptographic Invariant Tests)", () => {
  let testKey: CryptoKey;

  beforeEach(async () => {
    localStorage.clear();
    const keyBits = new Uint8Array(32).fill(42);
    testKey = await importAesKey(keyBits);
  });

  describe("encryptInventory & decryptInventory (Cryptographic Guarantees)", () => {
    it("round-trips inventory encryption and decryption cleanly with 100% property fidelity", async () => {
      const state: InventoryState = { items: [mockHost] };
      const vault = await encryptInventory(state, testKey);

      expect(vault.version).toBe(1);
      expect(typeof vault.iv).toBe("string");
      expect(typeof vault.ciphertext).toBe("string");

      const decrypted = await decryptInventory(vault, testKey);
      expect(decrypted.items).toHaveLength(1);
      const host = decrypted.items[0] as HostItem;
      expect(host.id).toBe("host-1");
      expect(host.name).toBe("DB Primary");
      expect(host.password).toBe("super-secret-pw");
      expect(host.privateKey).toBe("MY_PRIVATE_KEY_PAYLOAD");
    });

    it("ensures semantic security (IND-CPA): encrypting same plaintext twice yields unique IV and ciphertext", async () => {
      const state: InventoryState = { items: [mockHost] };
      const vault1 = await encryptInventory(state, testKey);
      const vault2 = await encryptInventory(state, testKey);

      // INVARIANT: Reusing IVs in AES-GCM is catastrophic. Each run MUST generate random IV.
      expect(vault1.iv).not.toBe(vault2.iv);
      expect(vault1.ciphertext).not.toBe(vault2.ciphertext);
    });

    it("fails decryption when presented with an incorrect key", async () => {
      const state: InventoryState = { items: [mockHost] };
      const vault = await encryptInventory(state, testKey);

      const wrongBits = new Uint8Array(32).fill(99);
      const wrongKey = await importAesKey(wrongBits);

      await expect(decryptInventory(vault, wrongKey)).rejects.toThrow();
    });

    it("fails decryption when ciphertext is tampered (AES-GCM Authentication Tag verification)", async () => {
      const state: InventoryState = { items: [mockHost] };
      const vault = await encryptInventory(state, testKey);

      // Mutate 1 character in ciphertext
      const tamperedCiphertext =
        vault.ciphertext.slice(0, -2) + (vault.ciphertext.endsWith("A") ? "B" : "A");
      const tamperedVault = { ...vault, ciphertext: tamperedCiphertext };

      await expect(decryptInventory(tamperedVault, testKey)).rejects.toThrow();
    });

    it("fails decryption when IV is tampered", async () => {
      const state: InventoryState = { items: [mockHost] };
      const vault = await encryptInventory(state, testKey);

      const tamperedIv = vault.iv.slice(0, -2) + "ZZ";
      const tamperedVault = { ...vault, iv: tamperedIv };

      await expect(decryptInventory(tamperedVault, testKey)).rejects.toThrow();
    });
  });

  describe("Record storage isolation & schema validation", () => {
    it("manages vault record in localStorage and strips plaintext storage when vault is written", async () => {
      expect(hasEncryptedInventory()).toBe(false);
      expect(readVaultRecord()).toBeNull();

      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify({ items: [mockHost] }));
      expect(localStorage.getItem(INVENTORY_STORAGE_KEY)).not.toBeNull();

      const vault = await encryptInventory({ items: [] }, testKey);
      writeVaultRecord(vault);

      expect(hasEncryptedInventory()).toBe(true);
      expect(readVaultRecord()).toEqual(vault);
      // INVARIANT: Writing vault record MUST purge plaintext storage to prevent credential leak
      expect(localStorage.getItem(INVENTORY_STORAGE_KEY)).toBeNull();

      clearVaultRecord();
      expect(hasEncryptedInventory()).toBe(false);
      expect(readVaultRecord()).toBeNull();
    });

    it("rejects invalid or corrupted vault record schemas", () => {
      // Invalid JSON
      localStorage.setItem(INVENTORY_VAULT_KEY, "{ broken json");
      expect(readVaultRecord()).toBeNull();

      // Wrong version
      localStorage.setItem(
        INVENTORY_VAULT_KEY,
        JSON.stringify({ version: 2, iv: "iv", ciphertext: "c" }),
      );
      expect(readVaultRecord()).toBeNull();

      // Missing fields
      localStorage.setItem(
        INVENTORY_VAULT_KEY,
        JSON.stringify({ version: 1, iv: "iv" }),
      );
      expect(readVaultRecord()).toBeNull();
    });
  });

  describe("loadInventoryState & saveInventoryState", () => {
    it("loads and saves plaintext inventory when key is null", async () => {
      const state: InventoryState = { items: [mockHost] };
      await saveInventoryState(state, null);

      expect(hasEncryptedInventory()).toBe(false);
      const loaded = await loadInventoryState(null);
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0].name).toBe("DB Primary");
    });

    it("loads and saves encrypted inventory when key is provided", async () => {
      const state: InventoryState = { items: [mockHost] };
      await saveInventoryState(state, testKey);

      expect(hasEncryptedInventory()).toBe(true);
      const loaded = await loadInventoryState(testKey);
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0].name).toBe("DB Primary");
    });

    it("falls back to plaintext if master password key provided but no encrypted vault exists yet", async () => {
      // User set master password but vault hasn't been saved yet
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify({ items: [mockHost] }));
      expect(hasEncryptedInventory()).toBe(false);

      const loaded = await loadInventoryState(testKey);
      expect(loaded.items).toHaveLength(1);
      expect(loaded.items[0].name).toBe("DB Primary");
    });

    it("throws explicit user-friendly error when decrypting damaged encrypted vault", async () => {
      writeVaultRecord({
        version: 1,
        iv: "AQIDBAUGBwgJCgsMDQ4PEA==", // valid base64 16 bytes
        ciphertext: "QUJDREVGR0g=", // valid base64 corrupt ciphertext
      });

      await expect(loadInventoryState(testKey)).rejects.toThrow(
        "Could not decrypt inventory. Wrong password or damaged vault.",
      );
    });

    it("returns empty inventory when plaintext storage is empty or malformed", async () => {
      expect((await loadInventoryState(null)).items).toHaveLength(0);

      localStorage.setItem(INVENTORY_STORAGE_KEY, "invalid-json");
      expect((await loadInventoryState(null)).items).toHaveLength(0);

      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify({ items: "not-an-array" }));
      expect((await loadInventoryState(null)).items).toHaveLength(0);
    });
  });

  describe("migration helpers", () => {
    it("migrates from plaintext to encrypted and back cleanly without data loss", async () => {
      await saveInventoryState({ items: [mockHost] }, null);
      expect(hasEncryptedInventory()).toBe(false);

      await migrateToEncrypted([mockHost], testKey);
      expect(hasEncryptedInventory()).toBe(true);
      expect(localStorage.getItem(INVENTORY_STORAGE_KEY)).toBeNull();

      const encLoaded = await loadInventoryState(testKey);
      expect(encLoaded.items).toHaveLength(1);
      expect(encLoaded.items[0].name).toBe("DB Primary");

      await migrateToPlaintext([mockHost]);
      expect(hasEncryptedInventory()).toBe(false);
      expect(localStorage.getItem(INVENTORY_VAULT_KEY)).toBeNull();

      const plainLoaded = await loadInventoryState(null);
      expect(plainLoaded.items).toHaveLength(1);
      expect(plainLoaded.items[0].name).toBe("DB Primary");
    });
  });
});
