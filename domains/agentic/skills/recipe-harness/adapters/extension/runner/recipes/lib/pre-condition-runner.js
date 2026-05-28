'use strict';

/**
 * Pre-condition evaluation engine.
 * Evaluates named pre-conditions before recipe steps run. Fails fast with hints.
 */

function classifyPreConditionError(message) {
  const raw = String(message || 'unknown error');
  if (/scuttl|stateHooks|globalThis\.(setInterval|clearInterval)|LavaMoat/i.test(raw)) {
    return `Pre-condition blocked by automation-incompatible Extension runtime, likely LavaMoat scuttling/stateHooks access: ${raw}. Use a harness-compatible runtime or classify this as a recipe/precondition limitation; do not start an expensive rebuild unless explicitly approved.`;
  }
  return `Pre-condition threw: ${raw}`;
}

async function runPreConditions(conditions, registries, context) {
  const results = [];

  for (const condition of conditions) {
    const name = typeof condition === 'string' ? condition : condition.name;
    const params = typeof condition === 'object'
      ? Object.fromEntries(Object.entries(condition).filter(([k]) => k !== 'name'))
      : undefined;

    let entry;
    for (const registry of registries) {
      if (registry[name]) { entry = registry[name]; break; }
    }

    if (!entry) {
      results.push({ name, pass: false, hint: `Unknown pre-condition: "${name}"`, durationMs: 0 });
      return { allPassed: false, results };
    }

    const start = Date.now();
    try {
      const result = await entry.check(params, context);
      const durationMs = Date.now() - start;
      results.push({ name, pass: result.pass, hint: result.hint, durationMs });

      if (!result.pass) return { allPassed: false, results };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        name,
        pass: false,
        hint: classifyPreConditionError(message),
        durationMs,
      });
      return { allPassed: false, results };
    }
  }

  return { allPassed: true, results };
}

module.exports = { runPreConditions };
