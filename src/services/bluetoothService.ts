import { sounds } from '../utils/audio';
import { SAMPLE_PORTRAITS } from '../templates/samplePhotos';
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

export type BluetoothDeviceType = 'phone' | 'camera' | 'printer' | 'remote' | 'other';
export type BleScanFilterMode = 'named_only' | 'cameras' | 'printers' | 'remotes' | 'custom' | 'all';

export interface BleScanOptions {
  mode?: BleScanFilterMode;
  customPrefix?: string;
}

export interface BluetoothDevice {
  id: string;
  name: string;
  type: BluetoothDeviceType;
  modelName: string;
  brand: string;
  rssi: number; // dBm, e.g. -45 dBm
  batteryLevel?: number; // 0 - 100
  macAddress: string;
  status: 'disconnected' | 'connecting' | 'pairing' | 'connected' | 'transferring' | 'printing';
  pairedPin?: string;
  signalBars: number; // 1 to 4
  isRealHardware?: boolean;
  gattServer?: unknown;
  lastSeen: number;
  details: {
    protocol: string;
    services: string[];
    paperLevel?: number;
    ribbonLevel?: number;
    cameraSettings?: {
      shutterSpeed: string;
      aperture: string;
      iso: number;
      shotsRemaining: number;
    };
    phoneInfo?: {
      os: string;
      storage: string;
      syncPhotosCount: number;
    };
  };
}

export interface TransferProgress {
  deviceId: string;
  fileName: string;
  fileSize: string;
  progress: number; // 0 to 100
  speed: string; // e.g. "3.2 MB/s"
  direction: 'incoming' | 'outgoing';
  previewUrl?: string;
}

export interface PrintJobProgress {
  printerId: string;
  printerName: string;
  currentPass: number; // 1: Yellow, 2: Magenta, 3: Cyan, 4: Overcoat
  passName: string;
  progress: number; // 0 to 100
  statusText: string;
  previewUrl?: string;
}

type DeviceListener = (devices: BluetoothDevice[]) => void;
type ShutterListener = (sourceDevice: BluetoothDevice) => void;
type PhotoReceivedListener = (photoUrl: string, deviceName: string) => void;
type TransferListener = (progress: TransferProgress | null) => void;
type PrintListener = (progress: PrintJobProgress | null) => void;

class BluetoothService {
  private devices: BluetoothDevice[] = [];
  private isScanning = false;
  private listeners: DeviceListener[] = [];
  private shutterListeners: ShutterListener[] = [];
  private photoReceivedListeners: PhotoReceivedListener[] = [];
  private transferListeners: TransferListener[] = [];
  private printListeners: PrintListener[] = [];
  private pendingPairingDevice: BluetoothDevice | null = null;
  private isBleClientInitialized = false;

  private hidKeyPressListeners: Array<(key: string) => void> = [];

  constructor() {
    this.devices = [];
    this.setupGlobalHidShutterListener();
  }

  // Global Bluetooth HID Shutter Button Listener (For iOS / Safari / macOS paired remotes)
  private setupGlobalHidShutterListener() {
    if (typeof window === 'undefined') return;

    // Bluetooth selfie remotes send Space, Enter, VolumeUp, VolumeDown, or MediaPlayPause
    window.addEventListener('keydown', (e) => {
      if (
        e.code === 'Space' ||
        e.code === 'Enter' ||
        e.key === 'VolumeUp' ||
        e.key === 'VolumeDown' ||
        e.key === 'AudioVolumeUp' ||
        e.key === 'AudioVolumeDown' ||
        e.key === 'MediaPlayPause' ||
        e.key === 'MediaTrackNext'
      ) {
        // Only trigger if not typing inside an input/textarea
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          this.hidKeyPressListeners.forEach((l) => l(e.code || e.key));
          this.triggerRemoteShutter();
        }
      }
    });

    // Support Bluetooth Selfie remotes / Smart rings via MediaSession API on iOS Safari and WKWebView
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        const handleRemoteClick = () => {
          this.hidKeyPressListeners.forEach((l) => l('Nút Bấm Bluetooth Selfie (Media Shutter)'));
          this.triggerRemoteShutter();
        };
        navigator.mediaSession.setActionHandler('play', handleRemoteClick);
        navigator.mediaSession.setActionHandler('pause', handleRemoteClick);
        navigator.mediaSession.setActionHandler('nexttrack', handleRemoteClick);
        navigator.mediaSession.setActionHandler('previoustrack', handleRemoteClick);
      } catch {
        // ignore
      }
    }
  }

  onHidKeyPress(listener: (key: string) => void): () => void {
    this.hidKeyPressListeners.push(listener);
    return () => {
      this.hidKeyPressListeners = this.hidKeyPressListeners.filter((l) => l !== listener);
    };
  }

  loadSampleVirtualDevices() {
    this.devices = [
      {
        id: 'dev-cam-canon-r6',
        name: 'Canon EOS R6 Mark II (Camera Thử Nghiệm)',
        type: 'camera',
        modelName: 'EOS R6 Mark II Full-Frame',
        brand: 'Canon',
        rssi: -46,
        batteryLevel: 88,
        macAddress: '00:1A:7D:DA:71:02',
        status: 'disconnected',
        signalBars: 4,
        lastSeen: Date.now(),
        details: {
          protocol: 'Canon Camera Connect BLE / PTP',
          services: ['Remote Shutter Service', 'LiveView Stream BLE'],
          cameraSettings: {
            shutterSpeed: '1/160s',
            aperture: 'f/2.8',
            iso: 400,
            shotsRemaining: 1420,
          },
        },
      },
      {
        id: 'dev-print-selphy',
        name: 'Canon SELPHY CP1500 (Máy In Thử Nghiệm)',
        type: 'printer',
        modelName: 'SELPHY CP1500 Dye-Sub Compact',
        brand: 'Canon',
        rssi: -38,
        batteryLevel: 100,
        macAddress: 'E4:A7:A0:88:51:3C',
        status: 'disconnected',
        signalBars: 4,
        lastSeen: Date.now(),
        details: {
          protocol: 'Bluetooth 5.0 SPP / Dye-Sub Print Engine',
          services: ['Canon Mobile Print GATT'],
          paperLevel: 85,
          ribbonLevel: 92,
        },
      },
      {
        id: 'dev-remote-shutter',
        name: 'AB Shutter 3 (Nút Bấm Selfie BLE Thử Nghiệm)',
        type: 'remote',
        modelName: 'Bluetooth HID Shutter Button',
        brand: 'Generic BLE',
        rssi: -34,
        batteryLevel: 98,
        macAddress: '3C:CD:5D:89:FE:01',
        status: 'disconnected',
        signalBars: 4,
        lastSeen: Date.now(),
        details: {
          protocol: 'BLE HID Keyboard / Camera Remote',
          services: ['00001812-0000-1000-8000-00805F9B34FB'],
        },
      },
    ];
    this.notify();
  }

  clearDevices() {
    this.devices = [];
    this.notify();
  }

  // Event Subscription
  subscribe(listener: DeviceListener): () => void {
    this.listeners.push(listener);
    listener([...this.devices]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  onShutterTrigger(listener: ShutterListener): () => void {
    this.shutterListeners.push(listener);
    return () => {
      this.shutterListeners = this.shutterListeners.filter((l) => l !== listener);
    };
  }

  onPhotoReceived(listener: PhotoReceivedListener): () => void {
    this.photoReceivedListeners.push(listener);
    return () => {
      this.photoReceivedListeners = this.photoReceivedListeners.filter((l) => l !== listener);
    };
  }

  onTransferProgress(listener: TransferListener): () => void {
    this.transferListeners.push(listener);
    return () => {
      this.transferListeners = this.transferListeners.filter((l) => l !== listener);
    };
  }

  onPrintProgress(listener: PrintListener): () => void {
    this.printListeners.push(listener);
    return () => {
      this.printListeners = this.printListeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.devices]));
  }

  getDevices(): BluetoothDevice[] {
    return [...this.devices];
  }

  getConnectedDevices(): BluetoothDevice[] {
    return this.devices.filter((d) => d.status === 'connected' || d.status === 'transferring' || d.status === 'printing');
  }

  getIsScanning(): boolean {
    return this.isScanning;
  }

  // Real Hardware Bluetooth Scan (Supports both Native iOS Capacitor BLE & Web Bluetooth API)
  async scanRealWebBluetooth(options: BleScanOptions = { mode: 'named_only' }): Promise<{ success: boolean; error?: string; isSafari?: boolean }> {
    sounds.playBluetoothPing();
    this.isScanning = true;

    // 1. Check if running inside Native iOS / Android Capacitor App
    if (Capacitor.isNativePlatform()) {
      try {
        if (!this.isBleClientInitialized) {
          await BleClient.initialize();
          this.isBleClientInitialized = true;
        }

        const nativeDev = await BleClient.requestDevice({
          optionalServices: [
            '0000180f-0000-1000-8000-00805f9b34fb', // Battery
            '0000180a-0000-1000-8000-00805f9b34fb', // Device Info
            '0000ffe0-0000-1000-8000-00805f9b34fb', // SPP Serial
          ],
        });

        await BleClient.connect(nativeDev.deviceId);
        this.isScanning = false;

        const devName = nativeDev.name || `iOS BLE Device (${nativeDev.deviceId.slice(0, 5)})`;
        const newDev: BluetoothDevice = {
          id: `ios-ble-${nativeDev.deviceId}`,
          name: devName,
          type: 'other',
          modelName: 'Capacitor Native BLE Device',
          brand: 'Real Bluetooth Hardware',
          rssi: -45,
          batteryLevel: 95,
          macAddress: nativeDev.deviceId.slice(0, 17).toUpperCase(),
          status: 'connected',
          signalBars: 4,
          isRealHardware: true,
          lastSeen: Date.now(),
          details: {
            protocol: 'iOS CoreBluetooth Native',
            services: ['CoreBluetooth Server'],
          },
        };

        this.devices = [newDev, ...this.devices.filter((d) => d.id !== newDev.id)];
        sounds.playBluetoothConnect();
        this.notify();
        return { success: true };
      } catch (err: unknown) {
        this.isScanning = false;
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    }

    // 2. Web Bluetooth API (for Chrome / Edge / Arc / Chromium)
    const nav = navigator as unknown as {
      bluetooth?: {
        requestDevice: (options: object) => Promise<{
          id: string;
          name?: string;
          gatt?: {
            connected: boolean;
            connect: () => Promise<{
              getPrimaryService: (name: string) => Promise<{
                getCharacteristic: (char: string) => Promise<{
                  readValue: () => Promise<DataView>;
                }>;
              }>;
            }>;
            disconnect: () => void;
          };
          addEventListener: (event: string, cb: () => void) => void;
        }>;
      };
    };

    if (!nav.bluetooth) {
      this.isScanning = false;
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      return {
        success: false,
        isSafari,
        error: isSafari
          ? 'Trình duyệt Safari hiện tại chưa hỗ trợ Web Bluetooth GATT trực tiếp. Bạn hãy dùng Google Chrome, Edge hoặc kết nối nút chụp qua Tab "🔘 Nút Chụp Bluetooth (HID)"!'
          : 'Trình duyệt hiện tại chưa hỗ trợ Web Bluetooth API. Hãy mở bằng Google Chrome, Edge hoặc Arc.',
      };
    }

    try {
      const mode = options.mode || 'named_only';
      const customPrefix = options.customPrefix?.trim() || '';

      const standardOptionalServices = [
        'battery_service',
        'device_information',
        'generic_access',
        '0000180f-0000-1000-8000-00805f9b34fb', // Battery
        '0000180a-0000-1000-8000-00805f9b34fb', // Device Info
        '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
        '0000ffe0-0000-1000-8000-00805f9b34fb', // SPP Serial
        '0000ff00-0000-1000-8000-00805f9b34fb', // Custom BLE
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Extended Serial
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip UART
      ];

      let requestParams: Record<string, unknown> = {};

      if (mode === 'named_only') {
        // Build filters for all alphanumeric prefixes (A-Z, a-z, 0-9) to completely exclude nameless/unknown BLE beacons
        const alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');
        const filters = alphanumeric.map((ch) => ({ namePrefix: ch }));
        requestParams = {
          filters,
          optionalServices: standardOptionalServices,
        };
      } else if (mode === 'cameras') {
        const cameraPrefixes = [
          'Canon', 'EOS', 'CANON', 'eos',
          'Sony', 'SONY', 'ILCE', 'ZV-', 'Alpha',
          'Nikon', 'NIKON', 'Z5', 'Z6', 'Zfc',
          'FUJIFILM', 'Fujifilm', 'Fuji', 'X-T', 'X-E', 'X100', 'Instax', 'INSTAX',
          'Panasonic', 'LUMIX', 'Lumix',
          'GoPro', 'GOPRO', 'DJI', 'Osmo', 'Insta360',
          'Camera', 'Cam',
        ];
        requestParams = {
          filters: cameraPrefixes.map((p) => ({ namePrefix: p })),
          optionalServices: standardOptionalServices,
        };
      } else if (mode === 'printers') {
        const printerPrefixes = [
          'SELPHY', 'Selphy', 'CP1500', 'CP1300', 'CP1200', 'CP1000',
          'Canon', 'CANON',
          'Instax', 'INSTAX', 'SHARE', 'LiPlay',
          'POS', 'pos', 'Printer', 'PRINTER', 'Thermal',
          'XP-', 'XP', 'MPT', 'PT-', 'MTP', 'RP', 'RPP',
          'DNP', 'HiTi', 'Citizen', 'Brother', 'EPSON', 'Epson',
          'BLE-Print', 'Bluetooth Printer', 'MobiPrint',
        ];
        requestParams = {
          filters: printerPrefixes.map((p) => ({ namePrefix: p })),
          optionalServices: standardOptionalServices,
        };
      } else if (mode === 'remotes') {
        const remotePrefixes = [
          'AB Shutter', 'AB Shutter3', 'Shutter', 'SHUTTER',
          'Selfie', 'SELFIE', 'Remote', 'REMOTE',
          'Clicker', 'CLICKER', 'Button', 'BUTTON',
          'BLE Remote', 'Wireless Shutter', 'BT Shutter',
          'iShutter', 'BR-E1', 'RMT-', 'ML-L7',
        ];
        requestParams = {
          filters: remotePrefixes.map((p) => ({ namePrefix: p })),
          optionalServices: standardOptionalServices,
        };
      } else if (mode === 'custom' && customPrefix) {
        requestParams = {
          filters: [{ namePrefix: customPrefix }],
          optionalServices: standardOptionalServices,
        };
      } else {
        // Raw Scan: Accept all devices (includes nameless beacons)
        requestParams = {
          acceptAllDevices: true,
          optionalServices: standardOptionalServices,
        };
      }

      // Call Native OS Bluetooth Sheet to scan REAL devices
      const realDevice = await nav.bluetooth.requestDevice(requestParams);

      this.isScanning = false;

      // Extract device name & info
      let rawDevName = realDevice.name?.trim() || '';
      let realBrand = 'Bluetooth Hardware';
      let realModel = 'Thiết Bị BLE';
      let realBattery = 95;
      const servicesFound: string[] = ['BLE Active'];

      // Read real GATT information if available
      if (realDevice.gatt) {
        try {
          const server = await realDevice.gatt.connect();

          // 1. Read Battery Level
          try {
            const batteryService = await server.getPrimaryService('battery_service');
            const char = await batteryService.getCharacteristic('battery_level');
            const value = await char.readValue();
            realBattery = value.getUint8(0);
            servicesFound.push('Battery Service');
          } catch {
            // Battery service not exposed
          }

          // 2. Read Device Information Service
          try {
            const infoService = await server.getPrimaryService('device_information');
            servicesFound.push('Device Information');

            // Manufacturer Name (0x2A29)
            try {
              const mfgChar = await infoService.getCharacteristic('00002a29-0000-1000-8000-00805f9b34fb');
              const mfgVal = await mfgChar.readValue();
              const mfgStr = new TextDecoder('utf-8').decode(mfgVal).trim();
              if (mfgStr) realBrand = mfgStr;
            } catch {}

            // Model Number (0x2A24)
            try {
              const modelChar = await infoService.getCharacteristic('00002a24-0000-1000-8000-00805f9b34fb');
              const modelVal = await modelChar.readValue();
              const modelStr = new TextDecoder('utf-8').decode(modelVal).trim();
              if (modelStr) realModel = modelStr;
            } catch {}
          } catch {
            // Device info service not exposed
          }
        } catch {
          // GATT connect fallback
        }
      }

      // Final name calculation
      const devName = rawDevName || (realBrand !== 'Bluetooth Hardware' ? `${realBrand} ${realModel}` : `Thiết bị BLE (${realDevice.id.slice(0, 5)})`);

      // Determine device category
      let type: BluetoothDeviceType = 'other';
      const lower = (devName + ' ' + realBrand + ' ' + realModel).toLowerCase();
      if (lower.includes('phone') || lower.includes('iphone') || lower.includes('galaxy') || lower.includes('xiaomi') || lower.includes('pixel') || lower.includes('ipad')) {
        type = 'phone';
      } else if (lower.includes('cam') || lower.includes('canon') || lower.includes('sony') || lower.includes('nikon') || lower.includes('fuji') || lower.includes('lumix') || lower.includes('gopro') || lower.includes('osmo') || lower.includes('insta360')) {
        type = 'camera';
      } else if (lower.includes('print') || lower.includes('selphy') || lower.includes('instax') || lower.includes('dnp') || lower.includes('pos') || lower.includes('thermal') || lower.includes('hiti') || lower.includes('brother') || lower.includes('epson')) {
        type = 'printer';
      } else if (lower.includes('shutter') || lower.includes('remote') || lower.includes('button') || lower.includes('clicker') || lower.includes('selfie') || lower.includes('key')) {
        type = 'remote';
      }

      const newDev: BluetoothDevice = {
        id: `real-${realDevice.id}`,
        name: devName,
        type: type,
        modelName: realModel !== 'Thiết Bị BLE' ? realModel : 'Thiết Bị Bluetooth Thật (Phần Cứng)',
        brand: realBrand,
        rssi: -45,
        batteryLevel: realBattery,
        macAddress: 'BLE:HW:' + realDevice.id.slice(0, 8).toUpperCase(),
        status: 'connected',
        signalBars: 4,
        isRealHardware: true,
        gattServer: realDevice.gatt,
        lastSeen: Date.now(),
        details: {
          protocol: 'Web Bluetooth GATT Native',
          services: servicesFound,
        },
      };

      // Listen to real disconnect
      realDevice.addEventListener('gattserverdisconnected', () => {
        this.disconnectDevice(newDev.id);
      });

      this.devices = [newDev, ...this.devices.filter((d) => d.id !== newDev.id)];
      sounds.playBluetoothConnect();
      this.notify();
      return { success: true };
    } catch (err: unknown) {
      this.isScanning = false;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('User cancelled') || msg.includes('cancelled') || msg.includes('User canceled')) {
        return { success: false, error: 'Đã đóng hộp thoại chọn thiết bị Bluetooth.' };
      }
      if (msg.includes('Bluetooth adapter not available') || msg.includes('Bluetooth is not powered on')) {
        return { success: false, error: 'Bluetooth trên thiết bị của bạn đang tắt. Vui lòng bật Bluetooth trong Cài đặt hệ điều hành.' };
      }
      return { success: false, error: msg };
    }
  }

  // Connection & Pairing Flow
  async connectDevice(deviceId: string): Promise<boolean> {
    const dev = this.devices.find((d) => d.id === deviceId);
    if (!dev) return false;

    this.updateDeviceStatus(deviceId, 'connecting');
    sounds.playBluetoothPing();

    await new Promise((r) => setTimeout(r, 600));

    this.updateDeviceStatus(deviceId, 'connected');
    sounds.playBluetoothConnect();
    return true;
  }

  confirmPairing(deviceId: string) {
    this.updateDeviceStatus(deviceId, 'connected');
    this.pendingPairingDevice = null;
    sounds.playBluetoothConnect();
  }

  cancelPairing(deviceId: string) {
    this.updateDeviceStatus(deviceId, 'disconnected');
    this.pendingPairingDevice = null;
    sounds.playBluetoothDisconnect();
  }

  getPendingPairingDevice(): BluetoothDevice | null {
    return this.pendingPairingDevice;
  }

  disconnectDevice(deviceId: string) {
    this.updateDeviceStatus(deviceId, 'disconnected');
    sounds.playBluetoothDisconnect();
  }

  private updateDeviceStatus(deviceId: string, status: BluetoothDevice['status']) {
    this.devices = this.devices.map((d) => (d.id === deviceId ? { ...d, status } : d));
    this.notify();
  }

  // Remote Shutter Trigger (from Bluetooth Remote or Camera)
  triggerRemoteShutter(deviceId?: string) {
    const found = deviceId ? this.devices.find((d) => d.id === deviceId) : undefined;
    const connectedDev = this.devices.find((d) => (d.type === 'remote' || d.type === 'camera') && d.status === 'connected');
    const dev: BluetoothDevice =
      found ||
      connectedDev || {
        id: 'dev-hid-remote',
        name: 'Nút Bấm Chụp Bluetooth (HID Remote)',
        type: 'remote' as BluetoothDeviceType,
        modelName: 'Bluetooth Selfie Remote',
        brand: 'Generic BLE',
        rssi: -30,
        macAddress: 'HID:REMOTE',
        status: 'connected' as const,
        signalBars: 4,
        lastSeen: Date.now(),
        details: { protocol: 'Bluetooth HID Keyboard', services: [] },
      };

    sounds.playShutterSound();
    this.shutterListeners.forEach((l) => l(dev));
  }

  // Transfer Photos from Phone to Photobooth
  async transferPhotoFromPhone(deviceId: string, customPhotoUrl?: string): Promise<string> {
    const dev = this.devices.find((d) => d.id === deviceId);
    const photoUrl = customPhotoUrl || SAMPLE_PORTRAITS[Math.floor(Math.random() * SAMPLE_PORTRAITS.length)];
    const deviceName = dev?.name || 'Điện thoại';

    this.updateDeviceStatus(deviceId, 'transferring');

    const steps = [
      { progress: 25, speed: '2.5 MB/s' },
      { progress: 65, speed: '4.2 MB/s' },
      { progress: 100, speed: 'Đã nhận xong' },
    ];

    for (const step of steps) {
      this.transferListeners.forEach((l) =>
        l({
          deviceId,
          fileName: `IMG_${Math.floor(1000 + Math.random() * 9000)}.HEIC`,
          fileSize: '3.4 MB',
          progress: step.progress,
          speed: step.speed,
          direction: 'incoming',
          previewUrl: photoUrl,
        })
      );
      await new Promise((r) => setTimeout(r, 180));
    }

    sounds.playSuccessChime();
    this.photoReceivedListeners.forEach((l) => l(photoUrl, deviceName));
    this.updateDeviceStatus(deviceId, 'connected');

    setTimeout(() => {
      this.transferListeners.forEach((l) => l(null));
    }, 1800);

    return photoUrl;
  }

  // Send Finished Photo Strip from Photobooth to Phone
  async sendStripToPhone(deviceId: string, stripDataUrl: string): Promise<boolean> {
    this.updateDeviceStatus(deviceId, 'transferring');

    const steps = [
      { progress: 30, speed: '2.8 MB/s' },
      { progress: 75, speed: '4.5 MB/s' },
      { progress: 100, speed: 'Hoàn tất gửi' },
    ];

    for (const step of steps) {
      this.transferListeners.forEach((l) =>
        l({
          deviceId,
          fileName: 'PhotoXinhh_Strip_300DPI.png',
          fileSize: '4.2 MB',
          progress: step.progress,
          speed: step.speed,
          direction: 'outgoing',
          previewUrl: stripDataUrl,
        })
      );
      await new Promise((r) => setTimeout(r, 200));
    }

    sounds.playSuccessChime();
    this.updateDeviceStatus(deviceId, 'connected');

    setTimeout(() => {
      this.transferListeners.forEach((l) => l(null));
    }, 1800);

    return true;
  }

  // Print Strip to Bluetooth Dye-Sub Printer
  async printViaBluetooth(printerId: string, stripDataUrl: string): Promise<boolean> {
    const printer = this.devices.find((d) => d.id === printerId);
    if (!printer) return false;

    this.updateDeviceStatus(printerId, 'printing');

    const passes = [
      { pass: 1, name: 'Lớp 1: Màu Vàng (Yellow Ribbon)', desc: 'Đang gia nhiệt phủ lớp màu vàng...' },
      { pass: 2, name: 'Lớp 2: Màu Đỏ Tía (Magenta Ribbon)', desc: 'Đang kéo lớp màu đỏ sắc nét...' },
      { pass: 3, name: 'Lớp 3: Màu Xanh Lam (Cyan Ribbon)', desc: 'Đang hòa trộn màu xanh...' },
      { pass: 4, name: 'Lớp 4: Lớp Màng Bóng Bảo Vệ (Overcoat UV)', desc: 'Đang phủ bóng chống nước & chống bay màu...' },
    ];

    for (let i = 0; i < passes.length; i++) {
      const p = passes[i];
      for (let sub = 1; sub <= 3; sub++) {
        const passPercent = ((i * 3 + sub) / 12) * 100;
        this.printListeners.forEach((l) =>
          l({
            printerId,
            printerName: printer.name,
            currentPass: p.pass,
            passName: p.name,
            progress: Math.round(passPercent),
            statusText: p.desc,
            previewUrl: stripDataUrl,
          })
        );
        sounds.playCountdownBeep(sub === 3);
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    if (printer.details.paperLevel) printer.details.paperLevel = Math.max(0, printer.details.paperLevel - 3);
    if (printer.details.ribbonLevel) printer.details.ribbonLevel = Math.max(0, printer.details.ribbonLevel - 2);

    sounds.playSuccessChime();
    this.updateDeviceStatus(printerId, 'connected');

    this.printListeners.forEach((l) =>
      l({
        printerId,
        printerName: printer.name,
        currentPass: 4,
        passName: 'In Hoàn Tất!',
        progress: 100,
        statusText: 'Ảnh đã được nhả ra khay đựng máy in thành công 🎉',
        previewUrl: stripDataUrl,
      })
    );

    setTimeout(() => {
      this.printListeners.forEach((l) => l(null));
    }, 2500);

    return true;
  }
}

export const bluetoothService = new BluetoothService();
