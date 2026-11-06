#!/bin/bash
# Double-click to start StyleMood AI on a Mac.
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is missing. Install the LTS version from https://nodejs.org and try again."
  read -n 1 -s -r -p "Press any key to close"; exit 1
fi
echo "Installing (first time only, a few minutes)..."
npm install && npm run local
read -n 1 -s -r -p "Press any key to close"
