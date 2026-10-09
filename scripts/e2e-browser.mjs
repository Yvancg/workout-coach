import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_URL = "http://127.0.0.1:4173/";
const DEBUG_PORT = 9222;
const STORAGE_KEY = "yvan-workout-coach-v2";

function fail(message) {
  throw new Error(message);
}

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("bash", ["-lc", `command -v ${candidate}`], { encoding: "utf8" });
    const path = result.stdout.trim();
    if (result.status === 0 && path) return path;
  }
  fail("No Chromium/Chrome executable found for browser E2E.");
}

async function waitForHttp(url, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server/browser endpoint not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  fail(`Timed out waiting for ${url}`);
}

async function connectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP WebSocket open timeout")), 10_000);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    ws.addEventListener("error", (event) => {
      clearTimeout(timer);
      reject(event.error || new Error("CDP WebSocket error"));
    }, { once: true });
  });

  let nextId = 1;
  const pending = new Map();

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message || "CDP command failed"));
    else entry.resolve(message.result);
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  return { send, close: () => ws.close() };
}

async function run() {
  const chromePath = findChrome();
  const profileDir = await mkdtemp(join(tmpdir(), "workout-coach-e2e-"));
  const preview = spawn(process.execPath, [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4173",
    "--strictPort",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  let chrome;
  let cdp;

  try {
    await waitForHttp(APP_URL);

    chrome = spawn(chromePath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ], { stdio: ["ignore", "pipe", "pipe"] });

    await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const targetResponse = await fetch(
      `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`,
      { method: "PUT" },
    );
    if (!targetResponse.ok) fail(`Could not create Chromium target: ${targetResponse.status}`);
    const target = await targetResponse.json();
    cdp = await connectCdp(target.webSocketDebuggerUrl);

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    async function evaluate(expression) {
      const result = await cdp.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        fail(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Browser evaluation failed");
      }
      return result.result?.value;
    }

    async function waitFor(predicate, message, timeoutMs = 10_000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (await predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      fail(message);
    }

    async function waitForText(text, timeoutMs = 10_000) {
      await waitFor(
        () => evaluate(`document.body?.innerText.includes(${JSON.stringify(text)}) || false`),
        `Timed out waiting for text: ${text}`,
        timeoutMs,
      );
    }

    async function clickButton(text) {
      const clicked = await evaluate(`(() => {
        const wanted = ${JSON.stringify(text)};
        const button = [...document.querySelectorAll("button")].find((item) =>
          item.textContent.replace(/\\s+/g, " ").trim().includes(wanted)
        );
        if (!button) return false;
        button.click();
        return true;
      })()`);
      if (!clicked) fail(`Button not found: ${text}`);
    }

    async function setField(labelText, value) {
      const updated = await evaluate(`(() => {
        const wanted = ${JSON.stringify(labelText)};
        const label = [...document.querySelectorAll("label")].find((item) =>
          item.textContent.replace(/\\s+/g, " ").trim().includes(wanted)
        );
        if (!label) return false;
        const container = label.parentElement;
        const field = label.control || container?.querySelector("input, select, textarea");
        if (!field) return false;
        const value = ${JSON.stringify(String(value))};
        const proto = field instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : field instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(field, value);
        else field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`);
      if (!updated) fail(`Field not found: ${labelText}`);
    }

    async function readState() {
      return evaluate(`(() => {
        try {
          return JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || "null");
        } catch {
          return null;
        }
      })()`);
    }

    async function waitForState(check, message, timeoutMs = 10_000) {
      await waitFor(async () => {
        const state = await readState();
        return Boolean(state && check(state));
      }, message, timeoutMs);
      return readState();
    }

    async function reload() {
      await cdp.send("Page.reload", { ignoreCache: false });
      await waitFor(
        () => evaluate('document.readyState === "complete" && Boolean(document.querySelector("#root"))'),
        "Page did not finish reloading",
        15_000,
      );
    }

    await waitForText("Session Setup");
    const initialState = await waitForState((state) => state.activeTab === "today", "Initial state did not hydrate.");
    if (initialState.sessionStage !== "idle") fail("Fresh browser did not start idle.");

    const manifest = await evaluate('fetch("/manifest.webmanifest").then((r) => r.json())');
    if (manifest.display !== "standalone" || manifest.start_url !== "/") fail("PWA manifest is not installable as expected.");
    if (manifest.theme_color !== "#fcfbf8") fail("PWA manifest theme color does not match the application.");

    const swReady = await evaluate(`(async () => {
      if (!("serviceWorker" in navigator)) return false;
      await navigator.serviceWorker.ready;
      return true;
    })()`);
    if (!swReady) fail("Service worker did not become ready.");

    await setField("Training readiness today", 4);
    await setField("Session note", "Phase 6 browser E2E");
    await clickButton("Workout");
    await waitForState((state) => state.sessionStage === "warmup", "Workout did not enter warmup.");
    await waitForText("Warm Up First");

    // Mid-session reload must recover from local durable state.
    await reload();
    await waitForText("Warm Up First");
    await waitForState((state) => state.sessionStage === "warmup", "Warmup state was not restored after reload.");

    await clickButton("Warm Up Done, Start Program");
    await waitForState((state) => state.sessionStage === "exercise" && state.exerciseIndex === 0, "Program did not start.");
    await waitForText("Current Exercise");

    if (!await evaluate('Boolean(document.querySelector("nav[aria-label=\\"Primary navigation\\"]"))')) {
      fail("Primary navigation landmark is missing.");
    }
    if (!await evaluate('Boolean(document.querySelector("[role=\\"progressbar\\"][aria-label=\\"Session completion\\"]"))')) {
      fail("Accessible session progressbar is missing.");
    }

    await setField("Set effort", 7);
    const beforeFirstSet = await readState();
    await clickButton("Complete Set and Save");
    await waitForState(
      (state) => state.logs.length === beforeFirstSet.logs.length + 1,
      "First set was not persisted.",
    );

    // Ensure the current deployment is controlling the page before taking the network away.
    await waitFor(
      () => evaluate("Boolean(navigator.serviceWorker?.controller)"),
      "Service worker did not take control of the page.",
      10_000,
    );

    // Offline reload validates app-shell caching plus durable workout recovery.
    await cdp.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
      connectionType: "none",
    });
    await reload();
    await waitForText("Current Exercise");
    await waitForState((state) => state.logs.length >= 1 && state.sessionStage === "exercise", "Offline reload lost workout state.");

    const cachesAvailable = await evaluate('caches.keys().then((keys) => keys.some((key) => key.startsWith("workout-coach-")))');
    if (!cachesAvaile) fail("PWA runtime cache was not created.");

    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: "wifi",
    });

    // Complete the real configured workout without bypassing React handlers.
    for (let guard = 0; guard < 80; guard += 1) {
      const state = await readState();
      if (state.sessionStage === "stretch") break;
      if (state.sessionStage !== "exercise") fail(`Unexpected session stage while completing workout: ${state.sessionStage}`);
      const previousLogCount = state.logs.length;
      await clickButton("Complete Set and Save");
      await waitForState(
        (next) => next.logs.length > previousLogCount || next.sessionStage === "stretch",
        "Set completion did not advance.",
      );
    }

    await waitForState((state) => state.sessionStage === "stretch", "Workout did not reach cooldown.");
    await waitForText("Finish with Stretches");
    await clickButton("Stretch Done, Finish Session");

    const finished = await waitForState(
      (state) => state.sessionStage === "idle" && state.activeTab === "history" && state.history.length >= 1,
      "Finished session was not written to history.",
    );
    if (finished.dayType !== "B") fail(`Expected day rotation A -> B, got ${finished.dayType}`);
    await waitForText("Session Log");
    await waitForText("Phase 6 browser E2E");

    const firstHistory = finished.history[0];
    if (!firstHistory.warmupCompleted || !firstHistory.stretchCompleted) {
      fail("Finished history did not preserve warmup/stretch completion.");
    }
    if (Number(firstHistory.readiness) !== 4) fail("Session readiness was not preserved.");

    // Re-open Day A from durable state to verify history now changes coaching behavior.
    const mutated = {
      ...finished,
      dayType: "A",
      activeTab: "today",
      sessionStage: "idle",
      sessionId: null,
      sessionStartedAt: null,
      exerciseIndex: 0,
      currentSet: 1,
      currentRep: 0,
    };
    await evaluate(`(() => {
      localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(${JSON.stringify(mutated)}));
      localStorage.setItem(${JSON.stringify(`${STORAGE_KEY}:savedAt`)}, String(Date.now() + 60000));
      return true;
    })()`);
    await reload();
    await waitForText("Session Setup");
    await clickButton("Workout");
    await waitForText("Warm Up First");
    await clickButton("Warm Up Done, Start Program");
    await waitForText("Coach suggestion");

    const suggestionText = await evaluate(`(() => {
      const heading = [...document.querySelectorAll("div")].find((item) => item.textContent.trim() === "Coach suggestion");
      return heading?.parentElement?.innerText || "";
    })()`);
    if (/first tracked session/i.test(suggestionText)) {
      fail("Previous completed session was not used by the progression coach.");
    }

    console.log("Browser E2E passed: reload recovery, offline PWA, full workout, history/day rotation, and progression context.");
  } finally {
    try { cdp?.close(); } catch {}
    chrome?.kill("SIGTERM");
    preview.kill("SIGTERM");
    await rm(profileDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
