import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request) {
  try {
    const body = await request.json();
    const { phone, ten_duong_su, so_thu_ly, drive_file_id, tham_phan } = body;

    console.log("📨 Đang xử lý tống đạt cho:", ten_duong_su, "- SĐT:", phone);

    // =================================================================
    // 1. KẾT NỐI VÀ ĐĂNG NHẬP GOOGLE DRIVE BẰNG BOT
    // =================================================================
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // Dùng tuyệt chiêu này để trị dứt điểm cái lỗi DECODER:
        private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.split(String.raw`\n`).join('\n') : "",
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // =================================================================
    // 2. LỆNH CHO BOT MỞ KHÓA FILE (Ai có link cũng xem được)
    // =================================================================
    if (!drive_file_id) {
       throw new Error("Không tìm thấy ID của file Drive!");
    }

    await drive.permissions.create({
      fileId: drive_file_id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    
    console.log("🔓 Đã mở khóa file Drive thành công!");

    // =================================================================
    // 3. (TODO) GỬI TIN NHẮN ZALO
    // Khúc này mình để dành bước tiếp theo nha Ní!
    // =================================================================

    // Tạm thời trả về thành công để báo cho giao diện web biết Drive đã mở
    return NextResponse.json({ 
      success: true, 
      message: 'Đã mở khóa file Drive thành công! Chờ gắn Zalo nữa là xong.' 
    });

  } catch (error) {
    console.error("❌ Lỗi API Tống đạt:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}