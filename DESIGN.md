# 기그온 Design System

## 1. Atmosphere & Identity

기그온 feels like a clear, practical AI work marketplace: calm enough for first-time clients, structured enough for repeat work. The signature is a clean marketplace surface with trust metadata close to each decision point.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--surface` | `#ffffff` | `#0f172a` | Cards, primary panels |
| Surface/secondary | `--background` | `#f8fafc` | `#111827` | Page background and soft panels |
| Text/primary | `--text-primary` | `#0f172a` | `#f8fafc` | Headlines, body emphasis |
| Text/secondary | `--text-secondary` | `#475569` | `#cbd5e1` | Descriptions, metadata |
| Text/muted | `--text-muted` | `#94a3b8` | `#64748b` | Empty states, subtle labels |
| Border/default | `--border-color` | `#e2e8f0` | `#334155` | Dividers, card outlines |
| Brand/navy | `--gigon-navy` | `#071a3d` | `#ffffff` | Gig wordmark, search CTA, footer |
| Accent/primary | `--primary`, `--gigon-blue` | `#0f70ed` | `#60a5fa` | On wordmark, primary CTA, links, focus |
| Accent/hover | `--primary-hover` | `#075fd1` | `#93c5fd` | CTA hover state |
| Accent/secondary | `--secondary` | `#4a9cff` | `#38bdf8` | Secondary accents |
| Status/danger | `--danger` | `#e11d48` | `#fb7185` | Errors, destructive actions |
| Status/danger strong | `--danger-strong` | `#991b1b` | `#fecdd3` | Destructive section headings |
| Status/danger muted | `--danger-muted` | `#7f1d1d` | `#fecaca` | Destructive explanatory copy |
| Status/rating | `--star` | `#fbbf24` | `#facc15` | Ratings |

### Rules

- Use blue only for actions, active states, and trust signals.
- Prefer neutral surfaces and subtle borders over decorative gradients.
- Add a token here before introducing any new reusable color.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | `2.5rem` | 800 | 1.15 | 0 | Home hero and major page titles |
| H1 | `2rem` | 800 | 1.2 | 0 | Product/page titles |
| H2 | `1.5rem` | 800 | 1.3 | 0 | Section headings |
| H3 | `1.125rem` | 750 | 1.4 | 0 | Card titles |
| Body | `0.9375rem` | 400 | 1.5 | 0 | Default body |
| Body/sm | `0.875rem` | 500 | 1.45 | 0 | Secondary text |
| Caption | `0.8125rem` | 700 | 1.35 | 0 | Labels and metadata |

### Font Stack

- Primary: `Pretendard Variable`, Pretendard, system UI, sans-serif.
- Mono: system monospace only when displaying code or fixed-width data.

### Rules

- Keep Korean marketplace copy direct and sentence case.
- Body text should stay at least `0.875rem`.
- Do not use negative letter spacing.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a base of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight icon gaps |
| `--space-2` | 8px | Inline groups |
| `--space-3` | 12px | Compact card gaps |
| `--space-4` | 16px | Default component padding |
| `--space-5` | 20px | Detail card padding |
| `--space-6` | 24px | Section/card padding |
| `--space-8` | 32px | Section groups |
| `--space-10` | 40px | Detail page section spacing |
| `--space-16` | 64px | Page-level rhythm |

### Grid

- Max content width: `--container-max` / 1280px.
- Product detail layout: one content column plus a sticky purchase sidebar on desktop.
- Mobile layout collapses to one column.

### Rules

- Use responsive grids for repeated marketplace cards.
- Keep fixed-format controls stable with explicit widths, aspect ratios, or min-heights.

## 5. Components

### Marketplace Card

- **Structure**: media thumbnail, title, seller/meta, price.
- **States**: default, hover, focus.
- **Accessibility**: card links need descriptive `aria-label` values.
- **Motion**: hover may use subtle color or border shifts only.

### Product Detail Section

- **Structure**: semantic `section`, icon plus heading, content block.
- **Spacing**: `--space-10` vertical rhythm with a bottom border in the main detail flow.
- **Accessibility**: heading names must describe the section content.

### Seller Info Card

- **Structure**: avatar, seller identity, trust metadata, contact CTA, profile summary.
- **States**: inquiry button supports default, hover, focus, disabled/loading.
- **Accessibility**: trust metadata uses clear label/value pairs.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 150ms | ease-out | Button hover and active |
| Standard | 200ms | ease-in-out | Card hover and menus |

### Rules

- Animate `transform`, `opacity`, or color only.
- Every clickable element needs visible hover and keyboard focus states.
- Loading text should preserve layout size where possible.

## 7. Depth & Surface

### Strategy

기그온 uses a mixed but restrained strategy: subtle borders define marketplace structure, and shadows are reserved for navigation or floating overlays.

| Level | Value | Usage |
|-------|-------|-------|
| Border/default | `1px solid var(--border-color)` | Cards, detail sections, dividers |
| Radius/md | `--radius-md` / 8px | Small controls |
| Radius/lg | `--radius-lg` / 12px | Compact cards |
| Radius/xl | `--radius-xl` / 16px | Detail cards |
| Radius/2xl | `--radius-2xl` / 24px | Large panels |

### Rules

- Do not nest cards inside decorative cards.
- Keep product detail content flatter than marketing pages so comparison and purchase decisions stay easy to scan.
