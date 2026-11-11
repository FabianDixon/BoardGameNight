import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Modal } from "../../src/App";
import ExpandableFab from "../../src/components/ui/ExpandableFab";
import { restoreQuickActionsFocus } from "../../src/components/ui/quickActionsFocus";
import Fab from "../../src/components/ui/Fab";
import "../../src/index.css";

export function Fixture() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [selectedAction, setSelectedAction] = useState("");

  return (
    <>
      <div role="status">{selectedAction} Votes: {voteCount}</div>
      <Modal
        open={dialogOpen}
        title="Add new game"
        onClose={() => setDialogOpen(false)}
        restoreFocus={restoreQuickActionsFocus}
      >
        <input aria-label="Game title" />
      </Modal>
      <ExpandableFab
        onAddGame={() => setDialogOpen(true)}
        onSettings={() => setSelectedAction("Settings")}
        onProfile={() => setSelectedAction("Profile")}
      />
      <Fab show variant="pill" label="Vote" onClick={() => setVoteCount((count) => count + 1)}>
        Vote
      </Fab>
    </>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
