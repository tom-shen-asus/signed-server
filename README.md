# signed-server

內部用的 **Windows 程式碼簽章入口網站（Code Signing Portal）**。
以 Flask 打造，提供網頁介面讓團隊上傳待簽檔（`.exe/.dll/.msi/.ps1`）、追蹤簽章進度、
下載已簽檔；真正的 Sign Server 不對外開放，改由它主動來抓檔、簽章、回傳。

> 內部工具，預設以自簽憑證跑在公司內網。非公開服務。

---

## 功能

**方便性**
- 網頁自助：瀏覽器上傳 → 看即時進度（大檔也有百分比）→ 直接下載，免指令、免共用資料夾。
- 檔案清單自動更新；一般使用者預設只看到自己的檔。

**安全性**
- 帳號制：由管理者（admin）開通帳號；新帳號發一次性臨時密碼、首次登入強制更換。
- 密碼以 Werkzeug（PBKDF2 + 隨機鹽）雜湊儲存，資料庫不存明碼。
- 登入失敗鎖定、閒置自動登出、Session cookie 旗標（HttpOnly / SameSite / Secure）、安全標頭。
- 上傳大小上限與副檔名白名單、路徑穿越防護、`next` 參數過濾。
- 完整稽核：SQLite `audit` 表 + 每位使用者 `logs/<帳號>_log.txt`。
- 簽章機端點（`/list /download /upload`）以 API token / IP 白名單控管，與網頁登入解耦。

---

## 專案結構

```
signed-server/
├── run.py            # 進入點：python run.py（有 cert/key → HTTPS:443，否則 HTTP:8080）
├── app.py            # create_app()：設定、安全、註冊 blueprints
├── config.py         # 所有可調設定（路徑、政策、白名單…）
├── db.py             # SQLite：users / audit / file_owner、稽核
├── security.py       # 權限裝飾器、登入鎖定、安全標頭、閒置後盾
├── auth.py           # 登入 / 登出 / 改密碼
├── portal.py         # 主頁 / 檔案 API / 送簽 / 下載 / 刪除
├── admin.py          # 使用者管理與稽核 API（admin）
├── machine.py        # 簽章機端點 /list /download /upload
├── templates/        # Jinja2 樣板
├── static/           # css / js / img（logo）
├── start_server.cmd  # 啟動伺服器
├── keep_awake.ps1    # 讓當伺服器的筆電不進睡眠 / Modern Standby
└── keep_running.cmd  # 執行 keep_awake.ps1
```

---

## 需求

- Python 3.8+
- 相依套件：`pip install -r requirements.txt`（Flask，內含 Werkzeug）

## 安裝與啟動

1. 安裝套件
   ```bash
   pip install -r requirements.txt
   ```
2. 產生自簽憑證（放在專案目錄；SAN 需含連線用的 IP/網域）
   ```bash
   openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem -days 825 \
     -subj "/CN=10.96.178.107" -addext "subjectAltName=IP:10.96.178.107"
   ```
3. 設定第一組 admin 密碼（選用；未設會自動產生並印在 console）
   ```bash
   set SIGN_ADMIN_PASSWORD=你的admin密碼      # Windows
   # export SIGN_ADMIN_PASSWORD=...           # Linux/mac
   ```
4. 啟動（443 為特權埠：Windows 需系統管理員、Linux 需 root/setcap）
   ```bash
   python run.py
   ```
5. 開 `https://<你的IP>/`，以 admin 登入 → 立即改密碼 → 到「管理後台」開使用者帳號。

## 設定（config.py）

| 項目 | 說明 |
|---|---|
| `PUBLIC_DIR` | 待簽檔存放路徑（也可用環境變數 `SIGN_PUBLIC_DIR`） |
| `SIGNING_MACHINE_IPS` | 簽章機 IP 白名單；留空 `[]` = 機器端點開放免 token |
| `API_TOKEN` | 簽章機用權杖（也可用環境變數 `SIGN_API_TOKEN`） |
| `ALLOWED_EXT` | 可上傳副檔名 |
| `MAX_CONTENT_LENGTH` | 單次上傳大小上限 |
| `MIN_PW_LEN` / `MAX_LOGIN_FAILS` / `LOCKOUT_MINUTES` / `IDLE_MINUTES` | 密碼與登入政策 |

## 主要路由

| 路由 | 對象 | 說明 |
|---|---|---|
| `/login` `/logout` `/change_password` | 使用者 | 認證 |
| `/` `/api/files` `/submit` `/download_signed/<f>` `/delete_signed/<f>` | 使用者 | Portal |
| `/admin` `/admin/...` | admin | 使用者管理、稽核 |
| `/list` `/download/<f>` `/upload` | 簽章機 | token / IP 白名單 |

## 自動產生（不進版控）

`signserver.db`（帳號與稽核）、`secret_key.txt`（session 金鑰）、`logs/<帳號>_log.txt`、
以及 `cert.pem` / `key.pem`（自備憑證）—— 這些皆列於 `.gitignore`，請勿提交。

## 注意事項

- 內建以 Flask 開發伺服器啟動，適合內網低流量；正式/高流量建議改用 WSGI 伺服器（如 waitress）。
- 自簽憑證瀏覽器會標「不安全」；要消除需把憑證匯入信任根，或改用內部 CA。
- 若用筆電當伺服器且為 Modern Standby 機種，請關閉睡眠或使用 `keep_awake.ps1`。
