import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createServer } from "vite";

const chrome = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((candidate) => candidate && existsSync(candidate));

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("real React modal restores FAB focus and landscape actions remain clickable", {
  skip: !chrome || typeof WebSocket === "undefined" ? "Chrome and Node WebSocket are required" : false,
  timeout: 30000,
}, async () => {
  const profile = path.resolve(`tests/.fab-browser-${process.pid}`);
  mkdirSync(profile);
  let server;
  let browser;
  let socket;
  try {
    server = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "silent" });
    await server.listen();
    const port = server.httpServer.address().port;
    browser = spawn(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ], { env: { ...process.env, TMPDIR: profile }, stdio: "ignore" });
    const portFile = path.join(profile, "DevToolsActivePort");
    for (let attempt = 0; attempt < 150 && !existsSync(portFile); attempt++) await pause(50);
    assert.ok(existsSync(portFile), "Chrome DevTools did not start");
    const debugPort = Number(readFileSync(portFile, "utf8").split("\n")[0]);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    const target = targets.find((entry) => entry.type === "page");
    assert.ok(target, "Chrome page was not created");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    let id = 0;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const next = ++id;
      pending.set(next, { resolve, reject });
      socket.send(JSON.stringify({ id: next, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };

    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 568, height: 320, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: `http://127.0.0.1:${port}/tests/fixtures/fab-lifecycle.html` });
    await evaluate(`(async () => {
      const wait = async (condition) => {
        for (let i = 0; i < 200; i++) {
          if (condition()) return;
          await new Promise(r => setTimeout(r, 20));
        }
        throw Error("Timed out waiting for fixture state");
      };
      await wait(() => document.querySelector("[data-quick-actions-toggle]"));
      const toggle = document.querySelector("[data-quick-actions-toggle]");
      const toggleRect = toggle.getBoundingClientRect();
      if (toggleRect.width !== 48 || toggleRect.height !== 48) throw Error("Unexpected FAB size");
      toggle.click();
      await wait(() => document.querySelector("[aria-label='Add game']")?.getClientRects().length);
      for (const [label, icon] of [["Add game", "＋"], ["Settings", "⚙"], ["Personal stats", "📊"]]) {
        const action = document.querySelector(\`[aria-label="\${label}"]\`);
        const rect = action.getBoundingClientRect();
        if (rect.width !== 48 || rect.height !== 48 || action.textContent.trim() !== icon) {
          throw Error(\`Unexpected icon-only action: \${label}\`);
        }
      }
      toggle.click();
      for (const closeMethod of ["escape", "button"]) {
        const toggle = document.querySelector("[data-quick-actions-toggle]");
        toggle.click();
        await wait(() => document.querySelector("[aria-label='Add game']")?.getClientRects().length);
        document.querySelector("[aria-label='Add game']").click();
        await wait(() => document.querySelector("[role='dialog']") && toggle.parentElement.inert);
        if (!toggle.isConnected || getComputedStyle(toggle).visibility !== "hidden") throw Error("FAB not suppressed");
        if (!document.querySelector("[role='dialog']").contains(document.activeElement)) throw Error("Dialog lacks focus");
        if (closeMethod === "escape") document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
        else document.querySelector("[role='dialog'] button").click();
        await wait(() => !document.querySelector("[role='dialog']") && document.activeElement === toggle);
        if (toggle.parentElement.inert || getComputedStyle(toggle).visibility !== "visible") throw Error("FAB not restored");
      }
      return true;
    })()`);

    for (const height of [320, 240]) {
      await send("Emulation.setDeviceMetricsOverride", { width: 568, height, deviceScaleFactor: 1, mobile: false });
      const result = await evaluate(`(async () => {
        const wait = async (condition) => {
          for (let i = 0; i < 100; i++) {
            if (condition()) return;
            await new Promise(r => setTimeout(r, 20));
          }
          throw Error("Timed out waiting for quick actions");
        };
        const toggle = document.querySelector("[data-quick-actions-toggle]");
        toggle.click();
        const menu = document.querySelector("[aria-label='Quick actions']");
        await wait(() => menu.getBoundingClientRect().height > 0);
        const action = document.querySelector("[aria-label='Add game']");
        const vote = document.querySelector("[aria-label='Vote']");
        const rect = e => {const r = e.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};};
        const m = rect(menu), a = rect(action), v = rect(vote);
        const overlap = (x, y) => x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
        if (m.height < 44 || a.top < 0 || a.bottom > innerHeight || overlap(m,v)) throw Error("Menu geometry invalid");
        if (document.elementFromPoint(a.left + a.height/2, a.top + a.height/2)?.closest("button") !== action) throw Error("Action is covered");
        if (document.elementFromPoint(v.left + v.height/2, v.top + v.height/2)?.closest("button") !== vote) throw Error("Vote is covered");
        const profile = document.querySelector("[aria-label='Personal stats']");
        profile.scrollIntoView({block:"nearest"});
        profile.click();
        await wait(() => document.querySelector("[role='status']").textContent.includes("Profile"));
        vote.click();
        await wait(() => !document.querySelector("[role='status']").textContent.includes("Votes: 0"));
        return {height: m.height, menu:m, vote:v};
      })()`);
      assert.ok(result.height >= 44, `menu remains usable at ${height}px`);
    }
  } finally {
    socket?.close();
    if (browser && browser.exitCode === null) {
      browser.kill("SIGTERM");
      await new Promise((resolve) => browser.once("exit", resolve));
    }
    if (server) await server.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
