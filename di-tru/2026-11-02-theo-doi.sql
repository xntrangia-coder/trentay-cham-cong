-- GĐ4 theo dõi lộ trình (CÔNG KHAI, chỉ trong ca): phiên ca + vị trí + điểm ghé + đồng ý riêng.
-- Chạy MỘT lần trên DB đã có. DB mới lấy từ schema.sql.

-- Đồng ý theo dõi vị trí liên tục là đồng ý RIÊNG, nặng hơn đồng ý chấm công — tách cột.
ALTER TABLE nguoi_dung ADD COLUMN theo_doi_dong_y_luc INTEGER;
ALTER TABLE nguoi_dung ADD COLUMN theo_doi_dong_y_ban TEXT;

-- Mỗi lần "Bắt đầu ca" là một phiên; "Kết thúc ca" đóng phiên. Chỉ theo dõi khi có phiên MỞ.
CREATE TABLE IF NOT EXISTS ca_phien (
  id TEXT PRIMARY KEY,
  dn_id TEXT NOT NULL,
  nv_id TEXT NOT NULL,
  bat_luc INTEGER NOT NULL,
  tat_luc INTEGER,                      -- NULL = đang trong ca
  dong_y_ban TEXT NOT NULL DEFAULT '',  -- phiên bản chính sách lúc bật
  may TEXT,
  tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cp_mo ON ca_phien(dn_id, tat_luc);
CREATE INDEX IF NOT EXISTS cp_nv ON ca_phien(dn_id, nv_id, bat_luc);

-- Điểm vị trí gửi dồn từ app trong ca. Tự xoá sau N ngày (giới hạn lưu trữ theo luật).
CREATE TABLE IF NOT EXISTS vi_tri (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dn_id TEXT NOT NULL,
  nv_id TEXT NOT NULL,
  phien_id TEXT NOT NULL,
  luc INTEGER NOT NULL,
  lat REAL NOT NULL, lng REAL NOT NULL,
  do_cx INTEGER,                        -- sai số GPS (mét)
  pin INTEGER,                          -- % pin
  toc_do REAL                           -- m/s
);
CREATE INDEX IF NOT EXISTS vt_nv ON vi_tri(dn_id, nv_id, luc);
CREATE INDEX IF NOT EXISTS vt_dn ON vi_tri(dn_id, luc);
CREATE INDEX IF NOT EXISTS vt_phien ON vi_tri(phien_id, luc);

-- Điểm ghé: sale→khách, giao→đơn, sửa→lịch hẹn. Cùng một bảng, khác nhãn loai.
CREATE TABLE IF NOT EXISTS ghe_tham (
  id TEXT PRIMARY KEY,
  dn_id TEXT NOT NULL,
  nv_id TEXT NOT NULL,
  phien_id TEXT,
  loai TEXT NOT NULL DEFAULT 'khach',   -- khach | giao | sua
  ten TEXT NOT NULL DEFAULT '',
  lat REAL, lng REAL,
  luc_den INTEGER NOT NULL,
  luc_di INTEGER,
  ghi_chu TEXT NOT NULL DEFAULT '',
  co_anh INTEGER NOT NULL DEFAULT 0,
  tao_luc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gt_nv ON ghe_tham(dn_id, nv_id, luc_den);
