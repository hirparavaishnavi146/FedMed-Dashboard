# Federated learning in FedMed

## What is actually implemented

Three simulated hospital clients each hold their own data, train a model locally,
and return **model parameters plus summary numbers**. A server aggregates those
parameters with sample-count-weighted Federated Averaging (FedAvg). Raw training
examples are never sent to the server.

| Piece | Where | What it does |
|---|---|---|
| FedAvg | `backend/app/federated/fedavg.py` | Weighted averaging with full validation |
| Client | `backend/app/federated/client.py` | Trains locally, emits parameters only |
| Server | `backend/app/federated/simulation.py` | Runs rounds, aggregates, records results |
| Flower apps | `backend/app/federated/flower_app.py` | The same loop across separate processes |
| Config | `backend/app/federated/config.py` | Round settings and seeds |
| Results | `backend/app/federated/results.py` | Round results and run history |
| Errors | `backend/app/federated/errors.py` | Typed failures |

## The aggregation, precisely

```
w_global = Σ_k (n_k / Σ_j n_j) · w_k
```

`n_k` is the number of local training examples client *k* used. This is the whole
point of FedAvg: a hospital with 48 studies influences the global model more than
one with 20, in proportion to the data it actually trained on.

Refused rather than averaged:

| Condition | Why |
|---|---|
| Parameter names differ between clients | Averaging incompatible structures is meaningless |
| Shapes differ for the same parameter | Same |
| A weight is negative, NaN or infinite | The average would be undefined or wrong |
| All weights are zero | Division by a zero total |
| A parameter contains NaN or Inf | One bad client would poison the global model |
| An update is empty, or non-numeric | Nothing to average |

Errors name the offending **client and parameter**, because "shape mismatch" on
its own is not actionable.

Averaging accumulates in float64 and casts back at the end, so many rounds do not
drift in float32.

## What a client sends, and what it never sends

Leaving a client (`ClientUpdate`):

- model parameters (weights and biases)
- the number of local training examples used — necessary for correct weighting
- mean training loss for the round
- validation loss and Dice on the client's own held-back split
- local epochs and wall-clock duration

Never leaving a client:

- training examples or patches
- labels or masks
- patient, study or scan identifiers
- per-sample losses or gradients

This is enforced structurally, not by convention: `LocalDataset` is created inside
the client and has no accessor, `ClientUpdate` is the only outbound type, and a
test asserts its exact field set — so adding a raw-data field would fail the suite
rather than ship quietly.

## Two ways to run it

### 1. Local simulation (default)

`python -m app.federated.run_local` from `backend/`, or the API's
`POST /api/v1/training/start`. All clients and the server live in one Python
process on one machine.

This exercises the aggregation arithmetic and the client boundary. It reports
`execution: "local-simulation"`.

### 2. Distributed local (Flower)

A real Flower server process plus three client processes, talking over gRPC on
localhost. See `fl/README.md` for the commands. This reports
`execution: "distributed-local"` and is what makes the client/server split real
rather than notional: the client processes genuinely cannot read each other's
data, because they do not share memory.

## Local simulation versus a real cross-silo deployment

This is the distinction the project must not blur, so it is written out rather
than implied.

| Concern | Local simulation | Distributed local (Flower) | Real cross-silo |
|---|---|---|---|
| Client separation | Same process | Separate processes | Separate machines and networks |
| Can client A read client B's data? | Not through the API; the objects are separate | No — no shared memory | No |
| Transport | None (in-process calls) | gRPC, plaintext on loopback | TLS, authenticated |
| Enforced by | Code structure | Process boundary | Network policy, hospital firewalls |
| Who runs the client | This program | This program | The hospital's own infrastructure |
| Data governance | None needed (synthetic) | None needed (synthetic) | Ethics approval, DPIA, audit |
| Failure modes exercised | A client raising during `fit()` | The same, plus gRPC timeouts | Plus network partitions, clock skew, version drift |
| What it proves | The aggregation is correct | The client/server split is real | Nothing here does this |

**A run on this machine does not demonstrate a cross-silo deployment.** It
demonstrates that the aggregation arithmetic is correct, that local training
happens, and that the client interface exposes only what it should. Everything in
the last column is untested and unimplemented.

What a real deployment would additionally require, none of which exists here:

1. The client running inside the hospital's network, under the hospital's
   control — not as a process the researchers start.
2. Mutual TLS and client authentication, so the server knows who is connecting.
3. A privacy mechanism with a real guarantee (see below).
4. An audit trail of who contributed what and when.
5. Approved data governance: ethics approval, a data-protection assessment, and a
   lawful basis for processing.
6. Robustness to the failures a network brings: retries, timeouts, stragglers and
   partial participation across days.

## Privacy: what is *not* implemented

There is **no** secure aggregation, **no** homomorphic encryption and **no**
differential privacy. None is implemented, so none is claimed, simulated or
approximated.

Specifically, this project does **not**:

- describe plaintext parameter exchange as "secure aggregation";
- flip a configuration flag and relabel the dashboard to imply a mechanism ran;
- apply a no-op "encryption" that base64s or masks updates without a security
  argument.

A request that asks for any of those mechanisms is **refused** with HTTP 422 and
`code: privacy_mechanism_not_implemented`, rather than being executed without them.
That refusal is the honest behaviour: the alternative is a run whose configuration
says one thing and whose behaviour does another.

When these are implemented (a later stage), each will need a real security
argument, not a label: for secure aggregation, a masking scheme with a
cancellation argument and a stated threat model; for DP, a privacy accountant
reporting an actual epsilon spent.

Note also that parameters are not automatically anonymous. Gradient and weight
updates can leak information about training data. Federated learning reduces the
need to centralise data; it is not by itself a privacy guarantee.

## The model used here

`TinyPatchSegmenter`, about 550 parameters, learning to segment a synthetic sphere
in a 16×16×16 patch.

It is a real, trainable model — genuine gradients, a loss that genuinely falls —
because federated averaging has to average *something*, and a tiny model keeps a
round finishable in under a second on a CPU-only machine.

**It is not the MRI segmentation model.** The 3D U-Net with PyTorch and MONAI is a
later stage and is not implemented. Nothing in the federated layer reads or
understands MRI data, and no number produced here says anything about segmentation
performance on real scans.

## Data

Procedurally generated float arrays. No patient, no scan, no DICOM, no NIfTI, no
identifier. The three clients differ deliberately — different lesion size ranges,
noise levels and sample counts — so the federation is non-IID. Averaging identical
shards would flatter the result.

## Reproducibility

Every round configuration records its seed. The same configuration produces the
same run on the same machine:

- model initialisation is seeded (`config.seed`)
- each client's data is generated from `(seed, client name, patch size)`
- each client's batch order is seeded from `(seed, client name)`
- the train/validation split is seeded from `(seed, client name, "split")`

The seed is stored in the run's results, so a reported result can be traced back to
the configuration that produced it. Cross-machine bit-identical reproduction is not
claimed: BLAS reduction order can differ between CPUs.

## Running it

### In-process (simplest)

```cmd
cd /d D:\FedMed-Axlero-Internship\backend
..\.venv\Scripts\python.exe -m app.federated.run_local --rounds 5 --clients 3 --seed 42
```

### Through the API

```cmd
cd /d D:\FedMed-Axlero-Internship\backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then `POST /api/v1/training/start` and poll `GET /api/v1/training/status`.

### Across separate processes (Flower)

See [../fl/README.md](../fl/README.md).

## Tests

```cmd
cd /d D:\FedMed-Axlero-Internship\backend
..\.venv\Scripts\python.exe -m pytest tests/test_fedavg.py tests/test_federated_client.py tests/test_federated_rounds.py -v
```

Covered: aggregation correctness and weighting, incompatible structures, invalid
weights, non-finite values, client isolation of raw data, a full round, client
failure and exclusion, and configuration validation.
