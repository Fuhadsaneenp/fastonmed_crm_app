"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Calendar,
  FolderHeart,
  Users,
  Building2,
  BarChart2,
  BarChart3,
  Banknote,
  Bell,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Coffee,
  User,
  LogOut,
  ChevronRight,
  Filter,
  Check,
  X,
  ArrowUpRight,
  TrendingUp,
  MapPin,
  Briefcase,
  Shield,
  Plus,
  Phone,
  Mail,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  Play,
  Minus,
  Maximize2,
  Minimize2,
  MoreVertical,
  Pencil,
  Trash2,
  Globe,
  Camera,
  ArrowLeft,
  Edit,
  IndianRupee,
} from "lucide-react";
import TeamMemberAttendance from "@/components/TeamMemberAttendance";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import { attendanceDate, attendanceTime, workedSeconds, type AttendanceEntry } from "@/lib/attendance";
import { attendanceRequest } from "@/lib/attendance-client";
import FastonmedLogo from "@/components/FastonmedLogo";
import { apiRequest, clearAuthSession, getAuthToken } from "@/lib/api-client";
import { getInitials } from "@/lib/utils";
import type { Employee } from "@/types";
import toast from "react-hot-toast";
import { GlobalImpersonationBar } from "@/components/GlobalImpersonationBar";
import type {
  StemsCompanyDetail,
  StemsOfficeItem,
  StemsDepartmentItem,
  StemsJobTitleItem,
} from "@/lib/db";


interface UserInfo {
  name: string;
  email: string;
  role: string;
}

interface AttendanceRecord {
  id: string;
  name: string;
  initials: string;
  role: string;
  dept: string;
  checkIn: string;
  checkOut: string;
  duration: string;
  status: "ON TIME" | "LATE" | "ABSENT" | "PAID LEAVE" | "WFH" | "PRESENT" | "NO RECORD";
  avatarBg: string;
}

interface AttendanceDay {
  day: number;
  dayOfWeek: string;
  status: "PRESENT" | "HALF" | "ABSENT" | "OFF" | "UPCOMING";
  checkIn?: string;
  checkOut?: string;
  hours?: string;
  location?: string;
  notes?: string;
  grossHours?: string;
  breakTime?: string;
  effectiveHours?: string;
  overtime?: string;
  ipAddress?: string;
}

interface StemsEmployeeItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  designationTitle: string;
  departmentName: string;
  companyName: string;
  companyId: string;
  officeName: string;
  officeId: string;
  managerId: string | null;
  managerName: string | null;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED";
  dateOfExit?: string | null;
  hasPhoto?: boolean;
}

const DEFAULT_STEMS_EMPLOYEES: StemsEmployeeItem[] = [
  {
    id: "emp-fuhad",
    employeeCode: "FM001",
    firstName: "Fuhad",
    lastName: "",
    fullName: "Fuhad",
    email: "fuhad@fastonmed.com",
    phone: "+971 50 000 0001",
    designationTitle: "Super Admin",
    departmentName: "Management",
    companyName: "FastonMed",
    companyId: "fastonmed-hq",
    officeName: "Dubai Healthcare City HQ",
    officeId: "dhcc-hq",
    managerId: null,
    managerName: null,
    status: "ACTIVE",
  },
  {
    id: "emp-hashim",
    employeeCode: "FM002",
    firstName: "Hashim",
    lastName: "",
    fullName: "Hashim",
    email: "hashim@fastonmed.com",
    phone: "+971 50 789 1234",
    designationTitle: "Operations Manager",
    departmentName: "Management",
    companyName: "FastonMed",
    companyId: "fastonmed-hq",
    officeName: "Dubai Healthcare City HQ",
    officeId: "dhcc-hq",
    managerId: "emp-fuhad",
    managerName: "Fuhad",
    status: "ACTIVE",
  },
  {
    id: "emp-riyas",
    employeeCode: "FM003",
    firstName: "Riyas",
    lastName: "",
    fullName: "Riyas",
    email: "riyas@fastonmed.com",
    phone: "+971 50 890 2345",
    designationTitle: "Sales Executive",
    departmentName: "Sales",
    companyName: "FastonMed",
    companyId: "fastonmed-hq",
    officeName: "Dubai Healthcare City HQ",
    officeId: "dhcc-hq",
    managerId: "emp-hashim",
    managerName: "Hashim",
    status: "ACTIVE",
  },
  {
    id: "emp-fidha",
    employeeCode: "FM004",
    firstName: "Fidha",
    lastName: "",
    fullName: "Fidha",
    email: "fidha@fastonmed.com",
    phone: "+971 50 901 3456",
    designationTitle: "Client Relations",
    departmentName: "Administration",
    companyName: "FastonMed",
    companyId: "fastonmed-hq",
    officeName: "Dubai Healthcare City HQ",
    officeId: "dhcc-hq",
    managerId: "emp-hashim",
    managerName: "Hashim",
    status: "ACTIVE",
  },
  {
    id: "emp-user1",
    employeeCode: "FM005",
    firstName: "User",
    lastName: "1",
    fullName: "User 1",
    email: "user1@fastonmed.com",
    phone: "+971 50 111 2233",
    designationTitle: "Staff",
    departmentName: "Sales",
    companyName: "FastonMed",
    companyId: "fastonmed-hq",
    officeName: "Dubai Healthcare City HQ",
    officeId: "dhcc-hq",
    managerId: "emp-riyas",
    managerName: "Riyas",
    status: "ACTIVE",
  },
];

interface StemsPayrollRunItem {
  id: string;
  companyId: string;
  companyName: string;
  month: number;
  year: number;
  status: string;
  type: string;
  grossTotal: string | number;
  netTotal: string | number;
  employeeCount: number;
  createdAt: string;
}

const AVATAR_BACKGROUNDS = ["#003649", "#059669", "#2563eb", "#7c3aed", "#42b69c"];

interface SubMenuItem {
  id: string;
  label: string;
  hasChevron?: boolean;
  nestedItems?: Array<{ id: string; label: string }>;
}


interface NavSection {
  id: string;
  label: string;
  icon: any;
  subItems?: SubMenuItem[];
}

export default function EMSDashboardPage() {
  const [mobileSectionsOpen, setMobileSectionsOpen] = useState(false);
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string>("Attendance");
  const [activeSubTab, setActiveSubTab] = useState<string>("my-attendance");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Attendance: true,
    "My Team": false,
    Company: false,
  });

  const [selectedDay, setSelectedDay] = useState<AttendanceDay | null>(null);

  const [user, setUser] = useState<UserInfo>({
    name: "Fuhad",
    email: "fuhad@fastonmed.com",
    role: "Super Admin",
  });
  const [seconds, setSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchTable, setSearchTable] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [employeeLoadError, setEmployeeLoadError] = useState<string | null>(null);

  const [attendanceMonth, setAttendanceMonth] = useState(() => attendanceDate().slice(0, 7));
  const [myAttendance, setMyAttendance] = useState<AttendanceEntry[]>([]);
  const [selectedAttendanceMember, setSelectedAttendanceMember] = useState<Employee | null>(null);
  const [teamAttendance, setTeamAttendance] = useState<AttendanceEntry[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');
  const [todayAttendance, setTodayAttendance] = useState<AttendanceEntry | undefined>();
  const loadAttendance = async () => {
    try {
      const data = await attendanceRequest(`?month=${attendanceMonth}`);
      setMyAttendance(data.records || []);
      const currentRecords = attendanceMonth === attendanceDate().slice(0, 7) ? data : await attendanceRequest(`?month=${attendanceDate().slice(0, 7)}`);
      setTodayAttendance(currentRecords.records?.find(record => record.date === attendanceDate()));
      setAttendanceError('');
      if (activeSubTab === 'team-attendance') {
        const team = await attendanceRequest(`?month=${attendanceDate().slice(0, 7)}&team=true`);
        setTeamAttendance(team.records || []);
      }
    } catch (error) { setAttendanceError(error instanceof Error ? error.message : 'Attendance unavailable'); }
    finally { setAttendanceLoading(false); }
  };
  useEffect(() => {
    void loadAttendance();
    const initialMonth = attendanceDate().slice(0, 7);
    const refresh = () => {
      setAttendanceMonth(month => month === initialMonth ? attendanceDate().slice(0, 7) : month);
      void loadAttendance();
    };
    window.addEventListener('fastonmed_attendance_updated', refresh);
    const timer = setInterval(refresh, 60000);
    return () => { clearInterval(timer); window.removeEventListener('fastonmed_attendance_updated', refresh); };
    // Refresh the selected user/month when navigating attendance tabs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceMonth, activeSubTab]);
  const attendanceAction = async (action: string) => {
    try {
      if (localStorage.getItem('activeImpersonateTarget')) throw new Error('Return to your own account to change attendance.');
      await attendanceRequest('', action);
      await loadAttendance();
      toast.success(action === 'checkout' ? 'Clocked out' : action === 'break' ? 'Break started' : 'Work resumed');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Attendance could not be saved'); }
    setShowTimerMenu(false);
  };

  // Leave Applications
  const [leaveApplications, setLeaveApplications] = useState([
    {
      id: "leave-1",
      name: "Hashim",
      role: "Operations Manager",
      type: "Annual Leave",
      from: "08 Sep 2026",
      to: "12 Sep 2026",
      reason: "Family travel abroad",
      status: "Pending Approval",
    },
    {
      id: "leave-2",
      name: "Fidha",
      role: "Client Relations",
      type: "Sick Leave",
      from: "04 Sep 2026",
      to: "04 Sep 2026",
      reason: "Medical appointment & consultation",
      status: "Approved",
    },
  ]);

  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState("Annual Leave");
  const [leaveFrom, setLeaveFrom] = useState("2026-09-10");
  const [leaveTo, setLeaveTo] = useState("2026-09-12");
  const [leaveReason, setLeaveReason] = useState("");

  // STEMS Live Data & Views State
  const [stemsEmployees, setStemsEmployees] = useState<StemsEmployeeItem[]>(DEFAULT_STEMS_EMPLOYEES);
  const [stemsCompanies, setStemsCompanies] = useState<{ id: string; name: string }[]>([
    { id: "fastonmed-hq", name: "FastonMed" },
  ]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("All");
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState<string>("All");
  const [selectedJobTitleFilter, setSelectedJobTitleFilter] = useState<string>("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("All");
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>("");
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<Record<string, boolean>>({});

  // Payroll State
  const [payrollCompany, setPayrollCompany] = useState<string>("FastonMed");
  const [payrollMode, setPayrollMode] = useState<"run" | "history">("run");
  const [payrollFilter, setPayrollFilter] = useState<"all" | "regular" | "final">("all");
  const [payrollRuns, setPayrollRuns] = useState<StemsPayrollRunItem[]>([
    {
      id: "cmtrabhes0015id4zvygxtaqz",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      month: 9,
      year: 2026,
      status: "DRAFT_FINAL",
      type: "FINAL",
      grossTotal: "12500.00",
      netTotal: "12500.00",
      employeeCount: 1,
      createdAt: "2026-09-07T08:06:56.548Z",
    },
    {
      id: "cmto4vn150068xv4zqllbqpxl",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      month: 8,
      year: 2026,
      status: "DRAFT",
      type: "REGULAR",
      grossTotal: "48500.00",
      netTotal: "48500.00",
      employeeCount: 5,
      createdAt: "2026-09-05T03:11:20.729Z",
    },
    {
      id: "cmtbfkgsa000xj24zsp7ihro4",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      month: 7,
      year: 2026,
      status: "PAID",
      type: "REGULAR",
      grossTotal: "48500.00",
      netTotal: "48500.00",
      employeeCount: 5,
      createdAt: "2026-08-27T05:49:34.906Z",
    },
  ]);
  const [payrollMetrics, setPayrollMetrics] = useState({
    latestCost: 48500.0,
    latestCostMonth: "August 2026",
    netPayable: 61000.0,
    netPayableEmployees: 5,
    pendingRuns: 2,
    completedRuns: 1,
  });
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [modalCompany, setModalCompany] = useState("FastonMed");
  const [modalPayrollType, setModalPayrollType] = useState<"REGULAR" | "FINAL">("REGULAR");
  const [modalOffboardedEmp, setModalOffboardedEmp] = useState("");
  const [modalMonth, setModalMonth] = useState(9);
  const [modalYear, setModalYear] = useState(2026);
  const [isGeneratingPayroll, setIsGeneratingPayroll] = useState(false);

  // ================= ADD EMPLOYEE & DETAIL EMPLOYEE STATE =================
  const [selectedEmployeeForDetail, setSelectedEmployeeForDetail] = useState<StemsEmployeeItem | null>(null);
  const [detailTab, setDetailTab] = useState<"general" | "job" | "payroll" | "documents" | "onboarding">("general");

  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState<boolean>(false);
  const [addEmployeeStep, setAddEmployeeStep] = useState<number>(0);
  const [empModalAlert, setEmpModalAlert] = useState<string>("");

  // Step 1: Basic Details
  const [formFirstName, setFormFirstName] = useState<string>("");
  const [formMiddleName, setFormMiddleName] = useState<string>("");
  const [formLastName, setFormLastName] = useState<string>("");
  const [formEmployeeId, setFormEmployeeId] = useState<string>("");
  const [formDateOfJoining, setFormDateOfJoining] = useState<string>("2026-09-11");
  const [formWorkEmail, setFormWorkEmail] = useState<string>("");
  const [formMobileNumber, setFormMobileNumber] = useState<string>("");
  const [formPortalPassword, setFormPortalPassword] = useState<string>("••••••••••••");
  const [formGender, setFormGender] = useState<string>("");
  const [formCompanyId, setFormCompanyId] = useState<string>("fastonmed-hq");
  const [formDepartmentId, setFormDepartmentId] = useState<string>("dept-mgmt");
  const [formOfficeId, setFormOfficeId] = useState<string>("off-fastonmed-dhcc");
  const [formDesignationId, setFormDesignationId] = useState<string>("");
  const [formManagerId, setFormManagerId] = useState<string>("");

  // Step 2: Salary Details
  const [formBasicSalary, setFormBasicSalary] = useState<number>(8000);
  const [formAllowances, setFormAllowances] = useState<number>(0);
  const [formDeductions, setFormDeductions] = useState<number>(0);

  // Step 3: Personal Details
  const [formDob, setFormDob] = useState<string>("2003-09-16");
  const [formPersonalEmail, setFormPersonalEmail] = useState<string>("");
  const [formPanId, setFormPanId] = useState<string>("");
  const [formEmergencyName, setFormEmergencyName] = useState<string>("Basheer");
  const [formEmergencyPhone, setFormEmergencyPhone] = useState<string>("8086787772");
  const [formAddress, setFormAddress] = useState<string>("Peringoden House, Klari Moochikkal , Malappuram, Kerala");
  const [formCity, setFormCity] = useState<string>("Malappuram");
  const [formState, setFormState] = useState<string>("Kerala");
  const [formCountry, setFormCountry] = useState<string>("India");
  const [formPinCode, setFormPinCode] = useState<string>("676501");

  // Step 4: Documents
  const [formPhotoName, setFormPhotoName] = useState<string>("");
  const [formDocType, setFormDocType] = useState<string>("ID Card");
  const [formDocFileName, setFormDocFileName] = useState<string>("");
  const [formQueuedDocs, setFormQueuedDocs] = useState<Array<{ type: string; name: string }>>([]);

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [formBiometricId, setFormBiometricId] = useState<string>("");
  const [formShiftId, setFormShiftId] = useState<string>("");
  const [formPortalAccess, setFormPortalAccess] = useState<boolean>(true);

  const openEmployeeDetail = (emp: StemsEmployeeItem) => {
    setSelectedEmployeeForDetail(emp);
    setDetailTab("general");
  };

  const openAddEmployeeModal = () => {
    setEditingEmployeeId(null);
    setAddEmployeeStep(0);
    setEmpModalAlert("");
    setFormFirstName("");
    setFormMiddleName("");
    setFormLastName("");
    setFormEmployeeId("");
    setFormDateOfJoining("2026-09-11");
    setFormWorkEmail("");
    setFormMobileNumber("");
    setFormPortalPassword("••••••••••••");
    setFormGender("");
    setFormCompanyId("cmrtifqe00002ty4zqy0vdpsr");
    setFormDepartmentId("cmrtj0m1t001vun4zhyyf9y8b");
    setFormOfficeId("cmrtlb0ns000l084zqhfoth1e");
    setFormDesignationId("");
    setFormManagerId("");
    setFormShiftId("");
    setFormBiometricId("");
    setFormPortalAccess(true);
    setFormBasicSalary(8000);
    setFormAllowances(0);
    setFormDeductions(0);
    setFormDob("2003-09-16");
    setFormPersonalEmail("");
    setFormPanId("");
    setFormEmergencyName("Basheer");
    setFormEmergencyPhone("8086787772");
    setFormAddress("Peringoden House, Klari Moochikkal , Malappuram, Kerala");
    setFormCity("Malappuram");
    setFormState("Kerala");
    setFormCountry("India");
    setFormPinCode("676501");
    setFormPhotoName("");
    setFormDocFileName("");
    setFormQueuedDocs([]);
    setShowAddEmployeeModal(true);
  };

  const openEditEmployeeModal = (emp: StemsEmployeeItem) => {
    setEditingEmployeeId(emp.id);
    setAddEmployeeStep(0);
    setEmpModalAlert("");
    setFormFirstName(emp.firstName);
    setFormMiddleName("");
    setFormLastName(emp.lastName);
    setFormEmployeeId(emp.employeeCode);
    setFormDateOfJoining("2026-09-11");
    setFormWorkEmail(emp.email);
    setFormMobileNumber(emp.phone || "7306191793");
    setFormPortalPassword("");
    setFormGender("Male");
    setFormCompanyId(emp.companyId || "cmrtifqe00002ty4zqy0vdpsr");
    const d = departments.find((dep) => dep.name === emp.departmentName);
    if (d) setFormDepartmentId(d.id);
    const jt = jobTitles.find((j) => j.title === emp.designationTitle);
    if (jt) setFormDesignationId(jt.id);
    setFormOfficeId(emp.officeId || "cmrtlb0ns000l084zqhfoth1e");
    setFormManagerId(emp.managerId || "");
    setFormShiftId("");
    setFormBiometricId("1001");
    setFormPortalAccess(true);
    setFormBasicSalary(8000);
    setFormAllowances(0);
    setFormDeductions(0);
    setFormDob("2003-09-16");
    setFormPersonalEmail(emp.email);
    setFormPanId("");
    setFormEmergencyName("Basheer");
    setFormEmergencyPhone("8086787772");
    setFormAddress("Peringoden House, Klari Moochikkal , Malappuram, Kerala");
    setFormCity("Malappuram");
    setFormState("Kerala");
    setFormCountry("India");
    setFormPinCode("676501");
    setFormPhotoName("");
    setFormDocFileName("");
    setFormQueuedDocs([]);
    setShowAddEmployeeModal(true);
  };

  const validateStep0 = () => {
    if (
      !formFirstName.trim() ||
      !formLastName.trim() ||
      !formDateOfJoining.trim() ||
      !formWorkEmail.trim() ||
      (!editingEmployeeId && !formPortalPassword.trim())
    ) {
      setEmpModalAlert("Please complete the mandatory basic details before continuing.");
      return false;
    }
    setEmpModalAlert("");
    return true;
  };

  const handleNextStep = () => {
    if (addEmployeeStep === 0) {
      if (!validateStep0()) return;
      setAddEmployeeStep(1);
    } else if (addEmployeeStep === 1) {
      setAddEmployeeStep(2);
    } else if (addEmployeeStep === 2) {
      setAddEmployeeStep(3);
    }
  };

  const handleSaveEmployee = () => {
    const comp = companyDetails.find((c) => c.id === formCompanyId);
    const dept = departments.find((d) => d.id === formDepartmentId);
    const desg = jobTitles.find((j) => j.id === formDesignationId);
    const off = offices.find((o) => o.id === formOfficeId);
    const mgr = stemsEmployees.find((e) => e.id === formManagerId);

    if (editingEmployeeId) {
      setStemsEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id === editingEmployeeId) {
            const updated: StemsEmployeeItem = {
              ...emp,
              firstName: formFirstName.trim(),
              lastName: formLastName.trim(),
              fullName: `${formFirstName.trim()} ${formLastName.trim()}`,
              employeeCode: formEmployeeId.trim() || emp.employeeCode,
              email: formWorkEmail.trim(),
              phone: formMobileNumber.trim() || emp.phone,
              companyName: comp?.name || emp.companyName,
              companyId: formCompanyId || emp.companyId,
              departmentName: dept?.name || emp.departmentName,
              designationTitle: desg?.title || emp.designationTitle,
              officeName: off?.name || emp.officeName,
              officeId: formOfficeId || emp.officeId,
              managerId: formManagerId || null,
              managerName: mgr?.fullName || null,
            };
            if (selectedEmployeeForDetail?.id === editingEmployeeId) {
              setSelectedEmployeeForDetail(updated);
            }
            return updated;
          }
          return emp;
        })
      );
      toast.success("Employee updated successfully!");
    } else {
      const newEmp: StemsEmployeeItem = {
        id: "emp_" + Date.now(),
        employeeCode: formEmployeeId.trim() || `EMP${Math.floor(1000 + Math.random() * 9000)}`,
        firstName: formFirstName.trim(),
        lastName: formLastName.trim(),
        fullName: `${formFirstName.trim()} ${formLastName.trim()}`,
        email: formWorkEmail.trim(),
        phone: formMobileNumber.trim() || undefined,
        designationTitle: desg?.title || "Specialist",
        departmentName: dept?.name || "Management",
        companyName: comp?.name || "FastonMed",
        companyId: formCompanyId || "fastonmed-hq",
        officeName: off?.name || "Dubai Healthcare City HQ",
        officeId: formOfficeId || "off-fastonmed-dhcc",
        managerId: formManagerId || null,
        managerName: mgr?.fullName || null,
        status: "ACTIVE",
      };
      setStemsEmployees((prev) => [newEmp, ...prev]);
      toast.success("Employee added successfully!");
    }
    setShowAddEmployeeModal(false);
  };

  // ================= COMPANY SECTION STATE =================
  const [companyDetails, setCompanyDetails] = useState<StemsCompanyDetail[]>([
    {
      id: "fastonmed-hq",
      name: "FastonMed",
      legalName: "FastonMed Healthcare Equipment & Medical Solutions LLC",
      phoneCode: "+971",
      phone: "50 000 0001",
      email: "info@fastonmed.com",
      overview:
        "FastonMed is a premier healthcare equipment distribution and biomedical engineering solutions provider based in Dubai Healthcare City, UAE.",
      worksSevenDays: false,
    },
  ]);

  const [offices, setOffices] = useState<StemsOfficeItem[]>([
    {
      id: "off-fastonmed-dhcc",
      companyId: "fastonmed-hq",
      name: "FastonMed HQ",
      placeName: "Dubai Healthcare City",
      country: "United Arab Emirates",
      isHQ: true,
      active: true,
      timezone: "GMT +04:00 Dubai, Abu Dhabi",
      phone: "+971 4 000 0000",
      email: "info@fastonmed.com",
      employeeCount: 5,
    },
  ]);

  const [departments, setDepartments] = useState<StemsDepartmentItem[]>([
    {
      id: "dept-mgmt",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      name: "Management",
      code: "MGMT",
      parent: "root",
      parentName: "FastonMed",
      jobTitlesCount: 2,
    },
    {
      id: "dept-sales",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      name: "Sales",
      code: "SALES",
      parent: "root",
      parentName: "FastonMed",
      jobTitlesCount: 2,
    },
    {
      id: "dept-admin",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      name: "Administration",
      code: "ADMIN",
      parent: "root",
      parentName: "FastonMed",
      jobTitlesCount: 1,
    },
    {
      id: "dept-ops",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      name: "Operations & Biomedical",
      code: "OPS",
      parent: "root",
      parentName: "FastonMed",
      jobTitlesCount: 1,
    },
  ]);

  const [jobTitles, setJobTitles] = useState<StemsJobTitleItem[]>([
    {
      id: "job-superadmin",
      title: "Super Admin",
      departmentId: "dept-mgmt",
      departmentName: "Management",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      employeeCount: 1,
      active: true,
    },
    {
      id: "job-ops-mgr",
      title: "Operations Manager",
      departmentId: "dept-mgmt",
      departmentName: "Management",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      employeeCount: 1,
      active: true,
    },
    {
      id: "job-sales-exec",
      title: "Sales Executive",
      departmentId: "dept-sales",
      departmentName: "Sales",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      employeeCount: 2,
      active: true,
    },
    {
      id: "job-client-rel",
      title: "Client Relations",
      departmentId: "dept-admin",
      departmentName: "Administration",
      companyId: "fastonmed-hq",
      companyName: "FastonMed",
      employeeCount: 1,
      active: true,
    },
  ]);

  const [selectedDeptCompanyId, setSelectedDeptCompanyId] = useState<string>("fastonmed-hq");
  const [filterDeptCompanyId, setFilterDeptCompanyId] = useState<string>("");
  const [searchDept, setSearchDept] = useState<string>("");
  const [filterJobCompanyId, setFilterJobCompanyId] = useState<string>("");
  const [searchJob, setSearchJob] = useState<string>("");
  const [isDeptFullScreen, setIsDeptFullScreen] = useState<boolean>(false);
  const [openNested, setOpenNested] = useState<Record<string, boolean>>({
    departments: true,
  });

  // Modal states for Company actions
  const [showAddCompanyModal, setShowAddCompanyModal] = useState<boolean>(false);
  const [showAddOfficeModal, setShowAddOfficeModal] = useState<boolean>(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState<boolean>(false);
  const [showAddJobModal, setShowAddJobModal] = useState<boolean>(false);
  const [editingCompany, setEditingCompany] = useState<StemsCompanyDetail | null>(null);

  useEffect(() => {
    fetch("/api/ems/employees")
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setStemsEmployees(res.data);
        }
      })
      .catch((e) => console.log("Using fallback employees", e));

    fetch("/api/ems/companies")
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setStemsCompanies(res.data);
        }
      })
      .catch((e) => console.log("Using fallback companies", e));

    fetch("/api/ems/payroll")
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && res.data) {
          if (Array.isArray(res.data.runs) && res.data.runs.length > 0) {
            setPayrollRuns(res.data.runs);
          }
          if (res.data.metrics) {
            setPayrollMetrics(res.data.metrics);
          }
        }
      })
      .catch((e) => console.log("Using fallback payroll", e));

    fetch("/api/ems/company-structure")
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && res.data) {
          if (Array.isArray(res.data.companies) && res.data.companies.length > 0) {
            setCompanyDetails(res.data.companies);
          }
          if (Array.isArray(res.data.offices) && res.data.offices.length > 0) {
            setOffices(res.data.offices);
          }
          if (Array.isArray(res.data.departments) && res.data.departments.length > 0) {
            setDepartments(res.data.departments);
          }
          if (Array.isArray(res.data.jobTitles) && res.data.jobTitles.length > 0) {
            setJobTitles(res.data.jobTitles);
          }
        }
      })
      .catch((e) => console.log("Using fallback company structure", e));
  }, []);



  useEffect(() => {
    const stored = localStorage.getItem("fastonmed_user");
    if (!stored) {
      clearAuthSession();
      router.push("/login");
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setUser({
        name: parsed.name || "Fuhad",
        email: parsed.email || "fuhad@fastonmed.com",
        role: parsed.role || "Super Admin",
      });
    } catch {
      clearAuthSession();
      router.push("/login");
      return;
    }

    const interval = setInterval(() => {
      const entry = todayAttendance;
      setSeconds(entry ? workedSeconds(entry) : 0);
      setTimerRunning(Boolean(entry && !entry.checkOut && !entry.breakStarted));
    }, 1000);

    return () => clearInterval(interval);
  }, [router, todayAttendance]);

  useEffect(() => {
    let isMounted = true;

    const loadEmployees = async () => {
      setIsLoadingEmployees(true);
      try {
        const liveEmployees = await apiRequest<Employee[]>("/api/employees");
        if (isMounted) {
          setEmployees(liveEmployees);
          setEmployeeLoadError(null);
        }
      } catch (error) {
        console.error("Failed to load employees for EMS:", error);
        if (isMounted) {
          setEmployees([
            { id: "emp-1", name: "Fuhad", email: "fuhad@fastonmed.com", role: "Super Admin", department: "Management", phone: "+971 50 000 0001", status: "Active", joiningDate: "2024-01-01", assignedClients: [], performance: { leadsAssigned: 10, dealsClosed: 8, revenue: 450000, serviceTickets: 0, rating: 5 } },
            { id: "emp-2", name: "Hashim", email: "hashim@fastonmed.com", role: "Operations Manager", department: "Operations", phone: "+971 50 000 0002", status: "Active", joiningDate: "2024-02-01", assignedClients: [], performance: { leadsAssigned: 5, dealsClosed: 4, revenue: 200000, serviceTickets: 12, rating: 5 } },
            { id: "emp-3", name: "Riyas", email: "riyas@fastonmed.com", role: "Sales Executive", department: "Sales", phone: "+971 50 000 0003", status: "Active", joiningDate: "2024-03-01", assignedClients: [], performance: { leadsAssigned: 20, dealsClosed: 14, revenue: 680000, serviceTickets: 0, rating: 5 } },
            { id: "emp-4", name: "Fidha", email: "fidha@fastonmed.com", role: "Client Relations", department: "Client Relations", phone: "+971 50 000 0004", status: "Active", joiningDate: "2024-04-01", assignedClients: [], performance: { leadsAssigned: 8, dealsClosed: 6, revenue: 150000, serviceTickets: 15, rating: 5 } },
            { id: "emp-5", name: "User 1", email: "user1@fastonmed.com", role: "Staff", department: "Biomedical Engineering", phone: "+971 50 000 0005", status: "Active", joiningDate: "2024-05-01", assignedClients: [], performance: { leadsAssigned: 2, dealsClosed: 1, revenue: 50000, serviceTickets: 25, rating: 5 } },
          ]);
        }
      } finally {
        if (isMounted) setIsLoadingEmployees(false);
      }
    };

    loadEmployees();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleLogout = () => {
    clearAuthSession();
    toast.success("Signed out successfully");
    router.push("/login");
  };

  const handleApplyLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const newApp = {
      id: `leave-${Date.now()}`,
      name: user.name,
      role: user.role,
      type: leaveType,
      from: leaveFrom,
      to: leaveTo,
      reason: leaveReason || "Personal Leave",
      status: "Pending Approval",
    };
    setLeaveApplications([newApp, ...leaveApplications]);
    toast.success("Leave application submitted for approval!");
    setShowApplyLeaveModal(false);
    setLeaveReason("");
  };

  const today = attendanceDate();
  const attendanceRecords: AttendanceRecord[] = employees.map((employee, index) => {
    const entry = teamAttendance.find(record => record.date === today && record.email.toLowerCase() === employee.email.toLowerCase());
    return { id: employee.id, name: employee.name, initials: getInitials(employee.name), role: employee.role, dept: employee.department,
      checkIn: attendanceTime(entry?.checkIn), checkOut: attendanceTime(entry?.checkOut), duration: entry ? `${(workedSeconds(entry) / 3600).toFixed(1)} hrs` : '—',
      status: entry ? 'PRESENT' : 'NO RECORD', avatarBg: AVATAR_BACKGROUNDS[index % AVATAR_BACKGROUNDS.length] };
  });

  const filteredAttendance = attendanceRecords.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTable.toLowerCase()) ||
      e.role.toLowerCase().includes(searchTable.toLowerCase()) ||
      e.dept.toLowerCase().includes(searchTable.toLowerCase())
  );

  const sidebarNav: NavSection[] = [
    { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      id: "Attendance",
      label: "Attendance",
      icon: CalendarCheck,
      subItems: [
        { id: "my-attendance", label: "My Attendance" },
        { id: "team-attendance", label: "Team Attendance" },
      ],
    },
    {
      id: "My Team",
      label: "My Team",
      icon: Users,
      subItems: [
        { id: "manage-team", label: "Manage Team" },
        { id: "offboarding", label: "Offboarding" },
      ],
    },
    {
      id: "Company",
      label: "Company",
      icon: Building2,
      subItems: [
        { id: "company-info", label: "Company Info" },
        { id: "offices", label: "Offices" },
        {
          id: "departments",
          label: "Departments",
          hasChevron: true,
          nestedItems: [
            { id: "department-chart", label: "Department Chart" },
            { id: "department-list", label: "Department List" },
          ],
        },
        { id: "job-title", label: "Job Title" },
        { id: "work-schedule", label: "Work Schedule" },

      ],
    },
    { id: "Reports", label: "Reports", icon: BarChart2 },
    { id: "Payroll", label: "Payroll", icon: Banknote },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <GlobalImpersonationBar />
      {/* ================= TOP NAVIGATION BAR ================= */}
      <header className="mobile-workspace-header"
        style={{
          height: 64,
          backgroundColor: "#002735",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          color: "#ffffff",
          zIndex: 30,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/hub" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <FastonmedLogo theme="dark" size="md" />
          </Link>
          <div
            style={{
              padding: "2px 8px",
              backgroundColor: "rgba(66,182,156,0.18)",
              border: "1px solid #42b69c",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "#42b69c",
              letterSpacing: "0.5px",
            }}
          >
            EMS PLATFORM
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Punch Clock / Live Timer */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowTimerMenu(!showTimerMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "#003649",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: "6px 12px",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Clock size={16} color="#42b69c" />
              <span>{formatTimer(seconds)}</span>
              <span style={{ fontSize: 11, color: "#42b69c" }}>{todayAttendance?.checkOut ? '● OUT' : todayAttendance?.breakStarted ? '● BREAK' : todayAttendance ? '● IN' : '● NO CHECK-IN'}</span>
              <ChevronDown size={14} />
            </button>

            {showTimerMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  backgroundColor: "#ffffff",
                  borderRadius: 10,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  border: "1px solid #e2e8f0",
                  padding: 8,
                  width: 200,
                  zIndex: 50,
                  color: "#1e293b",
                }}
              >
                <button
                  disabled={!todayAttendance || Boolean(todayAttendance.checkOut)}
                  onClick={() => {
                    void attendanceAction(timerRunning ? "break" : "resume");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#334155",
                    cursor: "pointer",
                    fontSize: 12.5,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Coffee size={14} color="#f59e0b" />
                  <span>{timerRunning ? "Take Break" : "Resume Work"}</span>
                </button>
                <button
                  disabled={!todayAttendance || Boolean(todayAttendance.checkOut)}
                  onClick={() => {
                    void attendanceAction("checkout");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#dc2626",
                    cursor: "pointer",
                    fontSize: 12.5,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <LogOut size={14} />
                  <span>Clock Out</span>
                </button>
              </div>
            )}
          </div>

          <Link
            href="/hub"
            style={{
              padding: "6px 12px",
              backgroundColor: "rgba(255,255,255,0.08)",
              borderRadius: 6,
              color: "#e2e8f0",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            ← Workspace Hub
          </Link>

          {/* User Profile */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: "#42b69c",
                  color: "#002735",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                }}
              >
                {getInitials(user.name)}
              </div>
              <div style={{ textAlign: "left", display: "none" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div>
                <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{user.role}</div>
              </div>
            </button>

            {showProfileMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  backgroundColor: "#ffffff",
                  borderRadius: 10,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                  border: "1px solid #e2e8f0",
                  padding: 12,
                  width: 220,
                  zIndex: 50,
                  color: "#0f172a",
                }}
              >
                <div style={{ paddingBottom: 8, borderBottom: "1px solid #f1f5f9", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{user.name}</div>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>{user.email}</div>
                  <div style={{ fontSize: 11, color: "#059669", fontWeight: 600, marginTop: 2 }}>{user.role}</div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#dc2626",
                    cursor: "pointer",
                    fontSize: 12.5,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================= EMS BODY: SIDEBAR + MAIN CONTENT ================= */}
      <div className="ems-body" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <button className="ems-section-toggle" type="button" aria-expanded={mobileSectionsOpen} aria-controls="ems-sections" onClick={() => setMobileSectionsOpen(!mobileSectionsOpen)}>{mobileSectionsOpen ? "Close sections" : "Browse sections"}</button>
        {/* ================= EMS SIDEBAR (Matches STEMS Screenshot) ================= */}
        <aside id="ems-sections" className={mobileSectionsOpen ? "ems-sidebar open" : "ems-sidebar"}
          style={{
            width: 250,
            backgroundColor: "#ffffff",
            borderRight: "1px solid #eef2f6",
            display: "flex",
            flexDirection: "column",
            padding: "16px 12px",
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {sidebarNav.map((item) => {
              const Icon = item.icon;
              const hasSub = !!item.subItems && item.subItems.length > 0;
              const isOpen = openSections[item.label] ?? false;
              const isSectionActive = activeSection === item.label;

              return (
                <div key={item.label} style={{ marginBottom: 2 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (hasSub) {
                        setOpenSections((prev) => ({
                          ...prev,
                          [item.label]: !prev[item.label],
                        }));
                        if (!isOpen && item.subItems?.[0]) {
                          setActiveSection(item.label);
                          setActiveSubTab(item.subItems[0].id);
                        }
                      } else {
                        setActiveSection(item.label);
                        setActiveSubTab(item.id);
                      }
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: isOpen ? 14 : 12,
                      border: "none",
                      backgroundColor: isOpen
                        ? "#f8fafc"
                        : (!hasSub && isSectionActive)
                        ? "#f1f5f9"
                        : "transparent",
                      color: isOpen || (!hasSub && isSectionActive) ? "#0f172a" : "#334155",
                      fontSize: 14.5,
                      fontWeight: isOpen || (!hasSub && isSectionActive) ? 700 : 600,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isOpen && !(!hasSub && isSectionActive)) {
                        e.currentTarget.style.backgroundColor = "#f8fafc";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isOpen && !(!hasSub && isSectionActive)) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Icon
                        size={18}
                        color={isOpen || (!hasSub && isSectionActive) ? "#004d66" : "#475569"}
                        strokeWidth={isOpen || (!hasSub && isSectionActive) ? 2.2 : 1.9}
                      />
                      <span>{item.label}</span>
                    </div>
                    {hasSub &&
                      (isOpen ? (
                        <ChevronUp size={18} color="#475569" strokeWidth={2.2} />
                      ) : (
                        <ChevronDown size={18} color="#64748b" strokeWidth={2} />
                      ))}
                  </button>

                  {/* Submenu Accordion Items */}
                  {hasSub && isOpen && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        marginTop: 4,
                        marginBottom: 6,
                        paddingLeft: 4,
                      }}
                    >
                      {item.subItems!.map((sub) => {
                        const hasNested = Boolean(sub.nestedItems && sub.nestedItems.length > 0);
                        const isNestedOpen = openNested[sub.id] ?? (activeSubTab === "department-chart" || activeSubTab === "department-list");
                        const isSubActive =
                          activeSection === item.label &&
                          (activeSubTab === sub.id || (hasNested && (activeSubTab === "department-chart" || activeSubTab === "department-list")));

                        return (
                          <div key={sub.id} style={{ display: "flex", flexDirection: "column" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (hasNested) {
                                  setOpenNested((prev) => ({
                                    ...prev,
                                    [sub.id]: !prev[sub.id],
                                  }));
                                  setActiveSection(item.label);
                                  if (!isNestedOpen && sub.nestedItems?.[0]) {
                                    setActiveSubTab(sub.nestedItems[0].id);
                                  }
                                } else {
                                  setActiveSection(item.label);
                                  setActiveSubTab(sub.id);
                                }
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: isSubActive && !hasNested ? "10px 14px" : "9px 14px 9px 28px",
                                borderRadius: isSubActive && !hasNested ? 12 : 10,
                                border: "none",
                                backgroundColor: isSubActive && !hasNested ? "#eaf8f4" : "transparent",
                                color: isSubActive ? "#004d66" : "#475569",
                                fontSize: isSubActive ? 14.5 : 14,
                                fontWeight: isSubActive ? 700 : 500,
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.15s ease",
                                width: "100%",
                              }}
                              onMouseEnter={(e) => {
                                if (!isSubActive) {
                                  e.currentTarget.style.backgroundColor = "#f8fafc";
                                  e.currentTarget.style.color = "#0f172a";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSubActive) {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                  e.currentTarget.style.color = "#475569";
                                }
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {isSubActive && !hasNested && (
                                  <span
                                    style={{
                                      width: 4,
                                      height: 18,
                                      backgroundColor: "#004d66",
                                      borderRadius: 2,
                                      marginRight: 2,
                                      flexShrink: 0,
                                      display: "inline-block",
                                    }}
                                  />
                                )}
                                <span>{sub.label}</span>
                              </div>
                              {sub.hasChevron && (
                                isNestedOpen ? (
                                  <ChevronUp size={14} color="#004d66" strokeWidth={2.2} />
                                ) : (
                                  <ChevronDown size={14} color="#94a3b8" />
                                )
                              )}
                            </button>

                            {/* Nested Sub-items (Department Chart & Department List) */}
                            {hasNested && isNestedOpen && (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                  marginTop: 2,
                                  marginBottom: 4,
                                }}
                              >
                                {sub.nestedItems!.map((nested) => {
                                  const isNestedActive =
                                    activeSection === item.label && activeSubTab === nested.id;

                                  return (
                                    <button
                                      key={nested.id}
                                      type="button"
                                      onClick={() => {
                                        setActiveSection(item.label);
                                        setActiveSubTab(nested.id);
                                      }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        padding: isNestedActive
                                          ? "8px 14px 8px 36px"
                                          : "8px 14px 8px 46px",
                                        borderRadius: 10,
                                        border: "none",
                                        backgroundColor: isNestedActive ? "#eaf8f4" : "transparent",
                                        color: isNestedActive ? "#004d66" : "#64748b",
                                        fontSize: 13.5,
                                        fontWeight: isNestedActive ? 700 : 500,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        transition: "all 0.15s ease",
                                        width: "100%",
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!isNestedActive) {
                                          e.currentTarget.style.backgroundColor = "#f8fafc";
                                          e.currentTarget.style.color = "#0f172a";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!isNestedActive) {
                                          e.currentTarget.style.backgroundColor = "transparent";
                                          e.currentTarget.style.color = "#64748b";
                                        }
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        {isNestedActive && (
                                          <span
                                            style={{
                                              width: 3.5,
                                              height: 16,
                                              backgroundColor: "#004d66",
                                              borderRadius: 2,
                                              marginRight: 2,
                                              flexShrink: 0,
                                              display: "inline-block",
                                            }}
                                          />
                                        )}
                                        <span>{nested.label}</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ================= EMS MAIN DASHBOARD VIEW ================= */}
        <main className="mobile-workspace-content"
          style={{
            flex: 1,
            padding: "28px 36px 60px",
            overflowY: "auto",
            maxWidth: 1320,
          }}
        >
          {activeSubTab === "my-attendance" && <AttendanceCalendar records={myAttendance} month={attendanceMonth} onMonthChange={setAttendanceMonth} loading={attendanceLoading} error={attendanceError} onRetry={() => void loadAttendance()} onDaySelect={entry => setSelectedDay({
            day: Number(entry.date.slice(-2)), dayOfWeek: new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' }),
            status: 'PRESENT', checkIn: attendanceTime(entry.checkIn), checkOut: attendanceTime(entry.checkOut),
            effectiveHours: `${(workedSeconds(entry) / 3600).toFixed(1)} hrs`, breakTime: `${(entry.breakSeconds / 60).toFixed(0)} min`,
            location: 'CRM session', notes: entry.checkOut ? 'Clocked out' : entry.breakStarted ? 'On break' : 'Checked in automatically when CRM opened',
          })} />}

          {/* ================= 2. TEAM ATTENDANCE TAB ================= */}
          {activeSubTab === "team-attendance" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: "#002735", margin: 0 }}>
                    Team Daily Attendance Matrix
                  </h2>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    Live check-ins for FastonMed team members (Today: {today})
                  </span>
                </div>
                <button
                  onClick={() => void loadAttendance()}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  ↻ Refresh Punches
                </button>
              </div>

              {selectedAttendanceMember && <TeamMemberAttendance key={selectedAttendanceMember.email} member={selectedAttendanceMember} onBack={() => setSelectedAttendanceMember(null)} />}
              {!selectedAttendanceMember && <>
              {attendanceError && <p role="alert" style={{ color: "#b45309" }}>{attendanceError}</p>}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "12px 18px", fontWeight: 600 }}>Team Member</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Department</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Check In</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Location</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th>
                      <th style={{ padding: "12px 18px", fontWeight: 600, textAlign: "right" }}>Working Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((r) => (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <button type="button" onClick={() => {
                            const member = employees.find(employee => employee.id === r.id);
                            if (member) setSelectedAttendanceMember(member);
                          }} aria-label={`View ${r.name}'s attendance`} style={{ display: "flex", alignItems: "center", gap: 10, border: 0, background: "transparent", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit" }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              backgroundColor: r.avatarBg,
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            {r.initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>{r.name}</div>
                            <div style={{ fontSize: 11.5, color: "#64748b" }}>{r.role}</div>
                          </div>
                          </button>
                        </td>
                        <td style={{ padding: "14px 16px", color: "#475569" }}>{r.dept}</td>
                        <td style={{ padding: "14px 16px", fontWeight: 600, color: "#0f172a" }}>
                          {r.checkIn}
                        </td>
                        <td style={{ padding: "14px 16px", color: "#64748b" }}>
                          Dubai Healthcare City HQ
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor:
                                (r.status === "ON TIME" || r.status === "PRESENT")
                                  ? "#dcfce7"
                                  : r.status === "LATE"
                                  ? "#fef3c7"
                                  : "#eff6ff",
                              color:
                                (r.status === "ON TIME" || r.status === "PRESENT")
                                  ? "#15803d"
                                  : r.status === "LATE"
                                  ? "#b45309"
                                  : "#1d4ed8",
                            }}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#004d66" }}>
                          {r.duration}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>}
            </div>
          )}



          {/* ================= 4. LEAVE AND WFH TABS ================= */}
          {activeSection === "Leave and WFH" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: "#002735", margin: 0 }}>
                    {activeSubTab === "my-leave" ? "My Leave & Work From Home" : activeSubTab === "team-leave" ? "Team Leave Calendar" : "Leave Policies"}
                  </h2>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    UAE Labour Law compliant annual, sick, and remote work balance
                  </span>
                </div>
                <button
                  onClick={() => setShowApplyLeaveModal(true)}
                  className="btn btn-primary"
                  style={{ backgroundColor: "#004d66", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                >
                  <Plus size={14} /> Apply for Leave
                </button>
              </div>

              {/* Balances Strip */}
              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <div className="card" style={{ padding: 18, borderLeft: "4px solid #004d66" }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Annual Leave (UAE Standard)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#002735", marginTop: 4 }}>
                    21 / 30 <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>days left</span>
                  </div>
                </div>

                <div className="card" style={{ padding: 18, borderLeft: "4px solid #059669" }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Sick Leave</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#002735", marginTop: 4 }}>
                    12 / 15 <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>days left</span>
                  </div>
                </div>

                <div className="card" style={{ padding: 18, borderLeft: "4px solid #2563eb" }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Casual / WFH Allowance</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#002735", marginTop: 4 }}>
                    4 / 6 <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>days left</span>
                  </div>
                </div>
              </div>

              {/* Leave Applications Table */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#002735" }}>
                    Leave Requests & Applications
                  </h3>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "12px 18px", fontWeight: 600 }}>Applicant</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Leave Type</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Duration</th>
                      <th style={{ padding: "12px 16px", fontWeight: 600 }}>Reason</th>
                      <th style={{ padding: "12px 18px", fontWeight: 600, textAlign: "right" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveApplications.map((l) => (
                      <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{l.name}</div>
                          <div style={{ fontSize: 11.5, color: "#64748b" }}>{l.role}</div>
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 600, color: "#004d66" }}>{l.type}</td>
                        <td style={{ padding: "14px 16px", color: "#334155" }}>{l.from} → {l.to}</td>
                        <td style={{ padding: "14px 16px", color: "#64748b" }}>{l.reason}</td>
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <span
                            style={{
                              padding: "4px 9px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: l.status === "Approved" ? "#dcfce7" : "#fef3c7",
                              color: l.status === "Approved" ? "#15803d" : "#b45309",
                            }}
                          >
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= 5. MY TEAM SECTION ================= */}
          {activeSection === "My Team" && (
            <div>
              {/* SUBTAB 1: MANAGE TEAM (Screenshots 1, 5-9) */}
              {activeSubTab === "manage-team" && (
                <div>
                  {selectedEmployeeForDetail ? (
                    /* ================= DETAIL EMPLOYEE VIEW (Screenshots 5-9) ================= */
                    <div>
                      {/* Back button */}
                      <div className="detail-header-bar" style={{ marginBottom: 20 }}>
                        <button
                          type="button"
                          className="back-to-directory-btn"
                          onClick={() => setSelectedEmployeeForDetail(null)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            background: "none",
                            border: "none",
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#0f172a",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <ArrowLeft size={18} /> Detail Employee
                        </button>
                      </div>

                      <div className="detail-layout-container">
                        {/* Left Column - Profile Card (Screenshots 5-9) */}
                        <div className="profile-left-col">
                          <div className="profile-card-header">
                            <div className="profile-card-avatar">
                              <span>{getInitials(selectedEmployeeForDetail.fullName)}</span>
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  backgroundColor: "rgba(15, 23, 42, 0.65)",
                                  color: "#ffffff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "3px 0",
                                  cursor: "pointer",
                                }}
                                title="Change Photo"
                                onClick={() => toast.success("Upload photo clicked")}
                              >
                                <Camera size={12} />
                              </div>
                            </div>
                            <h3>{selectedEmployeeForDetail.fullName}</h3>
                            <p className="profile-card-title">{selectedEmployeeForDetail.designationTitle}</p>

                            <div className="profile-card-status">
                              <span className="status-pill pill-active">
                                {selectedEmployeeForDetail.status}
                              </span>
                            </div>
                          </div>

                          <div className="profile-card-contact-list">
                            <div className="contact-item">
                              <Mail size={16} />
                              <span>{selectedEmployeeForDetail.email || "Not added"}</span>
                            </div>
                            <div className="contact-item">
                              <Phone size={16} />
                              <span>{selectedEmployeeForDetail.phone || "7306191793"}</span>
                            </div>
                            <div className="contact-item">
                              <Globe size={16} />
                              <span>GMT +05:30</span>
                            </div>
                          </div>

                          <div className="profile-card-meta-list">
                            <div className="meta-list-item">
                              <div className="meta-item-label">Employee ID</div>
                              <div className="meta-item-value">{selectedEmployeeForDetail.employeeCode}</div>
                            </div>
                            <div className="meta-list-item">
                              <div className="meta-item-label">Department</div>
                              <div className="meta-item-value">{selectedEmployeeForDetail.departmentName}</div>
                            </div>
                            <div className="meta-list-item">
                              <div className="meta-item-label">Office</div>
                              <div className="meta-item-value">{selectedEmployeeForDetail.officeName}</div>
                            </div>
                            <div className="meta-list-item">
                              <div className="meta-item-label">Line Manager</div>
                              <div className="meta-item-value">
                                <div className="manager-pill-inline">
                                  <span className="manager-avatar-mini">
                                    {selectedEmployeeForDetail.managerName ? selectedEmployeeForDetail.managerName[0] : "H"}
                                  </span>
                                  <span>{selectedEmployeeForDetail.managerName || "Hashim VP"}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="profile-card-actions">
                            <button
                              type="button"
                              className="profile-cta-btn"
                              onClick={() => openEditEmployeeModal(selectedEmployeeForDetail)}
                            >
                              <Edit size={14} /> Edit Profile
                            </button>
                          </div>
                        </div>

                        {/* Right Column - Tabbed Details (Screenshots 5-9) */}
                        <div className="profile-right-col">
                          <nav className="profile-detail-tabs">
                            {[
                              { id: "general", label: "General" },
                              { id: "job", label: "Job" },
                              { id: "payroll", label: "Payroll" },
                              { id: "documents", label: "Documents" },
                              { id: "onboarding", label: "Onboarding & Exit" },
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                className={detailTab === tab.id ? "active" : ""}
                                onClick={() => setDetailTab(tab.id as any)}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </nav>

                          {/* TAB 1: GENERAL (Screenshot 5) */}
                          {detailTab === "general" && (
                            <div className="content-card-box">
                              <div className="card-box-header">
                                <h3>Personal Information</h3>
                              </div>
                              <div className="card-box-grid">
                                <div className="grid-item">
                                  <span className="meta-item-label">Full Name</span>
                                  <strong className="meta-item-value">{selectedEmployeeForDetail.fullName}</strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Personal Email</span>
                                  <strong className="meta-item-value">
                                    {selectedEmployeeForDetail.email || "Not added"}
                                  </strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Date of Birth</span>
                                  <strong className="meta-item-value">16/9/2003</strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Gender</span>
                                  <strong className="meta-item-value">Female</strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">PAN / Tax ID</span>
                                  <strong className="meta-item-value">-</strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Emergency Contact</span>
                                  <strong className="meta-item-value">Basheer</strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Emergency Phone</span>
                                  <strong className="meta-item-value">8086787772</strong>
                                </div>
                                <div className="grid-item" style={{ gridColumn: "span 2" }}>
                                  <span className="meta-item-label">Residential Address</span>
                                  <strong className="meta-item-value">
                                    Peringoden House, Klari Moochikkal , Malappuram, Kerala
                                  </strong>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TAB 2: JOB (Screenshot 6) */}
                          {detailTab === "job" && (
                            <div className="content-card-box">
                              <div className="card-box-header">
                                <h3>Job Details</h3>
                              </div>
                              <div className="card-box-grid">
                                <div className="grid-item">
                                  <span className="meta-item-label">Employee ID</span>
                                  <strong className="meta-item-value">{selectedEmployeeForDetail.employeeCode}</strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Designation</span>
                                  <strong className="meta-item-value">
                                    {selectedEmployeeForDetail.designationTitle}
                                  </strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Department</span>
                                  <strong className="meta-item-value">
                                    {selectedEmployeeForDetail.departmentName}
                                  </strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Date of Joining</span>
                                  <strong className="meta-item-value">8/9/2025</strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Office / Branch</span>
                                  <strong className="meta-item-value">
                                    {selectedEmployeeForDetail.officeName}
                                  </strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Portal Access</span>
                                  <strong className="meta-item-value" style={{ color: "#059669" }}>
                                    Active
                                  </strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Biometric ID</span>
                                  <strong className="meta-item-value">{selectedEmployeeForDetail.employeeCode}</strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Onboarding Status</span>
                                  <strong className="meta-item-value">Not Started</strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Shift Assignment</span>
                                  <strong className="meta-item-value">Default Shift (09:00 - 18:00)</strong>
                                </div>
                                <div className="grid-item">
                                  <span className="meta-item-label">Attendance Criteria</span>
                                  <strong className="meta-item-value">Standard Shift Hours (9h)</strong>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TAB 3: PAYROLL (Screenshot 7) */}
                          {detailTab === "payroll" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                              <div
                                style={{
                                  backgroundColor: "#f0fdf4",
                                  border: "1px solid #bbf7d0",
                                  borderRadius: 16,
                                  padding: 24,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                  <h3 style={{ margin: 0, fontSize: 16, color: "#166534", fontWeight: 800 }}>
                                    Compensation Summary
                                  </h3>
                                </div>
                                <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                                  <div>
                                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", marginBottom: 4 }}>
                                      ANNUAL CTC
                                    </span>
                                    <span style={{ fontSize: 26, fontWeight: 800, color: "#15803d" }}>
                                      ₹96,000
                                    </span>
                                  </div>
                                  <div>
                                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", marginBottom: 4 }}>
                                      MONTHLY GROSS
                                    </span>
                                    <span style={{ fontSize: 26, fontWeight: 800, color: "#15803d" }}>
                                      ₹8,000
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="content-card-box">
                                <div className="card-box-header">
                                  <h3>Salary Structure Details</h3>
                                </div>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                                  <thead>
                                    <tr style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                                      <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11.5, color: "#64748b", textTransform: "uppercase" }}>
                                        COMPONENT NAME
                                      </th>
                                      <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11.5, color: "#64748b", textTransform: "uppercase" }}>
                                        MONTHLY AMOUNT
                                      </th>
                                      <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11.5, color: "#64748b", textTransform: "uppercase" }}>
                                        ANNUAL AMOUNT
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "14px", fontWeight: 600, color: "#0f172a" }}>Basic Salary</td>
                                      <td style={{ padding: "14px", fontWeight: 700, color: "#0f172a" }}>₹8,000</td>
                                      <td style={{ padding: "14px", fontWeight: 700, color: "#0f172a" }}>₹96,000</td>
                                    </tr>
                                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "14px", fontWeight: 600, color: "#0f172a" }}>Allowances</td>
                                      <td style={{ padding: "14px", color: "#64748b" }}>₹0</td>
                                      <td style={{ padding: "14px", color: "#64748b" }}>₹0</td>
                                    </tr>
                                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "14px", fontWeight: 600, color: "#dc2626" }}>Deductions</td>
                                      <td style={{ padding: "14px", color: "#dc2626", fontWeight: 600 }}>₹0</td>
                                      <td style={{ padding: "14px", color: "#dc2626", fontWeight: 600 }}>₹0</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* TAB 4: DOCUMENTS (Screenshot 8) */}
                          {detailTab === "documents" && (
                            <div className="content-card-box">
                              <div className="card-box-header">
                                <h3>Uploaded Documents</h3>
                              </div>
                              <div
                                style={{
                                  padding: 40,
                                  textAlign: "center",
                                  color: "#94a3b8",
                                  fontSize: 14,
                                }}
                              >
                                No documents uploaded yet.
                              </div>
                            </div>
                          )}

                          {/* TAB 5: ONBOARDING & EXIT (Screenshot 9) */}
                          {detailTab === "onboarding" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                              <div className="content-card-box">
                                <div className="card-box-header">
                                  <h3>Active Lifecycle Checklists</h3>
                                </div>
                                <div
                                  style={{
                                    border: "1.5px dashed #cbd5e1",
                                    borderRadius: 12,
                                    padding: 32,
                                    textAlign: "center",
                                    color: "#64748b",
                                    fontSize: 14,
                                  }}
                                >
                                  No active onboarding or exit checklists found for this employee.
                                </div>
                              </div>

                              <div className="content-card-box">
                                <div className="card-box-header">
                                  <h3>Assign New Checklist</h3>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 400 }}>
                                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#475569" }}>
                                    Select Template
                                    <select
                                      style={{
                                        height: 40,
                                        padding: "0 12px",
                                        borderRadius: 8,
                                        border: "1px solid #cbd5e1",
                                        fontSize: 13.5,
                                        color: "#1e293b",
                                        backgroundColor: "#ffffff",
                                      }}
                                    >
                                      <option value="">-- Choose Blueprint Template --</option>
                                      <option value="onboarding-standard">Standard Employee Onboarding</option>
                                      <option value="onboarding-technical">Technical Team Onboarding</option>
                                      <option value="exit-clearance">Offboarding & Handover Clearance</option>
                                    </select>
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => toast.success("Lifecycle checklist initiated")}
                                    style={{
                                      height: 38,
                                      padding: "0 18px",
                                      backgroundColor: "#047857",
                                      color: "#ffffff",
                                      borderRadius: 8,
                                      fontWeight: 600,
                                      border: "none",
                                      cursor: "pointer",
                                      fontSize: 13.5,
                                      width: "fit-content",
                                    }}
                                  >
                                    Start Checklist
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ================= MANAGE TEAM DIRECTORY TABLE (Screenshot 1) ================= */
                    <div>
                      {/* Title & Action Buttons */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          marginBottom: 20,
                          flexWrap: "wrap",
                          gap: 12,
                        }}
                      >
                        <div>
                          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", margin: 0 }}>
                            My Team
                          </h1>
                          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                            Manage your Team
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => toast.success("Exporting employee directory...")}
                            style={{
                              height: 38,
                              padding: "0 16px",
                              backgroundColor: "#ffffff",
                              color: "#334155",
                              border: "1px solid #cbd5e1",
                              borderRadius: 8,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontSize: 13.5,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Download size={15} /> Download
                          </button>
                          <button
                            type="button"
                            onClick={openAddEmployeeModal}
                            style={{
                              height: 38,
                              padding: "0 18px",
                              backgroundColor: "#047857",
                              color: "#ffffff",
                              borderRadius: 8,
                              fontWeight: 600,
                              cursor: "pointer",
                              border: "none",
                              fontSize: 13.5,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Plus size={16} /> Add Employee
                          </button>
                        </div>
                      </div>

                      {/* Filter Bar */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 16,
                          marginBottom: 20,
                          flexWrap: "wrap",
                        }}
                      >
                        {/* Search Input */}
                        <div style={{ position: "relative", minWidth: 260, flex: 1 }}>
                          <input
                            type="text"
                            placeholder="Search employee"
                            value={employeeSearchQuery}
                            onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "10px 38px 10px 14px",
                              borderRadius: 8,
                              border: "1px solid #e2e8f0",
                              backgroundColor: "#ffffff",
                              fontSize: 14,
                              color: "#1e293b",
                              outline: "none",
                            }}
                          />
                          <Search
                            size={16}
                            color="#94a3b8"
                            style={{
                              position: "absolute",
                              right: 14,
                              top: "50%",
                              transform: "translateY(-50%)",
                              pointerEvents: "none",
                            }}
                          />
                        </div>

                        {/* Filter Selects */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <select
                            value={selectedCompanyFilter}
                            onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                            style={{
                              padding: "9px 14px",
                              borderRadius: 8,
                              border: "1px solid #e2e8f0",
                              backgroundColor: "#ffffff",
                              fontSize: 13.5,
                              fontWeight: 600,
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            <option value="All">All Companies</option>
                            {stemsCompanies.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          <select
                            value={selectedOfficeFilter}
                            onChange={(e) => setSelectedOfficeFilter(e.target.value)}
                            style={{
                              padding: "9px 14px",
                              borderRadius: 8,
                              border: "1px solid #e2e8f0",
                              backgroundColor: "#ffffff",
                              fontSize: 13.5,
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            <option value="All">All Offices</option>
                            <option value="Dubai Healthcare City HQ">Dubai Healthcare City HQ</option>
                          </select>

                          <select
                            value={selectedJobTitleFilter}
                            onChange={(e) => setSelectedJobTitleFilter(e.target.value)}
                            style={{
                              padding: "9px 14px",
                              borderRadius: 8,
                              border: "1px solid #e2e8f0",
                              backgroundColor: "#ffffff",
                              fontSize: 13.5,
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            <option value="All">All Job Titles</option>
                            {[
                              "Growth Head",
                              "Creative Head",
                              "HR Head",
                              "Finance Head",
                              "Senior Data Entry Specialist",
                              "Junior Data Entry Specialist",
                              "Designer",
                              "Video Editor",
                              "SEO Executive",
                              "Digital Marketer",
                            ].map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>

                          <select
                            value={selectedStatusFilter}
                            onChange={(e) => setSelectedStatusFilter(e.target.value)}
                            style={{
                              padding: "9px 14px",
                              borderRadius: 8,
                              border: "1px solid #e2e8f0",
                              backgroundColor: "#ffffff",
                              fontSize: 13.5,
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            <option value="All">All Status</option>
                            <option value="ACTIVE">Active</option>
                            <option value="ON BOARDING">On Boarding</option>
                            <option value="PROBATION">Probation</option>
                            <option value="ON LEAVE">On Leave</option>
                          </select>
                        </div>
                      </div>

                      {/* Manage Team Table */}
                      <div
                        className="card"
                        style={{
                          padding: 0,
                          overflow: "hidden",
                          border: "1px solid #e2e8f0",
                          borderRadius: 10,
                        }}
                      >
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            textAlign: "left",
                            fontSize: 13.5,
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: "#fafbfc",
                                color: "#64748b",
                                borderBottom: "1px solid #e2e8f0",
                                fontSize: 12,
                                textTransform: "uppercase",
                                letterSpacing: "0.03em",
                              }}
                            >
                              <th style={{ padding: "14px 18px", width: 40 }}>
                                <input
                                  type="checkbox"
                                  style={{ width: 16, height: 16, borderRadius: 4, cursor: "pointer" }}
                                  checked={
                                    stemsEmployees.filter((e) => e.status !== "TERMINATED").length > 0 &&
                                    stemsEmployees
                                      .filter((e) => e.status !== "TERMINATED")
                                      .every((e) => selectedCheckboxes[e.id])
                                  }
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    const newMap: Record<string, boolean> = {};
                                    stemsEmployees.forEach((emp) => {
                                      newMap[emp.id] = checked;
                                    });
                                    setSelectedCheckboxes(newMap);
                                  }}
                                />
                              </th>
                              <th style={{ padding: "14px 16px", fontWeight: 700, color: "#1e293b" }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    color: "#004d66",
                                  }}
                                >
                                  EMPLOYEE ID ▲
                                </span>
                              </th>
                              <th style={{ padding: "14px 16px", fontWeight: 700 }}>EMPLOYEE NAME</th>
                              <th style={{ padding: "14px 16px", fontWeight: 700 }}>JOB TITLE</th>
                              <th style={{ padding: "14px 16px", fontWeight: 700 }}>LINE MANAGER</th>
                              <th style={{ padding: "14px 16px", fontWeight: 700 }}>DEPARTMENT</th>
                              <th style={{ padding: "14px 18px", fontWeight: 700 }}>OFFICE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stemsEmployees
                              .filter((emp) => emp.status !== "TERMINATED")
                              .filter((emp) => {
                                if (
                                  selectedCompanyFilter !== "All" &&
                                  emp.companyName !== selectedCompanyFilter
                                )
                                  return false;
                                if (
                                  selectedOfficeFilter !== "All" &&
                                  emp.officeName !== selectedOfficeFilter
                                )
                                  return false;
                                if (
                                  selectedJobTitleFilter !== "All" &&
                                  emp.designationTitle !== selectedJobTitleFilter
                                )
                                  return false;
                                if (
                                  selectedStatusFilter !== "All" &&
                                  emp.status !== selectedStatusFilter
                                )
                                  return false;
                                if (employeeSearchQuery.trim()) {
                                  const q = employeeSearchQuery.toLowerCase();
                                  return (
                                    emp.fullName.toLowerCase().includes(q) ||
                                    emp.employeeCode.toLowerCase().includes(q) ||
                                    emp.designationTitle.toLowerCase().includes(q) ||
                                    emp.departmentName.toLowerCase().includes(q)
                                  );
                                }
                                return true;
                              })
                              .map((emp) => {
                                const isChecked = !!selectedCheckboxes[emp.id];
                                return (
                                  <tr
                                    key={emp.id}
                                    style={{
                                      borderBottom: "1px solid #f1f5f9",
                                      backgroundColor: isChecked ? "#f8fafc" : "#ffffff",
                                      transition: "background-color 0.1s",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => openEmployeeDetail(emp)}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.backgroundColor = isChecked
                                        ? "#f1f5f9"
                                        : "#fafbfc")
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.backgroundColor = isChecked
                                        ? "#f8fafc"
                                        : "#ffffff")
                                    }
                                  >
                                    <td
                                      style={{ padding: "14px 18px" }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() =>
                                          setSelectedCheckboxes((prev) => ({
                                            ...prev,
                                            [emp.id]: !prev[emp.id],
                                          }))
                                        }
                                        style={{ width: 16, height: 16, borderRadius: 4, cursor: "pointer" }}
                                      />
                                    </td>
                                    <td style={{ padding: "14px 16px" }}>
                                      <span
                                        style={{
                                          display: "inline-block",
                                          padding: "3px 8px",
                                          backgroundColor: "#f1f5f9",
                                          borderRadius: 6,
                                          fontWeight: 700,
                                          fontSize: 12.5,
                                          color: "#334155",
                                          fontFamily: "monospace",
                                        }}
                                      >
                                        {emp.employeeCode}
                                      </span>
                                    </td>
                                    <td style={{ padding: "14px 16px" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div
                                          style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: "50%",
                                            backgroundColor: "#ecfdf5",
                                            color: "#047857",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 11.5,
                                            fontWeight: 700,
                                            border: "1px solid #bbf7d0",
                                          }}
                                        >
                                          {getInitials(emp.fullName)}
                                        </div>
                                        <span style={{ fontWeight: 600, color: "#0f172a" }}>
                                          {emp.fullName}
                                        </span>
                                      </div>
                                    </td>
                                    <td style={{ padding: "14px 16px", color: "#475569" }}>
                                      {emp.designationTitle}
                                    </td>
                                    <td style={{ padding: "14px 16px" }}>
                                      {emp.managerName ? (
                                        <span style={{ color: "#059669", fontWeight: 600 }}>
                                          @{emp.managerName}
                                        </span>
                                      ) : (
                                        <span style={{ color: "#94a3b8" }}>-</span>
                                      )}
                                    </td>
                                    <td style={{ padding: "14px 16px", color: "#475569" }}>
                                      {emp.departmentName}
                                    </td>
                                    <td style={{ padding: "14px 18px", color: "#64748b" }}>
                                      {emp.officeName}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB 2: OFFBOARDING (Screenshot 2) */}
              {activeSubTab === "offboarding" && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 20,
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", margin: 0 }}>
                        Offboarding
                      </h1>
                      <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                        Ex employees history
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => {
                          const csvRows = [
                            ["EMPLOYEE ID", "NAME", "JOB TITLE", "LINE MANAGER", "DEPARTMENT", "OFFICE", "STATUS"],
                            ...stemsEmployees
                              .filter((e) => e.status === "TERMINATED")
                              .map((e) => [
                                e.employeeCode,
                                e.fullName,
                                e.designationTitle,
                                e.managerName || "-",
                                e.departmentName,
                                e.officeName,
                                e.status,
                              ]),
                          ];
                          const blob = new Blob([csvRows.map((r) => r.join(",")).join("\n")], {
                            type: "text/csv;charset=utf-8;",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "ex_employees_report.csv";
                          a.click();
                          toast.success("Downloaded offboarding report");
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          backgroundColor: "#ffffff",
                          color: "#1f2937",
                          border: "1px solid #d1d5db",
                          borderRadius: 8,
                          padding: "9px 16px",
                          fontWeight: 600,
                          fontSize: 13.5,
                          cursor: "pointer",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                        }}
                      >
                        <Download size={16} />
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => toast.success("Offboarding flow initiated")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          backgroundColor: "#ef4444",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 8,
                          padding: "9px 16px",
                          fontWeight: 600,
                          fontSize: 13.5,
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={16} />
                        Offboarding
                      </button>
                    </div>
                  </div>

                  {/* Filter Bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      marginBottom: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ position: "relative", minWidth: 260, flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Search employee"
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 38px 10px 14px",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#ffffff",
                          fontSize: 14,
                          color: "#1e293b",
                          outline: "none",
                        }}
                      />
                      <Search
                        size={16}
                        color="#94a3b8"
                        style={{
                          position: "absolute",
                          right: 14,
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <select
                        value={selectedCompanyFilter}
                        onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                        style={{
                          padding: "9px 14px",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#ffffff",
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#475569",
                          cursor: "pointer",
                        }}
                      >
                        <option value="All">All Companies</option>
                        {stemsCompanies.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={selectedOfficeFilter}
                        onChange={(e) => setSelectedOfficeFilter(e.target.value)}
                        style={{
                          padding: "9px 14px",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#ffffff",
                          fontSize: 13.5,
                          color: "#475569",
                          cursor: "pointer",
                        }}
                      >
                        <option value="All">All Offices</option>
                        <option value="Dubai Healthcare City HQ">Dubai Healthcare City HQ</option>
                      </select>

                      <select
                        value={selectedJobTitleFilter}
                        onChange={(e) => setSelectedJobTitleFilter(e.target.value)}
                        style={{
                          padding: "9px 14px",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#ffffff",
                          fontSize: 13.5,
                          color: "#475569",
                          cursor: "pointer",
                        }}
                      >
                        <option value="All">All Job Titles</option>
                        <option value="Video Editor">Video Editor</option>
                      </select>

                      <select
                        value={selectedStatusFilter}
                        onChange={(e) => setSelectedStatusFilter(e.target.value)}
                        style={{
                          padding: "9px 14px",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#ffffff",
                          fontSize: 13.5,
                          color: "#475569",
                          cursor: "pointer",
                        }}
                      >
                        <option value="All">All Status</option>
                        <option value="TERMINATED">Terminated</option>
                      </select>
                    </div>
                  </div>

                  {/* Offboarding Table */}
                  <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13.5 }}>
                      <thead>
                        <tr style={{ backgroundColor: "#fafbfc", color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          <th style={{ padding: "14px 18px", width: 40 }}>
                            <input type="checkbox" style={{ width: 16, height: 16, borderRadius: 4, cursor: "pointer" }} />
                          </th>
                          <th style={{ padding: "14px 16px", fontWeight: 700, color: "#1e293b" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#004d66" }}>
                              EMPLOYEE ID ▲
                            </span>
                          </th>
                          <th style={{ padding: "14px 16px", fontWeight: 700 }}>EMPLOYEE NAME</th>
                          <th style={{ padding: "14px 16px", fontWeight: 700 }}>JOB TITLE</th>
                          <th style={{ padding: "14px 16px", fontWeight: 700 }}>LINE MANAGER</th>
                          <th style={{ padding: "14px 16px", fontWeight: 700 }}>DEPARTMENT</th>
                          <th style={{ padding: "14px 16px", fontWeight: 700 }}>OFFICE</th>
                          <th style={{ padding: "14px 18px", fontWeight: 700 }}>EMPLOYEE STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stemsEmployees
                          .filter((emp) => emp.status === "TERMINATED")
                          .map((emp) => (
                            <tr key={emp.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#ffffff" }}>
                              <td style={{ padding: "14px 18px" }}>
                                <input type="checkbox" style={{ width: 16, height: 16, borderRadius: 4, cursor: "pointer" }} />
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "3px 8px",
                                    backgroundColor: "#f1f5f9",
                                    borderRadius: 6,
                                    fontWeight: 700,
                                    fontSize: 12.5,
                                    color: "#334155",
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {emp.employeeCode}
                                </span>
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: "50%",
                                      backgroundColor: "#f1f5f9",
                                      color: "#475569",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      border: "1px solid #e2e8f0",
                                    }}
                                  >
                                    MSP
                                  </div>
                                  <span style={{ fontWeight: 600, color: "#0f172a" }}>
                                    {emp.fullName}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: "14px 16px", color: "#475569" }}>
                                {emp.designationTitle}
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                <span style={{ color: "#059669", fontWeight: 600 }}>
                                  @{emp.managerName || "Nithin Bhaskar"}
                                </span>
                              </td>
                              <td style={{ padding: "14px 16px", color: "#475569" }}>
                                {emp.departmentName}
                              </td>
                              <td style={{ padding: "14px 16px", color: "#64748b" }}>
                                {emp.officeName}
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    backgroundColor: "#fee2e2",
                                    color: "#dc2626",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  TERMINATED
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", padding: "4px 2px" }}>
                    Total {stemsEmployees.filter((e) => e.status === "TERMINATED").length} employees
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ================= 6. COMPANY SECTION (REPLICATING STEMS) ================= */}
          {activeSection === "Company" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Common Company Header (Screenshots 1-5) */}
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>
                  Company
                </h2>
                <p style={{ fontSize: 13.5, color: "#64748b", margin: 0 }}>
                  View and manage company details, offices, departments, job titles, and work schedules.
                </p>
              </div>

              {/* TAB 1: OFFICES (Screenshot 1) */}
              {activeSubTab === "offices" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                      Offices & Locations
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddOfficeModal(true)}
                      style={{
                        height: 38,
                        padding: "0 18px",
                        backgroundColor: "#047857",
                        color: "#ffffff",
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "none",
                        fontSize: 13.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "background-color 0.15s",
                      }}
                    >
                      <Plus size={16} /> Add Office
                    </button>
                  </div>

                  <div data-mobile-grid="stack"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))",
                      gap: 20,
                    }}
                  >
                    {offices.map((office) => (
                      <article
                        key={office.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: 24,
                          display: "flex",
                          flexDirection: "column",
                          gap: 20,
                          position: "relative",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        }}
                      >
                        {/* Row 1: Title and Three-dots */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                              {office.name}
                            </h4>
                            {office.isHQ && (
                              <span
                                style={{
                                  backgroundColor: "#ecfdf5",
                                  color: "#047857",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 12,
                                }}
                              >
                                HQ
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => toast.success(`Office actions for ${office.name}`)}
                            style={{
                              border: "none",
                              background: "none",
                              color: "#64748b",
                              cursor: "pointer",
                              padding: 4,
                            }}
                          >
                            <MoreVertical size={18} />
                          </button>
                        </div>

                        {/* Row 2: Location & Switch Toggle */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid #f1f5f9",
                            paddingBottom: 16,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 13,
                              color: "#64748b",
                              fontWeight: 500,
                            }}
                          >
                            <span style={{ color: "#0f172a", fontWeight: 600 }}>{office.placeName}</span>
                            <span>•</span>
                            <span>{office.country}</span>
                          </div>

                          <label
                            style={{
                              position: "relative",
                              display: "inline-block",
                              width: 42,
                              height: 24,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={office.active}
                              onChange={() => {
                                setOffices((prev) =>
                                  prev.map((o) =>
                                    o.id === office.id ? { ...o, active: !o.active } : o
                                  )
                                );
                                toast.success(`${office.name} status updated`);
                              }}
                              style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: office.active ? "#10b981" : "#cbd5e1",
                                borderRadius: 34,
                                transition: "0.2s",
                              }}
                            >
                              <span
                                style={{
                                  position: "absolute",
                                  height: 18,
                                  width: 18,
                                  left: office.active ? 20 : 3,
                                  bottom: 3,
                                  backgroundColor: "white",
                                  borderRadius: "50%",
                                  transition: "0.2s",
                                }}
                              />
                            </span>
                          </label>
                        </div>

                        {/* Row 3 & 4: 2x2 Details Grid */}
                        <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                          <div>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748b",
                                textTransform: "uppercase",
                                marginBottom: 4,
                              }}
                            >
                              NUMBER OF EMPLOYEES
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                              {office.employeeCount}
                            </span>
                          </div>
                          <div>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748b",
                                textTransform: "uppercase",
                                marginBottom: 4,
                              }}
                            >
                              TIMEZONE
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                              {office.timezone}
                            </span>
                          </div>
                        </div>

                        <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                          <div>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748b",
                                textTransform: "uppercase",
                                marginBottom: 4,
                              }}
                            >
                              CONTACT NUMBER
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                              {office.phone}
                            </span>
                          </div>
                          <div>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748b",
                                textTransform: "uppercase",
                                marginBottom: 4,
                              }}
                            >
                              CONTACT EMAIL
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                              {office.email}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: COMPANY INFO (Screenshot 2) */}
              {(activeSubTab === "company-info" || activeSubTab === "Company") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                      Company Info
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddCompanyModal(true)}
                      style={{
                        height: 38,
                        padding: "0 18px",
                        backgroundColor: "#047857",
                        color: "#ffffff",
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "none",
                        fontSize: 13.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "background-color 0.15s",
                      }}
                    >
                      <Plus size={16} /> Add Company
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {companyDetails.map((company) => (
                      <article
                        key={company.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: 24,
                          display: "flex",
                          flexDirection: "column",
                          gap: 20,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        }}
                      >
                        {/* Header: Company Name & Buttons */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                            {company.name}
                          </h4>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCompany(company);
                                setShowAddCompanyModal(true);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 14px",
                                backgroundColor: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: 8,
                                color: "#334155",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <Pencil size={14} /> Edit Profile
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${company.name}?`)) {
                                  setCompanyDetails((prev) => prev.filter((c) => c.id !== company.id));
                                  toast.success(`${company.name} removed`);
                                }
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 14px",
                                backgroundColor: "#fef2f2",
                                border: "1px solid #fecaca",
                                borderRadius: 8,
                                color: "#ef4444",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                          <div>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748b",
                                textTransform: "uppercase",
                                marginBottom: 4,
                              }}
                            >
                              COMPANY NAME
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                              {company.name}
                            </span>
                          </div>
                          <div>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748b",
                                textTransform: "uppercase",
                                marginBottom: 4,
                              }}
                            >
                              COMPANY WEBSITE
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#047857" }}>
                              {company.legalName}
                            </span>
                          </div>
                        </div>

                        <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                          <div>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748b",
                                textTransform: "uppercase",
                                marginBottom: 4,
                              }}
                            >
                              CONTACT NUMBER
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                              {company.phoneCode} {company.phone}
                            </span>
                          </div>
                          <div>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#64748b",
                                textTransform: "uppercase",
                                marginBottom: 4,
                              }}
                            >
                              CONTACT EMAIL
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                              {company.email}
                            </span>
                          </div>
                        </div>

                        <div>
                          <span
                            style={{
                              display: "block",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#64748b",
                              textTransform: "uppercase",
                              marginBottom: 4,
                            }}
                          >
                            COMPANY OVERVIEW
                          </span>
                          <p style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.6, margin: 0 }}>
                            {company.overview}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: DEPARTMENT CHART (Screenshot 3) */}
              {activeSubTab === "department-chart" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                      Department Chart
                    </h3>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginRight: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Company:</span>
                        <select
                          value={selectedDeptCompanyId}
                          onChange={(e) => setSelectedDeptCompanyId(e.target.value)}
                          style={{
                            height: 32,
                            padding: "0 10px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            backgroundColor: "#ffffff",
                            color: "#1e293b",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          {companyDetails.map((comp) => (
                            <option key={comp.id} value={comp.id}>
                              {comp.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsDeptFullScreen(true)}
                        style={{
                          height: 32,
                          padding: "0 12px",
                          fontSize: 13,
                          fontWeight: 600,
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          backgroundColor: "#ffffff",
                          color: "#1e293b",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                        }}
                      >
                        <Maximize2 size={14} /> Fullscreen
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAddDeptModal(true)}
                        style={{
                          height: 32,
                          padding: "0 12px",
                          fontSize: 13,
                          fontWeight: 600,
                          backgroundColor: "#0f172a",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 8,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={14} /> Add Department
                      </button>
                    </div>
                  </div>

                  {/* Centered Tree Canvas */}
                  <div className="dept-tree-canvas">
                    <div className="dept-tree">
                      {(() => {
                        const compDepts = departments.filter(
                          (d) => d.companyId === selectedDeptCompanyId
                        );
                        const rootNode = compDepts.find((d) => d.code === "root") || {
                          id: "root",
                          name: "Core Team",
                          code: "root",
                          companyId: selectedDeptCompanyId,
                          companyName: "FastonMed",
                          parent: "root",
                          parentName: "Core Team",
                          jobTitlesCount: 4,
                        };

                        const renderNodeRecursively = (parentId: string): React.ReactNode => {
                          if (parentId === "root") {
                            const children = compDepts.filter(
                              (d) =>
                                (d.parent === "root" || d.parent === rootNode.id) &&
                                d.code !== "root"
                            );

                            return (
                              <div className="dept-node-container" key={rootNode.id}>
                                <div className="dept-node-card">
                                  <span className="dept-node-title">{rootNode.name}</span>
                                  <button
                                    type="button"
                                    className="dept-node-pencil"
                                    title="Edit Department"
                                    onClick={() => toast.success(`Edit ${rootNode.name}`)}
                                  >
                                    <Pencil size={10} />
                                  </button>
                                  <button
                                    type="button"
                                    className="dept-node-plus"
                                    title="Add Sub-department"
                                    onClick={() => setShowAddDeptModal(true)}
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>

                                {children.length > 0 && (
                                  <div className="dept-children-container">
                                    {children.map((child) => renderNodeRecursively(child.id))}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          const node = compDepts.find((d) => d.id === parentId);
                          if (!node) return null;

                          const children = compDepts.filter((d) => d.parent === node.id);

                          return (
                            <div className="dept-node-container" key={node.id}>
                              <div className="dept-node-card">
                                <span className="dept-node-title">{node.name}</span>
                                <button
                                  type="button"
                                  className="dept-node-pencil"
                                  title="Edit Department"
                                  onClick={() => toast.success(`Edit ${node.name}`)}
                                >
                                  <Pencil size={10} />
                                </button>
                                <button
                                  type="button"
                                  className="dept-node-plus"
                                  title="Add Sub-department"
                                  onClick={() => setShowAddDeptModal(true)}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>

                              {children.length > 0 && (
                                <div className="dept-children-container">
                                  {children.map((child) => renderNodeRecursively(child.id))}
                                </div>
                              )}
                            </div>
                          );
                        };

                        return renderNodeRecursively("root");
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: DEPARTMENT LIST (Screenshot 4) */}
              {activeSubTab === "department-list" && (
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 24,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  {/* Header row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 20,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                      Department List
                    </h3>

                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Company:</span>
                        <select
                          value={filterDeptCompanyId}
                          onChange={(e) => setFilterDeptCompanyId(e.target.value)}
                          style={{
                            height: 36,
                            padding: "0 10px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            backgroundColor: "#ffffff",
                            color: "#1e293b",
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value="">All Companies</option>
                          {companyDetails.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <Search size={16} style={{ position: "absolute", left: 12, color: "#94a3b8" }} />
                        <input
                          type="text"
                          placeholder="Search departments..."
                          value={searchDept}
                          onChange={(e) => setSearchDept(e.target.value)}
                          style={{
                            height: 36,
                            paddingLeft: 36,
                            paddingRight: 12,
                            width: 220,
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            fontSize: 13.5,
                            outline: "none",
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddDeptModal(true)}
                        style={{
                          height: 36,
                          padding: "0 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          backgroundColor: "#0f172a",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 8,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={14} /> Add Department
                      </button>
                    </div>
                  </div>

                  {/* Table (Screenshot 4) */}
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            DEPARTMENT NAME
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            COMPANY
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            PARENT DEPARTMENT
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            HIERARCHY PATH (CODE)
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            JOB TITLES
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            ACTION
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {departments
                          .filter((dept) => {
                            if (filterDeptCompanyId && dept.companyId !== filterDeptCompanyId)
                              return false;
                            if (
                              searchDept &&
                              !dept.name.toLowerCase().includes(searchDept.toLowerCase()) &&
                              !dept.code.toLowerCase().includes(searchDept.toLowerCase())
                            )
                              return false;
                            return true;
                          })
                          .map((dept) => (
                            <tr
                              key={dept.id}
                              style={{
                                borderBottom: "1px solid #f1f5f9",
                                transition: "background-color 0.15s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor = "#fafafa")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = "transparent")
                              }
                            >
                              <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0f172a" }}>
                                {dept.name}
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#0f172a",
                                    backgroundColor: "#f1f5f9",
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                  }}
                                >
                                  {dept.companyName}
                                </span>
                              </td>
                              <td style={{ padding: "14px 16px", color: "#64748b", fontSize: 13 }}>
                                {dept.parentName}
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontFamily: "monospace",
                                    color: "#64748b",
                                  }}
                                >
                                  {dept.code}
                                </span>
                              </td>
                              <td style={{ padding: "14px 16px", color: "#334155" }}>
                                {dept.jobTitlesCount} Designations
                              </td>
                              <td style={{ padding: "14px 16px", textAlign: "right" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toast.success(`Edit ${dept.name}`)}
                                    style={{
                                      padding: 6,
                                      border: "none",
                                      backgroundColor: "transparent",
                                      color: "#64748b",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Delete department ${dept.name}?`)) {
                                        setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
                                        toast.success(`${dept.name} deleted`);
                                      }
                                    }}
                                    style={{
                                      padding: 6,
                                      border: "none",
                                      backgroundColor: "transparent",
                                      color: "#ef4444",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: JOB TITLES (Screenshot 5) */}
              {activeSubTab === "job-title" && (
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 24,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  {/* Header row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 20,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                      Job Titles
                    </h3>

                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Company:</span>
                        <select
                          value={filterJobCompanyId}
                          onChange={(e) => setFilterJobCompanyId(e.target.value)}
                          style={{
                            height: 36,
                            padding: "0 10px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            backgroundColor: "#ffffff",
                            color: "#1e293b",
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value="">All Companies</option>
                          {companyDetails.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <Search size={16} style={{ position: "absolute", left: 12, color: "#94a3b8" }} />
                        <input
                          type="text"
                          placeholder="Search job title"
                          value={searchJob}
                          onChange={(e) => setSearchJob(e.target.value)}
                          style={{
                            height: 36,
                            paddingLeft: 36,
                            paddingRight: 12,
                            width: 220,
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            fontSize: 13.5,
                            outline: "none",
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddJobModal(true)}
                        style={{
                          height: 36,
                          padding: "0 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          backgroundColor: "#0f172a",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          borderRadius: 8,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={14} /> Add Job Title
                      </button>
                    </div>
                  </div>

                  {/* Table (Screenshot 5) */}
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            JOB TITLE
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            COMPANY
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            DEPARTMENT
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            NUMBER OF EMPLOYEES
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            ACTIVE
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "12px 16px",
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                            }}
                          >
                            ACTION
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobTitles
                          .filter((job) => {
                            if (filterJobCompanyId && job.companyId !== filterJobCompanyId)
                              return false;
                            if (
                              searchJob &&
                              !job.title.toLowerCase().includes(searchJob.toLowerCase()) &&
                              !job.departmentName.toLowerCase().includes(searchJob.toLowerCase())
                            )
                              return false;
                            return true;
                          })
                          .map((job) => (
                            <tr
                              key={job.id}
                              style={{
                                borderBottom: "1px solid #f1f5f9",
                                transition: "background-color 0.15s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor = "#fafafa")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = "transparent")
                              }
                            >
                              <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0f172a" }}>
                                {job.title}
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#0f172a",
                                    backgroundColor: "#f1f5f9",
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                  }}
                                >
                                  {job.companyName}
                                </span>
                              </td>
                              <td style={{ padding: "14px 16px", color: "#64748b", fontSize: 13.5 }}>
                                {job.departmentName}
                              </td>
                              <td style={{ padding: "14px 16px", color: "#1e293b", fontWeight: 500 }}>
                                {job.employeeCount}
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                <label
                                  style={{
                                    position: "relative",
                                    display: "inline-block",
                                    width: 40,
                                    height: 22,
                                    cursor: "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={job.active}
                                    onChange={() => {
                                      setJobTitles((prev) =>
                                        prev.map((j) =>
                                          j.id === job.id ? { ...j, active: !j.active } : j
                                        )
                                      );
                                      toast.success(`${job.title} status updated`);
                                    }}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                  />
                                  <span
                                    style={{
                                      position: "absolute",
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      backgroundColor: job.active ? "#10b981" : "#cbd5e1",
                                      borderRadius: 34,
                                      transition: "0.2s",
                                    }}
                                  >
                                    <span
                                      style={{
                                        position: "absolute",
                                        height: 16,
                                        width: 16,
                                        left: job.active ? 21 : 3,
                                        bottom: 3,
                                        backgroundColor: "white",
                                        borderRadius: "50%",
                                        transition: "0.2s",
                                      }}
                                    />
                                  </span>
                                </label>
                              </td>
                              <td style={{ padding: "14px 16px", textAlign: "right" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toast.success(`Edit ${job.title}`)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: 32,
                                      height: 32,
                                      borderRadius: 8,
                                      border: "1px solid #bfdbfe",
                                      backgroundColor: "#eff6ff",
                                      color: "#2563eb",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Delete job title ${job.title}?`)) {
                                        setJobTitles((prev) => prev.filter((j) => j.id !== job.id));
                                        toast.success(`${job.title} deleted`);
                                      }
                                    }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: 32,
                                      height: 32,
                                      borderRadius: 8,
                                      border: "1px solid #fecaca",
                                      backgroundColor: "#fef2f2",
                                      color: "#ef4444",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: WORK SCHEDULE */}
              {activeSubTab === "work-schedule" && (
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 24,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 20,
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                        Work Schedules
                      </h3>
                      <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
                        Configure default working hours, grace periods, and shift rules.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toast.success("Create schedule clicked")}
                      style={{
                        height: 36,
                        padding: "0 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        backgroundColor: "#047857",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} /> Add Work Schedule
                    </button>
                  </div>

                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                          Standard Working Schedule
                        </h4>
                        <span
                          style={{
                            backgroundColor: "#ecfdf5",
                            color: "#047857",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 12,
                          }}
                        >
                          Default
                        </span>
                      </div>
                      <span style={{ fontSize: 13, color: "#64748b" }}>Effective From: 01 Jan 2026</span>
                    </div>

                    <div data-mobile-grid="metrics"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 16,
                        backgroundColor: "#f8fafc",
                        padding: 16,
                        borderRadius: 8,
                      }}
                    >
                      <div>
                        <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                          STANDARD HOURS
                        </span>
                        <strong style={{ fontSize: 14, color: "#0f172a" }}>8h 00m / day</strong>
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                          SCHEDULE TYPE
                        </span>
                        <strong style={{ fontSize: 14, color: "#0f172a" }}>Duration-based</strong>
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                          GRACE PERIOD
                        </span>
                        <strong style={{ fontSize: 14, color: "#0f172a" }}>15 minutes</strong>
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                          EARLY PUNCH TOLERANCE
                        </span>
                        <strong style={{ fontSize: 14, color: "#0f172a" }}>30 minutes</strong>
                      </div>
                    </div>

                    <div>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
                        WORKING DAYS
                      </span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                          <span
                            key={day}
                            style={{
                              padding: "4px 12px",
                              borderRadius: 16,
                              fontSize: 12,
                              fontWeight: 600,
                              backgroundColor: "#e0f2fe",
                              color: "#0369a1",
                            }}
                          >
                            {day}
                          </span>
                        ))}
                        {["Saturday", "Sunday"].map((day) => (
                          <span
                            key={day}
                            style={{
                              padding: "4px 12px",
                              borderRadius: 16,
                              fontSize: 12,
                              fontWeight: 500,
                              backgroundColor: "#f1f5f9",
                              color: "#94a3b8",
                            }}
                          >
                            {day} (Off)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fullscreen Department Tree Modal */}
              {isDeptFullScreen && (
                <div data-mobile-overlay="true"
                  style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "#ffffff",
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column",
                    padding: 24,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid #e2e8f0",
                      paddingBottom: 16,
                      marginBottom: 20,
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
                        Department Chart (Fullscreen)
                      </h3>
                      <span style={{ fontSize: 13, color: "#64748b" }}>
                        Company: {companyDetails.find((c) => c.id === selectedDeptCompanyId)?.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDeptFullScreen(false)}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#0f172a",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Minimize2 size={16} /> Exit Fullscreen
                    </button>
                  </div>
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <div className="dept-tree-canvas" style={{ border: "none" }}>
                      <div className="dept-tree">
                        {/* Repeat tree for fullscreen */}
                        {(() => {
                          const compDepts = departments.filter(
                            (d) => d.companyId === selectedDeptCompanyId
                          );
                          const rootNode = compDepts.find((d) => d.code === "root") || {
                            id: "root",
                            name: "Core Team",
                            code: "root",
                            companyId: selectedDeptCompanyId,
                            companyName: "FastonMed",
                            parent: "root",
                            parentName: "Core Team",
                            jobTitlesCount: 4,
                          };

                          const renderNodeRecursively = (parentId: string): React.ReactNode => {
                            if (parentId === "root") {
                              const children = compDepts.filter(
                                (d) =>
                                  (d.parent === "root" || d.parent === rootNode.id) &&
                                  d.code !== "root"
                              );
                              return (
                                <div className="dept-node-container" key={rootNode.id}>
                                  <div className="dept-node-card">
                                    <span className="dept-node-title">{rootNode.name}</span>
                                  </div>
                                  {children.length > 0 && (
                                    <div className="dept-children-container">
                                      {children.map((child) => renderNodeRecursively(child.id))}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            const node = compDepts.find((d) => d.id === parentId);
                            if (!node) return null;
                            const children = compDepts.filter((d) => d.parent === node.id);

                            return (
                              <div className="dept-node-container" key={node.id}>
                                <div className="dept-node-card">
                                  <span className="dept-node-title">{node.name}</span>
                                </div>
                                {children.length > 0 && (
                                  <div className="dept-children-container">
                                    {children.map((child) => renderNodeRecursively(child.id))}
                                  </div>
                                )}
                              </div>
                            );
                          };

                          return renderNodeRecursively("root");
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* ================= 7. PAYROLL OPERATIONS (Screenshot 4) ================= */}
          {activeSection === "Payroll" && (
            <div>
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 16,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      margin: "0 0 4px 0",
                    }}
                  >
                    PAYROLL OPERATIONS
                  </p>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#0f172a", lineHeight: 1.3 }}>
                    Run salaries, review payslips, and close payments.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPayrollModal(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 18px",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
                  }}
                >
                  <Play size={15} fill="#ffffff" />
                  Generate Payroll
                </button>
              </div>

              {/* Subheader & Company Filter */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 18,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  Payroll runs are filtered and generated company-wise.
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <span>Company</span>
                  <select
                    value={payrollCompany}
                    onChange={(e) => setPayrollCompany(e.target.value)}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: "8px 14px",
                      background: "#ffffff",
                      minWidth: 220,
                      fontWeight: 600,
                      color: "#0f172a",
                      cursor: "pointer",
                    }}
                  >
                    {stemsCompanies.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* 4 Minimal Metric Cards (Screenshot 4) */}
              <div data-mobile-grid="stack"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {[
                  {
                    title: "Latest Payroll Cost",
                    value: `₹${payrollMetrics.latestCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    sub: payrollMetrics.latestCostMonth,
                  },
                  {
                    title: "Net Payable",
                    value: `₹${payrollMetrics.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    sub: `${payrollMetrics.netPayableEmployees} employees`,
                  },
                  {
                    title: "Pending Runs",
                    value: String(payrollMetrics.pendingRuns),
                    sub: "Yet to close",
                  },
                  {
                    title: "Completed Runs",
                    value: String(payrollMetrics.completedRuns),
                    sub: "Paid runs",
                  },
                ].map((card, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "10px 14px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{card.title}</span>
                      <Info size={13} color="#94a3b8" />
                    </div>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: "#0f172a",
                        letterSpacing: "-0.01em",
                        lineHeight: 1.25,
                      }}
                    >
                      {card.value}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* Workspace Container */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                {/* Tabs */}
                <div
                  style={{
                    display: "flex",
                    gap: 24,
                    borderBottom: "1px solid #e2e8f0",
                    padding: "0 20px",
                    height: 48,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPayrollMode("run")}
                    style={{
                      border: "none",
                      background: "none",
                      fontSize: 14,
                      fontWeight: 700,
                      color: payrollMode === "run" ? "#0f172a" : "#64748b",
                      borderBottom: payrollMode === "run" ? "2px solid #2563eb" : "2px solid transparent",
                      padding: "0 4px",
                      cursor: "pointer",
                    }}
                  >
                    Run Payroll
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayrollMode("history")}
                    style={{
                      border: "none",
                      background: "none",
                      fontSize: 14,
                      fontWeight: 700,
                      color: payrollMode === "history" ? "#0f172a" : "#64748b",
                      borderBottom: payrollMode === "history" ? "2px solid #2563eb" : "2px solid transparent",
                      padding: "0 4px",
                      cursor: "pointer",
                    }}
                  >
                    Payroll History
                  </button>
                </div>

                {/* Filter Pills */}
                {payrollMode === "run" ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        padding: "16px 20px 12px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setPayrollFilter("all")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          border: payrollFilter === "all" ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                          backgroundColor: payrollFilter === "all" ? "#eff6ff" : "#ffffff",
                          color: payrollFilter === "all" ? "#1d4ed8" : "#475569",
                        }}
                      >
                        All Pending 2
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayrollFilter("regular")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          border: payrollFilter === "regular" ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                          backgroundColor: payrollFilter === "regular" ? "#eff6ff" : "#ffffff",
                          color: payrollFilter === "regular" ? "#1d4ed8" : "#475569",
                        }}
                      >
                        Regular Payroll 1
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayrollFilter("final")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          border: payrollFilter === "final" ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                          backgroundColor: payrollFilter === "final" ? "#eff6ff" : "#ffffff",
                          color: payrollFilter === "final" ? "#1d4ed8" : "#475569",
                        }}
                      >
                        Final Settlement Payroll 1
                      </button>
                    </div>

                    {/* Info Notice Banner */}
                    <div
                      style={{
                        margin: "0 20px 16px",
                        padding: "10px 14px",
                        borderRadius: 8,
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 12.5,
                        color: "#475569",
                      }}
                    >
                      <Info size={16} color="#0284c7" />
                      <span>
                        Pay salaries from your configured company account after reviewing each employee payout.
                      </span>
                    </div>

                    {/* Pending Payroll Runs Table */}
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13.5 }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc", color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 12, textTransform: "uppercase" }}>
                          <th style={{ padding: "12px 20px", fontWeight: 700 }}>Payroll Period</th>
                          <th style={{ padding: "12px 16px", fontWeight: 700 }}>Run Type</th>
                          <th style={{ padding: "12px 16px", fontWeight: 700 }}>Employees</th>
                          <th style={{ padding: "12px 16px", fontWeight: 700 }}>Gross Total</th>
                          <th style={{ padding: "12px 16px", fontWeight: 700 }}>Net Total</th>
                          <th style={{ padding: "12px 16px", fontWeight: 700 }}>Status</th>
                          <th style={{ padding: "12px 20px", fontWeight: 700, textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollRuns
                          .filter((r) => r.status !== "PAID")
                          .filter((r) => {
                            if (payrollFilter === "regular") return r.type === "REGULAR";
                            if (payrollFilter === "final") return r.type === "FINAL";
                            return true;
                          })
                          .map((run) => {
                            const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                            return (
                              <tr key={run.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "14px 20px", fontWeight: 600, color: "#0f172a" }}>
                                  {monthNames[run.month]} {run.year}
                                </td>
                                <td style={{ padding: "14px 16px" }}>
                                  <span
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      backgroundColor: run.type === "FINAL" ? "#fef3c7" : "#eff6ff",
                                      color: run.type === "FINAL" ? "#b45309" : "#1d4ed8",
                                    }}
                                  >
                                    {run.type === "FINAL" ? "Final Settlement" : "Regular Payroll"}
                                  </span>
                                </td>
                                <td style={{ padding: "14px 16px", color: "#475569" }}>
                                  {run.employeeCount} Employees
                                </td>
                                <td style={{ padding: "14px 16px", fontWeight: 600, color: "#0f172a" }}>
                                  ₹{Number(run.grossTotal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: "14px 16px", fontWeight: 700, color: "#059669" }}>
                                  ₹{Number(run.netTotal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: "14px 16px" }}>
                                  <span
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      backgroundColor: "#f1f5f9",
                                      color: "#475569",
                                    }}
                                  >
                                    {run.status === "DRAFT_FINAL" ? "Draft Final" : "Draft"}
                                  </span>
                                </td>
                                <td style={{ padding: "14px 20px", textAlign: "right" }}>
                                  <button
                                    type="button"
                                    onClick={() => toast.success(`Reviewing payslips for ${monthNames[run.month]} ${run.year}`)}
                                    style={{
                                      padding: "5px 12px",
                                      borderRadius: 6,
                                      border: "1px solid #cbd5e1",
                                      backgroundColor: "#ffffff",
                                      color: "#334155",
                                      fontSize: 12.5,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Review Payout
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </>
                ) : (
                  /* Payroll History */
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc", color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 12, textTransform: "uppercase" }}>
                        <th style={{ padding: "12px 20px", fontWeight: 700 }}>Payroll Period</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700 }}>Run Type</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700 }}>Employees</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700 }}>Paid Amount</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700 }}>Status</th>
                        <th style={{ padding: "12px 20px", fontWeight: 700, textAlign: "right" }}>Payslips</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollRuns
                        .filter((r) => r.status === "PAID")
                        .map((run) => {
                          const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                          return (
                            <tr key={run.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "14px 20px", fontWeight: 600, color: "#0f172a" }}>
                                {monthNames[run.month]} {run.year}
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, backgroundColor: "#eff6ff", color: "#1d4ed8" }}>
                                  Regular Payroll
                                </span>
                              </td>
                              <td style={{ padding: "14px 16px", color: "#475569" }}>
                                {run.employeeCount} Employees
                              </td>
                              <td style={{ padding: "14px 16px", fontWeight: 700, color: "#059669" }}>
                                ₹{Number(run.netTotal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, backgroundColor: "#dcfce7", color: "#15803d" }}>
                                  PAID
                                </span>
                              </td>
                              <td style={{ padding: "14px 20px", textAlign: "right" }}>
                                <button
                                  type="button"
                                  onClick={() => toast.success("Downloading zip of all payslips...")}
                                  style={{
                                    padding: "5px 12px",
                                    borderRadius: 6,
                                    border: "1px solid #cbd5e1",
                                    backgroundColor: "#ffffff",
                                    color: "#1e293b",
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Download Payslips
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ================= 8. REPORTS MODULE ================= */}
          {activeSection === "Reports" && (
            <div className="card" style={{ padding: 28, textAlign: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#004d66", marginBottom: 6 }}>
                FastonMed Reports Module
              </h3>
              <p style={{ color: "#64748b", fontSize: 13.5, maxWidth: 500, margin: "0 auto 20px" }}>
                Live synchronized records for attendance summaries, departmental rosters, and HR audits.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveSection("Attendance");
                  setActiveSubTab("my-attendance");
                }}
                className="btn btn-primary"
                style={{ backgroundColor: "#004d66" }}
              >
                ← Back to Visual Attendance Grid
              </button>
            </div>
          )}

          {/* ================= 8. EXECUTIVE DASHBOARD OVERVIEW ================= */}
          {activeSection === "Dashboard" && (
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#002735", marginBottom: 8 }}>
                FastonMed EMS Operations Summary
              </h2>
              <p style={{ color: "#64748b", fontSize: 13.5, marginBottom: 20 }}>
                Welcome to the unified workforce command center. Select any submenu tab on the left to review your attendance grid, team calendar, or company roster.
              </p>
              <button
                onClick={() => {
                  setActiveSection("Attendance");
                  setActiveSubTab("my-attendance");
                }}
                className="btn btn-primary"
                style={{ backgroundColor: "#004d66" }}
              >
                Open My Attendance Grid →
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ================= DETAILED TIMESTAMPS MODAL ================= */}
      {selectedDay && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 20,
          }}
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 540, padding: 24, borderRadius: 14 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#002735" }}>
                  Detailed Attendance Timestamps
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {selectedDay.dayOfWeek}, {selectedDay.day} {attendanceMonth}
                </span>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <div data-mobile-grid="stack"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                backgroundColor: "#f8fafc",
                borderRadius: 10,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>PUNCH IN</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                  {selectedDay.checkIn || "No Punch Recorded"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>PUNCH OUT</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                  {selectedDay.checkOut || "-"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>EFFECTIVE WORKING HOURS</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#16a34a", marginTop: 2 }}>
                  {selectedDay.effectiveHours || selectedDay.hours || "0 hrs"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>ATTENDANCE STATUS</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#004d66", marginTop: 2 }}>
                  {selectedDay.status}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5, color: "#334155", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Gross Duration:</span>
                <strong>{selectedDay.grossHours || "0 hrs"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Break Time:</span>
                <strong>{selectedDay.breakTime || "0 hrs"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Overtime:</span>
                <strong>{selectedDay.overtime || "0 hrs"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Punch Location:</span>
                <strong>{selectedDay.location || "CRM session"}</strong>
              </div>
              {selectedDay.ipAddress && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Network Gateway:</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11.5 }}>{selectedDay.ipAddress}</span>
                </div>
              )}
              {selectedDay.notes && (
                <div style={{ marginTop: 4, padding: "8px 10px", backgroundColor: "#f1f5f9", borderRadius: 6, fontSize: 12, color: "#475569" }}>
                  💡 {selectedDay.notes}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: "#004d66" }}
                onClick={() => setSelectedDay(null)}
              >
                Close Timestamps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= APPLY LEAVE MODAL ================= */}
      {showApplyLeaveModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 20,
          }}
          onClick={() => setShowApplyLeaveModal(false)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 480, padding: 24, borderRadius: 14 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#002735" }}>
                Apply for Leave
              </h3>
              <button
                onClick={() => setShowApplyLeaveModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyLeave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Leave Type *</label>
                <select
                  className="form-input"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  <option value="Annual Leave">Annual Leave (21 days available)</option>
                  <option value="Sick Leave">Sick Leave (12 days available)</option>
                  <option value="Casual / WFH">Work From Home (4 days available)</option>
                  <option value="Emergency Leave">Emergency Leave</option>
                </select>
              </div>

              <div data-mobile-grid="stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Start Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={leaveFrom}
                    onChange={(e) => setLeaveFrom(e.target.value)}
                    required
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>End Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={leaveTo}
                    onChange={(e) => setLeaveTo(e.target.value)}
                    required
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Reason for Leave *</label>
                <textarea
                  className="form-input"
                  placeholder="e.g. Travel abroad for annual vacation. Emergency contact provided."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  required
                  rows={3}
                  style={{ fontSize: 13, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowApplyLeaveModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: "#004d66" }}
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= GENERATE MONTHLY PAYROLL MODAL (Screenshot 5) ================= */}
      {showPayrollModal && (
        <div data-mobile-overlay="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowPayrollModal(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Generate Monthly Payroll
              </h3>
              <button
                type="button"
                onClick={() => setShowPayrollModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsGeneratingPayroll(true);
                try {
                  const companyObj = stemsCompanies.find((c) => c.name === modalCompany) || stemsCompanies[0];
                  const res = await fetch("/api/ems/payroll", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      companyId: companyObj.id,
                      month: modalMonth,
                      year: modalYear,
                      payrollType: modalPayrollType,
                    }),
                  });
                  const json = await res.json();
                  if (json.success) {
                    toast.success("Payroll run generated successfully!");
                    setPayrollRuns((prev) => [
                      {
                        id: json.id || `run_${Date.now()}`,
                        companyId: companyObj.id,
                        companyName: modalCompany,
                        month: modalMonth,
                        year: modalYear,
                        status: modalPayrollType === "FINAL" ? "DRAFT_FINAL" : "DRAFT",
                        type: modalPayrollType,
                        grossTotal: modalPayrollType === "FINAL" ? "2332.87" : "154543.59",
                        netTotal: modalPayrollType === "FINAL" ? "2332.87" : "154543.59",
                        employeeCount: modalPayrollType === "FINAL" ? 1 : 15,
                        createdAt: new Date().toISOString(),
                      },
                      ...prev,
                    ]);
                    setShowPayrollModal(false);
                  } else {
                    toast.error(json.error || "Failed to generate payroll");
                  }
                } catch {
                  toast.success("Payroll run simulated and added!");
                  setShowPayrollModal(false);
                } finally {
                  setIsGeneratingPayroll(false);
                }
              }}
              style={{ padding: "18px 20px" }}
            >
              <label style={{ display: "grid", gap: 6, marginBottom: 14, fontSize: 13.5, fontWeight: 600, color: "#334155" }}>
                Company
                <select
                  value={modalCompany}
                  onChange={(e) => setModalCompany(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: 14,
                    color: "#0f172a",
                    outline: "none",
                  }}
                >
                  {stemsCompanies.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, marginBottom: 14, fontSize: 13.5, fontWeight: 600, color: "#334155" }}>
                Payroll Type
                <select
                  value={modalPayrollType}
                  onChange={(e) => setModalPayrollType(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: 14,
                    color: "#0f172a",
                    outline: "none",
                  }}
                >
                  <option value="REGULAR">Regular Payroll</option>
                  <option value="FINAL">Final Settlement Payroll</option>
                </select>
              </label>

              {modalPayrollType === "FINAL" && (
                <label style={{ display: "grid", gap: 6, marginBottom: 14, fontSize: 13.5, fontWeight: 600, color: "#334155" }}>
                  Offboarded Employee
                  <select
                    value={modalOffboardedEmp}
                    onChange={(e) => setModalOffboardedEmp(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                      fontSize: 14,
                      color: "#0f172a",
                      outline: "none",
                    }}
                  >
                    <option value="">Muhammed Shamil PT (ST014)</option>
                  </select>
                </label>
              )}

              <label style={{ display: "grid", gap: 6, marginBottom: 14, fontSize: 13.5, fontWeight: 600, color: "#334155" }}>
                Month
                <select
                  value={modalMonth}
                  onChange={(e) => setModalMonth(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: 14,
                    color: "#0f172a",
                    outline: "none",
                  }}
                >
                  {[
                    "",
                    "January",
                    "February",
                    "March",
                    "April",
                    "May",
                    "June",
                    "July",
                    "August",
                    "September",
                    "October",
                    "November",
                    "December",
                  ].map((m, idx) => idx > 0 && (
                    <option key={idx} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, marginBottom: 20, fontSize: 13.5, fontWeight: 600, color: "#334155" }}>
                Year
                <input
                  type="number"
                  value={modalYear}
                  onChange={(e) => setModalYear(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: 14,
                    color: "#0f172a",
                    outline: "none",
                  }}
                />
              </label>

              {/* Modal Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowPayrollModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#f1f5f9",
                    color: "#334155",
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingPayroll}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: "none",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isGeneratingPayroll ? "Generating..." : "Generate Payroll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD / EDIT EMPLOYEE MODAL (STEMS 4-STEP WIZARD) ================= */}
      {showAddEmployeeModal && (
        <div className="employee-form-overlay">
          <div
            className="employee-form-shell"
            role="dialog"
            aria-modal="true"
            aria-label={editingEmployeeId ? "Edit Employee" : "Add Employee"}
          >
            <div className="employee-form-topbar">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  paddingRight: "44px",
                }}
              >
                <div>
                  <h3>{editingEmployeeId ? "Edit Employee" : "Add Employee"}</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#64748b" }}>
                    {editingEmployeeId
                      ? "Update employee profile, job assignments, and credentials."
                      : "Configure employee profile, job assignments, and portal access."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="employee-form-close"
                aria-label="Close"
                onClick={() => setShowAddEmployeeModal(false)}
              >
                <X size={17} />
              </button>
              <div className="employee-stepper" aria-label="Employee form progress">
                {["Basic Details", "Salary Details", "Personal Details", "Add Documents"].map(
                  (stepLabel, index) => (
                    <button
                      type="button"
                      key={stepLabel}
                      className={`${addEmployeeStep === index ? "active" : ""} ${
                        addEmployeeStep > index ? "completed" : ""
                      }`}
                      onClick={() => {
                        if (index <= addEmployeeStep) {
                          setAddEmployeeStep(index);
                        } else if (addEmployeeStep === 0 && validateStep0()) {
                          setAddEmployeeStep(index);
                        }
                      }}
                    >
                      <span>
                        {addEmployeeStep > index ? <Check size={12} strokeWidth={3} /> : index + 1}
                      </span>
                      {stepLabel}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="employee-form">
              {empModalAlert && <div className="form-alert">{empModalAlert}</div>}

              {/* STEP 0: BASIC DETAILS (Screenshots 1) */}
              {addEmployeeStep === 0 && (
                <section className="employee-form-section">
                  <div className="form-section-heading">
                    <h4>Basic Details</h4>
                    <p>Create the employee profile, reporting line, portal login, and job assignment.</p>
                  </div>
                  <div className="form-grid three">
                    <label>
                      <span>
                        First Name <b>*</b>
                      </span>
                      <input
                        type="text"
                        value={formFirstName}
                        onChange={(e) => {
                          setFormFirstName(e.target.value);
                          setEmpModalAlert("");
                        }}
                        placeholder="First Name"
                        required
                      />
                    </label>
                    <label>
                      Middle Name
                      <input
                        type="text"
                        value={formMiddleName}
                        onChange={(e) => setFormMiddleName(e.target.value)}
                        placeholder="Middle Name"
                      />
                    </label>
                    <label>
                      <span>
                        Last Name <b>*</b>
                      </span>
                      <input
                        type="text"
                        value={formLastName}
                        onChange={(e) => {
                          setFormLastName(e.target.value);
                          setEmpModalAlert("");
                        }}
                        placeholder="Last Name"
                        required
                      />
                    </label>
                  </div>
                  <div className="form-grid two">
                    <label>
                      Employee ID
                      <input
                        type="text"
                        value={formEmployeeId}
                        onChange={(e) => setFormEmployeeId(e.target.value)}
                        placeholder="Auto generated if empty"
                      />
                    </label>
                    <label>
                      <span>
                        Date of Joining <b>*</b>
                      </span>
                      <input
                        type="date"
                        value={formDateOfJoining}
                        onChange={(e) => setFormDateOfJoining(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      <span>
                        Work Email <b>*</b>
                      </span>
                      <input
                        type="email"
                        value={formWorkEmail}
                        onChange={(e) => {
                          setFormWorkEmail(e.target.value);
                          setEmpModalAlert("");
                        }}
                        placeholder="name@company.com"
                        required
                      />
                    </label>
                    <label>
                      Mobile Number
                      <input
                        type="tel"
                        value={formMobileNumber}
                        onChange={(e) => setFormMobileNumber(e.target.value)}
                        placeholder="Mobile Number"
                      />
                    </label>
                    <label>
                      <span>Portal Password {!editingEmployeeId && <b>*</b>}</span>
                      <input
                        type="password"
                        value={formPortalPassword}
                        onChange={(e) => setFormPortalPassword(e.target.value)}
                        placeholder={editingEmployeeId ? "Leave blank to keep unchanged" : "••••••••••••"}
                        required={!editingEmployeeId}
                      />
                    </label>
                    <label>
                      Gender
                      <select value={formGender} onChange={(e) => setFormGender(e.target.value)}>
                        <option value="">Select</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                    <label>
                      Company
                      <select
                        value={formCompanyId}
                        onChange={(e) => setFormCompanyId(e.target.value)}
                      >
                        <option value="">Select Company</option>
                        {companyDetails.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Department
                      <select
                        value={formDepartmentId}
                        onChange={(e) => setFormDepartmentId(e.target.value)}
                      >
                        <option value="">Select Department</option>
                        {departments
                          .filter((d) => !formCompanyId || d.companyId === formCompanyId)
                          .map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Office Location
                      <select
                        value={formOfficeId}
                        onChange={(e) => setFormOfficeId(e.target.value)}
                      >
                        <option value="">Select Office</option>
                        {offices.map((off) => (
                          <option key={off.id} value={off.id}>
                            {off.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Designation
                      <select
                        value={formDesignationId}
                        onChange={(e) => setFormDesignationId(e.target.value)}
                      >
                        <option value="">Select Designation</option>
                        {jobTitles
                          .filter((j) => !formDepartmentId || j.departmentId === formDepartmentId)
                          .map((desg) => (
                            <option key={desg.id} value={desg.id}>
                              {desg.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Manager
                      <select
                        value={formManagerId}
                        onChange={(e) => setFormManagerId(e.target.value)}
                      >
                        <option value="">None / Reports directly</option>
                        {stemsEmployees
                          .filter((emp) => emp.id !== editingEmployeeId)
                          .map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.fullName}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Shift Assignment
                      <select
                        value={formShiftId}
                        onChange={(e) => setFormShiftId(e.target.value)}
                      >
                        <option value="">No Shift / Default Shift (09:00 - 18:00)</option>
                        <option value="morning">Morning Shift (08:00 - 17:00)</option>
                        <option value="night">Night Shift (20:00 - 05:00)</option>
                      </select>
                    </label>
                    <label>
                      Biometric ID / eSSL ID
                      <input
                        type="text"
                        value={formBiometricId}
                        onChange={(e) => setFormBiometricId(e.target.value)}
                        placeholder="e.g. 1001"
                      />
                    </label>
                  </div>

                  <label className="portal-access-row">
                    <input
                      type="checkbox"
                      checked={formPortalAccess}
                      onChange={(e) => setFormPortalAccess(e.target.checked)}
                    />
                    <span>
                      <strong>Enable Portal Access</strong>
                      <small>
                        The employee can view payslips, submit requests, and access the employee portal.
                      </small>
                    </span>
                  </label>
                </section>
              )}

              {/* STEP 1: SALARY DETAILS (Screenshots 2) */}
              {addEmployeeStep === 1 && (
                <section className="employee-form-section">
                  <div className="form-section-heading">
                    <h4>Salary Structure</h4>
                    <p>Set how the employee salary is divided for payroll calculation.</p>
                  </div>

                  <div data-mobile-grid="stack"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "16px",
                      background: "#f8fafc",
                      padding: "16px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      marginBottom: "16px",
                    }}
                  >
                    <label style={{ margin: 0 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontWeight: 700,
                          fontSize: "13.5px",
                          color: "#1e293b",
                          marginBottom: "6px",
                        }}
                      >
                        <span>Salary Effective From Date</span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "#ecfdf5",
                            color: "#059669",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            border: "1px solid #a7f3d0",
                          }}
                        >
                          Mid-Month Upgrade
                        </span>
                      </span>
                      <input
                        type="date"
                        value={formDateOfJoining}
                        onChange={(e) => setFormDateOfJoining(e.target.value)}
                        required
                      />
                      <small
                        style={{
                          color: "#64748b",
                          fontSize: "12px",
                          marginTop: "4px",
                          display: "block",
                        }}
                      >
                        Date from which this salary rate takes effect.
                      </small>
                    </label>

                    <label style={{ margin: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontWeight: 700,
                          fontSize: "13.5px",
                          color: "#1e293b",
                          marginBottom: "6px",
                        }}
                      >
                        Revision Reason / Note (Optional)
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. Probation Completed, Appraisal, Role Promotion"
                      />
                      <small
                        style={{
                          color: "#64748b",
                          fontSize: "12px",
                          marginTop: "4px",
                          display: "block",
                        }}
                      >
                        Visible in salary revision history records.
                      </small>
                    </label>
                  </div>

                  <div className="ctc-entry">
                    <label>
                      Annual CTC
                      <div className="money-input">
                        <span>
                          <IndianRupee size={15} />
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={Math.max((formBasicSalary + formAllowances) * 12, 0)}
                          onChange={(e) => {
                            const totalAnnual = Number(e.target.value) || 0;
                            const monthly = Math.round(totalAnnual / 12);
                            setFormBasicSalary(monthly);
                          }}
                        />
                        <em>per year</em>
                      </div>
                    </label>
                  </div>

                  <div className="salary-structure-table">
                    <div className="salary-header">
                      <span>Salary Components</span>
                      <span>Calculation Type</span>
                      <span>Monthly Amount</span>
                      <span>Annual Amount</span>
                    </div>
                    <div className="salary-section-title">Earnings</div>
                    <div className="salary-row">
                      <strong>Basic</strong>
                      <div className="split-input">
                        <input
                          type="number"
                          min="0"
                          value={formBasicSalary}
                          onChange={(e) => setFormBasicSalary(Number(e.target.value) || 0)}
                        />
                        <span>fixed</span>
                      </div>
                      <span>₹{Number(formBasicSalary || 0).toLocaleString("en-IN")}</span>
                      <span>₹{(Number(formBasicSalary || 0) * 12).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="salary-row">
                      <strong>Allowances</strong>
                      <div className="split-input">
                        <input
                          type="number"
                          min="0"
                          value={formAllowances}
                          onChange={(e) => setFormAllowances(Number(e.target.value) || 0)}
                        />
                        <span>fixed</span>
                      </div>
                      <span>₹{Number(formAllowances || 0).toLocaleString("en-IN")}</span>
                      <span>₹{(Number(formAllowances || 0) * 12).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="salary-row">
                      <strong>Deductions</strong>
                      <div className="split-input">
                        <input
                          type="number"
                          min="0"
                          value={formDeductions}
                          onChange={(e) => setFormDeductions(Number(e.target.value) || 0)}
                        />
                        <span>fixed</span>
                      </div>
                      <span>₹{Number(formDeductions || 0).toLocaleString("en-IN")}</span>
                      <span>₹{(Number(formDeductions || 0) * 12).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="salary-total">
                      <strong>Cost to Company</strong>
                      <span>
                        ₹{Math.max((formBasicSalary + formAllowances) - formDeductions, 0).toLocaleString("en-IN")}
                      </span>
                      <span>
                        ₹{Math.max(((formBasicSalary + formAllowances) - formDeductions) * 12, 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* STEP 2: PERSONAL DETAILS (Screenshots 3) */}
              {addEmployeeStep === 2 && (
                <section className="employee-form-section">
                  <div className="form-section-heading">
                    <h4>Personal Details</h4>
                    <p>Capture identity, contact, and residential information for the employee file.</p>
                  </div>
                  <div className="form-grid two">
                    <label>
                      Date of Birth
                      <input
                        type="date"
                        value={formDob}
                        onChange={(e) => setFormDob(e.target.value)}
                      />
                    </label>
                    <label>
                      Personal Email Address
                      <input
                        type="email"
                        value={formPersonalEmail}
                        onChange={(e) => setFormPersonalEmail(e.target.value)}
                        placeholder="personal@email.com"
                      />
                    </label>
                    <label>
                      Tax / PAN ID
                      <input
                        type="text"
                        value={formPanId}
                        onChange={(e) => setFormPanId(e.target.value)}
                        placeholder="AAAAA0000A"
                      />
                    </label>
                    <label>
                      Emergency Contact Name
                      <input
                        type="text"
                        value={formEmergencyName}
                        onChange={(e) => setFormEmergencyName(e.target.value)}
                      />
                    </label>
                    <label>
                      Emergency Contact Phone
                      <input
                        type="tel"
                        value={formEmergencyPhone}
                        onChange={(e) => setFormEmergencyPhone(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="form-grid one">
                    <label>
                      Residential Address
                      <input
                        type="text"
                        value={formAddress}
                        onChange={(e) => setFormAddress(e.target.value)}
                        placeholder="Address Line 1"
                      />
                    </label>
                  </div>
                  <div className="form-grid four">
                    <label>
                      Town / City
                      <input
                        type="text"
                        value={formCity}
                        onChange={(e) => setFormCity(e.target.value)}
                      />
                    </label>
                    <label>
                      State
                      <input
                        type="text"
                        value={formState}
                        onChange={(e) => setFormState(e.target.value)}
                      />
                    </label>
                    <label>
                      Country
                      <input
                        type="text"
                        value={formCountry}
                        onChange={(e) => setFormCountry(e.target.value)}
                      />
                    </label>
                    <label>
                      PIN Code
                      <input
                        type="text"
                        value={formPinCode}
                        onChange={(e) => setFormPinCode(e.target.value)}
                      />
                    </label>
                  </div>
                </section>
              )}

              {/* STEP 3: ADD DOCUMENTS (Screenshots 4) */}
              {addEmployeeStep === 3 && (
                <section className="employee-form-section">
                  <div className="form-section-heading">
                    <h4>Add Documents</h4>
                    <p>Collect onboarding documents now. Employee photo must be below 150 KB.</p>
                  </div>
                  <div className="photo-upload-section">
                    <div className="photo-preview-card">
                      <span>{formFirstName?.[0]?.toUpperCase() || "E"}</span>
                    </div>
                    <div className="photo-upload-controls">
                      <label>
                        Employee Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setFormPhotoName(file.name);
                              toast.success(`Photo selected: ${file.name}`);
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="primary-form-button"
                        onClick={() => {
                          if (!formPhotoName) {
                            toast.error("Please select a photo first");
                          } else {
                            toast.success("Photo added!");
                          }
                        }}
                      >
                        Add Photo
                      </button>
                      <small
                        style={{
                          width: "100%",
                          color: "#64748b",
                          fontWeight: 650,
                          marginTop: "4px",
                        }}
                      >
                        Photo must be below 150 KB.
                      </small>
                    </div>
                  </div>

                  <div className="document-upload-panel">
                    <label>
                      Document Type
                      <select
                        value={formDocType}
                        onChange={(e) => setFormDocType(e.target.value)}
                      >
                        <option value="ID Card">ID Card</option>
                        <option value="CV">CV</option>
                        <option value="Passport">Passport</option>
                        <option value="Offer Letter">Offer Letter</option>
                      </select>
                    </label>
                    <label>
                      Upload File
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setFormDocFileName(file.name);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="primary-form-button"
                      onClick={() => {
                        if (!formDocFileName) {
                          toast.error("Please select a file to upload");
                          return;
                        }
                        setFormQueuedDocs((prev) => [
                          ...prev,
                          { type: formDocType, name: formDocFileName },
                        ]);
                        setFormDocFileName("");
                        toast.success(`${formDocType} queued successfully`);
                      }}
                    >
                      Add Document
                    </button>
                  </div>

                  <div className="pending-document-list">
                    {formQueuedDocs.length === 0 ? (
                      <p>No documents added yet.</p>
                    ) : (
                      formQueuedDocs.map((doc, idx) => (
                        <div key={idx} className="employee-file-row">
                          <div>
                            <strong>{doc.type}</strong>
                            <span>{doc.name}</span>
                          </div>
                          <button
                            type="button"
                            className="danger-action"
                            onClick={() =>
                              setFormQueuedDocs((prev) => prev.filter((_, i) => i !== idx))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="employee-review-card">
                    <strong>
                      {formFirstName || "New"} {formLastName || "Employee"}
                    </strong>
                    <span>
                      {formEmployeeId || "Employee ID will be auto generated"} ·{" "}
                      {departments.find((d) => d.id === formDepartmentId)?.name || "Core Team"}
                    </span>
                    <small>Documents queued: {formQueuedDocs.length}</small>
                  </div>
                </section>
              )}

              {/* MODAL FOOTER */}
              <div className="employee-form-footer">
                <span>* indicates mandatory fields</span>
                <div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setShowAddEmployeeModal(false)}
                  >
                    Cancel
                  </button>
                  {addEmployeeStep > 0 && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setAddEmployeeStep((s) => Math.max(s - 1, 0))}
                    >
                      Back
                    </button>
                  )}
                  {addEmployeeStep < 3 ? (
                    <button
                      type="button"
                      className="primary-form-button"
                      onClick={handleNextStep}
                    >
                      Save and Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-form-button"
                      onClick={handleSaveEmployee}
                    >
                      {editingEmployeeId ? "Save Changes" : "Add Employee"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
