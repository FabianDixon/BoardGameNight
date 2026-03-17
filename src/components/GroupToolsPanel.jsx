import SeatRandomizerTool from "./SeatRandomizerTool";

export default function GroupToolsPanel({ members }) {
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

      <SeatRandomizerTool members={members} />
    </div>
  );
}
