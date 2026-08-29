# Inventory & Data Management

Foxinal manages hosts and nested groups in a tree hierarchy with drag-and-drop organization, tags, search indexing, and export/import functionality.

---

## Data Models (`src/inventory/types.ts`)

### 1. Host (`Host`)
```typescript
interface Host {
  id: string;
  name: string;
  address: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key';
  password?: string;
  privateKey?: string;
  passphrase?: string;
  parentId?: string | null;     // Group ID or null for root
  tags?: string[];
  notes?: string;
  order?: number;
  color?: string;
  createdAt: number;
  updatedAt: number;
}
```

### 2. Group (`Group`)
```typescript
interface Group {
  id: string;
  name: string;
  parentId?: string | null;     // Allows nested groups
  order?: number;
  color?: string;
  isExpanded?: boolean;
}
```

---

## Import & Export (`src/inventory/transfer.ts`)

- **JSON Export**: Exports full inventory (with optional inclusion/exclusion of credentials) formatted with schema versioning. Writes directly to the user's `Downloads` folder using `write_export_file`.
- **SSH Config Import**: Parses standard OpenSSH configuration files (`~/.ssh/config`), extracting `Host`, `HostName`, `User`, `Port`, and `IdentityFile`.
- **Custom JSON Import**: Validates schema and resolves group hierarchy collisions.

---

## Related Documentation
- [Security & Vault Architecture](file:///Users/danial/Documents/Projects/foxinal/docs/security-and-vault.md)
- [System Architecture](file:///Users/danial/Documents/Projects/foxinal/docs/architecture.md)
