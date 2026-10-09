import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [pkgRaw, gradle, variables, manifest, capacitor, gitignore] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("android/app/build.gradle", "utf8"),
  readFile("android/variables.gradle", "utf8"),
  readFile("android/app/src/main/AndroidManifest.xml", "utf8"),
  readFile("capacitor.config.json", "utf8"),
  readFile(".gitignore", "utf8"),
]);

const pkg = JSON.parse(pkgRaw);
const capacitorConfig = JSON.parse(capacitor);

assert(/^\d+\.\d+\.\d+$/.test(pkg.version), "package.json must use semantic versioning.");
assert(capacitorConfig.appId === "com.yvan.workoutcoach", "Capacitor appId must remain com.yvan.workoutcoach.");
assert(/applicationId\s+"com\.yvan\.workoutcoach"/.test(gradle), "Android applicationId changed unexpectedly.");
assert(/ANDROID_VERSION_CODE/.test(gradle), "Android versionCode must support the ANDROID_VERSION_CODE release input.");
assert(/ANDROID_VERSION_NAME/.test(gradle), "Android versionName must support the ANDROID_VERSION_NAME release input.");
assert(gradle.includes(`?: "${pkg.version}"`), "Default Android versionName must match package.json.");
assert(/ANDROID_KEYSTORE_PATH/.test(gradle) && /ANDROID_KEYSTORE_PASSWORD/.test(gradle), "Release signing must be environment-driven.");
assert(/ANDROID_KEY_ALIAS/.test(gradle) && /ANDROID_KEY_PASSWORD/.test(gradle), "Release key alias/password inputs are missing.");

const targetSdk = Number(variables.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1] || 0);
const compileSdk = Number(variables.match(/compileSdkVersion\s*=\s*(\d+)/)?.[1] || 0);
assert(targetSdk >= 36, `Google Play release target must be API 36 or newer; found ${targetSdk}.`);
assert(compileSdk >= targetSdk, "compileSdkVersion must be at least targetSdkVersion.");

assert(/android:allowBackup="false"/.test(manifest), "Android backups must remain disabled.");
assert(/android:usesCleartextTraffic="false"/.test(manifest), "Cleartext Android traffic must remain disabled.");

const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((match) => match[1]);
assert(permissions.length === 1 && permissions[0] === "android.permission.INTERNET", `Unexpected Android permissions: ${permissions.join(", ") || "none"}.`);

assert(gitignore.includes("*.jks") && gitignore.includes("*.keystore"), "Keystore files must be ignored by git.");

console.log(`Android Play readiness passed: ${capacitorConfig.appId}, version ${pkg.version}, target API ${targetSdk}, permissions: INTERNET only.`);
