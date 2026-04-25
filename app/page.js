'use client';
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import "react-big-calendar/lib/css/react-big-calendar.css";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Firebase Imports
import { db, auth } from './firebase'; 
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence, updatePassword } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';

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

  // States cho Đổi mật khẩu
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  // States cho Lọc theo khoảng thời gian & Người nhập
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all"); // Lọc theo người tạo

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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      return showToast("Mật khẩu xác nhận không khớp!", "error");
    }
    if (newPwd.length < 6) {
      return showToast("Mật khẩu phải từ 6 ký tự trở lên!", "error");
    }
    
    try {
      await updatePassword(auth.currentUser, newPwd);
      showToast("✅ Đổi mật khẩu thành công!", "success");
      setShowPwdModal(false);
      setNewPwd("");
      setConfirmPwd("");
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
         showToast("Vui lòng đăng xuất và đăng nhập lại để thực hiện đổi mật khẩu!", "error");
      } else {
         showToast("Lỗi: " + error.message, "error");
      }
    }
  };

  const handleSubmit = async () => {
    if (userRole === 'thamphan' || userRole === 'viewer') return showToast("Không có quyền!", "error");
    if (!form.datetime || !form.caseName || !form.room) return showToast("Vui lòng nhập đủ thông tin!", "error");
    
    // Ghi nhận người cập nhật
    const logData = { ...form, status: form.status || 'pending', updatedAt: moment().toISOString(), updatedBy: user.email };
    try {
      if (editingId) {
        await updateDoc(doc(db, "schedule", editingId), logData);
        showToast("💾 Đã cập nhật hồ sơ!", "success");
      } else {
        // Nếu là tạo mới thì thêm người tạo
        await addDoc(collection(db, "schedule"), { ...logData, createdAt: moment().toISOString(), createdBy: user.email });
        showToast("✅ Lưu lịch mới thành công!", "success");
      }
      setForm(initialForm); setEditingId(null); loadData();
    } catch (err) { showToast("Lỗi khi lưu dữ liệu", "error"); }
  };

  const toggleStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, "schedule", id), { status: newStatus, updatedBy: user.email, updatedAt: moment().toISOString() });
      showToast(newStatus === 'completed' ? "✅ Đã đánh dấu xử xong!" : "⏳ Đã mở lại vụ án!", "success");
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

  // Lấy danh sách những người đã từng nhập liệu (để làm bộ lọc)
  const creatorsList = [...new Set(schedule.map(i => i.createdBy).filter(Boolean))];

  // ===== BỘ LỌC ĐA NĂNG =====
  const processedSchedule = schedule.filter(i => {
    const search = (searchQuery || "").toLowerCase().trim();
    const matchSearch = search === "" || 
      (i.caseName || "").toLowerCase().includes(search) ||
      (i.plaintiff || "").toLowerCase().includes(search) ||
      (i.defendant || "").toLowerCase().includes(search) ||
      (i.judge || "").toLowerCase().includes(search) ||
      (i.room || "").toLowerCase().includes(search) ||
      (i.createdBy || "").toLowerCase().includes(search) || // Tìm bằng tay tên người tạo
      (i.caseType || "").toLowerCase().includes(search);
      
    const matchStatus = statusFilter === 'all' ? true : i.status === statusFilter;
    
    // Lọc theo người nhập
    const matchCreator = creatorFilter === 'all' ? true : (i.createdBy === creatorFilter);

    // Lọc theo mốc thời gian
    let matchDate = true;
    if (startDate || endDate) {
      const itemDateStr = i.datetime ? i.datetime.split('T')[0] : null;
      if (!itemDateStr) {
        matchDate = false; 
      } else {
        const itemTime = moment(itemDateStr).startOf('day').valueOf();
        const start = startDate ? moment(startDate).startOf('day').valueOf() : 0;
        const end = endDate ? moment(endDate).startOf('day').valueOf() : Infinity;
        
        if (itemTime < start || itemTime > end) {
          matchDate = false;
        }
      }
    }

    return matchSearch && matchStatus && matchDate && matchCreator;
  }).sort((a, b) => {
    const dateA = a.datetime ? new Date(a.datetime).getTime() : 0;
    const dateB = b.datetime ? new Date(b.datetime).getTime() : 0;
    if (a.status === 'pending' && b.status === 'pending') return dateA - dateB;
    if (a.status !== 'pending' && b.status !== 'pending') return dateB - dateA;
    return a.status === 'pending' ? -1 : 1;
  });

  const exportToExcel = () => {
    if (schedule.length === 0) return showToast("Không có dữ liệu để xuất!", "error");
    const dataToExport = processedSchedule; 
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
            <td colspan="5" class="no-border text-center font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập - Tự do - Hạnh Phúc</td>
          </tr>
          <tr>
            <td colspan="7" class="no-border text-center"><i>Cần Thơ, ngày ${moment().format("DD")} tháng ${moment().format("MM")} năm ${moment().format("YYYY")}</i></td>
          </tr>
          <tr><td colspan="7" class="no-border"></td></tr>
          <tr>
            <td colspan="7" class="no-border text-center font-bold" style="font-size: 16pt;">
              LỊCH XÉT XỬ ${statusFilter === 'completed' ? '(ĐÃ XỬ XONG)' : ''}
              ${startDate || endDate ? `<br/><span style="font-size: 12pt; font-weight: normal;">(Từ ngày ${startDate ? moment(startDate).format("DD/MM/YYYY") : "..."} đến ngày ${endDate ? moment(endDate).format("DD/MM/YYYY") : "..."})</span>` : ''}
              ${creatorFilter !== 'all' ? `<br/><span style="font-size: 12pt; font-weight: normal;">Người nhập: ${creatorFilter}</span>` : ''}
            </td>
          </tr>
          <tr><td colspan="7" class="no-border"></td></tr>
          
          <tr>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">STT</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">NỘI DUNG VỤ ÁN</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">NGÀY XÉT XỬ</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">CHỦ TỌA, THƯ KÝ</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">HỘI THẨM NHÂN DÂN</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">PHÒNG XÉT XỬ</th>
            <th class="text-center font-bold" style="background-color: #f2f2f2;">NGƯỜI NHẬP</th>
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
          <td class="text-center">${item.createdBy ? item.createdBy.split('@')[0] : ""}</td>
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
    link.download = `Lich_Xet_Xu_${startDate ? moment(startDate).format("DDMMYY") : "All"}_${endDate ? moment(endDate).format("DDMMYY") : "All"}.xls`;
    link.click();
    showToast("Đã xuất file Excel chuẩn!", "success");
  };

  const isRoomConflict = schedule.some(i => i.datetime && i.datetime === form.datetime && i.room && i.room === form.room && i.id !== editingId && i.status === 'pending');
  const isProsecutorConflict = (form.prosecutor || "").trim() !== "" && schedule.some(i => i.datetime && i.datetime === form.datetime && (i.prosecutor || "").trim().toLowerCase() === (form.prosecutor || "").trim().toLowerCase() && i.id !== editingId && i.status === 'pending');
  const isJudgeConflict = (form.judge || "").trim() !== "" && schedule.some(i => i.datetime && i.datetime === form.datetime && (i.judge || "").trim().toLowerCase() === (form.judge || "").trim().toLowerCase() && i.id !== editingId && i.status === 'pending');
  const isClerkConflict = (form.clerk || "").trim() !== "" && schedule.some(i => i.datetime && i.datetime === form.datetime && (i.clerk || "").trim().toLowerCase() === (form.clerk || "").trim().toLowerCase() && i.id !== editingId && i.status === 'pending');
  const hasConflict = isRoomConflict || isProsecutorConflict || isJudgeConflict || isClerkConflict;

  const judgesList = [...new Set(schedule.map(i => i.judge).filter(Boolean))];
  const clerksList = [...new Set(schedule.map(i => i.clerk).filter(Boolean))];
  const prosecutorsList = [...new Set(schedule.map(i => i.prosecutor).filter(Boolean))];

  const isUrgent = (datetime) => {
    if(!datetime) return false;
    const diffDays = moment(datetime).startOf('day').diff(moment().startOf('day'), 'days');
    return diffDays === 0 || diffDays === 1; 
  };
  
  const urgentCount = schedule.filter(i => i.status === 'pending' && isUrgent(i.datetime)).length;
  const pendingCases = schedule.filter(i => i.status === 'pending');
  
  const caseTypeStats = {};
  schedule.forEach(i => { if(i.caseType) caseTypeStats[i.caseType] = (caseTypeStats[i.caseType] || 0) + 1 });
  const caseTypeData = Object.keys(caseTypeStats).map(key => ({ name: key, value: caseTypeStats[key] }));
  
  const judgeStats = {};
  pendingCases.forEach(i => { if(i.judge) judgeStats[i.judge] = (judgeStats[i.judge] || 0) + 1 });
  const judgeData = Object.keys(judgeStats).map(key => ({ name: key, value: judgeStats[key] })).sort((a,b) => b.value - a.value); 

  const CHART_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', 
    '#6366f1', '#84cc16', '#14b8a6', '#d946ef', 
    '#0ea5e9', '#f43f5e', '#eab308', '#64748b'
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-2xl text-blue-900">ĐANG TẢI...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-cover bg-center font-sans" style={{ backgroundImage: "url('/toaan.jpg')" }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        
        <div 
          className="relative z-10 w-full max-w-[480px] p-10 text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '24px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
          }}
        >
          <img src="/logo-toa-an-nhan-dan-toi-cao.png" alt="Logo" className="mx-auto mb-6 drop-shadow-2xl" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
          <h1 className="text-3xl font-black uppercase mb-10 tracking-tight" style={{ color: '#dc2626', textShadow: '2px 2px 4px rgba(255, 255, 255, 0.8)' }}>TAND KHU VỰC 9 - CẦN THƠ</h1>
          
          <form onSubmit={handleLogin} className="space-y-6 flex flex-col items-center">
            <input 
              type="email" 
              placeholder="Email..." 
              value={loginEmail} 
              onChange={e => setLoginEmail(e.target.value)} 
              className="w-full px-6 py-4 outline-none text-xl font-bold placeholder-gray-200"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '2px solid rgba(255, 255, 255, 0.5)', borderRadius: '12px' }}
              required 
            />
            <input 
              type="password" 
              placeholder="Mật khẩu..." 
              value={loginPass} 
              onChange={e => setLoginPass(e.target.value)} 
              className="w-full px-6 py-4 outline-none text-xl font-bold placeholder-gray-200"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '2px solid rgba(255, 255, 255, 0.5)', borderRadius: '12px' }}
              required 
            />
            <button 
              type="submit" 
              className="py-4 mt-4 font-black uppercase text-lg transition-all hover:opacity-80 active:scale-95"
              style={{ width: '50%', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '9999px', boxShadow: '0 0 15px rgba(37, 99, 235, 0.6)' }}
            >
              ĐĂNG NHẬP
            </button>
          </form>
        </div>
      </div>
    );
  }

  const canEdit = userRole === 'admin' || userRole === 'thuky';

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans antialiased tracking-tight relative">
      <div className="absolute inset-0 bg-black/30 z-0"></div>
      <datalist id="judges-list">{judgesList.map((name, i) => <option key={i} value={name} />)}</datalist>
      <datalist id="clerks-list">{clerksList.map((name, i) => <option key={i} value={name} />)}</datalist>
      <datalist id="prosecutors-list">{prosecutorsList.map((name, i) => <option key={i} value={name} />)}</datalist>

      <style dangerouslySetInnerHTML={{__html: `
        .rbc-event { background-color: #1e3a8a !important; border-radius: 0px !important; padding: 4px 8px !important; font-weight: 800 !important; border: none !important; }
        .rbc-event.rbc-selected { background-color: #000000 !important; box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #000000 !important; z-index: 10 !important; }
        .rbc-slot-selection { background-color: rgba(0, 0, 0, 0.6) !important; }
        .rbc-day-bg.rbc-today { background-color: #eff6ff !important; }
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px rgba(255, 255, 255, 0.1) inset !important;
            -webkit-text-fill-color: white !important;
            transition: background-color 5000s ease-in-out 0s;
        }
      `}} />

      {/* SIDEBAR */}
      <aside className="w-80 bg-blue-950 text-white hidden xl:flex flex-col fixed h-screen shadow-2xl border-r border-blue-900 z-20 overflow-y-auto">
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
        <div className="p-8 border-t border-white/5 bg-black/10 mt-auto">
          <div className="mb-6 p-4 bg-white/5 border border-white/10">
             <p className="text-[10px] text-blue-400 font-black uppercase mb-1 tracking-widest">Quyền: {userRole}</p>
             <p className="text-sm font-bold truncate opacity-70">{user?.email}</p>
          </div>
          <div className="space-y-3">
             <button onClick={() => setShowPwdModal(true)} className="w-full bg-blue-600 hover:bg-blue-700 py-4 font-black uppercase text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">🔑 ĐỔI MẬT KHẨU</button>
             <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 py-4 font-black uppercase text-xs transition-all flex items-center justify-center gap-2">🚪 ĐĂNG XUẤT</button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 xl:ml-80 flex flex-col min-h-screen relative z-10">
        
        <header className="bg-white/95 backdrop-blur-md h-24 shadow-sm flex items-center justify-between px-4 md:px-8 xl:px-12 sticky top-0 z-30 border-b border-gray-200 w-full">
          <div className="flex-1 flex justify-start items-center gap-2 xl:hidden">
             <button onClick={() => setShowPwdModal(true)} className="bg-blue-50 text-blue-700 px-3 py-2 text-[10px] sm:text-xs font-black uppercase border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm">🔑 Đổi MK</button>
             <button onClick={handleLogout} className="bg-red-50 text-red-600 border border-red-100 px-3 py-2 text-[10px] sm:text-xs font-black uppercase hover:bg-red-600 hover:text-white transition-all shadow-sm">🚪 Đăng xuất</button>
          </div>
          <div className="flex-1 hidden xl:block"></div>
          <div className="flex-[2] text-center px-2">
            <h1 className="font-black text-[14px] sm:text-[16px] md:text-xl xl:text-2xl uppercase text-blue-950 truncate">HỆ THỐNG QUẢN LÝ LỊCH TRỰC TUYẾN</h1>
          </div>
          <div className="flex-1 flex items-center justify-end">
             <div className="bg-blue-50 text-blue-700 px-3 py-2 sm:px-4 sm:py-2 md:px-6 md:py-3 font-black text-[10px] sm:text-xs md:text-sm border border-blue-100 uppercase tracking-widest text-center w-max">
               Cần Thơ: {moment().format("DD/MM/YYYY")}
             </div>
          </div>
        </header>

        <div className="p-4 md:p-12 flex-1">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
            <div className="bg-white p-8 border shadow-sm flex flex-col items-center">
               <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-6 w-full text-left">📊 TỶ LỆ LOẠI ÁN (TỔNG THỂ)</h3>
               {caseTypeData.length > 0 ? (
                 <div className="w-full h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={caseTypeData} cx="50%" cy="50%" outerRadius={110} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                         {caseTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                       </Pie>
                       <Tooltip formatter={(value) => [`${value} vụ`, 'Số lượng']} />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
               ) : <p className="text-gray-400 font-bold italic mt-10">Chưa có dữ liệu</p>}
            </div>

            <div className="bg-white p-8 border shadow-sm flex flex-col items-center">
               <h3 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-6 w-full text-left">👨‍⚖️ NĂNG SUẤT THẨM PHÁN (ĐANG CHỜ XỬ)</h3>
               {judgeData.length > 0 ? (
                 <div className="w-full h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={judgeData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="value" label={({name}) => name}>
                         {judgeData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 4) % CHART_COLORS.length]} />)}
                       </Pie>
                       <Tooltip formatter={(value) => [`${value} vụ`, 'Đang giải quyết']} />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
               ) : <p className="text-gray-400 font-bold italic mt-10">Chưa có dữ liệu thụ lý</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            
            {canEdit && (
              <div className="xl:col-span-4">
                <div className="bg-white p-6 md:p-10 border shadow-2xl sticky top-36">
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

                    <div className="bg-gray-50 p-4 md:p-8 space-y-6 border-2 border-gray-100">
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

            <div className={`space-y-12 ${!canEdit ? 'xl:col-span-12' : 'xl:col-span-8'}`}>
              
              <div className="bg-white p-4 md:p-8 border shadow-2xl h-[500px] overflow-hidden">
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
                
                <div className="p-6 md:p-10 border-b-2 border-gray-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sticky top-0 bg-white z-10">
                  <h3 className="font-black uppercase text-xl md:text-2xl text-blue-950 flex items-center gap-4 whitespace-nowrap">
                    <span className="w-2 h-10 bg-blue-950"></span>
                    Sổ thụ lý
                  </h3>
                  
                  <div className="flex flex-col md:flex-row flex-wrap gap-4 w-full justify-end items-stretch md:items-center">
                    
                    <div className="flex items-center gap-2 border-2 border-gray-100 px-4 py-3 bg-white w-full xl:w-auto">
                      <span className="text-xs font-black text-gray-400 uppercase">Từ:</span>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none text-sm md:text-base font-bold bg-transparent w-full" />
                      <span className="text-xs font-black text-gray-400 uppercase ml-2">Đến:</span>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none text-sm md:text-base font-bold bg-transparent w-full" />
                      {(startDate || endDate) && (
                        <button onClick={() => {setStartDate(""); setEndDate("")}} className="text-red-500 font-bold px-2 hover:bg-red-50 rounded" title="Xóa lộc ngày">✕</button>
                      )}
                    </div>

                    {/* BỘ LỌC NGƯỜI NHẬP LIỆU */}
                    <select value={creatorFilter} onChange={e => setCreatorFilter(e.target.value)} className="border-2 border-gray-100 px-4 py-3 text-sm md:text-base focus:border-blue-600 outline-none font-bold bg-white w-full xl:w-auto">
                      <option value="all">👤 Tất cả người nhập</option>
                      {creatorsList.map(email => <option key={email} value={email}>{email.split('@')[0]}</option>)}
                    </select>

                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border-2 border-gray-100 px-6 py-3 text-sm md:text-base focus:border-blue-600 outline-none font-bold bg-white w-full xl:w-auto">
                      <option value="pending">⏳ Đang chờ xử</option>
                      <option value="postponed">⏸ Đã hoãn</option>
                      <option value="completed">✅ Đã xử xong</option>
                      <option value="all">📁 Tất cả vụ án</option>
                    </select>

                    <input type="text" placeholder="Tìm kiếm tự do..." onChange={e => setSearchQuery(e.target.value)} className="border-2 border-gray-100 px-6 py-3 text-sm md:text-base w-full xl:w-64 focus:border-blue-600 outline-none font-bold" />
                    
                    <button onClick={exportToExcel} className="bg-green-600 text-white px-8 py-3 font-black uppercase shadow-xl hover:bg-green-700 transition-all flex items-center justify-center gap-3 w-full xl:w-auto">
                      📊 XUẤT EXCEL
                    </button>
                  </div>
                </div>

                <div className="overflow-auto flex-1">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-gray-50 text-[11px] font-black uppercase text-gray-400 border-b-2 border-gray-100 sticky top-0 z-10">
                      <tr>
                        <th className="p-6 md:p-10">Thời gian / Địa điểm</th>
                        <th className="p-6 md:p-10">Nội dung vụ việc</th>
                        <th className="p-6 md:p-10">Hội đồng & Thư ký</th>
                        {canEdit && <th className="p-6 md:p-10 text-center">Tác vụ</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-gray-50">
                      {processedSchedule.map(item => {
                       const isRowUrgent = item.status === 'pending' && isUrgent(item.datetime);

                        return (
                        <tr key={item.id} className={`transition-all group ${item.status === 'completed' || item.status === 'postponed' ? 'opacity-70 bg-gray-50/50' : isRowUrgent ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-blue-50/20'}`}>
                          <td className={`p-6 md:p-10 align-top ${isRowUrgent ? 'border-l-4 border-red-500' : ''}`}>
                            {item.status === 'postponed' ? (
                               <div className="text-amber-600 font-black text-lg md:text-xl mb-2 animate-pulse">⏸ ĐÃ HOÃN</div>
                            ) : (
                               <>
                                 <div className="font-black text-gray-950 text-xl md:text-2xl">{item.datetime ? moment(item.datetime).format("DD/MM/YYYY") : "---"}</div>
                                 <div className="text-blue-600 font-black text-lg md:text-xl mt-2">🕒 {item.datetime ? moment(item.datetime).format("HH:mm") : "---"}</div>
                               </>
                            )}
                            <div className="mt-4 font-black text-gray-400 uppercase text-xs tracking-widest">{item.room || "---"}</div>
                          </td>
                          <td className="p-6 md:p-10 align-top">
                            <div className="font-black uppercase text-gray-900 text-lg md:text-xl leading-tight mb-6 group-hover:text-blue-900 transition-colors">
                              {item.status === 'completed' && <span className="text-green-600 mr-2">✅</span>}
                              {item.status === 'postponed' && <span className="text-amber-500 mr-2">⏸</span>}
                              {isRowUrgent && <span className="bg-red-500 text-white px-2 py-1 text-xs rounded mr-2 animate-pulse">⚠️ SẮP XỬ</span>}
                              {item.caseName || "Vụ án chưa có tên"}
                            </div>
                            <div className="flex gap-4">
                                <span className="bg-blue-50 text-blue-800 px-5 py-2 text-xs font-black uppercase border border-blue-100">{item.caseType || "---"}</span>
                                <span className="bg-amber-50 text-amber-700 px-5 py-2 text-xs font-black uppercase border border-amber-100">{item.trialCount || "Lần 1"}</span>
                            </div>
                            <div className="mt-6 text-sm md:text-base text-gray-500 space-y-2 font-bold italic">
                                <p>📌 NĐ: {item.plaintiff || "N/A"}</p>
                                <p>📌 BĐ: {item.defendant || "N/A"}</p>
                            </div>
                            
                            {/* HIỂN THỊ DẤU ẤN NGƯỜI NHẬP / SỬA */}
                            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                               <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">✍️ Tạo bởi: <span className="text-blue-600">{item.createdBy ? item.createdBy.split('@')[0] : "Hệ thống"}</span></span>
                               {item.updatedBy && <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">🔄 Sửa bởi: <span className="text-amber-600">{item.updatedBy.split('@')[0]}</span></span>}
                            </div>
                          </td>
                          <td className="p-6 md:p-10 align-top space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-100 flex items-center justify-center text-blue-600 font-black text-sm shrink-0">TP</div>
                                <span className={`font-black text-lg md:text-xl ${isRowUrgent ? 'text-red-900' : 'text-gray-900'}`}>{item.judge || "---"}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm md:text-base text-gray-500 font-bold">
                                <div className="w-10 h-10 bg-gray-100 flex items-center justify-center font-black text-xs shrink-0">HT</div>
                                <span>{item.juror1 || "---"}, {item.juror2 || "---"}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm md:text-base text-gray-500 font-bold">
                                <div className="w-10 h-10 bg-gray-100 flex items-center justify-center font-black text-xs shrink-0">TK</div>
                                <span>{item.clerk || "---"}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm md:text-base text-red-600 font-black">
                                <div className="w-10 h-10 bg-red-50 flex items-center justify-center font-black text-xs shrink-0">KS</div>
                                <span>{item.prosecutor || "---"}</span>
                            </div>
                          </td>
                          {canEdit && (
                            <td className="p-6 md:p-10 text-center align-top">
                              <div className="flex flex-col gap-4">
                                {item.status === 'pending' || !item.status ? (
                                  <>
                                    <button onClick={() => toggleStatus(item.id, 'completed')} className="bg-green-50 text-green-700 px-4 py-3 font-black uppercase text-xs border border-green-100 hover:bg-green-600 hover:text-white transition-all">✔ XONG</button>
                                    <button onClick={() => toggleStatus(item.id, 'postponed')} className="bg-amber-50 text-amber-700 px-4 py-3 font-black uppercase text-xs border border-amber-100 hover:bg-amber-600 hover:text-white transition-all">⏸ HOÃN</button>
                                  </>
                                ) : item.status === 'postponed' ? (
                                  <button onClick={() => handleReschedule(item)} className="bg-blue-600 text-white px-4 py-3 font-black uppercase text-xs shadow-lg hover:bg-blue-700 transition-all">📅 LÊN LỊCH LẠI</button>
                                ) : (
                                  <button onClick={() => toggleStatus(item.id, 'pending')} className="bg-gray-200 text-gray-700 px-4 py-3 font-black uppercase text-xs hover:bg-gray-400 transition-all">↺ MỞ LẠI</button>
                                )}

                                <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="bg-blue-50 text-blue-700 px-4 py-3 font-black uppercase text-xs border border-blue-100 hover:bg-blue-600 hover:text-white transition-all mt-4">SỬA</button>
                                
                                {userRole === 'admin' && (
                                  <button onClick={async () => {if(confirm("Xóa hồ sơ này?")) {await deleteDoc(doc(db,"schedule",item.id)); loadData()}}} className="bg-red-50 text-red-700 px-4 py-3 font-black uppercase text-xs border border-red-100 hover:bg-red-600 hover:text-white transition-all">XÓA</button>
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

      {/* MODAL CHI TIẾT VỤ ÁN */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 md:p-6" onClick={() => setSelectedEvent(null)}>
           <div className="bg-white w-full max-w-lg shadow-2xl border-4 border-blue-900 md:scale-105" onClick={e => e.stopPropagation()}>
              <div className="bg-blue-900 p-6 md:p-8 text-white flex justify-between items-start">
                <div>
                  <p className="text-xs font-black uppercase opacity-80 mb-2">{selectedEvent.caseType || "---"} - {selectedEvent.trialCount || "---"}</p>
                  <h3 className="text-xl md:text-2xl font-black uppercase leading-tight">{selectedEvent.caseName || "Chưa có tên"}</h3>
                </div>
                {selectedEvent.status === 'completed' && <span className="bg-green-500 text-white px-3 py-1 font-black text-xs ml-4 shrink-0">ĐÃ XONG</span>}
                {selectedEvent.status === 'postponed' && <span className="bg-amber-500 text-white px-3 py-1 font-black text-xs ml-4 shrink-0">ĐÃ HOÃN</span>}
                {selectedEvent.status === 'pending' && isUrgent(selectedEvent.datetime) && <span className="bg-red-500 text-white px-3 py-1 font-black text-xs ml-4 animate-pulse shrink-0">SẮP XỬ</span>}
              </div>
              <div className="p-6 md:p-8 space-y-4 text-sm md:text-base font-bold text-gray-900">
                <p>🕒 <span className="text-blue-900">{selectedEvent.datetime ? moment(selectedEvent.datetime).format("HH:mm - DD/MM/YYYY") : "---"}</span> tại <span className="text-blue-900">{selectedEvent.room || "---"}</span></p>
                <hr className="border-gray-300 border-2"/>
                <p>👨‍⚖️ Thẩm phán: <span className="font-black text-gray-950">{selectedEvent.judge || "---"}</span></p>
                <p>⚖️ Hội thẩm: {selectedEvent.juror1 || "---"}, {selectedEvent.juror2 || "---"}</p>
                <p>📝 Thư ký: {selectedEvent.clerk || "---"}</p>
                <p>🛡️ Kiểm sát: <span className="text-red-600">{selectedEvent.prosecutor || "---"}</span></p>
                <hr className="border-gray-300 border-2"/>
                <p className="text-xs text-gray-500 uppercase tracking-widest">✍️ Nhập bởi: {selectedEvent.createdBy || "Không rõ"}</p>
                
                <button onClick={() => setSelectedEvent(null)} className="w-full bg-blue-900 text-white py-4 md:py-5 font-black uppercase mt-6 hover:bg-blue-800 transition-colors">ĐÓNG CỬA SỔ</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL ĐỔI MẬT KHẨU */}
      {showPwdModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 md:p-6" onClick={() => setShowPwdModal(false)}>
           <div className="bg-white w-full max-w-md shadow-2xl border-4 border-blue-900" onClick={e => e.stopPropagation()}>
              <div className="bg-blue-900 p-6 text-white text-center">
                <h3 className="text-xl font-black uppercase tracking-widest">🔑 ĐỔI MẬT KHẨU</h3>
              </div>
              <form onSubmit={handleChangePassword} className="p-6 md:p-8 space-y-6">
                <div>
                   <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Mật khẩu mới</label>
                   <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required className={inputBase} placeholder="Nhập mật khẩu mới..." minLength={6} />
                </div>
                <div>
                   <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Xác nhận mật khẩu</label>
                   <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required className={inputBase} placeholder="Nhập lại mật khẩu..." minLength={6} />
                </div>
                <div className="flex gap-4 pt-4">
                   <button type="button" onClick={() => setShowPwdModal(false)} className="w-1/2 bg-gray-200 text-gray-700 font-black py-4 uppercase hover:bg-gray-300 transition-all">HỦY BỎ</button>
                   <button type="submit" className="w-1/2 bg-blue-600 text-white font-black py-4 uppercase hover:bg-blue-700 transition-all shadow-lg">LƯU ĐỔI</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {toast.show && (
        <div className={`fixed bottom-6 md:bottom-12 right-6 md:right-12 z-[200] px-8 md:px-12 py-4 md:py-6 shadow-2xl font-black text-sm md:text-lg text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-700'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}