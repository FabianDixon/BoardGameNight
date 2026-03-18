import { useState } from "react";
import SeatRandomizerTool from "./SeatRandomizerTool";
import TokenCountersTool from "./TokenCountersTool";

function ToolSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="ui-surface overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left border-b border-neutral-700/70 hover:bg-neutral-800 transition"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-white">{title}</span>
        <span className="text-sm text-neutral-400 shrink-0">{open ? "▾" : "▸"}</span>
      </button>

      {open && <div className="p-4 md:p-5">{children}</div>}
    </div>
  );
}

export default function GroupToolsPanel({
  currentGroupId,
  members,
  memberProfilesById,
  sessionParticipantIds,
  participantSummaryById,
}) {
  return (
    <div className="space-y-4">
      <div className="ui-surface p-5 md:p-6">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Tools</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Lightweight helpers for running game night.
          </p>
        </div>
      </div>

      <ToolSection title="Seat Randomizer" defaultOpen>
        <SeatRandomizerTool
          members={members}
          memberProfilesById={memberProfilesById}
          sessionParticipantIds={sessionParticipantIds}
          participantSummaryById={participantSummaryById}
        />
      </ToolSection>

      <ToolSection title="Token Counters" defaultOpen={false}>
        <TokenCountersTool currentGroupId={currentGroupId} />
      </ToolSection>
    </div>
  );
}
