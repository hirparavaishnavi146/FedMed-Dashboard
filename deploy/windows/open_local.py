"""Open FedMed locally: one address for the frontend AND the backend.

The API serves the built frontend itself (FEDMED_SERVE_FRONTEND), so there is a single
origin to open -- no separate dev server, no second port, no tunnel, and no CORS to
configure. This starts that one process if it is not already running, waits for it to
answer, then opens the browser.

Why one origin matters here: with the pages and the API on the same address the browser
makes same-origin requests, so nothing depends on an origin being allowed or a tunnel
being alive. http://127.0.0.1:8000 works offline.

WHY THIS ALSO WIRES UP AN API KEY
    Dataset and training routes are mutations, so they require an API key while the
    read-only endpoints stay open. On a deployment that is exactly right. Locally it made
    "Validate directory" fail with `invalid_api_key` and nothing the user could do about
    it -- the built page had no key to send, because the bundle had been built for the
    public deployment, where a key must never appear.

    Locally the key is not a secret worth protecting: the server binds 127.0.0.1 and the
    key already lives in the Git-ignored frontend/.env.local. So this reads that key,
    hashes it for the server's FEDMED_API_KEYS, and ensures the built frontend contains
    it -- rebuilding once if the two halves disagree, because a page with no key cannot
    call a server that requires one.

    The public build stays the opposite: built with VITE_API_KEY="" so no key can leak
    into a bundle anyone can download. Local and public bundles therefore differ, and the
    deploy step must pass the empty key explicitly.

This is for USING the app. For editing the frontend with live reload, run `npm run dev`
in frontend/ instead -- that gives a second port by design, because a dev server
rebuilds on save.
"""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

REPO = Path(r"D:\FedMed-Axlero-Internship")
PYTHON = REPO / ".venv" / "Scripts" / "python.exe"
BACKEND = REPO / "backend"
FRONTEND = REPO / "frontend"
ENV_LOCAL = FRONTEND / ".env.local"
DIST = FRONTEND / "dist"
#: The LOCAL build goes to its own directory, separate from the deployable one.
#:
#: dist/ is what the public site is assembled from: tunnel API base, no API key. This
#: one is same-origin and carries the local dev key. They must not share a directory --
#: whichever built last would win, and the loser's page is broken in a way that looks
#: like a backend fault. Serving a tunnel-based bundle from 127.0.0.1:8000 makes every
#: request cross-origin to the tunnel host, which the server refuses, and the browser
#: reports only the bare "Failed to fetch" while the upload never leaves the page.
DIST_LOCAL = FRONTEND / "dist-local"
LOG = Path(r"C:\Users\DELL\AppData\Local\hermes\cache\scratch\api_local.log")
HERMES_CONFIG = Path.home() / "AppData/Local/hermes/config.yaml"

PORT = 8000
#: The single address. Frontend and API are both served here.
LOCAL_URL = f"http://127.0.0.1:{PORT}"
CREATE_NO_WINDOW = 0x08000000


def notify(title: str, message: str) -> None:
    try:
        import ctypes

        ctypes.windll.user32.MessageBoxW(None, message, title, 0x40)
    except Exception:
        print(message)


def ai_key() -> str | None:
    """The AI provider key, if the Hermes config has one.

    Optional: without it the report analysis still works and simply reports the
    generated sections as unavailable.
    """
    try:
        text = HERMES_CONFIG.read_text(encoding="utf-8")
    except OSError:
        return None
    import re

    found = re.search(r"^\s*api_key:\s*(.+)$", text, re.M)
    return found.group(1).strip().strip('"').strip("'") or None if found else None


def dev_key() -> str | None:
    """The local development key from frontend/.env.local, if one is set."""
    try:
        text = ENV_LOCAL.read_text(encoding="utf-8")
    except OSError:
        return None
    for line in text.splitlines():
        if line.startswith("VITE_API_KEY="):
            value = line.split("=", 1)[1].strip().strip('"').strip("'")
            return value or None
    return None


def build_frontend(api_key: str | None) -> bool:
    """Build the LOCAL bundle into dist-local: same origin, carrying the local key.

    Explicit rather than a plain `npm run build`, because that reads whatever .env.local
    holds and writes to the shared dist/ the deploy is assembled from. Same-origin means
    every request is relative, so the page cannot depend on the tunnel being up and no
    origin needs to be allowed.
    """
    env = dict(os.environ)
    env["VITE_API_SAME_ORIGIN"] = "true"
    env["VITE_API_BASE_URL"] = ""
    env["VITE_USE_DEMO_DATA"] = "false"
    env["VITE_HASH_ROUTER"] = "false"
    # Report analysis calls a live AI provider and can take a minute or more. The
    # default budget would abort it and report a failure the server never had.
    env["VITE_API_REPORT_TIMEOUT_SECONDS"] = "180"
    env["VITE_API_TIMEOUT_SECONDS"] = "30"
    if api_key:
        env["VITE_API_KEY"] = api_key

    result = subprocess.run(
        ["npm", "run", "build", "--", "--outDir", DIST_LOCAL.name],
        cwd=str(FRONTEND),
        env=env,
        capture_output=True,
        text=True,
        shell=True,
        creationflags=CREATE_NO_WINDOW,
    )
    if result.returncode != 0:
        notify(
            "FedMed",
            "The frontend build failed, so the pages would not match the API.\n\n"
            + (result.stderr or result.stdout or "")[-700:],
        )
        return False
    return True


def bundle_target(dist: Path) -> str:
    """Which API base a built bundle calls. Used to verify the build took effect.

    Returned values name the problem so the caller can report it: `tunnel` means this
    page would have to call a remote host, `absolute-local` a hardcoded loopback origin
    that would still differ from the page's own origin on any other port.
    """
    assets = dist / "assets"
    if not assets.is_dir():
        return "no-build"
    for path in assets.glob("index-*.js"):
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if "ngrok-free.dev" in text or "trycloudflare.com" in text:
            return "tunnel"
        if "127.0.0.1:8000" in text or "localhost:8000" in text:
            return "absolute-local"
        return "same-origin"
    return "unknown"


def stop_api() -> None:
    """Stop a running uvicorn so a configuration change actually takes effect.

    Starting a second process over a live one leaves the OLD configuration serving --
    which is how a key change can appear to do nothing at all.
    """
    if not healthy():
        return
    subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
            "Where-Object { $_.CommandLine -like '*uvicorn*' } | "
            "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
        ],
        capture_output=True,
        creationflags=CREATE_NO_WINDOW,
    )
    for _ in range(30):
        if not healthy():
            return
        time.sleep(0.5)


def healthy() -> bool:
    try:
        with urllib.request.urlopen(f"{LOCAL_URL}/health", timeout=3) as reply:
            return reply.status == 200
    except (urllib.error.URLError, OSError):
        return False


def start(api_key: str | None) -> None:
    env = dict(os.environ)
    env["FEDMED_SERVE_FRONTEND"] = "true"
    # Serve the LOCAL build, not the deployable dist/. An explicit path wins outright,
    # so the two bundles can never be confused for one another again.
    env["FEDMED_FRONTEND_DIR"] = str(DIST_LOCAL)
    # The report routes accept anonymous uploads, so the analysis workflow works locally
    # without any key handling at all.
    env["FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO"] = "true"

    if api_key:
        env["FEDMED_API_KEYS"] = f"local-ui:admin:{hashlib.sha256(api_key.encode()).hexdigest()}"

    # Set explicitly because an environment that already defined this replaces the
    # defaults rather than extending them -- which silently drops the dev-server ports
    # and breaks `npm run dev`. The public origins are included so the tunnel, which
    # forwards to this process, keeps serving the deployed site; the loopback origins
    # are included so a page served by this very process is allowed to call it.
    env["FEDMED_CORS_ORIGINS"] = env.get("FEDMED_CORS_ORIGINS") or ",".join(
        [
            f"http://127.0.0.1:{PORT}",
            f"http://localhost:{PORT}",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "https://hirparavaishnavi146-fedmed-dashboard.static.hf.space",
            "https://fedmed-dashboard.vercel.app",
        ]
    )

    key = ai_key()
    if key:
        env["FEDMED_AI_BASE_URL"] = "https://api.deepseek.com/v1"
        env["FEDMED_AI_API_KEY"] = key
        env["FEDMED_AI_MODEL"] = "deepseek-chat"
        env["FEDMED_AI_TIMEOUT_SECONDS"] = "90"

    LOG.parent.mkdir(parents=True, exist_ok=True)
    handle = open(LOG, "w", encoding="utf-8")
    return subprocess.Popen(
        [str(PYTHON), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=str(BACKEND),
        env=env,
        stdout=handle,
        stderr=subprocess.STDOUT,
        creationflags=CREATE_NO_WINDOW,
        close_fds=True,
    )


def main() -> int:
    if not PYTHON.is_file():
        notify("FedMed", f"Python virtualenv not found:\n{PYTHON}")
        return 1
    if not (DIST / "index.html").is_file():
        # dist/ is the deployable build, kept for assembling the public site. Its absence
        # is only a problem for a deploy, not for serving this machine.
        pass

    api_key = dev_key()

    # Always rebuild into dist-local. It is a separate directory from dist/ precisely so
    # this cannot disturb a deployable build, and so a stale local bundle cannot come back.
    if not build_frontend(api_key):
        return 1
    if not (DIST_LOCAL / "index.html").is_file():
        notify("FedMed", f"The build produced no index.html in {DIST_LOCAL}.")
        return 1
    target = bundle_target(DIST_LOCAL)
    if target != "same-origin":
        notify(
            "FedMed",
            f"The built frontend is not configured for local use (target: {target}).\n\n"
            "It must call the API on its own origin. Check frontend/.env.local and "
            "frontend/vite.config.ts.",
        )
        return 1

    # Restart rather than reusing a live process: the running one may hold older
    # configuration, which is exactly how a key change can appear to do nothing.
    if healthy():
        stop_api()
    start(api_key)

    for _ in range(60):
        if healthy():
            break
        time.sleep(0.5)
    else:
        notify("FedMed", f"The server did not start.\n\nSee:\n{LOG}")
        return 1

    webbrowser.open(LOCAL_URL)
    return 0


if __name__ == "__main__":
    sys.exit(main())
