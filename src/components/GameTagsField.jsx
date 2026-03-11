import { useMemo, useState } from "react";
import {
  getGameTagLabel,
  normalizeGameTag,
  normalizeGameTags,
  SUGGESTED_GAME_TAGS,
} from "../utils/gameTags";

export default function GameTagsField({ value, onChange }) {
  const [draftTag, setDraftTag] = useState("");

  const tags = useMemo(() => normalizeGameTags(value), [value]);

  function updateTags(nextTags) {
    onChange(normalizeGameTags(nextTags));
  }

  function addTag(rawTag) {
    const canonical = normalizeGameTag(rawTag);
    if (!canonical) return;
    updateTags([...tags, canonical]);
    setDraftTag("");
  }

  function removeTag(tagToRemove) {
    updateTags(tags.filter((tag) => tag !== tagToRemove));
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-white mb-1">Tags</label>
        <p className="text-xs text-gray-400">
          Add suggested tags or create your own. Tags are saved in a canonical format.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.length > 0 ? (
          tags.map((tag) => (
            <span
              key={tag}
              className="ui-chip-blue text-sm gap-2"
            >
              {getGameTagLabel(tag)}
              <button
                type="button"
                className="text-blue-200 hover:text-white"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${getGameTagLabel(tag)} tag`}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <p className="text-sm text-gray-400">No tags yet.</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="w-full text-sm"
          placeholder="Custom tag"
          value={draftTag}
          onChange={(e) => setDraftTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(draftTag);
            }
          }}
        />

        <button
          type="button"
          className="ui-btn-ghost px-3"
          onClick={() => addTag(draftTag)}
        >
          Add
        </button>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
          Suggested tags
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_GAME_TAGS.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`ui-pill ${
                  selected
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "ui-pill-inactive"
                }`}
                onClick={() => (selected ? removeTag(tag) : addTag(tag))}
              >
                {getGameTagLabel(tag)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}