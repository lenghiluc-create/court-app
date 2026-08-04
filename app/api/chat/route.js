import { GoogleGenerativeAI } from '@google/generative-ai';

// Thay cái chuỗi ở dưới bằng API Key Ní lấy trên aistudio.google.com nha
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { prompt, scheduleData } = await req.json();
    
    // Khởi tạo model AI
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Tạo một cái "lời căn dặn" để AI đóng vai nhân viên Tòa án
    const systemPrompt = `Bạn là Trợ lý AI của Tòa án nhân dân KV9-Cần Thơ. 
    Nhiệm vụ của bạn là trả lời câu hỏi của người dân về lịch xét xử dựa trên danh sách dữ liệu sau đây. 
    DỮ LIỆU LỊCH XÉT XỬ HIỆN TẠI: ${JSON.stringify(scheduleData)}. 
    Hãy trả lời lịch sự, ngắn gọn, xưng "Tôi" và gọi người dùng là "Bạn". 
    Nếu câu hỏi không liên quan đến lịch xét xử, hãy từ chối trả lời khéo léo.
    Câu hỏi của người dân: ${prompt}`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    return Response.json({ reply: text });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}