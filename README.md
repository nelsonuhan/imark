> [!NOTE]
> This is a personal fork of [Imark](https://github.com/migsilva89/imark),
> stripped down to just a Markdown renderer/reader. Gone: the editor mode,
> comments/annotations, the agent-review workflow, the sidebar's file browser,
> the outline rail, Quick Look, wiki-links, and tabs. What's left: rendering,
> a collapsible outline, live reload, and find.

<p align="center">
  <img src=".github/assets/app-icon.png" width="128" height="128" alt="imark app icon">
</p>

<h1 align="center">imark ®</h1>

<p align="center">
  <strong>Native Markdown reader for macOS.</strong><br><br>
  Double-click a <code>.md</code> file and it opens rendered, reloading itself<br>
  while you edit elsewhere. Nothing leaves the machine, and nothing here<br>
  writes to your files.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-14%2B-blue?style=flat-square" alt="macOS 14 or later">
  <img src="https://img.shields.io/badge/Swift-6-orange?style=flat-square" alt="Swift 6">
  <img src="https://img.shields.io/badge/network-update%20check%20only-brightgreen?style=flat-square" alt="Network: update check only, can be turned off">
  <img src="https://img.shields.io/badge/size-13%20MB-lightgrey?style=flat-square" alt="13 MB">
  <img src="https://img.shields.io/badge/licence-MIT-blue?style=flat-square" alt="MIT licence">
</p>

> [!NOTE]
> imark reads. There is no editor mode, no annotation, and nothing on screen
> ever offers to change your file.

## What it does

- **Live reload** — saving in your editor updates the view in under 300ms, keeping your scroll position, and it survives the delete-and-rename that editors call an atomic save
- **Foldable outline** — headings in the sidebar, with sections you can collapse; past twenty entries it opens folded, so a changelog is one row per version
- **Local links** — a relative link to another `.md` opens in the same window, with back and forward history
- **Everything GitHub-flavoured** — tables, task lists, footnotes, front matter as a header card you can put away from the View menu, syntax highlighting, Mermaid diagrams, KaTeX maths
- **Find with a counter** — `⌘F` highlights every hit and tells you which one you are on
- **Offline where it counts** — documents render with every request blocked by a content security policy, KaTeX fonts embedded, remote images refused on purpose

## Screenshots

> [!NOTE]
> The screenshot below is from before this fork's stripping pass and still
> shows the file browser, the editor toggle, and the outline rail — all gone
> now, along with Quick Look, which is what the rest of the old screenshots
> showed. Pending a retake.

<p align="center">
  <img src=".github/assets/imark-window.png" width="720" alt="A document window with the outline sidebar and syntax-highlighted code">
</p>

Rendering [`testdata/showcase.md`](testdata/showcase.md). For the full sweep —
every construction, and enough headings that the outline folds itself — open
[`testdata/everything.md`](testdata/everything.md).

## Install

```bash
brew install --cask nelsonuhan/tap/imark
```

> Once the tap exists — see [RELEASING.md](RELEASING.md) for how it gets set up.

Or build from source (below) and drag `imark.app` into `/Applications`.

macOS 14 or later. imark tells you when a newer version exists — once per release, and only if you leave the check on in Settings.

To make it the default for `.md`: launch it with no document open and click **Make imark the default for .md**, or use the same item in the **imark** menu. Once it is the default, both quietly disappear.

## What it touches

| Where | What, and when |
|---|---|
| `~/Library/Preferences/pt.miguelsilva.imark.plist` | your settings — theme, text size, width, the update check |
| The network | one request a day to `api.github.com` asking whether a newer version exists. A version number travels, nothing of yours does, and Settings turns it off |

imark never writes to the documents it opens.

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

That builds the JavaScript bundle, compiles the Swift, assembles `imark.app` and
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

## Security, contributing, licence

imark is a personal project, maintained by one person. Issues get answered and
pull requests are welcome —
[`CONTRIBUTING.md`](CONTRIBUTING.md) says what is out of scope before you spend a
weekend on it — but there is no support promise and no release schedule. For
anything that looks like a security problem, [`SECURITY.md`](SECURITY.md) says
where to send it instead of the issue tracker.

Everything imark bundles is permissive — MIT, ISC, BSD, Unlicense — with no
copyleft anywhere in the tree. Several require their copyright notice to travel
with the binary, so [`THIRD-PARTY.md`](THIRD-PARTY.md) is generated from what
esbuild actually put in the bundle, on every build, and the same list ships
inside the app: **imark › About imark** shows it.

imark itself is [MIT](LICENSE) — use it, change it, redistribute it, just keep
the copyright notice.
