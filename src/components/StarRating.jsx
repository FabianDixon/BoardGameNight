// src/components/StarRating.jsx
export default function StarRating({
    value = 0,
    onChange,
    readOnly = false,
    size = 28,
  }) {
    const stars = [1, 2, 3, 4, 5];
  
    function setRating(next) {
      if (readOnly) return;
      onChange?.(next);
    }
  
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {stars.map((star) => {
          const full = value >= star;
          const half = value >= star - 0.5 && value < star;
          const gradId = `half-grad-${star}`;
  
          const starBoxStyle = {
            position: "relative",
            width: size,
            height: size,
          };
  
          const btnBaseStyle = {
            position: "absolute",
            top: 0,
            height: "100%",
            width: "50%",
            zIndex: 9999,
            display: "block",
            pointerEvents: "auto",
            background: "transparent",
            border: 0,
            padding: 0,
            margin: 0,
            cursor: readOnly ? "default" : "pointer",
            appearance: "none",
            WebkitAppearance: "none",
          };
  
          return (
            <div key={star} style={starBoxStyle}>
              <button
                type="button"
                aria-label={`Rate ${star - 0.5} stars`}
                disabled={readOnly}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setRating(star - 0.5);
                }}
                onClick={() => setRating(star - 0.5)}
                style={{ ...btnBaseStyle, left: 0 }}
              />
              <button
                type="button"
                aria-label={`Rate ${star} stars`}
                disabled={readOnly}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setRating(star);
                }}
                onClick={() => setRating(star)}
                style={{ ...btnBaseStyle, right: 0 }}
              />
  
              <svg
                viewBox="0 0 24 24"
                width={size}
                height={size}
                style={{ pointerEvents: "none", display: "block" }}
                fill={full ? "#facc15" : half ? `url(#${gradId})` : "#e5e7eb"}
              >
                <defs>
                  <linearGradient id={gradId}>
                    <stop offset="50%" stopColor="#facc15" />
                    <stop offset="50%" stopColor="#e5e7eb" />
                  </linearGradient>
                </defs>
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>
          );
        })}
      </div>
    );
  }