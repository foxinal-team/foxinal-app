# UI & Styling Guidelines

Foxinal features a polished "liquid glass" interface designed with modern UI standards, high contrast readability, and fluent animations.

---

## Styling Stack

- **Framework**: [Tailwind CSS v4](https://tailwindcss.com/) with `@tailwindcss/vite`
- **UI Primitives**: Radix UI (accessible dialogs, context menus, sliders, popovers, tabs)
- **Component Library**: [shadcn/ui](https://ui.shadcn.com/)
- **Iconography**: [`@tabler/icons-react`](https://tabler.io/icons)
- **Typography**: [Space Grotesk](https://fontsource.org/fonts/space-grotesk) via `@fontsource/space-grotesk` + system monospace fonts for terminals.
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/) toast system.

---

## Theme System

Managed via `next-themes` and `src/hooks/useTheme.ts`:
- **Modes**: `dark` (default), `light`, and `system`.
- **Atmospheric Backgrounds**: `src/components/Atmosphere.tsx` renders subtle radial lighting gradients dynamically adjusted to the active theme.
- **Translucency & Blurs**: Uses `backdrop-blur-md` and calibrated alpha borders to maintain readability over custom terminal windows.

---

## Component Guidelines

1. **Accessibility**: Always use Radix primitives with proper ARIA attributes for modals, dropdowns, and context menus.
2. **Keyboard Navigation**: Ensure hotkeys (e.g. `Cmd/Ctrl + T` for new tab, `Cmd/Ctrl + W` for close, `Cmd/Ctrl + ,` for settings) are intercepted without colliding with the active terminal emulator.
3. **Responsive Density**: Keep spacing compact and efficient for power users who manage dozens of hosts simultaneously.

---

## Related Documentation
- [System Architecture](file:///Users/danial/Documents/Projects/foxinal/docs/architecture.md)
- [Terminal & PTY Subsystem](file:///Users/danial/Documents/Projects/foxinal/docs/terminal-and-pty.md)
