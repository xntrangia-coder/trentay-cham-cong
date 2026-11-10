// Đo tải "công ty 1.000 người":
//   1) tạo công ty thử, nhập 1.000 người qua đường nhập Excel (10 phòng ban)
//   2) (chỉ máy thử CC_THU=1) gieo trọn tháng trước ~26 ngày công × 2 lượt × 1.000 người
//   3) GIỜ VÀO CA: 1.000 người quẹt thẻ ở cổng, N lượt song song — đo từng lượt
//   4) đo các màn quản lý mở lúc đó: Hôm nay, Bảng công (1 trang), CSV cả công ty, danh sách nhân viên
//   node do-tai.mjs [gốc] [--nguoi 1000] [--song-song 40]
// Chạy trên bản thật xong phải dọn: wrangler d1 execute ... --remote --file don-du-lieu-thu.sql
const thamSo = process.argv.slice(2);
const GOC = thamSo.find((x) => x.startsWith("http")) || "http://127.0.0.1:8811";
const lay = (ten, mac) => { const i = thamSo.indexOf(ten); return i >= 0 ? Number(thamSo[i + 1]) : mac; };
const SO_NGUOI = lay("--nguoi", 1000), SONG_SONG = lay("--song-song", 40);
const LOCAL = GOC.includes("127.0.0.1") || GOC.includes("localhost");
const ANH = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
let cookie = "";
async function goi(duong, than) {
  const t0 = performance.now();
  const r = await fetch(GOC + "/api/" + duong, { method: than === undefined ? "GET" : "POST",
    headers: { cookie, "x-cc": "1", "content-type": "application/json" }, body: than === undefined ? undefined : JSON.stringify(than) });
  const sc = r.headers.get("set-cookie"); if (sc && than !== undefined && duong === "dang-ky") cookie = sc.split(";")[0];
  const chu = await r.text();
  let d; try { d = JSON.parse(chu); } catch { d = chu; }
  return { s: r.status, d, ms: performance.now() - t0, kb: chu.length / 1024 };
}
const pv = (ds, p) => { const s = [...ds].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const tron = (n) => Math.round(n);
const bao = [];
const ghi = (ten, ms, them = "") => { bao.push([ten, ms, them]); console.log(`${ten.padEnd(46)} ${String(tron(ms)).padStart(6)} ms ${them}`); };

const tg0 = performance.now();
let r = await goi("dang-ky", { ten_dn: "Đo tải 1000 người", ten: "Chủ đo tải", email: `do-tai-${Date.now()}@thu.vn`, mk: "matkhau123", dong_y_dieu_khoan: true });
if (r.s !== 200) { console.log("Không đăng ký được", r.d); process.exit(1); }

// 1) Nhập 1.000 người
const dong = Array.from({ length: SO_NGUOI }, (_, i) => ({ ten: `Công Nhân ${String(i).padStart(4, "0")}`, ma_nv: "DT" + i,
  phong_ban: `Tổ ${(i % 10) + 1}`, che_do: "the" }));
const t1 = performance.now(); let loiNhap = 0;
for (let i = 0; i < dong.length; i += 40) {
  r = await goi("nv/nhap", { dong: dong.slice(i, i + 40) });
  loiNhap += (r.d.ket || []).filter((k) => !k.ok).length + (r.s !== 200 ? 40 : 0);
}
ghi(`Nhập ${SO_NGUOI} người (${Math.ceil(SO_NGUOI / 40)} lượt × 40)`, performance.now() - t1, loiNhap ? `· ${loiNhap} dòng lỗi` : "· 0 lỗi");
r = await goi("nv/the");
const the = r.d.ds.filter((x) => x.ten.startsWith("Công Nhân"));
const dd = (await goi("dia-diem")).d.ds[0];

// 2) Gieo tháng trước (chỉ máy thử)
const homNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const [nam, thang] = homNay.split("-").map(Number);
const thangTruoc = thang === 1 ? `${nam - 1}-12` : `${nam}-${String(thang - 1).padStart(2, "0")}`;
if (LOCAL) {
  const [ny, nm] = thangTruoc.split("-").map(Number), soNgay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const banGhi = [];
  for (let d = 1; d <= soNgay; d++) {
    const ngay = Date.UTC(ny, nm - 1, d) - 7 * 3600e3;            // 00:00 giờ VN
    if (new Date(ngay + 7 * 3600e3).getUTCDay() === 0) continue;   // ca mẫu nghỉ Chủ nhật
    for (const x of the) {
      const tre = Math.floor(Math.random() * 25) - 15;             // vào 07:45–08:10
      banGhi.push({ nv_id: x.id, loai: "vao", luc: ngay + (8 * 60 + tre) * 60e3 });
      banGhi.push({ nv_id: x.id, loai: "ra", luc: ngay + (17 * 60 + Math.floor(Math.random() * 30)) * 60e3 });
    }
  }
  const t2 = performance.now();
  for (let i = 0; i < banGhi.length; i += 500) await goi("thu/cham-lo", { ds: banGhi.slice(i, i + 500) });
  ghi(`Gieo tháng ${thangTruoc}: ${banGhi.length.toLocaleString("vi")} lượt chấm`, performance.now() - t2);
} else console.log("(bỏ qua gieo tháng: bản thật không mở đường ghi giờ tuỳ ý)");

// 3) Giờ vào ca: 1.000 lượt quẹt thẻ, SONG_SONG lượt cùng lúc
const lat = [], loi = {};
let ke = 0;
const t3 = performance.now();
await Promise.all(Array.from({ length: SONG_SONG }, async () => {
  while (ke < the.length) {
    const x = the[ke++];
    const t = performance.now();
    try {
      const k = await fetch(`${GOC}/api/kiosk/${dd.id}/cham`, { method: "POST", headers: { "content-type": "application/json", "x-cc": "1" },
        body: JSON.stringify({ k: dd.ma_kiosk, the: x.the, anh: ANH }) });
      const j = await k.json().catch(() => ({}));
      if (!(k.status === 200 && j.ok)) loi[j.loi || k.status] = (loi[j.loi || k.status] || 0) + 1;
    } catch (e) { loi.mang = (loi.mang || 0) + 1; }
    lat.push(performance.now() - t);
  }
}));
const tongQuet = performance.now() - t3;
ghi(`${the.length} lượt quẹt thẻ, ${SONG_SONG} song song — cả đợt`, tongQuet, `· ${(the.length / (tongQuet / 1000)).toFixed(1)} lượt/giây`);
ghi(`  mỗi lượt: trung vị`, pv(lat, 0.5)); ghi(`  mỗi lượt: 95% xong trong`, pv(lat, 0.95)); ghi(`  mỗi lượt: chậm nhất`, Math.max(...lat));
console.log(`  lỗi: ${Object.keys(loi).length ? JSON.stringify(loi) : "0"}`);

// 4) Màn quản lý
r = await goi("hom-nay"); ghi("Hôm nay (đếm cả 1.000 người + trang 1)", r.ms, `· ${r.s} · ${r.d.tong?.da_vao}/${r.d.tong?.nv} đã vào · ${r.kb.toFixed(0)} KB`);
r = await goi("hom-nay?loc=da_vao&trang=10"); ghi("Hôm nay lọc 'đã vào' trang 10", r.ms, `· ${r.s}`);
r = await goi(`bang-cong?thang=${thangTruoc}`); ghi(`Bảng công ${thangTruoc} trang 1 (50 người)`, r.ms, `· ${r.s} · ${r.d.tong_nv} người · một công nhân: ${r.d.ds?.find((x) => x.nv.ten.startsWith("Công"))?.tong?.cong ?? "?"} công`);
r = await goi(`bang-cong?thang=${thangTruoc}&trang=20`); ghi(`Bảng công ${thangTruoc} trang 20`, r.ms, `· ${r.s}`);
r = await goi(`bang-cong.csv?thang=${thangTruoc}`); ghi(`CSV tổng ${thangTruoc} cả công ty`, r.ms, `· ${r.s} · ${typeof r.d === "string" ? r.d.split("\n").length - 1 : 0} dòng · ${r.kb.toFixed(0)} KB`);
r = await goi(`bang-cong.csv?thang=${thangTruoc}&kieu=chi-tiet`); ghi(`CSV chi tiết ${thangTruoc} cả công ty`, r.ms, `· ${r.s} · ${typeof r.d === "string" ? r.d.split("\n").length - 1 : 0} dòng · ${r.kb.toFixed(0)} KB`);
r = await goi("nv?q=cong%20nhan%200999"); ghi("Tìm 1 người trong 1.000", r.ms, `· ${r.d.ds?.length} kết quả`);
r = await goi("nv/the"); ghi("Danh sách in thẻ 1.000 người", r.ms, `· ${r.d.ds?.length} thẻ`);
console.log(`\nTổng thời gian: ${(performance.now() - tg0) / 1000 | 0} s`);
