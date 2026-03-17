// Helper to create a WebRTC peer connection and data channel
// TURN relay giúp "lách firewall": khi P2P bị chặn, traffic đi qua TURN (thường port 443).

function getIceServers() {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // TURN từ env (Vercel: Settings → Environment Variables)
  const turnUri = typeof process !== "undefined" && process.env.NEXT_PUBLIC_TURN_URI;
  const turnUser = typeof process !== "undefined" && process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCred = typeof process !== "undefined" && process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUri) {
    servers.push({
      urls: turnUri,
      username: turnUser || undefined,
      credential: turnCred || undefined,
    });
  } else {
    // Relay công khai (free/free) - dùng khi không set env
    servers.push({
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "free",
      credential: "free",
    });
  }

  return servers;
}

export function createPeerConnection({ onDataChannel, onIceCandidate, onConnectionStateChange }) {
  const pc = new RTCPeerConnection({ iceServers: getIceServers() });

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

  // Wait for ICE gathering to complete before creating offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Wait for ICE gathering to complete
  if (pc.iceGatheringState === 'new') {
    await new Promise((resolve) => {
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          setTimeout(checkState, 100);
        }
      };
      checkState();
    });
  }

  return { offer, channel };
}

export async function handleOffer(pc, offer) {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  // Wait for ICE gathering to complete
  if (pc.iceGatheringState === 'new') {
    await new Promise((resolve) => {
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          setTimeout(checkState, 100);
        }
      };
      checkState();
    });
  }

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

