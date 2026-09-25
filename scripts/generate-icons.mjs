/**
 * Renders the KASI app icons (PWA manifest, iOS home screen, notification
 * badge) from one SVG. Re-run after changing the mark:
 *   node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const NAVY = "#0f2647";
const CYAN = "#4fb6d9";

// Full-bleed square so it also works as a maskable icon: the mark sits well
// inside the central 80% safe zone that Android may crop to a circle.
const icon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${NAVY}"/>
  <path d="M168 136h52v104l92-104h64L268 252l112 124h-66l-94-106v106h-52z" fill="#ffffff"/>
  <rect x="168" y="396" width="176" height="18" rx="9" fill="${CYAN}"/>
</svg>`;

// Monochrome silhouette: Android draws the badge from its alpha channel.
const badge = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 512 512">
  <path d="M136 96h64v140l116-140h80L262 252l140 164h-82L200 274v142h-64z" fill="#ffffff"/>
</svg>`;

mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(icon(size))).png().toFile(`public/icons/icon-${size}.png`);
}
await sharp(Buffer.from(icon(180))).png().toFile("public/icons/apple-touch-icon.png");
await sharp(Buffer.from(badge)).png().toFile("public/icons/badge-96.png");
console.log("Icons written to public/icons/");
