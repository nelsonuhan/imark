# Contributing

Imark is one person's app. Issues get answered; pull requests are welcome but
please open an issue first, so nobody spends a weekend on something I was never
going to merge.

## Bugs

Anything that damages a document comes first. Everything else, use the [bug
report form](https://github.com/migsilva89/imark/issues/new?template=bug_report.yml)
— the version and the macOS version save a round trip.

## Before a pull request

Run the suites. `./release.sh` refuses to build if any of them fail, so a change
that breaks one cannot ship anyway.

```bash
node Support/test-math.mjs
swiftc -parse-as-library Sources/Imark/Updates.swift Sources/Imark/Settings.swift \
  Support/test-update.swift -o /tmp/imark-test-update && /tmp/imark-test-update
```

## Where things are

```
Sources/Imark/           the app
Sources/ImarkQuickLook/  the Quick Look extension
Sources/ImarkRender/     the renderer both of them share
renderer/                JavaScript source
Resources/               build output — not edited by hand
Support/                 Info.plist, entitlements, generators, and tests
testdata/                documents that exercise the renderer
```

The renderer is the only part that knows how to turn Markdown into anything. The
Swift side handles windows, files and navigation, and talks to it in messages
over a private `imark://` scheme, so images beside a document load without
opening `file://` to the page. There is no `.xcodeproj`: Swift Package Manager
compiles it and `build.sh` assembles the `.app`.

The app icon is drawn in code from the rules in the design document:

```bash
swift Support/make-icon.swift
```

Two helpers exist for looking at the UI without photographing the whole desktop.
`Support/shoot.swift` renders a page in an off-screen web view, and
`Support/window-id.swift` resolves a window id so a screenshot can be taken of
one window:

```bash
screencapture -x -o -l"$(swift Support/window-id.swift Imark)" shot.png
```

## What this is not

- **Not an editor.** Imark reads, and writes nothing to your files.
- **Not cross-platform.** It is AppKit and a WebView, and the Quick Look
  extension only exists on macOS.
- **Not a vault.** No database, no index, no folder structure it insists on.

Changes that pull in any of those three directions are not going to be merged,
however well they are written.
