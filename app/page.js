'use client';
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import "react-big-calendar/lib/css/react-big-calendar.css";

// Firebase Imports
import { db, auth } from './firebase'; 
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';

const localizer = momentLocalizer(moment);

export default function PremiumCourtApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 3 VAI TRÒ CHÍNH: admin, thuky, thamphan (và viewer mặc định)
  const [userRole, setUserRole] = useState('viewer'); 
  
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const initialForm = {
    datetime: "", room: "Trụ sở", caseType: "Hình sự", caseName: "", 
    plaintiff: "", defendant: "", 
    judge: "", clerk: "", juror1: "", juror2: "", 
    prosecutor: "", status: "pending"
  };
  const [form, setForm] = useState(initialForm);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // LOGIC PHÂN QUYỀN MỚI
        const email = currentUser.email.toLowerCase();
        if (email.includes('admin') || email === 'truongphong@gmail.com') {
          setUserRole('admin');
        } else if (email.includes('thuky')) {
          setUserRole('thuky');
        } else if (email.includes('thamphan')) {
          setUserRole('thamphan');
        } else {
          setUserRole('viewer');
        }
        
        loadData();
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    try {
      const q = query(collection(db, "schedule"), orderBy("datetime", "desc"));
      const querySnapshot = await getDocs(q);
      setSchedule(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { showToast("Lỗi tải dữ liệu từ máy chủ", "error"); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      showToast("Đăng nhập thành công!", "success");
    } catch (err) { 
      showToast("Đăng nhập thất bại: Sai tài khoản hoặc mật khẩu.", "error"); 
    } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    // Chỉ Admin và Thư ký mới được thao tác lưu
    if (userRole === 'thamphan' || userRole === 'viewer') return showToast("Bạn không có quyền thực hiện thao tác này!", "error");
    if (!form.datetime || !form.caseName || !form.room) return showToast("Vui lòng nhập Thời gian, Phòng và Tên vụ án!", "error");
    
    const logData = {
      ...form,
      updatedAt: moment().toISOString(),
      updatedBy: user.email
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "schedule", editingId), logData);
        showToast("💾 Đã cập nhật hồ sơ thành công!", "success");
      } else {
        await addDoc(collection(db, "schedule"), {
          ...logData,
          createdAt: moment().toISOString(),
          createdBy: user.email
        });
        showToast("✅ Đã thêm hồ sơ mới vào hệ thống!", "success");
      }
      setForm(initialForm);
      setEditingId(null);
      loadData();
    } catch (err) { showToast("Lỗi khi lưu: " + err.message, "error"); }
  };

  const exportToExcel = () => {
    if (schedule.length === 0) return showToast("Không có dữ liệu để xuất!", "error");
    const headers = ["Ngày", "Giờ", "Phòng", "Loại án", "Tên vụ án", "Nguyên đơn", "Bị đơn", "Thẩm phán", "Hội thẩm 1", "Hội thẩm 2", "Thư ký", "KSV", "Trạng thái", "Tạo bởi", "Cập nhật cuối"];
    const dataToExport = schedule.filter(i => i.caseName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const dataRows = dataToExport.map(item => [
      moment(item.datetime).format("DD/MM/YYYY"), moment(item.datetime).format("HH:mm"), item.room,
      item.caseType || "Khác", `"${(item.caseName || "").replace(/"/g, '""')}"`, `"${item.plaintiff || ""}"`, `"${item.defendant || ""}"`,
      `"${item.judge || ""}"`, `"${item.juror1 || ""}"`, `"${item.juror2 || ""}"`, `"${item.clerk || ""}"`, `"${item.prosecutor || ""}"`,
      item.status === 'done' ? 'Đã hoàn thành' : item.status === 'processing' ? 'Đang xét xử' : 'Chờ xét xử',
      item.createdBy || "N/A", item.updatedBy || "N/A"
    ]);

    const csvContent = "\uFEFF" + [headers, ...dataRows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Lich_Xet_Xu_${moment().format('DD_MM_YYYY')}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast("Đã tải xuống file Excel", "success");
  };

  const isRoomConflict = schedule.some(item => item.datetime === form.datetime && item.room === form.room && item.id !== editingId);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 p-6 flex gap-6">
      <div className="w-64 hidden xl:block bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse h-screen"></div>
      <div className="flex-1 space-y-6">
        <div className="h-16 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse"></div>
          <div className="h-28 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse"></div>
          <div className="h-28 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse"></div>
        </div>
        <div className="h-[500px] bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse"></div>
      </div>
    </div>
  );

  // ---------- GIAO DIỆN ĐĂNG NHẬP ----------
  if (!user) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center relative bg-cover bg-center bg-no-repeat z-[150]"
        // CHÚ Ý: Đổi 'bg-login.jpg' bằng tên file ảnh nền của bạn trong thư mục public
        style={{ backgroundImage: "url('/toaan.jpg')", backgroundColor: "#1e3a8a" }} // CÓ MÀU BACKUP NẾU ẢNH LỖI
      >
        <div className="absolute inset-0 bg-black/40"></div>

        <div className="relative z-10 w-full max-w-[480px] bg-black/60 backdrop-blur-md p-10 shadow-2xl text-white text-center mx-4 rounded-xl border border-white/10">
          
          {/* LOGO TÒA ÁN - CHÚ Ý: Đổi tên file 'logo-toaan.png' bằng tên file logo của bạn */}
          <img 
            src="/logo-toaan.png" 
            alt="Quốc Huy Tòa Án" 
            className="w-28 h-28 object-contain mx-auto mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] hover:scale-105 transition-transform duration-300"
            // Hiển thị logo thay thế nếu không tìm thấy ảnh
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          {/* Logo dự phòng nếu không tìm thấy file logo */}
          <div className="hidden w-20 h-20 bg-gradient-to-br from-yellow-400 to-red-600 rounded-full items-center justify-center mx-auto mb-4 border-2 border-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.5)]">
            <span className="text-3xl">⚖️</span>
          </div>

          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-200 mb-2">Tòa Án Nhân Dân Cần Thơ</h2>
          <h1 className="text-[22px] font-black uppercase tracking-wide mb-8">Tòa Án Nhân Dân Khu Vực 9</h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Tài Khoản..." value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-4 py-3.5 bg-white text-gray-900 rounded outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 font-medium text-sm" required />
            <input type="password" placeholder="Mật Khẩu..." value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full px-4 py-3.5 bg-white text-gray-900 rounded outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 font-medium text-sm" required />

            <div className="flex items-center justify-between text-sm text-gray-200 mt-2 mb-6 px-1">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-400 cursor-pointer accent-blue-600" />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Quên mật khẩu?</a>
            </div>

            <button type="submit" className="w-full bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-bold py-3.5 rounded uppercase transition-all shadow-lg text-sm border border-blue-900">
              Đăng Nhập
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Khai báo biến kiểm tra quyền xem Form (Chỉ Admin và Thư ký mới được xem Form)
  const canEdit = userRole === 'admin' || userRole === 'thuky';

  // ---------- GIAO DIỆN CHÍNH ----------
  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-800 relative">
      
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[200] px-6 py-4 rounded-xl shadow-2xl font-bold text-sm transform transition-all animate-in slide-in-from-right-8 fade-in duration-300 flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          <span className="text-xl">{toast.type === 'error' ? '⚠️' : '✅'}</span>
          {toast.message}
        </div>
      )}

      {selectedEvent && user && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="bg-blue-900 p-5 text-white flex justify-between items-start">
              <div>
                <div className="flex gap-2">
                  <span className="bg-blue-800 border border-blue-700 text-white text-[10px] font-black uppercase px-3 py-1 rounded">P. {selectedEvent.room}</span>
                  <span className="bg-white/20 border border-white/30 text-white text-[10px] font-black uppercase px-3 py-1 rounded">{selectedEvent.caseType || "Hình sự"}</span>
                </div>
                <h3 className="text-lg font-black uppercase mt-3 leading-snug">{selectedEvent.caseName}</h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-blue-200 hover:text-white bg-blue-800 hover:bg-red-500 w-8 h-8 rounded-full flex items-center justify-center transition-colors">&times;</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-blue-900 bg-blue-50 border border-blue-100 p-3 rounded-xl font-bold text-sm">
                <span className="text-xl">🕒</span> {moment(selectedEvent.datetime).format("HH:mm - Ngày DD/MM/YYYY")}
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm space-y-2">
                <p><strong className="text-gray-500 uppercase text-xs inline-block w-24">Nguyên đơn:</strong> <span className="font-bold text-gray-900">{selectedEvent.plaintiff}</span></p>
                <p><strong className="text-gray-500 uppercase text-xs inline-block w-24">Bị đơn:</strong> <span className="font-bold text-gray-900">{selectedEvent.defendant}</span></p>
              </div>
              <div className="text-sm space-y-2 border-t border-gray-200 pt-4">
                <p><strong className="text-gray-600 inline-block w-24">Thẩm phán:</strong> <span className="font-bold text-gray-900">{selectedEvent.judge}</span></p>
                <p><strong className="text-gray-600 inline-block w-24">Hội thẩm:</strong> <span className="text-gray-800">{selectedEvent.juror1}, {selectedEvent.juror2}</span></p>
                <p><strong className="text-gray-600 inline-block w-24">Thư ký:</strong> <span className="text-gray-800">{selectedEvent.clerk}</span></p>
                <p><strong className="text-gray-600 inline-block w-24">KSV:</strong> <span className="text-red-600 font-bold">{selectedEvent.prosecutor}</span></p>
              </div>

              <div className="bg-slate-100 p-3 rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-500 italic">
                <p>Khởi tạo: {selectedEvent.createdBy || "N/A"} - {selectedEvent.createdAt ? moment(selectedEvent.createdAt).format("HH:mm DD/MM/YYYY") : ""}</p>
                <p>Cập nhật: {selectedEvent.updatedBy || "N/A"} - {selectedEvent.updatedAt ? moment(selectedEvent.updatedAt).format("HH:mm DD/MM/YYYY") : ""}</p>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 flex gap-3">
                {/* Chỉ hiện nút sửa nếu là Admin hoặc Thư ký */}
                {canEdit && (
                  <button onClick={() => {setForm(selectedEvent); setEditingId(selectedEvent.id); setSelectedEvent(null); window.scrollTo({top: 0, behavior: 'smooth'});}} className="flex-1 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-xs font-black uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm">✏️ Sửa hồ sơ</button>
                )}
                <button onClick={() => setSelectedEvent(null)} className="flex-1 bg-gray-100 border border-gray-300 text-gray-700 px-4 py-3 rounded-xl text-xs font-black uppercase hover:bg-gray-200 transition-all shadow-sm">Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {user && (
        <>
          <aside className="w-64 bg-blue-900 text-white hidden xl:flex flex-col fixed h-screen shadow-2xl z-20">
            <div className="p-6 text-center border-b border-blue-800">
              <span className="text-4xl block mb-2">⚖️</span>
              <h2 className="font-black text-xl uppercase tracking-widest">TAND KV9</h2>
            </div>
            <div className="p-4 flex-1 space-y-2">
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-2 ml-2">Menu chức năng</p>
              <div className="bg-blue-800 text-white px-4 py-3 rounded-lg font-bold flex items-center gap-3 cursor-pointer shadow-inner border border-blue-700"><span>📅</span> Lịch xét xử</div>
              <div className="px-4 py-3 rounded-lg font-medium text-blue-300 flex items-center gap-3 cursor-not-allowed hover:bg-blue-800/50 transition-colors"><span>📁</span> Hồ sơ vụ án</div>
            </div>
            <div className="p-4 border-t border-blue-800">
              <div className="bg-blue-950 p-3 rounded-lg mb-3">
                <p className="text-[10px] text-blue-400 uppercase font-bold flex justify-between items-center">
                  Tài khoản
                  {/* HUY HIỆU VAI TRÒ */}
                  <span className={`px-2 py-0.5 rounded text-[8px] text-white font-black 
                    ${userRole === 'admin' ? 'bg-red-500' : 
                      userRole === 'thuky' ? 'bg-amber-500' : 
                      userRole === 'thamphan' ? 'bg-blue-500' : 'bg-green-500'}`}>
                    {userRole === 'admin' ? 'ADMIN' : 
                     userRole === 'thuky' ? 'THƯ KÝ' : 
                     userRole === 'thamphan' ? 'THẨM PHÁN' : 'TRA CỨU'}
                  </span>
                </p>
                <p className="text-xs font-medium truncate mt-1">{user.email}</p>
              </div>
              <button onClick={() => signOut(auth)} className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors shadow-md">Đăng xuất</button>
            </div>
          </aside>

          <main className="flex-1 xl:ml-64 flex flex-col min-h-screen">
            
            <header className="bg-white h-16 shadow-sm border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
              <h1 className="font-black text-gray-800 uppercase tracking-wide truncate pr-4">Hệ thống quản lý lịch trực tuyến</h1>
              <div className="flex items-center gap-3">
                <span className="hidden md:flex bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border border-green-200 items-center gap-2 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Trực tuyến
                </span>
                <button onClick={() => signOut(auth)} className="bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border border-red-200 px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-colors shadow-sm whitespace-nowrap">
                  🚪 Đăng xuất
                </button>
              </div>
            </header>

            <div className="p-6 lg:p-8 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between border-l-4 border-l-blue-900 hover:shadow-md transition-shadow">
                  <div><p className="text-gray-500 text-xs font-bold uppercase mb-1">Tổng vụ án</p><p className="text-3xl font-black text-gray-900">{schedule.length}</p></div>
                  <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl text-2xl">📁</div>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-6 rounded-2xl shadow-lg shadow-blue-900/20 flex items-center justify-between hover:shadow-xl transition-shadow">
                  <div><p className="text-blue-200 text-xs font-bold uppercase mb-1">Xử trong ngày</p><p className="text-3xl font-black">{schedule.filter(i => moment(i.datetime).isSame(moment(), 'day')).length}</p></div>
                  <div className="bg-white/20 p-3 rounded-xl text-2xl">⚡</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
                  <div><p className="text-gray-500 text-xs font-bold uppercase mb-1">Đang chờ xử</p><p className="text-3xl font-black text-amber-600">{schedule.filter(i => i.status === 'pending').length}</p></div>
                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-2xl">⏳</div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                
                {/* HIỂN THỊ FORM CHO ADMIN VÀ THƯ KÝ */}
                {canEdit && (
                  <div className="xl:col-span-4">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-24">
                      <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                        <h2 className="font-black text-blue-900 uppercase text-base">{editingId ? "✏️ Cập nhật hồ sơ" : "➕ Thêm lịch mới"}</h2>
                        {editingId && (<button onClick={() => {setEditingId(null); setForm(initialForm);}} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded font-bold uppercase hover:bg-gray-200">Hủy</button>)}
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
    Phòng xử án
  </label>
  <select 
    value={form.room} 
    onChange={e => setForm({...form, room: e.target.value})} 
    className={`w-full border p-2.5 rounded-lg bg-gray-50 text-sm font-bold outline-none text-gray-900 transition-colors ${
      isRoomConflict ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-blue-600 focus:bg-white'
    }`}
  >
    <option value="">-- Chọn nơi xử --</option>
    <option value="Trụ sở">Trụ sở</option>
    <option value="Chi nhánh">Chi nhánh</option>
    <option value="Dự phòng">Dự phòng</option>
  </select>
</div>
                        </div>
                        {isRoomConflict && <p className="text-red-600 text-[10px] font-bold bg-red-50 p-2 rounded border border-red-200 animate-pulse">⚠️ Trùng lịch tại phòng này!</p>}

                        <div>
                           <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Loại án</label>
                           <select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value})} className="w-full border border-gray-200 p-2.5 rounded-lg bg-gray-50 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white">
                             <option value="Hình sự">🚨 Hình sự</option>
                             <option value="Dân sự">🤝 Dân sự</option>
                             <option value="Hành chính">🏢 Hành chính</option>
                             <option value="Hôn nhân & GĐ">💍 Hôn nhân & Gia đình</option>
                             <option value="Kinh tế">💰 Kinh tế</option>
                           </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Vụ án / Tội danh</label>
                          <textarea placeholder="Nhập nội dung..." value={form.caseName} onChange={e => setForm({...form, caseName: e.target.value})} className="w-full border border-gray-200 p-3 rounded-lg bg-gray-50 text-sm font-bold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition-colors" rows="2" />
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <input placeholder="Nguyên đơn..." value={form.plaintiff} onChange={e => setForm({...form, plaintiff: e.target.value})} className="w-full border border-gray-200 p-2.5 rounded-lg bg-white text-xs text-gray-900 outline-none focus:border-blue-600 shadow-sm" />
                          <input placeholder="Bị đơn..." value={form.defendant} onChange={e => setForm({...form, defendant: e.target.value})} className="w-full border border-gray-200 p-2.5 rounded-lg bg-white text-xs text-gray-900 outline-none focus:border-blue-600 shadow-sm" />
                        </div>

                        <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 space-y-3">
                          <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest text-center mb-2">Thành phần tham gia</p>
                          <input placeholder="Thẩm phán chủ tọa" value={form.judge} onChange={e => setForm({...form, judge: e.target.value})} className="w-full p-2.5 border border-white rounded-lg bg-white text-sm font-bold text-gray-900 outline-none focus:border-blue-400 shadow-sm" />
                          <div className="grid grid-cols-2 gap-3">
                            <input placeholder="Hội thẩm 1" value={form.juror1} onChange={e => setForm({...form, juror1: e.target.value})} className="w-full p-2.5 border border-white rounded-lg bg-white text-xs text-gray-900 outline-none focus:border-blue-400 shadow-sm" />
                            <input placeholder="Hội thẩm 2" value={form.juror2} onChange={e => setForm({...form, juror2: e.target.value})} className="w-full p-2.5 border border-white rounded-lg bg-white text-xs text-gray-900 outline-none focus:border-blue-400 shadow-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input placeholder="Thư ký" value={form.clerk} onChange={e => setForm({...form, clerk: e.target.value})} className="w-full p-2.5 border border-white rounded-lg bg-white text-xs text-gray-900 outline-none focus:border-blue-400 shadow-sm" />
                            <input placeholder="Kiểm sát viên" value={form.prosecutor} onChange={e => setForm({...form, prosecutor: e.target.value})} className="w-full p-2.5 border border-white rounded-lg bg-white text-xs font-bold text-red-700 outline-none focus:border-red-400 shadow-sm" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Trạng thái hồ sơ</label>
                          <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full border border-gray-200 p-3 rounded-lg bg-white text-sm font-black uppercase outline-none focus:border-blue-600 cursor-pointer text-gray-800 shadow-sm">
                            <option value="pending">🟡 Chờ xét xử</option>
                            <option value="processing">🔵 Đang xử</option>
                            <option value="done">🟢 Đã hoàn thành</option>
                          </select>
                        </div>

                        <button onClick={handleSubmit} disabled={isRoomConflict} className={`w-full text-white font-black py-4 rounded-xl transition-all uppercase text-sm mt-2 shadow-md ${isRoomConflict ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'}`}>
                          {editingId ? "💾 Lưu cập nhật" : "✅ Lưu vào hệ thống"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* BẢNG VÀ LỊCH MỞ RỘNG TOÀN MÀN NẾU LÀ THẨM PHÁN / VIEWER */}
                <div className={`space-y-6 ${!canEdit ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
                  
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm h-[480px]">
                    <Calendar localizer={localizer} events={schedule.map(i => ({...i, title: `[P.${i.room}] ${i.caseName}`, start: new Date(i.datetime), end: new Date(new Date(i.datetime).getTime() + 3600000)}))} style={{ height: "100%" }} className="font-sans text-sm font-semibold text-gray-800" onSelectEvent={(event) => setSelectedEvent(event)} />
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-white sticky top-0 z-10">
                      <h3 className="font-black uppercase text-sm text-gray-800">📋 Sổ thụ lý trực tuyến</h3>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                          <input type="text" placeholder="Tìm kiếm vụ án..." onChange={e => setSearchQuery(e.target.value)} className="border border-gray-200 pl-9 pr-4 py-2 rounded-lg bg-gray-50 text-sm text-gray-900 outline-none focus:border-blue-600 focus:bg-white w-full md:w-64 transition-colors" />
                        </div>
                        <button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-xs font-black uppercase whitespace-nowrap shadow-sm transition-colors">📥 Xuất Excel</button>
                      </div>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 relative">
                      <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 bg-gray-50 z-10 outline outline-1 outline-gray-200">
                          <tr className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                            <th className="p-4 whitespace-nowrap">Thời gian & Phân loại</th>
                            <th className="p-4">Nội dung vụ án & Lưu vết</th>
                            <th className="p-4">Thành phần tham gia</th>
                            {/* Cột thao tác chỉ hiện khi là admin hoặc thư ký */}
                            {canEdit && <th className="p-4 text-center w-24">Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {schedule.filter(i => i.caseName.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                            <tr key={item.id} className="hover:bg-blue-50/40 transition-colors bg-white group cursor-pointer" onClick={() => setSelectedEvent(item)}>
                              <td className="p-4 align-top">
                                <div className="font-black text-gray-900 text-sm">{moment(item.datetime).format("DD/MM/YYYY")}</div>
                                <div className="text-blue-700 font-bold text-xs bg-blue-50 inline-block px-2 py-1 rounded border border-blue-100 mt-1">🕒 {moment(item.datetime).format("HH:mm")} — P.{item.room}</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${
                                    item.caseType === 'Hình sự' ? 'bg-red-50 text-red-700 border-red-200' :
                                    item.caseType === 'Dân sự' ? 'bg-green-50 text-green-700 border-green-200' :
                                    item.caseType === 'Hành chính' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}>{item.caseType || "Hình sự"}</span>
                                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${item.status === 'done' ? 'bg-green-50 text-green-700 border-green-200' : item.status === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                    {item.status === 'pending' ? 'Chờ xử' : item.status === 'processing' ? 'Đang xử' : 'Đã xong'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 align-top">
                                <div className="font-black uppercase text-sm mb-3 text-gray-800 group-hover:text-blue-800 transition-colors">{item.caseName}</div>
                                <div className="bg-gray-50 p-2.5 rounded-lg border border-dashed border-gray-200 mb-3 shadow-sm">
                                   <p className="text-[9px] text-gray-500 italic"><strong className="text-gray-400">Tạo:</strong> {item.createdBy || "N/A"} ({item.createdAt ? moment(item.createdAt).format("HH:mm DD/MM") : ""})</p>
                                   <p className="text-[9px] text-blue-600 italic mt-0.5"><strong className="text-blue-400">Sửa:</strong> {item.updatedBy || "N/A"} ({item.updatedAt ? moment(item.updatedAt).format("HH:mm DD/MM") : ""})</p>
                                </div>
                                <div className="text-xs text-gray-600 bg-white p-2.5 rounded-lg border border-gray-100 space-y-1">
                                  <p><strong className="text-gray-400 uppercase font-bold text-[10px]">NĐ:</strong> {item.plaintiff}</p>
                                  <p><strong className="text-gray-400 uppercase font-bold text-[10px]">BĐ:</strong> {item.defendant}</p>
                                </div>
                              </td>
                              <td className="p-4 text-xs align-top text-gray-700">
                                <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                  <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-400 font-bold w-12 inline-block">TP:</span> <span className="font-bold text-gray-900">{item.judge}</span></p>
                                  <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-400 font-bold w-12 inline-block">HT:</span> {item.juror1}, {item.juror2}</p>
                                  <p className="border-b border-gray-200 pb-1.5"><span className="text-gray-400 font-bold w-12 inline-block">TK:</span> {item.clerk}</p>
                                  <p className="pt-0.5"><span className="text-gray-400 font-bold w-12 inline-block">KSV:</span> <span className="text-red-600 font-bold">{item.prosecutor}</span></p>
                                </div>
                              </td>
                              
                              {/* Cột Thao tác (Chỉ Admin và Thư ký thấy) */}
                              {canEdit && (
                                <td className="p-4 text-center align-middle" onClick={e => e.stopPropagation()}>
                                  <div className="flex flex-col items-center gap-2">
                                    <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top: 0, behavior: 'smooth'});}} className="w-full bg-white text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-blue-50 transition-colors shadow-sm">Sửa</button>
                                    {userRole === 'admin' ? (
                                      <button onClick={async () => {if(confirm("Xác nhận xóa hồ sơ này?")){await deleteDoc(doc(db,"schedule",item.id)); loadData(); showToast("Đã xóa hồ sơ", "success");}}} className="w-full bg-white text-red-500 border border-red-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-red-50 transition-colors shadow-sm">Xóa</button>
                                    ) : (
                                      <span className="text-[9px] text-gray-400 uppercase font-bold border border-dashed border-gray-200 w-full py-1.5 rounded-lg bg-gray-50 cursor-not-allowed">🔒 Khóa xóa</span>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                          {schedule.length === 0 && (
                            <tr><td colSpan={!canEdit ? "3" : "4"} className="p-16 text-center text-gray-400 font-bold text-sm bg-white">Chưa có lịch xét xử nào được ghi nhận.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </>
      )}
    </div>
  );
}