import os from 'os';

/**
 * Returns the non-internal IPv4 address of the local network interface.
 * Falls back to '127.0.0.1' if no external IPv4 interface is found.
 */
export function getLocalIPv4() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
