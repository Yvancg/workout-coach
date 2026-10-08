import assert from "node:assert/strict";
import test from "node:test";

import {
  createRemoteLog,
  sendQueuedSyncOperation,
  updateRemoteSession,
} from "../src/lib/syncClient.js";

test("log sync sends an idempotency key and bearer token", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await createRemoteLog("https://sync.example", "token-123", {
      clientLogId: "log-123",
      exercise: "Chair Squat",
    });
    assert.equal(captured.url, "https://sync.example/api/logs");
    assert.equal(captured.init.headers.Authorization, "Bearer token-123");
    assert.equal(captured.init.headers["Idempotency-Key"], "log-123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("session ids are URL encoded before update", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = async (url) => {
    capturedUrl = url;
    return new Response(null, { status: 204 });
  };

  try {
    await updateRemoteSession("https://sync.example", "token", "session/with spaces", { note: "ok" });
    assert.equal(capturedUrl, "https://sync.example/api/sessions/session%2Fwith%20spaces");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("queued operations dispatch to the correct sync route", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await sendQueuedSyncOperation("https://sync.example", "token", {
      type: "session.delete",
      sessionId: "session-1",
    });
    assert.equal(captured.url, "https://sync.example/api/sessions/session-1");
    assert.equal(captured.init.method, "DELETE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rate-limit responses expose Retry-After for retry policy", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
    status: 429,
    headers: { "Retry-After": "42", "Content-Type": "application/json" },
  });

  try {
    await assert.rejects(
      () => createRemoteLog("https://sync.example", "token", { clientLogId: "log-429" }),
      (error) => error.status === 429 && error.retryAfter === "42",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
