# ZimEstimate

Project initialized.
# ZimEstimate Project Specification & Research

## 1. Research Summary & Project Vision
**ZimEstimate** is a milestone-based construction estimator designed for the Zimbabwean market. It solves the "trust gap" for the diaspora and locals by providing transparent, localized material and labor costs.

## 2. Milestone Architecture
The project must follow the traditional Zimbabwean "Step-Build" phases:
- **Phase 1: Substructure** (Foundation, Trenching, Slab)
- **Phase 2: Superstructure** (Walls to Window/Roof Level)
- **Phase 3: Roofing** (Timber, Chromadek/Tiles)
- **Phase 4: Finishing** (Plastering, Tiling, Electrical)
- **Phase 5: Exterior** (Paving, Durawall, Septic Tank)

## 3. Material Database (Classes)
- **Masonry:** Bricks (Common, Face), Sands (Pit, River), Cement (32.5N, 42.5R).
- **Electrical:** Conduits, 20 Round Boxes, Wiring (CAFCA standard).
- **Plumbing:** Septic components, PVC piping.

## 4. AI Use Cases (The Project Brain)
- **Plan-to-BOQ Takeoff:** Vision analysis of uploaded PDFs to estimate brick/cement counts.
- **Handwritten OCR:** Digitizing physical hardware quotes into the app ledger.
- **Predictive Pricing:** Inflation forecasting for the local construction market.

## 5. UI/UX Decisions
- **Palette:** Industrial Trust — Oxford Blue (#14213D) primary, Safety Orange (#FCA311) accent.
- **Icons:** Phosphor Icons (Light weight). **STRICT RULE: NO EMOJIS.**
- **Export:** Reports must be generated as professional, non-editable PDFs.

## 6. External Design Assets
- **Stitch Designs:** [INSERT YOUR STITCH LINK HERE]
- *Agent Instruction:* Use the Stitch MCP (Model Context Protocol) to extract the "Design DNA" from this link before creating any UI components.

## 7. System Dependencies
- **Tech Stack:** Next.js (Frontend), Supabase (Database/Auth).
- **APIs:** Gemini 3 Pro (Vision/LLM), Google Maps API (Supplier Geolocation).