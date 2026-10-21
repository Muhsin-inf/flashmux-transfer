# Master Plan & Spesifikasi Teknis: FlashMux (Local WebRTC & Optical QR P2P File Transfer)

Dokumen ini merupakan cetak biru (*blueprint*) arsitektur, spesifikasi protokol, struktur kode, dan standar pengembangan lengkap untuk proyek **FlashMux** (*Local P2P File Transfer*). Dokumen ini telah dikoreksi dan disempurnakan dari rancangan sebelumnya—serta dilengkapi spesifikasi **Protokol Transfer Optik via Kamera (Animated QR Stream)**—agar siap digunakan langsung oleh pengembang maupun *AI Coding Agent* sebagai acuan tunggal (*single source of truth*).

## 1. Ikhtisar Sistem & Tujuan Proyek

**FlashMux** adalah aplikasi web lintas platform (*Windows, macOS, Linux, Android, iOS*) untuk mentransfer file secara langsung antarperangkat (*Peer-to-Peer*) menggunakan dua mode transmisi komplementer:
1. **Mode Jaringan Lokal (WebRTC Multi-Channel):** Mentransfer file berukuran besar (ratusan MB hingga beberapa GB) berkecepatan tinggi melalui Wi-Fi Router atau Hotspot HP tanpa melalui penyimpanan *cloud*.
2. **Mode Optik Kamera / Air-Gapped (Animated QR Stream):** Mentransfer file atau data secara optik dari layar pengirim (yang menampilkan rentetan QR Code berkecepatan tinggi) ke kamera penerima tanpa memerlukan koneksi Wi-Fi, Bluetooth, maupun jaringan sama sekali.

### Prinsip Desain Utama

* **Zero Cloud Storage:** Server *backend* murni bertindak sebagai *Signaling Server* (perantara pertukaran metadata koneksi, SDP, dan ICE Candidates). Server tidak pernah menerima, memproses, atau menyimpan potongan file pengguna.
* **Cross-Platform Tanpa Instalasi:** Berjalan langsung melalui peramban modern (*Chrome, Safari, Firefox, Edge*) di desktop maupun perangkat *mobile* dengan dukungan *Progressive Web App* (PWA).
* **Multi-Channel Parallel Streaming (IDM-Style):** Memanfaatkan 4 hingga 8 kanal paralel `RTCDataChannel` dalam satu koneksi `RTCPeerConnection` dengan sistem antrean *chunk* dan *backpressure control* (`bufferedamountlow`) untuk memaksimalkan *throughput* Wi-Fi lokal.
* **Optical Fountain-Coded QR Stream:** Memanfaatkan algoritma *Fountain Codes* (*Luby Transform*) untuk mengubah potongan file menjadi aliran animasi QR Code pada `<canvas>` yang dapat dipindai oleh kamera penerima dalam urutan apa pun tanpa takut ada *frame* yang terlewat.
* **Memory-Safe Disk Streaming:** Memotong file di sisi pengirim menggunakan `File.slice()` (64 KB per *chunk* untuk WebRTC, atau 500–800 byte per *frame* untuk QR Optik) dan menulisnya secara bertahap di sisi penerima agar penggunaan RAM tetap rendah dan mencegah *Out of Memory* (OOM).
* **Kompatibilitas Jaringan Lokal (`HTTP` Non-Secure Context):** Menggunakan *incremental hashing* berbasis JavaScript/WASM per *chunk* (seperti `hash-wasm` atau `spark-md5`) karena `window.crypto.subtle` diblokir oleh peramban ketika diakses melalui IP lokal non-HTTPS (`http://192.168.x.x:5173`).

## 2. Koreksi Teknis Penting atas Rancangan Awal

Bagian ini merangkum perbaikan arsitektur yang wajib dipatuhi agar aplikasi tidak mengalami kegagalan saat diimplementasikan:

| Komponen / Masalah | Kesalahan pada Rancangan Awal | Perbaikan pada Master Plan Ini |
| :--- | :--- | :--- |
| **Akses Port Monorepo (Vite vs Express)** | Menginstruksikan pengguna membuka `http://192.168.1.10:3000` (port *backend*) padahal UI React berjalan di Vite (`5173`). | Saat *development*, pengguna mengakses **`http://<IP_LOKAL>:5173`**, dan React terhubung ke WebSocket secara dinamis di `ws://${window.location.hostname}:3000`. Saat *production*, Express menyajikan hasil `vite build` di port `3000`. |
| **Siklus Hidup Koneksi WebSocket** | Memutus koneksi WebSocket segera setelah jalur WebRTC terbuka, yang memicu event `close` di server dan menghapus perangkat dari daftar *peer* aktif. | Koneksi WebSocket **tetap dipertahankan dalam mode pasif (*idle*)** selama pengguna berada di halaman untuk menjaga daftar perangkat aktif (*presence*), mendukung *trickle ICE*, dan mengizinkan pengiriman file berikutnya. |
| **Konsistensi Pesan Signaling JSON** | Spesifikasi dokumentasi menulis tipe pesan `JOIN` dan `FILE_OFFER`, tetapi kode `server.js` hanya membaca `REGISTER` dan `SIGNAL`. | Menyatukan protokol signaling menjadi skema pesan terstandar: `REGISTER`, `PEER_LIST`, `FILE_OFFER`, `FILE_RESPONSE`, `SIGNAL`, dan `TRANSFER_CANCEL`. |
| **Header Biner & Backpressure WebRTC** | Kode awal mengirim *chunk* tanpa kendali *buffer* dan komentar kode hanya menyebutkan header 4-byte (berbeda dari spesifikasi 12-byte). | Menerapkan header biner **12-byte** secara konsisten serta wajib memeriksa `dc.bufferedAmount` dan menunggu event `bufferedamountlow` sebelum mengirim *chunk* berikutnya. |
| **API Penyimpanan & Hash di Mobile HTTP** | Mengasumsikan `FileSystem Access API` dan `crypto.subtle` berjalan di semua peramban HP via HTTP IP lokal. | Menyediakan *fallback* penyimpanan *stream* untuk Android/iOS (yang belum mendukung `showSaveFilePicker`) dan menggunakan *incremental hash* per *chunk* tanpa bergantung pada `crypto.subtle` (yang tidak tersedia di HTTP IP lokal) atau pembacaan file utuh ke RAM. |
| **Izin Kamera (`getUserMedia`) pada IP Lokal** | Mengakses kamera langsung pada `http://192.168.x.x` akan ditolak browser karena kamera mewajibkan *Secure Context* (`HTTPS` atau `localhost`). | Menggunakan plugin `@vitejs/plugin-basic-ssl` (atau sertifikat lokal `mkcert`) saat mengaktifkan fitur pemindai kamera di jaringan lokal, atau menjalankan aplikasi sebagai PWA statis yang sudah ter-cache. |

## 3. Tech Stack & Arsitektur Monorepo

Proyek menggunakan struktur **Monorepo** yang memisahkan tanggung jawab antara *Signaling Server* dan *Web Client*:

* **Backend (`/server`):**
  * **Runtime & Framework:** Node.js (v20+ / v24+ dengan fitur `--watch`) & Express.js.
  * **WebSocket Engine:** `ws` (pustaka WebSocket ringan untuk pertukaran pesan signaling).
  * **Utilities:** `cors`, `dotenv`.
* **Frontend (`/client`):**
  * **Framework & Bundler:** React.js (v18+) dengan Vite (`vite --host`).
  * **UI & Styling:** Tailwind CSS / CSS Modular & `lucide-react` untuk ikonografi.
  * **WebRTC & File APIs:** Native `RTCPeerConnection`, `RTCDataChannel`, `File.slice()`, `Streams API`, serta `hash-wasm` (atau `spark-md5`) untuk kalkulasi *checksum* secara *streaming* per *chunk*.
  * **Optical Camera QR Engine:**
    * Kompresi Data: `pako` (kompresi *zlib/deflate* di sisi pengirim sebelum di-encode ke QR).
    * Generator QR Cepat: `qrcode` (render langsung ke `<canvas>` pada 15–30 FPS).
    * Pemindai Kamera Cepat: `barcode-detector` (polyfill WebAssembly `BarcodeDetector API` atau `@zxing/browser` / `jsQR` di dalam *Web Worker*).

### Alur Komunikasi Jaringan (Mode WebRTC Lokal)

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
   * Pengirim mendistribusikan pengiriman *chunk* secara paralel di keempat `RTCDataChannel` yang dikendalikan oleh *backpressure* (`bufferedAmount <= 1048576` byte / 1 MB per kanal).
   * Setiap paket biner diawali **12-byte Header** (`chunkIndex`, `channelId`, `payloadSize`) diikuti data biner *chunk*.
5. **Rekonstruksi File & Verifikasi Integritas:**
   * Penerima membaca 12-byte header dari setiap paket yang tiba, menempatkan *chunk* sesuai urutan `chunkIndex` menggunakan *Reorder Buffer Window* (atau menulis langsung ke posisi byte `chunkIndex * chunkSize` jika menggunakan `FileSystemWritableFileStream`), lalu segera membebaskan memori RAM.

## 4. Struktur Direktori Proyek (Modular MVC & Services)

```text
local-p2p-transfer/
├── .gitignore                        # Aturan pengabaian file Git untuk seluruh monorepo
├── README.md                         # Dokumentasi instalasi dan penggunaan cepat
├── CONTRIBUTING.md                   # Standar kerja tim, Git workflow, dan konvensi kode
├── MASTER_PLAN.md                    # Dokumen spesifikasi teknis dan arsitektur utama
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
│   │   └── app.js                    # Entry point utama Express + WebSocket Server
│   ├── .env.example                  # Template variabel environment backend
│   ├── .env.local                    # Konfigurasi lokal backend (diabaikan oleh Git)
│   └── package.json
│
└── client/                           # FRONTEND: React + Vite + WebRTC & Optical QR Engine
    ├── public/
    │   ├── favicon.png               # Favicon tab browser FlashMux
    │   ├── icon-192.png              # Ikon PWA ukuran 192x192
    │   ├── icon-512.png              # Ikon PWA ukuran 512x512
    │   └── manifest.json             # Konfigurasi PWA untuk instalasi di layar utama HP
    ├── src/
    │   ├── assets/
    │   │   └── logo.png              # Logo utama FlashMux untuk komponen Header
    │   ├── components/
    │   │   ├── Header.jsx            # Header aplikasi, info IP lokal, & pemilih mode (Wi-Fi / QR)
    │   │   ├── DeviceList.jsx        # Grid kartu/avatar perangkat aktif di jaringan lokal
    │   │   ├── DropZone.jsx          # Area drag-and-drop & pemilih file
    │   │   ├── TransferModal.jsx     # Pop-up konfirmasi terima/tolak file masuk
    │   │   ├── TransferProgress.jsx  # Indikator progres per kanal (IDM-style), kecepatan, & ETA
    │   │   ├── QrStreamSender.jsx    # Layar generator animasi QR Code berkecepatan tinggi
    │   │   └── QrStreamReceiver.jsx  # Pemindai kamera (Viewfinder) + indikator blok terkumpul
    │   ├── hooks/
    │   │   ├── useSignaling.js       # Custom hook koneksi WebSocket & daftar peer
    │   │   ├── useP2PTransfer.js     # Custom hook siklus hidup WebRTC & state progres transfer
    │   │   └── useOpticalQr.js       # Custom hook untuk encoding/decoding animasi QR Code
    │   ├── services/
    │   │   ├── signalingClient.js    # Kelas manajemen koneksi WebSocket & auto-reconnect
    │   │   ├── webrtcEngine.js       # Kelas RTCPeerConnection & 4x paralel RTCDataChannel
    │   │   ├── fileChunker.js        # Logika File.slice(), antrean chunk, & backpressure
    │   │   ├── fileWriter.js         # Abstraksi penulisan stream ke disk (Desktop & Mobile)
    │   │   └── fountainQrEngine.js   # Encoder & decoder Fountain Code (Luby Transform) untuk QR
    │   ├── utils/
    │   │   ├── binaryPacket.js       # Encoder & decoder header biner 12-byte (ArrayBuffer)
    │   │   ├── hashCalculator.js     # Kalkulasi checksum incremental per chunk
    │   │   └── formatters.js         # Formatter ukuran byte (MB/GB), kecepatan (MB/s), & waktu
    │   ├── App.jsx                   # Komponen utama pengatur tata letak dan alur halaman
    │   ├── main.jsx                  # Titik masuk aplikasi React
    │   └── index.css                 # Styling global & utilitas responsif
    ├── .env.example                  # Template variabel environment frontend
    ├── .env.local                    # Konfigurasi lokal frontend (diabaikan oleh Git)
    ├── vite.config.js                # Konfigurasi Vite dengan `server: { host: true, port: 5173 }`
    └── package.json
```

## 5. Spesifikasi Protokol Komunikasi & Struktur Paket Data

### A. Protokol Signaling WebSocket (Format JSON)

Seluruh pesan yang dikirim melalui WebSocket wajib berbentuk JSON dan memiliki properti `type`:

#### 1. Registrasi Perangkat (`Client -> Server`)

```json
{
  "type": "REGISTER",
  "peerId": "peer_9f8a7b6c",
  "clientName": "ThinkPad-Muhsin",
  "deviceType": "desktop"
}
```

#### 2. Pembaruan Daftar Perangkat (`Server -> All Clients`)

```json
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

#### 3. Penawaran File / File Offer (`Sender -> Server -> Receiver`)

```json
{
  "type": "FILE_OFFER",
  "transferId": "tx_20261021_001",
  "from": "peer_9f8a7b6c",
  "to": "peer_1d2e3f4g",
  "metadata": {
    "fileName": "Dataset_Skripsi_4K.mp4",
    "fileSize": 2147483648,
    "fileType": "video/mp4",
    "chunkSize": 65536,
    "totalChunks": 32768,
    "numChannels": 4
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
  "accepted": true
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

### B. Protokol Paket Biner `RTCDataChannel` (Header 12-Byte)

Setiap pengiriman potongan file melalui `RTCDataChannel` dikemas dalam satu `ArrayBuffer` berukuran maksimal `65548` byte (`12` byte header + `65536` byte payload) dengan susunan *Little-Endian*:

| Offset Byte | Tipe Data | Nama Field | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Byte 0 – 3** | `Uint32` | `chunkIndex` | Nomor urut *chunk* (`0` s.d. `totalChunks - 1`) untuk penyusunan ulang. |
| **Byte 4 – 7** | `Uint32` | `channelId` | Indeks kanal pengirim (`0`, `1`, `2`, atau `3`) untuk pemantauan kecepatan per kanal. |
| **Byte 8 – 11** | `Uint32` | `payloadSize` | Ukuran byte aktual dari data biner di dalam paket ini (maksimal `65536`). |
| **Byte 12 – Akhir** | `Uint8Array` | `payloadData` | Data biner mentah hasil potongan `File.slice()`. |

## 6. Implementasi Kode Acuan (Core Blueprint)

### A. Encoder & Decoder Paket Biner (`client/src/utils/binaryPacket.js`)

```javascript
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

```javascript
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

```javascript
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

## 7. Spesifikasi Fitur Tambahan: Protokol Transfer Optik via Kamera (Animated QR Stream)

Fitur ini memungkinkan pengiriman file atau teks secara optik dari layar perangkat pengirim ke kamera perangkat penerima tanpa koneksi jaringan sama sekali (*100% Air-Gapped / Offline*).

### A. Referensi Repositori Open-Source Utama

Implementasi modul kamera di **FlashMux** mengadaptasi arsitektur dari proyek open-source teruji berikut:

* **[qifi-dev/qrs](https://github.com/qifi-dev/qrs):** Implementasi web modern (TypeScript) yang memotong file dan mengalirkannya melalui animasi QR Code menggunakan algoritma *Luby Transform (Fountain Code)* di peramban.
* **[bashalarmistalt/decimen-optical-transfer](https://github.com/bashalarmistalt/decimen-optical-transfer/):** Protokol transfer optik berbasis browser pada 60 FPS yang sanggup menembus kecepatan hingga ~190 KB/detik tanpa instalasi aplikasi maupun jaringan.
* **[divan/txqr](https://github.com/divan/txqr):** Protokol pionir *Transfer via QR* menggunakan *Fountain Codes* untuk mengatasi masalah *dropped frames* pada kamera HP.
* **[sz3/libcimbar](https://github.com/sz3/libcimbar) & [sz3/cimbar](https://github.com/sz3/cimbar):** Format *Color Icon Matrix Barcodes* (barcode matriks warna 2D berbasis WebAssembly/WebGL) yang memadatkan kapasitas data per frame hingga kecepatan ~106 KB/detik (850 kbps).
* **[deedy/qr-data-transfer](https://github.com/deedy/qr-data-transfer) & [mohankumarelec/airgapped-qr-code-transfer](https://github.com/mohankumarelec/airgapped-qr-code-transfer):** Implementasi web ringan yang menggabungkan kompresi `pako` (*zlib*) dengan *animated QR loop*.

### B. Mengapa Wajib Menggunakan Fountain Codes (Luby Transform)?

Komunikasi dari layar ke kamera bersifat **satu arah (*unidirectional*)**—kamera penerima tidak bisa mengirim sinyal balik ke layar pengirim untuk meminta ulang (*re-request*) nomor frame yang terlewat akibat *motion blur* atau kedipan fokus kamera:

1. **PendekatanSequential Loop Sederhana (Kurang Efisien untuk File > 50 KB):**
   * File dipecah menjadi `N` bagian (`Chunk 0` s.d. `Chunk N-1`) dan diputar berulang-ulang di layar pada 15–20 FPS.
   * Jika penerima terlewat 1 frame saja (misal `Chunk 42` dari `200`), penerima harus menunggu seluruh animasi berputar kembali dari awal sampai bertemu `Chunk 42`.
2. **Pendekatan Fountain Codes / Luby Transform (Standar Terbaik untuk FlashMux):**
   * File dikompresi dengan `pako.deflate()`, lalu dibagi menjadi `K` blok sumber berukuran **500–800 byte** per blok (ukuran optimal agar dimensi modul QR Code tidak terlalu rapat dan mudah dibaca kamera HP).
   * Pengirim membangkitkan paket *droplet* tak terbatas secara acak menggunakan operasi `XOR` dari beberapa blok sumber beserta *seed/degree header*.
   * **Keunggulan Mutlak:** Kamera penerima cukup memindai *droplet* mana saja dalam urutan apa pun. Begitu penerima berhasil mengumpulkan sekitar `K * 1.05` (105% jumlah blok asli), seluruh file langsung dapat direkonstruksi secara matematis melalui *peeling decoder* (eliminasi Gauss/XOR) tanpa perlu menunggu frame tertentu.

### C. Format Paket Frame QR (`fountainQrEngine.js`)

Setiap frame QR Code meng-encode data biner (Mode *Byte* QR atau Base64 ringkas) dengan struktur:

```text
[Magic: 2B "FM"] [TransferID: 2B] [BlockIndex / Seed: 4B] [TotalBlocks K: 2B] [FileSize: 4B] [Payload: 600B] [CRC16: 2B]
```

* **Frame Rate Pengirim:** Dapat diatur pengguna antara **10 FPS, 15 FPS, hingga 30 FPS** (menyesuaikan kemampuan kamera HP penerima).
* **Rekomendasi Ukuran File Mode Kamera:** Optimal untuk teks, kredensial, potongan kode, dokumen PDF, atau gambar dengan ukuran **di bawah 2 MB** (pada kecepatan ~50–100 KB/detik, file 1 MB membutuhkan waktu sekitar 10–20 detik). Untuk file ratusan MB hingga GB, UI secara cerdas mengarahkan pengguna ke **Mode WebRTC Multi-Channel**.
* **Bonus Penggunaan Kamera (Serverless WebRTC Signaling):** Selain mengirim file secara optik, modul QR + Kamera ini juga dapat dipakai untuk menukar **SDP Offer & Answer WebRTC** secara langsung antar-layar dan kamera ketika kedua perangkat terhubung ke Hotspot lokal tanpa menjalankan Node.js Signaling Server.

## 8. Konfigurasi File Penting (`.gitignore`, `.env.example`, `vite.config.js`)

### A. Root `.gitignore`

```text
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
  ```ini
  PORT=3000
  CORS_ORIGIN=*
  ```
* **`client/.env.example`:**
  ```ini
  VITE_SIGNALING_PORT=3000
  VITE_DEFAULT_CHUNK_SIZE=65536
  VITE_PARALLEL_CHANNELS=4
  VITE_QR_CHUNK_SIZE=600
  VITE_QR_DEFAULT_FPS=15
  ```

### C. Konfigurasi Vite (`client/vite.config.js`)

Agar API Kamera (`navigator.mediaDevices.getUserMedia`) diizinkan oleh browser HP saat diakses melalui IP lokal (`192.168.x.x`), disarankan mengaktifkan `@vitejs/plugin-basic-ssl` pada mode pengujian kamera:

```javascript
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

## 9. Peta Jalan Pengembangan (Development Roadmap)

1. **Fase 1 — Fondasi Monorepo & Signaling Server (`feat/signaling-server`):**
   * Inisialisasi folder `/server` dan `/client`, konfigurasi `.gitignore` dan `.env.example`.
   * Implementasi WebSocket server (`REGISTER`, `PEER_LIST`, `SIGNAL`) dan pengujian koneksi multi-perangkat (PC + HP) di satu jaringan Wi-Fi.
2. **Fase 2 — Negosiasi File & Single-Channel WebRTC (`feat/webrtc-handshake`):**
   * Pembuatan UI `DeviceList`, `DropZone`, dan `TransferModal`.
   * Implementasi alur `FILE_OFFER` -> `FILE_RESPONSE` -> pertukaran SDP & ICE Candidate hingga 1 `RTCDataChannel` berhasil mengirim file kecil (< 10 MB).
3. **Fase 3 — Chunking, Binary Header 12-Byte, & Backpressure (`feat/chunk-streaming`):**
   * Implementasi pemotongan file `File.slice()` @ 64 KB, *encoder/decoder* header biner 12-byte, dan kontrol `bufferedamountlow`.
   * Integrasi penulisan file *streaming* (`FileSystem Access API` dengan *fallback* Blob/Stream untuk *mobile*).
4. **Fase 4 — Optimasi Multi-Channel IDM-Style & Checksum (`feat/multi-channel-idm`):**
   * Pembukaan 4 `RTCDataChannel` paralel disertai *Reorder Buffer* di sisi penerima agar *chunk* yang tiba tidak berurutan tetap ditulis pada posisi yang tepat.
   * Integrasi verifikasi *incremental hash* per *chunk* dan indikator kecepatan per kanal di `TransferProgress.jsx`.
5. **Fase 5 — Protokol Kamera / Animated QR Stream (`feat/optical-qr-transfer`):**
   * Integrasi pustaka generator QR (`qrcode` ke `<canvas>`) dan pemindai kamera cepat (`BarcodeDetector` / `jsQR` di *Web Worker*).
   * Implementasi *Fountain Code (Luby Transform)* di `fountainQrEngine.js` beserta komponen `QrStreamSender.jsx` dan `QrStreamReceiver.jsx`.
6. **Fase 6 — Polesan UI/UX, Penanganan Error, & PWA (`feat/pwa-polish`):**
   * Penambahan fitur *Cancel Transfer*, deteksi otomatis terputusnya jaringan di tengah transfer, dan konfigurasi `manifest.json` beserta ikon **FlashMux** untuk PWA.

## 10. Standar Kerja & Aturan Emas Pengembangan (Golden Rules)

1. **Pemisahan Tanggung Jawab Mutlak (*Strict Separation of Concerns*):**
   * Direktori `/server` **hanya** menangani koneksi WebSocket dan meneruskan pesan teks JSON signaling. **Dilarang keras** menambahkan *endpoint* unggah file (`multipart/form-data`) atau menyimpan *buffer* biner file di server.
   * Direktori `/client` menangani seluruh negosiasi P2P WebRTC, pemotongan *chunk*, kontrol *buffer*, protokol kamera QR, perhitungan *hash*, dan penulisan ke penyimpanan perangkat.
2. **Keamanan Kredensial & Lingkungan:**
   * Jangan pernah melakukan *commit* file `.env` atau `.env.local` ke repositori Git. Setiap penambahan variabel konfigurasi baru wajib didokumentasikan menggunakan *placeholder* di dalam `.env.example`.
3. **Konvensi Branching & Pull Request:**
   * Dilarang melakukan *push* langsung ke branch `main` atau `development`.
   * Gunakan branch terpisah dengan penamaan *kebab-case*:
     * `feat/<nama-fitur>` untuk penambahan fitur baru (contoh: `feat/optical-qr-transfer`).
     * `fix/<nama-bug>` untuk perbaikan bug (contoh: `fix/mobile-ws-hostname`).
     * `refactor/<nama-modul>` untuk restrukturisasi kode tanpa mengubah perilaku sistem.
     * `docs/<nama-dokumen>` untuk pembaruan dokumentasi.
4. **Format Pesan Commit (*Conventional Commits*):**
   * Gunakan format `<tipe>(<modul>): <deskripsi singkat dalam bahasa Indonesia>`, misalnya:
     * `feat(qr): tambahkan encoder fountain code untuk streaming qr via kamera`
     * `fix(client): gunakan window.location.hostname agar websocket terbaca di perangkat mobile`
5. **Verifikasi Build Sebelum Pull Request:**
   * Pastikan aplikasi berhasil melewati `npm run build` di `/client` dan tidak menghasilkan *runtime error* di `/server` sebelum mengajukan *Pull Request* (PR).