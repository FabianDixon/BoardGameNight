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
    <button className="mt-2 text-sm text-red-600" onClick={handler(onRemove)}>
      Remove from my collection
    </button>
  ) : (
    <button className="mt-2 text-sm text-green-600" onClick={handler(onAdd)}>
      Add to my collection
    </button>
  );
}
