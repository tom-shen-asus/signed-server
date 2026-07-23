"""管理後台：使用者管理（建立/重設/停用/刪除）與稽核紀錄檢視。僅 admin 可存取。"""
from datetime import datetime

from flask import Blueprint, request, jsonify, render_template, g
from werkzeug.security import generate_password_hash
import secrets

import config
from db import get_user, audit, db_conn
from security import admin_required

admin_bp = Blueprint("admin", __name__)


def _valid_username(uname):
    return bool(uname) and len(uname) <= 32 and all(ch.isalnum() or ch in "._-" for ch in uname)


@admin_bp.route("/admin")
@admin_required
def admin_page():
    return render_template("admin.html", username=g.user["username"])


@admin_bp.route("/admin/api/users")
@admin_required
def api_users():
    with db_conn() as con:
        rows = con.execute(
            "SELECT username, role, active, must_change, created_at FROM users ORDER BY role DESC, username"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@admin_bp.route("/admin/api/audit")
@admin_required
def api_audit():
    with db_conn() as con:
        rows = con.execute(
            "SELECT ts, username, action, target, ip, result FROM audit ORDER BY id DESC LIMIT 200"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@admin_bp.route("/admin/create_user", methods=["POST"])
@admin_required
def create_user():
    data = request.get_json(silent=True) or {}
    uname = (data.get("username") or "").strip()
    if not uname:
        return jsonify({"error": "帳號不可空白"}), 400
    if not _valid_username(uname):
        return jsonify({"error": "帳號僅能用英數字與 . _ - （最多 32 字）"}), 400
    if get_user(uname):
        return jsonify({"error": "帳號已存在"}), 400
    temp = secrets.token_urlsafe(9)
    with db_conn() as con:
        con.execute(
            "INSERT INTO users(username, pw_hash, role, active, must_change, created_by, created_at) "
            "VALUES(?,?,?,?,?,?,?)",
            (uname, generate_password_hash(temp), "user", 1, 1,
             g.user["username"], datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    audit("USER_CREATE", uname)
    return jsonify({"ok": True, "temp_password": temp})


@admin_bp.route("/admin/reset_password", methods=["POST"])
@admin_required
def reset_password():
    data = request.get_json(silent=True) or {}
    uname = (data.get("username") or "").strip()
    row = get_user(uname)
    if not row:
        return jsonify({"error": "帳號不存在"}), 404
    if row["role"] == "admin":
        return jsonify({"error": "不可重設 admin 密碼（請用環境變數或直接操作）"}), 400
    temp = secrets.token_urlsafe(9)
    with db_conn() as con:
        con.execute("UPDATE users SET pw_hash=?, must_change=1 WHERE username=?",
                    (generate_password_hash(temp), uname))
    audit("USER_RESET_PW", uname)
    return jsonify({"ok": True, "temp_password": temp})


@admin_bp.route("/admin/toggle_user", methods=["POST"])
@admin_required
def toggle_user():
    data = request.get_json(silent=True) or {}
    uname = (data.get("username") or "").strip()
    row = get_user(uname)
    if not row:
        return jsonify({"error": "帳號不存在"}), 404
    if row["role"] == "admin":
        return jsonify({"error": "不可停用 admin"}), 400
    new_active = 0 if row["active"] else 1
    with db_conn() as con:
        con.execute("UPDATE users SET active=? WHERE username=?", (new_active, uname))
    audit("USER_ENABLE" if new_active else "USER_DISABLE", uname)
    return jsonify({"ok": True, "active": new_active})


@admin_bp.route("/admin/delete_user", methods=["POST"])
@admin_required
def delete_user():
    data = request.get_json(silent=True) or {}
    uname = (data.get("username") or "").strip()
    row = get_user(uname)
    if not row:
        return jsonify({"error": "帳號不存在"}), 404
    if row["role"] == "admin":
        return jsonify({"error": "不可刪除 admin"}), 400
    with db_conn() as con:
        con.execute("DELETE FROM users WHERE username=?", (uname,))
    audit("USER_DELETE", uname)
    return jsonify({"ok": True})
