export async function sendMessage({ fromId, toId, text, timestamp, type, kind, data }) {
  const res = await fetch("/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromId,
      toId,
      message: text,
      timestamp,
      type: type || "message",
      kind: kind || "text",
      data: data || null,
    }),
  });

  if (!res.ok) {
    throw new Error(`Send failed: ${res.status}`);
  }
}

