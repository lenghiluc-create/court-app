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
    if (userRole === 'thamphan' || userRole === 'viewer') return showToast("Bạn không có quyền!", "error");
    if (!form.datetime || !form.caseName || !form.room) return showToast("Thiếu thông tin bắt buộc!", "error");
    
    const logData = { ...form, updatedAt: moment().toISOString(), updatedBy: user.email };

    try {
      if (editingId) {
        await updateDoc(doc(db, "schedule", editingId), logData);
        showToast("💾 Đã cập nhật!", "success");
      } else {
        await addDoc(collection(db, "schedule"), { ...logData, createdAt: moment().toISOString(), createdBy: user.email });
        showToast("✅ Đã thêm mới!", "success");
      }
      setForm(initialForm);
      setEditingId(null);
      loadData();
    } catch (err) { showToast("Lỗi: " + err.message, "error"); }
  };

  const exportToExcel = () => {
    if (schedule.length === 0) return showToast("Không có dữ liệu!", "error");
    const headers = ["Ngày", "Giờ", "Phòng", "Loại án", "Tên vụ án", "Nguyên đơn", "Bị đơn", "Thẩm phán", "Hội thẩm 1", "Hội thẩm 2", "Thư ký", "KSV", "Trạng thái", "Tạo bởi", "Cập nhật"];
    const dataToExport = schedule.filter(i => i.caseName.toLowerCase().includes(searchQuery.toLowerCase()));
    const dataRows = dataToExport.map(item => [
      moment(item.datetime).format("DD/MM/YYYY"), moment(item.datetime).format("HH:mm"), item.room,
      item.caseType, item.caseName, item.plaintiff, item.defendant, item.judge, item.juror1, item.juror2, item.clerk, item.prosecutor, item.status, item.createdBy, item.updatedBy
    ]);
    const csvContent = "\uFEFF" + [headers, ...dataRows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Lich_Xet_Xu.csv`;
    link.click();
  };

  const isRoomConflict = schedule.some(item => item.datetime === form.datetime && item.room === form.room && item.id !== editingId);

  if (loading) return <div className="p-10 text-center font-bold">Đang tải hệ thống...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-blue-900 bg-cover bg-center" style={{ backgroundImage: "url('/toaan.jpg')" }}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 w-full max-w-[480px] bg-black/60 backdrop-blur-md p-10 shadow-2xl text-white text-center rounded-xl border border-white/10">
          <img src="/logo-toaan.png" alt="Logo" className="w-28 h-28 mx-auto mb-4" />
          <h2 className="text-xs font-bold uppercase mb-2">Tòa Án Nhân Dân Cần Thơ</h2>
          <h1 className="text-xl font-black uppercase mb-8">Tòa Án Nhân Dân Khu Vực 9</h1>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <input type="email" placeholder="Tài Khoản..." value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-4 py-3 bg-white text-gray-900 rounded outline-none" required />
            <input type="password" placeholder="Mật Khẩu..." value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full px-4 py-3 bg-white text-gray-900 rounded outline-none" required />
            <button type="submit" className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 rounded uppercase transition-all">Đăng Nhập</button>
          </form>
        </div>
      </div>
    );
  }

  const canEdit = userRole === 'admin' || userRole === 'thuky';

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-800 relative">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white hidden xl:flex flex-col fixed h-screen shadow-2xl">
        <div className="p-6 text-center border-b border-blue-800">
          <span className="text-4xl block mb-2">⚖️</span>
          <h2 className="font-black text-lg uppercase">TAND KV9</h2>
        </div>
        <div className="p-4 flex-1">
          <div className="bg-blue-800 px-4 py-3 rounded-lg font-bold">📅 Lịch xét xử</div>
        </div>
        <div className="p-4 border-t border-blue-800">
          <div className="bg-blue-950 p-3 rounded-lg mb-3">
            <p className="text-[10px] text-blue-400 uppercase font-bold">{userRole}</p>
            <p className="text-xs truncate">{user.email}</p>
          </div>
          <button onClick={() => signOut(auth)} className="w-full bg-red-500 py-2 rounded text-xs font-bold uppercase">Đăng xuất</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 xl:ml-64 flex flex-col min-h-screen">
        <header className="bg-white h-16 shadow-sm border-b flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="font-black uppercase text-gray-800">Hệ thống quản lý lịch trực tuyến</h1>
        </header>

        <div className="p-6 lg:p-8 flex-1">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Form Nhập Liệu */}
            {canEdit && (
              <div className="xl:col-span-4">
                <div className="bg-white p-6 rounded-2xl border shadow-sm sticky top-24">
                  <h2 className="font-black text-blue-900 uppercase mb-6 border-b pb-4">
                    {editingId ? "✏️ Cập nhật hồ sơ" : "➕ Thêm lịch mới"}
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Thời gian</label>
                        <input type="datetime-local" value={form.datetime} onChange={e => setForm({...form, datetime: e.target.value})} className="w-full border p-2 rounded bg-gray-50 text-sm font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Phòng xử</label>
                        <select value={form.room} onChange={e => setForm({...form, room: e.target.value})} className="w-full border p-2 rounded bg-gray-50 text-sm font-bold">
                          <option value="Trụ sở">Trụ sở</option>
                          <option value="Chi nhánh">Chi nhánh</option>
                          <option value="Dự phòng">Dự phòng</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Loại án</label>
                      <select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value})} className="w-full border p-2 rounded text-sm font-bold">
                        <option value="Hình sự">Hình sự</option>
                        <option value="Dân sự">Dân sự</option>
                        <option value="Hành chính">Hành chính</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Vụ án / Tội danh</label>
                      <textarea value={form.caseName} onChange={e => setForm({...form, caseName: e.target.value})} className="w-full border p-2 rounded text-sm" rows="2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder="Nguyên đơn..." value={form.plaintiff} onChange={e => setForm({...form, plaintiff: e.target.value})} className="border p-2 rounded text-xs" />
                      <input placeholder="Bị đơn..." value={form.defendant} onChange={e => setForm({...form, defendant: e.target.value})} className="border p-2 rounded text-xs" />
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl space-y-2">
                      <input placeholder="Thẩm phán" value={form.judge} onChange={e => setForm({...form, judge: e.target.value})} className="w-full p-2 border rounded text-xs" />
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Hội thẩm 1" value={form.juror1} onChange={e => setForm({...form, juror1: e.target.value})} className="p-2 border rounded text-xs" />
                        <input placeholder="Hội thẩm 2" value={form.juror2} onChange={e => setForm({...form, juror2: e.target.value})} className="p-2 border rounded text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Thư ký" value={form.clerk} onChange={e => setForm({...form, clerk: e.target.value})} className="p-2 border rounded text-xs" />
                        <input placeholder="KSV" value={form.prosecutor} onChange={e => setForm({...form, prosecutor: e.target.value})} className="p-2 border rounded text-xs font-bold text-red-600" />
                      </div>
                    </div>

                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full border p-2 rounded font-bold text-sm uppercase">
                      <option value="pending">🟡 Chờ xét xử</option>
                      <option value="processing">🔵 Đang xử</option>
                      <option value="done">🟢 Đã hoàn thành</option>
                    </select>

                    <button onClick={handleSubmit} className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl uppercase text-sm shadow-md hover:bg-blue-800">
                      {editingId ? "💾 Lưu cập nhật" : "✅ Lưu vào hệ thống"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bảng Hiển Thị */}
            <div className={`space-y-6 ${!canEdit ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
              <div className="bg-white p-5 rounded-2xl border shadow-sm h-[400px]">
                <Calendar 
                   localizer={localizer} 
                   events={schedule.map(i => ({...i, title: `[P.${i.room}] ${i.caseName}`, start: new Date(i.datetime), end: new Date(new Date(i.datetime).getTime() + 3600000)}))} 
                   style={{ height: "100%" }} 
                   onSelectEvent={e => setSelectedEvent(e)}
                />
              </div>

              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                  <h3 className="font-black uppercase text-sm">📋 Sổ thụ lý trực tuyến</h3>
                  <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold uppercase">📥 Xuất Excel</button>
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-500">
                      <tr>
                        <th className="p-4">Thời gian</th>
                        <th className="p-4">Vụ án</th>
                        <th className="p-4">Nhân sự</th>
                        {canEdit && <th className="p-4 text-center">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                      {schedule.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="p-4">
                            <div className="font-bold">{moment(item.datetime).format("DD/MM/YYYY")}</div>
                            <div className="text-blue-600 font-bold">{moment(item.datetime).format("HH:mm")} - {item.room}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold uppercase text-blue-900">{item.caseName}</div>
                            <div className="text-[10px] text-gray-500 italic">Bị cáo: {item.defendant}</div>
                          </td>
                          <td className="p-4">
                            <div>TP: {item.judge}</div>
                            <div className="text-[10px] text-gray-400">TK: {item.clerk}</div>
                          </td>
                          {canEdit && (
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo(0,0)}} className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold uppercase text-[9px]">Sửa</button>
                                {userRole === 'admin' && (
                                  <button onClick={async () => {if(confirm("Xóa?")) {await deleteDoc(doc(db,"schedule",item.id)); loadData()}}} className="bg-red-100 text-red-700 px-2 py-1 rounded font-bold uppercase text-[9px]">Xóa</button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}