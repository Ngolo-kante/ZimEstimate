# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Phone-first. Most people use it on a mobile browser. The Google Play app is the same site in a Trusted Web Activity wrapper, so its design language is the web's, not native Android's.

## Users

**Primary: self-builders.** Zimbabweans planning or building their own house, including people in the diaspora building at home and people on tight budgets. They want to know what a house will cost, and what it needs, before they commit money or hire a builder. Many are not construction professionals.

**Secondary:** contractors preparing bills of quantities and quotes, and suppliers listing materials in the marketplace.

## Product Purpose

ZimEstimate turns a house idea or a floor plan into a bill of quantities (BOQ) priced at real Zimbabwe prices, then helps the person track the project, buy materials and find suppliers. It works as a quick budget check ("what can I build for $X / what will this cost?") or as a full stage-by-stage BOQ. Success means a self-builder gets a believable figure and material list they can take to a builder or supplier, without paying for it.

## Positioning

- **Free to use.** The core estimate and BOQ stay free. Competitors such as Enormous Buildings charge for the full bill.
- **Zimbabwe-checked prices.** Rates come from local sources: the ZBMS store, local hardware suppliers, builders' Facebook-group quotes, and rural and peri-urban prices (farm bricks, river sand). Each price is sourced and dated. An item with no sourced price gets an "add from your quote" note instead of an invented figure.
- **Plan upload to BOQ.** People upload the floor plan they already have (usually a phone screenshot, a small image or an ArchiCAD/AutoCAD PDF), and the reader turns it into a priced BOQ.

## Operating Context

- The BOQ follows Zimbabwe building practice: 230 mm outside and 115 mm inside brick walls, footings under every wall, a 100 mm slab, a hipped roof by default, a separate plumbing and electrical stage, and labour priced per trade inside each stage.
- People compare estimates with builders' quotes, supplier price lists and figures from Facebook groups. Labour is negotiated locally.
- Uploaded plans are screenshots with viewer chrome, tiny images and A1 CAD PDFs, rarely photos of paper.
- Solar is a second estimating flow: it is bought by size (from 1 kVA), and battery, panels and inverter come before wiring and labour.

## Capabilities and Constraints

- Stack: Next.js App Router + Supabase, hosted on Vercel (Hobby plan) and Supabase. Budget is tight: prefer free options and never assume paid infrastructure.
- Features: quick budget, plan upload, manual BOQ builder, project tracking, marketplace and suppliers, market insights, solar budget, PDF/export, and an admin area.
- Terminology: "BOQ" (bill of quantities), "stages" (substructure, superstructure, roofing, services, finishes), "quick budget", "Add later" extras.
- Plan reading is not fully repeatable. A reading is remembered per file, but the product must not claim that plan reads are exact.
- Plaster quantities are on hold pending research. Double-storey pricing exists for plan uploads and quick budget, but not yet for the manual builder.

## Brand Commitments

- Name: ZimEstimate. Logo at `public/logo.svg` and `public/logo.png`, brand assets in `public/brand/`.
- Numbers stay honest: every figure says what it covers (materials only, labour included or not), and the product never rounds or adjusts a figure it didn't produce.
- Marketing avoids headline totals that scare people off. It uses a 120 m² sample house, materials only, honestly labelled, or no total at all.
- Never silently override a choice the person made in the UI. Offer the better option with both figures instead.
- Shona content is not a confirmed product commitment.

## Evidence on Hand

- Price sources and dates in the pricing code (`src/lib/pricing/`) and the price-collection scripts (`scripts/pricing/`).
- Benchmark: Propzone 2026 Harare model ($444–565/m²).
- A sample plan at `output/demo-assets/sample-plan-120sqm.png` (`output/` is gitignored; regenerate it with `scripts/make-sample-plan.mjs`).
- Real uploaded plans live in a private bucket. They are local test data only and never go in the repo or on any page.
- No testimonials, customer counts, press or case studies exist. Don't fabricate any.

## Product Principles

1. **A believable number beats an impressive one.** Accuracy, sources and stating what's included come before a polished total.
2. **Free first.** The core path from idea or plan to priced BOQ never sits behind a paywall.
3. **Built for the phone and the budget it lives on.** Small screens, patchy data and modest phones are the normal case.
4. **Local truth over generic defaults.** Zimbabwe building practice, prices and buying habits decide the quantities and the order of things.
5. **Respect the person's choices.** Suggest, show both figures, and let them decide.

## Accessibility & Inclusion

Users range from first-time builders to professionals, and many read on small, lower-end phones. Plain language is required: explain construction terms the first time they appear, and don't assume construction knowledge. No formal standard has been confirmed beyond that.
