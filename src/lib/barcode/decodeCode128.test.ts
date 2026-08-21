import {
  BinaryBitmap,
  Code128Reader,
  HybridBinarizer,
  RGBLuminanceSource,
} from "@zxing/library";
import bwipjs from "bwip-js";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import {
  CODE128_QUIET_ZONE_MODULES,
  calculateCode128ModuleScale,
} from "./generateCode128";

const PRINTABLE_RENDER_WIDTH = 852;
const RENDER_PIXELS_PER_PRINTER_DOT = 2;
const LABEL_MARGIN_RENDER_WIDTH = 38;

async function renderCode128(value: string, scaleX: number): Promise<PNG> {
  const bytes = await bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scaleX,
    scaleY: 2,
    height: 11.5,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
    backgroundcolor: "FFFFFF",
  });
  return PNG.sync.read(bytes);
}

function decodeCode128(image: PNG, quietZoneWidth: number): string {
  const width = image.width + quietZoneWidth * 2;
  const luminance = new Uint8ClampedArray(width * image.height);
  luminance.fill(255);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sourceOffset = (y * image.width + x) * 4;
      const targetOffset = y * width + x + quietZoneWidth;
      luminance[targetOffset] = Math.round(
        (image.data[sourceOffset] + image.data[sourceOffset + 1] * 2 + image.data[sourceOffset + 2]) / 4,
      );
    }
  }

  const source = new RGBLuminanceSource(luminance, width, image.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  return new Code128Reader().decode(bitmap).getText();
}

describe("generated CODE128 decoding", () => {
  it.each([
    "ABC123",
    "emptycolor001",
    "9356249855286",
    "ls25ht016jfnvy",
    "26FW-AW17SOH-BLK-M",
    "AC-26FW-AW17SOH-BLK-L",
    "AMK-26FW-AW17SOH-BLK-M",
  ])("decodes the uniform whole-dot value %s with an independent reader", async (value) => {
    const base = await renderCode128(value, 1);
    const moduleScale = calculateCode128ModuleScale(
      base.width,
      PRINTABLE_RENDER_WIDTH,
      LABEL_MARGIN_RENDER_WIDTH,
      RENDER_PIXELS_PER_PRINTER_DOT,
    );
    const rendered = await renderCode128(value, moduleScale);
    const internalQuietZoneWidth = Math.max(
      CODE128_QUIET_ZONE_MODULES * moduleScale - LABEL_MARGIN_RENDER_WIDTH,
      0,
    );
    const totalQuietZoneWidth = internalQuietZoneWidth + LABEL_MARGIN_RENDER_WIDTH;

    expect(rendered.width + internalQuietZoneWidth * 2).toBeLessThanOrEqual(PRINTABLE_RENDER_WIDTH);
    expect(rendered.width).toBe(base.width * moduleScale);
    expect(decodeCode128(rendered, totalQuietZoneWidth)).toBe(value);
  });
});
