# Project Refresh Report

## Overview
This report documents the refresh of three high-traffic pages to align with the new design system (Mbudzi). The refresh involved applying design tokens, implementing the `useReveal` motion hook, and ensuring mobile responsiveness.

## Refreshed Pages

### 1. Projects List (`src/app/projects/page.tsx`)
- **Design Tokens:** Applied `var(--color-primary)`, `var(--font-heading)`, and other tokens for consistent styling.
- **Motion:** Integrated `useReveal` for scroll-triggered animations on project cards and KPI sections.
- **Responsiveness:** Ensured the grid layout and filters adapt gracefully to mobile screens.
- **Refactoring:** Replaced hardcoded styles with token-based styles and consolidated logic.

### 2. Project Detail (`src/app/projects/[id]/page.tsx`)
- **Design Tokens:** Updated typography (`font-heading`) and colors (`bg-surface`, `text-primary`) to use the global design system.
- **Motion:** Applied `useReveal` to major sections (Overview, Budget Planner, Summary).
- **Layout:** Maintained the sidebar navigation and tabbed views while enhancing visual consistency.

### 3. Procurement Hub (`src/components/projects/UnifiedProcurementView.tsx`)
- **Design Tokens:** Refactored the UI to use semantic classes (`bg-surface`, `border-border`) mapped to design tokens.
- **Motion:** Added entrance animations for the toolbar, summary cards, and table rows using `useReveal`.
- **Structure:** Improved the table layout and tab navigation for better usability.

## Global Updates

### Global Styles (`src/app/globals.css`)
- **Tailwind Theme Integration:** Updated the `@theme inline` block to explicitly map design token variables (e.g., `--color-surface`, `--color-primary`) to Tailwind utility classes. This ensures that classes like `bg-surface` and `text-primary` work correctly throughout the application without needing manual CSS definitions in every component.

## Inconsistencies & Recommendations for Kante

During the refresh, the following inconsistencies were identified:

1.  **Font Loading Mismatch:**
    - `src/styles/design-tokens.css` defines `--font-heading` as `'Sora'` and `--font-body` as `'Instrument Sans'`.
    - `src/app/layout.tsx` currently loads `Geist` fonts (`--font-geist-sans`).
    - **Impact:** The application may display fallback fonts instead of the intended Sora/Instrument Sans.
    - **Recommendation:** Update `src/app/layout.tsx` to load Sora and Instrument Sans from Google Fonts or local files to match the design tokens.

2.  **Tailwind Configuration vs. CSS Variables:**
    - The project relies mainly on CSS variables in `design-tokens.css`. To make these usable with Tailwind v4's utility classes (e.g., `bg-primary`), we manually mapped them in `globals.css`.
    - **Recommendation:** As the design system grows, consider a more automated way to generate these mappings or strictly enforce the use of CSS variables in `style` props if utility classes are not preferred.

3.  **Component styling patterns:**
    - Some components use `style jsx` while others use Tailwind classes.
    - **Recommendation:** Standardize on one approach. The refresh heavily utilized Tailwind classes backed by the global theme for cleaner code.
