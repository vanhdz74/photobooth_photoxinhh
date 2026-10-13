import UIKit
import WebKit
import Capacitor
import AVFoundation

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

class MainViewController: CAPBridgeViewController, WKScriptMessageHandler, URLSessionDataDelegate {
    private var streamSession: URLSession?
    private var streamTask: URLSessionDataTask?
    private var streamBuffer = Data()
    private var lastFrameTime: TimeInterval = 0
    private var isStreaming = false
    private var isHandlerRegistered = false
    private var isEvaluatingFrame = false

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        attachNativeHandler()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        attachNativeHandler()
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
        if discovery.devices.isEmpty {
            CAPLog.print("⚡️ [iOS Camera Hardware] ⚠️ Không tìm thấy bất kỳ camera nào trong hệ thống iOS!")
        }
        CAPLog.print("==============================================================")
        
        let responsePayload: [String: Any] = [
            "osVersion": osVersion,
            "deviceModel": deviceModel,
            "isOs17Plus": isOs17Plus,
            "devices": summary
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

        // Process Sony MJPEG packets:
        // Common Header: 8 bytes (0xFF, 0x01 = LiveView frame, 0x02 = Frame info)
        // Payload Header: 128 bytes (0x24 0x35 0x68 0x79 = "$5hy")
        //   Byte 12..14: JPEG size (24-bit uint, big-endian)
        //   Byte 15: Padding size
        // JPEG data: starts at offset 136, length is jpegSize
        // Padding: starts at offset 136 + jpegSize, length is paddingSize
        while streamBuffer.count >= 136 {
            let b0 = streamBuffer[0]
            let b1 = streamBuffer[1]

            if b0 == 0xFF && b1 == 0x01 {
                // Verify Sony start code "$5" at offset 8
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

                            // Throttle frame rate to ~25fps (0.038s) and ensure WebKit is not overloaded
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
                            // Wait for more data to complete current packet
                            break
                        }
                    }
                }
            } else if b0 == 0xFF && b1 == 0x02 {
                // Frame info packet
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

            // If packet header not matched, advance to next 0xFF
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
