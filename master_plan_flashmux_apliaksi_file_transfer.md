# Master Plan & Spesifikasi Teknis: Local WebRTC P2P File Transfer

Dokumen ini merupakan cetak biru (*blueprint*) arsitektur, spesifikasi protokol, struktur kode, dan standar pengembangan lengkap untuk proyek **Local P2P File Transfer (FlashMux)**. Dokumen ini telah dikoreksi dan disempurnakan dari rancangan sebelumnya agar siap digunakan langsung oleh pengembang maupun *AI Coding Agent* sebagai acuan tunggal (*single source of truth*).

## 1. Ikhtisar Sistem & Tujuan Proyek

**Local P2P File Transfer (FlashMux)** adalah aplikasi web lintas platform (*Windows, macOS, Linux, Android, iOS*) untuk mentransfer file berukuran besar (ratusan MB hingga beberapa GB) secara langsung antarperangkat (*Peer-to-Peer*) di dalam satu jaringan lokal (Wi-Fi Router atau Hotspot HP) tanpa melalui penyimpanan *cloud* dan tanpa memerlukan koneksi internet aktif.

### Prinsip Desain Utama

* **Zero Cloud Storage:** Server *backend* murni bertindak sebagai *Signaling Server* (perantara pertukaran metadata koneksi, SDP, dan ICE Candidates). Server tidak pernah menerima, memproses, atau menyimpan potongan file pengguna.

* **Cross-Platform Tanpa Instalasi:** Berjalan langsung melalui peramban modern (*Chrome, Safari, Firefox, Edge*) di desktop maupun perangkat *mobile* dengan dukungan *Progressive Web App* (PWA) dan desain Anti-UI-Slop yang bersih, responsif, dan hemat sumber daya.

* **Multi-File Batch & Folder Streaming (Tanpa Kompresi):** Mampu mentransfer sekumpulan file (foto, video, dokumen) sekaligus maupun struktur pohon direktori/folder lengkap tanpa perlu mengompresi ke zip/tar terlebih dahulu dengan menjaga metadata `relativePath` dan merekonstruksi folder di perangkat tujuan via `showDirectoryPicker` di desktop atau *blob streaming fallback* di *mobile*.

* **Multi-Device Broadcast:** Memungkinkan pengirim memilih satu atau banyak perangkat sekaligus dari daftar peer aktif di jaringan lokal untuk mentransfer file secara simultan.

* **Multi-Channel Parallel Streaming (IDM-Style Segment Distribution):** Membagi file menjadi 4 segmen independen untuk 4 kanal paralel `RTCDataChannel` dalam satu koneksi `RTCPeerConnection` dengan mekanisme *dynamic work-stealing* dan *backpressure control* (`bufferedamountlow`), sehingga kanal yang lebih cepat tidak terhenti menunggu kanal lain.

* **Siklus Hidup Transfer Berkelanjutan (*Continuous Transfer*):** Penerima dapat menerima tawaran transfer baru kapan saja meskipun belum menutup modal hasil transfer sebelumnya; sesi lama otomatis dibersihkan dan digantikan oleh transfer baru secara mulus.

* **Memory-Safe Disk Streaming:** Memotong file di sisi pengirim menggunakan `File.slice()` (64 KB per *chunk*) dan menulisnya secara bertahap di sisi penerima (menggunakan *File System Access API* di desktop atau *blob chunking fallback* di perangkat *mobile*) agar penggunaan RAM tetap rendah dan mencegah *Out of Memory* (OOM).

* **Kompatibilitas Jaringan Lokal (`HTTP` Non-Secure Context):** Menggunakan *incremental hashing* berbasis `spark-md5` per *chunk* karena `window.crypto.subtle` diblokir oleh peramban ketika diakses melalui IP lokal non-HTTPS (`http://192.168.x.x:5173`).

## 2. Koreksi Teknis Penting atas Rancangan Awal

Bagian ini merangkum perbaikan arsitektur yang wajib dipatuhi agar aplikasi tidak mengalami kegagalan saat diimplementasikan:

| Komponen / Masalah | Kesalahan pada Rancangan Awal | Perbaikan pada Master Plan Ini | 
| ----- | ----- | ----- | 
| **Akses Port Monorepo (Vite vs Express)** | Menginstruksikan pengguna membuka `http://192.168.1.10:3000` (port *backend*) padahal UI React berjalan di Vite (`5173`). | Saat *development*, pengguna mengakses **`http://<IP_LOKAL>:5173`**, dan React terhubung ke WebSocket secara dinamis di `ws://${window.location.hostname}:3000`. Saat *production*, Express menyajikan hasil `vite build` di port `3000`. | 
| **Siklus Hidup Koneksi WebSocket** | Memutus koneksi WebSocket segera setelah jalur WebRTC terbuka, yang memicu event `close` di server dan menghapus perangkat dari daftar *peer* aktif. | Koneksi WebSocket **tetap dipertahankan dalam mode pasif (*idle*)** selama pengguna berada di halaman untuk menjaga daftar perangkat aktif (*presence*), mendukung *trickle ICE*, dan mengizinkan pengiriman file berikutnya. | 
| **Konsistensi Pesan Signaling JSON** | Spesifikasi dokumentasi menulis tipe pesan `JOIN` dan `FILE_OFFER`, tetapi kode `server.js` hanya membaca `REGISTER` dan `SIGNAL`. | Menyatukan protokol signaling menjadi skema pesan terstandar: `REGISTER`, `PEER_LIST`, `FILE_OFFER`, `FILE_RESPONSE`, `SIGNAL`, dan `TRANSFER_CANCEL`. | 
| **Header Biner & Backpressure WebRTC** | Kode awal mengirim *chunk* tanpa kendali *buffer* dan komentar kode hanya menyebutkan header 4-byte (berbeda dari spesifikasi 12-byte). | Menerapkan header biner **12-byte** secara konsisten serta wajib memeriksa `dc.bufferedAmount` dan menunggu event `bufferedamountlow` sebelum mengirim *chunk* berikutnya. | 
| **API Penyimpanan & Hash di Mobile HTTP** | Mengasumsikan `FileSystem Access API` dan `crypto.subtle` berjalan di semua peramban HP via HTTP IP lokal. | Menyediakan *fallback* penyimpanan *stream* untuk Android/iOS (yang belum mendukung `showSaveFilePicker`) dan menggunakan *incremental hash* per *chunk* tanpa bergantung pada `crypto.subtle` (yang tidak tersedia di HTTP IP lokal) atau pembacaan file utuh ke RAM. | 

## 3. Tech Stack & Arsitektur Monorepo

Proyek menggunakan struktur **Monorepo** yang memisahkan tanggung jawab antara *Signaling Server* dan *Web Client*:

* **Backend (`/server`):**

  * **Runtime & Framework:** Node.js (v20+ / v24+ dengan fitur `--watch`) & Express.js.

  * **WebSocket Engine:** `ws` (pustaka WebSocket ringan untuk pertukaran pesan signaling).

  * **Utilities:** `cors`, `dotenv`.

* **Frontend (`/client`):**

  * **Framework & Bundler:** React.js (v18+) dengan Vite (`vite --host`).

  * **UI & Styling:** Tailwind CSS / CSS Modular & `lucide-react` untuk ikonografi.

  * **Web APIs & Libraries:** Native `RTCPeerConnection`, `RTCDataChannel`, `File.slice()`, `Streams API`, serta `hash-wasm` (atau `spark-md5`) untuk kalkulasi *checksum* secara *streaming* per *chunk*.

### Alur Komunikasi Jaringan

1. **Inisialisasi & Penemuan Perangkat (*Discovery*):**

   * Laptop dan HP terhubung ke jaringan Wi-Fi yang sama (atau salah satu perangkat mengaktifkan *Hotspot* lokal).

   * Perangkat membuka aplikasi web di `http://<IP_LOKAL_SERVER>:5173` (mode *dev*) atau `http://<IP_LOKAL_SERVER>:3000` (mode *production*).

   * Client membuka koneksi WebSocket ke `ws://<IP_LOKAL_SERVER>:3000` dan mengirimkan paket `REGISTER` berisi identitas perangkat.

   * Server mem-broadcast daftar `PEER_LIST` terbaru ke seluruh perangkat aktif yang berada di jaringan lokal.

2. **Negosiasi Transfer File (*File Offer & Approval*):**

   * Pengirim memilih file melalui *DropZone* dan memilih kartu perangkat tujuan.

   * Pengirim mengirimkan pesan `FILE_OFFER` melalui WebSocket yang berisi metadata (`transferId`, `fileName`, `fileSize`, `fileType`, `chunkSize`, `totalChunks`).

   * Penerima menampilkan dialog konfirmasi. Jika disetujui, penerima membalas dengan pesan `FILE_RESPONSE` (`accepted: true`) dan menyiapkan *stream* penyimpanan lokal.

3. **WebRTC Handshake & Pembukaan Multi-Channel:**

   * Pengirim membuat instance `RTCPeerConnection` (dengan `iceServers: []` agar murni menggunakan kandidat IP *host* lokal tanpa ketergantungan internet).

   * Pengirim membuka 4 kanal paralel `RTCDataChannel` (`dc_0`, `dc_1`, `dc_2`, `dc_3`) dengan `binaryType = 'arraybuffer'`, lalu mengirim SDP `offer` dan `icecandidate` melalui pesan `SIGNAL` di WebSocket.

   * Penerima merespons dengan SDP `answer` dan `icecandidate` hingga keempat kanal berstatus `open`.

4. **Parallel Chunk Streaming & Flow Control (IDM-Style):**

   * File dibagi menjadi unit *chunk* berukuran **64 KB (`65536` byte)** dengan indeks `0` hingga `totalChunks - 1`.

   * Pengirim mendistribusikan pengiriman *chunk* secara paralel di keempat `RTCDataChannel` menggunakan mekanisme *pull batch* (penerima meminta rentang indeks *chunk* per kanal) atau *round-robin dispatcher* yang dikendalikan oleh *backpressure* (`bufferedAmount <= 1048576` byte / 1 MB per kanal).

   * Setiap paket biner diawali **12-byte Header** (`chunkIndex`, `channelId`, `payloadSize`) diikuti data biner *chunk*.

   * Selama pengiriman, pengirim dan penerima memperbarui nilai *incremental hash* untuk setiap *chunk* secara berurutan.

5. **Rekonstruksi File & Verifikasi Integritas:**

   * Penerima membaca 12-byte header dari setiap paket yang tiba, menempatkan *chunk* sesuai urutan `chunkIndex` menggunakan *Reorder Buffer Window* (atau menulis langsung ke posisi byte `chunkIndex * chunkSize` jika menggunakan `FileSystemWritableFileStream`), lalu segera membebaskan memori RAM.

   * Setelah seluruh *chunk* diterima, pengirim mengirimkan pesan kontrol `TRANSFER_COMPLETE` berisi nilai `fileHash` akhir melalui kanal data/WebSocket, dan penerima membandingkannya dengan hasil *hash* lokal.

## 4. Struktur Direktori Proyek (Modular MVC & Services)

```
local-p2p-transfer/
├── .gitignore                        # Aturan pengabaian file Git untuk seluruh monorepo
├── README.md                         # Dokumentasi instalasi dan penggunaan cepat
├── CONTRIBUTING.md                   # Standar kerja tim, Git workflow, dan konvensi kode
├── master_plan_flashmux_apliaksi_file_transfer.md # Dokumen spesifikasi teknis dan arsitektur utama
│
├── server/                           # BACKEND: Node.js + Express + WebSocket Signaling
│   ├── src/
│   │   ├── config/
│   │   │   └── env.js                # Konfigurasi PORT, CORS origin, dan interval heartbeat
│   │   ├── controllers/
│   │   │   ├── signalingController.js # Penanganan event WebSocket (REGISTER, OFFER, SIGNAL)
│   │   │   └── healthController.js   # Endpoint HTTP cek status server & info IP lokal
│   │   ├── services/
│   │   │   └── peerRegistry.js       # Manajemen state Map daftar peer aktif & subnet filter
│   │   ├── routes/
│   │   │   └── apiRoutes.js          # Endpoint REST ringan (/api/health, /api/network-info)
│   │   ├── utils/
│   │   │   └── networkUtils.js       # Deteksi otomatis alamat IPv4 LAN komputer server
│   │   ├── app.js                    # Express + WebSocket HTTP Server setup
│   │   └── index.js                  # Server launcher
│   ├── test-signaling.js             # Automated test script untuk verifikasi protokol WebSocket
│   ├── .env.example                  # Template variabel environment backend
│   ├── .env.local                    # Konfigurasi lokal backend (diabaikan oleh Git)
│   └── package.json
│
└── client/                           # FRONTEND: React + Vite + WebRTC Engine
    ├── public/
    │   ├── logo.png                  # Logo resmi aplikasi FlashMux
    │   ├── favicon.svg               # Fallback icon SVG
    │   └── manifest.json             # Konfigurasi PWA untuk instalasi di layar utama HP
    ├── src/
    │   ├── assets/                   # Ikon statis dan ilustrasi UI
    │   ├── components/
    │   │   ├── Header.jsx            # Header aplikasi dengan logo resmi, info IP & status
    │   │   ├── DeviceList.jsx        # Grid perangkat aktif dengan seleksi multi-peer broadcast
    │   │   ├── DropZone.jsx          # Area multi-file & folder dispatch dengan ringkasan kategori
    │   │   ├── TransferModal.jsx     # Pop-up konfirmasi terima/tolak file dengan folder picker
    │   │   └── TransferProgress.jsx  # Telemetri 4 kanal IDM, kecepatan, waktu total, & progress bar
    │   ├── hooks/
    │   │   ├── useSignaling.js       # Custom hook koneksi WebSocket & daftar peer
    │   │   └── useP2PTransfer.js     # State machine WebRTC transfer & dukungan transfer berulang
    │   ├── services/
    │   │   ├── signalingClient.js    # Kelas manajemen koneksi WebSocket & auto-reconnect
    │   │   ├── webrtcEngine.js       # Engine 4x paralel RTCDataChannel dengan IDM segment stream
    │   │   ├── fileChunker.js        # Logika File.slice(), antrean chunk, & backpressure
    │   │   └── fileWriter.js         # Abstraksi penulisan stream ke disk (Desktop & Mobile)
    │   ├── utils/
    │   │   ├── binaryPacket.js       # Encoder & decoder header biner 12-byte (ArrayBuffer)
    │   │   ├── fileScanner.js        # Pemindai folder rekursif & ekstraksi path relatif tanpa zip
    │   │   ├── hashCalculator.js     # Kalkulasi checksum incremental MD5 per chunk
    │   │   └── formatters.js         # Formatter ukuran byte, kecepatan, ETA, & total waktu
    │   ├── App.jsx                   # Komponen utama dengan auto-hide dispatch saat menerima
    │   ├── main.jsx                  # Titik masuk aplikasi React
    │   └── index.css                 # Styling global Anti-UI-Slop & mobile responsive
    ├── .env.example                  # Template variabel environment frontend
    ├── .env.local                    # Konfigurasi lokal frontend (diabaikan oleh Git)
    ├── vite.config.js                # Konfigurasi Vite dengan `server: { host: true, port: 5173 }`
    └── package.json

```

## 5. Spesifikasi Protokol Komunikasi & Struktur Paket Data

### A. Protokol Signaling WebSocket (Format JSON)

Seluruh pesan yang dikirim melalui WebSocket wajib berbentuk JSON dan memiliki properti `type`:

#### 1. Registrasi Perangkat (`Client -> Server`)

```
{
  "type": "REGISTER",
  "peerId": "peer_9f8a7b6c",
  "clientName": "ThinkPad-Muhsin",
  "deviceType": "desktop"
}

```

#### 2. Pembaruan Daftar Perangkat (`Server -> All Clients`)

```
{
  "type": "PEER_LIST",
  "peers": [
    {
      "peerId": "peer_9f8a7b6c",
      "clientName": "ThinkPad-Muhsin",
      "deviceType": "desktop"
    },
    {
      "peerId": "peer_1d2e3f4g",
      "clientName": "Android-Muhsin",
      "deviceType": "mobile"
    }
  ]
}

```

#### 3. Penawaran File & Folder Batch (`Sender -> Server -> Receiver`)

```json
{
  "type": "FILE_OFFER",
  "transferId": "tx_20261021_001",
  "from": "peer_9f8a7b6c",
  "to": "peer_1d2e3f4g",
  "metadata": {
    "transferId": "tx_20261021_001",
    "totalFiles": 2,
    "totalBytes": 125829120,
    "isFolder": true,
    "files": [
      {
        "fileIndex": 0,
        "fileName": "document.pdf",
        "relativePath": "Project/document.pdf",
        "fileSize": 5242880,
        "fileType": "application/pdf",
        "chunkSize": 65536,
        "totalChunks": 80
      },
      {
        "fileIndex": 1,
        "fileName": "demo.mp4",
        "relativePath": "Project/demo.mp4",
        "fileSize": 120586240,
        "fileType": "video/mp4",
        "chunkSize": 65536,
        "totalChunks": 1840
      }
    ]
  }
}
```

#### 4. Konfirmasi Penerima (`Receiver -> Server -> Sender`)

```json
{
  "type": "FILE_RESPONSE",
  "transferId": "tx_20261021_001",
  "from": "peer_1d2e3f4g",
  "to": "peer_9f8a7b6c",
  "accepted": true,
  "reason": null
}
```

#### 5. Pertukaran Sinyal WebRTC (`Peer <-> Server <-> Peer`)

```json
{
  "type": "SIGNAL",
  "transferId": "tx_20261021_001",
  "from": "peer_9f8a7b6c",
  "to": "peer_1d2e3f4g",
  "signalData": {
    "sdp": { "type": "offer", "sdp": "v=0..." },
    "candidate": null
  }
}
```

#### 6. Pembatalan Transfer (`Peer -> Server -> Peer`)

```json
{
  "type": "TRANSFER_CANCEL",
  "transferId": "tx_20261021_001",
  "from": "peer_9f8a7b6c",
  "to": "peer_1d2e3f4g",
  "reason": "Transfer cancelled by user"
}
```

### B. Protokol Paket Biner `RTCDataChannel` (Header 12-Byte)

Setiap pengiriman potongan file melalui `RTCDataChannel` dikemas dalam satu `ArrayBuffer` berukuran maksimal `65548` byte (`12` byte header + `65536` byte payload) dengan susunan *Little-Endian*:

| Offset Byte | Tipe Data | Nama Field | Deskripsi | 
| ----- | ----- | ----- | ----- | 
| **Byte 0 – 3** | `Uint32` | `chunkIndex` | Nomor urut *chunk* (`0` s.d. `totalChunks - 1`) untuk penyusunan ulang. | 
| **Byte 4 – 7** | `Uint32` | `channelId` | Indeks kanal pengirim (`0`, `1`, `2`, atau `3`) untuk pemantauan kecepatan per kanal. | 
| **Byte 8 – 11** | `Uint32` | `payloadSize` | Ukuran byte aktual dari data biner di dalam paket ini (maksimal `65536`). | 
| **Byte 12 – Akhir** | `Uint8Array` | `payloadData` | Data biner mentah hasil potongan `File.slice()`. | 

## 6. Implementasi Kode Acuan (Core Blueprint)

### A. Encoder & Decoder Paket Biner (`client/src/utils/binaryPacket.js`)

```
export const HEADER_SIZE = 12;

export function encodeChunkPacket(chunkIndex, channelId, payloadBuffer) {
  const payloadBytes = new Uint8Array(payloadBuffer);
  const packet = new ArrayBuffer(HEADER_SIZE + payloadBytes.byteLength);
  const view = new DataView(packet);

  // Gunakan Little-Endian (true) secara konsisten di pengirim dan penerima
  view.setUint32(0, chunkIndex, true);
  view.setUint32(4, channelId, true);
  view.setUint32(8, payloadBytes.byteLength, true);

  new Uint8Array(packet, HEADER_SIZE).set(payloadBytes);
  return packet;
}

export function decodeChunkPacket(packetBuffer) {
  const view = new DataView(packetBuffer);
  const chunkIndex = view.getUint32(0, true);
  const channelId = view.getUint32(4, true);
  const payloadSize = view.getUint32(8, true);
  const payload = packetBuffer.slice(HEADER_SIZE, HEADER_SIZE + payloadSize);

  return { chunkIndex, channelId, payloadSize, payload };
}

```

### B. Backend Signaling Server (`server/src/app.js`)

```
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Penyimpanan state peer aktif di memori (peerId -> { ws, clientName, deviceType, ip })
const clients = new Map();

function getLocalIPv4() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function broadcastPeerList() {
  const peers = Array.from(clients.entries()).map(([peerId, info]) => ({
    peerId,
    clientName: info.clientName,
    deviceType: info.deviceType,
  }));

  const payload = JSON.stringify({ type: 'PEER_LIST', peers });
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  });
}

function forwardToTarget(targetPeerId, payloadObj) {
  const targetClient = clients.get(targetPeerId);
  if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
    targetClient.ws.send(JSON.stringify(payloadObj));
  }
}

wss.on('connection', (ws, req) => {
  let registeredPeerId = null;
  const clientIp = req.socket.remoteAddress;

  ws.on('message', (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage);

      switch (data.type) {
        case 'REGISTER':
          registeredPeerId = data.peerId;
          clients.set(registeredPeerId, {
            ws,
            clientName: data.clientName || `Device-${registeredPeerId.slice(0, 4)}`,
            deviceType: data.deviceType || 'desktop',
            ip: clientIp,
          });
          broadcastPeerList();
          break;

        case 'FILE_OFFER':
        case 'FILE_RESPONSE':
        case 'SIGNAL':
        case 'TRANSFER_CANCEL':
          if (data.to) {
            forwardToTarget(data.to, {
              ...data,
              from: registeredPeerId || data.from,
            });
          }
          break;

        default:
          break;
      }
    } catch (err) {
      console.error('Gagal memproses pesan signaling:', err.message);
    }
  });

  ws.on('close', () => {
    if (registeredPeerId && clients.has(registeredPeerId)) {
      clients.delete(registeredPeerId);
      broadcastPeerList();
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    localIp: getLocalIPv4(),
    activePeers: clients.size,
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIPv4();
  console.log(`Signaling Server aktif di ws://${localIp}:${PORT}`);
  console.log(`Jalankan React Vite client dengan 'npm run dev' (akses via http://${localIp}:5173)`);
});

```

### C. WebRTC Multi-Channel & Backpressure Engine (`client/src/services/webrtcEngine.js`)

```
import { encodeChunkPacket, decodeChunkPacket } from '../utils/binaryPacket';

const CHUNK_SIZE = 65536; // 64 KB per chunk
const MAX_BUFFER_AMOUNT = 1024 * 1024; // 1 MB batas atas buffer per DataChannel
const LOW_BUFFER_THRESHOLD = 256 * 1024; // 256 KB batas bawah pemicu bufferedamountlow

export class P2PTransferEngine {
  constructor({ targetPeerId, sendSignal, onChunkReceived, onProgress, onComplete }) {
    this.targetPeerId = targetPeerId;
    this.sendSignal = sendSignal;
    this.onChunkReceived = onChunkReceived;
    this.onProgress = onProgress;
    this.onComplete = onComplete;

    this.numChannels = 4;
    this.channels = [];
    this.pendingCandidates = [];

    this.pc = new RTCPeerConnection({
      iceServers: [], // Murni jaringan lokal (LAN/Hotspot) tanpa STUN eksternal
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'SIGNAL',
          to: this.targetPeerId,
          signalData: { candidate: event.candidate },
        });
      }
    };
  }

  async initAsSender(file) {
    this.file = file;
    this.totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    this.nextChunkIndex = 0;
    this.sentChunks = 0;
    this.openChannelsCount = 0;

    for (let i = 0; i < this.numChannels; i++) {
      const dc = this.pc.createDataChannel(`transfer_channel_${i}`, {
        ordered: true,
      });
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = LOW_BUFFER_THRESHOLD;

      dc.onopen = () => {
        this.openChannelsCount += 1;
        if (this.openChannelsCount === this.numChannels) {
          this.startParallelStreaming();
        }
      };

      this.channels.push(dc);
    }

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({
      type: 'SIGNAL',
      to: this.targetPeerId,
      signalData: { sdp: this.pc.localDescription },
    });
  }

  initAsReceiver() {
    this.pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer';
      const channelIdx = this.channels.length;
      this.channels.push(dc);

      dc.onmessage = (msgEvent) => {
        if (typeof msgEvent.data === 'string') {
          const control = JSON.parse(msgEvent.data);
          if (control.type === 'EOF' && this.onComplete) {
            this.onComplete(control);
          }
          return;
        }
        const packet = decodeChunkPacket(msgEvent.data);
        if (this.onChunkReceived) {
          this.onChunkReceived(packet, channelIdx);
        }
      };
    };
  }

  async handleSignal(signalData) {
    if (signalData.sdp) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      while (this.pendingCandidates.length > 0) {
        const candidate = this.pendingCandidates.shift();
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      if (this.pc.remoteDescription.type === 'offer') {
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.sendSignal({
          type: 'SIGNAL',
          to: this.targetPeerId,
          signalData: { sdp: this.pc.localDescription },
        });
      }
    } else if (signalData.candidate) {
      if (this.pc.remoteDescription) {
        await this.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      } else {
        this.pendingCandidates.push(signalData.candidate);
      }
    }
  }

  startParallelStreaming() {
    this.channels.forEach((dc, channelId) => {
      this.pumpChannel(dc, channelId);
    });
  }

  async pumpChannel(dc, channelId) {
    while (this.nextChunkIndex < this.totalChunks && dc.readyState === 'open') {
      if (dc.bufferedAmount > MAX_BUFFER_AMOUNT) {
        await new Promise((resolve) => {
          dc.onbufferedamountlow = () => {
            dc.onbufferedamountlow = null;
            resolve();
          };
        });
      }

      if (this.nextChunkIndex >= this.totalChunks) break;

      const currentChunk = this.nextChunkIndex;
      this.nextChunkIndex += 1;

      const start = currentChunk * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, this.file.size);
      const blobSlice = this.file.slice(start, end);
      const payloadBuffer = await blobSlice.arrayBuffer();

      const packet = encodeChunkPacket(currentChunk, channelId, payloadBuffer);
      dc.send(packet);

      this.sentChunks += 1;
      if (this.onProgress) {
        this.onProgress({
          sentChunks: this.sentChunks,
          totalChunks: this.totalChunks,
          channelId,
        });
      }
    }
  }

  close() {
    this.channels.forEach((dc) => dc.close());
    this.pc.close();
  }
}

```

### D. Penanganan Penyimpanan Lintas Perangkat (`client/src/services/fileWriter.js`)

Untuk memastikan transfer file berukuran besar tidak membebani RAM baik di PC maupun di HP:

1. **Strategi 1 — Desktop Chrome/Edge (`FileSystem Access API`):**

   * Saat penerima menekan tombol **"Terima File"**, panggil `window.showSaveFilePicker({ suggestedName: metadata.fileName })` langsung di dalam *event handler* klik pengguna (agar tidak diblokir oleh kebijakan *user gesture* peramban).

   * Tulis setiap *chunk* secara berurutan atau menggunakan posisi *offset* langsung ke disk:
     `await writableStream.write({ type: 'write', position: chunkIndex * chunkSize, data: payload })`.

2. **Strategi 2 — Mobile Browser Android/iOS & Firefox (`Reorder Window + Stream/Blob Fallback`):**

   * Karena `showSaveFilePicker` tidak tersedia di Safari iOS dan mayoritas peramban Android, gunakan *Sliding Reorder Map* di memori yang hanya menahan *chunk* yang datang lebih awal (*out-of-order*) hingga *chunk* urutan berikutnya tiba, lalu salurkan secara berurutan ke *Service Worker Download Stream* atau kumpulan `Blob` terpartisi untuk diunduh otomatis saat `sentChunks === totalChunks`.

## 7. Konfigurasi File Penting (`.gitignore`, `.env.example`, `vite.config.js`)

### A. Root `.gitignore`

```
# Dependencies
node_modules/
server/node_modules/
client/node_modules/

# Environment Variables (Wajib Diabaikan)
.env
.env.local
.env.*.local
server/.env
server/.env.local
client/.env
client/.env.local

# Build Outputs & Caches
dist/
build/
client/dist/
.vite/

# Logs & OS Files
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
Thumbs.db

```

### B. Template Environment Variables (`.env.example`)

* **`server/.env.example`:**

  ```
  PORT=3000
  CORS_ORIGIN=*
  
  ```

* **`client/.env.example`:**

  ```
  VITE_SIGNALING_PORT=3000
  VITE_DEFAULT_CHUNK_SIZE=65536
  VITE_PARALLEL_CHANNELS=4
  
  ```

  *(Catatan: Pada kode `signalingClient.js`, gunakan `const wsUrl = import.meta.env.VITE_WS_URL || \`ws://\${window.location.hostname}:${import.meta.env.VITE_SIGNALING_PORT || 3000}\`;`sehingga perangkat HP otomatis menghubungi IP lokal komputer server, bukan`localhost\` milik HP).*

### C. Konfigurasi Vite (`client/vite.config.js`)

```
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Wajib aktif agar bisa diakses oleh HP/perangkat lain via IP Wi-Fi lokal
    port: 5173,
  },
});

```

## 8. Peta Jalan Pengembangan (Development Roadmap & Status)

1. **Fase 1 — Fondasi Monorepo & Signaling Server (`[SELESAI]`):**
   * Inisialisasi folder `/server` dan `/client`, konfigurasi `.gitignore` dan `.env.example`.
   * Implementasi WebSocket server (`REGISTER`, `PEER_LIST`, `SIGNAL`) dan pengujian koneksi multi-perangkat (PC + HP) di satu jaringan Wi-Fi via `test-signaling.js`.

2. **Fase 2 — Negosiasi File & Multi-Peer Discovery (`[SELESAI]`):**
   * Pembuatan UI `DeviceList` dengan dukungan seleksi *multi-peer broadcast*, `DropZone`, dan `TransferModal`.
   * Implementasi alur `FILE_OFFER` -> `FILE_RESPONSE` -> pertukaran SDP & ICE Candidate hingga kanal WebRTC terbuka.

3. **Fase 3 — Chunking, Binary Header 12-Byte, & Backpressure (`[SELESAI]`):**
   * Implementasi pemotongan file `File.slice()` @ 64 KB, *encoder/decoder* header biner 12-byte Little-Endian, dan kontrol `bufferedamountlow` threshold 256 KB.
   * Integrasi penulisan file *streaming* (`FileSystem Access API` di desktop dengan *fallback* Blob download di *mobile*).

4. **Fase 4 — Optimasi Multi-Channel IDM-Style & Checksum Streaming (`[SELESAI]`):**
   * Pembukaan 4 `RTCDataChannel` paralel dengan partisi segmen independen (IDM-style) dan mekanisme *dynamic work-stealing* agar kanal cepat tidak terhambat menunggu kanal lambat.
   * Integrasi verifikasi *incremental hash* MD5 per *chunk* (`spark-md5`) dan telemetri langsung (kecepatan MB/s, sisa waktu ETA, dan total durasi transfer).

5. **Fase 5 — Fitur Lanjutan, Polesan UI/UX, & PWA (`[SELESAI]`):**
   * Dukungan transfer batch banyak file sekaligus (foto, video, dsb.).
   * Dukungan transfer struktur folder bersarang tanpa kompresi zip (`showDirectoryPicker` di desktop / streaming blob di HP via `fileScanner.js`).
   * Siklus hidup transfer berkelanjutan (*Continuous Transfer*): penerima dapat menerima file baru secara langsung tanpa perlu menutup popup/layar transfer sebelumnya.
   * Integrasi logo resmi aplikasi FlashMux (`/logo.png`) dan favicon/manifest PWA.
   * Optimasi mobile UX Anti-UI-Slop: auto-hide card dispatch saat menerima file dengan tombol pemicu "Kirim File" yang fleksibel.

## 9. Standar Kerja & Aturan Emas Pengembangan (Golden Rules)

1. **Pemisahan Tanggung Jawab Mutlak (*Strict Separation of Concerns*):**

   * Direktori `/server` **hanya** menangani koneksi WebSocket dan meneruskan pesan teks JSON signaling. **Dilarang keras** menambahkan *endpoint* unggah file (`multipart/form-data`) atau menyimpan *buffer* biner file di server.

   * Direktori `/client` menangani seluruh negosiasi P2P WebRTC, pemotongan *chunk*, kontrol *buffer*, perhitungan *hash*, dan penulisan ke penyimpanan perangkat.

2. **Keamanan Kredensial & Lingkungan:**

   * Jangan pernah melakukan *commit* file `.env` atau `.env.local` ke repositori Git. Setiap penambahan variabel konfigurasi baru wajib didokumentasikan menggunakan *placeholder* di dalam `.env.example`.

3. **Konvensi Branching & Pull Request:**

   * Dilarang melakukan *push* langsung ke branch `main` atau `development`.

   * Gunakan branch terpisah dengan penamaan *kebab-case*:

     * `feat/<nama-fitur>` untuk penambahan fitur baru (contoh: `feat/webrtc-multi-channel`).

     * `fix/<nama-bug>` untuk perbaikan bug (contoh: `fix/mobile-ws-hostname`).

     * `refactor/<nama-modul>` untuk restrukturisasi kode tanpa mengubah perilaku sistem.

     * `docs/<nama-dokumen>` untuk pembaruan dokumentasi.

4. **Format Pesan Commit (*Conventional Commits*):**

   * Gunakan format `<tipe>(<modul>): <deskripsi singkat dalam bahasa Indonesia>`, misalnya:

     * `feat(webrtc): implementasi 4x parallel datachannel dengan kontrol bufferedamountlow`

     * `fix(client): gunakan window.location.hostname agar websocket terbaca di perangkat mobile`

5. **Verifikasi Build Sebelum Pull Request:**

   * Pastikan aplikasi berhasil melewati `npm run build` di `/client` dan tidak menghasilkan *runtime error* di `/server` sebelum mengajukan *Pull Request* (PR).