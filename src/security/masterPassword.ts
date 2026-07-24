const STORAGE_KEY = "foxinal-master-password";
export const ITERATIONS = 100_000;
const MIN_LENGTH = 8;

export type MasterPasswordRecord = {
  version: 1;
  salt: string;
  hash: string;
  iterations: number;
};

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

export async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

export async function importAesKey(bits: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function deriveVaultKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<{ key: CryptoKey; bits: Uint8Array }> {
  const bits = await deriveBits(password, salt, iterations);
  const key = await importAesKey(bits);
  return { key, bits };
}

export function loadMasterPasswordRecord(): MasterPasswordRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MasterPasswordRecord>;
    if (
      parsed.version !== 1 ||
      typeof parsed.salt !== "string" ||
      typeof parsed.hash !== "string" ||
      typeof parsed.iterations !== "number"
    ) {
      return null;
    }
    return {
      version: 1,
      salt: parsed.salt,
      hash: parsed.hash,
      iterations: parsed.iterations,
    };
  } catch {
    return null;
  }
}

function saveMasterPasswordRecord(record: MasterPasswordRecord) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function restoreMasterPasswordRecord(record: MasterPasswordRecord) {
  saveMasterPasswordRecord(record);
}

export function clearMasterPasswordRecord() {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasMasterPassword(): boolean {
  return loadMasterPasswordRecord() !== null;
}

export function validateMasterPasswordInput(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `Use at least ${MIN_LENGTH} characters.`;
  }
  return null;
}

export async function unlockWithPassword(password: string): Promise<
  | { ok: true; key: CryptoKey }
  | { ok: false; error: string }
> {
  const record = loadMasterPasswordRecord();
  if (!record) {
    return { ok: false, error: "No master password is set." };
  }
  const salt = base64ToBytes(record.salt);
  const expected = base64ToBytes(record.hash);
  const { key, bits } = await deriveVaultKey(
    password,
    salt,
    record.iterations,
  );
  if (!timingSafeEqual(bits, expected)) {
    return { ok: false, error: "Incorrect master password." };
  }
  return { ok: true, key };
}

export async function createMasterPassword(password: string): Promise<
  | { ok: true; key: CryptoKey }
  | { ok: false; error: string }
> {
  const invalid = validateMasterPasswordInput(password);
  if (invalid) return { ok: false, error: invalid };

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { key, bits } = await deriveVaultKey(password, salt, ITERATIONS);
  saveMasterPasswordRecord({
    version: 1,
    salt: bytesToBase64(salt),
    hash: bytesToBase64(bits),
    iterations: ITERATIONS,
  });
  return { ok: true, key };
}

export const MASTER_PASSWORD_MIN_LENGTH = MIN_LENGTH;
