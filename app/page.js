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
    plaintiff: "", defendant: "", judge: "", clerk: "", juror1: "", juror2: "", 
    prosecutor: "", status: "pending"
  };
  const [form, setForm] = useState(initialForm);

  // PHÔNG CHỮ INTER VÀ CỠ CHỮ 16PX ĐỒNG NHẤT
  const textStyle = "text-[16px] font-bold text-gray-800";
  const inputBase = `w-full border-2 border-gray-200 p-4 rounded-2xl bg-gray-50 outline-none focus:border-blue-600 focus:bg-white transition-all ${textStyle}`;

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
    } catch (err) { showToast("Sai tài khoản hoặc mật khẩu", "error"); } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast("Đã đăng xuất hệ thống", "success");
    } catch (error) { showToast("Lỗi khi đăng xuất", "error"); }
  };

  const handleSubmit = async () => {
    if (userRole === 'thamphan' || userRole === 'viewer') return showToast("Không có quyền!", "error");
    if (!form.datetime || !form.caseName || !form.room) return showToast("Vui lòng nhập đủ thông tin!", "error");
    
    const logData = { ...form, updatedAt: moment().toISOString(), updatedBy: user.email };
    try {
      if (editingId) {
        await updateDoc(doc(db, "schedule", editingId), logData);
        showToast("💾 Đã cập nhật hồ sơ!", "success");
      } else {
        await addDoc(collection(db, "schedule"), { ...logData, createdAt: moment().toISOString(), createdBy: user.email });
        showToast("✅ Lưu lịch mới thành công!", "success");
      }
      setForm(initialForm); setEditingId(null); loadData();
    } catch (err) { showToast("Lỗi khi lưu dữ liệu", "error"); }
  };
const isRoomConflict = schedule.some(item => item.datetime === form.datetime && item.room === form.room && item.id !== editingId);
  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-2xl text-blue-900">ĐANG TẢI...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-cover bg-center font-sans" style={{ backgroundImage: "url('/toaan.jpg')" }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div className="relative z-10 w-full max-w-[480px] p-10 bg-white/10 backdrop-blur-md rounded-[40px] border border-white/20 text-white text-center shadow-2xl">
          <img 
            src="/logo-toa-an-nhan-dan-toi-cao.png" 
            alt="Logo" 
            className="mx-auto mb-6 drop-shadow-2xl" 
            style={{ width: '120px', height: '120px', objectFit: 'contain' }} 
          />
          <h1 className="text-3xl font-red uppercase mb-10 tracking-tight">TAND KHU VỰC 9- CẦN THƠ</h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <input type="email" placeholder="Email..." value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-6 py-4 bg-white text-black rounded-2xl outline-none text-xl font-bold" required />
            <input type="password" placeholder="Mật khẩu..." value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full px-6 py-4 bg-white text-black rounded-2xl outline-none text-xl font-bold" required />
            <button type="submit" className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase hover:bg-blue-500 text-xl shadow-xl transition-all">ĐĂNG NHẬP</button>
          </form>
        </div>
      </div>
    );
  }

  const canEdit = userRole === 'admin' || userRole === 'thuky';

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans antialiased tracking-tight">
      {/* SIDEBAR */}
      <aside className="w-80 bg-blue-950 text-white hidden xl:flex flex-col fixed h-screen shadow-2xl border-r border-blue-900">
        <div className="p-12 text-center border-b border-white/5">
          <div className="text-5xl mb-4">⚖️</div>
          <h2 className="font-black text-2xl uppercase tracking-tighter">TAND KV9</h2>
        </div>
        <div className="p-8 flex-1">
          <div className="bg-blue-600 px-6 py-4 rounded-2xl font-black text-xl shadow-lg shadow-blue-900/50">📅 LỊCH XÉT XỬ</div>
        </div>
        <div className="p-8 border-t border-white/5 bg-black/10">
          <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10">
             <p className="text-[10px] text-blue-400 font-black uppercase mb-1 tracking-widest">Quyền: {userRole}</p>
             <p className="text-sm font-bold truncate opacity-70">{user.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2">
             🚪 ĐĂNG XUẤT
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 xl:ml-80 flex flex-col min-h-screen">
        <header className="bg-white h-24 shadow-sm flex items-center px-12 sticky top-0 z-10 justify-between border-b">
          <h1 className="font-black text-2xl uppercase text-blue-950">Hệ thống quản lý lịch trực tuyến</h1>
          <div className="flex items-center gap-6">
             <div className="bg-blue-50 text-blue-700 px-6 py-3 rounded-2xl font-black text-sm border border-blue-100 uppercase tracking-widest hidden md:block">Cần Thơ: {moment().format("DD/MM/YYYY")}</div>
             <button onClick={handleLogout} className="bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-red-600 hover:text-white transition-all">
                Đăng xuất
             </button>
          </div>
        </header>

        <div className="p-12 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-8 rounded-[32px] border shadow-xl flex items-center justify-between border-l-8 border-l-blue-900">
                <div>
                    <p className="text-gray-400 text-sm font-black uppercase mb-2 tracking-widest">Tổng vụ án</p>
                    <p className="text-5xl font-black text-gray-950">{schedule.length}</p>
                </div>
                <div className="bg-blue-50 text-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-blue-100">📁</div>
            </div>
            <div className="bg-gradient-to-br from-blue-600 to-blue-900 text-white p-8 rounded-[32px] shadow-2xl flex items-center justify-between transform transition-all hover:-translate-y-1">
                <div>
                    <p className="text-blue-200 text-sm font-black uppercase mb-2 tracking-widest">Xử trong ngày</p>
                    <p className="text-5xl font-black">{schedule.filter(i => moment(i.datetime).isSame(moment(), 'day')).length}</p>
                </div>
                <div className="bg-white/20 text-white w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-white/20">⚡</div>
            </div>
            <div className="bg-white p-8 rounded-[32px] border shadow-xl flex items-center justify-between border-l-8 border-l-amber-500">
                <div>
                    <p className="text-gray-400 text-sm font-black uppercase mb-2 tracking-widest">Đang chờ xử</p>
                    <p className="text-5xl font-black text-amber-600">{schedule.filter(i => i.status === 'pending').length}</p>
                </div>
                <div className="bg-amber-50 text-amber-500 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-amber-100">⏳</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            
            {/* FORM NHẬP LIỆU */}
            {canEdit && (
              <div className="xl:col-span-4">
                <div className="bg-white p-10 rounded-[40px] border shadow-2xl sticky top-36">
                  <h2 className="font-black text-2xl text-blue-950 uppercase mb-10 flex items-center gap-4">
                    <span className="w-2 h-10 bg-blue-600 rounded-full"></span>
                    {editingId ? "Cập nhật hồ sơ" : "Đăng ký lịch"}
                  </h2>
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Thời gian xét xử</label>
                        <input type="datetime-local" value={form.datetime} onChange={e => setForm({...form, datetime: e.target.value})} className={inputBase} />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Phòng xử / Địa điểm</label>
                        <select value={form.room} onChange={e => setForm({...form, room: e.target.value})} className={inputBase}>
                          <option value="Trụ sở">🏢 TRỤ SỞ</option>
                          <option value="Chi nhánh">🏢 CHI NHÁNH</option>
                          <option value="Dự phòng">⚠️ DỰ PHÒNG</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Loại án & Lần xử</label>
                        <div className="flex gap-4">
                            <select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value})} className={inputBase}>
                                <option value="Hình sự">🚨 Hình sự</option>
                                <option value="Dân sự">🤝 Dân sự</option>
                                <option value="Hành chính">🏢 Hành chính</option>
                                <option value="Hôn nhân & GĐ">💍 Hôn nhân</option>
                                <option value="Kinh tế">💰 Kinh tế</option>
                            </select>
                            <select value={form.trialCount} onChange={e => setForm({...form, trialCount: e.target.value})} className={`${inputBase} w-1/2 bg-blue-50/50`}>
                                <option value="Lần 1">Lần 1</option>
                                <option value="Lần 2">Lần 2</option>
                                <option value="Mở lại">Mở lại</option>
                            </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Vụ án / Tội danh</label>
                      <textarea value={form.caseName} onChange={e => setForm({...form, caseName: e.target.value})} className={inputBase} rows="4" placeholder="Nhập tên vụ án..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder="Nguyên đơn..." value={form.plaintiff} onChange={e => setForm({...form, plaintiff: e.target.value})} className={inputBase} />
                      <input placeholder="Bị đơn..." value={form.defendant} onChange={e => setForm({...form, defendant: e.target.value})} className={inputBase} />
                    </div>

                    <div className="bg-gray-50 p-8 rounded-[32px] space-y-6 border-2 border-gray-100">
                      <input placeholder="Thẩm phán chủ tọa" value={form.judge} onChange={e => setForm({...form, judge: e.target.value})} className={inputBase} />
                      <div className="grid grid-cols-2 gap-4">
                        <input placeholder="Hội thẩm 1" value={form.juror1} onChange={e => setForm({...form, juror1: e.target.value})} className={inputBase} />
                        <input placeholder="Hội thẩm 2" value={form.juror2} onChange={e => setForm({...form, juror2: e.target.value})} className={inputBase} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input placeholder="Thư ký" value={form.clerk} onChange={e => setForm({...form, clerk: e.target.value})} className={inputBase} />
                        <input placeholder="KSV" value={form.prosecutor} onChange={e => setForm({...form, prosecutor: e.target.value})} className={`${inputBase} text-red-600`} />
                      </div>
                    </div>

                    <button onClick={handleSubmit} className="w-full bg-blue-900 text-white font-black py-6 rounded-[24px] uppercase text-xl shadow-2xl hover:bg-blue-800 transition-all active:scale-95 shadow-blue-900/20">
                      {editingId ? "Cập nhật hồ sơ" : "Lưu vào hệ thống"}
                    </button>
                    {isRoomConflict && <p className="text-red-500 text-sm font-black text-center mt-2 animate-pulse uppercase">⚠️ TRÙNG LỊCH XÉT XỬ!</p>}
                  </div>
                </div>
              </div>
            )}

            {/* DANH SÁCH LỊCH & SỔ THỤ LÝ */}
            <div className={`space-y-12 ${!canEdit ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
              
              {/* LỊCH CALENDAR */}
              <div className="bg-white p-8 rounded-[40px] border shadow-2xl h-[500px]">
                <Calendar 
                   localizer={localizer} 
                   events={schedule.map(i => ({...i, title: `[${i.room}] ${i.caseName}`, start: new Date(i.datetime), end: new Date(new Date(i.datetime).getTime() + 3600000)}))} 
                   style={{ height: "100%" }} 
                   onSelectEvent={e => setSelectedEvent(e)}
                />
              </div>

              {/* BẢNG SỔ THỤ LÝ */}
              <div className="bg-white rounded-[40px] border shadow-2xl overflow-hidden flex flex-col h-[850px]">
                <div className="p-10 border-b-2 border-gray-50 flex justify-between items-center sticky top-0 bg-white z-10">
                  <h3 className="font-black uppercase text-2xl text-blue-950 flex items-center gap-4">
                    <span className="w-2 h-10 bg-blue-950 rounded-full"></span>
                    Sổ thụ lý trực tuyến
                  </h3>
                  <input type="text" placeholder="Tìm kiếm vụ án..." onChange={e => setSearchQuery(e.target.value)} className="border-2 border-gray-100 px-8 py-4 rounded-2xl text-lg w-80 focus:border-blue-600 outline-none font-bold" />
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-[11px] font-black uppercase text-gray-400 border-b-2 border-gray-100 sticky top-0">
                      <tr>
                        <th className="p-10">Thời gian / Địa điểm</th>
                        <th className="p-10">Nội dung vụ việc</th>
                        <th className="p-10">Hội đồng & Thư ký</th>
                        {canEdit && <th className="p-10 text-center">Tác vụ</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-gray-50">
                      {schedule.filter(i => i.caseName.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                        <tr key={item.id} className="hover:bg-blue-50/20 bg-white transition-all group">
                          <td className="p-10 align-top">
                            <div className="font-black text-gray-950 text-2xl">{moment(item.datetime).format("DD/MM/YYYY")}</div>
                            <div className="text-blue-600 font-black text-xl mt-2">🕒 {moment(item.datetime).format("HH:mm")}</div>
                            <div className="mt-4 font-black text-gray-400 uppercase text-xs tracking-widest">{item.room}</div>
                          </td>
                          <td className="p-10 align-top">
                            <div className="font-black uppercase text-gray-900 text-xl leading-tight mb-6 group-hover:text-blue-900 transition-colors">{item.caseName}</div>
                            <div className="flex gap-4">
                                <span className="bg-blue-50 text-blue-800 px-5 py-2 rounded-xl text-xs font-black uppercase border border-blue-100">{item.caseType}</span>
                                <span className="bg-amber-50 text-amber-700 px-5 py-2 rounded-xl text-xs font-black uppercase border border-amber-100">{item.trialCount || "Lần 1"}</span>
                            </div>
                            <div className="mt-6 text-base text-gray-500 space-y-2 font-bold italic">
                                <p>📌 NĐ: {item.plaintiff || "N/A"}</p>
                                <p>📌 BĐ: {item.defendant || "N/A"}</p>
                            </div>
                          </td>
                          <td className="p-10 align-top space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black text-sm">TP</div>
                                <span className="font-black text-xl text-gray-900">{item.judge}</span>
                            </div>
                            <div className="flex items-center gap-4 text-base text-gray-500 font-bold">
                                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center font-black text-xs">HT</div>
                                <span>{item.juror1}, {item.juror2}</span>
                            </div>
                            <div className="flex items-center gap-4 text-base text-gray-500 font-bold">
                                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center font-black text-xs">TK</div>
                                <span>{item.clerk}</span>
                            </div>
                            <div className="flex items-center gap-4 text-base text-red-600 font-black">
                                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center font-black text-xs">KS</div>
                                <span>{item.prosecutor}</span>
                            </div>
                          </td>
                          {canEdit && (
                            <td className="p-10 text-center align-top">
                              <div className="flex flex-col gap-4">
                                <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="bg-blue-50 text-blue-700 px-6 py-4 rounded-2xl font-black uppercase text-xs border border-blue-100 hover:bg-blue-600 hover:text-white transition-all">SỬA</button>
                                {userRole === 'admin' && (
                                  <button onClick={async () => {if(confirm("Xóa hồ sơ này?")) {await deleteDoc(doc(db,"schedule",item.id)); loadData()}}} className="bg-red-50 text-red-700 px-6 py-4 rounded-2xl font-black uppercase text-xs border border-red-100 hover:bg-red-600 hover:text-white transition-all">XÓA</button>
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

      {/* MODAL CHI TIẾT KHI CLICK VÀO LỊCH */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-6" onClick={() => setSelectedEvent(null)}>
           <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl scale-105" onClick={e => e.stopPropagation()}>
              <div className="bg-blue-900 p-8 text-white">
                <p className="text-xs font-black uppercase opacity-60 mb-2">{selectedEvent.caseType} - {selectedEvent.trialCount}</p>
                <h3 className="text-2xl font-black uppercase leading-tight">{selectedEvent.caseName}</h3>
              </div>
              <div className="p-8 space-y-4 text-base font-bold">
                <p>🕒 <span className="text-blue-900">{moment(selectedEvent.datetime).format("HH:mm - DD/MM/YYYY")}</span> tại <span className="text-blue-900">{selectedEvent.room}</span></p>
                <hr/>
                <p>👨‍⚖️ Thẩm phán: <span className="font-black text-gray-900">{selectedEvent.judge}</span></p>
                <p>⚖️ Hội thẩm: {selectedEvent.juror1}, {selectedEvent.juror2}</p>
                <p>📝 Thư ký: {selectedEvent.clerk}</p>
                <p>🛡️ Kiểm sát: <span className="text-red-600">{selectedEvent.prosecutor}</span></p>
                <button onClick={() => setSelectedEvent(null)} className="w-full bg-blue-900 text-white py-4 rounded-2xl font-black uppercase mt-6 shadow-lg hover:bg-blue-800">ĐÓNG CỬA SỔ</button>
              </div>
           </div>
        </div>
      )}

      {/* THÔNG BÁO TOAST */}
      {toast.show && (
        <div className={`fixed bottom-12 right-12 z-[200] px-12 py-6 rounded-[32px] shadow-2xl font-black text-base text-white animate-bounce ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-700'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}