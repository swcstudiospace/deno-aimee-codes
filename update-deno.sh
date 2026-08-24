#!/usr/bin/env bash
# Bumps the launcher package version and republishes it to JSR.
#
# Usage: ./update-deno.sh v0.1.0
# Env:   AUTO_PUSH=true commits/pushes the bump; JSR_TOKEN authenticates
#        the publish. NPM consumers are covered by JSR's npm compatibility
#        (npx jsr:@swcstudiospace/aimee), so no separate npm publish runs.
set -euo pipefail

TAG="${1:?usage: update-deno.sh <tag>}"
VERSION="${TAG#v}"

sed -i "s|\"version\": \"[^\"]*\"|\"version\": \"${VERSION}\"|" deno.json
echo "deno.json updated to ${VERSION}"

if ! command -v deno >/dev/null 2>&1; then
  curl -fsSL https://deno.land/install.sh | sh -s -- -y
  export PATH="$HOME/.deno/bin:$PATH"
fi

deno test --allow-all

if [[ "${AUTO_PUSH:-false}" == "true" ]]; then
  git config user.name "aimee-release-bot"
  git config user.email "noreply@aimeecodes.dev"
  git add deno.json
  git diff --cached --quiet ||
    git commit -m "chore(release): v${VERSION}" \
      -m "Co-Authored-By: AimeeCodes <noreply@aimeecodes.dev>"
  git push origin main
fi

if [[ -n "${JSR_TOKEN:-}" ]]; then
  deno publish --token "${JSR_TOKEN}"
fi
