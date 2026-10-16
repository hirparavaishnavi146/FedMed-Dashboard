# FedMed Flower: server and clients across separate processes

This runs the same federation as the in-process runner, but with the server and
each hospital client in **separate OS processes** talking over gRPC. That makes
the client/server split real rather than notional: client processes cannot read
each other's data because they share no memory.

Execution mode: **`distributed-local`**. All processes are on one machine, the
transport is plaintext gRPC on loopback, and there is no authentication. This is
**not** a cross-silo deployment across hospital infrastructures — see
[../docs/FEDERATED.md](../docs/FEDERATED.md) for what that would still require.

## Before you start

Install the dependencies if you have not already:

```cmd
cd /d D:\FedMed-Axlero-Internship
uv pip install --python .venv\Scripts\python.exe -r requirements-dev.txt
```

The Flower server needs **three client processes** to reach the full quorum. If
fewer connect, a round still runs as long as `min_clients` (default 2) reported.

## Running it on Windows

Open **four** Command Prompt windows, all starting here:

```cmd
cd /d D:\FedMed-Axlero-Internship\backend
```

**Window 1 — the server.** Start it first and leave it running:

```cmd
..\.venv\Scripts\python.exe -m app.federated.flower_app server --address 127.0.0.1:8080 --rounds 3 --seed 42
```

It will print the configuration and wait for clients.

**Windows 2, 3, 4 — one client each.** Start them within ~30 seconds of each
other:

```cmd
..\.venv\Scripts\python.exe -m app.federated.flower_app client --hospital HOSP-01 --address 127.0.0.1:8080 --seed 42
```

```cmd
..\.venv\Scripts\python.exe -m app.federated.flower_app client --hospital HOSP-02 --address 127.0.0.1:8080 --seed 42
```

```cmd
..\.venv\Scripts\python.exe -m app.federated.flower_app client --hospital HOSP-03 --address 127.0.0.1:8080 --seed 42
```

Each client prints its local training and validation example counts, trains, sends
its parameters, and exits when the server finishes.

The server prints one line per round:

```
[round 1] aggregated 3 updates (84 examples) -> loss 0.3690
[round 2] aggregated 3 updates (84 examples) -> loss 0.2344
[round 3] aggregated 3 updates (84 examples) -> loss 0.2184
server finished: rounds=3 losses=[0.368966, 0.23439, 0.218397]
  execution distributed-local: separate processes over plaintext gRPC on loopback.
```

## Options

Both roles accept the same flags, and they must agree or the clients will train a
different experiment from the one the server aggregates.

| Flag | Default | Meaning |
|---|---|---|
| `--address` | `127.0.0.1:8080` | Server address |
| `--rounds` | 3 | Federated rounds (server only) |
| `--local-epochs` | 2 | Local epochs per round |
| `--learning-rate` | 0.05 | Local SGD learning rate |
| `--clients` | 3 | Expected client count |
| `--min-clients` | 2 | Quorum for a round |
| `--seed` | 42 | Seeds data, initialisation and batch order |
| `--patch-size` | 16 | Patch edge length |
| `--hospital` | — | Required for the client role: `HOSP-01`, `HOSP-02` or `HOSP-03` |

Same seed on both sides means the same data and the same starting model.

## Stopping cleanly

`Ctrl + C` in each window. If a client dies mid-run, the server tolerates it
(`accept_failures`) and the round proceeds while at least `--min-clients`
remain; a round with fewer usable updates is reported as failed rather than
averaged from a single client.

## What is real here, and what is not

Real: separate processes, gRPC transport, genuine local training with real
gradients, Flower's client selection and round orchestration, and aggregation
performed by this project's own FedAvg (`fedavg.weighted_average`, tested in
`tests/test_fedavg.py` and cross-checked against Flower's built-in FedAvg in
`tests/test_flower_integration.py`).

Not real: the data is synthetic, the model is a ~550-parameter stand-in rather
than the MRI 3D U-Net, the transport is unencrypted with no authentication, and
every process is started by the same person on the same machine.

There is **no** secure aggregation, homomorphic encryption or differential
privacy in this path either. Flower ships differential-privacy strategies
(`DPFedAvgFixed`, `DPFedAvgAdaptive`) but this project does not use them, because
enabling one would mean the project claimed a privacy mechanism it had not
tested or argued for.

## Why the classic API

Flower 1.39 offers both the newer `ServerApp`/`ClientApp` API and the classic
`NumPyClient`/`start_server`/`start_client` API. This project uses the classic one
because `FitRes.num_examples` supplies the sample count that FedAvg weights by,
which is exactly the quantity this project must weight on. The choice was made
after inspecting the installed package, not from memory.

## Verifying the integration

```cmd
cd /d D:\FedMed-Axlero-Internship\backend
..\.venv\Scripts\python.exe -m pytest tests/test_flower_integration.py -v
```

These tests check parameter transport, that the strategy uses this project's
FedAvg, that weights equal sample counts, and that our FedAvg agrees with
Flower's built-in implementation on identical inputs.
