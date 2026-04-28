'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import "react-big-calendar/lib/css/react-big-calendar.css";
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
  const [statusFilter, setStatusFilter] = useState("pending");
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

  const inputBase = "w-full border border-gray-300 rounded-md px-4 py-3 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-[15px] font-medium text-gray-800";
  const labelStyle = "block text-center text-[13px] font-black text-teal-900 bg-teal-100 border border-teal-200 py-2.5 px-4 rounded-md mb-2 w-full uppercase tracking-widest shadow-sm"; 
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
      showToast("Đăng nhập thành công!", "success");
    } catch (err) { showToast("Sai tài khoản hoặc mật khẩu", "error"); } 
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); showToast("Đã đăng xuất hệ thống", "success"); } 
    catch (error) { showToast("Lỗi khi đăng xuất", "error"); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) return showToast("Mật khẩu xác nhận không khớp!", "error");
    if (newPwd.length < 6) return showToast("Mật khẩu phải từ 6 ký tự trở lên!", "error");
    try {
      await updatePassword(auth.currentUser, newPwd);
      showToast("✅ Đổi mật khẩu thành công!", "success");
      setShowPwdModal(false); setNewPwd(""); setConfirmPwd("");
    } catch (error) { showToast("Lỗi: " + error.message, "error"); }
  };

  const isConflictServerSide = async (newStartStr, room, excludeId, durationMins) => {
    try {
      const startNew = moment(newStartStr);
      const endNew = moment(startNew).add(durationMins, 'minutes');
      const q = query(collection(db, "schedule"), where("room", "==", room), where("status", "==", "pending"));
      const snap = await getDocs(q);
      let hasConflict = false;
      snap.forEach(doc => {
        if (doc.id === excludeId) return;
        const data = doc.data();
        if (!data.datetime) return;
        const startEx = moment(data.datetime);
        const endEx = moment(startEx).add(data.duration || 60, 'minutes');
        if (startNew.isBefore(endEx) && startEx.isBefore(endNew)) hasConflict = true;
      });
      return hasConflict;
    } catch (error) { return true; }
  };

  const handleSubmit = async () => {
    if (userRole === 'thamphan' || userRole === 'viewer') return showToast("Không có quyền!", "error");
    if (!form.datetime || !form.caseName || !form.room) return showToast("Vui lòng nhập đủ thông tin!", "error");
    
    const isConflict = await isConflictServerSide(form.datetime, form.room, editingId, form.duration);
    if(isConflict) return showToast("⚠️ Xin lỗi, phòng này vừa được đặt. Vui lòng chọn giờ khác!", "error");

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

  const toggleStatus = async (id, newStatus, caseName) => {
    try {
      const updateData = { status: newStatus, updatedBy: user.email, updatedAt: moment().toISOString() };
      if (newStatus === 'completed') updateData.completedAt = moment().toISOString();
      await updateDoc(doc(db, "schedule", id), updateData);
      
      let msg = "⏳ Đã cập nhật trạng thái!";
      if (newStatus === 'completed') msg = "✅ Đã đánh dấu xử xong!";
      if (newStatus === 'suspended') msg = "⏸ Phiên tòa đã tạm ngừng (Chờ báo sau)!";
      
      showToast(msg, "success");
      loadData();
    } catch (err) { showToast("Lỗi cập nhật trạng thái", "error"); }
  };

  const handleDelete = async (id, caseName) => {
    if(confirm("Xóa hồ sơ này?")) {
      await deleteDoc(doc(db,"schedule", id));
      loadData();
    }
  };

  const onEventDrop = async ({ event, start, end }) => {
    if (userRole === 'thamphan' || userRole === 'viewer') return showToast("Không có quyền dời lịch!", "error");
    const newDatetime = moment(start).format('YYYY-MM-DDTHH:mm');
    const isConflict = await isConflictServerSide(newDatetime, event.room, event.id, event.duration || 60);
    if (isConflict) return showToast(`⚠️ Trùng lịch phòng ${event.room}!`, "error");

    try {
      await updateDoc(doc(db, "schedule", event.id), { datetime: newDatetime, updatedBy: user.email, updatedAt: moment().toISOString() });
      showToast("🔄 Đã dời lịch thành công!", "success");
      loadData();
    } catch (err) { showToast("Lỗi dời lịch", "error"); }
  };

  const handleDragStart = (e, item) => { e.dataTransfer.setData("cardId", item.id); e.dataTransfer.setData("caseName", item.caseName); };
  const handleDragOver = (e) => e.preventDefault(); 
  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    if (!canEdit) return showToast("Không có quyền chuyển trạng thái!", "error");
    const id = e.dataTransfer.getData("cardId");
    const caseName = e.dataTransfer.getData("caseName");
    if(id) {
      const currentItem = schedule.find(i => i.id === id);
      if (currentItem && currentItem.status !== newStatus) await toggleStatus(id, newStatus, caseName);
    }
  };

  const handleReschedule = (item) => {
    let nextTrialCount = item.trialCount === "Lần 1" ? "Lần 2" : "Mở lại";
    setForm({ ...item, datetime: "", trialCount: nextTrialCount, status: "pending" });
    setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'});
    showToast("Đã lấy dữ liệu, vui lòng chọn ngày giờ mới!", "success");
  };

  const handleSendEmail = (item) => {
    const body = `Kính gửi Hội đồng xét xử,\n\nHệ thống xin thông báo lịch xét xử:\n- Vụ án: ${item.caseName}\n- Loại án: ${item.caseType} (${item.trialCount})\n- Thời gian: ${item.status === 'suspended' ? "TẠM NGỪNG (Chờ báo sau)" : moment(item.datetime).format("HH:mm - DD/MM/YYYY")}\n- Địa điểm: ${item.room}\n\nThành phần HĐXX:\n- Thẩm phán: ${item.judge || "..."}\n- Thư ký: ${item.clerk || "..."}\n- KSV: ${item.prosecutor || "..."}\n- Hội thẩm: ${item.juror1 || "..."} & ${item.juror2 || "..."}\n\nTrân trọng!`;
    navigator.clipboard.writeText(body).then(() => showToast("📋 Đã copy nội dung! Dán (Ctrl+V) vào Zalo/Email để gửi.", "success")).catch(() => showToast("Lỗi copy!", "error"));
  };

  const scrollToCalendar = () => { if(calendarSectionRef.current) calendarSectionRef.current.scrollIntoView({ behavior: 'smooth' }); };
  const scrollToTable = () => { if(tableSectionRef.current) tableSectionRef.current.scrollIntoView({ behavior: 'smooth' }); };

  const handleStatCardClick = (type) => {
    if (type === 'all') { setStatusFilter('all'); setShowOnlyUrgent(false); }
    if (type === 'pending') { setStatusFilter('pending'); setShowOnlyUrgent(false); }
    if (type === 'completed') { setStatusFilter('completed'); setShowOnlyUrgent(false); }
    if (type === 'suspended') { setStatusFilter('suspended'); setShowOnlyUrgent(false); }
    if (type === 'urgent') { setStatusFilter('pending'); setShowOnlyUrgent(true); }
    scrollToTable();
  };

  const isUrgent = (datetime) => {
    if(!datetime) return false;
    const diffDays = moment(datetime).startOf('day').diff(moment().startOf('day'), 'days');
    return diffDays === 0 || diffDays === 1; 
  };

  const creatorsList = [...new Set(schedule.map(i => i.createdBy).filter(Boolean))];
  const judgesList = [...new Set(schedule.map(i => i.judge).filter(Boolean))];
  const clerksList = [...new Set(schedule.map(i => i.clerk).filter(Boolean))];
  const prosecutorsList = [...new Set(schedule.map(i => i.prosecutor).filter(Boolean))];

  const processedSchedule = useMemo(() => {
    return schedule.filter(i => {
      const search = (searchQuery || "").toLowerCase().trim();
      const matchSearch = search === "" || (i.caseName || "").toLowerCase().includes(search) || (i.plaintiff || "").toLowerCase().includes(search) || (i.defendant || "").toLowerCase().includes(search);
      const matchStatus = statusFilter === 'all' ? true : i.status === statusFilter;
      const matchCreator = creatorFilter === 'all' ? true : (i.createdBy === creatorFilter);
      const matchJudge = judgeFilter === 'all' ? true : (i.judge === judgeFilter);
      const matchClerk = clerkFilter === 'all' ? true : (i.clerk === clerkFilter);
      const matchUrgent = showOnlyUrgent ? isUrgent(i.datetime) : true;
      let matchDate = true;
      if (startDate || endDate) {
        const itemDateStr = i.datetime ? i.datetime.split('T')[0] : null;
        if (!itemDateStr) { matchDate = false; } 
        else {
          const itemTime = moment(itemDateStr).startOf('day').valueOf();
          const start = startDate ? moment(startDate).startOf('day').valueOf() : 0;
          const end = endDate ? moment(endDate).startOf('day').valueOf() : Infinity;
          if (itemTime < start || itemTime > end) matchDate = false;
        }
      }
      return matchSearch && matchStatus && matchDate && matchCreator && matchJudge && matchClerk && matchUrgent;
    }).sort((a, b) => {
      const dateA = a.datetime ? new Date(a.datetime).getTime() : 0;
      const dateB = b.datetime ? new Date(b.datetime).getTime() : 0;
      if (a.status === 'pending' && b.status === 'pending') return dateA - dateB;
      if (a.status !== 'pending' && b.status !== 'pending') return dateB - dateA;
      return a.status === 'pending' ? -1 : 1;
    });
  }, [schedule, searchQuery, statusFilter, showOnlyUrgent, creatorFilter, judgeFilter, clerkFilter, startDate, endDate]);

  const urgentCount = schedule.filter(i => i.status === 'pending' && isUrgent(i.datetime)).length;
  const pendingCases = schedule.filter(i => i.status === 'pending');

  const caseTypeStats = {}; schedule.forEach(i => { if(i.caseType) caseTypeStats[i.caseType] = (caseTypeStats[i.caseType] || 0) + 1 });
  const caseTypeData = Object.keys(caseTypeStats).map(key => ({ name: key, value: caseTypeStats[key] }));
  const judgeStats = {}; pendingCases.forEach(i => { if(i.judge) judgeStats[i.judge] = (judgeStats[i.judge] || 0) + 1 });
  const judgeData = Object.keys(judgeStats).map(key => ({ name: key, value: judgeStats[key] })).sort((a,b) => b.value - a.value); 
  const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

  const exportToExcel = () => {
    if (schedule.length === 0) return showToast("Không có dữ liệu để xuất!", "error");
    const dataToExport = processedSchedule; 
    if (dataToExport.length === 0) return showToast("Không có dữ liệu trong bộ lọc!", "error");
    let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8" /><style>table { border-collapse: collapse; width: 100%; font-family: 'Times New Roman', Times, serif; font-size: 13pt; } td, th { border: 1px solid #000000; padding: 8px; vertical-align: top; } .no-border { border: none !important; } .text-center { text-align: center; vertical-align: middle; } .font-bold { font-weight: bold; }</style></head><body><table><tr><td colspan="2" class="no-border text-center font-bold">TÒA ÁN NHÂN DÂN<br/>KHU VỰC 9 - CẦN THƠ</td><td colspan="5" class="no-border text-center font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập - Tự do - Hạnh Phúc</td></tr><tr><td colspan="7" class="no-border text-center"><i>Cần Thơ, ngày ${moment().format("DD")} tháng ${moment().format("MM")} năm ${moment().format("YYYY")}</i></td></tr><tr><td colspan="7" class="no-border"></td></tr><tr><td colspan="7" class="no-border text-center font-bold" style="font-size: 16pt;">LỊCH XÉT XỬ</td></tr><tr><td colspan="7" class="no-border"></td></tr><tr><th class="text-center font-bold" style="background-color: #f2f2f2;">STT</th><th class="text-center font-bold" style="background-color: #f2f2f2;">NỘI DUNG VỤ ÁN</th><th class="text-center font-bold" style="background-color: #f2f2f2;">NGÀY XÉT XỬ</th><th class="text-center font-bold" style="background-color: #f2f2f2;">CHỦ TỌA, THƯ KÝ, KSV</th><th class="text-center font-bold" style="background-color: #f2f2f2;">HỘI THẨM NHÂN DÂN</th><th class="text-center font-bold" style="background-color: #f2f2f2;">PHÒNG XÉT XỬ</th><th class="text-center font-bold" style="background-color: #f2f2f2;">NGƯỜI NHẬP</th></tr>`;
    dataToExport.forEach((item, index) => {
      const noidung = `<b>${item.caseName || ""}</b><br/>NĐ: ${item.plaintiff || ""}<br/>BĐ: ${item.defendant || ""}`;
      const thoigian = item.status === 'suspended' ? 'TẠM NGỪNG<br/>(Chờ báo sau)' : `${moment(item.datetime).format("HH")} giờ ${moment(item.datetime).format("mm")} phút<br/>Ngày ${moment(item.datetime).format("DD/MM/YYYY")}`;
      tableHtml += `<tr><td class="text-center">${index + 1}</td><td>${noidung}</td><td class="text-center">${thoigian}</td><td>TP: ${item.judge || ""}<br/>TK: ${item.clerk || ""}<br/>KSV: ${item.prosecutor || ""}</td><td>${item.juror1 || ""}<br/>${item.juror2 || ""}</td><td class="text-center font-bold">${item.room || ""}</td><td class="text-center">${item.createdBy ? item.createdBy.split('@')[0] : ""}</td></tr>`;
    });
    tableHtml += `</table></body></html>`;
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `Lich_Xet_Xu_${startDate ? moment(startDate).format("DDMMYY") : "All"}.xls`;
    link.click(); showToast("Đã xuất file Excel chuẩn!", "success");
  };

  const calendarEvents = useMemo(() => {
    // Ẩn các vụ Tạm ngừng khỏi bộ lịch để tránh rác lịch
    return schedule.filter(i => i.datetime && i.status !== 'postponed' && i.status !== 'suspended').map(i => ({ 
      ...i, title: `${i.status === 'completed' ? '✅ ' : ''}[${i.room}] ${i.caseName || 'Chưa có tên'}`, start: new Date(i.datetime), end: new Date(new Date(i.datetime).getTime() + (i.duration || 60) * 60000) 
    }));
  }, [schedule]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-2xl text-blue-900">ĐANG TẢI...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-cover bg-center font-sans" style={{ backgroundImage: "url('/toaan.jpg')" }}>
        <div className="absolute inset-0 bg-black/30"></div> 
        <div className="relative z-10 w-full max-w-[480px] p-8 md:p-10 text-center" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
          <img src="/lgtoaan1.png" alt="Logo" className="mx-auto mb-4 drop-shadow-2xl" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
          <p className="text-[16px] md:text-lg font-black uppercase mb-2 tracking-tight text-red-600 drop-shadow-md">TOÀ ÁN NHÂN DÂN THÀNH PHỐ CẦN THƠ</p>
          <h1 className="text-[20px] md:text-2xl font-black uppercase mb-8 tracking-tight text-red-600 drop-shadow-md">TAND KHU VỰC 9 - CẦN THƠ</h1>
          <form onSubmit={handleLogin} className="space-y-5 flex flex-col items-center">
            <input type="email" placeholder="Email..." value={loginEmail} onChange={setLoginEmail} className="w-[85%] px-5 py-3 outline-none text-lg font-bold placeholder-gray-200 text-center transition-all focus:border-white focus:bg-white/20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', border: '2px solid rgba(255, 255, 255, 0.4)', borderRadius: '6px' }} required />
            <input type="password" placeholder="Mật khẩu..." value={loginPass} onChange={setLoginPass} className="w-[85%] px-5 py-3 outline-none text-lg font-bold placeholder-gray-200 text-center transition-all focus:border-white focus:bg-white/20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', border: '2px solid rgba(255, 255, 255, 0.4)', borderRadius: '6px' }} required />
            <button type="submit" className="py-3 mt-4 font-black uppercase text-lg transition-all hover:bg-blue-700 active:scale-95" style={{ width: '60%', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.5)' }}>ĐĂNG NHẬP</button>
          </form>
        </div>
      </div>
    );
  }

  const canEdit = userRole === 'admin' || userRole === 'chanhan' || userRole === 'thuky';

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans antialiased tracking-tight relative">
      <div className="absolute inset-0 bg-black/30 z-0"></div>
      <datalist id="judges-list">{judgesList.map((name, i) => <option key={i} value={name} />)}</datalist>
      <datalist id="clerks-list">{clerksList.map((name, i) => <option key={i} value={name} />)}</datalist>
      <datalist id="prosecutors-list">{prosecutorsList.map((name, i) => <option key={i} value={name} />)}</datalist>

      <style dangerouslySetInnerHTML={{__html: `
        .rbc-event { background-color: rgba(59, 130, 246, 0.15) !important; backdrop-filter: blur(4px) !important; -webkit-backdrop-filter: blur(4px) !important; border: 1px solid rgba(59, 130, 246, 0.4) !important; border-radius: 6px !important; padding: 3px 6px !important; font-size: 11px !important; font-weight: 700 !important; color: #1e3a8a !important; box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important; transition: all 0.2s ease-in-out; }
        .rbc-event:hover { background-color: rgba(59, 130, 246, 0.25) !important; }
        .rbc-event.rbc-selected { background-color: #1e3a8a !important; color: #ffffff !important; box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #1e3a8a !important; z-index: 10 !important; }
      `}} />

      <aside 
        className="w-64 text-white hidden xl:flex flex-col fixed h-screen z-20 overflow-y-auto"
        style={{ 
          fontFamily: "'Be Vietnam Pro', sans-serif", /* ÁP DỤNG PHÔNG CHỮ MỚI */
          background: 'rgba(220, 38, 38, 0.75)',
          backdropFilter: 'blur(16px)', 
          WebkitBackdropFilter: 'blur(16px)', 
          borderRight: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '4px 0 32px 0 rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Nhúng link Font từ Google Fonts */}
        <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');`}} />

        <div className="py-10 px-6 text-center border-b border-white/20">
          <img src="/lgtoaan1.png" alt="Logo Tòa án" className="w-20 h-20 mx-auto mb-4 drop-shadow-xl" />
          {/* Đổi từ font-black sang font-extrabold và tăng khoảng cách chữ */}
          <h2 className="font-extrabold text-2xl uppercase tracking-widest drop-shadow-md">KV9 - Cần Thơ</h2>
        </div>
        
        <div className="p-6 flex-1">
          <div onClick={scrollToCalendar} className="cursor-pointer bg-blue-600/90 backdrop-blur-md px-4 py-4 shadow-xl border border-white/20 flex justify-between items-center rounded-lg hover:bg-blue-500 transition-colors">
            {/* Đổi sang font-bold cho gọn */}
            <span className="font-bold text-sm tracking-wide drop-shadow-md">📅 LỊCH XÉT XỬ</span> 
            {urgentCount > 0 && <span className="bg-red-500 text-white px-2 py-1 text-xs font-bold rounded-full animate-bounce shadow-md border border-white/30">{urgentCount}</span>}
          </div>
        </div>

        <div className="p-6 border-t border-white/20 mt-auto bg-black/10">
          <div className="mb-6 p-4 bg-white/10 border border-white/20 rounded-lg shadow-inner">
             <p className="text-[10px] text-amber-300 font-bold uppercase mb-1 tracking-widest drop-shadow-md">Quyền: {roleDisplayNames[userRole]}</p>
             <p className="text-sm font-semibold truncate opacity-90 drop-shadow-md tracking-wide">{user?.email}</p>
          </div>
          <div className="space-y-3">
             <button onClick={() => setShowPwdModal(true)} className="w-full bg-blue-600/80 hover:bg-blue-600 py-3 font-bold uppercase text-xs tracking-wider transition-all shadow-lg border border-white/20 rounded backdrop-blur-sm">🔑 ĐỔI MẬT KHẨU</button>
             <button onClick={handleLogout} className="w-full bg-black/20 hover:bg-black/40 py-3 font-bold uppercase text-xs tracking-wider transition-all rounded border border-white/20 shadow-lg backdrop-blur-sm">🚪 ĐĂNG XUẤT</button>
          </div>
        </div>
      </aside>

      <main className="xl:ml-64 flex flex-col min-h-screen relative z-10 w-full xl:w-[calc(100%-16rem)] min-w-0">
        <header className="bg-white/95 backdrop-blur-md h-24 shadow-sm flex items-center justify-between px-4 md:px-8 xl:px-12 sticky top-0 z-30 border-b border-gray-200 w-full">
          <div className="flex-1 flex justify-start items-center gap-2 xl:hidden">
             <button onClick={() => setShowPwdModal(true)} className="bg-blue-50 text-blue-700 px-3 py-2 text-[10px] font-black uppercase shadow-sm border border-blue-100">🔑 MK</button>
             <button onClick={handleLogout} className="bg-red-50 text-red-600 border border-red-100 px-3 py-2 text-[10px] font-black uppercase shadow-sm">🚪 Thoát</button>
          </div>
          <div className="flex-[2] text-center px-2">
            <h1 className="font-black text-[14px] sm:text-[16px] md:text-xl xl:text-2xl uppercase text-blue-950 truncate">HỆ THỐNG QUẢN LÝ LỊCH TRỰC TUYẾN</h1>
          </div>
          <div className="flex-1 flex items-center justify-end">
             <div className="bg-blue-50 text-blue-700 px-3 py-2 md:px-6 md:py-3 font-black text-[10px] md:text-sm border border-blue-100 uppercase tracking-widest text-center w-max">
               Cần Thơ: {moment().format("DD/MM/YYYY")}
             </div>
          </div>
        </header>

        <div className="p-4 md:p-12 flex-1">
          {/* BẢNG ĐIỀU KHIỂN 5 Ô - THÊM Ô TẠM NGỪNG */}
          <div className="bg-white shadow-xl rounded-xl mb-8 border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-gray-200">
              <div onClick={() => handleStatCardClick('all')} className="cursor-pointer p-6 md:p-8 flex flex-col items-center justify-center text-center hover:bg-blue-50 transition-colors">
                <p className="text-gray-500 text-[10px] font-black uppercase mb-2">Tổng vụ</p><p className="text-3xl font-black text-blue-950">{schedule.length}</p>
              </div>
              <div onClick={() => handleStatCardClick('pending')} className="cursor-pointer p-6 md:p-8 flex flex-col items-center justify-center text-center hover:bg-amber-50 transition-colors">
                <p className="text-gray-500 text-[10px] font-black uppercase mb-2">Chờ xử</p><p className="text-3xl font-black text-amber-600">{pendingCases.length}</p>
              </div>
              <div onClick={() => handleStatCardClick('urgent')} className="cursor-pointer p-6 md:p-8 flex flex-col items-center justify-center text-center hover:bg-red-100 bg-red-50 transition-colors relative">
                <p className="text-red-600 text-[10px] font-black uppercase mb-2">Sắp xử</p><p className={`text-3xl font-black text-red-600 ${urgentCount > 0 ? 'animate-pulse' : ''}`}>{urgentCount}</p>
              </div>
              <div onClick={() => handleStatCardClick('suspended')} className="cursor-pointer p-6 md:p-8 flex flex-col items-center justify-center text-center hover:bg-purple-50 transition-colors">
                <p className="text-gray-500 text-[10px] font-black uppercase mb-2">Tạm ngừng</p><p className="text-3xl font-black text-purple-600">{schedule.filter(i => i.status === 'suspended').length}</p>
              </div>
              <div onClick={() => handleStatCardClick('completed')} className="cursor-pointer p-6 md:p-8 flex flex-col items-center justify-center text-center hover:bg-green-50 transition-colors">
                <p className="text-gray-500 text-[10px] font-black uppercase mb-2">Đã xong</p><p className="text-3xl font-black text-green-600">{schedule.filter(i => i.status === 'completed').length}</p>
              </div>
            </div>
          </div>

        {schedule.length > 0 && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
               <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-200">
                  <h3 className="text-center font-black text-[13px] text-gray-500 uppercase tracking-widest mb-4">Tỷ lệ theo Loại án</h3>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={caseTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({name, value}) => `${name} (${value})`}>
                          {caseTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        {/* Đã xóa thẻ <Legend /> ở đây để không bị vướng */}
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-200">
                  <h3 className="text-center font-black text-[13px] text-gray-500 uppercase tracking-widest mb-4">Tỷ lệ án Đang chờ xử theo Thẩm phán</h3>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={judgeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({name, value}) => `${name} (${value})`}>
                          {judgeData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        {/* Đã xóa thẻ <Legend /> ở đây để không bị vướng */}
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
               </div>
             </div>
          )}

          {canEdit && (
            <div className="bg-white p-6 md:p-10 border shadow-xl rounded-xl mb-12">
              <h2 className="font-black text-xl text-blue-950 uppercase mb-10 flex items-center justify-center gap-4"><span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>{editingId ? "Cập nhật hồ sơ" : "Đăng ký lịch xét xử"}<span className="w-1.5 h-8 bg-blue-600 rounded-full"></span></h2>
              <div className="max-w-5xl mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className={labelStyle}>Thời gian xét xử <span className="text-red-500">*</span></label>
                    <div className="flex gap-4 w-full">
                      <input type="date" value={form.datetime ? form.datetime.split('T')[0] : ""} onChange={e => { const time = form.datetime && form.datetime.includes('T') ? form.datetime.split('T')[1] : '07:30'; setForm({...form, datetime: `${e.target.value}T${time}`}); }} className="w-[65%] border border-gray-300 rounded-md px-4 py-3 bg-white outline-none focus:border-blue-500 text-[15px] font-medium" />
                      <select value={form.datetime && form.datetime.includes('T') ? form.datetime.split('T')[1] : "07:30"} onChange={e => { const date = form.datetime ? form.datetime.split('T')[0] : moment().format('YYYY-MM-DD'); setForm({...form, datetime: `${date}T${e.target.value}`}); }} className="w-[35%] border border-gray-300 rounded-md px-4 py-3 bg-white outline-none focus:border-blue-500 text-[15px] font-medium">
                        <option value="07:30">07:30</option><option value="08:00">08:00</option><option value="08:30">08:30</option><option value="09:00">09:00</option><option value="09:30">09:30</option><option value="10:00">10:00</option><option value="10:30">10:30</option><option value="11:00">11:00</option><option value="13:30">13:30</option><option value="14:00">14:00</option><option value="14:30">14:30</option><option value="15:00">15:00</option><option value="15:30">15:30</option><option value="16:00">16:00</option><option value="16:30">16:30</option><option value="17:00">17:00</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelStyle}>Phòng xử / Địa điểm <span className="text-red-500">*</span></label>
                    <select value={form.room} onChange={e => setForm({...form, room: e.target.value})} className={inputBase}><option value="Trụ sở">🏢 TRỤ SỞ</option><option value="Chi nhánh">🏢 CHI NHÁNH</option><option value="Trực tuyến">💻 TRỰC TUYẾN</option><option value="Lưu động">🚚 LƯU ĐỘNG</option><option value="Dự phòng">⚠️ DỰ PHÒNG</option></select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <label className={labelStyle}>Loại án <span className="text-red-500">*</span></label>
                    <select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value, duration: e.target.value === 'Hình sự' ? 120 : 30})} className={inputBase}><option value="Hình sự">Hình sự</option><option value="Dân sự">Dân sự</option><option value="Hành chính">Hành chính</option><option value="Hôn nhân & GĐ">Hôn nhân & GĐ</option><option value="Kinh tế">Kinh tế</option></select>
                  </div>
                  <div>
                    <label className={labelStyle}>Thời lượng <span className="text-red-500">*</span></label>
                    <select value={form.duration} onChange={e => setForm({...form, duration: parseInt(e.target.value)})} className={inputBase}>
                      <option value={30}>⏱ 30 phút (Xử nhanh)</option>
                      <option value={60}>⏱ 1 giờ (Bổ sung)</option>
                      <option value={120}>⏱ 2 giờ (Án hình sự)</option>
                      <option value={240}>⏱ 1 buổi (4 giờ)</option>
                      <option value={480}>⏱ 1 ngày (8 giờ)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelStyle}>Lần xử <span className="text-red-500">*</span></label>
                    <select value={form.trialCount} onChange={e => setForm({...form, trialCount: e.target.value})} className={inputBase}><option value="Lần 1">Lần 1</option><option value="Lần 2">Lần 2</option><option value="Mở lại">Mở lại</option></select>
                  </div>
                </div>

                <div><label className={labelStyle}>Trích yếu vụ án <span className="text-red-500">*</span></label><textarea value={form.caseName} onChange={e => setForm({...form, caseName: e.target.value})} className={inputBase} rows="2" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div><label className={labelStyle}>Nguyên đơn</label><input value={form.plaintiff} onChange={e => setForm({...form, plaintiff: e.target.value})} className={inputBase} /></div>
                  <div><label className={labelStyle}>Bị đơn</label><input value={form.defendant} onChange={e => setForm({...form, defendant: e.target.value})} className={inputBase} /></div>
                </div>
                <div className="pt-6">
                   <h3 className="text-[14px] font-black text-teal-800 bg-teal-50 border border-teal-200 py-3 rounded-md mb-6 text-center uppercase shadow-sm">Thành phần Hội đồng xét xử</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      <div><label className={labelStyle}>Thẩm phán</label><input list="judges-list" value={form.judge} onChange={e => setForm({...form, judge: e.target.value})} className={inputBase} /></div>
                      <div><label className={labelStyle}>Thư ký</label><input list="clerks-list" value={form.clerk} onChange={e => setForm({...form, clerk: e.target.value})} className={inputBase} /></div>
                      <div><label className={labelStyle}>Kiểm sát viên</label><input list="prosecutors-list" value={form.prosecutor} onChange={e => setForm({...form, prosecutor: e.target.value})} className={inputBase} /></div>
                      <div><label className={labelStyle}>Hội thẩm 1</label><input value={form.juror1} onChange={e => setForm({...form, juror1: e.target.value})} className={inputBase} /></div>
                      <div><label className={labelStyle}>Hội thẩm 2</label><input value={form.juror2} onChange={e => setForm({...form, juror2: e.target.value})} className={inputBase} /></div>
                   </div>
                </div>
                <div className="pt-10 pb-4 mt-6 border-t-2 border-dashed border-gray-300">
                   <button onClick={handleSubmit} className={`w-full block text-white font-bold py-4 rounded-md uppercase text-lg shadow-lg active:scale-95 bg-blue-600 hover:bg-blue-700`}>{editingId ? "Cập nhật thông tin" : "Lưu vào hệ thống"}</button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-12" ref={calendarSectionRef}>
            <div className="bg-white p-4 md:p-8 border shadow-xl rounded-xl h-[700px] w-full overflow-x-auto">
              {isMounted && localizer ? (
                <DnDCalendar localizer={localizer} events={calendarEvents} style={{ height: "100%", minWidth: "800px" }} onSelectEvent={e => setSelectedEvent(e)} onEventDrop={onEventDrop} resizable={false} />
              ) : <div className="font-bold text-gray-400 text-center mt-20">Đang tải bộ lịch...</div>}
            </div>

            <div className="bg-white border border-gray-200 shadow-xl rounded-xl flex flex-col h-auto min-h-[850px] w-full" ref={tableSectionRef}>
              <div className="p-6 md:p-8 border-b border-gray-200 flex flex-col gap-6 bg-white z-10 rounded-t-xl">
                <div className="flex justify-between items-center w-full">
                   <h3 className="font-black uppercase text-xl md:text-2xl text-blue-950 flex items-center gap-4"><span className="w-1.5 h-8 bg-blue-950 rounded-full"></span>Sổ thụ lý</h3>
                   <div className="flex bg-gray-100 p-1.5 rounded-lg border border-gray-200 shadow-inner">
                     <button onClick={() => setViewMode('table')} className={`px-4 py-2 text-xs font-black uppercase rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500 hover:text-gray-800'}`}>Danh sách</button>
                     <button onClick={() => setViewMode('kanban')} className={`px-4 py-2 text-xs font-black uppercase rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500 hover:text-gray-800'}`}>Bảng Kéo Thả</button>
                   </div>
                </div>
                
                <div className="flex flex-col xl:flex-row flex-wrap gap-4 w-full items-center">
                  <div className="flex items-center gap-2 border border-gray-300 rounded-md px-4 py-2.5 bg-white w-full md:w-auto">
                    <span className="text-xs font-bold text-gray-500">Từ:</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none text-sm bg-transparent" />
                    <span className="text-xs font-bold text-gray-500">Đến:</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none text-sm bg-transparent" />
                    {(startDate || endDate) && <button onClick={() => {setStartDate(""); setEndDate("")}} className="text-red-500 font-bold px-1.5">✕</button>}
                  </div>
                  <select value={judgeFilter} onChange={e => setJudgeFilter(e.target.value)} className={filterStyle}><option value="all">👨‍⚖️ Thẩm phán (Tất cả)</option>{judgesList.map(name => <option key={name} value={name}>{name}</option>)}</select>
                  <select value={clerkFilter} onChange={e => setClerkFilter(e.target.value)} className={filterStyle}><option value="all">📝 Thư ký (Tất cả)</option>{clerksList.map(name => <option key={name} value={name}>{name}</option>)}</select>
                  <select value={statusFilter} onChange={e => {setStatusFilter(e.target.value); setShowOnlyUrgent(false);}} className={filterStyle}>
                     <option value="all">📁 Tất cả Trạng thái</option>
                     <option value="pending">⏳ Đang chờ xử</option>
                     <option value="suspended">⏸ Tạm ngừng</option>
                     <option value="postponed">⚠️ Đã hoãn</option>
                     <option value="completed">✅ Đã xử xong</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm font-bold text-red-600 bg-red-50 px-4 py-2.5 rounded-md border border-red-200 cursor-pointer">
                    <input type="checkbox" checked={showOnlyUrgent} onChange={e => setShowOnlyUrgent(e.target.checked)} className="w-4 h-4 accent-red-600" /> Sắp xử (24h)
                  </label>
                  <input type="text" placeholder="Tìm kiếm tự do..." onChange={e => setSearchQuery(e.target.value)} className={`${filterStyle} flex-1 min-w-[150px]`} />
                  <button onClick={exportToExcel} className="bg-green-600 text-white px-6 py-2.5 font-bold uppercase rounded-md shadow-sm hover:bg-green-700 text-[14px]">📊 Xuất Excel</button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-gray-50/50 rounded-b-xl">
                {viewMode === 'table' ? (
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="bg-gray-100 text-[12px] font-black uppercase text-gray-500 sticky top-0 z-10 border-b border-gray-200">
                      <tr><th className="p-6 w-[15%] text-center">Lịch</th><th className="p-6 w-[40%]">Nội dung</th><th className="p-6 w-[30%]">Thành phần & Người nhập</th>{canEdit && <th className="p-6 w-[15%] text-center">Tác vụ</th>}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {processedSchedule.map((item, index) => {
                        const isRowUrgent = item.status === 'pending' && isUrgent(item.datetime);
                        let rowBgClass = item.status === 'completed' || item.status === 'postponed' || item.status === 'suspended' ? "opacity-70 bg-gray-100/50" : isRowUrgent ? "bg-red-50 hover:bg-red-100" : index % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-slate-50 hover:bg-blue-50/30";
                        return (
                          <tr key={item.id} className={`transition-all ${rowBgClass}`}>
                            <td className={`p-6 align-top text-center ${isRowUrgent ? 'border-l-4 border-l-red-500' : ''}`}>
                              {item.status === 'postponed' ? <div className="text-amber-600 font-bold animate-pulse">⚠️ ĐÃ HOÃN</div> : 
                               item.status === 'suspended' ? <div className="text-purple-600 font-bold uppercase">⏸ Tạm ngừng<br/><span className="text-[10px] text-gray-500 italic">(Chờ báo sau)</span></div> :
                               <>
                                <div className="font-bold text-gray-900">{item.datetime ? moment(item.datetime).format("DD/MM/YYYY") : "---"}</div>
                                <div className="text-blue-600 font-bold">🕒 {item.datetime ? moment(item.datetime).format("HH:mm") : "---"}</div>
                              </>}
                              <div className="font-bold text-gray-500 uppercase text-sm mt-4">{item.room || "---"}</div>
                            </td>
                            <td className="p-6 align-top">
                              <div className="font-bold uppercase text-gray-900 text-base mb-2">
                                {item.status === 'completed' && <span className="text-green-600 mr-2">✅</span>}
                                {item.status === 'suspended' && <span className="text-purple-600 mr-2">⏸</span>}
                                {isRowUrgent && <span className="bg-red-500 text-white px-2 py-1 text-xs rounded mr-2 animate-pulse">⚠️ SẮP XỬ</span>}
                                {item.caseName || "Vụ án chưa có tên"}
                              </div>
                              <div className="text-gray-700 font-semibold text-sm mb-2">{item.caseType || "---"} / {item.trialCount || "Lần 1"}</div>
                              <div className="text-sm text-gray-600"><p>NĐ: {item.plaintiff || "N/A"}</p><p>BĐ: {item.defendant || "N/A"}</p></div>
                            </td>
                            <td className="p-6 align-top text-sm text-gray-800 space-y-2">
                              <div><span className="font-semibold text-blue-700 inline-block w-8">TP:</span> <span className="font-bold">{item.judge || "---"}</span></div>
                              <div><span className="font-semibold text-gray-500 inline-block w-8">HT:</span> {item.juror1 || "---"}, {item.juror2 || "---"}</div>
                              <div><span className="font-semibold text-gray-500 inline-block w-8">TK:</span> {item.clerk || "---"}</div>
                              <div><span className="font-semibold text-red-600 inline-block w-8">KSV:</span> <span className="font-bold text-red-600">{item.prosecutor || "---"}</span></div>
                              
                              <div className="border-t border-gray-200 border-dashed pt-2 mt-3 text-xs text-gray-500 italic">
                                Nhập bởi: <span className="font-bold text-gray-700">{item.createdBy ? item.createdBy.split('@')[0] : "---"}</span>
                              </div>
                            </td>
                            {canEdit && (
                              <td className="p-4 align-top">
                                <div className="flex flex-col gap-2 w-full max-w-[150px] mx-auto">
                                  {(item.status === 'pending' || !item.status) && (
                                    <div className="grid grid-cols-2 gap-2">
                                      <button onClick={() => toggleStatus(item.id, 'completed', item.caseName)} className="bg-green-50 text-green-700 py-2 font-black uppercase text-[9px] border border-green-200 rounded">✔ XONG</button>
                                      <button onClick={() => toggleStatus(item.id, 'suspended', item.caseName)} className="bg-purple-50 text-purple-700 py-2 font-black uppercase text-[9px] border border-purple-200 rounded">⏸ NGỪNG</button>
                                    </div>
                                  )}
                                  {(item.status === 'postponed' || item.status === 'suspended') && <button onClick={() => handleReschedule(item)} className="bg-blue-600 text-white py-2 font-black uppercase text-[10px] rounded">📅 LÊN LỊCH LẠI</button>}
                                  {item.status === 'completed' && <button onClick={() => toggleStatus(item.id, 'pending', item.caseName)} className="bg-gray-200 text-gray-700 py-2 font-black uppercase text-[10px] rounded">↺ MỞ LẠI</button>}
                                  <button onClick={() => handleSendEmail(item)} className="bg-purple-50 text-purple-700 py-2 font-black uppercase text-[10px] border border-purple-200 rounded">📋 COPY LỊCH</button>
                                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200 border-dashed">
                                     <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="bg-blue-50 text-blue-700 py-2 font-black uppercase text-[10px] border border-blue-200 rounded">✏️ SỬA</button>
                                     <button onClick={() => handleDelete(item.id, item.caseName)} className="bg-red-50 text-red-700 py-2 font-black uppercase text-[10px] border border-red-200 rounded">🗑️ XÓA</button>
                                  </div>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex gap-6 p-6 h-full overflow-x-auto min-h-[700px] items-start">
                    {[
                      { id: 'pending', title: '⏳ ĐANG CHỜ XỬ', color: 'bg-blue-100 text-blue-900 border-blue-200' },
                      { id: 'suspended', title: '⏸ TẠM NGỪNG', color: 'bg-purple-100 text-purple-900 border-purple-200' },
                      { id: 'completed', title: '✅ ĐÃ XỬ XONG', color: 'bg-green-100 text-green-900 border-green-200' }
                    ].map(col => (
                      <div key={col.id} className="flex-1 min-w-[340px] max-w-[400px] bg-gray-100/80 rounded-xl border border-gray-200 shadow-inner flex flex-col max-h-[800px]" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.id)}>
                        <div className={`p-4 font-black text-center border-b rounded-t-xl shadow-sm sticky top-0 z-10 ${col.color}`}>
                          {col.title} <span className="bg-white/50 px-2 py-0.5 rounded-full ml-1">{processedSchedule.filter(i => i.status === col.id).length}</span>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                           {processedSchedule.filter(i => i.status === col.id).map(item => {
                             const urgent = item.status === 'pending' && isUrgent(item.datetime);
                             return (
                               <div key={item.id} draggable={canEdit} onDragStart={(e) => handleDragStart(e, item)} className={`bg-white p-5 rounded-xl border-l-4 shadow-sm transition-all relative group ${canEdit ? 'cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-1' : ''} ${urgent ? 'border-l-red-500' : col.id === 'suspended' ? 'border-l-purple-500' : 'border-l-blue-500'} border-y border-r border-gray-200`}>
                                 <h4 className="font-black text-blue-950 mb-4 leading-tight">{item.caseName || "Chưa có tên"}</h4>
                                 <div className="space-y-2 text-xs font-bold text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100">
                                   <div className="flex items-center gap-2"><span className="text-lg">🕒</span> {item.status === 'suspended' ? <span className="text-purple-600 italic">Chờ báo sau</span> : moment(item.datetime).format("HH:mm | DD/MM/YY")}</div>
                                   <div className="flex items-center gap-2"><span className="text-lg">👨‍⚖️</span> TP: {item.judge || "---"}</div>
                                   <div className="flex items-center gap-2"><span className="text-lg">🛡️</span> KSV: <span className="text-red-600">{item.prosecutor || "---"}</span></div>
                                 </div>
                               </div>
                             )
                           })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL XEM CHI TIẾT */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setSelectedEvent(null)}>
           <div className="w-full max-w-lg flex flex-col overflow-hidden bg-white rounded-[28px] shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-8 bg-red-600 text-white">
                <p className="text-xs font-black uppercase opacity-80 mb-2 tracking-widest">{selectedEvent.caseType} - {selectedEvent.trialCount}</p>
                <h3 className="text-2xl font-black uppercase leading-tight">{selectedEvent.caseName}</h3>
              </div>
              <div className="p-8 space-y-5 text-gray-900 font-bold">
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">🕒</div><p className="text-lg font-black text-blue-950">{moment(selectedEvent.datetime).format("HH:mm - DD/MM/YYYY")}</p></div>
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">👨‍⚖️</div><p className="text-lg">Thẩm phán: {selectedEvent.judge}</p></div>
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">🛡️</div><p className="text-lg text-red-700">KSV: {selectedEvent.prosecutor}</p></div>
                <button onClick={() => setSelectedEvent(null)} className="w-full bg-blue-900 text-white py-4 font-black uppercase rounded-xl mt-4">ĐÓNG</button>
              </div>
           </div>
        </div>
      )}

      {showPwdModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowPwdModal(false)}>
           <div className="w-full max-w-md bg-white rounded-[28px] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-8 bg-blue-900 text-white text-center font-black uppercase tracking-widest">🔑 ĐỔI MẬT KHẨU</div>
              <form onSubmit={handleChangePassword} className="p-8 space-y-6">
                <div><label className="block text-xs font-black text-gray-600 uppercase mb-2">Mật khẩu mới</label><input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required className="w-full border-2 border-gray-100 p-4 bg-gray-50 outline-none focus:border-blue-500 font-bold text-gray-900 rounded-xl" minLength={6} /></div>
                <div><label className="block text-xs font-black text-gray-600 uppercase mb-2">Xác nhận mật khẩu</label><input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required className="w-full border-2 border-gray-100 p-4 bg-gray-50 outline-none focus:border-blue-500 font-bold text-gray-900 rounded-xl" minLength={6} /></div>
                <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowPwdModal(false)} className="w-1/2 bg-gray-200 text-gray-700 font-black py-4 uppercase rounded-xl">HỦY</button><button type="submit" className="w-1/2 bg-blue-600 text-white font-black py-4 uppercase rounded-xl">LƯU</button></div>
              </form>
           </div>
        </div>
      )}

      {toast.show && (<div className={`fixed bottom-6 right-6 z-[200] px-8 py-4 shadow-2xl font-black text-white rounded-xl ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-700'}`}>{toast.message}</div>)}
    </div>
  );
}