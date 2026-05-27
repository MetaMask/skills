#!/bin/bash
# Reload all connected apps via Metro's WebSocket API.

set -euo pipefail

cd "$(dirname "$0")/../../.."
# shellcheck source=lib/safe-env-parser.sh
. "$(dirname "$0")/lib/safe-env-parser.sh"
load_js_env

PORT="${WATCHER_PORT:-8081}"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "ERROR: WATCHER_PORT must be numeric (got: $PORT)" >&2; exit 1; }

# Verify Metro is running
if ! curl -sf "http://localhost:${PORT}/status" >/dev/null 2>&1; then
  echo "ERROR: Metro is not running on port $PORT."
  exit 1
fi

# Send reload via WebSocket
node -e "
  const ws = new (require('ws'))('ws://localhost:${PORT}/message');
  const timer = setTimeout(() => { console.error('Timeout connecting to Metro.'); process.exit(1); }, 5000);
  ws.on('open', () => {
    clearTimeout(timer);
    ws.send(JSON.stringify({ version: 2, method: 'reload' }));
    console.log('Reload sent to all connected apps.');
    ws.close();
  });
  ws.on('error', (e) => {
    clearTimeout(timer);
    console.error('WebSocket error:', e.message);
    process.exit(1);
  });
"
