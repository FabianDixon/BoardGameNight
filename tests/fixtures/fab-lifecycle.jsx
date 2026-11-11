import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Modal } from "../../src/App";
import ConnectedExpandableFab from "../../src/components/ui/ConnectedExpandableFab";
import { restoreQuickActionsFocus } from "../../src/components/ui/quickActionsFocus";
import VotingPanel from "../../src/components/VotingPanel";
import "../../src/index.css";

const user = { uid: "u1" };
const groupGames = [
  { id: "g1", title: "Catan" },
  { id: "g2", title: "Azul" },
];
const poolActiveIds = new Set();
const submittedGameIds = new Set();
const calls = (window.__calls = []);

export function Fixture() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState("");
  const [screen, setScreen] = useState("voting"); // voting | other | detail
  const [groupId, setGroupId] = useState("group-a");
  const [status, setStatus] = useState("open");
  const [groupState, setGroupState] = useState({});
  const { submission = null, ballot = null } = groupState[groupId] || {};
  const patchGroup = (id, patch) => setGroupState((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  // Vote ids intentionally coincide across groups.
  const activeVote = { id: "vote-1", status, candidates: ["g1", "g2"] };

  return (
    <>
      <div role="status">{selectedAction}</div>
      <nav aria-label="Main navigation" data-fixture-nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-700 bg-neutral-900 md:hidden">
        <div className="px-3 py-2"><button type="button" className="w-full rounded-xl py-2 text-xs">Library</button></div>
      </nav>
      <nav aria-label="Fixture controls">
        {["voting", "other", "detail"].map((name) => (
          <button key={name} type="button" data-screen={name} onClick={() => setScreen(name)}>{name}</button>
        ))}
        {["collecting", "open", "closed"].map((name) => (
          <button key={name} type="button" data-status={name} onClick={() => setStatus(name)}>{name}</button>
        ))}
        {["group-a", "group-b"].map((id) => (
          <button key={id} type="button" data-group={id} onClick={() => setGroupId(id)}>{id}</button>
        ))}
        <input data-outside aria-label="Outside field" />
      </nav>
      <Modal
        open={dialogOpen}
        title="Add new game"
        onClose={() => setDialogOpen(false)}
        restoreFocus={restoreQuickActionsFocus}
      >
        <input aria-label="Game title" />
      </Modal>
      {screen === "voting" && (
        <VotingPanel
          user={user}
          currentGroupId={groupId}
          groupSettings={{}}
          groupGames={groupGames}
          members={[]}
          activeVote={activeVote}
          mySubmissionGameId={submission}
          myBallot={ballot}
          results={[]}
          poolActiveIds={poolActiveIds}
          submittedGameIds={submittedGameIds}
          onSubmitGame={async (gameId) => {
            calls.push(["submit", groupId, gameId]);
            patchGroup(groupId, { submission: { gameId, exists: true } });
          }}
          onCastVote={async (gameId) => {
            calls.push(["vote", groupId, gameId]);
            patchGroup(groupId, { ballot: { gameId } });
          }}
        />
      )}
      {screen !== "detail" && (
        <ConnectedExpandableFab
          onAddGame={() => setDialogOpen(true)}
          onSettings={() => setSelectedAction("Settings")}
          onProfile={() => setSelectedAction("Profile")}
        />
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
