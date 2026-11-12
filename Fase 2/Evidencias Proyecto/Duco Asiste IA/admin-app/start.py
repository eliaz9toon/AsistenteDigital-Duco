"""Open Duco and start its local backend when necessary."""

import json
import os
import threading
import time
import webbrowser
from urllib.request import ProxyHandler, build_opener

from app import load_dotenv, main


def main_launcher():
    load_dotenv()
    base_url = "http://127.0.0.1:" + os.getenv("ADMIN_PORT", "8765")
    http = build_opener(ProxyHandler({}))

    def is_ready():
        try:
            with http.open(base_url + "/api/duco/health", timeout=1) as response:
                return json.load(response).get("service") == "duco-admin"
        except (OSError, ValueError):
            return False

    if is_ready():
        webbrowser.open(base_url + "/duco")
        return

    def open_when_ready():
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if is_ready():
                webbrowser.open(base_url + "/duco")
                return
            time.sleep(0.3)

    threading.Thread(target=open_when_ready, daemon=True).start()
    main()


if __name__ == "__main__":
    main_launcher()
