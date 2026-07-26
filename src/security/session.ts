import type { InventoryItem } from "@/inventory/types";
import {
  clearMasterPasswordRecord,
  createMasterPassword,
  loadMasterPasswordRecord,
  restoreMasterPasswordRecord,
  unlockWithPassword,
  validateMasterPasswordInput,
} from "./masterPassword";
import {
  loadInventoryState,
  migrateToEncrypted,
  migrateToPlaintext,
} from "./vault";

export async function unlockApp(password: string): Promise<
  | { ok: true; key: CryptoKey; items: InventoryItem[] }
  | { ok: false; error: string }
> {
  const unlocked = await unlockWithPassword(password);
  if (!unlocked.ok) return unlocked;
  try {
    const state = await loadInventoryState(unlocked.key);
    return { ok: true, key: unlocked.key, items: state.items };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not decrypt inventory.",
    };
  }
}

export async function enableMasterPassword(
  password: string,
  items: InventoryItem[],
): Promise<{ ok: true; key: CryptoKey } | { ok: false; error: string }> {
  const created = await createMasterPassword(password);
  if (!created.ok) return created;
  try {
    await migrateToEncrypted(items, created.key);
    return { ok: true, key: created.key };
  } catch {
    clearMasterPasswordRecord();
    return { ok: false, error: "Could not encrypt inventory." };
  }
}

export async function changeMasterPassword(
  currentPassword: string,
  nextPassword: string,
  items: InventoryItem[],
): Promise<{ ok: true; key: CryptoKey } | { ok: false; error: string }> {
  const invalid = validateMasterPasswordInput(nextPassword);
  if (invalid) return { ok: false, error: invalid };

  const current = await unlockWithPassword(currentPassword);
  if (!current.ok) return current;

  const previous = loadMasterPasswordRecord();
  clearMasterPasswordRecord();
  const created = await createMasterPassword(nextPassword);
  if (!created.ok) {
    if (previous) restoreMasterPasswordRecord(previous);
    return created;
  }

  try {
    await migrateToEncrypted(items, created.key);
    return { ok: true, key: created.key };
  } catch {
    if (previous) restoreMasterPasswordRecord(previous);
    try {
      await migrateToEncrypted(items, current.key);
    } catch {
      // Best-effort restore of ciphertext with old key.
    }
    return { ok: false, error: "Could not re-encrypt inventory." };
  }
}

export async function disableMasterPassword(
  currentPassword: string,
  items: InventoryItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await unlockWithPassword(currentPassword);
  if (!current.ok) return current;
  try {
    await migrateToPlaintext(items);
    clearMasterPasswordRecord();
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not write plaintext inventory." };
  }
}
