"""Start the FedMed demo: the API, the permanent ngrok tunnel, and the browser.

WHAT THIS IS FOR
    A one-double-click restore after a reboot. It starts the API, exposes it on a
    permanent ngrok dev domain, and opens the dashboard.

WHY NGROK AND NOT A CLOUDFLARE QUICK TUNNEL
    A quick tunnel is issued a random hostname that Cloudflare reclaims after a while;
    it died six times in a single session, and each death required rebuilding the
    deployed frontend because the API address is compiled into it. A free ngrok account
    gets ONE permanent dev domain that survives restarts, so the deployed frontend
    keeps working and nothing needs rebuilding.

WHAT IT DOES NOT DO
    It does not make the deployment independent of this machine. The API still runs
    here, so the link works only while this PC is awake and these two processes run.
    Training also stays unavailable here: the API is started without torch on purpose
    (the web tier does not need it), so the training endpoints answer 503
    training_unavailable.

ENVIRONMENT
    The AI provider key is read from the Hermes config on disk and passed straight into
    the child process environment. It is never printed and never written to the repo.
"""

from __future__ import annotations

import os
import re
import socket
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
SCRATCH = Path(r"C:\Users\DELL\AppData\Local\hermes\cache\scratch")
API_LOG = SCRATCH / "api.log"
NGROK_LOG = SCRATCH / "ngrok.log"
NGROK = Path(
    r"C:\Users\DELL\AppData\Local\Microsoft\WinGet\Packages"
    r"\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
)
HERMES_CONFIG = Path.home() / "AppData/Local/hermes/config.yaml"

#: The permanent dev domain assigned to the ngrok account. Without it ngrok would use a
#: random hostname and the deployed frontend would break.
NGROK_DOMAIN = "secular-footsore-cedar.ngrok-free.dev"

PORT = 8000
SPACE_ORIGIN = "https://hirparavaishnavi146-fedmed-dashboard.static.hf.space"
DEPLOYED_URL = f"https://{NGROK_DOMAIN}"

CREATE_NO_WINDOW = 0x08000000


def notify(title: str, message: str) -> None:
    try:
        import ctypes

        ctypes.windll.user32.MessageBoxW(None, message, title, 0x40)
    except Exception:
        print(message)


def ai_key() -> str | None:
    """The AI provider key, read from the Hermes config.

    Returns None when it is not available, which is a valid state: the generated
    sections then report themselves unavailable instead of failing.
    """
    try:
        text = HERMES_CONFIG.read_text(encoding="utf-8")
    except OSError:
        return None
    match = re.search(r"^\s*api_key:\s*(.+)$", text, re.M)
    if not match:
        return None
    return match.group(1).strip().strip('"').strip("'") or None


def port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.5)
        return probe.connect_ex(("127.0.0.1", port)) == 0


def api_healthy() -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=3) as reply:
            return reply.status == 200
    except (urllib.error.URLError, OSError):
        return False


def start_api() -> subprocess.Popen:
    env = dict(os.environ)
    # Public-demo shape: no keys, report routes open, frontend served from this origin.
    env.pop("FEDMED_API_KEYS", None)
    env.pop("FEDMED_SECURE_AGGREGATION_SECRET", None)
    env["FEDMED_MEDICAL_REPORTS_PUBLIC_DEMO"] = "true"
    env["FEDMED_SERVE_FRONTEND"] = "true"
    env["FEDMED_CORS_ORIGINS"] = f"{SPACE_ORIGIN},https://fedmed-dashboard.vercel.app"

    key = ai_key()
    if key:
        env["FEDMED_AI_BASE_URL"] = "https://api.deepseek.com/v1"
        env["FEDMED_AI_API_KEY"] = key
        env["FEDMED_AI_MODEL"] = "deepseek-chat"
        env["FEDMED_AI_TIMEOUT_SECONDS"] = "90"

    handle = open(API_LOG, "w", encoding="utf-8")
    return subprocess.Popen(
        [str(PYTHON), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", f"--port={PORT}"],
        cwd=str(BACKEND),
        env=env,
        stdout=handle,
        stderr=subprocess.STDOUT,
        creationflags=CREATE_NO_WINDOW,
        close_fds=True,
    )


def start_ngrok() -> subprocess.Popen:
    handle = open(NGROK_LOG, "w", encoding="utf-8")
    return subprocess.Popen(
        [str(NGROK), "http", str(PORT), "--domain", NGROK_DOMAIN, "--log", "stdout"],
        stdout=handle,
        stderr=subprocess.STDOUT,
        creationflags=CREATE_NO_WINDOW,
        close_fds=True,
    )


def tunnel_url(timeout: int = 45) -> str | None:
    """Read the public URL from the ngrok agent's own local API."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=3) as reply:
                import json

                for tunnel in json.load(reply).get("tunnels", []):
                    url = tunnel.get("public_url") or ""
                    if url.startswith("https://"):
                        return url
        except (urllib.error.URLError, OSError, ValueError):
            pass
        time.sleep(1)
    return None


def main() -> int:
    if not PYTHON.is_file():
        notify("FedMed", f"Python virtualenv missing:\n{PYTHON}")
        return 1
    if not NGROK.is_file():
        notify("FedMed", f"ngrok not found:\n{NGROK}\n\nInstall it with:  winget install Ngrok.Ngrok")
        return 1
    if not (REPO / "frontend" / "dist" / "index.html").is_file():
        notify("FedMed", "The frontend is not built.\n\nRun this in frontend/:\n    npm run build")
        return 1

    # Quit any previous run so a restart does not stack processes.
    for name in ("ngrok",):
        subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             f"Get-Process {name} -ErrorAction SilentlyContinue | Stop-Process -Force"],
            capture_output=True,
            creationflags=CREATE_NO_WINDOW,
        )

    if not api_healthy():
        start_api()
        for _ in range(60):
            if api_healthy():
                break
            time.sleep(0.5)
        else:
            notify("FedMed", f"The API did not start.\n\nSee:\n{API_LOG}")
            return 1

    start_ngrok()
    url = tunnel_url()
    if url is None:
        notify("FedMed", f"ngrok did not report a URL.\n\nSee:\n{NGROK_LOG}")
        return 1

    try:
        subprocess.run(["clip"], input=url.encode("utf-16le"),
                       creationflags=CREATE_NO_WINDOW, check=False)
    except Exception:
        pass

    webbrowser.open(url)
    notify(
        "FedMed is running",
        f"{url}\n\nThis address is permanent and copied to your clipboard.\n\n"
        "The dashboard works while this computer is awake. To stop it, close the "
        "python and ngrok processes in Task Manager.\n\n"
        f"Deployed copy: {SPACE_ORIGIN}",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
