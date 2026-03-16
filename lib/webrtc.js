// Helper to create a WebRTC peer connection and data channel

const ICE_CONFIG = {
  iceServers: [
    // Public Google STUN server
    { urls: "stun:stun.l.google.com:19302" },
    // Public TURN servers for fallback
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export function createPeerConnection({ onDataChannel, onIceCandidate, onConnectionStateChange }) {
  const pc = new RTCPeerConnection(ICE_CONFIG);

  pc.onicecandidate = (event) => {
    if (event.candidate && onIceCandidate) {
      console.log("ICE candidate:", event.candidate.type, event.candidate.address);
      onIceCandidate(event.candidate);
    } else if (!event.candidate) {
      console.log("ICE gathering complete");
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log("ICE gathering state:", pc.iceGatheringState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", pc.iceConnectionState);
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

