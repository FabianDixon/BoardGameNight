// src/components/TopTabs.jsx
export default function TopTabs({ activeTab, setActiveTab, badges }) {
    const tabs = [
      { key: "library", label: "Library" },
      { key: "collection", label: "My Collection" },
      { key: "group", label: "Group" },
      { key: "profile", label: "Profile" },
    ];
  
    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => {
          const count = badges?.[t.key];
          const isActive = activeTab === t.key;
  
          return (
            <button
              key={t.key}
              className={`px-3 py-2 rounded border ${
                isActive ? "bg-white" : "bg-gray-100"
              }`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {typeof count === "number" ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>
    );
  }
  