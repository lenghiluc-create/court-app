import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  // 1. Bảo mật API
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Từ chối truy cập', { status: 401 });
  }

  // 2. KHỞI TẠO FIREBASE BÊN TRONG HÀM
  // Đưa vào đây để Next.js không tự động chạy lúc npm run build
  if (!getApps().length && process.env.FIREBASE_PROJECT_ID) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  // 3. Khai báo db NGAY TRONG HÀM sau khi đã khởi tạo xong
  const db = getFirestore();

  try {
    const now = new Date();
    const snapshot = await db.collection('schedule')
      .where('status', 'not-in', ['dinh_chi', 'completed'])
      .get();

    const batch = db.batch();
    let notificationCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const deadline = data.deadlineDate?.toDate();

      if (deadline && now > deadline) {
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
          clerkEmail: data.clerkEmail,
          title: '⚠️ Cảnh báo trễ hạn',
          message: `Hồ sơ ${data.caseId} đã quá hạn cập nhật. Vui lòng kiểm tra ngay!`,
          caseId: data.caseId,
          type: 'overdue',
          isRead: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        notificationCount++;
      }
    });

    if (notificationCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, count: notificationCount });
  } catch (error) {
    console.error('Lỗi quét deadline:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}