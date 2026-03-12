// src/components/CollectionToggle.jsx
import React from "react";

export default function CollectionToggle({
  inCollection,
  onAdd,
  onRemove,
  stopPropagation,
  compact = false,
}) {
  const handler = (fn) => (e) => {
    if (stopPropagation) e.stopPropagation();
    fn();
  };

  return inCollection ? (
    <button
      className={compact
        ? "ui-pill text-xs border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
        : "mt-2 ui-btn-danger"}
      onClick={handler(onRemove)}
    >
      {compact ? "Remove" : "Remove from my collection"}
    </button>
  ) : (
    <button
      className={compact
        ? "ui-pill text-xs border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
        : "mt-2 ui-btn-success"}
      onClick={handler(onAdd)}
    >
      {compact ? "Add" : "Add to my collection"}
    </button>
  );
}
