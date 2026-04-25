'use client';
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import "react-big-calendar/lib/css/react-big-calendar.css";

// Firebase Imports
import { db, auth } from './firebase'; 
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';

// Bọc thép lỗi SSR của Next.js (Lỗi navigator is not defined)
const localizer = typeof window !== 'undefined' ? momentLocalizer(moment) : null;

export default function PremiumCourtApp() {
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('viewer'); 
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [editingId, setEditingId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const initialForm = {
    datetime: "", room: "Trụ sở", caseType: "Hình sự", trialCount: "Lần 1", caseName: "", 
    plaintiff: "", defendant: "", judge: "", clerk: "", juror1: "", juror2: "", 
    prosecutor: "", status: "pending"
  };
  const [form, setForm] = useState(initialForm);

  const textStyle = "text-[16px] font-bold text-gray-800";
  const inputBase = `w-full border-2 border-gray-200 p-4 bg-gray-50 outline-none focus:border-blue-600 focus:bg-white transition-all ${textStyle}`;

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const email = currentUser.email ? currentUser.email.toLowerCase() : "";
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
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      showToast("Đăng nhập thành công!", "success");
    } catch (err) { 
      showToast("Sai tài khoản hoặc mật khẩu", "error"); 
    } finally { 
      setLoading(false); 
    }
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
    
    const logData = { ...form, status: form.status || 'pending', updatedAt: moment().toISOString(), updatedBy: user.email };
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

  const toggleStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, "schedule", id), { status: newStatus });
      let msg = "⏳ Đã mở lại vụ án!";
      if(newStatus === 'completed') msg = "✅ Đã đánh dấu xử xong!";
      if(newStatus === 'postponed') msg = "⏸ Đã hoãn phiên tòa!";
      showToast(msg, "success");
      loadData();
    } catch (err) {
      showToast("Lỗi cập nhật trạng thái", "error");
    }
  };

  const handleReschedule = (item) => {
    let nextTrialCount = "Lần 2";
    if (item.trialCount === "Lần 1") nextTrialCount = "Lần 2";
    else if (item.trialCount === "Lần 2") nextTrialCount = "Mở lại";
    else nextTrialCount = "Mở lại";

    setForm({
      ...item,
      datetime: "",
      trialCount: nextTrialCount,
      status: "pending"
    });
    setEditingId(item.id);
    window.scrollTo({top:0, behavior:'smooth'});
    showToast("Đã lấy dữ liệu, vui lòng chọn ngày giờ mới!", "success");
  };

  const exportToExcel = () => {
    if (schedule.length === 0) return showToast("Không có dữ liệu để xuất!", "error");

    const dataToExport = schedule.filter(i => {
      const caseName = i.caseName || ""; 
      const search = searchQuery || "";
      const matchSearch = caseName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' ? true : i.status === statusFilter;
      return matchSearch && matchStatus;
    });

    if (dataToExport.length === 0) return showToast("Không có dữ liệu trong bộ lọc này!", "error");

    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; font-family: 'Times New Roman', Times, serif; font-size: 13pt; }
          td, th { border: 1px solid #000000; padding: 8px; vertical-align: top; }
          .no-border { border: none !important; }
          .text-center { text-align: center; vertical-align: middle; }
          .font-bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="2" class="no-border text-center font-bold">TÒA ÁN NHÂN DÂN<br/>KHU VỰC 9 - CẦN THƠ</td>
            <td colspan="4" class="no-border text-center font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập - Tự do - Hạnh Phúc</td>
          </tr>
          <tr>
            <td colspan="6" class="no-border text-center"><i>Cần Thơ, ngày ${moment().format("DD")} tháng ${moment().format("MM")} năm ${moment().format("YYYY")}</i></td>
          </tr>
          <tr><td colspan="6" class="no-border"></td></tr>
          <tr>
            <td colspan="6" class="no-border text-center font-bold" style="font-size: 16pt;">
              LỊCH XÉT XỬ ${statusFilter === 'completed' ? '(ĐÃ XỬ XONG)' : statusFilter === 'postponed' ? '(ĐÃ HOÃN)' : ''}
            </td>
          </tr>
          <tr><td colspan="6" class="no-border"></td></tr>
          
          <tr>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">STT</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">NỘI DUNG VỤ ÁN</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">NGÀY XÉT XỬ</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">CHỦ TỌA, THƯ KÝ</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">HỘI THẨM NHÂN DÂN</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">PHÒNG XÉT XỬ</th>
          </tr>
    `;

    dataToExport.forEach((item, index) => {
      const noidung = `<b>${item.caseName || ""}</b><br/>NĐ: ${item.plaintiff || ""}<br/>BĐ: ${item.defendant || ""}`;
      const thoigian = `${moment(item.datetime).format("HH")} giờ ${moment(item.datetime).format("mm")} phút<br/>Ngày ${moment(item.datetime).format("DD/MM/YYYY")}`;
      const hd = `${item.judge || ""}<br/>${item.clerk || ""}`;
      const htm = `${item.juror1 || ""}<br/>${item.juror2 || ""}`;

      tableHtml += `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td>${noidung}</td>
          <td class="text-center">${thoigian}</td>
          <td>${hd}</td>
          <td>${htm}</td>
          <td class="text-center font-bold">${item.room || ""}</td>
        </tr>
      `;
    });

    tableHtml += `
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Lich_Xet_Xu_TANDKV9_${moment().format("DD_MM_YYYY")}.xls`;
    link.click();
    showToast("Đã xuất file Excel chuẩn!", "success");
  };

  const isRoomConflict = schedule.some(i => i.datetime && i.datetime === form.datetime && i.room && i.room === form.room && i.id !== editingId && i.status === 'pending');
  const isProsecutorConflict = (form.prosecutor || "").trim() !== "" && schedule.some(i => i.datetime && i.datetime === form.datetime && (i.prosecutor || "").trim().toLowerCase() === (form.prosecutor || "").trim().toLowerCase() && i.id !== editingId && i.status === 'pending');
  const isJudgeConflict = (form.judge || "").trim() !== "" && schedule.some(i => i.datetime && i.datetime === form.datetime && (i.judge || "").trim().toLowerCase() === (form.judge || "").trim().toLowerCase() && i.id !== editingId && i.status === 'pending');
  const isClerkConflict = (form.clerk || "").trim() !== "" && schedule.some(i => i.datetime && i.datetime === form.datetime && (i.clerk || "").trim().toLowerCase() === (form.clerk || "").trim().toLowerCase() && i.id !== editingId && i.status === 'pending');
  const hasConflict = isRoomConflict || isProsecutorConflict || isJudgeConflict || isClerkConflict;

  // --- TẠO DANH SÁCH GỢI Ý NHÂN SỰ ---
  const judgesList = [...new Set(schedule.map(i => i.judge).filter(Boolean))];
  const clerksList = [...new Set(schedule.map(i => i.clerk).filter(Boolean))];
  const prosecutorsList = [...new Set(schedule.map(i => i.prosecutor).filter(Boolean))];

  // --- TÍNH TOÁN DỮ LIỆU THỐNG KÊ (DASHBOARD NÂNG CAO) ---
  const isUrgent = (datetime) => {
    if(!datetime) return false;
    const diffDays = moment(datetime).startOf('day').diff(moment().startOf('day'), 'days');
    return diffDays === 0 || diffDays === 1; // Hôm nay hoặc Ngày mai
  };
  
  const urgentCount = schedule.filter(i => i.status === 'pending' && isUrgent(i.datetime)).length;
  const pendingCases = schedule.filter(i => i.status === 'pending');
  
  // KIỂM TRA ĐÃ CÓ BIẾN caseTypeStats Ở ĐÂY
  const caseTypeStats = {};
  schedule.forEach(i => { if(i.caseType) caseTypeStats[i.caseType] = (caseTypeStats[i.caseType] || 0) + 1 });
  
  const judgeStats = {};
  pendingCases.forEach(i => { if(i.judge) judgeStats[i.judge] = (judgeStats[i.judge] || 0) + 1 });
  const sortedJudges = Object.keys(judgeStats).sort((a,b) => judgeStats[b] - judgeStats[a]).slice(0, 5);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-2xl text-blue-900">ĐANG TẢI...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-cover bg-center font-sans" style={{ backgroundImage: "url('/toaan.jpg')" }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div className="relative z-10 w-full max-w-[480px] p-10 bg-white/20 backdrop-blur-md border border-white/30 text-center shadow-2xl">
          <img src="/logo-toa-an-nhan-dan-toi-cao.png" alt="Logo" className="mx-auto mb-6 drop-shadow-2xl" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
          <h1 className="text-3xl font-black uppercase mb-10 tracking-tight" style={{ color: '#dc2626', textShadow: '2px 2px 4px rgba(255, 255, 255, 0.8)' }}>TAND KHU VỰC 9 - CẦN THƠ</h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <input type="email" placeholder="Email..." value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full px-6 py-4 bg-white text-black outline-none text-xl font-bold" required />
            <input type="password" placeholder="Mật khẩu..." value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full px-6 py-4 bg-white text-black outline-none text-xl font-bold" required />
            <button type="submit" className="w-full bg-blue-600 py-5 font-black uppercase text-white hover:bg-blue-500 text-xl shadow-xl transition-all">ĐĂNG NHẬP</button>
          </form>
        </div>
      </div>
    );
  }

  const canEdit = userRole === 'admin' || userRole === 'thuky';

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans antialiased tracking-tight relative">
      
      <datalist id="judges-list">{judgesList.map((name, i) => <option key={i} value={name} />)}</datalist>
      <datalist id="clerks-list">{clerksList.map((name, i) => <option key={i} value={name} />)}</datalist>
      <datalist id="prosecutors-list">{prosecutorsList.map((name, i) => <option key={i} value={name} />)}</datalist>

      <style dangerouslySetInnerHTML={{__html: `
        .rbc-event { background-color: #1e3a8a !important; border-radius: 0px !important; padding: 4px 8px !important; font-weight: 800 !important; border: none !important; }
        .rbc-event.rbc-selected { background-color: #000000 !important; box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #000000 !important; z-index: 10 !important; }
        .rbc-slot-selection { background-color: rgba(0, 0, 0, 0.6) !important; }
        .rbc-day-bg.rbc-today { background-color: #eff6ff !important; }
      `}} />

      {/* SIDEBAR */}
      <aside className="w-80 bg-blue-950 text-white hidden xl:flex flex-col fixed h-screen shadow-2xl border-r border-blue-900 z-20">
        <div className="p-12 text-center border-b border-white/5">
          <div className="text-5xl mb-4">⚖️</div>
          <h2 className="font-black text-2xl uppercase tracking-tighter">TAND KV9</h2>
        </div>
        <div className="p-8 flex-1">
          <div className="bg-blue-600 px-6 py-4 font-black text-xl shadow-lg shadow-blue-900/50 flex justify-between items-center">
            📅 LỊCH XÉT XỬ
            {urgentCount > 0 && <span className="bg-red-500 text-white px-2 py-1 text-xs rounded-full animate-bounce">{urgentCount}</span>}
          </div>
        </div>
        <div className="p-8 border-t border-white/5 bg-black/10">
          <div className="mb-6 p-4 bg-white/5 border border-white/10">
             <p className="text-[10px] text-blue-400 font-black uppercase mb-1 tracking-widest">Quyền: {userRole}</p>
             <p className="text-sm font-bold truncate opacity-70">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 py-4 font-black uppercase text-xs transition-all flex items-center justify-center gap-2">🚪 ĐĂNG XUẤT</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 xl:ml-80 flex flex-col min-h-screen relative z-10">
        <header className="bg-white/95 backdrop-blur-md h-24 shadow-sm flex items-center px-12 sticky top-0 z-30 justify-between border-b border-gray-200">
          <h1 className="font-black text-2xl uppercase text-blue-950">Hệ thống quản lý lịch trực tuyến</h1>
          <div className="flex items-center gap-6">
             <div className="bg-blue-50 text-blue-700 px-6 py-3 font-black text-sm border border-blue-100 uppercase tracking-widest hidden md:block">Cần Thơ: {moment().format("DD/MM/YYYY")}</div>
             <button onClick={handleLogout} className="bg-red-50 text-red-600 border border-red-100 px-4 py-2 text-xs font-black uppercase hover:bg-red-600 hover:text-white transition-all">Đăng xuất</button>
          </div>
        </header>

        <div className="p-12 flex-1">
          
          {/* DASHBOARD CON SỐ */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-8 border shadow-sm border-l-8 border-l-blue-900">
                <p className="text-gray-400 text-sm font-black uppercase mb-2 tracking-widest">Tổng vụ án</p>
                <p className="text-4xl font-black text-gray-950">{schedule.length}</p>
            </div>
            <div className="bg-white p-8 border shadow-sm border-l-8 border-l-amber-500">
                <p className="text-gray-400 text-sm font-black uppercase mb-2 tracking-widest">Chờ xử</p>
                <p className="text-4xl font-black text-amber-600">{pendingCases.length}</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-700 text-white p-8 shadow-xl transform transition-all hover:scale-105">
                <p className="text-red-100 text-sm font-black uppercase mb-2 tracking-widest">Sắp xử (24h)</p>
                <p className="text-4xl font-black">{urgentCount}</p>
            </div>
            <div className="bg-white p-8 border shadow-sm border-l-8 border-l-green-500">
                <p className="text-gray-400 text-sm font-black uppercase mb-2 tracking-widest">Đã xong</p>
                <p className="text-4xl font-black text-green-600">{schedule.filter(i => i.status === 'completed').length}</p>
            </div>
          </div>

          {/* DASHBOARD BIỂU ĐỒ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white p-8 border shadow-sm">
               <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-6">📊 Tỷ lệ loại án</h3>
               <div className="space-y-4">
                 {Object.entries(caseTypeStats).map(([type, count]) => (
                   <div key={type}>
                     <div className="flex justify-between text-sm font-bold text-gray-700 mb-1">
                       <span>{type}</span>
                       <span>{count} vụ ({Math.round((count/schedule.length)*100)}%)</span>
                     </div>
                     <div className="w-full bg-gray-100 h-3">
                       <div className="bg-blue-600 h-3" style={{ width: `${(count/schedule.length)*100}%` }}></div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
            <div className="bg-white p-8 border shadow-sm">
               <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-6">👨‍⚖️ Năng suất Thẩm phán (Án đang chờ)</h3>
               <div className="space-y-4">
                 {sortedJudges.map(judge => (
                   <div key={judge}>
                     <div className="flex justify-between text-sm font-bold text-gray-700 mb-1">
                       <span>{judge}</span>
                       <span className="text-amber-600">{judgeStats[judge]} vụ</span>
                     </div>
                     <div className="w-full bg-gray-100 h-3">
                       <div className="bg-amber-500 h-3" style={{ width: `${(judgeStats[judge] / Math.max(...Object.values(judgeStats))) * 100}%` }}></div>
                     </div>
                   </div>
                 ))}
                 {sortedJudges.length === 0 && <p className="text-gray-400 text-sm italic font-bold">Chưa có dữ liệu thụ lý mới.</p>}
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            
            {/* FORM */}
            {canEdit && (
              <div className="xl:col-span-4">
                <div className="bg-white p-10 border shadow-2xl sticky top-36">
                  <h2 className="font-black text-2xl text-blue-950 uppercase mb-10 flex items-center gap-4">
                    <span className="w-2 h-10 bg-blue-600"></span>
                    {editingId ? "Cập nhật hồ sơ" : "Đăng ký lịch"}
                  </h2>
                  <div className="space-y-8">
                    
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-3 ml-2 tracking-widest">Thời gian xét xử</label>
                        <div className="flex gap-4">
                          <input 
                            type="date" 
                            value={form.datetime ? form.datetime.split('T')[0] : ""} 
                            onChange={e => {
                              const time = form.datetime && form.datetime.includes('T') ? form.datetime.split('T')[1] : '07:30';
                              setForm({...form, datetime: `${e.target.value}T${time}`});
                            }} 
                            className={inputBase} 
                          />
                          <select 
                            value={form.datetime && form.datetime.includes('T') ? form.datetime.split('T')[1] : "07:30"} 
                            onChange={e => {
                              const date = form.datetime ? form.datetime.split('T')[0] : moment().format('YYYY-MM-DD');
                              setForm({...form, datetime: `${date}T${e.target.value}`});
                            }} 
                            className={`${inputBase} w-1/2 bg-blue-50/50`}
                          >
                            <option value="07:30">07:30</option>
                            <option value="08:00">08:00</option>
                            <option value="08:30">08:30</option>
                            <option value="09:00">09:00</option>
                            <option value="09:30">09:30</option>
                            <option value="10:00">10:00</option>
                            <option value="10:30">10:30</option>
                            <option value="11:00">11:00</option>
                            <option value="13:30">13:30</option>
                            <option value="14:00">14:00</option>
                            <option value="14:30">14:30</option>
                            <option value="15:00">15:00</option>
                            <option value="15:30">15:30</option>
                            <option value="16:00">16:00</option>
                            <option value="16:30">16:30</option>
                            <option value="17:00">17:00</option>
                          </select>
                        </div>
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

                    <div className="bg-gray-50 p-8 space-y-6 border-2 border-gray-100">
                      <input list="judges-list" placeholder="Thẩm phán chủ tọa" value={form.judge} onChange={e => setForm({...form, judge: e.target.value})} className={inputBase} />
                      <div className="grid grid-cols-2 gap-4">
                        <input placeholder="Hội thẩm 1" value={form.juror1} onChange={e => setForm({...form, juror1: e.target.value})} className={inputBase} />
                        <input placeholder="Hội thẩm 2" value={form.juror2} onChange={e => setForm({...form, juror2: e.target.value})} className={inputBase} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input list="clerks-list" placeholder="Thư ký" value={form.clerk} onChange={e => setForm({...form, clerk: e.target.value})} className={inputBase} />
                        <input list="prosecutors-list" placeholder="KSV" value={form.prosecutor} onChange={e => setForm({...form, prosecutor: e.target.value})} className={`${inputBase} text-red-600`} />
                      </div>
                    </div>

                    <button 
                      onClick={handleSubmit} 
                      disabled={hasConflict} 
                      className={`w-full text-white font-black py-6 uppercase text-xl shadow-2xl transition-all active:scale-95 shadow-blue-900/20 ${hasConflict ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'}`}
                    >
                      {editingId ? "Cập nhật hồ sơ" : "Lưu vào hệ thống"}
                    </button>
                    
                    {isRoomConflict && <p className="text-red-500 text-sm font-black text-center mt-2 animate-pulse uppercase">⚠️ TRÙNG PHÒNG XÉT XỬ!</p>}
                    {isJudgeConflict && <p className="text-red-500 text-sm font-black text-center mt-2 animate-pulse uppercase">⚠️ THẨM PHÁN BỊ TRÙNG LỊCH!</p>}
                    {isClerkConflict && <p className="text-red-500 text-sm font-black text-center mt-2 animate-pulse uppercase">⚠️ THƯ KÝ BỊ TRÙNG LỊCH!</p>}
                    {isProsecutorConflict && <p className="text-red-500 text-sm font-black text-center mt-2 animate-pulse uppercase">⚠️ KIỂM SÁT VIÊN BỊ TRÙNG LỊCH!</p>}
                  </div>
                </div>
              </div>
            )}

            {/* DANH SÁCH LỊCH & SỔ THỤ LÝ */}
            <div className={`space-y-12 ${!canEdit ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
              
              <div className="bg-white p-8 border shadow-2xl h-[500px]">
                {isMounted && localizer ? (
                  <Calendar 
                     localizer={localizer} 
                     events={schedule.filter(i => i.datetime && i.status !== 'postponed').map(i => ({
                       ...i, 
                       title: `${i.status === 'completed' ? '✅ ' : ''}[${i.room}] ${i.caseName || 'Chưa có tên'}`, 
                       start: new Date(i.datetime), 
                       end: new Date(new Date(i.datetime).getTime() + 3600000)
                     }))} 
                     style={{ height: "100%" }} 
                     onSelectEvent={e => setSelectedEvent(e)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">Đang tải bộ lịch...</div>
                )}
              </div>

              <div className="bg-white border shadow-2xl overflow-hidden flex flex-col h-[850px]">
                
                <div className="p-10 border-b-2 border-gray-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sticky top-0 bg-white z-10">
                  <h3 className="font-black uppercase text-2xl text-blue-950 flex items-center gap-4">
                    <span className="w-2 h-10 bg-blue-950"></span>
                    Sổ thụ lý
                  </h3>
                  
                  <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border-2 border-gray-100 px-6 py-4 text-lg focus:border-blue-600 outline-none font-bold bg-white">
                      <option value="pending">⏳ Đang chờ xử</option>
                      <option value="postponed">⏸ Đã hoãn</option>
                      <option value="completed">✅ Đã xử xong</option>
                      <option value="all">📁 Tất cả vụ án</option>
                    </select>

                    <input type="text" placeholder="Tìm kiếm vụ án..." onChange={e => setSearchQuery(e.target.value)} className="border-2 border-gray-100 px-6 py-4 text-lg w-full md:w-64 focus:border-blue-600 outline-none font-bold" />
                    
                    <button onClick={exportToExcel} className="bg-green-600 text-white px-8 py-4 font-black uppercase shadow-xl hover:bg-green-700 transition-all flex items-center justify-center gap-3 w-full md:w-auto">
                      📊 XUẤT EXCEL
                    </button>
                  </div>
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
                      {schedule.filter(i => {
                        const caseName = i.caseName || "";
                        const search = searchQuery || "";
                        const matchSearch = caseName.toLowerCase().includes(search.toLowerCase());
                        const matchStatus = statusFilter === 'all' ? true : i.status === statusFilter;
                        return matchSearch && matchStatus;
                      }).map(item => {
                       const isRowUrgent = item.status === 'pending' && isUrgent(item.datetime);

                        return (
                        <tr key={item.id} className={`transition-all group ${item.status === 'completed' || item.status === 'postponed' ? 'opacity-70 bg-gray-50/50' : isRowUrgent ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-blue-50/20'}`}>
                          <td className={`p-10 align-top ${isRowUrgent ? 'border-l-4 border-red-500' : ''}`}>
                            {item.status === 'postponed' ? (
                               <div className="text-amber-600 font-black text-xl mb-2 animate-pulse">⏸ ĐÃ HOÃN</div>
                            ) : (
                               <>
                                 <div className="font-black text-gray-950 text-2xl">{item.datetime ? moment(item.datetime).format("DD/MM/YYYY") : "---"}</div>
                                 <div className="text-blue-600 font-black text-xl mt-2">🕒 {item.datetime ? moment(item.datetime).format("HH:mm") : "---"}</div>
                               </>
                            )}
                            <div className="mt-4 font-black text-gray-400 uppercase text-xs tracking-widest">{item.room || "---"}</div>
                          </td>
                          <td className="p-10 align-top">
                            <div className="font-black uppercase text-gray-900 text-xl leading-tight mb-6 group-hover:text-blue-900 transition-colors">
                              {item.status === 'completed' && <span className="text-green-600 mr-2">✅</span>}
                              {item.status === 'postponed' && <span className="text-amber-500 mr-2">⏸</span>}
                              {isRowUrgent && <span className="bg-red-500 text-white px-2 py-1 text-xs rounded mr-2 animate-pulse">⚠️ SẮP XỬ</span>}
                              {item.caseName || "Vụ án chưa có tên"}
                            </div>
                            <div className="flex gap-4">
                                <span className="bg-blue-50 text-blue-800 px-5 py-2 text-xs font-black uppercase border border-blue-100">{item.caseType || "---"}</span>
                                <span className="bg-amber-50 text-amber-700 px-5 py-2 text-xs font-black uppercase border border-amber-100">{item.trialCount || "Lần 1"}</span>
                            </div>
                            <div className="mt-6 text-base text-gray-500 space-y-2 font-bold italic">
                                <p>📌 NĐ: {item.plaintiff || "N/A"}</p>
                                <p>📌 BĐ: {item.defendant || "N/A"}</p>
                            </div>
                          </td>
                          <td className="p-10 align-top space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-100 flex items-center justify-center text-blue-600 font-black text-sm">TP</div>
                                <span className={`font-black text-xl ${isRowUrgent ? 'text-red-900' : 'text-gray-900'}`}>{item.judge || "---"}</span>
                            </div>
                            <div className="flex items-center gap-4 text-base text-gray-500 font-bold">
                                <div className="w-10 h-10 bg-gray-100 flex items-center justify-center font-black text-xs">HT</div>
                                <span>{item.juror1 || "---"}, {item.juror2 || "---"}</span>
                            </div>
                            <div className="flex items-center gap-4 text-base text-gray-500 font-bold">
                                <div className="w-10 h-10 bg-gray-100 flex items-center justify-center font-black text-xs">TK</div>
                                <span>{item.clerk || "---"}</span>
                            </div>
                            <div className="flex items-center gap-4 text-base text-red-600 font-black">
                                <div className="w-10 h-10 bg-red-50 flex items-center justify-center font-black text-xs">KS</div>
                                <span>{item.prosecutor || "---"}</span>
                            </div>
                          </td>
                          {canEdit && (
                            <td className="p-10 text-center align-top">
                              <div className="flex flex-col gap-4">
                                {item.status === 'pending' || !item.status ? (
                                  <>
                                    <button onClick={() => toggleStatus(item.id, 'completed')} className="bg-green-50 text-green-700 px-6 py-4 font-black uppercase text-xs border border-green-100 hover:bg-green-600 hover:text-white transition-all">✔ XONG</button>
                                    <button onClick={() => toggleStatus(item.id, 'postponed')} className="bg-amber-50 text-amber-700 px-6 py-4 font-black uppercase text-xs border border-amber-100 hover:bg-amber-600 hover:text-white transition-all">⏸ HOÃN</button>
                                  </>
                                ) : item.status === 'postponed' ? (
                                  <button onClick={() => handleReschedule(item)} className="bg-blue-600 text-white px-6 py-4 font-black uppercase text-xs shadow-lg hover:bg-blue-700 transition-all">📅 LÊN LỊCH LẠI</button>
                                ) : (
                                  <button onClick={() => toggleStatus(item.id, 'pending')} className="bg-gray-200 text-gray-700 px-6 py-4 font-black uppercase text-xs hover:bg-gray-400 transition-all">↺ MỞ LẠI</button>
                                )}

                                <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="bg-blue-50 text-blue-700 px-6 py-4 font-black uppercase text-xs border border-blue-100 hover:bg-blue-600 hover:text-white transition-all mt-4">SỬA</button>
                                
                                {userRole === 'admin' && (
                                  <button onClick={async () => {if(confirm("Xóa hồ sơ này?")) {await deleteDoc(doc(db,"schedule",item.id)); loadData()}}} className="bg-red-50 text-red-700 px-6 py-4 font-black uppercase text-xs border border-red-100 hover:bg-red-600 hover:text-white transition-all">XÓA</button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* MODAL CHI TIẾT */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-6" onClick={() => setSelectedEvent(null)}>
           <div className="bg-white w-full max-w-lg shadow-2xl border-4 border-blue-900 scale-105" onClick={e => e.stopPropagation()}>
              <div className="bg-blue-900 p-8 text-white flex justify-between items-start">
                <div>
                  <p className="text-xs font-black uppercase opacity-80 mb-2">{selectedEvent.caseType || "---"} - {selectedEvent.trialCount || "---"}</p>
                  <h3 className="text-2xl font-black uppercase leading-tight">{selectedEvent.caseName || "Chưa có tên"}</h3>
                </div>
                {selectedEvent.status === 'completed' && <span className="bg-green-500 text-white px-3 py-1 font-black text-xs ml-4">ĐÃ XONG</span>}
                {selectedEvent.status === 'postponed' && <span className="bg-amber-500 text-white px-3 py-1 font-black text-xs ml-4">ĐÃ HOÃN</span>}
                {selectedEvent.status === 'pending' && isUrgent(selectedEvent.datetime) && <span className="bg-red-500 text-white px-3 py-1 font-black text-xs ml-4 animate-pulse">SẮP XỬ</span>}
              </div>
              <div className="p-8 space-y-4 text-base font-bold text-gray-900">
                <p>🕒 <span className="text-blue-900">{selectedEvent.datetime ? moment(selectedEvent.datetime).format("HH:mm - DD/MM/YYYY") : "---"}</span> tại <span className="text-blue-900">{selectedEvent.room || "---"}</span></p>
                <hr className="border-gray-300 border-2"/>
                <p>👨‍⚖️ Thẩm phán: <span className="font-black text-gray-950">{selectedEvent.judge || "---"}</span></p>
                <p>⚖️ Hội thẩm: {selectedEvent.juror1 || "---"}, {selectedEvent.juror2 || "---"}</p>
                <p>📝 Thư ký: {selectedEvent.clerk || "---"}</p>
                <p>🛡️ Kiểm sát: <span className="text-red-600">{selectedEvent.prosecutor || "---"}</span></p>
                <button onClick={() => setSelectedEvent(null)} className="w-full bg-blue-900 text-white py-5 font-black uppercase mt-6 hover:bg-blue-800 transition-colors">ĐÓNG CỬA SỔ</button>
              </div>
           </div>
        </div>
      )}

      {toast.show && (
        <div className={`fixed bottom-12 right-12 z-[200] px-12 py-6 shadow-2xl font-black text-lg text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-700'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}