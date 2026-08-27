import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'
import deflist from 'markdown-it-deflist'
import mark from 'markdown-it-mark'
import hljs from 'highlight.js'
import { load as parseYaml } from 'js-yaml'
import katex from 'katex'
import mermaid from 'mermaid'

import math from './math.js'
import wikilink from './wikilink.js'
import './style.css'

const bridge = (payload) => {
  window.webkit?.messageHandlers?.imark?.postMessage(payload)
}

/* ------------------------------------------------------------------ paths */

// Absolute path of the directory holding the document currently rendered.
let docDir = '/'

function normalizePath(path) {
  const parts = path.split('/')
  const out = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return '/' + out.join('/')
}

function resolveLocal(href) {
  const path = href.startsWith('/') ? href : `${docDir}/${href}`
  return normalizePath(decodeURI(path))
}

// Local files are served by a WKURLSchemeHandler on the Swift side so that
// images next to the document load without granting file:// access.
const fileURL = (absPath) => `imark://file${absPath.split('/').map(encodeURIComponent).join('/')}`

const isExternal = (href) => /^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('imark:')

/* ----------------------------------------------------------------- parser */

const slugCounts = new Map()

function slugify(text) {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[̀-ͯ]/g, '')
      .normalize('NFD')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-') || 'section'
  const seen = slugCounts.get(base) ?? 0
  slugCounts.set(base, seen + 1)
  return seen === 0 ? base : `${base}-${seen}`
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
      } catch {
        /* fall through to auto */
      }
    }
    try {
      return hljs.highlightAuto(code).value
    } catch {
      return ''
    }
  },
})

md.use(anchor, { slugify, permalink: false, tabIndex: false })
  .use(taskLists, { enabled: true, label: true })
  .use(footnote)
  .use(deflist)
  .use(mark)
  .use(wikilink)

// Every block token knows which lines of the source produced it, stamped onto
// the DOM as `data-line`.
// The front matter is stripped before parsing, so markdown-it counts from the
// body while the file counts from the top. Everything it reports is short by
// however many lines the front matter took.
let lineOffset = 0

const stampLines = (token) => {
  if (!token.map) return
  token.attrSet('data-line', `${token.map[0] + lineOffset},${token.map[1] + lineOffset}`)
}

// For the blocks whose HTML is built by hand below, which never reach
// renderToken and so have to be given the same attribute themselves.
const lineAttr = (token) =>
  token.map ? ` data-line="${token.map[0] + lineOffset},${token.map[1] + lineOffset}"` : ''

// Down here rather than in the chain above only because it needs lineAttr.
md.use(math, { lines: lineAttr })

const defaultRenderToken = md.renderer.renderToken.bind(md.renderer)
md.renderer.renderToken = (tokens, idx, options) => {
  if (tokens[idx].nesting !== -1) stampLines(tokens[idx])
  return defaultRenderToken(tokens, idx, options)
}

/**
 * A ```diff block, rendered the way everybody already reads a diff: the whole
 * row tinted rather than just the `+` or the `-`, with the old and new line
 * numbers down the side.
 *
 * highlight.js colours the marker character and leaves the rest of the line on
 * the block's own background, which is legible but has to be read a character
 * at a time. Tinting the row is what makes a diff scannable.
 *
 * Unified only. A reading column is one column, and two columns of code inside
 * it is a different app.
 */
function renderDiff(source) {
  const HUNK = /^@@+ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/
  let oldNo = 0
  let newNo = 0

  const rows = source.split('\n').map((line) => {
    const cell = (kind, left, right) =>
      `<div class="diff-row diff-${kind}">`
      + `<span class="diff-num">${left}</span>`
      + `<span class="diff-num">${right}</span>`
      + `<code>${escapeHtml(line) || '&nbsp;'}</code>`
      + '</div>'

    const hunk = line.match(HUNK)
    if (hunk) {
      oldNo = Number(hunk[1])
      newNo = Number(hunk[2])
      return cell('hunk', '', '')
    }
    // The `diff --git`, `index`, `---` and `+++` preamble. Matched before the
    // +/- tests, or the file headers would be read as an added and a removed
    // line and tinted as changes nobody made.
    if (/^(diff --git |index |--- |\+\+\+ |new file|deleted file|similarity|rename |Binary files )/.test(line)) {
      return cell('meta', '', '')
    }
    if (line.startsWith('+')) return cell('add', '', newNo++)
    if (line.startsWith('-')) return cell('del', oldNo++, '')
    if (line.startsWith('\\')) return cell('meta', '', '')
    return cell('ctx', oldNo++, newNo++)
  })

  return `<div class="diff-block">${rows.join('')}</div>`
}

// Fenced ```mermaid blocks are held aside and rendered after the HTML lands.
const defaultFence = md.renderer.rules.fence.bind(md.renderer.rules)
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const info = (token.info || '').trim().split(/\s+/)[0]
  // Built by hand rather than through renderToken, so the offset has to be
  // applied here too — this is exactly where it was forgotten once already.
  const lines = lineAttr(token)
  if (info === 'mermaid') {
    return `<div class="mermaid-block"${lines} data-graph="${encodeURIComponent(token.content)}"></div>`
  }
  if (info === 'diff') {
    return `<div class="code-wrap diff-wrap"${lines} data-lang="diff">${renderDiff(token.content)}</div>`
  }
  const html = defaultFence(tokens, idx, options, env, self)
  const label = info || 'text'
  return `<div class="code-wrap"${lines} data-lang="${label}">${html}</div>`
}

// Rewrite relative hrefs/srcs so they resolve against the document's folder.
const patchAttr = (rules, rule, attr) => {
  const original = rules[rule]
  rules[rule] = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const i = token.attrIndex(attr)
    if (i >= 0) {
      const value = token.attrs[i][1]
      if (!isExternal(value) && !value.startsWith('#')) {
        token.attrs[i][1] = fileURL(resolveLocal(value))
      }
    }
    return original
      ? original(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options)
  }
}
patchAttr(md.renderer.rules, 'image', 'src')
patchAttr(md.renderer.rules, 'link_open', 'href')

// The two rules above only see markdown's own `![]()`/`[]()` — raw HTML
// (`<img src="...">` centred in a `<p align="center">`, say) goes through
// markdown-it untouched, so it needs the same rewrite applied to the DOM
// once the elements exist. Skipped in three cases: `#...` (in-page), already
// `imark:` (nothing left to do — matters for elements the rules above
// already rewrote), and external, same as the rules above.
function patchRawAttr(root, selector, attr) {
  for (const el of root.querySelectorAll(selector)) {
    const value = el.getAttribute(attr)
    if (!value || value.startsWith('#') || value.startsWith('imark:') || isExternal(value)) continue
    el.setAttribute(attr, fileURL(resolveLocal(value)))
  }
}

/* ------------------------------------------------------- front matter */

function splitFrontMatter(text) {
  if (!text.startsWith('---')) return { data: null, body: text, offset: 0 }
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!match) return { data: null, body: text, offset: 0 }
  try {
    const data = parseYaml(match[1])
    if (data && typeof data === 'object') {
      return {
        data,
        body: text.slice(match[0].length),
        offset: match[0].split('\n').length - 1,
      }
    }
  } catch {
    /* malformed front matter is shown as-is */
  }
  return { data: null, body: text, offset: 0 }
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function renderFrontMatter(data) {
  if (!data) return ''
  const title = data.title ?? data.name
  const rows = Object.entries(data)
    // `imark:` is how a document tells the app what it is — machinery, not
    // something the person reading it put there or needs to see.
    .filter(([key]) => key !== 'title' && key !== 'name' && key !== 'imark')
    .map(([key, value]) => {
      const shown = Array.isArray(value)
        ? value.map((v) => `<span class="fm-chip">${escapeHtml(v)}</span>`).join('')
        : value && typeof value === 'object'
          ? `<code>${escapeHtml(JSON.stringify(value))}</code>`
          : escapeHtml(value)
      return `<div class="fm-row"><dt>${escapeHtml(key)}</dt><dd>${shown}</dd></div>`
    })
    .join('')
  if (!title && !rows) return ''
  return `<header class="front-matter">
    ${title ? `<h1 class="fm-title">${escapeHtml(title)}</h1>` : ''}
    ${rows ? `<dl class="fm-grid">${rows}</dl>` : ''}
  </header>`
}

// Hidden with CSS rather than by leaving the card out of the HTML: the front
// matter still occupies its lines in the file, and a document that is not built
// again is a document whose notes cannot move.
function applyFrontMatter(shown) {
  document.documentElement.dataset.frontMatter = shown ? 'shown' : 'hidden'
}


/* --------------------------------------------------------------- mermaid */

let mermaidSeq = 0

// Mermaid ships its own palette, which clashes badly with ours. Feeding it the
// live CSS variables keeps diagrams on-theme in both light and dark.
function mermaidTheme() {
  const css = getComputedStyle(document.documentElement)
  const token = (name) => css.getPropertyValue(name).trim()
  return {
    background: token('--bg'),
    primaryColor: token('--code-bg'),
    primaryTextColor: token('--text'),
    primaryBorderColor: token('--diagram'),
    secondaryColor: token('--accent-soft'),
    secondaryBorderColor: token('--diagram'),
    tertiaryColor: token('--bg'),
    tertiaryBorderColor: token('--border'),
    lineColor: token('--secondary'),
    textColor: token('--text'),
    mainBkg: token('--code-bg'),
    nodeBorder: token('--diagram'),
    clusterBkg: token('--bg'),
    clusterBorder: token('--border'),
    edgeLabelBackground: token('--bg'),
    fontSize: '14px',
  }
}

async function renderMermaid(root, theme) {
  const blocks = root.querySelectorAll('.mermaid-block')
  if (!blocks.length) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: mermaidTheme(),
    securityLevel: 'strict',
    fontFamily: 'inherit',
  })
  for (const block of blocks) {
    const source = decodeURIComponent(block.dataset.graph || '')
    try {
      const { svg } = await mermaid.render(`mermaid-${mermaidSeq++}`, source)
      block.innerHTML = svg
      block.classList.add('is-rendered')
    } catch (error) {
      block.classList.add('is-error')
      block.innerHTML = `<div class="diagram-error"><strong>Invalid diagram</strong><pre>${escapeHtml(
        error?.message ?? error,
      )}</pre></div>`
    }
  }
}

/* ------------------------------------------------------------------- toc */

function buildToc(root) {
  const headings = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((h) => h.id)
  bridge({
    type: 'toc',
    items: headings.map((h) => ({
      id: h.id,
      level: Number(h.tagName.slice(1)),
      title: h.textContent.trim(),
    })),
  })
  return headings
}

/* ---------------------------------------------------------------- scroll */

// The browser's own `behavior: 'smooth'` scales its duration with the distance
// travelled, so a jump across a long document takes one or two seconds. This
// starts at once and always lands in about a third of a second.
let scrollAnimation = 0

function glideTo(top) {
  cancelAnimationFrame(scrollAnimation)

  const from = window.scrollY
  const to = Math.max(0, Math.min(top, document.body.scrollHeight - window.innerHeight))
  const delta = to - from
  if (Math.abs(delta) < 2) return window.scrollTo(0, to)

  // Long jumps get a little longer, but never much: 260ms to 420ms.
  const duration = Math.min(420, 260 + Math.abs(delta) * 0.06)
  const start = performance.now()
  // Quintic ease-out: leaves immediately, arrives without a bump.
  const ease = (t) => 1 - Math.pow(1 - t, 5)

  // If requestAnimationFrame is not running — WebKit stops it whenever it
  // decides the view is not visible — land on the target anyway.
  const failsafe = setTimeout(() => {
    cancelAnimationFrame(scrollAnimation)
    window.scrollTo(0, to)
  }, duration + 120)

  const step = (now) => {
    const t = Math.min(1, (now - start) / duration)
    window.scrollTo(0, from + delta * ease(t))
    if (t < 1) {
      scrollAnimation = requestAnimationFrame(step)
    } else {
      clearTimeout(failsafe)
    }
  }
  scrollAnimation = requestAnimationFrame(step)
}

/* -------------------------------------------------------- code copy button */

function addCopyButtons(root) {
  for (const wrap of root.querySelectorAll('.code-wrap')) {
    const button = document.createElement('button')
    button.className = 'copy-btn'
    button.type = 'button'
    button.textContent = 'Copiar'
    button.addEventListener('click', async () => {
      // A diff is one `code` per row, so the first one alone would copy a
      // single line and look like it had worked.
      const code = wrap.classList.contains('diff-wrap')
        ? [...wrap.querySelectorAll('.diff-row code')].map((el) => el.textContent).join('\n')
        : wrap.querySelector('code')?.textContent ?? ''
      try {
        await navigator.clipboard.writeText(code)
        button.textContent = 'Copiado'
      } catch {
        button.textContent = 'Falhou'
      }
      setTimeout(() => {
        button.textContent = 'Copiar'
      }, 1400)
    })
    wrap.appendChild(button)
  }
}

/* ---------------------------------------------------------------- render */

const content = () => document.getElementById('content')

let activeHeadings = []
let renderToken = 0

async function render({ markdown, path, theme, preview, frontMatter }) {
  const token = ++renderToken
  docDir = path ? path.slice(0, path.lastIndexOf('/')) || '/' : '/'
  slugCounts.clear()

  // The very first render carries the theme and the preview flag — without this
  // the page keeps the defaults from index.html until something calls the
  // setters, and in Quick Look those calls arrive before the page exists.
  if (theme) document.documentElement.dataset.theme = theme
  if (preview) document.documentElement.dataset.preview = 'true'
  // Carried too, so a document opened after the card was put away does not
  // flash it back for the length of one render.
  if (frontMatter !== undefined) applyFrontMatter(frontMatter)

  const { data, body, offset } = splitFrontMatter(markdown ?? '')
  lineOffset = offset
  const root = content()
  const previousScroll = window.scrollY

  root.innerHTML = body.trim()
    ? renderFrontMatter(data) + md.render(body)
    : `${renderFrontMatter(data)}<p class="empty">This file is empty</p>`
  if (token !== renderToken) return

  patchRawAttr(root, 'img', 'src')
  patchRawAttr(root, 'a:not(.wikilink)', 'href')

  // The highlight elements went out with the old DOM.
  matches = []
  matchIndex = -1

  addCopyButtons(root)
  activeHeadings = buildToc(root)
  await renderMermaid(root, theme)
  if (token !== renderToken) return

  const words = root.textContent.trim().split(/\s+/).filter(Boolean).length
  bridge({ type: 'meta', words, minutes: Math.max(1, Math.round(words / 220)) })

  // Swift resolves these against the filesystem and tells us which ones are
  // dead, so the renderer never has to know where notes live.
  const targets = [...root.querySelectorAll('a.wikilink')].map((a) => a.dataset.wikilink)
  if (targets.length) bridge({ type: 'wikilinks', targets: [...new Set(targets)] })

  window.scrollTo(0, Math.min(previousScroll, document.body.scrollHeight))
  updateActiveHeading()
  bridge({ type: 'rendered' })
}

/* --------------------------------------------------------- scroll tracking */

let scrollQueued = false

function updateActiveHeading() {
  if (!activeHeadings.length) return
  let index = 0
  for (let i = 0; i < activeHeadings.length; i += 1) {
    if (activeHeadings[i].getBoundingClientRect().top <= 80) index = i
    else break
  }
  bridge({ type: 'active', id: activeHeadings[index].id })
}

window.addEventListener(
  'scroll',
  () => {
    if (scrollQueued) return
    scrollQueued = true
    requestAnimationFrame(() => {
      scrollQueued = false
      updateActiveHeading()
    })
  },
  { passive: true },
)

/* ----------------------------------------------------------- link routing */

document.addEventListener('click', (event) => {
  const anchorEl = event.target.closest('a')
  if (!anchorEl) return

  const wiki = anchorEl.dataset.wikilink
  if (wiki) {
    event.preventDefault()
    bridge({ type: 'openWiki', target: wiki })
    return
  }

  const href = anchorEl.getAttribute('href') ?? ''
  if (href.startsWith('#')) {
    event.preventDefault()
    scrollToAnchor(href.slice(1))
    return
  }

  event.preventDefault()
  if (href.startsWith('imark://file')) {
    const path = decodeURIComponent(href.replace('imark://file', ''))
    bridge({ type: 'openLocal', path })
  } else if (isExternal(href)) {
    bridge({ type: 'openExternal', url: href })
  }
})

function scrollToAnchor(id) {
  const target = document.getElementById(id)
  if (!target) return
  glideTo(target.getBoundingClientRect().top + window.scrollY - 24)
}

/* ------------------------------------------------------------------ find */

let matches = []
let matchIndex = -1

function clearFind() {
  for (const hit of [...document.querySelectorAll('mark.find')]) {
    const parent = hit.parentNode
    if (!parent) continue
    parent.replaceChild(document.createTextNode(hit.textContent), hit)
    parent.normalize()
  }
  matches = []
  matchIndex = -1
}

function runFind(query) {
  clearFind()
  const needle = (query ?? '').toLowerCase()
  if (needle.length === 0) return report()

  const root = content()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      const tag = node.parentElement?.tagName
      return tag === 'SCRIPT' || tag === 'STYLE'
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
    },
  })

  // Collected up front: splitting text nodes while walking invalidates it.
  const nodes = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node)

  for (const node of nodes) {
    const text = node.nodeValue
    const lower = text.toLowerCase()
    let at = lower.indexOf(needle)
    if (at < 0) continue

    const fragment = document.createDocumentFragment()
    let from = 0
    while (at >= 0) {
      fragment.appendChild(document.createTextNode(text.slice(from, at)))
      const hit = document.createElement('mark')
      hit.className = 'find'
      hit.textContent = text.slice(at, at + needle.length)
      fragment.appendChild(hit)
      matches.push(hit)
      from = at + needle.length
      at = lower.indexOf(needle, from)
    }
    fragment.appendChild(document.createTextNode(text.slice(from)))
    node.parentNode?.replaceChild(fragment, node)
  }

  if (matches.length) step(0)
  return report()
}

function step(delta) {
  if (!matches.length) return report()
  matches[matchIndex]?.classList.remove('is-active')
  matchIndex = (matchIndex + delta + matches.length) % matches.length
  if (matchIndex < 0) matchIndex = 0
  const hit = matches[matchIndex]
  hit.classList.add('is-active')
  hit.scrollIntoView({ block: 'center', behavior: 'smooth' })
  return report()
}

function report() {
  bridge({ type: 'find', count: matches.length, index: matches.length ? matchIndex + 1 : 0 })
}

/* ------------------------------------------------------------------- api */

window.imark = {
  render,
  scrollToAnchor,
  setTheme(theme) {
    document.documentElement.dataset.theme = theme
    const blocks = document.querySelectorAll('.mermaid-block')
    if (blocks.length) renderMermaid(content(), theme)
  },
  setWidth(width) {
    document.documentElement.dataset.width = width
  },
  setFrontMatter: applyFrontMatter,
  setPreview(on) {
    document.documentElement.dataset.preview = on ? 'true' : 'false'
  },
  find: runFind,
  findStep: step,
  findClear: clearFind,
  setTextScale(scale) {
    document.documentElement.style.setProperty('--size-body', `${scale}px`)
  },
  /// How much of the top of the page the toolbar is standing on. Everything
  /// pinned to the viewport has to start below it, not just the prose.
  setTopInset(points) {
    document.documentElement.style.setProperty('--top-inset', `${points}px`)
  },
  markMissing(targets) {
    const dead = new Set(targets)
    for (const link of document.querySelectorAll('a.wikilink')) {
      if (dead.has(link.dataset.wikilink)) link.dataset.missing = 'true'
    }
  },
}

// KaTeX is imported for its side-effect-free API; keep a reference so the
// bundler cannot tree-shake the font-bearing CSS away.
window.imark.katexVersion = katex.version

bridge({ type: 'ready' })
