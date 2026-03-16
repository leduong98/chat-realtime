// Helper to create a WebRTC peer connection and data channel

const ICE_CONFIG = {
  iceServers: [
    // Public Google STUN server
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

export function createPeerConnection({ onDataChannel, onIceCandidate, onConnectionStateChange }) {
  const pc = new RTCPeerConnection(ICE_CONFIG);

  pc.onicecandidate = (event) => {
    if (event.candidate && onIceCandidate) {
      onIceCandidate(event.candidate);
    }
  };

  pc.ondatachannel = (event) => {
    if (onDataChannel) {
      onDataChannel(event.channel);
    }
  };

  pc.onconnectionstatechange = () => {
    if (onConnectionStateChange) {
      onConnectionStateChange(pc.connectionState);
    }
  };

  return pc;
}

export async function createOffer(pc, dataChannelLabel = "chat") {
  const channel = pc.createDataChannel(dataChannelLabel);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return { offer, channel };
}

export async function handleOffer(pc, offer) {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function handleAnswer(pc, answer) {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function addIceCandidate(pc, candidate) {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("Failed to add ICE candidate", err);
  }
}

