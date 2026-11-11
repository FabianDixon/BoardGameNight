export function restoreQuickActionsFocus() {
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return null;
  const button = document.querySelector("button[data-quick-actions-toggle]");
  const container = button?.parentElement;
  if (container) {
    container.inert = false;
    container.style.visibility = "";
  }
  return button;
}
