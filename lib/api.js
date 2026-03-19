export async function sendMessage({ fromId, toId, text, timestamp, type, kind, data, clientMessageId }) {
  const res = await fetch("/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toId,
      message: text,
      timestamp,
      type: type || "message",
      kind: kind || "text",
      data: data || null,
      clientMessageId: clientMessageId || null,
    }),
  });

  if (!res.ok) {
    throw new Error(`Send failed: ${res.status}`);
  }
}

