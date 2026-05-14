'use client';
import React from 'react';
import { useSearchParams } from 'next/navigation';

export default function TrangXemAn() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');       // Lấy mã hồ sơ Firebase
  const file = searchParams.get('file');   // Lấy mã Drive

  React.useEffect(() => {
    if (id && file) {
      const batQuaTang = async () => {
        try {
          const { doc, updateDoc } = await import('firebase/firestore');
          // Ní nhớ lùi 2 bậc '../' để chỉ đúng đường dẫn file firebase.js nha
          const { db } = await import('../../firebase'); 

          // 1. Ghi vô sổ: Đương sự đã bấm xem! Cập nhật trạng thái màu xanh lá!
          await updateDoc(doc(db, "tong_dat", id), { 
            trangThai: 'Đã xem 👀',
            thoiGianXem: new Date().toLocaleString('vi-VN') // Ghi lại luôn giờ giấc cho chắc ăn
          });
        } catch (error) {
          console.error("Lỗi ghi nhận:", error);
        }
        
        // 2. Lập tức đá đương sự sang trang Google Drive xem file (Không hề hay biết)
        window.location.href = `https://drive.google.com/file/d/${file}/view`;
      };
      
      batQuaTang();
    }
  }, [id, file]);

  // Giao diện ngụy trang trong 0.5 giây trước khi chuyển hướng
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <h2 className="text-xl font-bold text-gray-700 uppercase tracking-widest">
        Hệ thống Tòa Án đang mở tài liệu...
      </h2>
      <p className="text-gray-500 mt-2">Vui lòng đợi trong giây lát.</p>
    </div>
  );
}