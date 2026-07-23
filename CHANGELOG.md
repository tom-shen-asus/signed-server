# Changelog

## v1.0.0 - 2026-07-13
第一版：Windows 程式碼簽章入口（NUC SW Team）。

- HTTPS 網頁入口：登入、上傳待簽、下載已簽、刪除
- 帳號與權限：admin 管理、臨時密碼、首次強制改密碼、密碼加鹽雜湊（Werkzeug）不存明碼
- 稽核：SQLite audit 表 + 每位使用者 logs/<帳號>_log.txt
- 安全：session cookie 旗標(HttpOnly/SameSite/Secure)、安全標頭、上傳大小與副檔名驗證、
  路徑穿越防護、next 參數過濾、登入失敗鎖定、閒置 10 分鐘自動登出、簽章機 IP 白名單
- 相容：簽章機端點 /list /download /upload 沿用既有 sign_client.bat
- 模組化：config / db / security / auth / portal / machine / admin blueprints + templates/static
