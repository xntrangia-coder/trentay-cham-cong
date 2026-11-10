// Mô phỏng GĐ4: chủ + N nhân viên "đi thị trường" bật ca, gửi vị trí một tuyến đường,
// ghé vài điểm khách; rồi quản lý đọc BẢN ĐỒ trực tiếp và LỘ TRÌNH một người.
//   node mo-phong-di-chuyen.mjs [gốc] [--nguoi 3]
// Chạy trên bản thật xong phải dọn: wrangler d1 execute ... --remote --file don-du-lieu-thu.sql
const argv = process.argv.slice(2);
const GOC = argv.find((x) => x.startsWith("http")) || "http://127.0.0.1:8811";
const SO = (() => { const i = argv.indexOf("--nguoi"); return i >= 0 ? Number(argv[i + 1]) : 3; })();
const may = () => crypto.randomUUID().replace(/-/g, "");
async function goi(duong, than, cookie) {
  const r = await fetch(GOC + "/api/" + duong, { method: than === undefined ? "GET" : "POST",
    headers: { "x-cc": "1", "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: than === undefined ? undefined : JSON.stringify(than) });
  const sc = r.headers.get("set-cookie");
  const d = await r.json().catch(() => ({}));
  return { s: r.status, d, cookie: sc ? sc.split(";")[0] : null };
}
const xong = (ok, msg) => console.log(`${ok ? "✔" : "✖"} ${msg}`);
let loi = 0; const can = (ok, msg) => { if (!ok) loi++; xong(ok, msg); };

// 1) Chủ
let r = await goi("dang-ky", { ten_dn: "Mô phỏng lộ trình", ten: "Chủ", email: `mp-${Date.now()}@thu.vn`, mk: "matkhau123", dong_y_dieu_khoan: true });
can(r.s === 200, `Đăng ký chủ (${r.s})`);
const chu = r.cookie;

// 2) Nhân viên thị trường
const nvs = [];
for (let i = 0; i < SO; i++) {
  r = await goi("nv", { ten: `Sale ${i + 1}`, sdt: `09120000${String(i).padStart(2, "0")}`, che_do: "thi_truong" }, chu);
  if (r.s !== 200) { can(false, `Tạo nhân viên ${i} (${r.s} ${JSON.stringify(r.d)})`); continue; }
  const dm = may();
  const nm = await goi(`moi/${r.d.ma_moi}`, { mk: "matkhau123", dong_y: true, may: dm });
  can(nm.s === 200, `Nhân viên ${i + 1} nhận lời mời (${nm.s})`);
  nvs.push({ id: r.d.id, cookie: nm.cookie, may: dm });
}

// 3) Mỗi nhân viên: đồng ý theo dõi → bật ca → gửi tuyến đường → ghé khách
const now = Date.now();
for (const [i, nv] of nvs.entries()) {
  const dy = await goi("vi-tri/dong-y", {}, nv.cookie);
  can(dy.s === 200, `NV${i + 1} đồng ý theo dõi (${dy.s})`);

  const chua = await goi("vi-tri/bat-ca", {}, nv.cookie);          // chưa đồng ý? đã đồng ý rồi nên phải mở được
  const bc = chua.d.phien ? chua : await goi("vi-tri/bat-ca", { may: nv.may }, nv.cookie);
  can(bc.s === 200 && bc.d.phien, `NV${i + 1} bắt đầu ca (${bc.s})`);
  const phienId = bc.d.phien.id;

  // Tuyến: 40 điểm quanh TP.HCM, mỗi điểm cách 90 giây, điểm cuối cách hiện tại 60 giây (còn "đang chạy")
  const lat0 = 10.77 + i * 0.01, lng0 = 106.68 + i * 0.01, N = 40;
  const diem = Array.from({ length: N }, (_, k) => ({
    luc: now - (N - k) * 90000, lat: lat0 + k * 0.0009, lng: lng0 + k * 0.0006 * Math.sin(k / 4),
    do_cx: 8 + (k % 5), pin: 100 - k, toc_do: 6 }));
  const nap = await goi("vi-tri/nap", { phien_id: phienId, diem }, nv.cookie);
  can(nap.s === 200 && nap.d.so === N, `NV${i + 1} gửi ${N} điểm (${nap.s}, nhận ${nap.d.so})`);

  const loai = ["khach", "giao", "sua"][i % 3];
  const gt = await goi("ghe-tham", { phien_id: phienId, loai, ten: `Điểm ${loai} của NV${i + 1}`,
    lat: lat0 + 0.02, lng: lng0 + 0.01, ghi_chu: "Đã tư vấn xong" }, nv.cookie);
  can(gt.s === 200 && gt.d.id, `NV${i + 1} ghé 1 điểm (${gt.s})`);
  await goi(`ghe-tham/${gt.d.id}/roi`, {}, nv.cookie);
}

// 4) Quản lý (chủ) xem BẢN ĐỒ + LỘ TRÌNH
r = await goi("ban-do", undefined, chu);
can(r.s === 200 && r.d.ds.length === SO, `Bản đồ trực tiếp thấy ${r.d.ds?.length}/${SO} người đang chạy`);
if (r.d.ds?.[0]) console.log(`   → ${r.d.ds[0].ten}: ${r.d.ds[0].lat},${r.d.ds[0].lng} · ${r.d.ds[0].phut} phút trước · pin ${r.d.ds[0].pin}%`);

if (nvs[0]) {
  const today = new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
  r = await goi(`lo-trinh?nv=${nvs[0].id}&ngay=${today}`, undefined, chu);
  can(r.s === 200 && r.d.diem?.length === 40 && r.d.ghe?.length === 1, `Lộ trình NV1: ${r.d.diem?.length} điểm · ${r.d.ghe?.length} điểm ghé · ${r.d.km} km`);
}

// 5) Rút đồng ý thì xoá sạch vị trí của chính mình
if (nvs[0]) {
  await goi("vi-tri/dong-y", { rut: true }, nvs[0].cookie);
  r = await goi("ban-do", undefined, chu);
  can(r.d.ds?.length === SO - 1, `Rút đồng ý: bản đồ còn ${r.d.ds?.length}/${SO - 1} người (NV1 đã xoá)`);
}

console.log(`\n${loi ? "✖ " + loi + " lỗi" : "✔ TẤT CẢ ĐẠT"}`);
process.exit(loi ? 1 : 0);
