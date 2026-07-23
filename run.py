"""進入點：python run.py
有 cert.pem / key.pem 就啟用 HTTPS(443)，否則退回 HTTP(8080)。
443 為特權埠：Windows 需以系統管理員身分執行；Linux 需 root 或 setcap。"""
import os

import config
from app import create_app

app = create_app()

if __name__ == "__main__":
    if os.path.exists(config.CERT_FILE) and os.path.exists(config.KEY_FILE):
        print(">> HTTPS 已啟用：https://<你的IP>/")
        app.run(host="0.0.0.0", port=443, threaded=True,
                ssl_context=(config.CERT_FILE, config.KEY_FILE))
    else:
        print(">> 找不到 cert.pem / key.pem，改用 HTTP（http://<你的IP>:8080/）")
        app.run(host="0.0.0.0", port=8080, threaded=True)
