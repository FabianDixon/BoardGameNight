export default function QuickActionIcon({ kind, disabled, label, small = false }) {
  const size = small ? "h-3 w-3" : "h-6 w-6";
  if (kind === "vote") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`${size} ${disabled ? "stroke-green-700" : "stroke-green-400"}`}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    );
  }
  const changing = label === "Change Submission";
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${size} ${disabled ? "stroke-neutral-500" : "stroke-blue-300"}`}>
      {changing ? (
        <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
      ) : (
        <path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" />
      )}
    </svg>
  );
}
