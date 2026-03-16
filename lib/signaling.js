import Pusher from 'pusher-js';

let pusherClient = null;
let channel = null;
let userId = null;
let listeners = [];

export function connectSignaling(user_id, options = {}) {
  if (typeof window === 'undefined') return null;

  userId = user_id;

  // Tránh việc khởi tạo lại Pusher nhiều lần
  if (!pusherClient) {
    // Tắt log khi lên Production
    Pusher.logToConsole = process.env.NODE_ENV !== 'production';

    pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    });
  }

  // Subscribe vào kênh riêng của user này
  const channelName = `user-${userId}`;
  channel = pusherClient.subscribe(channelName);

  // Lắng nghe các sự kiện (Offer, Answer, ICE candidates) gửi tới mình
  channel.bind('signal-event', (data) => {
    listeners.forEach((fn) => fn(data));
  });

  return { ready: true };
}

export function stopPolling() {
  if (pusherClient && userId) {
    pusherClient.unsubscribe(`user-${userId}`);
    pusherClient.disconnect();
    pusherClient = null;
    channel = null;
  }
}

export function onSignalMessage(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((fn) => fn !== callback);
  };
}

export async function sendSignal(message) {
  if (!userId) return;

  try {
    // Gọi API của Vercel để nó báo cho Pusher
    await fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromId: userId, ...message }),
    });
  } catch (err) {
    console.error('Failed to send signal via API', err);
  }
}