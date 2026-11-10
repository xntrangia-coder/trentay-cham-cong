// Tự kiểm API: tách dữ liệu giữa công ty, lời mời, chống gian lận khi chấm, đơn từ, bảng công, xuất CSV.
// Chạy máy chủ thử trước (xem HUONG-DAN.md), rồi:  node kiem-tra.mjs [http://127.0.0.1:8811]
// Bài bảng công cần ghi giờ tuỳ ý, chỉ chạy khi máy chủ thử bật CC_THU=1.
const GOC = process.argv[2] || "http://127.0.0.1:8811";
const LOCAL = GOC.includes("127.0.0.1") || GOC.includes("localhost");
let dat = 0, truot = 0;
const kiem = (ten, dk, them = "") => { dk ? dat++ : truot++; console.log(`${dk ? "✔" : "✖"} ${ten}${dk ? "" : "  " + (typeof them === "string" ? them : JSON.stringify(them))}`); };

class May {
  constructor() { this.cookie = ""; this.ma = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
  async goi(duong, than, header = true) {
    const h = { cookie: this.cookie }; if (header) h["x-cc"] = "1";
    if (than !== undefined) h["content-type"] = "application/json";
    const r = await fetch(GOC + "/api/" + duong, { method: than === undefined ? "GET" : "POST", headers: h, body: than === undefined ? undefined : JSON.stringify(than) });
    const sc = r.headers.get("set-cookie"); if (sc) this.cookie = sc.split(";")[0];
    const loai = r.headers.get("content-type") || "";
    const buf = await r.arrayBuffer();
    let d;
    if (loai.includes("json")) { try { d = JSON.parse(new TextDecoder().decode(buf)); } catch { d = null; } }
    else d = new TextDecoder("utf-8", { ignoreBOM: true }).decode(buf);
    return { s: r.status, d, loai };
  }
}
const ngauNhien = () => Math.random().toString(36).slice(2, 8);
const so = () => "09" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const ANH = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const VP = { lat: 10.762622, lng: 106.660172 };         // văn phòng thử
const GAN = { lat: 10.7631, lng: 106.6605, sai_so: 20 };  // ~65 m
const XA = { lat: 10.7769, lng: 106.7009, sai_so: 15 };   // ~4,6 km

const A = new May(), B = new May(), nv1 = new May(), nvTT = new May(), la = new May();
const emailA = `a-${ngauNhien()}@thu.vn`, emailB = `b-${ngauNhien()}@thu.vn`;

// ---- Đăng ký chủ ----
let r = await A.goi("dang-ky", { ten_dn: "Cty Thử A", ten: "Chủ A", email: emailA, mk: "matkhau123", dong_y_dieu_khoan: true }, false);
kiem("Thiếu header riêng thì bị chặn", r.s === 403);
r = await A.goi("dang-ky", { ten_dn: "Cty Thử A", ten: "Chủ A", email: emailA, mk: "matkhau123" });
kiem("Không tick đồng ý thì không đăng ký được", r.d?.loi === "thieu-dong-y");
r = await A.goi("dang-ky", { ten_dn: "Cty Thử A", ten: "Chủ A", email: emailA, mk: "matkhau123", dong_y_dieu_khoan: true });
kiem("Công ty A đăng ký được", r.s === 200 && A.cookie, r.d);
r = await B.goi("dang-ky", { ten_dn: "Cty Thử B", ten: "Chủ B", email: emailB, mk: "matkhau123", dong_y_dieu_khoan: true });
kiem("Công ty B đăng ký được", r.s === 200);
r = await new May().goi("dang-ky", { ten_dn: "Trùng", ten: "Người trùng", email: emailA, mk: "matkhau123", dong_y_dieu_khoan: true });
kiem("Email trùng bị chặn", r.s === 409);

const caA = (await A.goi("ca")).d.ds, ddA = (await A.goi("dia-diem")).d.ds, ddB = (await B.goi("dia-diem")).d.ds;
kiem("Đăng ký tự tạo 1 ca hành chính + 1 địa điểm", caA.length === 1 && caA[0].gio_vao === "08:00" && ddA.length === 1);
r = await A.goi(`dia-diem/${ddA[0].id}/sua`, { ten: "VP Quận 10", lat: VP.lat, lng: VP.lng, ban_kinh: 150, ip_ds: "" });
kiem("Cài toạ độ văn phòng", r.s === 200);
r = await A.goi("ca", { ten: "Sai", gio_vao: "25:00", gio_ra: "17:00", ngay_lam: "1" });
kiem("Giờ ca sai bị từ chối", r.d?.loi === "sai-gio");

// ---- Nhân viên + lời mời ----
const sdt1 = so(), sdtTT = so(), sdt2 = so();
r = await A.goi("nv", { ten: "Nguyễn Văn An", sdt: sdt1, ma_nv: "NV01", ca_id: caA[0].id, dia_diem_id: ddA[0].id });
kiem("Thêm nhân viên văn phòng, nhận mã mời", r.s === 200 && /^[a-f0-9]{24}$/.test(r.d.ma_moi), r.d);
const idNv1 = r.d.id, moi1 = r.d.ma_moi;
r = await A.goi("nv", { ten: "Trần Thị Bình", sdt: sdtTT, che_do: "thi_truong", ca_id: caA[0].id });
const idTT = r.d.id, moiTT = r.d.ma_moi;
r = await A.goi("nv", { ten: "Lê Văn Cường", sdt: sdt2, ca_id: caA[0].id });
const idNv2 = r.d.id;
r = await A.goi("nv", { ten: "Trùng SĐT", sdt: sdt1 });
kiem("SĐT trùng bị chặn", r.s === 409);
r = await A.goi("nv", { ten: "Không cách đăng nhập" });
kiem("Thiếu cả SĐT lẫn email bị chặn", r.d?.loi === "thieu-dang-nhap");
r = await B.goi(`nv/${idNv1}/sua`, { ten: "Hack", sdt: so() });
kiem("Công ty B không sửa được nhân viên của A", r.s === 404);
r = await B.goi("nv");
kiem("Công ty B không thấy nhân viên của A", !r.d.ds.some((x) => x.id === idNv1));

r = await nv1.goi("moi/" + moi1);
kiem("Mở link mời thấy tên công ty + tên đăng nhập", r.s === 200 && r.d.dn_ten === "Cty Thử A" && r.d.dang_nhap === sdt1, r.d);
r = await nv1.goi("moi/" + moi1, { mk: "nhanvien123", dong_y: false, may: nv1.ma });
kiem("Nhận lời mời phải tick đồng ý thu vị trí/ảnh", r.d?.loi === "thieu-dong-y");
r = await nv1.goi("moi/" + moi1, { mk: "nhanvien123", dong_y: true, may: nv1.ma });
kiem("Nhận lời mời -> vào app luôn", r.s === 200 && nv1.cookie);
r = await new May().goi("moi/" + moi1);
kiem("Link mời chỉ dùng được một lần", r.s === 404);
r = await nvTT.goi("moi/" + moiTT, { mk: "nhanvien123", dong_y: true, may: nvTT.ma });
kiem("Nhân viên thị trường nhận lời mời", r.s === 200);
r = await nv1.goi("hom-nay");
kiem("Nhân viên không mở được trang quản trị", r.s === 403);

// ---- Màn QR ở quầy ----
r = await la.goi(`kiosk/${ddA[0].id}?k=sai`);
kiem("Màn QR sai mã kiosk -> không mở", r.s === 404);
const layQr = async (dd) => (await la.goi(`kiosk/${dd.id}?k=${dd.ma_kiosk}`)).d.ma;
const qrA = await layQr(ddA[0]);
kiem("Màn QR trả mã dạng <địa điểm>.<12 ký tự>", /^[a-f0-9]{16}\.[a-f0-9]{12}$/.test(qrA), qrA);

// ---- Chấm công + chống gian lận ----
r = await nv1.goi("cham", { loai: "vao", ...GAN, anh: ANH, may: nv1.ma });
kiem("Văn phòng không quét QR -> chặn", r.d?.loi === "thieu-qr");
r = await nv1.goi("cham", { loai: "vao", qr: qrA, anh: ANH, may: nv1.ma });
kiem("Không gửi vị trí -> chặn", r.d?.loi === "thieu-vi-tri");
r = await nv1.goi("cham", { loai: "vao", qr: qrA, ...GAN, may: nv1.ma });
kiem("Không có ảnh -> chặn", r.d?.loi === "thieu-anh");
r = await nv1.goi("cham", { loai: "vao", qr: qrA, ...GAN, anh: "data:image/png;base64,AAAA", may: nv1.ma });
kiem("Ảnh không phải JPEG -> chặn", r.d?.loi === "anh-loi");
r = await nv1.goi("cham", { loai: "vao", qr: qrA.slice(0, -3) + "000", ...GAN, anh: ANH, may: nv1.ma });
kiem("Mã QR sai/hết hạn -> chặn", r.d?.loi === "qr-het-han", r.d);
r = await nv1.goi("cham", { loai: "vao", qr: await layQr(ddB[0]), ...GAN, anh: ANH, may: nv1.ma });
kiem("Quét QR của công ty khác -> chặn", r.d?.loi === "qr-sai");
const mayLa = new May(); mayLa.cookie = nv1.cookie;
r = await mayLa.goi("cham", { loai: "vao", qr: qrA, ...GAN, anh: ANH, may: mayLa.ma });
kiem("Đúng tài khoản nhưng điện thoại khác -> chặn", r.s === 403 && r.d?.loi === "may-khac");
r = await nv1.goi("cham", { loai: "vao", qr: qrA, ...GAN, anh: ANH, may: nv1.ma });
kiem("Đủ QR + vị trí gần + ảnh -> chấm vào được, không cảnh báo", r.s === 200 && r.d.cham.qua_qr && r.d.cham.canh_bao.length === 0 && r.d.cham.cach_met < 150, r.d);
const idCham1 = r.d.cham?.id;
r = await nv1.goi("cham", { loai: "vao", qr: qrA, ...GAN, anh: ANH, may: nv1.ma });
kiem("Bấm lại ngay -> trả bản cũ, không ghi thêm", r.d?.vua_cham === true && r.d.cham.id === idCham1);
r = await nv1.goi("cham", { loai: "ra", qr: await layQr(ddA[0]), ...XA, anh: ANH, may: nv1.ma });
kiem("Có QR nhưng GPS xa 4 km -> vẫn ghi, gắn cảnh báo 'xa'", r.s === 200 && r.d.cham.canh_bao.includes("xa"), r.d);
r = await nv1.goi("cham/hom-nay");
kiem("Màn hôm nay của nhân viên có 2 bản ghi, gợi ý chấm vào tiếp", r.d.ban.length === 2 && r.d.tiep_theo === "vao", r.d);

// Tắt bắt buộc QR: không QR thì phải ở trong vùng.
r = await nv1.goi("dn/sua", { bat_qr: false });
kiem("Nhân viên không sửa được cài đặt công ty", r.s === 403);
await A.goi("dn/sua", { bat_qr: false });
r = await nv1.goi("cham", { loai: "vao", ...XA, anh: ANH, may: nv1.ma });
kiem("Tắt QR + đứng xa -> chặn 'ngoài vùng', báo khoảng cách", r.d?.loi === "ngoai-vung" && r.d.cach_met > 4000, r.d);
r = await nv1.goi("cham", { loai: "vao", ...GAN, anh: ANH, may: nv1.ma });
kiem("Tắt QR + đứng gần -> ghi, cảnh báo 'không QR'", r.s === 200 && r.d.cham.canh_bao.includes("khong-qr"), r.d);
await A.goi(`dia-diem/${ddA[0].id}/sua`, { ten: "VP Quận 10", lat: VP.lat, lng: VP.lng, ban_kinh: 150, ip_ds: "203.0.113.9" });
await A.goi("dn/sua", { bat_qr: true });
await new Promise((x) => setTimeout(x, 50));
r = await nv1.goi("cham", { loai: "ra", qr: await layQr(ddA[0]), ...GAN, anh: ANH, may: nv1.ma });
kiem("Mạng không nằm trong danh sách IP văn phòng -> cảnh báo 'mạng lạ'", r.s === 200 && r.d.cham.canh_bao.includes("ip-la"), r.d);

r = await nvTT.goi("cham", { loai: "vao", ...XA, anh: ANH, may: nvTT.ma });
kiem("Nhân viên thị trường chấm ở đâu cũng được (không QR, không bán kính)", r.s === 200 && r.d.cham.canh_bao.length === 0, r.d);
r = await nvTT.goi("cham", { loai: "ra", anh: ANH, may: nvTT.ma });
kiem("…nhưng vẫn phải gửi vị trí", r.d?.loi === "thieu-vi-tri");

// ---- Ảnh ----
r = await A.goi("anh/" + idCham1);
kiem("Chủ xem được ảnh chấm công (image/jpeg)", r.s === 200 && r.loai.includes("image/jpeg"));
r = await B.goi("anh/" + idCham1);
kiem("Công ty khác không xem được ảnh", r.s === 404);
r = await nv1.goi("anh/" + idCham1);
kiem("Nhân viên không mở được ảnh (kể cả của mình) qua quản trị", r.s === 403);
r = await A.goi(`nv/${idNv1}/ngay?ngay=${new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)}`);
kiem("Chi tiết ngày: đủ bản ghi, có toạ độ + IP + ảnh", r.d.ban?.length >= 4 && r.d.ban[0].con_anh && r.d.ban[0].lat != null, r.d);

// ---- Đơn ----
const homQua = new Date(Date.now() + 7 * 3600e3 - 86400e3).toISOString().slice(0, 10);
const ngayMai = new Date(Date.now() + 7 * 3600e3 + 86400e3).toISOString().slice(0, 10);
r = await nv1.goi("don", { loai: "quen_cham", ngay: ngayMai, gio_vao: "08:00", ly_do: "abc" });
kiem("Đơn quên chấm cho ngày mai bị chặn", r.d?.loi === "sai-ngay");
r = await nv1.goi("don", { loai: "quen_cham", ngay: homQua, ly_do: "Quên điện thoại ở nhà" });
kiem("Đơn quên chấm phải có giờ", r.d?.loi === "thieu-gio");
r = await nv1.goi("don", { loai: "quen_cham", ngay: homQua, gio_vao: "08:00", gio_ra: "17:00", ly_do: "Quên điện thoại ở nhà" });
kiem("Nhân viên gửi đơn quên chấm", r.s === 200);
const idDon = r.d.id;
r = await nv1.goi(`don/${idDon}/duyet`, {});
kiem("Nhân viên không tự duyệt được", r.s === 403);
r = await B.goi(`don/${idDon}/duyet`, {});
kiem("Công ty khác không duyệt được", r.s === 404);
r = await A.goi("don?tat_ca=1&trang_thai=cho");
kiem("Chủ thấy đơn chờ duyệt kèm tên nhân viên", r.d.ds.some((x) => x.id === idDon && x.nv_ten === "Nguyễn Văn An"));
r = await A.goi(`don/${idDon}/duyet`, {});
kiem("Chủ duyệt đơn", r.s === 200);
r = await A.goi(`don/${idDon}/tu-choi`, {});
kiem("Đơn đã duyệt không xét lại được", r.s === 409);
r = await nv1.goi("don", { loai: "nghi_phep", ngay: ngayMai, den_ngay: ngayMai, ly_do: "Việc gia đình" });
const idDon2 = r.d.id;
r = await nv1.goi(`don/${idDon2}/huy`, {});
kiem("Nhân viên huỷ được đơn đang chờ", r.s === 200);

// ---- Bảng công (cần CC_THU=1) ----
if (LOCAL) {
  const luc = (ngay, gio) => Date.parse(`${ngay}T${gio}:00+07:00`);
  const ghi = (ngay, loai, gio) => A.goi("thu/cham", { nv_id: idNv2, loai, luc: luc(ngay, gio) });
  // 10/2026: 1/10 là thứ Năm. Ca hành chính T2–T7 08:00–17:00.
  await ghi("2026-10-01", "vao", "07:55"); await ghi("2026-10-01", "ra", "17:05");
  await ghi("2026-10-02", "vao", "08:00"); await ghi("2026-10-02", "ra", "17:00");
  await ghi("2026-10-03", "vao", "08:30"); await ghi("2026-10-03", "ra", "17:00");
  await ghi("2026-10-05", "vao", "08:00");
  r = await A.goi("bang-cong?thang=2026-10");
  const x = r.d.ds?.find((y) => y.nv.id === idNv2);
  kiem("Bảng công 10/2026: 27 ngày có ca", x?.tong.ngay_ca === 27, x?.tong);
  kiem("…gần 3 công, 1 lần muộn 30 phút, 1 ngày thiếu giờ ra", x && x.tong.cong > 2.9 && x.tong.cong < 3 && x.tong.lan_muon === 1 && x.tong.muon_phut === 30 && x.tong.thieu_ra === 1, x?.tong);
  r = await A.goi(`nv/${idNv2}/thang?thang=2026-10`);
  kiem("Bảng công từng ngày của một người", r.d.ngay?.length === 31 && r.d.ngay[2].trang_thai === "muon", r.d.ngay?.[2]);
  r = await nv1.goi(`cua-toi?thang=${homQua.slice(0, 7)}`);
  const nq = r.d.ngay.find((n) => n.ngay === homQua);
  kiem("Đơn quên chấm đã duyệt được tính công ngày hôm qua", nq && (nq.sua_bang_don || !nq.co_ca), nq);
  r = await nv1.goi("thu/cham", { nv_id: idNv1, loai: "vao" });
  kiem("Nhân viên không gọi được lối ghi thử", r.s === 403);
}

// ---- Xuất CSV ----
r = await A.goi("bang-cong.csv?thang=2026-10");
kiem("Xuất CSV: text/csv có BOM, có tên nhân viên", r.s === 200 && r.loai.includes("text/csv") && r.d.startsWith("﻿") && r.d.includes("Lê Văn Cường"));
r = await A.goi("bang-cong.csv?thang=2026-10&kieu=chi-tiet");
kiem("CSV chi tiết từng ngày", r.s === 200 && r.d.includes("2026-10-03") && r.d.includes("muon"));
r = await B.goi("bang-cong.csv?thang=2026-10");
kiem("CSV của công ty B không có người của A", !r.d.includes("Lê Văn Cường") && !r.d.includes("Nguyễn Văn An"));

// ---- Hôm nay ----
r = await A.goi("hom-nay");
kiem("Trang hôm nay: đếm người đã vào, có cảnh báo", r.s === 200 && r.d.tong.nv >= 4 && r.d.tong.da_vao >= 2 && r.d.tong.canh_bao >= 1, r.d.tong);

// ---- Đăng nhập, mời lại, nghỉ việc ----
r = await new May().goi("dang-nhap", { dang_nhap: sdt2, mk: "gi-cung-duoc" });
kiem("Nhân viên chưa nhận lời mời không đăng nhập được", r.s === 401);
const nv1b = new May();
r = await nv1b.goi("dang-nhap", { dang_nhap: sdt1.replace(/^0/, "+84"), mk: "nhanvien123" });
kiem("Đăng nhập bằng SĐT (kể cả dạng +84)", r.s === 200);
r = await A.goi(`nv/${idNv1}/moi-lai`, {});
kiem("Mời lại sinh link mới", /^[a-f0-9]{24}$/.test(r.d.ma_moi || ""));
r = await A.goi(`nv/${idNv1}/doi-may`, {});
r = await mayLa.goi("cham", { loai: "vao", qr: await layQr(ddA[0]), ...GAN, anh: ANH, may: mayLa.ma });
kiem("Sau 'cho đổi điện thoại', máy mới chấm được và được gắn", r.s === 200, r.d);
r = await nv1.goi("cham", { loai: "ra", qr: await layQr(ddA[0]), ...GAN, anh: ANH, may: nv1.ma });
kiem("…và máy cũ hết chấm được", r.d?.loi === "may-khac");
r = await A.goi(`nv/${idNv1}/nghi-viec`, {});
r = await nv1.goi("cham/hom-nay");
kiem("Cho nghỉ việc -> phiên của nhân viên chết ngay", r.s === 401);
r = await new May().goi("dang-nhap", { dang_nhap: sdt1, mk: "nhanvien123" });
kiem("…và không đăng nhập lại được", r.s === 401);
r = await A.goi(`nv/${(await A.goi("toi")).d.id}/nghi-viec`, {});
kiem("Chủ không tự khoá chính mình", r.s === 403);

for (let i = 0; i < 5; i++) await new May().goi("dang-nhap", { dang_nhap: emailB, mk: "sai-sai-sai" });
r = await new May().goi("dang-nhap", { dang_nhap: emailB, mk: "matkhau123" });
kiem("Sai mật khẩu 5 lần -> tạm khoá kể cả khi nhập đúng", r.s === 429);

console.log(`\n${dat} đạt · ${truot} trượt`);
process.exit(truot ? 1 : 0);
