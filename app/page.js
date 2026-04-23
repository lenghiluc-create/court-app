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
    datetime: "", room: "Trụ sở", caseType: "Hình sự", trialCount: "Lần 1", caseName: "", 
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
    if (!form.datetime || !form.caseName || !form.room) return showToast("Vui lòng nhập đủ thông tin!", "error");
    
    const logData = { ...form, updatedAt: moment().toISOString(), updatedBy: user.email };
    try {
      if (editingId) {
        await updateDoc(doc(db, "schedule", editingId), logData);
        showToast("💾 Cập nhật thành công!", "success");
      } else {
        await addDoc(collection(db, "schedule"), { ...logData, createdAt: moment().toISOString(), createdBy: user.email });
        showToast("✅ Thêm mới thành công!", "success");
      }
      setForm(initialForm); setEditingId(null); loadData();
    } catch (err) { showToast("Lỗi khi lưu", "error"); }
  };

  const isRoomConflict = schedule.some(item => item.datetime === form.datetime && item.room === form.room && item.id !== editingId);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-2xl text-blue-900 animate-pulse">Hệ thống đang khởi động...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-cover bg-center" style={{ backgroundImage: "url('/toaan.jpg')" }}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 w-full max-w-[480px] bg-black/60 backdrop-blur-md p-10 shadow-2xl text-white text-center rounded-xl border border-white/10">
          <img src="/logo-toaan.png" alt="Logo" className="w-28 h-28 mx-auto mb-4" />
          <h1 className="text-2xl font-black uppercase mb-8 tracking-tighter">TAND Khu Vực 9</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email..." value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-4 py-3 bg-white text-black rounded text-lg outline-none shadow-inner" required />
            <input type="password" placeholder="Mật khẩu..." value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full px-4 py-3 bg-white text-black rounded text-lg outline-none shadow-inner" required />
            <button type="submit" className="w-full bg-blue-700 py-4 rounded font-black uppercase hover:bg-blue-600 text-lg transition-all shadow-lg">Đăng Nhập</button>
          </form>
        </div>
      </div>
    );
  }

  const canEdit = userRole === 'admin' || userRole === 'thuky';

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-800 relative">
      {/* Sidebar */}
      <aside className="w-72 bg-blue-900 text-white hidden xl:flex flex-col fixed h-screen shadow-2xl">
        <div className="p-8 text-center border-b border-blue-800">
          <span className="text-5xl block mb-4">⚖️</span>
          <h2 className="font-black text-2xl uppercase tracking-widest leading-tight">TAND<br/>KV9</h2>
        </div>
        <div className="p-6 flex-1">
          <div className="bg-blue-800 px-6 py-4 rounded-xl font-bold text-lg border border-blue-700 shadow-inner">📅 Lịch xét xử</div>
        </div>
        <div className="p-6 border-t border-blue-800">
          <p className="text-[10px] text-blue-400 font-black uppercase mb-1">Quyền: {userRole}</p>
          <p className="text-sm truncate mb-6 opacity-80">{user.email}</p>
          <button onClick={() => signOut(auth)} className="w-full bg-red-600 py-3 rounded-lg font-bold uppercase hover:bg-red-700 transition-colors shadow-md text-sm">Đăng xuất</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 xl:ml-72 flex flex-col min-h-screen">
        <header className="bg-white h-20 shadow-sm border-b flex items-center px-8 sticky top-0 z-10 justify-between">
          <h1 className="font-black text-2xl uppercase text-blue-900 tracking-tight">Hệ thống quản lý lịch trực tuyến</h1>
        </header>

        <div className="p-8 lg:p-10 flex-1">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            
            {/* CỘT TRÁI: FORM ĐĂNG KÝ */}
            {canEdit && (
              <div className="xl:col-span-4">
                <div className="bg-white p-8 rounded-3xl border shadow-xl sticky top-28 border-gray-100">
                  <h2 className="font-black text-2xl text-blue-900 uppercase mb-8 border-b-4 border-blue-600 w-fit pb-2">
                    {editingId ? "✏️ Cập nhật" : "➕ Đăng ký lịch"}
                  </h2>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Ngày giờ xử</label>
                        <input type="datetime-local" value={form.datetime} onChange={e => setForm({...form, datetime: e.target.value})} className="w-full border-2 border-gray-100 p-3 rounded-xl bg-gray-50 text-base font-black outline-none focus:border-blue-500 transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Nơi xét xử</label>
                        <select value={form.room} onChange={e => setForm({...form, room: e.target.value})} className="w-full border-2 border-gray-100 p-3 rounded-xl bg-gray-50 text-base font-black outline-none focus:border-blue-500">
                          <option value="Trụ sở">🏢 Trụ sở</option>
                          <option value="Chi nhánh">🏠 Chi nhánh</option>
                          <option value="Dự phòng">🔄 Dự phòng</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Loại vụ việc</label>
                        <select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value})} className="w-full border-2 border-gray-100 p-3 rounded-xl text-base font-black outline-none focus:border-blue-500">
                          <option value="Hình sự">🚨 Hình sự</option>
                          <option value="Dân sự">🤝 Dân sự</option>
                          <option value="Hành chính">🏢 Hành chính</option>
                          <option value="Hôn nhân & GĐ">💍 Hôn nhân & GĐ</option>
                          <option value="Kinh tế">💰 Kinh tế</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Lần xét xử</label>
                        <select value={form.trialCount} onChange={e => setForm({...form, trialCount: e.target.value})} className="w-full border-2 border-blue-100 p-3 rounded-xl text-base font-black outline-none bg-blue-50 text-blue-900 focus:border-blue-500">
                          <option value="Lần 1">Lần 1</option>
                          <option value="Lần 2">Lần 2</option>
                          <option value="Mở lại phiên tòa">🔄 Mở lại phiên tòa</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-2">Tên vụ án / Tội danh</label>
                      <textarea value={form.caseName} onChange={e => setForm({...form, caseName: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-xl text-lg font-black outline-none focus:border-blue-500 transition-all" rows="2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder="Nguyên đơn..." value={form.plaintiff} onChange={e => setForm({...form, plaintiff: e.target.value})} className="border-2 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" />
                      <input placeholder="Bị đơn..." value={form.defendant} onChange={e => setForm({...form, defendant: e.target.value})} className="border-2 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500" />
                    </div>

                    <div className="bg-blue-50 p-6 rounded-3xl space-y-4 border-2 border-blue-100 shadow-inner">
                      <p className="text-[10px] font-black text-blue-900 uppercase text-center tracking-widest border-b border-blue-200 pb-2">Hội đồng xét xử & Thư ký</p>
                      <input placeholder="Thẩm phán chủ tọa" value={form.judge} onChange={e => setForm({...form, judge: e.target.value})} className="w-full p-3 border-2 border-white rounded-xl text-base font-black outline-none focus:border-blue-500 shadow-sm" />
                      <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Hội thẩm 1" value={form.juror1} onChange={e => setForm({...form, juror1: e.target.value})} className="p-3 border-2 border-white rounded-xl text-sm font-bold outline-none focus:border-blue-500" />
                        <input placeholder="Hội thẩm 2" value={form.juror2} onChange={e => setForm({...form, juror2: e.target.value})} className="p-3 border-2 border-white rounded-xl text-sm font-bold outline-none focus:border-blue-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Thư ký tòa án" value={form.clerk} onChange={e => setForm({...form, clerk: e.target.value})} className="p-3 border-2 border-white rounded-xl text-sm font-bold outline-none focus:border-blue-500" />
                        <input placeholder="Kiểm sát viên" value={form.prosecutor} onChange={e => setForm({...form, prosecutor: e.target.value})} className="p-3 border-2 border-white rounded-xl text-sm font-black text-red-600 outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    <button onClick={handleSubmit} disabled={isRoomConflict} className={`w-full text-white font-black py-5 rounded-2xl uppercase text-lg mt-4 shadow-2xl transition-all transform active:scale-95 ${isRoomConflict ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'}`}>
                      {editingId ? "💾 Lưu cập nhật hồ sơ" : "✅ Đăng ký hệ thống"}
                    </button>
                    {isRoomConflict && <p className="text-red-600 text-xs font-black text-center mt-2 animate-bounce italic">⚠️ CẢNH BÁO: Trùng lịch tại địa điểm này!</p>}
                  </div>
                </div>
              </div>
            )}

            {/* CỘT PHẢI: DANH SÁCH SỔ THỤ LÝ */}
            <div className={`space-y-10 ${!canEdit ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
              
              <div className="bg-white p-6 rounded-3xl border shadow-xl h-[450px] border-gray-100">
                <Calendar 
                   localizer={localizer} 
                   events={schedule.map(i => ({...i, title: `[${i.room}] ${i.caseName}`, start: new Date(i.datetime), end: new Date(new Date(i.datetime).getTime() + 3600000)}))} 
                   style={{ height: "100%" }} 
                   onSelectEvent={e => setSelectedEvent(e)}
                />
              </div>

              <div className="bg-white rounded-3xl border shadow-xl overflow-hidden flex flex-col h-[750px] border-gray-100">
                <div className="p-6 border-b-2 border-gray-50 flex justify-between items-center sticky top-0 bg-white z-10">
                  <h3 className="font-black uppercase text-2xl text-blue-900 flex items-center gap-3">📋 Sổ thụ lý điện tử</h3>
                  <div className="relative">
                    <input type="text" placeholder="Tìm kiếm vụ án..." onChange={e => setSearchQuery(e.target.value)} className="border-2 border-gray-100 px-6 py-3 rounded-2xl text-base w-80 focus:border-blue-600 outline-none shadow-sm transition-all" />
                  </div>
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-blue-900 text-white text-xs font-black uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="p-6">Thời gian & Địa điểm</th>
                        <th className="p-6">Chi tiết vụ án</th>
                        <th className="p-6">Hội đồng xét xử</th>
                        {canEdit && <th className="p-6 text-center">Quản lý</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-gray-50 text-sm">
                      {schedule.filter(i => i.caseName.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                        <tr key={item.id} className="hover:bg-blue-50/50 bg-white transition-all cursor-pointer group" onClick={() => setSelectedEvent(item)}>
                          <td className="p-6">
                            <div className="font-black text-gray-900 text-xl tracking-tighter">{moment(item.datetime).format("DD/MM/YYYY")}</div>
                            <div className="text-blue-700 font-black text-lg mt-1 flex items-center gap-2">🕒 {moment(item.datetime).format("HH:mm")}</div>
                            <div className="mt-3 inline-block bg-gray-100 px-3 py-1 rounded-lg font-black text-gray-500 uppercase text-[10px]">{item.room}</div>
                          </td>
                          <td className="p-6">
                            <div className="font-black uppercase text-gray-800 text-lg leading-tight mb-4 group-hover:text-blue-900 transition-colors">{item.caseName}</div>
                            <div className="flex gap-3 items-center">
                                <span className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-sm border border-blue-200">{item.caseType}</span>
                                <span className="bg-amber-100 text-amber-800 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-sm border border-amber-200">{item.trialCount || "Lần 1"}</span>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="space-y-3">
                                {/* Thẩm phán */}
                                <div className="flex items-start gap-2">
                                    <span className="text-[10px] font-black bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded mt-1">TP</span>
                                    <span className="font-black text-gray-900 text-base">{item.judge}</span>
                                </div>
                                {/* Hội thẩm */}
                                <div className="flex items-start gap-2">
                                    <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded mt-0.5">HT</span>
                                    <div className="text-xs font-bold text-gray-600 leading-relaxed italic">
                                        {item.juror1} <br/> {item.juror2}
                                    </div>
                                </div>
                                {/* Thư ký - BỔ SUNG MỚI */}
                                <div className="flex items-start gap-2">
                                    <span className="text-[10px] font-black bg-green-100 text-green-600 px-1.5 py-0.5 rounded mt-0.5">TK</span>
                                    <span className="text-xs font-bold text-gray-700">{item.clerk}</span>
                                </div>
                                {/* Kiểm sát viên */}
                                <div className="flex items-start gap-2 border-t pt-2 border-gray-50">
                                    <span className="text-[10px] font-black bg-red-50 text-red-600 px-1.5 py-0.5 rounded mt-0.5">KS</span>
                                    <span className="text-xs font-black text-red-700">{item.prosecutor}</span>
                                </div>
                            </div>
                          </td>
                          {canEdit && (
                            <td className="p-6" onClick={e => e.stopPropagation()}>
                              <div className="flex flex-col gap-3">
                                <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="bg-white border-2 border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl font-black uppercase text-[10px] hover:bg-blue-900 hover:text-white transition-all shadow-sm">Sửa hồ sơ</button>
                                {userRole === 'admin' && (
                                  <button onClick={async () => {if(confirm("❗ XÁC NHẬN XÓA VĨNH VIỄN?")) {await deleteDoc(doc(db,"schedule",item.id)); loadData()}}} className="bg-white border-2 border-red-200 text-red-600 px-4 py-2.5 rounded-xl font-black uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all shadow-sm">Xóa hồ sơ</button>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-6" onClick={() => setSelectedEvent(null)}>
           <div className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl scale-110 transition-transform border-4 border-white" onClick={e => e.stopPropagation()}>
              <div className="bg-blue-900 p-10 text-white text-center">
                <div className="flex justify-center gap-3 mb-4">
                    <span className="bg-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">{selectedEvent.caseType}</span>
                    <span className="bg-amber-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">{selectedEvent.trialCount}</span>
                </div>
                <h3 className="text-3xl font-black uppercase leading-tight tracking-tight">{selectedEvent.caseName}</h3>
              </div>
              <div className="p-10 space-y-6 text-lg">
                <div className="grid grid-cols-2 gap-8 border-b-2 border-gray-50 pb-6">
                    <div>
                        <p className="text-xs font-black text-gray-400 uppercase mb-1">Thời gian xét xử</p>
                        <p className="font-black text-blue-900">{moment(selectedEvent.datetime).format("HH:mm - DD/MM/YYYY")}</p>
                    </div>
                    <div>
                        <p className="text-xs font-black text-gray-400 uppercase mb-1">Phòng xét xử</p>
                        <p className="font-black text-gray-900">{selectedEvent.room}</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <p className="flex justify-between items-center"><strong className="text-sm font-black text-gray-400 uppercase">Thẩm phán:</strong> <span className="font-black text-xl text-gray-900">{selectedEvent.judge}</span></p>
                    <p className="flex justify-between items-start"><strong className="text-sm font-black text-gray-400 uppercase mt-1">Hội thẩm:</strong> <span className="font-bold text-right leading-snug">{selectedEvent.juror1} <br/> {selectedEvent.juror2}</span></p>
                    <p className="flex justify-between items-center"><strong className="text-sm font-black text-gray-400 uppercase">Thư ký:</strong> <span className="font-bold text-green-700">{selectedEvent.clerk}</span></p>
                    <p className="flex justify-between items-center"><strong className="text-sm font-black text-gray-400 uppercase">Kiểm sát viên:</strong> <span className="font-black text-red-600">{selectedEvent.prosecutor}</span></p>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="w-full bg-blue-900 text-white py-5 rounded-2xl font-black uppercase mt-8 shadow-xl hover:bg-blue-800 transition-all">Đóng chi tiết</button>
              </div>
           </div>
        </div>
      )}

      {toast.show && (
        <div className={`fixed bottom-10 right-10 z-[200] px-10 py-5 rounded-[20px] shadow-2xl font-black text-base text-white animate-bounce flex items-center gap-3 border-4 border-white/20 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}