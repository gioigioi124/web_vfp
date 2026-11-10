import os
import sys
import subprocess
import time
import urllib.request
import webbrowser
import signal

def is_port_ready(url, timeout=1):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'HealthCheck'})
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status in (200, 404)
    except Exception:
        return False

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("=" * 65)
    print("  1S SALES VOUCHER WEB APPLICATION (GIAI DOAN 1: READ-ONLY)")
    print("=" * 65)
    print()

    # Find node
    node_cmd = "node"
    vite_js = os.path.join(frontend_dir, "node_modules", "vite", "bin", "vite.js")
    if not os.path.exists(vite_js):
        print(f"[ERROR] Khong tim thay {vite_js}. Vui long kiem tra npm install.")
        sys.exit(1)

    print("[1/2] Khoi dong Backend FastAPI (Port 8000)...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=backend_dir
    )

    print("[2/2] Khoi dong Frontend React Vite (Port 5173)...")
    frontend_proc = subprocess.Popen(
        [node_cmd, vite_js],
        cwd=frontend_dir
    )

    print()
    print("Dang cho he thong san sang...")

    backend_ok = False
    frontend_ok = False
    for i in range(20):
        time.sleep(0.5)
        if not backend_ok and is_port_ready("http://127.0.0.1:8000/docs"):
            backend_ok = True
            print("  [OK] Backend FastAPI da san sang: http://localhost:8000/docs")
        if not frontend_ok and is_port_ready("http://127.0.0.1:5173"):
            frontend_ok = True
            print("  [OK] Frontend React da san sang:  http://localhost:5173")
        if backend_ok and frontend_ok:
            break

    print()
    print("=" * 65)
    print("  HE THONG DA KHOI DONG THANH CONG!")
    print("  - Frontend App:         http://localhost:5173")
    print("  - Backend Swagger Docs: http://localhost:8000/docs")
    print("  (Nhan Ctrl+C hoac dong cua so nay de tat ung dung)")
    print("=" * 65)
    print()

    # Automatically open browser
    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    try:
        while True:
            if backend_proc.poll() is not None:
                print(f"[CANH BAO] Backend da thoat (exit code {backend_proc.returncode})")
                break
            if frontend_proc.poll() is not None:
                print(f"[CANH BAO] Frontend da thoat (exit code {frontend_proc.returncode})")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nDang tat he thong...")
    finally:
        for proc, name in [(backend_proc, "Backend"), (frontend_proc, "Frontend")]:
            try:
                proc.terminate()
                proc.wait(timeout=2)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        print("Da tat toan bo he thong.")

if __name__ == "__main__":
    main()
