import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [packageRaw, metadataRaw, apk] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("public/downloads/android.json", "utf8"),
  readFile("public/downloads/workout-coach-android.apk"),
]);

const pkg = JSON.parse(packageRaw);
const metadata = JSON.parse(metadataRaw);
const info = await stat("public/downloads/workout-coach-android.apk");
const sha256 = createHash("sha256").update(apk).digest("hex");

assert(metadata.version === pkg.version, `Android download version ${metadata.version} does not match package version ${pkg.version}.`);
assert(metadata.channel === "device-test", "Android download must remain clearly identified as a device-test build.");
assert(metadata.filename === "workout-coach-android.apk", "Android download metadata filename is unexpected.");
assert(Number(metadata.sizeBytes) === info.size, "Android download metadata size does not match the APK.");
assert(metadata.sha256 === sha256, "Android download SHA-256 does not match android.json.");
assert(info.size > 1_000_000, "Android APK is unexpectedly small.");
assert(apk.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])), "Android download is not an APK/ZIP file.");
assert(/^[0-9a-f]{40}$/.test(metadata.sourceCommit), "Android download source commit is invalid.");

console.log(`Android website APK verified: v${metadata.version}, ${info.size} bytes, sha256 ${sha256}.`);
