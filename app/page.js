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

  // ĐỊNH NGHĨA CỠ CHỮ ĐỒNG NHẤT 16PX VÀ PHÔNG CHỮ INTER
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

  const handleSubmit = async () => {
    if (userRole === 'thamphan' || userRole === 'viewer') return showToast("Không có quyền!", "error");
    if (!form.datetime || !form.caseName || !form.room) return showToast("Nhập đủ thông tin!", "error");
    
    const logData = { ...form, updatedAt: moment().toISOString(), updatedBy: user.email };
    try {
      if (editingId) {
        await updateDoc(doc(db, "schedule", editingId), logData);
        showToast("💾 Đã cập nhật!", "success");
      } else {
        await addDoc(collection(db, "schedule"), { ...logData, createdAt: moment().toISOString(), createdBy: user.email });
        showToast("✅ Lưu thành công!", "success");
      }
      setForm(initialForm); setEditingId(null); loadData();
    } catch (err) { showToast("Lỗi khi lưu", "error"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-2xl">HỆ THỐNG ĐANG TẢI...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-cover bg-center font-sans" style={{ backgroundImage: "url('/toaan.jpg')" }}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 w-full max-w-[480px] p-10 bg-white/10 backdrop-blur-md rounded-[40px] border border-white/20 text-white text-center shadow-2xl">
          <img src="/logo-toaan.png" alt="Logo" className="w-32 h-32 mx-auto mb-8" />
          <h1 className="text-3xl font-black uppercase mb-10">TAND KHU VỰC 9</h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <input type="email" placeholder="Tài khoản..." value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-6 py-4 bg-white text-black rounded-2xl outline-none text-xl" required />
            <input type="password" placeholder="Mật khẩu..." value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full px-6 py-4 bg-white text-black rounded-2xl outline-none text-xl" required />
            <button type="submit" className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase hover:bg-blue-500 text-xl shadow-xl transition-all">ĐĂNG NHẬP</button>
          </form>
        </div>
      </div>
    );
  }

  const canEdit = userRole === 'admin' || userRole === 'thuky';

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans antialiased tracking-tight">
      {/* Sidebar */}
      <aside className="w-80 bg-blue-950 text-white hidden xl:flex flex-col fixed h-screen shadow-2xl">
        <div className="p-12 text-center border-b border-white/5">
          <div className="text-5xl mb-4">⚖️</div>
          <h2 className="font-black text-2xl uppercase tracking-widest">TAND KV9</h2>
        </div>
        <div className="p-8 flex-1">
          <div className="bg-blue-600 px-6 py-4 rounded-2xl font-black text-xl">📅 LỊCH XÉT XỬ</div>
        </div>
        <div className="p-8 border-t border-white/5 bg-black/10">
          <p className="text-[10px] text-blue-400 font-black mb-2 uppercase">Quyền: {userRole}</p>
          <button onClick={() => signOut(auth)} className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-black uppercase text-xs">Đăng xuất</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 xl:ml-80 flex flex-col min-h-screen">
        <header className="bg-white h-24 shadow-sm flex items-center px-12 sticky top-0 z-10 justify-between border-b">
          <h1 className="font-black text-2xl uppercase text-blue-950">Hệ thống quản lý lịch trực tuyến</h1>
          <div className="bg-blue-50 text-blue-700 px-6 py-3 rounded-2xl font-black text-sm border border-blue-100 uppercase">Cần Thơ, {moment().format("DD/MM/YYYY")}</div>
        </header>

        <div className="p-12 flex-1">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            
            {/* FORM NHẬP (Chỉ Admin/Thư ký) */}
            {canEdit && (
              <div className="xl:col-span-4">
                <div className="bg-white p-10 rounded-[40px] border shadow-2xl sticky top-36">
                  <h2 className="font-black text-2xl text-blue-950 uppercase mb-10 flex items-center gap-4">
                    <span className="w-2 h-10 bg-blue-600 rounded-full"></span>
                    {editingId ? "Cập nhật hồ sơ" : "Đăng ký lịch"}
                  </h2>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Thời gian xét xử</label>
                        <input type="datetime-local" value={form.datetime} onChange={e => setForm({...form, datetime: e.target.value})} className={inputBase} />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Địa điểm / Phòng xử</label>
                        <select value={form.room} onChange={e => setForm({...form, room: e.target.value})} className={inputBase}>
                          <option value="Trụ sở">🏢 TRỤ SỞ</option>
                          <option value="Chi nhánh">🏢 CHI NHÁNH</option>
                          <option value="Dự phòng">⚠️ DỰ PHÒNG</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Loại án</label>
                        <select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value})} className={inputBase}>
                          <option value="Hình sự">🚨 Hình sự</option>
                          <option value="Dân sự">🤝 Dân sự</option>
                          <option value="Hành chính">🏢 Hành chính</option>
                          <option value="Hôn nhân & GĐ">💍 Hôn nhân</option>
                          <option value="Kinh tế">💰 Kinh tế</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Lần xét xử</label>
                        <select value={form.trialCount} onChange={e => setForm({...form, trialCount: e.target.value})} className={`${inputBase} bg-blue-50/50`}>
                          <option value="Lần 1">Lần 1</option>
                          <option value="Lần 2">Lần 2</option>
                          <option value="Mở lại">Mở lại</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-2">Tên vụ án / Tội danh</label>
                      <textarea value={form.caseName} onChange={e => setForm({...form, caseName: e.target.value})} className={inputBase} rows="3" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder="Nguyên đơn..." value={form.plaintiff} onChange={e => setForm({...form, plaintiff: e.target.value})} className={inputBase} />
                      <input placeholder="Bị đơn..." value={form.defendant} onChange={e => setForm({...form, defendant: e.target.value})} className={inputBase} />
                    </div>

                    <div className="bg-gray-50 p-8 rounded-[32px] space-y-4 border-2 border-gray-100">
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

                    <button onClick={handleSubmit} className="w-full bg-blue-900 text-white font-black py-6 rounded-3xl uppercase text-xl shadow-2xl hover:bg-blue-800 transition-all">
                      {editingId ? "CẬP NHẬT HỒ SƠ" : "LƯU VÀO HỆ THỐNG"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HỆ THỐNG LỊCH CALENDAR VÀ SỔ THỤ LÝ */}
            <div className={`space-y-12 ${!canEdit ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
              {/* PHẦN LỊCH CALENDAR (ĐÃ KHÔI PHỤC) */}
              <div className="bg-white p-8 rounded-[40px] border shadow-2xl h-[500px]">
                <Calendar 
                   localizer={localizer} 
                   events={schedule.map(i => ({...i, title: `[${i.room}] ${i.caseName}`, start: new Date(i.datetime), end: new Date(new Date(i.datetime).getTime() + 3600000)}))} 
                   style={{ height: "100%" }} 
                   onSelectEvent={e => setSelectedEvent(e)}
                />
              </div>

              {/* SỔ THỤ LÝ ĐIỆN TỬ */}
              <div className="bg-white rounded-[40px] border shadow-2xl overflow-hidden flex flex-col h-[700px]">
                <div className="p-10 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                  <h3 className="font-black uppercase text-2xl text-blue-950">📋 Sổ thụ lý điện tử</h3>
                  <input type="text" placeholder="Tìm vụ án..." onChange={e => setSearchQuery(e.target.value)} className="border-2 px-6 py-4 rounded-2xl text-lg w-72 focus:border-blue-600 outline-none" />
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs font-black uppercase text-gray-400 border-b-2">
                      <tr>
                        <th className="p-10">Thời gian</th>
                        <th className="p-10">Vụ án</th>
                        <th className="p-10">HĐXX & Thư ký</th>
                        {canEdit && <th className="p-10 text-center">Tác vụ</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y-2">
                      {schedule.filter(i => i.caseName.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                        <tr key={item.id} className="hover:bg-blue-50/30 transition-all cursor-pointer" onClick={() => setSelectedEvent(item)}>
                          <td className="p-10 align-top">
                            <div className="font-black text-gray-950 text-2xl">{moment(item.datetime).format("DD/MM/YYYY")}</div>
                            <div className="text-blue-600 font-black text-xl mt-2">🕒 {moment(item.datetime).format("HH:mm")}</div>
                            <div className="mt-4 font-bold text-gray-400 uppercase text-sm">{item.room}</div>
                          </td>
                          <td className="p-10 align-top">
                            <div className="font-black uppercase text-gray-900 text-xl leading-tight mb-4">{item.caseName}</div>
                            <div className="flex gap-4 mb-4">
                                <span className="bg-blue-50 text-blue-800 px-4 py-1.5 rounded-xl text-xs font-black uppercase border border-blue-100">{item.caseType}</span>
                                <span className="bg-amber-50 text-amber-800 px-4 py-1.5 rounded-xl text-xs font-black uppercase border border-amber-100">{item.trialCount || "Lần 1"}</span>
                            </div>
                            <div className="text-base text-gray-500 font-bold space-y-1">
                                <p>📌 NĐ: {item.plaintiff}</p>
                                <p>📌 BĐ: {item.defendant}</p>
                            </div>
                          </td>
                          <td className="p-10 align-top space-y-4">
                            <p className="text-xl font-black text-gray-950"><span className="text-gray-400 font-bold text-sm mr-2 uppercase">TP:</span>{item.judge}</p>
                            <p className="text-base font-bold text-gray-600"><span className="text-gray-400 font-bold text-sm mr-2 uppercase">HT:</span>{item.juror1}, {item.juror2}</p>
                            <p className="text-base font-bold text-gray-600"><span className="text-gray-400 font-bold text-sm mr-2 uppercase">TK:</span>{item.clerk}</p>
                            <p className="text-base font-black text-red-600"><span className="text-red-300 font-bold text-sm mr-2 uppercase">KS:</span>{item.prosecutor}</p>
                          </td>
                          {canEdit && (
                            <td className="p-10 text-center align-top" onClick={e => e.stopPropagation()}>
                              <div className="flex flex-col gap-4">
                                <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="bg-blue-50 text-blue-700 px-6 py-4 rounded-2xl font-black text-xs">SỬA</button>
                                {userRole === 'admin' && (
                                  <button onClick={async () => {if(confirm("Xóa?")) {await deleteDoc(doc(db,"schedule",item.id)); loadData()}}} className="bg-red-50 text-red-700 px-6 py-4 rounded-2xl font-black text-xs">XÓA</button>
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

      {/* Thông báo Toast */}
      {toast.show && (
        <div className={`fixed bottom-12 right-12 z-[200] px-12 py-6 rounded-[32px] shadow-2xl font-black text-lg text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-700'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}