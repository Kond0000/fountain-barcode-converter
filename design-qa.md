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
