import { peerRegistry } from '../services/peerRegistry.js';
import { getLocalIPv4 } from '../utils/networkUtils.js';

export const healthController = {
  getHealth: (req, res) => {
    res.json({
      status: 'ok',
      service: 'FlashMux Signaling Server',
      localIp: getLocalIPv4(),
      activePeers: peerRegistry.size,
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`
    });
  },

  getNetworkInfo: (req, res) => {
    res.json({
      localIp: getLocalIPv4(),
      activePeers: peerRegistry.getAll()
    });
  }
};
