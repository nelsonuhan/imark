<p align="center">
  <img src=".github/assets/app-icon.png" width="128" height="128" alt="Imark app icon">
</p>

<h1 align="center">Imark ®</h1>

<p align="center">
  <strong>Native Markdown reader for macOS.</strong><br><br>
  Double-click a <code>.md</code> file and it opens rendered, reloads itself while you<br>
  edit elsewhere, and previews in the Finder with the space bar. Nothing leaves<br>
  the machine, and nothing here writes to your files.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-14%2B-blue?style=flat-square" alt="macOS 14 or later">
  <img src="https://img.shields.io/badge/Swift-6-orange?style=flat-square" alt="Swift 6">
  <img src="https://img.shields.io/badge/network-update%20check%20only-brightgreen?style=flat-square" alt="Network: update check only, can be turned off">
  <img src="https://img.shields.io/badge/size-13%20MB-lightgrey?style=flat-square" alt="13 MB">
  <img src="https://img.shields.io/badge/licence-MIT-blue?style=flat-square" alt="MIT licence">
</p>

> [!NOTE]
> Imark reads. There is no editor mode, no annotation, and nothing on screen
> ever offers to change your file.

## What it does

- **Quick Look previews** — the space bar in the Finder renders the document, not raw text, using the same engine as the app
- **Live reload** — saving in your editor updates the view in under 300ms, keeping your scroll position, and it survives the delete-and-rename that editors call an atomic save
- **Foldable outline** — headings in the sidebar, with sections you can collapse; past twenty entries it opens folded, so a changelog is one row per version
- **Outline rail** — a tick per heading down the edge of every document, tapering around the pointer, with a card that names the section before you commit to going there
- **Wiki-links** — `[[note]]` resolves against the folder and opens in the same window, with back and forward history
- **Everything GitHub-flavoured** — tables, task lists, footnotes, front matter as a header card you can put away from the View menu, syntax highlighting, Mermaid diagrams, KaTeX maths
- **Find with a counter** — `⌘F` highlights every hit and tells you which one you are on
- **Tabs** — several documents in one window, with everything macOS gives a tabbed app: `⌘⇧[` and `⌘⇧]`, drag a tab out, Merge All Windows
- **Offline where it counts** — documents render with every request blocked by a content security policy, KaTeX fonts embedded, remote images refused on purpose

## Screenshots

| Document window | Quick Look preview |
|:---:|:---:|
| ![A document window with the outline sidebar and syntax-highlighted code](.github/assets/imark-window.png) | ![The Finder preview panel, with the outline rail down the left edge](.github/assets/imark-quicklook.png) |

Both are rendering [`testdata/showcase.md`](testdata/showcase.md). For the full
sweep — every construction, and enough headings that the outline folds itself —
open [`testdata/everything.md`](testdata/everything.md).

<p align="center">
  <img src=".github/assets/quicklook.gif" width="720" alt="Pressing the space bar in Finder and stepping through markdown files in the preview panel">
</p>

<p align="center"><em>Space bar in the Finder. No app to open first.</em></p>

<p align="center">
  <img src=".github/assets/imark-rail.png" width="520" alt="The rail tapering around the pointer, with a card naming the section and quoting its first line">
</p>

<p align="center"><em>The rail: one tick per heading, in the window and in the Finder's preview panel alike. Click to jump, or press and drag to scrub.</em></p>

## Install

```bash
brew install --cask migsilva89/imark/imark
```

Or download the [latest release](../../releases/latest) and drag `Imark.app` into `/Applications`. The disk image is signed and notarised, so it opens without a Gatekeeper warning.

macOS 14 or later. Imark tells you when a newer version exists — once per release, and only if you leave the check on in Settings.

To make it the default for `.md`: launch it with no document open and click **Make Imark the default for .md**, or use the same item in the **Imark** menu. Once it is the default, both quietly disappear.

## What it touches

| Where | What, and when |
|---|---|
| `~/Library/Preferences/pt.miguelsilva.imark.plist` | your settings — theme, text size, width, the update check |
| The network | one request a day to `api.github.com` asking whether a newer version exists. A version number travels, nothing of yours does, and Settings turns it off |

Imark never writes to the documents it opens.

## Keyboard shortcuts

| | | | |
|---|---|---|---|
| `⌘O` | Open | `⌘F` | Find, prefilled with the selection |
| `⌘W` | Close window | `⌘G` / `⌘⇧G` | Next / previous hit |
| `⌘\` | Toggle sidebar | `←` / `→` | Fold / unfold outline section |
| `⌘[` / `⌘]` | Back / forward | `⌘R` | Reload |
| `⌘+` / `⌘-` / `⌘0` | Text size | `⌘⇧R` | Reveal in Finder |
| `⌘P` | Print or export PDF | `⌘C` | Copy the selection |
| `⌘/` | This table, in the app | | |

`⌘/` opens the same list inside the app, built by reading the menu bar rather
than from a copy of this table — which is also how it stays right on keyboards
where macOS remaps the keys. On a Portuguese layout, Back and Forward are `⌘Ç`
and `⌘~`, not `⌘[` and `⌘]`.

## Building from source

Requires Xcode 16 or later and Node 20.

```bash
git clone https://github.com/migsilva89/imark.git
cd imark
cd renderer && npm ci && cd ..
./build.sh
```

That builds the JavaScript bundle, compiles the Swift, assembles `Imark.app` and
installs it to `/Applications`. `npm ci` is not optional: the rendered output is
generated, not committed, and `build.sh` refuses to assemble an app with a blank
window.

| | |
|---|---|
| `./build.sh` | build and install |
| `./build.sh --debug` | fast compile, for iterating |
| `./build.sh --no-install` | leave it in `dist/` |
| `IMARK_INSTALL_DIR=~/Applications ./build.sh` | install elsewhere |

Swift 6 with AppKit and no external Swift dependencies, around a WKWebView that
only ever renders; markdown-it, highlight.js, Mermaid and KaTeX are bundled
offline with esbuild. [`CONTRIBUTING.md`](CONTRIBUTING.md) has the layout of the
repository, the test suites and how to run them.

## FAQ

### Why does the Quick Look extension need the network entitlement?

It does not use the network. WebKit refuses to start its WebContent process
inside a sandboxed app extension without `com.apple.security.network.client`,
even when every byte is served from a local scheme. The panel stays blank without
it, with no error and no log entry.

## Security, contributing, licence

Imark is a personal project, maintained by one person. Issues get answered and
pull requests are welcome —
[`CONTRIBUTING.md`](CONTRIBUTING.md) says what is out of scope before you spend a
weekend on it — but there is no support promise and no release schedule. For
anything that looks like a security problem, [`SECURITY.md`](SECURITY.md) says
where to send it instead of the issue tracker.

Everything Imark bundles is permissive — MIT, ISC, BSD, Unlicense — with no
copyleft anywhere in the tree. Several require their copyright notice to travel
with the binary, so [`THIRD-PARTY.md`](THIRD-PARTY.md) is generated from what
esbuild actually put in the bundle, on every build, and the same list ships
inside the app: **Imark › About Imark** shows it.

Imark itself is [MIT](LICENSE) — use it, change it, redistribute it, just keep
the copyright notice.
