import { peerRegistry } from '../services/peerRegistry.js';

/**
 * Controller handling WebSocket signaling messages for WebRTC P2P connection
 */
class SignalingController {
  handleConnection(ws, req) {
    let registeredPeerId = null;
    const clientIp = req.socket?.remoteAddress || 'unknown';

    ws.on('message', (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());

        switch (data.type) {
          case 'REGISTER': {
            if (!data.peerId) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'peerId is required' }));
              return;
            }

            registeredPeerId = data.peerId;
            peerRegistry.register(registeredPeerId, ws, {
              clientName: data.clientName,
              deviceType: data.deviceType,
              ip: clientIp
            });

            console.log(`[Signaling] Registered peer: ${registeredPeerId} (${data.clientName || 'Unknown'}) from ${clientIp}`);
            peerRegistry.broadcastPeerList();
            break;
          }

          case 'FILE_OFFER':
          case 'FILE_RESPONSE':
          case 'SIGNAL':
          case 'TRANSFER_CANCEL': {
            const targetPeerId = data.to;
            if (!targetPeerId) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Target peer ID (to) is required' }));
              return;
            }

            const forwarded = peerRegistry.forward(targetPeerId, {
              ...data,
              from: registeredPeerId || data.from
            });

            if (!forwarded) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: `Target peer ${targetPeerId} is unavailable`,
                transferId: data.transferId
              }));
            }
            break;
          }

          default:
            console.warn(`[Signaling] Unrecognized message type: ${data.type}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: `Unknown type: ${data.type}` }));
            break;
        }
      } catch (err) {
        console.error('[Signaling] Failed to parse message:', err.message);
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Malformed JSON payload' }));
      }
    });

    ws.on('close', () => {
      if (registeredPeerId) {
        console.log(`[Signaling] Peer disconnected: ${registeredPeerId}`);
        peerRegistry.remove(registeredPeerId);
        peerRegistry.broadcastPeerList();
      }
    });

    ws.on('error', (err) => {
      console.error(`[Signaling] WebSocket error for peer ${registeredPeerId || 'unregistered'}:`, err.message);
    });
  }
}

export const signalingController = new SignalingController();
