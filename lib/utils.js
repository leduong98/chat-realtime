// Generate a simple random username and tag (e.g. "fox#1234")
export function generateUsername() {
  const animals = ["fox", "cat", "dog", "panda", "owl", "lion", "tiger", "bear"];
  const name = animals[Math.floor(Math.random() * animals.length)];
  const tag = String(Math.floor(1000 + Math.random() * 9000));
  return `${name}#${tag}`;
}

export function parseChatAddress(address) {
  if (!address) return null;
  const trimmed = address.trim();
  if (trimmed.startsWith("chat://")) {
    return trimmed.replace("chat://", "");
  }
  return trimmed;
}

export function formatChatAddress(username) {
  if (!username) return "";
  return `chat://${username}`;
}

export function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

