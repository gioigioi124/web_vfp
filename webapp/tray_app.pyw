import ctypes
import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
LOG_DIR = ROOT_DIR / "logs"
LOG_FILE = LOG_DIR / "server.log"
PID_FILE = LOG_DIR / "server.pid"

# Redirect stdout/stderr BEFORE importing uvicorn/fastapi because pythonw.exe sets them to None.
LOG_DIR.mkdir(parents=True, exist_ok=True)
if LOG_FILE.exists() and LOG_FILE.stat().st_size > 5 * 1024 * 1024:
    backup_log = LOG_DIR / "server.log.1"
    try:
        if backup_log.exists():
            backup_log.unlink()
        LOG_FILE.rename(backup_log)
    except OSError:
        pass

_log_stream = open(LOG_FILE, "a", encoding="utf-8", buffering=1)
sys.stdout = _log_stream
sys.stderr = _log_stream

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pystray
import uvicorn
from PIL import Image, ImageDraw, ImageFont

from app.config import settings
from app.main import app as fastapi_app


def _show_message(title: str, text: str, flags: int = 0x40) -> None:
    """Hiển thị hộp thoại Windows (0x40 = Information, 0x10 = Error)."""
    try:
        ctypes.windll.user32.MessageBoxW(None, text, title, flags)
    except Exception:
        print(f"[{title}] {text}")


def _get_lan_ip() -> str:
    """Lấy địa chỉ IP LAN hiện tại của máy chủ (ưu tiên card mạng ra LAN)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("192.168.10.8", 14333))
            ip = s.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass
    try:
        hostname_ip = socket.gethostbyname(socket.gethostname())
        if hostname_ip and not hostname_ip.startswith("127."):
            return hostname_ip
    except OSError:
        pass
    return "127.0.0.1"


def _is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _create_tray_icon_image() -> Image.Image:
    """Tạo icon 64x64 sắc nét cho khay hệ thống Windows."""
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Nền xanh dương bo góc
    draw.rounded_rectangle([(2, 2), (61, 61)], radius=14, fill=(29, 78, 216, 255))

    # Chữ "1S" màu trắng ở giữa
    try:
        font = ImageFont.truetype("segoeui.ttf", 28)
    except OSError:
        font = ImageFont.load_default()

    text = "1S"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1] - 2
    draw.text((tx, ty), text, fill=(255, 255, 255, 255), font=font)

    # Chấm xanh lá báo trạng thái đang chạy
    draw.ellipse([(44, 44), (60, 60)], fill=(34, 197, 94, 255), outline=(255, 255, 255, 255), width=2)
    return img


def _write_pid_file() -> None:
    try:
        PID_FILE.write_text(str(os.getpid()), encoding="utf-8")
    except OSError:
        pass


def _remove_pid_file() -> None:
    try:
        if PID_FILE.exists():
            PID_FILE.unlink()
    except OSError:
        pass


def main() -> None:
    port = settings.APP_PORT
    host = settings.APP_HOST

    if _is_port_in_use(port):
        lan_ip = _get_lan_ip()
        _show_message(
            "1S Sales Voucher Web App",
            f"Cổng {port} đang được sử dụng (có thể ứng dụng đã được bật sẵn).\n\n"
            f"Truy cập tại máy này: http://localhost:{port}/sales-invoices\n"
            f"Truy cập từ máy khác trong LAN: http://{lan_ip}:{port}/sales-invoices",
        )
        webbrowser.open(f"http://localhost:{port}/sales-invoices")
        return

    _write_pid_file()
    lan_ip = _get_lan_ip()
    local_url = f"http://localhost:{port}/sales-invoices"
    lan_url = f"http://{lan_ip}:{port}/sales-invoices"
    docs_url = f"http://localhost:{port}/docs"

    print("=" * 60)
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Khoi dong 1S Sales Voucher Server")
    print(f"Local URL: {local_url}")
    print(f"LAN URL:   {lan_url}")
    print("=" * 60)

    config = uvicorn.Config(
        fastapi_app,
        host=host,
        port=port,
        log_level="info",
        access_log=True,
        use_colors=False,
    )
    server = uvicorn.Server(config)
    # Tắt signal handler vì uvicorn chạy trong background thread, không phải main thread.
    server.install_signal_handlers = lambda: None

    server_thread = threading.Thread(target=server.run, name="uvicorn-server", daemon=True)
    server_thread.start()

    # Chờ tối đa 8 giây để cổng sẵn sàng trước khi báo cho người dùng
    ready = False
    for _ in range(40):
        if not server_thread.is_alive():
            break
        if _is_port_in_use(port):
            ready = True
            break
        time.sleep(0.2)

    if not ready:
        _remove_pid_file()
        _show_message(
            "Lỗi khởi động 1S Sales Voucher",
            f"Không thể khởi động server trên cổng {port}.\n"
            f"Vui lòng kiểm tra log tại:\n{LOG_FILE}",
            flags=0x10,
        )
        return

    def on_open_app(icon, item):
        webbrowser.open(local_url)

    def on_open_docs(icon, item):
        webbrowser.open(docs_url)

    def on_open_log(icon, item):
        try:
            os.startfile(str(LOG_FILE))
        except Exception:
            pass

    def on_exit(icon, item):
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Nhan lenh tat server tu System Tray.")
        server.should_exit = True
        server_thread.join(timeout=4.0)
        _remove_pid_file()
        icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem(f"Đang chạy - Port {port}", None, enabled=False),
        pystray.MenuItem(f"Địa chỉ LAN: {lan_ip}:{port}", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Mở ứng dụng (Trình duyệt)", on_open_app, default=True),
        pystray.MenuItem("Mở API Docs (/docs)", on_open_docs),
        pystray.MenuItem("Xem file Log", on_open_log),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Thoát (Tắt Server)", on_exit),
    )

    tray_icon = pystray.Icon(
        name="1S_Sales_Voucher",
        icon=_create_tray_icon_image(),
        title=f"1S Sales Voucher (Port {port})\nLAN: {lan_ip}:{port}",
        menu=menu,
    )

    def _notify_started(icon: pystray.Icon) -> None:
        icon.visible = True
        try:
            icon.notify(
                f"Máy khác trong LAN truy cập:\nhttp://{lan_ip}:{port}/sales-invoices",
                f"1S Sales Voucher đã sẵn sàng (Port {port})",
            )
        except Exception:
            pass

    try:
        tray_icon.run(setup=_notify_started)
    finally:
        server.should_exit = True
        _remove_pid_file()


if __name__ == "__main__":
    main()
