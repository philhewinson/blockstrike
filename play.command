#!/bin/bash
# Double-click to play. Serves the game on a fixed port so the leaderboard persists between sessions.
cd "$(dirname "$0")"
PORT=8765
if ! lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 -m http.server $PORT >/dev/null 2>&1 &
  sleep 0.7
fi
open "http://localhost:$PORT"
