import {
  emptyInventory,
  INVENTORY_STORAGE_KEY,
  type InventoryItem,
  type InventoryState,
} from "@/inventory/types";
import { normalizeInventoryItems } from "@/inventory/store";
import { base64ToBytes, bytesToBase64 } from "./masterPassword";

export const INVENTORY_VAULT_KEY = "foxinal-inventory-vault";

export type InventoryVault = {
  version: 1;
  iv: string;
  ciphertext: string;
};

export function hasEncryptedInventory(): boolean {
  return localStorage.getItem(INVENTORY_VAULT_KEY) !== null;
}

export async function encryptInventory(
  state: InventoryState,
  key: CryptoKey,
): Promise<InventoryVault> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(state));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plain,
  );
  return {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptInventory(
  vault: InventoryVault,
  key: CryptoKey,
): Promise<InventoryState> {
  const iv = base64ToBytes(vault.iv);
  const ciphertext = base64ToBytes(vault.ciphertext);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as InventoryState;
  if (!parsed || !Array.isArray(parsed.items)) return emptyInventory();
  return { items: normalizeInventoryItems(parsed.items) };
}

export function readVaultRecord(): InventoryVault | null {
  try {
    const raw = localStorage.getItem(INVENTORY_VAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InventoryVault>;
    if (
      parsed.version !== 1 ||
      typeof parsed.iv !== "string" ||
      typeof parsed.ciphertext !== "string"
    ) {
      return null;
    }
    return {
      version: 1,
      iv: parsed.iv,
      ciphertext: parsed.ciphertext,
    };
  } catch {
    return null;
  }
}

export function writeVaultRecord(vault: InventoryVault) {
  localStorage.setItem(INVENTORY_VAULT_KEY, JSON.stringify(vault));
  localStorage.removeItem(INVENTORY_STORAGE_KEY);
}

export function clearVaultRecord() {
  localStorage.removeItem(INVENTORY_VAULT_KEY);
}

/** Load inventory: encrypted vault when key provided, else plaintext. */
export async function loadInventoryState(
  key: CryptoKey | null,
): Promise<InventoryState> {
  if (key) {
    const vault = readVaultRecord();
    if (!vault) {
      // Master password set but no vault yet — fall back to plaintext migrate path.
      const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (!raw) return emptyInventory();
      try {
        const parsed = JSON.parse(raw) as InventoryState;
        if (!parsed || !Array.isArray(parsed.items)) return emptyInventory();
        return { items: normalizeInventoryItems(parsed.items) };
      } catch {
        return emptyInventory();
      }
    }
    try {
      return await decryptInventory(vault, key);
    } catch {
      throw new Error("Could not decrypt inventory. Wrong password or damaged vault.");
    }
  }

  const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
  if (!raw) return emptyInventory();
  try {
    const parsed = JSON.parse(raw) as InventoryState;
    if (!parsed || !Array.isArray(parsed.items)) return emptyInventory();
    return { items: normalizeInventoryItems(parsed.items) };
  } catch {
    return emptyInventory();
  }
}

export async function saveInventoryState(
  state: InventoryState,
  key: CryptoKey | null,
): Promise<void> {
  if (key) {
    const vault = await encryptInventory(state, key);
    writeVaultRecord(vault);
    return;
  }
  localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(state));
  clearVaultRecord();
}

export async function migrateToEncrypted(
  items: InventoryItem[],
  key: CryptoKey,
): Promise<void> {
  await saveInventoryState({ items }, key);
}

export async function migrateToPlaintext(items: InventoryItem[]): Promise<void> {
  await saveInventoryState({ items }, null);
}
