// src/components/CollectionToggle.jsx
import React from "react";

export default function CollectionToggle({
  inCollection,
  onAdd,
  onRemove,
  stopPropagation,
}) {
  const handler = (fn) => (e) => {
    if (stopPropagation) e.stopPropagation();
    fn();
  };

  return inCollection ? (
    <button className="mt-2 ui-btn-danger" onClick={handler(onRemove)}>
      Remove from my collection
    </button>
  ) : (
    <button className="mt-2 ui-btn-success" onClick={handler(onAdd)}>
      Add to my collection
    </button>
  );
}
