// App TRENTAY Chấm Công: nhân viên chấm công + chủ/quản lý theo dõi. Định tuyến bằng #hash.
// Dữ liệu luôn lấy từ /api, không lưu vào máy (trừ mã máy và ngôn ngữ).
(() => {
  const goc = document.getElementById("app");
  let TOI = null;
  let qrCho = null;          // mã QR nhận từ link #q=… (quét bằng camera điện thoại)

  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s) => goc.querySelector(s);
  const $$ = (s) => [...goc.querySelectorAll(s)];
  const vung = () => (NGON === "vi" ? "vi-VN" : "en-GB");
  const gio = (ms) => ms ? new Date(ms).toLocaleTimeString(vung(), { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "—";
  const ngayDep = (d) => new Date(d + "T00:00:00Z").toLocaleDateString(vung(), { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const homNay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const laQuanTri = () => TOI && (TOI.vai === "chu" || TOI.vai === "quan_ly");
  const so = (n) => new Intl.NumberFormat(vung(), { maximumFractionDigits: 2 }).format(n || 0);

  // Mã máy: sinh một lần, cất trong máy. Máy chủ chỉ giữ bản băm để biết "đúng điện thoại đã gắn".
  function maMay() {
    let m = null;
    try { m = localStorage.getItem("cc_may"); } catch {}
    if (!/^[a-f0-9]{32}$/.test(m || "")) {
      m = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
      try { localStorage.setItem("cc_may", m); } catch {}
    }
    return m;
  }

  async function goi(duong, than) {
    try {
      const r = await fetch("/api/" + duong, than === undefined ? { credentials: "same-origin" } : {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-cc": "1" }, body: JSON.stringify(than) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401 && !["dang-nhap", "toi"].includes(duong)) { TOI = null; location.hash = "#dang-nhap"; }
      return { s: r.status, d };
    } catch { return { s: 0, d: { loi: "mang" } }; }
  }
  function bao(chu) {
    const el = document.createElement("div"); el.className = "bao"; el.textContent = chu;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2400);
  }
  const nutNgon = () => `<div class="ngon"><button data-n="vi" class="${NGON === "vi" ? "on" : ""}">VI</button><button data-n="en" class="${NGON === "en" ? "on" : ""}">EN</button></div>`;
  const ganNgon = (veLai) => $$(".ngon button").forEach((b) => b.onclick = () => { datNgon(b.dataset.n); veLai(); });
  const nhanNgay = (tt) => `<span class="nhan n-${tt}">${t("ng:" + tt)}</span>`;
  const nhanCb = (ds) => (ds || []).map((c) => `<span class="nhan n-canh">⚠ ${t("cb:" + c)}</span>`).join(" ");

  function khung(tab, noiDung) {
    const tabDay = TOI.co_day ? [["day", "📚", "tab_day"]] : [];
    const muc = laQuanTri()
      ? [["cham", "◉", "tab_cham"], ...tabDay, ["hom-nay", "▦", "tab_hom_nay"], ["bang-cong", "▤", "tab_bang_cong"], ["don", "✎", "tab_don"], ["quan-ly", "⚙", "tab_quan_ly"]]
      : TOI.che_do === "thi_truong"
        ? [["cham", "◉", "tab_cham"], ["lo-trinh", "🗺", "tab_lo_trinh"], ["lich-su", "▤", "tab_lich_su"], ["toi", "☺", "tab_toi"]]
        : [["cham", "◉", "tab_cham"], ...tabDay, ["lich-su", "▤", "tab_lich_su"], ["don", "✎", "tab_don"], ["toi", "☺", "tab_toi"]];
    goc.innerHTML = `
      <div class="dau"><div><h1>${h(TOI.dn.ten)}</h1><div class="nho">${h(TOI.ten)} · ${t("vai:" + TOI.vai)}</div></div>${nutNgon()}</div>
      <main>${noiDung}</main>
      <nav class="dieu-huong">${muc.map(([id, ic, k]) => `<a href="#${id}" class="${tab === id ? "on" : ""}"><b aria-hidden="true">${ic}</b>${t(k)}</a>`).join("")}</nav>`;
    ganNgon(dieuHuong);
  }

  // ================= Đăng nhập / đăng ký / nhận lời mời =================
  function veDangNhap(dangKy) {
    goc.innerHTML = `<div class="giua">
      <div class="dau"><div><h1>${t("ten_app")}</h1><div class="nho">${t("khau_hieu")}</div></div>${nutNgon()}</div>
      <form class="the" id="f">
        <h2>${dangKy ? t("dang_ky") : t("dang_nhap")}</h2>
        ${dangKy ? `<label>${t("ten_dn")}</label><input type="text" name="ten_dn" required>
          <label>${t("ten_ban")}</label><input type="text" name="ten" autocomplete="name" required>
          <label>${t("email")}</label><input type="email" name="email" autocomplete="email" required>`
        : `<label>${t("dang_nhap_bang")}</label><input type="text" name="dang_nhap" autocomplete="username" inputmode="email" required>`}
        <label>${t("mat_khau")}</label><input type="password" name="mk" autocomplete="${dangKy ? "new-password" : "current-password"}" required>
        ${dangKy ? `<label class="tick"><input type="checkbox" name="dy"><span>${t("dong_y_dk")} <a href="/chinh-sach.html" target="_blank" rel="noopener">${t("xem_chinh_sach")}</a></span></label>` : ""}
        <div class="loi" id="loi"></div>
        <button class="nut chinh rong" type="submit">${dangKy ? t("dang_ky") : t("dang_nhap")}</button>
        <p class="giua-chu"><a href="#${dangKy ? "dang-nhap" : "dang-ky"}">${dangKy ? t("da_co_tk") : t("chua_co_tk")}</a></p>
        ${dangKy ? "" : `<p class="nho giua-chu">${t("nv_quen_mk")}</p>`}
      </form></div>`;
    ganNgon(() => veDangNhap(dangKy));
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const than = dangKy ? { ...f, dong_y_dieu_khoan: f.dy === "on", ngon_ngu: NGON } : f;
      const r = await goi(dangKy ? "dang-ky" : "dang-nhap", than);
      if (r.s !== 200) { $("#loi").textContent = tLoi(r.d.loi); return; }
      await taiToi(); location.hash = dangKy ? "#quan-ly" : "#cham";
    };
  }

  async function veMoi(ma) {
    const r = await goi("moi/" + ma);
    if (r.s !== 200) { goc.innerHTML = `<div class="giua"><div class="the"><p>${tLoi(r.d.loi)}</p><a href="#dang-nhap">${t("dang_nhap")}</a></div></div>`; return; }
    const ve = () => {
      goc.innerHTML = `<div class="giua">
        <div class="dau"><div><h1>${t("ten_app")}</h1></div>${nutNgon()}</div>
        <form class="the" id="f">
          <p class="nho" style="margin:0">${t("moi_chao")}</p><h2 style="margin:2px 0 12px">${h(r.d.dn_ten)}</h2>
          <p style="margin:0 0 8px">${t("moi_dang_nhap_bang")}: <b>${h(r.d.dang_nhap)}</b></p>
          <label>${t("moi_dat_mk")}</label><input type="password" name="mk" autocomplete="new-password" required>
          <label class="tick"><input type="checkbox" name="dy"><span>${t("dy_nv")} <a href="/chinh-sach.html" target="_blank" rel="noopener">${t("xem_chinh_sach")}</a></span></label>
          <div class="loi" id="loi"></div>
          <button class="nut chinh rong" type="submit">${t("nhan_moi")}</button>
          <p class="nho">${t("cai_app")}</p>
        </form></div>`;
      ganNgon(ve);
      $("#f").onsubmit = async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        const k = await goi("moi/" + ma, { mk: f.mk, dong_y: f.dy === "on", may: maMay() });
        if (k.s !== 200) { $("#loi").textContent = tLoi(k.d.loi); return; }
        await taiToi(); location.hash = "#cham";
      };
    };
    ve();
  }

  // ================= Chấm công =================
  async function veCham() {
    khung("cham", `<p class="trong">…</p>`);
    const { d } = await goi("cham/hom-nay");
    if (!d || !d.ngay) return;
    const tiep = d.tiep_theo, kia = tiep === "vao" ? "ra" : "vao";
    const n = d.ngay;
    khung("cham", `
      <div class="the dong-ho"><div class="gio-lon" id="dh">${gio(Date.now())}</div>
        <div class="nho">${new Date().toLocaleDateString(vung(), { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Ho_Chi_Minh" })}</div></div>
      <button class="nut-cham ${tiep}" id="cham">${t(tiep === "vao" ? "cham_vao" : "cham_ra")}</button>
      <p class="giua-chu"><a href="#" id="kia">${t(kia === "vao" ? "cham_loai_kia_vao" : "cham_loai_kia_ra")}</a></p>
      <div class="the">
        <div class="hang-giua"><h2 style="margin:0">${t("hom_nay")}</h2>${nhanNgay(n.trang_thai)}</div>
        <div class="luoi luoi-2" style="margin-top:12px">
          <div class="so"><b>${gio(n.vao)}</b><span>${t("gio_vao")}${n.muon_phut ? ` · ${t("di_muon")} ${n.muon_phut} ${t("phut")}` : ""}</span></div>
          <div class="so"><b>${gio(n.ra)}</b><span>${t("gio_ra")}</span></div>
        </div>
        ${d.ban.length ? `<ul class="ds gon">${d.ban.map((b) => `<li><span>${b.loai === "vao" ? "→" : "←"} ${gio(b.luc)}</span><span class="phai">${b.qua_qr ? `<span class="nhan">QR</span> ` : ""}${nhanCb(b.canh_bao)}</span></li>`).join("")}</ul>` : ""}
        <p class="nho" style="margin:10px 0 0">${TOI.ca ? `${t("ca_cua_ban")}: <b>${h(TOI.ca.ten)}</b> ${h(TOI.ca.gio_vao)}–${h(TOI.ca.gio_ra)}` : t("chua_gan_ca")}</p>
      </div>`);
    const dh = setInterval(() => { const e = $("#dh"); if (e) e.textContent = gio(Date.now()); else clearInterval(dh); }, 15000);
    $("#cham").onclick = () => batDauCham(tiep);
    $("#kia").onclick = (e) => { e.preventDefault(); batDauCham(kia); };
    if (qrCho) { const q = qrCho; qrCho = null; batDauCham(tiep, q); }
  }

  // Lớp phủ các bước: QR -> vị trí -> ảnh -> gửi. Luồng nào tắt thì bỏ qua bước đó.
  function lopPhu(noiDung) {
    let el = document.getElementById("lop");
    if (!el) { el = document.createElement("div"); el.id = "lop"; el.className = "lop"; document.body.appendChild(el); }
    el.innerHTML = `<div class="lop-trong">${noiDung}</div>`;
    return el;
  }
  const dongLop = () => { dungCamera(); document.getElementById("lop")?.remove(); };
  let luong = null;
  function dungCamera() { if (luong) { luong.getTracks().forEach((x) => x.stop()); luong = null; } }
  async function moCamera(huong) {
    dungCamera();
    luong = await navigator.mediaDevices.getUserMedia({ video: { facingMode: huong, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    return luong;
  }

  function quetQr() {
    return new Promise(async (xong) => {
      const el = lopPhu(`<h2>${t("buoc_qr")}</h2><p class="nho">${t("buoc_qr_phu")}</p>
        <div class="khung-cam"><video id="v" playsinline muted></video><div class="ngam"></div></div>
        <div class="loi" id="loiqr"></div>
        <div class="hang"><button class="nut" id="huy">${t("huy")}</button>${TOI.dn.bat_qr ? "" : `<button class="nut" id="bo">${t("khong_quet_duoc")}</button>`}</div>`);
      let dung = false;
      const ket = (v) => { if (dung) return; dung = true; dungCamera(); xong(v); };
      el.querySelector("#huy").onclick = () => ket(undefined);
      el.querySelector("#bo")?.addEventListener("click", () => ket(""));
      if (!navigator.mediaDevices?.getUserMedia) { el.querySelector("#loiqr").textContent = t("can_https"); return; }
      try { await moCamera("environment"); } catch { el.querySelector("#loiqr").textContent = t("can_camera"); return; }
      const v = el.querySelector("#v"); v.srcObject = luong; await v.play().catch(() => {});
      const dt = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
      const vong = async () => {
        if (dung) return;
        try {
          if (v.readyState >= 2) {
            let chu = null;
            if (dt) { const r = await dt.detect(v); if (r[0]) chu = r[0].rawValue; }
            else if (window.jsQR) {
              const w = 480, hh = Math.round(w * v.videoHeight / v.videoWidth) || 360;
              cv.width = w; cv.height = hh; cx.drawImage(v, 0, 0, w, hh);
              const r = window.jsQR(cx.getImageData(0, 0, w, hh).data, w, hh, { inversionAttempts: "dontInvert" });
              if (r) chu = r.data;
            }
            if (chu && /[a-f0-9]{16}\.[a-f0-9]{12}/.test(chu)) { ket(chu.match(/[a-f0-9]{16}\.[a-f0-9]{12}/)[0]); return; }
          }
        } catch {}
        setTimeout(vong, 180);
      };
      vong();
    });
  }

  function layViTri() {
    return new Promise((xong) => {
      if (!navigator.geolocation) return xong(null);
      navigator.geolocation.getCurrentPosition(
        (p) => xong({ lat: p.coords.latitude, lng: p.coords.longitude, sai_so: Math.round(p.coords.accuracy) }),
        () => xong(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }

  function chupSelfie() {
    return new Promise(async (xong) => {
      const el = lopPhu(`<h2>${t("buoc_selfie")}</h2><p class="nho">${t("buoc_selfie_phu")} <b id="dem">3</b></p>
        <div class="khung-cam tron"><video id="v" playsinline muted class="guong"></video></div>
        <div class="loi" id="loianh"></div>
        <div class="hang"><button class="nut" id="huy">${t("huy")}</button><button class="nut chinh" id="chup">${t("chup_ngay")}</button></div>`);
      let dung = false, hen = null;
      const ket = (v) => { if (dung) return; dung = true; clearInterval(hen); dungCamera(); xong(v); };
      el.querySelector("#huy").onclick = () => ket(undefined);
      try { await moCamera("user"); } catch { el.querySelector("#loianh").textContent = t("can_camera"); return; }
      const v = el.querySelector("#v"); v.srcObject = luong; await v.play().catch(() => {});
      const chup = () => {
        const w = 360, hh = Math.round(w * (v.videoHeight || 480) / (v.videoWidth || 640));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = hh;
        cv.getContext("2d").drawImage(v, 0, 0, w, hh);
        ket(cv.toDataURL("image/jpeg", 0.72));
      };
      el.querySelector("#chup").onclick = chup;
      let con = 3;
      hen = setInterval(() => { con--; const e = el.querySelector("#dem"); if (e) e.textContent = con; if (con <= 0) chup(); }, 1000);
    });
  }

  async function batDauCham(loai, qrSan) {
    const vanPhong = TOI.che_do !== "thi_truong";
    // Vị trí lấy song song với bước quét để đỡ chờ.
    const hViTri = TOI.dn.bat_gps || !vanPhong ? layViTri() : Promise.resolve(null);
    let qr = qrSan || "";
    if (vanPhong && !qr) {
      qr = await quetQr();
      if (qr === undefined) return dongLop();
    }
    lopPhu(`<div class="xoay"></div><p>${t("buoc_vi_tri")}</p>`);
    const vt = await hViTri;
    if (!vt && TOI.dn.bat_gps) return ketQua({ loi: "thieu-vi-tri" }, loai);
    let anh = "";
    if (TOI.dn.bat_selfie) {
      anh = await chupSelfie();
      if (anh === undefined) return dongLop();
    }
    lopPhu(`<div class="xoay"></div><p>${t("dang_gui")}</p>`);
    const r = await goi("cham", { loai, qr, ...(vt || {}), anh, may: maMay() });
    ketQua(r.s === 200 ? r.d : r.d, loai);
  }

  function ketQua(d, loai) {
    if (d.ok) {
      const c = d.cham;
      const el = lopPhu(`<div class="dau-tick ${c.canh_bao?.length ? "canh" : ""}">${c.canh_bao?.length ? "!" : "✓"}</div>
        <h2>${t(c.loai === "vao" ? "da_cham_vao" : "da_cham_ra")}</h2>
        <div class="gio-lon">${gio(c.luc)}</div>
        ${d.vua_cham ? `<p class="nho">${t("vua_cham")}</p>` : ""}
        ${c.canh_bao?.length ? `<p class="nho">${t("co_canh_bao")}</p><p>${nhanCb(c.canh_bao)}</p>` : ""}
        <button class="nut chinh rong" id="xong">${t("xong")}</button>`);
      el.querySelector("#xong").onclick = () => { dongLop(); veCham(); };
      if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(80);
      return;
    }
    let chu = tLoi(d.loi);
    if (d.loi === "ngoai-vung" && d.cach_met) chu += ` (${t("cach")} ~${d.cach_met} m / ${d.ban_kinh} m)`;
    if (d.loi === "thieu-vi-tri" && location.protocol !== "https:" && location.hostname !== "127.0.0.1" && location.hostname !== "localhost") chu = t("can_https");
    const el = lopPhu(`<div class="dau-tick loi-tick">✕</div><p class="loi-to">${h(chu)}</p>
      <div class="hang"><button class="nut" id="dong">${t("huy")}</button><button class="nut chinh" id="lai">${t("thu_lai")}</button></div>`);
    el.querySelector("#dong").onclick = dongLop;
    el.querySelector("#lai").onclick = () => batDauCham(loai);
  }

  // ================= Lịch sử / bảng công một người =================
  const chonThang = (thang) => `<label>${t("thang")}</label><input type="month" id="thang" value="${thang}" max="${homNay().slice(0, 7)}">`;
  function veNgayCong(n, bamDuoc) {
    if (!n.co_ca && !n.vao && !n.ra) return "";
    return `<li ${bamDuoc ? `data-ngay="${n.ngay}"` : ""}>
      <div><div class="ten">${ngayDep(n.ngay)}</div>
        <div class="phu">${gio(n.vao)} → ${gio(n.ra)}${n.muon_phut ? ` · ${t("di_muon")} ${n.muon_phut}′` : ""}${n.som_phut && n.ra ? ` · ${t("ng:ve_som")} ${n.som_phut}′` : ""}${n.sua_bang_don ? ` · ${t("sua_bang_don")}` : ""}${n.canh_bao ? ` · ⚠ ${n.canh_bao}` : ""}</div></div>
      <div class="phai">${nhanNgay(n.trang_thai)}<div class="phu">${n.cong ? so(n.cong) + " " + t("cong") : n.cong_phep ? "1 " + t("cong_phep").toLowerCase() : ""}</div></div></li>`;
  }
  const oTong = (tg) => `<div class="luoi">
      <div class="so"><b>${so(tg.cong)}</b><span>${t("tong_cong")}</span></div>
      <div class="so"><b>${so(tg.cong_phep)}</b><span>${t("cong_phep")}</span></div>
      <div class="so ${tg.vang ? "do" : ""}"><b>${tg.vang}</b><span>${t("ngay_vang")}</span></div>
      <div class="so ${tg.lan_muon ? "canh" : ""}"><b>${tg.lan_muon}</b><span>${t("lan_muon")} (${tg.muon_phut} ${t("phut")})</span></div>
      <div class="so ${tg.thieu_ra ? "canh" : ""}"><b>${tg.thieu_ra}</b><span>${t("thieu_ra")}</span></div>
      <div class="so ${tg.canh_bao ? "canh" : ""}"><b>${tg.canh_bao}</b><span>${t("canh_bao")}</span></div></div>`;

  async function veLichSu(thang) {
    thang = thang || homNay().slice(0, 7);
    khung("lich-su", `<p class="trong">…</p>`);
    const { d } = await goi("cua-toi?thang=" + thang);
    khung("lich-su", `<div class="the">${chonThang(thang)}</div>${oTong(d.tong)}
      ${d.tong.thieu_ra ? `<p class="nho"><a href="#don">${t("goi_y_quen")}</a></p>` : ""}
      <div class="the"><ul class="ds">${d.ngay.slice().reverse().map((n) => veNgayCong(n, false)).join("") || `<li>${t("khong_co_du_lieu")}</li>`}</ul></div>`);
    $("#thang").onchange = (e) => veLichSu(e.target.value);
  }

  // ================= Đơn từ =================
  async function veDon(tab) {
    const qt = laQuanTri();
    tab = tab || (qt ? "can-duyet" : "cua-toi");
    khung("don", `<p class="trong">…</p>`);
    const q = tab === "can-duyet" ? "don?tat_ca=1&trang_thai=cho" : tab === "tat-ca" ? "don?tat_ca=1" : "don";
    const { d } = await goi(q);
    const hom = homNay();
    khung("don", `
      ${qt ? `<div class="chips">${[["can-duyet", "don_can_duyet"], ["tat-ca", "tat_ca_don"], ["cua-toi", "don_cua_toi"]]
        .map(([k, n]) => `<span class="chip ${tab === k ? "on" : ""}" data-tab="${k}">${t(n)}</span>`).join("")}</div>` : ""}
      <details class="the" ${tab === "cua-toi" && !d.ds.length ? "open" : ""}><summary><b>${t("tao_don")}</b></summary>
        <form id="fd">
          <label>${t("loai_don")}</label><select name="loai" id="loai">${["quen_cham", "nghi_phep", "nghi_khong_luong"].map((l) => `<option value="${l}">${t("don:" + l)}</option>`).join("")}</select>
          <div class="hang"><div><label id="nhan-ngay">${t("ngay")}</label><input type="date" name="ngay" value="${hom}" required></div>
            <div class="chi-nghi" hidden><label>${t("den_ngay")}</label><input type="date" name="den_ngay" value="${hom}"></div></div>
          <div class="hang chi-quen"><div><label>${t("gio_vao")}</label><input type="time" name="gio_vao"></div><div><label>${t("gio_ra")}</label><input type="time" name="gio_ra"></div></div>
          <label>${t("ly_do")}</label><textarea name="ly_do" required></textarea>
          <div class="loi" id="loi"></div>
          <button class="nut chinh rong" type="submit">${t("gui_don")}</button>
        </form></details>
      <div class="the"><ul class="ds">${d.ds.map((x) => `<li data-don="${x.id}" class="cot-don">
          <div class="hang-giua"><div><div class="ten">${tab !== "cua-toi" ? h(x.nv_ten) + " · " : ""}${t("don:" + x.loai)}</div>
            <div class="phu">${ngayDep(x.ngay)}${x.den_ngay !== x.ngay ? " → " + ngayDep(x.den_ngay) : ""}${x.gio_vao ? ` · ${t("gio_vao")} ${x.gio_vao}` : ""}${x.gio_ra ? ` · ${t("gio_ra")} ${x.gio_ra}` : ""}</div></div>
            <span class="nhan d-${x.trang_thai}">${t("tt:" + x.trang_thai)}</span></div>
          <div class="phu">${h(x.ly_do)}${x.ghi_chu_duyet ? ` — <i>${h(x.ghi_chu_duyet)}</i>` : ""}</div>
          ${x.trang_thai === "cho" ? `<div class="hang nut-nho">
            ${qt && x.nv_id !== TOI.id || TOI.vai === "chu" ? `<button class="nut chinh" data-xet="duyet">${t("duyet")}</button><button class="nut do" data-xet="tu-choi">${t("tu_choi")}</button>` : ""}
            ${x.nv_id === TOI.id ? `<button class="nut" data-huy>${t("huy_don")}</button>` : ""}</div>` : ""}
        </li>`).join("") || `<li>${t("khong_co_don")}</li>`}</ul></div>`);
    $$(".chip[data-tab]").forEach((c) => c.onclick = () => veDon(c.dataset.tab));
    const capNhatLoai = () => {
      const l = $("#loai").value;
      $$(".chi-quen").forEach((e) => e.hidden = l !== "quen_cham");
      $$(".chi-nghi").forEach((e) => e.hidden = l === "quen_cham");
      $("#nhan-ngay").textContent = t(l === "quen_cham" ? "ngay" : "tu_ngay");
    };
    $("#loai").onchange = capNhatLoai; capNhatLoai();
    $("#fd").onsubmit = async (e) => {
      e.preventDefault();
      const r = await goi("don", Object.fromEntries(new FormData(e.target)));
      if (r.s !== 200) { $("#loi").textContent = tLoi(r.d.loi); return; }
      bao(t("da_gui")); veDon("cua-toi");
    };
    $$("[data-xet]").forEach((b) => b.onclick = async () => {
      const id = b.closest("li").dataset.don;
      let ghi = "";
      if (b.dataset.xet === "tu-choi") { ghi = prompt(t("ghi_chu_tu_choi")); if (ghi === null) return; }
      const r = await goi(`don/${id}/${b.dataset.xet}`, { ghi_chu: ghi });
      if (r.s !== 200) return bao(tLoi(r.d.loi));
      veDon(tab);
    });
    $$("[data-huy]").forEach((b) => b.onclick = async () => {
      await goi(`don/${b.closest("li").dataset.don}/huy`, {}); veDon(tab);
    });
  }

  // ================= Tài khoản =================
  function veToi() {
    const quay = laQuanTri() ? `<a href="#quan-ly">${t("quay_lai")}</a>` : "";
    khung(laQuanTri() ? "quan-ly" : "toi", `${quay}
      <div class="the"><h2>${h(TOI.ten)}</h2>
        <p class="nho" style="margin:0">${h(TOI.sdt || TOI.email || "")}${TOI.ma_nv ? " · " + h(TOI.ma_nv) : ""} · ${t("cd:" + TOI.che_do)}</p>
        ${TOI.co_may ? `<p class="nho" style="margin:6px 0 0">✓ ${t("co_may")}</p>` : ""}</div>
      <form class="the" id="fm"><h2>${t("doi_mk")}</h2>
        <label>${t("mk_cu")}</label><input type="password" name="cu" autocomplete="current-password" required>
        <label>${t("mk_moi")}</label><input type="password" name="moi" autocomplete="new-password" required>
        <div class="loi" id="loi"></div><button class="nut chinh rong" type="submit">${t("luu")}</button></form>
      <div class="menu" style="margin-bottom:12px"><a class="the" href="#phieu-luong">🧾 <b>${t("phieu_luong")}</b></a>
        <a class="the" href="#lam-them">⏱ <b>${t("lam_them")}</b></a></div>
      <div class="the"><p class="nho">${t("cai_app")}</p><a href="/chinh-sach.html" target="_blank" rel="noopener">${t("xem_chinh_sach")}</a></div>
      <button class="nut do rong" id="out">${t("dang_xuat")}</button>`);
    $("#fm").onsubmit = async (e) => {
      e.preventDefault();
      const r = await goi("doi-mat-khau", Object.fromEntries(new FormData(e.target)));
      if (r.s !== 200) { $("#loi").textContent = tLoi(r.d.loi); return; }
      e.target.reset(); bao(t("da_luu"));
    };
    $("#out").onclick = async () => { await goi("dang-xuat", {}); TOI = null; location.hash = "#dang-nhap"; };
  }

  // ================= Lộ trình / ca làm (nhân viên thị trường) =================
  // CÔNG KHAI, chỉ trong ca: nhân viên tự bấm Bắt đầu/Kết thúc. Khi app đang mở thì gửi vị trí (foreground);
  // tắt màn hình vẫn gửi là việc của app cài (bản Android bọc Capacitor) — màn này là lõi dùng chung.
  let caTd = null;          // { phien_id, bat_luc } khi đang trong ca
  let vtWatch = null, vtHen = null, vtBuf = [], vtDaGui = 0, vtMoiNhat = null;
  function vtDung() { if (vtWatch != null) navigator.geolocation.clearWatch(vtWatch); vtWatch = null; clearInterval(vtHen); vtHen = null; }
  async function vtNap() {
    if (!caTd || !vtBuf.length) return;
    const diem = vtBuf.splice(0, vtBuf.length);
    const r = await goi("vi-tri/nap", { phien_id: caTd.phien_id, diem });
    if (r.s === 200 && r.d.ok) { vtDaGui += r.d.so; capNhatCa(); }
    else if (r.d && r.d.loi === "phien-dong") { vtDung(); caTd = null; if (location.hash === "#lo-trinh") veLoTrinh(); }
  }
  function vtBatWatch() {
    vtDung();
    if (!navigator.geolocation) return;
    vtWatch = navigator.geolocation.watchPosition((p) => {
      vtMoiNhat = { lat: p.coords.latitude, lng: p.coords.longitude };
      vtBuf.push({ luc: Date.now(), lat: p.coords.latitude, lng: p.coords.longitude,
        do_cx: Math.round(p.coords.accuracy || 0), toc_do: p.coords.speed == null ? null : p.coords.speed,
        pin: pinPhanTram });
      if (vtBuf.length >= 12) vtNap();
    }, () => {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
    vtHen = setInterval(vtNap, 45000);
  }
  let pinPhanTram = null;
  try { navigator.getBattery?.().then((b) => { pinPhanTram = Math.round(b.level * 100); b.addEventListener("levelchange", () => pinPhanTram = Math.round(b.level * 100)); }); } catch {}

  function capNhatCa() {
    const e = $("#lt-dagui"); if (e) e.textContent = vtDaGui;
    const g = $("#lt-tu"); if (g && caTd) g.textContent = gio(caTd.bat_luc);
  }
  async function veLoTrinh() {
    khung("lo-trinh", `<p class="trong">…</p>`);
    const { s, d } = await goi("vi-tri/phien");
    if (s !== 200) return khung("lo-trinh", `<p class="trong">${t("loi:mang")}</p>`);
    // Máy chủ bảo đang có ca mở mà máy này chưa theo dõi (mở lại app) → nối lại.
    if (d.phien && !caTd) { caTd = { phien_id: d.phien.id, bat_luc: d.phien.bat_luc }; vtBatWatch(); }
    if (!d.phien && caTd) { vtDung(); caTd = null; }

    if (!d.dong_y) {
      khung("lo-trinh", `
        <div class="the"><h2>${t("lt_tieu_de")}</h2>
          <p class="nho" style="line-height:1.6">${t("lt_dong_y_than")}</p>
          <label class="tick"><input type="checkbox" id="lt-ok"><span>${t("lt_dong_y_nut")}</span></label>
          <button class="nut chinh rong" id="lt-dongy" disabled>${t("lt_dong_y_xac_nhan")}</button></div>`);
      $("#lt-ok").onchange = (e) => $("#lt-dongy").disabled = !e.target.checked;
      $("#lt-dongy").onclick = async () => { const r = await goi("vi-tri/dong-y", {}); if (r.s === 200) veLoTrinh(); else bao(tLoi(r.d.loi)); };
      return;
    }

    const dangCa = !!caTd;
    khung("lo-trinh", `
      <div class="the dong-ho" style="${dangCa ? "border:2px solid #16a34a" : ""}">
        <div class="hang-giua"><h2 style="margin:0">${t("lt_tieu_de")}</h2>
          <span class="nhan ${dangCa ? "n-xanh" : ""}">${dangCa ? "● " + t("lt_dang_trong_ca") : t("lt_ngoai_ca")}</span></div>
        ${dangCa ? `<p class="nho" style="margin:10px 0 0">${t("lt_tu")} <b id="lt-tu">${gio(caTd.bat_luc)}</b> · <b id="lt-dagui">${vtDaGui}</b> ${t("lt_diem_da_gui")}</p>` : ""}
      </div>
      ${dangCa
        ? `<button class="nut do rong" id="lt-ket">${t("lt_ket_thuc")}</button>
           <div class="the"><h2>${t("lt_ghe_tieu_de")}</h2>
             <label>${t("lt_ghe_loai")}</label>
             <select id="g-loai">${["khach", "giao", "sua"].map((x) => `<option value="${x}">${t("loai:" + x)}</option>`).join("")}</select>
             <label>${t("lt_ghe_ten")}</label><input id="g-ten" type="text" placeholder="${h(t("lt_ghe_ten_ph"))}">
             <button class="nut chinh rong" id="lt-ghe">${t("lt_ghe_luu")}</button></div>`
        : `<button class="nut chinh rong" id="lt-bat">${t("lt_bat_dau")}</button>`}
      <div class="the"><p class="nho" style="line-height:1.6">${t("lt_ghi_chu_nen")}</p>
        <a href="#" id="lt-rut" class="loi-link">${t("lt_rut")}</a></div>`);
    capNhatCa();

    $("#lt-bat") && ($("#lt-bat").onclick = async () => {
      if (!navigator.geolocation) return bao(t("lt_can_vi_tri"));
      const vt = await layViTri();
      if (!vt) return bao(t("lt_can_vi_tri"));
      const r = await goi("vi-tri/bat-ca", { may: maMay() });
      if (r.s !== 200) return bao(tLoi(r.d.loi));
      caTd = { phien_id: r.d.phien.id, bat_luc: r.d.phien.bat_luc }; vtDaGui = 0; vtBuf = [];
      vtMoiNhat = { lat: vt.lat, lng: vt.lng };
      vtBuf.push({ luc: Date.now(), lat: vt.lat, lng: vt.lng, do_cx: vt.sai_so, pin: pinPhanTram });
      vtBatWatch(); vtNap(); veLoTrinh();
    });
    $("#lt-ket") && ($("#lt-ket").onclick = async () => {
      if (!confirm(t("lt_ket_xac_nhan"))) return;
      await vtNap(); vtDung();
      await goi("vi-tri/tat-ca", {}); caTd = null; veLoTrinh();
    });
    $("#lt-ghe") && ($("#lt-ghe").onclick = async () => {
      const vt = vtMoiNhat || await layViTri();   // đang trong ca thì đã có vị trí trực tiếp, không gọi GPS lại
      const r = await goi("ghe-tham", { phien_id: caTd && caTd.phien_id, loai: $("#g-loai").value,
        ten: $("#g-ten").value, ...(vt ? { lat: vt.lat, lng: vt.lng } : {}) });
      if (r.s === 200) { bao(t("lt_ghe_da_luu")); $("#g-ten").value = ""; } else bao(tLoi(r.d.loi));
    });
    $("#lt-rut").onclick = async (e) => {
      e.preventDefault();
      if (!confirm(t("lt_rut_xac_nhan"))) return;
      await vtNap().catch(() => {}); vtDung();
      await goi("vi-tri/dong-y", { rut: true }); caTd = null; veLoTrinh();
    };
  }

  // ================= Bộ lọc dùng chung (phòng ban + ô tìm) và chia trang =================
  const LOC = { pb: "", q: "" };
  let PBS = null, LOC_HN = "", TT_NV = "";
  async function taiPb(lai) { if (!PBS || lai) { const r = await goi("phong-ban"); PBS = r.d.ds || []; } return PBS; }
  const tsLoc = () => `pb=${encodeURIComponent(LOC.pb)}&q=${encodeURIComponent(LOC.q)}`;
  const chonPb = (id, gt, rong = true) => `<select ${id ? `id="${id}"` : 'name="phong_ban_id"'}>${rong ? `<option value="">${t(id ? "tat_ca_pb" : "chua_pb")}</option>` : ""}
    ${(PBS || []).map((p) => `<option value="${p.id}" ${gt === p.id ? "selected" : ""}>${h(p.ten)}</option>`).join("")}
    ${id ? `<option value="khong" ${gt === "khong" ? "selected" : ""}>${t("chua_pb")}</option>` : ""}</select>`;
  const oLoc = () => `<div class="the loc">${TOI.gioi_han_pb || !(PBS || []).length ? "" : chonPb("loc-pb", LOC.pb)}
    <input type="search" id="loc-q" value="${h(LOC.q)}" placeholder="${h(t("tim_nv"))}" enterkeyhint="search"></div>`;
  function ganLoc(veLai, giu) {
    $("#loc-pb")?.addEventListener("change", (e) => { LOC.pb = e.target.value; veLai(1); });
    let hen;
    const o = $("#loc-q");
    o?.addEventListener("input", () => { clearTimeout(hen); hen = setTimeout(() => { LOC.q = o.value.trim(); veLai(1, true); }, 350); });
    // Gõ tới đâu lọc tới đó mà không mất con trỏ trong ô tìm.
    if (giu && o) { o.focus(); o.setSelectionRange(o.value.length, o.value.length); }
  }
  const oTrang = (tr, so) => so > 1 ? `<div class="trang"><button class="nut" data-trang="${tr - 1}" ${tr <= 1 ? "disabled" : ""}>‹ ${t("truoc")}</button>
    <span>${tr} / ${so}</span><button class="nut" data-trang="${tr + 1}" ${tr >= so ? "disabled" : ""}>${t("sau")} ›</button></div>` : "";
  const ganTrang = (ve) => $$("[data-trang]").forEach((b) => b.onclick = () => { ve(Number(b.dataset.trang)); window.scrollTo(0, 0); });

  // ================= Quản trị: hôm nay =================
  async function veHomNay(trang = 1, giu) {
    if (!giu) khung("hom-nay", `<p class="trong">…</p>`);
    await taiPb();
    const { d } = await goi(`hom-nay?${tsLoc()}&loc=${LOC_HN}&trang=${trang}`);
    if (!d.tong) return;
    const tg = d.tong;
    const o = (k, so, cls, nhan) => `<button type="button" class="so ${cls} ${LOC_HN === k ? "chon" : ""}" data-loc="${k}"><b>${so}</b><span>${nhan}</span></button>`;
    khung("hom-nay", `
      ${d.don_cho ? `<a class="the banner" href="#don">✎ <b>${d.don_cho}</b> ${t("don_cho_banner")}</a>` : ""}
      ${oLoc()}
      <div class="luoi">${o("da_vao", `${tg.da_vao}/${tg.nv}`, "", t("da_vao"))}${o("muon", tg.muon, tg.muon ? "canh" : "", t("di_muon"))}
        ${o("chua_vao", tg.chua_vao, tg.chua_vao ? "do" : "", t("chua_vao"))}${o("nghi", tg.nghi, "", t("dang_nghi"))}
        ${o("canh_bao", tg.canh_bao, tg.canh_bao ? "canh" : "", t("co_cb"))}</div>
      ${LOC_HN ? `<p class="nho">${t("dang_loc")} · ${d.so_dong} ${t("so_nguoi")} · <a href="#" id="bo-loc">${t("bo_loc")}</a></p>` : ""}
      <div class="the"><ul class="ds">${d.ds.map((x) => `<li data-nv="${x.nv.id}" data-ngay="${x.ngay.ngay}">
        <div><div class="ten">${h(x.nv.ten)}${x.nv.ma_nv ? ` <span class="phu">${h(x.nv.ma_nv)}</span>` : ""}</div>
          <div class="phu">${x.nv.phong_ban ? h(x.nv.phong_ban) + " · " : ""}${h(x.nv.ca || "—")} · ${gio(x.ngay.vao)} → ${gio(x.ngay.ra)}${x.ngay.muon_phut ? ` · ${x.ngay.muon_phut}′` : ""}</div></div>
        <div class="phai">${nhanNgay(x.ngay.trang_thai)}<div>${nhanCb(x.canh_bao)}</div></div></li>`).join("") || `<li>${t("khong_co_du_lieu")}</li>`}</ul>
        ${oTrang(d.trang, d.so_trang)}</div>`);
    $$("[data-loc]").forEach((b) => b.onclick = () => { LOC_HN = LOC_HN === b.dataset.loc ? "" : b.dataset.loc; veHomNay(1); });
    $("#bo-loc")?.addEventListener("click", (e) => { e.preventDefault(); LOC_HN = ""; veHomNay(1); });
    ganLoc(veHomNay, giu); ganTrang(veHomNay);
    $$("li[data-nv]").forEach((li) => li.onclick = () => location.hash = `#nv/${li.dataset.nv}/${li.dataset.ngay}`);
  }

  async function veChiTietNgay(nvId, ngay) {
    khung("hom-nay", `<p class="trong">…</p>`);
    const { d } = await goi(`nv/${nvId}/ngay?ngay=${ngay}`);
    if (!d.nv) return khung("hom-nay", `<p class="trong">${t("khong_co_du_lieu")}</p>`);
    khung("hom-nay", `<a href="javascript:history.back()">${t("quay_lai")}</a>
      <div class="the"><h2>${h(d.nv.ten)} · ${ngayDep(ngay)}</h2>
      ${d.ban.map((b) => `<div class="ban-ghi">
        ${b.con_anh ? `<img src="/api/anh/${b.id}" alt="" loading="lazy">` : `<div class="anh-trong">${b.co_anh ? t("anh_da_xoa") : "—"}</div>`}
        <div><div class="ten">${b.loai === "vao" ? "→ " + t("gio_vao") : "← " + t("gio_ra")} ${gio(b.luc)}</div>
          <div class="phu">${b.dia_diem ? h(b.dia_diem) + " · " : ""}${b.qua_qr ? t("qua_qr") + " · " : ""}${b.qua_the ? "💳 " + t("may_quet_the") + " · " : ""}${b.cach_met != null ? `${t("cach")} ${b.cach_met} m · ` : ""}${b.sai_so != null ? `±${b.sai_so} m` : ""}</div>
          <div class="phu">IP ${h(b.ip || "—")}</div>
          ${b.lat != null ? `<a href="https://www.google.com/maps?q=${b.lat},${b.lng}" target="_blank" rel="noopener">${t("xem_ban_do")}</a>` : ""}
          <div>${nhanCb(b.canh_bao)}</div></div></div>`).join("") || `<p>${t("khong_co_du_lieu")}</p>`}
      </div>`);
  }

  // ================= Quản trị: bảng công =================
  let THANG_BC = null;
  async function veBangCong(trang = 1, giu) {
    const thang = THANG_BC || homNay().slice(0, 7);
    if (!giu) khung("bang-cong", `<p class="trong">…</p>`);
    await taiPb();
    const { d } = await goi(`bang-cong?thang=${thang}&${tsLoc()}&trang=${trang}`);
    if (!d.ds) return;
    const csv = (k) => `/api/bang-cong.csv?thang=${thang}&${tsLoc()}${k ? "&kieu=" + k : ""}`;
    khung("bang-cong", `<div class="the">${chonThang(thang)}
        <div class="hang" style="margin-top:12px"><a class="nut" href="${csv("")}">⤓ ${t("xuat_tong")}</a>
        <a class="nut" href="${csv("chi-tiet")}">⤓ ${t("xuat_chi_tiet")}</a></div></div>
      ${oLoc()}<p class="nho">${d.tong_nv} ${t("so_nguoi")}</p>
      <div class="the cuon"><table class="bang"><thead><tr><th>${t("ho_ten")}</th><th>${t("tong_cong")}</th><th>${t("cong_phep")}</th>
        <th>${t("ngay_vang")}</th><th>${t("lan_muon")}</th><th>${t("phut_muon")}</th><th>${t("thieu_ra")}</th><th>⚠</th></tr></thead>
        <tbody>${d.ds.map((x) => `<tr data-nv="${x.nv.id}"><td><b>${h(x.nv.ten)}</b><div class="phu">${h(x.nv.ma_nv || "")} ${h(x.nv.phong_ban)} ${h(x.nv.ca)}</div></td>
          <td>${so(x.tong.cong)}</td><td>${so(x.tong.cong_phep)}</td><td class="${x.tong.vang ? "c-do" : ""}">${x.tong.vang}</td>
          <td>${x.tong.lan_muon}</td><td>${x.tong.muon_phut}</td><td class="${x.tong.thieu_ra ? "c-canh" : ""}">${x.tong.thieu_ra}</td><td>${x.tong.canh_bao}</td></tr>`).join("")}</tbody></table>
        ${oTrang(d.trang, d.so_trang)}</div>`);
    $("#thang").onchange = (e) => { THANG_BC = e.target.value; veBangCong(1); };
    ganLoc(veBangCong, giu); ganTrang(veBangCong);
    $$("tr[data-nv]").forEach((tr) => tr.onclick = () => location.hash = `#nv-thang/${tr.dataset.nv}/${thang}`);
  }
  async function veNvThang(nvId, thang) {
    khung("bang-cong", `<p class="trong">…</p>`);
    const { d } = await goi(`nv/${nvId}/thang?thang=${thang}`);
    if (!d.nv) return khung("bang-cong", `<p class="trong">${t("khong_co_du_lieu")}</p>`);
    khung("bang-cong", `<a href="#bang-cong">${t("quay_lai")}</a><div class="the"><h2>${h(d.nv.ten)} · ${thang}</h2>
      <p class="nho" style="margin:0">${d.ca ? `${h(d.ca.ten)} ${d.ca.gio_vao}–${d.ca.gio_ra}` : t("chua_gan_ca")}</p></div>
      ${oTong(d.tong)}<div class="the"><ul class="ds">${d.ngay.map((n) => veNgayCong(n, true)).join("")}</ul></div>`);
    $$("li[data-ngay]").forEach((li) => li.onclick = () => location.hash = `#nv/${nvId}/${li.dataset.ngay}`);
  }

  // ================= Quản trị: quản lý =================
  function veQuanLy() {
    const toanCty = !TOI.gioi_han_pb;
    khung("quan-ly", `<div class="menu">
      <a class="the" href="#bang-luong">💰 <b>${t("bang_luong")}</b></a>
      <a class="the" href="#buoi-day">📚 <b>${t("buoi_day")}</b></a>
      <a class="the" href="#lam-them">⏱ <b>${t("lam_them")}</b></a>
      ${toanCty ? `<a class="the" href="#thiet-lap-luong">🧾 <b>${t("thiet_lap_luong")}</b></a>` : ""}
      ${TOI.vai === "chu" ? `<a class="the" href="#noi-lark">🔗 <b>${t("noi_lark")}</b></a>` : ""}
      <a class="the" href="#nhan-vien">☺ <b>${t("nhan_vien")}</b></a>
      <a class="the" href="#nhap-nv">⤒ <b>${t("nhap_excel")}</b></a>
      ${toanCty ? `<a class="the" href="#phong-ban">▣ <b>${t("phong_ban")}</b></a>` : ""}
      <a class="the" href="#in-the">💳 <b>${t("in_the")}</b></a>
      <a class="the" href="/ban-do.html" target="_blank" rel="noopener">🗺 <b>${t("ban_do")}</b></a>
      ${toanCty ? `<a class="the" href="#ca-lam">◷ <b>${t("ca_lam")}</b></a>
      <a class="the" href="#dia-diem">⌖ <b>${t("dia_diem")}</b></a>` : ""}
      ${TOI.vai === "chu" ? `<a class="the" href="#cai-dat">⚙ <b>${t("cai_dat")}</b></a>` : ""}
      <a class="the" href="#toi">◉ <b>${t("tai_khoan")}</b></a></div>`);
  }

  const linkMoi = (ma) => `${location.origin}/#moi=${ma}`;
  const anhQr = (chu, co = 6) => { try { const q = qrcode(0, "M"); q.addData(chu); q.make(); return q.createDataURL(co, 2); } catch { return ""; } };
  function oMoi(ma) {
    const l = linkMoi(ma);
    return `<div class="moi"><p class="nho">${t("link_moi")}</p><div class="qr"><div class="anh"><img src="${anhQr(l, 4)}" alt="QR"></div>
      <div><div class="link">${h(l)}</div><div class="hang nut-nho"><button class="nut" data-chep="${h(l)}">${t("chep")}</button>
      <a class="nut" href="https://zalo.me/share?url=${encodeURIComponent(l)}" target="_blank" rel="noopener">${t("gui_zalo")}</a></div></div></div></div>`;
  }
  function ganChep(trong) {
    (trong ? [...trong.querySelectorAll("[data-chep]")] : $$("[data-chep]")).forEach((b) => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.chep); bao(t("da_chep")); } catch { prompt("", b.dataset.chep); }
    });
  }
  function taiTep(ten, chu, loai = "text/csv;charset=utf-8") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([chu], { type: loai })); a.download = ten;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ================= Quản trị: nhân viên (chia trang, form chỉ dựng khi mở) =================
  async function veNhanVien(trang = 1, giu) {
    if (!giu) khung("quan-ly", `<p class="trong">…</p>`);
    const [nv, ca, dd] = await Promise.all([goi(`nv?${tsLoc()}&tt=${TT_NV}&trang=${trang}`), goi("ca"), goi("dia-diem"), taiPb()]);
    if (!nv.d.ds) return;
    const cas = ca.d.ds, dds = dd.d.ds;
    const laChu = TOI.vai === "chu";
    const form = (x = {}) => `<form class="fnv" data-id="${x.id || ""}">
      <label>${t("ho_ten")}</label><input type="text" name="ten" value="${h(x.ten)}" required>
      <div class="hang"><div><label>${t("sdt")}</label><input type="tel" name="sdt" value="${h(x.sdt)}"></div>
        <div><label>${t("ma_nv")}</label><input type="text" name="ma_nv" value="${h(x.ma_nv)}"></div></div>
      <label>${t("email_tuy")}</label><input type="email" name="email" value="${h(x.email)}">
      ${TOI.gioi_han_pb ? "" : `<label>${t("phong_ban_1")}</label>${chonPb("", x.phong_ban_id ?? (LOC.pb && LOC.pb !== "khong" ? LOC.pb : ""))}`}
      <div class="hang"><div><label>${t("ca")}</label><select name="ca_id"><option value="">${t("khong_ca")}</option>${cas.map((c) => `<option value="${c.id}" ${(x.ca_id ?? cas[0]?.id) === c.id ? "selected" : ""}>${h(c.ten)} ${c.gio_vao}–${c.gio_ra}</option>`).join("")}</select></div>
        <div><label>${t("dia_diem_chinh")}</label><select name="dia_diem_id"><option value="">${t("khong_dd")}</option>${dds.map((c) => `<option value="${c.id}" ${(x.dia_diem_id ?? dds[0]?.id) === c.id ? "selected" : ""}>${h(c.ten)}</option>`).join("")}</select></div></div>
      <label>${t("che_do")}</label><select name="che_do">${["van_phong", "thi_truong", "the"].map((c) => `<option value="${c}" ${x.che_do === c ? "selected" : ""}>${t("cd:" + c)}</option>`).join("")}</select>
      ${x.vai !== "chu" && laChu ? `<div class="hang"><div><label>${t("vai")}</label><select name="vai">${["nhan_vien", "quan_ly"].map((v) => `<option value="${v}" ${x.vai === v ? "selected" : ""}>${t("vai:" + v)}</option>`).join("")}</select></div>
        <div class="o-pham-vi" ${x.vai === "quan_ly" ? "" : "hidden"}><label>${t("pham_vi")}</label><select name="pham_vi">${["cong_ty", "phong_ban"].map((v) => `<option value="${v}" ${x.pham_vi === v ? "selected" : ""}>${t("pv:" + v)}</option>`).join("")}</select></div></div>` : ""}
      <div class="loi"></div><button class="nut chinh rong" type="submit">${t("luu")}</button></form>`;
    const tenPb = (id) => (PBS || []).find((p) => p.id === id)?.ten || "";
    const chiTiet = (x) => `${x.che_do === "the" ? `<p class="nho">💳 ${t("khong_can_app")}</p>` : x.ma_moi || x.ma_moi_lai ? oMoi(x.ma_moi || x.ma_moi_lai) : ""}
      ${form(x)}
      <div class="hang nut-nho">
        ${x.co_may ? `<button class="nut" data-viec="doi-may" title="${h(t("doi_may_mo_ta"))}">${t("doi_may")}</button>` : ""}
        ${x.trang_thai === "hoat_dong" && x.che_do !== "the" ? `<button class="nut" data-viec="moi-lai">${t("moi_lai")}</button>` : ""}
        ${x.trang_thai === "hoat_dong" ? `<button class="nut" data-viec="cap-the">${t("cap_the")}</button>` : ""}
        <a class="nut" href="#luong-nv/${x.id}">💰 ${t("cv_luong")}</a>
        ${x.id !== TOI.id && x.vai !== "chu" ? (x.trang_thai === "hoat_dong" ? `<button class="nut do" data-viec="nghi-viec">${t("nghi_viec")}</button>` : `<button class="nut" data-viec="khoi-phuc">${t("khoi_phuc")}</button>`) : ""}
      </div>`;
    khung("quan-ly", `<a href="#quan-ly">${t("quay_lai")}</a>
      <details class="the" id="them"><summary><b>${t("them_nv")}</b></summary><div id="them-trong">${form({ che_do: "van_phong" })}</div></details>
      ${oLoc()}
      <div class="chips">${[["", "tt_dang_lam"], ["chua_nhan", "tt_chua_nhan"], ["nghi_viec", "tt_nghi"]]
        .map(([k, n]) => `<span class="chip ${TT_NV === k ? "on" : ""}" data-tt="${k}">${t(n)}</span>`).join("")}</div>
      <p class="nho">${nv.d.tong} ${t("so_nguoi")}</p>
      <div class="the"><ul class="ds">${nv.d.ds.map((x) => `<li class="cot-don" data-nv="${x.id}">
        <div class="hang-giua mo-nv"><div><div class="ten">${h(x.ten)} ${x.vai !== "nhan_vien" ? `<span class="nhan">${t("vai:" + x.vai)}</span>` : ""}</div>
          <div class="phu">${h(x.sdt || x.email || "")}${x.ma_nv ? " · " + h(x.ma_nv) : ""}${tenPb(x.phong_ban_id) ? " · " + h(tenPb(x.phong_ban_id)) : ""} · ${h(cas.find((c) => c.id === x.ca_id)?.ten || "—")}</div></div>
          <div class="phai">${x.trang_thai !== "hoat_dong" ? `<span class="nhan n-vang">${t("nv:nghi_viec")}</span>` : x.che_do === "the" ? `<span class="nhan">💳</span>` : !x.da_nhan ? `<span class="nhan n-canh">${t("chua_nhan")}</span>` : x.co_may ? `<span class="nhan">📱</span>` : ""}</div></div>
        <div class="chi-tiet" hidden></div></li>`).join("") || `<li>${t("khong_co_du_lieu")}</li>`}</ul>
        ${oTrang(nv.d.trang, nv.d.so_trang)}</div>`);
    const ganForm = (f, sau) => {
      f.vai?.addEventListener("change", () => { const o = f.querySelector(".o-pham-vi"); if (o) o.hidden = f.vai.value !== "quan_ly"; });
      f.onsubmit = async (e) => {
        e.preventDefault();
        const id = f.dataset.id;
        const r = await goi(id ? `nv/${id}/sua` : "nv", Object.fromEntries(new FormData(f)));
        if (r.s !== 200) { f.querySelector(".loi").textContent = tLoi(r.d.loi); return; }
        bao(t("da_luu")); sau(r.d);
      };
    };
    const moChiTiet = (li) => {
      const x = nv.d.ds.find((y) => y.id === li.dataset.nv), c = li.querySelector(".chi-tiet");
      c.innerHTML = chiTiet(x); c.hidden = false; ganChep(c);
      ganForm(c.querySelector(".fnv"), () => veNhanVien(trang));
      c.querySelectorAll("[data-viec]").forEach((b) => b.onclick = async () => {
        if (b.dataset.viec === "nghi-viec" && !confirm(t("nghi_viec") + "?")) return;
        if (b.dataset.viec === "cap-the" && !confirm(t("cap_the_hoi"))) return;
        const r = await goi(`nv/${x.id}/${b.dataset.viec}`, {});
        if (r.s !== 200) return bao(tLoi(r.d.loi));
        bao(t("da_luu"));
        if (b.dataset.viec === "moi-lai") { x.ma_moi_lai = r.d.ma_moi; moChiTiet(li); } else veNhanVien(trang);
      });
    };
    $$(".mo-nv").forEach((e) => e.onclick = () => { const li = e.parentElement, c = li.querySelector(".chi-tiet"); if (c.hidden) moChiTiet(li); else c.hidden = true; });
    ganForm($("#them-trong .fnv"), (kq) => {
      $("#them-trong").innerHTML = `${kq.ma_moi ? `<p class="nho">${t("da_them_gui")}</p>${oMoi(kq.ma_moi)}` : `<p class="nho">✓ ${t("khong_can_app")}</p>`}
        <button class="nut rong" id="them-nua" type="button">${t("them_nv")}</button>`;
      ganChep($("#them-trong"));
      $("#them-nua").onclick = () => veNhanVien(1);
    });
    $$(".chip[data-tt]").forEach((c) => c.onclick = () => { TT_NV = c.dataset.tt; veNhanVien(1); });
    ganLoc(veNhanVien, giu); ganTrang(veNhanVien);
  }

  // ================= Quản trị: phòng ban =================
  async function vePhongBan() {
    khung("quan-ly", `<p class="trong">…</p>`);
    const ds = await taiPb(true);
    khung("quan-ly", `<a href="#quan-ly">${t("quay_lai")}</a>
      <div class="the"><h2>${t("phong_ban")}</h2><p class="nho">${t("pb_mo_ta")}</p>
        <form id="fpb" class="hang"><input type="text" name="ten" placeholder="${h(t("ten_pb"))}" required><button class="nut chinh" type="submit" style="flex:0 0 auto">${t("them_pb")}</button></form>
        <div class="loi" id="loi"></div></div>
      <div class="the"><ul class="ds">${ds.map((p) => `<li data-pb="${p.id}"><form class="hang sua-pb" style="flex:1">
          <input type="text" name="ten" value="${h(p.ten)}" required><span class="phu">${p.so_nv} ${t("so_nguoi")}</span>
          <button class="nut" type="submit" style="flex:0 0 auto">${t("luu")}</button><button class="nut do" type="button" data-xoa style="flex:0 0 auto">${t("xoa")}</button></form></li>`).join("") || `<li>${t("khong_co_du_lieu")}</li>`}</ul></div>`);
    $("#fpb").onsubmit = async (e) => {
      e.preventDefault();
      const r = await goi("phong-ban", { ten: e.target.ten.value });
      if (r.s !== 200) { $("#loi").textContent = tLoi(r.d.loi); return; }
      vePhongBan();
    };
    $$(".sua-pb").forEach((f) => {
      const id = f.closest("li").dataset.pb;
      f.onsubmit = async (e) => { e.preventDefault(); const r = await goi(`phong-ban/${id}/sua`, { ten: f.ten.value }); bao(r.s === 200 ? t("da_luu") : tLoi(r.d.loi)); taiPb(true); };
      f.querySelector("[data-xoa]").onclick = async () => { if (!confirm(t("xac_nhan_xoa"))) return; await goi(`phong-ban/${id}/xoa`, {}); vePhongBan(); };
    });
  }

  // ================= Quản trị: nhập nhân viên từ Excel / CSV =================
  // Đọc tệp NGAY TRONG TRÌNH DUYỆT (.xlsx là tệp zip chứa XML), không tải tệp lên máy chủ — chỉ gửi các dòng đã đọc.
  const COT = {
    ten: ["ho ten", "ho va ten", "ten", "ten nhan vien", "name", "full name"],
    sdt: ["sdt", "so dien thoai", "dien thoai", "dt", "phone", "phone number"],
    email: ["email", "e-mail", "mail"],
    ma_nv: ["ma nv", "ma nhan vien", "ma", "msnv", "employee id", "id"],
    phong_ban: ["phong ban", "bo phan", "phong", "department"],
    ca: ["ca", "ca lam", "shift"],
    dia_diem: ["dia diem", "co so", "chi nhanh", "site", "location"],
    che_do: ["cach cham", "che do", "hinh thuc", "mode"],
  };
  const boDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
  function docCsv(chu) {
    chu = chu.replace(/^﻿/, "");
    const dau = chu.split(/\r?\n/)[0] || "";
    const tach = [";", "\t", ","].sort((a, b) => dau.split(b).length - dau.split(a).length)[0];
    const dong = []; let o = "", hang = [], nhay = false;
    for (let i = 0; i < chu.length; i++) {
      const c = chu[i];
      if (nhay) { if (c === '"') { if (chu[i + 1] === '"') { o += '"'; i++; } else nhay = false; } else o += c; }
      else if (c === '"') nhay = true;
      else if (c === tach) { hang.push(o); o = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && chu[i + 1] === "\n") i++; hang.push(o); dong.push(hang); hang = []; o = ""; }
      else o += c;
    }
    if (o || hang.length) { hang.push(o); dong.push(hang); }
    return dong;
  }
  // Đọc một tệp trong zip (.xlsx) bằng DecompressionStream có sẵn của trình duyệt — không cần thư viện.
  async function giaiNen(buf, ten) {
    const v = new DataView(buf);
    let e = buf.byteLength - 22;
    while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("zip");
    const soTep = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
    const td = new TextDecoder();
    for (let i = 0; i < soTep; i++) {
      const cach = v.getUint16(p + 10, true), nen = v.getUint32(p + 20, true), dTen = v.getUint16(p + 28, true);
      const dPhu = v.getUint16(p + 30, true), dGhi = v.getUint16(p + 32, true), dau = v.getUint32(p + 42, true);
      const tenTep = td.decode(new Uint8Array(buf, p + 46, dTen));
      if (tenTep === ten) {
        const bd = dau + 30 + v.getUint16(dau + 26, true) + v.getUint16(dau + 28, true);
        const du = new Uint8Array(buf, bd, nen);
        if (cach === 0) return td.decode(du);
        const s = new Blob([du]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return await new Response(s).text();
      }
      p += 46 + dTen + dPhu + dGhi;
    }
    return null;
  }
  async function docXlsx(buf) {
    const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
    const chung = await giaiNen(buf, "xl/sharedStrings.xml");
    const ss = chung ? [...xml(chung).getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((x) => x.textContent).join("")) : [];
    const trang = await giaiNen(buf, "xl/worksheets/sheet1.xml");
    if (!trang) throw new Error("sheet");
    const cot = (r) => { let n = 0; for (const ch of r.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
    return [...xml(trang).getElementsByTagName("row")].map((row) => {
      const hang = [];
      for (const c of row.getElementsByTagName("c")) {
        const kieu = c.getAttribute("t"), gt = c.getElementsByTagName("v")[0]?.textContent ?? "";
        hang[cot(c.getAttribute("r") || "A")] = kieu === "s" ? ss[Number(gt)] ?? "" : kieu === "inlineStr" ? [...c.getElementsByTagName("t")].map((x) => x.textContent).join("") : gt;
      }
      return Array.from(hang, (x) => x ?? "");
    });
  }
  function veNhap() {
    khung("quan-ly", `<a href="#quan-ly">${t("quay_lai")}</a>
      <div class="the"><h2>${t("nhap_excel")}</h2><p class="nho">${t("nhap_mo_ta")}</p>
        <div class="hang"><button class="nut" id="mau" type="button">${t("tai_mau")}</button></div>
        <label>${t("chon_tep")}</label><input type="file" id="tep" accept=".xlsx,.csv,text/csv">
        <div class="loi" id="loi"></div><div id="xem"></div></div>
      <div id="ket"></div>`);
    $("#mau").onclick = () => taiTep("mau-nhap-nhan-vien.csv", "﻿" + ["Họ tên,Số điện thoại,Email,Mã NV,Phòng ban,Ca,Địa điểm,Cách chấm",
      "Nguyễn Văn An,0912345678,,NV001,Kế toán,,,văn phòng", "Trần Thị Bình,,,NV002,Xưởng may,,,thẻ"].join("\r\n"));
    $("#tep").onchange = async (e) => {
      const tep = e.target.files[0]; if (!tep) return;
      $("#loi").textContent = ""; $("#xem").innerHTML = ""; $("#ket").innerHTML = "";
      let bang;
      try { bang = /\.xlsx$/i.test(tep.name) ? await docXlsx(await tep.arrayBuffer()) : docCsv(await tep.text()); }
      catch { $("#loi").textContent = tLoi("trong"); return; }
      const dau = (bang[0] || []).map(boDau), viTri = {};
      for (const [k, ten] of Object.entries(COT)) { const i = dau.findIndex((x) => ten.includes(x)); if (i >= 0) viTri[k] = i; }
      if (viTri.ten == null) { $("#loi").textContent = t("thieu_cot_ten"); return; }
      const dong = bang.slice(1).map((r, i) => ({ so: i + 2, ...Object.fromEntries(Object.entries(viTri).map(([k, j]) => [k, String(r[j] ?? "").trim()])) }))
        .filter((r) => r.ten);
      if (!dong.length) { $("#loi").textContent = tLoi("trong"); return; }
      $("#xem").innerHTML = `<p>${t("doc_duoc", { n: dong.length })} ${t("cot_nhan")}: <b>${Object.values(viTri).map((j) => h(bang[0][j])).join(" · ")}</b></p>
        <div class="cuon"><table class="bang"><tbody>${dong.slice(0, 5).map((r) => `<tr><td>${r.so}</td><td>${h(r.ten)}</td><td>${h(r.sdt || r.email || "")}</td><td>${h(r.phong_ban || "")}</td><td>${h(r.che_do || "")}</td></tr>`).join("")}</tbody></table></div>
        <button class="nut chinh rong" id="nhap" style="margin-top:12px">${t("bat_dau_nhap", { n: dong.length })}</button>`;
      $("#nhap").onclick = async () => {
        $("#nhap").disabled = true;
        const lo = 40, ket = [];
        for (let i = 0; i < dong.length; i += lo) {
          $("#nhap").textContent = `${t("dang_nhap_lo")} ${Math.min(i + lo, dong.length)}/${dong.length}`;
          const phan = dong.slice(i, i + lo);
          const r = await goi("nv/nhap", { dong: phan });
          if (r.s !== 200) { phan.forEach((d) => ket.push({ so: d.so, ten: d.ten, loi: r.d.loi })); continue; }
          r.d.ket.forEach((k) => ket.push({ ...k, so: phan[k.i].so, ten: phan[k.i].ten, sdt: k.sdt || phan[k.i].sdt }));
        }
        const ok = ket.filter((k) => k.ok), hong = ket.filter((k) => !k.ok);
        PBS = null;
        $("#ket").innerHTML = `<div class="the"><h2>${t("ket_qua_nhap", { ok: ok.length, loi: hong.length })}</h2>
          ${ok.some((k) => k.ma_moi) ? `<button class="nut chinh" id="link">${t("tai_link_moi")}</button>` : ""}
          ${hong.length ? `<ul class="ds gon">${hong.map((k) => `<li><span>${t("dong")} ${k.so}: ${h(k.ten)}</span><span class="phai c-do">${h(tLoi(k.loi))}</span></li>`).join("")}</ul>` : ""}</div>`;
        $("#nhap").textContent = "✓";
        $("#link")?.addEventListener("click", () => taiTep("link-moi-nhan-vien.csv", "﻿Họ tên,Số điện thoại,Email,Link mời\r\n" +
          ok.filter((k) => k.ma_moi).map((k) => [k.ten, k.sdt || "", k.email || "", linkMoi(k.ma_moi)].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n")));
      };
    };
  }

  // ================= Quản trị: in thẻ chấm công =================
  async function veInThe() {
    await taiPb();
    khung("quan-ly", `<div class="khong-in"><a href="#quan-ly">${t("quay_lai")}</a>
      <div class="the"><h2>${t("in_the")}</h2><p class="nho">${t("in_the_mo_ta")}</p>
        ${TOI.gioi_han_pb || !PBS.length ? "" : chonPb("in-pb", LOC.pb)}
        <button class="nut chinh rong" id="in" style="margin-top:12px">🖨 ${t("in")}</button></div></div>
      <div id="cac-the" class="cac-the"><p class="trong">…</p></div>`);
    const tai = async () => {
      const { d } = await goi(`nv/the?pb=${encodeURIComponent(LOC.pb)}`);
      $("#cac-the").innerHTML = (d.ds || []).map((x) => `<div class="the-in"><img src="${anhQr(x.the, 4)}" alt="QR">
        <div><small>${h(d.dn_ten)}</small><b>${h(x.ten)}</b><span>${h(x.ma_nv || "")}</span><span>${h(x.phong_ban)}</span></div></div>`).join("")
        || `<p class="trong">${t("khong_co_du_lieu")}</p>`;
    };
    $("#in-pb")?.addEventListener("change", (e) => { LOC.pb = e.target.value; tai(); });
    $("#in").onclick = () => window.print();
    tai();
  }

  async function veCa() {
    khung("quan-ly", `<p class="trong">…</p>`);
    const { d } = await goi("ca");
    const thu = t("thu_ngan");
    const form = (c = { ngay_lam: "1,2,3,4,5,6", nghi_phut: 60, cho_muon_phut: 5, gio_vao: "08:00", gio_ra: "17:00" }) => `<form class="fca" data-id="${c.id || ""}">
      <label>${t("ten_ca")}</label><input type="text" name="ten" value="${h(c.ten)}" required>
      <div class="hang"><div><label>${t("gio_vao")}</label><input type="time" name="gio_vao" value="${c.gio_vao}" required></div>
        <div><label>${t("gio_ra")}</label><input type="time" name="gio_ra" value="${c.gio_ra}" required></div></div>
      <p class="nho" style="margin:4px 0 0">${t("qua_dem")}</p>
      <div class="hang"><div><label>${t("nghi_trua")}</label><input type="number" name="nghi_phut" min="0" max="240" value="${c.nghi_phut}"></div>
        <div><label>${t("cho_muon")}</label><input type="number" name="cho_muon_phut" min="0" max="120" value="${c.cho_muon_phut}"></div></div>
      <label>${t("ngay_lam")}</label><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map((i) => `<label class="chip-tick"><input type="checkbox" name="thu" value="${i}" ${c.ngay_lam.split(",").includes(String(i)) ? "checked" : ""}><span>${thu[i]}</span></label>`).join("")}</div>
      <div class="loi"></div><div class="hang"><button class="nut chinh" type="submit">${t("luu")}</button>${c.id ? `<button class="nut do" type="button" data-xoa>${t("xoa")}</button>` : ""}</div></form>`;
    khung("quan-ly", `<a href="#quan-ly">${t("quay_lai")}</a>
      ${d.ds.map((c) => `<div class="the">${form(c)}</div>`).join("")}
      <details class="the"><summary><b>${t("them_ca")}</b></summary>${form()}</details>`);
    $$(".fca").forEach((f) => {
      f.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        const than = Object.fromEntries(fd); than.ngay_lam = fd.getAll("thu").join(",");
        const r = await goi(f.dataset.id ? `ca/${f.dataset.id}/sua` : "ca", than);
        if (r.s !== 200) { f.querySelector(".loi").textContent = tLoi(r.d.loi); return; }
        bao(t("da_luu")); veCa();
      };
      f.querySelector("[data-xoa]")?.addEventListener("click", async () => {
        if (!confirm(t("xac_nhan_xoa"))) return;
        await goi(`ca/${f.dataset.id}/xoa`, {}); veCa();
      });
    });
  }

  async function veDiaDiem() {
    khung("quan-ly", `<p class="trong">…</p>`);
    const { d } = await goi("dia-diem");
    const form = (x = { ban_kinh: 150, ip_ds: "" }) => `<form class="fdd" data-id="${x.id || ""}">
      <label>${t("ten_dd")}</label><input type="text" name="ten" value="${h(x.ten)}" required>
      <div class="hang"><div><label>${t("vi_do")}</label><input type="text" inputmode="decimal" name="lat" value="${x.lat ?? ""}"></div>
        <div><label>${t("kinh_do")}</label><input type="text" inputmode="decimal" name="lng" value="${x.lng ?? ""}"></div></div>
      <button class="nut" type="button" data-vt style="margin-top:8px">${t("lay_vi_tri")}</button>
      ${x.id && x.lat == null ? `<p class="nho canh-chu">${t("chua_co_toa_do")}</p>` : ""}
      <label>${t("ban_kinh")}</label><input type="number" name="ban_kinh" min="30" max="3000" value="${x.ban_kinh}">
      <label>${t("ip_vp")}</label><div class="hang"><input type="text" name="ip_ds" value="${h(x.ip_ds)}" placeholder="113.161.x.x"><button class="nut" type="button" data-ip style="flex:0 0 auto">${t("them_ip")}</button></div>
      <div class="loi"></div><div class="hang"><button class="nut chinh" type="submit">${t("luu")}</button>${x.id ? `<button class="nut do" type="button" data-xoa>${t("xoa")}</button>` : ""}</div></form>`;
    const kiosk = (x) => `${location.origin}/kiosk.html?d=${x.id}&k=${x.ma_kiosk}`;
    khung("quan-ly", `<a href="#quan-ly">${t("quay_lai")}</a>
      ${d.ds.map((x) => `<div class="the">${form(x)}
        <hr><h2>${t("man_qr")}</h2><p class="nho">${t("man_qr_mo_ta")}</p>
        <div class="link">${h(kiosk(x))}</div>
        <div class="hang nut-nho"><a class="nut chinh" href="${kiosk(x)}" target="_blank" rel="noopener">${t("mo_man_qr")}</a>
          <button class="nut" data-chep="${h(kiosk(x))}">${t("chep")}</button><button class="nut" data-doima="${x.id}">${t("doi_ma")}</button></div>
        <hr><h2>💳 ${t("may_quet_the")}</h2><p class="nho">${t("may_quet_mo_ta")}</p>
        <div class="link">${h(kiosk(x) + "&che=the")}</div>
        <div class="hang nut-nho"><a class="nut chinh" href="${kiosk(x)}&che=the" target="_blank" rel="noopener">${t("mo_may_quet")}</a>
          <button class="nut" data-chep="${h(kiosk(x) + "&che=the")}">${t("chep")}</button></div></div>`).join("")}
      <details class="the"><summary><b>${t("them_dd")}</b></summary>${form()}</details>`);
    ganChep();
    $$("[data-doima]").forEach((b) => b.onclick = async () => { if (!confirm(t("doi_ma") + "?")) return; await goi(`dia-diem/${b.dataset.doima}/doi-ma`, {}); veDiaDiem(); });
    $$(".fdd").forEach((f) => {
      f.onsubmit = async (e) => {
        e.preventDefault();
        const r = await goi(f.dataset.id ? `dia-diem/${f.dataset.id}/sua` : "dia-diem", Object.fromEntries(new FormData(f)));
        if (r.s !== 200) { f.querySelector(".loi").textContent = tLoi(r.d.loi); return; }
        bao(t("da_luu")); veDiaDiem();
      };
      f.querySelector("[data-vt]").onclick = async () => {
        const vt = await layViTri();
        if (!vt) return bao(t("can_vi_tri"));
        f.lat.value = vt.lat.toFixed(5); f.lng.value = vt.lng.toFixed(5); bao(`±${vt.sai_so} m`);
      };
      f.querySelector("[data-ip]").onclick = async () => {
        const { d: x } = await goi("ip");
        if (x.ip) f.ip_ds.value = [...new Set([...f.ip_ds.value.split(",").map((s) => s.trim()).filter(Boolean), x.ip])].join(", ");
      };
      f.querySelector("[data-xoa]")?.addEventListener("click", async () => {
        if (!confirm(t("xac_nhan_xoa"))) return;
        await goi(`dia-diem/${f.dataset.id}/xoa`, {}); veDiaDiem();
      });
    });
  }

  function veCaiDat() {
    const dn = TOI.dn;
    khung("quan-ly", `<a href="#quan-ly">${t("quay_lai")}</a>
      <form class="the" id="fc"><h2>${t("cai_dat")}</h2>
        <label>${t("ten_cty")}</label><input type="text" name="ten" value="${h(dn.ten)}">
        ${["bat_qr", "bat_gps", "bat_selfie"].map((k) => `<label class="tick"><input type="checkbox" name="${k}" ${dn[k] ? "checked" : ""}><span>${t(k)}</span></label>`).join("")}
        <div class="hang"><div><label>${t("giu_anh")}</label><input type="number" name="giu_anh_ngay" min="7" max="365" value="${dn.giu_anh_ngay}"></div>
          <div><label>${t("cong_chuan")}</label><input type="number" name="cong_chuan" min="20" max="31" value="${dn.cong_chuan}"></div></div>
        <div class="loi" id="loi"></div><button class="nut chinh rong" type="submit">${t("luu")}</button></form>`);
    $("#fc").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const r = await goi("dn/sua", { ten: f.ten.value, bat_qr: f.bat_qr.checked, bat_gps: f.bat_gps.checked, bat_selfie: f.bat_selfie.checked,
        giu_anh_ngay: f.giu_anh_ngay.value, cong_chuan: f.cong_chuan.value });
      if (r.s !== 200) { $("#loi").textContent = tLoi(r.d.loi); return; }
      await taiToi(); bao(t("da_luu")); veCaiDat();
    };
  }


  // ================= GĐ3 TÍNH LƯƠNG =================
  // Chữ song ngữ tại chỗ: phần lương nhiều chữ riêng, để cạnh nhau dễ sửa hơn rải sang i18n.js.
  const L2 = (vi, en) => (NGON === "vi" ? vi : en);
  const dong = (n) => (n == null || n === "" ? "—" : new Intl.NumberFormat(vungTien()).format(Math.round(n)));
  const vungTien = () => (NGON === "vi" ? "vi-VN" : "en-US");
  const CT = { thang: () => L2("Lương tháng", "Monthly"), gio: () => L2("Lương giờ", "Hourly"), khoan: () => L2("Khoán", "Fixed fee") };
  const THUE_T = { luy_tien: () => L2("Lũy tiến (HĐLĐ)", "Progressive (employee)"), khau_tru: () => L2("Khấu trừ 10%", "Withhold 10%"),
    khong_cu_tru: () => L2("Không cư trú 20%", "Non-resident 20%"), khong: () => L2("Không khấu trừ (có hoá đơn)", "None (invoiced)"),
    duoi_nguong: () => L2("Dưới ngưỡng khấu trừ", "Below withholding threshold") };
  const NHOM_HS_T = { khung_gio: () => L2("Khung giờ", "Time slot"), hinh_thuc: () => L2("Hình thức", "Mode"), loai_lop: () => L2("Loại lớp", "Class type") };
  const NGAY_T = { thuong: () => L2("Ngày thường", "Weekday"), nghi_tuan: () => L2("Ngày nghỉ hằng tuần", "Weekly day off"), le: () => L2("Ngày lễ, Tết", "Public holiday") };
  const TT_BUOI = { ke_hoach: () => L2("Chưa dạy", "Scheduled"), dang_day: () => L2("Đang dạy", "In progress"), xong: () => L2("Đã dạy", "Taught"),
    duyet: () => L2("Đã duyệt", "Approved"), huy: () => L2("Huỷ", "Cancelled") };
  const lopTT = { ke_hoach: "d-cho", dang_day: "n-canh", xong: "n-du", duyet: "d-duyet", huy: "d-huy" };
  const thuDep = (d) => new Date(d + "T00:00:00Z").toLocaleDateString(vung(), { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  let THANG_L = "";
  const oThang = (th) => `<label>${L2("Tháng", "Month")}</label><input type="month" id="thang-l" value="${th}">`;
  const ganThang = (ve) => { const o = $("#thang-l"); if (o) o.onchange = () => { THANG_L = o.value; ve(); }; };
  const nhanLuat = (l) => l && !l.chac ? `<p class="nho canh-chu">⚠ ${L2("Tham số thuế/BH áp dụng từ", "Tax/insurance parameters from")} ${h(l.tu)}
    (${h(l.nguon)}) ${L2("chưa được kế toán xác nhận — nhờ kế toán soát trước khi trả lương thật.", "not yet confirmed by an accountant — have it checked before real payroll.")}</p>` : "";

  // ---------- Bảng lương ----------
  async function veBangLuong() {
    const thang = THANG_L || homNay().slice(0, 7);
    khung("quan-ly", `<p class="trong">…</p>`);
    const { d } = await goi(`bang-luong?thang=${thang}`);
    if (!d || !d.ds) return;
    const csv = (k) => `/api/bang-luong.csv?thang=${thang}&kieu=${k}`;
    const nCanh = d.ds.filter((x) => x.canh_bao.length).length;
    khung("quan-ly", `<a href="#quan-ly">${t("quay_lai")}</a>
      <div class="the">${oThang(thang)}
        <p class="nho" style="margin:8px 0 0">${d.khoa ? `🔒 ${L2("Kỳ lương đã khoá lúc", "Payroll locked at")} ${new Date(d.khoa).toLocaleString(vung())}` : L2("Tạm tính — số còn đổi khi có thêm công, buổi dạy, làm thêm.", "Draft — figures change as attendance, lessons and overtime are added.")}</p>
        <div class="hang nut-nho"><a class="nut" href="${csv("dot1")}">⤓ ${L2("Đợt 1 (bảng BHXH)", "Run 1 (insurance sheet)")}</a>
          <a class="nut" href="${csv("tong")}">⤓ ${L2("Tổng hợp", "Summary")}</a>
          ${!TOI.gioi_han_pb ? `<button class="nut" id="day-lark">⇪ ${L2("Đẩy sang Lark", "Send to Lark")}</button>` : ""}
          ${!TOI.gioi_han_pb ? (d.khoa ? (TOI.vai === "chu" ? `<button class="nut" id="mo-khoa">${L2("Mở khoá", "Unlock")}</button>` : "")
            : `<button class="nut chinh" id="khoa">🔒 ${L2("Khoá kỳ lương", "Lock payroll")}</button>`) : ""}</div></div>
      ${nhanLuat(d.luat)}
      <div class="luoi">
        <div class="so"><b>${dong(d.tong.thuc_linh)}</b><span>${L2("Tổng thực lĩnh", "Total net pay")}</span></div>
        <div class="so"><b>${dong(d.tong.dot1)}</b><span>${L2("Đợt 1", "Run 1")}</span></div>
        <div class="so"><b>${dong(d.tong.dot2)}</b><span>${L2("Đợt 2", "Run 2")}</span></div>
        <div class="so"><b>${dong(d.tong.thue)}</b><span>${L2("Thuế TNCN khấu trừ", "PIT withheld")}</span></div>
        <div class="so"><b>${dong(d.tong.bh_cty)}</b><span>${L2("BH công ty đóng", "Employer insurance")}</span></div>
        <div class="so"><b>${dong(d.tong.chi_phi_cty)}</b><span>${L2("Tổng chi phí công ty", "Total company cost")}</span></div>
      </div>
      ${nCanh ? `<p class="nho canh-chu">⚠ ${nCanh} ${L2("người có cảnh báo — bấm vào dòng để xem.", "people have warnings — tap a row to see.")}</p>` : ""}
      <div class="the cuon"><table class="bang"><thead><tr><th>${t("ho_ten")}</th><th>${L2("Tổng thu nhập", "Gross")}</th><th>${L2("BH trừ lương", "Employee ins.")}</th>
        <th>${L2("Thuế", "PIT")}</th><th>${L2("Thực lĩnh", "Net")}</th><th>${L2("Đợt 1", "Run 1")}</th><th>${L2("Đợt 2", "Run 2")}</th><th>⚠</th></tr></thead>
        <tbody>${d.ds.map((x) => `<tr data-nv="${x.nv.id}"><td><b>${h(x.nv.ten)}</b><div class="phu">${x.dong.map((v) => h(v.ten_vai)).join(" + ")}</div></td>
          <td>${dong(x.tong_thu_nhap)}</td><td>${dong(x.bh_nld_tra)}</td><td>${dong(x.thue)}</td><td><b>${dong(x.thuc_linh)}</b></td>
          <td>${dong(x.dot1)}</td><td>${x.dot2 ? dong(x.dot2) : "—"}</td><td class="${x.canh_bao.length ? "c-canh" : ""}">${x.canh_bao.length || ""}</td></tr>`).join("")
          || `<tr><td colspan="8">${L2("Chưa ai có công việc & lương. Vào Quản lý → Nhân viên → mở một người → «💰 Công việc & lương».", "Nobody has a job & pay set. Go to Manage → Staff → open a person → “💰 Jobs & pay”.")}</td></tr>`}</tbody></table></div>`);
    ganThang(veBangLuong);
    $$("tr[data-nv]").forEach((tr) => tr.onclick = () => location.hash = `#phieu/${tr.dataset.nv}/${thang}`);
    $("#khoa")?.addEventListener("click", async () => {
      if (!confirm(L2("Khoá kỳ lương tháng này? Sau khi khoá, số liệu đứng yên và nhân viên xem được phiếu lương.", "Lock this month's payroll? Figures freeze and staff can see their payslips."))) return;
      const r = await goi("bang-luong/khoa", { thang }); if (r.s !== 200) return bao(tLoi(r.d.loi));
      if (r.d.lark && !r.d.lark.ok) alert(L2("Đã khoá, nhưng đẩy sang Lark lỗi: ", "Locked, but sending to Lark failed: ") + (r.d.lark.chi_tiet || r.d.lark.loi));
      else bao(r.d.lark ? L2(`Đã khoá · đã đẩy ${r.d.lark.ghi} dòng sang Lark`, `Locked · ${r.d.lark.ghi} rows sent to Lark`) : t("da_luu"));
      veBangLuong();
    });
    $("#day-lark")?.addEventListener("click", async (e) => {
      const nut = e.target; nut.disabled = true; nut.textContent = L2("Đang đẩy…", "Sending…");
      const r = await goi("bang-luong/day-lark", { thang });
      nut.disabled = false; nut.textContent = "⇪ " + L2("Đẩy sang Lark", "Send to Lark");
      if (r.s === 200) return bao(L2(`Đã đẩy sang Lark: Bảng lương ${r.d.ghi} dòng · Bảng công ${r.d.ghi_cong} dòng`, `Sent to Lark: payroll ${r.d.ghi} rows · timesheet ${r.d.ghi_cong} rows`));
      if (r.d.loi === "chua-noi-lark") { if (TOI.vai === "chu" && confirm(L2("Chưa nối Lark. Mở màn nối Lark?", "Lark isn't connected. Open Lark setup?"))) location.hash = "#noi-lark"; else bao(L2("Chưa nối Lark — nhờ chủ trung tâm nối.", "Lark not connected — ask the owner.")); return; }
      alert(L2("Lark báo lỗi: ", "Lark error: ") + (r.d.chi_tiet || r.d.loi));
    });
    $("#mo-khoa")?.addEventListener("click", async () => {
      if (!confirm(L2("Mở khoá để tính lại?", "Unlock to recalculate?"))) return;
      await goi("bang-luong/mo-khoa", { thang }); veBangLuong();
    });
  }

  // ---------- Phiếu lương (dùng chung quản lý + nhân viên) ----------
  function phieuHtml(x, thang) {
    const hang = (a, b, dam) => `<li><span>${a}</span><span class="phai">${dam ? `<b>${b}</b>` : b}</span></li>`;
    return `<div class="the"><h2 style="margin:0">${h(x.nv.ten)}</h2><p class="nho" style="margin:2px 0 0">${L2("Phiếu lương", "Payslip")} ${h(thang)}${x.nv.ma_nv ? " · " + h(x.nv.ma_nv) : ""}</p></div>
      ${x.dong.map((v) => `<div class="the"><div class="hang-giua"><h2 style="margin:0">${h(v.ten_vai)}</h2><span class="nhan">${CT[v.cach_tinh]()}</span></div>
        <ul class="ds gon">${hang(v.cach_tinh === "gio" ? L2("Tiền dạy", "Teaching pay") : L2("Lương", "Base pay"), dong(v.co_ban))}
          <li><span class="nho">${h(v.chi_tiet)}</span></li>
          ${v.lam_them ? hang(L2("Làm thêm giờ", "Overtime"), dong(v.lam_them)) : ""}
          ${v.phu_cap ? hang(L2("Phụ cấp", "Allowances"), dong(v.phu_cap)) : ""}
          ${hang(L2("Cộng", "Subtotal"), dong(v.tong), 1)}</ul>
        ${v.buoi && v.buoi.length ? `<details><summary class="nho">${v.buoi.length} ${L2("buổi dạy", "lessons")}</summary><ul class="ds gon">${v.buoi.map((b) =>
          `<li><span>${thuDep(b.ngay)} ${h(b.gio_bd)}–${h(b.gio_kt)} · ${h(b.lop)} ${b.hinh_thuc === "online" ? "🌐" : ""}</span><span class="phai">${b.so_gio}h × ${b.he_so} = ${dong(b.tien)}</span></li>`).join("")}</ul></details>` : ""}</div>`).join("")}
      <div class="the"><ul class="ds gon">
        ${hang(L2("Tổng thu nhập", "Gross income"), dong(x.tong_thu_nhap), 1)}
        ${x.luong_bh ? hang(L2("Lương đóng BH", "Insurance base"), dong(x.luong_bh)) : ""}
        ${x.luong_bh ? hang(`− BHXH 8% · BHYT 1,5% · BHTN 1%${x.bh_cty_dong_thay ? L2(" (công ty đóng thay)", " (paid by company)") : ""}`, x.bh_cty_dong_thay ? "0" : "− " + dong(x.bh_nld.cong)) : ""}
        ${hang(`− ${L2("Thuế TNCN", "PIT")} · ${(THUE_T[x.cach_thue] || THUE_T.khong)()}`, x.thue ? "− " + dong(x.thue) : "0")}
        ${x.cach_thue === "luy_tien" ? `<li><span class="nho">${L2("Thu nhập chịu thuế", "Taxable")} ${dong(x.tn_chiu_thue)}${x.mien_thue ? ` (${L2("đã trừ khoán", "excl. allowances")} ${dong(x.mien_thue)})` : ""} · ${L2("giảm trừ", "deductions")} ${dong(x.giam_tru)} · ${L2("tính thuế", "assessable")} ${dong(x.tn_tinh_thue)}</span></li>` : ""}
        ${hang(L2("THỰC LĨNH", "NET PAY"), dong(x.thuc_linh), 1)}
        ${hang(L2("Đợt 1 (bảng BHXH)", "Run 1 (insurance sheet)"), dong(x.dot1))}
        ${x.dot2 ? hang(L2("Đợt 2", "Run 2"), dong(x.dot2)) : ""}</ul></div>
      ${x.canh_bao.length ? `<div class="the">${x.canh_bao.map((c) => `<p class="nho canh-chu" style="margin:4px 0">⚠ ${h(c.chu)}</p>`).join("")}</div>` : ""}`;
  }
  async function vePhieuQuanLy(nvId, thang) {
    khung("quan-ly", `<p class="trong">…</p>`);
    const { d } = await goi(`bang-luong?thang=${thang}`);
    const x = d && d.ds && d.ds.find((y) => y.nv.id === nvId);
    khung("quan-ly", `<a href="#bang-luong">${t("quay_lai")}</a>${x ? phieuHtml(x, thang) + `
      ${laQuanTri() ? `<div class="the"><p class="nho" style="margin:0">${L2("BH công ty đóng", "Employer insurance")}: ${dong(x.bh_cty.cong + x.bh_cty_dong_thay)} · KPCĐ ${dong(x.kpcd)} ·
        ${L2("Chi phí công ty", "Company cost")}: <b>${dong(x.chi_phi_cty)}</b></p>
        <a class="nut" style="margin-top:10px" href="#luong-nv/${nvId}">💰 ${L2("Sửa công việc & lương", "Edit jobs & pay")}</a></div>` : ""}` : `<p class="trong">${t("khong_co_du_lieu")}</p>`}`);
  }
  async function vePhieuCuaToi() {
    const thang = THANG_L || homNay().slice(0, 7);
    khung(laQuanTri() ? "quan-ly" : "toi", `<p class="trong">…</p>`);
    const { d } = await goi(`phieu-luong?thang=${thang}`);
    khung(laQuanTri() ? "quan-ly" : "toi", `<a href="#toi">${t("quay_lai")}</a><div class="the">${oThang(thang)}</div>
      ${d && d.phieu ? phieuHtml(d.phieu, thang) : `<p class="trong">${L2("Phiếu lương tháng này chưa chốt.", "This month's payslip isn't final yet.")}</p>`}`);
    ganThang(vePhieuCuaToi);
  }

  // ---------- Công việc & lương của một người ----------
  async function veLuongNv(nvId) {
    khung("quan-ly", `<p class="trong">…</p>`);
    const [cv, tl] = await Promise.all([goi(`nv/${nvId}/cong-viec`), goi("luong/thiet-lap")]);
    if (cv.s !== 200) return khung("quan-ly", `<p class="trong">${tLoi(cv.d.loi)}</p>`);
    const KT = tl.d.kieu_thue, BG = tl.d.bac_gv;
    const ktCua = (id) => KT.find((k) => k.id === id) || KT[0];
    const so$ = (n, v) => `<input type="text" inputmode="numeric" name="${n}" value="${v == null ? "" : v}">`;
    const form = (x = {}) => {
      const kt = ktCua(x.kieu_thue_id);
      return `<form class="fcv" data-id="${x.id || ""}">
      <label>${L2("Tên công việc", "Job title")}</label><input type="text" name="ten_vai" value="${h(x.ten_vai || "")}" placeholder="${h(L2("VD: Giáo viên IELTS / Hành chính", "e.g. IELTS teacher / Admin"))}" required>
      <label>${L2("Kiểu thuê", "Employment type")}</label><select name="kieu_thue_id">${KT.map((k) => `<option value="${k.id}" ${kt && kt.id === k.id ? "selected" : ""}>${h(k.ten)}</option>`).join("")}</select>
      <p class="nho mo-ta-kt" style="margin:4px 0 0"></p>
      <div class="o-thang"><label class="nhan-thang">${L2("Lương tháng theo HĐ (đồng)", "Monthly salary (VND)")}</label>${so$("luong_thang", x.luong_thang)}</div>
      <div class="o-gio hang"><div><label>${L2("Bậc giáo viên", "Teacher grade")}</label><select name="bac_gv_id"><option value="">—</option>${BG.map((b) => `<option value="${b.id}" ${x.bac_gv_id === b.id ? "selected" : ""}>${h(b.ten)} · ${dong(b.don_gia)}</option>`).join("")}</select></div>
        <div><label>${L2("Hoặc đơn giá riêng/giờ", "Or own hourly rate")}</label>${so$("don_gia_rieng", x.don_gia_rieng)}</div></div>
      <div class="o-bh"><div class="hang"><div><label>${L2("Lương đóng BH (để trống = lương HĐ)", "Insurance base (blank = salary)")}</label>${so$("luong_bh", x.luong_bh)}</div></div>
        <label class="tick"><input type="checkbox" name="bh_cty_chiu_het" ${x.bh_cty_chiu_het ? "checked" : ""}><span>${L2("Công ty chịu luôn 10,5% phần của người lao động (tổng 32%)", "Company also pays the employee's 10.5% (32% total)")}</span></label></div>
      <details ${x.pc_dt || x.pc_xang || x.pc_nha || x.pc_khac ? "open" : ""}><summary class="nho">${L2("Phụ cấp hằng tháng", "Monthly allowances")}</summary>
        <div class="hang"><div><label>${L2("Điện thoại", "Phone")}</label>${so$("pc_dt", x.pc_dt || "")}</div><div><label>${L2("Xăng xe", "Fuel")}</label>${so$("pc_xang", x.pc_xang || "")}</div></div>
        <div class="hang"><div><label>${L2("Nhà ở", "Housing")}</label>${so$("pc_nha", x.pc_nha || "")}</div><div><label>${L2("Khác", "Other")}</label>${so$("pc_khac", x.pc_khac || "")}</div></div>
        <label class="tick"><input type="checkbox" name="pc_mien_thue" ${x.pc_mien_thue ? "checked" : ""}><span>${L2("Điện thoại, xăng xe là khoán chi theo quy chế công ty (không chịu thuế TNCN)", "Phone & fuel are lump-sum per company policy (PIT-exempt)")}</span></label></details>
      <div class="loi"></div><div class="hang"><button class="nut chinh" type="submit">${t("luu")}</button>${x.id ? `<button class="nut do" type="button" data-xoa>${t("xoa")}</button>` : ""}</div></form>`;
    };
    khung("quan-ly", `<a href="#nhan-vien">${t("quay_lai")}</a>
      <div class="the"><h2 style="margin:0">💰 ${h(cv.d.nv.ten)}</h2><p class="nho" style="margin:4px 0 0">${L2("Một người có thể có nhiều công việc (vd hành chính + dạy buổi tối). Mỗi công việc tính tiền riêng, thuế TNCN gộp lại.", "One person can hold several jobs (e.g. admin + evening teaching). Each is paid separately; PIT is combined.")}</p></div>
      ${cv.d.ds.map((x) => `<div class="the">${form(x)}</div>`).join("")}
      <details class="the" ${cv.d.ds.length ? "" : "open"}><summary><b>+ ${L2("Thêm công việc", "Add a job")}</b></summary>${form()}</details>
      <form class="the" id="fthue"><h2>${L2("Thuế & giấy tờ", "Tax & documents")}</h2>
        <div class="hang"><div><label>${L2("Số người phụ thuộc", "Dependants")}</label><input type="number" name="so_phu_thuoc" min="0" max="20" value="${cv.d.nv.so_phu_thuoc}"></div>
          <div><label>${L2("Hạn giấy phép lao động (GV nước ngoài)", "Work permit expiry (foreign teachers)")}</label><input type="date" name="gpld_het" value="${h(cv.d.nv.gpld_het)}"></div></div>
        <button class="nut chinh rong" type="submit">${t("luu")}</button></form>`);
    $$(".fcv").forEach((f) => {
      const dongBo = () => {
        const kt = ktCua(f.kieu_thue_id.value);
        f.querySelector(".o-thang").hidden = kt.cach_tinh === "gio";
        f.querySelector(".nhan-thang").textContent = kt.cach_tinh === "khoan" ? L2("Tiền khoán mỗi tháng (đồng)", "Monthly fixed fee (VND)") : L2("Lương tháng theo HĐ (đồng)", "Monthly salary (VND)");
        f.querySelector(".o-gio").hidden = kt.cach_tinh !== "gio";
        f.querySelector(".o-bh").hidden = !kt.dong_bh;
        f.querySelector(".mo-ta-kt").textContent = `${CT[kt.cach_tinh]()} · ${kt.dong_bh ? L2("có đóng BH", "insured") : L2("không đóng BH", "not insured")} · ${L2("thuế", "tax")}: ${THUE_T[kt.thue]()}`;
      };
      f.kieu_thue_id.onchange = dongBo; dongBo();
      f.onsubmit = async (e) => {
        e.preventDefault();
        const than = Object.fromEntries(new FormData(f));
        for (const k of ["bh_cty_chiu_het", "pc_mien_thue"]) than[k] = f[k].checked;
        const r = await goi(f.dataset.id ? `nv/${nvId}/cong-viec/${f.dataset.id}/sua` : `nv/${nvId}/cong-viec`, than);
        if (r.s !== 200) { f.querySelector(".loi").textContent = tLoi(r.d.loi); return; }
        bao(t("da_luu")); veLuongNv(nvId);
      };
      f.querySelector("[data-xoa]")?.addEventListener("click", async () => {
        if (!confirm(t("xac_nhan_xoa"))) return;
        await goi(`nv/${nvId}/cong-viec/${f.dataset.id}/xoa`, {}); veLuongNv(nvId);
      });
    });
    $("#fthue").onsubmit = async (e) => { e.preventDefault(); const r = await goi(`nv/${nvId}/thue`, Object.fromEntries(new FormData(e.target))); bao(r.s === 200 ? t("da_luu") : tLoi(r.d.loi)); };
  }

  // ---------- Thiết lập lương: kiểu thuê · bậc giáo viên · hệ số ----------
  async function veThietLapLuong() {
    khung("quan-ly", `<p class="trong">…</p>`);
    const { d } = await goi("luong/thiet-lap");
    if (!d || !d.kieu_thue) return;
    const thu = t("thu_ngan");
    const fKt = (k = { cach_tinh: "gio", dong_bh: 0, thue: "khau_tru" }) => `<form class="ftl" data-loai="kieu-thue" data-id="${k.id || ""}">
      <input type="text" name="ten" value="${h(k.ten || "")}" placeholder="${h(L2("Tên kiểu thuê", "Type name"))}" required>
      <div class="hang"><select name="cach_tinh">${Object.keys(CT).map((c) => `<option value="${c}" ${k.cach_tinh === c ? "selected" : ""}>${CT[c]()}</option>`).join("")}</select>
        <select name="thue">${["luy_tien", "khau_tru", "khong_cu_tru", "khong"].map((c) => `<option value="${c}" ${k.thue === c ? "selected" : ""}>${THUE_T[c]()}</option>`).join("")}</select></div>
      <label class="tick"><input type="checkbox" name="dong_bh" ${k.dong_bh ? "checked" : ""}><span>${L2("Đóng BHXH bắt buộc", "Compulsory social insurance")}</span></label>
      <div class="loi"></div><div class="hang nut-nho"><button class="nut chinh" type="submit">${t("luu")}</button>${k.id ? `<button class="nut do" type="button" data-xoa>${t("xoa")}</button>` : ""}</div></form>`;
    const fBg = (b = {}) => `<form class="ftl hang" data-loai="bac-gv" data-id="${b.id || ""}" style="align-items:end">
      <div style="flex:2"><input type="text" name="ten" value="${h(b.ten || "")}" placeholder="${h(L2("Tên bậc", "Grade"))}" required></div>
      <div><input type="text" inputmode="numeric" name="don_gia" value="${b.don_gia ?? ""}" placeholder="${h(L2("đ/giờ", "VND/h"))}"></div>
      <button class="nut chinh" type="submit" style="flex:0 0 auto">${t("luu")}</button>${b.id ? `<button class="nut do" type="button" data-xoa style="flex:0 0 auto">✕</button>` : ""}<div class="loi"></div></form>`;
    const fHs = (x) => `<form class="ftl" data-loai="he-so" data-id="${x.id || ""}"><input type="hidden" name="nhom" value="${x.nhom}">
      <div class="hang"><div style="flex:2"><input type="text" name="ten" value="${h(x.ten || "")}" placeholder="${h(L2("Tên", "Name"))}" required ${x.nhom === "hinh_thuc" ? "readonly" : ""}></div>
        <div><input type="number" step="0.05" min="0" max="10" name="gia_tri" value="${x.gia_tri ?? 1}"></div></div>
      ${x.nhom === "khung_gio" ? `<div class="hang"><div><label>${L2("Bắt đầu từ", "Starting from")}</label><input type="time" name="gio_tu" value="${h(x.gio_tu || "18:00")}"></div>
        <div><label>${L2("đến", "to")}</label><input type="time" name="gio_den" value="${h(x.gio_den || "23:59")}"></div></div>
        <div class="chips">${[1, 2, 3, 4, 5, 6, 0].map((i) => `<label class="chip-tick"><input type="checkbox" name="thu" value="${i}" ${String(x.thu || "").split(",").includes(String(i)) ? "checked" : ""}><span>${thu[i]}</span></label>`).join("")}</div>` : ""}
      <div class="loi"></div><div class="hang nut-nho"><button class="nut chinh" type="submit">${t("luu")}</button>${x.id && x.nhom !== "hinh_thuc" ? `<button class="nut do" type="button" data-xoa>${t("xoa")}</button>` : ""}</div></form>`;
    const hs = (n) => d.he_so.filter((x) => x.nhom === n);
    khung("quan-ly", `<a href="#quan-ly">${t("quay_lai")}</a>
      <div class="the"><h2>${L2("Kiểu thuê", "Employment types")}</h2><p class="nho">${L2("Kiểu thuê quyết định: tính tiền theo tháng/giờ/khoán, có đóng BH không, khấu trừ thuế cách nào.", "The type decides: monthly/hourly/fixed pay, insured or not, and how tax is withheld.")}</p>
        ${d.kieu_thue.map((k) => `<div class="khoi-tl">${fKt(k)}</div>`).join("")}<details><summary><b>+ ${L2("Thêm kiểu thuê", "Add type")}</b></summary>${fKt()}</details></div>
      <div class="the"><h2>${L2("Bậc giáo viên & đơn giá giờ", "Teacher grades & hourly rates")}</h2>
        ${d.bac_gv.map((b) => fBg(b)).join("")}<details><summary><b>+ ${L2("Thêm bậc", "Add grade")}</b></summary>${fBg()}</details></div>
      ${["khung_gio", "hinh_thuc", "loai_lop"].map((n) => `<div class="the"><h2>${L2("Hệ số", "Multiplier")} · ${NHOM_HS_T[n]()}</h2>
        <p class="nho">${n === "khung_gio" ? L2("Buổi bắt đầu trong khung giờ + đúng thứ thì nhân hệ số. Khớp nhiều khung thì lấy hệ số lớn nhất.", "Lessons starting in the slot on those days get the multiplier. If several match, the largest wins.")
          : n === "hinh_thuc" ? L2("Online / offline.", "Online / offline.") : L2("Mỗi loại lớp một hệ số.", "One multiplier per class type.")}</p>
        ${hs(n).map((x) => `<div class="khoi-tl">${fHs(x)}</div>`).join("")}
        ${n !== "hinh_thuc" ? `<details><summary><b>+ ${L2("Thêm", "Add")}</b></summary>${fHs({ nhom: n })}</details>` : ""}</div>`).join("")}
      <div class="the"><h2>${L2("Tham số luật đang dùng", "Legal parameters in use")}</h2><ul class="ds gon">
        <li><span>${L2("BH người lao động", "Employee insurance")}</span><span class="phai">10,5%</span></li>
        <li><span>${L2("BH công ty", "Employer insurance")}</span><span class="phai">21,5% + KPCĐ 2%</span></li>
        <li><span>${L2("Giảm trừ bản thân / người phụ thuộc", "Personal / dependant deduction")}</span><span class="phai">${dong(d.luat.giam_tru_ban_than)} / ${dong(d.luat.giam_tru_phu_thuoc)}</span></li>
        <li><span>${L2("Ngưỡng khấu trừ 10% mỗi lần trả", "10% withholding threshold per payment")}</span><span class="phai">${dong(d.luat.nguong_khau_tru)}</span></li>
        <li><span>${L2("Làm thêm tối thiểu: thường / nghỉ tuần / lễ", "OT minimum: weekday / rest day / holiday")}</span><span class="phai">150% / 200% / 300%</span></li></ul>
        ${nhanLuat(d.luat)}</div>`);
    $$(".ftl").forEach((f) => {
      f.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(f), than = Object.fromEntries(fd);
        if (f.dong_bh) than.dong_bh = f.dong_bh.checked;
        if (f.querySelector("[name=thu]")) than.thu = fd.getAll("thu").join(",");
        const r = await goi(`luong/${f.dataset.loai}${f.dataset.id ? `/${f.dataset.id}/sua` : ""}`, than);
        if (r.s !== 200) { f.querySelector(".loi").textContent = tLoi(r.d.loi); return; }
        bao(t("da_luu")); if (!f.dataset.id) veThietLapLuong();
      };
      f.querySelector("[data-xoa]")?.addEventListener("click", async () => {
        if (!confirm(t("xac_nhan_xoa"))) return;
        const r = await goi(`luong/${f.dataset.loai}/${f.dataset.id}/xoa`, {});
        if (r.s !== 200) return bao(r.d.loi === "dang-dung" ? L2("Đang có người dùng kiểu thuê này.", "This type is in use.") : tLoi(r.d.loi));
        veThietLapLuong();
      });
    });
  }

  // ---------- Buổi dạy (quản lý xếp lịch, duyệt) ----------
  const formBuoi = (gv, loaiLop, dds, cvs) => `<form id="fbuoi">
    ${gv ? `<label>${L2("Giáo viên", "Teacher")}</label><select name="gv">${gv.map((g) => `<option value="${g.id}|${g.cv_id}">${h(g.ten)} · ${h(g.ten_vai)}</option>`).join("")}</select>`
      : cvs.length > 1 ? `<label>${L2("Công việc", "Job")}</label><select name="cv_id">${cvs.map((c) => `<option value="${c.id}">${h(c.ten_vai)}</option>`).join("")}</select>` : `<input type="hidden" name="cv_id" value="${cvs[0]?.id || ""}">`}
    <div class="hang"><div><label>${L2("Lớp", "Class")}</label><input type="text" name="lop" placeholder="IELTS 6.5 – A1"></div>
      <div><label>${L2("Loại lớp", "Class type")}</label><select name="loai_lop_id"><option value="">—</option>${loaiLop.map((x) => `<option value="${x.id}">${h(x.ten)}</option>`).join("")}</select></div></div>
    <div class="hang"><div><label>${L2("Ngày", "Date")}</label><input type="date" name="ngay" value="${homNay()}" required></div>
      <div><label>${L2("Từ", "From")}</label><input type="time" name="gio_bd" value="18:00" required></div><div><label>${L2("Đến", "To")}</label><input type="time" name="gio_kt" value="19:30" required></div></div>
    <div class="hang"><div><label>${L2("Hình thức", "Mode")}</label><select name="hinh_thuc"><option value="offline">Offline</option><option value="online">Online</option></select></div>
      <div class="o-cs"><label>${L2("Cơ sở dạy", "Teaching site")}</label><select name="dia_diem_id">${dds.map((x) => `<option value="${x.id}">${h(x.ten)}</option>`).join("")}</select></div></div>
    ${gv ? `<label>${L2("Lặp hằng tuần tới ngày (tuỳ chọn)", "Repeat weekly until (optional)")}</label><input type="date" name="lap_den">` : ""}
    <div class="loi"></div><button class="nut chinh rong" type="submit">${L2("Thêm buổi", "Add lesson")}</button></form>`;
  const ganFormBuoi = (gui) => {
    const f = $("#fbuoi"); if (!f) return;
    const dongBo = () => { f.querySelector(".o-cs").hidden = f.hinh_thuc.value === "online"; };
    f.hinh_thuc.onchange = dongBo; dongBo();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const than = Object.fromEntries(new FormData(f));
      if (than.gv) { [than.nv_id, than.cv_id] = than.gv.split("|"); delete than.gv; }
      const r = await gui(than);
      if (r.s !== 200) { f.querySelector(".loi").textContent = tLoi(r.d.loi); return; }
      bao(`${t("da_luu")}${r.d.so > 1 ? ` · ${r.d.so} ${L2("buổi", "lessons")}` : ""}`);
      return true;
    };
  };
  async function veBuoiDay() {
    const thang = THANG_L || homNay().slice(0, 7);
    khung("quan-ly", `<p class="trong">…</p>`);
    const [{ d }, dd] = await Promise.all([goi(`buoi-day?thang=${thang}`), goi("dia-diem")]);
    if (!d || !d.ds) return;
    const theoNgay = new Map(); for (const b of d.ds) { if (!theoNgay.has(b.ngay)) theoNgay.set(b.ngay, []); theoNgay.get(b.ngay).push(b); }
    const daDay = d.ds.filter((b) => b.trang_thai === "xong" || b.trang_thai === "duyet");
    khung("quan-ly", `<a href="#quan-ly">${t("quay_lai")}</a>
      <div class="the">${oThang(thang)}</div>
      <div class="luoi"><div class="so"><b>${d.ds.filter((b) => b.trang_thai !== "huy").length}</b><span>${L2("Buổi trong tháng", "Lessons this month")}</span></div>
        <div class="so"><b>${so(daDay.reduce((s, b) => s + b.so_gio, 0))}</b><span>${L2("Giờ đã dạy", "Hours taught")}</span></div>
        <div class="so"><b>${d.ds.filter((b) => b.trang_thai === "ke_hoach" && b.ngay < homNay()).length}</b><span>${L2("Đã qua, chưa xác nhận", "Past, unconfirmed")}</span></div></div>
      <details class="the" ${d.giao_vien.length ? "" : "open"}><summary><b>+ ${L2("Xếp buổi dạy", "Schedule a lesson")}</b></summary>
        ${d.giao_vien.length ? formBuoi(d.giao_vien, d.loai_lop, dd.d.ds || [], []) : `<p class="nho">${L2("Chưa có giáo viên lương giờ. Thêm công việc kiểu «lương giờ» cho giáo viên trước.", "No hourly teachers yet. Add an hourly job to a teacher first.")}</p>`}</details>
      ${[...theoNgay.entries()].map(([ngay, ds]) => `<div class="the"><h2 style="margin:0 0 6px">${thuDep(ngay)}</h2><ul class="ds">${ds.map((b) => `<li class="cot-don" data-b="${b.id}">
        <div class="hang-giua"><div><div class="ten">${h(b.gio_bd)}–${h(b.gio_kt)} · ${h(b.nv_ten)}</div>
          <div class="phu">${h(b.lop || "—")} · ${b.hinh_thuc === "online" ? "🌐 Online" : "📍 " + h(b.dia_diem || "")} · ${b.so_gio}h × ${b.he_so}${b.tao_boi_gv ? ` · ${L2("GV tự thêm", "added by teacher")}` : ""}
          ${b.cach_met != null ? ` · ${b.cach_met} m` : ""} ${b.canh_bao.map((c) => `<span class="nhan n-canh">⚠ ${h(c)}</span>`).join(" ")}</div></div>
          <div class="phai"><span class="nhan ${lopTT[b.trang_thai]}">${TT_BUOI[b.trang_thai]()}</span></div></div>
        <div class="hang nut-nho">${b.trang_thai === "xong" || (b.trang_thai === "ke_hoach" && b.ngay <= homNay()) ? `<button class="nut chinh" data-v="duyet">✓ ${L2("Duyệt đã dạy", "Approve")}</button>` : ""}
          ${b.trang_thai !== "huy" && b.trang_thai !== "duyet" ? `<button class="nut" data-v="huy">${L2("Huỷ buổi", "Cancel")}</button>` : ""}
          ${b.trang_thai === "huy" || b.trang_thai === "duyet" ? `<button class="nut" data-v="mo-lai">${L2("Mở lại", "Reopen")}</button>` : ""}</div></li>`).join("")}</ul></div>`).join("")
        || `<p class="trong">${L2("Tháng này chưa có buổi dạy.", "No lessons this month.")}</p>`}`);
    ganThang(veBuoiDay);
    ganFormBuoi(async (than) => { const r = await goi("buoi-day", than); if (r.s === 200) setTimeout(veBuoiDay, 300); return r; });
    $$("li[data-b] [data-v]").forEach((b) => b.onclick = async () => {
      const r = await goi(`buoi-day/${b.closest("li").dataset.b}/${b.dataset.v}`, {});
      if (r.s !== 200) return bao(r.d.loi === "ky-da-khoa" ? L2("Kỳ lương tháng này đã khoá.", "Payroll for this month is locked.") : tLoi(r.d.loi));
      veBuoiDay();
    });
  }

  // ---------- Màn «Dạy» của giáo viên ----------
  async function veDay() {
    khung("day", `<p class="trong">…</p>`);
    const [{ d }, cv] = await Promise.all([goi("day/cua-toi"), goi("luong/cua-toi")]);
    if (!d || !d.ds) return;
    const cvs = (cv.d.cong_viec || []).filter((x) => x.cach_tinh === "gio");
    const hom = d.ds.filter((b) => b.ngay === d.hom_nay && b.trang_thai !== "huy");
    const sap = d.ds.filter((b) => b.ngay > d.hom_nay && b.trang_thai !== "huy");
    const qua = d.ds.filter((b) => b.ngay < d.hom_nay).reverse();
    const the = (b, coNut) => `<li class="cot-don" data-b="${b.id}"><div class="hang-giua"><div>
      <div class="ten">${coNut ? "" : thuDep(b.ngay) + " · "}${h(b.gio_bd)}–${h(b.gio_kt)} · ${h(b.lop || "—")}</div>
      <div class="phu">${b.hinh_thuc === "online" ? "🌐 Online" : "📍 " + h(b.dia_diem || "")} · ${b.so_gio}h</div></div>
      <div class="phai"><span class="nhan ${lopTT[b.trang_thai]}">${TT_BUOI[b.trang_thai]()}</span></div></div>
      ${coNut && b.trang_thai === "ke_hoach" ? `<button class="nut-cham vao" data-v="bat-dau" style="margin-top:10px">▶ ${L2("BẮT ĐẦU BUỔI", "START LESSON")}</button>` : ""}
      ${coNut && b.trang_thai === "dang_day" ? `<button class="nut-cham ra" data-v="ket-thuc" style="margin-top:10px">■ ${L2("KẾT THÚC BUỔI", "END LESSON")}</button>` : ""}</li>`;
    khung("day", `<div class="the"><h2 style="margin:0">📚 ${L2("Hôm nay", "Today")}</h2>
        ${hom.length ? `<ul class="ds">${hom.map((b) => the(b, true)).join("")}</ul>` : `<p class="nho">${L2("Hôm nay không có buổi dạy.", "No lessons today.")}</p>`}
        <p class="nho">${L2("Buổi offline: app lấy vị trí để xác nhận bạn đang ở đúng cơ sở của buổi đó (kể cả dạy ở cơ sở khác). Buổi online không cần vị trí.", "Offline lessons: the app checks your location against that lesson's site (including other sites). Online lessons need no location.")}</p></div>
      ${sap.length ? `<div class="the"><h2 style="margin:0">${L2("Sắp tới", "Upcoming")}</h2><ul class="ds">${sap.map((b) => the(b)).join("")}</ul></div>` : ""}
      ${cvs.length ? `<details class="the"><summary><b>+ ${L2("Thêm buổi dạy phát sinh", "Add an extra lesson")}</b></summary><p class="nho">${L2("Quản lý sẽ duyệt buổi bạn tự thêm.", "Your manager approves lessons you add.")}</p>
        ${formBuoi(null, cv.d.loai_lop || [], cv.d.dia_diem || [], cvs)}</details>` : ""}
      ${qua.length ? `<div class="the"><h2 style="margin:0">${L2("7 ngày qua", "Last 7 days")}</h2><ul class="ds">${qua.map((b) => the(b)).join("")}</ul></div>` : ""}`);
    ganFormBuoi(async (than) => { const r = await goi("day", than); if (r.s === 200) setTimeout(veDay, 300); return r; });
    $$("li[data-b] [data-v]").forEach((nut) => nut.onclick = async () => {
      const li = nut.closest("li"), b = d.ds.find((x) => x.id === li.dataset.b);
      nut.disabled = true; nut.textContent = L2("Đang lấy vị trí…", "Getting location…");
      let than = {};
      if (b.hinh_thuc === "offline") {
        const vt = await layViTri();
        if (!vt) { bao(t("can_vi_tri")); return veDay(); }
        than = vt;
      }
      const r = await goi(`day/${b.id}/${nut.dataset.v}`, than);
      if (r.s !== 200) {
        if (r.d.loi === "ngoai-vung") alert(L2(`Bạn đang cách ${r.d.co_so} ${r.d.cach_met} m (cho phép ${r.d.ban_kinh} m). Hãy tới đúng cơ sở rồi bấm lại.`, `You are ${r.d.cach_met} m from ${r.d.co_so} (allowed ${r.d.ban_kinh} m). Go to the site and try again.`));
        else bao(r.d.loi === "khong-phai-hom-nay" ? L2("Chỉ bắt đầu được buổi của hôm nay.", "You can only start today's lessons.") : tLoi(r.d.loi));
      } else bao(nut.dataset.v === "bat-dau" ? L2("Đã bắt đầu buổi.", "Lesson started.") : L2("Đã kết thúc buổi.", "Lesson ended."));
      veDay();
    });
  }

  // ---------- Làm thêm giờ ----------
  async function veLamThem() {
    const qt = laQuanTri(), thang = THANG_L || homNay().slice(0, 7);
    khung(qt ? "quan-ly" : "toi", `<p class="trong">…</p>`);
    const [cua, tat, cv] = await Promise.all([goi("lam-them/cua-toi"), qt ? goi(`lam-them?thang=${thang}`) : Promise.resolve(null), goi("luong/cua-toi")]);
    const cvs = cv.d.cong_viec || [];
    const ttL = { cho: L2("Chờ duyệt", "Pending"), duyet: L2("Đã duyệt", "Approved"), tu_choi: L2("Từ chối", "Rejected") };
    const lopL = { cho: "d-cho", duyet: "d-duyet", tu_choi: "d-tu_choi" };
    const dongLt = (x, duyet) => `<li class="cot-don" data-lt="${x.id}"><div class="hang-giua"><div>
      <div class="ten">${duyet ? h(x.nv_ten) + " · " : ""}${thuDep(x.ngay)} · ${so(x.so_gio)} ${L2("giờ", "h")}</div>
      <div class="phu">${h(x.ten_vai || "")} · ${NGAY_T[x.loai_ngay]()} · ${h(x.ly_do)}${x.he_so ? ` · ${L2("hệ số", "rate")} ${x.he_so}` : ""}</div></div>
      <div class="phai"><span class="nhan ${lopL[x.trang_thai]}">${ttL[x.trang_thai]}</span></div></div>
      ${duyet && x.trang_thai === "cho" ? `<div class="hang nut-nho">${tat.d.he_so.map((hs) => `<button class="nut ${hs >= (tat.d.toi_thieu[x.loai_ngay] || 1.5) ? "" : "canh-chu"}" data-hs="${hs}" title="${hs < (tat.d.toi_thieu[x.loai_ngay] || 1.5) ? h(L2("Thấp hơn mức luật", "Below legal minimum")) : ""}">× ${hs}</button>`).join("")}
        <button class="nut do" data-tc>${L2("Từ chối", "Reject")}</button></div>
        <p class="nho" style="margin:4px 0 0">${L2("Luật tối thiểu cho", "Legal minimum for")} ${NGAY_T[x.loai_ngay]()}: × ${tat.d.toi_thieu[x.loai_ngay]}</p>` : ""}
      ${!duyet && x.trang_thai === "cho" ? `<button class="nut" data-huy style="margin-top:6px">${t("huy")}</button>` : ""}</li>`;
    khung(qt ? "quan-ly" : "toi", `<a href="#${qt ? "quan-ly" : "toi"}">${t("quay_lai")}</a>
      ${cvs.length ? `<details class="the"><summary><b>+ ${L2("Đăng ký làm thêm giờ", "Request overtime")}</b></summary><form id="flt">
        ${cvs.length > 1 ? `<label>${L2("Công việc", "Job")}</label><select name="cv_id">${cvs.map((c) => `<option value="${c.id}">${h(c.ten_vai)}</option>`).join("")}</select>` : `<input type="hidden" name="cv_id" value="${cvs[0].id}">`}
        <div class="hang"><div><label>${L2("Ngày", "Date")}</label><input type="date" name="ngay" value="${homNay()}" required></div>
          <div><label>${L2("Số giờ", "Hours")}</label><input type="number" name="so_gio" step="0.25" min="0.25" max="12" value="2" required></div></div>
        <label>${L2("Loại ngày", "Day type")}</label><select name="loai_ngay">${Object.keys(NGAY_T).map((k) => `<option value="${k}">${NGAY_T[k]()}</option>`).join("")}</select>
        <label>${L2("Lý do", "Reason")}</label><input type="text" name="ly_do" required>
        <div class="loi"></div><button class="nut chinh rong" type="submit">${L2("Gửi", "Send")}</button></form></details>` : ""}
      ${qt ? `<div class="the">${oThang(thang)}</div><div class="the"><h2 style="margin:0">${L2("Đơn làm thêm cần duyệt", "Overtime to review")}</h2>
        <p class="nho">${L2("Chọn hệ số khi duyệt: 1 · 1,5 · 2 · 3. Nút vàng là thấp hơn mức luật cho loại ngày đó.", "Pick a rate when approving: 1 · 1.5 · 2 · 3. Yellow buttons are below the legal minimum for that day type.")}</p>
        <ul class="ds">${tat.d.ds.map((x) => dongLt(x, true)).join("") || `<li>${t("khong_co_du_lieu")}</li>`}</ul></div>` : ""}
      <div class="the"><h2 style="margin:0">${L2("Của tôi", "Mine")}</h2><ul class="ds">${(cua.d.ds || []).map((x) => dongLt(x, false)).join("") || `<li>${t("khong_co_du_lieu")}</li>`}</ul></div>`);
    if (qt) ganThang(veLamThem);
    $("#flt")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const r = await goi("lam-them", Object.fromEntries(new FormData(e.target)));
      if (r.s !== 200) { e.target.querySelector(".loi").textContent = tLoi(r.d.loi); return; }
      bao(t("da_luu")); veLamThem();
    });
    $$("[data-lt] [data-hs]").forEach((b) => b.onclick = async () => {
      const r = await goi(`lam-them/${b.closest("li").dataset.lt}/duyet`, { he_so: Number(b.dataset.hs) });
      if (r.s !== 200) return bao(tLoi(r.d.loi)); veLamThem();
    });
    $$("[data-lt] [data-tc]").forEach((b) => b.onclick = async () => { await goi(`lam-them/${b.closest("li").dataset.lt}/tu-choi`, {}); veLamThem(); });
    $$("[data-lt] [data-huy]").forEach((b) => b.onclick = async () => { await goi(`lam-them/${b.closest("li").dataset.lt}/huy`, {}); veLamThem(); });
  }

  // ---------- Nối Lark: bảng lương đổ về Lark Base của chính trung tâm ----------
  async function veNoiLark() {
    khung("quan-ly", `<p class="trong">…</p>`);
    const { d } = await goi("luong/lark");
    khung("quan-ly", `<a href="#quan-ly">${t("quay_lai")}</a>
      <form class="the" id="fl"><h2>🔗 ${L2("Nối chấm công & bảng lương sang Lark Base", "Send timesheet & payroll to Lark Base")}</h2>
        <p class="nho">${L2("Mỗi lần khoá kỳ lương, app tự ghi hai bảng «Bảng công» (công, đi muộn, vắng, giờ dạy) và «Bảng lương» vào Base của trung tâm (tự tạo bảng nếu chưa có). Bấm «Đẩy sang Lark» ở màn Bảng lương để gửi bản tạm tính bất cứ lúc nào; đẩy lại một tháng thì thay bản cũ, không nhân đôi.",
          "Every time you lock payroll, the app writes the final sheet into a “Bảng lương” table in your Base (created if missing). Use “Send to Lark” on the Payroll screen to send a draft any time; re-sending a month replaces it.")}</p>
        <ol class="nho" style="padding-left:18px">
          <li>${L2("Lark Developer (open.larksuite.com/app) → Tạo app tự dựng → chép App ID + App Secret.", "Lark Developer (open.larksuite.com/app) → Create custom app → copy App ID + App Secret.")}</li>
          <li>${L2("Quyền: bitable:app (đọc & ghi Base) → Tạo phiên bản → Phát hành.", "Permission: bitable:app (read & write Base) → Create version → Publish.")}</li>
          <li>${L2("Mở Base muốn nhận bảng lương → … → Thêm tiện ích/ứng dụng → chọn app vừa tạo, cho quyền chỉnh sửa.", "Open the Base → … → Add app → pick your app with edit access.")}</li>
          <li>${L2("Dán link Base vào ô dưới → Lưu & kiểm tra.", "Paste the Base link below → Save & test.")}</li></ol>
        <label>App ID</label><input type="text" name="app_id" value="${h(d.app_id)}" placeholder="cli_xxxxxxxx" autocomplete="off">
        <label>App Secret</label><input type="password" name="secret" placeholder="${h(d.co_secret ? L2("đã lưu — để trống giữ nguyên", "saved — leave blank to keep") : "")}" autocomplete="new-password">
        <label>${L2("Link Base (hoặc mã Base)", "Base link (or token)")}</label><input type="text" name="base" value="${h(d.base)}" placeholder="https://xxx.larksuite.com/base/…">
        ${d.lan_cuoi ? `<p class="nho">✓ ${L2("Lần đẩy gần nhất", "Last sent")}: ${h(d.lan_cuoi)}</p>` : ""}
        <div class="loi" id="loi"></div>
        <div class="hang"><button class="nut chinh" type="submit">${L2("Lưu & kiểm tra", "Save & test")}</button>
          ${d.app_id ? `<button class="nut do" type="button" id="ngat">${L2("Ngắt kết nối", "Disconnect")}</button>` : ""}</div></form>`);
    $("#fl").onsubmit = async (e) => {
      e.preventDefault();
      const nut = e.target.querySelector("[type=submit]"); nut.disabled = true; $("#loi").textContent = L2("Đang kiểm tra với Lark…", "Testing with Lark…");
      const r = await goi("luong/lark", Object.fromEntries(new FormData(e.target)));
      nut.disabled = false;
      if (r.s !== 200) { $("#loi").textContent = r.d.chi_tiet ? L2("Lark báo: ", "Lark says: ") + r.d.chi_tiet : tLoi(r.d.loi); return; }
      bao(L2("Đã nối Lark — bảng «Bảng lương» sẵn sàng.", "Lark connected — “Bảng lương” table ready.")); veNoiLark();
    };
    $("#ngat")?.addEventListener("click", async () => { if (!confirm(L2("Ngắt kết nối Lark?", "Disconnect Lark?"))) return; await goi("luong/lark", { xoa: true }); veNoiLark(); });
  }

  // ================= Định tuyến =================
  async function taiToi() {
    const r = await goi("toi");
    TOI = r.s === 200 ? r.d : null;
    return TOI;
  }
  async function dieuHuong() {
    dungCamera();
    const hs = location.hash.slice(1);
    let m;
    if ((m = hs.match(/^moi=([a-f0-9]{24})$/))) return veMoi(m[1]);
    if ((m = hs.match(/^q=([a-f0-9]{16}\.[a-f0-9]{12})$/))) { qrCho = m[1]; history.replaceState(null, "", "#cham"); }
    if (!TOI) await taiToi();
    if (!TOI) return veDangNhap(hs === "dang-ky");
    if (hs === "dang-nhap" || hs === "dang-ky" || hs === "") return (location.hash = "#cham");
    const qt = laQuanTri();
    if (hs === "cham" || hs.startsWith("q=")) return veCham();
    if ((m = hs.match(/^lich-su(?:\/(\d{4}-\d{2}))?$/))) return veLichSu(m[1]);
    if (hs === "don") return veDon();
    if (hs === "toi") return veToi();
    if (hs === "lo-trinh") return veLoTrinh();
    if (hs === "day") return veDay();
    if (hs === "lam-them") return veLamThem();
    if (hs === "phieu-luong") return vePhieuCuaToi();
    if (!qt) return (location.hash = "#cham");
    if (hs === "hom-nay") return veHomNay();
    if (hs === "bang-cong") return veBangCong();
    if (hs === "nhap-nv") return veNhap();
    if (hs === "in-the") return veInThe();
    if (hs === "phong-ban" && !TOI.gioi_han_pb) return vePhongBan();
    if ((m = hs.match(/^nv-thang\/([a-f0-9]{16})\/(\d{4}-\d{2})$/))) return veNvThang(m[1], m[2]);
    if ((m = hs.match(/^nv\/([a-f0-9]{16})\/(\d{4}-\d{2}-\d{2})$/))) return veChiTietNgay(m[1], m[2]);
    if (hs === "quan-ly") return veQuanLy();
    if (hs === "bang-luong") return veBangLuong();
    if (hs === "buoi-day") return veBuoiDay();
    if (hs === "noi-lark" && TOI.vai === "chu") return veNoiLark();
    if (hs === "thiet-lap-luong" && !TOI.gioi_han_pb) return veThietLapLuong();
    if ((m = hs.match(/^luong-nv\/([a-f0-9]{16})$/))) return veLuongNv(m[1]);
    if ((m = hs.match(/^phieu\/([a-f0-9]{16})\/(\d{4}-\d{2})$/))) return vePhieuQuanLy(m[1], m[2]);
    if (hs === "nhan-vien") return veNhanVien();
    if (hs === "ca-lam" && !TOI.gioi_han_pb) return veCa();
    if (hs === "dia-diem" && !TOI.gioi_han_pb) return veDiaDiem();
    if (hs === "cai-dat" && TOI.vai === "chu") return veCaiDat();
    location.hash = "#cham";
  }
  window.addEventListener("hashchange", dieuHuong);
  dieuHuong();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
})();
