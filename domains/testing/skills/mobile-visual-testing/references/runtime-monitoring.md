# Runtime Monitoring: Network and Console Capture

Inject a namespaced monitoring global into the Hermes runtime to inspect `fetch` calls, JSON-RPC queries, and console logs. Running these checks helps discover silent failures, RPC errors, or console exceptions during visual testing.

## Contents

- [Prerequisites](#prerequisites)
- [Install Interceptors](#install-interceptors)
- [Read Captured Data](#read-captured-data)
- [Check Interceptor Health](#check-interceptor-health)
- [Dismissing Dev Error Overlays](#dismissing-dev-error-overlays)
- [Anomaly Detection](#anomaly-detection)
- [Daemon and Metro Logs](#daemon-and-metro-logs)
- [Uninstall Interceptors](#uninstall-interceptors)
- [Final Cleanup Checklist](#final-cleanup-checklist)
- [Gotchas](#gotchas)

## Prerequisites

- Metro must be active on `MM_METRO_PORT` when launching the daemon.
- Connections require Chrome DevTools Protocol (CDP). Node 20 requires the `--experimental-websocket` flag passed to the daemon. Version 22 and later support WebSockets natively.
- Interceptors capture the JS thread only. Native layer requests like iOS URLSession or Android native networking remain un-intercepted.

## Install Interceptors

Run this command once after launch to install the namespaced monitor. The installation is idempotent and will not re-wrap fetch or console methods if already installed.

```bash
yarn mm cdp Runtime.evaluate '{"expression":"(function(){if(globalThis.__mmMonitor)return JSON.stringify(\"already installed\");function sanitizeUrl(str){if(typeof str!==\"string\")return\"\";var cleaned=str.replace(/([?&])([^=]*(?:key|token|secret|auth|credential)[^=]*)=([^&#]*)/gi,\"$1$2=[REDACTED]\");cleaned=cleaned.replace(/(\\/v[23]\\/)([a-zA-Z0-9_-]+)/g,\"$1[REDACTED]\");return cleaned}var monitor={origFetch:globalThis.fetch,origLog:console.log,origWarn:console.warn,origError:console.error,net:[],con:[]};globalThis.__mmMonitor=monitor;globalThis.fetch=function(){var url=arguments[0];var opts=arguments[1]||{};var entry={t:Date.now(),method:opts.method||\"GET\",url:sanitizeUrl(typeof url===\"string\"?url:(url&&url.url)||String(url))};if(opts.body){try{var b=typeof opts.body===\"string\"?JSON.parse(opts.body):opts.body;if(b&&b.method)entry.rpcMethod=b.method}catch(x){entry.reqBodyParseFail=true}}monitor.net.push(entry);if(monitor.net.length>2000)monitor.net=monitor.net.slice(-1000);return monitor.origFetch.apply(globalThis,arguments).then(function(resp){entry.status=resp.status;entry.ms=Date.now()-entry.t;if(entry.rpcMethod){try{resp.clone().text().then(function(body){try{var j=JSON.parse(body);if(j.error){entry.rpcError=(j.error.message||JSON.stringify(j.error)).substring(0,200);entry.rpcErrorCode=j.error.code}}catch(x){entry.respJsonParseFail=true}}).catch(function(){entry.respReadFail=true})}catch(x){entry.respCloneFail=true}}return resp}).catch(function(err){entry.err=String(err);entry.ms=Date.now()-entry.t;throw err})};[\"log\",\"warn\",\"error\"].forEach(function(level){var origKey=\"orig\"+level.charAt(0).toUpperCase()+level.slice(1);console[level]=function(){var args=Array.prototype.slice.call(arguments);monitor.con.push({t:Date.now(),level:level,msg:args.map(function(a){try{return String(a)}catch(e){return\"[unstringifiable]\"}}).join(\" \")});if(monitor.con.length>1000)monitor.con=monitor.con.slice(-500);return monitor[origKey].apply(console,arguments)}});return JSON.stringify(\"interceptors installed\")})()","returnByValue":true}'
```

> ### ⚠️ SECURITY WARNING
> 
> * **No payload capture**: The fetch interceptor does not log request headers or general body contents. It only extracts the JSON-RPC method name.
> * **URL Redaction**: Query parameter names containing key, token, secret, auth, or credential (such as api_key, access_token, or authorization) are automatically redacted. Path credentials following /v2/ or /v3/ segments are also masked.
> * **Manual Review Required**: All captured output, including RPC error messages and console logs, can still contain sensitive data. You must review and redact all outputs before sharing or persisting them.

## Read Captured Data

### Drain and Clear Buffers

Use this command to read all accumulated logs and empty the buffers.

```bash
yarn mm cdp Runtime.evaluate '{"expression":"(function(){if(!globalThis.__mmMonitor)return JSON.stringify({net:[],con:[]});var r=JSON.stringify({net:globalThis.__mmMonitor.net,con:globalThis.__mmMonitor.con});globalThis.__mmMonitor.net=[];globalThis.__mmMonitor.con=[];return r})()","returnByValue":true}'
```

### Peek at Buffers

Read the logs without clearing them to keep tracking records across steps.

```bash
yarn mm cdp Runtime.evaluate '{"expression":"(function(){if(!globalThis.__mmMonitor)return JSON.stringify({net:[],con:[]});return JSON.stringify({net:globalThis.__mmMonitor.net,con:globalThis.__mmMonitor.con})})()","returnByValue":true}'
```

## Check Interceptor Health

Check if the interceptors are active. They will be reset if the app reloads or encounters a Fast Refresh event.

```bash
yarn mm cdp Runtime.evaluate '{"expression":"(function(){return JSON.stringify({installed:!!globalThis.__mmMonitor,netCount:globalThis.__mmMonitor?(globalThis.__mmMonitor.net||[]).length:0,conCount:globalThis.__mmMonitor?(globalThis.__mmMonitor.con||[]).length:0})})()","returnByValue":true}'
```

## Dismissing Dev Error Overlays

Some advanced state walks can trigger red screen overlays in development builds. An overlay may represent a real development-runtime error, so you must capture evidence and inspect the captured or Metro logs before dismissal. After dismissal, run the interceptor health check because an app reload or Fast Refresh event may have removed your instrumentation. You must clear the overlays to interact with the app.

### Dismissal Procedure

1. Run `yarn mm describe-screen` to refresh the interactive tree.
2. Search for any visible button named "Dismiss" or matching that target.
3. Click the target button using its fresh accessibility reference.
4. Repeat steps 1 to 3 until no "Dismiss" options remain.
5. Limit your attempts to a maximum of 7 clicks to prevent infinite loops. If you are still blocked, capture a screenshot via `yarn mm screenshot --name "dismiss-failed"` for offline analysis.

## Anomaly Detection

Scan drained logs for these suspicious signatures:

### Network Concerns
* **Failed Requests**: Any entry with a `status >= 400` or an `err` property.
* **JSON-RPC Failures**: Any entry with `rpcError` populated. The HTTP status will remain `200` for these errors.
* **Slow Responses**: Any entry where `ms > 5000`.

### Console Concerns
* **Exceptions**: Level matches `error`.
* **Promise Failures**: Messages containing terms like "Unhandled" or "rejection".
* **Component Loops**: Warning messages containing "Maximum update depth" or "Cannot update a component".

## Daemon and Metro Logs

Two supplementary log files help debug environment issues. Use workspace file-reading or search tools to examine them rather than streaming bash commands:

- **Daemon logs (`.mm-daemon.log`)**: Located at the project root. This log tracks CLI operations and session initialization.
- **Metro output**: Check the terminal output where Metro was started to review bundler actions and JS build errors.

## Uninstall Interceptors

Use this command to restore original functions and clean up all namespaces:

```bash
yarn mm cdp Runtime.evaluate '{"expression":"(function(){if(!globalThis.__mmMonitor)return JSON.stringify(\"not installed\");globalThis.fetch=globalThis.__mmMonitor.origFetch;console.log=globalThis.__mmMonitor.origLog;console.warn=globalThis.__mmMonitor.origWarn;console.error=globalThis.__mmMonitor.origError;delete globalThis.__mmMonitor;return JSON.stringify(\"interceptors uninstalled\")})()","returnByValue":true}'
```

## Final Cleanup Checklist

Always clean up your testing environment when diagnostics are complete:

1. Drain any remaining logs to secure final reports.
2. Confirm no private or sensitive data is included in your persisted logs.
3. Run the uninstall command to restore the original fetch and console methods.
4. Run `yarn mm describe-screen` to verify the UI state is still active and correct.
5. Revert any other temporary state changes.
6. Run the standard `yarn mm cleanup` command to clear the active session.

## Gotchas

- **HTTP 200 RPC errors**: Relays like Infura return a `200` status code even when transactions fail on-chain. Check the `rpcError` property to detect execution failures.
- **Asynchronous body cloning**: Body cloning for RPC parsing is asynchronous. Wait a moment after submitting transactions before draining the logs.
- **Fast Refresh loss**: Interceptors are lost during Metro hot reloads. Run the health check frequently to verify active status.
- **Overhead**: Interception introduces runtime overhead and should be removed after diagnostic tasks are complete.
