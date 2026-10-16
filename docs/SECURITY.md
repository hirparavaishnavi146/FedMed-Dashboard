# FedMed security: what is real, what is not, and what would still be needed

This document states the security posture honestly. It is written so that a reader
cannot come away believing the system is more protected than it is.

## Bottom line

**This application is not production-secure.** It has not been penetration tested,
audited, or reviewed by an independent security assessor. It must not be relied on to
protect patient data. It is a research prototype.

What *is* real: API-key authentication with scoped authorization over the privileged
endpoints, a TLS capability with certificate tooling, a genuine secure-aggregation
masking implementation, a working differential-privacy accountant, and a real audit
log. Each is implemented and covered by tests.

What is *not* real: no differential privacy has actually been applied to a training
run; secure aggregation has not been exercised on a live run; there is no homomorphic
encryption; there is no durable audit storage; and the federated clients are
simulated in a single process.

## Audit: what existed before this stage

| Area | Before | Now |
|---|---|---|
| Authentication | **None.** Every endpoint was open | API keys with scoped roles; privileged endpoints refuse when unconfigured |
| Authorization | **None** | `read` / `train` / `admin` scopes enforced as dependencies |
| Transport security | **None.** Plain HTTP on loopback | TLS capability, certificate generator, live scheme detection |
| Secure aggregation | **Nothing.** No masking of any kind | SecAgg+-style pairwise masking on Flower's primitive, tested |
| Differential privacy | **Nothing.** An unapplied config object | Clipping wrapper + Opacus RDP accountant; epsilon computed on request |
| Homomorphic encryption | Nothing | Nothing (unchanged) |
| Audit log | **Seeded sample rows presented as history** | Real recorded events, redacted, bounded |
| Redaction | None | One implementation, applied before storage |

## Authentication and authorization

**How it works.** A caller sends `X-API-Key`. The server hashes it with SHA-256 and
compares, in constant time, against configured hashes. The raw key is never stored,
never logged, never returned. Configuration is
`FEDMED_API_KEYS=label:role:sha256hex[,...]`.

```
cd backend
..\.venv\Scripts\python.exe -m app.security.keys generate --label ops --role admin
```

Copy the printed hash into `FEDMED_API_KEYS`. The raw key is shown once, because it
cannot be recovered from the hash — that is the point.

**Scopes.**

| Scope | Grants | Protects |
|---|---|---|
| `read` | GET endpoints | — |
| `train` | Starting, stopping, resetting a run | `POST /api/v1/training/{start,stop,reset}` |
| `admin` | Administrative actions | `POST /api/v1/security/audit/clear` |

`admin` implies `train` implies `read`.

**Fail-closed.** With no keys configured, the protected endpoints return **503
`auth_not_configured`**, not 200. A missing configuration must never silently mean
"no authentication" — that is how a security control ends up present but doing
nothing.

**Reads are open by default** so the read-only dashboard stays browsable. Set
`FEDMED_AUTH_REQUIRED_FOR_READS=true` to lock reads too. The current setting is
reported in `/security/status` as `authentication.requiredForReads`.

**Limitations.** Static keys with no expiry, no revocation list, no rotation, no
per-user accounts, and no session management. Keys travel in a header over whatever
transport is configured, so without TLS they are readable in transit. There is no
rate limiting and no account lockout. This stops an anonymous caller from changing
training configuration; it is not a hospital-grade authorization system.

## Transport security

**What exists.** `app/security/tls.py` generates a self-signed certificate (RSA 2048,
SANs for `localhost` and `127.0.0.1`), inspects any certificate on disk, and returns
the uvicorn SSL arguments. Flower's `Certificates` object is available for the gRPC
path.

```
..\.venv\Scripts\python.exe -m app.security.keys cert --out secrets
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8443 ^
    --ssl-certfile secrets\server.crt --ssl-keyfile secrets\server.key
```

**How the state is reported.** `transport.state` is `enabled` **only when the request
being served arrived over HTTPS**. A certificate sitting on disk is not evidence that
TLS is in use, so it alone reports `unverified`. This is deliberate: it is the
difference between "configured" and "in effect".

**Limitations.** A self-signed certificate is trusted by no client by default, so a
browser will warn and a program will reject it unless the CA is installed. The private
key is written unencrypted (no passphrase). There is no certificate rotation, no
revocation, no mutual TLS, and no HSTS. Production would need a CA-issued certificate,
a trust story for every client, and automated renewal. **Nothing at rest is
encrypted.**

## Secure aggregation

**What it does.** Each client clips and quantizes its update, multiplies by its sample
count to form a *contribution*, masks that contribution and its weight with pairwise
pseudorandom masks, and uploads the two masked values. The server sums them; the masks
cancel exactly, recovering only `sum(weight × params)` and `sum(weight)`. The server
can compute the weighted average without ever seeing an individual update.

The pseudorandom generator is Flower's own
`secaggplus_utils.pseudo_rand_gen` from the pinned version, not a reimplementation.

**Verified properties** (`tests/test_secure_aggregation.py`):

- mask residual is exactly `0.0` — masks cancel, not approximately but exactly
- the recovered weighted sum equals plain FedAvg over the same quantized inputs exactly
- each client's masked contribution differs from its real contribution
- a dropped client is **refused**, not silently averaged incorrectly
- a weighted sum that could overflow the modulus is refused with the numbers

**Protocol assumptions, and what breaks them.**

| Assumption | Consequence if violated |
|---|---|
| All participating clients report | Masks do not cancel. The implementation refuses to unmask. Real SecAgg+ uses secret sharing and a reconstruction threshold; this does not. |
| Seeds shared over a secure channel | An attacker who learns a pair's seed can strip that pair's mask. Seeds come from configuration here. |
| True weighted sum stays below the modulus | Silent wraparound. Detected and refused (`theoreticalMax` vs `safeBound`), not tolerated. |
| Honest-but-curious server | A server colluding with all-but-one client recovers the remaining client's update by subtraction. Not mitigated. |

**Quantization cost.** Updates are clipped to a bounded norm and rounded to integers,
so the aggregate differs slightly from plain FedAvg. This is measured and reported per
run as `quantizationErrorMaxAbs` (about `1.5e-6` on the reference configuration).
Clipping also discards information from unusually large updates — that is the point,
and it is a real accuracy cost.

**Limitations.** Not active until `FEDMED_SECURE_AGGREGATION_SECRET` is set; a default
secret would be a false sense of protection. The protocol has not been run end-to-end
on a live federated round, so its live status is `unconfigured` or `unverified` rather
than `enabled`. It protects a *client's whole update*, not individual records.

## Differential privacy

**Mechanism.** Client-side clipping with Gaussian noise on the aggregate, via Flower's
maintained `DifferentialPrivacyClientSideFixedClipping`. The `DPFedAvgFixed` and
`DPFedAvgAdaptive` wrappers are present in Flower 1.39 but documented as deprecated, so
they are deliberately not used.

**Accountant.** `opacus.accountants.create_accountant("rdp")` — Opacus 1.6.0, a
maintained implementation of the Rényi-DP accountant for the subsampled Gaussian
mechanism. This project does not implement its own accounting, because a hand-rolled
accountant is the easiest place to overstate a guarantee. Verified directions: epsilon
rises with rounds, falls with noise, rises as delta shrinks.

**Request it.**

```cmd
curl -X POST http://127.0.0.1:8000/api/v1/security/privacy/account ^
  -H "Content-Type: application/json" ^
  -d "{\"enabled\":true,\"noise_multiplier\":1.0,\"sample_rate\":0.5,\"num_rounds\":10,\"target_epsilon\":3.0}"
```

Measured: `epsilon = 11.5371` at `delta = 1e-5`, and `withinBudget: false` against a
target of 3.0.

**The privacy unit — read this before quoting an epsilon.** The unit protected is **one
client's entire update**, not one patient record. Flower's DP treats each client as a
single example, so epsilon bounds what the server learns about a *hospital's
contribution*. It says nothing about individuals whose scans are in that hospital's
dataset. Presenting this as patient-level DP would be false.

**Assumptions the bound depends on.** Subsampled Gaussian mechanism with Poisson
sampling at the stated rate; per-client clipping at the stated norm every round;
independent noise per round; an honest, non-colluding server; exactly the configured
number of rounds run (more rounds means a larger epsilon than reported); and the
RDP-to-(epsilon, delta) conversion, which is itself an upper bound. All of these are
returned with every accounting response.

**Limitations.** No DP configuration is set by default, so **no epsilon has been
spent** and none is displayed — `null`, never `0.0`. DP has not been applied to a live
training run. The bound is not independently validated against a second accountant.

## Data handling

- **Datasets stay local.** In the simulation each client's data lives on that client
  object and is never returned: `LocalDataset` has no accessor, `ClientUpdate` is the
  only outbound type, and a test asserts its exact field set, so adding a data field
  fails the suite.
- **No patient data anywhere.** All imaging data is procedurally generated synthetic
  phantoms. `docs/IMAGING.md` covers obtaining real research data, and the pipeline
  never downloads anything itself.
- **Git exclusions.** `.env*` (except `.env.example`), `secrets/`, `experiments/`,
  `*.pt`, `*.pth`, datasets, and local databases are ignored. Verify before committing:

```cmd
git status --short
git check-ignore -v backend\.env backend\secrets\server.key backend\experiments
```

- **Input validation.** Federated configuration is range-checked with per-field
  locations; privacy configuration is validated with a specific error code; malformed
  API-key configuration fails at startup rather than silently disabling authentication.
- **Safe errors.** One error envelope, machine-readable codes, and no secret in any
  message — asserted by tests that scan responses and the audit log for the raw key,
  its hash, and a hash prefix.

## Frontend reporting

The Privacy & Security page shows the same five states the API reports, and a feature
is `enabled` **only** when the API says so — never because a switch is on:

| State | Meaning |
|---|---|
| `enabled` | Implemented, configured, and in effect for this process |
| `disabled` | Implemented but turned off |
| `unconfigured` | Needs configuration before it can work |
| `unverified` | Implemented and covered by tests, but not exercised here |
| `not_implemented` | No code exists |

Configuring auth or TLS and reloading the page visibly changes the state, which is how
you can tell the reporting is live rather than cosmetic.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `FEDMED_ENVIRONMENT` | `development` | `production` refuses the CORS wildcard |
| `FEDMED_API_KEYS` | *(empty)* | `label:role:sha256hex` entries. Empty means auth is unconfigured and protected endpoints return 503 |
| `FEDMED_AUTH_REQUIRED_FOR_READS` | `false` | Require a key for GET endpoints too |
| `FEDMED_TLS_CERT_FILE` | *(unset)* | Certificate path |
| `FEDMED_TLS_KEY_FILE` | *(unset)* | Private key path |
| `FEDMED_SECURE_AGGREGATION_SECRET` | *(unset)* | Shared secret for pairwise seeds. Unset means secure aggregation is not active |
| `FEDMED_CORS_ORIGINS` | localhost:5173/4173 | Comma-separated allowed origins |

Never commit a real `.env`. Only `.env.example` is tracked.

## Known risks

1. **Not independently validated.** No audit, no pentest, no security review.
2. **No DP or secure aggregation applied to a live run.** Both are implemented and
   tested as components; neither has been exercised end-to-end.
3. **Client isolation is structural, not network-enforced.** All clients run in one
   process. A real cross-silo deployment needs policy and infrastructure, not just code.
4. **No durable audit trail.** The log is in-memory, bounded, and lost on restart. An
   attacker who can restart the process can erase it.
5. **Static API keys.** No expiry, rotation, or revocation; keys are readable in transit
   without TLS; the browser-held key in local development is not a secret.
6. **Self-signed TLS only.** Trust is not established with any client.
7. **No encryption at rest.** Checkpoints and artifacts are plaintext.
8. **Secure aggregation does not resist collusion**, and cannot tolerate a dropout.
9. **Differential privacy is client-level**, and its epsilon is an upper bound from one
   accountant.
10. **No rate limiting, lockout, or brute-force protection** on the key check.
11. **Denial of service is unaddressed.** A federated run occupies a worker thread;
    concurrency is not bounded.

## Checklist before any real deployment

- [ ] Independent security review and penetration test
- [ ] Replace API keys with a real identity provider, short-lived tokens and rotation
- [ ] CA-issued TLS certificates; mutual TLS on the federated gRPC path
- [ ] Encrypt checkpoints and any data at rest
- [ ] Durable, append-only audit storage with retention and tamper evidence
- [ ] Rate limiting, lockout and monitoring on authentication
- [ ] Run DP and secure aggregation end-to-end and record the measured epsilon
- [ ] Validate the epsilon against a second accountant
- [ ] Move each client into its own infrastructure with network policy
- [ ] Define a data-processing agreement and an ethics/IRB position for real data
- [ ] Clinical validation before any claim of clinical readiness — none is made here
