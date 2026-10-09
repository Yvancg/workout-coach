import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

import worker, {
  boundedText,
  decodeSessionPath,
  getRateLimitRouteKey,
  isAllowedOrigin,
  nonNegativeInteger,
  nonNegativeNumber,
  originMatchesRule,
  ratingInteger,
  sessionBelongsToIdentity,
} from "../worker/src/index.js";

test("session ownership requires matching user id once an owner id exists", () => {
  const identity = { ownerId: "user-new", ownerEmail: "same@example.com" };
  assert.equal(
    sessionBelongsToIdentity(
      { owner_id: "user-old", owner_email: "same@example.com" },
      identity,
    ),
    false,
  );
});

test("legacy email ownership is accepted only when owner id is empty", () => {
  const identity = { ownerId: "user-new", ownerEmail: "same@example.com" };
  assert.equal(
    sessionBelongsToIdentity(
      { owner_id: "", owner_email: "same@example.com" },
      identity,
    ),
    true,
  );
});

test("bounded text trims and caps untrusted payload strings", () => {
  assert.equal(boundedText("  abcdef  ", 4), "abcd");
  assert.equal(boundedText({ value: "abc" }, 10), "");
});

test("non-negative integer normalization rejects negative and excessive values", () => {
  assert.equal(nonNegativeInteger(-12, 100), 0);
  assert.equal(nonNegativeInteger(12.9, 100), 12);
  assert.equal(nonNegativeInteger(999, 100), 100);
  assert.equal(nonNegativeInteger("not-a-number", 100), 0);
});

test("coaching numeric inputs are bounded before D1 writes", () => {
  assert.equal(nonNegativeNumber("5.26", 100), 5.3);
  assert.equal(nonNegativeNumber(-2, 100), 0);
  assert.equal(nonNegativeNumber(500, 100), 100);
  assert.equal(ratingInteger(12, 1, 10, 0), 10);
  assert.equal(ratingInteger(-3, 1, 10, 0), 1);
  assert.equal(ratingInteger("bad", 1, 5, 3), 3);
});


test("preview-origin wildcard matches exactly one secure hostname label", () => {
  assert.equal(originMatchesRule("https://abc123.workout-coach.pages.dev", "https://*.workout-coach.pages.dev"), true);
  assert.equal(originMatchesRule("https://branch.workout-coach.pages.dev", "https://*.workout-coach.pages.dev"), true);
  assert.equal(originMatchesRule("https://a.b.workout-coach.pages.dev", "https://*.workout-coach.pages.dev"), false);
  assert.equal(originMatchesRule("http://abc.workout-coach.pages.dev", "https://*.workout-coach.pages.dev"), false);
  assert.equal(originMatchesRule("https://workout-coach.pages.dev", "https://*.workout-coach.pages.dev"), false);
  assert.equal(originMatchesRule("https://evilworkout-coach.pages.dev", "https://*.workout-coach.pages.dev"), false);
});

test("origin allowlist supports exact production and wildcard preview rules", () => {
  const env = {
    ALLOWED_ORIGINS: "https://workout-coach.pages.dev,https://*.workout-coach.pages.dev,https://localhost",
  };
  assert.equal(isAllowedOrigin("https://workout-coach.pages.dev", env), true);
  assert.equal(isAllowedOrigin("https://preview.workout-coach.pages.dev", env), true);
  assert.equal(isAllowedOrigin("https://attacker.example", env), false);
});

test("session route decoding rejects malformed paths and caps ids", () => {
  assert.equal(decodeSessionPath("/api/sessions/session%20one"), "session one");
  assert.equal(decodeSessionPath("/api/sessions/%E0%A4%A"), "");
  assert.equal(decodeSessionPath("/api/other/session"), "");
  assert.equal(decodeSessionPath(`/api/sessions/${"a".repeat(200)}`).length, 160);
});

test("session rate-limit keys cannot be bypassed by changing ids", () => {
  assert.equal(getRateLimitRouteKey("/api/sessions/a"), "/api/sessions/:sessionId");
  assert.equal(getRateLimitRouteKey("/api/sessions/b"), "/api/sessions/:sessionId");
  assert.equal(getRateLimitRouteKey("/api/logs"), "/api/logs");
});

test("allowed preflight echoes the requesting origin and rejects untrusted origins", async () => {
  const env = { ALLOWED_ORIGINS: "https://workout-coach.pages.dev,https://*.workout-coach.pages.dev" };
  const ctx = { waitUntil() {} };

  const allowed = await worker.fetch(new Request("https://api.example/api/logs", {
    method: "OPTIONS",
    headers: { Origin: "https://preview.workout-coach.pages.dev" },
  }), env, ctx);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://preview.workout-coach.pages.dev");

  const blocked = await worker.fetch(new Request("https://api.example/api/logs", {
    method: "OPTIONS",
    headers: { Origin: "https://attacker.example" },
  }), env, ctx);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get("Access-Control-Allow-Origin"), null);
});

test("unexpected Worker failures do not expose internal exception text", async () => {
  const env = {
    ALLOWED_ORIGINS: "https://workout-coach.pages.dev",
    API_TOKEN: "test-admin-token",
    ADMIN_FALLBACK_OWNER_EMAIL: "admin@example.com",
    ADMIN_FALLBACK_OWNER_ID: "admin",
  };
  const response = await worker.fetch(new Request("https://api.example/api/snapshot", {
    headers: { Authorization: "Bearer test-admin-token" },
  }), env, { waitUntil() {} });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Internal server error" });
});


test("valid Supabase JWT resolves identity without using the admin fallback", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "phase6-key";
  jwk.alg = "RS256";
  jwk.use = "sig";

  const issuer = "https://phase6.supabase.co/auth/v1";
  const token = await new SignJWT({ email: "phase6@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setSubject("user-phase6")
    .setIssuer(issuer)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === `${issuer}/.well-known/jwks.json`) {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(input);
  };

  try {
    const response = await worker.fetch(new Request("https://api.example/api/whoami", {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "https://workout-coach.pages.dev",
      },
    }), {
      SUPABASE_URL: "https://phase6.supabase.co",
      SUPABASE_JWT_AUDIENCE: "authenticated",
      ALLOWED_ORIGINS: "https://workout-coach.pages.dev",
    }, { waitUntil() {} });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      authenticated: true,
      userId: "user-phase6",
      email: "phase6@example.com",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("expired Supabase JWT is rejected as 401 instead of a server error", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "expired-key";
  jwk.alg = "RS256";
  jwk.use = "sig";

  const issuer = "https://expired.supabase.co/auth/v1";
  const token = await new SignJWT({ email: "expired@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setSubject("expired-user")
    .setIssuer(issuer)
    .setAudience("authenticated")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(privateKey);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === `${issuer}/.well-known/jwks.json`) {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(input);
  };

  try {
    const response = await worker.fetch(new Request("https://api.example/api/whoami", {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "https://workout-coach.pages.dev",
      },
    }), {
      SUPABASE_URL: "https://expired.supabase.co",
      SUPABASE_JWT_AUDIENCE: "authenticated",
      ALLOWED_ORIGINS: "https://workout-coach.pages.dev",
    }, { waitUntil() {} });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Invalid or expired login" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing authentication is rejected before protected API access", async () => {
  const response = await worker.fetch(new Request("https://api.example/api/whoami", {
    headers: { Origin: "https://workout-coach.pages.dev" },
  }), {
    SUPABASE_URL: "https://phase6.supabase.co",
    ALLOWED_ORIGINS: "https://workout-coach.pages.dev",
  }, { waitUntil() {} });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Login required" });
});
