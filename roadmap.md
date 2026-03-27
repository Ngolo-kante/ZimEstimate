# ZimEstimate Build-Flow Improvements Roadmap

## Scope (Agreed)
- Non-blocking guidance only (no hard mandatory blockers).
- Keep the 5-stage model.
- Add a Pre-Construction advisory checklist.
- Add location-aware advisory logic (urban/peri-urban/rural).
- Add soil-type risk logic with one-click BOQ adjustments.
- Add temporary works as suggested one-click package.
- Add weighted BOQ Health Score (continuous).
- Track top 3 certificates in V1.

## Status Legend
- `[ ]` Not started
- `[-]` In progress
- `[x]` Completed

## Current Sprint To-Do

### A. Planning & Rules
- [x] Finalize product rules from user clarification (non-blocking, location logic, soil strategy, certificates, weighted score).
- [x] Define `Not Applicable` vs `Recommended` rule matrix by location type.
- [x] Define fixed soil enum and risk/recommendation table (`sandy`, `clay_black_mountain`, `loam`, `rock`).
- [x] Define temporary works suggestion pack and default quantities.

### B. Data Model & Services
- [x] Add advisory checklist data model (persisted via stage tasks under project stage flow).
- [x] Add project fields for `soil_type`, `site_slope`, and geotech metadata (upload optional/pro).
- [x] Add certificate tracker model for:
  - [x] Approved Site Plan
  - [x] Slab/Foundation Certificate
  - [x] Council Completion/Occupation Certificate

### C. Manual Builder UX
- [x] Add Pre-Construction Checklist panel/tab (advisory only).
- [x] Add soil selector UI in manual builder.
- [x] Add soil warning panel with one-click "Apply BOQ adjustment".
- [x] Add temporary works suggestion card with one-click add.
- [x] Add certificate tracker UI + upload status.

### D. BOQ Health Score (Continuous)
- [x] Create weighted BOQ health scoring engine.
- [x] Wire score into manual builder final stage UI.
- [x] Add criticality alert states:
  - [x] `<40%` High Risk
  - [x] `40-80%` Work in Progress
  - [x] `>90%` Ready for Procurement
- [x] Add missing-critical-items hints by category.

### E. Validation & Quality
- [x] Unit tests for weighted scoring and threshold behavior.
- [x] Unit tests for soil risk recommendation logic.
- [x] Unit tests for temporary works suggestion IDs and pricing availability.
- [ ] UI tests for checklist and score rendering.
- [ ] Regression test of BOQ generation totals after adjustments.

### F. AI Vision + My Projects Alignment
- [x] Extend Vision Takeoff project info with location type, soil type, and site slope.
- [x] Persist Vision Takeoff soil/slope metadata into project records.
- [x] Auto-include temporary works in Vision Takeoff BOQ as removable enablement costs.
- [x] Surface compliance chips (soil/slope/geotech) on My Projects list cards.
- [x] Surface compliance chips (soil/slope/geotech) on My Projects dashboard featured cards.
- [x] Highlight enablement-cost rows in project stage BOQ tables.
- [x] Add geotech-specific quick filter in project documents tab.
- [x] Add realtime refresh triggers for stage task and project document updates on project detail screen.

### G. Current Build (Temporary Works + Compliance UX)
- [x] Add dedicated pre-final "Temporary Works" step in manual BOQ builder.
- [x] Add septic-tank path from temporary toilet with L/W/H inputs and editable USD rate.
- [x] Persist temporary works + septic selections in session restore flow.
- [x] Apply temporary works selections into BOQ as editable enablement line items.
- [x] Add My Project "Compliance Tracker" tab with per-stage requirements.
- [x] Move stage admin tasks out of BOQ tab display (BOQ now materials-focused).
- [x] Surface warning-only approval/compliance alerts in BOQ and Usage views.
- [ ] Update E2E tests for new step order and temporary works flow.

## Already Completed in Current Branch
- [x] Fixed final-stage material dropdown layering in manual builder.
- [x] Removed emoji from final-stage milestone descriptions/banner.
- [x] Added missing substructure generated items (`dpc`, `termite-poison`) and validated tests.
- [x] Improved pricing alignment with CSV-backed mappings and unit-aware quantity rounding.

## Open Clarifications (Pending)
- [x] Should health score use normalized weights based only on selected stages, or always total out of all 5 stages?
- Assumption implemented: score is normalized to active construction stages shown in the current BOQ flow (labor excluded).
- [x] Should geotech upload be strictly Pro-only, or available to all with richer Pro analysis?
- Decision implemented: upload is available to all users; advanced geotech-driven BOQ automation is highlighted as Pro.
