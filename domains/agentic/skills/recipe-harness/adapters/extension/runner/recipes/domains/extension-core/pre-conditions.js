'use strict';

async function getExtensionState(context) {
  if (!context?.sessionManager?.getExtensionState) {
    throw new Error('Active session manager does not support extension state');
  }
  return context.sessionManager.getExtensionState();
}

async function waitForTestId(context, testId, timeoutMs = 5000) {
  if (!context?.getPage) throw new Error('No active browser page');
  await context.getPage().locator(`[data-testid="${testId}"]`).first().waitFor({
    state: 'visible',
    timeout: timeoutMs,
  });
}

const REGISTRY = {
  'wallet.unlocked': {
    description: 'Extension is loaded and wallet is unlocked',
    check: async (_params, context) => {
      let state;
      try {
        state = await getExtensionState(context);
      } catch (err) {
        return { pass: false, hint: `Extension not loaded or no active CDP session: ${err.message || err}` };
      }
      if (state?.isUnlocked === true) {
        return { pass: true, hint: 'Wallet is unlocked' };
      }
      if (context) {
        try {
          const page = context.getPage();
          const lockCount = await page.locator('[data-testid="unlock-password"]').count();
          if (lockCount === 0) {
            return { pass: true, hint: 'Wallet is unlocked (DOM check)' };
          }
        } catch (err) {
          return { pass: false, hint: `Wallet lock DOM check failed: ${err.message || err}` };
        }
      }
      return { pass: false, hint: 'Wallet is locked. Unlock it first (type password + press unlock-submit).' };
    },
  },

  'extension.loaded': {
    description: 'Extension is loaded and responsive',
    check: async (_params, context) => {
      let loaded = false;
      let error = null;
      try {
        await getExtensionState(context);
        loaded = true;
      } catch (err) {
        error = err;
      }
      return {
        pass: loaded,
        hint: loaded
          ? 'Extension is loaded'
          : `Extension is not responding. Check that the browser is running and extension is loaded. ${error?.message || error || ''}`.trim(),
      };
    },
  },

  'ext.element_visible': {
    description: 'A specific data-testid element is visible on screen',
    check: async (params, context) => {
      const testId = params?.testId;
      if (!testId) return { pass: false, hint: 'ext.element_visible requires a testId parameter.' };
      let found = false;
      try {
        await waitForTestId(context, testId, 5000);
        found = true;
      } catch (err) {
        return { pass: false, hint: `Element [data-testid="${testId}"] not found on screen: ${err.message || err}` };
      }
      return {
        pass: found === true,
        hint: found ? `Element "${testId}" is visible` : `Element [data-testid="${testId}"] not found.`,
      };
    },
  },

  'ext.on_screen': {
    description: 'Extension is on a specific screen (URL hash)',
    check: async (params, context) => {
      const hash = params?.hash;
      if (!hash) return { pass: false, hint: 'ext.on_screen requires a hash parameter.' };
      let state;
      try {
        state = await getExtensionState(context);
      } catch (err) {
        return { pass: false, hint: `Cannot get state to check screen: ${err.message || err}` };
      }
      const currentUrl = state?.currentUrl;
      const includes = currentUrl?.includes(hash) ?? false;
      return {
        pass: includes,
        hint: includes
          ? `On expected screen (hash contains "${hash}")`
          : `Expected URL hash to contain "${hash}", got "${currentUrl ?? 'unknown'}".`,
      };
    },
  },
};

module.exports = { REGISTRY };
