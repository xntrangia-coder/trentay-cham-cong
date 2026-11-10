# Tạo tệp Excel thử cho bài kiểm giao diện "Nhập nhân viên từ Excel".
# Cố ý có: SĐT lưu dạng SỐ (rụng số 0 như Excel thật), tên cột viết hoa/thường lẫn lộn, một dòng trống.
import sys, pathlib
from openpyxl import Workbook

ra = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "thu-nhap.xlsx")
duoi = sys.argv[2] if len(sys.argv) > 2 else "000111"   # 6 số cuối SĐT, đổi mỗi lần chạy để khỏi trùng
wb = Workbook()
ws = wb.active
ws.append(["HỌ TÊN", "Số điện thoại", "Mã NV", "Phòng ban", "Cách chấm"])
ws.append(["Nguyễn Thị Hoa", int("912" + duoi), "X001", "Xưởng may", "thẻ"])
ws.append(["Trần Văn Khoa", None, "X002", "Xưởng may", "thẻ"])
ws.append([None, None, None, None, None])
ws.append(["Lê Thị Lan", "0913" + duoi, "VP01", "Kế toán", "văn phòng"])
wb.save(ra)
print(ra)
