import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QuickActionIcon from "./QuickActionIcon";

export default function ExpandableFab({
  onAddGame,
  onSettings,
  onProfile,
  currentDestination = null,
  contextualAction = null,
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const hadContextualFocusRef = useRef(false);
  const hasContextual = !!contextualAction;

  // The ref cleanup runs before the node is detached, so focus is still readable.
  const contextualRef = useCallback((node) => {
    if (!node) return undefined;
    return () => {
      if (document.activeElement === node) hadContextualFocusRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (hasContextual || !hadContextualFocusRef.current) return;
    hadContextualFocusRef.current = false;
    const remaining = open
      ? menuRef.current?.querySelector('button:not([aria-disabled="true"])')
      : null;
    (remaining || triggerRef.current)?.focus();
  }, [hasContextual, open]);

  useEffect(() => {
    // Dialogs can be opened by nested screens without notifying the app shell.
    const container = containerRef.current;
    const hasModal = () => !!document.querySelector('[role="dialog"][aria-modal="true"]');
    const syncVisibility = () => {
      const modalOpen = hasModal();
      container.inert = modalOpen;
      container.style.visibility = modalOpen ? "hidden" : "";
      return modalOpen;
    };

    syncVisibility();
    const observer = new MutationObserver(() => {
      if (syncVisibility()) setOpen(false);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "aria-modal"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const firstAction = menuRef.current?.querySelector('button:not([aria-disabled="true"])');
    firstAction?.focus();

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    function handlePointerDown(event) {
      if (
        menuRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleFocusIn(event) {
      if (
        menuRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [open]);

  const actions = [
    { label: "Add game", icon: "＋", onClick: onAddGame },
    { label: "Settings", icon: "⚙", onClick: onSettings, current: currentDestination === "settings" },
    { label: "Personal stats", icon: "📊", onClick: onProfile, current: currentDestination === "profile" },
  ];
  const currentAction = actions.find((action) => action.current);

  const contextualLabel = contextualAction
    ? `${contextualAction.label}${contextualAction.disabled && contextualAction.reason ? `, unavailable: ${contextualAction.reason}` : ""}`
    : "";

  function runContextualAction() {
    if (!contextualAction || contextualAction.disabled) return;
    runAction(contextualAction.onClick);
  }

  function runAction(action) {
    setOpen(false);
    action();
    triggerRef.current?.focus();
  }

  return createPortal(
    <div
      ref={containerRef}
      className="fixed right-4 bottom-24 md:bottom-6 z-[45] flex flex-col items-end gap-3"
    >
      <div
        id={menuId}
        ref={menuRef}
        role="group"
        aria-label="Quick actions"
        className={`${open ? "flex" : "hidden"} absolute bottom-full right-0 mb-3 max-h-[max(0px,calc(100dvh-10.5rem))] md:max-h-[max(0px,calc(100dvh-6rem))] [@media_(max-height:303px)_and_(min-width:320px)]:fixed [@media_(max-height:303px)_and_(min-width:320px)]:top-4 [@media_(max-height:303px)_and_(min-width:320px)]:left-4 [@media_(max-height:303px)_and_(min-width:320px)]:right-auto [@media_(max-height:303px)_and_(min-width:320px)]:bottom-auto [@media_(max-height:303px)_and_(min-width:320px)]:max-h-[max(0px,calc(100dvh-5rem))] overflow-y-auto flex-col items-end gap-2`}
      >
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            aria-label={action.label}
            title={action.label}
            aria-current={action.current ? "page" : undefined}
            onClick={() => runAction(action.onClick)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-xl transition hover:border-blue-500 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${action.current ? "border-blue-400 bg-blue-900" : "border-neutral-700 bg-neutral-900"}`}
          >
            <span aria-hidden="true" className="text-xl text-blue-300">
              {action.icon}
            </span>
          </button>
        ))}
        {contextualAction && (
          <button
            ref={contextualRef}
            type="button"
            data-contextual-quick-action={contextualAction.kind}
            aria-label={contextualLabel}
            title={contextualLabel}
            aria-disabled={contextualAction.disabled ? "true" : undefined}
            onClick={runContextualAction}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${contextualAction.disabled ? "cursor-not-allowed border-neutral-700 bg-neutral-800 opacity-60" : "border-green-500 bg-neutral-900 hover:bg-neutral-800"}`}
          >
            <QuickActionIcon kind={contextualAction.kind} disabled={contextualAction.disabled} label={contextualAction.label} />
          </button>
        )}
      </div>
      <button
        ref={triggerRef}
        type="button"
        data-quick-actions-toggle
        aria-label={`${open ? "Close" : "Open"} quick actions${currentAction ? `, current page: ${currentAction.label}` : ""}${contextualAction ? `. ${contextualLabel} available in menu` : ""}`}
        aria-expanded={open}
        aria-controls={menuId}
        title="Quick actions"
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-blue-500 bg-blue-600 text-2xl text-white shadow-xl transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 active:scale-95"
      >
        <span aria-hidden="true" className={open ? undefined : "inline-block translate-y-[3px]"}>{open ? "×" : "^"}</span>
        {contextualAction && (
          <span
            aria-hidden="true"
            data-contextual-badge
            className={`absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border bg-neutral-900 ${contextualAction.disabled ? "border-neutral-600 opacity-80" : "border-green-500"}`}
          >
            <QuickActionIcon kind={contextualAction.kind} disabled={contextualAction.disabled} label={contextualAction.label} small />
          </span>
        )}
        {currentAction && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-blue-400 bg-neutral-900 text-sm md:hidden">
            {currentAction.icon}
          </span>
        )}
      </button>
    </div>,
    document.body
  );
}
