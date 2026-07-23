"""
資料層：SQLite 連線、資料表建立、admin 啟動、稽核紀錄、檔案清單。
密碼一律以 Werkzeug 雜湊儲存（單向、不可還原）。
"""
import os
import sqlite3
import secrets
from datetime import datetime

from flask import request, g
from werkzeug.security import generate_password_hash

import config


def db_conn():
    con = sqlite3.connect(config.DB_FILE)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    """建立資料表；若無 admin 則建立（密碼取自環境變數或自動產生）。"""
    with db_conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                pw_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                active INTEGER NOT NULL DEFAULT 1,
                must_change INTEGER NOT NULL DEFAULT 1,
                created_by TEXT,
                created_at TEXT
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL,
                username TEXT,
                action TEXT NOT NULL,
                target TEXT,
                ip TEXT,
                result TEXT,
                detail TEXT
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS file_owner (
                filename TEXT PRIMARY KEY,
                owner TEXT,
                ts TEXT
            )
        """)
        cur = con.execute("SELECT COUNT(*) AS n FROM users WHERE role='admin'")
        if cur.fetchone()["n"] == 0:
            env_pw = os.environ.get("SIGN_ADMIN_PASSWORD")
            if env_pw:
                pw, must_change = env_pw, 0
                print(">> 已用環境變數 SIGN_ADMIN_PASSWORD 建立 admin 帳號。")
            else:
                pw, must_change = secrets.token_urlsafe(9), 1
                print("=" * 60)
                print(">> 已自動建立 admin 帳號")
                print(">>   帳號: admin")
                print(">>   臨時密碼: " + pw)
                print(">>   首次登入請立即修改密碼。")
                print("=" * 60)
            con.execute(
                "INSERT INTO users(username, pw_hash, role, active, must_change, created_by, created_at) "
                "VALUES(?,?,?,?,?,?,?)",
                ("admin", generate_password_hash(pw), "admin", 1, must_change,
                 "system", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            )


def get_user(username):
    with db_conn() as con:
        return con.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()


# ---------- 稽核 / 使用者行為紀錄 ----------
def write_user_log(ts, username, action, target, ip, result, detail):
    """把單筆行為寫到 logs/<帳號>_log.txt，方便直接開檔觀察。"""
    try:
        safe = "".join(ch for ch in (username or "anon") if ch.isalnum() or ch in "._-") or "anon"
        parts = ["[%s]" % ts, "IP=%s" % (ip or "-"), "action=%s" % action]
        if target:
            parts.append("target=%s" % target)
        parts.append("result=%s" % result)
        if detail:
            parts.append(detail)
        with open(os.path.join(config.LOG_DIR, safe + "_log.txt"), "a", encoding="utf-8") as f:
            f.write(" ".join(parts) + "\n")
    except Exception:
        pass


def audit(action, target="", result="ok", detail="", username=None):
    """寫一筆稽核到 DB 的 audit 表，並同步寫到 logs/<帳號>_log.txt。"""
    try:
        u = username
        if u is None:
            u = g.user["username"] if getattr(g, "user", None) else "anon"
        ip = request.remote_addr if request else ""
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with db_conn() as con:
            con.execute(
                "INSERT INTO audit(ts, username, action, target, ip, result, detail) VALUES(?,?,?,?,?,?,?)",
                (ts, u, action, target, ip, result, detail)
            )
        write_user_log(ts, u, action, target, ip, result, detail)
    except Exception:
        pass


# ---------- 檔案清單 ----------
def human_size(n):
    for unit in ["B", "KB", "MB", "GB"]:
        if n < 1024.0:
            return "%.1f %s" % (n, unit)
        n /= 1024.0
    return "%.1f TB" % n


def owner_map():
    with db_conn() as con:
        rows = con.execute("SELECT filename, owner FROM file_owner").fetchall()
    return {r["filename"]: r["owner"] for r in rows}


def _file_info(directory, filename, owners):
    path = os.path.join(directory, filename)
    try:
        st = os.stat(path)
        return {"name": filename, "size": human_size(st.st_size),
                "mtime": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
                "owner": owners.get(filename, "-")}
    except OSError:
        return {"name": filename, "size": "-", "mtime": "-", "owner": owners.get(filename, "-")}


def list_waiting():
    owners = owner_map()
    files = [f for f in os.listdir(config.PUBLIC_DIR) if f.lower().endswith(config.ALLOWED_EXT)]
    return sorted([_file_info(config.PUBLIC_DIR, f, owners) for f in files], key=lambda x: x["name"].lower())


def list_done():
    if not os.path.exists(config.SIGNED_DIR):
        return []
    owners = owner_map()
    files = [f for f in os.listdir(config.SIGNED_DIR) if os.path.isfile(os.path.join(config.SIGNED_DIR, f))]
    return sorted([_file_info(config.SIGNED_DIR, f, owners) for f in files], key=lambda x: x["name"].lower())


def set_file_owner(filename, owner):
    with db_conn() as con:
        con.execute("INSERT OR REPLACE INTO file_owner(filename, owner, ts) VALUES(?,?,?)",
                    (filename, owner, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))


def clear_file_owner(filename):
    with db_conn() as con:
        con.execute("DELETE FROM file_owner WHERE filename=?", (filename,))
