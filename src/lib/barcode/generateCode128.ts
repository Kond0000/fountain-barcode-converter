export type BarcodeCanvasOptions = { scale?: number; heightMm?: number };

export async function generateCode128Canvas(
  value: string,
  canvas: HTMLCanvasElement,
  options: BarcodeCanvasOptions = {},
): Promise<HTMLCanvasElement> {
  if (!value) throw new Error("バーコード値が空です。");
  const { default: bwipjs } = await import("bwip-js");
  bwipjs.toCanvas(canvas, {
    bcid: "code128",
    text: value,
    scale: options.scale ?? 3,
    height: options.heightMm ?? 10,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
    backgroundcolor: "FFFFFF",
  });
  return canvas;
}

export function createCode128Canvas(value: string, options?: BarcodeCanvasOptions): Promise<HTMLCanvasElement> {
  return generateCode128Canvas(value, document.createElement("canvas"), options);
}
