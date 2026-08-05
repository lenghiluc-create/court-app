import { NextResponse } from 'next/server';
export async function POST(req) {
  try {
    const { prompt, scheduleData } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ reply: "Thiếu API Key trong hệ thống!" }, { status: 500 });
    }

    const systemPrompt = `Bạn là Trợ lý AI của Tòa án nhân dân KV9-Cần Thơ.
Nhiệm vụ của bạn là trả lời câu hỏi của người dân về lịch xét xử dựa trên danh sách dữ liệu sau đây.
DỮ LIỆU LỊCH XÉT XỬ HIỆN TẠI: ${JSON.stringify(scheduleData)}
Hãy trả lời lịch sự, ngắn gọn, xưng "Tôi" và gọi người dùng là "Bạn".
Nếu câu hỏi không liên quan đến lịch xét xử, hãy từ chối trả lời khéo léo.
Câu hỏi của người dân: ${prompt}`;

const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
  headers: {
    // Chỉ cần Content-Type, KHÔNG dùng Authorization: Bearer ở đây nữa
    'Content-Type': 'application/json'
  },

  body: JSON.stringify({
    contents: [
      {
        parts: [{ text: systemPrompt }]
      }
    ]
  })
});

    const data = await response.json();
    if (!response.ok) {
      console.error("Lỗi từ Google API:", data);
      return NextResponse.json({ reply: "Xin lỗi, máy chủ AI đang bận." }, { status: 500 });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không thể phản hồi.";
    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error("LỖI CHI TIẾT:", error);
    return NextResponse.json({ reply: "Xin lỗi, tôi gặp sự cố khi tra cứu dữ liệu." }, { status: 500 });
  }
} 

