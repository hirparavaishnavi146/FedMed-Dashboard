// Integration check: calls exactly the endpoints the frontend calls, from the
// frontend's origin, and asserts every field the pages actually read.
// Run: node scripts/check-api-contract.mjs
//
// It also compares the TypeScript response types against the live payloads, in
// both directions. That direction matters: an earlier version of this script only
// checked that listed keys were present, so a type declaring fields the API never
// sends (`execution`, `failures` on a round) passed every check while the UI read
// undefined. Declared keys and returned keys must now match exactly.

import { readFileSync } from 'node:fs';

/**
 * Target and origin are overridable so this can be pointed at any deployment.
 *
 * It matters because the checks encode assumptions about the server's CONFIGURATION,
 * not just its contract: several assert that a protected route refuses without a key,
 * which is only true while FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO is off. Run against a
 * public-demo instance and those fail for the wrong reason -- the server is fine, the
 * expectation is wrong for that deployment.
 *
 *   FEDMED_CONTRACT_BASE=https://my-api.example.org node scripts/check-api-contract.mjs
 *   FEDMED_CONTRACT_ORIGIN=https://my-app.example.org node scripts/check-api-contract.mjs
 */
const BASE = (process.env.FEDMED_CONTRACT_BASE ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');
const ORIGIN = process.env.FEDMED_CONTRACT_ORIGIN ?? 'http://localhost:5173';

const typesSource = readFileSync(new URL('../src/types/index.ts', import.meta.url), 'utf8');

let failures = 0;
let checks = 0;

function ok(label, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function has(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj) !== undefined;
}

/**
 * Top-level property names of `export interface <name> { ... }`.
 *
 * Brace depth is tracked so that an inline nested object contributes only its own
 * property name, not its members. An earlier version matched any `name:` line, so
 * `holdout: { dice: ... }` reported `dice` as a top-level key of the interface and
 * every nested field looked like a phantom "not in API" mismatch. Comment lines are
 * skipped so JSDoc above a field does not become a field.
 */
function declaredKeys(name) {
  const header = new RegExp(`export interface ${name}\\s*\\{`).exec(typesSource);
  if (!header) return null;

  const body = typesSource.slice(header.index + header[0].length);
  const keys = [];
  let depth = 0;

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (depth === 0) {
      if (line.startsWith('}')) break; // end of the interface body
      if (line && !line.startsWith('/') && !line.startsWith('*')) {
        const parsed = /^(\w+)\??:/.exec(line);
        if (parsed) keys.push(parsed[1]);
      }
    }
    // Update depth after reading the line's own key, so a line that opens a nested
    // object still contributes the property it belongs to.
    depth += (rawLine.match(/\{/g) || []).length;
    depth -= (rawLine.match(/\}/g) || []).length;
  }

  return keys;
}

/**
 * Assert a TypeScript interface and a runtime payload describe the same object.
 * Reports both directions, because either one being wrong breaks the pages.
 */
function matchesType(label, interfaceName, payload) {
  const declared = declaredKeys(interfaceName);
  if (!declared) {
    ok(`${label} (type ${interfaceName} found)`, false, 'interface not found in src/types/index.ts');
    return;
  }
  const actual = Object.keys(payload ?? {});
  const missingInType = actual.filter((key) => !declared.includes(key));
  const extraInType = declared.filter((key) => !actual.includes(key));
  ok(
    `${label} matches the ${interfaceName} type`,
    missingInType.length === 0 && extraInType.length === 0,
    `not in type: [${missingInType}]; not in API: [${extraInType}]`,
  );
}

async function get(path) {
  const res = await fetch(BASE + path, { headers: { Accept: 'application/json', Origin: ORIGIN } });
  const body = await res.json();
  return { status: res.status, body, cors: res.headers.get('access-control-allow-origin') };
}

console.log(`FedMed API contract check against ${BASE}`);
console.log(`Origin: ${ORIGIN}\n`);

// --- /health (Header reads these) -----------------------------------------
{
  const { status, body } = await get('/health');
  console.log('/health');
  ok('status 200', status === 200, `got ${status}`);
  ok('demoData present', has(body, 'demoData'));
  ok('simulatedTraining present', has(body, 'simulatedTraining'));
  ok('service is a string', typeof body.service === 'string');
}

// --- /api/v1/dashboard/metrics (DashboardPage reads these) ----------------
{
  const { status, body, cors } = await get('/api/v1/dashboard/metrics');
  console.log('\n/api/v1/dashboard/metrics');
  ok('status 200', status === 200, `got ${status}`);
  ok('CORS allows the Vite origin', cors === ORIGIN, `got ${cors}`);
  ok('envelope has data + meta', has(body, 'data') && has(body, 'meta'));
  ok('meta.simulated is true', body.meta?.simulated === true);
  const d = body.data;
  for (const field of [
    'participatingHospitals',
    'totalHospitals',
    'hospitalSummary',
    'federatedRounds',
    'currentModel',
    'trainingStatus',
    'trainingIsSimulated',
    'trainingTrainsModel',
    'trainingExecution',
    'trainingMeasured',
    'seededRounds',
    'totalStudies',
    'averagePrivacyBudgetUsed',
    'privacyTargetEpsilon',
    'metricHistory',
    'recentRounds',
    'activity',
  ]) {
    ok(`data.${field} present`, has(d, field));
  }
  // `trainingTrainsModel` is false while idle and true once a run has actually
  // trained the stand-in model, so it tracks `trainingMeasured` rather than being
  // always false. Asserting it was always false only passed before any run.
  ok('trainingTrainsModel agrees with whether a run measured anything',
    d.trainingTrainsModel === d.trainingMeasured,
    `trainsModel ${d.trainingTrainsModel} vs measured ${d.trainingMeasured}`);
  // The chart is empty until a round is measured: a placeholder curve where a
  // result belongs is exactly what this project must not ship.
  ok('metricHistory is an array', Array.isArray(d.metricHistory));
  ok('metricHistory matches the measured round count',
    d.metricHistory.length === d.recentRounds.length,
    `metrics ${d.metricHistory.length} vs rounds ${d.recentRounds.length}`);
  if (d.metricHistory.length > 0) {
    ok('metricHistory points have chart keys',
      ['round', 'loss', 'validationLoss', 'dice', 'accuracy'].every((k) => k in d.metricHistory[0]));
  }
  // The seeded baseline is published separately and always unmeasured, so no
  // results field can quietly contain placeholder values.
  ok('seededRounds rows are all unmeasured',
    Array.isArray(d.seededRounds) && d.seededRounds.length > 0 &&
    d.seededRounds.every((row) => row.measured === false));
  ok('trainingMeasured agrees with the rounds shown',
    d.trainingMeasured === (d.recentRounds.length > 0));
  ok('activity items have feed keys',
    d.activity?.[0] && ['id', 'timestamp', 'kind', 'title', 'detail'].every((k) => k in d.activity[0]));
}

// --- /api/v1/hospitals (HospitalTable reads these) ------------------------
{
  const { status, body } = await get('/api/v1/hospitals');
  console.log('\n/api/v1/hospitals');
  ok('status 200', status === 200, `got ${status}`);
  ok('three nodes', body.data?.length === 3, `got ${body.data?.length}`);
  const row = body.data?.[0] ?? {};
  for (const field of [
    'id', 'name', 'location', 'nodeId', 'status', 'datasetStatus', 'studies',
    'sizeGb', 'lastSync', 'localTraining', 'roundsContributed',
    'privacyBudgetUsed', 'split', 'notes',
  ]) {
    ok(`node.${field} present`, has(row, field));
  }
  ok('datasetStatus is a known value', ['ready', 'partial', 'not-prepared'].includes(row.datasetStatus));
  ok('lastSync parses as a date', !Number.isNaN(Date.parse(row.lastSync)));
}

// --- /api/v1/training/status (TrainingPage reads these) -------------------
{
  const { status, body } = await get('/api/v1/training/status');
  console.log('\n/api/v1/training/status');
  ok('status 200', status === 200, `got ${status}`);
  const d = body.data;
  for (const field of [
    'runId', 'status', 'execution', 'measured', 'isSimulatedData',
    'trainsOnRealPatientData', 'strategy', 'seed', 'config', 'clients',
    'modelParameters', 'totalRounds', 'completedRounds', 'currentRound',
    'firstLoss', 'lastLoss', 'lossImprovement', 'message', 'history',
  ]) {
    ok(`data.${field} present`, has(d, field));
  }
  ok('status is a known value',
    ['idle', 'running', 'completed', 'stopped', 'failed'].includes(d.status));
  // The honest claims: synthetic data, no patient data, and a local mode.
  ok('isSimulatedData is true', d.isSimulatedData === true);
  ok('trainsOnRealPatientData is false', d.trainsOnRealPatientData === false);
  ok('execution is a known mode',
    ['local-simulation', 'distributed-local', 'cross-silo'].includes(d.execution));
  ok('execution does not claim cross-silo', d.execution !== 'cross-silo');
  ok('strategy is FedAvg', d.strategy === 'FedAvg');
  // The page reads this object directly, so its type must match it field for field.
  matchesType('/training/status', 'TrainingStatus', d);
}

// --- /api/v1/training/history + /metrics (round table and charts) ---------
{
  const history = await get('/api/v1/training/history');
  const metrics = await get('/api/v1/training/metrics');
  const config = await get('/api/v1/training/config');
  console.log('\n/api/v1/training/history and /metrics');
  ok('history status 200', history.status === 200);
  ok('metrics status 200', metrics.status === 200);
  ok('config status 200', config.status === 200);

  // History is an object carrying its own provenance, not a bare array: the UI
  // needs to know whether these rows are measurements or the seed baseline.
  const h = history.body.data;
  ok('history has source and measured', has(h, 'source') && has(h, 'measured'));
  ok('history source is a known value', ['federated-run', 'seed'].includes(h.source));
  ok('history rows are an array', Array.isArray(h.rounds));
  ok('history rows match the declared source',
    h.source === 'federated-run' ? h.measured === true : h.measured === false);
  matchesType('/training/history', 'FederatedHistory', h);
  if (h.rounds.length > 0) {
    // The exact-shape check: this is what catches a type declaring a field the
    // API never sends, which is how the round table came to read `undefined`.
    matchesType('round row', 'FederatedRound', h.rounds[0]);
    ok('a baseline row is marked unmeasured', h.rounds[0].measured === h.measured);
  }
  // Check the per-client shape from a real run, where it is actually populated.
  const measured = await get('/api/v1/training/history');
  const anyClientRow = (measured.body.data.rounds ?? []).find((row) => (row.clients ?? []).length > 0);
  if (anyClientRow) {
    matchesType('client row', 'FederatedClientResult', anyClientRow.clients[0]);
  } else {
    console.log('  SKIP  client row shape (no measured run in this process)');
  }

  // Metrics must agree with the history rather than inventing points.
  ok('metric count matches measured rounds',
    metrics.body.data.length === (h.measured ? h.rounds.length : 0),
    `metrics ${metrics.body.data.length} vs history ${h.rounds.length} (measured ${h.measured})`);
  if (metrics.body.data.length > 0) {
    ok('metric point keys',
      ['round', 'loss', 'validationLoss', 'dice', 'accuracy'].every((k) => k in metrics.body.data[0]));
  }

  // The config must publish its own limitations, not only the strategy name.
  const c = config.body.data;
  ok('config lists clientsSend', Array.isArray(c.clientsSend) && c.clientsSend.length > 0);
  ok('config lists clientsNeverSend', Array.isArray(c.clientsNeverSend) && c.clientsNeverSend.length > 0);
  ok('config neverSend excludes parameters',
    !c.clientsNeverSend.some((item) => /parameter/i.test(item)));
  ok('config states limitations', Array.isArray(c.limitations) && c.limitations.length > 0);
  ok('config says the client model is not the MRI model',
    /NOT the MRI segmentation model/.test(c.clientModelDescription));
  ok('config supports FedAvg only', c.strategiesSupported.length === 1);
}

// --- /api/v1/model/results (ModelResultsPage reads these) ----------------
{
  const { status, body } = await get('/api/v1/model/results');
  console.log('\n/api/v1/model/results');
  ok('status 200', status === 200, `got ${status}`);
  const d = body.data;
  ok('models array', Array.isArray(d.models) && d.models.length === 3, `got ${d.models?.length}`);
  ok('activeVersion present', has(d, 'activeVersion.version'));
  ok('bestVersion present', has(d, 'bestVersion.version'));
  ok('latestVersion present', has(d, 'latestVersion.version'));
  const m = d.models?.[0] ?? {};
  ok('model keys', ['version', 'createdAt', 'status', 'dice', 'iou', 'accuracy', 'loss',
    'sensitivity', 'specificity', 'rounds', 'notes'].every((k) => k in m));
  ok('createdAt parses as a date', !Number.isNaN(Date.parse(m.createdAt)));

  // The registry is illustrative and must say so; measured values live elsewhere.
  ok('registryIsIllustrative is true', d.registryIsIllustrative === true);
  ok('registryNotice warns the values are illustrative',
    typeof d.registryNotice === 'string' && /illustrative/i.test(d.registryNotice));
  ok('measuredExperiment present', has(d, 'measuredExperiment.available'));
  matchesType('/model/results', 'ModelResults', d);
}

// --- /api/v1/model/experiment (measured 3D U-Net results) ----------------
{
  const { status, body } = await get('/api/v1/model/experiment');
  console.log('\n/api/v1/model/experiment');
  ok('status 200', status === 200, `got ${status}`);
  const d = body.data;

  // `available` is explicit so absence is never inferred from nulls. This is the
  // check that stops a 0.0 Dice being rendered for an experiment that never ran.
  ok('available is a boolean', typeof d.available === 'boolean');
  matchesType('/model/experiment', 'ImagingExperiment', d);

  if (d.available) {
    ok('bestDice is a measured number', typeof d.bestDice === 'number' && d.bestDice >= 0);
    ok('epochs were measured', Array.isArray(d.epochs) && d.epochs.length > 0);
    ok('every epoch has a real train loss', d.epochs.every((e) => e.trainLoss > 0));
    ok('validation Dice is present, not fabricated',
      d.epochs.every((e) => e.validationDice === null || (e.validationDice >= 0 && e.validationDice <= 1)));
    ok('a validation sample count is reported',
      d.epochs.every((e) => Number.isInteger(e.validationSamples)));
    ok('provenance present', has(d, 'provenance.dataSource'));
    ok('declares no patient data', d.provenance.containsPatientData === false);
    ok('declares it is not clinically validated', d.provenance.clinicallyValidated === false);
    ok('isDemoValue is false (a real measurement, not a placeholder)',
      d.provenance.isDemoValue === false);
    ok('model info present', has(d, 'model.parameterCount') && d.model.parameterCount > 0);
    ok('bestEpoch is within the epoch range',
      d.bestEpoch !== null && d.bestEpoch >= 1 && d.bestEpoch <= d.epochs.length);
  } else {
    ok('unavailableReason explains why', typeof d.unavailableReason === 'string' && d.unavailableReason.length > 0);
    // Fail-safe: unavailability must not masquerade as measured zeroes.
    ok('no zero metrics when unavailable', d.bestDice === null && d.lastTrainLoss === null);
    ok('no epochs when unavailable', d.epochs.length === 0);
  }
}

// --- /api/v1/security/status (PrivacySecurityPage reads these) -----------
{
  const { status, body } = await get('/api/v1/security/status');
  console.log('\n/api/v1/security/status');
  ok('status 200', status === 200, `got ${status}`);
  const d = body.data;
  // Stage 5 implemented TLS, secure aggregation and differential privacy, so the
  // count must reflect the repository rather than the plan it replaced.
  ok('mechanismsImplemented is 3', d.mechanismsImplemented === 3, `got ${d.mechanismsImplemented}`);
  ok('mechanismsTotal is 4', d.mechanismsTotal === 4, `got ${d.mechanismsTotal}`);
  ok('atRest encryption is not implemented', d.encryption?.atRest === 'not implemented');
  ok('differentialPrivacy.applied is false', d.differentialPrivacy?.applied === false);
  ok('mechanisms array', Array.isArray(d.mechanisms) && d.mechanisms.length === 4);
  ok('budgets array', Array.isArray(d.budgets) && d.budgets.length === 3);
  ok('mechanism keys', ['id', 'name', 'description', 'state', 'implemented', 'reference']
    .every((k) => k in (d.mechanisms?.[0] ?? {})));
  ok('budget keys', ['hospitalId', 'hospital', 'epsilon', 'targetEpsilon', 'exceeded']
    .every((k) => k in (d.budgets?.[0] ?? {})));

  // --- Stage 5 posture blocks. The page renders these directly. ------------
  ok('features array present', Array.isArray(d.features) && d.features.length === 5, `got ${d.features?.length}`);
  ok('feature keys', ['id', 'name', 'state', 'implemented', 'enabled', 'description',
    'evidence', 'requirements', 'reference'].every((k) => k in (d.features?.[0] ?? {})));

  const VALID_STATES = ['enabled', 'disabled', 'unconfigured', 'unverified', 'not_implemented'];
  ok('every feature state is a known value',
    d.features.every((f) => VALID_STATES.includes(f.state)),
    `states: ${d.features.map((f) => f.state)}`);

  // The honesty rule: enabled must never be reported without a real state, and
  // never for something that is not implemented.
  ok('no feature is enabled while unimplemented',
    d.features.every((f) => !(f.enabled && !f.implemented)));
  ok('enabled agrees with state',
    d.features.every((f) => (f.state === 'enabled') === f.enabled));
  ok('every feature carries evidence for its state',
    d.features.every((f) => typeof f.evidence === 'string' && f.evidence.length > 0));

  // Homomorphic encryption genuinely does not exist.
  const he = (d.features ?? []).find((f) => f.id === 'he');
  ok('homomorphic encryption is not_implemented', he?.state === 'not_implemented' && he.enabled === false);

  // Authentication posture, read from the running configuration.
  ok('authentication block present', d.authentication !== null && typeof d.authentication === 'object');
  ok('authentication keys', ['configured', 'state', 'scheme', 'keyCount', 'principals',
    'requiredForReads', 'protectedPaths', 'note'].every((k) => k in d.authentication));
  ok('authentication state is a known value', VALID_STATES.includes(d.authentication.state));
  ok('principals expose labels and roles only',
    Array.isArray(d.authentication.principals) &&
    d.authentication.principals.every((p) => Object.keys(p).sort().join(',') === 'label,role'));

  // Transport: state must follow the request scheme, not merely configuration.
  ok('transport block present', d.transport !== null && typeof d.transport === 'object');
  ok('transport scheme matches the request', d.transport.scheme === 'http');
  ok('transport is not claimed enabled over plain HTTP', d.transport.state !== 'enabled');

  ok('secureAggregation block present', d.secureAggregation !== null);
  ok('secure aggregation does not claim to tolerate dropout',
    d.secureAggregation.toleratesDropout === false);
  ok('secure aggregation states a threat model',
    typeof d.secureAggregation.threatModel === 'string' && d.secureAggregation.threatModel.length > 20);

  ok('privacyAccounting block present', d.privacyAccounting !== null);
  ok('privacy unit is client-level',
    /client/i.test(d.privacyAccounting.privacyUnit));
  // An unspent budget must be null, never 0.0 — zero would read as perfect privacy.
  ok('unconfigured privacy reports a null epsilon',
    d.privacyAccounting.configured || d.privacyAccounting.epsilon === null,
    `epsilon ${d.privacyAccounting.epsilon}`);

  ok('audit block present', d.audit !== null);
  ok('audit is marked as recorded', d.audit.recorded === true);
  ok('audit counts agree',
    d.audit.total === d.audit.info + d.audit.warning + d.audit.critical);

  ok('disclaimers are present', Array.isArray(d.disclaimers) && d.disclaimers.length >= 4);
  ok('disclaimers state it is not production-secure',
    d.disclaimers.some((text) => /not production-secure/i.test(text)));

  matchesType('/security/status', 'SecurityStatus', d);
}

// --- /api/v1/security/privacy/account (requirement 4: epsilon accounting) ---
{
  const res = await fetch(`${BASE}/api/v1/security/privacy/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      enabled: true, noiseMultiplier: 1.0, clippingNorm: 1.0,
      sampleRate: 0.5, numRounds: 10, targetDelta: 1e-5, targetEpsilon: 3.0,
    }),
  });
  const body = await res.json();
  console.log('\n/api/v1/security/privacy/account');
  ok('status 200', res.status === 200, `got ${res.status}`);
  const d = body.data;

  ok('epsilon is a measured number', typeof d.epsilon === 'number' && d.epsilon > 0);
  ok('delta is reported', d.delta === 1e-5);
  ok('steps match the rounds requested', d.steps === 10);
  ok('budget verdict present', d.withinBudget === false, `got ${d.withinBudget}`);
  ok('privacy unit is client-level', /client/i.test(d.privacyUnit));
  ok('assumptions are returned with the epsilon', Array.isArray(d.assumptions) && d.assumptions.length >= 5);
  ok('assumptions state the privacy unit is not a patient record',
    d.assumptions.some((text) => /not one patient record|client's whole update/i.test(text)));

  // Disabled must report absence, not zero.
  const off = await fetch(`${BASE}/api/v1/security/privacy/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ enabled: false }),
  });
  const offBody = await off.json();
  ok('disabled reports a null epsilon, never 0.0', offBody.data.epsilon === null);
  ok('disabled reports unavailable with a reason',
    offBody.data.available === false && typeof offBody.data.unavailableReason === 'string');
}

// --- medical report analysis ---------------------------------------------
//
// This group handles real medical documents, so the property that matters most is
// the one that always holds: it must not be reachable without a key, reads included.
// That check runs unconditionally. The full workflow check runs only when a key is
// supplied, because the script has no business inventing one.
{
  console.log('\nMedical report analysis');
  const health = await fetch(`${BASE}/api/v1/medical-reports/health`, { headers: { Origin: ORIGIN } });
  ok('health is not reachable without a key', health.status === 401 || health.status === 503,
    `got ${health.status}`);
  ok('health never returns 200 anonymously', health.status !== 200);

  const anonAnalyze = await fetch(`${BASE}/api/v1/medical-reports/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ sessionId: 'mr-does-not-exist' }),
  });
  ok('analyse is not reachable without a key',
    anonAnalyze.status === 401 || anonAnalyze.status === 503, `got ${anonAnalyze.status}`);

  const key = process.env.FEDMED_CONTRACT_API_KEY;
  if (!key) {
    console.log('  SKIP  authenticated workflow (set FEDMED_CONTRACT_API_KEY to run it)');
  } else {
    const authHeaders = { 'X-API-Key': key, Origin: ORIGIN };
    const healthAuth = await fetch(`${BASE}/api/v1/medical-reports/health`, { headers: authHeaders });
    const healthBody = await healthAuth.json();
    ok('health returns 200 with a key', healthAuth.status === 200, `got ${healthAuth.status}`);
    ok('health declares the report limit', has(healthBody, 'data.maxReports'));
    ok('health declares whether AI is configured', typeof healthBody.data?.ai?.configured === 'boolean');
    ok('an unconfigured AI provider carries a reason',
      healthBody.data?.ai?.configured === true || typeof healthBody.data?.ai?.reason === 'string');
    ok('health declares whether OCR is available',
      typeof healthBody.data?.ocr?.engineInstalled === 'boolean');
    ok('health states an API key is required', healthBody.data?.authRequired === true);
    ok('health declares whether the routes are open to anonymous callers',
      typeof healthBody.data?.publicDemoMode === 'boolean');
    ok('a closed deployment carries no public-demo warning',
      healthBody.data?.publicDemoMode === false && healthBody.data?.publicDemoWarning === null);

    // The determinism rule the frontend relies on: no printed range means no verdict.
    const created = await fetch(`${BASE}/api/v1/medical-reports/sessions`, {
      method: 'POST',
      headers: authHeaders,
    });
    const session = (await created.json()).data;
    ok('session created with an id', typeof session?.sessionId === 'string');

    const form = new FormData();
    form.append('session_id', session.sessionId);
    form.append('files', new Blob(['Findings:\nSodium   140 mmol/L   (no range printed)\n']), 'n.txt');
    const uploaded = await fetch(`${BASE}/api/v1/medical-reports/upload`, {
      method: 'POST',
      headers: authHeaders,
      body: form,
    });
    ok('upload accepts a plain text report', uploaded.status === 200, `got ${uploaded.status}`);

    const extracted = await fetch(`${BASE}/api/v1/medical-reports/extract`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.sessionId }),
    });
    const parsed = (await extracted.json()).data?.reports?.[0]?.parsed;
    const sodium = parsed?.labs?.find((lab) => /sodium/i.test(lab.name));
    ok('a value with no printed range is left unjudged',
      sodium !== undefined && sodium.withinRange === null,
      `withinRange=${JSON.stringify(sodium?.withinRange)}`);

    // Comparing before confirming the patient must be refused, not warned about.
    const early = await fetch(`${BASE}/api/v1/medical-reports/analyze`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.sessionId }),
    });
    ok('analysis before confirming the patient -> 422', early.status === 422, `got ${early.status}`);
    const earlyBody = await early.json();
    ok('and it names the reason', earlyBody.error?.code === 'same_patient_not_confirmed',
      JSON.stringify(earlyBody.error?.code));

    // Clean up the staged files this check created.
    await fetch(`${BASE}/api/v1/medical-reports/sessions/${session.sessionId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
  }
}

// --- error contract (api.ts parses error.code / error.message) -----------
{
  console.log('\nError contract');
  const notFound = await get('/api/v1/hospitals/HOSP-99');
  ok('unknown hospital -> 404', notFound.status === 404, `got ${notFound.status}`);
  ok('error.code present', typeof notFound.body.error?.code === 'string');
  ok('error.message present', typeof notFound.body.error?.message === 'string');
  ok('detail keys are camelCase', has(notFound.body, 'error.detail.hospitalId'),
    JSON.stringify(notFound.body.error?.detail));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
console.log('All contract checks passed.');
