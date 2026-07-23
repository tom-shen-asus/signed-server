/* 閒置自動登出：使用者在 window.IDLE_MS 毫秒內沒有任何操作，就導向 /logout。
   只有真正的使用者活動（滑鼠/鍵盤/觸控/捲動/點擊）會重置計時；
   背景輪詢等程式行為不會重置，確保「閒置」判斷正確。 */
(function () {
  "use strict";
  var LIMIT = window.IDLE_MS || 10 * 60 * 1000;  // 預設 10 分鐘
  var WARN_BEFORE = 30 * 1000;                    // 登出前 30 秒提示
  var timer, warnTimer;

  function doLogout() {
    window.location.href = "/logout";
  }
  function warn() {
    var t = document.getElementById("toast");
    if (t) {
      t.textContent = "閒置過久，30 秒後將自動登出（移動滑鼠可繼續）";
      t.className = "toast show err";
      setTimeout(function () { if (t) t.className = "toast"; }, 5000);
    }
  }
  function reset() {
    clearTimeout(timer); clearTimeout(warnTimer);
    warnTimer = setTimeout(warn, Math.max(0, LIMIT - WARN_BEFORE));
    timer = setTimeout(doLogout, LIMIT);
  }

  ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"].forEach(function (ev) {
    document.addEventListener(ev, reset, { passive: true });
  });
  reset();
  window.keepAlive = reset;   // 供長時間上傳等情境維持登入、避免被閒置登出
})();
