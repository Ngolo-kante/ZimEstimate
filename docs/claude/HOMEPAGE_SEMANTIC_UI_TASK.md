# Claude Coding Task: Homepage Loading and Semantic UI Foundation

## Assignment

Act as the implementation engineer for ZimEstimate. Start with the homepage and
establish patterns that can later be reused across the rest of the application.

The reviewing engineer will inspect every diff and will only accept the work if
it improves clarity, mobile usability, accessibility, and maintainability without
changing existing product behavior.

## Repository Context

- Framework: Next.js 16.3, React 19, TypeScript, CSS Modules
- Primary route: `src/app/home/page.tsx`
- Homepage styles: `src/app/home/home.module.css`
- Global design tokens: `src/app/globals.css`
- Shared layout: `src/components/layout/MainLayout.tsx`
- Homepage budget component: `src/components/home/HeroBudgetWidget.tsx`
- Existing public smoke coverage: `tests/public-pages-smoke.spec.ts`
- Read `AGENTS.md` and the relevant Next.js documentation under
  `node_modules/next/dist/docs/` before editing.

## Objectives

### 1. Identify the loading-state rollout

Audit the application routes and produce `docs/SKELETON_LOADER_ROLLOUT.md` with
three priority groups:

1. High priority: authenticated or data-heavy money workflows where waiting is
   currently disruptive.
2. Medium priority: discovery, marketplace, contractor, and account pages.
3. Low priority: mostly static or near-instant public pages.

For each recommended route, document:

- what data or component causes the wait;
- the skeleton structure that should mirror the final layout;
- whether route-level `loading.tsx`, component-level Suspense, or an inline
  pending state is appropriate;
- mobile layout considerations;
- the test required to prevent regressions.

Do not implement skeletons across the whole application in this task.

### 2. Implement the homepage skeleton

Implement a production-quality route loading state for `/home` using the
appropriate Next.js convention.

Requirements:

- Mirror the real header, hero, budget widget, four BOQ pathway cards, and a hint
  of the next section so the page does not jump when content resolves.
- Use neutral surfaces and the existing border radius system.
- Do not display fake values, fake project information, or readable placeholder
  sentences.
- Mark the loading region appropriately for assistive technology.
- Use a restrained shimmer or pulse and disable it under
  `prefers-reduced-motion`.
- Avoid JavaScript timers and avoid adding a loading dependency.
- Keep the 320px mobile layout free from horizontal overflow.

### 3. Establish semantic color roles

Review the existing variables in `src/app/globals.css`. Preserve the navy brand
color and blue action color. Extend the token system only where a semantic role
is missing.

At minimum, provide consistent foreground, subtle background, and border roles
for:

- success / complete / on track;
- warning / attention / stale pricing;
- danger / destructive / over budget;
- information / neutral guidance;
- interactive focus.

Rules:

- Name tokens by meaning, not by hue.
- Reuse existing values where they already satisfy the role.
- Do not introduce purple decorative states, gradients, or additional competing
  brand colors.
- Colors cannot be the only way status is communicated.
- Ensure text and controls meet WCAG AA contrast.
- Apply the new roles to relevant homepage status UI, but do not perform a
  site-wide token migration in this task.

### 4. Tighten homepage copy

Audit supporting copy directly beneath homepage headings. Remove text only when
it repeats the heading, narrates the interface, or does not help the user decide
or act.

Keep copy that communicates any of the following:

- what input the user needs;
- how pathways differ;
- what result the user receives;
- trust, privacy, pricing, or Zimbabwe-specific context.

Prefer one useful sentence over two weak sentences. Do not change the approved
four pathway names:

- Create Your BOQ
- Plan to BOQ
- Quote to Project
- Quick Project

Include a short copy-change table in `docs/SKELETON_LOADER_ROLLOUT.md` showing
the original text, the revised or removed text, and the reason.

## UX Constraints

- Mobile is the primary field experience.
- Preserve the current ZimEstimate visual identity and homepage hierarchy.
- All four BOQ cards remain neutral at rest; recommendation is guidance, not a
  selected state.
- Use Phosphor icons already installed in the project; do not add emojis.
- Do not add cards inside cards, oversized decorative headings, or instructional
  text explaining the UI.
- Do not change navigation destinations or business logic.

## Verification

Before reporting completion, run:

```bash
npm run lint
npm run typecheck
npm run test:unit
npx playwright test tests/public-pages-smoke.spec.ts
npm run build
```

Also inspect `/home` at approximately 1440px, 390px, and 320px widths. Verify:

- no horizontal overflow;
- no text or badge collisions;
- loading and loaded layouts have similar geometry;
- keyboard focus remains visible;
- reduced-motion behavior is respected.

## Delivery

Do not commit or push. Return:

1. a concise summary of the decisions;
2. every changed file path;
3. verification results;
4. remaining risks or follow-up recommendations.

