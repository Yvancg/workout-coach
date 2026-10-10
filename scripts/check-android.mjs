import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [
  pkgRaw,
  gradle,
  variables,
  manifest,
  capacitor,
  gitignore,
  privacyPolicy,
  deletionPage,
  todayTab,
  workerSource,
  deleteFunction,
  supabaseClient,
  authHook,
] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("android/app/build.gradle", "utf8"),
  readFile("android/variables.gradle", "utf8"),
  readFile("android/app/src/main/AndroidManifest.xml", "utf8"),
  readFile("capacitor.config.json", "utf8"),
  readFile(".gitignore", "utf8"),
  readFile("public/privacy.html", "utf8"),
  readFile("public/delete-account.html", "utf8"),
  readFile("src/components/TodayTab.jsx", "utf8"),
  readFile("worker/src/index.js", "utf8"),
  readFile("supabase/functions/delete-account/index.ts", "utf8"),
  readFile("src/lib/supabaseClient.js", "utf8"),
  readFile("src/hooks/useSupabaseAuth.js", "utf8"),
]);

const pkg = JSON.parse(pkgRaw);
const capacitorConfig = JSON.parse(capacitor);

assert(/^\d+\.\d+\.\d+$/.test(pkg.version), "package.json must use semantic versioning.");
assert(capacitorConfig.appId === "com.yvan.workoutcoach", "Capacitor appId must remain com.yvan.workoutcoach.");
assert(/applicationId\s+"com\.yvan\.workoutcoach"/.test(gradle), "Android applicationId changed unexpectedly.");
assert(/ANDROID_VERSION_CODE/.test(gradle), "Android versionCode must remain injectable for future signed releases.");
assert(/ANDROID_VERSION_NAME/.test(gradle), "Android versionName must remain injectable for future signed releases.");
assert(gradle.includes(`?: "${pkg.version}"`), "Default Android versionName must match package.json.");

const targetSdk = Number(variables.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1] || 0);
const compileSdk = Number(variables.match(/compileSdkVersion\s*=\s*(\d+)/)?.[1] || 0);
assert(targetSdk >= 36, `Android target must remain API 36 or newer; found ${targetSdk}.`);
assert(compileSdk >= targetSdk, "compileSdkVersion must be at least targetSdkVersion.");

assert(/android:allowBackup="false"/.test(manifest), "Android backups must remain disabled.");
assert(/android:usesCleartextTraffic="false"/.test(manifest), "Cleartext Android traffic must remain disabled.");

const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((match) => match[1]);
assert(
  permissions.length === 1 && permissions[0] === "android.permission.INTERNET",
  `Unexpected Android permissions: ${permissions.join(", ") || "none"}.`,
);

assert(gitignore.includes("*.jks") && gitignore.includes("*.keystore"), "Keystore files must remain ignored by git.");
assert(privacyPolicy.includes("Workout Coach Privacy Policy") && privacyPolicy.includes("/delete-account"), "Public privacy policy or deletion link is missing.");
assert(deletionPage.includes("Delete your Workout Coach account") && deletionPage.includes("/delete-account"), "Public external account-deletion instructions are missing.");
assert(todayTab.includes("Delete account and synced data") && todayTab.includes("/privacy.html"), "In-app privacy/account-deletion controls are missing.");
assert(workerSource.includes('url.pathname === "/api/account"') && workerSource.includes("DELETE FROM workout_logs"), "Authenticated D1 account deletion endpoint is missing.");
assert(!workerSource.includes("API_TOKEN") && !workerSource.includes("ADMIN_FALLBACK"), "Legacy admin-token authentication must not return.");
assert(
  deleteFunction.includes("auth.admin.deleteUser")
    && deleteFunction.includes("SUPABASE_SERVICE_ROLE_KEY")
    && deleteFunction.includes("auth.getUser(token)"),
  "Supabase Auth deletion function is missing or unsafe.",
);

assert(authHook.includes("signInWithOAuth") && authHook.includes('provider: "google"'), "Google sign-in must remain available in v1.");
assert(authHook.includes("signInWithOtp"), "Email magic-link sign-in must remain available in v1.");
assert(!supabaseClient.includes("passkey: true") && !authHook.includes("signInWithPasskey") && !authHook.includes("registerPasskey"), "Passkey client support is deferred to v1.1 and must not enter v1 accidentally.");

console.log(`Android readiness passed: ${capacitorConfig.appId}, version ${pkg.version}, target API ${targetSdk}, Google + magic-link auth only.`);
