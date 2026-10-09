import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function base64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function createServiceAccountAssertion(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64Url(signer.sign(credentials.private_key))}`;
}

async function googleAccessToken(credentials) {
  const assertion = createServiceAccountAssertion(credentials);
  const response = await fetch(credentials.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth failed (${response.status}): ${await response.text()}`);
  const data = await response.json();
  if (!data.access_token) throw new Error("Google OAuth response did not include an access token.");
  return data.access_token;
}

async function googleJson(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Google Play API failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : {};
}

const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || "com.yvan.workoutcoach";
const aabPath = requireEnv("ANDROID_AAB_PATH");
const credentials = JSON.parse(requireEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"));
const track = process.env.GOOGLE_PLAY_TRACK?.trim() || "qa";
const releaseName = process.env.GOOGLE_PLAY_RELEASE_NAME?.trim() || "Workout Coach internal release";
const releaseStatus = process.env.GOOGLE_PLAY_RELEASE_STATUS?.trim() || "completed";

if (!credentials.client_email || !credentials.private_key) {
  throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is missing client_email/private_key.");
}

const accessToken = await googleAccessToken(credentials);
const apiRoot = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const uploadRoot = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3";
const encodedPackage = encodeURIComponent(packageName);

const edit = await googleJson(`${apiRoot}/applications/${encodedPackage}/edits`, accessToken, {
  method: "POST",
  body: "{}",
});

const bundleResponse = await fetch(
  `${uploadRoot}/applications/${encodedPackage}/edits/${encodeURIComponent(edit.id)}/bundles?uploadType=media`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: await readFile(aabPath),
  },
);
const bundleText = await bundleResponse.text();
if (!bundleResponse.ok) throw new Error(`Google Play bundle upload failed (${bundleResponse.status}): ${bundleText}`);
const bundle = JSON.parse(bundleText);

await googleJson(
  `${apiRoot}/applications/${encodedPackage}/edits/${encodeURIComponent(edit.id)}/tracks/${encodeURIComponent(track)}`,
  accessToken,
  {
    method: "PUT",
    body: JSON.stringify({
      track,
      releases: [{
        name: releaseName,
        versionCodes: [String(bundle.versionCode)],
        status: releaseStatus,
      }],
    }),
  },
);

await googleJson(
  `${apiRoot}/applications/${encodedPackage}/edits/${encodeURIComponent(edit.id)}:commit`,
  accessToken,
  { method: "POST", body: "{}" },
);

console.log(`Uploaded ${packageName} versionCode ${bundle.versionCode} to Google Play track ${track} with status ${releaseStatus}.`);
