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
  
  // Login & Search States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [editingId, setEditingId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Modal States
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  // Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [judgeFilter, setJudgeFilter] = useState("all");
  const [clerkFilter, setClerkFilter] = useState("all");

  const calendarSectionRef = useRef(null);

  const initialForm = {
    datetime: "", room: "Trụ sở", caseType: "Hình sự", duration: 120, trialCount: "Lần 1", caseName: "", 
    plaintiff: "", defendant: "", judge: "", clerk: "", juror1: "", juror2: "", 
    prosecutor: "", status: "pending"
  };
  const [form, setForm] = useState(initialForm);

  // Styles
  const inputBase = "w-full border border-gray-300 rounded-md px-4 py-3 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-[15px] font-medium text-gray-800";
  const labelStyle = "block text-center text-[13px] font-black text-teal-900 bg-teal-100 border border-teal-200 py-2.5 px-4 rounded-md mb-2 w-full uppercase tracking-widest shadow-sm"; 
  const filterStyle = "border border-gray-300 rounded-md px-4 py-2.5 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-[14px] font-medium text-gray-800 w-full md:w-auto cursor-pointer";

  const roleDisplayNames = {
    chanhan: "CHÁNH ÁN", admin: "QUẢN TRỊ VIÊN", thuky: "THƯ KÝ", thamphan: "THẨM PHÁN", viewer: "CHỈ XEM"
  };

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
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // NÂNG CẤP 2: Tối ưu hiệu suất, chỉ lấy dữ liệu từ 3 tháng trước đến nay
  const loadData = async () => {
    try {
      const threeMonthsAgo = moment().subtract(3, 'months').toISOString();
      const q = query(collection(db, "schedule"), where("datetime", ">=", threeMonthsAgo), orderBy("datetime", "desc"));
      const querySnapshot = await getDocs(q);
      setSchedule(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { showToast("Lỗi tải dữ liệu", "error"); }
  };

  const logAction = async (action, details) => {
    try { await addDoc(collection(db, "audit_logs"), { action, details, user: user.email, timestamp: moment().toISOString() }); } 
    catch(err) { console.error("Lỗi ghi log", err); }
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
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') showToast("Vui lòng đăng xuất và đăng nhập lại để thực hiện đổi mật khẩu!", "error");
      else showToast("Lỗi: " + error.message, "error");
    }
  };

  // NÂNG CẤP 3: Double Check Server chống Race Condition (Xung đột)
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
        if (startNew.isBefore(endEx) && startEx.isBefore(endNew)) {
          hasConflict = true;
        }
      });
      return hasConflict;
    } catch (error) {
      return true; // Nếu lỗi mạng, block luôn cho an toàn
    }
  };

  const handleSubmit = async () => {
    if (userRole === 'thamphan' || userRole === 'viewer') return showToast("Không có quyền!", "error");
    if (!form.datetime || !form.caseName || !form.room) return showToast("Vui lòng nhập đủ thông tin!", "error");
    
    // Kiểm tra chéo Server trước khi ghi
    const isConflict = await isConflictServerSide(form.datetime, form.room, editingId, form.duration);
    if(isConflict) return showToast("⚠️ Xin lỗi, phòng này vừa được người khác đặt trước vài giây. Vui lòng chọn giờ khác!", "error");

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
      showToast(newStatus === 'completed' ? "✅ Đã đánh dấu xử xong!" : "⏳ Đã mở lại vụ án!", "success");
      loadData();
    } catch (err) { showToast("Lỗi cập nhật trạng thái", "error"); }
  };

  const handleDelete = async (id, caseName) => {
    if(confirm("Xóa hồ sơ này?")) {
      await deleteDoc(doc(db,"schedule", id));
      await logAction("XÓA HỒ SƠ", `Vụ án: ${caseName}`);
      loadData();
    }
  };

  const onEventDrop = async ({ event, start, end }) => {
    if (userRole === 'thamphan' || userRole === 'viewer') return showToast("Không có quyền dời lịch!", "error");
    const newDatetime = moment(start).format('YYYY-MM-DDTHH:mm');
    
    const isConflict = await isConflictServerSide(newDatetime, event.room, event.id, event.duration || 60);
    if (isConflict) return showToast(`⚠️ Trùng lịch phòng ${event.room} trong khoảng thời gian này!`, "error");

    try {
      await updateDoc(doc(db, "schedule", event.id), { datetime: newDatetime, updatedBy: user.email, updatedAt: moment().toISOString() });
      await logAction("KÉO THẢ DỜI LỊCH", `Vụ án "${event.caseName}" sang lúc ${moment(newDatetime).format("HH:mm DD/MM/YYYY")}`);
      showToast("🔄 Đã dời lịch thành công!", "success");
      loadData();
    } catch (err) { showToast("Lỗi khi dời lịch", "error"); }
  };

  const handleReschedule = (item) => {
    let nextTrialCount = "Lần 2";
    if (item.trialCount === "Lần 1") nextTrialCount = "Lần 2";
    else if (item.trialCount === "Lần 2") nextTrialCount = "Mở lại";
    else nextTrialCount = "Mở lại";
    setForm({ ...item, datetime: "", trialCount: nextTrialCount, status: "pending" });
    setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'});
    showToast("Đã lấy dữ liệu, vui lòng chọn ngày giờ mới!", "success");
  };

  // NÂNG CẤP 4: Gửi Email (Chỉ sử dụng Mailto Protocol, không cần API ngoài)
  const handleSendEmail = (item) => {
    const body = `Kính gửi Hội đồng xét xử,\n\n`+
      `Hệ thống xin thông báo lịch xét xử chi tiết như sau:\n`+
      `- Vụ án: ${item.caseName}\n`+
      `- Loại án: ${item.caseType} (${item.trialCount})\n`+
      `- Thời gian: ${moment(item.datetime).format("HH:mm - DD/MM/YYYY")}\n`+
      `- Địa điểm: Phòng xử ${item.room}\n\n`+
      `Thành phần HĐXX:\n`+
      `- Thẩm phán: ${item.judge || "..."}\n`+
      `- Thư ký: ${item.clerk || "..."}\n`+
      `- Kiểm sát viên: ${item.prosecutor || "..."}\n`+
      `- Hội thẩm: ${item.juror1 || "..."} & ${item.juror2 || "..."}\n\n`+
      `Trân trọng thông báo!`;
      
    navigator.clipboard.writeText(body).then(() => {
      showToast("📋 Đã copy nội dung! Bạn có thể dán (Ctrl+V) vào Zalo/Email.", "success");
    }).catch(err => {
      showToast("Lỗi khi copy!", "error");
    });
  };

  const scrollToCalendar = () => {
    if(calendarSectionRef.current) calendarSectionRef.current.scrollIntoView({ behavior: 'smooth' });
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
      return matchSearch && matchStatus && matchDate && matchCreator && matchJudge && matchClerk;
    }).sort((a, b) => {
      const dateA = a.datetime ? new Date(a.datetime).getTime() : 0;
      const dateB = b.datetime ? new Date(b.datetime).getTime() : 0;
      if (a.status === 'pending' && b.status === 'pending') return dateA - dateB;
      if (a.status !== 'pending' && b.status !== 'pending') return dateB - dateA;
      return a.status === 'pending' ? -1 : 1;
    });
  }, [schedule, searchQuery, statusFilter, creatorFilter, judgeFilter, clerkFilter, startDate, endDate]);

  const exportToExcel = () => {
    if (schedule.length === 0) return showToast("Không có dữ liệu để xuất!", "error");
    const dataToExport = processedSchedule; 
    if (dataToExport.length === 0) return showToast("Không có dữ liệu trong bộ lọc này!", "error");
    let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8" /><style>table { border-collapse: collapse; width: 100%; font-family: 'Times New Roman', Times, serif; font-size: 13pt; } td, th { border: 1px solid #000000; padding: 8px; vertical-align: top; } .no-border { border: none !important; } .text-center { text-align: center; vertical-align: middle; } .font-bold { font-weight: bold; }</style></head><body><table><tr><td colspan="2" class="no-border text-center font-bold">TÒA ÁN NHÂN DÂN<br/>KHU VỰC 9 - CẦN THƠ</td><td colspan="5" class="no-border text-center font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập - Tự do - Hạnh Phúc</td></tr><tr><td colspan="7" class="no-border text-center"><i>Cần Thơ, ngày ${moment().format("DD")} tháng ${moment().format("MM")} năm ${moment().format("YYYY")}</i></td></tr><tr><td colspan="7" class="no-border"></td></tr><tr><td colspan="7" class="no-border text-center font-bold" style="font-size: 16pt;">LỊCH XÉT XỬ ${statusFilter === 'completed' ? '(ĐÃ XỬ XONG)' : ''} ${startDate || endDate ? `<br/><span style="font-size: 12pt; font-weight: normal;">(Từ ngày ${startDate ? moment(startDate).format("DD/MM/YYYY") : "..."} đến ngày ${endDate ? moment(endDate).format("DD/MM/YYYY") : "..."})</span>` : ''}</td></tr><tr><td colspan="7" class="no-border"></td></tr><tr><th class="text-center font-bold" style="background-color: #f2f2f2;">STT</th><th class="text-center font-bold" style="background-color: #f2f2f2;">NỘI DUNG VỤ ÁN</th><th class="text-center font-bold" style="background-color: #f2f2f2;">NGÀY XÉT XỬ</th><th class="text-center font-bold" style="background-color: #f2f2f2;">CHỦ TỌA, THƯ KÝ</th><th class="text-center font-bold" style="background-color: #f2f2f2;">HỘI THẨM NHÂN DÂN</th><th class="text-center font-bold" style="background-color: #f2f2f2;">PHÒNG XÉT XỬ</th><th class="text-center font-bold" style="background-color: #f2f2f2;">NGƯỜI NHẬP</th></tr>`;
    dataToExport.forEach((item, index) => {
      const noidung = `<b>${item.caseName || ""}</b><br/>NĐ: ${item.plaintiff || ""}<br/>BĐ: ${item.defendant || ""}`;
      const thoigian = `${moment(item.datetime).format("HH")} giờ ${moment(item.datetime).format("mm")} phút<br/>Ngày ${moment(item.datetime).format("DD/MM/YYYY")}`;
      tableHtml += `<tr><td class="text-center">${index + 1}</td><td>${noidung}</td><td class="text-center">${thoigian}</td><td>${item.judge || ""}<br/>${item.clerk || ""}</td><td>${item.juror1 || ""}<br/>${item.juror2 || ""}</td><td class="text-center font-bold">${item.room || ""}</td><td class="text-center">${item.createdBy ? item.createdBy.split('@')[0] : ""}</td></tr>`;
    });
    tableHtml += `</table></body></html>`;
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `Lich_Xet_Xu_${startDate ? moment(startDate).format("DDMMYY") : "All"}_${endDate ? moment(endDate).format("DDMMYY") : "All"}.xls`;
    link.click(); showToast("Đã xuất file Excel chuẩn!", "success");
  };

  const isRoomConflict = useMemo(() => {
    if (!form.datetime || !form.room) return false;
    const startNew = moment(form.datetime);
    const endNew = moment(startNew).add(form.duration || 60, 'minutes');

    return schedule.some(i => {
      if (!i.datetime || i.room !== form.room || i.id === editingId || i.status !== 'pending') return false;
      const startEx = moment(i.datetime);
      const endEx = moment(startEx).add(i.duration || 60, 'minutes');
      return startNew.isBefore(endEx) && startEx.isBefore(endNew);
    });
  }, [form.datetime, form.room, form.duration, schedule, editingId]);

  const isUrgent = (datetime) => {
    if(!datetime) return false;
    const diffDays = moment(datetime).startOf('day').diff(moment().startOf('day'), 'days');
    return diffDays === 0 || diffDays === 1; 
  };
  
  const urgentCount = schedule.filter(i => i.status === 'pending' && isUrgent(i.datetime)).length;
  const pendingCases = schedule.filter(i => i.status === 'pending');
  const caseTypeStats = {}; schedule.forEach(i => { if(i.caseType) caseTypeStats[i.caseType] = (caseTypeStats[i.caseType] || 0) + 1 });
  const caseTypeData = Object.keys(caseTypeStats).map(key => ({ name: key, value: caseTypeStats[key] }));
  const judgeStats = {}; pendingCases.forEach(i => { if(i.judge) judgeStats[i.judge] = (judgeStats[i.judge] || 0) + 1 });
  const judgeData = Object.keys(judgeStats).map(key => ({ name: key, value: judgeStats[key] })).sort((a,b) => b.value - a.value); 
  const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#84cc16', '#14b8a6', '#d946ef', '#0ea5e9', '#f43f5e', '#eab308', '#64748b'];

  const calendarEvents = useMemo(() => {
    return schedule
      .filter(i => i.datetime && i.status !== 'postponed')
      .map(i => {
        const start = new Date(i.datetime);
        return { 
          ...i, 
          title: `${i.status === 'completed' ? '✅ ' : ''}[${i.room}] ${i.caseName || 'Chưa có tên'}`, 
          start: start, 
          end: new Date(start.getTime() + (i.duration || 60) * 60000) 
        };
      });
  }, [schedule]);

  const notifications = useMemo(() => {
    const today = moment().startOf('day');
    const alerts = { phatHanh: [], hieuLuc: [] };
    schedule.filter(i => i.status === 'completed' && i.completedAt).forEach(item => {
      const compDate = moment(item.completedAt).startOf('day');
      const diffDays = today.diff(compDate, 'days');
      if (diffDays >= 4 && diffDays <= 7) alerts.phatHanh.push({ ...item, diffDays });
      else if (diffDays >= 30 && diffDays <= 35) alerts.hieuLuc.push({ ...item, diffDays });
    });
    return alerts;
  }, [schedule]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-2xl text-blue-900">ĐANG TẢI...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-cover bg-center font-sans" style={{ backgroundImage: "url('/toaan.jpg')" }}>
        <div className="absolute inset-0 bg-black/30"></div> 
        <div className="relative z-10 w-full max-w-[480px] p-8 md:p-10 text-center" style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '12px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
          <img src="/lgtoaan1.png" alt="Logo" className="mx-auto mb-4 drop-shadow-2xl" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
          <p className="text-[16px] md:text-lg font-black uppercase mb-2 tracking-tight" style={{ color: '#dc2626', textShadow: '2px 2px 4px rgba(255, 255, 255, 0.9)' }}>TOÀ ÁN NHÂN DÂN THÀNH PHỐ CẦN THƠ</p>
          <h1 className="text-[20px] md:text-2xl font-black uppercase mb-8 tracking-tight" style={{ color: '#dc2626', textShadow: '2px 2px 4px rgba(255, 255, 255, 0.9)' }}>TAND KHU VỰC 9 - CẦN THƠ</h1>
          <form onSubmit={handleLogin} className="space-y-5 flex flex-col items-center">
            <input type="email" placeholder="Email..." value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-[85%] px-5 py-3 outline-none text-lg font-bold placeholder-gray-200 text-center transition-all focus:border-white focus:bg-white/20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', border: '2px solid rgba(255, 255, 255, 0.4)', borderRadius: '6px' }} required />
            <input type="password" placeholder="Mật khẩu..." value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-[85%] px-5 py-3 outline-none text-lg font-bold placeholder-gray-200 text-center transition-all focus:border-white focus:bg-white/20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', border: '2px solid rgba(255, 255, 255, 0.4)', borderRadius: '6px' }} required />
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
        .rbc-event { 
          background-color: rgba(59, 130, 246, 0.15) !important; 
          backdrop-filter: blur(4px) !important;
          -webkit-backdrop-filter: blur(4px) !important;
          border: 1px solid rgba(59, 130, 246, 0.4) !important;
          border-radius: 6px !important; 
          padding: 3px 6px !important; 
          font-size: 11px !important; 
          font-weight: 700 !important; 
          color: #1e3a8a !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;
          transition: all 0.2s ease-in-out;
        }
        .rbc-event:hover { background-color: rgba(59, 130, 246, 0.25) !important; }
        .rbc-event.rbc-selected { 
          background-color: #1e3a8a !important; 
          color: #ffffff !important;
          box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #1e3a8a !important; 
          z-index: 10 !important; 
        }
        .rbc-slot-selection { background-color: rgba(0, 0, 0, 0.6) !important; }
        .rbc-day-bg.rbc-today { background-color: #eff6ff !important; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 30px rgba(255, 255, 255, 0.1) inset !important; -webkit-text-fill-color: white !important; transition: background-color 5000s ease-in-out 0s; }
      `}} />

      {/* Sidebar đỏ với hiệu ứng kính mờ (Frosted Glass) */}
      <aside 
        className="w-64 text-white hidden xl:flex flex-col fixed h-screen z-20 overflow-y-auto"
        style={{ 
          background: 'rgba(220, 38, 38, 0.75)',
          backdropFilter: 'blur(16px)', 
          WebkitBackdropFilter: 'blur(16px)', 
          borderRight: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '4px 0 32px 0 rgba(0, 0, 0, 0.2)'
        }}
      >
        <div className="py-10 px-6 text-center border-b border-white/20">
          <img src="/lgtoaan1.png" alt="Logo Tòa án" className="w-20 h-20 mx-auto mb-4 drop-shadow-xl" />
          <h2 className="font-black text-2xl uppercase tracking-tighter drop-shadow-md">TAND KV9</h2>
        </div>
        
        <div className="p-6 flex-1">
          {/* NÂNG CẤP 1: Chuyển hướng nhanh (Scroll to Calendar) */}
          <div onClick={scrollToCalendar} className="cursor-pointer bg-blue-600/90 backdrop-blur-md px-4 py-4 font-black text-sm shadow-xl border border-white/20 flex justify-between items-center rounded-lg hover:bg-blue-500 transition-colors">
            <span className="drop-shadow-md">📅 LỊCH XÉT XỬ</span> 
            {urgentCount > 0 && <span className="bg-red-500 text-white px-2 py-1 text-xs rounded-full animate-bounce shadow-md border border-white/30">{urgentCount}</span>}
          </div>
        </div>

        <div className="p-6 border-t border-white/20 mt-auto bg-black/10">
          <div className="mb-6 p-4 bg-white/10 border border-white/20 rounded-lg shadow-inner">
             <p className="text-[10px] text-amber-300 font-black uppercase mb-1 tracking-widest drop-shadow-md">Quyền: {roleDisplayNames[userRole]}</p>
             <p className="text-sm font-bold truncate opacity-90 drop-shadow-md">{user?.email}</p>
          </div>
          <div className="space-y-3">
             <button onClick={() => setShowPwdModal(true)} className="w-full bg-blue-600/80 hover:bg-blue-600 py-3 font-black uppercase text-xs transition-all flex items-center justify-center gap-2 shadow-lg border border-white/20 rounded backdrop-blur-sm">🔑 ĐỔI MẬT KHẨU</button>
             <button onClick={handleLogout} className="w-full bg-black/20 hover:bg-black/40 py-3 font-black uppercase text-xs transition-all flex items-center justify-center gap-2 rounded border border-white/20 shadow-lg backdrop-blur-sm">🚪 ĐĂNG XUẤT</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 xl:ml-64 flex flex-col min-h-screen relative z-10">
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
          <div className="bg-white shadow-xl rounded-xl mb-8 border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-200">
              <div className="p-6 md:p-8 flex flex-col items-center justify-center text-center hover:bg-blue-50/50 transition-colors">
                <p className="text-gray-500 text-[11px] md:text-xs font-black uppercase tracking-widest mb-2">Tổng vụ án</p>
                <p className="text-4xl font-black text-blue-950">{schedule.length}</p>
              </div>
              <div className="p-6 md:p-8 flex flex-col items-center justify-center text-center hover:bg-amber-50/50 transition-colors">
                <p className="text-gray-500 text-[11px] md:text-xs font-black uppercase tracking-widest mb-2">Chờ xử</p>
                <p className="text-4xl font-black text-amber-600">{pendingCases.length}</p>
              </div>
              <div className="p-6 md:p-8 flex flex-col items-center justify-center text-center bg-red-50 hover:bg-red-100 transition-colors relative overflow-hidden group">
                {urgentCount > 0 && <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600 group-hover:h-2 transition-all"></div>}
                <p className="text-red-600 text-[11px] md:text-xs font-black uppercase tracking-widest mb-2">Sắp xử (24h)</p>
                <p className={`text-4xl font-black text-red-600 ${urgentCount > 0 ? 'animate-pulse' : ''}`}>{urgentCount}</p>
              </div>
              <div className="p-6 md:p-8 flex flex-col items-center justify-center text-center hover:bg-green-50/50 transition-colors">
                <p className="text-gray-500 text-[11px] md:text-xs font-black uppercase tracking-widest mb-2">Đã xong</p>
                <p className="text-4xl font-black text-green-600">{schedule.filter(i => i.status === 'completed').length}</p>
              </div>
            </div>
          </div>

          {(notifications.phatHanh.length > 0 || notifications.hieuLuc.length > 0) && (
            <div className="bg-white p-6 border-l-8 border-l-red-600 shadow-xl rounded-xl mb-8 animate-pulse-slow">
              <h3 className="font-black text-red-600 uppercase mb-4 flex items-center gap-2">🔔 DANH SÁCH NHẮC VIỆC HÔM NAY</h3>
              <div className="space-y-3">
                {notifications.phatHanh.map(item => (
                  <div key={`ph-${item.id}`} className="bg-amber-50 border border-amber-200 p-3 rounded flex justify-between items-center">
                    <p className="text-sm font-bold text-amber-800">⚠️ Đã <span className="text-red-600 text-lg">{item.diffDays}</span> ngày kể từ khi xử xong vụ <b>{item.caseName}</b>. Vui lòng kiểm tra tiến độ phát hành bản án!</p>
                  </div>
                ))}
                {notifications.hieuLuc.map(item => (
                  <div key={`hl-${item.id}`} className="bg-blue-50 border border-blue-200 p-3 rounded flex justify-between items-center">
                    <p className="text-sm font-bold text-blue-800">📜 Đã <span className="text-red-600 text-lg">{item.diffDays}</span> ngày kể từ khi xử xong vụ <b>{item.caseName}</b>. Bản án bắt đầu có hiệu lực pháp luật!</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canEdit && (
            <div className="bg-white p-6 md:p-10 border shadow-xl rounded-xl mb-12">
              <h2 className="font-black text-xl text-blue-950 uppercase mb-10 flex items-center justify-center gap-4">
                <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                {editingId ? "Cập nhật hồ sơ" : "Đăng ký lịch xét xử"}
                <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
              </h2>
              <div className="max-w-5xl mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className={labelStyle}>Thời gian xét xử <span className="text-red-500">*</span></label>
                    <div className="flex gap-4 w-full">
                      <input type="date" value={form.datetime ? form.datetime.split('T')[0] : ""} onChange={e => { const time = form.datetime && form.datetime.includes('T') ? form.datetime.split('T')[1] : '07:30'; setForm({...form, datetime: `${e.target.value}T${time}`}); }} className="w-[65%] border border-gray-300 rounded-md px-4 py-3 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-[15px] font-medium text-gray-800" />
                      <select value={form.datetime && form.datetime.includes('T') ? form.datetime.split('T')[1] : "07:30"} onChange={e => { const date = form.datetime ? form.datetime.split('T')[0] : moment().format('YYYY-MM-DD'); setForm({...form, datetime: `${date}T${e.target.value}`}); }} className="w-[35%] border border-gray-300 rounded-md px-4 py-3 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-[15px] font-medium text-gray-800">
                        <option value="07:30">07:30</option><option value="08:00">08:00</option><option value="08:30">08:30</option><option value="09:00">09:00</option><option value="09:30">09:30</option><option value="10:00">10:00</option><option value="10:30">10:30</option><option value="11:00">11:00</option><option value="13:30">13:30</option><option value="14:00">14:00</option><option value="14:30">14:30</option><option value="15:00">15:00</option><option value="15:30">15:30</option><option value="16:00">16:00</option><option value="16:30">16:30</option><option value="17:00">17:00</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelStyle}>Phòng xử / Địa điểm <span className="text-red-500">*</span></label>
                    <select value={form.room} onChange={e => setForm({...form, room: e.target.value})} className={inputBase}>
                      <option value="Trụ sở">🏢 TRỤ SỞ</option><option value="Chi nhánh">🏢 CHI NHÁNH</option><option value="Trực tuyến">💻 TRỰC TUYẾN</option><option value="Lưu động">🚚 LƯU ĐỘNG</option><option value="Dự phòng">⚠️ DỰ PHÒNG</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <label className={labelStyle}>Loại án <span className="text-red-500">*</span></label>
                    <select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value, duration: e.target.value === 'Hình sự' ? 120 : 30})} className={inputBase}>
                      <option value="Hình sự">Hình sự</option>
                      <option value="Dân sự">Dân sự</option>
                      <option value="Hành chính">Hành chính</option>
                      <option value="Hôn nhân & GĐ">Hôn nhân & GĐ</option>
                      <option value="Kinh tế">Kinh tế</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelStyle}>Thời lượng <span className="text-red-500">*</span></label>
                    <select value={form.duration} onChange={e => setForm({...form, duration: parseInt(e.target.value)})} className={inputBase}>
                      <option value={30}>⏱ 30 phút (Xử nhanh)</option>
                      <option value={120}>⏱ 2 giờ (Án hình sự)</option>
                      <option value={240}>⏱ 1 buổi (4 giờ)</option>
                      <option value={480}>⏱ 1 ngày (8 giờ)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelStyle}>Lần xử <span className="text-red-500">*</span></label>
                    <select value={form.trialCount} onChange={e => setForm({...form, trialCount: e.target.value})} className={inputBase}>
                      <option value="Lần 1">Lần 1</option>
                      <option value="Lần 2">Lần 2</option>
                      <option value="Mở lại">Mở lại</option>
                    </select>
                  </div>
                </div>

                <div><label className={labelStyle}>Trích yếu vụ án / Tội danh <span className="text-red-500">*</span></label><textarea value={form.caseName} onChange={e => setForm({...form, caseName: e.target.value})} className={inputBase} rows="2" placeholder="Ví dụ: Tranh chấp hợp đồng vay tài sản..." /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div><label className={labelStyle}>Nguyên đơn đầu vụ</label><input value={form.plaintiff} onChange={e => setForm({...form, plaintiff: e.target.value})} className={inputBase} placeholder="Họ & tên..." /></div>
                  <div><label className={labelStyle}>Bị đơn đầu vụ</label><input value={form.defendant} onChange={e => setForm({...form, defendant: e.target.value})} className={inputBase} placeholder="Họ & tên..." /></div>
                </div>
                <div className="pt-6">
                   <h3 className="text-[14px] font-black text-teal-800 bg-teal-50 border border-teal-200 py-3 rounded-md mb-6 text-center uppercase tracking-widest shadow-sm">Thành phần Hội đồng xét xử</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      <div><label className={labelStyle}>Thẩm phán</label><input list="judges-list" value={form.judge} onChange={e => setForm({...form, judge: e.target.value})} className={inputBase} placeholder="Chọn / nhập..." /></div>
                      <div><label className={labelStyle}>Thư ký</label><input list="clerks-list" value={form.clerk} onChange={e => setForm({...form, clerk: e.target.value})} className={inputBase} placeholder="Chọn / nhập..." /></div>
                      <div><label className={labelStyle}>Kiểm sát viên</label><input list="prosecutors-list" value={form.prosecutor} onChange={e => setForm({...form, prosecutor: e.target.value})} className={inputBase} placeholder="Chọn / nhập..." /></div>
                      <div><label className={labelStyle}>Hội thẩm nhân dân 1</label><input value={form.juror1} onChange={e => setForm({...form, juror1: e.target.value})} className={inputBase} placeholder="Họ & tên..." /></div>
                      <div><label className={labelStyle}>Hội thẩm nhân dân 2</label><input value={form.juror2} onChange={e => setForm({...form, juror2: e.target.value})} className={inputBase} placeholder="Họ & tên..." /></div>
                   </div>
                </div>
                <div className="pt-10 pb-4 mt-6 border-t-2 border-dashed border-gray-300">
                   <button onClick={handleSubmit} className={`w-full block text-white font-bold py-4 rounded-md uppercase text-lg shadow-lg transition-all active:scale-95 bg-blue-600 hover:bg-blue-700`}>
                     {editingId ? "Cập nhật thông tin" : "Lưu vào hệ thống"}
                   </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-12" ref={calendarSectionRef}>
            <div className="bg-white p-4 md:p-8 border shadow-xl rounded-xl h-[700px] group w-full">
              {canEdit && <p className="text-gray-400 text-xs font-bold text-center mb-4 italic">💡 Kéo thả để dời lịch. Độ dài ô trên lịch thể hiện thời lượng vụ án.</p>}
              {isMounted && localizer ? (
                <DnDCalendar localizer={localizer} events={calendarEvents} style={{ height: "100%" }} onSelectEvent={e => setSelectedEvent(e)} onEventDrop={onEventDrop} resizable={false} />
              ) : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">Đang tải bộ lịch...</div>}
            </div>

            <div className="bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden flex flex-col h-[850px] w-full">
              <div className="p-6 md:p-8 border-b border-gray-200 flex flex-col gap-6 sticky top-0 bg-white z-10">
                <h3 className="font-black uppercase text-xl md:text-2xl text-blue-950 flex items-center justify-center gap-4 whitespace-nowrap"><span className="w-1.5 h-8 bg-blue-950 rounded-full"></span>Sổ thụ lý</h3>
                
                {/* NÂNG CẤP 1: Bộ Lọc Nâng Cao (Thẩm phán, Thư ký) */}
                <div className="flex flex-col xl:flex-row flex-wrap gap-4 w-full justify-center items-center">
                  <div className="flex items-center gap-3 border border-gray-300 rounded-md px-4 py-2.5 bg-white w-full md:w-auto focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                    <span className="text-xs font-bold text-gray-500 uppercase">Từ:</span>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none text-sm font-medium bg-transparent text-gray-800 w-full" />
                    <span className="text-xs font-bold text-gray-500 uppercase ml-1">Đến:</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none text-sm font-medium bg-transparent text-gray-800 w-full" />
                    {(startDate || endDate) && <button onClick={() => {setStartDate(""); setEndDate("")}} className="text-red-500 font-bold px-1.5 hover:bg-red-50 rounded-full">✕</button>}
                  </div>
                  <select value={judgeFilter} onChange={e => setJudgeFilter(e.target.value)} className={filterStyle}><option value="all">👨‍⚖️ Lọc Thẩm phán</option>{judgesList.map(name => <option key={name} value={name}>{name}</option>)}</select>
                  <select value={clerkFilter} onChange={e => setClerkFilter(e.target.value)} className={filterStyle}><option value="all">📝 Lọc Thư ký</option>{clerksList.map(name => <option key={name} value={name}>{name}</option>)}</select>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={filterStyle}><option value="pending">⏳ Đang chờ xử</option><option value="postponed">⏸ Đã hoãn</option><option value="completed">✅ Đã xử xong</option><option value="all">📁 Tất cả</option></select>
                  <input type="text" placeholder="Tìm kiếm tự do..." onChange={e => setSearchQuery(e.target.value)} className={`${filterStyle} flex-1 min-w-[200px]`} />
                  <button onClick={exportToExcel} className="bg-green-600 text-white px-6 py-2.5 font-bold uppercase rounded-md shadow-sm hover:bg-green-700 transition-all active:scale-95 text-[14px]">📊 Xuất Excel</button>
                </div>
              </div>

              <div className="overflow-auto flex-1 bg-gray-50/30">
                <table className="w-full text-left border-collapse min-w-[900px] border-b border-gray-200">
                  <thead className="bg-gray-100 text-[12px] font-black uppercase text-gray-500 border-b border-gray-300 sticky top-0 z-10">
                    <tr className="divide-x divide-gray-200">
                      <th className="p-6 md:p-8 w-[15%] text-center">Thời gian / Địa điểm</th>
                      <th className="p-6 md:p-8 w-[40%]">Nội dung vụ việc</th>
                      <th className="p-6 md:p-8 w-[30%]">Hội đồng & Thư ký</th>
                      {canEdit && <th className="p-6 md:p-8 w-[15%] text-center">Tác vụ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {processedSchedule.map((item, index) => {
                      const isRowUrgent = item.status === 'pending' && isUrgent(item.datetime);
                      const isEven = index % 2 === 0;
                      let rowBgClass = item.status === 'completed' || item.status === 'postponed' ? "opacity-70 bg-gray-100/50" : isRowUrgent ? "bg-red-50 hover:bg-red-100" : isEven ? "bg-white hover:bg-blue-50/30" : "bg-slate-50 hover:bg-blue-50/30";

                      return (
                        <tr key={item.id} className={`transition-all group divide-x divide-gray-200 ${rowBgClass}`}>
                          <td className={`p-6 md:p-8 align-top text-center ${isRowUrgent ? 'border-l-4 border-l-red-500' : ''}`}>
                            <div className="space-y-4">
                              {item.status === 'postponed' ? ( <div className="text-amber-600 font-bold text-base animate-pulse">⏸ ĐÃ HOÃN</div> ) : (
                                <>
                                  <div className="font-bold text-gray-900 text-base">{item.datetime ? moment(item.datetime).format("DD/MM/YYYY") : "---"}</div>
                                  <div className="text-blue-600 font-bold text-base flex flex-col items-center justify-center gap-1">
                                    <span>🕒 {item.datetime ? moment(item.datetime).format("HH:mm") : "---"}</span>
                                    <span className="text-[10px] font-medium text-gray-500 bg-gray-200 px-2 rounded-full">Kéo dài: {item.duration || 60}p</span>
                                  </div>
                                </>
                              )}
                              <div className="font-bold text-gray-500 uppercase text-sm mt-4">{item.room || "---"}</div>
                            </div>
                          </td>
                          <td className="p-6 md:p-8 align-top">
                            <div className="space-y-4">
                              <div className="font-bold uppercase text-gray-900 text-base leading-snug group-hover:text-blue-800 transition-colors">
                                {item.status === 'completed' && <span className="text-green-600 mr-2">✅</span>}
                                {item.status === 'postponed' && <span className="text-amber-500 mr-2">⏸</span>}
                                {isRowUrgent && <span className="bg-red-500 text-white px-2 py-1 text-xs rounded mr-2 animate-pulse">⚠️ SẮP XỬ</span>}
                                {item.caseName || "Vụ án chưa có tên"}
                              </div>
                              <div className="text-gray-700 font-semibold text-sm">{item.caseType || "---"} / {item.trialCount || "Lần 1"}</div>
                              <div className="text-sm text-gray-700 space-y-2 pt-2">
                                <p><span className="font-semibold text-gray-500">NĐ:</span> {item.plaintiff || "N/A"}</p>
                                <p><span className="font-semibold text-gray-500">BĐ:</span> {item.defendant || "N/A"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-6 md:p-8 align-top">
                            <div className="space-y-4 text-sm md:text-base text-gray-800">
                              <div className="flex gap-2"><span className="font-semibold text-blue-700 w-8 shrink-0">TP:</span> <span className={`font-bold ${isRowUrgent ? 'text-red-900' : 'text-gray-900'}`}>{item.judge || "---"}</span></div>
                              <div className="flex gap-2"><span className="font-semibold text-gray-500 w-8 shrink-0">HT:</span> <span className="font-medium text-gray-700">{item.juror1 || "---"}, {item.juror2 || "---"}</span></div>
                              <div className="flex gap-2"><span className="font-semibold text-gray-500 w-8 shrink-0">TK:</span> <span className="font-medium text-gray-700">{item.clerk || "---"}</span></div>
                              <div className="flex gap-2"><span className="font-semibold text-red-600 w-8 shrink-0">KS:</span> <span className="font-bold text-red-600">{item.prosecutor || "---"}</span></div>
                            </div>
                          </td>
                          {canEdit && (
                            <td className="p-6 md:p-8 text-center align-top">
                              <div className="flex flex-col gap-3">
                                {(item.status === 'pending' || !item.status) && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => toggleStatus(item.id, 'completed', item.caseName)} className="bg-green-50 text-green-700 py-2.5 font-black uppercase text-[10px] md:text-xs border border-green-200 hover:bg-green-600 hover:text-white transition-all rounded shadow-sm" title="Xử xong">✔ XONG</button>
                                    <button onClick={() => toggleStatus(item.id, 'postponed', item.caseName)} className="bg-amber-50 text-amber-700 py-2.5 font-black uppercase text-[10px] md:text-xs border border-amber-200 hover:bg-amber-600 hover:text-white transition-all rounded shadow-sm" title="Hoãn xử">⏸ HOÃN</button>
                                  </div>
                                )}

                                {/* Trạng thái: Mở lại / Lên lịch lại (Chiếm full chiều ngang) */}
                                {item.status === 'postponed' && (
                                  <button onClick={() => handleReschedule(item)} className="w-full bg-blue-600 text-white py-2.5 font-black uppercase text-[10px] md:text-xs shadow-md hover:bg-blue-700 transition-all rounded">📅 LÊN LỊCH LẠI</button>
                                )}
                                {item.status === 'completed' && (
                                  <button onClick={() => toggleStatus(item.id, 'pending', item.caseName)} className="w-full bg-gray-200 text-gray-700 py-2.5 font-black uppercase text-[10px] md:text-xs hover:bg-gray-300 transition-all rounded">↺ MỞ LẠI</button>
                                )}

                                {/* Hàng 2: COPY LỊCH (Chiếm full chiều ngang) */}
                                {(item.status === 'pending' || !item.status) && (
                                  <button onClick={() => handleSendEmail(item)} className="w-full bg-purple-50 text-purple-700 py-2.5 font-black uppercase text-[10px] md:text-xs border border-purple-200 hover:bg-purple-600 hover:text-white transition-all rounded flex justify-center items-center gap-1 shadow-sm">📋 COPY LỊCH</button>
                                )}

                                {/* Hàng 3: SỬA / XÓA (Chia đôi nếu có quyền Xóa, không thì full Sửa) */}
                                <div className={`grid ${userRole === 'admin' || userRole === 'chanhan' ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-1 mt-1 border-t border-gray-200 border-dashed`}>
                                   <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="bg-blue-50 text-blue-700 py-2 font-black uppercase text-[10px] md:text-xs border border-blue-200 hover:bg-blue-600 hover:text-white transition-all rounded shadow-sm">✏️ SỬA</button>
                                   {(userRole === 'admin' || userRole === 'chanhan') && (
                                     <button onClick={() => handleDelete(item.id, item.caseName)} className="bg-red-50 text-red-700 py-2 font-black uppercase text-[10px] md:text-xs border border-red-200 hover:bg-red-600 hover:text-white transition-all rounded shadow-sm">🗑️ XÓA</button>
                                   )}
                                </div>

                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- CÁC MODAL HIỂN THỊ (Sự kiện, Đổi mật khẩu, Loading) GIỮ NGUYÊN --- */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-6" onClick={() => setSelectedEvent(null)}>
           <div className="w-full max-w-lg flex flex-col overflow-hidden transition-all transform md:scale-105" onClick={e => e.stopPropagation()} style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.6)', borderRadius: '28px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' }}>
              <div className="p-6 md:p-8 flex justify-between items-start" style={{ background: 'rgba(218, 32, 41, 0.9)' }}>
                <div><p className="text-xs font-black uppercase text-blue-200 mb-2 tracking-widest">{selectedEvent.caseType || "---"} - {selectedEvent.trialCount || "---"}</p><h3 className="text-xl md:text-2xl font-black uppercase leading-tight text-white drop-shadow-md">{selectedEvent.caseName || "Chưa có tên"}</h3></div>
              </div>
              <div className="p-6 md:p-8 space-y-5 text-sm md:text-base font-bold text-gray-900">
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-blue-100/80 flex items-center justify-center text-2xl shadow-sm">🕒</div><p className="flex-1 text-blue-950 text-lg"><span className="font-black">{selectedEvent.datetime ? moment(selectedEvent.datetime).format("HH:mm - DD/MM/YYYY") : "---"}</span> tại <span className="font-black">{selectedEvent.room || "---"}</span></p></div><hr className="border-gray-300 border-2 rounded-full opacity-50"/>
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-gray-200/60 flex items-center justify-center text-2xl shadow-sm">👨‍⚖️</div><p className="flex-1 text-gray-700 text-lg">Thẩm phán: <span className="font-black text-gray-950">{selectedEvent.judge || "---"}</span></p></div>
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-gray-200/60 flex items-center justify-center text-2xl shadow-sm">⚖️</div><p className="flex-1 text-gray-700 text-lg">Hội thẩm: <span className="font-black text-gray-900">{selectedEvent.juror1 || "---"}, {selectedEvent.juror2 || "---"}</span></p></div>
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-gray-200/60 flex items-center justify-center text-2xl shadow-sm">📝</div><p className="flex-1 text-gray-700 text-lg">Thư ký: <span className="font-black text-gray-900">{selectedEvent.clerk || "---"}</span></p></div>
                <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-red-100/60 flex items-center justify-center text-2xl shadow-sm">🛡️</div><p className="flex-1 text-gray-700 text-lg">Kiểm sát: <span className="font-black text-red-700">{selectedEvent.prosecutor || "---"}</span></p></div><hr className="border-gray-300 border-2 rounded-full opacity-50"/>
                <button onClick={() => setSelectedEvent(null)} className="w-full bg-blue-900/95 backdrop-blur-md text-white py-4 md:py-5 font-black text-lg uppercase mt-4 rounded-xl hover:bg-blue-800 transition-all shadow-xl active:scale-95 border border-blue-700">ĐÓNG CỬA SỔ</button>
              </div>
           </div>
        </div>
      )}

      {showPwdModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-6" onClick={() => setShowPwdModal(false)}>
           <div className="w-full max-w-md flex flex-col overflow-hidden transition-all transform md:scale-105" onClick={e => e.stopPropagation()} style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255, 255, 255, 0.6)', borderRadius: '28px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' }}>
              <div className="p-6 md:p-8 flex justify-center items-center" style={{ background: 'rgba(30, 58, 138, 0.9)' }}><h3 className="text-xl font-black uppercase tracking-widest text-white drop-shadow-md">🔑 ĐỔI MẬT KHẨU</h3></div>
              <form onSubmit={handleChangePassword} className="p-6 md:p-8 space-y-6">
                <div><label className="block text-xs font-black text-gray-600 uppercase mb-2 tracking-widest">Mật khẩu mới</label><input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required className="w-full border-2 border-white/80 p-4 bg-white/60 outline-none focus:border-blue-500 focus:bg-white/90 transition-all font-bold text-gray-900 rounded-xl shadow-inner" placeholder="Nhập mật khẩu mới..." minLength={6} /></div>
                <div><label className="block text-xs font-black text-gray-600 uppercase mb-2 tracking-widest">Xác nhận mật khẩu</label><input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required className="w-full border-2 border-white/80 p-4 bg-white/60 outline-none focus:border-blue-500 focus:bg-white/90 transition-all font-bold text-gray-900 rounded-xl shadow-inner" placeholder="Nhập lại mật khẩu..." minLength={6} /></div>
                <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowPwdModal(false)} className="w-1/2 bg-gray-200/80 backdrop-blur-sm text-gray-700 font-black py-4 uppercase hover:bg-gray-300 transition-all rounded-xl border border-white/80 shadow-sm active:scale-95">HỦY BỎ</button><button type="submit" className="w-1/2 bg-blue-600/95 backdrop-blur-sm text-white font-black py-4 uppercase hover:bg-blue-700 transition-all shadow-lg rounded-xl border border-blue-500 active:scale-95">LƯU ĐỔI</button></div>
              </form>
           </div>
        </div>
      )}

      {toast.show && (<div className={`fixed bottom-6 md:bottom-12 right-6 md:right-12 z-[200] px-8 md:px-12 py-4 md:py-6 shadow-2xl font-black text-sm md:text-lg text-white rounded-xl ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-700'}`}>{toast.message}</div>)}
    </div>
  );
}