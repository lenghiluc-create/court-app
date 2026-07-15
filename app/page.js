'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/vi';
import "react-big-calendar/lib/css/react-big-calendar.css";
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';

// Firebase Imports
import { db, auth } from './firebase'; 
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence, updatePassword } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, where, onSnapshot } from 'firebase/firestore';

const DANH_MUC_QUAN_HE = {
  "Dân sự": [
    "Tranh chấp hợp đồng vay tài sản",
    "Tranh chấp quyền sử dụng đất",
    "Tranh chấp hợp đồng tín dụng",
    "Tranh chấp về bồi thường thiệt hại ngoài hợp đồng",
    "Tranh chấp thừa kế tài sản",
    "Tranh chấp hợp đồng đặt cọc",
    "Tranh chấp hợp đồng mua bán tài sản"
  ],
  "Hôn nhân & GĐ": [
    "Ly hôn",
    "Ly hôn, tranh chấp về nuôi con",
    "Ly hôn, tranh chấp về nuôi con, chia tài sản khi ly hôn",
    "Tranh chấp về chia tài sản chung của vợ chồng sau khi ly hôn",
    "Tranh chấp về thay đổi người trực tiếp nuôi con sau khi ly hôn",
    "Yêu cầu cấp dưỡng",
    "Yêu cầu xác định cha, mẹ cho con"
  ],
  "Hình sự": [
    "Trộm cắp tài sản",
    "Cố ý gây thương tích",
    "Lừa đảo chiếm đoạt tài sản",
    "Vi phạm quy định về tham gia giao thông đường bộ",
    "Mua bán trái phép chất ma túy",
    "Tàng trữ trái phép chất ma túy"
  ],
  "Kinh tế": [
    "Tranh chấp hợp đồng mua bán hàng hóa",
    "Tranh chấp hợp đồng dịch vụ",
    "Tranh chấp giữa các thành viên công ty",
    "Tranh chấp hợp đồng tín dụng doanh nghiệp"
  ],
  "Lao động": [
    "Tranh chấp về đơn phương chấm dứt hợp đồng lao động",
    "Tranh chấp về đòi tiền lương, trợ cấp thôi việc",
    "Tranh chấp kỷ luật lao động theo hình thức sa thải"
  ],
  "Hành chính": [
    "Khiếu kiện quyết định hành chính về quản lý đất đai",
    "Khiếu kiện quyết định xử phạt vi phạm hành chính",
    "Khiếu kiện hành vi hành chính"
  ],
  "Cai nghiện": [
    "Đề nghị áp dụng biện pháp đưa vào cơ sở cai nghiện bắt buộc",
    "Đề nghị áp dụng biện pháp đưa vào trường giáo dưỡng"
  ]
};
const localizer = typeof window !== 'undefined' ? momentLocalizer(moment) : null;
const DnDCalendar = withDragAndDrop(Calendar);

export default function PremiumCourtApp() {
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('viewer'); 
  const [userRoles, setUserRoles] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  
  // States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showOnlyUrgent, setShowOnlyUrgent] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [displayMode, setDisplayMode] = useState("table"); 
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTVMode, setShowTVMode] = useState(false);
  const [isPublicView, setIsPublicView] = useState(false);
  const [userFullName, setUserFullName] = useState("");
  const [isSystemMenuOpen, setIsSystemMenuOpen] = useState(false); 
  const [editingUserId, setEditingUserId] = useState(null);
  const [viewMode, setViewMode] = useState("portal");
  const [newsList, setNewsList] = useState([]);
  const [legalDocs, setLegalDocs] = useState([]);
  const [quickLinks, setQuickLinks] = useState([]);
  const [readingLink, setReadingLink] = useState(null);
  const [listJudges, setListJudges] = useState([]); // Chứa danh sách 14 thẩm phán để máy tính toán
  const [phanAnForm, setPhanAnForm] = useState({ caseName: "", plaintiff: "", defendant: "", caseType: "Dân sự" });
  const [dsChoPhanAn, setDsChoPhanAn] = useState([]);
  const [choPhanAnId, setChoPhanAnId] = useState(null);
  const [manualJudge, setManualJudge] = useState(null); // Thẩm phán được chọn thủ công
  const [newsForm, setNewsForm] = useState({ title: "", content: "", date: moment().format("YYYY-MM-DD") });
  const [tuKhoa, setTuKhoa] = useState("");
  const [ketQuaTraCuu, setKetQuaTraCuu] = useState(null);
  const [selectedStatType, setSelectedStatType] = useState(null);
  const [statMonth, setStatMonth] = useState(moment().format('YYYY-MM'));
  // Modal States
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState(moment().startOf('month').format('YYYY-MM-DD')); 
  const [exportEnd, setExportEnd] = useState(moment().endOf('month').format('YYYY-MM-DD')); 
  const [exportFilterType, setExportFilterType] = useState('datetime');
  const [exportUnexportedOnly, setExportUnexportedOnly] = useState(false); // Cờ lọc án chưa xuất

  // Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateFilterType, setDateFilterType] = useState("datetime");
  const [reportMonth, setReportMonth] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [judgeFilter, setJudgeFilter] = useState("all");
  const [clerkFilter, setClerkFilter] = useState("all");

  const calendarSectionRef = useRef(null);
  const tableSectionRef = useRef(null); 
  const tvScrollRef = useRef(null);
  
  const initialForm = {
    datetime: "", room: "Trụ sở", caseType: "Hình sự", duration: 120, trialCount: "Lần 1", caseName: "", 
    plaintiff: "", defendant: "", judge: "", clerk: "", juror1: "", juror2: "", 
    prosecutor: "", status: "pending"
  };
  const [form, setForm] = useState(initialForm);
  const [activeTab, setActiveTab] = useState("trial"); 
  const [inspections, setInspections] = useState([]);
  const [insForm, setInsForm] = useState({ 
  date: "", 
  time: "08:00", 
  judge: "", 
  clerk: "", 
  commune: "An Thạnh", 
  content: "" 
});
  const communes = ["An Thạnh", "Cù Lao Dung", "Trường Khánh", "Đại Ngãi", "Tân Thạnh","Long Phú", "Thạnh Thới An", "Liêu Tú", "Lịch Hội Thượng", "Trần Đề", "Tài Văn"];

  const handleInsSubmit = async () => {
  if (!insForm.date || !insForm.time || !insForm.judge) {
    return showToast("Vui lòng nhập đầy đủ Ngày đi, Giờ đi và Thẩm phán!", "error");
  }
  try {
    await addDoc(collection(db, "inspections"), { 
      ...insForm, 
      createdAt: moment().toISOString(), 
      createdBy: user.email 
    });
    
    showToast("✅ Đã lưu lịch thẩm định thành công!", "success");
    setInsForm({ date: "", time: "08:00", judge: "", clerk: "", commune: "An Thạnh", content: "" });
  } catch (e) {
    console.error("Lỗi lưu:", e);
    showToast("Lỗi khi lưu dữ liệu vào hệ thống!", "error"); 
  }
};
const handlePostNews = async () => {
  if (!newsForm.title || !newsForm.content) {
    return showToast("Vui lòng nhập đủ Tiêu đề và Nội dung tin!", "error");
  }
  try {
    await addDoc(collection(db, "news"), { 
      ...newsForm, 
      createdAt: moment().toISOString(), 
      createdBy: user.email 
    });
    showToast("✅ Đã đăng tin thành công!", "success");
    setNewsForm({ title: "", content: "", date: moment().format("YYYY-MM-DD") }); // Reset form
  } catch (e) {
    showToast("Lỗi khi đăng tin!", "error"); 
  }
};
const getLabelBenBi = (loaiAn) => {
  switch (loaiAn) {
    case 'Hình sự':
      return 'Bị cáo:';
    case 'cainghien':
    case 'Cai nghiện': 
    case 'Hành chính':
      return 'Người bị đề nghị:';
    case 'Dân sự':
    case 'Hôn nhân & GĐ':
    case 'Kinh tế':
    case 'Lao động':
      return 'Bị đơn:';
    default:
      return 'Bị cáo / Bị đơn / Đương sự:';
  }
};

const getLabelBenKien = (loaiAn) => {
  switch (loaiAn) {
    case 'Hình sự':
      return 'Bị hại / Người liên quan:';
    case 'cainghien':
    case 'Cai nghiện':
      return 'Cơ quan đề nghị:';
    case 'Dân sự':
    case 'Hôn nhân & GĐ':
    case 'Hành chính':
    case 'Lao động':
    case 'Kinh tế':
      return 'Nguyên đơn / Người khởi kiện:';
    default:
      return 'Nguyên đơn / VKS / CQ Đề nghị:';
  }
};
const goiYThamPhan = () => {
    const danhSachChoAI = listJudges.filter(j => j.role !== "Chánh án");
    
    if (!danhSachChoAI || danhSachChoAI.length === 0) return null;

    const calculations = danhSachChoAI.map(j => {
    // (Chưa có datetime)
      const soAnDangCho = schedule.filter(a => a.judge === j.name && a.status === 'pending' && !a.datetime).length;
      
      const tongAnThucTe = (parseInt(j.tonCu) || 0) + soAnDangCho;
      const heSo = j.weight && j.weight > 0 ? j.weight : 1; 
      const chiSoTai = tongAnThucTe / heSo;

      return { ...j, chiSoTai, tongAnThucTe };
    });

    calculations.sort((a, b) => a.chiSoTai - b.chiSoTai);
    return calculations[0]; 
  };
    
  const handleLuuChoPhanAn = async () => {
    if (!phanAnForm.caseName) return showToast("Vui lòng nhập Trích yếu vụ án!", "error");
    try {
      if (choPhanAnId) {
        await updateDoc(doc(db, "schedule", choPhanAnId), {
          ...phanAnForm, updatedAt: moment().toISOString(), updatedBy: user?.email || "Hệ thống"
        });
      } else {
        await addDoc(collection(db, "schedule"), {
          caseName: phanAnForm.caseName, plaintiff: phanAnForm.plaintiff,
          defendant: phanAnForm.defendant, caseType: phanAnForm.caseType,
          status: "cho_phan_an", 
          createdAt: moment().toISOString(), createdBy: user?.email || "Hệ thống"
        });
      }
      showToast("✅ Đã lưu hồ sơ vào hàng chờ thành công!", "success");
      setPhanAnForm({ caseName: "", plaintiff: "", defendant: "", caseType: "Dân sự" });
      setChoPhanAnId(null);
    } catch (e) { showToast("Lỗi: " + e.message, "error"); }
  };

  // ====================================================================
  // 0. HÀM TRỢ THỦ: ĐẾM SỐ ÁN TRONG THÁNG CỦA THẨM PHÁN
  // ====================================================================
  const countCasesThisMonth = (judgeName) => {
    const currentMonth = moment().month() + 1;
    const currentYear = moment().year();
    
    return schedule.filter(item => {
      if (item.judge !== judgeName) return false;
      // Ưu tiên lấy ngày tạo án, nếu không có lấy ngày cập nhật
      const itemDate = item.createdAt ? moment(item.createdAt) : moment(item.updatedAt || new Date());
      return itemDate.month() + 1 === currentMonth && itemDate.year() === currentYear;
    }).length;
  };

  // ====================================================================
  // 1. HÀM LƯU PHÂN ÁN (1 VỤ)
  // ====================================================================
  const handleLuuPhanAn = async () => {
    if (!isChanHan && !isAdmin) return showToast("⛔ Chỉ Chánh án mới có quyền phê duyệt giao án!", "error");
    if (!phanAnForm.caseName) return showToast("Vui lòng nhập trích yếu!", "error");
    
    const targetJudge = manualJudge || goiYThamPhan(); 
    
    if (!targetJudge) return showToast("Không tìm thấy Thẩm phán phù hợp (hoặc chưa có ai ngoài Chánh án)!", "error");

    try {
      const data = {
        soThuLy: phanAnForm.soThuLy || "", // Đã bổ sung số thụ lý
        caseName: phanAnForm.caseName,
        plaintiff: phanAnForm.plaintiff || "",
        defendant: phanAnForm.defendant || "",
        caseType: phanAnForm.caseType,
        quanHePhapLuat: phanAnForm.quanHePhapLuat || "",
        judge: targetJudge.name, 
        status: "pending",
        room: "Chưa phân phòng",
        updatedAt: moment().toISOString(),
        updatedBy: user?.email || "Hệ thống"
      };

      if (choPhanAnId) {
        await updateDoc(doc(db, "schedule", choPhanAnId), data);
      } else {
        await addDoc(collection(db, "schedule"), { ...data, createdAt: moment().toISOString() });
      }

      showToast(`⚖️ Đã giao án thành công cho ${targetJudge.name}!`, "success");
      setPhanAnForm({ soThuLy: "", caseName: "", plaintiff: "", defendant: "", caseType: "Dân sự", quanHePhapLuat: "" });
      setChoPhanAnId(null);
      setManualJudge(null); 
    } catch (e) { showToast("Lỗi phân án: " + e.message, "error"); }
  };

  // 1.5. HÀM ĐỔI NHANH THẨM PHÁN TRÊN THẺ
  const handleChangeJudgeDirectly = async (id, judgeName) => {
    try {
      await updateDoc(doc(db, "schedule", id), { judge: judgeName });
    } catch (e) {
      showToast("Lỗi: " + e.message, "error");
    }
  };

  // ====================================================================
  // 2. HÀM TÍNH TOÁN DỰ KIẾN (ĐÃ UPDATE AI ẨN THẨM PHÁN >= 10 VỤ)
  // ====================================================================
  const predictAssignments = () => {
    let tempLoads = listJudges.filter(j => j.role !== "Chánh án").map(j => ({
        name: j.name,
        tonCu: parseInt(j.tonCu) || 0,
        soAnDangCho: schedule.filter(a => a.judge === j.name && a.status === 'pending' && !a.datetime).length,
        anThangNay: countCasesThisMonth(j.name), // Lấy số án đang ôm trong tháng này
        weight: j.weight && j.weight > 0 ? j.weight : 1
    }));

    return dsChoPhanAn.map(item => {
        // NẾU LÃNH ĐẠO ĐÃ CHỌN TAY: Vượt rào thoải mái
        if (item.judge) { 
           const target = tempLoads.find(j => j.name === item.judge);
           if (target) {
               target.soAnDangCho += 1;
               target.anThangNay += 1; 
           }
           return { ...item, suggestedJudge: item.judge, isManual: true };
        }

        // NẾU LÀ AI TỰ TÍNH: Lọc bỏ ngay những ông đã đủ 10 vụ
        let availableJudges = tempLoads.filter(j => j.anThangNay < 10);
        
        // Cảnh báo nếu ai cũng full 10 vụ
        if (availableJudges.length === 0) {
            return { ...item, suggestedJudge: "⛔ Đều đã max 10 vụ", isManual: false };
        }

        // Ưu tiên chia cho người rảnh việc (Trừ ra những người đã loại ở trên)
        availableJudges.sort((a, b) => ((a.tonCu + a.soAnDangCho) / a.weight) - ((b.tonCu + b.soAnDangCho) / b.weight));
        const target = availableJudges[0];
        
        if(target) {
            target.soAnDangCho += 1; 
            target.anThangNay += 1; // Nhận thêm 1 vụ thì cộng lên để vòng lặp sau tính tiếp
        }
        return { ...item, suggestedJudge: target ? target.name : "Đang tính...", isManual: false };
    });
  };

  // ====================================================================
  // 3. HÀM PHÂN ÁN ĐỒNG LOẠT (ĐÃ UPDATE CHIA TỰ ĐỘNG XOAY VÒNG < 10 VỤ)
  // ====================================================================
  const handlePhanAnDongLoat = async () => {
    if (!isChanHan && !isAdmin) return showToast("⛔ Chỉ Chánh án mới có quyền phê duyệt giao án!", "error");
    if (dsChoPhanAn.length === 0) return;

    if (!window.confirm(`🚀 Bạn có chắc muốn HỆ THỐNG GIAO ĐỒNG LOẠT ${dsChoPhanAn.length} hồ sơ này không?`)) return;

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      let tempLoads = listJudges.filter(j => j.role !== "Chánh án").map(j => ({
          name: j.name,
          tonCu: parseInt(j.tonCu) || 0,
          soAnDangCho: schedule.filter(a => a.judge === j.name && a.status === 'pending' && !a.datetime).length,
          anThangNay: countCasesThisMonth(j.name),
          weight: j.weight && j.weight > 0 ? j.weight : 1
      }));

      for (let item of dsChoPhanAn) {
          let targetJudgeName = item.judge; 

          // NẾU HỆ THỐNG AI TỰ CHỌN
          if (!targetJudgeName) { 
              let availableJudges = tempLoads.filter(j => j.anThangNay < 10);
              
              if (availableJudges.length === 0) {
                  showToast(`⚠️ Hệ thống ngừng lại giữa chừng do tất cả Thẩm phán đều đã nhận tối đa 10 vụ!`, "warning");
                  break; // Không còn ai nhận được nữa thì ngừng chia đồng loạt
              }

              availableJudges.sort((a, b) => ((a.tonCu + a.soAnDangCho) / a.weight) - ((b.tonCu + b.soAnDangCho) / b.weight));
              const targetJudge = availableJudges[0];
              
              if (targetJudge) {
                  targetJudgeName = targetJudge.name;
                  targetJudge.soAnDangCho += 1;
                  targetJudge.anThangNay += 1; // Quan trọng: Nhận vụ này xong là cộng lên, nếu đủ 10 nó sẽ bị loại ở vòng lặp sau
              }
          } else { 
              // NẾU LÃNH ĐẠO CHỌN TAY TRÊN THẺ
              const targetJudge = tempLoads.find(j => j.name === targetJudgeName);
              if(targetJudge) {
                  targetJudge.soAnDangCho += 1;
                  targetJudge.anThangNay += 1;
              }
          }

          if (!targetJudgeName) continue;

          await updateDoc(doc(db, "schedule", item.id), {
              judge: targetJudgeName,
              status: "pending",
              room: "Chưa phân phòng",
              updatedAt: moment().toISOString(),
              updatedBy: user?.email || "Hệ thống tự động"
          });
      }

      showToast(`✅ Đã phân án đồng loạt thành công!`, "success");
      setPhanAnForm({ soThuLy: "", caseName: "", plaintiff: "", defendant: "", caseType: "Dân sự", quanHePhapLuat: "" });
      setChoPhanAnId(null);
    } catch (e) {
      showToast("Lỗi phân án đồng loạt: " + e.message, "error");
    }
  };

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
  const qNews = query(collection(db, "news"), orderBy("date", "desc"));
  const qDocs = query(collection(db, "legal_docs"), orderBy("createdAt", "desc"));
  const qLinks = query(collection(db, "quick_links"), orderBy("order", "asc"));

  const unsubNews = onSnapshot(qNews, (snap) => setNewsList(snap.docs.map(d => ({id: d.id, ...d.data()}))));
  const unsubDocs = onSnapshot(qDocs, (snap) => setLegalDocs(snap.docs.map(d => ({id: d.id, ...d.data()}))));
  const unsubLinks = onSnapshot(qLinks, (snap) => setQuickLinks(snap.docs.map(d => ({id: d.id, ...d.data()}))));
  
  return () => {
    unsubNews();
    unsubDocs();
    unsubLinks();
  };
}, []);
useEffect(() => {
    const qCho = query(collection(db, "schedule"), where("status", "==", "cho_phan_an"));
    const unsubCho = onSnapshot(qCho, (snap) => {
      setDsChoPhanAn(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });
    return () => unsubCho();
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'tv') {
      setIsPublicView(true);
      setShowTVMode(true);
      setActiveTab("trial"); 
    }
    setIsMounted(true);
    const qIns = query(collection(db, "inspections"), orderBy("date", "asc"));
      const unsubscribeIns = onSnapshot(qIns, (snapshot) => {
        setInspections(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const threeMonthsAgo = moment().subtract(3, 'months').toISOString();
      const qSchedule = query(collection(db, "schedule"), where("datetime", ">=", threeMonthsAgo), orderBy("datetime", "desc"));
      const unsubscribeSchedule = onSnapshot(qSchedule, (snapshot) => {
        setSchedule(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          setViewMode("app");
          const email = currentUser.email ? currentUser.email.toLowerCase() : "";
          
          try {
            const q = query(collection(db, "users"), where("email", "==", email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const userData = querySnapshot.docs[0].data();
              const mangQuyen = userData.roles || [];
              setUserRoles(mangQuyen);
              setUserFullName(userData.hoTen || "");

              if (mangQuyen.includes("chanhan")) {
                setUserRole("chanhan"); 
              } else if (mangQuyen.includes("admin")) {
                setUserRole("admin"); 
              } else if (mangQuyen.includes("tham_phan")) {
                setUserRole("thamphan"); 
              } else if (mangQuyen.includes("thu_ky")) {
                setUserRole("thuky"); 
              } else {
                setUserRole("viewer"); 
              }
            } else {
              setUserRole("viewer"); 
            }
          } catch (error) {
            console.error("Lỗi đồng bộ quyền:", error);
            setUserRole("viewer");
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    return () => {
        unsubscribeIns();
        unsubscribeSchedule();
        unsubscribeAuth();
  };
    }
  }, []);
  useEffect(() => {
  if (!showTVMode) return; // Chỉ chạy khi mở Tivi

  const scrollContainer = tvScrollRef.current;
  if (!scrollContainer) return;

  const scrollInterval = setInterval(() => {
    // Nếu cuộn chạm đáy thì giật ngược lại lên đầu
    if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Cuộn xuống từ từ (mỗi 50 mili-giây cuộn 1 pixel)
      scrollContainer.scrollBy({ top: 1, behavior: 'smooth' });
    }
  }, 50); 

  return () => clearInterval(scrollInterval); // Dọn dẹp khi tắt Tivi
}, [showTVMode]);
  useEffect(() => {
    // Lấy danh sách Thẩm phán & Định mức tồn cũ
    const qJudges = query(collection(db, "judges"));
    const unsubscribeJudges = onSnapshot(qJudges, (snap) => {
      setListJudges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubscribeJudges();
  }, []);
  // TỰ ĐỘNG ĐIỀN THÔNG TIN TỪ VỤ ÁN ĐÃ PHÂN CÔNG
  const handleSelectPendingCase = (caseId) => {
    if (!caseId) {
      setForm(initialForm);
      setEditingId(null);
      return;
    }

    // Tìm vụ án được chọn trong danh sách danh sách án
    const selectedCase = schedule.find(item => item.id === caseId);
    
    if (selectedCase) {
      // Đổ hết dữ liệu cũ vào Form, chừa ngày giờ và phòng xử ra cho thư ký chọn
      setForm({
        ...initialForm, // Reset form trước
        caseName: selectedCase.caseName || "",
        caseType: selectedCase.caseType || "Civil", // Hoặc Dân sự/Hình sự tùy database của Ní
        plaintiff: selectedCase.plaintiff || "",
        defendant: selectedCase.defendant || "",
        judge: selectedCase.judge || "---",
        clerk: selectedCase.clerk || "---",
        prosecutor: selectedCase.prosecutor || "---",
        trialCount: selectedCase.trialCount || "Lần 1",
      });
      
      // Gán editingId bằng ID của vụ án này luôn để khi bấm "Lưu" nó sẽ UPDATE đè lên vụ án cũ 
      // chứ không tạo ra vụ án mới tinh bị trùng!
      setEditingId(selectedCase.id);
      
      showToast("⚡ Đã tự động điền thông tin vụ án!", "success");
    }
  };
  // =========================================================
  // 📊 HÀM XUẤT EXCEL CHI TIẾT ÁN THEO LOẠI (BẢN ĐẸP TOÀN DIỆN)
  // =========================================================
  const handleExportChiTietAn = () => {
    const dataToExport = schedule.filter(item => {
      if (item.caseType !== selectedStatType || !item.judge || item.judge === "---") return false;
      const itemMonth = moment(item.createdAt || item.updatedAt || new Date()).format('YYYY-MM');
      if (statMonth !== "all" && itemMonth !== statMonth) return false;
      return true;
    });
    
    if (dataToExport.length === 0) {
      alert("Không có dữ liệu để xuất!");
      return;
    }

    // Thiết lập nhãn thời gian hiển thị trên tiêu đề Excel
    const formattedMonth = statMonth === "all" ? "TẤT CẢ CÁC THỜI KỲ" : `THÁNG ${moment(statMonth, 'YYYY-MM').format('MM/YYYY')}`;

    // Khởi tạo chuỗi HTML vẽ bảng Excel chuẩn .5pt viền mảnh
    let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        table { border-collapse: collapse; width: 100%; font-family: 'Times New Roman', Times, serif; font-size: 12pt; } 
        td, th { border: .5pt solid windowtext; padding: 6px; vertical-align: top; } 
        .no-border { border: none !important; } 
        .text-center { text-align: center; vertical-align: middle; } 
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .bg-header { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <table>
        {/* PHẦN TIÊU ĐỀ QUỐC HIỆU QUỐC NGỮ */}
        <tr>
          <td colspan="3" class="no-border text-center font-bold" style="font-size: 11pt;">
            TÒA ÁN NHÂN DÂN<br/>KHU VỰC 9 - CẦN THƠ
          </td>
          <td colspan="5" class="no-border text-center font-bold" style="font-size: 11pt;">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập - Tự do - Hạnh Phúc
          </td>
        </tr>
        <tr>
          <td colspan="8" class="no-border text-center" style="font-size: 11pt;">
            <i>Cần Thơ, ngày ${moment().format("DD")} tháng ${moment().format("MM")} năm ${moment().format("YYYY")}</i>
          </td>
        </tr>
        <tr><td colspan="8" class="no-border"></td></tr>
        
        {/* TÊN BÁO CÁO */}
        <tr>
          <td colspan="8" class="no-border text-center font-bold" style="font-size: 15pt; text-transform: uppercase; color: #1e3a8a;">
            DANH SÁCH CHI TIẾT ÁN ${selectedStatType} ĐÃ PHÂN CÔNG
          </td>
        </tr>
        <tr>
          <td colspan="8" class="no-border text-center font-bold" style="font-size: 11pt; color: #555; text-transform: uppercase;">
            (${formattedMonth})
          </td>
        </tr>
        <tr><td colspan="8" class="no-border"></td></tr>
        
        {/* TIÊU ĐỀ CỘT BẢNG */}
        <thead>
          <tr class="bg-header">
            <th class="text-center font-bold" style="width: 50px;">STT</th>
            <th class="text-center font-bold" style="width: 140px;">SỐ THỤ LÝ</th>
            <th class="text-center font-bold" style="width: 280px;">TRÍCH YẾU VỤ ÁN</th>
            <th class="text-center font-bold" style="width: 240px;">QUAN HỆ PHÁP LUẬT / TỘI DANH</th>
            <th class="text-center font-bold" style="width: 180px;">NGUYÊN ĐƠN / BÌ HẠI</th>
            <th class="text-center font-bold" style="width: 180px;">BỊ ĐƠN / BỊ CÁO</th>
            <th class="text-center font-bold" style="width: 160px;">THẨM PHÁN THỤ LÝ</th>
            <th class="text-center font-bold" style="width: 110px;">TRẠNG THÁI</th>
          </tr>
        </thead>
        
        <tbody>
    `;

    // Đổ dữ liệu vào các dòng
    dataToExport.forEach((item, index) => {
      const stt = index + 1;
      const soThuLy = item.soThuLy || "Chưa cập nhật";
      const caseName = item.caseName || "---";
      const quanHe = item.quanHePhapLuat || "---";
      const plaintiff = item.plaintiff || "---";
      const defendant = item.defendant || "---";
      const judge = item.judge || "---";
      
      // Việt hóa trạng thái hiển thị
      let statusStr = "Chờ xếp lịch";
      if (item.status === 'completed') statusStr = "Đã giải quyết";
      else if (item.status === 'suspended') statusStr = "Tạm ngừng";
      else if (item.status === 'dinh_chi') statusStr = "Đình chỉ";
      else if (item.status === 'nghi_an') statusStr = "Nghị án";

      tableHtml += `
        <tr>
          <td class="text-center">${stt}</td>
          <td class="text-center" style="mso-number-format:'\\@';">${soThuLy}</td>
          <td><b>${caseName}</b></td>
          <td>${quanHe}</td>
          <td class="text-left">${plaintiff}</td>
          <td class="text-left">${defendant}</td>
          <td class="text-center">${judge}</td>
          <td class="text-center font-bold" style="color: ${item.status === 'completed' ? '#10b981' : '#4b5563'}">${statusStr}</td>
        </tr>
      `;
    });

    tableHtml += `
        </tbody>
      </table>
    </body>
    </html>`;

    // Đóng gói và tải file định dạng .xls
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    
    const monthSuffix = statMonth === "all" ? "TatCa" : statMonth.replace('-', '');
    link.download = `Danh_Sach_Chi_Tiet_An_${selectedStatType.replace(/\s+/g, '_')}_${monthSuffix}.xls`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");
    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      showToast("Đăng nhập thành công!", "success");
      setViewMode("app"); // Tự động chuyển thẳng vào giao diện làm việc
      setShowLoginModal(false);
    } catch (err) { setLoginError("❌ Sai tài khoản hoặc mật khẩu. Vui lòng kiểm tra lại!"); 
    } finally { 
      setLoading(false); 
    }
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

  const ghiNhatKy = async (hanhDong, chiTiet) => {
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      await addDoc(collection(db, "logs"), {
        nguoiThucHien: user?.email || "Khách vô danh",
        hanhDong: hanhDong,
        chiTiet: chiTiet,
        thoiGian: moment().toISOString()
      });
    } catch (error) {
      console.error("Lỗi ghi log:", error);
    }
  };
  
  const handleSubmit = async () => {
    if (!canEditSchedule) return showToast("Không có quyền!", "error");
    if (!form.datetime || !form.caseName || !form.room) return showToast("Vui lòng nhập đủ thông tin!", "error");
    
    if (!editingId) { 
      const duplicateCase = schedule.find(item => 
        (form.plaintiff && item.plaintiff === form.plaintiff) || 
        (form.defendant && item.defendant === form.defendant)
      );

      if (duplicateCase) {
        const trungTen = duplicateCase.plaintiff === form.plaintiff ? duplicateCase.plaintiff : duplicateCase.defendant;
        const ngayXu = duplicateCase.datetime ? moment(duplicateCase.datetime).format("DD/MM/YYYY") : "Chưa có ngày";
        
        const confirmSave = window.confirm(
          `⚠️ PHÁT HIỆN TRÙNG ĐƯƠNG SỰ!\n\n` +
          `Đương sự: ${trungTen}\n` +
          `Đã có trong vụ: "${duplicateCase.caseName}"\n` +
          `Ngày xử: ${ngayXu}\n\n` +
          `Bạn có chắc chắn đây là vụ án mới và muốn tiếp tục lưu không?`
        );
        
        if (!confirmSave) return; 
      }
    }

    // ==============================================================
    // 🛡️ 1. CHẶN THƯ KÝ SỬA NGÀY GIỜ SAI QUY TRÌNH (BYPASS NÚT HOÃN)
    // ==============================================================
    if (editingId) {
      const oldItem = schedule.find(item => item.id === editingId);
      
      // Nếu hồ sơ cũ đã có ngày, form nhập cũng có ngày, và 2 ngày này khác nhau
      if (oldItem && oldItem.datetime && form.datetime && oldItem.datetime !== form.datetime) {
        
        // Kiểm tra xem tên vụ án hoặc Lần xử có dấu vết của việc dùng nút [🔄 Hoãn] hợp lệ không
        const laDungQuyTrinhHoan = form.caseName.includes("Hoãn từ ngày") || form.trialCount !== oldItem.trialCount;

        // Nếu không phải đang dùng nút Hoãn mà lại đi đổi ngày
        if (!laDungQuyTrinhHoan) {
          const xacNhan = window.confirm(
            `🚨 HỆ THỐNG CẢNH BÁO QUY TRÌNH!\n\n` +
            `Hệ thống phát hiện bạn đang TỰ Ý ĐỔI NGÀY XÉT XỬ (từ ${moment(oldItem.datetime).format("DD/MM/YYYY")} sang ${moment(form.datetime).format("DD/MM/YYYY")}) thông qua nút [Sửa hồ sơ] thay vì dùng tính năng Hoãn.\n\n` +
            `👉 NẾU PHIÊN TÒA BỊ HOÃN:\nBấm [Cancel / Hủy] ngay! Sau đó ra ngoài, dùng nút [🔄 Hoãn] để hệ thống tự động tăng Lần xử và ghi chú lý lịch.\n\n` +
            `👉 NẾU CHỈ LÀ NHẬP SAI/GÕ NHẦM NGÀY:\nBấm [OK] để xác nhận là lỗi đánh máy và tiếp tục lưu.`
          );
          
          if (!xacNhan) {
            // Trả về không cho lưu, bắt Thư ký làm lại
            return showToast("❌ Đã hủy cập nhật! Vui lòng dùng nút [🔄 Hoãn] ở ngoài danh sách.", "error");
          } else {
            // Bổ sung cờ đánh dấu để Lãnh đạo biết Thư ký tự đổi tay
            form.ghiChuQuyTrinh = `⚠️ Tự đổi ngày bằng nút Sửa (từ ${moment(oldItem.datetime).format("DD/MM")})`;
          }
        }
      }
    }
    // ==============================================================

    const conflicts = schedule.filter(item => {
      // Bỏ qua chính vụ án đang sửa (nếu là update)
      if (editingId && item.id === editingId) return false;
      
      // Bỏ qua nếu chưa chọn giờ
      if (!item.datetime || !form.datetime) return false; 

      // Kiểm tra xem có bị trùng cùng 1 thời điểm không (cùng ngày, cùng giờ)
      const isSameTime = item.datetime === form.datetime;

      if (isSameTime) {
        // 1. Quét trùng Thẩm phán, Thư ký, Phòng xử
        const trungTP = form.judge && form.judge !== "---" && item.judge === form.judge;
        const trungTK = form.clerk && form.clerk !== "---" && item.clerk === form.clerk;
        const trungPhong = form.room && form.room !== "---" && item.room === form.room;
        
        // 2. Quét chéo Hội thẩm 1 và Hội thẩm 2
        const formHT1 = form.juror1;
        const formHT2 = form.juror2;
        const itemHT1 = item.juror1;
        const itemHT2 = item.juror2;
        
        const trungHT1 = formHT1 && formHT1 !== "---" && (formHT1 === itemHT1 || formHT1 === itemHT2);
        const trungHT2 = formHT2 && formHT2 !== "---" && (formHT2 === itemHT1 || formHT2 === itemHT2);

        // Trả về true nếu trùng BẤT KỲ thành phần nào
        if (trungTP || trungTK || trungPhong || trungHT1 || trungHT2) {
           item.loiTrung = [];
           if (trungPhong) item.loiTrung.push(`Phòng ${form.room}`);
           if (trungTP) item.loiTrung.push(`Thẩm phán ${form.judge}`);
           if (trungTK) item.loiTrung.push(`Thư ký ${form.clerk}`);
           if (trungHT1) item.loiTrung.push(`Hội thẩm ${formHT1}`);
           if (trungHT2) item.loiTrung.push(`Hội thẩm ${formHT2}`);
           return true;
        }
      }
      return false;
    });

    // NẾU CÓ TRÙNG -> CHẶN LẠI VÀ BÁO LỖI CHI TIẾT
    if (conflicts.length > 0) {
      const canhBao = conflicts.map(c => `• Vụ "${c.caseName}": Trùng ${c.loiTrung.join(", ")}`).join("\n");
      return showToast(`⚠️ KHÔNG THỂ LƯU! Phát hiện TRÙNG LỊCH tại thời điểm này:\n\n${canhBao}`, "error"); 
    }
    
    const isConflict = await isConflictServerSide(form.datetime, form.room, editingId, form.duration);
    if(isConflict) return showToast("⚠️ Xin lỗi, phòng này vừa được đặt. Vui lòng chọn giờ khác!", "error");

    const logData = { 
      ...form, 
      updatedAt: moment().toISOString(), 
      updatedBy: user.email 
    };

    // ==============================================================
    // 💡 2. TẨY NÃO CỜ EXCEL KHI ĐỔI NGÀY (FIX LỖI MẤT ÁN HOÃN LẦN 2)
    // ==============================================================
    if (editingId) {
      const oldItem = schedule.find(item => item.id === editingId);
      if (oldItem && oldItem.datetime !== form.datetime) {
        logData.daXuatExcel = false; // Ép về false để lần hoãn mới lọt vào danh sách xuất Excel tiếp
      }
    }
    // ==============================================================

    try {
      if (editingId) {
        await updateDoc(doc(db, "schedule", editingId), logData);
        showToast("💾 Đã cập nhật hồ sơ!", "success");
        ghiNhatKy("Cập nhật lịch", `Sửa thông tin vụ án: ${form.caseName}`);
      } else {
        await addDoc(collection(db, "schedule"), { ...logData, createdAt: moment().toISOString(), createdBy: user.email });
        showToast("✅ Lưu lịch mới thành công!", "success");
        ghiNhatKy("Thêm lịch mới", `Tạo vụ án: ${form.caseName} - Phòng: ${form.room}`);
      }
      setForm(initialForm); setEditingId(null);
    } catch (err) { showToast("Lỗi khi lưu dữ liệu", "error"); }
  };

  const toggleStatus = async (id, newStatus, caseName) => {
    try {
      const updateData = { status: newStatus, updatedBy: user.email, updatedAt: moment().toISOString() };
      if (newStatus === 'completed') updateData.completedAt = moment().toISOString();
      await updateDoc(doc(db, "schedule", id), updateData);
      
      let msg = "⏳ Đã cập nhật trạng thái!";
      if (newStatus === 'completed') msg = "✅ Đã đánh dấu xử xong (Bắt đầu tính hạn phát hành)!";
      if (newStatus === 'suspended') msg = "⏸ Phiên tòa đã tạm ngừng (Chờ báo sau)!";
      
      showToast(msg, "success");
      ghiNhatKy("Đổi trạng thái", `Chuyển vụ "${caseName}" sang: ${newStatus}`);
    } catch (err) { showToast("Lỗi cập nhật trạng thái", "error"); }
  };
  // HÀM XỬ LÝ ĐÌNH CHỈ VỤ ÁN / RÚT ĐƠN
  const handleDinhChi = async (item) => {
    const lyDo = window.prompt(`🛑 ĐÌNH CHỈ VỤ ÁN: ${item.caseName}\n\nNhập lý do đình chỉ (VD: Rút đơn khởi kiện, Nguyên đơn vắng mặt 2 lần...):`);
    
    // Nếu Thư ký bấm Hủy (Cancel) thì không làm gì cả
    if (lyDo === null) return; 

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, "schedule", item.id), { 
        status: 'dinh_chi', 
        lyDoDinhChi: lyDo || "Không ghi rõ lý do", // Nếu để trống thì ghi mặc định
        ngayDinhChi: moment().toISOString(),
        updatedBy: user.email,
        updatedAt: moment().toISOString()
      });
      
      showToast("✅ Đã cập nhật trạng thái ĐÌNH CHỈ thành công!", "success");
      ghiNhatKy("Đình chỉ án", `Vụ: ${item.caseName} - Lý do: ${lyDo}`);
    } catch (e) {
      showToast("Lỗi cập nhật đình chỉ: " + e.message, "error");
    }
  };
  // HÀM CẬP NHẬT TRẠNG THÁI NGHỊ ÁN 
  const updateCaseStatus = async (id, status) => {
    let extraData = {};
    if (status === 'nghi_an') {
      const duKien = window.prompt("⚖️ Vụ án chuyển sang Nghị án.\nNhập ngày dự kiến tuyên án (VD: 30/05/2026):");
      if (duKien) {
        extraData = { duKienTuyenAn: duKien };
      } else {
        return; // Nếu Thư ký bấm Hủy thì không làm gì cả
      }
    }
    
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, "schedule", id), { 
        status: status, 
        ...extraData,
        updatedAt: new Date().toISOString()
      });
      showToast("✅ Đã cập nhật trạng thái thành công!", "success");
    } catch (e) {
      showToast("Lỗi cập nhật: " + e.message, "error");
    }
  };

  const togglePublish = async (item) => {
    try {
      const isPublishing = !item.publishedAt;
      await updateDoc(doc(db, "schedule", item.id), { 
        publishedAt: isPublishing ? moment().toISOString() : null,
        updatedBy: user.email, 
        updatedAt: moment().toISOString() 
      });
      showToast(isPublishing ? "📤 Đã ghi nhận phát hành bản án!" : "Hủy ghi nhận phát hành", "success");
    } catch (err) { showToast("Lỗi cập nhật phát hành", "error"); }
  };
// 1. HÀM NHẬN KHÁNG CÁO (Hỏi thêm người kháng cáo)
  const handleKhangCao = async (item) => {
    const inputDate = window.prompt(`⚖️ Nhập ngày nhận đơn Kháng cáo/Kháng nghị vụ: ${item.caseName}\n(Định dạng: DD/MM/YYYY. Để trống sẽ lấy hôm nay):`);
    if (inputDate === null) return;

    // HỎI THÊM NGƯỜI KHÁNG CÁO
    const nguoiKhangCao = window.prompt(`👤 Ai là người nộp đơn Kháng cáo / Cơ quan Kháng nghị?\n(VD: Bị đơn Trần Văn A kháng cáo toàn phần)`);
    if (nguoiKhangCao === null) return;

    let ngayKhangCao = moment();
    if (inputDate.trim() !== "") {
        const parsed = moment(inputDate, ["DD/MM/YYYY", "YYYY-MM-DD"], true);
        if (parsed.isValid()) ngayKhangCao = parsed;
        else return showToast("Sai định dạng ngày! Vui lòng nhập chuẩn DD/MM/YYYY", "error");
    }

    let hanChuyen = moment(ngayKhangCao).add(30, 'days');
    if (item.caseType?.includes("Hình sự")) {
        hanChuyen.add(7, 'days');
    } else {
        let daysAdded = 0;
        while (daysAdded < 5) {
            hanChuyen.add(1, 'days');
            if (hanChuyen.isoWeekday() !== 6 && hanChuyen.isoWeekday() !== 7) daysAdded++;
        }
    }

    try {
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, "schedule", item.id), {
            isKhangCao: true,
            ngayKhangCao: ngayKhangCao.toISOString(),
            hanChuyenKhangCao: hanChuyen.toISOString(),
            nguoiKhangCao: nguoiKhangCao || "Không ghi rõ", // Lưu tên người kháng cáo
            trangThaiKhangCao: "dang_cho_chuyen", // Gắn cờ đang chờ
            updatedBy: user?.email || "Hệ thống",
            updatedAt: moment().toISOString()
        });
        showToast(`✅ Đã ghi nhận! Hạn chuyển: ${hanChuyen.format("DD/MM/YYYY")}`, "success");
    } catch (e) { showToast("Lỗi cập nhật: " + e.message, "error"); }
  };

  // 2. HÀM CHỐT ĐÃ CHUYỂN PHÚC THẨM (Ngừng báo đỏ)
  const handleChuyenPhucTham = async (item) => {
    if (!window.confirm(`📦 Bạn có chắc là ĐÃ CHUYỂN hồ sơ vụ "${item.caseName}" lên Tòa Phúc thẩm chưa?`)) return;
    try {
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, "schedule", item.id), {
            trangThaiKhangCao: "da_chuyen", // Đổi cờ thành Đã chuyển
            ngayChuyenPhucTham: moment().toISOString(),
            updatedBy: user?.email || "Hệ thống",
            updatedAt: moment().toISOString()
        });
        showToast("✅ Đã chốt chuyển hồ sơ thành công!", "success");
    } catch (e) { showToast("Lỗi cập nhật: " + e.message, "error"); }
  };
  // 3. HÀM CHỐT KẾT QUẢ PHÚC THẨM VÀ ĐÁNH GIÁ LỖI CHỦ QUAN
  const handleKetQuaPhucTham = async (item) => {
    const luaChon = window.prompt(
        `🏆 CẬP NHẬT KẾT QUẢ PHÚC THẨM vụ: ${item.caseName}\n\nNhập SỐ tương ứng với kết quả:\n1 - Y án sơ thẩm\n2 - Sửa bản án\n3 - Hủy bản án\n4 - Rút đơn / Đình chỉ xét xử`
    );

    if (!luaChon) return;

    let ketQuaStr = "";
    let isLoiChuQuan = false;

    if (luaChon === "1") ketQuaStr = "Y án sơ thẩm";
    else if (luaChon === "2") {
        ketQuaStr = "Sửa bản án";
        isLoiChuQuan = window.confirm("⚠️ Việc SỬA án này có bị xem là do LỖI CHỦ QUAN của Thẩm phán không?\n(Bấm OK = Có lỗi / Bấm Cancel = Khách quan)");
    }
    else if (luaChon === "3") {
        ketQuaStr = "Hủy bản án";
        isLoiChuQuan = window.confirm("🚨 Việc HỦY án này có bị xem là do LỖI CHỦ QUAN của Thẩm phán không?\n(Bấm OK = Có lỗi / Bấm Cancel = Khách quan)");
    }
    else if (luaChon === "4") ketQuaStr = "Rút đơn / Đình chỉ";
    else return showToast("Lựa chọn không hợp lệ! Vui lòng nhập từ 1 đến 4.", "error");

    try {
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, "schedule", item.id), {
            ketQuaPhucTham: ketQuaStr,
            loiChuQuan: isLoiChuQuan,
            ngayChotPhucTham: moment().toISOString(),
            updatedBy: user?.email || "Hệ thống",
            updatedAt: moment().toISOString()
        });
        showToast(`✅ Đã chốt KQ Phúc thẩm: ${ketQuaStr}`, "success");
    } catch (e) { showToast("Lỗi cập nhật: " + e.message, "error"); }
  };
// HÀM PHÁT THANH GỌI TÊN ĐƯƠNG SỰ BẰNG GIỌNG NÓI TRÌNH DUYỆT (0 TỐN DUNG LƯỢNG)
  const docTenDuongSu = (item) => {
    if (!window.speechSynthesis) {
      return showToast("Trình duyệt trên Tivi không hỗ trợ giọng nói!", "error");
    }

    // Dừng các giọng đọc cũ (nếu có) để đọc câu mới ngay lập tức
    window.speechSynthesis.cancel();

    // Gom tên đương sự lại cho tự nhiên
    let danhSach = [];
    if (item.plaintiff && item.plaintiff !== "---") danhSach.push(item.plaintiff);
    if (item.defendant && item.defendant !== "---") danhSach.push(item.defendant);
    let chuoiTen = danhSach.join(" và ");

    // Lên kịch bản lời gọi chuẩn phong cách Tòa án
    let kichBan = `Kính mời đương sự ${chuoiTen}, vui lòng di chuyển vào phòng xử ${item.room || "phòng xét xử"} để làm việc. Xin nhắc lại, kính mời đương sự ${chuoiTen} vào phòng xét xử ${item.room || "phòng xét xử"}.`;

    // Gọi Robot ra đọc
    const ut = new SpeechSynthesisUtterance(kichBan);
    ut.lang = 'vi-VN'; // Bắt buộc đọc tiếng Việt
    ut.rate = 0.85;    // Tốc độ đọc chậm rãi, dõng dạc (1.0 là bình thường)
    ut.pitch = 1;      // Độ cao giọng chuẩn
    
    window.speechSynthesis.speak(ut);
    
    // Hiện thông báo góc màn hình
    showToast("📢 Đang phát thanh gọi đương sự...");
  };
  
  const handleDelete = async (id, caseName) => {
    if(confirm("Xóa hồ sơ này?")) {
      await deleteDoc(doc(db,"schedule", id));
      ghiNhatKy("Xóa lịch (Cảnh báo)", `Đã xóa vụ án: ${caseName}`); 
    }
  };
 const handleDeleteIns = async (id) => {
    if (window.confirm("Bạn có chắc muốn xóa lịch thẩm định này không?")) {
      try {
        // Gọi thẳng lệnh deleteDoc luôn, không cần import lại nữa
        await deleteDoc(doc(db, "inspections", id));
        
        showToast("Đã xóa lịch thẩm định thành công!", "success");
      } catch (error) {
        console.error("Lỗi xóa:", error);
        showToast("Lỗi khi xóa: " + error.message, "error");
      }
    }
  };

  const onEventDrop = async ({ event, start, end }) => {
    if (!canEditSchedule) return showToast("Không có quyền dời lịch!", "error");
    const newDatetime = moment(start).format('YYYY-MM-DDTHH:mm');
    const isConflict = await isConflictServerSide(newDatetime, event.room, event.id, event.duration || 60);
    if (isConflict) return showToast(`⚠️ Trùng lịch phòng ${event.room}!`, "error");

    try {
      await updateDoc(doc(db, "schedule", event.id), { 
        datetime: newDatetime, 
        updatedAt: moment().toISOString(), 
        updatedBy: user.email 
      });
      showToast("🔄 Đã dời lịch thành công!", "success");
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
      if (currentItem && currentItem.status !== newStatus) {
         if (newStatus === 'pending' && currentItem.status === 'suspended') {
            handleReschedule(currentItem);
         } else {
            await toggleStatus(id, newStatus, caseName);
         }
      }
    }
  };

  const handleReschedule = (item) => {
    let nextTrialCount = item.trialCount === "Lần 1" ? "Lần 2" : "Mở lại";
    const oldDate = item.datetime ? moment(item.datetime).format("DD/MM/YYYY") : "Chưa có";
    const oldNote = `(Hoãn từ ngày ${oldDate})`;
    setForm({ ...item, datetime: "", trialCount: nextTrialCount, status: "pending", daXuatExcel: false,
    caseName: item.caseName.includes(oldNote) ? item.caseName : `${item.caseName} ${oldNote}`
  });
    setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'});
    showToast(`⚠️ Đã kích hoạt Hoãn/Mở lại. ${oldNote}. Vui lòng CHỌN NGÀY GIỜ MỚI và bấm Cập nhật!`, "success");
  };

  const scrollToCalendar = () => { if(calendarSectionRef.current) calendarSectionRef.current.scrollIntoView({ behavior: 'smooth' }); };
  const scrollToTable = () => { if(tableSectionRef.current) tableSectionRef.current.scrollIntoView({ behavior: 'smooth' }); };

  const handleStatCardClick = (type) => {
    if (type === 'all') { setStatusFilter('all'); setShowOnlyUrgent(false); }
    if (type === 'pending') { setStatusFilter('pending'); setShowOnlyUrgent(false); }
    if (type === 'completed') { setStatusFilter('completed'); setShowOnlyUrgent(false); }
    if (type === 'suspended') { setStatusFilter('suspended'); setShowOnlyUrgent(false); }
    if (type === 'urgent') { setStatusFilter('pending'); setShowOnlyUrgent(true); }
    if (type === 'overdue_publish') { setStatusFilter('completed'); setShowOnlyUrgent(false); }
    if (type === 'effective') { setStatusFilter('completed'); setShowOnlyUrgent(false); }
    scrollToTable();
  };

  const isUrgent = (datetime) => {
    if(!datetime) return false;
    const diffDays = moment(datetime).startOf('day').diff(moment().startOf('day'), 'days');
    return diffDays === 0 || diffDays === 1; 
  };

  const isOverduePublish = (item) => {
    if (item.status !== 'completed' || !item.completedAt || item.publishedAt) return false;
    const days = moment().startOf('day').diff(moment(item.completedAt).startOf('day'), 'days');
    return days >= 5; 
  };

  const isEffective = (item) => {
    if (item.status !== 'completed' || !item.completedAt) return false;
    const days = moment().startOf('day').diff(moment(item.completedAt).startOf('day'), 'days');
    return days >= 30;
  };

  const calculateDeadlines = (item) => {
    if (!item.completedAt) return { publish: null, effective: null };
    return {
      publish: moment(item.completedAt).add(5, 'days').format("DD/MM/YYYY"),
      effective: moment(item.completedAt).add(30, 'days').format("DD/MM/YYYY")
    };
  };

  const creatorsList = [...new Set(schedule.map(i => i.createdBy).filter(Boolean))];
  const judgesList = [...new Set(schedule.map(i => i.judge).filter(Boolean))];
  const clerksList = [...new Set(schedule.map(i => i.clerk).filter(Boolean))];
  const prosecutorsList = [...new Set(schedule.map(i => i.prosecutor).filter(Boolean))];

  const processedSchedule = useMemo(() => {
    return schedule.filter(i => {
      const search = (searchQuery || "").toLowerCase().trim();
      const matchSearch = search === "" || (i.caseName || "").toLowerCase().includes(search) || (i.plaintiff || "").toLowerCase().includes(search) || (i.defendant || "").toLowerCase().includes(search);
      const matchStatus = statusFilter === 'all' ? true : 
                    statusFilter === 'has_appeal' ? i.isKhangCao === true : 
                    i.status === statusFilter;
      const matchCreator = creatorFilter === 'all' ? true : (i.createdBy === creatorFilter);
      const matchJudge = judgeFilter === 'all' ? true : (i.judge === judgeFilter);
      const matchClerk = clerkFilter === 'all' ? true : (i.clerk === clerkFilter);
      const matchUrgent = showOnlyUrgent ? isUrgent(i.datetime) : true;
      
      let matchDate = true;
      if (startDate || endDate) {
        // NÂNG CẤP: Cho phép chọn trường dữ liệu để lọc
        const targetDate = dateFilterType === 'createdAt' ? i.createdAt : i.datetime;
        
        // Cắt bỏ phần giờ phút, chỉ lấy ngày (YYYY-MM-DD)
        const itemDateStr = targetDate ? (targetDate.includes('T') ? targetDate.split('T')[0] : targetDate) : null;
        
        if (!itemDateStr) { 
            matchDate = false; 
        } else {
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
  }, [schedule, searchQuery, statusFilter, showOnlyUrgent, creatorFilter, judgeFilter, clerkFilter, startDate, endDate, dateFilterType]); // <-- Đã chèn thêm dateFilterType ở cuối dòng này
  
  // THUẬT TOÁN ĐÁNH GIÁ CHẤT LƯỢNG XÉT XỬ (ĐÃ NÂNG CẤP LỌC THEO THÁNG)
  const chatLuongXetXu = useMemo(() => {
    const stats = {};
    schedule.filter(i => {
      if (i.status !== 'completed' || !i.judge) return false;
      
      // NẾU CÓ CHỌN THÁNG -> BẮT ĐẦU LỌC TRƯỚC KHI ĐẾM
      if (reportMonth) {
        const itemMonth = i.datetime ? moment(i.datetime).format("YYYY-MM") : "";
        if (itemMonth !== reportMonth) return false;
      }
      return true;
      
    }).forEach(item => {
      if (!stats[item.judge]) {
         stats[item.judge] = { tongAn: 0, biKhangCao: 0, biHuy: 0, biSua: 0 };
      }
      stats[item.judge].tongAn += 1;
      if (item.isKhangCao) stats[item.judge].biKhangCao += 1;
      if (item.ketQuaPhucTham === "Hủy bản án" && item.loiChuQuan) stats[item.judge].biHuy += 1;
      if (item.ketQuaPhucTham === "Sửa bản án" && item.loiChuQuan) stats[item.judge].biSua += 1;
    });
    
    return Object.keys(stats).map(judge => ({
       name: judge, ...stats[judge]
    })).sort((a,b) => b.biHuy - a.biHuy || b.biSua - a.biSua || b.tongAn - a.tongAn);
  }, [schedule, reportMonth]);
  // =========================================================
  // THUẬT TOÁN TÍNH MA TRẬN TẢI TRỌNG THẨM PHÁN
  // =========================================================
  const bangMaTranPhanAn = useMemo(() => {
    const dsLoaiAn = ["Hình sự", "Dân sự", "Hành chính", "Hôn nhân & GĐ", "Kinh tế", "Lao động", "Cai nghiện"];
    const stats = {};

    // 1. Khởi tạo bộ đếm bằng Số án gốc cấu hình
    listJudges.forEach(judge => {
      stats[judge.name] = {};
      dsLoaiAn.forEach(type => {
        stats[judge.name][type] = judge.tonCuChiTiet && judge.tonCuChiTiet[type] ? parseInt(judge.tonCuChiTiet[type]) : 0;
      });
    });

    // 2. CHỈ CỘNG THÊM NHỮNG ÁN MỚI PHÂN (Chưa được Thư ký lên lịch)
    // Thêm điều kiện !item.datetime để loại bỏ các án đã nằm trên Lịch Xét Xử
    schedule.forEach(item => {
      if (item.status === 'pending' && !item.datetime && item.judge && stats[item.judge]) {
        let type = item.caseType === "cainghien" ? "Cai nghiện" : item.caseType;
        
        if (stats[item.judge][type] !== undefined) {
          stats[item.judge][type] += 1;
        }
      }
    });

    return { dsLoaiAn, stats };
  }, [schedule, listJudges]);
  const completedByMonth = useMemo(() => {
    const stats = {};
    schedule
      .filter(i => i.status === 'completed' && i.datetime)
      .forEach(item => {
        const monthStr = moment(item.datetime).format("MM/YYYY");
        if (!stats[monthStr]) stats[monthStr] = [];
        stats[monthStr].push(item);
      });
    
    return Object.keys(stats)
      .map(month => ({ month, cases: stats[month], count: stats[month].length }))
      .sort((a, b) => moment(b.month, "MM/YYYY").valueOf() - moment(a.month, "MM/YYYY").valueOf());
  }, [schedule]);

  const urgentCount = schedule.filter(i => i.status === 'pending' && isUrgent(i.datetime)).length;
  const overduePublishCount = schedule.filter(i => isOverduePublish(i)).length;
  const effectiveCount = schedule.filter(i => isEffective(i)).length;
  const pendingCases = schedule.filter(i => i.status === 'pending');

  const caseTypeStats = {}; schedule.forEach(i => { if(i.caseType) caseTypeStats[i.caseType] = (caseTypeStats[i.caseType] || 0) + 1 });
  const caseTypeData = Object.keys(caseTypeStats).map(key => ({ name: key, value: caseTypeStats[key] }));
  const judgeStats = {}; pendingCases.forEach(i => { if(i.judge) judgeStats[i.judge] = (judgeStats[i.judge] || 0) + 1 });
  const judgeDataList = Object.keys(judgeStats).map(key => ({ name: key, value: judgeStats[key] })).sort((a,b) => b.value - a.value); 
  const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

  const handleExportClick = async () => {
    // 1. GIỮ NGUYÊN KIỂM TRA DỮ LIỆU CỦA NÍ
    if (schedule.length === 0) return showToast("Không có dữ liệu hệ thống!", "error");

    // 2. KHÚC THÊM MỚI: PHÂN QUYỀN VÀ HỎI TRƯỚC KHI MỞ MODAL
    if (userRole === "admin" || canEdit) {
      const xacNhanChotSoLieu = window.confirm(
        "📊 BẠN CÓ MUỐN CHỐT SỐ LIỆU KHÔNG?\n\n" +
        "👉 Bấm [OK]: Đánh dấu các hồ sơ này là 'Đã báo cáo' vào hệ thống và mở bảng xuất file.\n" +
        "👉 Bấm [Cancel / Hủy]: Chỉ mở bảng tải file Excel để xem, KHÔNG thay đổi hệ thống."
      );

      // Nếu Cán bộ thống kê bấm OK -> Chạy vòng lặp dán nhãn Firebase
      if (xacNhanChotSoLieu) {
        try {
          const updatePromises = processedSchedule.map(item => {
             const docRef = doc(db, "schedule", item.id);
             return updateDoc(docRef, { isExported: true });
          });
          
          await Promise.all(updatePromises); // Đợi lưu xong hết
          showToast("✅ Đã chốt số liệu và đánh dấu hệ thống thành công!", "success");
          
        } catch (error) {
          console.error("Lỗi khi chốt số liệu:", error);
          showToast("❌ Có lỗi xảy ra khi cập nhật trạng thái lên máy chủ!", "error");
        }
      }
    }

    // 3. GIỮ NGUYÊN LỆNH MỞ BẢNG XUẤT FILE CỦA NÍ (Dù bấm OK hay Hủy thì vẫn mở bảng cho tải file)
    setShowExportModal(true); 
  };

  const executeExport = async () => {
    let dataToExport = [...schedule]; 
    
    if (exportStart || exportEnd) {
      dataToExport = dataToExport.filter(i => {
        const targetDate = exportFilterType === 'createdAt' ? i.createdAt : i.datetime;
        if (!targetDate) return false;
        
        const dateStr = targetDate.includes('T') ? targetDate.split('T')[0] : targetDate;
        const itemTime = moment(dateStr).startOf('day').valueOf();
        
        const start = exportStart ? moment(exportStart).startOf('day').valueOf() : 0;
        const end = exportEnd ? moment(exportEnd).startOf('day').valueOf() : Infinity;
        return itemTime >= start && itemTime <= end;
      });
    }

    if (exportUnexportedOnly) {
      dataToExport = dataToExport.filter(i => !i.daXuatExcel);
    }
    
    dataToExport.sort((a, b) => {
      const dateA = exportFilterType === 'createdAt' ? a.createdAt : a.datetime;
      const dateB = exportFilterType === 'createdAt' ? b.createdAt : b.datetime;
      return new Date(dateA || 0).getTime() - new Date(dateB || 0).getTime();
    });

    if (dataToExport.length === 0) {
      return showToast("Không có vụ án nào (hoặc các vụ trong kỳ này đều đã được xuất Excel từ trước)!", "error");
    }

    // --- ĐOẠN VẼ BẢNG EXCEL (VIỀN MẢNH .5pt) CỦA NÍ ---
    let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8" /><style>table { border-collapse: collapse; width: 100%; font-family: 'Times New Roman', Times, serif; font-size: 13pt; } td, th { border: .5pt solid windowtext; padding: 8px; vertical-align: top; } .no-border { border: none !important; } .text-center { text-align: center; vertical-align: middle; } .font-bold { font-weight: bold; }</style></head><body><table><tr><td colspan="2" class="no-border text-center font-bold">TÒA ÁN NHÂN DÂN<br/>KHU VỰC 9 - CẦN THƠ</td><td colspan="5" class="no-border text-center font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập - Tự do - Hạnh Phúc</td></tr><tr><td colspan="7" class="no-border text-center"><i>Cần Thơ, ngày ${moment().format("DD")} tháng ${moment().format("MM")} năm ${moment().format("YYYY")}</i></td></tr><tr><td colspan="7" class="no-border"></td></tr><tr><td colspan="7" class="no-border text-center font-bold" style="font-size: 16pt;">DANH SÁCH LỊCH XÉT XỬ</td></tr><tr><td colspan="7" class="no-border text-center font-bold" style="font-size: 12pt; color: #666;">(${exportFilterType === 'createdAt' ? 'Tiêu chí: Trích xuất theo ngày nhập hệ thống' : 'Tiêu chí: Trích xuất theo ngày xét xử'}<br/>Từ ngày: ${exportStart ? moment(exportStart).format("DD/MM/YYYY") : "..."} - Đến ngày: ${exportEnd ? moment(exportEnd).format("DD/MM/YYYY") : "..."})</td></tr><tr><td colspan="7" class="no-border"></td></tr><tr><th class="text-center font-bold" style="background-color: #f2f2f2; width: 50px;">STT</th><th class="text-center font-bold" style="background-color: #f2f2f2; width: 350px;">NỘI DUNG VỤ ÁN</th><th class="text-center font-bold" style="background-color: #f2f2f2; width: 150px;">NGÀY XÉT XỬ</th><th class="text-center font-bold" style="background-color: #f2f2f2; width: 220px;">CHỦ TỌA, THƯ KÝ, KSV</th><th class="text-center font-bold" style="background-color: #f2f2f2; width: 220px;">HỘI THẨM NHÂN DÂN</th><th class="text-center font-bold" style="background-color: #f2f2f2; width: 120px;">PHÒNG XỬ</th><th class="text-center font-bold" style="background-color: #f2f2f2; width: 120px;">NGƯỜI NHẬP</th></tr>`;
    
    dataToExport.forEach((item, index) => {
      let noidung = "";
      if (item.caseType?.includes("Hình sự")) {
        noidung = `<b>${item.caseName || ""}</b><br/>Bị cáo: ${item.defendant || "---"}<br/>Bị hại/NLQ: ${item.plaintiff || "---"}`;
      } else if (item.caseType === "cainghien" || item.caseType?.includes("Cai nghiện") || item.caseType?.includes("Hành chính")) {
        noidung = `<b>${item.caseName || ""}</b><br/>CQ Đề nghị: ${item.plaintiff || "---"}<br/>Người bị ĐN: ${item.defendant || "---"}`;
      } else {
        noidung = `<b>${item.caseName || ""}</b><br/>NĐ: ${item.plaintiff || "---"}<br/>BĐ: ${item.defendant || "---"}`;
      }
        
      const thoigian = item.datetime 
        ? `${moment(item.datetime).format("HH")} giờ ${moment(item.datetime).format("mm")} phút<br/>Ngày ${moment(item.datetime).format("DD/MM/YYYY")}`
        : `<span style="color: #b45309; font-weight: bold; font-style: italic;">Chờ xếp lịch lại</span>`;
      
      tableHtml += `<tr><td class="text-center">${index + 1}</td><td>${noidung}</td><td class="text-center">${thoigian}</td><td>TP: ${item.judge || ""}<br/>TK: ${item.clerk || ""}<br/>KSV: ${item.prosecutor || ""}</td><td>${item.juror1 || ""}<br/>${item.juror2 || ""}</td><td class="text-center font-bold">${item.room || ""}</td><td class="text-center">${item.createdBy ? item.createdBy.split('@')[0] : ""}</td></tr>`;
    });
    
    tableHtml += `</table></body></html>`;
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `Bao_Cao_Lich_Xet_Xu_${exportStart ? moment(exportStart).format("DD_MM_YYYY") : "ToanBo"}.xls`;
    link.click();

    // 💡 SAU KHI TẢI FILE XONG -> CHẠY VÒNG LẶP LƯU LẠI VẾT "ĐÃ XUẤT" LÊN FIREBASE
    try {
       const { doc, updateDoc } = await import('firebase/firestore');
       for (let item of dataToExport) {
          if (!item.daXuatExcel) {
             await updateDoc(doc(db, "schedule", item.id), {
                daXuatExcel: true,
                ngayXuatExcel: moment().toISOString()
             });
          }
       }
    } catch(e) {
       console.error("Lỗi đánh dấu đã xuất:", e);
    }
    
    setShowExportModal(false); 
    showToast(`Đã xuất báo cáo ${dataToExport.length} vụ và đánh dấu vào hệ thống!`, "success");
  };

  const calendarEvents = useMemo(() => {
    return schedule.filter(i => i.datetime && i.status !== 'suspended').map(i => ({ 
      ...i, title: `${i.status === 'completed' ? '✅ ' : ''}[${i.room}] ${i.caseName || 'Chưa có tên'}`, start: new Date(i.datetime), end: new Date(new Date(i.datetime).getTime() + (i.duration || 60) * 60000) 
    }));
  }, [schedule]);
 const CourtPortal = () => {
  // =========================================================
  // 1. PHẦN MẶT TIỀN: CHUYÊN TRANG LỊCH XÉT XỬ TRỰC TUYẾN
  // =========================================================
  return (
    <div className="animate-fadeIn pb-20 max-w-7xl mx-auto px-4 py-2 bg-transparent">
      <div className="space-y-6">
        
        {/* THANH HIỂN THỊ LIÊN KẾT NHANH */}
        {quickLinks && quickLinks.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-wrap gap-3 items-center shadow-sm">
            <span className="text-xs font-black text-amber-800 uppercase tracking-wider mr-2">🔗 Liên kết nhanh:</span>
            {quickLinks.map(link => (
              <a 
                key={link.id} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors"
              >
                {link.title}
              </a>
            ))}
          </div>
        )}
{/* ============================================================== */}
      {/* 1. 🔍 CỔNG TRA CỨU (FULL-WIDTH TRÀN VIỀN ĐỒNG BỘ 100%) */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 md:p-6 mb-6 w-full">
        
        <h2 className="text-xl font-black text-gray-800 uppercase mb-1">🔍 Tra cứu Lịch Xét Xử & Hòa Giải</h2>
        <p className="text-sm text-gray-500 italic mb-5">Dành cho Đương sự, Người tham gia tố tụng và Luật sư</p>
        
        {/* Thanh Search liền khối kéo dài 100% */}
        <div className="flex shadow-sm rounded-xl overflow-hidden border-2 border-gray-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all w-full">
          <input 
            type="text" 
            placeholder="Nhập tên Đương sự, số thụ lý hoặc tên vụ án..." 
            className="flex-1 px-5 py-3.5 outline-none font-bold text-gray-700 text-sm md:text-base"
            value={tuKhoa}
            onChange={(e) => setTuKhoa(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tuKhoa.trim().length > 2) {
                const res = schedule.filter(i => 
                  (i.plaintiff && i.plaintiff.toLowerCase().includes(tuKhoa.toLowerCase())) ||
                  (i.defendant && i.defendant.toLowerCase().includes(tuKhoa.toLowerCase())) ||
                  (i.caseName && i.caseName.toLowerCase().includes(tuKhoa.toLowerCase()))
                );
                setKetQuaTraCuu(res);
              }
            }}
          />
          <button 
            onClick={() => {
               if(tuKhoa.trim().length < 2) return showToast("Vui lòng nhập ít nhất 2 ký tự!", "error");
               const res = schedule.filter(i => 
                  (i.plaintiff && i.plaintiff.toLowerCase().includes(tuKhoa.toLowerCase())) ||
                  (i.defendant && i.defendant.toLowerCase().includes(tuKhoa.toLowerCase())) ||
                  (i.caseName && i.caseName.toLowerCase().includes(tuKhoa.toLowerCase()))
                );
                setKetQuaTraCuu(res);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 md:px-16 py-3.5 font-black text-sm uppercase tracking-wider transition-colors whitespace-nowrap"
          >
            TÌM KIẾM
          </button>
        </div>

        {/* HIỂN THỊ KẾT QUẢ CỦA CỔNG TRA CỨU */}
        {ketQuaTraCuu !== null && (
          <div className="mt-6 border-t border-dashed border-gray-200 pt-6">
            <h3 className="font-bold text-gray-600 mb-4 text-sm">Tìm thấy <span className="text-blue-600 text-xl">{ketQuaTraCuu.length}</span> kết quả phù hợp:</h3>
            
            {ketQuaTraCuu.length === 0 ? (
              <div className="bg-orange-50 text-orange-700 p-4 rounded-xl text-center font-bold text-sm border border-orange-100">
                Không tìm thấy lịch xét xử nào khớp với từ khóa "{tuKhoa}". Vui lòng kiểm tra lại.
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {ketQuaTraCuu.map((item, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-all shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                       <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-1 uppercase rounded tracking-wider">
                         {item.caseType || "Vụ việc"}
                       </span>
                       {item.datetime ? (
                         <span className="text-green-700 font-black text-xs flex items-center gap-1 bg-green-100 px-3 py-1 rounded-full">
                           ⏰ {moment(item.datetime).format("HH:mm - DD/MM/YYYY")}
                         </span>
                       ) : (
                         <span className="text-orange-600 font-bold text-xs italic">Đang chờ xếp lịch</span>
                       )}
                    </div>
                    
                    <h4 className="font-bold text-gray-800 text-base mb-3 leading-tight">{item.caseName}</h4>

                    <div className="flex flex-col gap-1 mb-4 text-[13px] text-gray-700">
  {item.plaintiff && (
    <div className="flex items-start">
      <span className="font-bold w-[70px] flex-shrink-0">NĐ/Bị hại:</span>
      <span className="uppercase">{item.plaintiff}</span>
    </div>
  )}
  {item.defendant && (
    <div className="flex items-start">
      <span className="font-bold w-[70px] flex-shrink-0">BĐ/Bị cáo:</span>
      <span className="uppercase">{item.defendant}</span>
    </div>
  )}
</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-2">
                       <div className="bg-white p-2.5 rounded-lg border border-gray-100 col-span-2">
                         <span className="text-gray-400 text-[10px] font-bold uppercase block mb-1">Thẩm phán</span>
                         <span className="font-semibold text-gray-700">{item.judge || "Chưa phân công"}</span>
                       </div>
                       <div className="bg-white p-2.5 rounded-lg border border-gray-100 col-span-2">
                         <span className="text-gray-400 text-[10px] font-bold uppercase block mb-1">Phòng xử / Chi nhánh</span>
                         <span className="font-bold text-blue-900">{item.room || "Chưa xác định"}</span>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. BẢNG LỊCH XÉT XỬ MẶC ĐỊNH CHO NGƯỜI DÂN (ĐOẠN CODE CỦA NÍ) */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 overflow-hidden">
         <div className="flex justify-between items-center mb-4 pb-2 border-b">
           <h2 className="font-black text-blue-900 text-lg uppercase flex items-center gap-2">
             <span className="text-2xl">📅</span> Danh sách vụ án xét xử
           </h2>
           
           {/* BỘ LỌC TÌM KIẾM CHO NGƯỜI DÂN */}
           <div className="flex gap-2">
              <input type="text" placeholder="Tìm tên đương sự..." onChange={e => setSearchQuery(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-xs outline-none focus:border-blue-500 min-w-[150px]" />
           </div>
         </div>

           {/* BẢNG HIỂN THỊ DỮ LIỆU ÁN */}
           <div className="overflow-x-auto bg-gray-50/50 rounded-lg custom-scrollbar">
              <table className="w-full border-collapse table-fixed min-w-[900px] border border-gray-300 text-[11px]">
                <thead className="bg-gray-100 text-[11px] font-black uppercase text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-2 border border-gray-300 w-[15%] text-center">Thời gian</th>
                    <th className="px-2 py-2 border border-gray-300 w-[45%] text-left">Nội dung Vụ án</th>
                    <th className="px-2 py-2 border border-gray-300 w-[20%] text-left">Hội đồng Xét xử</th>
                    <th className="px-2 py-2 border border-gray-300 w-[20%] text-center">Phòng / Tình trạng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {processedSchedule
                     .filter(i => i.status !== 'completed' && i.status !== 'suspended') // Chỉ hiện án đang chờ xử
                     .map((item, index) => {
                      const isRowUrgent = isUrgent(item.datetime);
                      return (
                        <tr key={item.id} className="hover:bg-blue-50/30 transition-all">
                          {/* CỘT 1: THỜI GIAN */}
                          <td className="px-2 py-2 border border-gray-300 text-center">
                            <div className="font-bold text-[12px] text-gray-900">{item.datetime ? moment(item.datetime).format("DD/MM/YYYY") : "---"}</div>
                            <div className={`font-black mt-0.5 text-[11px] ${isRowUrgent ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>
                               🕒 {item.datetime ? moment(item.datetime).format("HH:mm") : "---"}
                            </div>
                          </td>

                          {/* CỘT 2: NỘI DUNG VỤ ÁN */}
                          <td className="px-2 py-2 border border-gray-300 text-left">
                            <div className="font-bold uppercase text-blue-900 text-[12px] mb-1.5 leading-tight line-clamp-2">
                              {item.caseName || "Vụ án chưa có tên"}
                            </div>
                            <div className="text-gray-500 font-bold text-[11px]">
                               {item.caseType?.includes("Hình sự") ? (
  <div className="space-y-1">
    <p><span className="text-red-600 uppercase text-[9px]">Bị cáo:</span> <span className="font-bold text-gray-800">{item.defendant || "---"}</span></p>
    <p><span className="text-gray-500 uppercase text-[9px]">Bị hại / NLQ:</span> <span className="font-bold text-gray-800">{item.plaintiff || "---"}</span></p>
  </div>
) : (item.caseType === "cainghien" || item.caseType?.includes("Cai nghiện") || item.caseType?.includes("Hành chính")) ? (
  <div className="flex gap-4">
    <p><span className="text-teal-600 uppercase text-[9px]">CQ ĐN:</span> <span className="font-bold text-gray-800">{item.plaintiff || "---"}</span></p>
    <p><span className="text-teal-600 uppercase text-[9px]">Người bị ĐN:</span> <span className="font-bold text-gray-800">{item.defendant || "---"}</span></p>
  </div>
) : (
  <div className="flex gap-4">
    <p><span className="text-gray-500 uppercase text-[9px]">NĐ:</span> <span className="font-bold text-gray-800">{item.plaintiff || "---"}</span></p>
    <p><span className="text-gray-500 uppercase text-[9px]">BĐ:</span> <span className="font-bold text-gray-800">{item.defendant || "---"}</span></p>
  </div>
)}
                            </div>
                          </td>

                          {/* CỘT 3: HỘI ĐỒNG XÉT XỬ */}
                          <td className="px-2 py-2 border border-gray-300 text-left space-y-1">
                            <div className="flex items-center gap-1"><span className="text-red-600 font-bold text-[10px]">TP:</span> <span className="text-[11px] font-bold text-gray-800 uppercase">{item.judge || "---"}</span></div>
                            <div className="flex items-center gap-1"><span className="text-gray-500 font-bold text-[10px]">TK:</span> <span className="text-[11px] font-bold text-gray-800">{item.clerk || "---"}</span></div>
                            <div className="flex items-center gap-1"><span className="text-red-400 font-bold text-[10px]">KSV:</span> <span className="text-[11px] font-bold text-red-700">{item.prosecutor || "---"}</span></div>
                          </td>

                          {/* CỘT 4: PHÒNG / TÌNH TRẠNG */}
                          <td className="px-2 py-2 border border-gray-300 text-center">
                            <div className="font-black text-gray-800 uppercase text-[11px] mb-1.5">{item.room || "---"}</div>
                            {isRowUrgent ? (
                              <span className="bg-red-600 text-white text-[9px] px-2 py-1 rounded font-black uppercase animate-pulse shadow-sm">SẮP XỬ</span>
                            ) : (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-black text-[9px] uppercase">Đã lên lịch</span>
                            )}
                          </td>
                        </tr>
                      );
                  })}
                </tbody>
              </table>
              
              {processedSchedule.filter(i => i.status !== 'completed' && i.status !== 'suspended').length === 0 && (
                 <div className="text-center py-10 text-gray-400 font-bold italic">Hiện chưa có lịch xét xử nào sắp diễn ra</div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
  }
  
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-950 font-sans">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
        <img 
          src="/lgtoaan1.png" 
          alt="Loading..." 
          className="w-24 h-24 relative z-10 animate-bounce" 
          style={{ animationDuration: '2s' }}
        />
      </div>

      <div className="text-center">
        <h2 className="text-white font-black text-xl uppercase tracking-[0.3em] mb-2 animate-pulse">
          Hệ Thống Đang Khởi Chạy
        </h2>
        <div className="w-48 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-blue-500 animate-loading-bar"></div>
        </div>
        <p className="text-blue-400 text-[10px] font-bold mt-4 uppercase tracking-widest opacity-60">
          Vui lòng đợi trong giây lát...
        </p>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes loading-bar {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 100%; transform: translateX(0); }
          100% { width: 0%; transform: translateX(100%); }
        }
        .animate-loading-bar {
          animation: loading-bar 2s infinite ease-in-out;
        }
      `}} />
    </div>
  );

  const isScanningQR = typeof window !== 'undefined' && window.location.search.includes('mode=tv');
  // =========================================================
  // 🛡️ MA TRẬN PHÂN QUYỀN (ROLE-BASED ACCESS CONTROL)
  // =========================================================
  const isChanHan = userRoles.includes("chanhan");
  const isAdmin = userRoles.includes("admin");
  const isThamPhan = userRoles.includes("tham_phan");
  const isThuKy = userRoles.includes("thu_ky");

  // Định nghĩa các nút thắt hành động
  const canEditSchedule = isAdmin || isChanHan || isThuKy; // Quản lý lịch
  const canAssignCases = isAdmin || isChanHan || isThuKy; // Cho phép Thư ký, Chánh án, Admin thấy tab Phân án
  const canManagePortal = isAdmin || isChanHan; // Đăng tin tức, văn bản pháp luật
  const canManageUsers = isAdmin; // Phân quyền cán bộ, cấu hình hệ thống
  const canViewReports = isAdmin || isChanHan || isThamPhan || isThuKy; // Xem thống kê
  
  const canEdit = canEditSchedule; // Khai báo thêm dòng này để tránh lỗi canEdit is not defined
  // =========================================================
  // HÀM TÍNH TOÁN THỐNG KÊ ÁN ĐÃ PHÂN CÔNG
const thongKeLoaiAn = schedule.reduce((acc, item) => {
    if (item.judge && item.judge !== "---" && item.judge !== "") {
      // Lấy ngày phân án (ưu tiên ngày tạo, nếu không có lấy ngày cập nhật)
      const itemMonth = moment(item.createdAt || item.updatedAt || new Date()).format('YYYY-MM');
      
      // Chỉ đếm những vụ nằm trong tháng được chọn (hoặc nếu chọn 'all' thì đếm hết)
      if (statMonth === "all" || itemMonth === statMonth) {
        const loai = item.caseType || 'Chưa xác định';
        acc[loai] = (acc[loai] || 0) + 1;
        acc.tongSo = (acc.tongSo || 0) + 1;
      }
    }
    return acc;
  }, { tongSo: 0 });

  const danhSachCacLoaiAn = ['Hình sự', 'Dân sự', 'Hành chính', 'Hôn nhân & GĐ', 'Kinh tế', 'Lao động', 'Cai nghiện'];
  const myCases = schedule.filter(item => 
    item.judge === userFullName || item.clerk === userFullName || item.createdBy === user?.email
  );

  const myPendingCases = myCases.filter(item => item.status === 'pending' || !item.datetime);
  
  const myUpcomingTrials = myCases.filter(item => item.datetime && item.status !== 'completed' && item.status !== 'done')
                                  .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
                                  .slice(0, 5);
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
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@100;300;400;700&display=swap');

  body {
    font-family: 'Be Vietnam Pro', sans-serif !important;
  }

  .font-thin-strong {
    font-weight: 100;
    text-transform: uppercase;
    letter-spacing: 0.2em; 
    color: #1e293b;
  }

  .btn-delete-thin {
    transition: all 0.3s ease;
    border: 1px solid transparent;
    color: #94a3b8;
  }

  .btn-delete-thin:hover {
    color: #ef4444;
    background: #fef2f2;
    border-radius: 99px;
  }
      `}} />

      <aside 
        // 💡 Nền trong mờ (Glassmorphism): dùng backdrop-blur và bg-white/80
        className={`bg-white/80 backdrop-blur-md border-r border-slate-200 text-slate-700 flex flex-col h-screen fixed z-20 overflow-y-auto transition-all duration-300 ease-in-out ${
          user ? 'xl:flex' : 'hidden'
        } ${isCollapsed ? 'w-[70px]' : 'w-64'}`}
        style={{ fontFamily: "'Be Vietnam Pro', sans-serif", boxShadow: '2px 0 20px rgba(0,0,0,0.05)' }}
      >
        
        {/* ======================================= */}
        {/* LOGO & NÚT THU GỌN (ĐÃ THAY 3 GẠCH BẰNG LOGO) */}
        {/* ======================================= */}
        <div className="flex items-center justify-between h-24 px-4 border-b border-red-800 bg-red-700 sticky top-0 z-30">
          {!isCollapsed && (
            <div className="flex items-center gap-3 overflow-hidden">
              <img src="/lgtoaan1.png" alt="Logo" className="w-10 h-10 flex-shrink-0 drop-shadow-md" />
              <div className="flex flex-col">
                 <span className="font-bold text-yellow-100 text-[11px] uppercase tracking-widest">Tòa Án Nhân Dân</span>
                 <span className="font-black text-yellow-400 text-[13px] uppercase tracking-wider truncate">KV9-Cần Thơ</span>
              </div>
            </div>
          )}
          
          {/* Nút bấm để Thu/Mở Sidebar */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`p-2 hover:bg-red-800 rounded-lg text-red-100 transition-colors flex-shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}
            title={isCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
          >
            {isCollapsed ? (
              /* KHI THU GỌN: Hiện Logo Tòa án thay cho 3 gạch */
              <img src="/lgtoaan1.png" alt="Logo" className="w-8 h-8 drop-shadow-md hover:scale-110 transition-transform" />
            ) : (
              /* KHI MỞ RỘNG: Hiện dấu 3 gạch (Hoặc Ní có thể đổi thành mũi tên ◀) */
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
        {/* ======================================= */}
        {/* DANH SÁCH MENU (CHỮ ĐẬM HƠN, RÕ HƠN) */}
        {/* ======================================= */}
        <div className="p-3 space-y-1 mt-2">
          {/* TRANG CHỦ */}
          <div onClick={() => setViewMode("portal")} className={`flex items-center px-3 py-3 rounded-lg cursor-pointer transition-colors ${viewMode === 'portal' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <span className="text-[17px]">🏠</span>{!isCollapsed && <span className="ml-3 text-[14px] font-bold">Trang chủ Portal</span>}
          </div>

          {/* LỊCH XÉT XỬ (ĐẬM HƠN) */}
          <div onClick={() => { setActiveTab("trial"); setViewMode("app"); }} className={`flex items-center px-3 py-3 rounded-lg cursor-pointer transition-colors ${activeTab === 'trial' ? 'bg-blue-50 text-blue-800 font-extrabold border-l-4 border-blue-600' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-semibold'}`}>
            <span className="text-[17px]">📅</span>{!isCollapsed && <span className="ml-3 text-[14px]">Lịch xét xử</span>}
          </div>

          {/* PHÂN ÁN */}
          {canAssignCases && (
            <div onClick={() => { setActiveTab("nhap_an"); setViewMode("app"); }} className={`flex items-center px-3 py-3 rounded-lg cursor-pointer transition-colors ${activeTab === 'nhap_an' ? 'bg-indigo-50 text-indigo-800 font-extrabold border-l-4 border-indigo-600' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-semibold'}`}>
              <span className="text-[17px]">🔄</span>{!isCollapsed && <span className="ml-3 text-[14px]">Phân án tự động</span>}
            </div>
          )}

          {/* LỊCH THẨM ĐỊNH (ĐẬM HƠN) */}
          {!isPublicView && (
            <div onClick={() => { setActiveTab("inspection"); setViewMode("app"); }} className={`flex items-center px-3 py-3 rounded-lg cursor-pointer transition-colors ${activeTab === 'inspection' ? 'bg-teal-50 text-teal-800 font-extrabold border-l-4 border-teal-600' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-semibold'}`}>
              <span className="text-[17px]">🌍</span>{!isCollapsed && <span className="ml-3 text-[14px]">Lịch thẩm định</span>}
            </div>
          )}

          {/* 💡 BỔ SUNG: BÁO CÁO */}
          {!isPublicView && (
            <div onClick={() => { setActiveTab("report"); setViewMode("app"); }} className={`flex items-center px-3 py-3 rounded-lg cursor-pointer transition-colors ${activeTab === 'report' ? 'bg-blue-50 text-blue-800 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
              <span className="text-[17px]">📊</span>{!isCollapsed && <span className="ml-3 text-[13px] font-medium">Báo cáo thống kê</span>}
            </div>
          )}

          {/* 💡 BỔ SUNG: QUẢN LÝ CÔNG VIỆC */}
          {!isPublicView && (
            <div onClick={() => { setActiveTab("tasks"); setViewMode("app"); }} className={`flex items-center px-3 py-3 rounded-lg cursor-pointer transition-colors ${activeTab === 'tasks' ? 'bg-blue-50 text-blue-800 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
              <span className="text-[17px]">📝</span>{!isCollapsed && <span className="ml-3 text-[13px] font-medium">Quản lý công việc</span>}
            </div>
          )}
        </div>

        {/* QUẢN TRỊ */}
        {canManageUsers && !isPublicView && (
          <div className="mt-4 pt-4 border-t border-slate-100 px-3">
            <div onClick={() => !isCollapsed && setIsSystemMenuOpen(!isSystemMenuOpen)} className="flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer text-slate-400 hover:bg-slate-50">
              <div className="flex items-center gap-3"><span className="text-[17px]">⚙️</span>{!isCollapsed && <span className="text-[11px] font-bold uppercase tracking-widest">Cấu hình chung</span>}</div>
            </div>
            {isSystemMenuOpen && !isCollapsed && (
              <div className="pl-9 mt-1 space-y-1">
                <div onClick={() => setActiveTab("roles")} className="px-3 py-2 text-[13px] text-slate-500 cursor-pointer hover:text-blue-700">Phân Quyền</div>
                <div onClick={() => setActiveTab("config_judges")} className="px-3 py-2 text-[13px] text-slate-500 cursor-pointer hover:text-blue-700">Thẩm phán</div>
                <div onClick={() => setActiveTab("logs")} className="px-3 py-2 text-[13px] text-slate-500 cursor-pointer hover:text-blue-700">Nhật ký thao tác</div>
              </div> 
            )}
          </div>
        )}
        {/* ========================================================= */}
        {/* KHU VỰC THÔNG TIN TÀI KHOẢN & ĐĂNG XUẤT (DƯỚI CÙNG MENU) */}
        {/* ========================================================= */}
        {user && (
          <div className="mt-auto border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex items-center gap-3 mb-3">
              {/* Cục Avatar tự lấy chữ cái đầu của tên hoặc email */}
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-md">
                {userFullName ? userFullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              
              {/* Thông tin tên và email */}
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-black text-gray-800 truncate" title={userFullName || "Cán bộ Tòa án"}>
                  {userFullName || "Cán bộ Tòa án"}
                </p>
                <p className="text-xs text-gray-500 font-medium truncate" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>

            {/* Nút Đăng Xuất */}
            <button
              onClick={() => {
                if (window.confirm("👋 Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?")) {
                  signOut(auth).then(() => {
                    showToast("Đã đăng xuất thành công!", "success");
                    // Chuyển view về trang public hoặc reset state tùy logic của Ní
                    setIsPublicView(true); 
                  }).catch((error) => {
                    showToast("Lỗi đăng xuất: " + error.message, "error");
                  });
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 hover:bg-red-600 hover:text-white transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              ĐĂNG XUẤT
            </button>
          </div>
        )}
      </aside>

      <main className={`${user ? (isCollapsed ? 'xl:ml-[70px]' : 'xl:ml-64') : ''} transition-all duration-300 ease-in-out flex flex-col h-screen relative z-10 flex-1 w-full overflow-hidden bg-slate-50`}>
        
        {/* ============================================================== */}
        {/* 1. HEADER (Đứng im cứng ngắc bằng flex-shrink-0) */}
        {/* ============================================================== */}
        <header className="flex-shrink-0 bg-red-700 h-24 shadow-md flex items-center justify-between px-4 md:px-8 xl:px-12 border-b border-red-800 w-full z-30 relative">
          <div className="flex-1 flex justify-start items-center gap-2">
            {!user ? (
              <button onClick={() => setShowLoginModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-[10px] md:text-xs font-black uppercase shadow-md rounded-lg transition-all">
                🔑 Đăng nhập Cán bộ
              </button>
            ) : (
              <div className="flex xl:hidden gap-2">
                <button onClick={() => setShowPwdModal(true)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 text-[10px] font-black uppercase shadow-sm border border-white/30 rounded-md backdrop-blur-sm transition-all">🔑 MK</button>
                <button onClick={handleLogout} className="bg-black/20 hover:bg-black/30 text-white border border-black/30 px-3 py-2 text-[10px] font-black uppercase shadow-sm rounded-md backdrop-blur-sm transition-all">🚪 THOÁT</button>
              </div>
            )}
            {!user && viewMode !== 'portal' && (
               <button onClick={() => setViewMode('portal')} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-[10px] md:text-xs font-black uppercase shadow-md rounded-lg transition-all ml-1">
                 🏠 TRANG CHỦ
               </button>
            )}
          </div>

          <div className="flex-[2] text-center px-2 flex justify-center">
            <h1 className="font-black text-[14px] sm:text-[16px] md:text-xl xl:text-2xl uppercase text-yellow-300 truncate tracking-widest drop-shadow-md">
              HỆ THỐNG QUẢN LÝ LỊCH TRỰC TUYẾN
            </h1>
          </div>

          <div className="flex-1 flex items-center justify-end">
            <div className="bg-yellow-400 text-red-800 px-3 py-2 md:px-6 md:py-3 font-black text-[10px] md:text-sm border border-yellow-500 uppercase tracking-widest text-center w-max rounded-lg shadow-md">
              Cần Thơ: {moment().format("DD/MM/YYYY")}
            </div>
            
          </div>
        </header>

        {/* ============================================================== */}
        {/* 2. DẢI BÁO CÁO CỐ ĐỊNH (ÉP 1 DÒNG TUYỆT ĐỐI - TRƯỢT NGANG NẾU HẸP) */}
        {/* ============================================================== */}
        {viewMode !== "portal" && activeTab === "trial" && (
          <div className="flex-shrink-0 w-full z-20 relative px-4 md:px-8 xl:px-12 pt-4 pb-2 bg-slate-50">
            {/* 💡 Flexbox trượt ngang: Ẩn thanh cuộn nhưng vẫn cho vuốt mượt mà */}
            <div className="flex flex-row gap-3 w-full overflow-x-auto hide-scrollbar pb-1">
              
              {/* min-w-[120px] giúp các thẻ không bị bóp méo quá đà khi màn hình nhỏ */}
              <div onClick={() => handleStatCardClick('pending')} className="flex-1 min-w-[120px] bg-white hover:bg-blue-50 cursor-pointer rounded-xl px-3 py-2 shadow-sm border border-gray-200 flex flex-col justify-between transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Chờ xử</span>
                  <span className="text-blue-500 text-sm">⏳</span>
                </div>
                <p className="text-xl font-black text-blue-600">{pendingCases.length}</p>
              </div>

              <div onClick={() => handleStatCardClick('urgent')} className="flex-1 min-w-[120px] bg-red-50 hover:bg-red-100 cursor-pointer rounded-xl px-3 py-2 shadow-sm border border-red-100 flex flex-col justify-between transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-red-700 uppercase tracking-wider whitespace-nowrap">Sắp xử</span>
                  <span className="text-red-500 text-sm">🔥</span>
                </div>
                <p className={`text-xl font-black text-red-600 ${urgentCount > 0 ? 'animate-pulse' : ''}`}>{urgentCount}</p>
              </div>

              <div onClick={() => handleStatCardClick('suspended')} className="flex-1 min-w-[120px] bg-amber-50 hover:bg-amber-100 cursor-pointer rounded-xl px-3 py-2 shadow-sm border border-amber-100 flex flex-col justify-between transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider whitespace-nowrap">Tạm ngừng</span>
                  <span className="text-amber-500 text-sm">⏸️</span>
                </div>
                <p className="text-xl font-black text-amber-600">{schedule.filter(i => i.status === 'suspended').length}</p>
              </div>

              <div onClick={() => handleStatCardClick('completed')} className="flex-1 min-w-[120px] bg-green-50 hover:bg-green-100 cursor-pointer rounded-xl px-3 py-2 shadow-sm border border-green-100 flex flex-col justify-between transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-green-700 uppercase tracking-wider whitespace-nowrap">Đã xong</span>
                  <span className="text-green-500 text-sm">✅</span>
                </div>
                <p className="text-xl font-black text-green-600">{schedule.filter(i => i.status === 'completed').length}</p>
              </div>

              <div onClick={() => handleStatCardClick('overdue_publish')} className="flex-1 min-w-[120px] bg-rose-50 hover:bg-rose-100 cursor-pointer rounded-xl px-3 py-2 shadow-sm border border-rose-100 flex flex-col justify-between transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider whitespace-nowrap">Chưa PH</span>
                  <span className="text-rose-500 text-sm">📜</span>
                </div>
                <p className="text-xl font-black text-rose-600">{overduePublishCount}</p>
              </div>

              <div onClick={() => handleStatCardClick('effective')} className="flex-1 min-w-[120px] bg-teal-50 hover:bg-teal-100 cursor-pointer rounded-xl px-3 py-2 shadow-sm border border-teal-100 flex flex-col justify-between transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-teal-700 uppercase tracking-wider whitespace-nowrap">Hiệu lực</span>
                  <span className="text-teal-500 text-sm">⚖️</span>
                </div>
                <p className="text-xl font-black text-teal-600">{effectiveCount}</p>
              </div>

              <div onClick={() => handleStatCardClick('all')} className="flex-1 min-w-[120px] bg-gray-100 hover:bg-gray-200 cursor-pointer rounded-xl px-3 py-2 shadow-sm border border-gray-200 flex flex-col justify-between transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider whitespace-nowrap">Tổng vụ</span>
                  <span className="text-gray-500 text-sm">📁</span>
                </div>
                <p className="text-xl font-black text-gray-700">{schedule.length}</p>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. KHU VỰC CUỘN ĐỘC LẬP TỰ ĐỘNG (Là 1 thẻ div bao bọc toàn bộ nội dung) */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto custom-scrollbar w-full relative z-0 p-4 md:p-8 pb-24">
          
          {/* --- CHỈ HIỆN PORTAL KHI VIEWMODE LÀ PORTAL --- */}
          {viewMode === "portal" ? (
            <>
              {readingLink ? (
                /* GIAO DIỆN ĐỌC TIN TẠI CHỖ */
                <div className="animate-fadeIn flex flex-col h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                  <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
                    <button onClick={() => setReadingLink(null)} className="bg-white border px-4 py-2 rounded-lg font-bold text-sm text-red-600 hover:bg-red-50 transition-all flex items-center gap-2">
                      ⬅️ TRỞ VỀ DANH SÁCH
                    </button>
                    <p className="text-xs font-bold text-gray-500 truncate max-w-md italic">Đang xem: {readingLink}</p>
                  </div>
                  <div className="flex-1 w-full bg-white">
                    <iframe src={readingLink} className="w-full h-full border-none" title="News Reader" 
                    />
                  </div>
                </div>
              ) : (
                    CourtPortal()
              )}
            </>
          ) : (
            /* --- NẾU KHÔNG PHẢI PORTAL THÌ HIỆN CÁC TAB NGHIỆP VỤ --- */
            <>
              {activeTab === "trial" && (
                <div className="animate-fadeIn">

          {user && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200 animate-fadeIn relative z-10 mb-8">
          <div className="flex items-center justify-center mb-8">
            <h2 className="text-xl md:text-2xl font-black text-blue-900 uppercase tracking-widest border-l-8 border-red-600 pl-4">
               ĐĂNG KÝ LỊCH XÉT XỬ
            </h2>
          </div>
              <div className="max-w-5xl mx-auto space-y-8">
              {/* THÀNH PHẦN CHỌN NHANH VỤ ÁN ĐÃ PHÂN CÔNG */}
<div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
  <label className="block text-xs font-black text-blue-900 uppercase mb-2">
    ⚡ Chọn nhanh vụ án đã phân công (Không cần gõ lại):
  </label>
  <select 
    onChange={(e) => handleSelectPendingCase(e.target.value)}
    className="w-full border border-blue-200 p-3 bg-white text-gray-800 font-bold rounded-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-sm"
  >
    <option value="">--- Chọn vụ án chờ lên lịch ---</option>
    {/* Lọc các vụ án trong database chưa có ngày giờ */}
    {schedule
      .filter(item => !item.datetime || item.status === 'cho_len_lich')
      .map(item => (
        <option key={item.id} value={item.id}>
          {item.caseName} ({item.plaintiff || item.defendant})
        </option>
      ))
    }
  </select>
</div>
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
    <select 
      value={form.room} 
      onChange={e => {
        const newRoom = e.target.value;
        let newDuration = form.duration;
        
        if (newRoom === "Dự phòng") {
          newDuration = 30;
        } else if (newRoom === "Trực tuyến") {
          newDuration = 240; 
          newDuration = form.caseType === 'Hình sự' ? 120 : 60;
        }
        
        setForm({...form, room: newRoom, duration: newDuration});
      }} 
      className={inputBase}
    >
      <option value="Trụ sở">🏢 TRỤ SỞ</option>
      <option value="Chi nhánh">🏢 CHI NHÁNH</option>
      <option value="Trực tuyến">💻 TRỰC TUYẾN (Mặc định 1 buổi)</option>
      <option value="Lưu động">🚚 LƯU ĐỘNG</option>
      <option value="Dự phòng">⚠️ DỰ PHÒNG (Mặc định 30p)</option>
    </select>
  </div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
  <div>
    <label className={labelStyle}>Loại án <span className="text-red-500">*</span></label>
    <select 
      value={form.caseType} 
      onChange={e => {
       const newType = e.target.value;
       let newDuration = 60; 
       
       if (newType === 'Hình sự') {
         newDuration = 120; 
       }
        if (form.room === "Dự phòng") newDuration = 30;
        if (form.room === "Trực tuyến") newDuration = 240;
        
        setForm({...form, caseType: newType, duration: newDuration});
      }} 
      className={inputBase}
    >
      <option value="Hình sự">Hình sự</option>
      <option value="Dân sự">Dân sự</option>
      <option value="Hành chính">Hành chính</option>
      <option value="Hôn nhân & GĐ">Hôn nhân & GĐ</option>
      <option value="Kinh tế">Kinh tế</option>
      <option value="Lao động">Lao động</option> {/* NÍ THÊM DÒNG NÀY VÀO ĐÂY */}
      <option value="cainghien">Cai nghiện bắt buộc</option>
    </select>
  </div>
  <div>
    <label className={labelStyle}>Thời lượng <span className="text-red-500">*</span></label>
    <select 
      value={form.duration} 
      onChange={e => setForm({...form, duration: parseInt(e.target.value)})} 
      className={inputBase}
    >
      <option value={30}>⏱ 30 phút (Xử nhanh / Dự phòng)</option>
      <option value={60}>⏱ 1 giờ (Bổ sung)</option>
      <option value={120}>⏱ 2 giờ (Án hình sự)</option>
      <option value={240}>⏱ 1 buổi (4 giờ / Trực tuyến)</option>
      <option value={480}>⏱ 1 ngày (8 giờ)</option>
    </select>
  </div>
                  <div>
                    <label className={labelStyle}>Lần xử <span className="text-red-500">*</span></label>
                    <select value={form.trialCount} onChange={e => setForm({...form, trialCount: e.target.value})} className={inputBase}><option value="Lần 1">Lần 1</option><option value="Lần 2">Lần 2</option><option value="Mở lại">Mở lại</option></select>
                  </div>
                </div>

                <div><label className={labelStyle}>Trích yếu vụ án <span className="text-red-500">*</span></label><textarea value={form.caseName} onChange={e => setForm({...form, caseName: e.target.value})} className={inputBase} rows="2" /></div>
                {/* ĐẢO VỊ TRÍ HIỂN THỊ BẰNG REACT (Đảm bảo 100% chạy mượt và chuẩn phím Tab) */}
{(form.caseType === 'Hình sự' || form.caseType === 'cainghien' || form.caseType?.includes('Cai nghiện') || form.caseType === 'Hành chính') ? (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
    {/* CỘT TRÁI: BỊ CÁO / NGƯỜI BỊ ĐỀ NGHỊ (Lưu vào defendant) */}
    <div>
      <label className={labelStyle}>{getLabelBenBi(form.caseType)}</label>
      <input 
        value={form.defendant} 
        onChange={e => setForm({...form, defendant: e.target.value})} 
        className={inputBase} 
        placeholder="Nhập thông tin..." 
      />
    </div>
    {/* CỘT PHẢI: BỊ HẠI / CƠ QUAN ĐỀ NGHỊ (Lưu vào plaintiff) */}
    <div>
      <label className={labelStyle}>{getLabelBenKien(form.caseType)}</label>
      <input 
        value={form.plaintiff} 
        onChange={e => setForm({...form, plaintiff: e.target.value})} 
        className={inputBase} 
        placeholder="Nhập thông tin..." 
      />
    </div>
  </div>
) : (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
    {/* CỘT TRÁI: NGUYÊN ĐƠN (Lưu vào plaintiff) */}
    <div>
      <label className={labelStyle}>{getLabelBenKien(form.caseType)}</label>
      <input 
        value={form.plaintiff} 
        onChange={e => setForm({...form, plaintiff: e.target.value})} 
        className={inputBase} 
        placeholder="Nhập thông tin..." 
      />
    </div>
    {/* CỘT PHẢI: BỊ ĐƠN (Lưu vào defendant) */}
    <div>
      <label className={labelStyle}>{getLabelBenBi(form.caseType)}</label>
      <input 
        value={form.defendant} 
        onChange={e => setForm({...form, defendant: e.target.value})} 
        className={inputBase} 
        placeholder="Nhập thông tin..." 
      />
    </div>
  </div>
)}
                <div className="pt-6 border-t-2 border-dashed border-gray-200 mt-8 bg-red-50 p-6 rounded-lg border border-red-200 shadow-inner">
                   <h3 className="text-[14px] font-medium text-white bg-red-600 border border-red-700 py-3 rounded-md mb-6 text-center uppercase shadow-md">Thành phần Hội đồng xét xử</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      <div><label className={judgeLabelStyle}>Thẩm phán</label><input list="judges-list" value={form.judge} onChange={e => setForm({...form, judge: e.target.value})} className={inputBase} /></div>
                      <div><label className={judgeLabelStyle}>Thư ký</label><input list="clerks-list" value={form.clerk} onChange={e => setForm({...form, clerk: e.target.value})} className={inputBase} /></div>
                      <div><label className={judgeLabelStyle}>Kiểm sát viên</label><input list="prosecutors-list" value={form.prosecutor} onChange={e => setForm({...form, prosecutor: e.target.value})} className={inputBase} /></div>
                      <div><label className={judgeLabelStyle}>Hội thẩm 1</label><input value={form.juror1} onChange={e => setForm({...form, juror1: e.target.value})} className={inputBase} /></div>
                      <div><label className={judgeLabelStyle}>Hội thẩm 2</label><input value={form.juror2} onChange={e => setForm({...form, juror2: e.target.value})} className={inputBase} /></div>
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
                   <h3 className="font-black uppercase text-xl md:text-2xl text-blue-950 flex items-center gap-4"><span className="w-1.5 h-8 bg-blue-950 rounded-full"></span>Sổ tổng hợp lịch </h3>
                   <div className="flex bg-gray-100 p-1.5 rounded-lg border border-gray-200 shadow-inner">
                     <button onClick={() => setDisplayMode('table')} className={`px-4 py-2 text-xs font-black uppercase rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500 hover:text-gray-800'}`}>Danh sách</button>
                     <button onClick={() => setDisplayMode('kanban')} className={`px-4 py-2 text-xs font-black uppercase rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white text-blue-700 shadow-md' : 'text-gray-500 hover:text-gray-800'}`}>Bảng Kéo Thả</button>
                   </div>
                </div>
                
                <div className="flex flex-col xl:flex-row flex-wrap gap-4 w-full items-center">
                  <div className="flex items-center gap-2 border border-gray-300 rounded-md px-3 py-2 bg-white w-full md:w-auto shadow-sm">
           {/* MENU CHỌN KIỂU LỌC */}
           <select 
             value={dateFilterType} 
             onChange={e => setDateFilterType(e.target.value)} 
             className="text-[11px] font-black text-blue-800 bg-blue-50 outline-none border border-blue-200 rounded py-1.5 px-2 cursor-pointer uppercase shadow-inner"
           >
             <option value="datetime">📅 Lọc Ngày Xử</option>
             <option value="createdAt">📥 Lọc Ngày Nhập</option>
           </select>

           <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none text-sm bg-transparent font-bold text-gray-700 ml-1" title="Từ ngày" />
           <span className="text-xs font-bold text-gray-300">-</span>
           <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none text-sm bg-transparent font-bold text-gray-700" title="Đến ngày" />
           
           {(startDate || endDate) && <button onClick={() => {setStartDate(""); setEndDate("")}} className="text-white bg-red-500 rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] ml-1 hover:bg-red-600 transition-all shadow-sm">✕</button>}
        </div>
                  <select value={judgeFilter} onChange={e => setJudgeFilter(e.target.value)} className={filterStyle}><option value="all">👨‍⚖️ Thẩm phán (Tất cả)</option>{judgesList.map(name => <option key={name} value={name}>{name}</option>)}</select>
                  <select value={clerkFilter} onChange={e => setClerkFilter(e.target.value)} className={filterStyle}><option value="all">📝 Thư ký (Tất cả)</option>{clerksList.map(name => <option key={name} value={name}>{name}</option>)}</select>
                  <select value={statusFilter} onChange={e => {setStatusFilter(e.target.value); setShowOnlyUrgent(false);}} className={filterStyle}>
                     <option value="all">📁 Tất cả Trạng thái</option>
                     <option value="pending">⏳ Đang chờ xử</option>
                     <option value="nghi_an">📁 Đang nghị án</option>
                     <option value="suspended">⏸ Tạm ngừng</option>
                     <option value="completed">✅ Đã xử xong</option>
                     <option value="has_appeal">📜 Án có Kháng cáo</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm font-bold text-red-600 bg-red-50 px-4 py-2.5 rounded-md border border-red-200 cursor-pointer">
                    <input type="checkbox" checked={showOnlyUrgent} onChange={e => setShowOnlyUrgent(e.target.checked)} className="w-4 h-4 accent-red-600" /> Sắp xử (24h)
                  </label>
                  <input type="text" placeholder="Tìm kiếm tự do..." onChange={e => setSearchQuery(e.target.value)} className={`${filterStyle} flex-1 min-w-[150px]`} />
                  <button onClick={handleExportClick} className="bg-green-600 text-white px-6 py-2.5 font-bold uppercase rounded-md shadow-sm hover:bg-green-700 text-[14px]">📊 Xuất Excel</button>
                  <button onClick={() => setShowTVMode(true)} className="bg-blue-900 text-white px-6 py-2.5 font-bold uppercase rounded-md shadow-sm hover:bg-black text-[14px]">📺 Chế độ Tivi</button>
                </div>
              </div>

             <div className="flex-1 overflow-x-auto bg-gray-50/50 rounded-b-xl custom-scrollbar">
  {displayMode === 'table' ? (
    <table className="w-full border-collapse table-fixed min-w-[1100px] border border-gray-300 text-[11px]">
      <thead className="bg-gray-100 text-[11px] font-black uppercase text-gray-500 sticky top-0 z-10 border-b border-gray-200">
        <tr>
          <th className="px-2 py-2 border border-gray-300 w-[15%] text-center">Lịch & Cập nhật</th>
          <th className="px-2 py-2 border border-gray-300 w-[45%] text-left">Nội dung & Cảnh báo</th>
          <th className="px-2 py-2 border border-gray-300 w-[25%] text-left">Thành phần HĐXX</th>
          {(canEdit || userRole === 'thamphan') && (
  <th className="px-2 py-2 border border-gray-300 w-[15%] text-center">Tác vụ</th>
)}
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-200 bg-white">
        {processedSchedule.map((item, index) => {
          const isRowUrgent = item.status === 'pending' && isUrgent(item.datetime);
          const isForgotten = item.status === 'pending' && 
                              moment(item.datetime).isBefore(moment().subtract(4, 'hours'));
          const overduePublish = isOverduePublish(item);
          const effective = isEffective(item);

          let rowBgClass = isForgotten ? "bg-orange-50 animate-pulse" : 
                           isRowUrgent ? "bg-red-50 hover:bg-red-100" : 
                           index % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-slate-50 hover:bg-blue-50/30";
          
          return (
            <tr key={item.id} className={`transition-all ${rowBgClass}`}>
              {/* CỘT 1: LỊCH & CẬP NHẬT */}
              <td className={`px-2 py-2 w-[15%] align-top text-center border-r border-gray-300 ${isRowUrgent ? 'border-l-4 border-l-red-500' : isForgotten ? 'border-l-4 border-l-orange-500' : ''}`}>
                {item.status === 'suspended' ? (
                  <div className="text-purple-600 font-bold uppercase text-[10px]">⏸ Tạm ngừng</div>
                  ) : item.status === 'dinh_chi' ? (  /* <--- THÊM DÒNG NÀY ---> */
                  <div className="text-red-600 font-bold uppercase text-[10px]">🛑 ĐÌNH CHỈ</div>
                ) : (
                  <>
                    <div className="font-bold text-[12px] text-gray-900">{item.datetime ? moment(item.datetime).format("DD/MM/YYYY") : "---"}</div>
                    <div className="text-blue-600 font-bold mt-0.5 text-[11px]">🕒 {item.datetime ? moment(item.datetime).format("HH:mm") : "---"}</div>
                  </>
                )}
                <div className="font-bold text-gray-500 uppercase text-[10px] mt-1.5">{item.room || "---"}</div>
                
                <div className="border-t border-gray-200 border-dashed pt-1 mt-1.5 text-[9px] text-gray-400 italic">
                  Nhập: {item.createdBy ? item.createdBy.split('@')[0] : "---"}
                </div>
              </td>

              {/* CỘT 2: NỘI DUNG & CẢNH BÁO */}
              <td className="px-2 py-2 w-[45%] align-top border border-gray-300">
                <div className="font-bold uppercase text-blue-900 text-[12px] mb-1.5 leading-tight line-clamp-2 break-words">
                  {item.caseName || "Vụ án chưa có tên"}
                </div>
                
                <div className="flex flex-wrap gap-1 mb-2">
                  {isForgotten && (
                    <span className="bg-orange-600 text-white text-[9px] px-2 py-1 rounded font-black uppercase animate-pulse shadow-sm">
                      ⚠️ QUÊN CẬP NHẬT
                    </span>
                  )}
                  {isRowUrgent && (
                    <span className="bg-red-600 text-white text-[9px] px-2 py-1 rounded font-black uppercase animate-pulse shadow-sm">
                      🔥 SẮP XỬ (24H)
                    </span>
                  )}
                  {overduePublish && (
                    <span className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded border border-red-700 animate-pulse uppercase">
                      🚨 CHẬM PHÁT HÀNH
                    </span>
                  )}
                  {effective && (
                    <span className="bg-teal-100 text-teal-800 text-[9px] font-black px-2 py-1 rounded border border-teal-200 uppercase">
                      ⚖️ ÁN CÓ HIỆU LỰC
                    </span>
                  )}
                  {/* HIỂN THỊ THẺ KHÁNG CÁO SIÊU XỊN (BẢN CÓ KẾT QUẢ) */}
                  {item.isKhangCao && (
                    <div className={`mt-2 p-2 rounded border shadow-sm w-max ${item.ketQuaPhucTham ? 'bg-blue-50 border-blue-300' : item.trangThaiKhangCao === 'da_chuyen' ? 'bg-gray-100 border-gray-300' : 'bg-orange-50 border-orange-300'}`}>
                        <div className={`text-[10px] font-black uppercase mb-1 ${item.ketQuaPhucTham ? 'text-blue-800' : item.trangThaiKhangCao === 'da_chuyen' ? 'text-gray-500' : 'text-orange-800 animate-pulse'}`}>
                           {item.ketQuaPhucTham ? `🏆 KQPT: ${item.ketQuaPhucTham}` : item.trangThaiKhangCao === 'da_chuyen' ? '📦 ĐÃ CHUYỂN PHÚC THẨM' : `📜 HẠN CHUYỂN: ${item.hanChuyenKhangCao ? moment(item.hanChuyenKhangCao).format("DD/MM/YYYY") : "---"}`}
                        </div>
                        <p className="text-[10px] font-bold text-gray-700 italic border-t border-dashed border-gray-300 pt-1">
                           {item.ketQuaPhucTham && item.loiChuQuan ? <span className="text-white bg-red-600 px-1 rounded mr-1 not-italic">LỖI CHỦ QUAN</span> : ""}
                           ND: {item.nguoiKhangCao}
                        </p>
                    </div>
                  )}
                  {/* TUI ĐÃ CHUYỂN THẺ NGHỊ ÁN VÀO ĐÂY CHO ĐÚNG LUẬT HTML */}
                  {item.status === 'nghi_an' && (
                    <span className="bg-purple-600 text-white text-[9px] px-2 py-1 rounded font-black uppercase animate-pulse shadow-sm">
                      ⚖️ ĐANG NGHỊ ÁN
                    </span>
                  )}
                </div>

                <div className="text-gray-500 font-bold text-[11px]">
                  <p className="mb-2 italic opacity-70">{item.caseType} / {item.trialCount}</p>
                  
                  <div className="space-y-0.5 bg-gray-50/50 p-1.5 rounded-md border border-gray-100">
  {item.caseType?.includes("Hình sự") ? (
    <div className="space-y-1">
      <div className="flex flex-col">
         <span className="text-red-600 uppercase text-[9px]">Bị cáo:</span>
         <span className="text-[11px] font-bold text-gray-800 uppercase">{item.defendant || "---"}</span>
      </div>
      <div className="flex flex-col">
         <span className="text-gray-500 uppercase text-[9px]">Bị hại / NLQ:</span>
         <span className="text-[11px] font-bold text-gray-800 uppercase">{item.plaintiff || "---"}</span>
      </div>
    </div>
  ) : (item.caseType === "cainghien" || item.caseType?.includes("Cai nghiện") || item.caseType?.includes("Hành chính")) ? (
    <div className="space-y-1">
      <div className="flex flex-col">
         <span className="text-teal-600 uppercase text-[9px]">Cơ quan đề nghị:</span>
         <span className="text-[11px] font-bold text-gray-800 uppercase">{item.plaintiff || "---"}</span>
      </div>
      <div className="flex flex-col">
         <span className="text-teal-600 uppercase text-[9px]">Người bị đề nghị:</span>
         <span className="text-[11px] font-bold text-gray-800 uppercase">{item.defendant || "---"}</span>
      </div>
    </div>
  ) : (
    <div className="space-y-1">
      <div className="flex flex-col">
        <span className="text-gray-500 uppercase text-[9px]">NĐ:</span>
        <span className="text-[11px] font-bold text-gray-800 uppercase">{item.plaintiff || "---"}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-gray-500 uppercase text-[9px]">BĐ:</span>
        <span className="text-[11px] font-bold text-gray-800 uppercase">{item.defendant || "---"}</span>
      </div>
    </div>
  )}
              </div>
                </div>

                {item.status === 'completed' && !item.publishedAt && (
                  <div className="mt-2 text-[10px] font-black px-2 py-1 rounded border bg-amber-50 text-amber-700 border-amber-200 inline-block">
                    HẠN PHÁT HÀNH: {calculateDeadlines(item).publish}
                  </div>
                )}
              </td>

              {/* CỘT 3: THÀNH PHẦN HĐXX */}
              <td className="px-2 py-2 w-[25%] align-top space-y-1.5 border border-gray-300">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-red-600 w-6 flex-shrink-0 font-bold text-[10px]">TP:</span> 
                    <span className="text-[11px] font-bold text-gray-800 uppercase">{item.judge || "---"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 font-bold w-6 flex-shrink-0 text-[10px]">TK:</span> 
                    <span className="text-[11px] font-bold text-gray-800">{item.clerk || "---"}</span>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-gray-100 mt-1">
                  <div className="flex gap-1">
                    <span className="text-gray-400 font-bold w-6 flex-shrink-0 text-[10px]">HT:</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium text-gray-700 leading-tight">{item.juror1 || "---"}</span>
                      <span className="text-[11px] font-medium text-gray-700 leading-tight">{item.juror2 || "---"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-1.5 flex items-center gap-1">
                  <span className="w-6 font-bold text-red-400 flex-shrink-0 text-[10px]">KSV:</span> 
                  <span className="text-[11px] font-bold text-red-700">{item.prosecutor || "---"}</span>
                </div>
              </td>

              {/* BẮT ĐẦU CỘT THAO TÁC (DẠNG DROPDOWN MENU) */}
{(canEdit || userRole === 'thamphan') && (
  <td className="px-2 py-2 w-[15%] align-top text-center border border-gray-300">
    
    <details className="w-full max-w-[130px] mx-auto group [&_summary::-webkit-details-marker]:hidden">
      {/* NÚT CHÍNH: Bấm vào để mở */}
      <summary className="bg-slate-800 hover:bg-black text-white px-2 py-2 rounded-md text-[10px] font-black uppercase shadow-sm transition-all flex justify-center items-center gap-1 cursor-pointer list-none outline-none border border-slate-700 active:scale-95">
        ⚙️ THAO TÁC <span className="group-open:rotate-180 transition-transform text-[8px] ml-1">▼</span>
      </summary>

      {/* DANH SÁCH NÚT: Đẩy hàng xuống để hiện ra, không lo bị che */}
      <div className="mt-1.5 flex flex-col gap-1 bg-gray-100/80 p-1 border border-gray-200 rounded-md shadow-inner text-left animate-fadeIn">
        
        {/* 1. KHI ÁN CHỜ XỬ HOẶC CHƯA CÓ TRẠNG THÁI */}
        {canEdit && (item.status === 'pending' || !item.status) && (
          <>
            <button onClick={() => toggleStatus(item.id, 'completed', item.caseName)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-green-100 text-green-700 font-bold uppercase text-[9px] rounded border border-gray-100 shadow-sm transition-all flex items-center gap-1.5">✅ Xét xử xong</button>
            <button onClick={() => handleReschedule(item)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-gray-200 text-gray-700 font-bold uppercase text-[9px] rounded border border-gray-100 shadow-sm transition-all flex items-center gap-1.5">🔄 Hoãn</button>
            <button onClick={() => toggleStatus(item.id, 'suspended', item.caseName)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-purple-100 text-purple-700 font-bold uppercase text-[9px] rounded border border-gray-100 shadow-sm transition-all flex items-center gap-1.5">⏸ Tạm ngừng</button>
            <button onClick={() => handleDinhChi(item)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-red-100 text-red-700 font-bold uppercase text-[9px] rounded border border-red-100 shadow-sm transition-all flex items-center gap-1.5">🛑 Đình chỉ (Rút đơn)</button>
            <button onClick={() => updateCaseStatus(item.id, 'nghi_an')} className="w-full text-left px-2 py-1.5 bg-white hover:bg-indigo-100 text-indigo-700 font-bold uppercase text-[9px] rounded border border-gray-100 shadow-sm transition-all flex items-center gap-1.5 animate-pulse">⚖️ Nghị án</button>
          </>
        )}

        {/* 2. HIỂN THỊ NÚT MỞ LẠI KHI ĐANG NGHỊ ÁN */}
        {item.status === 'nghi_an' && canEdit && (
          <button onClick={() => toggleStatus(item.id, 'pending', item.caseName)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-indigo-100 text-indigo-700 font-bold uppercase text-[9px] rounded border border-indigo-100 shadow-sm transition-all flex items-center gap-1.5">🔓 Mở lại án</button>
        )}

        {/* 3. KHI ÁN ĐÃ XONG */}
        {item.status === 'completed' && (
          <>
             <button onClick={() => togglePublish(item)} className={`w-full text-left px-2 py-1.5 font-bold uppercase text-[9px] rounded border shadow-sm transition-all flex items-center gap-1.5 ${item.publishedAt ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-100 hover:bg-amber-200 text-amber-700 border-amber-300 animate-pulse'}`}>
               {item.publishedAt ? "✅ Đã phát hành" : "📢 Chốt PH"}
             </button>
             {canEdit && <button onClick={() => toggleStatus(item.id, 'pending', item.caseName)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-gray-200 text-gray-700 font-bold uppercase text-[9px] rounded border border-gray-100 shadow-sm transition-all flex items-center gap-1.5">🔓 Mở lại án</button>}
             
             {/* NÚT KHÁNG CÁO & CHUYỂN PHÚC THẨM */}
             {canEdit && !item.isKhangCao && (
                <button onClick={() => handleKhangCao(item)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-orange-100 text-orange-700 font-bold uppercase text-[9px] rounded border border-orange-200 shadow-sm transition-all flex items-center gap-1.5">📜 Nhận Kháng Cáo</button>
             )}
             {canEdit && item.isKhangCao && item.trangThaiKhangCao !== 'da_chuyen' && (
                <button onClick={() => handleChuyenPhucTham(item)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-teal-100 text-teal-700 font-bold uppercase text-[9px] rounded border border-teal-200 shadow-sm transition-all flex items-center gap-1.5">📦 Đã chuyển Phúc thẩm</button>
             )}
             {/* NÚT CHỐT KẾT QUẢ PHÚC THẨM (Chỉ hiện khi án đã chuyển PT) */}
             {canEdit && item.trangThaiKhangCao === 'da_chuyen' && !item.ketQuaPhucTham && (
                <button onClick={() => handleKetQuaPhucTham(item)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-blue-100 text-blue-700 font-bold uppercase text-[9px] rounded border border-blue-200 shadow-sm transition-all flex items-center gap-1.5 animate-pulse">🏆 Chốt KQ Phúc thẩm</button>
             )}
          </>
        )}

        {/* 4. NÚT LÊN LỊCH LẠI */}
        {canEdit && item.status !== 'completed' && item.status !== 'nghi_an' && item.status !== 'pending' && (
          <button onClick={() => handleReschedule(item)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-blue-100 text-blue-700 font-bold uppercase text-[9px] rounded border border-gray-100 shadow-sm transition-all flex items-center gap-1.5">📅 Lên lịch lại</button>
        )}

        <button onClick={() => docTenDuongSu(item)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-amber-100 text-amber-700 font-bold uppercase text-[9px] rounded border border-amber-200 shadow-sm transition-all flex items-center gap-1.5">
           📢 Phát thanh gọi tên
        </button>
        {canEdit && <div className="h-[1px] bg-gray-300 my-0.5 mx-1"></div>}

        {/* 5. NHÓM NÚT SỬA / LOG / XÓA */}
        {canEdit && (
          <>
            <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="w-full text-left px-2 py-1.5 bg-white hover:bg-blue-50 text-blue-600 font-bold uppercase text-[9px] rounded border border-gray-100 shadow-sm transition-all flex items-center gap-1.5">✏️ Sửa hồ sơ</button>
            <button onClick={() => setSelectedEvent(item)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-gray-100 text-gray-600 font-bold uppercase text-[9px] rounded border border-gray-100 shadow-sm transition-all flex items-center gap-1.5">🕒 Xem Log</button>
            {canManagePortal && <button onClick={() => handleDelete(item.id, item.caseName)} className="w-full text-left px-2 py-1.5 bg-white hover:bg-red-100 text-red-600 font-bold uppercase text-[9px] rounded border border-red-100 shadow-sm transition-all flex items-center gap-1.5">🗑️ Xóa hồ sơ</button>}
          </>
        )}
      </div>
    </details>

  </td>
)}
{/* KẾT THÚC CỘT THAO TÁC */}
            </tr>
          );
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
                             const overduePublish = isOverduePublish(item);
                             const effective = isEffective(item);

                             return (
                               <div key={item.id} draggable={canEdit} onDragStart={(e) => handleDragStart(e, item)} className={`bg-white p-4 rounded-xl border-l-4 shadow-sm transition-all relative group ${canEdit ? 'cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-1' : ''} ${urgent || overduePublish ? 'border-l-red-500' : effective ? 'border-l-teal-500' : col.id === 'suspended' ? 'border-l-purple-500' : 'border-l-blue-500'} border-y border-r border-gray-200`}>
                                 <h4 className="font-bold text-[12px] text-blue-900 mb-2 leading-tight line-clamp-2">{item.caseName || "Chưa có tên"}</h4>
                                 
                                 {overduePublish && <div className="mb-2 text-[9px] font-black text-red-600 bg-red-50 p-2 rounded border border-red-100 animate-pulse">CHẬM PHÁT HÀNH BẢN ÁN</div>}
                                 {effective && <div className="mb-2 text-[9px] font-black text-teal-700 bg-teal-50 p-2 rounded border border-teal-100">ÁN ĐÃ CÓ HIỆU LỰC</div>}

                                 <div className="space-y-1.5 text-[10px] font-bold text-gray-700 bg-gray-50 p-2 rounded-md border border-gray-100">
                                   <div className="flex items-center gap-2"><span className="text-lg">🕒</span> {item.status === 'suspended' 
? <span className="text-purple-600 italic">Chờ báo sau</span> 
    : item.datetime 
      ? moment(item.datetime).format("HH:mm | DD/MM/YY") 
      : <span className="text-red-500 font-black italic">CHƯA LÊN LỊCH</span>
  }
</div>
                                   <div className="flex items-center gap-2"><span className="text-lg">👨‍⚖️</span> TP: {item.judge || "---"}</div>
                                   <div className="flex items-center gap-2"><span className="text-lg">🛡️</span> KSV: <span className="text-red-600">{item.prosecutor || "---"}</span></div>
                                 </div>
                                 
                                 {canEdit && item.status === 'completed' && (
                                   <div className="mt-4 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                     <button onClick={() => togglePublish(item)} className={`flex-1 py-2.5 rounded-md text-[9px] font-bold uppercase transition-all shadow-sm ${item.publishedAt ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                                       {item.publishedAt ? "✅ ĐÃ PH" : "📤 PHÁT HÀNH"}
                                     </button>
                                     <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2.5 rounded-md text-[9px] font-bold uppercase transition-all shadow-sm">✏️ SỬA</button>
                                   </div>
                                 )}
                                 
                                 {canEdit && item.status !== 'completed' && (
                                   <div className="mt-4 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button onClick={() => {setForm(item); setEditingId(item.id); window.scrollTo({top:0, behavior:'smooth'})}} className="w-full bg-blue-500/20 hover:bg-blue-500/30 backdrop-blur-md text-gray-900 py-2.5 rounded-md text-[10px] font-medium uppercase transition-all shadow-sm">CẬP NHẬT & SỬA</button>
                                   </div>
                                 )}
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
          )}

      {activeTab === "inspection" && (
    <div className="animate-fadeIn space-y-10">
        <div className="bg-teal-700 p-10 rounded-xl text-white shadow-2xl flex flex-col items-center">
          <h2 className="text-3xl font-black uppercase italic mb-2 text-center">Quản Lý Lịch Xem Xét, Thẩm Định Tại Chỗ</h2>
          <p className="opacity-80 font-bold uppercase text-[11px] tracking-widest">Địa bàn Khu vực 9</p>
        </div>

      <div className="bg-white p-8 rounded-xl shadow-xl border grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
  
  <div className="md:col-span-3 flex flex-col gap-2">
    <label className="block text-[11px] font-black uppercase text-teal-700">Thời gian đi</label>
    <div className="flex gap-2">
      <input type="date" value={insForm.date} onChange={e => setInsForm({...insForm, date: e.target.value})} className={inputBase} />
      <select 
  value={insForm.time} 
  onChange={e => setInsForm({...insForm, time: e.target.value})} 
  className="border border-gray-300 rounded-md px-2 py-3 bg-white outline-none focus:border-blue-500 text-sm font-bold w-full">
        <option value="07:30">07:30</option>
        <option value="09:30">09:30</option>
        <option value="13:30">13:30</option>
        <option value="15:00">15:00</option>
        </select>
    </div>
  </div>

  <div className="md:col-span-2">
    <label className="block text-[11px] font-black uppercase text-teal-700">Địa bàn</label>
    <input 
      list="communes-list" 
      value={insForm.commune} 
      onChange={e => setInsForm({...insForm, commune: e.target.value})} 
      className={inputBase} 
      placeholder="Chọn hoặc gõ xã khác..."
    />
    {/* Datalist chứa các xã mặc định để gợi ý */}
    <datalist id="communes-list">
      {communes.map(c => <option key={c} value={c} />)}
    </datalist>
  </div>

  <div className="md:col-span-2">
    <label className="block text-[11px] font-black uppercase text-teal-700">Thẩm phán</label>
    <input list="judges-list" value={insForm.judge} onChange={e => setInsForm({...insForm, judge: e.target.value})} className={inputBase} placeholder="Chọn TP..."/>
  </div>

  <div className="md:col-span-3">
    <label className="block text-[11px] font-black uppercase text-teal-700">Ghi chú vụ việc</label>
    <input type="text" value={insForm.content} onChange={e => setInsForm({...insForm, content: e.target.value})} className={inputBase} placeholder="Nhập nhanh nội dung..."/>
  </div>

  <button onClick={handleInsSubmit} className="md:col-span-2 bg-teal-600 hover:bg-teal-700 text-white font-black py-4 rounded-lg uppercase shadow-lg transition-all h-[50px]">
    Lên lịch
  </button>
</div>

        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border">
          <table className="w-full text-left table-fixed border-collapse border border-gray-300 text-[12px]">
            <thead className="bg-teal-50 text-teal-900 text-[11px] font-black uppercase">
              <tr>
                <th className="px-2 py-2 border border-gray-300 w-[20%] text-center">Ngày đi</th>
                <th className="px-2 py-2 border border-gray-300 w-[20%] text-center">Địa bàn</th>
                <th className="px-2 py-2 border border-gray-300 w-[25%] text-center">Thẩm phán</th>
                <th className="px-2 py-2 border border-gray-300 w-[35%]">Ghi chú vụ việc</th>
                <th className="px-2 py-2 border border-gray-300 text-center text-xs font-black uppercase text-gray-500 w-20">Xóa</th>
              </tr>
            </thead>
           <tbody className="divide-y divide-gray-100 bg-white">
            {inspections
              .filter(item => moment(item.date).isSameOrAfter(moment().startOf('day'))) // DÒNG NÀY SẼ LỌC ẨN NGÀY CŨ NÈ
              .map(item => (
                <tr key={item.id} className="hover:bg-teal-50/50 transition-all font-bold">
      <td className="px-2 py-2 border border-gray-300 text-center text-teal-900">
  <div className="flex flex-col items-center">
    <span className="text-blue-600 font-black flex items-center gap-1">
      🕒 {item.time || "08:00"} 
    </span>
    <span className="text-gray-600 font-bold">
      {moment(item.date).format("DD/MM/YYYY")}
    </span>
  </div>
</td>
                  <td className="px-2 py-2 border border-gray-300 text-center"><span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-[11px] font-black border border-teal-200">📍 {item.commune}</span></td>
                  <td className="px-2 py-2 border border-gray-300 text-center uppercase text-blue-800 italic">{item.judge}</td>
                  <td className="px-2 py-2 border border-gray-300 text-gray-500 italic text-sm">{item.content || "---"}</td>
                  <td className="px-2 py-2 border border-gray-300 text-center">
        <button 
          onClick={() => handleDeleteIns(item.id)} 
          className="p-1 hover:bg-red-100 rounded-full transition-colors group"
          title="Xóa lịch này"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 text-red-400 group-hover:text-red-600" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  ))}
</tbody>
          </table>
          {inspections.filter(item => moment(item.date).isSameOrAfter(moment().startOf('day'))).length === 0 && (
            <div className="p-20 text-center text-gray-300 font-bold uppercase italic">Chưa có lịch thẩm định nào sắp tới</div>
          )}
        </div>
      </div>
      
    )}
    {activeTab === "config_judges" && (
  <QuanLyThamPhan db={db} showToast={showToast} />
)}
{activeTab === "dashboard" && (
  <div className="bg-white p-8 rounded-2xl shadow-xl border-t-8 border-blue-600 max-w-6xl mx-auto animate-fadeIn relative overflow-hidden">
    
    {/* TRANG TRÍ BACKGROUND NHẸ NHÀNG */}
    <div className="absolute top-[-50px] right-[-50px] text-[200px] opacity-5">👋</div>

    {/* LỜI CHÀO & TÓM TẮT TRẠNG THÁI */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 relative z-10 border-b border-gray-100 pb-6">
      <div>
        <h2 className="text-3xl md:text-4xl font-black text-blue-900 tracking-tight mb-2">
          Chào ngày mới, <span className="text-blue-600">{userFullName || user?.email?.split('@')[0]}</span>!
        </h2>
        <p className="text-gray-500 font-medium text-sm">
          Hôm nay bạn có <span className="text-red-600 font-black text-lg mx-1">{myPendingCases.length}</span> vụ án đang chờ xử lý. Chúc một ngày làm việc hiệu quả!
        </p>
      </div>
      <div className="mt-4 md:mt-0 text-right">
        <p className="text-3xl font-black text-gray-800 tracking-tighter">{moment().format('HH:mm')}</p>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{moment().format('dddd, DD/MM/YYYY')}</p>
      </div>
    </div>

    {/* 3 THẺ SỐ LIỆU TỔNG QUAN (METRICS) */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 relative z-10">
      
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200 shadow-sm hover:-translate-y-1 transition-transform">
        <div className="flex justify-between items-start">
          <p className="text-xs font-black text-blue-800 uppercase tracking-widest">Tổng án đang ôm</p>
          <span className="p-2 bg-blue-200 text-blue-700 rounded-lg text-xl">📁</span>
        </div>
        <p className="text-5xl font-black text-blue-900 mt-4">{myCases.length}</p>
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border border-amber-200 shadow-sm hover:-translate-y-1 transition-transform">
        <div className="flex justify-between items-start">
          <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Chờ xếp lịch</p>
          <span className="p-2 bg-amber-200 text-amber-700 rounded-lg text-xl">⏳</span>
        </div>
        <p className="text-5xl font-black text-amber-600 mt-4">{myPendingCases.length}</p>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl border border-emerald-200 shadow-sm hover:-translate-y-1 transition-transform">
        <div className="flex justify-between items-start">
          <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">Sắp xét xử (Sắp tới)</p>
          <span className="p-2 bg-emerald-200 text-emerald-700 rounded-lg text-xl">⚖️</span>
        </div>
        <p className="text-5xl font-black text-emerald-600 mt-4">{myUpcomingTrials.length}</p>
      </div>

    </div>

    {/* DANH SÁCH LỊCH SẮP XỬ CỦA RIÊNG MÌNH */}
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative z-10">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
          <span>📅</span> Lịch xét xử sắp tới của bạn
        </h3>
        <button onClick={() => setActiveTab("trial")} className="text-xs font-bold text-blue-600 hover:text-blue-800 underline">
          Xem toàn bộ lịch &rarr;
        </button>
      </div>

      <div className="space-y-4">
        {myUpcomingTrials.length > 0 ? (
          myUpcomingTrials.map(item => (
            <div key={item.id} className="flex flex-col md:flex-row md:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4 hover:border-blue-300 transition-colors">
              
              {/* Lốc ngày giờ nổi bật */}
              <div className="bg-blue-600 text-white rounded-lg p-3 text-center shrink-0 w-24">
                <p className="text-[10px] font-black uppercase mb-1 opacity-80">{moment(item.datetime).format('MMM')}</p>
                <p className="text-2xl font-black leading-none mb-1">{moment(item.datetime).format('DD')}</p>
                <p className="text-[11px] font-bold bg-blue-800 rounded py-0.5">{moment(item.datetime).format('HH:mm')}</p>
              </div>

              {/* Thông tin án */}
              <div className="flex-1">
                <div className="flex gap-2 items-center mb-1.5">
                  <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                    {item.caseType}
                  </span>
                  <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                    Phòng: {item.room}
                  </span>
                </div>
                <p className="font-bold text-blue-900 text-sm uppercase leading-tight mb-1">{item.caseName}</p>
                <p className="text-xs text-gray-500 font-medium">
                  👥 Đương sự: {item.plaintiff || "---"} {item.defendant ? ` - ${item.defendant}` : ""}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
            <p className="text-3xl mb-2">🏝️</p>
            <p className="text-slate-500 font-bold text-sm">Bạn chưa có lịch xét xử nào sắp tới. Thật thảnh thơi!</p>
          </div>
        )}
      </div>
    </div>
  </div>
)}
    {activeTab === "nhap_an" && (
  <div className="bg-white p-8 rounded-2xl shadow-2xl border-t-8 border-indigo-900 animate-fadeIn max-w-6xl mx-auto">
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-black text-indigo-900 uppercase flex items-center gap-2">
        <span className="text-3xl">🔄</span> Tiếp Nhận & Phân Án Tự Động
      </h2>
      {choPhanAnId && (
        <button onClick={() => {setPhanAnForm({ caseName: "", plaintiff: "", defendant: "", caseType: "Dân sự" }); setChoPhanAnId(null);}} className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all border border-red-200">
          ✕ Hủy chọn hồ sơ
        </button>
      )}
    </div>
    
    {/* 1. KHAY CHỨA DANH SÁCH CHỜ PHÂN ÁN */}
    {dsChoPhanAn.length > 0 && (
      <div className="mb-8 bg-amber-50 p-5 rounded-xl border border-amber-200 shadow-inner relative">
        <div className="flex justify-between items-center mb-4 border-b border-amber-200 pb-3">
           <h3 className="text-sm font-black text-amber-800 uppercase flex items-center gap-2">
             <span className="text-xl">📁</span> Danh sách hồ sơ chờ phân án ({dsChoPhanAn.length})
           </h3>
           
           {/* NÚT PHÂN ÁN ĐỒNG LOẠT THẦN THÁNH */}
           {(isChanHan || isAdmin) && (
             <button onClick={handlePhanAnDongLoat} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-[11px] font-black uppercase shadow-md transition-all flex items-center gap-2 active:scale-95">
               <span>🚀 Phân Án Đồng Loạt</span>
             </button>
           )}
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
          {predictAssignments().map(item => (
            <div key={item.id} onClick={() => { setPhanAnForm(item); setChoPhanAnId(item.id); }} className={`min-w-[260px] max-w-[260px] p-4 bg-white border-2 rounded-xl cursor-pointer transition-all hover:border-indigo-400 hover:-translate-y-1 hover:shadow-md ${choPhanAnId === item.id ? 'border-indigo-600 shadow-lg bg-indigo-50/50' : 'border-gray-200'}`}>
              <p className="font-bold text-[13px] text-blue-900 line-clamp-2 mb-3 leading-tight" title={item.caseName}>{item.caseName}</p>
              
             {/* KHUNG HIỂN THỊ VÀ CHO PHÉP ĐỔI TRỰC TIẾP THẨM PHÁN */}
<div className={`p-2.5 rounded-lg border mb-3 shadow-sm transition-all ${item.isManual ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-100'}`}>
   <p className={`text-[9px] uppercase font-black mb-1.5 tracking-wider ${item.isManual ? 'text-green-600' : 'text-indigo-500'}`}>
     {item.isManual ? "📌 CHỈ ĐỊNH RIÊNG:" : "🤖 AI ĐỀ XUẤT CHO:"}
   </p>
   
   <select 
      value={item.judge || ""} 
      onChange={(e) => {
          e.stopPropagation(); // Rất quan trọng: Ngăn không cho click nhầm sang việc chọn hồ sơ sửa
          handleChangeJudgeDirectly(item.id, e.target.value);
      }}
      className={`w-full text-xs font-black p-2 rounded outline-none border cursor-pointer ${item.isManual ? 'bg-green-100 text-green-800 border-green-300' : 'bg-white text-indigo-800 border-indigo-200 shadow-inner'}`}
   >
      <option value="">🤖 Tự động (Đề xuất: {item.suggestedJudge})</option>
      {listJudges.map(j => (
         <option key={j.id} value={j.name}>👨‍⚖️ {j.name}</option>
      ))}
   </select>
</div>

              <div className="flex justify-between items-center text-[10px] text-gray-500 pt-2 border-t border-gray-100">
                 <p>Loại án: <span className="font-black text-gray-700">{item.caseType}</span></p>
                 <p className="italic font-medium">Nhập: {item.createdBy?.split('@')[0]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* 2. BẢNG THỐNG KÊ CHI TIẾT (DẠNG EXCEL) */}
      <div className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
          <h3 className="text-[12px] font-black text-indigo-900 uppercase flex items-center gap-2">
            📊  commit 
          </h3>
          <span className="text-[10px] text-indigo-500 font-bold italic">* Số liệu án đang thụ lý</span>
        </div>
        
        {/* COPY TỪ ĐÂY */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-black uppercase">
                <th className="p-3 border-b border-r border-gray-200 text-left w-40">Thẩm phán</th>
                {bangMaTranPhanAn.dsLoaiAn.map(type => (
                  <th key={type} className="p-3 border-b border-r border-gray-200 text-center">{type}</th>
                ))}
                <th className="p-3 border-b border-gray-200 text-center bg-indigo-100 text-indigo-900">Tổng cộng</th>
              </tr>
            </thead>
            
            <tbody>
            {listJudges.map(judge => {
              // HỆ THỐNG LẤY SỐ TỔNG (ĐÃ BAO GỒM GỐC CẤU HÌNH + ÁN MỚI PHÂN)
              const statsCuaJudge = bangMaTranPhanAn.stats[judge.name] || {};
              const tongTatCa = Object.values(statsCuaJudge).reduce((acc, val) => acc + (val || 0), 0);
              
              return (
                <tr key={judge.id} className="hover:bg-gray-50 transition-colors">
                  {/* CỘT TÊN THẨM PHÁN VÀ CHỌN THỦ CÔNG */}
                  <td 
                    className={`p-3 border-b border-r border-gray-200 font-bold uppercase cursor-pointer transition-all ${manualJudge?.name === judge.name ? 'bg-indigo-600 text-white shadow-inner scale-95' : 'text-blue-900 hover:bg-indigo-50'}`}
                    onClick={() => {
                      setManualJudge(manualJudge?.name === judge.name ? null : judge);
                      showToast(manualJudge?.name === judge.name ? "Đã quay lại AI tự động" : `Đã chọn đích danh Thẩm phán: ${judge.name}`);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{judge.name}</span>
                      {manualJudge?.name === judge.name && <span className="text-[10px] bg-white text-indigo-700 px-1.5 py-0.5 rounded shadow-sm">📍 CHỌN</span>}
                    </div>
                    <p className={`text-[9px] font-normal mt-0.5 ${manualJudge?.name === judge.name ? 'text-indigo-200' : 'text-gray-400'}`}>{judge.role}</p>
                  </td>
                  
                  {/* CÁC CỘT CHI TIẾT LOẠI ÁN (Số cấu hình + Số án mới) */}
                  {bangMaTranPhanAn.dsLoaiAn.map(type => (
                    <td key={type} className="p-3 border-b border-r border-gray-200 text-center font-bold text-gray-600">
                      {statsCuaJudge[type] > 0 
                        ? statsCuaJudge[type] 
                        : <span className="text-gray-300">0</span>}
                    </td>
                  ))}
                  
                  {/* CỘT TỔNG CỘNG ĐÃ ĐƯỢC FIX LỖI: HIỆN CHÍNH XÁC SỐ CỘNG NGANG (GỐC + MỚI) */}
                  <td className="p-3 border-b border-gray-200 text-center font-black text-red-600 bg-red-50/20 text-[13px]">
                    {tongTatCa}
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
        {/* ĐẾN ĐÂY */}
        
      </div>

    {/* 3. KHU VỰC NHẬP LIỆU & AI PHÂN TÍCH */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* CỘT TRÁI: NHẬP LIỆU */}
      <div>
          <label className="block text-xs font-black text-gray-500 mb-2 uppercase">Số thụ lý vụ án <span className="text-red-500">*</span></label>
          <input 
            type="text"
            value={phanAnForm.soThuLy || ""}
            onChange={e => setPhanAnForm({...phanAnForm, soThuLy: e.target.value})}
            className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none transition-all border-indigo-100 focus:ring-4 focus:ring-indigo-100"
            placeholder="VD: 123/2026/TLST-DS..."
          />
        </div>

        {/* 2. Ô NHẬP TRÍCH YẾU VỤ ÁN */}
        <div>
          <label className="block text-xs font-black text-gray-500 mb-2 uppercase">Trích yếu vụ án <span className="text-red-500">*</span></label>
          <input 
            type="text"
            value={phanAnForm.caseName}
            onChange={e => setPhanAnForm({...phanAnForm, caseName: e.target.value})}
            className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none transition-all"
            placeholder="VD: Tranh chấp hợp đồng vay tài sản..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-gray-500 mb-2 uppercase">Nguyên đơn / Bị cáo</label>
            <input 
              type="text"
              value={phanAnForm.plaintiff}
              onChange={e => setPhanAnForm({...phanAnForm, plaintiff: e.target.value})}
              className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none transition-all"
              placeholder="VD: Ông Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 mb-2 uppercase">Bị đơn / Bị hại</label>
            <input 
              type="text"
              value={phanAnForm.defendant}
              onChange={e => setPhanAnForm({...phanAnForm, defendant: e.target.value})}
              className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none transition-all"
              placeholder="VD: Bà Trần Thị B"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-gray-500 mb-2 uppercase">Loại án <span className="text-red-500">*</span></label>
          <select 
            value={phanAnForm.caseType}
            onChange={e => setPhanAnForm({...phanAnForm, caseType: e.target.value})}
            className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none"
          >
            <option value="Dân sự">Dân sự</option>
            <option value="Hình sự">Hình sự</option>
            <option value="Hành chính">Hành chính</option>
            <option value="Lao động">Lao động</option>
            <option value="Cai nghiện">Cai nghiện</option>
            <option value="Kinh tế">Kinh tế</option>
            <option value="Hôn nhân & GĐ">Hôn nhân & Gia đình</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-black text-gray-500 mb-2 uppercase">
            Quan hệ pháp luật / Tội danh <span className="text-red-500">*</span>
          </label>
          <input 
            list="quan-he-goy-list" 
            type="text"
            value={phanAnForm.quanHePhapLuat || ""}
            onChange={e => setPhanAnForm({...phanAnForm, quanHePhapLuat: e.target.value})}
            className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold focus:border-indigo-500 outline-none transition-all"
            placeholder="Gõ hoặc chọn từ danh sách gợi ý..."
          />
          
          {/* Datalist tự động thay đổi danh mục dựa vào Loại án đang chọn */}
          <datalist id="quan-he-goy-list">
            {(DANH_MUC_QUAN_HE[phanAnForm.caseType] || []).map((qh, idx) => (
              <option key={idx} value={qh} />
            ))}
          </datalist>
        </div>
        
     {/* ========================================================================= */}
        {/* ĐÃ ÉP CÂN CHO NÚT LÙN LẠI BẰNG LỆNH max-h-[56px]                        */}
        {/* ========================================================================= */}
        <div className="flex gap-3 mt-6">
          <button 
            onClick={handleLuuChoPhanAn}
            className={`flex-1 text-white font-black py-4 rounded-xl shadow-md transition-all active:scale-95 uppercase tracking-widest text-sm max-h-[56px] flex items-center justify-center ${choPhanAnId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-800 hover:bg-black'}`}
          >
            {choPhanAnId ? "✏️ CẬP NHẬT HỒ SƠ" : "LƯU VÀO CHỜ PHÂN ÁN"}
          </button>

          {/* NÚT XÓA CŨNG PHẢI ÉP CÂN CHO BẰNG NHAU */}
          {choPhanAnId && (
            <button   
              onClick={async () => {
                if (window.confirm("⚠️ Bạn có chắc muốn xóa vĩnh viễn hồ sơ này khỏi danh sách chờ không?")) {
                  try {
                    await deleteDoc(doc(db, "schedule", choPhanAnId));
                    showToast("Đã xóa hồ sơ chờ thành công!", "success");
                    
                    setPhanAnForm({ soThuLy: "", caseName: "", plaintiff: "", defendant: "", caseType: "Dân sự", quanHePhapLuat: "" });
                    setChoPhanAnId(null);
                  } catch(e) {
                    showToast("Lỗi xóa: " + e.message, "error");
                  }
                }
              }}
              className="bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border-2 border-red-200 hover:border-red-500 font-black px-5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center shrink-0 max-h-[56px]"
              title="Xóa hồ sơ khỏi danh sách chờ"
            >
              🗑️ XÓA
            </button>
          )}
        </div>
        {/* ========================================================================= */}

      {/* CỘT PHẢI: KẾT QUẢ PHÂN ÁN BẰNG AI HOẶC CHỌN TAY */}
      <div className="bg-slate-900 p-8 rounded-2xl text-white shadow-2xl relative overflow-hidden border-2 border-indigo-500/30">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-8xl">⚖️</div>
        
        <h3 className="text-indigo-400 font-black uppercase tracking-tighter text-sm mb-4 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full animate-ping ${manualJudge ? 'bg-green-500' : 'bg-indigo-500'}`}></span>
          {manualJudge ? "Chế độ: Lãnh đạo chỉ định" : "Hệ thống phân tích (AI Suggest)"}
        </h3>

        {/* BỘ LỌC TỰ CHỌN BỔ SUNG (GHI ĐÈ AI) */}
        <div className="mb-6 relative z-10 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <label className="block text-[11px] uppercase font-black text-gray-400 mb-2 tracking-widest">
            Thay đổi Thẩm phán thủ công:
          </label>
          <select 
            value={manualJudge ? manualJudge.name : ""} 
            onChange={(e) => {
              const selectedName = e.target.value;
              if (!selectedName) {
                setManualJudge(null); // Trả lại quyền phân án cho AI
              } else {
                const judgeObj = listJudges.find(j => j.name === selectedName);
                setManualJudge(judgeObj);
              }
            }}
            className="w-full bg-slate-800 border border-slate-600 text-yellow-400 text-sm font-black p-3 rounded-lg outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-inner"
          >
            <option value="" className="text-white">🤖 Cho phép Hệ thống AI tự tính toán</option>
            {listJudges.map(j => (
              <option key={j.id} value={j.name} className="text-white">
                👨‍⚖️ {j.name} (Đang thụ lý: {parseInt(j.tonCu) || 0} vụ)
              </option>
            ))}
          </select>
        </div>

        {/* HIỂN THỊ THÔNG TIN THẨM PHÁN SẼ ĐƯỢC GIAO */}
        {goiYThamPhan() || manualJudge ? (
          <div className="space-y-6 relative z-10">
            <div className="text-center">
              <p className="text-gray-400 text-xs uppercase font-bold mb-1">
                {manualJudge ? "Thẩm phán được đích danh chọn:" : "Đề xuất Thẩm phán thụ lý:"}
              </p>
              <h4 className={`text-3xl md:text-4xl font-black tracking-tight ${manualJudge ? 'text-green-400' : 'text-yellow-400'}`}>
                {manualJudge ? manualJudge.name : goiYThamPhan()?.name}
              </h4>
              <span className="inline-block mt-2 px-4 py-1 bg-indigo-500/20 border border-indigo-500/40 rounded-full text-[10px] font-black uppercase">
                {manualJudge ? manualJudge.role : goiYThamPhan()?.role}
              </span>
            </div>

            {/* BẢNG THỐNG KÊ SỐ LIỆU ĐANG ÔM */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center shadow-inner">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Số án đang ôm</p>
                <div className="flex items-end justify-center gap-1">
                  <span className={`text-2xl font-black ${manualJudge ? 'text-green-300' : 'text-indigo-300'}`}>
                    {manualJudge 
                      ? (parseInt(manualJudge.tonCu) || 0) + schedule.filter(a => a.judge === manualJudge.name && a.status === 'pending' && !a.datetime).length 
                      : goiYThamPhan()?.tongAnThucTe}
                  </span>
                  <span className="text-[10px] mb-1.5 text-gray-400">vụ</span>
                </div>
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center shadow-inner">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Định mức</p>
                <div className="flex items-end justify-center gap-1">
                  <span className="text-2xl font-black text-gray-300">
                    {manualJudge ? (manualJudge.weight || 1) * 100 : (goiYThamPhan()?.weight || 1) * 100}
                  </span>
                  <span className="text-[10px] mb-1.5 text-gray-400">%</span>
                </div>
              </div>
            </div>

            {/* NÚT XÁC NHẬN GIAO ÁN ĐƠN LẺ */}
            {(isChanHan || isAdmin) ? (
              choPhanAnId ? (
                <button 
                  onClick={handleLuuPhanAn} 
                  className={`w-full font-black py-4 rounded-xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-sm ${manualJudge ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                >
                  XÁC NHẬN GIAO CHO VỤ NÀY
                </button>
              ) : (
                <div className="w-full bg-gray-800/80 border border-gray-700 text-gray-400 font-bold py-4 rounded-xl text-center text-xs px-2 italic">
                  👈 Chọn 1 hồ sơ bên trái để giao lẻ, hoặc bấm "Phân án đồng loạt" ở trên
                </div>
              )
            ) : (
              <div className="w-full bg-gray-800 border border-gray-700 text-gray-500 font-black py-4 rounded-xl text-center uppercase tracking-widest text-sm cursor-not-allowed">
                ⛔ CHỈ CHÁNH ÁN ĐƯỢC PHÊ DUYỆT
              </div>
            )}

          </div>
        ) : (
          <div className="text-center py-10 opacity-50 italic relative z-10">Đang tính toán hoặc chưa có Thẩm phán hợp lệ...</div>
        )}
      </div>

    </div>
    {/* ========================================================= */}
    {/* KHU VỰC BÁO CÁO THỐNG KÊ NHANH                            */}
    {/* ========================================================= */}
    <div className="mt-10 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 p-2 opacity-5 text-6xl">📈</div>
      
     {/* HEADER CỦA KHU VỰC THỐNG KÊ KÈM BỘ LỌC THÁNG */}
      <div className="bg-emerald-50 px-5 py-4 border-b border-emerald-100 flex flex-col md:flex-row justify-between md:items-center gap-3">
        <h3 className="text-sm font-black text-emerald-900 uppercase flex items-center gap-2">
          📊 Thống kê nhanh: Án đã phân công theo loại
        </h3>
        
        {/* THANH CÔNG CỤ CHỌN THÁNG */}
        <div className="flex items-center gap-2 relative z-10">
          <label className="text-[11px] font-black uppercase text-emerald-700 tracking-widest">Thời gian:</label>
          <input 
            type="month" 
            value={statMonth !== "all" ? statMonth : ""}
            onChange={(e) => setStatMonth(e.target.value || "all")}
            disabled={statMonth === "all"}
            className="px-3 py-1.5 border-2 border-emerald-200 rounded-lg text-sm font-bold text-emerald-900 outline-none focus:border-emerald-500 bg-white shadow-sm disabled:bg-gray-100 disabled:text-gray-400"
          />
          <button 
            onClick={() => setStatMonth(statMonth === "all" ? moment().format('YYYY-MM') : "all")}
            className={`px-3 py-1.5 text-[11px] uppercase font-black tracking-widest rounded-lg border-2 shadow-sm transition-all active:scale-95 ${statMonth === "all" ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"}`}
          >
            {statMonth === "all" ? "Trở về từng tháng" : "Xem tất cả"}
          </button>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          
          {/* Ô Tổng số án */}
          <div className="col-span-2 bg-slate-800 rounded-xl p-5 border border-slate-700 text-center shadow-lg transition-transform hover:scale-105">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Tổng số đã phân</p>
            <div className="flex items-end justify-center gap-1">
               <p className="text-4xl font-black text-white">{thongKeLoaiAn.tongSo || 0}</p>
               <p className="text-sm text-slate-400 mb-1">vụ</p>
            </div>
          </div>

          {/* Render linh động các loại án */}
          {danhSachCacLoaiAn.map(type => (
            <div 
              key={type} 
              onClick={() => setSelectedStatType(type)} // <--- THÊM DÒNG NÀY
              className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 text-center transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer hover:bg-emerald-100 active:scale-95" // <--- THÊM cursor-pointer VÀ hover:bg-emerald-100
            >
              <p className="text-[10px] font-black text-emerald-800 uppercase mb-2 line-clamp-1" title={type}>{type}</p>
              <p className="text-2xl font-black text-emerald-600">{thongKeLoaiAn?.[type] || 0}</p>
            </div>
          ))}

        </div>
      </div>
    </div>
  </div>
)}
{/* ========================================================= */}
{/* MODAL HIỂN THỊ CHI TIẾT DANH SÁCH ÁN THEO LOẠI            */}
{/* ========================================================= */}
{selectedStatType && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setSelectedStatType(null)}>
    <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
      
      {/* HEADER */}
      <div className="p-5 bg-emerald-700 text-white flex justify-between items-center shrink-0">
        <h3 className="font-black uppercase text-lg tracking-widest flex items-center gap-2">
          <span>📑</span> DANH SÁCH ÁN {selectedStatType} ĐÃ PHÂN CÔNG
        </h3>
        <button onClick={() => setSelectedStatType(null)} className="text-white/70 hover:text-white font-black text-xl transition-colors">✕</button>
      </div>
      
      {/* NỘI DUNG DANH SÁCH (Có thanh cuộn) */}
      <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
        <div className="space-y-4">
          {schedule
            .filter(item => {
               if (item.caseType !== selectedStatType || !item.judge || item.judge === "---") return false;
               const itemMonth = moment(item.createdAt || item.updatedAt || new Date()).format('YYYY-MM');
               return statMonth === "all" || itemMonth === statMonth;
            })
            .map((item, index) => (
              <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:justify-between md:items-center gap-4 hover:border-emerald-300 transition-colors">
                <div className="flex-1">
                  {/* BỔ SUNG SỐ THỤ LÝ VÀO ĐÂY */}
                  <div className="flex gap-3 items-center mb-1.5">
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded border border-slate-200">
                      Số TL: {item.soThuLy || "Chưa cập nhật"}
                    </span>
                    <p className="font-bold text-blue-900 text-sm uppercase leading-tight">{index + 1}. {item.caseName}</p>
                  </div>
                  
                  <p className="text-xs text-gray-600 font-medium ml-1">
                    👥 Đương sự: <span className="font-bold">{item.plaintiff || "---"}</span> {item.defendant ? ` - ${item.defendant}` : ""}
                  </p>
                </div>
                
                <div className="text-left md:text-right shrink-0 bg-emerald-50 md:bg-transparent p-3 md:p-0 rounded-lg">
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-1">Thẩm phán thụ lý</p>
                  <p className="text-sm font-black text-emerald-700 flex items-center md:justify-end gap-1">
                    👨‍⚖️ {item.judge}
                  </p>
                </div>
              </div>
          ))}

          {/* Báo lỗi nếu trống */}
          {schedule.filter(item => item.caseType === selectedStatType && item.judge && item.judge !== "---").length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 font-bold">Chưa có vụ án nào thuộc loại này được phân công.</p>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER: THÊM NÚT XUẤT EXCEL */}
      <div className="p-4 bg-white border-t border-gray-100 shrink-0 flex gap-4">
         <button 
           onClick={handleExportChiTietAn} 
           className="w-1/3 bg-green-600 hover:bg-green-700 text-white py-3 font-black uppercase rounded-xl transition-colors shadow-md flex justify-center items-center gap-2"
         >
           <span>📥 XUẤT EXCEL</span>
         </button>
         
         <button 
           onClick={() => setSelectedStatType(null)} 
           className="w-2/3 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 font-black uppercase rounded-xl transition-colors shadow-sm"
         >
           ĐÓNG DANH SÁCH
         </button>
      </div>

    </div>
  </div>
)}
{/* ========================================================= */}  {activeTab === "report" && (
    <div className="animate-fadeIn space-y-8">
      <div className="bg-blue-900 p-8 rounded-2xl text-white shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter">Báo Cáo Kết Quả Xét Xử</h2>
          <p className="opacity-70 font-bold uppercase text-[11px] mt-1 tracking-[0.2em]">Thống kê tổng hợp</p>
        </div>
       <div className="flex items-center gap-3 bg-white/20 p-3 rounded-xl border border-white/30 backdrop-blur-sm shadow-inner">
           <span className="text-[11px] font-black uppercase tracking-widest text-blue-100 hidden sm:block">Chọn tháng:</span>
           <input 
              type="month" 
              value={reportMonth} 
              onChange={e => setReportMonth(e.target.value)} 
              className="bg-white text-blue-900 font-black px-4 py-2 rounded-lg outline-none cursor-pointer shadow-sm" 
           />
           {reportMonth && (
              <button onClick={() => setReportMonth("")} className="text-[10px] bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 rounded-lg font-black uppercase transition-all shadow-md active:scale-95">
                 Toàn thời gian
              </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-xl border-l-8 border-l-green-500">
          <h3 className="text-gray-500 font-black text-[11px] uppercase mb-4">✅ Tổng án đã xét xử</h3>
          <p className="text-4xl font-black text-green-600">
            {schedule.filter(i => i.status === 'completed' && (!reportMonth || moment(i.datetime || i.createdAt).format("YYYY-MM") === reportMonth)).length}
          </p>
          <p className="text-[10px] text-gray-400 mt-2 italic font-bold">Toàn bộ án đã giải quyết xong</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-xl border-l-8 border-l-blue-500">
          <h3 className="text-gray-500 font-black text-[11px] uppercase mb-4">📁 Án đang chờ xử</h3>
          <p className="text-4xl font-black text-blue-900">
            {schedule.filter(i => i.status === 'pending' && (!reportMonth || moment(i.datetime || i.createdAt).format("YYYY-MM") === reportMonth)).length}
          </p>
          <p className="text-[10px] text-gray-400 mt-2 italic font-bold">Tổng số vụ việc đang thụ lý</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-xl border-l-8 border-l-teal-500">
          <h3 className="text-gray-500 font-black text-[11px] uppercase mb-4">🏆 Tỷ lệ giải quyết</h3>
          <p className="text-4xl font-black text-teal-600">
            {(() => {
               const filtered = schedule.filter(i => !reportMonth || moment(i.datetime || i.createdAt).format("YYYY-MM") === reportMonth);
               const completed = filtered.filter(i => i.status === 'completed').length;
               return filtered.length > 0 ? Math.round((completed / filtered.length) * 100) : 0;
            })()}%
          </p>
          <p className="text-[10px] text-gray-400 mt-2 italic font-bold">Dựa trên tổng số án đã nhập</p>
        </div>
      </div>
      {/* TỰ ĐỘNG TÍNH TOÁN VÀ VẼ BIỂU ĐỒ THEO THÁNG ĐƯỢC CHỌN */}
      {(() => {
        const filteredReport = schedule.filter(i => !reportMonth || moment(i.datetime || i.createdAt).format("YYYY-MM") === reportMonth);
        if (filteredReport.length === 0) return null; 
        
        // Dữ liệu Biểu đồ tròn
        const ctStats = {};
        filteredReport.forEach(i => { if(i.caseType) ctStats[i.caseType] = (ctStats[i.caseType] || 0) + 1 });
        const ctData = Object.keys(ctStats).map(key => ({ name: key, value: ctStats[key] }));
        
        // Dữ liệu Danh sách Thẩm phán án chờ
        const jStats = {};
        filteredReport.filter(i => i.status === 'pending').forEach(i => { if(i.judge) jStats[i.judge] = (jStats[i.judge] || 0) + 1 });
        const jData = Object.keys(jStats).map(key => ({ name: key, value: jStats[key] })).sort((a,b) => b.value - a.value);

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
               <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-200">
                  <h3 className="text-center font-black text-[13px] text-gray-500 uppercase tracking-widest mb-4">Tỷ lệ theo Loại án</h3>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={ctData} 
                        layout="vertical" 
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {ctData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               <div className="bg-white shadow-xl rounded-xl p-6 border border-gray-200 flex flex-col">
                  <h3 className="text-center font-black text-[13px] text-gray-500 uppercase tracking-widest mb-4">Án đang chờ xử theo Thẩm phán</h3>
                  <div className="h-[320px] w-full overflow-y-auto pr-2 custom-scrollbar">
                    {jData.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-2">
                        {jData.map((item, index) => (
                          <div key={index} className="flex justify-between items-center border-b border-gray-100 pb-2">
                            <span className="text-[14px] font-bold text-gray-700 truncate pr-2" title={item.name}>
                              <span className="text-gray-400 mr-1.5">{index + 1}.</span>{item.name}
                            </span>
                            <span className="text-[14px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded shadow-sm">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm font-bold text-gray-400 italic">Không có án chờ xử</div>
                    )}
                  </div>
               </div>
            </div>
        );
      })()}
      <div className="bg-white rounded-2xl shadow-2xl border p-6 mt-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-blue-900 uppercase text-lg flex items-center gap-2">
            <span className="text-2xl">📅</span> Chi tiết án đã xét xử theo tháng
          </h3>
        </div>
{/* BẢNG ĐÁNH GIÁ CHẤT LƯỢNG XÉT XỬ CỦA THẨM PHÁN */}
      <div className="bg-white rounded-2xl shadow-2xl border p-6 mt-8 border-t-8 border-t-red-600">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-red-800 uppercase text-lg flex items-center gap-2">
            <span className="text-2xl">⚖️</span> Đánh giá Chất lượng Xét xử (Tỷ lệ Hủy/Sửa án)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse border border-gray-300 text-[12px]">
            <thead className="bg-red-50 text-red-900 text-[11px] font-black uppercase">
              <tr>
                <th className="px-2 py-3 border border-gray-300 text-left">Thẩm phán</th>
                <th className="px-2 py-3 border border-gray-300">Án đã giải quyết</th>
                <th className="px-2 py-3 border border-gray-300 text-orange-700">Bị Kháng cáo/Kháng nghị</th>
                <th className="px-2 py-3 border border-gray-300 text-red-600 bg-red-100">Bị HỦY (Lỗi chủ quan)</th>
                <th className="px-2 py-3 border border-gray-300 text-amber-600 bg-amber-100">Bị SỬA (Lỗi chủ quan)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {chatLuongXetXu.map((tp, idx) => (
                <tr key={idx} className="hover:bg-red-50/30 transition-all">
                   <td className="px-2 py-2 border border-gray-300 font-black text-blue-900 text-left">{tp.name}</td>
                   <td className="px-2 py-2 border border-gray-300 font-bold text-gray-700">{tp.tongAn}</td>
                   <td className="px-2 py-2 border border-gray-300 font-bold text-orange-600">{tp.biKhangCao}</td>
                   <td className="px-2 py-2 border border-gray-300 font-black text-red-600 text-lg bg-red-50/50">{tp.biHuy}</td>
                   <td className="px-2 py-2 border border-gray-300 font-black text-amber-600 text-lg bg-amber-50/50">{tp.biSua}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-500 italic font-bold mt-2">* Lưu ý: Bảng thống kê này chỉ tính những vụ án bị Hủy/Sửa do <b>Lỗi chủ quan</b> của Thẩm phán để làm cơ sở bình xét thi đua.</p>
        </div>
      </div>

        <div className="space-y-6">
          {completedByMonth.map((monthData, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
               <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                  <h4 className="font-black text-blue-950 text-sm uppercase">Tháng {monthData.month}</h4>
                  <span className="bg-green-100 text-green-800 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider border border-green-200">
                     Hoàn thành: {monthData.count} vụ
                  </span>
               </div>
               
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-gray-300 text-[12px]">
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {monthData.cases.map(item => (
                        <tr key={item.id} className="hover:bg-blue-50/30 transition-all">
                           <td className="px-2 py-2 border border-gray-300 text-[13px] font-bold text-blue-900 uppercase w-[40%] leading-tight">{item.caseName}</td>
                           <td className="px-2 py-2 border border-gray-300 text-[12px] text-gray-600 font-bold w-[20%]">{item.caseType} / {item.trialCount}</td>
                           <td className="px-2 py-2 border border-gray-300 text-[12px] text-gray-500 italic font-medium w-[25%]">👨‍⚖️ TP: {item.judge}</td>
                           <td className="px-2 py-2 border border-gray-300 text-[12px] text-right text-gray-500 font-bold w-[15%]">Ngày xử: {moment(item.datetime).format("DD/MM/YYYY")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
          ))}
          
          {completedByMonth.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-300 font-black text-2xl uppercase tracking-widest mb-2">Chưa có dữ liệu</p>
              <p className="text-gray-400 text-sm italic">Hệ thống sẽ tự động tổng hợp khi có vụ án được đánh dấu "Đã xử xong"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )}
  {activeTab === "news_admin" && (
        <QuanLyTinTuc />
      )}
      {activeTab === "post_news" && (
  <div className="animate-fadeIn space-y-6 max-w-4xl mx-auto">
    <div className="bg-white p-8 rounded-xl shadow-xl border border-gray-200">
      <h2 className="text-2xl font-black text-blue-900 uppercase mb-6 flex items-center gap-2">
        <span className="text-3xl">✍️</span> Đăng Tin Tức Mới
      </h2>
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-black uppercase text-gray-600 mb-2">Tiêu đề bản tin</label>
          <input type="text" value={newsForm.title} onChange={e => setNewsForm({...newsForm, title: e.target.value})} className={inputBase} placeholder="Nhập tiêu đề..." />
        </div>
        <div className="flex gap-4">
          <div className="w-1/3">
            <label className="block text-xs font-black uppercase text-gray-600 mb-2">Ngày đăng</label>
            <input type="date" value={newsForm.date} onChange={e => setNewsForm({...newsForm, date: e.target.value})} className={inputBase} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-black uppercase text-gray-600 mb-2">Nội dung</label>
          <textarea rows="5" value={newsForm.content} onChange={e => setNewsForm({...newsForm, content: e.target.value})} className={inputBase} placeholder="Nhập nội dung bản tin..." />
        </div>
        <button onClick={handlePostNews} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-lg uppercase shadow-lg transition-all">
          Đăng lên Cổng thông tin
        </button>
      </div>
    </div>
  </div>
)}

{activeTab === "manage_portal" && (
  <div className="space-y-10 max-w-5xl mx-auto animate-fadeIn">
    {/* FORM ĐĂNG VĂN BẢN */}
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
      <h3 className="font-black text-blue-900 uppercase mb-4 flex items-center gap-2">⚖️ Cập nhật Văn bản mới</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="text" id="docTitle" placeholder="Tên văn bản/nghị quyết..." className={inputBase} />
        <input type="text" id="docUrl" placeholder="Đường dẫn tải file (PDF/Drive)..." className={inputBase} />
        <button 
          onClick={async () => {
            const title = document.getElementById('docTitle').value;
            const fileUrl = document.getElementById('docUrl').value;
            if(title && fileUrl) {
              await addDoc(collection(db, "legal_docs"), { title, fileUrl, createdAt: moment().toISOString() });
              showToast("Đã thêm văn bản!");
            }
          }}
          className="md:col-span-2 bg-blue-600 text-white font-black py-3 rounded-lg uppercase"
        >
          Thêm vào danh sách
        </button>
      </div>
    </div>

    {/* FORM ĐĂNG LIÊN KẾT NHANH */}
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
      <h3 className="font-black text-gray-700 uppercase mb-4 flex items-center gap-2">🔗 Quản lý Liên kết nhanh</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="text" id="linkTitle" placeholder="Tên nút (VD: Án lệ điện tử)..." className={inputBase} />
        <input type="text" id="linkUrl" placeholder="Link web liên kết..." className={inputBase} />
        <button 
          onClick={async () => {
            const title = document.getElementById('linkTitle').value;
            const url = document.getElementById('linkUrl').value;
            if(title && url) {
              await addDoc(collection(db, "quick_links"), { title, url, order: quickLinks.length + 1 });
              showToast("Đã tạo liên kết!");
            }
          }}
          className="md:col-span-2 bg-gray-800 text-white font-black py-3 rounded-lg uppercase"
        >
          Tạo nút liên kết
        </button>
      </div>
    </div>
  </div>
)}
      {activeTab === "roles" && (
        <QuanLyPhanQuyen />
      )}
      {/* QUẢN LÝ CÔNG VIỆC THƯ KÝ */}
{activeTab === "tasks" && (
  <QuanLyCongViec 
     db={db} 
     userEmail={user?.email} 
     userRole={userRole} 
     clerksList={clerksList} 
     showToast={showToast} 
  />
)}
      
      {activeTab === "manage_portal" && (
  <QuanLyPortal db={db} userEmail={user?.email} showToast={showToast} />
)}
      {activeTab === "logs" && (
        <NhatKyThaoTac />
      )}
      {user && ( <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-[70px] z-[100] shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] pb-safe">
        
        <button 
          onClick={() => {
    setActiveTab("trial"); setViewMode("app"); // Dòng này cực kỳ quan trọng để ẩn Portal nè Ní
  }} 
          className={`flex flex-col items-center justify-center w-full h-full transition-all ${activeTab === 'trial' ? 'text-red-700 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <span className="text-2xl mb-1">{activeTab === 'trial' ? '⚖️' : '⚖️'}</span>
          <span className="text-[10px] font-black uppercase tracking-wider">Xét xử</span>
        </button>
        
        <button 
          onClick={() => {
    setActiveTab("inspection"); setViewMode("app");
  }} 
          className={`flex flex-col items-center justify-center w-full h-full transition-all ${activeTab === 'inspection' ? 'text-red-700 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <span className="text-2xl mb-1">{activeTab === 'inspection' ? '📍' : '📍'}</span>
          <span className="text-[10px] font-black uppercase tracking-wider">Thẩm định</span>
        </button>
        
        <button 
          onClick={() => {
    setActiveTab("report"); setViewMode("app");
  }} 
          className={`flex flex-col items-center justify-center w-full h-full transition-all ${activeTab === 'report' ? 'text-red-700 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <span className="text-2xl mb-1">{activeTab === 'report' ? '📊' : '📊'}</span>
          <span className="text-[10px] font-black uppercase tracking-wider">Báo cáo</span>
        </button>
        <button 
  onClick={() => {
    setActiveTab("news_admin"); 
    setViewMode("app"); 
  }} 
  className={`flex flex-col items-center justify-center w-full h-full transition-all ${activeTab === 'news_admin' ? 'text-red-700 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
>
  <span className="text-2xl mb-1">✍️</span> 
  <span className="text-[10px] font-black uppercase tracking-wider">Tin tức</span>
</button>

      </div> 
      )}
    </> /* Đóng thẻ Fragment của nhánh App */
  )} 
</div>
</main>

      {selectedEvent && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 py-10" onClick={() => setSelectedEvent(null)}>
     
     {/* KHUNG MODAL CHÍNH - Ép max-h-full để nó không bao giờ chui ra khỏi màn hình */}
     <div className="w-full max-w-lg flex flex-col bg-white rounded-[28px] shadow-2xl max-h-full overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* ========================================= */}
        {/* 1. HEADER (Màu đỏ) - Đứng im (shrink-0) */}
        {/* ========================================= */}
        <div className="p-6 md:p-8 bg-red-600 text-white shrink-0">
          <p className="text-xs font-black uppercase opacity-80 mb-2 tracking-widest">{selectedEvent.caseType} - {selectedEvent.trialCount}</p>
          <h3 className="text-xl md:text-2xl font-black uppercase leading-tight">{selectedEvent.caseName}</h3>
        </div>
        
        {/* ========================================= */}
        {/* 2. NỘI DUNG (Khúc này sẽ được cuộn) */}
        {/* ========================================= */}
        <div className="p-6 md:p-8 space-y-5 text-gray-900 font-bold overflow-y-auto custom-scrollbar flex-1">
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl shrink-0">🕒</div>
            <p className="text-lg font-black text-blue-950">{moment(selectedEvent.datetime).format("HH:mm - DD/MM/YYYY")}</p>
          </div>
          
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-2xl shrink-0">👥</div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Thông tin đương sự:</p>
              {selectedEvent.caseType?.includes("Hình sự") ? (
                <p className="text-base text-red-700 font-black">
                  Bị cáo: {selectedEvent.plaintiff || selectedEvent.defendant || "---"}
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-black text-gray-800">NĐ: {selectedEvent.plaintiff || "---"}</p>
                  <p className="text-sm font-black text-gray-800">BĐ: {selectedEvent.defendant || "---"}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl shrink-0">👨‍⚖️</div>
            <p className="text-lg">Thẩm phán: {selectedEvent.judge}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-2xl shrink-0">📝</div>
            <p className="text-lg">Thư ký: {selectedEvent.clerk}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl shrink-0">🛡️</div>
            <p className="text-lg text-red-700">KSV: {selectedEvent.prosecutor}</p>
          </div>
          
          {/* KHUNG DẤU VẾT VỤ ÁN DẠNG TIMELINE */}
          <div className="p-6 bg-slate-50 rounded-2xl border border-gray-200 mt-6">
            <p className="text-blue-900 font-black uppercase text-xs mb-4 tracking-widest flex items-center gap-2">
              <span className="text-lg">🕵️‍♂️</span> Diễn biến hồ sơ
            </p>
            <div className="relative border-l-2 border-blue-200 ml-3 space-y-5">
               
               <div className="relative pl-6">
                  <span className="absolute -left-[7px] top-1 bg-green-500 w-3 h-3 rounded-full shadow-[0_0_0_4px_#f8fafc]"></span>
                  <p className="text-xs font-black text-gray-800 uppercase">Khởi tạo lịch xét xử</p>
                  <p className="text-[10px] text-gray-500 mt-1">🕒 {selectedEvent.createdAt ? moment(selectedEvent.createdAt).format("HH:mm - DD/MM/YYYY") : "---"} • 👤 {selectedEvent.createdBy}</p>
               </div>

               {selectedEvent.isKhangCao && (
                 <div className="relative pl-6">
                    <span className="absolute -left-[7px] top-1 bg-orange-500 w-3 h-3 rounded-full shadow-[0_0_0_4px_#f8fafc]"></span>
                    <p className="text-xs font-black text-gray-800 uppercase">Ghi nhận Kháng cáo</p>
                    <p className="text-[10px] text-gray-500 mt-1">👤 Hệ thống • {selectedEvent.nguoiKhangCao}</p>
                 </div>
               )}

               {selectedEvent.status === 'completed' && (
                 <div className="relative pl-6">
                    <span className="absolute -left-[7px] top-1 bg-blue-600 w-3 h-3 rounded-full shadow-[0_0_0_4px_#f8fafc]"></span>
                    <p className="text-xs font-black text-blue-700 uppercase">Đã xét xử xong</p>
                    <p className="text-[10px] text-gray-500 mt-1">🕒 {selectedEvent.completedAt ? moment(selectedEvent.completedAt).format("HH:mm - DD/MM/YYYY") : "---"}</p>
                 </div>
               )}

               {selectedEvent.status === 'dinh_chi' && (
                 <div className="relative pl-6">
                    <span className="absolute -left-[7px] top-1 bg-red-600 w-3 h-3 rounded-full shadow-[0_0_0_4px_#f8fafc]"></span>
                    <p className="text-xs font-black text-red-700 uppercase">Đã Đình chỉ vụ án</p>
                    <p className="text-[10px] text-gray-500 mt-1">Lý do: {selectedEvent.lyDoDinhChi}</p>
                 </div>
               )}
               
               <div className="relative pl-6">
                  <span className="absolute -left-[7px] top-1 bg-gray-400 w-3 h-3 rounded-full shadow-[0_0_0_4px_#f8fafc]"></span>
                  <p className="text-xs font-black text-gray-600 uppercase">Cập nhật cuối</p>
                  <p className="text-[10px] text-gray-500 mt-1">🕒 {selectedEvent.updatedAt ? moment(selectedEvent.updatedAt).format("HH:mm - DD/MM/YYYY") : "---"} • 👤 {selectedEvent.updatedBy || "Chưa có thay đổi"}</p>
               </div>
            </div>
          </div>

        </div>

        {/* ========================================= */}
        {/* 3. FOOTER (Nút Đóng) - Đứng im dưới cùng */}
        {/* ========================================= */}
        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
           <button onClick={() => setSelectedEvent(null)} className="w-full bg-blue-900 hover:bg-black text-white py-4 font-black uppercase rounded-xl transition-colors">ĐÓNG</button>
        </div>
        
     </div>
  </div>
)}
      {showLoginModal && !user && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative z-10 w-full max-w-[480px] p-8 md:p-10 text-center animate-popIn" style={{ background: 'rgba(20, 30, 70, 0.95)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)' }}>
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-5 text-white/50 hover:text-red-500 text-2xl font-black transition-colors">✕</button>
            <img src="/lgtoaan1.png" alt="Logo" className="mx-auto mb-4 drop-shadow-2xl w-24 h-24 object-contain" />
            <p className="text-[14px] md:text-base font-black uppercase mb-1 tracking-tight text-red-500 drop-shadow-md">HỆ THỐNG NỘI BỘ</p>
            <h1 className="text-[18px] md:text-xl font-black uppercase mb-8 tracking-tight text-yellow-400 drop-shadow-md">ĐĂNG NHẬP CÁN BỘ</h1>
            <form onSubmit={handleLogin} className="space-y-5 flex flex-col items-center">
              <input type="email" placeholder="Email cán bộ..." value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-[90%] px-5 py-3 outline-none text-sm font-bold placeholder-gray-400 text-center transition-all focus:border-blue-400 bg-white text-blue-900 rounded-lg shadow-inner" required />
              <input type="password" placeholder="Mật khẩu..." value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-[90%] px-5 py-3 outline-none text-sm font-bold placeholder-gray-400 text-center transition-all focus:border-blue-400 bg-white text-blue-900 rounded-lg shadow-inner" required />
              {loginError && (<p className="text-red-400 text-xs font-bold mt-2 bg-red-900/20 py-2 px-4 rounded border border-red-500/30 animate-shake">{loginError}</p>)}
              <button type="submit" onClick={() => setTimeout(() => setShowLoginModal(false), 1500)} className="w-[90%] py-3 mt-4 font-black uppercase text-sm transition-all bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg active:scale-95">{loading ? "ĐANG KIỂM TRA..." : "ĐĂNG NHẬP"}</button>
            </form>
          </div>
        </div>
      )}

      {showPwdModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowPwdModal(false)}>
           <div className="w-full max-md bg-white rounded-[28px] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-8 bg-blue-900 text-white text-center font-black uppercase tracking-widest">🔑 ĐỔI MẬT KHẨU</div>
              <form onSubmit={handleChangePassword} className="p-8 space-y-6">
                <div><label className="block text-xs font-black text-gray-600 uppercase mb-2">Mật khẩu mới</label><input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required className="w-full border-2 border-gray-100 p-4 bg-gray-50 outline-none focus:border-blue-500 font-bold text-gray-900 rounded-xl" minLength={6} /></div>
                <div><label className="block text-xs font-black text-gray-600 uppercase mb-2">Xác nhận mật khẩu</label><input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required className="w-full border-2 border-gray-100 p-4 bg-gray-50 outline-none focus:border-blue-500 font-bold text-gray-900 rounded-xl" minLength={6} /></div>
                <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowPwdModal(false)} className="w-1/2 bg-gray-200 text-gray-700 font-black py-4 uppercase rounded-xl">HỦY</button><button type="submit" className="w-1/2 bg-blue-600 text-white font-black py-4 uppercase rounded-xl">LƯU</button></div>
              </form>
           </div>
        </div>
      )}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setShowExportModal(false)}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 bg-green-700 text-white text-center">
                  <h3 className="font-black uppercase text-xl tracking-widest">📊 Tùy Chọn Xuất Excel</h3>
                  <p className="text-[11px] font-medium mt-1 opacity-80 uppercase">Chọn khoảng thời gian xét xử cần trích xuất</p>
              </div>
              <div className="p-8 space-y-6">
                  <div>
                    <label className="block text-xs font-black text-gray-600 uppercase mb-2">Tiêu chí lọc</label>
                    <select 
                      value={exportFilterType} 
                      onChange={e => setExportFilterType(e.target.value)} 
                      className="w-full border-2 border-green-100 p-3 bg-green-50 outline-none focus:border-green-500 font-bold text-green-900 rounded-xl cursor-pointer"
                    >
                      <option value="datetime">📌 Lọc theo Ngày Xét Xử (Án đã đem ra xử)</option>
                      <option value="createdAt">📥 Lọc theo Ngày Nhập Lịch (Án mới thụ lý)</option>
                    </select>
                  </div>
                    <div>
                    <label className="block text-xs font-black text-gray-600 uppercase mb-2">Từ ngày</label>
                    <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="w-full border-2 border-gray-200 p-3 bg-gray-50 outline-none focus:border-green-500 font-bold text-gray-900 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-600 uppercase mb-2">Đến ngày</label>
                    <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="w-full border-2 border-gray-200 p-3 bg-gray-50 outline-none focus:border-green-500 font-bold text-gray-900 rounded-xl" />
                  </div>
                  <div className="pt-2">
                    <label className="flex items-center gap-3 cursor-pointer bg-green-50 p-3 rounded-lg border border-green-200">
                      <input 
                        type="checkbox" 
                        checked={exportUnexportedOnly} 
                        onChange={e => setExportUnexportedOnly(e.target.checked)} 
                        className="w-5 h-5 accent-green-600" 
                      />
                      <span className="text-[11px] font-black text-green-800 uppercase tracking-wide">
                        Lọc bỏ những vụ án đã từng xuất Excel
                      </span>
                    </label>
                  </div>
                  <div className="flex gap-4 pt-2">
                    <button type="button" onClick={() => setShowExportModal(false)} className="w-1/2 bg-gray-200 text-gray-700 font-black py-4 uppercase rounded-xl hover:bg-gray-300 transition-colors">HỦY BỎ</button>
                    <button type="button" onClick={executeExport} className="w-1/2 bg-green-600 text-white font-black py-4 uppercase rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/30">XUẤT FILE</button>
                  </div>
              </div>
            </div>
        </div>
      )}
      {showTVMode && (
  <div className="fixed inset-0 bg-slate-950 z-[1000] flex flex-col text-white overflow-hidden font-sans">
    <div className="p-4 md:p-10 border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-4 md:gap-6">
        <img src="/lgtoaan1.png" className="w-12 h-12 md:w-24 md:h-24 object-contain" />
        <div>
          <h1 className="text-lg md:text-4xl font-extralight uppercase tracking-[0.2em] leading-none mb-1 md:mb-3">Lịch Xét Xử</h1>
          <p className="text-[10px] md:text-2xl text-blue-400 font-light uppercase tracking-widest">
            {moment().locale('vi').format("dddd, [Ngày] DD [Tháng] MM [Năm] YYYY")}
          </p>
        </div>
      </div>
      <button onClick={() => setShowTVMode(false)} className="w-10 h-10 md:w-auto md:px-8 md:py-4 bg-red-600/20 md:bg-red-600 rounded-full md:rounded-xl text-red-500 md:text-white font-black hover:bg-red-700 transition-all flex items-center justify-center">
        <span className="md:hidden text-xl">✕</span>
        <span className="hidden md:inline">THOÁT X</span>
      </button>
    </div>

    <div ref={tvScrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-4 custom-scrollbar">
      {schedule
        .filter(i => moment(i.datetime).isSame(moment(), 'day'))
        .sort((a,b) => moment(a.datetime).diff(moment(b.datetime)))
        .map(item => (
          <div key={item.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-8 space-y-3 md:grid md:grid-cols-4 md:gap-6 md:items-center">
           <div className="flex justify-between items-center md:block md:text-center">
  <span className="text-2xl md:text-5xl font-bold text-blue-500">{moment(item.datetime).format("HH:mm")}</span>
  
  <span className={`md:mt-4 block px-3 py-1 rounded-full text-[10px] md:text-sm font-bold uppercase ${
    item.status === 'completed' 
      ? 'bg-green-500/20 text-green-400' 
      : moment().isBefore(moment(item.datetime)) 
        ? 'bg-blue-500/20 text-blue-400' 
        : 'bg-amber-500/20 text-amber-400 animate-pulse' 
  }`}>
    {item.status === 'completed' 
      ? 'Đã xong' 
      : moment().isBefore(moment(item.datetime)) 
        ? 'Đang chờ' 
        : 'Đang xử'}
  </span>
</div>
            
            <div className="md:col-span-2">
  <h3 className="text-sm md:text-3xl font-bold uppercase leading-tight text-gray-100 mb-2">
    {item.caseName}
  </h3>
  
  <div className="text-[10px] md:text-lg text-blue-300 font-medium mb-3">
    {item.caseType?.includes("Hình sự") ? (
  <>
    <span className="opacity-70">Bị cáo:</span> {item.plaintiff || item.defendant || "---"}
  </>
) : (item.caseType === "cainghien" || item.caseType?.includes("Cai nghiện") || item.caseType?.includes("Hành chính")) ? (
  <>
    <span className="opacity-70">Cơ quan ĐN:</span> {item.plaintiff || "---"} 
    <span className="mx-2 opacity-50">|</span> 
    <span className="opacity-70">Người bị ĐN:</span> {item.defendant || "---"}
  </>
) : (
  <>
    <span className="opacity-70">NĐ:</span> {item.plaintiff || "---"} 
    <span className="mx-2 opacity-50">|</span> 
    <span className="opacity-70">BĐ:</span> {item.defendant || "---"}
  </>
)}
  </div>

  <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-[11px] md:text-xl text-gray-400 font-light italic">
    <span>👨‍⚖️ TP: {item.judge}</span>
    <span>📝 TK: {item.clerk}</span>
    <span className="hidden md:inline">|</span>
    <span>📍 Phòng: {item.room}</span>
  </div>
</div>
            
            {/* CỘT BÊN PHẢI CỦA GIAO DIỆN TIVI: THƯ KÝ VÀ NÚT GỌI LOA */}
            <div className="hidden md:flex flex-col items-end gap-3 w-max">
               <span className="bg-white/10 px-6 py-3 rounded-lg text-xl uppercase font-black tracking-widest text-blue-200 border border-blue-500/30">
                  {item.clerk}
               </span>
               
               {/* NÚT BẤM GỌI LOA ĐƯƠNG SỰ */}
               <button 
                  onClick={() => docTenDuongSu(item)} 
                  className="bg-amber-600/30 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/50 px-6 py-3 rounded-lg uppercase font-black tracking-widest transition-all flex items-center gap-2 active:scale-95 cursor-pointer shadow-lg"
                  title="Phát thanh gọi tên đương sự"
               >
                  <span className="text-2xl animate-pulse">📢</span> GỌI ĐƯƠNG SỰ
               </button>
            </div>
          </div>
        ))}

      {schedule.filter(i => moment(i.datetime).isSame(moment(), 'day')).length === 0 && (
        <div className="h-full flex items-center justify-center opacity-20">
          <p className="text-2xl md:text-6xl font-black uppercase tracking-[0.5em] text-center">Hôm nay không có lịch xét xử</p>
        </div>
      )}
    </div>

    <div className="p-4 md:p-8 text-center border-t border-white/5">
      <p className="text-[9px] md:text-xl text-gray-600 font-light uppercase tracking-widest animate-pulse">Hệ thống cập nhật dữ liệu tự động...</p>
    </div>
  </div>
)}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-[200] px-8 py-4 shadow-2xl font-black text-white rounded-xl ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-950'}`}>
          {toast.message}
        </div>
      )}
      </div> 
  ); 
}

function QuanLyPhanQuyen() {
  const [users, React_useState] = React.useState([]);
  const [loading, React_setLoading] = React.useState(true);
  const [showAddModal, setShowAddModal] = React.useState(false); 

  const [newInfo, setNewInfo] = React.useState({ hoTen: "", email: "", password: "" });
  const [editingUserId, setEditingUserId] = React.useState(null); 
  const [editingName, setEditingName] = React.useState("");
  const DANH_SACH_QUYEN = [
    { maQuyen: "chanhan", tenQuyen: "Chánh án" }, 
    { maQuyen: "thu_ky", tenQuyen: "Thư ký" },
    { maQuyen: "tham_phan", tenQuyen: "Thẩm phán" },
    { maQuyen: "admin", tenQuyen: "Quản trị viên" }
  ];

  const taiDuLieu = async () => {
    const { collection, getDocs } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const snapshot = await getDocs(collection(db, "users"));
    React_useState(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    React_setLoading(false);
  };

  React.useEffect(() => { taiDuLieu(); }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newInfo.email || !newInfo.hoTen) return alert("Điền đủ tên và email nhé bạn!");

    try {
      const { setDoc, doc } = await import('firebase/firestore');
      const { db, auth } = await import('./firebase');
      const { createUserWithEmailAndPassword } = await import('firebase/auth');

      try {
        await createUserWithEmailAndPassword(auth, newInfo.email, newInfo.password || "Toaan@123");
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use') {
          console.log("Tài khoản đã có trên Auth, chỉ tiến hành tạo hồ sơ quyền.");
        }
      }

      const docId = newInfo.email.replace(/\./g, '_'); 
      await setDoc(doc(db, "users", docId), {
        hoTen: newInfo.hoTen,
        email: newInfo.email.toLowerCase(),
        roles: ["thu_ky"], 
        createdAt: new Date().toISOString()
      });

      alert("✅ Đã đồng bộ cán bộ thành công!");
      setShowAddModal(false);
      setNewInfo({ hoTen: "", email: "", password: "" });
      taiDuLieu(); 
    } catch (error) {
      alert("❌ Lỗi: " + error.message);
    }
  };

  const xuLyDoiQuyen = async (idNhanVien, danhSachQuyenHienTai, maQuyenVuaBam, laDangTick) => {
    let rolesMoi = laDangTick ? [...(danhSachQuyenHienTai || []), maQuyenVuaBam] : (danhSachQuyenHienTai || []).filter(r => r !== maQuyenVuaBam);
    React_useState(users.map(u => u.id === idNhanVien ? { ...u, roles: rolesMoi } : u));
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      await updateDoc(doc(db, "users", idNhanVien), { roles: rolesMoi });
    } catch (e) { alert("Lưu thất bại!"); }
  };

  const handleSaveName = async (idNhanVien) => {
    if (!editingName.trim()) return alert("Tên không được để trống bạn ơi!");
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      
      await updateDoc(doc(db, "users", idNhanVien), { hoTen: editingName });
      
      React_useState(users.map(u => u.id === idNhanVien ? { ...u, hoTen: editingName } : u));
      
      setEditingUserId(null); 
    } catch (error) {
      alert("❌ Lưu thất bại: " + error.message);
    }
  };
  if (loading) return <div className="p-10 text-center text-blue-600 font-bold">⏳ Đang đồng bộ...</div>;

const handleResetUserPassword = async (emailCanBo) => {
    const xacNhan = window.confirm(`Bạn có chắc muốn gửi Email đặt lại mật khẩu cho tài khoản: ${emailCanBo} không?`);
    if (!xacNhan) return;

    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('./firebase');
      
      await sendPasswordResetEmail(auth, emailCanBo);
      alert(`✅ Đã gửi Link đặt lại mật khẩu thành công!\n\nCán bộ vui lòng mở hộp thư email (${emailCanBo}) để nhập mật khẩu mới.`);
    } catch (error) {
      alert("❌ Lỗi gửi email: " + error.message);
    }
  };
  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-slate-800 p-6 rounded-2xl text-white shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase">Cán bộ hệ thống</h2>
          <p className="opacity-70 text-[10px] font-bold uppercase tracking-widest">Danh sách nhân sự & Phân quyền</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg transition-all active:scale-95"
        >
          ➕ THÊM CÁN BỘ
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <table className="min-w-full text-left border-collapse border border-gray-300 text-[12px]">
          <thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-gray-300">
            <tr>
              <th className="px-2 py-2 border border-gray-300">Cán bộ</th>
              <th className="px-2 py-2 border border-gray-300">Quyền hạn (Tick để cấp quyền)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-2 py-2 border border-gray-300">
                  {editingUserId === u.id ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input 
                        type="text" 
                        value={editingName} 
                        onChange={(e) => setEditingName(e.target.value)}
                        className="border-2 border-blue-400 rounded-md px-2 py-1 text-sm font-bold text-blue-900 outline-none w-full shadow-inner"
                        autoFocus
                      />
                      <button onClick={() => handleSaveName(u.id)} className="bg-green-500 hover:bg-green-600 text-white p-1 rounded-sm text-[10px] shadow-sm" title="Lưu">💾</button>
                      <button onClick={() => setEditingUserId(null)} className="bg-gray-300 hover:bg-gray-400 text-gray-700 p-1 rounded-sm text-[10px] shadow-sm" title="Hủy">❌</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group mb-1">
                      <p className="font-black text-blue-950 capitalize text-[13px]">{u.hoTen}</p>
                      <button 
                        onClick={() => { setEditingUserId(u.id); setEditingName(u.hoTen); }} 
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-500 transition-all cursor-pointer"
                        title="Sửa tên cán bộ"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                  
                  <p className="text-[11px] text-gray-500 font-bold mb-2">{u.email}</p>
                  <button 
                    onClick={() => handleResetUserPassword(u.email)}
                    className="bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 px-2 py-1 rounded-sm text-[9px] font-black uppercase transition-all shadow-sm flex items-center gap-1 w-max"
                    title="Gửi link khôi phục mật khẩu vào email này"
                  >
                    🔄 Khôi phục MK
                  </button>
                </td>
                <td className="px-2 py-2 border border-gray-300">
                  <div className="flex gap-4">
                    {DANH_SACH_QUYEN.map((q) => {
                      const isActive = (u.roles || []).includes(q.maQuyen);
                      return (
                        <label key={q.maQuyen} className="flex items-center gap-2 cursor-pointer bg-white border px-2 py-1.5 rounded-sm hover:shadow-sm">
                          <input type="checkbox" checked={isActive} onChange={(e) => xuLyDoiQuyen(u.id, u.roles, q.maQuyen, e.target.checked)} className="w-3 h-3 accent-blue-600" />
                          <span className={`text-[10px] font-black uppercase ${isActive ? 'text-blue-700' : 'text-gray-400'}`}>{q.tenQuyen}</span>
                        </label>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-popIn">
            <div className="bg-blue-900 p-6 text-white text-center">
              <h3 className="font-black uppercase tracking-widest">Thêm Cán Bộ Mới</h3>
            </div>
            <form onSubmit={handleAddUser} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Họ và Tên</label>
                <input type="text" value={newInfo.hoTen} onChange={e => setNewInfo({...newInfo, hoTen: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-xl outline-none focus:border-blue-500 font-bold" placeholder="VD: Nguyễn Văn A" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Email đăng nhập</label>
                <input type="email" value={newInfo.email} onChange={e => setNewInfo({...newInfo, email: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-xl outline-none focus:border-blue-500 font-bold" placeholder="email@toaan.gov.vn" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Mật khẩu (Mặc định)</label>
                <input type="text" value={newInfo.password} onChange={e => setNewInfo({...newInfo, password: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-xl outline-none focus:border-blue-500 font-bold" placeholder="Toaan@123" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="w-1/2 py-4 font-black uppercase text-xs text-gray-400 bg-gray-100 rounded-xl">Hủy</button>
                <button type="submit" className="w-1/2 py-4 font-black uppercase text-xs text-white bg-blue-600 rounded-xl shadow-lg">Lưu hồ sơ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
// =========================================================================
// COMPONENT: NHẬT KÝ THAO TÁC HỆ THỐNG
// =========================================================================
function NhatKyThaoTac() {
  const [logs, React_useState] = React.useState([]);
  const [loading, React_setLoading] = React.useState(true);

  React.useEffect(() => {
    const taiNhatKy = async () => {
      try {
        const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        const q = query(collection(db, "logs"), orderBy("thoiGian", "desc"), limit(100));
        const dataSnapshot = await getDocs(q);
        React_useState(dataSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        React_setLoading(false);
      } catch (error) {
        console.error("Lỗi tải nhật ký:", error);
        React_setLoading(false);
      }
    };
    taiNhatKy();
  }, []);

  if (loading) return <div className="p-10 text-center font-bold text-xl text-blue-600 animate-pulse">⏳ Đang trích xuất nhật ký...</div>;

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-amber-800 p-6 rounded-2xl text-white shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase">Nhật Ký Hệ Thống</h2>
          <p className="opacity-70 text-[10px] font-bold uppercase tracking-widest">Lưu vết 100 thao tác gần nhất</p>
        </div>
        <div className="text-3xl">🕵️‍♂️</div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <table className="min-w-full text-left border-collapse border border-gray-300 text-[12px]">
          <thead className="bg-amber-50 text-[11px] font-black uppercase text-amber-900 border-b border-gray-300">
            <tr>
              <th className="px-2 py-2 border border-gray-300 w-[20%] text-center">Thời gian</th>
              <th className="px-2 py-2 border border-gray-300 w-[20%]">Người thực hiện</th>
              <th className="px-2 py-2 border border-gray-300 w-[20%] text-center">Thao tác</th>
              <th className="px-2 py-2 border border-gray-300 w-[40%]">Chi tiết vụ việc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => {
              const thoiGianStr = log.thoiGian ? new Date(log.thoiGian).toLocaleString('vi-VN') : "---";
              return (
                <tr key={log.id} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-2 py-2 border border-gray-300 text-center text-xs font-bold text-gray-500">{thoiGianStr}</td>
                  <td className="px-2 py-2 border border-gray-300 text-xs font-black text-blue-800">{log.nguoiThucHien}</td>
                  <td className="px-2 py-2 border border-gray-300 text-center">
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-sm border ${
                      log.hanhDong.includes('Xóa') ? 'bg-red-100 text-red-700 border-red-200' :
                      log.hanhDong.includes('Thêm') ? 'bg-green-100 text-green-700 border-green-200' :
                      log.hanhDong.includes('Cập nhật') ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      {log.hanhDong}
                    </span>
                  </td>
                  <td className="px-2 py-2 border border-gray-300 text-[11px] font-bold text-gray-700">{log.chiTiet}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {logs.length === 0 && <div className="p-10 text-center text-gray-400 font-bold uppercase italic">Hệ thống chưa ghi nhận thao tác nào</div>}
      </div>
    </div>
  );
}

// =========================================================================
// COMPONENT: QUẢN TRỊ TRANG CHỦ PORTAL (ĐĂNG & XÓA)
// =========================================================================
function QuanLyPortal({ db, userEmail, showToast }) {
  // State Form Văn Bản & Liên Kết Nhanh
  const [docTitle, setDocTitle] = React.useState("");
  const [docUrl, setDocUrl] = React.useState("");
  const [linkTitle, setLinkTitle] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  
  // State Danh sách hiển thị để xóa
  const [listDocs, setListDocs] = React.useState([]);
  const [listLinks, setListLinks] = React.useState([]);

  const inputStyle = "w-full border border-gray-300 rounded-md px-4 py-3 bg-gray-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm font-bold text-gray-800";

  // Tải dữ liệu Real-time hệ thống văn bản và liên kết ngoài
  React.useEffect(() => {
    let unsubDocs, unsubLinks;
    const loadData = async () => {
      const { collection, query, orderBy, onSnapshot } = await import('firebase/firestore');
      
      // Tải danh sách văn bản tố tụng
      unsubDocs = onSnapshot(query(collection(db, "legal_docs"), orderBy("createdAt", "desc")), (snap) => {
        setListDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      // Tải danh sách liên kết nhanh
      unsubLinks = onSnapshot(query(collection(db, "quick_links"), orderBy("order", "asc")), (snap) => {
        setListLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    };
    loadData();
    return () => { if(unsubDocs) unsubDocs(); if(unsubLinks) unsubLinks(); }
  }, [db]);

  // HÀM XÓA DỮ LIỆU CHUNG
  const handleDelete = async (collectionName, id) => {
    if (window.confirm("⚠️ Bạn có chắc chắn muốn xóa mục này không? Xóa xong không lấy lại được đâu nhé!")) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, collectionName, id));
        showToast("🗑️ Đã xóa thành công!");
      } catch (e) {
        showToast("Lỗi khi xóa: " + e.message, "error");
      }
    }
  };

  // HÀM THÊM VĂN BẢN MỚI
  const handleAddDoc = async () => {
    if (!docTitle || !docUrl) return showToast("Vui lòng nhập Tên văn bản và Link tải!", "error");
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      await addDoc(collection(db, "legal_docs"), { title: docTitle, fileUrl: docUrl, createdAt: moment().toISOString() });
      showToast("✅ Đã thêm văn bản thành công!");
      setDocTitle(""); setDocUrl(""); 
    } catch (e) { showToast("Lỗi thêm văn bản: " + e.message, "error"); }
  };

  // HÀM THÊM NÚT LIÊN KẾT NHANH
  const handleAddLink = async () => {
    if (!linkTitle || !linkUrl) return showToast("Vui lòng nhập Tên nút và Link web!", "error");
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      await addDoc(collection(db, "quick_links"), { title: linkTitle, url: linkUrl, order: listLinks.length + 1 });
      showToast("✅ Đã tạo nút liên kết thành công!");
      setLinkTitle(""); setLinkUrl(""); 
    } catch (e) { showToast("Lỗi tạo liên kết: " + e.message, "error"); }
  };

  return (
    <div className="animate-fadeIn space-y-8 max-w-6xl mx-auto pb-10">
      {/* THANH TIÊU ĐỀ KHU VỰC QUẢN TRỊ NỘI BỘ */}
      <div className="bg-red-800 p-6 rounded-2xl text-white shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase">Hệ Thống Quản Trị Nội Bộ</h2>
          <p className="opacity-70 text-[10px] font-bold uppercase tracking-widest">Thiết lập văn bản & Tiện ích liên kết nhanh cho cán bộ</p>
        </div>
        <div className="text-3xl">🛡️</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* 1. QUẢN LÝ VĂN BẢN PHÁP LUẬT */}
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 flex flex-col">
          <h3 className="font-black text-blue-900 uppercase mb-6 flex items-center gap-2 border-b pb-3"><span className="text-2xl">⚖️</span> Quản Lý Văn Bản Ngành</h3>
          <div className="space-y-4 mb-6">
            <input type="text" value={docTitle} onChange={e => setDocTitle(e.target.value)} className={inputStyle} placeholder="Tên văn bản (VD: Nghị quyết 04/2016...)" />
            <input type="url" value={docUrl} onChange={e => setDocUrl(e.target.value)} className={inputStyle} placeholder="Link liên kết hoặc link tải file..." />
            <button onClick={handleAddDoc} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl uppercase shadow-md active:scale-95 transition-all">Thêm Văn Bản</button>
          </div>
          <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-200 max-h-60 overflow-y-auto">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Văn bản hiện có ({listDocs.length})</p>
            {listDocs.map(item => (
              <div key={item.id} className="flex justify-between items-center p-2 mb-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                <p className="text-xs font-bold text-gray-800 truncate pr-2">{item.title}</p>
                <button onClick={() => handleDelete("legal_docs", item.id)} className="text-red-500 hover:bg-red-100 p-1 rounded">❌</button>
              </div>
            ))}
          </div>
        </div>

        {/* 2. QUẢN LÝ LIÊN KẾT NHANH */}
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 flex flex-col">
          <h3 className="font-black text-gray-700 uppercase mb-6 flex items-center gap-2 border-b pb-3"><span className="text-2xl">🔗</span> Liên Kết Nhanh Hệ Thống</h3>
          <div className="space-y-4 mb-6">
            <input type="text" value={linkTitle} onChange={e => setLinkTitle(e.target.value)} className={inputStyle} placeholder="Tên nút (VD: Án lệ điện tử...)" />
            <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className={inputStyle} placeholder="Đường dẫn trang web..." />
            <button onClick={handleAddLink} className="w-full bg-gray-800 hover:bg-black text-white font-black py-3 rounded-xl uppercase shadow-md active:scale-95 transition-all">Tạo Nút Liên Kết</button>
          </div>
          <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-200 max-h-60 overflow-y-auto">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Nút liên kết hiện có ({listLinks.length})</p>
             {listLinks.map(item => (
              <div key={item.id} className="flex justify-between items-center p-2 mb-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                <p className="text-xs font-bold text-gray-800 truncate pr-2">{item.title}</p>
                <button onClick={() => handleDelete("quick_links", item.id)} className="text-red-500 hover:bg-red-100 p-1 rounded">❌</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
// =========================================================================
// COMPONENT: QUẢN LÝ THẨM PHÁN (THÊM, SỬA, XÓA & TÙY CHỈNH ĐỊNH MỨC %)
// =========================================================================
function QuanLyThamPhan({ db, showToast }) {
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("Thẩm phán");
  const [weight, setWeight] = React.useState(100); // Thêm state quản lý % định mức
  const [listJudges, setListJudges] = React.useState([]);
  const [editingJudgeId, setEditingJudgeId] = React.useState(null); 

  const [tonCuChiTiet, setTonCuChiTiet] = React.useState({
    "Hình sự": 0, "Dân sự": 0, "Hành chính": 0, "Hôn nhân & GĐ": 0, "Kinh tế": 0, "Lao động": 0, "Cai nghiện": 0
  });

  React.useEffect(() => {
    const loadJudges = async () => {
      const { collection, onSnapshot, query, orderBy } = await import('firebase/firestore');
      const q = query(collection(db, "judges"), orderBy("createdAt", "desc"));
      onSnapshot(q, (snap) => {
        setListJudges(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    };
    loadJudges();
  }, [db]);

  // Tự động nhảy % mặc định khi chọn chức vụ (nhưng vẫn cho phép sửa lại bằng tay)
  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setRole(newRole);
    if (newRole === "Chánh án") setWeight(30);
    else if (newRole === "Phó Chánh án") setWeight(60);
    else setWeight(100);
  };

  const handleEditClick = (judge) => {
    setEditingJudgeId(judge.id);
    setName(judge.name);
    setRole(judge.role || "Thẩm phán");
    setWeight(judge.weight ? Math.round(judge.weight * 100) : 100); // Phục hồi số %
    setTonCuChiTiet(judge.tonCuChiTiet || {
      "Hình sự": 0, "Dân sự": 0, "Hành chính": 0, "Hôn nhân & GĐ": 0, "Kinh tế": 0, "Lao động": 0, "Cai nghiện": 0
    });
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleCancelEdit = () => {
    setEditingJudgeId(null);
    setName("");
    setRole("Thẩm phán");
    setWeight(100); // Trả về mặc định
    setTonCuChiTiet({ "Hình sự": 0, "Dân sự": 0, "Hành chính": 0, "Hôn nhân & GĐ": 0, "Kinh tế": 0, "Lao động": 0, "Cai nghiện": 0 });
  };

  const handleSaveJudge = async () => {
    if (!name) return showToast("Nhập tên Thẩm phán bạn ơi!", "error");
    if (weight <= 0 || weight > 100) return showToast("Định mức phải từ 1 đến 100%!", "error");

    const tongTonCu = Object.values(tonCuChiTiet).reduce((acc, val) => acc + (parseInt(val) || 0), 0);

    try {
      const { collection, addDoc, doc, updateDoc } = await import('firebase/firestore');
      
      const data = {
        name,
        role,
        weight: parseFloat(weight) / 100, // Đổi % ra số thập phân cho AI tính toán (vd: 60 -> 0.6)
        tonCuChiTiet,
        tonCu: tongTonCu,
        updatedAt: new Date().toISOString()
      };

      if (editingJudgeId) {
        await updateDoc(doc(db, "judges", editingJudgeId), data);
        showToast("✅ Đã cập nhật thông tin Thẩm phán!");
      } else {
        await addDoc(collection(db, "judges"), { ...data, createdAt: new Date().toISOString() });
        showToast("✅ Đã thêm Thẩm phán mới!");
      }

      handleCancelEdit(); 
    } catch (e) { showToast("Lỗi: " + e.message, "error"); }
  };

  const handleDeleteJudge = async (id, judgeName) => {
    if (window.confirm(`⚠️ Bạn có chắc muốn xóa Thẩm phán ${judgeName} không?`)) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, "judges", id));
        showToast("🗑️ Đã xóa Thẩm phán!");
      } catch (e) { showToast("Lỗi xóa: " + e.message, "error"); }
    }
  };

  const handleTonCuChange = (type, value) => {
    setTonCuChiTiet(prev => ({ ...prev, [type]: parseInt(value) || 0 }));
  };

  const currentTotal = Object.values(tonCuChiTiet).reduce((acc, val) => acc + (parseInt(val) || 0), 0);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200 animate-fadeIn max-w-5xl mx-auto">
      <h3 className="font-black text-blue-900 uppercase mb-6 flex items-center gap-2">
        {editingJudgeId ? "✏️ Chỉnh sửa thông tin Thẩm phán" : "⚖️ Cấu hình Thẩm phán & Án thụ lý"}
      </h3>
      
      <div className={`mb-8 p-6 rounded-xl border shadow-inner transition-all ${editingJudgeId ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'}`}>
        
        {/* THÊM CỘT NHẬP % ĐỊNH MỨC VÀO ĐÂY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-xs font-black uppercase text-blue-800 mb-2">Tên Thẩm phán</label>
            <input type="text" placeholder="Nhập họ tên..." value={name} onChange={e => setName(e.target.value)} className="w-full border p-3 rounded-lg font-bold outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-blue-800 mb-2">Chức vụ</label>
            <select value={role} onChange={handleRoleChange} className="w-full border p-3 rounded-lg font-bold outline-none focus:border-blue-500">
              <option value="Chánh án">Chánh án</option>
              <option value="Phó Chánh án">Phó Chánh án</option>
              <option value="Thẩm phán">Thẩm phán</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-blue-800 mb-2">Định mức giải quyết (%)</label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="100" value={weight} onChange={e => setWeight(e.target.value)} className="w-full border p-3 rounded-lg font-black text-blue-900 outline-none focus:border-blue-500 text-center" />
              <span className="font-black text-blue-800">%</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <label className="text-xs font-black uppercase text-red-600">Số lượng án đang thụ lý (Cập nhật chuẩn nhất)</label>
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black">Tổng: {currentTotal} vụ</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.keys(tonCuChiTiet).map(type => (
              <div key={type} className="flex flex-col bg-gray-50 border rounded-md px-3 py-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase mb-1">{type}</span>
                <input type="number" min="0" value={tonCuChiTiet[type] === 0 ? '' : tonCuChiTiet[type]} onChange={e => handleTonCuChange(type, e.target.value)} className="w-full bg-transparent font-black text-blue-900 outline-none text-right text-lg" placeholder="0" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          {editingJudgeId && (
            <button onClick={handleCancelEdit} className="flex-1 bg-gray-200 text-gray-700 font-black py-4 rounded-lg uppercase tracking-widest text-sm">Hủy bỏ</button>
          )}
          <button onClick={handleSaveJudge} className={`flex-[2] text-white font-black py-4 rounded-lg uppercase tracking-widest shadow-lg transition-all ${editingJudgeId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {editingJudgeId ? "Cập nhật dữ liệu" : "Lưu cấu hình thẩm phán"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listJudges.map(j => (
          <div key={j.id} className="p-4 border border-gray-200 rounded-xl flex justify-between items-center bg-gray-50 group hover:border-blue-300 transition-all">
            <div className="flex-1">
              <p className="font-black text-blue-900 text-sm uppercase">{j.name}</p>
              <p className="text-[10px] uppercase font-bold text-gray-500">{j.role} - Định mức: {j.weight ? Math.round(j.weight * 100) : 100}%</p>
              <div className="mt-2 flex gap-2">
                 <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 font-bold">Tổng: {j.tonCu} vụ</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEditClick(j)} className="p-2 bg-white border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-50 shadow-sm" title="Sửa thông tin">✏️</button>
              <button onClick={() => handleDeleteJudge(j.id, j.name)} className="p-2 bg-white border border-red-200 text-red-500 rounded-lg hover:bg-red-50 shadow-sm" title="Xóa Thẩm phán">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// =========================================================================
// COMPONENT: QUẢN LÝ CÔNG VIỆC THƯ KÝ (TASK MANAGER)
// =========================================================================
function QuanLyCongViec({ db, userEmail, userRole, clerksList, showToast }) {
  const [tasks, setTasks] = React.useState([]);
  const [taskForm, setTaskForm] = React.useState({ title: "", assignee: "", deadline: moment().format("YYYY-MM-DD"), priority: "Bình thường", note: "" });
  const [filterAssignee, setFilterAssignee] = React.useState("all");

  const inputBase = "w-full border border-gray-300 rounded-md px-4 py-3 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-sm font-medium text-gray-800";

  React.useEffect(() => {
    const loadTasks = async () => {
      const { collection, query, orderBy, onSnapshot } = await import('firebase/firestore');
      const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
      onSnapshot(q, (snap) => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    };
    loadTasks();
  }, [db]);

  const handleAddTask = async () => {
    if (!taskForm.title || !taskForm.assignee) return showToast("Vui lòng nhập Tên công việc và Chọn thư ký!", "error");
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      await addDoc(collection(db, "tasks"), {
        ...taskForm,
        status: "todo", // Mặc định là Chưa làm
        createdAt: moment().toISOString(),
        createdBy: userEmail
      });
      showToast("✅ Đã giao việc thành công!");
      setTaskForm({ ...taskForm, title: "", note: "" });
    } catch (e) { showToast("Lỗi giao việc: " + e.message, "error"); }
  };

  const updateTaskStatus = async (id, newStatus) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, "tasks", id), { status: newStatus, updatedAt: moment().toISOString() });
      showToast("🔄 Đã chuyển trạng thái công việc!");
    } catch (e) { showToast("Lỗi: " + e.message, "error"); }
  };

  const deleteTask = async (id) => {
    if (window.confirm("Xóa công việc này?")) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, "tasks", id));
        showToast("🗑️ Đã xóa công việc!");
      } catch (e) { showToast("Lỗi: " + e.message, "error"); }
    }
  };

  // Nếu là Thư ký, chỉ thấy việc của mình. Nếu là Admin/Chánh án/Thẩm phán, thấy hết.
  const isManager = ["chanhan", "admin", "thamphan"].includes(userRole);
  
  const displayedTasks = tasks.filter(t => {
    if (!isManager && t.assignee !== userEmail && !t.assignee.includes(userEmail.split('@')[0])) return false;
    if (filterAssignee !== "all" && t.assignee !== filterAssignee) return false;
    return true;
  });

  const COLUMNS = [
    { id: "todo", title: "📝 CHƯA LÀM", color: "border-gray-300 bg-gray-50", textColor: "text-gray-700" },
    { id: "doing", title: "⏳ ĐANG LÀM", color: "border-blue-300 bg-blue-50", textColor: "text-blue-700" },
    { id: "done", title: "✅ ĐÃ XONG", color: "border-green-300 bg-green-50", textColor: "text-green-700" }
  ];

  return (
    <div className="animate-fadeIn space-y-8 max-w-7xl mx-auto">
      {/* HEADER QUẢN LÝ */}
      <div className="bg-orange-800 p-8 rounded-2xl text-white shadow-xl flex justify-between items-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-widest text-orange-100">Sổ Giao Việc Điện Tử</h2>
          <p className="opacity-80 font-bold uppercase text-[11px] mt-1 tracking-[0.2em]">Theo dõi tiến độ hàng ngày / tuần</p>
        </div>
        <div className="text-5xl">📋</div>
      </div>

      {/* FORM GIAO VIỆC (CHỈ QUẢN LÝ HOẶC TỰ MÌNH LÊN LỊCH) */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <h3 className="font-black text-orange-900 uppercase mb-4 border-b pb-2 flex items-center gap-2">✍️ Giao việc mới</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input type="text" placeholder="Tên công việc (VD: Tống đạt bản án số 12)..." value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} className={`md:col-span-2 ${inputBase}`} />
          
          <select value={taskForm.assignee} onChange={e => setTaskForm({...taskForm, assignee: e.target.value})} className={inputBase}>
            <option value="">-- Giao cho Thư ký --</option>
            <option value={userEmail}>Tự giao cho mình</option>
            {clerksList && clerksList.map(name => <option key={name} value={name}>{name}</option>)}
          </select>

          <select value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})} className={inputBase}>
            <option value="Bình thường">🔵 Bình thường</option>
            <option value="Khẩn cấp">🔴 Khẩn cấp</option>
          </select>

          <input type="date" value={taskForm.deadline} onChange={e => setTaskForm({...taskForm, deadline: e.target.value})} className={inputBase} title="Hạn chót" />
          
          <input type="text" placeholder="Ghi chú thêm..." value={taskForm.note} onChange={e => setTaskForm({...taskForm, note: e.target.value})} className={`md:col-span-2 ${inputBase}`} />

          <button onClick={handleAddTask} className="bg-orange-600 hover:bg-orange-700 text-white font-black py-3 rounded-md uppercase shadow-md active:scale-95 transition-all">
            LÊN LỊCH
          </button>
        </div>
      </div>

      {/* BỘ LỌC DÀNH CHO LÃNH ĐẠO */}
      {isManager && (
        <div className="flex items-center gap-3 bg-white p-4 rounded-xl border shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase">Lọc theo Thư ký:</span>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm font-bold text-orange-900 outline-none">
            <option value="all">Tất cả Thư ký</option>
            {clerksList && clerksList.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      )}

      {/* KANBAN BOARD - BẢNG KÉO THẢ TRẠNG THÁI */}
      <div className="flex flex-col md:flex-row gap-6 min-h-[600px]">
        {COLUMNS.map(col => (
          <div key={col.id} className={`flex-1 rounded-2xl border-2 ${col.color} flex flex-col overflow-hidden shadow-sm`}>
            <div className={`p-4 font-black text-center border-b-2 bg-white ${col.textColor}`}>
              {col.title} <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full ml-1 text-xs">{displayedTasks.filter(t => t.status === col.id).length}</span>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {displayedTasks.filter(t => t.status === col.id).map(task => {
                const isOverdue = moment().isAfter(moment(task.deadline)) && task.status !== "done";
                
                return (
                  <div key={task.id} className={`bg-white p-4 rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all relative group ${task.priority === 'Khẩn cấp' ? 'border-red-500' : 'border-blue-500'}`}>
                    {/* Badge Khẩn / Trễ */}
                    <div className="flex gap-1 mb-2">
                      {task.priority === 'Khẩn cấp' && <span className="bg-red-100 text-red-700 text-[9px] font-black px-2 py-0.5 rounded uppercase">Khẩn</span>}
                      {isOverdue && <span className="bg-orange-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase animate-pulse">Trễ Hạn</span>}
                    </div>

                    <h4 className="font-bold text-sm text-gray-800 mb-1 leading-tight">{task.title}</h4>
                    {task.note && <p className="text-[11px] text-gray-500 italic mb-3 line-clamp-2">{task.note}</p>}
                    
                    <div className="flex flex-col gap-1.5 text-[11px] font-bold text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-200/60 mt-2 shadow-inner">
  <p className="flex items-center gap-1.5">
    <span className="opacity-70">👤 Giao cho:</span> 
    <span className="text-orange-800 font-black uppercase">{task.assignee}</span>
  </p>
  
  {/* Đường gạch ngang nét đứt chia tách nội dung */}
  <div className="border-t border-gray-200 border-dashed my-1"></div>
  
  {/* 🕒 NGÀY PHÂN CÔNG (Tự động lấy ngày + giờ phút hệ thống ghi nhận) */}
  <p className="text-gray-500 flex items-center gap-1">
    <span>🕒 Ngày phân:</span> 
    <span className="text-gray-700 font-extrabold">
      {task.createdAt ? moment(task.createdAt).format("DD/MM/YYYY [lúc] HH:mm") : "---"}
    </span>
  </p>
  
  {/* 🚨 NGÀY ĐẾN HẠN (Hạn chót hoàn thành, nếu trễ hạn sẽ đổi màu đỏ cảnh báo) */}
  <p className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-black animate-pulse" : "text-emerald-700"}`}>
    <span>📅 Đến hạn:</span> 
    <span>
      {task.deadline ? moment(task.deadline).format("DD/MM/YYYY") : "---"}
    </span>
  </p>
</div>

                    {/* Nút thao tác chuyển cột */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                      {col.id !== "todo" && <button onClick={() => updateTaskStatus(task.id, "todo")} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-1.5 rounded text-[10px] font-bold uppercase transition-colors">Về Chưa làm</button>}
                      {col.id !== "doing" && <button onClick={() => updateTaskStatus(task.id, "doing")} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-1.5 rounded text-[10px] font-bold uppercase transition-colors">Đang làm</button>}
                      {col.id !== "done" && <button onClick={() => updateTaskStatus(task.id, "done")} className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 py-1.5 rounded text-[10px] font-bold uppercase transition-colors">Hoàn thành</button>}
                    </div>

                    {/* Nút Xóa hiện lên khi hover */}
                    {(isManager || task.createdBy === userEmail) && (
                      <button onClick={() => deleteTask(task.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        🗑️
                      </button>
                    )}
                  </div>
                );
              })}
              
              {displayedTasks.filter(t => t.status === col.id).length === 0 && (
                <div className="text-center py-10 text-gray-400 font-bold text-xs italic">Trống</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}