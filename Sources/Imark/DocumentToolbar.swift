import AppKit

private extension NSToolbarItem.Identifier {
    static let find = NSToolbarItem.Identifier("find")
    static let export = NSToolbarItem.Identifier("export")
    static let theme = NSToolbarItem.Identifier("theme")
    static let shortcuts = NSToolbarItem.Identifier("shortcuts")
}

extension DocumentWindowController: NSToolbarDelegate {
    func buildToolbar() {
        let toolbar = NSToolbar(identifier: "ImarkDocumentToolbar")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        window?.toolbar = toolbar
        window?.toolbarStyle = .unified
        // The system's own item arrives with a label and no tooltip, so it is the
        // one button in the row that answers nothing when you hover it.
        if let sidebar = toolbar.items.first(where: { $0.itemIdentifier == .toggleSidebar }) {
            sidebar.toolTip = "Show or Hide Sidebar (⌘\\)"
        }
    }

    public func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.toggleSidebar, .sidebarTrackingSeparator, .flexibleSpace, .theme, .find, .export]
    }

    public func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        toolbarDefaultItemIdentifiers(toolbar)
    }

    func refreshThemeButton() {
        let item = window?.toolbar?.items.first { $0.itemIdentifier == .theme }
        (item?.view as? ThemeButton)?.show(Settings.theme)
    }

    public func toolbar(
        _ toolbar: NSToolbar,
        itemForItemIdentifier identifier: NSToolbarItem.Identifier,
        willBeInsertedIntoToolbar flag: Bool
    ) -> NSToolbarItem? {
        switch identifier {
        case .find:
            return button(identifier, symbol: "magnifyingglass", label: "Find",
                          tip: "Find in Document (⌘F)",
                          action: #selector(performFind(_:)))

        case .shortcuts:
            // Target left nil so it walks the responder chain to the app
            // delegate: the panel belongs to the app, not to one document.
            let item = NSToolbarItem(itemIdentifier: identifier)
            item.image = NSImage(systemSymbolName: "keyboard", accessibilityDescription: "Keyboard Shortcuts")
            item.label = "Shortcuts"
            item.toolTip = "Keyboard Shortcuts (⌘/)"
            item.action = #selector(AppDelegate.showShortcuts(_:))
            return item

        case .export:
            // The share glyph promises a share sheet and opens the print panel
            // instead. Saying so is the cheap half of the fix; the icon is the
            // other half and belongs with whatever sharing ends up being.
            return button(identifier, symbol: "square.and.arrow.up", label: "Export",
                          tip: "Print or Save as PDF (⌘P)",
                          action: #selector(printDocument(_:)))

        case .theme:
            let item = NSToolbarItem(itemIdentifier: identifier)
            item.view = ThemeButton(target: self, action: #selector(cycleTheme(_:)))
            item.label = "Appearance"
            return item

        default:
            return nil
        }
    }

    private func button(
        _ identifier: NSToolbarItem.Identifier,
        symbol: String,
        label: String,
        tip: String? = nil,
        action: Selector
    ) -> NSToolbarItem {
        let item = NSToolbarItem(itemIdentifier: identifier)
        item.image = NSImage(systemSymbolName: symbol, accessibilityDescription: label)
        item.label = label
        item.toolTip = tip ?? label
        item.target = self
        item.action = action
        return item
    }
}
