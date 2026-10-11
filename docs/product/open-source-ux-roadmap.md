# Open-source UX opportunities for ZimEstimate

Researched 11 October 2026 against the current Next.js / React 19 / Supabase application. Features below are proposed integrations, not features already supplied by ZimEstimate or installed by this research. Effort is a relative engineering estimate, not a delivery commitment.

## Recommended order

1. **Reliable uploads with Uppy + Supabase TUS** — extend the document and receipt work already underway.
2. **Quote comparison and BOQ editing with TanStack Table** — help users choose what to buy and from whom.
3. **Offline site records with Dexie** — make the site useful when a connection drops.
4. **PDF plan review with PDF.js** — improve checking scanned quantities against the original document.
5. **A construction timeline with SVAR React Gantt** — connect the estimate to execution.
6. **Optional contextual guidance with Driver.js** — help first-time users complete an actual task.
7. **3D BIM inspection with That Open Components** — a later, specialist product experiment.

## 1. Uploads that resume after a connection drops

**Code:** [Uppy](https://github.com/transloadit/uppy) — MIT. Recent repository activity was visible in the retrieved source.

Uppy provides resumable uploads through TUS, modular UI, and optional file recovery. It offers React components and hooks, so its upload logic can be used with ZimEstimate's own visual design rather than introducing a separate-looking dashboard. These capabilities are documented in its [official repository](https://github.com/transloadit/uppy).

**Proposed experience:** users attach multiple receipt photos or plans, see genuine byte progress, pause or retry individual files, and continue supported interrupted uploads. Retain category and project association throughout.

**Fit:** `src/components/projects/DocumentUploader.tsx`, the purchase receipt picker, and `src/lib/services/projects.ts`. Keep the existing private project storage and document records. Supabase officially supports TUS and supplies [Uppy integration code](https://github.com/supabase/supabase/tree/master/examples/storage/resumable-upload-uppy), linked from its [resumable-upload guide](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).

**Work required:** authenticate each upload, enforce the project's storage permissions, create the document record only after the file finishes, and recover cleanly when the metadata write fails. Test interruption, expired authentication and duplicate retries. A resumable upload is not the same as an offline purchase record.

**Effort:** medium. First pilot: project documents, then receipt uploads. Cloud-provider import buttons are optional and introduce additional infrastructure; leave them out of the initial pilot.

## 2. A BOQ workspace and supplier comparison table

**Code:** [TanStack Table](https://github.com/TanStack/table) — MIT. Recent repository activity was visible in the retrieved source.

Its headless table engine provides sorting, filtering, grouping, aggregation and row selection while allowing custom markup and styling. A [versioned v8 editable-data example](https://tanstack.com/table/v8/docs/framework/react/examples/editable-data) provides a starting point for saving cell edits. It is not a complete spreadsheet UI; keyboard editing, validation and persistence remain application work.

**Proposed experience:** filter a BOQ to one construction stage, edit quantities or prices in place, select materials for a quote request, and compare supplier responses side by side. Show a comparable delivered total only when quantities, units, delivery and tax treatment are known; clearly mark missing items.

**Fit:** `src/app/boq/new/components/BOQTable.tsx`, `src/components/projects/UnifiedProcurementView.tsx`, and the existing RFQ data. Reuse existing calculations and save services. Use stacked comparison cards on phones instead of forcing a wide desktop table.

**Work required:** agree on normalized quote rows and price inclusions, preserve focus while editing, implement undo before persistence, and make validation accessible. Add virtualization only if measured row counts justify it.

**Effort:** medium for a scoped quote comparison; larger for replacing every BOQ surface. First pilot: compare two returned quotes for the same material list.

## 3. Offline purchases, material usage and site notes

**Code:** [Dexie.js](https://github.com/dexie/Dexie.js) — Apache-2.0. The retrieved repository showed a September 2026 release and recent commits.

Dexie simplifies IndexedDB, the browser's local database. Dexie Cloud is a separate synchronization option; using the local library does not automatically synchronize data to Supabase. See the [official repository](https://github.com/dexie/Dexie.js).

**Proposed experience:** a builder records purchases, quantities used, notes and receipt photos without reception. Each entry says **Saved on this device**, **Waiting to sync**, **Synced**, or **Needs attention**. An offline entry must never be presented as already saved to the shared project.

**Fit:** the site already has a service worker and offline route, but `public/sw.js` skips non-GET requests. Cached pages do not provide durable offline writes. Add a project-scoped IndexedDB outbox beside the purchase and usage services.

**Work required:** stable client operation IDs, server-side duplicate protection, ownership checks at synchronization time, explicit handling of revoked access, and a user-visible conflict policy. Persist photo blobs with storage/quota feedback. Flush on reconnection and app resume rather than relying solely on browser background sync. Separate data by signed-in account.

**Effort:** large. First pilot: append-only site notes or usage entries; broaden to purchases after duplicate and retry behaviour is proven. Existing Supabase remains the shared source of truth.

## 4. Read the plan while checking the estimate

**Code:** [Mozilla PDF.js](https://github.com/mozilla/pdf.js) — Apache-2.0. Recent repository activity was visible in the retrieved source.

PDF.js is Mozilla-supported browser PDF rendering software, with [modern and legacy viewer demos](https://github.com/mozilla/pdf.js#online-demo). It supplies document rendering, not construction quantity recognition or a calibrated measurement model.

**Proposed experience:** a consistent in-app viewer for plans and supplier documents, with the original page beside the quantities being checked. Later, attach a source-page reference to each reviewed item and save simple comments.

**Fit:** the scanners and `src/components/projects/DocumentsTab.tsx` currently use native PDF iframes. Lazy-load a dedicated viewer only when opening a PDF. Continue using authenticated/signed document URLs.

**Work required:** package the PDF worker correctly, test large drawings and mobile memory use, and persist annotations separately. Treat measurements as a separate feature requiring a verified scale; do not infer accurate dimensions merely from rendered pixels.

**Effort:** medium for consistent viewing; larger for durable annotation and measurement tools.

## 5. Turn the estimate into a build programme

**Code:** [SVAR React Gantt](https://github.com/svar-widgets/react-gantt) — MIT core. Recent repository activity was visible in the retrieved source.

The open-source core includes an interactive timeline, task/dependency visualization, progress and a task grid. Its README explicitly describes React 19 and Next.js readiness. Automatic scheduling, critical path and several resource-planning features are in its **PRO** edition, not the free core. See the [core/PRO feature split](https://github.com/svar-widgets/react-gantt#-pro-edition).

**Proposed experience:** visualize foundation, walls, roof and finishes; record planned dates and completion; open the relevant stage's budget from a task. A separate compact agenda would be easier to use on a phone.

**Fit:** reuse the application's project stages and tasks. Keep dates explicitly user-entered at first. Linking a delivery or expenditure forecast requires additional business rules; drawing a dependency alone does not calculate a reliable schedule.

**Effort:** medium to large. First pilot: a read-only stage timeline, then persisted date editing. Free-core functionality is sufficient for that scope.

## 6. Help users finish their first useful action

**Code:** [Driver.js](https://github.com/nilbuild/driver.js) — MIT. The original project URL redirected to this repository; recent activity was visible in the retrieved source.

Driver.js supplies framework-independent highlighting, contextual overlays and keyboard-controllable introductions without external dependencies. See its [official repository](https://github.com/nilbuild/driver.js).

**Proposed experience:** a voluntary, short walkthrough explaining how to edit a quantity, request a quote or record a purchase. Use the actual project screen and preserve dismissal. Link it from a small “Show me how” control.

**Fit:** start at estimate review or first project visit. Reuse existing consent-aware analytics to measure task completion and abandonment. Account for mobile layouts, keyboard focus and elements that appear only after a tab opens.

**Effort:** small to medium. A long compulsory tour on the homepage would compete with the existing calculator and primary action; keep guidance contextual and optional.

## 7. A specialist 3D model inspection experiment

**Code:** [That Open Components](https://github.com/ThatOpen/engine_components) — repository lists MIT. Recent repository activity was visible in the retrieved source.

The library provides Three.js-based BIM tools, including dimensions, floor-plan navigation and DXF export; its repository links an IFC loader demo. It expects Three.js knowledge. See the [official repository and demo](https://github.com/ThatOpen/engine_components).

**Proposed experience:** users with IFC models inspect a building in 3D and select elements for review. Linking those elements to costed materials would be ZimEstimate-specific work.

**Fit:** a separately loaded advanced workspace. The current Konva-based floor-plan editor already covers 2D editing, so there is no need to replace it. Validate demand from architects and contractors who actually have model files before investing.

**Work required:** model ingestion, units, large-file performance, element-to-BOQ mapping and dependency licence review. A PDF floor plan cannot simply become a trustworthy BIM model by adding this viewer.

**Effort:** large / experimental. Lower priority than uploads, quote comparison and offline work.

## Decisions before implementation

- Pilot one feature at a time and keep the established navy visual system, terminology and Supabase data model.
- Pin and test a released package version; repository-main documentation can describe newer APIs than a stable release.
- Preserve the applicable licence and attribution notices; verify the exact packages and optional extensions selected.
- Judge success by completed estimates, successful uploads, comparable quotes and correctly synchronized site entries, using the existing consent-aware analytics.

The strongest first combination is **Uppy-backed uploads plus supplier quote comparison**. The biggest operational improvement after that is a carefully scoped **offline site notebook**.
