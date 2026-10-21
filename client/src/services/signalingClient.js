/**
 * WebSocket Signaling Client for FlashMux
 * Maintains persistent connection for peer presence, trickle ICE, and file offers.
 */
export class SignalingClient {
  constructor() {
    this.socket = null;
    this.peerId = null;
    this.clientName = null;
    this.deviceType = 'desktop';
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'
    this.lastPeerList = null;

    this.listeners = new Map();
    this.reconnectTimeout = null;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
  }

  getWsUrl() {
    const defaultPort = import.meta.env.VITE_SIGNALING_PORT || '3000';
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const host = (typeof window !== 'undefined' && window.location.host) || 'localhost:5173';
    const hostname = (typeof window !== 'undefined' && window.location.hostname) || 'localhost';

    if (import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }

    if (isHttps) {
      // In HTTPS context (LAN mobile testing), route through Vite's WSS proxy to avoid mixed content
      return `wss://${host}/ws`;
    }

    return `ws://${hostname}:${defaultPort}`;
  }

  connect(peerInfo = {}) {
    if (peerInfo.peerId) this.peerId = peerInfo.peerId;
    if (peerInfo.clientName) this.clientName = peerInfo.clientName;
    if (peerInfo.deviceType) this.deviceType = peerInfo.deviceType;

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.setStatus('connected');
      if (this.peerId) {
        this.register({
          peerId: this.peerId,
          clientName: this.clientName,
          deviceType: this.deviceType,
        });
      }
      if (this.lastPeerList) {
        const callbacks = this.listeners.get('PEER_LIST') || [];
        callbacks.forEach((cb) => cb(this.lastPeerList));
      }
      return;
    }

    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.setStatus('connecting');
    const url = this.getWsUrl();

    try {
      this.socket = new WebSocket(url);
    } catch (err) {
      console.error('[SignalingClient] Failed to instantiate WebSocket:', err.message);
      this.setStatus('disconnected');
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      console.log(`[SignalingClient] Connected to signaling server at ${url}`);
      this.setStatus('connected');
      this.reconnectAttempts = 0;

      // Register client presence
      if (this.peerId) {
        this.register({
          peerId: this.peerId,
          clientName: this.clientName,
          deviceType: this.deviceType,
        });
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (err) {
        console.error('[SignalingClient] Error parsing message:', err.message);
      }
    };

    this.socket.onclose = () => {
      console.warn('[SignalingClient] WebSocket connection closed');
      this.setStatus('disconnected');
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (err) => {
      console.error('[SignalingClient] WebSocket error:', err);
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.reconnectAttempts += 1;
    this.reconnectTimeout = setTimeout(() => {
      if (this.shouldReconnect) {
        console.log(`[SignalingClient] Reconnecting (attempt ${this.reconnectAttempts})...`);
        this.connect();
      }
    }, delay);
  }

  handleMessage(data) {
    const { type } = data;

    if (type === 'PEER_LIST') {
      this.lastPeerList = data;
    }

    const callbacks = this.listeners.get(type) || [];
    callbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[SignalingClient] Error in listener for ${type}:`, err);
      }
    });

    // Also notify wildcard listeners
    const allCallbacks = this.listeners.get('*') || [];
    allCallbacks.forEach((cb) => cb(data));
  }

  setStatus(newStatus) {
    this.status = newStatus;
    const callbacks = this.listeners.get('statusChange') || [];
    callbacks.forEach((cb) => cb(newStatus));
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // If subscribing to statusChange, immediately inform of current status
    if (event === 'statusChange') {
      try {
        callback(this.status);
      } catch (err) {
        console.error('[SignalingClient] Error in immediate status callback:', err);
      }
    }

    // If subscribing to PEER_LIST and we have cached data, immediately inform
    if (event === 'PEER_LIST' && this.lastPeerList) {
      try {
        callback(this.lastPeerList);
      } catch (err) {
        console.error('[SignalingClient] Error in immediate peer list callback:', err);
      }
    }

    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event).filter((cb) => cb !== callback);
    this.listeners.set(event, list);
  }

  send(payload) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
      return true;
    }
    console.warn('[SignalingClient] Cannot send message; socket not open');
    return false;
  }

  register({ peerId, clientName, deviceType }) {
    this.peerId = peerId;
    this.clientName = clientName;
    this.deviceType = deviceType;
    return this.send({
      type: 'REGISTER',
      peerId,
      clientName,
      deviceType,
    });
  }

  sendOffer({ to, transferId, metadata }) {
    return this.send({
      type: 'FILE_OFFER',
      transferId,
      from: this.peerId,
      to,
      metadata,
    });
  }

  sendResponse({ to, transferId, accepted }) {
    return this.send({
      type: 'FILE_RESPONSE',
      transferId,
      from: this.peerId,
      to,
      accepted,
    });
  }

  sendSignal({ to, transferId, signalData }) {
    return this.send({
      type: 'SIGNAL',
      transferId,
      from: this.peerId,
      to,
      signalData,
    });
  }

  sendCancel({ to, transferId, reason }) {
    return this.send({
      type: 'TRANSFER_CANCEL',
      transferId,
      from: this.peerId,
      to,
      reason: reason || 'Transfer cancelled by user',
    });
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }
}

export const signalingClient = new SignalingClient();
