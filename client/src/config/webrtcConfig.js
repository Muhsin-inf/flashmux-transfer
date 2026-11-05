export const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// 16KB is the recommended safe standard chunk size for WebRTC DataChannels across all browsers
export const CHUNK_SIZE = 16 * 1024;

export const SIGNALING_SERVER_URL =
  import.meta.env.VITE_SIGNALING_SERVER_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
    : 'ws://localhost:3000/ws');
