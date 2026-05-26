'use strict';

/**
 * Bootstrap the recipe runner's browser session.
 *
 * Live recipe runs attach to an already-running browser over CDP. Browser
 * actions are implemented by ext-bridge.js; this file deliberately does not
 * install or emulate MCP tool handlers.
 */

const { CdpSessionManager } = require('./cdp-session-manager');

function bootstrapSession() {
  throw new Error('Live recipe runs require CDP. Pass --cdp-port <port>.');
}

async function bootstrapCdpSession(cdpPort) {
  const sessionManager = await CdpSessionManager.connect(cdpPort);
  return { sessionManager };
}

module.exports = {
  bootstrapSession,
  bootstrapCdpSession,
};
