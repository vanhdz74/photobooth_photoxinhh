import UIKit
import WebKit
import Capacitor
import AVFoundation
import ImageCaptureCore

class LeakAvoider: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?
    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
        super.init()
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

class MainViewController: CAPBridgeViewController, WKScriptMessageHandler, URLSessionDataDelegate, ICDeviceBrowserDelegate, ICDeviceDelegate, ICCameraDeviceDelegate {
    private var streamSession: URLSession?
    private var streamTask: URLSessionDataTask?
    private var streamBuffer = Data()
    private var lastFrameTime: TimeInterval = 0
    private var isStreaming = false
    private var isHandlerRegistered = false
    private var isEvaluatingFrame = false

    // MARK: - USB PTP Camera Bridge (ImageCaptureCore - Mechanism like Monitor+)
    private var deviceBrowser: ICDeviceBrowser?
    private var connectedCamera: ICCameraDevice?
    private var isPtpStreaming = false
    private var ptpTransactionId: UInt32 = 1
    private var isPtpPolling = false
    private var isSonyHandshakeCompleted = false
    private var isPerformingHandshake = false

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        attachNativeHandler()
        setupImageCaptureBrowser()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        attachNativeHandler()
        setupImageCaptureBrowser()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        attachNativeHandler()
    }

    private func attachNativeHandler() {
        guard let webView = self.webView else { return }
        let controller = webView.configuration.userContentController
        if !isHandlerRegistered {
            controller.removeScriptMessageHandler(forName: "sonyCameraNative")
            controller.add(LeakAvoider(delegate: self), name: "sonyCameraNative")
            isHandlerRegistered = true
            CAPLog.print("⚡️ [Native Sony] Registered 'sonyCameraNative' script handler successfully!")
        }
        
        // Notify JavaScript environment that native bridge is active
        DispatchQueue.main.async {
            webView.evaluateJavaScript("window.__sonyNativeAvailable = true;", completionHandler: nil)
        }

        // Re-sync connected camera status if camera is already detected before WebView finished loading
        if let cam = self.connectedCamera {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
                guard let self = self, let cam = self.connectedCamera else { return }
                let payload: [String: Any] = [
                    "name": cam.name ?? "Sony Camera",
                    "isConnected": true,
                    "isReady": true,
                    "isUsbPtp": true
                ]
                self.notifyJs(event: "__onSonyUsbDeviceConnected", payload: payload)
                self.notifyJs(event: "__onSonyUsbDeviceReady", payload: payload)
            }
        }
    }

    private func setupImageCaptureBrowser() {
        if deviceBrowser == nil {
            let browser = ICDeviceBrowser()
            browser.delegate = self
            if #available(iOS 15.2, *) {
                browser.browsedDeviceTypeMask = .camera
            }
            browser.start()
            self.deviceBrowser = browser
            CAPLog.print("⚡️ [Native Sony USB] Initialized ICDeviceBrowser for USB PTP cameras")
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "sonyCameraNative",
              let dict = message.body as? [String: Any],
              let action = dict["action"] as? String else {
            return
        }

        if action == "startLiveview", let urlString = dict["url"] as? String {
            var targetUrl = URL(string: urlString)
            if targetUrl == nil, let encoded = urlString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
                targetUrl = URL(string: encoded)
            }
            if let validUrl = targetUrl {
                startSonyLiveview(url: validUrl)
            } else {
                CAPLog.print("⚡️ [Native Sony LiveView] Invalid URL: \(urlString)")
            }
        } else if action == "stopLiveview" {
            stopSonyLiveview()
        } else if action == "checkUsbCameras" {
            checkNativeCameras()
        } else if action == "startUsbLiveview" {
            startUsbLiveview()
        } else if action == "stopUsbLiveview" {
            stopUsbLiveview()
        } else if action == "triggerUsbShutter" {
            triggerUsbShutter()
        }
    }

    // MARK: - ICDeviceBrowserDelegate
    func deviceBrowser(_ browser: ICDeviceBrowser, didAdd device: ICDevice, moreComing: Bool) {
        let devName = device.name ?? "Camera"
        CAPLog.print("⚡️ [Native Sony USB] Detected USB Device: '\(devName)'")
        if let camera = device as? ICCameraDevice {
            self.connectedCamera = camera
            camera.delegate = self
            camera.requestOpenSession()
            CAPLog.print("⚡️ [Native Sony USB] Opening PTP session for: '\(devName)'")
            
            let payload: [String: Any] = [
                "name": devName,
                "isConnected": true,
                "isUsbPtp": true
            ]
            notifyJs(event: "__onSonyUsbDeviceConnected", payload: payload)
        }
    }

    func deviceBrowser(_ browser: ICDeviceBrowser, didRemove device: ICDevice, moreGoing: Bool) {
        let devName = device.name ?? "Camera"
        CAPLog.print("⚡️ [Native Sony USB] Removed USB Device: '\(devName)'")
        if let camera = device as? ICCameraDevice, camera == self.connectedCamera {
            stopUsbLiveview()
            camera.requestCloseSession()
            self.connectedCamera = nil
            self.isSonyHandshakeCompleted = false
            self.isPerformingHandshake = false
            notifyJs(event: "__onSonyUsbDeviceDisconnected", payload: ["isConnected": false])
        }
    }

    // MARK: - ICDeviceDelegate
    func device(_ device: ICDevice, didOpenSessionWithError error: Error?) {
        if let error = error {
            CAPLog.print("⚡️ [Native Sony USB] Failed to open device session: \(error.localizedDescription)")
            return
        }
        CAPLog.print("⚡️ [Native Sony USB] Session opened successfully for: \(device.name ?? "Device")")
    }

    func device(_ device: ICDevice, didCloseSessionWithError error: Error?) {
        CAPLog.print("⚡️ [Native Sony USB] Session closed for: \(device.name ?? "Device")")
        self.isSonyHandshakeCompleted = false
        self.isPerformingHandshake = false
    }

    func didRemove(_ device: ICDevice) {
        if let camera = device as? ICCameraDevice, camera == self.connectedCamera {
            stopUsbLiveview()
            self.connectedCamera = nil
            self.isSonyHandshakeCompleted = false
            self.isPerformingHandshake = false
            notifyJs(event: "__onSonyUsbDeviceDisconnected", payload: ["isConnected": false])
        }
    }

    func deviceDidBecomeReady(_ device: ICDevice) {
        guard let camera = device as? ICCameraDevice else { return }
        CAPLog.print("⚡️ [Native Sony USB] Camera Session Ready: '\(camera.name ?? "")'")
        let payload: [String: Any] = [
            "name": camera.name ?? "Sony Camera",
            "isReady": true,
            "isUsbPtp": true
        ]
        notifyJs(event: "__onSonyUsbDeviceReady", payload: payload)
        notifyJs(event: "__onSonyUsbDeviceConnected", payload: payload)

        // Perform Sony PC Remote Handshake to unlock camera from "Connecting..." screen
        isPerformingHandshake = true
        performSonyHandshake(camera: camera) { [weak self] success in
            guard let self = self else { return }
            self.isSonyHandshakeCompleted = success
            self.isPerformingHandshake = false
            if success && self.isPtpStreaming, let cam = self.connectedCamera {
                CAPLog.print("⚡️ [Native Sony USB] Handshake hoàn tất -> Bắt đầu poll LiveView...")
                self.pollNextPtpLiveviewFrame(camera: cam)
            }
        }
    }

    // MARK: - ICCameraDeviceDelegate
    func cameraDevice(_ camera: ICCameraDevice, didAdd items: [ICCameraItem]) {
        CAPLog.print("⚡️ [Native Sony USB] Camera added \(items.count) item(s)")
        // Find latest JPEG/PNG photo
        let photoItems = items.compactMap { $0 as? ICCameraFile }.filter { item in
            let ext = (item.name ?? "").lowercased()
            return ext.hasSuffix(".jpg") || ext.hasSuffix(".jpeg") || ext.hasSuffix(".png")
        }
        guard let lastItem = photoItems.last ?? (items.last as? ICCameraFile) else { return }
        CAPLog.print("📸 [Native Sony USB] New Photo file added: '\(lastItem.name ?? "")'")
        self.fetchFullResolutionPhoto(file: lastItem)
    }

    private func fetchFullResolutionPhoto(file: ICCameraFile) {
        let filename = file.name ?? "sony_captured_\(Int(Date().timeIntervalSince1970)).jpg"
        let tempDir = FileManager.default.temporaryDirectory
        
        if #available(iOS 13.0, *) {
            let downloadOptions: [ICDownloadOption: Any] = [
                .downloadsDirectoryURL: tempDir,
                .overwrite: true
            ]
            file.requestDownload(options: downloadOptions) { [weak self] (downloadedFilename, error) in
                guard let self = self else { return }
                if let err = error {
                    CAPLog.print("⚠️ [Native Sony USB] requestDownload error: \(err.localizedDescription), trying high-res thumbnail...")
                    self.fetchThumbnailFallback(file: file)
                    return
                }
                
                let savedName = downloadedFilename ?? filename
                let fileUrl = tempDir.appendingPathComponent(savedName)
                CAPLog.print("📸 [Native Sony USB] Photo downloaded to temp: \(fileUrl.path)")
                
                if let data = try? Data(contentsOf: fileUrl) {
                    let optimized = self.optimizePhotoDataForWeb(data: data)
                    self.sendPhotoToJs(data: optimized, filename: savedName)
                    try? FileManager.default.removeItem(at: fileUrl)
                } else {
                    self.fetchThumbnailFallback(file: file)
                }
            }
        } else {
            self.fetchThumbnailFallback(file: file)
        }
    }

    private func fetchThumbnailFallback(file: ICCameraFile) {
        let filename = file.name ?? "sony_captured_\(Int(Date().timeIntervalSince1970)).jpg"
        if #available(iOS 13.0, *) {
            let options: [ICCameraItemThumbnailOption: Any] = [
                .imageSourceThumbnailMaxPixelSize: 2560
            ]
            file.requestThumbnailData(options: options) { [weak self] (data, _) in
                guard let self = self, let photoData = data else { return }
                let optimized = self.optimizePhotoDataForWeb(data: photoData)
                self.sendPhotoToJs(data: optimized, filename: filename)
            }
        } else {
            file.requestThumbnailData(options: nil) { [weak self] (data, _) in
                guard let self = self, let photoData = data else { return }
                let optimized = self.optimizePhotoDataForWeb(data: photoData)
                self.sendPhotoToJs(data: optimized, filename: filename)
            }
        }
    }

    private func optimizePhotoDataForWeb(data: Data) -> Data {
        guard let image = UIImage(data: data) else { return data }
        let maxDimension: CGFloat = 2560.0
        let size = image.size
        
        if size.width <= maxDimension && size.height <= maxDimension {
            return image.jpegData(compressionQuality: 0.92) ?? data
        }
        
        var targetSize = size
        if size.width > size.height {
            targetSize = CGSize(width: maxDimension, height: round((size.height / size.width) * maxDimension))
        } else {
            targetSize = CGSize(width: round((size.width / size.height) * maxDimension), height: maxDimension)
        }
        
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1.0
        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
        return resized.jpegData(compressionQuality: 0.92) ?? data
    }

    private func sendPhotoToJs(data: Data, filename: String) {
        let base64 = data.base64EncodedString()
        let dataUrl = "data:image/jpeg;base64,\(base64)"
        DispatchQueue.main.async { [weak self] in
            let js = "if(window.__onSonyUsbPhotoCaptured){window.__onSonyUsbPhotoCaptured('\(dataUrl)', '\(filename)');}"
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    func cameraDevice(_ camera: ICCameraDevice, didRemove items: [ICCameraItem]) {
        CAPLog.print("⚡️ [Native Sony USB] Camera removed \(items.count) item(s)")
    }

    func cameraDevice(_ camera: ICCameraDevice, didReceiveThumbnail thumbnail: CGImage?, for item: ICCameraItem, error: Error?) {
    }

    func cameraDevice(_ camera: ICCameraDevice, didReceiveMetadata metadata: [AnyHashable : Any]?, for item: ICCameraItem, error: Error?) {
    }

    func cameraDevice(_ camera: ICCameraDevice, didRenameItems items: [ICCameraItem]) {
    }

    func cameraDeviceDidChangeCapability(_ camera: ICCameraDevice) {
        CAPLog.print("⚡️ [Native Sony USB] Camera capability changed")
    }

    func cameraDevice(_ camera: ICCameraDevice, didReceivePTPEvent eventData: Data) {
    }

    func deviceDidBecomeReady(withCompleteContentCatalog device: ICCameraDevice) {
        CAPLog.print("⚡️ [Native Sony USB] Camera ready with complete content catalog: \(device.name ?? "")")
    }

    func cameraDeviceDidRemoveAccessRestriction(_ device: ICDevice) {
        CAPLog.print("⚡️ [Native Sony USB] Access restriction removed")
    }

    func cameraDeviceDidEnableAccessRestriction(_ device: ICDevice) {
        CAPLog.print("⚡️ [Native Sony USB] Access restriction enabled")
    }

    // MARK: - USB PTP Live View & Shutter Control (Sony PC Remote Mechanism)
    private func startUsbLiveview() {
        guard let camera = self.connectedCamera else {
            CAPLog.print("⚡️ [Native Sony USB] Cannot start LiveView: No camera connected via USB")
            return
        }
        isPtpStreaming = true
        CAPLog.print("⚡️ [Native Sony USB] Starting USB PTP Live View...")
        if isSonyHandshakeCompleted {
            pollNextPtpLiveviewFrame(camera: camera)
        } else if !isPerformingHandshake {
            isPerformingHandshake = true
            performSonyHandshake(camera: camera) { [weak self] success in
                guard let self = self else { return }
                self.isSonyHandshakeCompleted = success
                self.isPerformingHandshake = false
                if success && self.isPtpStreaming, let cam = self.connectedCamera {
                    CAPLog.print("⚡️ [Native Sony USB] Handshake hoàn tất -> Bắt đầu poll LiveView...")
                    self.pollNextPtpLiveviewFrame(camera: cam)
                }
            }
        } else {
            CAPLog.print("⚡️ [Native Sony USB] Handshake đang diễn ra, sẽ tự động bắt đầu stream khi xong.")
        }
    }

    private func stopUsbLiveview() {
        isPtpStreaming = false
        isPtpPolling = false
        CAPLog.print("⚡️ [Native Sony USB] Stopped USB PTP Live View")
    }

    // MARK: - Sony PC Remote Handshake (SDIOConnect 0x9201 Sequence)
    private func performSonyHandshake(camera: ICCameraDevice, completion: ((Bool) -> Void)? = nil) {
        CAPLog.print("⚡️ [Native Sony USB] Bắt đầu Sony PC Remote Handshake (SDIOConnect 0x9201)...")
        // Step 1: SDIOConnect(1, 0, 0)
        let step1 = buildPtpCommand(opCode: 0x9201, params: [0x00000001, 0x00000000, 0x00000000])
        camera.requestSendPTPCommand(step1, outData: nil) { [weak self] (_, _, err1) in
            guard let self = self else { return }
            if let e = err1 {
                CAPLog.print("⚡️ [Native Sony USB] Handshake step 1 (0x9201, 1) info: \(e.localizedDescription)")
            } else {
                CAPLog.print("⚡️ [Native Sony USB] Handshake step 1 (0x9201, 1) OK")
            }

            // Step 2: SDIOConnect(2, 0, 0)
            let step2 = self.buildPtpCommand(opCode: 0x9201, params: [0x00000002, 0x00000000, 0x00000000])
            camera.requestSendPTPCommand(step2, outData: nil) { [weak self] (_, _, err2) in
                guard let self = self else { return }
                if let e = err2 {
                    CAPLog.print("⚡️ [Native Sony USB] Handshake step 2 (0x9201, 2) info: \(e.localizedDescription)")
                } else {
                    CAPLog.print("⚡️ [Native Sony USB] Handshake step 2 (0x9201, 2) OK")
                }

                // Step 3: SDIOGetExtDeviceInfo(0xC8)
                let step3 = self.buildPtpCommand(opCode: 0x9202, params: [0x000000C8])
                camera.requestSendPTPCommand(step3, outData: nil) { [weak self] (_, _, err3) in
                    guard let self = self else { return }
                    if let e = err3 {
                        CAPLog.print("⚡️ [Native Sony USB] Handshake step 3 (0x9202, 0xC8) info: \(e.localizedDescription)")
                    } else {
                        CAPLog.print("⚡️ [Native Sony USB] Handshake step 3 (0x9202, 0xC8) OK")
                    }

                    // Step 4: SDIOConnect(3, 0, 0) - Finalize host PC remote connection
                    let step4 = self.buildPtpCommand(opCode: 0x9201, params: [0x00000003, 0x00000000, 0x00000000])
                    camera.requestSendPTPCommand(step4, outData: nil) { (_, _, err4) in
                        if let e = err4 {
                            CAPLog.print("⚡️ [Native Sony USB] Handshake step 4 (0x9201, 3) info: \(e.localizedDescription)")
                        } else {
                            CAPLog.print("✅ [Native Sony USB] Sony PC Remote Handshake HOÀN TẤT! Máy ảnh đã sẵn sàng chụp & LiveView.")
                        }
                        completion?(true)
                    }
                }
            }
        }
    }

    private func pollNextPtpLiveviewFrame(camera: ICCameraDevice) {
        guard isPtpStreaming, !isPtpPolling else { return }
        guard isSonyHandshakeCompleted else {
            CAPLog.print("⚡️ [Native Sony USB LiveView] Chờ hoàn tất handshake trước khi poll frame...")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
                guard let self = self, self.isPtpStreaming, let cam = self.connectedCamera else { return }
                self.pollNextPtpLiveviewFrame(camera: cam)
            }
            return
        }
        isPtpPolling = true

        // Build PTP GetObject container for virtual handle 0xFFFFC002 (Sony LiveView frame)
        let cmd = buildPtpCommand(opCode: 0x1009, params: [0xFFFFC002])

        if #available(iOS 13.0, *) {
            camera.requestSendPTPCommand(cmd, outData: nil) { [weak self] (inData, responseData, error) in
                guard let self = self else { return }
                self.isPtpPolling = false

                if let err = error {
                    CAPLog.print("⚡️ [Native Sony USB LiveView] Poll error: \(err.localizedDescription)")
                }

                if self.isPtpStreaming {
                    // inData: Data payload returned by camera containing JPEG bytes
                    // responseData: 12-byte PTP response packet
                    let dataToScan = inData.count > 100 ? inData : responseData
                    if let jpeg = self.extractJpeg(from: dataToScan) {
                        let base64 = jpeg.base64EncodedString()
                        DispatchQueue.main.async {
                            let js = "if(window.__onSonyLiveviewFrame){window.__onSonyLiveviewFrame('data:image/jpeg;base64,\(base64)');}"
                            self.webView?.evaluateJavaScript(js, completionHandler: nil)
                        }
                    } else if inData.count > 0 || responseData.count > 0 {
                        let hexPrefix = dataToScan.prefix(16).map { String(format: "%02X", $0) }.joined(separator: " ")
                        CAPLog.print("⚠️ [Native Sony USB LiveView] inData: \(inData.count)B, resp: \(responseData.count)B. First 16 bytes: \(hexPrefix)")
                    }

                    // Poll next frame after 35ms (~28 fps)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.035) { [weak self] in
                        guard let self = self, self.isPtpStreaming, let cam = self.connectedCamera else { return }
                        self.pollNextPtpLiveviewFrame(camera: cam)
                    }
                }
            }
        } else {
            isPtpPolling = false
        }
    }

    private func buildPtpCommand(opCode: UInt16, params: [UInt32] = []) -> Data {
        var data = Data()
        let paramCount = UInt32(params.count)
        var length: UInt32 = 12 + (paramCount * 4) // PTP container header is 12 bytes
        var type: UInt16 = 1                       // Command block (0x0001)
        var op = opCode
        var txId = ptpTransactionId
        ptpTransactionId &+= 1

        data.append(Data(bytes: &length, count: 4))
        data.append(Data(bytes: &type, count: 2))
        data.append(Data(bytes: &op, count: 2))
        data.append(Data(bytes: &txId, count: 4))

        for param in params {
            var p = param
            data.append(Data(bytes: &p, count: 4))
        }
        return data
    }

    private func extractJpeg(from data: Data) -> Data? {
        guard data.count > 100 else { return nil }
        var startIndex: Int?
        var endIndex: Int?

        data.withUnsafeBytes { rawBuffer in
            guard let ptr = rawBuffer.bindMemory(to: UInt8.self).baseAddress else { return }
            let count = data.count

            // Find SOI 0xFF, 0xD8
            for i in 0..<(count - 1) {
                if ptr[i] == 0xFF && ptr[i + 1] == 0xD8 {
                    startIndex = i
                    break
                }
            }

            guard let start = startIndex else { return }

            // Find EOI 0xFF, 0xD9
            var i = count - 2
            while i >= start {
                if ptr[i] == 0xFF && ptr[i + 1] == 0xD9 {
                    endIndex = i + 2
                    break
                }
                i -= 1
            }
        }

        guard let start = startIndex, let end = endIndex, end > start else { return nil }
        return data.subdata(in: start..<end)
    }

    private func triggerUsbShutter() {
        guard let camera = self.connectedCamera else {
            CAPLog.print("⚡️ [Native Sony USB] Cannot trigger shutter: No camera connected")
            let js = "if(window.__onSonyUsbShutterResult){window.__onSonyUsbShutterResult(false, 'Chưa kết nối máy ảnh qua cổng USB');}"
            webView?.evaluateJavaScript(js, completionHandler: nil)
            return
        }

        CAPLog.print("⚡️ [Native Sony USB] Triggering Sony PTP Shutter...")
        let pressCmd = buildPtpCommand(opCode: 0x9207, params: [0x00000002])
        if #available(iOS 13.0, *) {
            camera.requestSendPTPCommand(pressCmd, outData: nil) { [weak self] (_, _, error) in
                guard let self = self else { return }
                if let err = error {
                    CAPLog.print("⚡️ [Native Sony USB] Shutter press error: \(err.localizedDescription)")
                    DispatchQueue.main.async {
                        let js = "if(window.__onSonyUsbShutterResult){window.__onSonyUsbShutterResult(false, '\(err.localizedDescription)');}"
                        self.webView?.evaluateJavaScript(js, completionHandler: nil)
                    }
                } else {
                    CAPLog.print("✅ [Native Sony USB] Shutter triggered successfully via PTP!")
                    DispatchQueue.main.async {
                        let js = "if(window.__onSonyUsbShutterResult){window.__onSonyUsbShutterResult(true, null);}"
                        self.webView?.evaluateJavaScript(js, completionHandler: nil)
                    }
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
                    guard let self = self, let cam = self.connectedCamera else { return }
                    let relCmd = self.buildPtpCommand(opCode: 0x9209, params: [0x00000002])
                    cam.requestSendPTPCommand(relCmd, outData: nil) { _, _, _ in }
                }
            }
        }
    }

    private func notifyJs(event: String, payload: [String: Any]) {
        let jsonBytes = try? JSONSerialization.data(withJSONObject: payload, options: [])
        let jsonStr = jsonBytes != nil ? (String(data: jsonBytes!, encoding: .utf8) ?? "{}") : "{}"
        DispatchQueue.main.async { [weak self] in
            let js = "if(window.\(event)){window.\(event)(\(jsonStr));}"
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func checkNativeCameras() {
        CAPLog.print("================= 🔌 [NATIVE USB CAMERA CHECK] =================")
        let osVersion = UIDevice.current.systemVersion
        let deviceModel = UIDevice.current.model
        CAPLog.print("⚡️ [iOS System Info] Thiết bị: '\(deviceModel)', Phiên bản iOS: '\(osVersion)'")

        var isOs17Plus = false
        var deviceTypes: [AVCaptureDevice.DeviceType] = [
            .builtInWideAngleCamera
        ]
        if #available(iOS 17.0, *) {
            isOs17Plus = true
            deviceTypes.append(.external)
            let extSession = AVCaptureDevice.DiscoverySession(
                deviceTypes: [.external],
                mediaType: .video,
                position: .unspecified
            )
            CAPLog.print("⚡️ [iOS Camera Hardware] Quét riêng cổng Type-C (.external): tìm thấy \(extSession.devices.count) thiết bị UVC")
        } else {
            CAPLog.print("⚡️ [iOS Camera Hardware] ⚠️ CẢNH BÁO: Phiên bản iOS (\(osVersion)) < 17.0! Apple KHÔNG hỗ trợ UVC webcam trên iOS < 17!")
        }
        
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: deviceTypes,
            mediaType: .video,
            position: .unspecified
        )
        
        var summary: [[String: Any]] = []
        CAPLog.print("⚡️ [iOS Camera Hardware] Tìm thấy \(discovery.devices.count) thiết bị camera phần cứng từ AVFoundation:")
        for (idx, dev) in discovery.devices.enumerated() {
            var isExternal = false
            if #available(iOS 17.0, *) {
                isExternal = (dev.deviceType == .external)
            }
            let info = "[\(idx + 1)] Tên: '\(dev.localizedName)', Model: '\(dev.modelID)', External(USB): \(isExternal), Đang kết nối: \(dev.isConnected)"
            CAPLog.print("⚡️ [iOS Camera Hardware] \(info)")
            summary.append([
                "index": idx + 1,
                "name": dev.localizedName,
                "modelId": dev.modelID,
                "isExternal": isExternal,
                "isConnected": dev.isConnected,
                "deviceType": dev.deviceType.rawValue
            ])
        }

        var usbPtpCameraName: String? = nil
        var isUsbPtpConnected = false
        if let cam = self.connectedCamera {
            usbPtpCameraName = cam.name
            isUsbPtpConnected = true
        }

        CAPLog.print("==============================================================")
        
        let responsePayload: [String: Any] = [
            "osVersion": osVersion,
            "deviceModel": deviceModel,
            "isOs17Plus": isOs17Plus,
            "devices": summary,
            "usbPtpCamera": [
                "isConnected": isUsbPtpConnected,
                "name": usbPtpCameraName ?? ""
            ]
        ]
        
        let jsonBytes = try? JSONSerialization.data(withJSONObject: responsePayload, options: [])
        let jsonStr = jsonBytes != nil ? (String(data: jsonBytes!, encoding: .utf8) ?? "{}") : "{}"
        DispatchQueue.main.async { [weak self] in
            let js = "if(window.__onNativeCameraInspection){window.__onNativeCameraInspection(\(jsonStr));}"
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func startSonyLiveview(url: URL) {
        stopSonyLiveview()
        isStreaming = true
        CAPLog.print("⚡️ [Native Sony LiveView] Connecting to stream: \(url.absoluteString)")

        let sessionConfig = URLSessionConfiguration.ephemeral
        sessionConfig.timeoutIntervalForRequest = 30
        sessionConfig.timeoutIntervalForResource = 604800 // continuous stream
        sessionConfig.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("*/*", forHTTPHeaderField: "Accept")
        request.setValue("keep-alive", forHTTPHeaderField: "Connection")
        request.timeoutInterval = 30

        streamSession = URLSession(configuration: sessionConfig, delegate: self, delegateQueue: OperationQueue.main)
        streamTask = streamSession?.dataTask(with: request)
        streamTask?.resume()
    }

    private func stopSonyLiveview() {
        isStreaming = false
        streamTask?.cancel()
        streamTask = nil
        streamSession?.invalidateAndCancel()
        streamSession = nil
        streamBuffer.removeAll()
        isEvaluatingFrame = false
        CAPLog.print("⚡️ [Native Sony LiveView] Stream stopped.")
    }

    // MARK: - URLSessionDataDelegate
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        if let httpRes = response as? HTTPURLResponse {
            CAPLog.print("⚡️ [Native Sony LiveView] HTTP Response status: \(httpRes.statusCode)")
        }
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard isStreaming else { return }
        streamBuffer.append(data)

        while streamBuffer.count >= 136 {
            let b0 = streamBuffer[0]
            let b1 = streamBuffer[1]

            if b0 == 0xFF && b1 == 0x01 {
                if streamBuffer[8] == 0x24 && streamBuffer[9] == 0x35 {
                    let s0 = Int(streamBuffer[12])
                    let s1 = Int(streamBuffer[13])
                    let s2 = Int(streamBuffer[14])
                    let jpegSize = (s0 << 16) | (s1 << 8) | s2
                    let paddingSize = Int(streamBuffer[15])
                    let totalPacketSize = 136 + jpegSize + paddingSize

                    if jpegSize > 500 && jpegSize < 2_000_000 {
                        if streamBuffer.count >= totalPacketSize {
                            let jpegData = streamBuffer.subdata(in: 136..<(136 + jpegSize))
                            streamBuffer.removeSubrange(0..<totalPacketSize)

                            let now = Date().timeIntervalSince1970
                            if now - lastFrameTime >= 0.038 && !isEvaluatingFrame {
                                lastFrameTime = now
                                isEvaluatingFrame = true
                                let base64 = jpegData.base64EncodedString()

                                DispatchQueue.main.async { [weak self] in
                                    guard let self = self, self.isStreaming else { return }
                                    let js = "if(window.__onSonyLiveviewFrame){window.__onSonyLiveviewFrame('data:image/jpeg;base64,\(base64)');}"
                                    self.webView?.evaluateJavaScript(js) { _, _ in
                                        self.isEvaluatingFrame = false
                                    }
                                }
                            }
                            continue
                        } else {
                            break
                        }
                    }
                }
            } else if b0 == 0xFF && b1 == 0x02 {
                if streamBuffer[8] == 0x24 && streamBuffer[9] == 0x35 {
                    let infoSize = (Int(streamBuffer[12]) << 16) | (Int(streamBuffer[13]) << 8) | Int(streamBuffer[14])
                    let paddingSize = Int(streamBuffer[15])
                    let totalSize = 136 + infoSize + paddingSize
                    if streamBuffer.count >= totalSize {
                        streamBuffer.removeSubrange(0..<totalSize)
                        continue
                    } else {
                        break
                    }
                }
            }

            var syncIndex: Int?
            for i in 1..<streamBuffer.count {
                if streamBuffer[i] == 0xFF {
                    syncIndex = i
                    break
                }
            }

            if let idx = syncIndex {
                streamBuffer.removeSubrange(0..<idx)
            } else {
                streamBuffer.removeAll()
                break
            }
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if isStreaming, let err = error as NSError?, err.code != NSURLErrorCancelled {
            CAPLog.print("⚡️ [Native Sony LiveView] Stream error: \(err.localizedDescription)")
            DispatchQueue.main.async { [weak self] in
                let js = "if(window.__onSonyLiveviewError){window.__onSonyLiveviewError('\(err.localizedDescription)');}"
                self?.webView?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
