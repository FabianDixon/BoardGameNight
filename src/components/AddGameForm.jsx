// src/components/AddGameForm.jsx
import React from "react";
import GameTagsField from "./GameTagsField";

export default function AddGameForm({ form, setForm, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="ui-surface p-4 mb-6">
      <h2 className="text-xl font-semibold mb-3 text-white">Add New Game</h2>

      <input
        className="w-full mb-2"
        placeholder="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        required
      />

      <input
        className="w-full mb-2"
        placeholder="Image URL"
        value={form.imageUrl}
        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
      />

      <textarea
        className="w-full mb-2"
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        required
      />

      <GameTagsField
        value={form.tags}
        onChange={(tags) => setForm({ ...form, tags })}
      />

      <div className="pt-2">
        <button className="ui-btn-primary">
          Add Game
        </button>
      </div>
    </form>
  );
}
