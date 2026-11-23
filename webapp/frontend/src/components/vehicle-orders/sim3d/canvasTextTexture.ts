import * as THREE from "three";

export interface CanvasSignOptions {
  text: string;
  subText?: string;
  width?: number;
  height?: number;
  bgColor?: string;
  textColor?: string;
  subTextColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  fontSize?: number;
  subFontSize?: number;
  accentBarColor?: string;
  transparentBg?: boolean;
}

/**
 * Generates a crisp, offline-safe, Vietnamese-ready THREE.CanvasTexture
 * for 3D architectural signage, ground stencils, and truck roof markings.
 */
export function createCanvasSignTexture(
  opts: CanvasSignOptions,
): THREE.CanvasTexture {
  const width = opts.width ?? 512;
  const height = opts.height ?? 160;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, width, height);

    const radius = opts.borderRadius ?? 18;
    const bw = opts.borderWidth ?? 0;

    if (!opts.transparentBg && opts.bgColor) {
      ctx.fillStyle = opts.bgColor;
      ctx.beginPath();
      ctx.roundRect(bw / 2, bw / 2, width - bw, height - bw, radius);
      ctx.fill();
    }

    if (opts.accentBarColor) {
      ctx.fillStyle = opts.accentBarColor;
      ctx.beginPath();
      ctx.roundRect(bw / 2, bw / 2, 18, height - bw, [radius, 0, 0, radius]);
      ctx.fill();
    }

    if (bw > 0 && opts.borderColor) {
      ctx.strokeStyle = opts.borderColor;
      ctx.lineWidth = bw;
      ctx.beginPath();
      ctx.roundRect(bw / 2, bw / 2, width - bw, height - bw, radius);
      ctx.stroke();
    }

    const fontStack =
      '"Hanken Grotesk", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = opts.accentBarColor ? width / 2 + 8 : width / 2;

    if (opts.subText) {
      const mainSize = opts.fontSize ?? Math.floor(height * 0.36);
      const subSize = opts.subFontSize ?? Math.floor(height * 0.22);

      ctx.fillStyle = opts.textColor ?? "#0f172a";
      ctx.font = `800 ${mainSize}px ${fontStack}`;
      ctx.fillText(opts.text, centerX, height * 0.38, width - 48);

      ctx.fillStyle = opts.subTextColor ?? "#475569";
      ctx.font = `600 ${subSize}px ${fontStack}`;
      ctx.fillText(opts.subText, centerX, height * 0.72, width - 48);
    } else {
      const mainSize = opts.fontSize ?? Math.floor(height * 0.46);
      ctx.fillStyle = opts.textColor ?? "#0f172a";
      ctx.font = `800 ${mainSize}px ${fontStack}`;
      ctx.fillText(opts.text, centerX, height * 0.52, width - 36);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a subtle diagonal black-and-yellow hazard stripe texture for dock bumpers & wheel stops.
 */
export function createHazardStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#1e293b";
    for (let x = -64; x < 320; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 24, 0);
      ctx.lineTo(x + 48, 64);
      ctx.lineTo(x + 24, 64);
      ctx.closePath();
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
