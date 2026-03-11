import { useState } from "react";
import { getGameTagLabel, normalizeGameTag } from "../utils/gameTags";

export default function GameTagFilter({ availableTags = [], selectedTags = [], onTagsChange }) {
  const [isOpen, setIsOpen] = useState(false);

  function toggleTag(tag) {
    const canonical = normalizeGameTag(tag);
    if (!canonical) return;

    if (selectedTags.includes(canonical)) {
      onTagsChange(selectedTags.filter((t) => t !== canonical));
    } else {
      onTagsChange([...selectedTags, canonical]);
    }
  }

  function clearAll() {
    onTagsChange([]);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="px-3 py-1.5 rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-sm text-gray-200"
        onClick={() => setIsOpen(!isOpen)}
      >
        🏷️ Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-full left-0 mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg p-3 z-50 min-w-[250px]">
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {availableTags.length === 0 ? (
                <p className="text-sm text-gray-400">No tags available.</p>
              ) : (
                availableTags.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <label key={tag} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleTag(tag)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-200 flex-1">
                        {getGameTagLabel(tag)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({selectedTags.includes(tag) ? "on" : "off"})
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {selectedTags.length > 0 && (
              <div className="mt-2 pt-2 border-t border-neutral-700">
                <button
                  type="button"
                  className="text-xs text-blue-400 hover:text-blue-300 w-full text-left px-1"
                  onClick={clearAll}
                >
                  Clear all {selectedTags.length === 1 ? "tag" : "tags"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
