import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, phone, ten_duong_su, so_thu_ly, drive_file_id, tham_phan } = body;

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
    // // =================================================================
    // 3. GỬI TIN NHẮN ZALO (Tích hợp Zalo OA API)
    // =================================================================
    console.log("🚀 Bắt đầu gọi API Zalo gửi tin nhắn...");

    // 3.1: Xử lý số điện thoại (Zalo bắt buộc đầu số 84 thay cho số 0)
    let phoneZalo = phone.trim();
    if (phoneZalo.startsWith('0')) {
      phoneZalo = '84' + phoneZalo.substring(1);
    }

    // 3.2: Tạo link file Drive để gửi cho đương sự bấm vào xem
    // Lấy đường dẫn domain gốc của trang web (Localhost hoặc Vercel)
const host = request.headers.get('host');
const protocol = host.includes('localhost') ? 'http' : 'https';

// Tạo link bẫy (đính kèm mã hồ sơ và mã file Drive)
const linkFileDrive = `${protocol}://${host}/xem-an?id=${id}&file=${drive_file_id}`;

    // 3.3: Soạn nội dung tin nhắn Tống đạt
    const tinNhan = `TÒA ÁN NHÂN DÂN KHU VỰC 9 - TP. CẦN THƠ\n\nXin chào ông/bà: ${ten_duong_su}\nĐây là thông báo tống đạt điện tử cho hồ sơ thụ lý số: ${so_thu_ly} (Thẩm phán giải quyết: ${tham_phan}).\n\nVui lòng bấm vào đường link bên dưới để xem chi tiết và tải văn bản tống đạt:\n${linkFileDrive}\n\nTrân trọng.`;

    // 3.4: Gửi lệnh lên máy chủ Zalo (Nhớ điền Token thật vào biến môi trường)
    const zaloToken = process.env.ZALO_ACCESS_TOKEN; 

    if (!zaloToken) {
      console.warn("⚠️ Cảnh báo: Chưa cài đặt Zalo Token, hệ thống chỉ giả lập gửi thành công.");
    } else {
      const zaloResponse = await fetch('https://openapi.zalo.me/v2.0/oa/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': zaloToken
        },
        body: JSON.stringify({
          recipient: { user_id: "735698789452499011" }, // Tuyệt đối không dùng { phone: ... } để test nha!
          message: { text: tinNhan }
        })
      });

      const zaloResult = await zaloResponse.json();
      if (zaloResult.error) {
         throw new Error(`Zalo báo lỗi: ${zaloResult.message} (Mã lỗi: ${zaloResult.error})`);
      }
      console.log("✅ Đã gửi tin nhắn Zalo thật thành công!");
    }
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