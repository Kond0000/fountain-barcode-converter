# Label layout design QA

## Evidence

- Reference source: `/tmp/codex-remote-attachments/01a01314-ea1b-7b41-ac04-b38ec5cfcb28/676F71DC-D36A-4AC6-AD2E-CEAD71C88D60/1-写真1.jpg`
- Latest visual direction: keep color and size grouped on one row, then place the slightly larger price on a separate right-aligned row.
- Before screenshot: `/private/tmp/label-details-before.png`
- Browser implementation screenshot: `/private/tmp/product-name-larger-than-variant.png`
- Generated PDF: `/Users/ruler/Documents/Development/fountain-barcode-converter/output/pdf/label-product-name-hierarchy-sample.pdf`
- PDF render at printer resolution: `/private/tmp/pdfs/label-product-name-hierarchy.png`
- Focused before/after comparison: `/private/tmp/label-details-comparison.png`

## Normalization

- Original reference image: 2880 × 3840 px photograph; the printed region was cropped during the first comparison.
- Browser source and implementation captures: both 919 × 800 px CSS viewport at `http://localhost:4174/`, device scale factor 1.
- Focused comparison sheet: 1042 × 482 px, using equal crops from the same preview region. Product data differs between the before and after captures, so only hierarchy and alignment were judged.
- Historical 50mm Japanese PDF fixture: 50 × 40.25 mm; rendered at 203.2 dpi to 400 × 322 px.
- Current default-width verification: 58mm saved PDF at 928 source pixels and 58mm direct-print PDF at 464 printer dots.

## State

Sample row: `Loose joints/JASON FOX- GRRRR Baseball cap`, `NAVY`, `FREE`, `ls25ht016jfnvy`, `¥7,700`, `FOUNTAIN`.

## Checks

| Surface | Result | Notes |
| --- | --- | --- |
| Information hierarchy | Passed | Product name first; `カラー / サイズ` forms one left-side container; the larger price occupies its own right-aligned row; barcode and brand follow below. |
| Product-name wrapping | Passed | English wraps at a word boundary; Japanese wraps by physical width. Every line stays within the 28-character limit and printable width. |
| Typography | Passed | Product name uses the 3.0–3.2 mm automatic range and never shrinks to the 2.8 mm variant size; price is 3.8 mm versus 2.8 mm for the variant container. |
| Spacing | Passed | Color/size and price always use separate rows, with price right-aligned consistently; 3 mm vertical and 2.4 mm horizontal margins are preserved. |
| Color | Passed | Output remains pure black and white for thermal printing. |
| Image quality | Passed | No new raster assets were introduced; the barcode remains sharp on the native printer-dot grid. |
| Barcode quality | Passed | PDF is generated on the mC-Label3 8-dot/mm grid. CODE128 modules keep a uniform whole-dot width and required quiet zones; symbol width varies with encoded content and remains centered. |
| Copy/data fidelity | Passed with scope note | The app renders only mapped CSV fields. The reference's separate item code and dual tax prices were not invented. |
| Browser/PDF parity | Passed | Both surfaces render `NAVY / FREE` on the variant row and `¥7,700` on the next right-aligned row. |

## Iteration history

1. Compared the supplied physical label with the existing preview hierarchy.
2. Reordered the preview and PDF to match the reference hierarchy and reduced oversized typography.
3. Added character-aware and measured-width wrapping, then rendered the browser preview and a real PDF.
4. Compared the cropped reference and the 203.2 dpi PDF render in one image; no P1/P2 layout mismatch remained.
5. Browser Comment 1 identified a P2 hierarchy mismatch: color and size were separated, while price occupied a later row.
6. Grouped color/size with a slash, moved price to the same row's right edge, increased price size from 3.4 to 3.8 mm, and applied the same structure to PDF rendering.
7. Re-captured the 919 × 800 preview, compared the focused region, and rendered the revised PDF at 203.2 dpi. No P0/P1/P2 issue remains.
8. Raised the product-name minimum from 2.4 to 2.8 mm. Verified a long Japanese name remains at 2.8 mm and wraps into two lines in both the browser and generated PDF without clipping.
9. Raised the product-name minimum from 2.8 to 3.0 mm so it always remains larger than the 2.8 mm color/size row. Browser-computed sizes were 13.5 px versus 12.6 px; the 203.2 dpi PDF render also retained the two-line Japanese title without clipping.
10. Replaced integer-scale-only barcode sizing with printer-dot-aligned width distribution. Verified `ABC123` and `ls25ht016jfnvy` both render at 201 px inside the 201.4 px browser content width and reach the same 362-dot printable span in the PDF.
11. Added collision-aware details layout shared by browser preview and PDF. `VINTAGE BLUE / 24` with `¥19,800` stacks into two rows, while `BRAD BLUE / 24` with `¥20,900` retains a single row with a 16.9 px gap. Both PDF pages render without overlap.
12. Standardized the details layout so price always occupies its own right-aligned row. This removes per-product layout changes and makes label lists easier to scan.
13. Superseded the full-width distribution from step 10 with uniform whole-dot CODE128 modules and centered variable-width symbols, then changed the default paper width from 50mm to 58mm while preserving editable 50mm output.

Final result: passed.

# FOUNTAIN monochrome palette design QA

## Evidence

- Visual source of truth: `/var/folders/v5/41z29dld5mbg09mxhq18d8lr0000gn/T/codex-clipboard-2bccd3ef-a1ea-4e03-9ad9-c69e0ae728dc.png`
- Desktop implementation screenshot: `/private/tmp/label-print-monochrome-desktop-postfix.png`
- Mobile implementation screenshot: `/private/tmp/label-print-monochrome-mobile.png`
- Full-view comparison sheet: `/private/tmp/fountain-logo-palette-comparison.png`

## Normalization

- Source logo: 994 × 994 px, RGB.
- Desktop implementation: 919 × 793 px at `http://127.0.0.1:5173/`, device scale factor 1.
- Mobile implementation: 390 × 844 px at the same URL, device scale factor 1.
- The supplied logo was used only as a brand-color reference. Per the user's final direction, its blue was intentionally excluded and its black/white visual language was translated into neutral UI tokens.

## State

- Empty CSV state with the upload action focused.
- No CSV data or printer hardware was required for this palette verification.

## Checks

| Surface | Result | Notes |
| --- | --- | --- |
| Typography | Passed | Existing Japanese system-font hierarchy, sizes, and weights were preserved. |
| Layout and spacing | Passed | Palette-only changes did not alter the empty-state desktop or responsive mobile layout; the 390 px viewport has no horizontal overflow. |
| Color | Passed | Primary tokens are neutral: `#080f17`, `#202833`, `#53606b`, `#eef1f3`, and `#f6f7f8`. Blue is no longer used for brand accents or focus states. Semantic success, warning, and error colors remain for status comprehension. |
| Focus state | Passed | The initial browser-blue outline was treated as a P2 mismatch and replaced with the neutral `#53606b` inset focus ring. |
| Image fidelity | Passed with scope note | No logo artwork was embedded or recreated. The existing app icon was recolored using the logo's black/white direction only. |
| Copy fidelity | Passed | No user-facing copy changed. |
| Responsive behavior | Passed | Desktop and 390 × 844 mobile views render without clipping or horizontal scrolling. |
| Interaction and console | Passed | The CSV file chooser opens from the primary empty-state action; browser console has no warnings or errors. |

## Iteration history

1. Sampled the supplied logo and identified `#2ea7de` as its dominant blue plus near-black and white neutrals.
2. Applied the user's monochrome override to the shared CSS tokens and favicon rather than adopting the blue.
3. Captured the desktop implementation and found a system-blue focus outline (P2).
4. Added an explicit neutral focus-visible treatment, then recaptured desktop and mobile states.
5. Compared the source and implementation together in `/private/tmp/fountain-logo-palette-comparison.png`; no remaining P0/P1/P2 palette issue was found.

final result: passed

# Application layout design QA

## Evidence

- Source visual truth: `/private/tmp/label-print-layout-loaded-before.png`
- Source empty-state capture: `/private/tmp/label-print-layout-before.png`
- Desktop implementation: `/private/tmp/label-print-layout-desktop-after.png`
- Desktop empty-state implementation: `/private/tmp/label-print-layout-empty-after.png`
- Mobile empty-state implementation: `/private/tmp/label-print-layout-mobile-empty-after.png`
- Mobile loaded-state implementation: `/private/tmp/label-print-layout-mobile-loaded-after.png`
- Full-view comparison: `/private/tmp/label-print-layout-comparison.png`
- Focused mapping/workspace comparison: `/private/tmp/label-print-layout-focused-comparison.png`

## Normalization

- Source and desktop implementation are both 1280 × 720 px at a 1280 × 720 CSS viewport and device scale factor 1.
- Mobile captures are both 390 × 844 px at a 390 × 844 CSS viewport and device scale factor 1.
- The source is the pre-change implementation in the same browser, route, monochrome theme, and CSV-loaded state. Product rows and mappings are identical.

## State and target flow

- CSV fixture: `public/sample-products.csv` (12 rows).
- Flow: app loads → CSV is selected → mappings, product list, label settings, preview, and save/print actions render → search filters the list → a mapping dropdown opens and closes.

## Findings and fixes

1. P2 — Mapping controls lacked a clear container and consistent scan path. The source mixed labels and controls across two horizontal rows on the page background. The implementation groups the section in one card and uses six equal desktop tracks with each label directly above its dropdown.
2. P2 — The product table started with search alone, so the table's purpose and item count were visually disconnected. The implementation adds `印刷する商品` and keeps the count next to that heading while placing search consistently on the opposite side.
3. P2 — Footer metrics, privacy text, and actions competed as three unrelated columns. The implementation groups summary/privacy as context and PDF/print controls as the action area, within the same maximum-width frame as the main content.
4. P2 — The empty state used two full-width stacked cards and left excessive unused vertical space. The desktop implementation balances upload and explanation cards side by side; mobile intentionally stacks them.

## Required fidelity surfaces

| Surface | Result | Notes |
| --- | --- | --- |
| Fonts and typography | Passed | Existing Japanese system-font stack and core type scale are preserved. New headings use existing weights and remain readable without truncation. |
| Spacing and layout rhythm | Passed | Header, main content, and action bar now share the same 1480 px content frame. Desktop mapping, workspace, and right rail align to consistent 16–18 px gaps; mobile has no horizontal overflow. |
| Colors and tokens | Passed | The approved monochrome palette is unchanged. Semantic success, warning, and error colors remain limited to status meaning. |
| Image quality and assets | Passed with scope note | No new image assets were introduced. Existing upload, file, lock, navigation, and status icons remain unchanged. |
| Copy and content | Passed | Existing task copy is preserved. The empty-state privacy sentence is separated into a short supporting line, and footer metrics are shortened without changing meaning. |
| Interaction states | Passed | CSV upload works, `Gray` search returns two data rows, and the custom barcode dropdown reports `aria-expanded=true` when open and `false` after Escape. |
| Responsive behavior | Passed | 1280 × 720 desktop and 390 × 844 mobile captures show no clipping or horizontal scrolling. Mobile keeps save and print actions visible in the fixed footer. |
| Console/framework health | Passed | No browser warnings, errors, blank page, or framework overlay were observed. |

## Comparison history

1. Captured the original empty and CSV-loaded layouts at 1280 × 720.
2. Implemented the aligned header frame, two-column empty state, card-based mapping section, titled product table, sticky desktop rail, and grouped action footer.
3. First post-change capture showed the three-column/two-row mapping card consumed too much vertical space (P2 density regression).
4. Changed desktop mapping to six equal columns and retained three columns below 1100 px plus one column on mobile.
5. Captured desktop and mobile final states, then compared the full view and focused mapping/workspace region. No actionable P0/P1/P2 issue remains.

## Follow-up polish

- P3: A future pass could add a user-controlled compact/comfortable table-density preference; it is not necessary for the current workflow.

final result: passed

# Sticky right sidebar annotation QA

## Evidence

- Behavior source: Browser Comment 1 on `.right-rail` in the user's annotated 1440 × 900 screenshot.
- Page-top capture: `/private/tmp/label-print-sticky-sidebar-top.png`
- Scrolled implementation: `/private/tmp/label-print-sticky-sidebar.png`
- Side-by-side comparison: `/private/tmp/label-print-sticky-sidebar-comparison.png`

## Normalization

- Both implementation captures use a 1440 × 900 CSS viewport, 1440 × 900 output pixels, and device scale factor 1.
- Both use the same `sample-products.csv` loaded state and identical label settings.
- The page-top capture uses `scrollY = 0`; the scrolled capture uses `scrollY = 336.5`.

## Finding and fix

1. P2 — The existing sticky rail could be taller than the usable viewport, which made its lower controls vulnerable to clipping behind the fixed action bar. The desktop rail now uses `max-height: calc(100vh - 130px)` and its own vertical overflow only when required. `overscroll-behavior: contain`, a stable gutter, and a thin scrollbar keep that local scroll predictable. Below 1100 px the rail returns to normal document flow so the tablet and mobile layouts are unchanged.

## Verification

| Surface | Result | Notes |
| --- | --- | --- |
| Sticky behavior | Passed | At `scrollY = 336.5`, the complete settings/preview rail remains visible on the right. |
| Fixed-footer separation | Passed | The rail bottom measured 760.1 px and the action footer top measured 802 px, leaving a visible gap with no overlap. |
| Scoped visual fidelity | Passed | Fonts, colors, images, copy, settings controls, preview contents, table, and footer design were not changed by this annotation fix. |
| Responsive fallback | Passed | At widths below 1100 px, the rail is explicitly reset to static flow with no internal scrollbar. |
| Console/framework health | Passed | The 1440 × 900 interaction produced no browser warnings or errors. |
| Automated checks | Passed | All 67 tests and the production build pass. |

final result: passed
