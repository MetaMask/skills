#!/bin/bash
# Reload all connected apps via Metro's WebSocket API.

set -euo pipefail

cd "$(dirname "$0")/../../.."
if [ -f .js.env ]; then
  while IFS= read -r _line || [ -n "$_line" ]; do
    [[ "$_line" =~ ^[[:space:]]*(#|$) ]] && continue
    _line="${_line#export }"
    _key="${_line%%=*}"
    _key="${_key//[[:space:]]/}"
    _val="${_line#*=}"
    _val="${_val#\"}" ; _val="${_val%\"}"
    _val="${_val#\'}" ; _val="${_val%\'}"
    [[ -n "$_key" && -z "${!_key+x}" ]] && export "$_key=$_val"
  done < .js.env
  unset _line _key _val
fi

PORT="${WATCHER_PORT:-8081}"

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
