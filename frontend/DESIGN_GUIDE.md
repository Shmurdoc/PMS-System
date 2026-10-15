# NEXUS PMS - Design System Guide

## Overview

This document establishes the design standards for NEXUS PMS, ensuring visual consistency across all features and components.

---

## Color Palette

### Primary Colors (Gold Accent)
| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `hsl(38 45% 65%)` | Main accent, CTAs, highlights |
| `--accent-gold` | `#c9a87c` | Warm gold accent |
| `--accent-gold-dim` | `#a38b65` | Muted gold for secondary elements |
| `--accent-gold-glow` | `rgba(201,168,124,0.3)` | Glow effects |

### Semantic Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `hsl(142 76% 45%)` | Positive states, confirmations |
| `--warning` | `hsl(38 92% 50%)` | Warnings, pending states |
| `--info` | `hsl(217 91% 60%)` | Information, links |
| `--destructive` | `hsl(0 65% 55%)` | Errors, destructive actions |

### Background & Surface (Dark Theme)
| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `hsl(0 0% 7%)` | Page background |
| `--card` | `hsl(0 0% 9%)` | Card backgrounds |
| `--surface` | `#111113` | Base surface |
| `--surface-elevated` | `#1c1c1e` | Elevated elements |
| `--surface-raised` | `#28282a` | Raised elements |
| `--surface-floating` | `#323234` | Floating elements |

### Text Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--foreground` | `hsl(0 0% 95%)` | Primary text |
| `--text-primary` | `#e5e5e7` | Primary text (alternative) |
| `--text-secondary` | `#8e8e93` | Secondary text |
| `--text-tertiary` | `#636366` | Tertiary text |
| `--text-muted` | `#48484a` | Muted text |

### Border & Input
| Token | Hex | Usage |
|-------|-----|-------|
| `--border` | `hsl(0 0% 18%)` | Default borders |
| `--input` | `hsl(0 0% 14%)` | Input backgrounds |
| `--muted` | `hsl(0 0% 14%)` | Muted backgrounds |
| `--muted-foreground` | `hsl(0 0% 55%)` | Muted text |

---

## Typography

### Font Family
```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-display: 'Cal Sans', 'Inter', sans-serif;
```

### Type Scale
- **Body**: 14px, line-height 1.6
- **Headings**: Use `font-semibold` or `font-bold`
- **Small text**: 12px (`text-xs`)
- **Labels**: 14px, `font-medium`

---

## Spacing System

Use Tailwind's spacing scale. Key values:

| Token | Value | Usage |
|-------|-------|-------|
| `p-4` | 1rem | Standard padding |
| `p-5` | 1.25rem | Card padding |
| `p-6` | 1.5rem | Large spacing |
| `gap-4` | 1rem | Standard gap |
| `gap-6` | 1.5rem | Large gap |
| `space-y-6` | 1.5rem | Section spacing |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-lg` | `var(--radius)` = 0.75rem | **Default** for cards, buttons, inputs |
| `rounded-xl` | `calc(var(--radius) + 4px)` | Larger cards, panels |
| `rounded-md` | `calc(var(--radius) - 2px)` | Smaller elements |
| `rounded-2xl` | 1.5rem | Feature cards, login forms |
| `rounded-full` | 9999px | Pills, avatars, badges |

---

## Component Patterns

### Cards

```tsx
// Standard Card
<div className="bg-card border border-border rounded-xl p-5 hover-lift">
  {/* Content */}
</div>

// Panel Card (with header)
<div className="bg-card border border-border rounded-xl overflow-hidden">
  <div className="px-5 py-4 border-b border-border">
    <h3 className="font-semibold">Title</h3>
  </div>
  <div className="p-5">{children}</div>
</div>
```

### Metric Cards

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-card border border-border rounded-xl p-5 hover-lift"
>
  <div className="flex items-start justify-between">
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
    <div className="p-3 bg-primary/10 rounded-lg">
      <Icon className="w-5 h-5 text-primary" />
    </div>
  </div>
</motion.div>
```

### Buttons

```tsx
// Primary Button
<button className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
  Action
</button>

// Secondary Button
<button className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
  <Icon className="w-4 h-4" />
  Action
</button>

// Icon Button
<button className="p-2 hover:bg-muted rounded-lg transition-colors">
  <Icon className="w-4 h-4" />
</button>

// Danger Button
<button className="p-2 hover:bg-muted rounded-lg transition-colors text-red-500">
  <Icon className="w-4 h-4" />
</button>
```

### Status Badges

```tsx
const styles: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'checked-in': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  // ...
};

<span className="px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}">
  {children}
</span>
```

### Form Inputs

```tsx
// Text Input
<input
  type="text"
  placeholder="Search..."
  className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
/>

// Select
<select className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
  {/* Options */}
</select>
```

### Tables

```tsx
<div className="overflow-x-auto">
  <table className="w-full">
    <thead>
      <tr className="border-b border-border">
        <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Header</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
        <td className="py-3 px-4 text-sm">Cell</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Search Input with Icon

```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
  <input
    type="text"
    placeholder="Search..."
    className="pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-primary/50"
  />
</div>
```

---

## Animation Guidelines

### Timing
| Token | Duration | Usage |
|-------|----------|-------|
| `--duration-fast` | 100ms | Hover states, micro-interactions |
| `--duration-normal` | 200ms | Default transitions |
| `--duration-slow` | 300ms | Page transitions, modals |
| `--duration-slower` | 500ms | Large reveals |
| `--duration-slowest` | 800ms | Dramatic entrances |

### Easing
| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | **Default** - smooth deceleration |
| `--ease-in-expo` | `cubic-bezier(0.7, 0, 0.84, 0)` | Accelerating |
| `--ease-elastic` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Bouncy effects |
| `--ease-smooth` | `cubic-bezier(0.4, 0, 0.2, 1)` | Linear-ish |

### Animation Patterns

```tsx
// Card entrance (staggered)
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.05 }}
>
  {children}
</motion.div>

// Modal/Panel slide-in
<motion.div
  initial={{ opacity: 0, x: '100%' }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: '100%' }}
  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
>
  {children}
</motion.div>

// Fade in
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  {children}
</motion.div>
```

### Hover Effects

```css
.hover-lift {
  transition: transform var(--duration-normal) var(--ease-out-expo),
              box-shadow var(--duration-normal) var(--ease-out-expo);
}
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.hover-glow:hover {
  box-shadow: var(--shadow-glow);
}

.hover-scale:hover {
  transform: scale(1.02);
}
```

---

## Layout & Grid

### Grid System
- **Dashboard**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` for metrics
- **Cards Grid**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **Property Grid**: `grid-cols-1 lg:grid-cols-3`

### Layout Structure
```
Header: --header-height = 64px
Sidebar: --sidebar-width = 280px, --sidebar-collapsed = 72px
Content Area: ml-[280px] when expanded, ml-[72px] when collapsed
```

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | **Desktop** (sidebar visible) |
| `xl` | 1280px | Large screens |

### Responsive Patterns

```tsx
// Mobile-first approach
<div className="space-y-4">
  {/* Stack vertically on mobile */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* Cards that adapt */}
  </div>
</div>

// Sidebar handling
<aside className={`fixed left-0 top-0 h-full transition-transform duration-300
  ${sidebarCollapsed ? 'w-[72px]' : 'w-[280px]'}
  -translate-x-full lg:translate-x-0`}>
</aside>
```

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.3)` | Subtle depth |
| `--shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.4)` | Cards |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.5)` | Hover states |
| `--shadow-glow` | `0 0 20px rgba(201, 168, 124, 0.3)` | Gold glow |
| `--shadow-glow-lg` | `0 0 40px rgba(201, 168, 124, 0.4)` | Emphasized glow |

---

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | 0 | Default |
| `--z-dropdown` | 100 | Dropdowns |
| `--z-sticky` | 200 | Sticky elements |
| `--z-fixed` | 300 | Fixed elements |
| `--z-modal-backdrop` | 400 | Modal backgrounds |
| `--z-modal` | 500 | Modals |
| `--z-popover` | 600 | Popovers |
| `--z-tooltip` | 700 | Tooltips |
| `--z-toast` | 800 | Toast notifications |
| `--z-command-palette` | 900 | Command palette |

---

## Status Color Mapping

| Status | Color Scheme | Hex |
|--------|--------------|-----|
| Available / Confirmed / Active / Connected | Green | `emerald-500` |
| Pending / Warning / Syncing / On-Break | Amber | `amber-500` |
| Checked-in / Occupied / VIP | Blue | `blue-500` |
| Cancelled / Error / Maintenance | Red | `red-500` |
| Checked-out / Disconnected / Off-Duty | Slate | `slate-500` |
| New / Corporate / Cleaning / Reserved | Purple / Cyan | `purple-500` / `cyan-500` |

---

## Glass Effects

```css
.glass {
  background: rgba(28, 28, 30, 0.7);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.glass-strong {
  background: rgba(17, 17, 19, 0.9);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

---

## Accessibility

### Focus States
```css
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Common Patterns Checklist

- [ ] Use `rounded-xl` (0.75rem) as default border radius
- [ ] Apply `hover-lift` class to interactive cards
- [ ] Use gold accent (`--primary` / `text-primary`) for CTAs
- [ ] Add `transition-colors` to all interactive elements
- [ ] Use `focus:ring-2 focus:ring-primary/50` on all inputs
- [ ] Apply entrance animations with `motion.div` from framer-motion
- [ ] Use semantic status colors consistently
- [ ] Add `text-muted-foreground` for secondary text
- [ ] Ensure minimum 44px touch targets on mobile
- [ ] Test all colors in both light and dark themes

---

## Icon Guidelines

- Use Lucide React icons
- Standard size: `w-4 h-4` (inline), `w-5 h-5` (buttons), `w-6 h-6` (feature icons)
- Color: `text-muted-foreground` for UI, `text-primary` for emphasis

---

## File Structure

```
src/
├── components/
│   ├── ui/           # Reusable UI components
│   ├── features/     # Feature-specific components
│   └── layout/       # Layout components (Sidebar, Header)
├── App.tsx           # Main application
└── index.css         # Global styles and design tokens
```

---

*Last Updated: 2026-03-20*
