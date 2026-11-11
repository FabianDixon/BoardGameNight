import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";

const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const modalSource = source.slice(source.indexOf("const openModals = [];"), source.indexOf("function normalizePlayedGameIds"));

function setup({ dismissible = true, disconnectedTrigger = false } = {}) {
  const effects = [];
  const listeners = new Map();
  const document = {
    body: {},
    activeElement: null,
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) listeners.delete(type);
    },
  };
  const trigger = { isConnected: !disconnectedTrigger, focus() { document.activeElement = this; } };
  const replacement = { focus() { document.activeElement = this; } };
  document.activeElement = trigger;
  const elements = [];
  const dialog = {
    contains(target) { return target === this || elements.includes(target); },
    querySelectorAll() { return elements; },
    focus() { document.activeElement = this; },
  };
  for (let i = 0; i < 2; i++) {
    elements.push({
      tabIndex: 0,
      matches: () => false,
      closest: () => null,
      getClientRects: () => [1],
      focus() { document.activeElement = this; },
    });
  }
  const jsx = (type, props) => ({ type, props });
  const context = {
    document,
    useId: () => "modal-title",
    useRef: (value) => ({ current: value === null ? dialog : value }),
    useEffect: (effect) => effects.push(effect),
    jsxRuntime: { jsx, jsxs: jsx },
    exports: {},
  };
  const code = transformSync(`${modalSource}\nthis.Modal = Modal;`, {
    loader: "jsx",
    jsx: "automatic",
    jsxImportSource: "jsxRuntime",
    format: "cjs",
  }).code;
  context.require = () => context.jsxRuntime;
  vm.runInNewContext(code, context);
  let closed = 0;
  const tree = context.exports.Modal({
    open: true,
    title: "Test modal",
    onClose: () => { closed++; },
    dismissible,
    restoreFocus: () => replacement,
  });
  const cleanups = effects.map((effect) => effect()).filter(Boolean);
  function key(key, shiftKey = false) {
    const event = { key, shiftKey, prevented: false, preventDefault() { this.prevented = true; } };
    listeners.get("keydown")(event);
    return event;
  }
  return { tree, document, dialog, elements, trigger, replacement, listeners, cleanups, key, closed: () => closed };
}

test("modal names itself, contains keyboard and programmatic focus, and restores trigger", () => {
  const h = setup();
  assert.equal(h.tree.props.role, "dialog");
  assert.equal(h.tree.props["aria-labelledby"], "modal-title");
  assert.equal(h.document.activeElement, h.elements[0]);
  assert.equal(h.key("Tab", true).prevented, true);
  assert.equal(h.document.activeElement, h.elements[1]);
  assert.equal(h.key("Tab").prevented, true);
  assert.equal(h.document.activeElement, h.elements[0]);
  h.document.activeElement = h.trigger;
  h.listeners.get("focusin")({ target: h.trigger });
  assert.equal(h.document.activeElement, h.elements[0]);
  assert.equal(h.key("Escape").prevented, true);
  assert.equal(h.closed(), 1);
  h.cleanups.forEach((cleanup) => cleanup());
  assert.equal(h.document.activeElement, h.trigger);
});

test("non-dismissible modal ignores Escape and restores a replacement trigger", () => {
  const h = setup({ dismissible: false, disconnectedTrigger: true });
  assert.equal(h.key("Escape").prevented, true);
  assert.equal(h.closed(), 0);
  h.cleanups.forEach((cleanup) => cleanup());
  assert.equal(h.document.activeElement, h.replacement);
});

test("desktop and mobile navigation expose the active destination", () => {
  const navigation = source.slice(source.indexOf("const topLevelTabs ="), source.indexOf("{/* Game detail (works from any tab) */}"));
  assert.equal((navigation.match(/aria-label="Main navigation"/g) || []).length, 2);
  assert.equal((navigation.match(/aria-current=\{isActive \? "page" : undefined\}/g) || []).length, 2);
});
