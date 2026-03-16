import Pusher from 'pusher';

// Khởi tạo Pusher Server
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { targetId, fromId, ...payload } = req.body;

  if (!targetId) {
    return res.status(400).json({ error: 'Missing targetId' });
  }

  try {
    // Phát tín hiệu đến một channel dành riêng cho người nhận (targetId)
    await pusher.trigger(`user-${targetId}`, 'signal-event', {
      fromId,
      ...payload
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Pusher error:', error);
    res.status(500).json({ error: 'Failed to send signal' });
  }
}