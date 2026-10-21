export const HEADER_SIZE = 12;

/**
 * Encodes a file chunk into an ArrayBuffer with a 12-byte little-endian header:
 * - Bytes 0..3: chunkIndex (Uint32)
 * - Bytes 4..7: channelId (Uint32)
 * - Bytes 8..11: payloadSize (Uint32)
 * - Bytes 12..end: binary payload data
 */
export function encodeChunkPacket(chunkIndex, channelId, payloadBuffer) {
  const payloadBytes = new Uint8Array(payloadBuffer);
  const packet = new ArrayBuffer(HEADER_SIZE + payloadBytes.byteLength);
  const view = new DataView(packet);

  view.setUint32(0, chunkIndex, true);
  view.setUint32(4, channelId, true);
  view.setUint32(8, payloadBytes.byteLength, true);

  new Uint8Array(packet, HEADER_SIZE).set(payloadBytes);
  return packet;
}

/**
 * Decodes a 12-byte header chunk packet
 */
export function decodeChunkPacket(packetBuffer) {
  const view = new DataView(packetBuffer);
  const chunkIndex = view.getUint32(0, true);
  const channelId = view.getUint32(4, true);
  const payloadSize = view.getUint32(8, true);
  const payload = packetBuffer.slice(HEADER_SIZE, HEADER_SIZE + payloadSize);

  return { chunkIndex, channelId, payloadSize, payload };
}
