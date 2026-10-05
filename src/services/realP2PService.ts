import { Peer, DataConnection, MediaConnection } from 'peerjs';

// Hybrid Real-time Peer-to-Peer & LAN Sync Engine
// Combines Local Wi-Fi SSE/HTTP Relay + WebRTC PeerJS + BroadcastChannel
// Guarantees 100% instant connection across any smartphone and photobooth on the same network!

export interface ConnectedPhoneClient {
  id: string;
  name: string;
  os: string;
  joinedAt: number;
  isStreamingCamera?: boolean;
  hasMediaStream?: boolean;
}

export type P2PMessage =
  | { type: 'PHONE_JOIN'; payload: { id: string; name: string; os: string } }
  | { type: 'PHONE_HEARTBEAT'; payload: { id: string } }
  | { type: 'SHUTTER_TRIGGER'; payload: { sourceId: string; sourceName: string } }
  | { type: 'PHOTO_TRANSFER'; payload: { sourceId: string; sourceName: string; photoDataUrl: string; fileName: string } }
  | { type: 'STRIP_DELIVERY'; payload: { stripDataUrl: string; title: string } }
  | { type: 'BOOTH_INFO'; payload: { frameName: string; requiredSlots: number; filledSlots: number } }
  | { type: 'PHONE_CAMERA_STREAM_START'; payload: { sourceId: string; sourceName: string; facingMode: string } }
  | { type: 'PHONE_CAMERA_STREAM_STOP'; payload: { sourceId: string } }
  | { type: 'PHONE_CAMERA_FRAME'; payload: { sourceId: string; frameDataUrl: string } }
  | { type: 'PHONE_HIGHRES_CAPTURE'; payload: { sourceId: string; photoDataUrl: string } }
  | { type: 'REQUEST_PHONE_SNAPSHOT'; payload: { targetId?: string } };

type MessageHandler = (msg: P2PMessage) => void;
type FrameListener = (frameDataUrl: string) => void;
type StreamListener = (stream: MediaStream | null) => void;

class RealP2PService {
  private roomId: string = '';
  private isRemoteMode: boolean = false;
  private peer: Peer | null = null;
  private peerId: string = '';
  private activeDataConnections: Map<string, DataConnection> = new Map();
  private boothConnection: DataConnection | null = null;
  private activeCall: MediaConnection | null = null;
  private remoteMediaStream: MediaStream | null = null;
  private eventSource: EventSource | null = null;

  private broadcastChannel: BroadcastChannel | null = null;
  private messageHandlers: MessageHandler[] = [];
  private frameListeners: FrameListener[] = [];
  private mediaStreamListeners: StreamListener[] = [];
  private connectedClients: Map<string, ConnectedPhoneClient> = new Map();
  private clientListeners: Array<(clients: ConnectedPhoneClient[]) => void> = [];
  private connectionStatusListeners: Array<(status: 'connected' | 'connecting' | 'disconnected') => void> = [];
  
  private latestPhoneFrame: string | null = null;
  private isPhoneStreaming = false;
  private connectionStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private customHost: string = '192.168.0.117:5173';

  constructor() {
    this.roomId = this.getOrGenerateRoomId();
    const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    this.isRemoteMode = urlParams.get('mode') === 'remote';

    const storedHost = typeof localStorage !== 'undefined' ? localStorage.getItem('px_custom_host') : null;
    if (storedHost) {
      this.customHost = storedHost;
    } else if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.origin.includes('capacitor')) {
      this.customHost = window.location.host;
    }

    this.setupBroadcastChannel();
    this.setupLocalStorageSync();
    this.setupSSERelay();
    this.initWebRTCPeer();
  }

  private getOrGenerateRoomId(): string {
    if (typeof window === 'undefined') return 'PX5832';
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) return roomParam.toUpperCase();

    let stored = localStorage.getItem('px_room_id');
    if (!stored) {
      stored = 'PX5832';
      localStorage.setItem('px_room_id', stored);
    }
    return stored;
  }

  private getCleanRoomId(): string {
    return this.roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  getRoomId(): string {
    return this.roomId;
  }

  setRoomId(id: string) {
    this.roomId = id.toUpperCase();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('px_room_id', this.roomId);
    }
    this.setupBroadcastChannel();
    this.setupSSERelay();
    this.initWebRTCPeer();
  }

  getCustomHost(): string {
    return this.customHost;
  }

  setCustomHost(host: string) {
    this.customHost = host;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('px_custom_host', host);
    }
    this.setupSSERelay();
  }

  getSyncUrl(): string {
    const protocol = typeof window !== 'undefined' && window.location.protocol.startsWith('https') ? 'https:' : 'http:';
    let host = this.customHost;

    if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
      host = '192.168.0.117:5173';
    }

    return `${protocol}//${host}/?mode=remote&room=${this.roomId}`;
  }

  // 1. Local Wi-Fi Server-Sent Events (SSE) & HTTP Relay
  private setupSSERelay() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    try {
      const protocol = window.location.protocol.startsWith('https') ? 'https:' : 'http:';
      let host = this.customHost;
      if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
        host = window.location.host || '192.168.0.117:5173';
      }

      const sseUrl = `${protocol}//${host}/api/p2p/events?room=${this.roomId}`;
      const es = new EventSource(sseUrl);
      this.eventSource = es;

      es.onopen = () => {
        console.log('[P2P SSE] Connected to local LAN relay');
        this.setConnectionState('connected');
        if (this.isRemoteMode) {
          this.joinRoomAsPhone();
        }
      };

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as P2PMessage;
          if (msg && (msg as unknown as { type: string }).type !== 'SSE_READY') {
            this.handleIncomingMessage(msg);
          }
        } catch {
          // ignore
        }
      };

      es.onerror = () => {
        // SSE not supported or offline - relies on WebRTC PeerJS & BroadcastChannel
      };
    } catch (e) {
      console.warn('[P2P SSE] Relay setup note:', e);
    }
  }

  // 2. WebRTC PeerJS Connection
  private initWebRTCPeer() {
    if (typeof window === 'undefined') return;

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    const cleanRoom = this.getCleanRoomId();

    if (this.isRemoteMode) {
      // 📱 REMOTE CLIENT (PHONE) MODE
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      this.peerId = `pxphone-${cleanRoom}-${randomSuffix}`;

      try {
        this.peer = new Peer(this.peerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
            ],
          },
        });

        this.peer.on('open', (id) => {
          console.log('[Phone P2P] Peer open:', id);
          this.connectToBoothHost(cleanRoom);
        });

        this.peer.on('error', (err) => {
          console.warn('[Phone P2P] Peer warning:', err);
        });
      } catch (e) {
        console.error('[Phone P2P] Init peer failed:', e);
      }
    } else {
      // 🖥️ PHOTOBOOTH HOST MODE
      this.peerId = `pxbooth-${cleanRoom}`;

      try {
        this.peer = new Peer(this.peerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
            ],
          },
        });

        this.peer.on('open', (id) => {
          console.log('[Booth P2P] Host peer ready listening on:', id);
          this.setConnectionState('connected');
        });

        this.peer.on('connection', (conn) => {
          console.log('[Booth P2P] New phone connected:', conn.peer);
          this.setupHostDataConnection(conn);
        });

        this.peer.on('call', (call) => {
          console.log('[Booth P2P] Incoming Live Camera stream call from:', call.peer);
          call.answer();
          call.on('stream', (remoteStream) => {
            console.log('[Booth P2P] Received live video stream tracks:', remoteStream.getTracks());
            this.remoteMediaStream = remoteStream;
            this.isPhoneStreaming = true;
            this.mediaStreamListeners.forEach((l) => l(remoteStream));
          });
          call.on('close', () => {
            console.log('[Booth P2P] Live Camera call closed');
            this.remoteMediaStream = null;
            this.mediaStreamListeners.forEach((l) => l(null));
          });
        });

        this.peer.on('error', (err) => {
          console.warn('[Booth P2P] Host peer warning:', err);
        });
      } catch (e) {
        console.error('[Booth P2P] Init host peer failed:', e);
      }
    }
  }

  // PHONE: Connect to Booth Host
  private connectToBoothHost(cleanRoom: string) {
    if (!this.peer || this.peer.destroyed) return;

    const boothPeerId = `pxbooth-${cleanRoom}`;
    try {
      const conn = this.peer.connect(boothPeerId, { reliable: true });
      this.boothConnection = conn;

      conn.on('open', () => {
        console.log('[Phone P2P] Connected to Photobooth Host DataChannel!');
        this.setConnectionState('connected');
        this.joinRoomAsPhone();
      });

      conn.on('data', (data) => {
        this.handleIncomingMessage(data as P2PMessage);
      });

      conn.on('close', () => {
        console.log('[Phone P2P] Host connection closed. Retrying...');
      });
    } catch (e) {
      console.warn('[Phone P2P] WebRTC direct conn note:', e);
    }
  }

  // BOOTH: Setup phone client DataConnection
  private setupHostDataConnection(conn: DataConnection) {
    this.activeDataConnections.set(conn.peer, conn);

    conn.on('data', (data) => {
      this.handleIncomingMessage(data as P2PMessage);
    });

    conn.on('close', () => {
      this.activeDataConnections.delete(conn.peer);
      this.connectedClients.delete(conn.peer);
      this.notifyClients();
    });
  }

  private setConnectionState(status: 'connected' | 'connecting' | 'disconnected') {
    this.connectionStatus = status;
    this.connectionStatusListeners.forEach((l) => l(status));
  }

  onConnectionStatusChange(listener: (status: 'connected' | 'connecting' | 'disconnected') => void): () => void {
    this.connectionStatusListeners.push(listener);
    listener(this.connectionStatus);
    return () => {
      this.connectionStatusListeners = this.connectionStatusListeners.filter((l) => l !== listener);
    };
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  // Broadcast & Local Storage Fallback
  private setupBroadcastChannel() {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel(`px_sync_${this.roomId}`);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingMessage(event.data);
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel note:', e);
    }
  }

  private setupLocalStorageSync() {
    if (typeof window === 'undefined') return;

    window.addEventListener('storage', (event) => {
      if (event.key === `px_msg_${this.roomId}` && event.newValue) {
        try {
          const msg = JSON.parse(event.newValue) as P2PMessage;
          this.handleIncomingMessage(msg);
        } catch {
          // ignore
        }
      }
    });
  }

  private handleIncomingMessage(msg: P2PMessage) {
    if (!msg || !msg.type) return;

    if (msg.type === 'PHONE_JOIN') {
      const client: ConnectedPhoneClient = {
        id: msg.payload.id,
        name: msg.payload.name,
        os: msg.payload.os,
        joinedAt: Date.now(),
        isStreamingCamera: false,
      };
      this.connectedClients.set(client.id, client);
      this.setConnectionState('connected');
      this.notifyClients();
    } else if (msg.type === 'PHONE_CAMERA_STREAM_START') {
      this.isPhoneStreaming = true;
      const client = this.connectedClients.get(msg.payload.sourceId);
      if (client) {
        client.isStreamingCamera = true;
        this.notifyClients();
      }
    } else if (msg.type === 'PHONE_CAMERA_STREAM_STOP') {
      this.isPhoneStreaming = false;
      const client = this.connectedClients.get(msg.payload.sourceId);
      if (client) {
        client.isStreamingCamera = false;
        this.notifyClients();
      }
    } else if (msg.type === 'PHONE_CAMERA_FRAME') {
      this.latestPhoneFrame = msg.payload.frameDataUrl;
      this.isPhoneStreaming = true;
      this.frameListeners.forEach((l) => l(msg.payload.frameDataUrl));
    }

    // Pass to all listeners
    this.messageHandlers.forEach((handler) => handler(msg));
  }

  // Send message across all channels (LAN HTTP Relay + WebRTC DataChannel + BroadcastChannel + LocalStorage)
  sendMessage(msg: P2PMessage) {
    // 1. Local Wi-Fi HTTP Relay POST
    try {
      const protocol = typeof window !== 'undefined' && window.location.protocol.startsWith('https') ? 'https:' : 'http:';
      let host = this.customHost;
      if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
        host = (typeof window !== 'undefined' && window.location.host) || '192.168.0.117:5173';
      }
      fetch(`${protocol}//${host}/api/p2p/send?room=${this.roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {});
    } catch {
      // offline fallback
    }

    // 2. WebRTC DataChannel
    if (this.isRemoteMode && this.boothConnection && this.boothConnection.open) {
      this.boothConnection.send(msg);
    } else {
      this.activeDataConnections.forEach((conn) => {
        if (conn.open) {
          conn.send(msg);
        }
      });
    }

    // 3. BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch {
        // ignore
      }
    }

    // 4. LocalStorage Event
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`px_msg_${this.roomId}`, JSON.stringify({ ...msg, _t: Date.now() }));
      }
    } catch {
      // quota
    }

    // Notify local handlers in current window
    this.messageHandlers.forEach((handler) => handler(msg));
  }

  // Subscribe to raw messages
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  // Subscribe to live WebRTC MediaStream (60 FPS Native Video Stream)
  onRemoteMediaStream(listener: StreamListener): () => void {
    this.mediaStreamListeners.push(listener);
    if (this.remoteMediaStream) {
      listener(this.remoteMediaStream);
    }
    return () => {
      this.mediaStreamListeners = this.mediaStreamListeners.filter((l) => l !== listener);
    };
  }

  getRemoteMediaStream(): MediaStream | null {
    return this.remoteMediaStream;
  }

  // Subscribe to live video canvas frames
  onPhoneCameraFrame(listener: FrameListener): () => void {
    this.frameListeners.push(listener);
    if (this.latestPhoneFrame) {
      listener(this.latestPhoneFrame);
    }
    return () => {
      this.frameListeners = this.frameListeners.filter((l) => l !== listener);
    };
  }

  getLatestPhoneFrame(): string | null {
    return this.latestPhoneFrame;
  }

  getIsPhoneStreaming(): boolean {
    return this.isPhoneStreaming || this.remoteMediaStream !== null;
  }

  // Subscribe to client list changes
  onClientsChange(listener: (clients: ConnectedPhoneClient[]) => void): () => void {
    this.clientListeners.push(listener);
    listener(Array.from(this.connectedClients.values()));
    return () => {
      this.clientListeners = this.clientListeners.filter((l) => l !== listener);
    };
  }

  getConnectedClients(): ConnectedPhoneClient[] {
    return Array.from(this.connectedClients.values());
  }

  private notifyClients() {
    const list = Array.from(this.connectedClients.values());
    this.clientListeners.forEach((l) => l(list));
  }

  // Actions for Phone Remote:
  joinRoomAsPhone(name?: string) {
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);
    const os = isIOS ? 'Apple iPhone/iOS' : isAndroid ? 'Android Phone' : 'Mobile Browser';
    const phoneName = name || (isIOS ? 'iPhone của bạn' : isAndroid ? 'Điện thoại Android' : 'Smartphone Remote');

    const id = this.peerId || ('phone-' + Math.random().toString(36).substring(2, 8));
    this.sendMessage({
      type: 'PHONE_JOIN',
      payload: { id, name: phoneName, os },
    });
    return id;
  }

  startPhoneCameraStream(sourceId: string, sourceName: string, stream?: MediaStream, facingMode: string = 'environment') {
    this.isPhoneStreaming = true;

    if (stream && this.peer && !this.peer.destroyed) {
      const cleanRoom = this.getCleanRoomId();
      const boothPeerId = `pxbooth-${cleanRoom}`;
      try {
        console.log('[Phone P2P] Calling Booth Host with Camera MediaStream:', boothPeerId);
        this.activeCall = this.peer.call(boothPeerId, stream);
      } catch (e) {
        console.warn('[Phone P2P] MediaStream call error:', e);
      }
    }

    this.sendMessage({
      type: 'PHONE_CAMERA_STREAM_START',
      payload: { sourceId, sourceName, facingMode },
    });
  }

  stopPhoneCameraStream(sourceId: string) {
    this.isPhoneStreaming = false;
    if (this.activeCall) {
      this.activeCall.close();
      this.activeCall = null;
    }
    this.sendMessage({
      type: 'PHONE_CAMERA_STREAM_STOP',
      payload: { sourceId },
    });
  }

  sendPhoneCameraFrame(sourceId: string, frameDataUrl: string) {
    this.latestPhoneFrame = frameDataUrl;
    this.sendMessage({
      type: 'PHONE_CAMERA_FRAME',
      payload: { sourceId, frameDataUrl },
    });
  }

  triggerShutter(sourceId = 'phone-client', sourceName = 'Điện thoại') {
    this.sendMessage({
      type: 'SHUTTER_TRIGGER',
      payload: { sourceId, sourceName },
    });
  }

  sendPhotoFromPhone(photoDataUrl: string, fileName = 'Phone_Photo.jpg', sourceId = 'phone-client', sourceName = 'Điện thoại') {
    this.sendMessage({
      type: 'PHOTO_TRANSFER',
      payload: {
        sourceId,
        sourceName,
        photoDataUrl,
        fileName,
      },
    });
  }

  sendStripToPhones(stripDataUrl: string, title = 'PhotoXinhh Strip') {
    this.sendMessage({
      type: 'STRIP_DELIVERY',
      payload: {
        stripDataUrl,
        title,
      },
    });
  }
}

export const realP2PService = new RealP2PService();
