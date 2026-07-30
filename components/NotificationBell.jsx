import React, { useState, useEffect } from 'react';
// Đảm bảo Ní import đúng cấu hình Firebase của dự án nha
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../app/firebase';

const NotificationBell = ({ currentUser }) => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Nếu chưa có user đăng nhập thì không gọi Firebase để tiết kiệm tài nguyên
    if (!currentUser?.email) return;

    // Bắt đầu "nghe" thông báo thuộc về email của user này
    const q = query(
      collection(db, 'notifications'),
      where('clerkEmail', '==', currentUser.email),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notifs);
    });

    // Dọn dẹp listener khi tắt component
    return () => unsubscribe();
  }, [currentUser]);

  // Đếm số thông báo chưa đọc để hiển thị lên chấm đỏ
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative">
      {/* Nút Chuông */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-blue-600 focus:outline-none transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {/* Chấm đỏ báo số lượng */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Khung Dropdown hiển thị danh sách */}
      {isOpen && (
        <div className="absolute right-0 w-80 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 text-sm font-bold text-gray-800 bg-gray-50 border-b">
            Thông báo của bạn
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-sm text-center text-gray-500">
                Bạn không có thông báo nào mới!
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notif) => (
                  <li 
                    key={notif.id} 
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${notif.isRead ? 'bg-white opacity-70' : 'bg-blue-50/40'}`}
                    onClick={() => {
                        // Ní viết thêm logic ở đây:
                        // 1. Gọi Firebase update `isRead` thành true
                        // 2. Chuyển hướng router tới trang chi tiết vụ án
                        setIsOpen(false); 
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-semibold text-gray-800">{notif.title}</p>
                      {!notif.isRead && (
                        <span className="w-2 h-2 mt-1.5 bg-blue-500 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notif.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;