#!/bin/bash
# Sets the app's version.
#
#   Support/bump.sh 0.2.4     write it
#   Support/bump.sh --check   print the current version, change nothing

set -euo pipefail
cd "$(dirname "$0")/.."

FILE="Support/Imark-Info.plist"

version() {
	/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$FILE"
}

if [ "${1:-}" = "--check" ] || [ $# -eq 0 ]; then
	version
	exit 0
fi

VERSION="$1"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
	|| { echo "not a version: $VERSION (expected 1.2.3)" >&2; exit 1; }

/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$FILE"

printf '\033[1;32m✓ %s\033[0m\n' "$VERSION"
echo "  next: git commit -am \"$VERSION\" && git push, then ./release.sh"
