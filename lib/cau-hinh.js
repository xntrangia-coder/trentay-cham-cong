// Cấu hình dùng chung máy chủ + giao diện.
export const PHIEN_BAN_CHINH_SACH = "2026-11-02";

export const HAN = {
  phien_ngay: 60,            // phiên đăng nhập (nhân viên mở app mỗi ngày, không bắt đăng nhập lại liên tục)
  thu_sai_toi_da: 5,
  khoa_thu_phut: 15,
  qr_cua_so_giay: 30,        // mã QR đổi sau ngần ấy giây; máy chủ nhận cả cửa sổ trước đó (≈ 60 giây hiệu lực)
  cham_lap_giay: 60,         // bấm cùng loại trong ngần ấy giây thì trả lại bản ghi cũ, không ghi thêm
  sai_so_gps_cong_toi_da: 80, // bán kính + min(sai số GPS, ngần này mét)
  anh_toi_da_kb: 160,
  nv_toi_da: 5000,          // trần mỗi công ty; đo thật 1.000 người (xem SRS mục 8)
  trang_co: 50,             // số dòng mỗi trang ở Hôm nay / Bảng công / Nhân viên
  nhap_lo: 40,              // số dòng Excel mỗi lượt gửi (D1 nhận tối đa 100 tham số một câu)
  the_lap_giay: 60,         // quẹt cùng thẻ trong ngần ấy giây thì không ghi thêm
  the_ra_trong_gio: 16,     // lần chấm trước là VÀO trong ngần ấy giờ thì lần này là RA
  theo_doi_song_phut: 6,    // trên bản đồ: còn "đang chạy" nếu có vị trí trong ngần ấy phút
  vi_tri_lo: 300,           // số điểm vị trí tối đa mỗi lượt app gửi dồn
  vi_tri_giu_ngay: 90,      // tự xoá điểm vị trí sau ngần ấy ngày (giới hạn lưu trữ theo luật)
  ghe_loai: ["khach", "giao", "sua"], // sale→khách · giao→đơn · thợ→lịch hẹn
};

// Lý do cảnh báo trên một lần chấm: bản ghi VẪN được ghi, quản lý xem lại.
export const CANH_BAO = ["xa", "ip-la", "gps-yeu", "khong-qr"];

export const CHE_DO = ["van_phong", "thi_truong", "the"]; // the = quẹt thẻ ở máy cổng, không cần điện thoại

export const LOAI_DON = ["quen_cham", "nghi_phep", "nghi_khong_luong"];

export const CA_MAU = { ten: "Hành chính", gio_vao: "08:00", gio_ra: "17:00", nghi_phut: 60, cho_muon_phut: 5, ngay_lam: "1,2,3,4,5,6" };
