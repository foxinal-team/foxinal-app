# Security & Vault Architecture

Foxinal implements a **Local-First, Zero-Knowledge** security model. Sensitive data (passwords, private keys, host credentials) is never transmitted to any cloud or external service.

---

## Cryptographic Specifications

All client-side cryptographic routines utilize the standard **Web Crypto API** (`crypto.subtle`):

- **Key Derivation**: PBKDF2 with SHA-256
  - Iterations: 100,000 rounds
  - Salt: Cryptographically secure random 16-byte salt (`crypto.getRandomValues`)
- **Symmetric Encryption**: AES-GCM (256-bit key)
  - Initialization Vector (IV): Unique 12-byte random IV per encryption operation
  - Tag Length: 128-bit authentication tag

---

## Vault Modes

1. **Unencrypted Mode (Default / Personal)**:
   - Inventory is stored in `localStorage` under `foxinal_inventory`.
   - Optimized for single-user trusted personal workstations.
2. **Encrypted Vault Mode**:
   - Master Password is set by the user.
   - Master Password verification hash is created using PBKDF2 (`foxinal_master_pw_hash`).
   - The entire inventory is serialized to JSON, encrypted with AES-GCM, and stored as an encrypted payload in `localStorage` (`foxinal_vault_payload`).
   - Plaintext inventory keys are wiped from persistent storage upon enabling encryption.

---

## Security Policies & Auto-Lock

Configured in [`src/security/prefs.ts`](file:///Users/danial/Documents/Projects/foxinal/src/security/prefs.ts) and [`src/hooks/useLockGuards.ts`](file:///Users/danial/Documents/Projects/foxinal/src/hooks/useLockGuards.ts):
- **Idle Timeout**: Automatically locks the vault and clears decrypted sessions after a configurable period of user inactivity (e.g. 5, 15, 30 minutes).
- **Lock on App Hide / Blur**: Locks immediately when window loses focus or app is minimized if configured.
- **Memory Clearing**: Decrypted credentials and keys are held strictly in ephemeral JavaScript variables and purged upon locking.
- **Clipboard Management**: Uses `arboard` in Rust for secure clipboard read/write operations without webview clipboard permission popups.

---

## Related Documentation
- [Inventory & Data Models](file:///Users/danial/Documents/Projects/foxinal/docs/inventory-and-data.md)
- [System Architecture](file:///Users/danial/Documents/Projects/foxinal/docs/architecture.md)
