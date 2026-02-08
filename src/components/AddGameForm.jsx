// src/components/AddGameForm.jsx
import React from "react";

export default function AddGameForm({ form, setForm, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="bg-white p-4 rounded-2xl shadow mb-6">
      <h2 className="text-xl font-semibold mb-3">Add New Game</h2>

      <input
        className="border p-2 w-full mb-2 rounded"
        placeholder="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        required
      />

      <input
        className="border p-2 w-full mb-2 rounded"
        placeholder="Image URL"
        value={form.imageUrl}
        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
      />

      <textarea
        className="border p-2 w-full mb-2 rounded"
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        required
      />

      <button className="bg-blue-600 text-white px-4 py-2 rounded">
        Add Game
      </button>
    </form>
  );
}
