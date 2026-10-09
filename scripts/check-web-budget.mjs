import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";

const DIST_ASSETS = new URL("../dist/assets/", import.meta.url);
const MAX_SINGLE_JS_GZIP = 100_000;
const MAX_TOTAL_JS_GZIP = 180_000;
const MAX_EXERCISE_MEDIA_BYTES = 500_000;

async function listFiles(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

const assetNames = await listFiles(DIST_ASSETS);
const jsFiles = assetNames.filter((name) => name.endsWith(".js"));

let totalJsGzip = 0;
let largestJs = { name: "", gzipBytes: 0 };

for (const name of jsFiles) {
  const bytes = await readFile(new URL(name, DIST_ASSETS));
  const gzipBytes = gzipSync(bytes).byteLength;
  totalJsGzip += gzipBytes;
  if (gzipBytes > largestJs.gzipBytes) largestJs = { name, gzipBytes };
}

const mediaDir = new URL("../public/exercise-reference/imported/", import.meta.url);
let largestMedia = { name: "", bytes: 0 };
for (const name of await listFiles(mediaDir)) {
  const info = await stat(new URL(name, mediaDir));
  if (info.size > largestMedia.bytes) largestMedia = { name, bytes: info.size };
}

console.log(`Largest JS gzip: ${largestJs.name} ${largestJs.gzipBytes} bytes`);
console.log(`Total JS gzip: ${totalJsGzip} bytes`);
console.log(`Largest exercise media: ${largestMedia.name} ${largestMedia.bytes} bytes`);

const failures = [];
if (largestJs.gzipBytes > MAX_SINGLE_JS_GZIP) {
  failures.push(`Largest JS chunk exceeds ${MAX_SINGLE_JS_GZIP} gzip bytes.`);
}
if (totalJsGzip > MAX_TOTAL_JS_GZIP) {
  failures.push(`Combined JS exceeds ${MAX_TOTAL_JS_GZIP} gzip bytes.`);
}
if (largestMedia.bytes > MAX_EXERCISE_MEDIA_BYTES) {
  failures.push(`Exercise media exceeds ${MAX_EXERCISE_MEDIA_BYTES} bytes.`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
