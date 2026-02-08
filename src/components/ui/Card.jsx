// src/components/ui/Card.jsx
export function Card({ children, interactive, noPadding, ...props }) {
  return (
    <div
      {...props}
      className={[
        "bg-neutral-900 rounded-2xl shadow",
        interactive && "cursor-pointer hover:bg-neutral-800",
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
  return (
    <div className={`p-4 pt-0 ${className}`}>
      {children}
    </div>
  );
}