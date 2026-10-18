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

class MainViewController: CAPBridgeViewController, WKScriptMessageHandler, URLSessionDataDelegate, ICDeviceBrowserDelegate, ICCameraDeviceDelegate {
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
    }

    private func setupImageCaptureBrowser() {
        if deviceBrowser == nil {
            let browser = ICDeviceBrowser()
            browser.delegate = self
            browser.browsedDeviceTypeMask = [.camera]
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
            notifyJs(event: "__onSonyUsbDeviceDisconnected", payload: ["isConnected": false])
        }
    }

    // MARK: - ICCameraDeviceDelegate
    func deviceDidBecomeReady(_ device: ICDevice) {
        guard let camera = device as? ICCameraDevice else { return }
        CAPLog.print("⚡️ [Native Sony USB] Camera Session Ready: '\(camera.name ?? "")'")
        let payload: [String: Any] = [
            "name": camera.name ?? "Sony Camera",
            "isReady": true,
            "isUsbPtp": true
        ]
        notifyJs(event: "__onSonyUsbDeviceReady", payload: payload)
    }

    func didRemoveDevice(_ device: ICDevice) {
        if let camera = device as? ICCameraDevice, camera == self.connectedCamera {
            stopUsbLiveview()
            self.connectedCamera = nil
            notifyJs(event: "__onSonyUsbDeviceDisconnected", payload: ["isConnected": false])
        }
    }

    func cameraDevice(_ camera: ICCameraDevice, didAdd items: [ICCameraItem]) {
        CAPLog.print("⚡️ [Native Sony USB] Camera added \(items.count) item(s)")
        guard let lastItem = items.last as? ICCameraFile else { return }
        let ext = (lastItem.name ?? "").lowercased()
        if ext.hasSuffix(".jpg") || ext.hasSuffix(".jpeg") || ext.hasSuffix(".png") {
            CAPLog.print("📸 [Native Sony USB] New Photo file added: '\(lastItem.name ?? "")'")
            lastItem.requestThumbnailData(options: nil) { [weak self] (data, error) in
                if let photoData = data {
                    let base64 = photoData.base64EncodedString()
                    let dataUrl = "data:image/jpeg;base64,\(base64)"
                    DispatchQueue.main.async {
                        let js = "if(window.__onSonyUsbPhotoCaptured){window.__onSonyUsbPhotoCaptured('\(dataUrl)', '\(lastItem.name ?? "photo.jpg")');}"
                        self?.webView?.evaluateJavaScript(js, completionHandler: nil)
                    }
                }
            }
        }
    }

    // MARK: - USB PTP Live View & Shutter Control (Sony PC Remote Mechanism)
    private func startUsbLiveview() {
        guard let camera = self.connectedCamera else {
            CAPLog.print("⚡️ [Native Sony USB] Cannot start LiveView: No camera connected via USB")
            return
        }
        isPtpStreaming = true
        CAPLog.print("⚡️ [Native Sony USB] Starting USB PTP Live View polling...")
        pollNextPtpLiveviewFrame(camera: camera)
    }

    private func stopUsbLiveview() {
        isPtpStreaming = false
        isPtpPolling = false
        CAPLog.print("⚡️ [Native Sony USB] Stopped USB PTP Live View")
    }

    private func pollNextPtpLiveviewFrame(camera: ICCameraDevice) {
        guard isPtpStreaming, !isPtpPolling else { return }
        isPtpPolling = true

        // Build PTP GetObject container for virtual handle 0xFFFFC002 (Sony LiveView frame)
        let cmd = buildPtpCommand(opCode: 0x1009, param1: 0xFFFFC002)

        if #available(iOS 13.0, *) {
            camera.requestSendPTPCommand(cmd, outData: nil) { [weak self] (responseData, outData, error) in
                guard let self = self else { return }
                self.isPtpPolling = false

                if self.isPtpStreaming {
                    let dataToScan = (outData != nil && !outData!.isEmpty) ? outData! : responseData
                    if let jpeg = self.extractJpeg(from: dataToScan) {
                        let base64 = jpeg.base64EncodedString()
                        DispatchQueue.main.async {
                            let js = "if(window.__onSonyLiveviewFrame){window.__onSonyLiveviewFrame('data:image/jpeg;base64,\(base64)');}"
                            self.webView?.evaluateJavaScript(js, completionHandler: nil)
                        }
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

    private func buildPtpCommand(opCode: UInt16, param1: UInt32? = nil) -> Data {
        var data = Data()
        let paramCount: UInt32 = param1 != nil ? 1 : 0
        var length: UInt32 = 12 + (paramCount * 4) // PTP container header is 12 bytes
        var type: UInt16 = 1                       // Command block (0x0001)
        var op = opCode
        var txId = ptpTransactionId
        ptpTransactionId &+= 1

        data.append(Data(bytes: &length, count: 4))
        data.append(Data(bytes: &type, count: 2))
        data.append(Data(bytes: &op, count: 2))
        data.append(Data(bytes: &txId, count: 4))

        if var p1 = param1 {
            data.append(Data(bytes: &p1, count: 4))
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

        CAPLog.print("⚡️ [Native Sony USB] Triggering PTP Shutter...")
        // 1. Try standard requestTakePTPPhoto
        camera.requestTakePTPPhoto { [weak self] error in
            guard let self = self else { return }
            if let err = error {
                CAPLog.print("⚡️ [Native Sony USB] requestTakePTPPhoto error: \(err.localizedDescription), trying vendor PTP opcode 0x9207...")
                // Fallback to Sony PTP vendor opcode 0x9207 (Full press shutter)
                let pressCmd = self.buildPtpCommand(opCode: 0x9207, param1: 0x0002)
                if #available(iOS 13.0, *) {
                    camera.requestSendPTPCommand(pressCmd, outData: nil) { (_, _, _) in
                        // Release shutter after 200ms
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            let relCmd = self.buildPtpCommand(opCode: 0x9209, param1: 0x0002)
                            camera.requestSendPTPCommand(relCmd, outData: nil, completion: { _, _, _ in })
                        }
                    }
                }
            } else {
                CAPLog.print("✅ [Native Sony USB] Shutter triggered successfully via PTP!")
            }

            DispatchQueue.main.async {
                let js = "if(window.__onSonyUsbShutterResult){window.__onSonyUsbShutterResult(true, null);}"
                self.webView?.evaluateJavaScript(js, completionHandler: nil)
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
