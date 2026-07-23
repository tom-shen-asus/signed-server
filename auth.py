"""認證相關路由：登入、登出、修改密碼。"""
from datetime import datetime

from flask import (Blueprint, request, session, redirect, url_for,
                   render_template, g)
from werkzeug.security import generate_password_hash, check_password_hash

import config
from db import get_user, audit, db_conn
from security import (is_locked, record_fail, clear_fail, safe_next)

auth_bp = Blueprint("auth", __name__)

# 計時等化用假雜湊（帳號不存在時也做一次比對，降低帳號列舉）
_DUMMY_HASH = generate_password_hash("x" * 24)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    nxt = safe_next(request.values.get("next", "/"))
    if request.method == "POST":
        uname = (request.form.get("username") or "").strip()
        pw = request.form.get("password") or ""
        if is_locked(uname):
            audit("LOGIN_FAIL", uname, "locked", "帳號鎖定中", username=uname)
            return render_template("login.html", next=nxt,
                                   msg="帳號因多次失敗已鎖定，請 %d 分鐘後再試" % config.LOCKOUT_MINUTES,
                                   msg_cls="err")
        row = get_user(uname)
        ok = False
        if row and row["active"]:
            ok = check_password_hash(row["pw_hash"], pw)
        else:
            check_password_hash(_DUMMY_HASH, pw)   # 計時等化
        if ok:
            clear_fail(uname)
            session.clear()
            session.permanent = True
            session["username"] = uname
            audit("LOGIN_OK", uname, "ok", username=uname)
            return redirect(nxt)
        record_fail(uname)
        audit("LOGIN_FAIL", uname, "fail", "帳號或密碼錯誤", username=uname)
        return render_template("login.html", next=nxt, msg="帳號或密碼不正確", msg_cls="err")
    return render_template("login.html", next=nxt, msg="", msg_cls="")


@auth_bp.route("/logout")
def logout():
    if g.user:
        audit("LOGOUT", username=g.user["username"])
    session.clear()
    return redirect(url_for("auth.login"))


@auth_bp.route("/change_password", methods=["GET", "POST"])
def change_password():
    if g.user is None:
        return redirect(url_for("auth.login"))
    forced = bool(g.user["must_change"])
    if request.method == "POST":
        cur = request.form.get("current") or ""
        new = request.form.get("new") or ""
        confirm = request.form.get("confirm") or ""
        if not check_password_hash(g.user["pw_hash"], cur):
            return _pw_page("目前密碼不正確", forced)
        if new != confirm:
            return _pw_page("兩次新密碼不一致", forced)
        if len(new) < config.MIN_PW_LEN:
            return _pw_page("密碼長度至少需 %d 碼" % config.MIN_PW_LEN, forced)
        if check_password_hash(g.user["pw_hash"], new):
            return _pw_page("新密碼不可與目前密碼相同", forced)
        with db_conn() as con:
            con.execute("UPDATE users SET pw_hash=?, must_change=0 WHERE username=?",
                        (generate_password_hash(new), g.user["username"]))
        audit("PW_CHANGE", username=g.user["username"])
        return redirect(url_for("portal.index"))
    return _pw_page("", forced)


def _pw_page(msg, forced):
    return render_template("change_password.html",
                           forced=forced, min_len=config.MIN_PW_LEN,
                           msg=msg, msg_cls="err" if msg else "")
