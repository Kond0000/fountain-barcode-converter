export const MM_PER_INCH = 25.4;
export const POINTS_PER_INCH = 72;

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * POINTS_PER_INCH;
}

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}
