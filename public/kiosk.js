// Màn ở quầy / cổng, hai chế độ theo link:
//   /kiosk.html?d=<địa điểm>&k=<mã kiosk>          → HIỆN mã QR động (nhân viên quét bằng điện thoại), đổi mỗi 30 giây.
//   /kiosk.html?d=<địa điểm>&k=<mã kiosk>&che=the  → MÁY QUÉT THẺ: công nhân đưa thẻ trước camera, máy chụp ảnh, máy chủ ghi vào/ra.
// Máy này không giữ khoá ký QR; chủ bấm "Đổi link" là màn cũ hết dùng.
(() => {
  const goc = document.getElementById("k");
  const qs = new URLSearchParams(location.search);
  const dd = qs.get("d") || "", k = qs.get("k") || "";
  let hetLuc = 0, hen = null, du = null;
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const gio = (ms) => new Date(ms || Date.now()).toLocaleTimeString(NGON === "vi" ? "vi-VN" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
  const anhQr = (chu) => { const q = qrcode(0, "M"); q.addData(chu); q.make(); return q.createDataURL(10, 2); };
  const nutNgon = () => `<div class="ngon k-ngon"><button data-n="vi" class="${NGON === "vi" ? "on" : ""}">VI</button><button data-n="en" class="${NGON === "en" ? "on" : ""}">EN</button></div>`;
  const giuSang = async () => { try { await navigator.wakeLock?.request("screen"); } catch {} };

  // ================= Chế độ hiện mã QR =================
  function ve(mat) {
    if (!du) { goc.innerHTML = `<p class="trong">${mat ? t("k_mat_mang") : "…"}</p>`; return; }
    goc.innerHTML = `${nutNgon()}
      <div class="k-dau"><small>${h(du.dn_ten)}</small><h1>${h(du.ten)}</h1></div>
      <div class="k-gio" id="gio">${gio()}</div>
      <div class="k-qr"><img id="qr" src="${anhQr(`${location.origin}/#q=${du.ma}`)}" alt="QR"></div>
      <p class="k-huong">${t("k_quet")}</p>
      <div class="k-thanh"><div id="thanh"></div></div>
      <p class="nho">${t("k_doi_sau")} <b id="giay"></b> ${t("k_giay")} ${mat ? `· <span class="loi">${t("k_mat_mang")}</span>` : ""}</p>
      <button class="nut" id="tm">${t("k_toan_man")}</button>`;
    goc.querySelectorAll(".ngon button").forEach((b) => b.onclick = () => { datNgon(b.dataset.n); ve(); });
    document.getElementById("tm").onclick = () => document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function nhip() {
    const con = Math.max(0, hetLuc - Date.now());
    const g = document.getElementById("giay"), th = document.getElementById("thanh"), gg = document.getElementById("gio");
    if (g) g.textContent = Math.ceil(con / 1000);
    if (th) th.style.width = (con / 300) + "%";
    if (gg) gg.textContent = gio();
  }
  async function lay() {
    clearTimeout(hen);
    try {
      const r = await fetch(`/api/kiosk/${encodeURIComponent(dd)}?k=${encodeURIComponent(k)}`, { cache: "no-store" });
      if (r.status === 404) { goc.innerHTML = `<p class="trong loi-to">${t("k_loi")}</p>`; return; }
      du = await r.json();
      hetLuc = Date.now() + du.doi_sau_ms;
      ve(false);
      hen = setTimeout(lay, du.doi_sau_ms + 300);
    } catch {
      ve(true); hen = setTimeout(lay, 5000);
    }
  }

  // ================= Chế độ máy quét thẻ =================
  let am = null;
  function keu(tot) {
    try {
      am = am || new AudioContext();
      const o = am.createOscillator(), g = am.createGain();
      o.frequency.value = tot ? 880 : 220; o.type = tot ? "sine" : "square";
      g.gain.setValueAtTime(0.25, am.currentTime); g.gain.exponentialRampToValueAtTime(0.001, am.currentTime + (tot ? 0.25 : 0.5));
      o.connect(g).connect(am.destination); o.start(); o.stop(am.currentTime + 0.5);
    } catch {}
  }
  async function moMayThe() {
    let thongTin;
    try {
      const r = await fetch(`/api/kiosk/${encodeURIComponent(dd)}?k=${encodeURIComponent(k)}`, { cache: "no-store" });
      if (r.status === 404) { goc.innerHTML = `<p class="trong loi-to">${t("k_loi")}</p>`; return; }
      thongTin = await r.json();
    } catch { goc.innerHTML = `<p class="trong">${t("k_mat_mang")}</p>`; setTimeout(moMayThe, 5000); return; }
    // Phải có một cú chạm để trình duyệt cho bật camera + âm thanh + toàn màn hình.
    const veMoDau = () => {
      goc.innerHTML = `${nutNgon()}<div class="k-dau"><small>${h(thongTin.dn_ten)}</small><h1>💳 ${h(thongTin.ten)}</h1></div>
        <p class="k-huong">${t("k_bat_dau_mo_ta")}</p><button class="nut chinh" id="bd" style="font-size:22px;padding:14px 40px">${t("k_bat_dau")}</button>`;
      goc.querySelectorAll(".ngon button").forEach((b) => b.onclick = () => { datNgon(b.dataset.n); veMoDau(); });
      document.getElementById("bd").onclick = () => { document.documentElement.requestFullscreen?.().catch(() => {}); keu(true); chayMayThe(thongTin); };
    };
    veMoDau();
  }
  async function chayMayThe(thongTin) {
    goc.innerHTML = `<div class="k-dau"><small>${h(thongTin.dn_ten)}</small><h1>${h(thongTin.ten)}</h1></div>
      <div class="k-gio" id="gio">${gio()}</div>
      <div class="k-quet"><video id="v" playsinline muted></video><div class="k-khung"></div><div class="k-kq" id="kq" hidden></div></div>
      <p class="k-huong">${t("k_the_huong")}</p><p class="loi" id="loi"></p>`;
    setInterval(() => { const g = document.getElementById("gio"); if (g) g.textContent = gio(); }, 500);
    const v = document.getElementById("v");
    try {
      v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      await v.play().catch(() => {});
    } catch { document.getElementById("loi").textContent = t("k_can_camera"); return; }
    const dt = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    const cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
    let ban = false, theTruoc = "", lucTruoc = 0;
    const chup = () => {
      const w = 360, hh = Math.round(w * (v.videoHeight || 480) / (v.videoWidth || 640));
      const c2 = document.createElement("canvas"); c2.width = w; c2.height = hh;
      c2.getContext("2d").drawImage(v, 0, 0, w, hh);
      return c2.toDataURL("image/jpeg", 0.72);
    };
    const hien = (lop, noiDung, ms) => {
      const kq = document.getElementById("kq"); kq.className = "k-kq " + lop; kq.innerHTML = noiDung; kq.hidden = false;
      return new Promise((xong) => setTimeout(() => { kq.hidden = true; xong(); }, ms));
    };
    const vong = async () => {
      if (!ban && v.readyState >= 2) {
        try {
          let chu = null;
          if (dt) { const r = await dt.detect(v); if (r[0]) chu = r[0].rawValue; }
          else if (window.jsQR) {
            const w = 480, hh = Math.round(w * v.videoHeight / v.videoWidth) || 360;
            cv.width = w; cv.height = hh; cx.drawImage(v, 0, 0, w, hh);
            const r = window.jsQR(cx.getImageData(0, 0, w, hh).data, w, hh, { inversionAttempts: "attemptBoth" });
            if (r) chu = r.data;
          }
          const mm = chu && chu.match(/TTCC:[a-f0-9]{16}\.[a-f0-9]{12}/);
          // Cùng thẻ trong 6 giây thì bỏ qua (người còn đang giơ thẻ).
          if (mm && !(mm[0] === theTruoc && Date.now() - lucTruoc < 6000)) {
            ban = true; theTruoc = mm[0]; lucTruoc = Date.now();
            const anh = thongTin.bat_selfie ? chup() : "";
            let d, s = 0;
            try {
              const r = await fetch(`/api/kiosk/${encodeURIComponent(dd)}/cham`, { method: "POST",
                headers: { "content-type": "application/json", "x-cc": "1" }, body: JSON.stringify({ k, the: mm[0], anh }) });
              s = r.status; d = await r.json().catch(() => ({}));
            } catch { d = { loi: "mang" }; }
            if (s === 200 && d.ok) {
              keu(true);
              await hien(d.cham.loai, `<b>${t(d.cham.loai === "vao" ? "k_vao" : "k_ra")} · ${gio(d.cham.luc).slice(0, 5)}</b>
                <div class="k-ten">${h(d.ten)}</div><div>${h(d.ma_nv || "")}${d.vua_cham ? " · " + t("k_vua_cham") : ""}</div>`, 2800);
            } else {
              keu(false);
              await hien("loi", `<b>✕</b><div>${h(tLoi(d.loi))}</div>`, 2800);
            }
            ban = false;
          }
        } catch { ban = false; }
      }
      setTimeout(vong, 200);
    };
    vong();
  }

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { giuSang(); if (qs.get("che") !== "the") lay(); } });
  giuSang();
  if (qs.get("che") === "the") moMayThe();
  else { setInterval(nhip, 250); lay(); }
})();
