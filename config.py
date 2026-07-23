"""
集中設定檔。所有可調參數都在這裡，方便維護。
部分項目支援環境變數覆寫，方便不同機器/測試環境切換。
"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---- 路徑 ----
# 分享路徑（待簽檔案存放處）；可用環境變數 SIGN_PUBLIC_DIR 覆寫。Windows 請用正斜線，例如 D:/sign_server/AISuperBuild
#PUBLIC_DIR = os.environ.get("SIGN_PUBLIC_DIR", "/home/tom/AISuperBuild")
PUBLIC_DIR = os.environ.get("SIGN_PUBLIC_DIR", "D:\\sign_server\\Data")
SIGNED_DIR = os.path.join(PUBLIC_DIR, "signed")

DB_FILE = os.path.join(BASE_DIR, "signserver.db")
SECRET_FILE = os.path.join(BASE_DIR, "secret_key.txt")
CERT_FILE = os.path.join(BASE_DIR, "cert.pem")
KEY_FILE = os.path.join(BASE_DIR, "key.pem")
LOG_DIR = os.path.join(BASE_DIR, "logs")

# ---- 簽章機（機器端點）存取控制 ----
API_TOKEN = os.environ.get("SIGN_API_TOKEN", "nuc-machine-token-please-change")
# 簽章機 IP 允許清單。留空 [] = 不限制。同一台可用 "127.0.0.1"。
SIGNING_MACHINE_IPS = ["172.22.134.27"]

# ---- 上傳 ----
ALLOWED_EXT = (".exe", ".dll", ".msi", ".ps1")
MAX_CONTENT_LENGTH = 3 * 1024 * 1024 * 1024  # = 3 GB

# ---- 密碼與登入安全政策 ----
MIN_PW_LEN = 10
MAX_LOGIN_FAILS = 5
LOCKOUT_MINUTES = 15
IDLE_MINUTES = 10         # 閒置自動登出（分鐘）：前端偵測活動 + 伺服器 session 壽命


def ensure_dirs():
    """啟動時確保必要資料夾存在。"""
    for d in (PUBLIC_DIR, SIGNED_DIR, LOG_DIR):
        try:
            os.makedirs(d, exist_ok=True)
        except OSError:
            pass
