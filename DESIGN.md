# 🦊 Foxinal — Design System & Style Guide

> **Universal Design Specification**: Use this document across both the **Foxinal Desktop App** (`foxinal-app`) and the **Foxinal Web & Landing Site** (`foxinal-web`) to maintain 100% visual and interactive consistency.

---

## 1. Design Philosophy: *Liquid Glass & Atmospheric Depth*

Foxinal uses a dark-first **Liquid Glass** design system that blends deep obsidian surfaces, subtle radial lighting gradients, ultra-fine frosted borders, and high-energy fox-orange accents.

### Core Principles
1. **Atmospheric Depth**: Interfaces are not flat black; they sit on rich ambient gradient meshes that feel alive and responsive.
2. **Tactile Translucency**: Glassmorphism with `backdrop-blur-md` (14px–22px) and calibrated alpha borders (`oklch(1 0 0 / 0.1)`).
3. **High Contrast Readability**: Space Grotesk for crisp geometric headings and clean system monospace fonts for code and terminals.
4. **Snappy Micro-Interactions**: Custom cubic-bezier spring curves (`cubic-bezier(0.22, 1, 0.36, 1)`) for silky smooth animations.

---

## 2. Typography

| Role | Font Family | Fallbacks | Usage |
| :--- | :--- | :--- | :--- |
| **Headings & UI** | **Space Grotesk** | `ui-sans-serif`, `system-ui`, `sans-serif` | Brand titles, nav items, buttons, dialog headers |
| **Body Text** | **Space Grotesk** or **Inter** | `system-ui`, `sans-serif` | Descriptions, feedback posts, changelog markdown |
| **Monospace / Code** | **JetBrains Mono** / **SF Mono** | `ui-monospace`, `monospace` | Terminal outputs, POSIX permissions, octal codes, JSON |

### Web Font Import (HTML/Next.js)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 3. Color Palette & Tokens

### Primary Brand Colors
- **Fox Orange (Primary)**: `#ea580c` (`oklch(0.65 0.22 45)`)
- **Fox Bright (Hover/Accent)**: `#f97316`
- **Fox Deep (Active/Pressed)**: `#c2410c`
- **Fox Glow (Ambient)**: `oklch(0.55 0.16 49 / 0.14)`

### Dark Theme (Default)
```css
--background: oklch(0.14 0.015 280);       /* Deep Obsidian #0B0B10 */
--surface: oklch(1 0 0 / 0.06);            /* Translucent Glass Card */
--surface-solid: oklch(0.18 0.02 280);     /* Elevated Modal/Panel #14141E */
--foreground: oklch(0.96 0.005 75);        /* Crisp High-Contrast Text #F5F5F7 */
--muted-foreground: oklch(0.7 0.015 75);   /* Secondary / Muted Text #A1A1AA */
--line: oklch(1 0 0 / 0.1);                /* Default Border (10% White) */
--line-strong: oklch(1 0 0 / 0.16);         /* Hovered/Active Border (16% White) */
--field-bg: oklch(1 0 0 / 0.05);           /* Input & Textarea Surface */
--field-bg-hover: oklch(1 0 0 / 0.08);     /* Input Hover */
--field-bg-focus: oklch(1 0 0 / 0.1);      /* Input Focus */
--error: oklch(0.72 0.16 25);              /* Soft Coral Red #F43F5E */
--success: oklch(0.72 0.12 155);           /* Emerald Green #10B981 */
```

### Light Theme
```css
--background: oklch(0.985 0.005 75);      /* Soft Chalk #F8F8FA */
--surface: oklch(1 0 0 / 0.72);            /* Frosted White Glass */
--surface-solid: oklch(0.995 0.003 75);    /* Solid White Card #FFFFFF */
--foreground: oklch(0.18 0.01 60);         /* Deep Ink #18181B */
--muted-foreground: oklch(0.48 0.015 60);  /* Muted Slate #71717A */
--line: oklch(0.25 0.01 60 / 0.1);         /* 10% Black Line */
--line-strong: oklch(0.25 0.01 60 / 0.16); /* 16% Black Line */
```

---

## 4. Atmospheric Background (Glow Effect)

To recreate Foxinal's signature background on any landing page or view:

```tsx
export function Atmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Primary Warm Fox Glow */}
      <div 
        className="absolute -top-[25%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] rounded-full opacity-25 blur-[120px]"
        style={{ background: "radial-gradient(circle, #ea580c 0%, transparent 70%)" }}
      />
      {/* Secondary Cool Indigo Glow */}
      <div 
        className="absolute top-[40%] -right-[10%] w-[600px] h-[600px] rounded-full opacity-15 blur-[140px]"
        style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }}
      />
      {/* Deep Obsidian Gradient Mask */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0B0B10]/60 to-[#0B0B10]" />
    </div>
  );
}
```

---

## 5. UI Component Specs (shadcn / Radix compatible)

### A. Glass Cards & Panels
- **Class**: `bg-neutral-900/50 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl shadow-black/20`
- **Hover**: `hover:border-white/20 hover:bg-neutral-900/70 transition-all duration-200`

### B. Primary Fox Button
- **Default**: `bg-fox text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-orange-500/20 hover:bg-orange-500 hover:shadow-orange-500/30 active:scale-[0.98] transition-all`
- **Secondary (Glass)**: `bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 active:scale-[0.98] transition-all`

### C. Form Inputs & Textareas
- **Class**: `bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 transition-all`

### D. Badges & Chips
- **Orange/Feature**: `bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full px-2.5 py-0.5 text-xs font-medium`
- **Green/Success/Shipped**: `bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-0.5 text-xs font-medium`
- **Red/Bug/Destructive**: `bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full px-2.5 py-0.5 text-xs font-medium`
- **Neutral/Under Review**: `bg-white/5 text-neutral-400 border border-white/10 rounded-full px-2.5 py-0.5 text-xs font-medium`

---

## 6. Iconography (`@tabler/icons-react`)

Always use `@tabler/icons-react` with unified stroke width:
- **Default Stroke**: `stroke={1.75}`
- **Default Sizes**:
  - Buttons / Controls: `size={18}`
  - List items / Table cells: `size={16}`
  - Section headers / Bento icons: `size={24}` to `size={28}`

### Common Icon Mappings:
- 🖥️ Terminal: `IconTerminal2`
- 📂 SFTP / Files: `IconFolder`, `IconFileCode`, `IconArrowsLeftRight`
- 🖼️ Image Viewer: `IconPhoto`, `IconEye`
- 🔐 Vault / Security: `IconShieldLock`, `IconKey`, `IconLock`
- 💡 Feature Request: `IconBulb`, `IconSparkles`
- 🐛 Bug Report: `IconBug`, `IconAlertTriangle`
- 🚀 Updates / Releases: `IconRocket`, `IconHistory`
- ⬆️ Upvote: `IconChevronUp`, `IconArrowBigUp`

---

## 7. Motion & Easing Curves

Foxinal uses a custom spring-like ease curve for all drawer, modal, and panel entrances:

```css
--ease-fox: cubic-bezier(0.22, 1, 0.36, 1);
```

- **Panel Rise Entrance**: `translateY(12px) opacity-0` → `translateY(0) opacity-1` over `0.35s ease-out`
- **Button Micro-interaction**: `transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)` with `active:scale-[0.98]`
