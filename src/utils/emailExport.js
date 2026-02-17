// src/utils/emailExport.js
export function buildSessionMailto({ groupName, voteId }) {
  const subject = encodeURIComponent(
    `BoardGameNight – Session export (${groupName || "Group"} / ${voteId})`
  );

  const body = encodeURIComponent(
    [
      `Session export: ${voteId}`,
      groupName ? `Group: ${groupName}` : "",
      "",
      "The session JSON has been copied to your clipboard.",
      "Paste it into this email and send it.",
      "",
      "— BoardGameNight",
    ]
      .filter(Boolean)
      .join("\n")
  );

  return `mailto:?subject=${subject}&body=${body}`;
}

export async function copyJsonToClipboard(payload) {
  const json = JSON.stringify(payload, null, 2);
  await navigator.clipboard.writeText(json);
  return json.length;
}