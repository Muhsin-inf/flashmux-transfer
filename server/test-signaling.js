import WebSocket from 'ws';

async function testSignaling() {
  const wsUrl = 'ws://127.0.0.1:3000';
  console.log('Connecting Peer 1 and Peer 2 to', wsUrl);

  const ws1 = new WebSocket(wsUrl);
  const ws2 = new WebSocket(wsUrl);

  await Promise.all([
    new Promise((resolve, reject) => {
      ws1.on('open', resolve);
      ws1.on('error', reject);
    }),
    new Promise((resolve, reject) => {
      ws2.on('open', resolve);
      ws2.on('error', reject);
    }),
  ]);

  console.log('Both peers connected to WebSocket');

  let peer1ReceivedList = false;
  let peer2ReceivedOffer = false;
  let peer1ReceivedResponse = false;

  const waitOffer = new Promise((resolve) => {
    ws2.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('[Peer 2 Received]', msg.type);
      if (msg.type === 'FILE_OFFER') {
        peer2ReceivedOffer = true;
        // Respond accepted
        ws2.send(
          JSON.stringify({
            type: 'FILE_RESPONSE',
            transferId: msg.transferId,
            to: msg.from,
            accepted: true,
          })
        );
        resolve();
      }
    });
  });

  const waitResponse = new Promise((resolve) => {
    ws1.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('[Peer 1 Received]', msg.type);
      if (msg.type === 'PEER_LIST') {
        peer1ReceivedList = true;
      }
      if (msg.type === 'FILE_RESPONSE') {
        peer1ReceivedResponse = true;
        resolve();
      }
    });
  });

  // Register Peer 1
  ws1.send(
    JSON.stringify({
      type: 'REGISTER',
      peerId: 'peer_test_1',
      clientName: 'ThinkPad Test',
      deviceType: 'desktop',
    })
  );

  // Register Peer 2
  ws2.send(
    JSON.stringify({
      type: 'REGISTER',
      peerId: 'peer_test_2',
      clientName: 'Mobile Test',
      deviceType: 'mobile',
    })
  );

  // Give 100ms for registration broadcast
  await new Promise((r) => setTimeout(r, 100));

  // Send FILE_OFFER from Peer 1 to Peer 2
  ws1.send(
    JSON.stringify({
      type: 'FILE_OFFER',
      transferId: 'tx_unit_test',
      from: 'peer_test_1',
      to: 'peer_test_2',
      metadata: {
        fileName: 'test.bin',
        fileSize: 1048576,
        chunkSize: 65536,
        totalChunks: 16,
      },
    })
  );

  await Promise.all([waitOffer, waitResponse]);

  ws1.close();
  ws2.close();

  if (peer1ReceivedList && peer2ReceivedOffer && peer1ReceivedResponse) {
    console.log('SUCCESS: Signaling protocol test passed completely!');
    process.exit(0);
  } else {
    console.error('FAILURE: Incomplete signaling test', {
      peer1ReceivedList,
      peer2ReceivedOffer,
      peer1ReceivedResponse,
    });
    process.exit(1);
  }
}

testSignaling().catch((err) => {
  console.error(err);
  process.exit(1);
});
