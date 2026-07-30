import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Khởi tạo Firebase Admin an toàn để không lỗi khi Next.js reload
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Xử lý ký tự xuống dòng cho private key khi lưu trên Vercel
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export async function GET(request) {
  // 1. Bảo mật API: Chỉ cho phép Vercel Cron gọi API này
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Từ chối truy cập', { status: 401 });
  }

  try {
    const now = new Date();
    // 2. Quét bảng dữ liệu án (thay 'schedule' bằng tên bảng thật của Ní)
    const snapshot = await db.collection('schedule')
      .where('status', 'not-in', ['dinh_chi', 'completed']) // Bỏ qua án đã xong/đình chỉ
      .get();

    const batch = db.batch(); // Dùng batch để thêm nhiều thông báo cùng lúc cho mượt
    let notificationCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const deadline = data.deadlineDate?.toDate(); // Giả sử Ní có trường hạn chót

      // Nếu có hạn chót và đã bị trễ
      if (deadline && now > deadline) {
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
          clerkEmail: data.clerkEmail,
          title: '⚠️ Cảnh báo trễ hạn',
          message: `Hồ sơ ${data.caseId} đã quá hạn cập nhật. Vui lòng kiểm tra ngay!`,
          caseId: data.caseId,
          type: 'overdue',
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        notificationCount++;
      }
    });

    // 3. Đẩy toàn bộ thông báo lên Firestore
    if (notificationCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, count: notificationCount });
  } catch (error) {
    console.error('Lỗi quét deadline:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}