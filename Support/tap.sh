#!/bin/bash
# Points Homebrew at the release that was just published.
#
#   Support/tap.sh            the version in Support/Imark-Info.plist
#   Support/tap.sh 0.2.4      that one
#   Support/tap.sh --check    say what Homebrew is handing out, change nothing
#
# `brew install --cask nelsonuhan/tap/imark` reads one file in another
# repository — Casks/imark.rb in nelsonuhan/homebrew-tap — and that file names
# a version and the checksum of its .dmg. Publishing a release on GitHub does
# not touch it, so until this runs Homebrew keeps installing the previous
# version.
#
# The checksum is taken from the asset as GitHub serves it, not from the local
# dist/ copy, because those are the bytes somebody's brew will actually download
# and compare.

set -euo pipefail
cd "$(dirname "$0")/.."

TAP="nelsonuhan/homebrew-tap"
CASK="Casks/imark.rb"

step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

command -v gh >/dev/null || die "gh is not installed — brew install gh"

# Wherever `origin` points, so this keeps working once it points at your own
# fork instead of upstream. https:// and git@ remotes both parse.
SOURCE_REPO="$(git remote get-url origin \
	| sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')"

# Through the API rather than raw.githubusercontent, which serves a cached copy
# for a few minutes and would report the old version right after a push.
cask_version() {
	gh api "repos/$TAP/contents/$CASK" -H "Accept: application/vnd.github.raw" \
		| sed -n 's/^ *version "\(.*\)"/\1/p'
}

# ------------------------------------------------------------------- check

if [ "${1:-}" = "--check" ]; then
	HERE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' Support/Imark-Info.plist)"
	THERE="$(cask_version)"
	if [ "$HERE" = "$THERE" ]; then
		echo "Homebrew installs $THERE, same as this tree"
	else
		printf '\033[1;33m! Homebrew installs %s, this tree is %s — run Support/tap.sh\033[0m\n' \
			"$THERE" "$HERE"
		exit 1
	fi
	exit 0
fi

VERSION="${1:-$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' Support/Imark-Info.plist)}"
DMG="imark-$VERSION.dmg"

# --------------------------------------------------------------- the release

step "the release"
gh api "repos/$SOURCE_REPO/releases/tags/v$VERSION" --jq '.assets[].name' 2>/dev/null \
	| grep -qx "$DMG" \
	|| die "v$VERSION has no $DMG attached on $SOURCE_REPO — publish the release first, see RELEASING.md"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL -o "$TMP/$DMG" \
	"https://github.com/$SOURCE_REPO/releases/download/v$VERSION/$DMG"
SHA="$(shasum -a 256 "$TMP/$DMG" | cut -d' ' -f1)"
echo "$DMG · $(du -h "$TMP/$DMG" | cut -f1) · $SHA"

# ------------------------------------------------------------------ the cask

step "the cask"
gh repo clone "$TAP" "$TMP/tap" -- --quiet --depth 1

# Only the two lines that change: a cask is Ruby, and everything else in it —
# the zap list, the minimum macOS — is hand-written and stays as it was.
node -e '
	const fs = require("fs")
	const [file, version, sha] = process.argv.slice(1)
	let text = fs.readFileSync(file, "utf8")
	for (const [key, value] of [["version", version], ["sha256", sha]]) {
		const pattern = new RegExp(`(^\\s*${key} ")[^"]*(")`, "m")
		if (!pattern.test(text)) { console.error(`no ${key} line in the cask`); process.exit(1) }
		text = text.replace(pattern, `$1${value}$2`)
	}
	fs.writeFileSync(file, text)
' "$TMP/tap/$CASK" "$VERSION" "$SHA"

if git -C "$TMP/tap" diff --quiet; then
	echo "already $VERSION — nothing to push"
	exit 0
fi

git -C "$TMP/tap" commit --quiet -am "imark $VERSION"
git -C "$TMP/tap" push --quiet origin HEAD
echo "pushed"

# ------------------------------------------------------------------- confirm

step "confirm"
[ "$(cask_version)" = "$VERSION" ] \
	|| die "pushed, but the tap still serves $(cask_version) — check $TAP by hand"

printf '\033[1;32m✓ brew install --cask nelsonuhan/tap/imark now gives %s\033[0m\n' "$VERSION"
echo "  try it: brew update && brew upgrade --cask imark"
