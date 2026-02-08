import React from "react";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        className="w-full border rounded-xl px-4 py-2 bg-white"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="search"
        autoComplete="off"
      />
      {value?.trim() && (
        <button
          type="button"
          className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"
          onClick={() => onChange("")}
          title="Clear"
        >
          ✕
        </button>
      )}
    </div>
  );
}