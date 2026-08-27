import AppKit
import ImarkRender

final class DocumentWindowController: NSWindowController, NSWindowDelegate {
    private(set) var url: URL
    var onClose: (() -> Void)?

    private let split = NSSplitViewController()
    private let sidebar = SidebarViewController()
    let content = ContentViewController()
    private var sidebarItem: NSSplitViewItem!

    private var watcher: FileWatcher?
    private var back: [URL] = []
    private var forward: [URL] = []

    /// Documents past this size would lock the web view up; render a prefix and
    /// say so instead of beachballing.
    private static let sizeLimit = 5 * 1_024 * 1_024

    init(url: URL) {
        self.url = url

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1_140, height: 800),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        // The document runs the full height of the window and slides under the
        // toolbar, which carries its own blur. A solid strip cuts a reading
        // window in two; a blurred one says there is more page up there.
        window.titlebarAppearsTransparent = true
        // Obeys "prefer tabs when opening documents", which is somebody's
        // stated preference and not ours to override. It only governs windows
        // the system groups on its own: ⌘-clicking a file in the sidebar asks
        // for its tab outright, and that still works at every setting. What
        // this gives up is Finder double-clicks tabbing for people who left
        // the preference on its default of full screen only.
        window.tabbingMode = .automatic
        // Every document window joins the same group. Without an identifier
        // macOS groups by class name, which happens to work here and would stop
        // working the moment a second kind of window wanted tabs.
        window.tabbingIdentifier = "ImarkDocument"

        super.init(window: window)

        sidebarItem = NSSplitViewItem(sidebarWithViewController: sidebar)
        sidebarItem.minimumThickness = 260
        sidebarItem.maximumThickness = 420
        sidebarItem.preferredThicknessFraction = 0.26
        sidebarItem.canCollapse = true
        sidebarItem.isCollapsed = Settings.sidebarCollapsed

        split.addSplitViewItem(sidebarItem)
        split.addSplitViewItem(NSSplitViewItem(viewController: content))

        // Assigning a content view controller resizes the window to the view's
        // fitting size, which for autolayout-only views is nothing. Restore a
        // real size first, then let the autosaved frame win if there is one.
        window.contentViewController = split
        window.minSize = NSSize(width: 680, height: 420)
        window.setContentSize(NSSize(width: 1_140, height: 800))
        window.center()
        window.setFrameAutosaveName("ImarkDocument")
        window.delegate = self

        // Settings belong to the app, not to a window. Applying them where they
        // were changed left every other open document on the old value until it
        // happened to re-render.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(settingsChanged),
            name: Settings.changed,
            object: nil
        )

        buildToolbar()

        content.onMessage = { [weak self] in self?.handle($0) }
        content.onFindClosed = { [weak self] in
            self?.window?.makeFirstResponder(self?.content.renderer)
        }

        sidebar.onSelectHeading = { [weak self] id in self?.content.renderer.scrollTo(anchor: id) }

        applySettings()

        show(url, pushingHistory: false)

        // Without this nothing holds focus and the arrow keys do nothing until
        // you click into the document first.
        DispatchQueue.main.async { [weak self] in self?.content.renderer.focus() }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("not supported") }

    // MARK: - Loading

    func show(_ target: URL, pushingHistory: Bool) {
        if pushingHistory {
            back.append(url)
            forward.removeAll()
        }
        url = target
        window?.title = target.lastPathComponent
        window?.representedURL = target
        content.setStatus(path: target)
        // One document's folded sections should not carry over to the next.
        sidebar.resetOutlineState()
        load()

        watcher = FileWatcher(url: target) { [weak self] event in
            guard let self else { return }
            switch event {
            case .changed:
                self.load()
                self.content.flashReloaded()
            case .vanished:
                self.showVanished()
            }
        }
    }

    private func load() {
        guard let source = try? String(contentsOf: url, encoding: .utf8) else {
            content.renderer.render(
                markdown: "# Can't read this file\n\n`\(url.path)`\n\nIt exists, but it isn't UTF-8 text.",
                path: url.path
            )
            return
        }
        var text = source

        if text.utf8.count > Self.sizeLimit {
            let prefix = String(decoding: Array(text.utf8.prefix(Self.sizeLimit)), as: UTF8.self)
            text = prefix + "\n\n---\n\n> **Truncated.** Above 5 MB imark shows only the beginning."
        }

        content.renderer.render(markdown: text, path: url.path)
    }

    private func showVanished() {
        content.renderer.render(
            markdown: "# This file no longer exists\n\n`\(url.path)`",
            path: url.path
        )
    }

    // MARK: - Messages

    private func handle(_ message: RendererMessage) {
        switch message {
        case .toc(let entries):
            sidebar.update(toc: entries)

        case .active(let id):
            sidebar.setActive(id)

        case .meta(let words, let minutes):
            content.setStatus(words: words, minutes: minutes)

        case .wikilinks(let targets):
            let dead = targets.filter { LinkRouter.resolveWiki($0, from: url) == nil }
            if !dead.isEmpty { content.renderer.markMissingWikiLinks(dead) }

        case .openExternal(let target):
            NSWorkspace.shared.open(target)

        case .openLocal(let path):
            let target = URL(fileURLWithPath: path)
            if MarkdownType.matches(target), FileManager.default.fileExists(atPath: path) {
                show(target, pushingHistory: true)
            } else {
                NSWorkspace.shared.activateFileViewerSelecting([target])
            }

        case .openWiki(let name):
            if let target = LinkRouter.resolveWiki(name, from: url) {
                show(target, pushingHistory: true)
            } else {
                NSSound.beep()
            }

        case .ready, .rendered, .find:
            break
        }
    }

    // MARK: - Actions

    @objc func reloadDocument(_ sender: Any?) { load() }

    @objc func goBack(_ sender: Any?) {
        guard let previous = back.popLast() else { return NSSound.beep() }
        forward.append(url)
        show(previous, pushingHistory: false)
    }

    @objc func goForward(_ sender: Any?) {
        guard let next = forward.popLast() else { return NSSound.beep() }
        back.append(url)
        show(next, pushingHistory: false)
    }

    @objc func toggleSidebar(_ sender: Any?) {
        sidebarItem.animator().isCollapsed.toggle()
        Settings.sidebarCollapsed = sidebarItem.isCollapsed
    }

    /// Gives the tab bar its + button and ⌘T. Without it macOS shows tabs but
    /// no way to open another one, which reads as a broken tab bar.
    override func newWindowForTab(_ sender: Any?) {
        (NSApp.delegate as? AppDelegate)?.openDocument(sender)
    }

    /// Whatever is selected goes into the search field. Selecting a phrase and
    /// pressing ⌘F only ever meant one thing, and typing it again was the app
    /// ignoring what you had already told it.
    @objc func performFind(_ sender: Any?) {
        content.showFind()
    }

    func validateMenuItem(_ item: NSMenuItem) -> Bool {
        switch item.action {
        case #selector(chooseWidth(_:)):
            item.state = (item.representedObject as? String) == Settings.width.rawValue ? .on : .off
            return true
        case #selector(toggleFrontMatter(_:)):
            item.state = Settings.showsFrontMatter ? .on : .off
            return true
        default:
            return true
        }
    }

    @objc func findNext(_ sender: Any?) { content.findNext() }

    @objc func findPrevious(_ sender: Any?) { content.findPrevious() }

    @objc func increaseText(_ sender: Any?) { setTextScale(Settings.textScale + 1) }

    @objc func decreaseText(_ sender: Any?) { setTextScale(Settings.textScale - 1) }

    @objc func resetText(_ sender: Any?) { setTextScale(Settings.defaultTextScale) }

    private func setTextScale(_ value: Double) {
        Settings.textScale = value
        content.renderer.setTextScale(Settings.textScale)
    }

    @objc func chooseWidth(_ sender: NSMenuItem) {
        guard let width = Settings.Width(rawValue: sender.representedObject as? String ?? "") else { return }
        Settings.width = width
        content.renderer.setWidth(width.rawValue)
    }

    /// Shows or hides the card the front matter is drawn in. The document is not
    /// rendered again: the page only stops drawing the card, so the file, its
    /// line numbers and every note anchored in it stay exactly as they were.
    @objc func toggleFrontMatter(_ sender: Any?) {
        Settings.showsFrontMatter.toggle()
    }

    /// System → Light → Dark → System. The button announces the change, every
    /// window hears it, and each one moves its own glyph.
    @objc func cycleTheme(_ sender: Any?) {
        Settings.theme = Settings.theme.next
        Settings.applyThemeToApp()
    }

    @objc func printDocument(_ sender: Any?) {
        guard let window else { return }
        let info = NSPrintInfo.shared
        info.topMargin = 36
        info.bottomMargin = 36
        info.leftMargin = 36
        info.rightMargin = 36
        content.renderer.printOperation(with: info)
            .runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil)
    }

    @objc func revealInFinder(_ sender: Any?) {
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    // MARK: - NSWindowDelegate

    @objc private func settingsChanged() { applySettings() }

    /// Everything the page takes from the settings, in one place, so a window
    /// opened now and a window opened an hour ago cannot disagree.
    private func applySettings() {
        content.renderer.palettes = (
            light: Settings.palette.face(dark: false),
            dark: Settings.palette.face(dark: true)
        )
        content.renderer.applyTheme()
        content.renderer.setTextScale(Settings.textScale)
        content.renderer.setWidth(Settings.width.rawValue)
        content.renderer.setFrontMatter(Settings.showsFrontMatter)
        refreshThemeButton()
    }

    func windowWillClose(_ notification: Notification) {
        NotificationCenter.default.removeObserver(self)
        watcher = nil
        onClose?()
    }
}
