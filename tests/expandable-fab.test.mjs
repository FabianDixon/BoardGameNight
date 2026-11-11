import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const componentSource = readFileSync(
  new URL("../src/components/ui/ExpandableFab.jsx", import.meta.url),
  "utf8"
);
const fabSource = readFileSync(new URL("../src/components/ui/Fab.jsx", import.meta.url), "utf8");
const votingSource = readFileSync(new URL("../src/components/VotingPanel.jsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const profileSource = readFileSync(new URL("../src/components/ProfileCard.jsx", import.meta.url), "utf8");
const analyticsSource = readFileSync(new URL("../src/components/UserAnalyticsPanel.jsx", import.meta.url), "utf8");
const tokenSource = readFileSync(new URL("../src/components/TokenCountersTool.jsx", import.meta.url), "utf8");

function setup({ callbacks = {}, modalCount = 0, currentDestination = null, contextualAction = null } = {}) {
  const state = [];
  const refs = [];
  const effects = [];
  const listeners = new Map();
  const document = {
    body: {},
    activeElement: null,
    querySelector(selector) {
      assert.equal(selector, '[role="dialog"][aria-modal="true"]');
      return modalCount > 0 ? {} : null;
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
  };
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let tree;
  let observer;

  class MutationObserver {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
  }

  const react = {
    useId: () => "quick-actions",
    useState(initialValue) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initialValue;
      return [
        state[index],
        (nextValue) => {
          state[index] = typeof nextValue === "function" ? nextValue(state[index]) : nextValue;
        },
      ];
    },
    useCallback: (fn) => fn,
    useRef(initialValue) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initialValue };
      return refs[index];
    },
    useEffect(effect, dependencies) {
      const index = effectIndex++;
      const previous = effects[index];
      if (
        !previous ||
        dependencies.some((value, dependencyIndex) => !Object.is(value, previous.dependencies[dependencyIndex]))
      ) {
        effects[index] = { effect, dependencies, cleanup: previous?.cleanup };
        effects[index].pending = true;
      }
    },
  };
  const jsxRuntime = {
    Fragment: Symbol("Fragment"),
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props }),
  };
  const code = transformSync(componentSource, {
    loader: "jsx",
    jsx: "automatic",
    jsxImportSource: "jsx-runtime",
    format: "cjs",
  }).code;
  const moduleObject = { exports: {} };
  const context = {
    document,
    MutationObserver,
    module: moduleObject,
    exports: moduleObject.exports,
    require(specifier) {
      if (specifier === "react") return react;
      if (specifier === "./QuickActionIcon") return { default: () => null };
      if (specifier === "react-dom") return { createPortal: (content) => content };
      if (specifier === "jsx-runtime/jsx-runtime") return jsxRuntime;
      throw new Error(`Unexpected import: ${specifier}`);
    },
  };
  vm.runInNewContext(code, context);
  const ExpandableFab = moduleObject.exports.default;

  function hydrate(element, parent = null) {
    if (!element || typeof element !== "object") return;
    if (Array.isArray(element)) {
      element.forEach((child) => hydrate(child, parent));
      return;
    }

    const node = element.props?.ref?.current || {
      element,
      parent,
      style: {},
      focus() {
        document.activeElement = this;
        for (const listener of listeners.get("focusin") || []) listener({ target: this });
      },
      contains(target) {
        return target === this || descendants(this).some((child) => child === target);
      },
      querySelector(selector) {
        const enabledOnly = selector === 'button:not([aria-disabled="true"])';
        if (selector !== "button" && !enabledOnly) return null;
        return descendants(this).find((child) =>
          child.element.type === "button" && !(enabledOnly && child.element.props["aria-disabled"] === "true")
        );
      },
    };
    node.element = element;
    node.parent = parent;
    element.node = node;
    if (element.props?.ref) element.props.ref.current = node;
    hydrate(element.props?.children, node);
  }

  function descendants(root) {
    const result = [];
    function visit(children) {
      for (const child of Array.isArray(children) ? children : [children]) {
        if (Array.isArray(child)) visit(child);
        else if (child && typeof child === "object") {
          result.push(child.node);
          visit(child.props?.children);
        }
      }
    }
    visit(root.element.props?.children);
    return result;
  }

  function render() {
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    tree = ExpandableFab({
      onAddGame: callbacks.onAddGame || (() => {}),
      onSettings: callbacks.onSettings || (() => {}),
      onProfile: callbacks.onProfile || (() => {}),
      currentDestination,
      contextualAction,
    });
    hydrate(tree);
    for (const entry of effects) {
      if (!entry?.pending) continue;
      entry.cleanup?.();
      entry.cleanup = entry.effect() || undefined;
      entry.pending = false;
    }
    return tree;
  }

  function findAll(element, predicate, result = []) {
    if (!element || typeof element !== "object") return result;
    if (Array.isArray(element)) {
      element.forEach((child) => findAll(child, predicate, result));
      return result;
    }
    if (predicate(element)) result.push(element);
    findAll(element.props?.children, predicate, result);
    return result;
  }

  function dispatch(type, event) {
    for (const listener of listeners.get(type) || []) listener(event);
  }

  return {
    document,
    dispatch,
    findAll,
    listeners,
    render,
    container() { return tree.node; },
    setModalCount(count, notify = true) {
      modalCount = count;
      if (notify) observer.callback();
    },
    observer() { return observer; },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
    trigger() {
      return findAll(tree, (element) => element.type === "button" && /quick actions/.test(element.props["aria-label"]))[0];
    },
    actions() {
      return findAll(tree, (element) =>
        element.type === "button" &&
        ["Add game", "Settings", "Personal stats"].includes(element.props["aria-label"])
      );
    },
    contextual() {
      return findAll(tree, (element) => element.props?.["data-contextual-quick-action"])[0];
    },
    setContextualAction(next) { contextualAction = next; },
  };
}

test("modal dialogs suppress the FAB above the header until the last dialog closes", () => {
  for (const [source, title] of [[profileSource, "Choose avatar"], [tokenSource, "Choose icon"]]) {
    assert.match(source, /className="fixed inset-0 z-50[^"]*"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
    assert.ok(source.includes(title));
  }
  assert.match(appSource, /md:sticky md:top-0 md:z-40/);
  assert.match(appSource, /bottom-0 z-40/);

  const h = setup();
  h.render();
  assert.match(h.container().element.props.className, /\bz-\[45\]/);
  assert.equal(h.container().style.visibility, "");
  assert.equal(h.observer().target, h.document.body);
  assert.equal(h.observer().options.childList, true);
  assert.equal(h.observer().options.subtree, true);
  assert.equal(Array.from(h.observer().options.attributeFilter).join(","), "role,aria-modal");
  h.trigger().props.onClick();
  h.render();
  h.setModalCount(1, false);
  const event = { key: "Escape", prevented: false, preventDefault() { this.prevented = true; } };
  h.dispatch("keydown", event);
  assert.equal(event.prevented, false);
  h.setModalCount(1);
  assert.equal(h.container().style.visibility, "hidden");
  assert.equal(h.container().inert, true);
  h.render();
  assert.equal(h.trigger().props["aria-expanded"], false);
  h.setModalCount(2);
  h.setModalCount(1);
  assert.equal(h.container().inert, true);
  h.setModalCount(0);
  assert.equal(h.container().style.visibility, "");
  assert.equal(h.container().inert, false);
  h.trigger().props.onClick();
  h.render();
  assert.equal(h.trigger().props["aria-expanded"], true);
  h.unmount();
  assert.equal(h.observer().disconnected, true);
});

test("a FAB mounted while a modal is already open starts hidden and inert", () => {
  const h = setup({ modalCount: 1 });
  h.render();
  assert.equal(h.container().style.visibility, "hidden");
  assert.equal(h.container().inert, true);
});

test("quick actions start collapsed and focus the first action when expanded", () => {
  const h = setup();
  h.render();
  assert.equal(h.trigger().props.type, "button");
  assert.equal(h.trigger().props["aria-expanded"], false);
  assert.equal(h.trigger().props.children[0].props.children, "^");
  assert.match(h.trigger().props.children[0].props.className, /\binline-block translate-y-\[3px\]/);
  assert.match(h.trigger().props.className, /\bh-11 w-11\b/);

  h.trigger().props.onClick();
  h.render();
  assert.equal(h.trigger().props["aria-expanded"], true);
  assert.equal(h.trigger().props["aria-label"], "Close quick actions");
  assert.equal(h.actions().map((button) => button.props["aria-label"]).join(", "), "Add game, Settings, Personal stats");
  for (const action of h.actions()) {
    assert.equal(action.props.title, action.props["aria-label"]);
    assert.equal(action.props.children.props["aria-hidden"], "true");
    assert.match(action.props.className, /\bh-11 w-11\b/);
  }
  assert.equal(h.document.activeElement, h.actions()[0].node);
});

test("Escape closes the menu and restores focus to its toggle", () => {
  const h = setup();
  h.render();
  h.trigger().props.onClick();
  h.render();
  const event = { key: "Escape", prevented: false, preventDefault() { this.prevented = true; } };
  h.dispatch("keydown", event);
  h.render();

  assert.equal(event.prevented, true);
  assert.equal(h.trigger().props["aria-expanded"], false);
  assert.equal(h.document.activeElement.element.props.title, "Quick actions");
  assert.equal(h.listeners.get("keydown").size, 0);
});

test("pointer and keyboard focus outside dismiss without stealing outside focus", () => {
  for (const dismissal of ["pointerdown", "focusin"]) {
    const h = setup();
    h.render();
    h.trigger().props.onClick();
    h.render();
    const outside = { outside: true };
    if (dismissal === "focusin") h.document.activeElement = outside;
    h.dispatch(dismissal, { target: outside });
    h.render();
    assert.equal(h.trigger().props["aria-expanded"], false);
    if (dismissal === "focusin") assert.equal(h.document.activeElement, outside);
  }
});

test("each quick action invokes its matching callback and closes the menu", () => {
  const actionsRun = [];
  const h = setup({
    callbacks: {
      onAddGame: () => actionsRun.push("add"),
      onSettings: () => actionsRun.push("settings"),
      onProfile: () => actionsRun.push("profile"),
    },
  });
  h.render();
  h.trigger().props.onClick();
  h.render();
  for (const action of h.actions()) {
    action.props.onClick();
    h.render();
    if (actionsRun.length < 3) {
      h.trigger().props.onClick();
      h.render();
    }
  }

  assert.deepEqual(actionsRun, ["add", "settings", "profile"]);
  assert.equal(h.trigger().props["aria-expanded"], false);
});

test("the app retains five desktop destinations and three mobile destinations", () => {
  const navigation = appSource.slice(appSource.indexOf("const topLevelTabs ="), appSource.indexOf("function handleTopLevelTabClick"));
  assert.deepEqual([...navigation.matchAll(/key: APP_TAB\.(\w+)/g)].map((match) => match[1]), [
    "LIBRARY",
    "COLLECTION",
    "GROUP",
    "ANALYTICS",
    "PROFILE",
  ]);
  assert.match(navigation, /const desktopTabs = \[\s*\.\.\.topLevelTabs,/);
  assert.match(appSource, /desktopTabs\.map\(\(t\)/);
  assert.match(appSource, /topLevelTabs\.map\(\(t\)/);
  assert.match(appSource, /currentDestination=\{activeTab === APP_TAB\.PROFILE \? "settings" : activeTab === APP_TAB\.ANALYTICS \? "profile" : null\}/);
  assert.match(appSource, /onSettings=\{\(\) => handleTopLevelTabClick\(APP_TAB\.PROFILE\)\}/);
  assert.match(appSource, /onProfile=\{\(\) => handleTopLevelTabClick\(APP_TAB\.ANALYTICS\)\}/);
  assert.match(appSource, /grid grid-cols-3 gap-2/);
  assert.match(navigation, /label: "Personal stats"/);
  assert.match(navigation, /label: "Settings"/);
  assert.match(profileSource, />Settings<\/h2>/);
  assert.equal((analyticsSource.match(/>Personal stats<\/h3>/g) || []).length, 3);
  assert.match(appSource, /restoreFocus=\{restoreQuickActionsFocus\}/);
  const visibility = appSource.slice(appSource.indexOf("const showFab ="), appSource.indexOf("const topLevelTabs ="));
  assert.doesNotMatch(visibility, /isAddGameOpen/);
});

test("current account destination is indicated on the FAB and its matching action", () => {
  for (const [destination, label, icon] of [
    ["settings", "Settings", "⚙"],
    ["profile", "Personal stats", "📊"],
  ]) {
    const h = setup({ currentDestination: destination });
    h.render();
    assert.match(h.trigger().props["aria-label"], new RegExp(`current page: ${label}`));
    assert.equal(h.trigger().props.children[2].props.children, icon);
    assert.match(h.trigger().props.children[2].props.className, /md:hidden/);
    h.trigger().props.onClick();
    h.render();
    assert.equal(h.actions().find((action) => action.props["aria-label"] === label).props["aria-current"], "page");
    assert.equal(h.actions().filter((action) => action.props["aria-current"] === "page").length, 1);
  }
});

test("FAB positioning uses responsive CSS that changes at the navigation breakpoint", async () => {
  const h = setup();
  h.render();
  const { className, style } = h.container().element.props;
  const menuClass = h.findAll(h.container().element, (element) => element.props?.role === "group")[0].props.className;
  assert.match(className, /\bbottom-24\b/);
  assert.match(className, /\bmd:bottom-6\b/);
  assert.match(menuClass, /\babsolute bottom-full\b/);
  assert.match(menuClass, /\boverflow-y-auto\b/);
  assert.equal(style, undefined);
  assert.doesNotMatch(appSource, /matchMedia\("\(min-width: 768px\)"\)/);
  assert.doesNotMatch(votingSource, /matchMedia\("\(min-width: 768px\)"\)/);

  const result = await postcss([
    tailwindcss({ content: [{ raw: `${componentSource}\n${fabSource}`, extension: "jsx" }] }),
  ]).process("@tailwind utilities;", { from: undefined });
  const bottomOffsets = {};
  result.root.walkRules((rule) => {
    if (rule.parent.type === "atrule" && rule.parent.params !== "(min-width: 768px)") return;
    const bottom = rule.nodes.find((node) => node.prop === "bottom")?.value;
    if (bottom) bottomOffsets[rule.selector] = bottom;
  });
  assert.equal(bottomOffsets[".bottom-24"], "6rem");
  assert.equal(bottomOffsets[".md\\:bottom-6"], "1.5rem");
});

test("short landscape viewports keep every action reachable without overlapping navigation", async () => {
  const h = setup();
  h.render();
  h.trigger().props.onClick();
  h.render();
  const menu = h.findAll(h.container().element, (element) => element.props?.role === "group")[0];
  assert.match(menu.props.className, /\boverflow-y-auto\b/);
  assert.ok(h.actions().every((action) => /\bshrink-0\b/.test(action.props.className)));
  assert.equal(h.document.activeElement, h.actions()[0].node);

  const result = await postcss([
    tailwindcss({ content: [{ raw: componentSource, extension: "jsx" }] }),
  ]).process("@tailwind utilities;", { from: undefined });
  const heights = new Map();
  const shortRules = new Map();
  result.root.walkRules((rule) => {
    const media = rule.parent.type === "atrule" ? rule.parent.params : "";
    const height = rule.nodes.find((node) => node.prop === "max-height")?.value;
    if (media === "(max-height:303px) and (min-width:320px)") {
      for (const declaration of rule.nodes) shortRules.set(declaration.prop, declaration.value);
    } else if (height) {
      heights.set(media ? "desktop" : "mobile", height);
    }
  });
  assert.equal(heights.get("mobile").replaceAll(" ", ""), "max(0px,calc(100dvh-10.5rem))");
  assert.equal(heights.get("desktop").replaceAll(" ", ""), "max(0px,calc(100dvh-6rem))");
  assert.equal(shortRules.get("position"), "fixed");
  assert.equal(shortRules.get("left"), "1rem");
  assert.equal(shortRules.get("top"), "1rem");
  assert.equal(shortRules.get("right"), "auto");
  assert.equal(shortRules.get("bottom"), "auto");
  assert.equal(shortRules.get("max-height").replaceAll(" ", ""), "max(0px,calc(100dvh-5rem))");

  // offset = trigger bottom + 44px trigger + 12px gap + 16px top margin
  for (const [offset, toggleBottom] of [[168, 96], [96, 24]]) {
    for (const viewportHeight of [320, 304]) {
      const menuHeight = Math.max(0, viewportHeight - offset);
      assert.ok(menuHeight >= 44, `action fits at ${viewportHeight}px`);
      assert.equal(viewportHeight - toggleBottom - 44 - 12 - menuHeight, 16);
    }
  }
  assert.ok(240 - 80 >= 44);
});

test("voting phase controls coexist below the quick actions and retain their callbacks", () => {
  const code = transformSync(fabSource, {
    loader: "jsx",
    jsx: "automatic",
    jsxImportSource: "jsx-runtime",
    format: "cjs",
  }).code;
  const moduleObject = { exports: {} };
  const context = {
    document: { body: {} },
    module: moduleObject,
    exports: moduleObject.exports,
    require(specifier) {
      if (specifier === "react-dom") return { createPortal: (element) => element };
      if (specifier === "jsx-runtime/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
      throw new Error(`Unexpected import: ${specifier}`);
    },
  };
  vm.runInNewContext(code, context);
  const Fab = moduleObject.exports.default;
  let invoked = 0;
  for (const label of ["Submit", "Change Submission", "Vote", "Voted"]) {
    const button = Fab({ show: true, label, variant: "pill", onClick: () => invoked++ });
    assert.equal(button.props["aria-label"], label);
    assert.match(button.props.className, /\bbottom-24\b/);
    assert.match(button.props.className, /\bmd:bottom-6\b/);
    assert.equal(button.props.style.bottom, undefined);
    assert.equal(button.props.style.right, 16);
    assert.equal(button.props.style.zIndex, 45);
    button.props.onClick();
  }
  assert.equal(invoked, 4);
  assert.equal(Fab({ show: false }), null);
  const disabled = Fab({ show: true, disabled: true, onClick() {} });
  assert.equal(disabled.props.disabled, true);
  assert.equal(disabled.props.onClick, undefined);

  assert.doesNotMatch(votingSource, /<Fab\b/);
  assert.doesNotMatch(votingSource, /ui\/Fab"/);
  assert.match(appSource, /onAddGame=\{\(\) => setIsAddGameOpen\(true\)\}/);
});

test("contextual action is wired once, from the mounted panel, with its original guards", () => {
  assert.match(appSource, /import ExpandableFab from "\.\/components\/ui\/ConnectedExpandableFab"/);
  assert.match(votingSource, /const isCollecting = activeVote\?\.status === VOTE_STATUS\.COLLECTING/);
  assert.match(votingSource, /const isVoting = activeVote\?\.status === VOTE_STATUS\.OPEN/);
  assert.match(votingSource, /quickActionDisabled = isCollecting \? submitDisabled : voteDisabled/);
  assert.match(votingSource, /isCollecting \? handleSubmit : handleVote/);
  assert.match(votingSource, /if \(submitDisabled\) return;/);
  assert.match(votingSource, /if \(voteDisabled\) return;/);
  assert.match(votingSource, /useEffect\(\(\) => \(\) => clearContextualQuickAction\(quickActionOwner\)/);
  assert.match(votingSource, /open <span className="font-semibold">Quick actions<\/span>/);
  assert.doesNotMatch(votingSource, /press <span/);
  assert.match(votingSource, /No Submission/);
  assert.match(votingSource, /props\.currentGroupId \|\| "no-group"/);
  assert.equal((votingSource.match(/\{quickActionStatus\}/g) || []).length, 2);
  assert.match(votingSource, /data-quick-action-status/);
  assert.match(readFileSync(new URL("../src/components/GroupDetail.jsx", import.meta.url), "utf8"), /groupTab === GROUP_TAB\.VOTING && votingNode/);
});

test("enabled contextual action renders as an icon, runs its callback and closes the menu", () => {
  let calls = 0;
  const h = setup({ contextualAction: { kind: "vote", label: "Vote", disabled: false, reason: "", onClick: () => calls++ } });
  h.render();
  assert.match(h.trigger().props["aria-label"], /Vote available in menu/);
  assert.equal(h.trigger().props.children[1].props["data-contextual-badge"], true);
  h.trigger().props.onClick();
  h.render();
  const action = h.contextual();
  assert.equal(action.props["aria-label"], "Vote");
  assert.equal(action.props["aria-disabled"], undefined);
  assert.match(action.props.className, /\bh-11 w-11\b/);
  assert.equal(h.document.activeElement, h.actions()[0].node);
  action.props.onClick();
  h.render();
  assert.equal(calls, 1);
  assert.equal(h.trigger().props["aria-expanded"], false);
});

test("disabled contextual action exposes its reason, is inert and never takes initial focus", () => {
  let calls = 0;
  const h = setup({ contextualAction: { kind: "submit", label: "Submit", disabled: true, reason: "Select a game first", onClick: () => calls++ } });
  h.render();
  assert.match(h.trigger().props["aria-label"], /Submit, unavailable: Select a game first/);
  h.trigger().props.onClick();
  h.render();
  const action = h.contextual();
  assert.equal(action.props["aria-disabled"], "true");
  assert.equal(action.props["aria-label"], "Submit, unavailable: Select a game first");
  assert.notEqual(h.document.activeElement, action.node);
  assert.equal(h.document.activeElement, h.actions()[0].node);
  action.props.onClick();
  h.render();
  assert.equal(calls, 0);
  assert.equal(h.trigger().props["aria-expanded"], true);
});

test("contextual action disappears from the FAB when the screen unregisters it", () => {
  const h = setup({ contextualAction: { kind: "vote", label: "Vote", disabled: false, onClick() {} } });
  h.render();
  h.setContextualAction(null);
  h.render();
  assert.equal(h.contextual(), undefined);
  assert.doesNotMatch(h.trigger().props["aria-label"], /Vote/);
});

test("contextual registry only lets the current owner clear or replace its action", () => {
  const code = transformSync(readFileSync(new URL("../src/components/ui/contextualQuickAction.js", import.meta.url), "utf8"), {
    format: "cjs",
  }).code;
  const moduleObject = { exports: {} };
  const captured = [];
  vm.runInNewContext(code, {
    module: moduleObject,
    exports: moduleObject.exports,
    require: (specifier) => {
      assert.equal(specifier, "react");
      return { useSyncExternalStore: (subscribe, get) => { captured.push(subscribe, get); return get(); } };
    },
  });
  const { setContextualQuickAction, clearContextualQuickAction, useContextualQuickAction } = moduleObject.exports;
  assert.equal(useContextualQuickAction(), null);
  const [subscribe, get] = captured;
  let notified = 0;
  const unsubscribe = subscribe(() => notified++);

  const first = { kind: "vote", label: "Vote", disabled: false, reason: "", onClick() {} };
  setContextualQuickAction("a", first);
  setContextualQuickAction("a", first);
  assert.equal(notified, 1, "identical publishes do not re-render");
  clearContextualQuickAction("stale");
  assert.equal(get().owner, "a");

  setContextualQuickAction("b", { ...first, kind: "submit", label: "Submit" });
  clearContextualQuickAction("a");
  assert.equal(get().owner, "b", "old owner cannot clear the replacement");
  clearContextualQuickAction("b");
  assert.equal(get(), null);
  unsubscribe();
  setContextualQuickAction("c", first);
  assert.equal(notified, 3);
  clearContextualQuickAction("c");
});
