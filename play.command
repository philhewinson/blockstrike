#!/bin/bash
# Double-click to play the local copy (with its own local leaderboard). The live game is https://blockstrike.netlify.app
cd "$(dirname "$0")"
PORT=8765
if ! lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  node server/dev-server.mjs >/dev/null 2>&1 &
  sleep 0.7
fi
open "http://localhost:$PORT"
