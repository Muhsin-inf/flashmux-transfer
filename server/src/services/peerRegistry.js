import { WebSocket } from 'ws';

/**
 * In-memory registry of active peers in the local network
 */
class PeerRegistry {
  constructor() {
    this.clients = new Map();
  }

  get size() {
    return this.clients.size;
  }

  register(peerId, ws, { clientName, deviceType, ip } = {}) {
    this.clients.set(peerId, {
      ws,
      clientName: clientName || `Device-${peerId.slice(0, 4)}`,
      deviceType: deviceType || 'desktop',
      ip: ip || 'unknown',
      registeredAt: Date.now()
    });
  }

  remove(peerId) {
    return this.clients.delete(peerId);
  }

  get(peerId) {
    return this.clients.get(peerId);
  }

  has(peerId) {
    return this.clients.has(peerId);
  }

  getAll() {
    return Array.from(this.clients.entries()).map(([peerId, info]) => ({
      peerId,
      clientName: info.clientName,
      deviceType: info.deviceType
    }));
  }

  broadcastPeerList() {
    const peers = this.getAll();
    const payload = JSON.stringify({
      type: 'PEER_LIST',
      peers
    });

    for (const [peerId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch (err) {
          console.error(`[PeerRegistry] Failed to send peer list to ${peerId}:`, err.message);
        }
      }
    }
  }

  forward(targetPeerId, payloadObj) {
    const target = this.clients.get(targetPeerId);
    if (target && target.ws.readyState === WebSocket.OPEN) {
      try {
        target.ws.send(JSON.stringify(payloadObj));
        return true;
      } catch (err) {
        console.error(`[PeerRegistry] Failed to forward to ${targetPeerId}:`, err.message);
        return false;
      }
    }
    return false;
  }

  getStats() {
    return {
      activePeers: this.clients.size,
      peers: this.getAll()
    };
  }
}

export const peerRegistry = new PeerRegistry();
