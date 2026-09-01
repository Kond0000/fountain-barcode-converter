# Design QA - Catalog size editorial rail

## Comparison target

- Source visual truth: `/Users/ruler/.codex/generated_images/01a0470b-d5ec-7d53-80d3-97ca73502894/exec-befc6dea-7983-48f3-9331-fd5bf07bc922.png`
- Implementation screenshot: `/private/tmp/catalog-size-editorial-preview.png`
- Combined comparison evidence: `/private/tmp/catalog-size-editorial-comparison.png`
- State: A4 portrait catalog PDF, first page, three selected products with the same product image and sizes 1, 2, and 3
- Source pixels: 1800 x 872
- Implementation pixels: 1489 x 720 (top-page crop from a 1489 x 2105 render at 180 dpi)
- Comparison normalization: both images resized to 1000 px wide and stacked without changing aspect ratio
- Viewport: A4 portrait PDF page, top catalog region

## Full-view comparison evidence

The combined comparison shows the selected source above and the rendered PDF below. The implementation preserves the established A4 four-column catalog density while matching the selected size treatment: a transparent lower-right rail, right-aligned size label, and short corner baseline. The product image canvas is not reduced and the numbered badge remains independent.

## Focused region comparison

No additional crop was required. At the normalized 1000 px comparison width, the size text, upper rail, short baseline, image edge, and numbered badge are all clearly readable across all three cards.

## Findings

- No P0, P1, or P2 issues found.
- Typography: size labels use the existing catalog font family and bold optical weight, with scale and right alignment matching the source direction.
- Spacing and layout: the rail stays inside the image frame at the lower-right, avoids the numbered badge, and does not reserve image height.
- Colors and visual tokens: black rules and text on white match the catalog's monochrome palette; no fill or opacity block was added.
- Image quality and asset fidelity: the supplied product image remains the source asset and keeps its existing contained-image rendering and white-background normalization.
- Copy and content: `SIZE 1`, `SIZE 2`, and `SIZE 3` match the selected concept and current CSV values.

## Comparison history

- Initial implementation: passed. The first comparison found no actionable P0/P1/P2 mismatch, so no visual correction loop was required.

## Implementation checklist

- [x] Add the editorial rail as a retained size-layout variant.
- [x] Make the editorial rail the active catalog size layout.
- [x] Keep the earlier corner badge, metadata row, and image footer variants available.
- [x] Preserve product-image dimensions and number-badge rendering.
- [x] Render and inspect the saved A4 PDF.

## Follow-up polish

- P3: The selected concept uses slightly larger cards than the production four-column layout. The production density is intentionally retained because it is an existing catalog constraint, not part of the selected size-tag change.

final result: passed
