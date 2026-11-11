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
      if (toggleRect.width !== 44 || toggleRect.height !== 44) throw Error("Unexpected FAB size");
      toggle.click();
      await wait(() => document.querySelector("[aria-label='Add game']")?.getClientRects().length);
      for (const [label, icon] of [["Add game", "＋"], ["Settings", "⚙"], ["Personal stats", "📊"]]) {
        const action = document.querySelector(\`[aria-label="\${label}"]\`);
        const rect = action.getBoundingClientRect();
        if (rect.width !== 44 || rect.height !== 44 || action.textContent.trim() !== icon) {
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

    const helpers = `
      const wait = async (condition, message = "Timed out waiting for " + "condition") => {
        for (let i = 0; i < 150; i++) {
          if (condition()) return;
          await new Promise(r => setTimeout(r, 20));
        }
        throw Error(message + " :: " + condition.toString());
      };
      const $ = (selector) => document.querySelector(selector);
      const toggle = () => $("[data-quick-actions-toggle]");
      const contextual = () => $("[data-contextual-quick-action]");
      const menuOpen = () => $("[aria-label='Quick actions']").getBoundingClientRect().height > 0;
      const open = async () => { if (!menuOpen()) toggle().click(); await wait(menuOpen, "menu did not open"); };
      const closeMenu = async () => { if (menuOpen()) toggle().click(); await wait(() => !menuOpen()); };
      const tile = (title) => [...document.querySelectorAll("button")].find(b => b.textContent.includes(title) && !b.closest("[aria-label='Quick actions']"));
      const go = (selector) => $(selector).click();
      const settle = () => new Promise(r => setTimeout(r, 60));
    `;

    // Lifecycle: contextual action follows the visible voting panel and never leaks.
    await send("Emulation.setDeviceMetricsOverride", { width: 568, height: 640, deviceScaleFactor: 1, mobile: false });
    await evaluate(`(async () => {
      ${helpers}
      window.__calls.length = 0;
      go("[data-status='open']");
      await wait(() => $("[data-contextual-badge]"), "collapsed trigger lacks badge");
      if (!/Vote.*unavailable: Select a game first/.test(toggle().getAttribute("aria-label"))) throw Error("Trigger label lacks contextual action: " + toggle().getAttribute("aria-label"));
      const t = toggle().getBoundingClientRect();
      const caret = toggle().querySelector("span");
      if (t.width !== 44 || t.height !== 44) throw Error("Trigger size wrong");
      if (!["inline-block", "block"].includes(getComputedStyle(caret).display)) throw Error("Caret must be transformable, got " + getComputedStyle(caret).display);
      const matrix = new DOMMatrix(getComputedStyle(caret).transform);
      if (matrix.m42 !== 3) throw Error("Caret transform not applied: " + getComputedStyle(caret).transform);
      const range = document.createRange();
      range.selectNodeContents(caret);
      const before = range.getBoundingClientRect();
      caret.style.transform = "none";
      const base = (range.getBoundingClientRect().top);
      caret.style.transform = "";
      if (Math.abs(before.top - base - 3) > 0.5) throw Error("Caret glyph did not move 3px: " + (before.top - base));
      const nav = $("[data-fixture-nav]").getBoundingClientRect();
      if (t.bottom > nav.top - 8) throw Error("Trigger overlaps navigation");
      if (Math.round(innerHeight - t.bottom) !== 96) throw Error("Trigger bottom offset should be 96px");
      const badge = $("[data-contextual-badge]").getBoundingClientRect();
      if (badge.left < t.left - 6 || badge.top < t.top - 6) throw Error("Badge outside trigger");

      const panelStatus = () => $("[data-quick-action-status]")?.textContent || "";
      if (!/Vote.*unavailable: Select a game first/.test(panelStatus())) throw Error("Panel lacks visible disabled reason: " + panelStatus());
      if ($("[data-quick-action-status] svg").getBoundingClientRect().width === 0) throw Error("Panel icon not visible");

      // Disabled contextual action: menu still opens, focus lands on a normal action, click is inert.
      await open();
      if (contextual().getAttribute("aria-disabled") !== "true") throw Error("Vote should be disabled before selection");
      if (document.activeElement === contextual() || document.activeElement.getAttribute("aria-label") !== "Add game") throw Error("Disabled action received initial focus");
      const rect = contextual().getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) throw Error("Contextual touch target too small");
      contextual().click();
      await settle();
      if (!menuOpen() || window.__calls.length) throw Error("Disabled action must be inert");
      await closeMenu();

      // Selecting a game enables it; stale selection never invokes an old handler.
      tile("Catan").click();
      await open();
      await wait(() => contextual().getAttribute("aria-disabled") === null, "Vote not enabled");
      if (contextual().querySelector("svg").getAttribute("class").indexOf("green") < 0) throw Error("Vote icon is not green");
      await closeMenu();
      if (!/Vote.*ready.*green check/.test(panelStatus())) throw Error("Panel lacks ready text: " + panelStatus());
      tile("Azul").click();
      await open();
      contextual().click();
      await wait(() => window.__calls.length === 1, "vote callback not called");
      if (JSON.stringify(window.__calls[0]) !== JSON.stringify(["vote", "group-a", "g2"])) throw Error("Stale selection voted: " + JSON.stringify(window.__calls));
      if (menuOpen() || document.activeElement !== toggle()) throw Error("Menu should close and focus trigger");
      await wait(() => /Voted.*unavailable: Your vote is recorded/.test(toggle().getAttribute("aria-label")), "voted state missing");
      if (!/Voted.*your vote is recorded/.test(panelStatus())) throw Error("Panel lacks voted state: " + panelStatus());
      await open();
      if (contextual().getAttribute("aria-label") !== "Voted, unavailable: Your vote is recorded") throw Error("Voted label wrong");
      contextual().click();
      await settle();
      if (window.__calls.length !== 1) throw Error("Voted action should not write again");
      await closeMenu();

      // Leaving the panel: other tab, inline detail, and return do not leak.
      for (const screen of ["other", "detail"]) {
        go("[data-screen='" + screen + "']");
        await wait(() => !contextual() && !$("[data-contextual-badge]"), "action leaked on " + screen);
      }
      if ($("[data-quick-actions-toggle]")) throw Error("FAB should be hidden on detail");
      go("[data-screen='other']");
      await wait(() => toggle());
      await open();
      if (contextual() || /Vote/.test(toggle().getAttribute("aria-label"))) throw Error("Leaked after returning to other tab");
      await closeMenu();

      // Phase changes swap Vote for Submit, and closed has no action.
      go("[data-screen='voting']");
      await wait(() => $("[data-contextual-badge]"));
      go("[data-status='collecting']");
      await wait(() => /Submit/.test(toggle().getAttribute("aria-label")), "Submit missing");
      await open();
      if (contextual().dataset.contextualQuickAction !== "submit" || /Vote/.test(contextual().getAttribute("aria-label"))) throw Error("Phase did not switch action");
      if (contextual().getAttribute("aria-disabled") !== "true") throw Error("Submit enabled without selection");
      await closeMenu();
      tile("Catan").click();
      await open();
      contextual().click();
      await wait(() => window.__calls.length === 2, "submit callback not called");
      if (JSON.stringify(window.__calls[1]) !== JSON.stringify(["submit", "group-a", "g1"])) throw Error("Wrong submit payload");
      await wait(() => /Change Submission/.test(toggle().getAttribute("aria-label")), "Change state missing");
      await wait(() => /Change Submission.*unavailable: Select a game first/.test(panelStatus()), "Panel lacks change state: " + panelStatus());

      // Remote phase change removes a focused contextual button: focus stays in the menu.
      await open();
      contextual().focus();
      if (document.activeElement !== contextual()) throw Error("Contextual action not focusable");
      go("[data-status='closed']");
      await wait(() => !contextual(), "action not removed");
      await settle();
      if (!menuOpen() || document.activeElement?.getAttribute("aria-label") !== "Add game") throw Error("Focus not restored into menu: " + document.activeElement?.outerHTML?.slice(0, 80));
      await closeMenu();
      go("[data-status='open']");
      await wait(() => contextual() || $("[data-contextual-badge]"));
      // Focus outside the menu is never stolen.
      await open();
      $("[data-outside]").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      $("[data-outside]").focus();
      await wait(() => !menuOpen());
      go("[data-status='collecting']");
      await settle();
      if (document.activeElement !== $("[data-outside]")) throw Error("Focus stolen from outside field");
      go("[data-status='closed']");
      await wait(() => !$("[data-contextual-badge]"));
      if (document.activeElement !== $("[data-outside]")) throw Error("Focus stolen on close");
      // Menu closed but trigger holds focus: removal keeps focus on the trigger.
      go("[data-status='open']");
      await wait(() => $("[data-contextual-badge]"));
      toggle().focus();
      go("[data-status='closed']");
      await wait(() => !$("[data-contextual-badge]"));
      if (document.activeElement !== toggle()) throw Error("Trigger lost focus");
      go("[data-status='closed']");
      await wait(() => !contextual() && !$("[data-contextual-badge]"), "action leaked after close");

      // Realistic group transition: coincident vote ids, uncast selection, per-group state.
      go("[data-status='open']");
      await wait(() => $("[data-contextual-badge]"));
      go("[data-group='group-b']");
      await wait(() => /Vote.*unavailable: Select a game first/.test(panelStatus()), "group-b should start unselected and unvoted");
      tile("Catan").click();
      await wait(() => /ready/.test(panelStatus()));
      go("[data-group='group-a']");
      await wait(() => /Voted/.test(panelStatus()), "group-a keeps its own ballot");
      go("[data-group='group-b']");
      await wait(() => /unavailable: Select a game first/.test(panelStatus()), "selection leaked across groups");
      await open();
      if (contextual().getAttribute("aria-disabled") !== "true") throw Error("Selection leaked into FAB");
      contextual().click();
      await settle();
      if (window.__calls.length !== 2) throw Error("Stale selection voted in other group");
      await closeMenu();
      tile("Azul").click();
      await open();
      contextual().click();
      await wait(() => window.__calls.length === 3, "group-b vote not called");
      if (JSON.stringify(window.__calls[2]) !== JSON.stringify(["vote", "group-b", "g2"])) throw Error("Wrong group target: " + JSON.stringify(window.__calls[2]));
      go("[data-group='group-a']");
      await wait(() => /Voted/.test(panelStatus()));
      if (window.__calls.length !== 3) throw Error("Unexpected extra write");
      return true;
    })()`);

    for (const height of [320, 240]) {
      await send("Emulation.setDeviceMetricsOverride", { width: 568, height, deviceScaleFactor: 1, mobile: false });
      const result = await evaluate(`(async () => {
        ${helpers}
        await closeMenu();
        go("[data-screen='voting']");
        go("[data-status='open']");
        await wait(() => $("[data-contextual-badge]"));
        await open();
        const menu = $("[aria-label='Quick actions']");
        const labels = ["Add game", "Settings", "Personal stats"];
        const actions = [...labels.map(l => $("[aria-label='" + l + "']")), contextual()];
        const rect = e => {const r = e.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,width:r.width};};
        const overlap = (x, y) => x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
        const nav = rect($("[data-fixture-nav]"));
        const m = rect(menu), c = rect(toggle());
        if (m.height < 44 || overlap(m, c) || overlap(m, nav)) throw Error("Menu geometry invalid " + JSON.stringify({m, c, nav}));
        if (overlap(c, nav)) throw Error("Trigger overlaps navigation");
        const results = [];
        for (const action of actions) {
          action.scrollIntoView({block:"nearest"});
          const r = rect(action);
          if (r.width < 44 || r.height < 44) throw Error("Touch target too small");
          if (r.top < m.top - 0.5 || r.bottom > m.bottom + 0.5 || r.bottom > nav.top) throw Error("Action outside visible menu");
          if (document.elementFromPoint(r.left + r.width/2, r.top + r.height/2)?.closest("button") !== action) throw Error("Action is covered: " + action.getAttribute("aria-label"));
          results.push(action.getAttribute("aria-label"));
        }
        const profile = $("[aria-label='Personal stats']");
        profile.scrollIntoView({block:"nearest"});
        profile.click();
        await wait(() => $("[role='status']").textContent.includes("Profile"));
        await open();
        contextual().scrollIntoView({block:"nearest"});
        tile("Catan")?.click();
        return {height: m.height, results};
      })()`);
      assert.ok(result.height >= 44, `menu remains usable at ${height}px`);
      assert.equal(result.results.length, 4);
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
