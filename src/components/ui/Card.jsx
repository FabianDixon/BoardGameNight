// src/components/ui/Card.jsx
export function Card({ children, interactive, noPadding, className = "", ...props }) {
  return (
    <div
      {...props}
      className={[
        "ui-surface",
        "overflow-hidden flex flex-col min-w-0", // <-- crucial containment
        interactive && "cursor-pointer hover:bg-neutral-700/80 transition-colors",
        className,
        !noPadding && "p-4",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function CardBody({ children }) {
  return <div className="p-4 space-y-2">{children}</div>;
}

export function CardFooter({ children, className = "" }) {
  return <div className={`p-4 pt-0 ${className}`}>{children}</div>;
}