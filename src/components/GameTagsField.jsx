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
              className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-sm text-blue-100"
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
          className="border border-neutral-700 bg-neutral-900 p-2 w-full rounded text-white placeholder-gray-500"
          placeholder="Add custom tag"
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
          className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-white"
          onClick={() => addTag(draftTag)}
        >
          Add tag
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
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  selected
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-neutral-700 bg-neutral-900 text-gray-200 hover:border-neutral-500"
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