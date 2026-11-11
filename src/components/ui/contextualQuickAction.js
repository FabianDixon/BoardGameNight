import { useSyncExternalStore } from "react";

// Single-slot registry: a mounted screen publishes one contextual action for the
// shared quick-actions FAB. Only the owner that published it can replace or clear it,
// so a stale unmount can never remove another screen's action.
let current = null;
const listeners = new Set();

function sameAction(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return ["owner", "kind", "label", "reason", "disabled", "onClick"].every((key) => a[key] === b[key]);
}

function emit(next) {
  if (sameAction(current, next)) return;
  current = next;
  listeners.forEach((listener) => listener());
}

export function setContextualQuickAction(owner, action) {
  emit({ ...action, owner });
}

export function clearContextualQuickAction(owner) {
  if (current?.owner === owner) emit(null);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => current;

export function useContextualQuickAction() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
