"""
StayPredict — Single-terminal launcher
Starts ML service, backend, and frontend in parallel.
Run: python start.py
     python start.py --no-frontend   (skip Vite dev server)
     python start.py --prod          (serve built frontend via backend)
"""

import subprocess
import sys
import os
import time
import signal
import threading
import argparse
import shutil
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).parent.resolve()
ML_DIR     = ROOT / "ml-service"
BACKEND    = ROOT / "backend"
FRONTEND   = ROOT / "frontend"

# ── Colors (works on Windows 10+ and all Unix) ────────────────────────────────
IS_WIN = sys.platform == "win32"

class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    RED    = "\033[91m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    CYAN   = "\033[96m"
    WHITE  = "\033[97m"
    GRAY   = "\033[90m"
    TEAL   = "\033[36m"
    NAVY   = "\033[34m"

def enable_win_ansi():
    """Enable ANSI escape codes on Windows."""
    if IS_WIN:
        try:
            import ctypes
            kernel = ctypes.windll.kernel32
            kernel.SetConsoleMode(kernel.GetStdHandle(-11), 7)
        except Exception:
            pass

enable_win_ansi()

def banner():
    print(f"""
{C.TEAL}{C.BOLD}╔══════════════════════════════════════════════════════╗
║        StayPredict — Starting All Services           ║
║   Hospital LOS Prediction & Bed Management System    ║
╚══════════════════════════════════════════════════════╝{C.RESET}
""")

# ── Detect python / node / npm executables ────────────────────────────────────
def which(cmd):
    return shutil.which(cmd)

def get_python():
    # Prefer venv python if it exists
    if IS_WIN:
        venv_py = ROOT / ".venv" / "Scripts" / "python.exe"
        ml_venv = ML_DIR / ".venv" / "Scripts" / "python.exe"
    else:
        venv_py = ROOT / ".venv" / "bin" / "python"
        ml_venv = ML_DIR / ".venv" / "bin" / "python"

    for p in [ml_venv, venv_py]:
        if p.exists():
            return str(p)
    return which("python") or which("python3") or "python"

def get_node():
    return which("node") or "node"

def get_npm():
    return which("npm") or "npm"

def get_uvicorn(python_exe):
    """Find uvicorn — prefer same venv as python."""
    py = Path(python_exe)
    if IS_WIN:
        uv = py.parent / "uvicorn.exe"
    else:
        uv = py.parent / "uvicorn"
    if uv.exists():
        return str(uv)
    # Fall back to running as module
    return None

# ── Service definitions ───────────────────────────────────────────────────────
def build_commands(args):
    python  = get_python()
    npm     = get_npm()
    uvicorn = get_uvicorn(python)

    ml_cmd = (
        [str(uvicorn), "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
        if uvicorn
        else [python, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    )

    services = [
        {
            "name":    "ML Service",
            "tag":     "[ML]  ",
            "color":   C.TEAL,
            "cmd":     ml_cmd,
            "cwd":     str(ML_DIR),
            "port":    8000,
            "ready":   "Application startup complete",
        },
        {
            "name":    "Backend",
            "tag":     "[API] ",
            "color":   C.NAVY,
            "cmd":     [get_node(), "src/server.js"],
            "cwd":     str(BACKEND),
            "port":    5000,
            "ready":   "running on port",
            "env":     {"NODE_ENV": "development"},
        },
    ]

    if not args.no_frontend:
        if args.prod:
            # Serve built dist via a simple http.server on 5173
            services.append({
                "name":  "Frontend",
                "tag":   "[UI]  ",
                "color": C.GREEN,
                "cmd":   [python, "-m", "http.server", "5173", "--directory", str(FRONTEND / "dist")],
                "cwd":   str(FRONTEND),
                "port":  5173,
                "ready": "Serving HTTP",
            })
        else:
            services.append({
                "name":  "Frontend",
                "tag":   "[UI]  ",
                "color": C.GREEN,
                "cmd":   [npm, "run", "dev"],
                "cwd":   str(FRONTEND),
                "port":  5173,
                "ready": "Local",
            })

    return services

# ── Process manager ───────────────────────────────────────────────────────────
processes  = []
stop_event = threading.Event()

def log(tag, color, line):
    ts = time.strftime("%H:%M:%S")
    print(f"{C.GRAY}{ts}{C.RESET} {color}{C.BOLD}{tag}{C.RESET} {line}", flush=True)

def stream(proc, tag, color):
    """Read stdout+stderr from a process and print with tag."""
    try:
        for raw in proc.stdout:
            if stop_event.is_set():
                break
            line = raw.rstrip()
            if line:
                log(tag, color, line)
    except Exception:
        pass

def run_service(svc, ready_events):
    tag   = svc["tag"]
    color = svc["color"]
    cwd   = svc["cwd"]
    cmd   = svc["cmd"]
    extra_env = svc.get("env", {})

    env = os.environ.copy()
    # Load backend .env into subprocess environment
    env_file = Path(cwd) / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env.setdefault(k.strip(), v.strip())
    env.update(extra_env)

    log(tag, color, f"Starting: {' '.join(str(c) for c in cmd)}")
    log(tag, color, f"CWD: {cwd}")

    try:
        proc = subprocess.Popen(
            cmd, cwd=cwd, env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace",
            bufsize=1,
        )
        processes.append(proc)

        ready_marker = svc.get("ready", "")
        ready_set    = False

        for raw in proc.stdout:
            if stop_event.is_set():
                break
            line = raw.rstrip()
            if not line:
                continue
            log(tag, color, line)
            if not ready_set and ready_marker and ready_marker.lower() in line.lower():
                ready_set = True
                ready_events[svc["name"]].set()

        proc.wait()
        if not stop_event.is_set():
            log(tag, C.RED, f"⚠ Process exited with code {proc.returncode}")

    except FileNotFoundError as e:
        log(tag, C.RED, f"✗ Command not found: {e}")
        log(tag, C.RED, f"  Make sure dependencies are installed.")
        ready_events[svc["name"]].set()  # unblock so others still start
    except Exception as e:
        log(tag, C.RED, f"✗ Error: {e}")
        ready_events[svc["name"]].set()

def shutdown(sig=None, frame=None):
    if stop_event.is_set():
        return
    stop_event.set()
    print(f"\n{C.YELLOW}{C.BOLD}[STOP] Shutting down all services…{C.RESET}")
    for p in processes:
        try:
            if p.poll() is None:
                if IS_WIN:
                    p.terminate()
                else:
                    p.send_signal(signal.SIGTERM)
        except Exception:
            pass
    time.sleep(1)
    for p in processes:
        try:
            if p.poll() is None:
                p.kill()
        except Exception:
            pass
    print(f"{C.GREEN}[STOP] All services stopped.{C.RESET}")
    sys.exit(0)

# ── Pre-flight checks ─────────────────────────────────────────────────────────
def preflight(args):
    ok = True

    print(f"{C.BOLD}Pre-flight checks…{C.RESET}")

    # Python
    python = get_python()
    print(f"  {'✓' if python else '✗'} Python  → {python}")

    # Node
    node = get_node()
    print(f"  {'✓' if node else '✗'} Node    → {node or 'NOT FOUND — install Node.js'}")
    if not node:
        ok = False

    # npm
    npm = get_npm()
    if not args.no_frontend:
        print(f"  {'✓' if npm else '✗'} npm     → {npm or 'NOT FOUND'}")

    # Model artifact
    model = ML_DIR / "artifacts" / "model.joblib"
    if model.exists():
        print(f"  ✓ Model  → {model}")
    else:
        print(f"  {C.YELLOW}⚠ Model artifact not found at {model}{C.RESET}")
        print(f"    Run: cd ml-service && python -m training.train")

    # backend .env
    benv = BACKEND / ".env"
    if benv.exists():
        print(f"  ✓ backend/.env exists")
    else:
        print(f"  {C.YELLOW}⚠ backend/.env not found — copy from backend/.env.example{C.RESET}")

    # backend node_modules
    nm = BACKEND / "node_modules"
    if nm.exists():
        print(f"  ✓ backend/node_modules exists")
    else:
        print(f"  {C.RED}✗ backend/node_modules missing — run: cd backend && npm install{C.RESET}")
        ok = False

    # frontend node_modules
    if not args.no_frontend and not args.prod:
        fnm = FRONTEND / "node_modules"
        if fnm.exists():
            print(f"  ✓ frontend/node_modules exists")
        else:
            print(f"  {C.RED}✗ frontend/node_modules missing — run: cd frontend && npm install{C.RESET}")
            ok = False

    # frontend dist (prod mode)
    if args.prod:
        dist = FRONTEND / "dist"
        if dist.exists():
            print(f"  ✓ frontend/dist exists (prod mode)")
        else:
            print(f"  {C.YELLOW}⚠ frontend/dist not found — run: cd frontend && npm run build{C.RESET}")

    print()
    return ok

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="StayPredict service launcher")
    parser.add_argument("--no-frontend", action="store_true", help="Skip the frontend dev server")
    parser.add_argument("--prod",        action="store_true", help="Serve built frontend (dist/) instead of Vite dev server")
    parser.add_argument("--skip-checks", action="store_true", help="Skip pre-flight checks")
    args = parser.parse_args()

    banner()

    if not args.skip_checks:
        ok = preflight(args)
        if not ok:
            print(f"{C.RED}Pre-flight failed. Fix the issues above and retry.{C.RESET}")
            sys.exit(1)

    services = build_commands(args)

    # Register shutdown handlers
    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Ready events — wait for ML before starting backend, etc.
    ready_events = {svc["name"]: threading.Event() for svc in services}

    print(f"{C.BOLD}Starting {len(services)} service(s)…{C.RESET}")
    print(f"{C.GRAY}Press Ctrl+C to stop all services.{C.RESET}\n")

    threads = []

    for i, svc in enumerate(services):
        t = threading.Thread(target=run_service, args=(svc, ready_events), daemon=True, name=svc["name"])

        if i == 0:
            # Start ML service immediately
            t.start()
            print(f"{C.GRAY}  Waiting for ML service to be ready…{C.RESET}")
            ready_events[svc["name"]].wait(timeout=60)
        elif i == 1:
            # Start backend after ML ready
            t.start()
            print(f"{C.GRAY}  Waiting for backend to be ready…{C.RESET}")
            ready_events[svc["name"]].wait(timeout=30)
        else:
            # Start frontend last
            time.sleep(1)
            t.start()

        threads.append(t)

    # Print access URLs once everything is up
    time.sleep(2)
    print(f"""
{C.TEAL}{C.BOLD}╔══════════════════════════════════════════════╗
║              All Services Running             ║
╠══════════════════════════════════════════════╣
║  🌐 Frontend   →  http://localhost:5173       ║
║  🔌 Backend    →  http://localhost:5000/api   ║
║  🤖 ML Service →  http://localhost:8000/docs  ║
╚══════════════════════════════════════════════╝{C.RESET}

{C.GRAY}Demo logins:{C.RESET}
  Admin:   admin@staypredict.demo  /  Admin@12345
  Staff:   staff@staypredict.demo  /  Staff@12345
  Patient: patient@staypredict.demo / Patient@1

{C.GRAY}Press Ctrl+C to stop all services.{C.RESET}
""")

    # Keep main thread alive
    try:
        while not stop_event.is_set():
            time.sleep(0.5)
            # Check if all subprocesses have died unexpectedly
            if all(p.poll() is not None for p in processes) and processes:
                print(f"\n{C.RED}All processes have exited.{C.RESET}")
                break
    except KeyboardInterrupt:
        shutdown()

if __name__ == "__main__":
    main()