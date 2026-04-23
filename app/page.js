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
    } catch (error) { showToast("Lỗi tải dữ liệu", "error"); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      showToast("Đăng nhập thành công!", "success");
    } catch (err) { showToast("Lỗi đăng nhập", "error"); } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (userRole === 'thamphan' || userRole === 'viewer') return showToast("Không có quyền!", "error");
    if (!form.datetime || !form.caseName || !form.room) return showToast("Vui lòng nhập đủ Ngày giờ, Địa điểm và Tên vụ án!", "error");
    
    const logData = { ...form, updatedAt: moment().toISOString(), updatedBy: user.email };
    try {
      if (editingId) {
        await updateDoc(doc(db, "schedule", editingId), logData);
        showToast("💾 Đã cập nhật hồ sơ!", "success");
      } else {
        await addDoc(collection(db, "schedule"), { ...logData, createdAt: moment().toISOString(), createdBy: user.email });
        showToast("✅ Đã thêm lịch mới!", "success");
      }
      setForm(initialForm); setEditingId(null); loadData();
    } catch (err) { showToast("Lỗi khi lưu", "error"); }
  };

  const exportToExcel = () => {
    if (schedule.length === 0) return showToast("Không có dữ liệu để xuất!", "error");
    const headers = ["Ngày", "Giờ", "Phòng", "Loại án", "Vụ án", "Nguyên đơn", "Bị đơn", "Thẩm phán", "Thư ký", "Trạng thái"];
    const dataToExport = schedule.filter(i => i.caseName.toLowerCase().includes(searchQuery.toLowerCase()));
    const dataRows = dataToExport.map(item => [
      moment(item.datetime).format("DD/MM/YYYY"), moment(item.datetime).format("HH:mm"), item.room,
      item.caseType, item.caseName, item.plaintiff, item.defendant, item.judge, item.clerk, item.status
    ]);
    const csvContent = "\uFEFF" + [headers, ...dataRows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Lich_Xet_Xu.csv`; link.click();
  };

  const isRoomConflict = schedule.some(item => item.datetime === form.datetime && item.room === form.room && item.id !== editingId);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-blue-900">Đang khởi tạo hệ thống...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-cover bg-center" style={{ backgroundImage: "url('/toaan.jpg')" }}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 w-full max-w-[480px] bg-black/60 backdrop-blur-md p-10 shadow-2xl text-white text-center rounded-xl border border-white/10">
          <img src="/logo-toaan.png" alt="Logo" className="w-28 h-28 mx-auto mb-4" />
          <h2 className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Tòa Án Nhân Dân Cần Thơ</h2>
          <h1 className="text-xl font-black uppercase mb-8">Tòa Án Nhân Dân Khu Vực 9</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Tài khoản (Email)..." value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-4 py-3 bg-white text-black rounded outline-none focus:ring-2 focus:ring-blue-500" required />
            <input type="password" placeholder="Mật khẩu..." value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full px-4 py-3 bg-white text-black rounded outline-none focus:ring-2 focus:ring-blue-500" required />
            <button type="submit" className="w-full bg-blue-700 py-3.5 rounded font-black uppercase hover:bg-blue-600 transition-all shadow-lg">Đăng Nhập Hệ Thống</button>
          </form>
        </div>
      </div>
    );
  }

  const canEdit = userRole === 'admin' || userRole === 'thuky';

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-800 relative">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white hidden xl:flex flex-col fixed h-screen shadow-2xl z-20">
        <div className="p-6 text-center border-b border-blue-800">
          <span className="text-4xl block mb-2">⚖️</span>
          <h2 className="font-black text-lg uppercase tracking-tighter">TAND KV9</h2>
        </div>
        <div className="p-4 flex-1">
          <div className="bg-blue-800 px-4 py-3 rounded-lg font-bold border border-blue-700">📅 Lịch xét xử</div>
        </div>
        <div className="p-4 border-t border-blue-800">
          <div className="bg-blue-950 p-3 rounded-lg mb-3">
            <p className="text-[10px] text-blue-400 font-bold uppercase">{userRole}</p>
            <p className="text-xs truncate">{user.email}</p>
          </div>
          <button onClick={() => signOut(auth)} className="w-full bg-red-500 py-2 rounded text-xs font-bold uppercase hover:bg-red-600 transition-colors">Đăng xuất</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 xl:ml-64 flex flex-col min-h-screen">
        <header className="bg-white h-16 shadow-sm border-b flex items-center px-6 sticky top-0 z-10 justify-between">
          <h1 className="font-black uppercase text-blue-900 text-sm">Hệ thống quản lý lịch trực tuyến</h1>
          <div className="text-[10px] font-bold bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-200">Trạng thái: Sẵn sàng</div>
        </header>

        <div className="p-6 lg:p-8 flex-1">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* FORM ĐĂNG KÝ (Dành cho Admin/Thư ký) */}
            {canEdit && (
              <div className="xl:col-span-4">
                <div className="bg-white p-6 rounded-2xl border shadow-sm sticky top-24">
                  <h2 className="font-black text-blue-900 uppercase mb-6 border-b pb-4 flex justify-between items-center">
                    <span>{editingId ? "✏️ Cập nhật" : "➕ Đăng ký mới"}</span>
                    {editingId && <button onClick={() => {setEditingId(null); setForm(initialForm)}} className="text-[9px] bg-gray-100 px-2 py-1 rounded">Hủy</button>}
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ngày giờ xử</label>
                        <input type="datetime-local" value={form.datetime} onChange={e => setForm({...form, datetime: e.target.value})} className="w-full border p-2 rounded bg-gray-50 text-sm font-bold outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nơi xét xử</label>
                        <select value={form.room} onChange={e => setForm({...form, room: e.target.value})} className="w-full border p-2 rounded bg-gray-50 text-sm font-bold outline-none">
                          <option value="Trụ sở">Trụ sở</option>
                          <option value="Chi nhánh">Chi nhánh</option>
                          <option value="Dự phòng">Dự phòng</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Loại án xét xử</label>
                      <select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value})} className="w-full border p-2 rounded text-sm font-bold outline-none">
                        <option value="Hình sự">🚨 Hình sự</option>
                        <option value="Dân sự">🤝 Dân sự</option>
                        <option value="Hành chính">🏢 Hành chính</option>
                        <option value="Hôn nhân & GĐ">💍 Hôn nhân & Gia đình</option>
                        <option value="Kinh tế">💰 Kinh tế</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tên vụ án / Tội danh</label>
                      <textarea value={form.caseName} onChange={e => setForm({...form, caseName: e.target.value})} className="w-full border p-2 rounded text-sm font-bold outline-none focus:border-blue-500" rows="2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder="Nguyên đơn..." value={form.plaintiff} onChange={e => setForm({...form, plaintiff: e.target.value})} className="border p-2 rounded text-xs outline-none" />
                      <input placeholder="Bị đơn..." value={form.defendant} onChange={e => setForm({...form, defendant: e.target.value})} className="border p-2 rounded text-xs outline-none" />
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl space-y-2 border border-blue-100">
                      <p className="text-[9px] font-black text-blue-900 uppercase text-center mb-1">Hội đồng & Thư ký</p>
                      <input placeholder="Thẩm phán chủ tọa" value={form.judge} onChange={e => setForm({...form, judge: e.target.value})} className="w-full p-2 border rounded text-xs font-bold outline-none" />
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Hội thẩm 1" value={form.juror1} onChange={e => setForm({...form, juror1: e.target.value})} className="p-2 border rounded text-xs outline-none" />
                        <input placeholder="Hội thẩm 2" value={form.juror2} onChange={e => setForm({...form, juror2: e.target.value})} className="p-2 border rounded text-xs outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Thư ký tòa" value={form.clerk} onChange={e => setForm({...form, clerk: e.target.value})} className="p-2 border rounded text-xs outline-none" />
                        <input placeholder="Kiểm sát viên" value={form.prosecutor} onChange={e => setForm({...form, prosecutor: e.target.value})} className="p-2 border rounded text-xs font-bold text-red-600 outline-none" />
                      </div>
                    </div>

                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full border p-2 rounded font-black text-xs uppercase outline-none">
                      <option value="pending">🟡 Chờ xét xử</option>
                      <option value="processing">🔵 Đang xét xử</option>
                      <option value="done">🟢 Đã hoàn thành</option>
                    </select>

                    <button onClick={handleSubmit} disabled={isRoomConflict} className={`w-full text-white font-black py-4 rounded-xl uppercase text-xs mt-2 shadow-lg transition-all ${isRoomConflict ? 'bg-gray-400' : 'bg-blue-900 hover:bg-blue-800'}`}>
                      {editingId ? "Lưu cập nhật" : "Đăng ký lịch"}
                    </button>
                    {isRoomConflict && <p className="text-red-500 text-[9px] font-bold text-center mt-2">⚠️ Trùng lịch tại địa điểm này!</p>}
                  </div>
                </div>
              </div>
            )}

            {/* DANH SÁCH & LỊCH */}
            <div className={`space-y-6 ${!canEdit ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
              <div className="bg-white p-5 rounded-2xl border shadow-sm h-[400px]">
                <Calendar 
                   localizer={localizer} 
                   events={schedule.map(i => ({...i, title: `[${i.room}] ${i.caseName}`, start: new Date(i.datetime), end: new Date(new Date(i.datetime).getTime() + 3600000)}))} 
                   style={{ height: "100%" }} 
                   onSelectEvent={e => setSelectedEvent(e)}
                />
              </div>

              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                  <h3 className="font-black uppercase text-xs text-blue-900">📋 Sổ thụ lý điện tử</h3>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Tìm vụ án..." onChange={e => setSearchQuery(e.target.value)} className="border px-3 py-1.5 rounded-lg text-[10px] w-40 outline-none" />
                    <button onClick={exportToExcel} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase">Xuất Excel</button>
                  </div>
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-[9px] font-black uppercase text-gray-500 border-b">
                      <tr>
                        <th className="p-4">Thời gian / Nơi xử</th>
                        <th className="p-4">Nội dung vụ án</th>
                        <th className="p-4">Hội đồng & Thư ký</th>
                        {canEdit && <th className="p-4 text-center">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y text-[11px]">
                      {schedule.filter(i => i.caseName.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                        <tr key={item.id} className="hover:bg-blue-50 bg-white cursor-pointer" onClick={() => setSelectedEvent(item)}>
                          <td className="p-4">
                            <div className="font-black text-gray-900">{moment(item.datetime).format("DD/MM/YYYY")}</div>
                            <div className="text-blue-700 font-bold">🕒 {moment(item.datetime).format("HH:mm")}</div>
                            <div className="mt-1 font-bold text-gray-500">{item.room}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-black uppercase text-gray-800 leading-snug">{item.caseName}</div>
                            <div className="mt-2 flex gap-2">
                                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase">{item.caseType}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${item.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {item.status === 'pending' ? 'Chờ xử' : item.status === 'processing' ? 'Đang xử' : 'Đã xong'}
                                </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <p><span className="text-gray-400 font-bold">TP:</span> <span className="font-bold">{item.judge}</span></p>
                            <p><span className="text-gray-400 font-bold">TK:</span> {item.clerk}</p>
                            <p><span className="text-gray-400 font-bold">KSV:</span> <span className="text-red-600">{item.prosecutor}</span></p>
                          </td>
                          {canEdit && (
                            <td className="p-4" onClick={e => e.stopPropagation()}>
                              <div className="flex flex-col gap-1.5">
                                <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded font-bold uppercase text-[8px] hover:bg-blue-600 hover:text-white">Sửa</button>
                                {userRole === 'admin' && (
                                  <button onClick={async () => {if(confirm("Xác nhận xóa?")) {await deleteDoc(doc(db,"schedule",item.id)); loadData()}}} className="bg-white border border-red-200 text-red-700 px-2 py-1 rounded font-bold uppercase text-[8px] hover:bg-red-600 hover:text-white">Xóa</button>
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

      {/* Modal chi tiết vụ án */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setSelectedEvent(null)}>
           <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="bg-blue-900 p-5 text-white">
                <h3 className="text-sm font-black uppercase">{selectedEvent.caseName}</h3>
              </div>
              <div className="p-6 space-y-3 text-xs">
                <p><strong>🕒 Thời gian:</strong> {moment(selectedEvent.datetime).format("HH:mm - DD/MM/YYYY")}</p>
                <p><strong>🏢 Địa điểm:</strong> {selectedEvent.room}</p>
                <hr/>
                <p><strong>👨‍⚖️ Thẩm phán:</strong> {selectedEvent.judge}</p>
                <p><strong>⚖️ Hội thẩm:</strong> {selectedEvent.juror1}, {selectedEvent.juror2}</p>
                <p><strong>📝 Thư ký:</strong> {selectedEvent.clerk}</p>
                <p><strong>🛡️ Kiểm sát viên:</strong> {selectedEvent.prosecutor}</p>
                <button onClick={() => setSelectedEvent(null)} className="w-full bg-blue-900 text-white py-3 rounded-xl font-bold uppercase mt-4">Đóng</button>
              </div>
           </div>
        </div>
      )}

      {/* Toast thông báo */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-[200] px-6 py-3 rounded-xl shadow-lg font-bold text-xs text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}