// src/components/ProfileTab.jsx
export default function ProfileTab({
    user,
    profile,
    nickname,
    setNickname,
    onSaveNickname,
  }) {
    if (!user) {
      return <p className="text-sm text-gray-600">Signing in…</p>;
    }
  
    if (!profile) {
      return <p className="text-sm text-gray-600">Loading profile…</p>;
    }
  
    return (
      <div className="bg-white p-4 rounded-2xl shadow">
        <h2 className="text-xl font-semibold mb-3">Profile</h2>
  
        <p className="text-sm text-gray-700 mb-2">
          Current nickname:{" "}
          <span className="font-semibold">
            {profile.nickname || "(no nickname yet)"}
          </span>
        </p>
  
        <input
          className="border p-2 rounded w-full mb-2"
          placeholder="Enter nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
  
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={onSaveNickname}
          disabled={!nickname.trim()}
          title={!nickname.trim() ? "Enter a nickname first" : ""}
        >
          Save nickname
        </button>
      </div>
    );
  }
  