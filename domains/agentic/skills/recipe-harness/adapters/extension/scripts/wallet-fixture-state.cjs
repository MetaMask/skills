#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const EOA_METHODS = [
  'personal_sign',
  'eth_sign',
  'eth_signTransaction',
  'eth_signTypedData_v1',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
];

function usage() {
  console.error(`Usage:
  wallet-fixture-state.cjs generate --target <metamask-extension> --fixture <wallet-fixture.json> --out <fixture-state.json>
  wallet-fixture-state.cjs prefill-profile --target <metamask-extension> --state <fixture-state.json> --profile <chrome-profile> --extension-dir <runtime-dist> [--extension-id-file <path>]
  wallet-fixture-state.cjs seed-cdp --target <metamask-extension> --fixture <wallet-fixture.json> --state <fixture-state.json> --cdp-port <port> --extension-dir <runtime-dist> --extension-id-file <path> --out <report.json>`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith('--')) {
      throw new Error(`Unknown positional argument: ${arg}`);
    }
    if (index + 1 >= rest.length) {
      throw new Error(`Missing value for ${arg}`);
    }
    args[arg.slice(2)] = rest[index + 1];
    index += 1;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function requireFromTarget(target, moduleName) {
  return require(require.resolve(moduleName, { paths: [target] }));
}

function normalizePrivateKey(value, label) {
  const raw = String(value || '').replace(/^0x/u, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(raw)) {
    throw new Error(`Invalid private key for ${label}`);
  }
  return raw;
}

function deterministicUuid(input) {
  const bytes = crypto.createHash('sha256').update(input).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function deterministicEntropyId(input) {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = crypto.createHash('sha256').update(input).digest();
  let id = '01';
  for (let index = 0; id.length < 26; index += 1) {
    id += alphabet[bytes[index % bytes.length] % alphabet.length];
  }
  return id;
}

function getFixtureAccounts(wallet) {
  const accounts = Array.isArray(wallet.accounts) ? wallet.accounts : [];
  if (accounts.length === 0) {
    throw new Error('wallet fixture must include accounts[]');
  }
  const supported = accounts.filter(
    (account) => account && (account.type === 'mnemonic' || account.type === 'privateKey'),
  );
  if (supported.length !== accounts.length) {
    throw new Error('wallet fixture accounts must use type mnemonic or privateKey');
  }
  if (!supported.some((account) => account.type === 'mnemonic')) {
    throw new Error('wallet fixture must include at least one mnemonic account for Extension vault setup');
  }
  return supported;
}

function readMnemonicCount(account, label) {
  const raw = account.count ?? account.numberOfAccounts ?? 1;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error(`Invalid mnemonic account count for ${label}: ${raw}`);
  }
  return count;
}

function readAccountNames(account, fallbackName, count) {
  const names = Array.isArray(account.names) ? account.names : [];
  return Array.from({ length: count }, (_unused, index) => {
    const explicitName = names[index];
    if (typeof explicitName === 'string' && explicitName.trim()) {
      return explicitName.trim();
    }
    if (index === 0 && typeof account.name === 'string' && account.name.trim()) {
      return account.name.trim();
    }
    if (index === 0) {
      return fallbackName;
    }
    return `Account ${index + 1}`;
  });
}

async function buildKeyringEntries(target, wallet) {
  const { HdKeyring } = requireFromTarget(target, '@metamask/eth-hd-keyring');
  const SimpleKeyring = requireFromTarget(target, '@metamask/eth-simple-keyring').default;
  const { privateToAddress, bytesToHex } = requireFromTarget(target, '@ethereumjs/util');
  const accounts = getFixtureAccounts(wallet);
  const entries = [];

  for (const [index, account] of accounts.entries()) {
    const name =
      typeof account.name === 'string' && account.name.trim()
        ? account.name.trim()
        : account.type === 'mnemonic'
          ? index === 0
            ? 'Primary'
            : `SRP ${index + 1}`
          : `Imported ${index + 1}`;

    if (account.type === 'mnemonic') {
      const mnemonic = String(account.value || '').trim();
      if (!mnemonic) {
        throw new Error(`Missing mnemonic value for ${name}`);
      }
      const count = readMnemonicCount(account, name);
      const names = readAccountNames(account, name, count);
      const keyring = new HdKeyring();
      await keyring.deserialize({ mnemonic, numberOfAccounts: count });
      const addresses = await keyring.getAccounts();
      const keyringId = deterministicEntropyId(`mnemonic:${mnemonic}:${index}`);
      const serializedKeyring = {
        type: 'HD Key Tree',
        data: await keyring.serialize(),
        metadata: { id: keyringId, name: '' },
      };
      addresses.forEach((address, accountIndex) => {
        entries.push({
          fixtureType: 'mnemonic',
          groupIndex: accountIndex,
          keyringId,
          keyring: accountIndex === 0 ? serializedKeyring : null,
          keyringType: serializedKeyring.type,
          address,
          name: names[accountIndex],
        });
      });
      continue;
    }

    const rawPrivateKey = normalizePrivateKey(account.value, name);
    const keyring = new SimpleKeyring();
    await keyring.deserialize([rawPrivateKey]);
    const [address] = await keyring.getAccounts();
    const derivedAddress = bytesToHex(privateToAddress(Buffer.from(rawPrivateKey, 'hex')));
    entries.push({
      fixtureType: 'privateKey',
      keyring: {
        type: 'Simple Key Pair',
        data: await keyring.serialize(),
        metadata: { id: deterministicEntropyId(`privateKey:${derivedAddress}:${index}`), name: '' },
      },
      address: address || derivedAddress,
      name,
    });
  }

  return entries;
}

function patchAccountTracker(data, addresses) {
  if (!data.AccountTracker?.accountsByChainId) {
    return;
  }
  for (const chain of Object.values(data.AccountTracker.accountsByChainId)) {
    if (!chain || typeof chain !== 'object') {
      continue;
    }
    for (const oldAddress of Object.keys(chain)) {
      delete chain[oldAddress];
    }
    for (const address of addresses) {
      chain[address] = { balance: '0x0' };
    }
  }
}

function patchNetworkState(data) {
  const mainnetChainId = '0x1';
  const mainnetClientId = 'mainnet';

  if (data.NetworkController) {
    data.NetworkController.selectedNetworkClientId = mainnetClientId;

    const configs = data.NetworkController.networkConfigurationsByChainId || {};
    for (const chainId of Object.keys(configs)) {
      if (chainId !== mainnetChainId) {
        delete configs[chainId];
      }
    }

    const metadata = data.NetworkController.networksMetadata || {};
    for (const clientId of Object.keys(metadata)) {
      if (clientId !== mainnetClientId) {
        delete metadata[clientId];
      }
    }
  }

  if (data.NetworkEnablementController?.enabledNetworkMap?.eip155) {
    data.NetworkEnablementController.enabledNetworkMap.eip155 = { [mainnetChainId]: true };
  }

  if (Array.isArray(data.NetworkOrderController?.orderedNetworkList)) {
    data.NetworkOrderController.orderedNetworkList =
      data.NetworkOrderController.orderedNetworkList.filter((entry) => entry?.networkId === 'eip155:1');
  }
}

function patchSyncState(data) {
  data.UserStorageController = {
    ...(data.UserStorageController || {}),
    isAccountSyncingEnabled: false,
    isBackupAndSyncEnabled: false,
    isContactSyncingEnabled: false,
  };

  if (data.ProfileMetricsController) {
    data.ProfileMetricsController.syncQueue = {};
    data.ProfileMetricsController.initialEnqueueCompleted = false;
  }
}

function resolveSelectedAccount(wallet, accountRows) {
  const wanted = wallet.selectedAccount || wallet.selectedAddress || wallet.address;
  if (typeof wanted !== 'string' || !wanted.trim()) {
    return accountRows[0];
  }
  const normalized = wanted.trim().toLowerCase();
  return (
    accountRows.find(
      (account) =>
        (account.metadata?.name || '').toLowerCase() === normalized ||
        account.address.toLowerCase() === normalized,
    ) || accountRows[0]
  );
}

function accountGroupId(account) {
  if (account.fixtureType === 'mnemonic') {
    return `entropy:${account.keyringId}/${account.groupIndex}`;
  }
  return `keyring:${account.metadata.keyring.type}/${account.address}`;
}

function patchAccountTree(data, accountRows, selected) {
  const wallets = {};
  const accountGroupsMetadata = {};
  const accountWalletsMetadata = {};

  for (const account of accountRows) {
    const groupId = accountGroupId(account);
    accountGroupsMetadata[groupId] = {
      name: {
        value: account.metadata.name,
        lastUpdatedAt: account.metadata.importTime || 0,
      },
      lastSelected: account.metadata.lastSelected || 0,
    };

    if (account.fixtureType === 'mnemonic') {
      const walletId = `entropy:${account.keyringId}`;
      wallets[walletId] ??= {
        id: walletId,
        type: 'entropy',
        status: 'ready',
        groups: {},
        metadata: {
          name: 'Wallet 1',
          entropy: { id: account.keyringId },
        },
      };
      wallets[walletId].groups[groupId] = {
        id: groupId,
        type: 'multichain-account',
        accounts: [account.id],
        metadata: {
          name: account.metadata.name,
          pinned: false,
          hidden: false,
          lastSelected: account.metadata.lastSelected || 0,
          entropy: { groupIndex: account.groupIndex },
        },
      };
      continue;
    }

    const walletId = `keyring:${account.metadata.keyring.type}`;
    wallets[walletId] ??= {
      id: walletId,
      type: 'keyring',
      status: 'ready',
      groups: {},
      metadata: {
        name: 'Imported accounts',
        keyring: { type: account.metadata.keyring.type },
      },
    };
    wallets[walletId].groups[groupId] = {
      id: groupId,
      type: 'single-account',
      accounts: [account.id],
      metadata: {
        name: account.metadata.name,
        pinned: false,
        hidden: false,
        lastSelected: account.metadata.lastSelected || 0,
      },
    };
  }

  data.AccountTreeController = {
    accountGroupsMetadata,
    accountTree: { wallets },
    accountWalletsMetadata,
    hasAccountTreeSyncingSyncedAtLeastOnce: true,
    selectedAccountGroup: accountGroupId(selected),
  };
}

async function generate(args) {
  // Validate raw arg VALUES before path.resolve — path.resolve('') returns the
  // cwd, so a missing --fixture/--out would otherwise silently resolve to cwd.
  if (!args.fixture || !args.out) {
    throw new Error('generate requires --fixture <wallet-fixture.json> and --out <fixture-state.json>');
  }
  const target = path.resolve(args.target || process.cwd());
  const fixturePath = path.resolve(args.fixture);
  const outputPath = path.resolve(args.out);
  const wallet = readJson(fixturePath);
  if (typeof wallet.password !== 'string' || wallet.password.length === 0) {
    throw new Error('wallet fixture must include password');
  }

  const defaultFixturePath = path.join(target, 'test/e2e/fixtures/default-fixture.json');
  if (!fs.existsSync(defaultFixturePath)) {
    throw new Error(`default-fixture.json not found at ${defaultFixturePath}`);
  }
  const fixture = readJson(defaultFixturePath);
  const data = fixture.data || fixture;
  const browserPassworder = requireFromTarget(target, '@metamask/browser-passworder');
  let keyringEntries = await buildKeyringEntries(target, wallet);
  const hasExplicitMnemonic = getFixtureAccounts(wallet).some(
    (account) => account.type === 'mnemonic' && typeof account.value === 'string' && account.value.trim(),
  );
  // NOTE: currently unreachable. getFixtureAccounts()/buildKeyringEntries() above
  // require an explicit mnemonic and throw earlier when none is present, so
  // `!hasExplicitMnemonic` is never true at this point. Retained as the intended
  // future path for reusing an existing encrypted vault when a fixture supplies a
  // `vault` blob instead of a mnemonic; relax the upstream mnemonic requirement
  // before relying on it.
  if (!hasExplicitMnemonic && typeof wallet.vault === 'string' && wallet.vault.length > 0) {
    const existingKeyrings = await browserPassworder.decrypt(wallet.password, wallet.vault);
    const existingHd = existingKeyrings.find((keyring) => keyring?.type === 'HD Key Tree');
    if (existingHd) {
      let replacedPrimary = false;
      keyringEntries = keyringEntries.map((entry) => {
        if (entry.fixtureType !== 'mnemonic' || replacedPrimary) {
          return entry;
        }
        replacedPrimary = true;
        return {
          ...entry,
          keyring: existingHd,
          address:
            typeof wallet.address === 'string' && wallet.address
              ? wallet.address
              : entry.address,
        };
      });
    }
  }
  data.KeyringController = {
    vault: await browserPassworder.encrypt(
      wallet.password,
      keyringEntries.filter((entry) => entry.keyring).map((entry) => entry.keyring),
    ),
  };

  if (!data.AccountsController) {
    data.AccountsController = { internalAccounts: { accounts: {}, selectedAccount: null } };
  }
  if (!data.AccountsController.internalAccounts) {
    data.AccountsController.internalAccounts = { accounts: {}, selectedAccount: null };
  }
  const internalAccounts = data.AccountsController.internalAccounts;
  internalAccounts.accounts = {};
  const now = Date.now();
  const accountRows = keyringEntries.map((entry, index) => {
    const id = deterministicUuid(`${entry.fixtureType}:${entry.address}:${index}`);
    const row = {
      id,
      address: entry.address.toLowerCase(),
      fixtureType: entry.fixtureType,
      groupIndex: entry.groupIndex ?? 0,
      keyringId: entry.keyringId || '',
      metadata: {
        name: entry.name,
        importTime: now + index,
        keyring: { type: entry.keyringType || entry.keyring.type },
        lastSelected: 0,
      },
      options:
        entry.fixtureType === 'mnemonic'
          ? {
              entropySource: entry.keyringId,
              derivationPath: `m/44'/60'/0'/0/${entry.groupIndex ?? 0}`,
              groupIndex: entry.groupIndex ?? 0,
              entropy: {
                type: 'mnemonic',
                id: entry.keyringId,
                derivationPath: `m/44'/60'/0'/0/${entry.groupIndex ?? 0}`,
                groupIndex: entry.groupIndex ?? 0,
              },
            }
          : {},
      methods: EOA_METHODS,
      scopes: ['eip155:0'],
      type: 'eip155:eoa',
    };
    internalAccounts.accounts[id] = row;
    return row;
  });
  const selected = resolveSelectedAccount(wallet, accountRows);
  selected.metadata.lastSelected = now + accountRows.length;
  internalAccounts.selectedAccount = selected.id;
  patchAccountTree(data, accountRows, selected);

  data.OnboardingController = {
    completedOnboarding: true,
    firstTimeFlowType: 'import',
    seedPhraseBackedUp: true,
  };
  data.PreferencesController ??= {};
  data.PreferencesController.useExternalServices = true;
  data.PreferencesController.preferences ??= {};
  data.PreferencesController.preferences.useSidePanelAsDefault = true;
  if (wallet.settings?.autoLockNever) {
    data.PreferencesController.autoLockTimeLimit = 0;
  }
  data.PerpsController ??= {};
  data.PerpsController.isFirstTimeUser = { mainnet: false, testnet: false };
  data.PerpsController.hasPlacedFirstOrder = { mainnet: true, testnet: true };
  patchAccountTracker(
    data,
    accountRows.map((account) => account.address),
  );
  patchNetworkState(data);
  patchSyncState(data);

  writeJson(outputPath, fixture);
  const summary = {
    status: 'READY',
    accountCount: accountRows.length,
    selectedAccount: { name: selected.metadata.name, address: selected.address },
    accounts: accountRows.map((account) => ({
      name: account.metadata.name,
      address: account.address,
      type: account.fixtureType,
      keyringType: account.metadata.keyring.type,
    })),
  };
  writeJson(`${outputPath}.summary.json`, summary);
  console.error(
    `[fixture] Generated Extension fixture state: accounts=${summary.accountCount} selected=${summary.selectedAccount.name}`,
  );
}

function httpJson(port, pathname) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}${pathname}`, { timeout: 1000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (_error) {
          // CDP can briefly return a non-JSON error page while Chrome is still
          // starting. Treat that as "not ready yet" so waitForCdp can retry.
          resolve(null);
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

async function waitForCdp(port) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const version = await httpJson(port, '/json/version');
    if (version) {
      return version;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`CDP not reachable on port ${port}`);
}

function extensionIdFromUrl(url) {
  if (!String(url || '').startsWith('chrome-extension://')) {
    return '';
  }
  return String(url).split('/')[2] || '';
}

function extensionIdFromManifestKey(key) {
  if (!key) {
    return '';
  }
  const digest = crypto.createHash('sha256').update(Buffer.from(key, 'base64')).digest();
  return [...digest.subarray(0, 16)]
    .map((byte) => `${'abcdefghijklmnop'[byte >> 4]}${'abcdefghijklmnop'[byte & 0x0f]}`)
    .join('');
}

function versionedStorageState(fixtureState) {
  return fixtureState.data
    ? { data: fixtureState.data, meta: { ...(fixtureState.meta || {}), storageKind: 'data' } }
    : fixtureState;
}

async function prefillProfile(args) {
  // Validate raw arg VALUES before path.resolve (path.resolve('') === cwd).
  if (!args.state || !args.profile || !args['extension-dir']) {
    throw new Error('prefill-profile requires --state, --profile, and --extension-dir');
  }
  const target = path.resolve(args.target || process.cwd());
  const statePath = path.resolve(args.state);
  const profilePath = path.resolve(args.profile);
  const extensionDir = path.resolve(args['extension-dir']);
  const extensionIdFile = args['extension-id-file'] ? path.resolve(args['extension-id-file']) : '';
  const manifest = readJson(path.join(extensionDir, 'manifest.json'));
  const candidateIds = new Set();
  const manifestId = extensionIdFromManifestKey(manifest.key);
  if (manifestId) {
    candidateIds.add(manifestId);
  }
  if (extensionIdFile && fs.existsSync(extensionIdFile)) {
    const marker = fs.readFileSync(extensionIdFile, 'utf8').trim();
    if (/^[a-p]{32}$/u.test(marker)) {
      candidateIds.add(marker);
    }
  }
  if (candidateIds.size === 0) {
    console.error('[fixture] No deterministic extension id available for profile prefill; CDP seeding will run after launch.');
    return;
  }
  const { ClassicLevel } = requireFromTarget(target, 'classic-level');
  const stateEntries = Object.entries(versionedStorageState(readJson(statePath)));
  const settingsRoot = path.join(profilePath, 'Default', 'Local Extension Settings');
  for (const extensionId of candidateIds) {
    const dbPath = path.join(settingsRoot, extensionId);
    fs.mkdirSync(dbPath, { recursive: true });
    const db = new ClassicLevel(dbPath, { valueEncoding: 'json' });
    await db.open();
    try {
      for (const [key, value] of stateEntries) {
        await db.put(key, value);
      }
    } finally {
      await db.close();
    }
    console.error(`[fixture] Prefilled Extension profile storage for ${extensionId} (${stateEntries.length} keys)`);
  }
}

async function detectExtension(context, extensionDir, extensionIdFile) {
  const manifest = readJson(path.join(extensionDir, 'manifest.json'));
  const expectedServiceWorker = manifest.background?.service_worker || '';
  const manifestId = extensionIdFromManifestKey(manifest.key);
  const rejected = new Set();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidates = [];
    const push = (id, reason) => {
      if (!id || rejected.has(id) || candidates.some((candidate) => candidate.id === id)) {
        return;
      }
      candidates.push({ id, reason });
    };
    if (extensionIdFile && fs.existsSync(extensionIdFile)) {
      push(fs.readFileSync(extensionIdFile, 'utf8').trim(), 'extension id marker');
    }
    push(manifestId, 'manifest key');
    for (const worker of context.serviceWorkers()) {
      const id = extensionIdFromUrl(worker.url());
      if (expectedServiceWorker && worker.url().endsWith(`/${expectedServiceWorker}`)) {
        push(id, `manifest service worker ${expectedServiceWorker}`);
      } else {
        push(id, 'extension service worker');
      }
    }
    for (const page of context.pages()) {
      push(extensionIdFromUrl(page.url()), `extension page ${page.url()}`);
    }

    for (const candidate of candidates) {
      const page = await context.newPage();
      try {
        await page.goto(`chrome-extension://${candidate.id}/home.html`, {
          waitUntil: 'load',
          timeout: 10000,
        });
        if (page.url().startsWith('chrome-error://')) {
          throw new Error('candidate resolved to chrome-error page');
        }
        return { extensionId: candidate.id, page };
      } catch (error) {
        rejected.add(candidate.id);
        await page.close().catch((closeError) => {
          console.error(`[fixture] WARN: failed to close rejected extension page: ${closeError.message}`);
        });
        console.error(`[fixture] Rejected extension id ${candidate.id} (${candidate.reason}): ${error.message}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Could not detect MetaMask extension ID from CDP targets');
}

async function locatorVisible(locator) {
  try {
    return await locator.first().isVisible();
  } catch (_error) {
    // During startup the Extension page can navigate between onboarding, lock,
    // and home. A stale/missing locator means "not visible in this poll", not
    // a fixture failure; the caller keeps polling until the deadline.
    return false;
  }
}

async function waitForWalletScreen(page) {
  const readySelectors = [
    '[data-testid="account-menu-icon"]',
    '[data-testid="account-options-menu-button"]',
    '[data-testid="account-overview__asset-tab"]',
    '.wallet-overview',
    '.home__container',
  ];
  const unlockSelector = '[data-testid="unlock-password"]';
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    for (const selector of readySelectors) {
      if (await locatorVisible(page.locator(selector))) {
        return { state: 'unlocked', selector };
      }
    }
    if (await locatorVisible(page.locator(unlockSelector))) {
      return { state: 'locked', selector: unlockSelector };
    }
    if (page.url().includes('/onboarding')) {
      return { state: 'onboarding', selector: null };
    }
    await page.waitForTimeout(500);
  }
  return { state: 'unknown', selector: null };
}

async function unlockIfNeeded(page, password) {
  let state = await waitForWalletScreen(page);
  if (state.state === 'locked') {
    await page.fill('[data-testid="unlock-password"]', password);
    try {
      await page.locator('[data-testid="unlock-submit"]').first().click({ timeout: 15000 });
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      if (!message.includes('Timeout')) throw error;
      const clicked = await page.evaluate(() => {
        const button = document.querySelector('[data-testid="unlock-submit"]');
        if (!button) return false;
        button.click();
        return true;
      });
      if (!clicked) throw new Error(`Unlock submit timed out and DOM fallback could not find the button: ${message}`);
    }
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      state = await waitForWalletScreen(page);
      if (state.state === 'unlocked') {
        break;
      }
      await page.waitForTimeout(750);
    }
  }
  if (state.state !== 'unlocked') {
    throw new Error(`Wallet did not reach unlocked home screen after fixture seeding (state=${state.state})`);
  }
  return state;
}

async function readLiveAccounts(page) {
  const raw = await page.evaluate(() => {
    const metamask = (window.stateHooks?.store?.getState?.() || {}).metamask || {};
    const accts = metamask.internalAccounts || {};
    const byId = accts.accounts || {};
    const selectedId = accts.selectedAccount || null;
    const groupNamesByAccountId = {};
    const wallets = metamask.accountTree?.wallets || {};
    for (const wallet of Object.values(wallets)) {
      for (const group of Object.values(wallet?.groups || {})) {
        for (const accountId of group?.accounts || []) {
          groupNamesByAccountId[accountId] = group?.metadata?.name || '';
        }
      }
    }
    const list = Object.keys(byId).map((id) => {
      const account = byId[id] || {};
      const meta = account.metadata || {};
      return {
        id,
        name: meta.name || '',
        groupName: groupNamesByAccountId[id] || '',
        address: account.address || '',
        keyringType: (meta.keyring || {}).type || '',
        type: account.type || '',
      };
    });
    const selected = selectedId && byId[selectedId] ? byId[selectedId] : null;
    return JSON.stringify({
      selectedAccountId: selectedId,
      selectedAddress: selected?.address || null,
      selectedName: selected?.metadata?.name || null,
      accounts: list,
    });
  });
  return JSON.parse(raw);
}

function expectedFixtureFromState(state) {
  const internalAccounts = state.data?.AccountsController?.internalAccounts || {};
  const accounts = internalAccounts.accounts || {};
  const rows = Object.values(accounts).map((account) => ({
    id: account.id || '',
    name: account.metadata?.name || '',
    address: String(account.address || '').toLowerCase(),
    keyringType: account.metadata?.keyring?.type || '',
  }));
  const selected = accounts[internalAccounts.selectedAccount] || rows[0] || null;
  return {
    accounts: rows,
    selected: selected
      ? {
          id: selected.id || '',
          name: selected.metadata?.name || selected.name || '',
          address: String(selected.address || '').toLowerCase(),
        }
      : null,
  };
}

function getEvmAccounts(live) {
  return live.accounts.filter((account) => String(account.address || '').startsWith('0x'));
}

function compareImportParity(live, expectedFixture) {
  const evmAccounts = getEvmAccounts(live);
  const missing = expectedFixture.accounts.filter(
    (expectedAccount) =>
      !evmAccounts.some(
        (actual) =>
          actual.address.toLowerCase() === expectedAccount.address &&
          actual.keyringType === expectedAccount.keyringType,
      ),
  );
  const unexpectedEvm = evmAccounts.filter(
    (actual) =>
      !expectedFixture.accounts.some(
        (expectedAccount) => expectedAccount.address === actual.address.toLowerCase(),
      ),
  );
  const selectedMatches = expectedFixture.selected
    ? String(live.selectedAddress || '').toLowerCase() === expectedFixture.selected.address
    : true;
  return {
    status:
      missing.length === 0 &&
      unexpectedEvm.length === 0 &&
      evmAccounts.length === expectedFixture.accounts.length
        ? 'PASS'
        : 'FAIL',
    expectedEvmAccountCount: expectedFixture.accounts.length,
    liveEvmAccountCount: evmAccounts.length,
    missing,
    unexpectedEvm,
    selectedExpected: expectedFixture.selected,
    selectedActual: {
      id: live.selectedAccountId,
      name: live.selectedName,
      address: live.selectedAddress,
    },
    selectedMatches,
  };
}

function compareAccountNames(live, expectedFixture) {
  const evmAccounts = getEvmAccounts(live);
  const mismatched = expectedFixture.accounts.filter(
    (expectedAccount) =>
      !evmAccounts.some(
        (actual) =>
          actual.address.toLowerCase() === expectedAccount.address &&
          (actual.groupName || actual.name) === expectedAccount.name,
      ),
  );
  return {
    status: mismatched.length === 0 ? 'PASS' : 'FAIL',
    mismatched,
  };
}

async function applyAccountNames(page, expectedAccounts) {
  for (const account of expectedAccounts) {
    if (!account.name || !account.address.startsWith('0x')) {
      continue;
    }
    await page.evaluate(
      async ({ address, name }) => {
        const metamask = window.stateHooks?.store?.getState?.()?.metamask || {};
        const normalizedAddress = String(address || '').toLowerCase();
        const accountsById = metamask.internalAccounts?.accounts || {};
        const accountId = Object.keys(accountsById).find(
          (id) => String(accountsById[id]?.address || '').toLowerCase() === normalizedAddress,
        );
        let groupId = '';
        const wallets = metamask.accountTree?.wallets || {};
        for (const wallet of Object.values(wallets)) {
          for (const group of Object.values(wallet?.groups || {})) {
            if (Array.isArray(group?.accounts) && group.accounts.includes(accountId)) {
              groupId = group.id || '';
            }
          }
        }
        await window.stateHooks.submitRequestToBackground('setAccountLabel', [address, name]);
        if (!groupId) {
          throw new Error(`No account group found for fixture account ${address}`);
        }
        await window.stateHooks.submitRequestToBackground('setAccountGroupName', [groupId, name]);
      },
      { address: account.address, name: account.name },
    );
  }
}

async function applySelectedAccount(page, expectedSelected) {
  if (!expectedSelected?.address) {
    return;
  }
  await page.evaluate(
    async ({ address }) => {
      const accounts = window.stateHooks?.store?.getState?.()?.metamask?.internalAccounts?.accounts || {};
      const accountId = Object.keys(accounts).find(
        (id) => String(accounts[id]?.address || '').toLowerCase() === String(address || '').toLowerCase(),
      );
      if (!accountId) {
        throw new Error(`Could not find live account to select for ${address}`);
      }
      await window.stateHooks.submitRequestToBackground('setSelectedInternalAccount', [accountId]);
    },
    { address: expectedSelected.address },
  );
}

async function waitForFixtureSetup(page, expectedFixture) {
  const deadline = Date.now() + 15000;
  let live = await readLiveAccounts(page);
  while (Date.now() < deadline) {
    const names = compareAccountNames(live, expectedFixture);
    const importParity = compareImportParity(live, expectedFixture);
    if (names.status === 'PASS' && importParity.selectedMatches) {
      return { live, names, importParity };
    }
    await page.waitForTimeout(500);
    live = await readLiveAccounts(page);
  }
  return {
    live,
    names: compareAccountNames(live, expectedFixture),
    importParity: compareImportParity(live, expectedFixture),
  };
}

async function disconnectCdpBrowser(browser) {
  try {
    if (typeof browser.disconnect === 'function') {
      await browser.disconnect();
    } else {
      await browser.close();
    }
  } catch (error) {
    console.error(`[fixture] WARN: failed to disconnect CDP session cleanly: ${error.message}`);
  }
}

async function seedCdp(args) {
  // Validate raw arg VALUES before path.resolve (path.resolve('') === cwd).
  const port = Number(args['cdp-port']);
  if (!args.fixture || !args.state || !args['extension-dir'] || !port) {
    throw new Error('seed-cdp requires --fixture, --state, --extension-dir, and --cdp-port');
  }
  const target = path.resolve(args.target || process.cwd());
  const fixturePath = path.resolve(args.fixture);
  const statePath = path.resolve(args.state);
  const extensionDir = path.resolve(args['extension-dir']);
  const extensionIdFile = args['extension-id-file'] ? path.resolve(args['extension-id-file']) : '';
  const outPath = path.resolve(args.out || path.join(target, 'temp/runtime/fixture-state-validation.json'));
  const wallet = readJson(fixturePath);
  const fixtureState = readJson(statePath);
  const versionedState = versionedStorageState(fixtureState);

  await waitForCdp(port);
  const playwright = requireFromTarget(target, 'playwright');
  const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0] || (await browser.newContext());
  const { extensionId, page } = await detectExtension(context, extensionDir, extensionIdFile);
  if (extensionIdFile) {
    fs.mkdirSync(path.dirname(extensionIdFile), { recursive: true });
    fs.writeFileSync(extensionIdFile, `${extensionId}\n`);
  }

  await page.evaluate(async (state) => {
    await chrome.storage.local.set(state);
  }, versionedState);
  await page.goto(`chrome-extension://${extensionId}/home.html`, {
    waitUntil: 'load',
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
  const screen = await unlockIfNeeded(page, wallet.password);
  const expectedFixture = expectedFixtureFromState(fixtureState);
  const liveBeforeSetup = await readLiveAccounts(page);
  const importParityBeforeSetup = compareImportParity(liveBeforeSetup, expectedFixture);
  const namesBeforeSetup = compareAccountNames(liveBeforeSetup, expectedFixture);

  // Name and selected-account calls are an explicit fixture setup phase, not
  // import-parity proof. The report records account import parity before these
  // calls so validation cannot pass by repairing the imported account set it
  // claims to prove. The setup phase only applies user-facing labels/selection
  // after the expected EVM accounts and keyring types already exist.
  if (importParityBeforeSetup.status === 'PASS' && namesBeforeSetup.status !== 'PASS') {
    await applyAccountNames(page, expectedFixture.accounts);
  }
  if (importParityBeforeSetup.status === 'PASS' && !importParityBeforeSetup.selectedMatches) {
    await applySelectedAccount(page, expectedFixture.selected);
  }
  const setupResult = await waitForFixtureSetup(page, expectedFixture);
  const finalImportParity = compareImportParity(setupResult.live, expectedFixture);
  const finalNames = compareAccountNames(setupResult.live, expectedFixture);
  const fixtureSetupStatus =
    importParityBeforeSetup.status === 'PASS' && finalImportParity.selectedMatches && finalNames.status === 'PASS'
      ? 'PASS'
      : 'FAIL';
  const report = {
    status: fixtureSetupStatus,
    extensionId,
    unlockedVia: screen.selector,
    importParity: importParityBeforeSetup,
    fixtureSetup: {
      status: fixtureSetupStatus,
      namesBeforeSetup,
      namesAfterSetup: finalNames,
      selectedAfterSetup: finalImportParity.selectedActual,
      selectedExpected: finalImportParity.selectedExpected,
      note:
        'Account-label/selection calls are setup-time fixture finalization only; account importParity is measured before these calls, and final selected account/name setup is validated separately.',
    },
    expectedAccountCount: expectedFixture.accounts.length,
    liveAccountCount: setupResult.live.accounts.length,
    liveEvmAccountCount: getEvmAccounts(setupResult.live).length,
    selected: {
      name: setupResult.live.selectedName,
      address: setupResult.live.selectedAddress,
    },
    expectedAccounts: expectedFixture.accounts,
    liveAccounts: setupResult.live.accounts.map((account) => ({
      name: account.name,
      groupName: account.groupName,
      address: account.address,
      keyringType: account.keyringType,
      type: account.type,
    })),
    missing: importParityBeforeSetup.missing,
    unexpectedEvm: importParityBeforeSetup.unexpectedEvm,
    generatedAt: new Date().toISOString(),
  };
  writeJson(outPath, report);
  await disconnectCdpBrowser(browser);
  if (report.status !== 'PASS') {
    throw new Error(`Extension fixture account parity failed; see ${outPath}`);
  }
  console.error(
    `[fixture] CDP validated Extension wallet fixture: accounts=${report.liveAccountCount} selected=${report.selected.name || report.selected.address}`,
  );
}

(async () => {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.command === 'generate') {
      await generate(args);
    } else if (args.command === 'prefill-profile') {
      await prefillProfile(args);
    } else if (args.command === 'seed-cdp') {
      await seedCdp(args);
    } else {
      usage();
      process.exit(2);
    }
  } catch (error) {
    console.error(`FAIL: ${error.message || error}`);
    process.exit(1);
  }
})();
