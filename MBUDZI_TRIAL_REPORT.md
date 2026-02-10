# Mbudzi Trial Task Report

## Delivered Files
- `src/app/market-insights/page.tsx`: Refreshed with new design tokens and motion.
- `src/app/marketplace/suppliers/page.tsx`: Refreshed with new design tokens, motion, and pagination improvements.

## Inconsistencies & Observations

During the refresh, I identified the following areas for potential improvement:

1.  **Global Token Import**:
    - `src/styles/design-tokens.css` is not imported globally (e.g., in `src/app/globals.css` or `src/app/layout.tsx`).
    - **Impact**: It requires manual import in every page file (`import '@/styles/design-tokens.css'`), which is repetitive and error-prone.
    - **Recommendation**: Import it once in `src/app/layout.tsx`.

2.  **Duplicated Motion Logic**:
    - The `IntersectionObserver` logic for the `.reveal` animation is duplicated in `home`, `market-insights`, and `marketplace` pages.
    - **Impact**: Violates DRY principles and makes it harder to update animation triggers globally.
    - **Recommendation**: Extract this logic into a custom hook (e.g., `useReveal`) or a wrapper component.

3.  **Font Loading Strategy**:
    - The design tokens reference `Sora` and `Instrument Sans`. However, `src/app/layout.tsx` only loads `Geist` fonts.
    - **Impact**: Unless these fonts are loaded via CSS import in `globals.css` (which I couldn't verify) or another method, the application will likely render system fallback fonts.
    - **Recommendation**: Add `next/font` configurations for Sora and Instrument Sans in `layout.tsx` to match the tokens.

4.  **Local Component Definitions**:
    - `PriceDisplay` is defined locally in `market-insights/page.tsx`.
    - **Impact**: Limits reusability if this component is needed elsewhere.
    - **Recommendation**: Move to `src/components/ui/PriceDisplay.tsx`.
