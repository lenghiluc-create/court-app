import { NextResponse } from 'next/server';

// Hàm gửi tin nhắn phản hồi ngược lại cho Zalo
async function callZaloAPI(endpoint, payload) {
  const response = await fetch(`https://openapi.zalo.me/v2.0/oa/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': process.env.ZALO_ACCESS_TOKEN // Lưu Access Token trong file .env
    },
    body: JSON.stringify(payload)
  });
  return await response.json();
}

// LUỒNG CHÍNH TIẾP NHẬN WEBHOOK FROM ZALO
export async function POST(request) {
  try {
    const data = await request.json();
    
    // Kiểm tra xem có đúng là sự kiện người dùng gửi tin nhắn/bấm nút không
    if (data.event_name === 'user_send_text_msg' || data.event_name === 'user_click_element') {
      const userId = data.sender.id; // ID Zalo của người dân
      const userText = data.message.text.trim(); // Nội dung chữ người dân gửi/bấm

      // 1. KỊCH BẢN 1: Người dân bấm nút "Mẫu đơn"
      if (userText === "Mẫu đơn") {
        const listPayload = {
          "recipient": { "user_id": userId },
          "message": {
            "attachment": {
              "type": "template",
              "payload": {
                "template_type": "list",
                "elements": [
                  {
                    "title": "Mẫu đơn ly hôn (đơn phương)",
                    "subtitle": "Nhận hướng dẫn và file Word tải về",
                    "default_action": {
                      "type": "oa.query.show",
                      "payload": "Ly hôn đơn phương" // Khi bấm dòng này, Zalo sẽ gửi chữ này về webhook
                    }
                  },
                  {
                    "title": "Mẫu đơn khởi kiện dân sự",
                    "subtitle": "Nhận hướng dẫn và file Word tải về",
                    "default_action": {
                      "type": "oa.open.url",
                      "payload": "Khởi kiện dân sự"
                    }
                  }
                ]
              }
            }
          }
        };
        await callZaloAPI('message', listPayload);
      }

      // 2. KỊCH BẢN 2: Người dân chọn dòng "Ly hôn đơn phương" từ danh sách
      else if (userText === "Ly hôn đơn phương") {
        
        // Hành động A: Gửi tin nhắn chữ hướng dẫn chi tiết
        const textPayload = {
          "recipient": { "user_id": userId },
          "message": {
            "text": "Tòa án gửi bạn tài liệu mẫu.\n\n⚠️ Lưu ý khi điền đơn:\n📌 Điền đầy đủ thông tin cá nhân và nơi cư trú.\n📌 Trình bày rõ quá trình mâu thuẫn vợ chồng.\n📌 Kèm theo bản sao CCCD, Giấy kết hôn (bản chính) và Khai sinh của con (nếu có)."
          }
        };
        await callZaloAPI('message', textPayload);

        // Hành động B: Gửi đính kèm file Word mẫu đơn (.docx)
        const filePayload = {
          "recipient": { "user_id": userId },
          "message": {
            "attachment": {
              "type": "file",
              "payload": {
                "token": "TOKEN_FILE_LY_HON_CUA_BAN" // Token này có được sau khi làm Bước 2 bên dưới
              }
            }
          }
        };
        await callZaloAPI('message', filePayload);
      }
    }

    // Luôn luôn phản hồi lại cho Zalo là server của bạn đã nhận được gói tin (HTTP 200)
    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error("Lỗi xử lý Webhook:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}