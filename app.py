"""應用工廠：建立並設定 Flask app，註冊 blueprints、請求前置與安全設定。"""
import os
from datetime import timedelta

from flask import Flask

import config
from db import init_db
from security import load_secret_key, register_hooks
from auth import auth_bp
from portal import portal_bp
from machine import machine_bp
from admin import admin_bp


def create_app():
    config.ensure_dirs()

    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.secret_key = load_secret_key()

    use_https = os.path.exists(config.CERT_FILE) and os.path.exists(config.KEY_FILE)
    app.config.update(
        # 伺服器端後盾：session 壽命 = 閒置逾時；前端另有活動偵測會主動登出
        PERMANENT_SESSION_LIFETIME=timedelta(minutes=config.IDLE_MINUTES),
        SESSION_COOKIE_HTTPONLY=True,       # JS 無法讀取 session cookie
        SESSION_COOKIE_SAMESITE="Lax",      # 降低 CSRF
        SESSION_COOKIE_SECURE=use_https,    # 僅在 HTTPS 傳送 cookie
        MAX_CONTENT_LENGTH=config.MAX_CONTENT_LENGTH,
    )

    # 提供前端閒置逾時毫秒數給樣板
    @app.context_processor
    def inject_idle():
        return {"idle_ms": config.IDLE_MINUTES * 60 * 1000}

    register_hooks(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(portal_bp)
    app.register_blueprint(machine_bp)
    app.register_blueprint(admin_bp)

    init_db()
    return app
