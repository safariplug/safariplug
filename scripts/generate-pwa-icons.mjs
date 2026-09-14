import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public", "brand", "safariplug-full-lockup.png");
const outputDir = path.join(root, "public", "pwa-icons");

await mkdir(outputDir, { recursive: true });

async function buildIcon(size) {
  const inner = Math.round(size * 0.64);
  const logo = await sharp(source)
    .resize({ width: inner, height: inner, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(path.join(outputDir, `icon-${size}.png`));
}

await Promise.all([buildIcon(192), buildIcon(512)]);
console.log("Generated SafariPlug PWA launcher icons.");
