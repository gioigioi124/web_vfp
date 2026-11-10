---
name: Ledger & Vector
colors:
  surface: "#f8f9ff"
  surface-dim: "#ccdbf3"
  surface-bright: "#f8f9ff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#eff4ff"
  surface-container: "#e6eeff"
  surface-container-high: "#dce9ff"
  surface-container-highest: "#d5e3fc"
  on-surface: "#0d1c2e"
  on-surface-variant: "#444651"
  inverse-surface: "#233144"
  inverse-on-surface: "#eaf1ff"
  outline: "#757682"
  outline-variant: "#c5c5d3"
  surface-tint: "#4059aa"
  primary: "#00236f"
  on-primary: "#ffffff"
  primary-container: "#1e3a8a"
  on-primary-container: "#90a8ff"
  inverse-primary: "#b6c4ff"
  secondary: "#006398"
  on-secondary: "#ffffff"
  secondary-container: "#5bb8fe"
  on-secondary-container: "#00476e"
  tertiary: "#442100"
  on-tertiary: "#ffffff"
  tertiary-container: "#653400"
  on-tertiary-container: "#fc922b"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#dce1ff"
  primary-fixed-dim: "#b6c4ff"
  on-primary-fixed: "#00164e"
  on-primary-fixed-variant: "#264191"
  secondary-fixed: "#cce5ff"
  secondary-fixed-dim: "#93ccff"
  on-secondary-fixed: "#001d31"
  on-secondary-fixed-variant: "#004b73"
  tertiary-fixed: "#ffdcc3"
  tertiary-fixed-dim: "#ffb77d"
  on-tertiary-fixed: "#2f1500"
  on-tertiary-fixed-variant: "#6e3900"
  background: "#f8f9ff"
  on-background: "#0d1c2e"
  surface-variant: "#d5e3fc"
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 1.5rem
    fontWeight: "700"
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 1.25rem
    fontWeight: "600"
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 1.125rem
    fontWeight: "600"
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 0.9375rem
    fontWeight: "400"
    lineHeight: 1.375rem
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 0.8125rem
    fontWeight: "400"
    lineHeight: 1.125rem
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 0.75rem
    fontWeight: "400"
    lineHeight: 1rem
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: "400"
    lineHeight: 1rem
    letterSpacing: -0.01em
  data-mono-bold:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: "600"
    lineHeight: 1rem
    letterSpacing: -0.01em
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 0.75rem
    fontWeight: "600"
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 0.6875rem
    fontWeight: "600"
    lineHeight: 0.875rem
    letterSpacing: 0.04em
  kbd-shortcut:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: "500"
    lineHeight: 0.875rem
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-compact: 0.375rem
  margin: 1rem
  margin-compact: 0.5rem
  space-xs: 0.125rem
  space-sm: 0.25rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

The design system is engineered for mission-critical enterprise resource planning, financial ledgers, and tabular data intelligence. It addresses power users, financial analysts, comptrollers, and technical operators who spend 6–10 hours daily parsing high-density alphanumeric records, executing reconciliation flows, and running raw SQL audits.

The aesthetic philosophy balances **Corporate Modernism** with **Engineered Precision**. It favors functional density over decorative white space, utilizing precise structural outlines, low optical fatigue surfaces, deliberate contrast hierarchies, and mechanical data alignment.

The visual tone communicates unwavering stability, deterministic accuracy, and rapid operational throughput. Interfaces prioritize high visual parsing speed, tabular scannability, deterministic keyboard navigation, and instant contextual clarity.

## Colors

The palette is anchored by deep corporate blues, cool slate neutrals, and functional signaling tokens tuned for light-mode accounting environments:

- **Primary (`#1E3A8A` - Navy Deep)**: Drives top-level app structure, active table row highlights, primary action triggers, and primary navigational states.
- **Secondary (`#0284C7` - Slate Blue Accent)**: Applied to interactive links, active tabular filters, focal controls, and active splitters.
- **Tertiary (`#D97706` - Amber / Warning Balance)**: Applied for reconciliation alerts, pending journal entries, non-blocking discrepancies, and attention states.
- **Neutral (`#475569` - Slate Carbon)**: Establishes structural grid borders, low-glare surface scaffolding, column divider strokes, and crisp body copy.

### Functional Status Indicators

- **Success / Balanced Credit (`#059669`)**: Cleared states, matching debits/credits, validated entries.
- **Critical / Negative Outflow (`#DC2626`)**: Ledger imbalance, reconciliation exceptions, overdue transactions, and destructive operations.
- **Information / Query Context (`#2563EB`)**: Execution logs, system timestamps, and meta tags.

### Surface Tiers

- **Canvas Base (`#F8FAFC`)**: Structural workspace background that reduces monitor glare.
- **Surface Elevation 0 (`#FFFFFF`)**: Primary tabular cell backgrounds and modal sheet surfaces.
- **Surface Elevation 1 (`#F1F5F9`)**: Sticky column headers, table footers, nested query inspectors, and toolbars.
- **Surface Hover / Selection (`#E0E7FF` / `#EEF2F6`)**: Deterministic row selection and cursor hover states.

## Typography

The typographic hierarchy is calibrated specifically for data readability, tabular vertical scannability, and high density.

- **Primary Interface Type (`Hanken Grotesk`)**: Chosen for its structural rigidity, open apertures, and robust rendering at 11px–13px. Used for all application shell controls, labels, and contextual dialogue.
- **Monospace Engine (`JetBrains Mono`)**: Mandatory for all raw numeric values, accounting balances, currency symbols, transaction hashes, UUIDs, SQL queries, and keyboard shortcut tokens. It features slashed zeros, unambiguous glyph separation (e.g., `1`, `l`, `I`), and tabular figures that ensure column-wise numeric alignment.

### Numeric Alignment Rules

- **Monetary & Ledger Totals**: Always right-aligned, set in `data-mono` with identical character bounding boxes. Negative values must utilize accounting parentheses `(1,240.50)` or persistent prepended minus glyphs with semantic color coding.
- **Dates & Identifiers**: Always left-aligned or centered, rendered in `data-mono` using ISO-8601 formatting (`YYYY-MM-DD HH:mm:ss`).

## Layout & Spacing

The layout utilizes a continuous **compact fluid-grid framework** built around a tight 4px base modular unit. It is strictly optimized for high-resolution desktop viewports (1440px to 4K multi-monitor workstations), with deliberate collapsible panes for side drawers, SQL consoles, and detail flyouts.

### Structural Rhythm

- **Default Grid**: 12-column or 24-column flexible grid with `0.75rem` (12px) gutters and `1rem` (16px) canvas boundaries.
- **Docked Panes**: Sidebars, SQL query runtimes, and balance sheet drawers use fixed-width anchors (e.g., 260px or 380px) while the core table canvas claims 100% of the remaining viewport.
- **Component Tightness**: Row heights across data tables adhere to 3 strict density modes:
  - _Compact (High Density)_: 28px cell height; `space-xs` (2px) vertical padding, `space-md` (8px) horizontal padding.
  - _Standard_: 36px cell height; `space-sm` (4px) vertical padding, `space-lg` (12px) horizontal padding.
  - _Comfortable_: 44px cell height; used only in review modals or approval stages.

## Elevation & Depth

To maximize data density and eliminate visual distraction, this system completely rejects heavy blurs, diffusion shadows, and skeuomorphic gradients. Depth is established through **tonal surface stacking** and **crisp 1px low-contrast structural borders**.

### Layer Hierarchy

- **Level 0 (Base Canvas - `#F8FAFC`)**: The master desktop backdrop containing structural splits.
- **Level 1 (Panels & Table Bodies - `#FFFFFF`)**: Enclosed by a continuous `1px solid #CBD5E1` border.
- **Level 2 (Sticky Headers & Toolbar Strips - `#F1F5F9`)**: Glued to the viewport top/left using `z-index: 10`. Separated from scrolling data by a distinct `1px solid #94A3B8` divider line.
- **Level 3 (Dropdown Menus & Overlays)**: Floated using a hairline border (`1px solid #94A3B8`) paired with an ultra-subtle, directional administrative shadow: `0 2px 4px -1px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.04)`.
- **Level 4 (Modal Sheets & Query Consoles)**: Raised surfaces with `1px solid #64748B` border and an ambient `0 10px 15px -3px rgba(15, 23, 42, 0.12)`.

## Shapes

The design system uses a **Soft (Level 1)** structural radius. Sharp corners convey data rigidity and spreadsheet parity, while microscopic rounding (`0.25rem` / 4px) softens the functional impact of interactive inputs, buttons, and popovers.

- **Data Cells & Table Grids**: Strictly `0px` radius. Interior grid borders intersect with razor-sharp edges to maintain cell alignment.
- **Controls & Form Inputs**: `0.25rem` (4px) border radius for inputs, filter chips, buttons, and status tags.
- **Modal Containers & Dialogues**: `0.5rem` (8px) maximum boundary rounding (`rounded-lg`), ensuring enterprise authority without ornamental softness.
- **Keyboard Shortcut Badges (`<kbd>`)**: `0.25rem` (4px) with inner structural border framing.

## Components

### 1. Data Tables & Sticky Headers

- **Header Columns**: Height 32px, surface `#F1F5F9`, text in `label-sm` (uppercase, letter-spaced, slate-600). Top and bottom pinned with `1px solid #CBD5E1`. Resizable drag handles positioned at the right boundary of each column.
- **Sticky Behavior**: Table header (`thead`) remains fixed during vertical scroll. Primary key columns (e.g., Ledger ID, Account Number) stick to the left with an active right-edge border drop (`2px solid #94A3B8`).
- **Cells**: Single-line truncation with tooltip triggers; right-aligned numeric data set in `data-mono`. Inline edit inputs fill 100% of the cell volume with an active `#1E3A8A` focus outline.

### 2. Action Toolbars

- **Container**: Pinned above data grids, 40px height, flex-row layout, containing bulk actions, global search, and query filters.
- **Quick Action Clusters**: Grouped button sets sharing a contiguous border frame. Left-aligned search with clear shortcut indicator (`/` or `Ctrl+K`).

### 3. Buttons & Split Triggers

- **Primary Button**: Solid `#1E3A8A`, text `#FFFFFF`, height 28px/32px, `space-lg` horizontal padding, font `label-md`. Focus ring: `2px solid #0284C7` with 1px white offset.
- **Secondary / Ghost Button**: Surface transparent, `1px solid #CBD5E1`, text `#334155`. Hover state uses `#F1F5F9`.
- **Keyboard Trigger Affordance**: Buttons mapped to system actions visually display an integrated mono keycap right-aligned inside the button container.

### 4. Status Tags & Audit Chips

- **Geometry**: Compact height 20px, horizontal padding `space-sm` (4px), font `label-sm`.
- **Variants**:
  - _Balanced / Posted_: Background `#ECFDF5`, text `#065F46`, border `#A7F3D0`.
  - _Pending / In Review_: Background `#FFFBEB`, text `#92400E`, border `#FDE68A`.
  - _Failed / Discrepancy_: Background `#FEF2F2`, text `#991B1B`, border `#FECACA`.
  - _Draft / System Log_: Background `#F1F5F9`, text `#475569`, border `#CBD5E1`.

### 5. Form Inputs & SQL Editors

- **Standard Field**: 30px height, background `#FFFFFF`, border `1px solid #94A3B8`, text `body-md`. Focus switches border to `#1E3A8A` with a distinct `0 0 0 1px #1E3A8A` ring.
- **Inline Cell Inputs**: No default border until hovered or active; double-click converts static text into an active monospace edit field.
- **SQL Console Panel**: Surface `#0F172A`, syntax highlighting tuned for SQL-92 standards, text `data-mono`, line numbers right-aligned in slate-500.

### 6. Keyboard Shortcut Badges (`<kbd>`)

- **Visuals**: Background `#F8FAFC`, border `1px solid #94A3B8`, bottom edge `2px solid #64748B`, font `kbd-shortcut`.
- Displayed ubiquitously next to contextual menu options, row navigation commands, and query execution triggers (e.g., `⌘ + Enter`).

### 7. Selection & Checkboxes

- **Table Checkboxes**: Square 14px size, centered in a dedicated 32px wide column. Indeterminate states explicitly represented via a solid horizontal bar for partial ledger selection.
