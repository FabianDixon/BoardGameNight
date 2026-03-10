// src/components/AddGameForm.jsx
import React from "react";

export default function AddGameForm({ form, setForm, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="bg-neutral-800 p-4 rounded-2xl shadow border border-neutral-700 mb-6">
      <h2 className="text-xl font-semibold mb-3 text-white">Add New Game</h2>

      <input
        className="border border-neutral-700 bg-neutral-900 p-2 w-full mb-2 rounded text-white placeholder-gray-500"
        placeholder="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        required
      />

      <input
        className="border border-neutral-700 bg-neutral-900 p-2 w-full mb-2 rounded text-white placeholder-gray-500"
        placeholder="Image URL"
        value={form.imageUrl}
        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
      />

      <textarea
        className="border border-neutral-700 bg-neutral-900 p-2 w-full mb-2 rounded text-white placeholder-gray-500"
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        required
      />

      <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
        Add Game
      </button>
    </form>
  );
}
