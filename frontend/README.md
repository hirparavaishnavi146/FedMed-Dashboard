# FedMed frontend

React + TypeScript + Vite dashboard for the FedMed cross-silo federated learning
project. **Stage 1: frontend only.** No backend, no federated learning, no model
and no real security mechanism is connected. Every number on screen is labelled
demo data.

## Run it (Windows, Command Prompt)

```cmd
cd /d D:\FedMed-Axlero-Internship\frontend
npm install
npm run dev
```

Then open the address it prints:

```
http://localhost:5173
```

Stop the server with `Ctrl + C` in that terminal.

### Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload on <http://localhost:5173> |
| `npm run build` | Type-checks with `tsc --noEmit`, then builds to `dist/` |
| `npm run preview` | Serves the built `dist/` folder on <http://127.0.0.1:4173> |
| `npm run typecheck` | Type check only, no build |

### Run it in VS Code

1. Open the project: **File → Open Folder → `D:\FedMed-Axlero-Internship`**.
2. Open a terminal: **Ctrl + `** (backtick), or **Terminal → New Terminal**.
3. Type `cd frontend`, then `npm run dev`.
4. Ctrl + click the `http://localhost:5173` link in the terminal output.

## Configuration

Copy `.env.example` to `.env` to change anything:

```cmd
cd /d D:\FedMed-Axlero-Internship\frontend
copy .env.example .env
```

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Where the FastAPI backend will live |
| `VITE_USE_DEMO_DATA` | `true` | `true` renders labelled sample data and makes no network calls. `false` calls the real API and shows errors if it is down |
| `VITE_API_TIMEOUT_SECONDS` | `10` | Request timeout |

`.env` is Git-ignored. Only variables starting with `VITE_` reach the browser, so
never put a secret in there.

## Pages

| Route | Page | Contents |
|---|---|---|
| `/` | Dashboard | Hospital count, rounds, Dice score, status, loss chart, activity feed, participation table |
| `/training` | Training | Config form with validation, progress charts, round history. Start/Stop disabled with reasons |
| `/hospitals` | Hospitals | Three simulated nodes, search, filters, sortable table, details dialog |
| `/model-results` | Model Results | Version selector, metrics, comparison chart and table, training history |
| `/privacy-security` | Privacy & Security | Mechanisms with honest status, DP config fields, simulated audit log |

`/privacy` redirects to `/privacy-security`. Any other path shows a "page not
found" screen.

## Project structure

```
frontend/
  index.html            HTML shell; Vite mounts the app into <div id="root">
  public/favicon.svg    Browser tab icon
  src/
    main.tsx            Entry point: finds #root and renders <App />
    App.tsx             Routes; every page is lazy-loaded (own JS chunk)
    index.css           All styling: design tokens, components, responsive rules
    components/         Reusable UI (see below)
    layouts/            AppLayout: sidebar + header + page content
    pages/              One file per route
    hooks/              useApiResource (data loading), useMediaQuery (breakpoints)
    services/api.ts     The only place a backend URL is built
    types/index.ts      Shared TypeScript types
    data/demo.ts        All demo data, in one clearly marked file
```

### Components

| Component | Purpose |
|---|---|
| `Sidebar` | Navigation; collapses to an icon rail, becomes a drawer on mobile |
| `Header` | Page title, demo/live badge, backend address, refresh button |
| `MetricCard` | Headline number with unit, delta and footnote |
| `TrainingChart` | Wraps Recharts: `TrainingChart`, `TrendAreaChart`, `ComparisonBarChart` |
| `HospitalTable` | The hospital table plus `HospitalDetails` for the dialog |
| `RoundHistoryTable` | Per-round metrics table, shared by Training and Model Results |
| `StatusBadge` | Coloured status pill; text always states the status too |
| `Card` | `Card`, `CardHeader`, `PageHeader`, `StatList`, `ProgressBar` |
| `Button` | One button with variants, loading state and a `disabledReason` tooltip |
| `FormControls` | `TextField`, `NumberField`, `SelectField`, `RangeField`, `SwitchField` |
| `Tabs` | Tab strip with arrow-key, Home and End keyboard support |
| `Modal` | Accessible dialog: Escape closes, focus is trapped and restored |
| `States` | `LoadingState`, `EmptyState`, `ErrorState`, `Notice`, `SkeletonRows` |
| `Icon` | Stroked outline icon set (no emoji, no filled tiles) |

## What actually works

- All five routes, plus the redirect and the not-found page.
- Hospitals: search, status filter, sort by clicking column headers, details dialog.
- Training: form validation, presets, save/reset (stored in your browser only).
- Model Results: version switching, all three tabs, comparison table.
- Privacy: mechanism list, editable-but-inert DP fields, audit search and severity filter.
- Sidebar: collapse (remembered), mobile drawer with scrim, closes on navigation.
- Empty, loading and error states, including a real 10-second timeout message.
- Keyboard navigation for tabs, Escape to close the dialog, skip-to-content link.

## What is deliberately NOT implemented

- No federated learning, no Flower server, no clients, no FedAvg.
- No PyTorch/MONAI model, no training, no MRI data of any kind.
- No FastAPI backend; the API client is written but nothing consumes it.
- No encryption, secure aggregation or differential privacy.
- "Start federated training", "Stop" and every privacy switch are disabled with
  an on-screen reason instead of pretending to work.

## Notes for the next stage

- Set `VITE_USE_DEMO_DATA=false` once FastAPI exists, and implement
  `/health`, `/api/hospitals`, `/api/training/rounds`, `/api/models`,
  `/api/security/events` to match `src/types/index.ts`.
- Demo values are typed exactly like the real API responses, so switching over is
  a data-source change, not a rewrite.
