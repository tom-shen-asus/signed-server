"""
安全性：secret_key 持久化、登入失敗鎖定、權限裝飾器、安全的 next 驗證、
請求前置（載入登入者 / 強制改密碼）、回應安全標頭。
"""
import os
import secrets
from functools import wraps
from datetime import datetime, timedelta

from flask import g, session, request, redirect, url_for

import config
from db import get_user


# ---------- secret_key 持久化 ----------
def load_secret_key():
    if os.path.exists(config.SECRET_FILE):
        with open(config.SECRET_FILE, "r") as f:
            return f.read().strip()
    key = secrets.token_hex(32)
    with open(config.SECRET_FILE, "w") as f:
        f.write(key)
    try:
        os.chmod(config.SECRET_FILE, 0o600)
    except OSError:
        pass
    return key


# ---------- 登入失敗鎖定（記憶體內）----------
_fails = {}


def is_locked(username):
    info = _fails.get(username)
    if not info:
        return False
    return bool(info.get("until") and datetime.now() < info["until"])


def record_fail(username):
    info = _fails.get(username, {"count": 0, "until": None})
    info["count"] += 1
    if info["count"] >= config.MAX_LOGIN_FAILS:
        info["until"] = datetime.now() + timedelta(minutes=config.LOCKOUT_MINUTES)
        info["count"] = 0
    _fails[username] = info


def clear_fail(username):
    _fails.pop(username, None)


# ---------- 安全的 next（防開放轉址 / 反射式 XSS）----------
def safe_next(nxt):
    if not nxt or not nxt.startswith("/"):
        return "/"
    if nxt.startswith("//") or nxt.startswith("/\\"):
        return "/"
    for ch in nxt:
        if not (ch.isalnum() or ch in "/_-.%?=&"):
            return "/"
    return nxt


# ---------- 權限裝飾器 ----------
def login_required(f):
    @wraps(f)
    def wrapper(*a, **k):
        if g.user is None:
            return redirect(url_for("auth.login", next=request.path))
        return f(*a, **k)
    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*a, **k):
        if g.user is None:
            return redirect(url_for("auth.login", next=request.path))
        if g.user["role"] != "admin":
            return "Forbidden: 需要管理員權限", 403
        return f(*a, **k)
    return wrapper


def token_or_login(f):
    """簽章機端點：登入者、正確 token、或在 IP 允許清單內皆可。
    若 SIGNING_MACHINE_IPS 留空，則開放免 token（讓 sign_client.bat 不用改）。"""
    @wraps(f)
    def wrapper(*a, **k):
        if g.user is not None:
            return f(*a, **k)
        token = request.headers.get("X-Auth-Token") or request.args.get("token")
        if config.API_TOKEN and token == config.API_TOKEN:
            return f(*a, **k)
        if config.SIGNING_MACHINE_IPS:
            if request.remote_addr in config.SIGNING_MACHINE_IPS:
                return f(*a, **k)
            return "Unauthorized", 401
        return f(*a, **k)   # 未設定 IP 清單 = 開放
    return wrapper


# ---------- 請求前置 / 安全標頭 ----------
def register_hooks(app):
    @app.before_request
    def load_logged_in_user():
        g.user = None
        uname = session.get("username")
        if uname:
            row = get_user(uname)
            if row and row["active"]:
                g.user = row
            else:
                session.clear()
        # 首次登入強制改密碼
        if g.user and g.user["must_change"]:
            allowed = {"auth.change_password", "auth.logout", "static"}
            if request.endpoint not in allowed:
                return redirect(url_for("auth.change_password"))

    @app.after_request
    def security_headers(resp):
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "no-referrer"
        return resp
