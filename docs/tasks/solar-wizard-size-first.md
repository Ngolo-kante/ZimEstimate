# Solar wizard: size first, fewer steps, plus a gold refresh of the quick-project wizards (19 Nov 2026)

Owner decisions, settled. A solar expert told the owner that people in Zimbabwe buy solar by size, starting from 1kVA, and that every question needs a "Not sure" answer. Today a backup buyer goes through 9 screens:
1. goal
2. property
3. backup hours
4. appliances
5. same-time loads
6. roof
7. recommendation
8. brands
9. optional costs

Rebuild the solar wizard as below and give all quick-project wizards the refreshed look.

Read first:
- `AGENTS.md`
- `src/components/quick-projects/SolarQuickWizard.tsx` (current flow, `stepOrder`, `activeSteps`, `restoredSolar`, `onSave`)
- `src/components/quick-projects/SolarBudgetExplorer.tsx` (`groupPackagesByKva`, `PackageCard`, and how a chosen package becomes BOQ items)
- `src/lib/quick-projects/solar/catalog.ts` (`SOLAR_PACKAGES`, `INVERTER_TIERS`)
- `src/lib/quick-projects/solar/calculations.ts`
- `src/lib/quick-projects/solar/boq.ts`
- `src/components/projects/StartOptions.tsx` and `StartOptions.module.css` (the owner's starred card and icon style)

## 1. New solar flow

### Step 1: "What size are you looking at?"
Intro line: "Most homes start with 1kVA and add more later."

Five tiles, in this order:

| Tile | Covers packages with | What it runs |
|---|---|---|
| **1kVA** | `kva < 2` | from the packages' `appliances` text, e.g. "Lights, Wi-Fi, TV, phone charging" |
| **3kVA** | `2 ≤ kva < 4` | from the packages' `appliances` text |
| **5kVA** | `4 ≤ kva < 7` | from the packages' `appliances` text |
| **8kVA and up** | `kva ≥ 7` | from the packages' `appliances` text |
| **Not sure? Help me choose** | — | starts the guided path |

- The size tiles also show "From $X", the lowest `price` in that group, computed from `SOLAR_PACKAGES` and never typed in.
- "1kVA" can carry a small "Most popular" badge, styled like the House badge in `StartOptions`.
- Under the tiles, two quiet text links:
  - "Have a budget? See what it buys" goes to `/quick-budget?mode=solar`.
  - "Check a solar quote you have" switches the wizard into the existing quote-check path (`quote` step, then `results`), which is otherwise unchanged.

### Size path: step 2 "Your 1kVA options" (2 screens in total)
- Show that group's packages as cards (reuse `PackageCard`), cheapest first. The first card says "Lowest price".
- Choosing a card shows its parts on the same screen in the owner's priority order: battery, panels, inverter, then wiring kit, then labour.
- Also on the same screen:
  - **Brand preferences** in a closed "Change brands" disclosure, defaulting to "No preference".
  - **Optional costs** as the same toggles as today.
- Save builds the BOQ exactly as the Budget Estimator loads a package, then calls the existing `onSave`.
- Never silently change a choice the person made.

### "Not sure" path (4 screens in total)
1. **Backup hours**
   - Same choices as today, plus "Not sure — use 4 hours".
   - Off-grid (8+ hours) stays one of the choices; the old goal screen's backup, heavy backup and off-grid were the same question.
2. **Appliances**
   - The audit, with the old same-time-loads screen folded in as a "Runs at the same time" tick on heavy appliances.
   - Add a "Not sure — use a typical home" button that applies `buildDefaultSelections()`.
3. **Recommendation**
   - The existing results.
   - Brands (closed "Change brands", default "No preference") and optional costs moved onto this screen.

### Removed screens
- **Goal**: replaced by step 1 and its two links.
- **Property context**: the city and property type no longer drive the sizing; keep the fields' defaults so saved data still loads.
- **Same-time loads**: folded into appliances.
- **Roof**: assume there is enough roof. Add one line on the recommendation: "Each panel needs about 2 m² of roof."
- **Existing system** ("replace"): drop it.

### Rules for the solar changes
- Add `1` to `INVERTER_TIERS`, so the "Not sure" path can recommend 1kVA for small loads. Update the calculation tests, and add a test that a lights, TV and Wi-Fi load sizes to 1kVA.
- The step counter shows this path's real length: "Step 1 of 2" or "Step 2 of 4".
- Restoring a saved solar estimate (`restoredSolar`) must keep working. Older saves with removed fields load with sensible defaults.

## 2. Look (solar and all quick-project wizards: `SolarQuickWizard`, `QuickProjectWizard`)

- **Choice tiles and option cards** follow the starred style:
  - white card, 1px #e2e8f0 border, 16px radius
  - icon in a 44–48px pale #f1f5f9 tile, using Phosphor `weight="duotone"` with a navy outline and the fill set to #e9c46a at 0.75 opacity via `svg [opacity='0.2']`
  - name in semibold navy, detail line in #475569
- **Selected state**: border #1d4ed8 on a #eff6ff background. Pressed: `scale(0.98)`. Hover only inside `@media (hover: hover) and (pointer: fine)`.
- **Text**:
  - Sentence case: "SOLAR GUIDED SETUP" becomes "Solar setup", and drop other uppercase eyebrows.
  - At least 12px everywhere, 44px tap targets.
  - Respect `prefers-reduced-motion`.
- **Other wizards' content**: no flow changes in borehole, water, septic, fencing or paving. Only where a single-choice question has no "Not sure" answer and a sensible default exists, add "Not sure" mapped to that default, and list each one you add in your summary.

## Rules
- No commits, pushes, packages or network access. Do not touch vision files, `src/app/api/**`, `supabase/**` or `.env*`.
- Prices come from the catalogue; never invent one.
- Update tests only where your change requires it.
- `npm run lint && npm run typecheck && npm run build && npm run test:unit` must pass.
- Finish with:
  - a file-by-file summary
  - the screen count for each solar path
  - every "Not sure" you added
  - anything you could not do
