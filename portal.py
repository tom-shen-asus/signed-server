"""使用者 Portal：主頁、檔案清單 API、上傳送簽、下載/刪除已簽檔。"""
import os

from flask import (Blueprint, request, jsonify, render_template, abort,
                   send_from_directory, g)

import config
from db import (list_waiting, list_done, audit, set_file_owner, clear_file_owner)
from security import login_required

portal_bp = Blueprint("portal", __name__)


@portal_bp.route("/")
@login_required
def index():
    return render_template("portal.html",
                           username=g.user["username"],
                           is_admin=(g.user["role"] == "admin"))


@portal_bp.route("/api/files")
@login_required
def api_files():
    return jsonify({"waiting": list_waiting(), "done": list_done()})


@portal_bp.route("/submit", methods=["POST"])
@login_required
def submit():
    if "file" not in request.files:
        return "No file", 400
    file = request.files["file"]
    if not file.filename:
        return "No filename", 400
    if not file.filename.lower().endswith(config.ALLOWED_EXT):
        return "File type not allowed", 400
    safe = os.path.basename(file.filename)
    file.save(os.path.join(config.PUBLIC_DIR, safe))
    set_file_owner(safe, g.user["username"])
    audit("SUBMIT", safe)
    return "OK", 200


@portal_bp.route("/download_signed/<path:filename>")
@login_required
def download_signed(filename):
    safe = os.path.basename(filename)
    path = os.path.join(config.SIGNED_DIR, safe)
    if not os.path.exists(path):
        abort(404)
    audit("DOWNLOAD_SIGNED", safe)
    return send_from_directory(config.SIGNED_DIR, safe, as_attachment=True)


@portal_bp.route("/delete_signed/<path:filename>", methods=["POST"])
@login_required
def delete_signed(filename):
    safe = os.path.basename(filename)
    path = os.path.join(config.SIGNED_DIR, safe)
    try:
        if os.path.exists(path):
            os.remove(path)
            clear_file_owner(safe)
            audit("DELETE_SIGNED", safe)
            return "OK", 200
        return "Not found", 404
    except OSError:
        audit("DELETE_SIGNED", safe, "fail")
        return "Delete failed", 500
