'use client';
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// 1. TÁCH PHẦN XỬ LÝ LOGIC RA MỘT COMPONENT RIÊNG
function BoMayXuLyXemAn() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');       
  const file = searchParams.get('file');   

  React.useEffect(() => {
    if (id && file) {
      const batQuaTang = async () => {
        try {
          const { doc, updateDoc } = await import('firebase/firestore');
          // Nhớ kiểm tra lại đường dẫn tới file firebase.js cho chuẩn nha Ní
          const { db } = await import('../../firebase'); 

          // Ghi vô sổ: Đã xem!
          await updateDoc(doc(db, "tong_dat", id), { 
            trangThai: 'Đã xem 👀',
            thoiGianXem: new Date().toLocaleString('vi-VN') 
          });
        } catch (error) {
          console.error("Lỗi ghi nhận:", error);
        }
        
        // Đá sang Drive
        window.location.href = `https://drive.google.com/file/d/${file}/view`;
      };
      
      batQuaTang();
    }
  }, [id, file]);

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

// 2. BỌC COMPONENT CHÍNH BẰNG SUSPENSE LÀ VERCEL HẾT LA LÀNG
export default function TrangXemAn() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Đang tải dữ liệu...</div>}>
      <BoMayXuLyXemAn />
    </Suspense>
  );
}