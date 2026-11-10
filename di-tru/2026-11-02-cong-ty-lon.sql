-- Đợt "công ty lớn" (02/11/2026): phòng ban + phạm vi quản lý, tìm theo tên bỏ dấu, thẻ chấm ở cổng, ảnh ở R2.
-- Chạy MỘT lần trên CSDL đã có (ALTER không chạy lại được). CSDL mới thì schema.sql đã gồm sẵn.
CREATE TABLE IF NOT EXISTS phong_ban (id TEXT PRIMARY KEY, dn_id TEXT NOT NULL, ten TEXT NOT NULL, tao_luc INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS pb_dn ON phong_ban(dn_id);
ALTER TABLE nguoi_dung ADD COLUMN phong_ban_id TEXT;
ALTER TABLE nguoi_dung ADD COLUMN pham_vi TEXT NOT NULL DEFAULT 'cong_ty';
ALTER TABLE nguoi_dung ADD COLUMN ten_tim TEXT NOT NULL DEFAULT '';
ALTER TABLE nguoi_dung ADD COLUMN ma_the TEXT;
ALTER TABLE cham ADD COLUMN qua_the INTEGER NOT NULL DEFAULT 0;
ALTER TABLE anh_cham ADD COLUMN kho TEXT NOT NULL DEFAULT 'd1';
UPDATE nguoi_dung SET ten_tim = lower(ten) WHERE ten_tim = '';
CREATE INDEX IF NOT EXISTS nd_pb ON nguoi_dung(dn_id, phong_ban_id);
CREATE INDEX IF NOT EXISTS nd_tim ON nguoi_dung(dn_id, ten_tim);
CREATE UNIQUE INDEX IF NOT EXISTS nd_the ON nguoi_dung(ma_the);
CREATE INDEX IF NOT EXISTS anh_dn_luc ON anh_cham(dn_id, luc);
