import AppKit
import Foundation
import Network
import WebKit

private let printURLScheme = "fountain-label-print"
private let printerSettingsMessageName = "printerSettings"
private let printJobMessageName = "printJob"
private let selectedPrinterDefaultsKey = "selectedPrinterName"
// WKWebViewのIndexedDBはポートを含むオリジン単位で保存されるため、
// このポートを固定してアプリの再起動・再ビルド後も作業履歴を引き継ぐ。
private let bundledWebServerPort = NWEndpoint.Port(rawValue: 47_831)!
private let bundledWebAppURL = URL(string: "http://127.0.0.1:47831/index.html")!

private struct PrintJob: Decodable {
  let version: Int
  let jobId: String
  let archiveName: String
  let pageCount: Int

  var isValid: Bool {
    guard version == 2,
      UUID(uuidString: jobId) != nil,
      (1...65_534).contains(pageCount)
    else {
      return false
    }
    return archiveName == "mclabel-\(jobId).zip"
  }
}

private struct PrintCommandResult {
  let output: String
  let terminationStatus: Int32
}

private struct PendingPrintJob {
  let jobId: String
  let jobJSON: String
  let pageCount: Int
}

private struct ActivePrintDownload {
  let job: PendingPrintJob
  let destination: URL
}

private enum PrintJobPhase: String {
  case prepared
  case saving
  case printing
  case completed
  case failed
}

private struct PrintJobState {
  let jobId: String
  var phase: PrintJobPhase
  var message: String
}

private final class BundledWebServer: @unchecked Sendable {
  private let listener: NWListener
  private let rootDirectory: URL
  private let queue = DispatchQueue(label: "jp.fountain.labelprint.web-server")
  private var reportedReady = false

  init(rootDirectory: URL) throws {
    self.rootDirectory = rootDirectory.standardizedFileURL
    let parameters = NWParameters.tcp
    parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: bundledWebServerPort)
    listener = try NWListener(using: parameters)
  }

  func start(onReady: @escaping @Sendable (Result<URL, Error>) -> Void) {
    listener.stateUpdateHandler = { [weak self] state in
      guard let self else { return }
      switch state {
      case .ready:
        guard !reportedReady else { return }
        reportedReady = true
        onReady(.success(bundledWebAppURL))
      case .failed(let error):
        guard !reportedReady else { return }
        reportedReady = true
        onReady(.failure(error))
      default:
        break
      }
    }
    listener.newConnectionHandler = { [weak self] connection in
      self?.receiveRequest(on: connection, accumulated: Data())
    }
    listener.start(queue: queue)
  }

  func stop() {
    listener.cancel()
  }

  private func receiveRequest(on connection: NWConnection, accumulated: Data) {
    connection.start(queue: queue)
    receiveMore(on: connection, accumulated: accumulated)
  }

  private func receiveMore(on connection: NWConnection, accumulated: Data) {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { [weak self] data, _, isComplete, error in
      guard let self else {
        connection.cancel()
        return
      }

      var requestData = accumulated
      if let data { requestData.append(data) }
      if requestData.range(of: Data("\r\n\r\n".utf8)) != nil {
        respond(to: requestData, on: connection)
        return
      }
      if error != nil || isComplete || requestData.count >= 65_536 {
        sendStatus(400, reason: "Bad Request", on: connection)
        return
      }
      receiveMore(on: connection, accumulated: requestData)
    }
  }

  private func respond(to requestData: Data, on connection: NWConnection) {
    guard let request = String(data: requestData, encoding: .utf8),
      let firstLine = request.components(separatedBy: "\r\n").first
    else {
      sendStatus(400, reason: "Bad Request", on: connection)
      return
    }

    let parts = firstLine.split(separator: " ", maxSplits: 2).map(String.init)
    guard parts.count == 3, ["GET", "HEAD"].contains(parts[0]),
      let components = URLComponents(string: "http://127.0.0.1\(parts[1])"),
      let decodedPath = components.percentEncodedPath.removingPercentEncoding
    else {
      sendStatus(400, reason: "Bad Request", on: connection)
      return
    }

    let relativePath = decodedPath == "/" ? "index.html" : String(decodedPath.dropFirst())
    let pathParts = relativePath.split(separator: "/", omittingEmptySubsequences: false)
    guard !relativePath.isEmpty,
      !pathParts.contains(where: { $0 == "." || $0 == ".." || $0.isEmpty })
    else {
      sendStatus(404, reason: "Not Found", on: connection)
      return
    }

    let fileURL = rootDirectory.appendingPathComponent(relativePath).standardizedFileURL
    let allowedPrefix = rootDirectory.path.hasSuffix("/") ? rootDirectory.path : rootDirectory.path + "/"
    guard fileURL.path.hasPrefix(allowedPrefix),
      let body = try? Data(contentsOf: fileURL, options: [.mappedIfSafe])
    else {
      sendStatus(404, reason: "Not Found", on: connection)
      return
    }

    let header = [
      "HTTP/1.1 200 OK",
      "Content-Type: \(mimeType(for: fileURL))",
      "Content-Length: \(body.count)",
      "Cache-Control: no-store",
      "Connection: close",
      "",
      "",
    ].joined(separator: "\r\n")
    var response = Data(header.utf8)
    if parts[0] == "GET" { response.append(body) }
    send(response, on: connection)
  }

  private func sendStatus(_ status: Int, reason: String, on connection: NWConnection) {
    let body = Data("\(status) \(reason)".utf8)
    let header = [
      "HTTP/1.1 \(status) \(reason)",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Length: \(body.count)",
      "Connection: close",
      "",
      "",
    ].joined(separator: "\r\n")
    var response = Data(header.utf8)
    response.append(body)
    send(response, on: connection)
  }

  private func send(_ response: Data, on connection: NWConnection) {
    connection.send(content: response, contentContext: .defaultStream, isComplete: true, completion: .contentProcessed { _ in
      connection.cancel()
    })
  }

  private func mimeType(for fileURL: URL) -> String {
    switch fileURL.pathExtension.lowercased() {
    case "html": "text/html; charset=utf-8"
    case "js": "text/javascript; charset=utf-8"
    case "css": "text/css; charset=utf-8"
    case "svg": "image/svg+xml"
    case "csv": "text/csv; charset=utf-8"
    case "json": "application/json"
    default: "application/octet-stream"
    }
  }
}

@MainActor
private final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate,
  WKDownloadDelegate, WKScriptMessageHandlerWithReply
{
  private var mainWindow: NSWindow?
  private var webView: WKWebView?
  private var webServer: BundledWebServer?
  private var runningProcesses: [ObjectIdentifier: Process] = [:]
  private var pendingPrintJobs: [String: PendingPrintJob] = [:]
  private var activePrintDownloads: [ObjectIdentifier: ActivePrintDownload] = [:]
  private var printJobStates: [String: PrintJobState] = [:]

  func applicationDidFinishLaunching(_ notification: Notification) {
    createMainWindow()
    registerURLHandler()
    loadBundledWebApp()

    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      CommandLine.arguments.dropFirst().compactMap(URL.init(string:)).forEach(self.handlePrintURL)
    }
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  func applicationWillTerminate(_ notification: Notification) {
    webServer?.stop()
  }

  func application(_ application: NSApplication, open urls: [URL]) {
    urls.forEach(handlePrintURL)
  }

  private func createMainWindow() {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    configuration.applicationNameForUserAgent = "LABELPRINT-MAC/1.0"
    configuration.preferences.isTextInteractionEnabled = true
    configuration.userContentController.addScriptMessageHandler(
      self,
      contentWorld: .page,
      name: printerSettingsMessageName
    )
    configuration.userContentController.addScriptMessageHandler(
      self,
      contentWorld: .page,
      name: printJobMessageName
    )

    let browser = WKWebView(frame: .zero, configuration: configuration)
    browser.navigationDelegate = self
    browser.uiDelegate = self
    browser.allowsMagnification = true

    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1180, height: 800),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false,
    )
    window.title = "LABEL PRINT"
    window.minSize = NSSize(width: 760, height: 600)
    window.contentView = browser
    window.isReleasedWhenClosed = false
    window.center()
    window.makeKeyAndOrderFront(nil)

    mainWindow = window
    webView = browser
  }

  private func loadBundledWebApp() {
    guard let webRoot = Bundle.main.resourceURL?.appendingPathComponent("WebApp", isDirectory: true),
      FileManager.default.fileExists(atPath: webRoot.path),
      FileManager.default.fileExists(atPath: webRoot.appendingPathComponent("index.html").path)
    else {
      showError("アプリ画面が見つかりません。LABEL PRINT.appを入れ直してください。")
      return
    }

    do {
      let server = try BundledWebServer(rootDirectory: webRoot)
      webServer = server
      server.start { [weak self] result in
        DispatchQueue.main.async {
          switch result {
          case .success(let url):
            self?.webView?.load(URLRequest(url: url))
          case .failure(let error):
            self?.showError("アプリ画面を開始できませんでした。\(error.localizedDescription)")
          }
        }
      }
    } catch {
      showError("アプリ画面を開始できませんでした。\(error.localizedDescription)")
    }
  }

  private func registerURLHandler() {
    NSAppleEventManager.shared().setEventHandler(
      self,
      andSelector: #selector(handleGetURLEvent(_:withReplyEvent:)),
      forEventClass: AEEventClass(kInternetEventClass),
      andEventID: AEEventID(kAEGetURL),
    )
  }

  @objc private func handleGetURLEvent(
    _ event: NSAppleEventDescriptor,
    withReplyEvent replyEvent: NSAppleEventDescriptor,
  ) {
    guard let value = event.paramDescriptor(forKeyword: AEKeyword(keyDirectObject))?.stringValue,
      let url = URL(string: value)
    else {
      showError("印刷アプリの起動URLを読み取れませんでした。")
      return
    }
    handlePrintURL(url)
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url else {
      decisionHandler(.cancel)
      return
    }

    if url.scheme == printURLScheme {
      handlePrintURL(url)
      decisionHandler(.cancel)
      return
    }

    if navigationAction.shouldPerformDownload {
      decisionHandler(.download)
      return
    }

    if navigationAction.targetFrame == nil, let scheme = url.scheme, ["http", "https"].contains(scheme) {
      NSWorkspace.shared.open(url)
      decisionHandler(.cancel)
      return
    }

    decisionHandler(.allow)
  }

  func webView(
    _ webView: WKWebView,
    navigationAction: WKNavigationAction,
    didBecome download: WKDownload
  ) {
    download.delegate = self
  }

  func webView(
    _ webView: WKWebView,
    navigationResponse: WKNavigationResponse,
    didBecome download: WKDownload
  ) {
    download.delegate = self
  }

  func download(
    _ download: WKDownload,
    decideDestinationUsing response: URLResponse,
    suggestedFilename: String,
    completionHandler: @escaping (URL?) -> Void
  ) {
    let safeName = URL(fileURLWithPath: suggestedFilename).lastPathComponent
    let fileName = safeName.isEmpty ? "LABEL-PRINT-download" : safeName
    guard let downloadsDirectory = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first else {
      if let pendingJob = pendingPrintJobs.removeValue(forKey: fileName) {
        updatePrintJobState(
          jobId: pendingJob.jobId,
          phase: .failed,
          message: "Downloadsフォルダを確認できないため、印刷ファイルを保存できませんでした。"
        )
      }
      showError("Downloadsフォルダを確認できないため、ファイルを保存できませんでした。")
      completionHandler(nil)
      return
    }

    let destination = availableDestination(in: downloadsDirectory, fileName: fileName)
    if let pendingJob = pendingPrintJobs.removeValue(forKey: fileName) {
      activePrintDownloads[ObjectIdentifier(download)] = ActivePrintDownload(
        job: pendingJob,
        destination: destination
      )
      updatePrintJobState(
        jobId: pendingJob.jobId,
        phase: .saving,
        message: "印刷ファイルを保存しています。"
      )
    }
    completionHandler(destination)
  }

  func downloadDidFinish(_ download: WKDownload) {
    guard let activeDownload = activePrintDownloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
    updatePrintJobState(
      jobId: activeDownload.job.jobId,
      phase: .printing,
      message: "mC-Label3へ印刷ジョブを送信しています。"
    )
    startPrint(
      jobId: activeDownload.job.jobId,
      jobJSON: activeDownload.job.jobJSON,
      pageCount: activeDownload.job.pageCount,
      archiveURL: activeDownload.destination
    )
  }

  func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
    let message = "印刷ファイルを保存できませんでした。\(error.localizedDescription)"
    if let activeDownload = activePrintDownloads.removeValue(forKey: ObjectIdentifier(download)) {
      updatePrintJobState(jobId: activeDownload.job.jobId, phase: .failed, message: message)
    }
    showError(message)
  }

  func webView(
    _ webView: WKWebView,
    runOpenPanelWith parameters: WKOpenPanelParameters,
    initiatedByFrame frame: WKFrameInfo,
    completionHandler: @escaping ([URL]?) -> Void
  ) {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = parameters.allowsDirectories
    panel.allowsMultipleSelection = parameters.allowsMultipleSelection
    if let mainWindow {
      panel.beginSheetModal(for: mainWindow) { response in
        completionHandler(response == .OK ? panel.urls : nil)
      }
    } else {
      completionHandler(panel.runModal() == .OK ? panel.urls : nil)
    }
  }

  private func availableDestination(in directory: URL, fileName: String) -> URL {
    let fileManager = FileManager.default
    let firstChoice = directory.appendingPathComponent(fileName)
    guard fileManager.fileExists(atPath: firstChoice.path) else { return firstChoice }

    let original = firstChoice.deletingPathExtension().lastPathComponent
    let pathExtension = firstChoice.pathExtension
    for index in 2...9_999 {
      let suffix = pathExtension.isEmpty ? "" : ".\(pathExtension)"
      let candidate = directory.appendingPathComponent("\(original) \(index)\(suffix)")
      if !fileManager.fileExists(atPath: candidate.path) { return candidate }
    }
    return directory.appendingPathComponent("\(UUID().uuidString)-\(fileName)")
  }

  private func handlePrintURL(_ url: URL) {
    guard url.scheme == printURLScheme, url.host == "print",
      let jobJSON = URLComponents(url: url, resolvingAgainstBaseURL: false)?
        .queryItems?
        .first(where: { $0.name == "job" })?
        .value
    else {
      showError("印刷アプリの起動URLが不正です。")
      return
    }

    guard let job = try? JSONDecoder().decode(PrintJob.self, from: Data(jobJSON.utf8)), job.isValid else {
      showError("印刷ジョブが不正です。アプリ画面を再読み込みして、もう一度印刷してください。")
      return
    }

    do {
      if let readinessError = try printerReadinessError() {
        showError(readinessError)
        return
      }
    } catch {
      showError("プリンターの状態を確認できませんでした。画面上部のプリンター診断を確認してください。")
      return
    }

    startPrint(jobId: job.jobId, jobJSON: jobJSON, pageCount: job.pageCount, archiveURL: nil)
  }

  private func startPrint(jobId: String, jobJSON: String, pageCount: Int, archiveURL: URL?) {
    guard let scriptURL = Bundle.main.url(forResource: "mclabel3-print", withExtension: "sh") else {
      let message = "印刷処理が見つかりません。LABEL PRINT.appを入れ直してください。"
      updatePrintJobState(jobId: jobId, phase: .failed, message: message)
      showError(message)
      return
    }

    updatePrintJobState(
      jobId: jobId,
      phase: .printing,
      message: "mC-Label3へ印刷ジョブを送信しています。"
    )

    let process = Process()
    let output = Pipe()
    process.executableURL = URL(fileURLWithPath: "/bin/zsh")
    process.arguments = [
      scriptURL.path,
      jobJSON,
      UserDefaults.standard.string(forKey: selectedPrinterDefaultsKey) ?? "",
      archiveURL?.path ?? "",
    ]
    process.standardOutput = output
    process.standardError = output

    let identifier = ObjectIdentifier(process)
    process.terminationHandler = { [weak self] finishedProcess in
      let data = output.fileHandleForReading.readDataToEndOfFile()
      let result = String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
      DispatchQueue.main.async {
        self?.runningProcesses.removeValue(forKey: identifier)
        let succeeded = finishedProcess.terminationStatus == 0 && result.hasPrefix("OK:")
        self?.updatePrintJobState(
          jobId: jobId,
          phase: succeeded ? .completed : .failed,
          message: result.isEmpty
            ? (succeeded ? "印刷ジョブを送信しました。" : "印刷処理の結果を取得できませんでした。")
            : result
        )
        self?.showPrintResult(result)
      }
    }

    do {
      runningProcesses[identifier] = process
      try process.run()
    } catch {
      runningProcesses.removeValue(forKey: identifier)
      let message = "印刷処理を開始できませんでした。\(error.localizedDescription)"
      updatePrintJobState(jobId: jobId, phase: .failed, message: message)
      showError(message)
    }
  }

  private func showPrintResult(_ result: String) {
    if result.hasPrefix("OK:") {
      showAlert(title: "印刷ジョブを送信しました", message: result)
      return
    }
    showError(result.isEmpty ? "印刷処理の結果を取得できませんでした。" : result)
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage,
    replyHandler: @escaping (Any?, String?) -> Void
  ) {
    if message.name == printJobMessageName {
      handlePrintJobMessage(message.body, replyHandler: replyHandler)
      return
    }

    guard message.name == printerSettingsMessageName,
      let body = message.body as? [String: Any],
      let action = body["action"] as? String
    else {
      replyHandler(nil, "プリンター設定の要求が不正です。")
      return
    }

    do {
      let printers = try registeredPrinters()
      switch action {
      case "list":
        replyHandler(printerSettingsPayload(printers: printers), nil)
      case "save":
        if let printerName = body["printerName"] as? String, !printerName.isEmpty {
          guard printers.contains(printerName) else {
            replyHandler(nil, "選択したプリンターがMacに登録されていません。")
            return
          }
          UserDefaults.standard.set(printerName, forKey: selectedPrinterDefaultsKey)
        } else if body["printerName"] is NSNull || body["printerName"] == nil {
          UserDefaults.standard.removeObject(forKey: selectedPrinterDefaultsKey)
        } else {
          replyHandler(nil, "保存するプリンター名が不正です。")
          return
        }
        replyHandler(printerSettingsPayload(printers: printers), nil)
      default:
        replyHandler(nil, "未対応のプリンター設定操作です。")
      }
    } catch {
      replyHandler(nil, error.localizedDescription)
    }
  }

  private func handlePrintJobMessage(
    _ value: Any,
    replyHandler: @escaping (Any?, String?) -> Void
  ) {
    guard let body = value as? [String: Any], let action = body["action"] as? String else {
      replyHandler(nil, "印刷処理の要求が不正です。アプリ画面を再読み込みしてください。")
      return
    }

    if action == "status" {
      guard let jobId = body["jobId"] as? String,
        UUID(uuidString: jobId) != nil,
        let state = printJobStates[jobId]
      else {
        replyHandler(nil, "印刷状況を確認できませんでした。アプリ画面を再読み込みしてください。")
        return
      }
      replyHandler(printJobStatusPayload(state), nil)
      return
    }

    guard action == "prepare",
      let jobValue = body["job"],
      JSONSerialization.isValidJSONObject(jobValue),
      let jobData = try? JSONSerialization.data(withJSONObject: jobValue),
      let job = try? JSONDecoder().decode(PrintJob.self, from: jobData),
      job.isValid,
      let jobJSON = String(data: jobData, encoding: .utf8)
    else {
      replyHandler(nil, "印刷ファイルの保存準備を開始できませんでした。アプリ画面を再読み込みしてください。")
      return
    }

    do {
      if let readinessError = try printerReadinessError() {
        replyHandler(nil, readinessError)
        return
      }
    } catch {
      replyHandler(nil, "プリンターの状態を確認できませんでした。画面上部のプリンター診断を確認してください。")
      return
    }

    pendingPrintJobs[job.archiveName] = PendingPrintJob(
      jobId: job.jobId,
      jobJSON: jobJSON,
      pageCount: job.pageCount
    )
    updatePrintJobState(
      jobId: job.jobId,
      phase: .prepared,
      message: "印刷ファイルの保存を待っています。"
    )
    replyHandler(["accepted": true], nil)
  }

  private func updatePrintJobState(jobId: String, phase: PrintJobPhase, message: String) {
    printJobStates[jobId] = PrintJobState(jobId: jobId, phase: phase, message: message)
  }

  private func printJobStatusPayload(_ state: PrintJobState) -> [String: Any] {
    [
      "jobId": state.jobId,
      "status": state.phase.rawValue,
      "message": state.message,
    ]
  }

  private func printerReadinessError() throws -> String? {
    let printers = try registeredPrinters()
    let selectedPrinter = UserDefaults.standard.string(forKey: selectedPrinterDefaultsKey)
    let diagnostic = printerDiagnostic(printers: printers, selectedPrinter: selectedPrinter)
    guard diagnostic["status"] as? String == "error" else { return nil }
    let summary = diagnostic["summary"] as? String ?? "プリンターの準備が完了していません"
    let detail = diagnostic["detail"] as? String ?? "画面上部のプリンター診断を確認してください。"
    return "\(summary)\n\(detail)"
  }

  private func registeredPrinters() throws -> [String] {
    let result = try runPrintCommand("/usr/bin/lpstat", arguments: ["-e"])
    guard result.terminationStatus == 0 else {
      throw NSError(
        domain: "jp.fountain.labelprint.printers",
        code: Int(result.terminationStatus),
        userInfo: [NSLocalizedDescriptionKey: "macOSのプリンター一覧を取得できませんでした。(result.output)"]
      )
    }
    return result.output
      .split(whereSeparator: \.isNewline)
      .map(String.init)
      .filter { !$0.isEmpty }
      .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
  }

  private func printerSettingsPayload(printers: [String]) -> [String: Any] {
    let selectedPrinter = UserDefaults.standard.string(forKey: selectedPrinterDefaultsKey)
    return [
      "printers": printers,
      "selectedPrinter": selectedPrinter ?? NSNull(),
      "diagnostic": printerDiagnostic(printers: printers, selectedPrinter: selectedPrinter),
    ]
  }

  private func printerDiagnostic(printers: [String], selectedPrinter: String?) -> [String: Any] {
    let automaticPrinters = printers.filter { $0.uppercased().contains("MCL32") }
    let targetPrinter: String

    if let selectedPrinter, !selectedPrinter.isEmpty {
      guard printers.contains(selectedPrinter) else {
        return diagnosticPayload(
          status: "error",
          code: "selectedPrinterMissing",
          printerName: selectedPrinter,
          summary: "保存したプリンターが見つかりません",
          detail: "保存済みの印刷先が、このMacの登録済みプリンター一覧にありません。",
          checks: unavailablePrinterChecks(
            queueDetail: "\(selectedPrinter) が登録されていません。",
            selectionDetail: "保存済みの印刷先を使用できません。"
          ),
          setupSteps: [
            "プリンターの電源とUSB接続を確認してください。",
            "Macの「システム設定」→「プリンタとスキャナ」でmC-Label3を追加してください。",
            "別名で登録されている場合は、上の印刷先メニューからそのプリンターを選び直してください。",
          ]
        )
      }
      targetPrinter = selectedPrinter
    } else {
      if printers.isEmpty {
        return diagnosticPayload(
          status: "error",
          code: "noPrinters",
          printerName: nil,
          summary: "プリンターのセットアップが必要です",
          detail: "このMacに登録済みのプリンターがありません。",
          checks: unavailablePrinterChecks(
            queueDetail: "macOSにプリンターが登録されていません。",
            selectionDetail: "自動検出する対象がありません。"
          ),
          setupSteps: [
            "Star MicronicsのmC-Label3用macOSドライバーをインストールしてください。",
            "Macの「システム設定」→「プリンタとスキャナ」でmC-Label3を追加してください。",
            "追加後、この画面の「更新」を押してください。",
          ]
        )
      }
      if automaticPrinters.isEmpty {
        return diagnosticPayload(
          status: "error",
          code: "automaticPrinterMissing",
          printerName: nil,
          summary: "mC-Label3を自動検出できません",
          detail: "登録済みプリンターはありますが、名前にMCL32を含む印刷先がありません。",
          checks: unavailablePrinterChecks(
            queueDetail: "登録済みプリンターは\(printers.count)台あります。",
            selectionDetail: "自動検出の条件（名前にMCL32を含む1台）を満たしていません。"
          ),
          setupSteps: [
            "上の印刷先メニューから、mC-Label3として登録したプリンターを選択してください。",
            "候補がない場合は、mC-Label3用ドライバーをインストールしてプリンターを追加してください。",
          ]
        )
      }
      if automaticPrinters.count > 1 {
        return diagnosticPayload(
          status: "error",
          code: "multipleAutomaticPrinters",
          printerName: nil,
          summary: "印刷先を選択してください",
          detail: "mC-Label3候補が\(automaticPrinters.count)台あるため、自動では決められません。",
          checks: unavailablePrinterChecks(
            queueDetail: "mC-Label3候補を\(automaticPrinters.count)台検出しました。",
            selectionDetail: "自動検出では印刷先を1台に絞れません。"
          ),
          setupSteps: ["上の印刷先メニューから、使用するプリンターを1台選択してください。"]
        )
      }
      targetPrinter = automaticPrinters[0]
    }

    let selectedAutomatically = selectedPrinter == nil || selectedPrinter?.isEmpty == true
    var checks: [[String: Any]] = [
      diagnosticCheck(
        id: "queue",
        label: "プリンター登録",
        status: "pass",
        detail: "\(targetPrinter) をmacOSで確認しました。"
      ),
      diagnosticCheck(
        id: "selection",
        label: "印刷先の決定",
        status: "pass",
        detail: selectedAutomatically ? "MCL32を含む1台を自動選択します。" : "このMacに保存した印刷先を使用します。"
      ),
    ]

    let optionResult: PrintCommandResult
    do {
      optionResult = try runPrintCommand("/usr/bin/lpoptions", arguments: ["-p", targetPrinter, "-l"])
    } catch {
      checks.append(diagnosticCheck(
        id: "driver",
        label: "プリンタードライバー",
        status: "fail",
        detail: "プリンタードライバーの情報を読み取れませんでした。"
      ))
      checks.append(diagnosticCheck(
        id: "customPageSize",
        label: "可変ラベルサイズ",
        status: "pending",
        detail: "ドライバーを確認できないため未判定です。"
      ))
      return diagnosticPayload(
        status: "error",
        code: "printerOptionsUnavailable",
        printerName: targetPrinter,
        summary: "プリンタードライバーを確認できません",
        detail: "macOSからプリンター固有の印刷設定を取得できませんでした。",
        checks: checks,
        setupSteps: driverSetupSteps()
      )
    }

    guard optionResult.terminationStatus == 0, !optionResult.output.isEmpty else {
      checks.append(diagnosticCheck(
        id: "driver",
        label: "プリンタードライバー",
        status: "fail",
        detail: "プリンタードライバーの詳細設定を取得できませんでした。"
      ))
      checks.append(diagnosticCheck(
        id: "customPageSize",
        label: "可変ラベルサイズ",
        status: "pending",
        detail: "ドライバーを確認できないため未判定です。"
      ))
      return diagnosticPayload(
        status: "error",
        code: "printerOptionsUnavailable",
        printerName: targetPrinter,
        summary: "プリンタードライバーの再設定が必要です",
        detail: "印刷先は登録されていますが、対応するPPD・印刷オプションを取得できません。",
        checks: checks,
        setupSteps: driverSetupSteps()
      )
    }

    let options = optionResult.output
    let supportsCustomPageSize = options.contains("Custom.WIDTHxHEIGHT")
    let hasMCL32Name = targetPrinter.uppercased().contains("MCL32")
    let hasStarDriverSignature = optionSupports(options, name: "PrintDensity", value: nil)
      && optionSupports(options, name: "PageType", value: nil)
      && optionSupports(options, name: "DocCutType", value: nil)
    let likelyMCL32 = hasMCL32Name || hasStarDriverSignature
    let supportsMonochrome = optionSupports(options, name: "Halftoning", value: "1Monochrome")
    let supportsLowSpeed = optionSupports(options, name: "PrintSpeed", value: "2Low")

    checks.append(diagnosticCheck(
      id: "driver",
      label: "プリンタードライバー",
      status: "pass",
      detail: "PPD・印刷オプションを取得できました。"
    ))
    checks.append(diagnosticCheck(
      id: "model",
      label: "mC-Label3互換性",
      status: likelyMCL32 ? "pass" : "warning",
      detail: likelyMCL32
        ? "プリンター名とドライバー設定からmC-Label3として確認できました。"
        : "選択したプリンターがmC-Label3か確認できません。"
    ))
    checks.append(diagnosticCheck(
      id: "customPageSize",
      label: "可変ラベルサイズ",
      status: supportsCustomPageSize ? "pass" : "fail",
      detail: supportsCustomPageSize
        ? "ラベルごとに異なる用紙サイズを指定できます。"
        : "ラベルごとに用紙サイズを変える機能に対応していません。"
    ))

    let acceptingResult = try? runPrintCommand("/usr/bin/lpstat", arguments: ["-a", targetPrinter])
    let acceptingOutput = acceptingResult?.output.lowercased() ?? ""
    let acceptingJobs = acceptingResult?.terminationStatus == 0
      && !acceptingOutput.isEmpty
      && !containsAny(acceptingOutput, markers: ["not accepting", "受け付けていません", "受付を停止", "拒否"])
    checks.append(diagnosticCheck(
      id: "acceptingJobs",
      label: "印刷ジョブの受付",
      status: acceptingJobs ? "pass" : "fail",
      detail: acceptingJobs ? "macOSは印刷データを受け付けています。" : "macOSが印刷データを受け付けていません。"
    ))

    let stateResult = try? runPrintCommand("/usr/bin/lpstat", arguments: ["-p", targetPrinter])
    let stateOutput = stateResult?.output.lowercased() ?? ""
    let printerEnabled = stateResult?.terminationStatus == 0
      && !stateOutput.isEmpty
      && !containsAny(stateOutput, markers: ["disabled", "無効", "一時停止", "停止中"])
    checks.append(diagnosticCheck(
      id: "enabled",
      label: "プリンターキュー",
      status: printerEnabled ? "pass" : "fail",
      detail: printerEnabled ? "プリンターキューは有効です。" : "プリンターキューが停止または無効になっています。"
    ))
    checks.append(diagnosticCheck(
      id: "monochrome",
      label: "モノクロ印刷（推奨）",
      status: supportsMonochrome ? "pass" : "warning",
      detail: supportsMonochrome ? "モノクロ印刷を指定できます。" : "推奨するモノクロ印刷設定を確認できません。"
    ))
    checks.append(diagnosticCheck(
      id: "lowSpeed",
      label: "低速印刷（推奨）",
      status: supportsLowSpeed ? "pass" : "warning",
      detail: supportsLowSpeed ? "低速印刷を指定できます。" : "推奨する低速印刷設定を確認できません。"
    ))

    if !supportsCustomPageSize {
      return diagnosticPayload(
        status: "error",
        code: "customPageSizeUnsupported",
        printerName: targetPrinter,
        summary: "このドライバーでは直接印刷できません",
        detail: "ラベルごとに異なる高さを印刷するための用紙サイズ設定に対応していません。",
        checks: checks,
        setupSteps: driverSetupSteps()
      )
    }
    if !acceptingJobs || !printerEnabled {
      return diagnosticPayload(
        status: "error",
        code: "printerQueueUnavailable",
        printerName: targetPrinter,
        summary: "プリンターキューを再開してください",
        detail: "ドライバーは対応していますが、現在は印刷ジョブを送信できない状態です。",
        checks: checks,
        setupSteps: [
          "Macの「システム設定」→「プリンタとスキャナ」で対象プリンターを開いてください。",
          "停止中のジョブを確認し、プリンターキューを再開してください。",
          "プリンターの電源とUSB接続を確認してから「更新」を押してください。",
        ]
      )
    }
    if !likelyMCL32 || !supportsMonochrome || !supportsLowSpeed {
      return diagnosticPayload(
        status: "warning",
        code: "readyWithWarnings",
        printerName: targetPrinter,
        summary: "印刷可能（確認事項あり）",
        detail: "直接印刷の必須条件は満たしていますが、mC-Label3向け推奨設定の一部を確認できません。",
        checks: checks,
        setupSteps: [
          "選択した印刷先がmC-Label3であることを確認してください。",
          "印字品質に問題がある場合は、Star MicronicsのmC-Label3用ドライバーを入れ直してください。",
        ]
      )
    }

    return diagnosticPayload(
      status: "ready",
      code: "ready",
      printerName: targetPrinter,
      summary: "印刷準備OK",
      detail: "アプリの直接印刷に必要なキュー・ドライバー・可変用紙設定を確認できました。",
      checks: checks,
      setupSteps: []
    )
  }

  private func runPrintCommand(_ executablePath: String, arguments: [String]) throws -> PrintCommandResult {
    let process = Process()
    let output = Pipe()
    process.executableURL = URL(fileURLWithPath: executablePath)
    process.arguments = arguments
    process.standardOutput = output
    process.standardError = output
    var environment = ProcessInfo.processInfo.environment
    environment["LANG"] = "C"
    environment["LC_ALL"] = "C"
    process.environment = environment
    try process.run()
    let data = output.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    return PrintCommandResult(
      output: String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines),
      terminationStatus: process.terminationStatus
    )
  }

  private func optionSupports(_ options: String, name: String, value: String?) -> Bool {
    for line in options.split(whereSeparator: \.isNewline) {
      let text = String(line)
      guard text.hasPrefix("\(name)/"), let separator = text.firstIndex(of: ":") else { continue }
      guard let value else { return true }
      return text[text.index(after: separator)...]
        .split(whereSeparator: \.isWhitespace)
        .map { String($0).replacingOccurrences(of: "*", with: "") }
        .contains(value)
    }
    return false
  }

  private func containsAny(_ text: String, markers: [String]) -> Bool {
    markers.contains { text.contains($0) }
  }

  private func unavailablePrinterChecks(queueDetail: String, selectionDetail: String) -> [[String: Any]] {
    [
      diagnosticCheck(id: "queue", label: "プリンター登録", status: "fail", detail: queueDetail),
      diagnosticCheck(id: "selection", label: "印刷先の決定", status: "fail", detail: selectionDetail),
      diagnosticCheck(id: "driver", label: "プリンタードライバー", status: "pending", detail: "印刷先が決まってから確認します。"),
      diagnosticCheck(id: "customPageSize", label: "可変ラベルサイズ", status: "pending", detail: "ドライバーを取得してから確認します。"),
    ]
  }

  private func driverSetupSteps() -> [String] {
    [
      "Star MicronicsのmC-Label3用macOSドライバーをインストールしてください。",
      "Macの「システム設定」→「プリンタとスキャナ」で、現在の印刷先を削除して追加し直してください。",
      "追加時にmC-Label3用ドライバーが選ばれていることを確認し、この画面の「更新」を押してください。",
    ]
  }

  private func diagnosticCheck(id: String, label: String, status: String, detail: String) -> [String: Any] {
    ["id": id, "label": label, "status": status, "detail": detail]
  }

  private func diagnosticPayload(
    status: String,
    code: String,
    printerName: String?,
    summary: String,
    detail: String,
    checks: [[String: Any]],
    setupSteps: [String]
  ) -> [String: Any] {
    [
      "status": status,
      "code": code,
      "printerName": printerName ?? NSNull(),
      "summary": summary,
      "detail": detail,
      "checks": checks,
      "setupSteps": setupSteps,
    ]
  }

  private func showError(_ message: String) {
    showAlert(title: "処理できませんでした", message: message)
  }

  private func showAlert(title: String, message: String) {
    let alert = NSAlert()
    alert.messageText = title
    alert.informativeText = message
    alert.alertStyle = title == "印刷ジョブを送信しました" ? .informational : .warning
    if let mainWindow, mainWindow.isVisible {
      alert.beginSheetModal(for: mainWindow)
    } else {
      alert.runModal()
    }
    NSApp.activate(ignoringOtherApps: true)
  }
}

MainActor.assumeIsolated {
  let application = NSApplication.shared
  let appDelegate = AppDelegate()
  application.delegate = appDelegate
  application.setActivationPolicy(.regular)
  application.run()
}
