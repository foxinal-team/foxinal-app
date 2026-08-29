# Development & Build Workflows

Guidelines for setting up the environment, running the app locally, adding features, and building distribution packages for macOS and Linux.

---

## Prerequisites

- **Node.js**: LTS (v20+)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Rust**: Latest stable toolchain (`rustup update stable`)
- **Tauri Prerequisites**: See [Tauri 2 Prerequisites](https://tauri.app/start/prerequisites/)
- **OpenSSH**: `ssh` and `ssh-keygen` available on system `PATH`

---

## Commands

### Development
```bash
# Install frontend dependencies
pnpm install

# Run full desktop app (Frontend + Rust Backend + PTY)
pnpm tauri dev

# Run frontend-only (UI layout development without native PTY/SSH)
pnpm dev
```

### Building & Packaging
```bash
# Type check and build web assets
pnpm build

# Build native installers and executables
pnpm tauri build
```
Built binaries and installers are output to:
`src-tauri/target/release/bundle/` (e.g. `.dmg` on macOS, `.AppImage` / `.deb` / `.rpm` on Linux).

---

## Versioning & Releases

Use the included helper script to synchronize versions across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`:

```bash
# Bump semantic versions
pnpm version:patch
pnpm version:minor
pnpm version:major

# Set explicit version
node scripts/set-version.mjs 1.2.0
```

---

## Related Documentation
- [System Architecture](file:///Users/danial/Documents/Projects/foxinal/docs/architecture.md)
- [Agent & Contributor Guide](../AGENTS.md)
