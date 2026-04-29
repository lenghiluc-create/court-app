'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import "react-big-calendar/lib/css/react-big-calendar.css";
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// Firebase Imports
import { db, auth } from './firebase'; 
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence, updatePassword } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';

const localizer = typeof window !== 'undefined' ? momentLocalizer(moment) : null;
const DnDCalendar = withDragAndDrop(Calendar);

export default function PremiumCourtApp() {
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('viewer'); 
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  
  // States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showOnlyUrgent, setShowOnlyUrgent] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState("table"); 

  // Modal States
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  // Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [judgeFilter, setJudgeFilter] = useState("all");
  const [clerkFilter, setClerkFilter] = useState("all");

  const calendarSectionRef = useRef(null);
  const tableSectionRef = useRef(null); 

  const initialForm = {
    datetime: "", room: "Trụ sở", caseType: "Hình sự", duration: 120, trialCount: "Lần 1", caseName: "", 
    plaintiff: "", defendant: "", judge: "", clerk: "", juror1: "", juror2: "", 
    prosecutor: "", status: "pending"
  };
  const [form, setForm] = useState(initialForm);

  // --- HỆ THỐNG STYLE ---
  const inputBase = "w-full border border-gray-300 rounded-md px-4 py-3 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-[15px] font-medium text-gray-800";
  const labelStyle = "block text-center text-[13px] font-black text-teal-900 bg-teal-100 border border-teal-200 py-2.5 px-4 rounded-md mb-2 w-full uppercase tracking-widest shadow-sm"; 
  const judgeLabelStyle = "block text-center text-[13px] font-black text-red-900 bg-red-100 border border-red-200 py-2.5 px-4 rounded-md mb-2 w-full uppercase tracking-widest shadow-sm";
  const filterStyle = "border border-gray-300 rounded-md px-4 py-2.5 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-[14px] font-medium text-gray-800 w-full md:w-auto cursor-pointer";

  const roleDisplayNames = { chanhan: "CHÁNH ÁN", admin: "QUẢN TRỊ VIÊN", thuky: "THƯ KÝ", thamphan: "THẨM PHÁN", viewer: "CHỈ XEM" };

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
        if (email === 'ltcnhung@thamphan.vn') setUserRole('chanhan');
        else if (email.includes('admin') || email === 'truongphong@gmail.com') setUserRole('admin');
        else if (email.includes('thuky')) setUserRole('thuky');
        else if (email.includes('thamphan')) setUserRole('thamphan');
        else setUserRole('viewer');
        loadData();
      } else setUser(null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    try {
      const threeMonthsAgo = moment().subtract(3, 'months').toISOString();
      const q = query(collection(db, "schedule"), where("datetime", ">=", threeMonthsAgo), orderBy("datetime", "desc"));
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
    } catch (err) { showToast("Sai tài khoản hoặc mật khẩu", "error"); } 
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); } catch (error) { showToast("Lỗi khi đăng xuất", "error"); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) return showToast("Mật khẩu xác nhận không khớp!", "error");
    try {
      await updatePassword(auth.currentUser, newPwd);
      showToast("✅ Đổi mật khẩu thành công!", "success");
      setShowPwdModal(false); setNewPwd(""); setConfirmPwd("");
    } catch (error) { showToast("Lỗi: " + error.message, "error"); }
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
      const updateData = { status: newStatus, updatedBy: user.email, updatedAt: moment().toISOString() };
      if (newStatus === 'completed') updateData.completedAt = moment().toISOString();
      await updateDoc(doc(db, "schedule", id), updateData);
      showToast("⏳ Đã cập nhật trạng thái!", "success");
      loadData();
    } catch (err) { showToast("Lỗi cập nhật", "error"); }
  };

  const togglePublish = async (item) => {
    try {
      const isPublishing = !item.publishedAt;
      await updateDoc(doc(db, "schedule", item.id), { 
        publishedAt: isPublishing ? moment().toISOString() : null,
        updatedBy: user.email, 
        updatedAt: moment().toISOString() 
      });
      showToast(isPublishing ? "📤 Đã ghi nhận phát hành!" : "Hủy ghi nhận", "success");
      loadData();
    } catch (err) { showToast("Lỗi cập nhật", "error"); }
  };

  const handleDelete = async (id) => {
    if(confirm("Xóa hồ sơ này?")) {
      await deleteDoc(doc(db,"schedule", id));
      loadData();
    }
  };

  const handleReschedule = (item) => {
    let nextTrialCount = item.trialCount === "Lần 1" ? "Lần 2" : "Mở lại";
    setForm({ ...item, datetime: "", trialCount: nextTrialCount, status: "pending" });
    setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'});
    showToast("⚠️ Đã kích hoạt Hoãn/Mở lại. Vui lòng chọn ngày giờ mới!", "success");
  };

  const onEventDrop = async ({ event, start }) => {
    if (userRole === 'thamphan' || userRole === 'viewer') return;
    const newDatetime = moment(start).format('YYYY-MM-DDTHH:mm');
    try {
      await updateDoc(doc(db, "schedule", event.id), { datetime: newDatetime, updatedAt: moment().toISOString() });
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleDragStart = (e, item) => { e.dataTransfer.setData("cardId", item.id); };
  const handleDragOver = (e) => e.preventDefault(); 
  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("cardId");
    if(id) toggleStatus(id, newStatus);
  };

  const handleStatCardClick = (type) => {
    if (type === 'urgent') { setStatusFilter('pending'); setShowOnlyUrgent(true); }
    else if (type === 'overdue_publish') { setStatusFilter('completed'); setShowOnlyUrgent(false); }
    else if (type === 'effective') { setStatusFilter('completed'); setShowOnlyUrgent(false); }
    else { setStatusFilter(type); setShowOnlyUrgent(false); }
    if(tableSectionRef.current) tableSectionRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const isUrgent = (datetime) => {
    if(!datetime) return false;
    const diffDays = moment(datetime).startOf('day').diff(moment().startOf('day'), 'days');
    return diffDays === 0 || diffDays === 1; 
  };

  const isOverduePublish = (item) => {
    if (item.status !== 'completed' || !item.completedAt || item.publishedAt) return false;
    return moment().startOf('day').diff(moment(item.completedAt).startOf('day'), 'days') >= 5;
  };

  const isEffective = (item) => {
    if (item.status !== 'completed' || !item.completedAt) return false;
    return moment().startOf('day').diff(moment(item.completedAt).startOf('day'), 'days') >= 30;
  };

  const processedSchedule = useMemo(() => {
    return schedule.filter(i => {
      const search = (searchQuery || "").toLowerCase().trim();
      const matchSearch = search === "" || i.caseName?.toLowerCase().includes(search) || i.plaintiff?.toLowerCase().includes(search) || i.defendant?.toLowerCase().includes(search);
      const matchStatus = statusFilter === 'all' ? true : i.status === statusFilter;
      const matchCreator = creatorFilter === 'all' ? true : i.createdBy === creatorFilter;
      const matchJudge = judgeFilter === 'all' ? true : i.judge === judgeFilter;
      const matchClerk = clerkFilter === 'all' ? true : i.clerk === clerkFilter;
      const matchUrgent = showOnlyUrgent ? isUrgent(i.datetime) : true;
      let matchDate = true;
      if (startDate || endDate) {
        const itemTime = moment(i.datetime).startOf('day').valueOf();
        const start = startDate ? moment(startDate).startOf('day').valueOf() : 0;
        const end = endDate ? moment(endDate).startOf('day').valueOf() : Infinity;
        if (itemTime < start || itemTime > end) matchDate = false;
      }
      return matchSearch && matchStatus && matchDate && matchCreator && matchJudge && matchClerk && matchUrgent;
    }).sort((a, b) => moment(b.datetime).diff(moment(a.datetime)));
  }, [schedule, searchQuery, statusFilter, showOnlyUrgent, creatorFilter, judgeFilter, clerkFilter, startDate, endDate]);

  const urgentCount = schedule.filter(i => i.status === 'pending' && isUrgent(i.datetime)).length;
  const overduePublishCount = schedule.filter(i => isOverduePublish(i)).length;
  const effectiveCount = schedule.filter(i => isEffective(i)).length;

  const caseTypeStats = {}; schedule.forEach(i => { if(i.caseType) caseTypeStats[i.caseType] = (caseTypeStats[i.caseType] || 0) + 1 });
  const caseTypeData = Object.keys(caseTypeStats).map(key => ({ name: key, value: caseTypeStats[key] }));
  const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

  const creatorsList = [...new Set(schedule.map(i => i.createdBy).filter(Boolean))];
  const judgesList = [...new Set(schedule.map(i => i.judge).filter(Boolean))];
  const clerksList = [...new Set(schedule.map(i => i.clerk).filter(Boolean))];
  const prosecutorsList = [...new Set(schedule.map(i => i.prosecutor).filter(Boolean))];

  const exportToExcel = () => {
    let tableHtml = `<table border="1"><tr><th>STT</th><th>Nội dung vụ án</th><th>Ngày xét xử</th><th>HĐXX</th><th>Phòng xử</th></tr>`;
    processedSchedule.forEach((item, index) => {
      tableHtml += `<tr><td>${index + 1}</td><td>${item.caseName}</td><td>${moment(item.datetime).format("DD/MM/YYYY")}</td><td>${item.judge} - ${item.clerk}</td><td>${item.room}</td></tr>`;
    });
    tableHtml += `</table>`;
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `Lich_Xet_Xu.xls`; link.click();
  };

  const calendarEvents = useMemo(() => {
    return schedule.filter(i => i.datetime && i.status !== 'suspended').map(i => ({ 
      ...i, title: `[${i.room}] ${i.caseName}`, start: new Date(i.datetime), end: new Date(new Date(i.datetime).getTime() + (i.duration || 60) * 60000) 
    }));
  }, [schedule]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-2xl text-blue-900">ĐANG TẢI...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 bg-cover bg-center" style={{ backgroundImage: "url('/toaan.jpg')" }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative bg-white p-10 rounded-xl shadow-2xl w-full max-w-md text-center">
          <img src="/lgtoaan1.png" className="w-20 mx-auto mb-4" />
          <h1 className="text-xl font-black text-red-600 mb-8 uppercase">Đăng nhập hệ thống KV9</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className={inputBase} required />
            <input type="password" placeholder="Mật khẩu" value={loginPass} onChange={e => setLoginPass(e.target.value)} className={inputBase} required />
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-md uppercase">Đăng nhập</button>
          </form>
        </div>
      </div>
    );
  }

  const canEdit = userRole !== 'viewer';
  const scrollToCalendar = () => calendarSectionRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col xl:flex-row font-sans relative">
      <datalist id="judges-list">{judgesList.map((name, i) => <option key={i} value={name} />)}</datalist>
      <datalist id="clerks-list">{clerksList.map((name, i) => <option key={i} value={name} />)}</datalist>
      <datalist id="prosecutors-list">{prosecutorsList.map((name, i) => <option key={i} value={name} />)}</datalist>

      {/* Sidebar */}
      <aside className="w-full xl:w-64 bg-red-700 text-white flex flex-col sticky top-0 xl:h-screen z-20 shadow-xl overflow-y-auto">
        <div className="p-8 text-center border-b border-white/20">
          <img src="/lgtoaan1.png" className="w-16 mx-auto mb-3" />
          <h2 className="font-black text-xl uppercase tracking-tighter">TAND KV9</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setViewMode('table')} className={`w-full text-left p-3 rounded font-bold uppercase text-xs ${viewMode==='table'?'bg-white text-red-700':'hover:bg-red-800'}`}>📋 DANH SÁCH</button>
          <button onClick={() => setViewMode('kanban')} className={`w-full text-left p-3 rounded font-bold uppercase text-xs ${viewMode==='kanban'?'bg-white text-red-700':'hover:bg-red-800'}`}>🗂️ BẢNG KÉO THẢ</button>
          <button onClick={scrollToCalendar} className="w-full text-left p-3 hover:bg-red-800 rounded font-bold uppercase text-xs">📅 LỊCH XÉT XỬ</button>
        </nav>
        <div className="p-4 bg-black/20 text-[11px] space-y-3">
          <p className="font-bold opacity-80 truncate">{user.email}</p>
          <p className="uppercase font-black text-amber-400">Quyền: {roleDisplayNames[userRole]}</p>
          <button onClick={() => setShowPwdModal(true)} className="w-full bg-white/10 hover:bg-white/20 py-2 rounded font-bold">ĐỔI MẬT KHẨU</button>
          <button onClick={handleLogout} className="w-full bg-black/30 hover:bg-black/50 py-2 rounded font-bold">ĐĂNG XUẤT</button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
           {[
             { label: 'Chờ xử', val: schedule.filter(i=>i.status==='pending').length, type: 'pending', col: 'text-blue-600' },
             { label: 'Sắp xử', val: urgentCount, type: 'urgent', col: 'text-red-600' },
             { label: 'Tạm ngừng', val: schedule.filter(i=>i.status==='suspended').length, type: 'suspended', col: 'text-purple-600' },
             { label: 'Đã xong', val: schedule.filter(i=>i.status==='completed').length, type: 'completed', col: 'text-green-600' },
             { label: 'Chưa PH', val: overduePublishCount, type: 'overdue_publish', col: 'text-red-700' },
             { label: 'Hiệu lực', val: effectiveCount, type: 'effective', col: 'text-teal-700' },
             { label: 'Tổng vụ', val: schedule.length, type: 'all', col: 'text-gray-500' }
           ].map((stat, idx) => (
             <div key={idx} onClick={() => handleStatCardClick(stat.type)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center cursor-pointer hover:shadow-md transition-all">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">{stat.label}</p>
                <p className={`text-2xl font-black ${stat.col}`}>{stat.val}</p>
             </div>
           ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[320px]">
                <h3 className="text-center text-xs font-black uppercase mb-4 text-gray-500 tracking-widest">Tỷ lệ theo loại án</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={caseTypeData} innerRadius={60} outerRadius={80} dataKey="value" label={({name, value})=>`${name} (${value})`}>
                            {caseTypeData.map((e,idx)=><Cell key={idx} fill={CHART_COLORS[idx%CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center text-center space-y-4">
                <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">Thông tin hệ thống</h3>
                <p className="text-sm font-bold text-gray-600 italic px-8">Hệ thống đang tự động theo dõi thời hạn phát hành bản án (5 ngày) và thời gian kháng cáo/kháng nghị (30 ngày) dựa trên ngày tuyên án.</p>
                <div className="flex justify-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase text-red-600">Cảnh báo chậm phát hành đang bật</span>
                </div>
            </div>
        </div>

        {/* Form Section */}
        {canEdit && (
          <section className="bg-white p-6 md:p-10 rounded-xl shadow-xl border border-gray-200 mb-12 transition-all">
            <h2 className="text-xl font-black text-blue-900 uppercase mb-10 text-center flex items-center justify-center gap-4">
                <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                {editingId ? "Cập nhật hồ sơ vụ án" : "Đăng ký lịch xét xử mới"}
                <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div><label className={labelStyle}>Ngày & Giờ xử <span className="text-red-500">*</span></label><input type="datetime-local" value={form.datetime} onChange={e => setForm({...form, datetime: e.target.value})} className={inputBase} /></div>
              <div><label className={labelStyle}>Địa điểm / Phòng xử <span className="text-red-500">*</span></label><select value={form.room} onChange={e => setForm({...form, room: e.target.value})} className={inputBase}><option value="Trụ sở">🏢 TRỤ SỞ</option><option value="Chi nhánh">🏢 CHI NHÁNH</option><option value="Trực tuyến">💻 TRỰC TUYẾN</option><option value="Lưu động">🚚 LƯU ĐỘNG</option></select></div>
              <div><label className={labelStyle}>Loại án</label><select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value})} className={inputBase}><option value="Hình sự">Hình sự</option><option value="Dân sự">Dân sự</option><option value="Hành chính">Hành chính</option><option value="Hôn nhân & GĐ">Hôn nhân & GĐ</option><option value="Kinh doanh TM">Kinh doanh TM</option></select></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="md:col-span-2"><label className={labelStyle}>Trích yếu vụ án <span className="text-red-500">*</span></label><textarea value={form.caseName} onChange={e => setForm({...form, caseName: e.target.value})} className={inputBase} rows="2" /></div>
                <div><label className={labelStyle}>Lần xét xử</label><select value={form.trialCount} onChange={e => setForm({...form, trialCount: e.target.value})} className={inputBase}><option value="Lần 1">Lần 1</option><option value="Lần 2">Lần 2</option><option value="Mở lại">Mở lại</option></select></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div><label className={labelStyle}>Nguyên đơn / Người bị hại</label><input value={form.plaintiff} onChange={e => setForm({...form, plaintiff: e.target.value})} className={inputBase} /></div>
                <div><label className={labelStyle}>Bị đơn / Bị cáo</label><input value={form.defendant} onChange={e => setForm({...form, defendant: e.target.value})} className={inputBase} /></div>
            </div>

            {/* Thành phần HĐXX - NỀN ĐỎ */}
            <div className="bg-red-50 p-8 rounded-lg border border-red-200 mb-10 shadow-inner">
               <h3 className="text-sm font-bold text-white bg-red-600 py-3 rounded-md mb-8 text-center uppercase shadow-md tracking-widest">Thành phần Hội đồng xét xử</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  <div><label className={judgeLabelStyle}>Thẩm phán</label><input list="judges-list" value={form.judge} onChange={e => setForm({...form, judge: e.target.value})} className={inputBase} /></div>
                  <div><label className={judgeLabelStyle}>Thư ký</label><input list="clerks-list" value={form.clerk} onChange={e => setForm({...form, clerk: e.target.value})} className={inputBase} /></div>
                  <div><label className={judgeLabelStyle}>Kiểm sát viên</label><input list="prosecutors-list" value={form.prosecutor} onChange={e => setForm({...form, prosecutor: e.target.value})} className={inputBase} /></div>
                  <div><label className={judgeLabelStyle}>Hội thẩm 1</label><input value={form.juror1} onChange={e => setForm({...form, juror1: e.target.value})} className={inputBase} /></div>
                  <div><label className={judgeLabelStyle}>Hội thẩm 2</label><input value={form.juror2} onChange={e => setForm({...form, juror2: e.target.value})} className={inputBase} /></div>
               </div>
            </div>

            <div className="flex gap-4">
               {editingId && <button onClick={()=>{setEditingId(null); setForm(initialForm);}} className="flex-1 bg-gray-200 text-gray-700 font-black py-4 rounded-md uppercase hover:bg-gray-300 transition-all">HỦY BỎ</button>}
               <button onClick={handleSubmit} className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-md uppercase shadow-lg active:scale-95 hover:bg-blue-700 transition-all">LƯU THÔNG TIN HỒ SƠ</button>
            </div>
          </section>
        )}

        {/* View Mode Switching */}
        {viewMode === 'kanban' ? (
           <div className="flex gap-6 overflow-x-auto pb-10 items-start min-h-[600px] custom-scrollbar">
             {[
               { id: 'pending', title: '⏳ ĐANG CHỜ XỬ', color: 'border-l-blue-500' },
               { id: 'suspended', title: '⏸️ TẠM NGỪNG', color: 'border-l-purple-500' },
               { id: 'completed', title: '✅ ĐÃ XỬ XONG', color: 'border-l-green-500' }
             ].map(col => (
               <div key={col.id} onDragOver={handleDragOver} onDrop={(e)=>handleDrop(e, col.id)} className="flex-1 min-w-[350px] bg-gray-200/50 rounded-xl p-4 border border-gray-300 shadow-inner">
                  <h3 className="text-center font-black uppercase text-[11px] mb-4 py-3 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-600 tracking-tighter">
                    {col.title} <span className="ml-2 bg-gray-100 px-2 py-0.5 rounded-full">{processedSchedule.filter(i=>i.status===col.id).length}</span>
                  </h3>
                  <div className="space-y-4">
                    {processedSchedule.filter(i=>i.status===col.id).map(item => {
                        const overdue = isOverduePublish(item);
                        const effective = isEffective(item);
                        return (
                          <div key={item.id} draggable onDragStart={(e)=>handleDragStart(e, item)} className={`bg-white p-5 rounded-xl shadow-sm border-l-4 ${col.color} border-y border-r border-gray-200 group hover:shadow-md transition-all cursor-grab active:cursor-grabbing`}>
                             <p className="font-black text-sm text-blue-950 uppercase mb-3 leading-tight">{item.caseName}</p>
                             
                             {overdue && <div className="mb-3 text-[9px] font-black text-red-600 bg-red-50 p-2 rounded border border-red-100 animate-pulse">⚠️ CHẬM PHÁT HÀNH</div>}
                             {effective && <div className="mb-3 text-[9px] font-black text-teal-700 bg-teal-50 p-2 rounded border border-teal-100">✔️ ĐÃ CÓ HIỆU LỰC</div>}

                             <div className="space-y-2 text-[10px] font-bold text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <p className="flex items-center gap-2">🕒 {moment(item.datetime).format("HH:mm - DD/MM/YYYY")}</p>
                                <p className="flex items-center gap-2">👨‍⚖️ TP: {item.judge}</p>
                                <p className="flex items-center gap-2">📝 TK: {item.clerk}</p>
                             </div>
                             
                             <div className="mt-4 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                                <button onClick={()=>{setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="flex-1 py-2 bg-blue-50 text-blue-700 text-[9px] font-black uppercase rounded border border-blue-100">Sửa</button>
                                <button onClick={()=>setSelectedEvent(item)} className="flex-1 py-2 bg-gray-50 text-gray-700 text-[9px] font-black uppercase rounded border border-gray-200">Xem</button>
                             </div>
                          </div>
                        )
                    })}
                  </div>
               </div>
             ))}
           </div>
        ) : (
          <section ref={tableSectionRef} className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden transition-all">
            <div className="p-6 md:p-8 border-b flex flex-col xl:flex-row gap-6 justify-between items-center bg-white sticky top-0 z-10">
               <h3 className="font-black text-xl text-blue-950 uppercase flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-blue-950 rounded-full"></span> Sổ thụ lý trực tuyến
               </h3>
               <div className="flex flex-wrap gap-3 w-full xl:w-auto">
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="border p-2.5 rounded text-xs outline-none focus:border-blue-500" />
                  <select value={judgeFilter} onChange={e=>setJudgeFilter(e.target.value)} className="border p-2.5 rounded text-xs outline-none focus:border-blue-500">
                    <option value="all">Tất cả Thẩm phán</option>
                    {judgesList.map(j=><option key={j} value={j}>{j}</option>)}
                  </select>
                  <input type="text" placeholder="Tìm kiếm nhanh..." onChange={e => setSearchQuery(e.target.value)} className="border p-2.5 rounded-md text-xs flex-1 xl:w-64 outline-none focus:border-blue-500 shadow-inner" />
                  <button onClick={exportToExcel} className="bg-green-600 text-white px-5 py-2.5 rounded font-black uppercase text-[10px] hover:bg-green-700 shadow-md">📊 Excel</button>
               </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-[11px] font-black uppercase text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="p-6 text-center w-[12%]">Thời gian</th>
                    <th className="p-6 w-[40%]">Nội dung vụ án & Trạng thái</th>
                    <th className="p-6 w-[28%]">Thành phần HĐXX</th>
                    <th className="p-6 text-center w-[20%]">Tác vụ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {processedSchedule.map((item, idx) => {
                    const overdue = isOverduePublish(item);
                    const effective = isEffective(item);
                    const urgent = item.status === 'pending' && isUrgent(item.datetime);
                    
                    return (
                      <tr key={item.id} className={`hover:bg-blue-50/40 transition-colors ${idx%2===0?'bg-white':'bg-gray-50/30'}`}>
                        <td className="p-6 text-center align-top">
                          <div className={`font-black text-sm ${urgent?'text-red-600':'text-gray-900'}`}>{moment(item.datetime).format("DD/MM/YYYY")}</div>
                          <div className="text-blue-600 font-black text-base mt-1">🕒 {moment(item.datetime).format("HH:mm")}</div>
                          <div className="mt-3 text-[10px] font-black text-gray-400 bg-gray-100 py-1 px-2 rounded uppercase">{item.room}</div>
                        </td>
                        <td className="p-6 align-top">
                          <div className="font-black text-blue-950 uppercase text-sm mb-2 leading-tight group relative">
                            {item.caseName}
                            <div className="hidden group-hover:block absolute top-full left-0 mt-2 p-3 bg-white border shadow-2xl rounded-lg z-50 min-w-[300px] text-[11px] normal-case text-gray-600 font-medium">
                               <p><b>Nguyên đơn:</b> {item.plaintiff}</p>
                               <p><b>Bị đơn:</b> {item.defendant}</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mb-3">
                             {item.status === 'completed' && <span className="bg-green-100 text-green-700 text-[9px] px-2.5 py-1 rounded-full font-black">XỬ XONG</span>}
                             {item.status === 'suspended' && <span className="bg-purple-100 text-purple-700 text-[9px] px-2.5 py-1 rounded-full font-black">TẠM NGỪNG</span>}
                             {overdue && <span className="bg-red-600 text-white text-[9px] px-2.5 py-1 rounded-full font-black animate-pulse shadow-sm">⚠️ CHẬM PHÁT HÀNH</span>}
                             {effective && <span className="bg-teal-600 text-white text-[9px] px-2.5 py-1 rounded-full font-black shadow-sm">✔️ HIỆU LỰC</span>}
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-[11px] text-gray-500 font-semibold border-t border-gray-100 pt-3">
                             <div>Lần xử: <span className="text-gray-800">{item.trialCount}</span></div>
                             <div>Loại án: <span className="text-gray-800">{item.caseType}</span></div>
                          </div>
                          
                          {item.completedAt && (
                             <div className="mt-2 text-[10px] text-gray-400 italic">
                                Tuyên án: {moment(item.completedAt).format("DD/MM")} 
                                {item.publishedAt && <span className="ml-3 text-green-600 font-bold">✅ Đã PH: {moment(item.publishedAt).format("DD/MM")}</span>}
                             </div>
                          )}
                        </td>
                        <td className="p-6 align-top text-xs space-y-2">
                          <div className="flex items-center gap-2"><span className="w-8 font-black text-red-600">TP:</span> <span className="font-bold text-gray-800">{item.judge || "---"}</span></div>
                          <div className="flex items-center gap-2"><span className="w-8 font-bold text-gray-400">TK:</span> <span className="font-bold text-gray-700">{item.clerk || "---"}</span></div>
                          <div className="flex items-center gap-2"><span className="w-8 font-bold text-gray-400">KSV:</span> <span className="font-bold text-gray-700">{item.prosecutor || "---"}</span></div>
                          <div className="pt-2 text-[10px] text-gray-400 font-medium">HT: {item.juror1}, {item.juror2}</div>
                        </td>
                        <td className="p-6 align-top">
                          <div className="flex flex-col gap-2 max-w-[150px] mx-auto">
                            {item.status === 'pending' && (
                              <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => toggleStatus(item.id, 'completed')} className="bg-green-600 text-white py-2.5 rounded-lg text-[10px] font-black uppercase hover:bg-green-700 shadow-sm transition-all">XONG</button>
                                <button onClick={() => handleReschedule(item)} className="bg-gray-100 text-gray-600 py-2.5 rounded-lg text-[10px] font-black uppercase hover:bg-gray-200 border border-gray-200 transition-all">HOÃN</button>
                              </div>
                            )}
                            
                            {item.status === 'completed' && (
                               <button onClick={() => togglePublish(item)} className={`py-2.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-md ${item.publishedAt ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200'}`}>
                                 {item.publishedAt ? "✅ ĐÃ PH" : "📤 PHÁT HÀNH"}
                               </button>
                            )}

                            {item.status === 'suspended' && (
                               <button onClick={() => handleReschedule(item)} className="bg-purple-600 text-white py-2.5 rounded-lg text-[10px] font-black uppercase hover:bg-purple-700 shadow-md transition-all">Lên lịch lại</button>
                            )}

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 border-dashed mt-2">
                              <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="bg-blue-50 text-blue-600 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-blue-100 border border-blue-50 transition-all">SỬA</button>
                              <button onClick={() => handleDelete(item.id)} className="bg-red-50 text-red-600 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-red-100 border border-red-50 transition-all">XÓA</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {processedSchedule.length === 0 && (
                     <tr><td colSpan="4" className="p-20 text-center font-bold text-gray-400 italic">Không tìm thấy vụ án nào theo bộ lọc của bạn...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Calendar visual */}
        <section ref={calendarSectionRef} className="bg-white p-6 md:p-10 rounded-xl shadow-xl border border-gray-200 h-[750px] mt-12 overflow-hidden transition-all">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-black uppercase text-gray-500 text-xs tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-6 bg-red-600 rounded-full"></span> Lịch xét xử trực quan
             </h3>
             <div className="flex gap-4 text-[10px] font-bold">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500/20 border border-blue-500 rounded"></span> Chờ xử</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500/20 border border-green-500 rounded"></span> Đã xong</span>
             </div>
          </div>
          {isMounted && localizer && (
            <DnDCalendar 
                localizer={localizer} 
                events={calendarEvents} 
                onEventDrop={onEventDrop} 
                onSelectEvent={e => setSelectedEvent(e)}
                style={{ height: '90%' }} 
                messages={{ next: "Tiếp", previous: "Trước", today: "Hôm nay", month: "Tháng", week: "Tuần", day: "Ngày" }}
            />
          )}
        </section>
      </main>

      {/* --- CÁC MODAL HỆ THỐNG --- */}

      {/* Modal chi tiết vụ án */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={() => setSelectedEvent(null)}>
           <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="p-10 bg-gradient-to-br from-blue-900 to-blue-700 text-white">
                <p className="text-[10px] font-black uppercase opacity-60 mb-3 tracking-[0.2em]">{selectedEvent.caseType} - {selectedEvent.trialCount}</p>
                <h3 className="text-2xl font-black uppercase leading-tight drop-shadow-lg">{selectedEvent.caseName}</h3>
              </div>
              <div className="p-10 space-y-6 text-gray-900 font-bold">
                <div className="flex items-center gap-5 p-4 bg-gray-50 rounded-2xl"><div className="text-3xl">🕒</div><p className="text-xl font-black text-blue-950">{moment(selectedEvent.datetime).format("HH:mm - DD/MM/YYYY")}</p></div>
                <div className="flex items-center gap-5 p-4 bg-gray-50 rounded-2xl"><div className="text-3xl">👨‍⚖️</div><p className="text-lg">Thẩm phán: {selectedEvent.judge}</p></div>
                <div className="flex items-center gap-5 p-4 bg-red-50 rounded-2xl"><div className="text-3xl">🛡️</div><p className="text-lg text-red-700">KSV: {selectedEvent.prosecutor}</p></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-2xl text-[11px]"><p className="text-gray-400 uppercase mb-1">Nguyên đơn</p>{selectedEvent.plaintiff}</div>
                    <div className="p-4 border rounded-2xl text-[11px]"><p className="text-gray-400 uppercase mb-1">Bị đơn</p>{selectedEvent.defendant}</div>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="w-full bg-blue-950 text-white py-5 font-black uppercase rounded-2xl mt-4 shadow-xl active:scale-95 transition-all">ĐÓNG THÔNG TIN</button>
              </div>
           </div>
        </div>
      )}

      {/* Modal đổi mật khẩu */}
      {showPwdModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
           <div className="bg-white rounded-[32px] shadow-2xl p-10 w-full max-w-md border border-gray-100">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">🔑</div>
              <h3 className="text-center font-black uppercase mb-8 text-blue-900 tracking-widest">Thiết lập mật khẩu mới</h3>
              <div className="space-y-4">
                <input type="password" placeholder="Mật khẩu mới (ít nhất 6 ký tự)" value={newPwd} onChange={e => setNewPwd(e.target.value)} className={inputBase + " !bg-gray-50 border-none"} />
                <input type="password" placeholder="Xác nhận lại mật khẩu" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className={inputBase + " !bg-gray-50 border-none"} />
              </div>
              <div className="flex gap-4 mt-10">
                <button onClick={() => setShowPwdModal(false)} className="flex-1 bg-gray-100 text-gray-500 font-bold py-4 rounded-2xl uppercase text-[11px] tracking-widest hover:bg-gray-200 transition-all">HỦY BỎ</button>
                <button onClick={handleChangePassword} className="flex-[2] bg-blue-600 text-white font-bold py-4 rounded-2xl uppercase text-[11px] tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all">LƯU THAY ĐỔI</button>
              </div>
           </div>
        </div>
      )}

      {/* Toast thông báo */}
      {toast.show && (
        <div className={`fixed bottom-8 right-8 z-[200] px-10 py-5 shadow-2xl font-black text-white rounded-2xl animate-in slide-in-from-right-10 duration-300 ${toast.type === 'error' ? 'bg-red-600 shadow-red-200' : 'bg-blue-950 shadow-blue-200'}`}>
            <div className="flex items-center gap-4">
                <span className="text-xl">{toast.type === 'error' ? '❌' : '✅'}</span>
                <span className="uppercase text-xs tracking-widest">{toast.message}</span>
            </div>
        </div>
      )}
    </div>
  );
}