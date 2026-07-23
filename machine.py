"""簽章機端點：列出待簽、下載待簽、回傳已簽檔。
存取由 token_or_login 控制（登入者 / 正確 token / IP 允許清單）。"""
import os

from flask import Blueprint, request, send_from_directory

import config
from db import audit
from security import token_or_login

machine_bp = Blueprint("machine", __name__)


@machine_bp.route("/list")
@token_or_login
def list_files():
    files = [f for f in os.listdir(config.PUBLIC_DIR) if f.lower().endswith(config.ALLOWED_EXT)]
    return "\n".join(files)


@machine_bp.route("/download/<path:filename>")
@token_or_login
def download(filename):
    return send_from_directory(config.PUBLIC_DIR, os.path.basename(filename), as_attachment=True)


@machine_bp.route("/upload", methods=["POST"])
@token_or_login
def upload():
    if "file" not in request.files:
        return "No file", 400
    file = request.files["file"]
    if not file.filename:
        return "No filename", 400
    safe = os.path.basename(file.filename)
    if not safe.lower().endswith(config.ALLOWED_EXT):
        return "File type not allowed", 400
    file.save(os.path.join(config.SIGNED_DIR, safe))
    original = os.path.join(config.PUBLIC_DIR, safe)
    if os.path.exists(original):
        os.remove(original)
    audit("SIGNED_RETURNED", safe, username="signing-machine")
    return "OK", 200
