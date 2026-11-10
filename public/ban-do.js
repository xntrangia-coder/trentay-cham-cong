// Bản đồ lộ trình cho QUẢN LÝ: tab Trực tiếp (vị trí mọi người đang trong ca, tự làm mới)
// và tab Lộ trình ngày (đường đi + điểm ghé + km của một người). Dùng chung phiên đăng nhập.
(() => {
  const goc = document.getElementById("goc");
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const gio = (ms) => new Date(ms).toLocaleTimeString(NGON === "vi" ? "vi-VN" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
  const homNayVn = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  async function api(d) { const r = await fetch("/api/" + d, { cache: "no-store" }); return { s: r.status, d: await r.json().catch(() => ({})) }; }

  let map, lopLive, lopTrinh, hen = null, tab = "live", nguoiChon = "", daFit = false;

  function trangChinh() {
    goc.innerHTML = `
      <div class="bd-top">
        <h1 data-t="bd_tieu_de"></h1>
        <div class="bd-tab">
          <button id="t-live" class="on" data-t="bd_truc_tiep"></button>
          <button id="t-trinh" data-t="bd_lo_trinh"></button>
        </div>
        <div class="ngon"><button data-n="vi" class="${NGON === "vi" ? "on" : ""}">VI</button><button data-n="en" class="${NGON === "en" ? "on" : ""}">EN</button></div>
      </div>
      <div class="bd-than">
        <div class="bd-ben" id="ben"></div>
        <div id="map"></div>
      </div>`;
    dichChu();
    goc.querySelectorAll(".ngon button").forEach((b) => b.onclick = () => { datNgon(b.dataset.n); trangChinh(); dungMap(); doiTab(tab, true); });
    document.getElementById("t-live").onclick = () => doiTab("live");
    document.getElementById("t-trinh").onclick = () => doiTab("trinh");
    dungMap();
    doiTab(tab, true);
  }
  const dichChu = () => goc.querySelectorAll("[data-t]").forEach((e) => e.textContent = t(e.dataset.t));

  function dungMap() {
    map = L.map("map", { zoomControl: true }).setView([16.0, 107.5], 6); // giữa Việt Nam
    L.tileLayer("https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap, © CARTO" }).addTo(map);
    lopLive = L.layerGroup().addTo(map);
    lopTrinh = L.layerGroup();
  }

  function doiTab(which, ép) {
    if (which === tab && !ép) return;
    tab = which;
    clearTimeout(hen);
    document.getElementById("t-live").classList.toggle("on", tab === "live");
    document.getElementById("t-trinh").classList.toggle("on", tab === "trinh");
    daFit = false;
    if (tab === "live") { map.addLayer(lopLive); map.removeLayer(lopTrinh); vongLive(); }
    else { map.addLayer(lopTrinh); map.removeLayer(lopLive); benTrinh(); }
  }

  // ---------- Trực tiếp ----------
  async function vongLive() {
    const { s, d } = await api("ban-do");
    if (s !== 200) return;
    lopLive.clearLayers();
    const ben = document.getElementById("ben");
    if (!d.ds.length) { ben.innerHTML = `<p class="trong">${t("bd_khong_ai")}</p>`; }
    else {
      const pts = [];
      ben.innerHTML = `<h3 style="margin:0 0 8px">${t("bd_dang_chay")} · ${d.ds.length}</h3>` + d.ds.map((x) => {
        pts.push([x.lat, x.lng]);
        return `<div class="nguoi" data-nv="${x.nv_id}"><span class="cham-xanh"></span><div>
          <b>${h(x.ten)}${x.ma_nv ? ` <small>${h(x.ma_nv)}</small>` : ""}</b>
          <small>${x.phut <= 0 ? t("bd_vua_xong") : t("bd_phut_truoc", { n: x.phut })}${x.pin != null ? ` · ${t("bd_pin")} ${x.pin}%` : ""}</small></div></div>`;
      }).join("") + `<p class="nhip">${t("bd_tu_dong", { n: d.song_phut ? 15 : 15 })}</p>`;
      d.ds.forEach((x) => {
        L.circleMarker([x.lat, x.lng], { radius: 9, color: "#16a34a", fillColor: "#16a34a", fillOpacity: .9, weight: 2 })
          .addTo(lopLive).bindTooltip(h(x.ten), { permanent: true, direction: "top", offset: [0, -6] })
          .on("click", () => { nguoiChon = x.nv_id; doiTab("trinh"); });
      });
      ben.querySelectorAll(".nguoi").forEach((e) => e.onclick = () => { nguoiChon = e.dataset.nv; doiTab("trinh"); });
      if (!daFit && pts.length) { map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 }); daFit = true; }
    }
    if (tab === "live") hen = setTimeout(() => { if (document.visibilityState === "visible") vongLive(); else hen = setTimeout(vongLive, 15000); }, 15000);
  }

  // ---------- Lộ trình ngày ----------
  let dsNguoi = null;
  async function benTrinh() {
    if (!dsNguoi) {
      const { d } = await api("nv?trang=1");
      let ds = (d.ds || []);
      const tt = ds.filter((x) => x.che_do === "thi_truong");
      dsNguoi = tt.length ? tt : ds;
    }
    const ben = document.getElementById("ben");
    ben.innerHTML = `<div class="dieu">
      <label>${t("bd_chon_nguoi")}</label>
      <select id="chon">${dsNguoi.map((x) => `<option value="${x.id}" ${x.id === nguoiChon ? "selected" : ""}>${h(x.ten)}${x.ma_nv ? " · " + h(x.ma_nv) : ""}</option>`).join("")}</select>
      <label>${t("bd_ngay")}</label><input type="date" id="ngay" value="${homNayVn()}" max="${homNayVn()}">
      <button class="nut chinh" id="xem">${t("bd_xem")}</button></div>
      <div id="tt"></div>`;
    document.getElementById("xem").onclick = veTrinh;
    if (nguoiChon) veTrinh();
  }
  async function veTrinh() {
    const nv = document.getElementById("chon").value, ngay = document.getElementById("ngay").value || homNayVn();
    nguoiChon = nv;
    const { s, d } = await api(`lo-trinh?nv=${encodeURIComponent(nv)}&ngay=${ngay}`);
    lopTrinh.clearLayers();
    const tt = document.getElementById("tt");
    if (s !== 200) { tt.innerHTML = `<p class="trong">${tLoi(d.loi)}</p>`; return; }
    if (!d.diem.length && !d.ghe.length) { tt.innerHTML = `<p class="trong">${t("bd_khong_diem")}</p>`; return; }
    const pts = d.diem.map((p) => [p.lat, p.lng]);
    if (pts.length > 1) L.polyline(pts, { color: "#2563eb", weight: 4, opacity: .85 }).addTo(lopTrinh);
    if (pts.length) {
      L.circleMarker(pts[0], { radius: 7, color: "#16a34a", fillColor: "#16a34a", fillOpacity: 1 }).addTo(lopTrinh).bindTooltip(t("bd_bat_dau"));
      L.circleMarker(pts[pts.length - 1], { radius: 7, color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1 }).addTo(lopTrinh).bindTooltip(t("bd_ket_thuc"));
    }
    d.ghe.forEach((g, i) => {
      if (g.lat == null) return;
      const bieu = { khach: "★", giao: "📦", sua: "🔧" }[g.loai] || "•";
      L.marker([g.lat, g.lng], { icon: L.divIcon({ className: "", html: `<div class="ghe-pin"><span>${bieu}</span></div>`, iconSize: [26, 26], iconAnchor: [13, 26] }) })
        .addTo(lopTrinh).bindPopup(`<b>${h(g.ten || t("loai:" + g.loai))}</b><br>${t("loai:" + g.loai)}<br>${gio(g.luc_den)}${g.luc_di ? "–" + gio(g.luc_di) : ""}${g.ghi_chu ? "<br>" + h(g.ghi_chu) : ""}`);
    });
    const all = pts.concat(d.ghe.filter((g) => g.lat != null).map((g) => [g.lat, g.lng]));
    if (all.length) map.fitBounds(all, { padding: [50, 50], maxZoom: 16 });
    const t0 = d.diem[0]?.luc, t1 = d.diem[d.diem.length - 1]?.luc;
    tt.innerHTML = `
      <div class="tt-dong"><span>${t("bd_km")}</span><b>${d.km} km</b></div>
      <div class="tt-dong"><span>${t("bd_so_diem")}</span><b>${d.diem.length}</b></div>
      <div class="tt-dong"><span>${t("bd_diem_ghe")}</span><b>${d.ghe.length}</b></div>
      ${t0 ? `<div class="tt-dong"><span>${t("bd_khoang")}</span><b>${gio(t0)} – ${gio(t1)}</b></div>` : ""}
      ${d.ghe.map((g) => `<div class="tt-dong"><span>${{ khach: "★", giao: "📦", sua: "🔧" }[g.loai] || "•"} ${h(g.ten || t("loai:" + g.loai))}</span><b>${gio(g.luc_den)}</b></div>`).join("")}`;
  }

  // ---------- Khởi động: kiểm quyền ----------
  (async () => {
    const { s, d } = await api("toi");
    if (s === 401) { goc.innerHTML = `<div class="giua-man"><div class="the"><p>${t("bd_can_dang_nhap")}</p><a class="nut chinh" href="/">${t("bd_mo_app")}</a></div></div>`; return; }
    if (s !== 200) { goc.innerHTML = `<div class="giua-man"><p>${t("loi:mang")}</p></div>`; return; }
    if (d.vai !== "chu" && d.vai !== "quan_ly") { goc.innerHTML = `<div class="giua-man"><div class="the"><p>${t("bd_quyen")}</p><a class="nut" href="/">${t("bd_mo_app")}</a></div></div>`; return; }
    trangChinh();
  })();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && tab === "live" && map) { clearTimeout(hen); vongLive(); } });
})();
