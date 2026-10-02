"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  createBoughtPayment,
  getCompanies,
  getCompanyBoughtBills,
  getReturnsForCompany,
  getBoughtPaymentDetails,
  updateBoughtPayment,
  getBoughtPayments,
  getBoughtBills,
} from "@/lib/data";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Select from "react-select";
import { Filter, Search, Paperclip, Camera, Image as ImageIcon } from "lucide-react";

// --- Advanced Filter Operators ---
const STRING_OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "startsWith", label: "Starts with" },
  { value: "endsWith", label: "Ends with" },
  { value: "isEmpty", label: "Is empty" },
  { value: "isNotEmpty", label: "Is not empty" }
];

const NUMBER_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Not equals" },
  { value: "greaterThan", label: "> Greater than" },
  { value: "greaterThanOrEqual", label: ">= Greater or eq" },
  { value: "lessThan", label: "< Less than" },
  { value: "lessThanOrEqual", label: "<= Less or eq" },
  { value: "isEmpty", label: "Is empty" },
  { value: "isNotEmpty", label: "Is not empty" }
];

// --- Circle colors for bill / return numbers ---
const BILL_COLORS = ["#8B5CF6", "#10B981", "#3B82F6", "#06B6D4", "#6366F1", "#14B8A6"];
const RETURN_COLORS = ["#EF4444", "#F97316", "#EC4899", "#F59E0B", "#DC2626", "#E11D48"];

const getReturnLabel = (ret, fallbackId = "") =>
  ret?.returnBillNumber || ret?.returnNumber || `RET-${String(ret?.id || fallbackId).slice(-6)}`;

// --- Colored number circles ---
const NumberBubbles = ({ numbers, palette }) => {
  if (!numbers || numbers.length === 0) {
    return <span style={{ color: "#9CA3AF" }}>—</span>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
      {numbers.map((n, i) => (
        <span
          key={`${n}-${i}`}
          title={String(n)}
          style={{
            minWidth: "28px",
            height: "28px",
            padding: "0 8px",
            borderRadius: "999px",
            background: palette[i % palette.length],
            color: "white",
            fontSize: "0.72rem",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            whiteSpace: "nowrap",
            boxSizing: "border-box",
          }}
        >
          {n}
        </span>
      ))}
    </div>
  );
};

// --- Excel Filter Dropdown Component ---
const ExcelFilterDropdown = ({
  columnKey,
  type = "string",
  alignLeft = false,
  payments,
  columnFilters,
  activeFilterDropdown,
  setActiveFilterDropdown,
  handleUpdateColumnFilter,
  clearColumnFilter,
  formatDateToDMY,
  getFirstName,
  getBillNumbers,
  getReturnNumbers
}) => {
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280, maxHeight: 480 });
  const triggerRef = useRef(null);
  const isOpen = activeFilterDropdown === columnKey;
  const operators = type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;

  const filterState = columnFilters[columnKey] || { operator: operators[0].value, textValue: '', selectedValues: [] };
  const { operator, textValue, selectedValues } = filterState;

  const uniqueValues = useMemo(() => {
    const vals = new Set();
    payments.forEach(item => {
      if (columnKey === 'billNumbers') {
        getBillNumbers(item).forEach(n => vals.add(String(n)));
        return;
      }
      if (columnKey === 'returnNumbers') {
        getReturnNumbers(item).forEach(n => vals.add(String(n)));
        return;
      }

      let val = "";
      if (columnKey === 'paymentNumber') val = item.paymentNumber || '';
      if (columnKey === 'companyName') val = item.companyName || '';
      if (columnKey === 'paymentDate') val = formatDateToDMY(item.paymentDate);
      if (columnKey === 'hardcopyBillNumber') val = item.hardcopyBillNumber || '';
      if (columnKey === 'netAmountUSD') val = item.netAmountUSD !== undefined ? item.netAmountUSD : '';
      if (columnKey === 'netAmountIQD') val = item.netAmountIQD !== undefined ? item.netAmountIQD : '';
      if (columnKey === 'notes') val = (item.notes || '').trim();
      if (columnKey === 'createdByName') val = getFirstName(item.createdByName);

      vals.add(String(val ?? ""));
    });
    return Array.from(vals).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [payments, columnKey, formatDateToDMY, getFirstName, getBillNumbers, getReturnNumbers]);

  const displayValues = uniqueValues.filter(v => v.toLowerCase().includes(search.toLowerCase()));
  const isActive = !!(textValue || (selectedValues && selectedValues.length > 0) || ['isEmpty', 'isNotEmpty'].includes(operator));

  const handleCheckbox = (val, checked) => {
    const current = selectedValues || [];
    const updated = checked ? [...current, val] : current.filter(v => v !== val);
    handleUpdateColumnFilter(columnKey, { selectedValues: updated });
  };

  const handleSelectAll = (checked) => {
    handleUpdateColumnFilter(columnKey, { selectedValues: checked ? [...uniqueValues] : [] });
  };

  const toggleDropdown = (e) => {
    e.stopPropagation();
    if (isOpen) {
      setActiveFilterDropdown(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(280, vw - 16);
      let left = alignLeft ? rect.left : rect.right - width;
      left = Math.max(8, Math.min(left, vw - width - 8));
      const desiredHeight = 460;
      let top = rect.bottom + 6;
      if (top + desiredHeight > vh - 8) {
        top = Math.max(8, vh - desiredHeight - 8);
      }
      setPos({ top, left, width, maxHeight: vh - top - 8 });
    }
    setSearch("");
    setActiveFilterDropdown(columnKey);
  };

  const panel = (
    <div
      className="filter-dropdown-container"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
        background: "white",
        border: "1px solid #cbd5e1",
        borderRadius: "0.5rem",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.25)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        cursor: "default",
        overflow: "hidden",
        color: "#2c3e50",
        boxSizing: "border-box",
        fontFamily: "var(--font-nrt-reg)",
        textAlign: "left",
      }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "0.5rem", flexShrink: 0 }}>
        <p style={{ margin: "0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Condition</p>
        <select
          value={operator || operators[0].value}
          onChange={(e) => handleUpdateColumnFilter(columnKey, { operator: e.target.value })}
          style={{ width: "100%", boxSizing: "border-box", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none", background: "white" }}
        >
          {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
        </select>
        {!['isEmpty', 'isNotEmpty'].includes(operator) && (
          <input
            type={type === "number" ? "number" : "text"}
            placeholder="Value..."
            value={textValue || ""}
            onChange={(e) => handleUpdateColumnFilter(columnKey, { textValue: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            style={{ width: "100%", boxSizing: "border-box", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none" }}
          />
        )}
      </div>

      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, boxSizing: "border-box" }}>
        <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569", flexShrink: 0 }}>Values</p>
        <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", marginBottom: "0.5rem", boxSizing: "border-box", flexShrink: 0 }}>
          <Search size={14} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search values..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            style={{ border: "none", outline: "none", width: "100%", boxSizing: "border-box", fontSize: "0.875rem", marginLeft: "0.5rem" }}
          />
        </div>

        <div style={{ flex: "1 1 auto", minHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", fontWeight: "500", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={selectedValues.length === uniqueValues.length && uniqueValues.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#7C3AED" }}
            />
            <span>(Select All)</span>
          </label>
          {displayValues.map(val => (
            <label key={val} title={val} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", color: "#1e293b", flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={selectedValues.includes(val)}
                onChange={(e) => handleCheckbox(val, e.target.checked)}
                style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#7C3AED" }}
              />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val === "" ? "(Blank)" : val}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc", boxSizing: "border-box", flexShrink: 0 }}>
        <button onClick={() => clearColumnFilter(columnKey)} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: "0.875rem", cursor: "pointer", fontWeight: 600 }}>Clear</button>
        <button onClick={() => setActiveFilterDropdown(null)} style={{ background: "#7C3AED", border: "none", color: "white", fontSize: "0.875rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>Apply</button>
      </div>
    </div>
  );

  return (
    <div className="filter-dropdown-container" style={{ position: "relative", display: "inline-block" }}>
      <div
        ref={triggerRef}
        onClick={toggleDropdown}
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.25rem",
          borderRadius: "0.375rem",
          background: isActive ? "#EDE9FE" : "transparent",
          color: isActive ? "#7C3AED" : "#bdc3c7"
        }}
      >
        <Filter size={14} />
      </div>

      {isOpen && typeof document !== "undefined" && createPortal(panel, document.body)}
    </div>
  );
};

// --- Table Header with Sort & Filter Dropdown ---
const TableHeader = ({
  title,
  columnKey,
  type = "string",
  colWidth,
  alignLeft = false,
  sortConfig,
  handleSort,
  getSortIcon,
  payments,
  columnFilters,
  activeFilterDropdown,
  setActiveFilterDropdown,
  handleUpdateColumnFilter,
  clearColumnFilter,
  formatDateToDMY,
  getFirstName,
  getBillNumbers,
  getReturnNumbers
}) => (
  <th style={{
    backgroundColor: "#34495e", color: "white", padding: "12px 10px",
    textAlign: "left", fontSize: "14px", fontFamily: "var(--font-nrt-bd)",
    whiteSpace: "nowrap", borderRight: "1px solid #576574",
    width: colWidth || "auto",
    minWidth: colWidth || "auto"
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
      <div onClick={() => handleSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", flex: 1, userSelect: "none" }}>
        {title}
        <span style={{ fontSize: "11px", color: "#bdc3c7" }}>
          {getSortIcon(columnKey)}
        </span>
      </div>
      <ExcelFilterDropdown
        columnKey={columnKey}
        type={type}
        alignLeft={alignLeft}
        payments={payments}
        columnFilters={columnFilters}
        activeFilterDropdown={activeFilterDropdown}
        setActiveFilterDropdown={setActiveFilterDropdown}
        handleUpdateColumnFilter={handleUpdateColumnFilter}
        clearColumnFilter={clearColumnFilter}
        formatDateToDMY={formatDateToDMY}
        getFirstName={getFirstName}
        getBillNumbers={getBillNumbers}
        getReturnNumbers={getReturnNumbers}
      />
    </div>
  </th>
);

export default function BoughtPaymentManagementPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [boughtBills, setBoughtBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedBoughtBills, setSelectedBoughtBills] = useState([]);
  const [selectedBoughtReturns, setSelectedBoughtReturns] = useState([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [hardcopyBillNumber, setHardcopyBillNumber] = useState("");
  const [hardcopyBillError, setHardcopyBillError] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  // Lookup maps (id -> displayed number) for payments that only stored IDs
  const [billNumberMap, setBillNumberMap] = useState({});
  const [returnNumberMap, setReturnNumberMap] = useState({});

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: ""
  });

  const [advancedSearch, setAdvancedSearch] = useState({
    companyName: "",
    hardcopyBillNumber: "",
    boughtBillNumber: "",
    returnBillNumber: "",
    paymentNumber: "",
    createdBy: "",
    dateFrom: "",
    dateTo: "",
    amountMinUSD: "",
    amountMaxUSD: "",
    amountMinIQD: "",
    amountMaxIQD: "",
  });

  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Sorting & Header Column Filter states
  const [sortConfig, setSortConfig] = useState({ key: "paymentDate", direction: "desc" });
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);

  // DETAILS MODAL FOR UNPAID BILLS
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState({ title: "", type: "", items: [], currency: "USD", note: "" });

  // IMAGE STATE
  const [billImageData, setBillImageData] = useState(null);
  const [originalImageData, setOriginalImageData] = useState(null);
  const [imageHasChanged, setImageHasChanged] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Quick attach image for already recorded payment
  const [attachTargetPayment, setAttachTargetPayment] = useState(null);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [attachUploading, setAttachUploading] = useState(false);
  const quickFileInputRef = useRef(null);
  const quickCameraInputRef = useRef(null);

  // Replace / delete image from the image viewer
  const [imageModalPayment, setImageModalPayment] = useState(null);
  const [imageActionLoading, setImageActionLoading] = useState(false);
  const replaceFileInputRef = useRef(null);
  const replaceCameraInputRef = useRef(null);

  const [currencyTotals, setCurrencyTotals] = useState({ boughtUSD: 0, boughtIQD: 0, returnUSD: 0, returnIQD: 0, netUSD: 0, netIQD: 0 });
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [printLoading, setPrintLoading] = useState(false);
  const [consignmentWarnings, setConsignmentWarnings] = useState([]);

  const hardcopyBillNumberRef = useRef(null);
  const companyDropdownRef = useRef(null);

  const colorScheme = {
    primary: "#8B5CF6",
    secondary: "#06B6D4",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    dark: "#7C3AED",
    light: "#A78BFA",
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#1F2937",
    textLight: "#6B7280",
  };

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      setIsLoading(false);
    }
  }, [user, router]);

  // Close header filter dropdown when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.filter-dropdown-container')) {
        setActiveFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const formatDateToDMY = useCallback((date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  const formatDateToYMD = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const generateSequentialPaymentNumber = async () => {
    const currentYear = new Date().getFullYear();
    const allPayments = await getBoughtPayments();

    const currentYearPayments = allPayments.filter(payment => {
      const paymentNumber = payment.paymentNumber || '';
      return paymentNumber.startsWith(`BPAY-${currentYear}-`);
    });

    let maxNumber = 0;
    currentYearPayments.forEach(payment => {
      const match = payment.paymentNumber?.match(new RegExp(`BPAY-${currentYear}-(\\d+)`));
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });

    const newNumber = maxNumber + 1;
    return `BPAY-${currentYear}-${newNumber}`;
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || Math.abs(amount) < 0.5) return "0 IQD";
    return new Intl.NumberFormat("en-US").format(Math.round(amount)) + " IQD";
  };

  const formatUSD = (amount) => {
    if (amount === undefined || amount === null || Math.abs(amount) < 0.0001) return "$0.00";
    const sign = amount < 0 ? "-" : "";
    return sign + "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(amount));
  };

  const getDisplayAmount = (amountUSD, amountIQD) => {
    const parts = [];
    if (amountUSD && amountUSD > 0) parts.push(formatUSD(amountUSD));
    if (amountIQD && amountIQD > 0) parts.push(formatCurrency(amountIQD));
    if (parts.length === 0) return "0 IQD";
    return parts.join(" + ");
  };

  const getFirstName = useCallback((fullName) => {
    if (!fullName) return "User";
    const namePart = fullName.split("@")[0];
    return namePart.split(" ")[0];
  }, []);

  // --- Bill / Return number helpers for the history table ---
  const getBillNumbers = useCallback((payment) => {
    const ids = payment?.selectedBoughtBills || [];
    if (ids.length === 0) return [];
    if (Array.isArray(payment.selectedBoughtBillNumbers) && payment.selectedBoughtBillNumbers.length === ids.length) {
      return payment.selectedBoughtBillNumbers.map(String);
    }
    return ids.map((id) => String(billNumberMap[id] ?? `…${String(id).slice(-4)}`));
  }, [billNumberMap]);

  const getReturnNumbers = useCallback((payment) => {
    const ids = payment?.selectedBoughtReturns || [];
    if (ids.length === 0) return [];
    if (Array.isArray(payment.selectedBoughtReturnNumbers) && payment.selectedBoughtReturnNumbers.length === ids.length) {
      return payment.selectedBoughtReturnNumbers.map(String);
    }
    return ids.map((id) => String(returnNumberMap[id] ?? `…${String(id).slice(-4)}`));
  }, [returnNumberMap]);

  // Resolve numbers for older payments that only saved IDs
  useEffect(() => {
    if (!paymentHistory || paymentHistory.length === 0) return;
    let cancelled = false;

    const hasStoredBills = (p) =>
      Array.isArray(p.selectedBoughtBillNumbers) &&
      p.selectedBoughtBillNumbers.length === (p.selectedBoughtBills?.length || 0);
    const hasStoredReturns = (p) =>
      Array.isArray(p.selectedBoughtReturnNumbers) &&
      p.selectedBoughtReturnNumbers.length === (p.selectedBoughtReturns?.length || 0);

    const resolve = async () => {
      try {
        // Bills
        const needBills = paymentHistory.some((p) => (p.selectedBoughtBills?.length || 0) > 0 && !hasStoredBills(p));
        if (needBills) {
          const allBills = await getBoughtBills();
          if (cancelled) return;
          const map = {};
          allBills.forEach((b) => {
            map[b.id] = String(b.billNumber ?? b.id);
          });
          setBillNumberMap((prev) => ({ ...prev, ...map }));
        }

        // Returns (grouped per company to keep requests low)
        const companyIds = new Set();
        paymentHistory.forEach((p) => {
          if ((p.selectedBoughtReturns?.length || 0) > 0 && !hasStoredReturns(p) && p.companyId) {
            companyIds.add(p.companyId);
          }
        });

        if (companyIds.size > 0) {
          const results = await Promise.all(
            Array.from(companyIds).map((cid) => getReturnsForCompany(cid).catch(() => []))
          );
          if (cancelled) return;
          const rMap = {};
          results.flat().forEach((r) => {
            if (r && r.id) rMap[r.id] = getReturnLabel(r);
          });
          setReturnNumberMap((prev) => ({ ...prev, ...rMap }));
        }
      } catch (err) {
        console.error("Error resolving bill/return numbers:", err);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [paymentHistory]);

  // Extract unique creator names/emails from payment history for the filter dropdown
  const uniqueCreators = useMemo(() => {
    const creatorsSet = new Set();
    paymentHistory.forEach((p) => {
      if (p.createdByName && p.createdByName !== "Unknown User") {
        creatorsSet.add(p.createdByName);
      } else if (p.createdBy && p.createdBy !== "unknown") {
        creatorsSet.add(p.createdBy);
      }
    });
    return Array.from(creatorsSet).sort();
  }, [paymentHistory]);

  const processImageFile = (file, callback) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setImageProcessing(true);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        let width = img.width;
        let height = img.height;
        const maxWidth = 800;
        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);

        const base64 = canvas.toDataURL("image/jpeg", 0.7);
        setImageProcessing(false);
        if (callback) {
          callback(base64);
        } else {
          setBillImageData(base64);
          setImageHasChanged(true);
        }
      };
      img.onerror = () => {
        setError("Failed to load image. Please try another file.");
        setImageProcessing(false);
      };
      img.src = readerEvent.target.result;
    };
    reader.onerror = () => {
      setError("Failed to read file. Please try again.");
      setImageProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e) => processImageFile(e.target.files[0]);
  const handleCameraChange = (e) => processImageFile(e.target.files[0]);
  const triggerFileInput = () => fileInputRef.current?.click();
  const triggerCameraInput = () => cameraInputRef.current?.click();

  const removeImage = () => {
    setBillImageData(null);
    setImageHasChanged(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleDownloadImage = () => {
    if (!selectedImageUrl) return;
    const link = document.createElement("a");
    link.href = selectedImageUrl;
    link.download = `Bill_Image_${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save (or clear) the image of an existing payment and keep all local state in sync
  const persistPaymentImage = async (payment, imageValue) => {
    const paymentRef = doc(db, "boughtPayments", payment.id);
    await updateDoc(paymentRef, {
      billImageBase64: imageValue,
      billImageUrl: imageValue,
    });
    setPaymentHistory((prev) =>
      prev.map((p) => (p.id === payment.id ? { ...p, billImageBase64: imageValue, billImageUrl: imageValue } : p))
    );
    setSelectedPayment((prev) =>
      prev && prev.id === payment.id ? { ...prev, billImageBase64: imageValue, billImageUrl: imageValue } : prev
    );
    // If this payment is currently loaded in the edit form, keep the form in sync
    if (isEditMode && editPaymentId === payment.id) {
      setOriginalImageData(imageValue);
      if (!imageHasChanged) setBillImageData(imageValue);
    }
  };

  // Quick attach image directly to an existing payment in the table
  const handleOpenAttachModal = (payment) => {
    setAttachTargetPayment(payment);
    setAttachModalOpen(true);
  };

  const handleQuickImageSelected = (file) => {
    if (!attachTargetPayment || !file) return;
    const target = attachTargetPayment;
    processImageFile(file, async (base64) => {
      try {
        setAttachUploading(true);
        await persistPaymentImage(target, base64);
        setSuccess("Bill image attached successfully!");
        setAttachModalOpen(false);
        setAttachTargetPayment(null);
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        console.error("Error attaching image:", err);
        setError("Failed to attach image: " + err.message);
      } finally {
        setAttachUploading(false);
      }
    });
  };

  // Replace the attached image from the image viewer
  const handleReplaceImageSelected = (file) => {
    if (!imageModalPayment || !file) return;
    const target = imageModalPayment;
    processImageFile(file, async (base64) => {
      try {
        setImageActionLoading(true);
        await persistPaymentImage(target, base64);
        setSelectedImageUrl(base64);
        setSuccess("Bill image replaced successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        console.error("Error replacing image:", err);
        setError("Failed to replace image: " + err.message);
      } finally {
        setImageActionLoading(false);
      }
    });
  };

  // Delete the attached image from the image viewer
  const handleDeleteAttachedImage = async () => {
    if (!imageModalPayment) return;
    if (!window.confirm("Are you sure you want to delete this attached image?")) return;
    const target = imageModalPayment;
    try {
      setImageActionLoading(true);
      await persistPaymentImage(target, null);
      setShowImageModal(false);
      setSelectedImageUrl("");
      setImageModalPayment(null);
      setSuccess("Bill image deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting image:", err);
      setError("Failed to delete image: " + err.message);
    } finally {
      setImageActionLoading(false);
    }
  };

  const normalizeForSearch = (str) => {
    if (!str) return "";
    return str.toString().toLowerCase()
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/ه/g, "ە")
      .trim();
  };

  const filteredCompanies = companies.filter((company) => {
    const search = normalizeForSearch(companySearchTerm);
    if (!search) return true;
    return (
      normalizeForSearch(company.name).includes(search) ||
      normalizeForSearch(company.code).includes(search)
    );
  });

  const handleSelectCompany = (company) => {
    if (!company) {
      setSelectedCompany("");
      setCompanySearchTerm("");
      setSelectedBoughtBills([]);
      setSelectedBoughtReturns([]);
      setBoughtBills([]);
      setReturns([]);
      setError(null);
      if (!isEditMode) {
        setHardcopyBillNumber("");
        setBillImageData(null);
        setOriginalImageData(null);
        setImageHasChanged(false);
      }
      return;
    }

    setSelectedCompany(company.id);
    setCompanySearchTerm(company.name);
    setShowCompanyDropdown(false);
  };

  const handleCompanyInputChange = (e) => {
    setCompanySearchTerm(e.target.value);
    setShowCompanyDropdown(true);
    if (e.target.value === "") {
      setSelectedCompany("");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshPayments = async () => {
    try {
      setHistoryLoading(true);
      const paymentsData = await getBoughtPayments();
      paymentsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      setPaymentHistory(paymentsData);
    } catch (err) {
      console.error("Error refreshing payments:", err);
      setError("Failed to refresh payment history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const loadInitialData = async () => {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get("edit");
        if (editId) { setIsEditMode(true); setEditPaymentId(editId); }
      }
      await refreshPayments();
      await loadCompanies();
    };
    loadInitialData();
  }, [user]);

  const loadCompanies = async () => {
    try {
      const companiesData = await getCompanies();
      setCompanies(companiesData.filter(c => c && c.id));
    } catch (err) {
      console.error("Error loading companies:", err);
      setError("Failed to load companies");
    }
  };

  useEffect(() => {
    const loadPaymentForEdit = async () => {
      if (!isEditMode || !editPaymentId || companies.length === 0) return;
      try {
        setLoading(true);
        setError(null);
        const paymentToEdit = await getBoughtPaymentDetails(editPaymentId);
        if (paymentToEdit) {
          setSelectedCompany(paymentToEdit.companyId);
          const company = companies.find((c) => c.id === paymentToEdit.companyId);
          setCompanySearchTerm(company?.name || "");
          setHardcopyBillNumber(paymentToEdit.hardcopyBillNumber);

          const existingImage = paymentToEdit.billImageBase64 || paymentToEdit.billImageUrl || null;
          setBillImageData(existingImage);
          setOriginalImageData(existingImage);
          setImageHasChanged(false);

          if (fileInputRef.current) fileInputRef.current.value = "";
          if (cameraInputRef.current) cameraInputRef.current.value = "";

          if (paymentToEdit.paymentDate) {
            setPaymentDate(formatDateToYMD(paymentToEdit.paymentDate));
          } else {
            setPaymentDate(new Date().toISOString().split("T")[0]);
          }
          setNotes(paymentToEdit.notes || "");
          setSelectedBoughtBills(paymentToEdit.selectedBoughtBills || []);
          setSelectedBoughtReturns(paymentToEdit.selectedBoughtReturns || []);
        }
      } catch (err) {
        console.error("Error loading payment for edit:", err);
        setError("Failed to load payment for editing");
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    };
    loadPaymentForEdit();
  }, [isEditMode, editPaymentId, companies]);

  useEffect(() => {
    if (!selectedCompany) {
      setBoughtBills([]);
      setReturns([]);
      return;
    }
    const loadCompanyData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [allBoughtBills, allReturns] = await Promise.all([
          getCompanyBoughtBills(selectedCompany, isEditMode ? selectedBoughtBills : []),
          getReturnsForCompany(selectedCompany, isEditMode ? selectedBoughtReturns : []),
        ]);
        setBoughtBills(allBoughtBills);
        const uniqueReturnsMap = new Map();
        allReturns.forEach((returnItem) => {
          if (!uniqueReturnsMap.has(returnItem.id)) {
            uniqueReturnsMap.set(returnItem.id, {
              ...returnItem,
              items: returnItem.items ? [...returnItem.items] : [{
                name: returnItem.name, barcode: returnItem.barcode,
                returnQuantity: returnItem.returnQuantity, returnPrice: returnItem.returnPrice,
                returnPriceUSD: returnItem.returnPriceUSD, returnPriceIQD: returnItem.returnPriceIQD,
                returnNote: returnItem.returnNote || "",
              }],
              totalReturnUSD: returnItem.totalReturnUSD || 0,
              totalReturnIQD: returnItem.totalReturnIQD || 0,
              totalReturn: returnItem.totalReturn || (returnItem.returnPrice || 0) * (returnItem.returnQuantity || 0),
              returnNote: returnItem.returnNote || "",
            });
          } else {
            const existing = uniqueReturnsMap.get(returnItem.id);
            if (returnItem.name && !existing.items.some((i) => i.barcode === returnItem.barcode)) {
              existing.items.push({
                name: returnItem.name, barcode: returnItem.barcode,
                returnQuantity: returnItem.returnQuantity, returnPrice: returnItem.returnPrice,
                returnPriceUSD: returnItem.returnPriceUSD, returnPriceIQD: returnItem.returnPriceIQD,
                returnNote: returnItem.returnNote || "",
              });
              existing.totalReturnUSD += returnItem.totalReturnUSD || 0;
              existing.totalReturnIQD += returnItem.totalReturnIQD || 0;
              existing.totalReturn += (returnItem.returnPrice || 0) * (returnItem.returnQuantity || 0);
            }
          }
        });
        setReturns(Array.from(uniqueReturnsMap.values()));
      } catch (err) {
        console.error("Error loading company data:", err);
        setError("Failed to load company data");
      } finally {
        setLoading(false);
      }
    };
    loadCompanyData();
  }, [selectedCompany, isEditMode, initialLoadComplete]);

  useEffect(() => {
    let boughtUSD = 0, boughtIQD = 0, returnUSD = 0, returnIQD = 0;
    selectedBoughtBills.forEach((billId) => {
      const bill = boughtBills.find((b) => b.id === billId);
      if (bill) {
        if ((bill.currency || "USD") === "USD") boughtUSD += bill.totalAmountUSD || bill.totalAmount || 0;
        else boughtIQD += bill.totalAmountIQD || bill.totalAmount || 0;
      }
    });
    selectedBoughtReturns.forEach((returnId) => {
      const returnBill = returns.find((r) => r.id === returnId);
      if (returnBill) {
        if (returnBill.items && returnBill.items.length > 0) {
          returnBill.items.forEach((item) => {
            const itemCurrency = item.currency || returnBill.currency || "USD";
            const itemTotal = (item.returnPrice || 0) * (item.returnQuantity || 0);
            if (itemCurrency === "USD") returnUSD += itemTotal;
            else returnIQD += itemTotal;
          });
        } else {
          const returnCurrency = returnBill.currency || "USD";
          const returnTotal = (returnBill.returnPrice || 0) * (returnBill.returnQuantity || 0);
          if (returnCurrency === "USD") returnUSD += returnTotal;
          else returnIQD += returnTotal;
        }
      }
    });
    setCurrencyTotals({ boughtUSD, boughtIQD, returnUSD, returnIQD, netUSD: boughtUSD - returnUSD, netIQD: boughtIQD - returnIQD });
  }, [selectedBoughtBills, selectedBoughtReturns, boughtBills, returns]);

  useEffect(() => {
    const warnings = [];
    selectedBoughtBills.forEach((billId) => {
      const bill = boughtBills.find((b) => b.id === billId);
      if (bill && bill.isConsignment) {
        warnings.push({
          billId,
          billNumber: bill.billNumber,
          message: `Bill #${bill.billNumber} contains consigned items. Items may still be in the store — please verify before paying.`,
        });
      }
    });
    setConsignmentWarnings(warnings);
  }, [selectedBoughtBills, boughtBills]);

  const toggleBoughtBill = (billId) => setSelectedBoughtBills((prev) => prev.includes(billId) ? prev.filter((id) => id !== billId) : [...prev, billId]);
  const toggleBoughtReturn = (returnId) => setSelectedBoughtReturns((prev) => prev.includes(returnId) ? prev.filter((id) => id !== returnId) : [...prev, returnId]);
  const selectAllBoughtBills = () => setSelectedBoughtBills(selectedBoughtBills.length === boughtBills.length ? [] : boughtBills.map((b) => b.id));
  const selectAllBoughtReturns = () => setSelectedBoughtReturns(selectedBoughtReturns.length === returns.length ? [] : returns.map((r) => r.id));

  const resetForm = () => {
    setSelectedBoughtBills([]);
    setSelectedBoughtReturns([]);
    setHardcopyBillNumber("");
    setNotes("");
    setBillImageData(null);
    setOriginalImageData(null);
    setImageHasChanged(false);
    setSelectedCompany("");
    setCompanySearchTerm("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setPaymentDate(new Date().toISOString().split("T")[0]);
  };

  const viewBoughtBillDetails = (e, bill) => {
    e.stopPropagation();
    setDetailData({
      title: `Bill #${bill.billNumber || bill.id}`,
      type: "bought",
      items: bill.items || [],
      currency: bill.currency || "USD",
      note: bill.billNote || bill.note || ""
    });
    setShowDetailModal(true);
  };

  const viewReturnDetails = (e, ret) => {
    e.stopPropagation();
    setDetailData({
      title: `Return #${ret.returnBillNumber || ret.returnNumber || ret.id?.slice(-6)}`,
      type: "return",
      items: ret.items || [],
      currency: ret.currency || "USD",
      note: ret.returnNote || ret.note || ""
    });
    setShowDetailModal(true);
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm("Are you sure you want to delete this payment? Associated bills and returns will be marked as unpaid. This action cannot be undone.")) {
      return;
    }
    try {
      setSubmitting(true);

      const paymentToDelete = paymentHistory.find((p) => p.id === paymentId);

      if (!paymentToDelete) {
        throw new Error("Payment not found in history.");
      }

      const batch = writeBatch(db);

      // Revert Bought Bills to unpaid
      if (paymentToDelete.selectedBoughtBills && paymentToDelete.selectedBoughtBills.length > 0) {
        paymentToDelete.selectedBoughtBills.forEach((billId) => {
          const billRef = doc(db, "boughtBills", billId);
          batch.set(billRef, {
            status: "unpaid",
            paymentStatus: "unpaid",
            isPaid: false,
            paymentId: null
          }, { merge: true });
        });
      }

      // Revert Returns to unprocessed
      if (paymentToDelete.selectedBoughtReturns && paymentToDelete.selectedBoughtReturns.length > 0) {
        paymentToDelete.selectedBoughtReturns.forEach((returnId) => {
          const returnRef = doc(db, "returns", returnId);
          batch.set(returnRef, {
            status: "unprocessed",
            paymentStatus: "unpaid",
            isPaid: false,
            paymentId: null
          }, { merge: true });
        });
      }

      // Delete the actual payment document
      const paymentRef = doc(db, "boughtPayments", paymentId);
      batch.delete(paymentRef);

      await batch.commit();

      setSuccess("Payment deleted and bills reverted to unpaid successfully!");

      await refreshPayments();

      if (selectedCompany === paymentToDelete.companyId) {
        setInitialLoadComplete((prev) => !prev);
      }

      setTimeout(() => setSuccess(null), 3000);
      if (showPaymentModal) {
        setShowPaymentModal(false);
      }
    } catch (err) {
      console.error("Error deleting payment:", err);
      setError(err.message || "Failed to delete payment and revert bills.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setHardcopyBillError(false);

    let hasError = false;
    if (!selectedCompany) {
      setError("Please select a company");
      hasError = true;
    }
    if (!hardcopyBillNumber.trim()) {
      setHardcopyBillError(true);
      if (!hasError) {
        hardcopyBillNumberRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => hardcopyBillNumberRef.current?.focus(), 400);
      }
      hasError = true;
    }
    if (selectedBoughtBills.length === 0 && selectedBoughtReturns.length === 0) {
      if (!hasError) setError("Please select at least one bill or return to process");
      hasError = true;
    }
    if (hasError) return;

    if (imageProcessing) {
      setError("Image is still processing. Please wait a moment.");
      return;
    }

    try {
      setSubmitting(true);

      const selectedCompanyData = companies.find((c) => c.id === selectedCompany);
      const userDisplayName = user?.name || user?.email || "Unknown User";

      let paymentNumber;
      if (isEditMode) {
        const existingPayment = paymentHistory.find(p => p.id === editPaymentId);
        paymentNumber = existingPayment?.paymentNumber || await generateSequentialPaymentNumber();
      } else {
        paymentNumber = await generateSequentialPaymentNumber();
      }

      let imageToSave = isEditMode ? (imageHasChanged ? (billImageData || null) : (originalImageData || null)) : (billImageData || null);

      // Save the visible numbers so the history table can show them instantly
      const selectedBoughtBillNumbers = selectedBoughtBills.map((id) => {
        const b = boughtBills.find((x) => x.id === id);
        return String(b?.billNumber ?? billNumberMap[id] ?? String(id).slice(-4));
      });
      const selectedBoughtReturnNumbers = selectedBoughtReturns.map((id) => {
        const r = returns.find((x) => x.id === id);
        return String(r ? getReturnLabel(r, id) : (returnNumberMap[id] ?? `RET-${String(id).slice(-6)}`));
      });

      const paymentData = {
        paymentNumber,
        companyId: selectedCompany,
        companyName: selectedCompanyData?.name || "Unknown Company",
        selectedBoughtBills,
        selectedBoughtReturns,
        selectedBoughtBillNumbers,
        selectedBoughtReturnNumbers,
        boughtTotalUSD: currencyTotals.boughtUSD,
        boughtTotalIQD: currencyTotals.boughtIQD,
        returnTotalUSD: currencyTotals.returnUSD,
        returnTotalIQD: currencyTotals.returnIQD,
        netAmountUSD: currencyTotals.netUSD,
        netAmountIQD: currencyTotals.netIQD,
        netAmount: currencyTotals.netUSD + currencyTotals.netIQD,
        boughtTotal: currencyTotals.boughtUSD + currencyTotals.boughtIQD,
        returnTotal: currencyTotals.returnUSD + currencyTotals.returnIQD,
        paymentDate: new Date(paymentDate),
        hardcopyBillNumber: hardcopyBillNumber.trim(),
        notes,
        billImageBase64: imageToSave,
        billImageUrl: imageToSave,
        createdBy: user.uid,
        createdByName: userDisplayName,
        paymentType: "bought",
      };

      if (isEditMode) {
        await updateBoughtPayment(editPaymentId, paymentData);
        setSuccess("Bought Payment updated successfully!");
        setIsEditMode(false);
        setEditPaymentId(null);
      } else {
        const result = await createBoughtPayment(paymentData);
        if (!result || !result.id) throw new Error("Payment creation failed: No payment ID returned.");
        setSuccess("Bought Payment created successfully!");
      }

      resetForm();
      await refreshPayments();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error creating/updating payment:", err);
      setError(err.message || "Failed to process payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditPaymentId(null);
    setSelectedBoughtBills([]);
    setSelectedBoughtReturns([]);
    setHardcopyBillNumber("");
    setHardcopyBillError(false);
    setNotes("");
    setBillImageData(null);
    setOriginalImageData(null);
    setImageHasChanged(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setSelectedCompany("");
    setCompanySearchTerm("");
    window.history.replaceState({}, "", "/bought-payments");
  };

  const handleUpdatePayment = (payment) => {
    setIsEditMode(true);
    setEditPaymentId(payment.id);
    setSelectedCompany(payment.companyId);
    const company = companies.find((c) => c.id === payment.companyId);
    setCompanySearchTerm(company?.name || "");
    setHardcopyBillNumber(payment.hardcopyBillNumber);
    setHardcopyBillError(false);

    const existingImage = payment.billImageBase64 || payment.billImageUrl || null;
    setBillImageData(existingImage);
    setOriginalImageData(existingImage);
    setImageHasChanged(false);

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";

    if (payment.paymentDate) {
      setPaymentDate(formatDateToYMD(payment.paymentDate));
    } else {
      setPaymentDate(new Date().toISOString().split("T")[0]);
    }
    setNotes(payment.notes || "");
    setSelectedBoughtBills(payment.selectedBoughtBills || []);
    setSelectedBoughtReturns(payment.selectedBoughtReturns || []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewPayment = async (payment) => {
    setSelectedPayment(payment);
    await loadPaymentDetails(payment.id);
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => { setShowPaymentModal(false); setSelectedPayment(null); };

  // payment is optional: when provided, the viewer shows Replace / Delete actions
  const handleViewImage = (imageData, payment = null) => {
    setSelectedImageUrl(imageData);
    setImageModalPayment(payment);
    setShowImageModal(true);
  };
  const closeImageModal = () => {
    if (imageActionLoading) return;
    setShowImageModal(false);
    setSelectedImageUrl("");
    setImageModalPayment(null);
  };

  const handlePrintPayment = async (payment) => {
    setPrintLoading(true);
    try {
      const allBoughtBills = await getBoughtBills();
      const allReturnsRaw = await getReturnsForCompany(payment.companyId);
      const boughtDetails = allBoughtBills.filter((bill) => payment.selectedBoughtBills?.includes(bill.id));
      const returnDetailsMap = new Map();
      allReturnsRaw.forEach((r) => {
        if (!payment.selectedBoughtReturns?.includes(r.id)) return;
        if (!returnDetailsMap.has(r.id)) returnDetailsMap.set(r.id, { ...r, allItems: [] });
        returnDetailsMap.get(r.id).allItems.push(r);
      });
      const returnDetails = Array.from(returnDetailsMap.values());
      const printWindow = window.open("", "_blank");
      printWindow.document.write(generatePrintHTML(payment, boughtDetails, returnDetails));
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    } catch (err) {
      console.error("Error generating print:", err);
      setError("Failed to generate print preview");
    } finally {
      setPrintLoading(false);
    }
  };

  const generatePrintHTML = (payment, boughtBillsList, returnsList) => {
    let totalBoughtUSD = 0, totalBoughtIQD = 0, totalReturnUSD = 0, totalReturnIQD = 0;
    const boughtItemsRows = [];
    const returnItemsRows = [];

    if (boughtBillsList && boughtBillsList.length > 0) {
      boughtBillsList.forEach((bill) => {
        const currency = bill.currency || "USD";
        let billTotal = 0;
        if (bill.items && Array.isArray(bill.items) && bill.items.length > 0) {
          bill.items.forEach((item) => { billTotal += (item.basePrice || item.price || 0) * (item.quantity || 1); });
        } else if (bill.totalAmountUSD || bill.totalAmountIQD) {
          billTotal = currency === "USD" ? bill.totalAmountUSD || 0 : bill.totalAmountIQD || 0;
        } else {
          billTotal = bill.totalAmount || bill.amount || 0;
        }
        if (currency === "USD") totalBoughtUSD += billTotal;
        else totalBoughtIQD += billTotal;
        const displayAmount = currency === "USD" ? formatUSD(billTotal) : formatCurrency(billTotal);
        const billNote = bill.billNote || bill.note || "";
        boughtItemsRows.push(`<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${bill.billNumber || bill.id}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${formatDateToDMY(bill.date)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:10px;">${billNote || "—"}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;color:${currency === "USD" ? "#059669" : "#2563eb"};">+${displayAmount}</td>
        </tr>`);
      });
    }

    if (returnsList && returnsList.length > 0) {
      const displayedReturnNumbers = new Set();
      returnsList.forEach((ret) => {
        const returnNumberDisplay = ret.returnBillNumber || ret.returnNumber || `RET-${ret.id?.slice(-6)}`;
        const currency = ret.currency || "USD";
        let returnTotal = 0;
        if (ret.items && Array.isArray(ret.items) && ret.items.length > 0) {
          ret.items.forEach((item) => { returnTotal += (item.returnPrice || 0) * (item.returnQuantity || 0); });
        } else if (ret.allItems && ret.allItems.length > 0) {
          ret.allItems.forEach((item) => { returnTotal += (item.returnPrice || 0) * (item.returnQuantity || 0); });
        } else {
          returnTotal = (ret.returnPrice || 0) * (ret.returnQuantity || 0);
          if (returnTotal === 0) returnTotal = ret.totalReturnUSD || ret.totalReturnIQD || ret.totalReturn || 0;
        }
        if (currency === "USD") totalReturnUSD += returnTotal;
        else totalReturnIQD += returnTotal;
        const displayAmount = currency === "USD" ? formatUSD(returnTotal) : formatCurrency(returnTotal);
        const rowKey = `${returnNumberDisplay}_${currency}`;
        const retNote = ret.returnNote || ret.note || "";
        if (!displayedReturnNumbers.has(rowKey)) {
          displayedReturnNumbers.add(rowKey);
          returnItemsRows.push(`<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${returnNumberDisplay}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${formatDateToDMY(ret.returnDate || ret.date)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:10px;">${retNote || "—"}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;color:${currency === "USD" ? "#dc2626" : "#b91c1c"};">-${displayAmount}</td>
          </tr>`);
        }
      });
    }

    const finalReturnUSD = totalReturnUSD || payment.returnTotalUSD || 0;
    const finalReturnIQD = totalReturnIQD || payment.returnTotalIQD || 0;
    const finalBoughtUSD = totalBoughtUSD || payment.boughtTotalUSD || 0;
    const finalBoughtIQD = totalBoughtIQD || payment.boughtTotalIQD || 0;
    const paidUSD = payment.netAmountUSD !== undefined && payment.netAmountUSD !== null ? payment.netAmountUSD : finalBoughtUSD - finalReturnUSD;
    const paidIQD = payment.netAmountIQD !== undefined && payment.netAmountIQD !== null ? payment.netAmountIQD : finalBoughtIQD - finalReturnIQD;
    const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/Aranlogo.png` : "/Aranlogo.png";

    return `<!DOCTYPE html>
<html>
  <head>
    <title>Payment Receipt - ${payment.paymentNumber}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#111;background:white;padding:15px;}
      .receipt{max-width:900px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:20px;background:white;}
      .header{text-align:center;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #8B5CF6;}
      .logo{max-height:70px;max-width:220px;object-fit:contain;margin-bottom:8px;}
      .header h1{font-size:18px;font-weight:bold;margin-bottom:4px;color:#8B5CF6;}
      .header p{font-size:11px;color:#6b7280;}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;padding:12px;background:#f8fafc;border-radius:8px;}
      .info-item{margin-bottom:6px;}
      .info-label{font-weight:bold;color:#6b7280;font-size:9px;text-transform:uppercase;margin-bottom:2px;}
      .info-value{font-size:12px;font-weight:600;color:#1f2937;}
      .totals-row{display:flex;justify-content:space-between;gap:12px;margin-bottom:20px;}
      .total-card{flex:1;padding:10px;border-radius:8px;text-align:center;}
      .total-card.bought{background:#d1fae5;border:1px solid #10b981;}
      .total-card.return{background:#fee2e2;border:1px solid #ef4444;}
      .total-card.paid{background:#e9d5ff;border:1px solid #8b5cf6;}
      .total-label{font-size:9px;text-transform:uppercase;font-weight:600;color:#4b5563;margin-bottom:4px;}
      .total-amount{font-size:13px;font-weight:bold;}
      .section{margin-bottom:20px;}
      .section-title{font-size:12px;font-weight:bold;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #e5e7eb;}
      table{width:100%;border-collapse:collapse;}
      th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #e5e7eb;}
      th{background:#f3f4f6;font-weight:600;font-size:10px;}
      th:last-child,td:last-child{text-align:right;}
      .notes-box{margin-top:15px;padding:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:10px;}
      .footer{margin-top:15px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;font-size:8px;color:#9ca3af;}
      @media print{body{padding:0;margin:0;}.receipt{border:none;padding:10px;}}
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        <img src="${logoUrl}" alt="Aran Logo" class="logo" onerror="this.style.display='none'" />
        <h1>BOUGHT PAYMENT RECEIPT</h1>
        <p><strong>${payment.paymentNumber}</strong> | ${formatDateToDMY(payment.paymentDate)}</p>
      </div>
      <div class="info-grid">
        <div>
          <div class="info-item"><div class="info-label">Company</div><div class="info-value">${payment.companyName || ""}</div></div>
          <div class="info-item"><div class="info-label">Hardcopy Bill</div><div class="info-value">${payment.hardcopyBillNumber || ""}</div></div>
        </div>
        <div>
          <div class="info-item"><div class="info-label">Created By</div><div class="info-value">${getFirstName(payment.createdByName)}</div></div>
          <div class="info-item"><div class="info-label">Payment Date</div><div class="info-value">${formatDateToDMY(payment.paymentDate)}</div></div>
        </div>
      </div>
      <div class="totals-row">
        <div class="total-card bought">
          <div class="total-label">TOTAL BOUGHT</div>
          ${finalBoughtUSD > 0 ? `<div class="total-amount" style="color:#059669;">+${formatUSD(finalBoughtUSD)}</div>` : ""}
          ${finalBoughtIQD > 0 ? `<div class="total-amount" style="color:#2563eb;">+${formatCurrency(finalBoughtIQD)}</div>` : ""}
          ${finalBoughtUSD === 0 && finalBoughtIQD === 0 ? `<div class="total-amount" style="color:#6b7280;">$0.00</div>` : ""}
        </div>
        <div class="total-card return">
          <div class="total-label">TOTAL RETURN</div>
          ${finalReturnUSD > 0 ? `<div class="total-amount" style="color:#dc2626;">-${formatUSD(finalReturnUSD)}</div>` : ""}
          ${finalReturnIQD > 0 ? `<div class="total-amount" style="color:#b91c1c;">-${formatCurrency(finalReturnIQD)}</div>` : ""}
          ${finalReturnUSD === 0 && finalReturnIQD === 0 ? `<div class="total-amount" style="color:#6b7280;">$0.00</div>` : ""}
        </div>
        <div class="total-card paid">
          <div class="total-label">TOTAL PAID</div>
          ${paidUSD !== 0 ? `<div class="total-amount" style="color:${paidUSD >= 0 ? "#059669" : "#dc2626"};">${paidUSD >= 0 ? "+" : ""}${formatUSD(paidUSD)}</div>` : ""}
          ${paidIQD !== 0 ? `<div class="total-amount" style="color:${paidIQD >= 0 ? "#2563eb" : "#b91c1c"};">${paidIQD >= 0 ? "+" : ""}${formatCurrency(paidIQD)}</div>` : ""}
          ${paidUSD === 0 && paidIQD === 0 ? `<div class="total-amount" style="color:#6b7280;">$0.00</div>` : ""}
        </div>
      </div>
      ${boughtItemsRows.length > 0 ? `<div class="section"><div class="section-title">📦 BOUGHT BILLS</div><table><thead><tr><th>Bill Number</th><th>Date</th><th>Note</th><th>Amount</th></tr></thead><tbody>${boughtItemsRows.join("")}</tbody></table></div>` : ""}
      ${returnItemsRows.length > 0 ? `<div class="section"><div class="section-title">🔄 RETURNS</div><table><thead><tr><th>Return Number</th><th>Date</th><th>Note</th><th>Amount</th></tr></thead><tbody>${returnItemsRows.join("")}</tbody></table></div>` : ""}
      ${payment.notes ? `<div class="notes-box"><strong>Payment Notes:</strong><br/>${payment.notes}</div>` : ""}

      <div class="footer"><p>Generated on ${formatDateToDMY(new Date())}</p></div>
    </div>
  </body>
</html>`;
  };

  const loadPaymentDetails = async (paymentId) => {
    try {
      const payment = paymentHistory.find((p) => p.id === paymentId);
      if (!payment) return;
      const allBoughtBills = await getBoughtBills();
      const allReturnsRaw = await getReturnsForCompany(payment.companyId);
      const boughtDetails = allBoughtBills
        .filter((bill) => payment.selectedBoughtBills?.includes(bill.id))
        .map((bill) => ({
          ...bill,
          displayAmount: getDisplayAmount(bill.totalAmountUSD || 0, bill.totalAmountIQD || 0),
          billNote: bill.billNote || bill.note || "",
        }));

      const returnGroupMap = new Map();
      allReturnsRaw.forEach((r) => {
        if (!payment.selectedBoughtReturns?.includes(r.id)) return;
        if (!returnGroupMap.has(r.id)) {
          returnGroupMap.set(r.id, { ...r, displayAmount: getDisplayAmount(r.totalReturnUSD || 0, r.totalReturnIQD || 0), returnNote: r.returnNote || r.note || "" });
        }
      });
      setPaymentDetails((prev) => ({ ...prev, [paymentId]: { boughtBills: boughtDetails, returns: Array.from(returnGroupMap.values()) } }));
    } catch (err) {
      console.error("Error loading payment details:", err);
    }
  };

  const resetAdvancedSearch = () =>
    setAdvancedSearch({ companyName: "", hardcopyBillNumber: "", boughtBillNumber: "", returnBillNumber: "", paymentNumber: "", createdBy: "", dateFrom: "", dateTo: "", amountMinUSD: "", amountMaxUSD: "", amountMinIQD: "", amountMaxIQD: "" });

  // --- Header column filters + sorting ---
  const handleUpdateColumnFilter = useCallback((columnKey, updates) => {
    setColumnFilters(prev => {
      const current = prev[columnKey] || { operator: '', textValue: '', selectedValues: [] };
      const next = { ...current, ...updates };
      if (!next.operator && !next.textValue && (!next.selectedValues || next.selectedValues.length === 0)) {
        const newFilters = { ...prev };
        delete newFilters[columnKey];
        return newFilters;
      }
      return { ...prev, [columnKey]: next };
    });
  }, []);

  const clearColumnFilter = useCallback((columnKey) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
  }, []);

  // Works with single values and with arrays (bill / return number lists)
  const evaluateFilter = (itemValue, filterData, type = "string") => {
    if (!filterData) return true;
    const { operator, textValue, selectedValues } = filterData;
    const isArr = Array.isArray(itemValue);

    if (selectedValues && selectedValues.length > 0) {
      if (isArr) {
        if (!itemValue.some((v) => selectedValues.includes(String(v)))) return false;
      } else if (!selectedValues.includes(String(itemValue))) {
        return false;
      }
    }

    if (operator && (textValue !== "" || ['isEmpty', 'isNotEmpty'].includes(operator))) {
      if (isArr && operator === 'isEmpty') return itemValue.length === 0;
      if (isArr && operator === 'isNotEmpty') return itemValue.length > 0;

      const testOne = (single) => {
        const valStr = String(single || '').toLowerCase();
        const searchStr = String(textValue).toLowerCase();
        const valNum = Number(single);
        const searchNum = Number(textValue);

        switch (operator) {
          case 'contains': return valStr.includes(searchStr);
          case 'equals': return type === 'number' ? valNum === searchNum : valStr === searchStr;
          case 'notEquals': return type === 'number' ? valNum !== searchNum : valStr !== searchStr;
          case 'startsWith': return valStr.startsWith(searchStr);
          case 'endsWith': return valStr.endsWith(searchStr);
          case 'greaterThan': return valNum > searchNum;
          case 'greaterThanOrEqual': return valNum >= searchNum;
          case 'lessThan': return valNum < searchNum;
          case 'lessThanOrEqual': return valNum <= searchNum;
          case 'isEmpty': return !single || single === "N/A" || single === "-";
          case 'isNotEmpty': return !!single && single !== "N/A" && single !== "-";
          default: return true;
        }
      };

      return isArr ? itemValue.some(testOne) : testOne(itemValue);
    }
    return true;
  };

  const handleSort = (key) => {
    const newDirection = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction: newDirection });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const sortItems = useCallback((items) => {
    return [...items].sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction;
      const cmpStr = (x, y) => direction === 'asc' ? (x || '').localeCompare(y || '') : (y || '').localeCompare(x || '');
      const cmpNum = (x, y) => direction === 'asc' ? x - y : y - x;

      if (key === 'paymentDate') {
        const dateA = a.paymentDate?.toDate ? a.paymentDate.toDate() : new Date(a.paymentDate || 0);
        const dateB = b.paymentDate?.toDate ? b.paymentDate.toDate() : new Date(b.paymentDate || 0);
        return cmpNum(dateA, dateB);
      } else if (key === 'paymentNumber') {
        return cmpStr(a.paymentNumber, b.paymentNumber);
      } else if (key === 'companyName') {
        return cmpStr(a.companyName, b.companyName);
      } else if (key === 'hardcopyBillNumber') {
        return cmpStr(a.hardcopyBillNumber, b.hardcopyBillNumber);
      } else if (key === 'netAmountUSD') {
        return cmpNum(a.netAmountUSD || 0, b.netAmountUSD || 0);
      } else if (key === 'netAmountIQD') {
        return cmpNum(a.netAmountIQD || 0, b.netAmountIQD || 0);
      } else if (key === 'billNumbers') {
        return cmpNum(a.selectedBoughtBills?.length || 0, b.selectedBoughtBills?.length || 0);
      } else if (key === 'returnNumbers') {
        return cmpNum(a.selectedBoughtReturns?.length || 0, b.selectedBoughtReturns?.length || 0);
      } else if (key === 'notes') {
        return cmpStr((a.notes || '').trim(), (b.notes || '').trim());
      } else if (key === 'createdByName') {
        return cmpStr(getFirstName(a.createdByName), getFirstName(b.createdByName));
      }
      return 0;
    });
  }, [sortConfig, getFirstName]);

  const filteredPayments = useMemo(() => {
    const sorted = sortItems(paymentHistory);

    return sorted.filter((payment) => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const basicMatch =
          payment.paymentNumber?.toLowerCase().includes(s) ||
          payment.companyName?.toLowerCase().includes(s) ||
          getFirstName(payment.createdByName).toLowerCase().includes(s) ||
          payment.hardcopyBillNumber?.toLowerCase().includes(s) ||
          payment.notes?.toLowerCase().includes(s) ||
          String(payment.netAmountUSD || "").includes(s) ||
          String(payment.netAmountIQD || "").includes(s) ||
          getBillNumbers(payment).some((n) => n.toLowerCase().includes(s)) ||
          getReturnNumbers(payment).some((n) => n.toLowerCase().includes(s));
        if (!basicMatch) return false;
      }

      // Quick date range
      if (filters.startDate || filters.endDate) {
        const pDate = payment.paymentDate?.toDate ? payment.paymentDate.toDate() : new Date(payment.paymentDate);
        if (filters.startDate) {
          const start = new Date(filters.startDate);
          start.setHours(0, 0, 0, 0);
          if (pDate < start) return false;
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (pDate > end) return false;
        }
      }

      if (showAdvancedSearch) {
        if (advancedSearch.companyName && !payment.companyName?.toLowerCase().includes(advancedSearch.companyName.toLowerCase())) return false;
        if (advancedSearch.hardcopyBillNumber && !payment.hardcopyBillNumber?.toLowerCase().includes(advancedSearch.hardcopyBillNumber.toLowerCase())) return false;
        if (advancedSearch.paymentNumber && !payment.paymentNumber?.toLowerCase().includes(advancedSearch.paymentNumber.toLowerCase())) return false;
        if (advancedSearch.createdBy) {
          const creatorMatch = (payment.createdByName || "").toLowerCase().includes(advancedSearch.createdBy.toLowerCase()) ||
                               (payment.createdBy || "").toLowerCase() === advancedSearch.createdBy.toLowerCase();
          if (!creatorMatch) return false;
        }
        if (advancedSearch.boughtBillNumber) {
          const searchBill = advancedSearch.boughtBillNumber.toLowerCase();
          const numberMatch = getBillNumbers(payment).some((n) => n.toLowerCase().includes(searchBill));
          const idMatch = payment.selectedBoughtBills?.some((billId) => billId.toLowerCase().includes(searchBill));
          if (!numberMatch && !idMatch) return false;
        }
        if (advancedSearch.returnBillNumber) {
          const searchRet = advancedSearch.returnBillNumber.toLowerCase();
          const numberMatch = getReturnNumbers(payment).some((n) => n.toLowerCase().includes(searchRet));
          const idMatch = payment.selectedBoughtReturns?.some((retId) => retId.toLowerCase().includes(searchRet));
          if (!numberMatch && !idMatch) return false;
        }
        if (advancedSearch.dateFrom || advancedSearch.dateTo) {
          let paymentDateObj;
          if (payment.paymentDate?.toDate) paymentDateObj = payment.paymentDate.toDate();
          else if (payment.paymentDate instanceof Date) paymentDateObj = payment.paymentDate;
          else paymentDateObj = new Date(payment.paymentDate);
          if (advancedSearch.dateFrom) {
            const fromDate = new Date(advancedSearch.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (paymentDateObj < fromDate) return false;
          }
          if (advancedSearch.dateTo) {
            const toDate = new Date(advancedSearch.dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (paymentDateObj > toDate) return false;
          }
        }
        if (advancedSearch.amountMinUSD !== "" && !isNaN(advancedSearch.amountMinUSD) && (payment.netAmountUSD || 0) < Number(advancedSearch.amountMinUSD)) return false;
        if (advancedSearch.amountMaxUSD !== "" && !isNaN(advancedSearch.amountMaxUSD) && (payment.netAmountUSD || 0) > Number(advancedSearch.amountMaxUSD)) return false;
        if (advancedSearch.amountMinIQD !== "" && !isNaN(advancedSearch.amountMinIQD) && (payment.netAmountIQD || 0) < Number(advancedSearch.amountMinIQD)) return false;
        if (advancedSearch.amountMaxIQD !== "" && !isNaN(advancedSearch.amountMaxIQD) && (payment.netAmountIQD || 0) > Number(advancedSearch.amountMaxIQD)) return false;
      }

      // Column Filters Evaluation
      for (const [columnKey, filterData] of Object.entries(columnFilters)) {
        let itemValue = "";
        if (columnKey === 'paymentNumber') itemValue = payment.paymentNumber || '';
        if (columnKey === 'companyName') itemValue = payment.companyName || '';
        if (columnKey === 'paymentDate') itemValue = formatDateToDMY(payment.paymentDate);
        if (columnKey === 'hardcopyBillNumber') itemValue = payment.hardcopyBillNumber || '';
        if (columnKey === 'netAmountUSD') itemValue = payment.netAmountUSD !== undefined ? payment.netAmountUSD : '';
        if (columnKey === 'netAmountIQD') itemValue = payment.netAmountIQD !== undefined ? payment.netAmountIQD : '';
        if (columnKey === 'createdByName') itemValue = getFirstName(payment.createdByName);
        if (columnKey === 'billNumbers') itemValue = getBillNumbers(payment);
        if (columnKey === 'returnNumbers') itemValue = getReturnNumbers(payment);
        if (columnKey === 'notes') itemValue = (payment.notes || '').trim();

        const isNum = ['netAmountUSD', 'netAmountIQD'].includes(columnKey);
        if (!evaluateFilter(itemValue, filterData, isNum ? "number" : "string")) return false;
      }

      return true;
    });
  }, [paymentHistory, sortItems, searchTerm, filters, showAdvancedSearch, advancedSearch, columnFilters, formatDateToDMY, getFirstName, getBillNumbers, getReturnNumbers]);

  // Aggregate values for Table Footer
  const totalNetUSD = useMemo(() => filteredPayments.reduce((sum, p) => sum + (p.netAmountUSD || 0), 0), [filteredPayments]);
  const totalNetIQD = useMemo(() => filteredPayments.reduce((sum, p) => sum + (p.netAmountIQD || 0), 0), [filteredPayments]);

  const formatPaymentNumber = (payment) => {
    if (!payment.paymentNumber) return `BPAY-${formatDateToYMD(new Date()).replace(/-/g, "")}-${payment.id?.slice(-6)}`;
    return payment.paymentNumber;
  };

  const inputStyle = { width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.75rem", fontSize: "0.875rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box", transition: "all 0.2s" };
  const labelStyle = { display: "block", fontSize: "0.8rem", fontWeight: "600", marginBottom: "0.4rem", color: colorScheme.text };

  const getPaymentImage = (payment) => payment.billImageBase64 || payment.billImageUrl || null;

  // Shared props for every table header
  const headerCommon = {
    sortConfig,
    handleSort,
    getSortIcon,
    payments: paymentHistory,
    columnFilters,
    activeFilterDropdown,
    setActiveFilterDropdown,
    handleUpdateColumnFilter,
    clearColumnFilter,
    formatDateToDMY,
    getFirstName,
    getBillNumbers,
    getReturnNumbers,
  };

  if (!user || isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)" }}>
        <div className="modern-spinner"></div>
        <p style={{ marginTop: "1.5rem", color: "#64748b", fontSize: "1.1rem", fontWeight: "500", letterSpacing: "0.5px" }}>Loading data...</p>
        <style dangerouslySetInnerHTML={{__html: `
          .modern-spinner { width: 48px; height: 48px; border-radius: 50%; border: 4px solid #E5E7EB; border-top-color: #8B5CF6; animation: spin 1s linear infinite; }
          @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
        `}} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: "0.5rem", background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)", fontFamily: "var(--font-nrt-reg)", boxSizing: "border-box", overflowX: "hidden" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
        @keyframes shake { 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-6px);} 40%,80%{transform:translateX(6px);} }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
        .modern-spinner-small { width: 32px; height: 32px; border-radius: 50%; border: 3px solid #E5E7EB; border-top-color: #8B5CF6; animation: spin 1s linear infinite; margin: 0 auto; }
        .hardcopy-error-shake { animation: shake 0.4s ease; }
        input:focus, textarea:focus, select:focus { outline: 2px solid #8B5CF6; outline-offset: 1px; }
        .adv-input { width:100%; padding:0.6rem 0.75rem; border:1px solid #D1D5DB; border-radius:0.6rem; font-size:0.8rem; font-family:inherit; box-sizing:border-box; }
        .adv-input:focus { outline:2px solid #8B5CF6; }
        .img-btn-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        @media (max-width: 480px) { .img-btn-row { flex-direction: column; } }
        .note-cell {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
          line-height: 1.35;
          font-size: 0.82rem;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "0.25rem", fontFamily: "var(--font-nrt-bd)" }}>
          {isEditMode ? "✏️ Update Bought Payment" : "💼 Bought Payment Management"}
        </h1>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEF2F2", border: `1px solid ${colorScheme.danger}`, borderRadius: "0.75rem", marginBottom: "1rem" }}>
          <p style={{ color: colorScheme.danger, margin: 0, fontWeight: "500" }}>❌ {error}</p>
        </div>
      )}
      {success && (
        <div style={{ padding: "1rem", backgroundColor: "#F0FDF4", border: `1px solid ${colorScheme.success}`, borderRadius: "0.75rem", marginBottom: "1rem" }}>
          <p style={{ color: colorScheme.success, margin: 0, fontWeight: "500" }}>✅ {success}</p>
        </div>
      )}

      {/* Consignment Warning Banner */}
      {consignmentWarnings.length > 0 && (
        <div style={{ padding: "1rem", backgroundColor: "#FFF7ED", border: "2px solid #F59E0B", borderRadius: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: "600", color: "#92400E", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Consignment Warning — Optional but important!</div>
              {consignmentWarnings.map((w, i) => (
                <div key={i} style={{ color: "#B45309", fontSize: "0.85rem", marginBottom: "0.25rem" }}>• {w.message}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>

        {/* Company Information */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "1.25rem", paddingBottom: "0.6rem", borderBottom: `2px solid ${colorScheme.primary}`, color: colorScheme.text }}>
            🏢 Company Information
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>

            {/* React Select Dropdown Component */}
            <div style={{ position: "relative", zIndex: 50 }}>
              <label style={labelStyle}>Select Company *</label>
              <Select
                options={companies.map(c => ({ value: c.id, label: `${c.name} ${c.code ? `(${c.code})` : ''}`, company: c }))}
                onChange={(selected) => handleSelectCompany(selected ? selected.company : null)}
                value={selectedCompany ? { value: selectedCompany, label: companySearchTerm } : null}
                placeholder="Search company..."
                isClearable
                isSearchable
                styles={{
                  control: (base, state) => ({
                    ...base,
                    borderRadius: '0.75rem',
                    padding: '0.2rem',
                    borderColor: state.isFocused ? colorScheme.primary : '#D1D5DB',
                    boxShadow: state.isFocused ? `0 0 0 3px ${colorScheme.primary}20` : 'none',
                    '&:hover': { borderColor: colorScheme.primary }
                  })
                }}
              />
            </div>

            {/* Hardcopy Bill Number */}
            <div>
              <label style={labelStyle}>Hardcopy Bill Number *</label>
              <input ref={hardcopyBillNumberRef} type="text" value={hardcopyBillNumber}
                onChange={(e) => { setHardcopyBillNumber(e.target.value); if (e.target.value.trim()) setHardcopyBillError(false); }}
                className={hardcopyBillError ? "hardcopy-error-shake" : ""}
                style={{ ...inputStyle, border: hardcopyBillError ? "2px solid #EF4444" : "1px solid #D1D5DB", boxShadow: hardcopyBillError ? "0 0 0 3px rgba(239,68,68,0.15)" : undefined }}
                placeholder="Enter hardcopy bill number" />
              {hardcopyBillError && (
                <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.75rem", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#DC2626", fontWeight: "600" }}>
                  ⚠️ Hardcopy Bill Number is required.
                </div>
              )}
            </div>

            {/* Payment Date */}
            <div>
              <label style={labelStyle}>Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Bill Image Section */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "1.25rem", paddingBottom: "0.6rem", borderBottom: `2px solid ${colorScheme.primary}`, color: colorScheme.text }}>
            📷 Bill Image
          </h2>

          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
          <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleCameraChange} style={{ display: "none" }} />

          <div style={{ display: "grid", gridTemplateColumns: billImageData ? "1fr auto" : "1fr", gap: "1.5rem", alignItems: "start" }}>
            <div>
              <label style={labelStyle}>Upload Bill Image (Optional)</label>

              <div className="img-btn-row">
                <button type="button" onClick={triggerFileInput} disabled={imageProcessing}
                  style={{ flex: 1, padding: "0.75rem", backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: "600", cursor: imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s", textAlign: "center" }}
                  onMouseEnter={e => { if (!imageProcessing) e.currentTarget.style.background = "#E5E7EB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#F3F4F6"; }}>
                  {imageProcessing ? "⏳ Processing..." : "📁 Choose from Gallery"}
                </button>

                <button type="button" onClick={triggerCameraInput} disabled={imageProcessing}
                  style={{ flex: 1, padding: "0.75rem", backgroundColor: "#EDE9FE", color: "#5B21B6", border: "1px solid #C4B5FD", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: "600", cursor: imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s", textAlign: "center" }}
                  onMouseEnter={e => { if (!imageProcessing) e.currentTarget.style.background = "#DDD6FE"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#EDE9FE"; }}>
                  📷 Take Photo
                </button>
              </div>

              {imageProcessing && (
                <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.75rem", backgroundColor: "#EDE9FE", border: "1px solid #C4B5FD", borderRadius: "0.5rem", fontSize: "0.8rem", color: "#5B21B6", fontWeight: "600", animation: "pulse 1.5s infinite" }}>
                  ⚙️ Converting to grayscale...
                </div>
              )}

              {billImageData && !imageProcessing && (
                <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.75rem", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#166534", fontWeight: "600" }}>
                  ✅ Image ready — will be saved with payment
                </div>
              )}

              {!billImageData && !imageProcessing && isEditMode && (
                <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.75rem", backgroundColor: imageHasChanged ? "#FEF3C7" : "#F3F4F6", border: `1px solid ${imageHasChanged ? "#FDE68A" : "#E5E7EB"}`, borderRadius: "0.5rem", fontSize: "0.78rem", color: imageHasChanged ? "#92400E" : colorScheme.textLight, fontWeight: "600" }}>
                  {imageHasChanged ? "ℹ️ Image removed — will be cleared on save" : "ℹ️ Keeping original image (upload new or take photo to replace)"}
                </div>
              )}
            </div>

            {billImageData && !imageProcessing && (
              <div style={{ textAlign: "center", padding: "0.5rem", border: "1px dashed #D1D5DB", borderRadius: "0.75rem", background: "#F9FAFB" }}>
                <p style={{ fontSize: "0.7rem", color: colorScheme.textLight, marginBottom: "0.4rem", fontWeight: "600", textTransform: "uppercase" }}>Preview</p>
                <img src={billImageData} alt="Bill Preview" style={{ width: "90px", height: "90px", objectFit: "cover", borderRadius: "0.5rem", border: "1px solid #E5E7EB", cursor: "pointer", filter: "grayscale(100%)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} onClick={() => handleViewImage(billImageData)} />
                <button type="button" onClick={removeImage} style={{ display: "block", margin: "0.5rem auto 0", padding: "0.3rem 0.6rem", fontSize: "0.7rem", color: "white", background: "#EF4444", border: "none", borderRadius: "0.25rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "600" }}>✕ Remove</button>
              </div>
            )}
          </div>
        </div>

        {/* Bills & Returns Sections (100% width) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
          {/* Bought Bills */}
          <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`, padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: "bold", color: "white", margin: 0 }}>📦 Bought Bills ({boughtBills.length})</h2>
                {!isEditMode && boughtBills.length > 0 && (
                  <button onClick={selectAllBoughtBills} style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", padding: "0.4rem 0.9rem", borderRadius: "0.6rem", border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", fontWeight: "600" }}>
                    {selectedBoughtBills.length === boughtBills.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {selectedBoughtBills.length > 0 && <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#DDD6FE", fontWeight: "600" }}>{selectedBoughtBills.length} selected</div>}
            </div>
            <div style={{ padding: "1rem", maxHeight: "500px", overflowY: "auto", background: "#F8FAFC" }}>
              {loading ? (
                <div style={{ padding: "3rem", textAlign: "center" }}>
                   <div className="modern-spinner-small"></div>
                   <p style={{ marginTop: "1rem", color: "#94a3b8", fontSize: "0.9rem" }}>Fetching records...</p>
                </div>
              ) : boughtBills.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>{selectedCompany ? "No unpaid bills available" : "Select a company first"}</div>
              ) : (
                boughtBills.map((bill) => {
                  const billCurrency = bill.currency || "USD";
                  const isSelected = selectedBoughtBills.includes(bill.id);
                  const billAmount = billCurrency === "USD" ? bill.totalAmountUSD || 0 : bill.totalAmountIQD || 0;
                  const billNote = bill.billNote || bill.note || "";
                  const isConsignment = bill.isConsignment;
                  return (
                    <div key={bill.id} onClick={() => toggleBoughtBill(bill.id)}
                      style={{ padding: "0.85rem", marginBottom: "0.6rem", border: isSelected ? `2px solid ${colorScheme.primary}` : isConsignment ? "1px dashed #F59E0B" : "1px solid #E5E7EB", backgroundColor: isSelected ? "#F5F3FF" : isConsignment ? "#FFFBEB" : "white", borderRadius: "0.75rem", cursor: "pointer", transition: "all 0.2s ease", boxShadow: isSelected ? "0 4px 6px -1px rgba(139, 92, 246, 0.1)" : "0 1px 2px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: "600", fontSize: "0.875rem", color: isSelected ? colorScheme.dark : colorScheme.text }}>Bill #{bill.billNumber}</span>
                            {isConsignment && <span style={{ backgroundColor: "#FEF3C7", color: "#92400E", fontSize: "0.65rem", fontWeight: "700", padding: "2px 6px", borderRadius: "999px", border: "1px solid #FCD34D", whiteSpace: "nowrap" }}>⚠️ CONSIGNED</span>}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: colorScheme.textLight, marginTop: "0.3rem" }}>
                            {formatDateToDMY(bill.date)}
                            {bill.items?.length > 0 && <span style={{ marginLeft: "0.5rem" }}>• {bill.items.length} item{bill.items.length !== 1 ? "s" : ""}</span>}
                          </div>
                          {billNote && <div style={{ fontSize: "0.7rem", color: "#6B7280", marginTop: "0.3rem", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {billNote}</div>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem", marginLeft: "0.5rem" }}>
                          <div style={{ fontWeight: "bold", color: billCurrency === "USD" ? "#059669" : "#2563eb", fontSize: "0.95rem", textAlign: "right", whiteSpace: "nowrap", padding: "0.25rem 0.5rem", background: billCurrency === "USD" ? "#ECFDF5" : "#DBEAFE", borderRadius: "0.5rem" }}>
                            {billCurrency === "USD" ? formatUSD(billAmount) : formatCurrency(billAmount)}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ fontSize: "0.7rem", color: colorScheme.textLight, fontWeight: "600" }}>
                              Currency: <span style={{ color: billCurrency === "USD" ? "#059669" : "#2563eb" }}>{billCurrency}</span>
                            </div>
                            <button onClick={(e) => viewBoughtBillDetails(e, bill)}
                              style={{ padding: "0.3rem 0.75rem", background: "#4B5563", color: "white", borderRadius: "0.5rem", border: "none", fontSize: "0.7rem", cursor: "pointer", fontWeight: "600", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                              👁️ View Items
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Returns */}
          <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
            <div style={{ background: `linear-gradient(135deg, ${colorScheme.secondary} 0%, #0891B2 100%)`, padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: "bold", color: "white", margin: 0 }}>🔄 Returns ({returns.length})</h2>
                {!isEditMode && returns.length > 0 && (
                  <button onClick={selectAllBoughtReturns} style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", padding: "0.4rem 0.9rem", borderRadius: "0.6rem", border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", fontWeight: "600" }}>
                    {selectedBoughtReturns.length === returns.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {selectedBoughtReturns.length > 0 && <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#CFFAFE", fontWeight: "600" }}>{selectedBoughtReturns.length} selected</div>}
            </div>
            <div style={{ padding: "1rem", maxHeight: "500px", overflowY: "auto", background: "#F8FAFC" }}>
              {loading ? (
                <div style={{ padding: "3rem", textAlign: "center" }}>
                   <div className="modern-spinner-small"></div>
                   <p style={{ marginTop: "1rem", color: "#94a3b8", fontSize: "0.9rem" }}>Fetching records...</p>
                </div>
              ) : returns.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>{selectedCompany ? "No unprocessed returns available" : "Select a company first"}</div>
              ) : (
                returns.map((returnBill) => {
                  const isSelected = selectedBoughtReturns.includes(returnBill.id);
                  const returnCurrency = returnBill.currency || "USD";
                  let returnTotal = 0;
                  if (returnBill.items && returnBill.items.length > 0) {
                    returnBill.items.forEach((item) => { returnTotal += (item.returnPrice || 0) * (item.returnQuantity || 0); });
                  } else {
                    returnTotal = (returnBill.returnPrice || 0) * (returnBill.returnQuantity || 0);
                  }
                  const retNote = returnBill.returnNote || returnBill.note || "";
                  return (
                    <div key={returnBill.id} onClick={() => toggleBoughtReturn(returnBill.id)}
                      style={{ padding: "0.85rem", marginBottom: "0.6rem", border: isSelected ? `2px solid ${colorScheme.secondary}` : "1px solid #E5E7EB", backgroundColor: isSelected ? "#ECFEFF" : "white", borderRadius: "0.75rem", cursor: "pointer", transition: "all 0.2s ease", boxShadow: isSelected ? "0 4px 6px -1px rgba(6, 182, 212, 0.1)" : "0 1px 2px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: "600", fontSize: "0.875rem", color: isSelected ? "#0891B2" : colorScheme.text }}>Return #{returnBill.returnBillNumber || returnBill.id?.slice(-6)}</div>
                          <div style={{ fontSize: "0.75rem", color: colorScheme.textLight, marginTop: "0.3rem" }}>
                            {formatDateToDMY(returnBill.returnDate || returnBill.date)}
                            {returnBill.items?.length > 0 && <span style={{ marginLeft: "0.5rem" }}>• {returnBill.items.length} item{returnBill.items.length !== 1 ? "s" : ""}</span>}
                          </div>
                          {retNote && <div style={{ fontSize: "0.7rem", color: "#6B7280", marginTop: "0.3rem", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {retNote}</div>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem", marginLeft: "0.5rem" }}>
                          <div style={{ fontWeight: "bold", color: returnCurrency === "USD" ? "#dc2626" : "#b91c1c", fontSize: "0.95rem", textAlign: "right", whiteSpace: "nowrap", padding: "0.25rem 0.5rem", background: "#FEF2F2", borderRadius: "0.5rem" }}>
                            -{returnCurrency === "USD" ? formatUSD(returnTotal) : formatCurrency(returnTotal)}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ fontSize: "0.7rem", color: colorScheme.textLight, fontWeight: "600" }}>
                              Currency: <span style={{ color: returnCurrency === "USD" ? "#dc2626" : "#b91c1c" }}>{returnCurrency}</span>
                            </div>
                            <button onClick={(e) => viewReturnDetails(e, returnBill)}
                              style={{ padding: "0.3rem 0.75rem", background: "#4B5563", color: "white", borderRadius: "0.5rem", border: "none", fontSize: "0.7rem", cursor: "pointer", fontWeight: "600", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                              👁️ View Items
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* BEAUTIFUL PAYMENT SUMMARY SECTION */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1rem", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: `2px solid ${colorScheme.secondary}`, color: colorScheme.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>💰</span> Payment Summary
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.25rem", alignItems: "stretch" }}>

            {/* Total Bought Card */}
            <div style={{ padding: "1rem", backgroundColor: "white", borderRadius: "1rem", border: "1px solid #A7F3D0", boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ background: "#D1FAE5", padding: "0.4rem", borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "1rem" }}>📦</span></div>
                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Bought</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                {currencyTotals.boughtUSD > 0 && <div style={{ color: "#059669", fontWeight: "700", fontSize: "1.15rem" }}>+{formatUSD(currencyTotals.boughtUSD)}</div>}
                {currencyTotals.boughtIQD > 0 && <div style={{ color: "#2563eb", fontWeight: "700", fontSize: "1.15rem" }}>+{formatCurrency(currencyTotals.boughtIQD)}</div>}
                {currencyTotals.boughtUSD === 0 && currencyTotals.boughtIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "1.1rem", fontWeight: "600" }}>$0.00</div>}
              </div>
            </div>

            {/* Total Return Card */}
            <div style={{ padding: "1rem", backgroundColor: "white", borderRadius: "1rem", border: "1px solid #FECACA", boxShadow: "0 4px 6px -1px rgba(239, 68, 68, 0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ background: "#FEE2E2", padding: "0.4rem", borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "1rem" }}>🔄</span></div>
                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Return</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                {currencyTotals.returnUSD > 0 && <div style={{ color: "#dc2626", fontWeight: "700", fontSize: "1.15rem" }}>−{formatUSD(currencyTotals.returnUSD)}</div>}
                {currencyTotals.returnIQD > 0 && <div style={{ color: "#b91c1c", fontWeight: "700", fontSize: "1.15rem" }}>−{formatCurrency(currencyTotals.returnIQD)}</div>}
                {currencyTotals.returnUSD === 0 && currencyTotals.returnIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "1.1rem", fontWeight: "600" }}>$0.00</div>}
              </div>
            </div>

            {/* Net Amount Card */}
            <div style={{ padding: "1rem", background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", borderRadius: "1rem", border: "none", boxShadow: "0 10px 15px -3px rgba(124, 58, 237, 0.3)", color: "white", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ background: "rgba(255,255,255,0.2)", padding: "0.4rem", borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: "1rem" }}>💰</span></div>
                <div style={{ fontSize: "0.8rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#E0E7FF" }}>Net Amount</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                {currencyTotals.netUSD !== 0 && <div style={{ fontWeight: "700", fontSize: "1.25rem", color: "white" }}>{currencyTotals.netUSD > 0 ? "+" : ""}{formatUSD(currencyTotals.netUSD)}</div>}
                {currencyTotals.netIQD !== 0 && <div style={{ fontWeight: "700", fontSize: "1.25rem", color: "#FDE047" }}>{currencyTotals.netIQD > 0 ? "+" : ""}{formatCurrency(currencyTotals.netIQD)}</div>}
                {currencyTotals.netUSD === 0 && currencyTotals.netIQD === 0 && <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "1.25rem", fontWeight: "600" }}>$0.00</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: `2px solid ${colorScheme.light}`, color: colorScheme.text }}>📝 Payment Notes</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }} placeholder="Add notes about this payment..." />
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {isEditMode && (
            <button onClick={handleCancelEdit} disabled={submitting}
              style={{ flex: "1 1 120px", padding: "1rem", backgroundColor: colorScheme.textLight, color: "white", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem", fontWeight: "600", transition: "background 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#4B5563"}
              onMouseLeave={e => e.currentTarget.style.background = colorScheme.textLight}
            >
              ✕ Cancel
            </button>
          )}
          <button onClick={handleSubmit} disabled={submitting || imageProcessing}
            style={{ flex: "2 1 200px", padding: "1rem", background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)", color: "white", border: "none", borderRadius: "0.75rem", cursor: submitting || imageProcessing ? "not-allowed" : "pointer", opacity: submitting || imageProcessing ? 0.8 : 1, fontFamily: "inherit", fontSize: "1.05rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", boxShadow: "0 10px 15px -3px rgba(67, 56, 202, 0.4), 0 4px 6px -2px rgba(67, 56, 202, 0.2)", transition: "transform 0.1s" }}
            onMouseDown={e => { if(!submitting && !imageProcessing) e.currentTarget.style.transform = "scale(0.98)" }}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            {imageProcessing ? "⚙️ Processing image..." : submitting ? "⏳ Saving..." : isEditMode ? (imageHasChanged ? "✏️ Update Payment (Image Changed)" : "✏️ Update Payment") : "✅ Confirm & Save Payment"}
          </button>
        </div>
      </div>

      {/* Payment History Table Section */}
      <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", overflow: "hidden", width: "100%" }}>
        <div style={{ background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`, padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "white", margin: 0 }}>📋 Bought Payment History</h2>
          {paymentHistory.length > 0 && <div style={{ fontSize: "0.8rem", color: "#DDD6FE", marginTop: "0.25rem" }}>{filteredPayments.length} of {paymentHistory.length} payments</div>}
        </div>

        <div style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>

            <div style={{ flex: "2 1 220px", position: "relative" }}>
               <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>🔍</span>
               <input type="text" placeholder="Quick search: company, payment #, hardcopy, bill #, notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                 style={{ ...inputStyle, paddingLeft: "35px" }} />
            </div>

            <div style={{ flex: "1 1 150px" }}>
              <input type="date" title="From date" style={inputStyle} value={filters.startDate} onChange={(e) => handleFilterChange("startDate", e.target.value)} />
            </div>

            <div style={{ flex: "1 1 150px" }}>
              <input type="date" title="To date" style={inputStyle} value={filters.endDate} onChange={(e) => handleFilterChange("endDate", e.target.value)} />
            </div>

            {(filters.startDate || filters.endDate) && (
              <button onClick={() => setFilters({ startDate: "", endDate: "" })} style={{ padding: "0.75rem 1rem", height: "42px", backgroundColor: "#E5E7EB", color: "#374151", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap" }}>
                ✕ Clear Dates
              </button>
            )}

            {Object.keys(columnFilters).length > 0 && (
              <button onClick={() => setColumnFilters({})}
                style={{ padding: "0.75rem 1rem", height: "42px", backgroundColor: "#fee2e2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap" }}>
                ✕ Clear Header Filters
              </button>
            )}

            <button onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} style={{ padding: "0.75rem 1.25rem", height: "42px", backgroundColor: showAdvancedSearch ? colorScheme.primary : colorScheme.textLight, color: "white", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap" }}>
               {showAdvancedSearch ? "▲ Hide Advanced" : "▼ Advanced Search"}
            </button>
          </div>

          {showAdvancedSearch && (
            <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <span style={{ fontWeight: "700", fontSize: "0.9rem", color: colorScheme.text }}>🔍 Advanced Search Filters</span>
                <button onClick={resetAdvancedSearch} style={{ padding: "0.35rem 0.9rem", backgroundColor: "#E5E7EB", color: "#374151", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: "600" }}>✕ Clear All</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🏢 Company Name</label>
                  <input className="adv-input" type="text" placeholder="e.g. Aran" value={advancedSearch.companyName} onChange={e => setAdvancedSearch(p => ({ ...p, companyName: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🔖 Payment Number</label>
                  <input className="adv-input" type="text" placeholder="e.g. BPAY-2026-..." value={advancedSearch.paymentNumber} onChange={e => setAdvancedSearch(p => ({ ...p, paymentNumber: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📋 Hardcopy Bill Number</label>
                  <input className="adv-input" type="text" placeholder="Hardcopy bill #" value={advancedSearch.hardcopyBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, hardcopyBillNumber: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>👤 Created By (Creator)</label>
                  <select
                    className="adv-input"
                    value={advancedSearch.createdBy}
                    onChange={e => setAdvancedSearch(p => ({ ...p, createdBy: e.target.value }))}
                  >
                    <option value="">All Creators</option>
                    {uniqueCreators.map((creator) => (
                      <option key={creator} value={creator}>
                        {creator}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📦 Bought Bill Number</label>
                  <input className="adv-input" type="text" placeholder="Bill number" value={advancedSearch.boughtBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, boughtBillNumber: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🔄 Return Bill Number</label>
                  <input className="adv-input" type="text" placeholder="Return number" value={advancedSearch.returnBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, returnBillNumber: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📅 Payment Date — From</label>
                  <input className="adv-input" type="date" value={advancedSearch.dateFrom} onChange={e => setAdvancedSearch(p => ({ ...p, dateFrom: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📅 Payment Date — To</label>
                  <input className="adv-input" type="date" value={advancedSearch.dateTo} onChange={e => setAdvancedSearch(p => ({ ...p, dateTo: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>💵 Net Amount USD — Range</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#059669", fontWeight: "700", fontSize: "0.85rem" }}>$</span>
                      <input className="adv-input" type="number" placeholder="Min USD" style={{ paddingLeft: "1.5rem" }} value={advancedSearch.amountMinUSD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMinUSD: e.target.value }))} />
                    </div>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#059669", fontWeight: "700", fontSize: "0.85rem" }}>$</span>
                      <input className="adv-input" type="number" placeholder="Max USD" style={{ paddingLeft: "1.5rem" }} value={advancedSearch.amountMaxUSD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMaxUSD: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🇮🇶 Net Amount IQD — Range</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#2563eb", fontWeight: "600", fontSize: "0.7rem" }}>IQD</span>
                      <input className="adv-input" type="number" placeholder="Min IQD" style={{ paddingRight: "3rem" }} value={advancedSearch.amountMinIQD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMinIQD: e.target.value }))} />
                    </div>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#2563eb", fontWeight: "600", fontSize: "0.7rem" }}>IQD</span>
                      <input className="adv-input" type="number" placeholder="Max IQD" style={{ paddingRight: "3rem" }} value={advancedSearch.amountMaxIQD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMaxIQD: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>
              {Object.values(advancedSearch).some(v => v !== "") && (
                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", backgroundColor: "#EDE9FE", borderRadius: "0.5rem", fontSize: "0.78rem", color: colorScheme.dark, fontWeight: "600" }}>
                  ✓ {Object.values(advancedSearch).filter(v => v !== "").length} filter{Object.values(advancedSearch).filter(v => v !== "").length !== 1 ? "s" : ""} active — {filteredPayments.length} result{filteredPayments.length !== 1 ? "s" : ""} found
                </div>
              )}
            </div>
          )}

          {/* Interactive Data Table with Filters */}
          <div style={{ width: "100%", overflowX: "auto", overflowY: "auto", maxHeight: "70vh", border: "1px solid #E5E7EB", borderRadius: "0.75rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1650px" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr>
                  <TableHeader title="Payment #" columnKey="paymentNumber" colWidth="160px" alignLeft={true} {...headerCommon} />
                  <TableHeader title="Company Name" columnKey="companyName" colWidth="auto" {...headerCommon} />
                  <TableHeader title="Hardcopy #" columnKey="hardcopyBillNumber" colWidth="130px" {...headerCommon} />
                  <TableHeader title="Date" columnKey="paymentDate" colWidth="120px" {...headerCommon} />
                  <TableHeader title="Net Paid (USD)" columnKey="netAmountUSD" type="number" colWidth="140px" {...headerCommon} />
                  <TableHeader title="Net Paid (IQD)" columnKey="netAmountIQD" type="number" colWidth="150px" {...headerCommon} />
                  <TableHeader title="Bills" columnKey="billNumbers" colWidth="190px" {...headerCommon} />
                  <TableHeader title="Returns" columnKey="returnNumbers" colWidth="190px" {...headerCommon} />
                  <TableHeader title="Notes" columnKey="notes" colWidth="220px" {...headerCommon} />
                  <TableHeader title="Created By" columnKey="createdByName" colWidth="120px" {...headerCommon} />
                  <th style={{ backgroundColor: "#34495e", color: "white", padding: "12px 10px", textAlign: "center", width: "200px", fontSize: "14px", fontFamily: "var(--font-nrt-bd)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>
                      <div className="modern-spinner-small"></div>
                      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>Loading payment history...</p>
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>
                      {paymentHistory.length === 0 ? "No payments recorded yet" : "No payments match your filters"}
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment, idx) => {
                    const displayNumber = formatPaymentNumber(payment);
                    const paymentImage = getPaymentImage(payment);
                    const netUSD = payment.netAmountUSD || 0;
                    const netIQD = payment.netAmountIQD || 0;
                    const paymentNote = (payment.notes || "").trim();

                    return (
                      <tr key={payment.id || idx} style={{ borderBottom: "1px solid #E5E7EB", backgroundColor: idx % 2 === 0 ? "white" : "#F9FAFB" }}>
                        <td style={{ padding: "12px 10px", fontWeight: "600", color: "#5B21B6", borderRight: "1px solid #E5E7EB" }}>
                          {displayNumber}
                        </td>
                        <td style={{ padding: "12px 10px", fontWeight: "500", color: colorScheme.text, borderRight: "1px solid #E5E7EB" }}>
                          {payment.companyName || "—"}
                        </td>
                        <td style={{ padding: "12px 10px", color: colorScheme.textLight, borderRight: "1px solid #E5E7EB" }}>
                          {payment.hardcopyBillNumber || "—"}
                        </td>
                        <td style={{ padding: "12px 10px", color: colorScheme.textLight, borderRight: "1px solid #E5E7EB" }}>
                          {formatDateToDMY(payment.paymentDate)}
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: "700", color: netUSD >= 0 ? "#059669" : "#DC2626", borderRight: "1px solid #E5E7EB" }}>
                          {netUSD !== 0 ? (netUSD > 0 ? `+${formatUSD(netUSD)}` : formatUSD(netUSD)) : "—"}
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: "700", color: netIQD >= 0 ? "#2563EB" : "#DC2626", borderRight: "1px solid #E5E7EB" }}>
                          {netIQD !== 0 ? (netIQD > 0 ? `+${formatCurrency(netIQD)}` : formatCurrency(netIQD)) : "—"}
                        </td>
                        <td style={{ padding: "10px", textAlign: "left", verticalAlign: "middle", borderRight: "1px solid #E5E7EB" }}>
                          <NumberBubbles numbers={getBillNumbers(payment)} palette={BILL_COLORS} />
                        </td>
                        <td style={{ padding: "10px", textAlign: "left", verticalAlign: "middle", borderRight: "1px solid #E5E7EB" }}>
                          <NumberBubbles numbers={getReturnNumbers(payment)} palette={RETURN_COLORS} />
                        </td>
                        <td style={{ padding: "10px", textAlign: "left", verticalAlign: "middle", color: colorScheme.textLight, borderRight: "1px solid #E5E7EB", maxWidth: "220px" }}>
                          {paymentNote ? (
                            <div className="note-cell" title={paymentNote}>{paymentNote}</div>
                          ) : (
                            <span style={{ color: "#9CA3AF" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 10px", color: colorScheme.textLight, borderRight: "1px solid #E5E7EB" }}>
                          {getFirstName(payment.createdByName)}
                        </td>
                        <td style={{ padding: "12px 10px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
                            <button onClick={() => handleViewPayment(payment)}
                              style={{ padding: "0.3rem 0.5rem", backgroundColor: "#6B7280", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", fontSize: "0.72rem" }} title="View Statement">
                              👁️
                            </button>
                            <button onClick={() => handlePrintPayment(payment)}
                              style={{ padding: "0.3rem 0.5rem", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", fontSize: "0.72rem" }} title="Print Receipt">
                              🖨️
                            </button>
                            {paymentImage ? (
                              <button onClick={() => handleViewImage(paymentImage, payment)}
                                style={{ padding: "0.3rem 0.5rem", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", fontSize: "0.72rem" }} title="View Attached Image">
                                🖼️
                              </button>
                            ) : (
                              <button onClick={() => handleOpenAttachModal(payment)}
                                style={{ padding: "0.3rem 0.6rem", backgroundColor: "#dcfce7", color: "#15803d", border: "1px solid #86efac", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "700", fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "2px" }} title="Attach Bill Image">
                                <Paperclip size={12} /> Attach
                              </button>
                            )}
                            <button onClick={() => handleUpdatePayment(payment)}
                              style={{ padding: "0.3rem 0.5rem", backgroundColor: "#06B6D4", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", fontSize: "0.72rem" }} title="Edit Payment">
                              ✏️
                            </button>
                            <button onClick={() => handleDeletePayment(payment.id)}
                              style={{ padding: "0.3rem 0.5rem", backgroundColor: "#EF4444", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", fontSize: "0.72rem" }} title="Delete Payment">
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot style={{ position: "sticky", bottom: 0, zIndex: 1 }}>
                <tr style={{ backgroundColor: "#F8FAFC", borderTop: "2px solid #E5E7EB", fontWeight: "700" }}>
                  <td colSpan={4} style={{ padding: "12px 10px", textAlign: "right", color: colorScheme.text, borderRight: "1px solid #E5E7EB" }}>
                    Filtered Totals:
                  </td>
                  <td style={{ padding: "12px 10px", textAlign: "right", color: totalNetUSD >= 0 ? "#059669" : "#DC2626", borderRight: "1px solid #E5E7EB" }}>
                    {formatUSD(totalNetUSD)}
                  </td>
                  <td style={{ padding: "12px 10px", textAlign: "right", color: totalNetIQD >= 0 ? "#2563EB" : "#DC2626", borderRight: "1px solid #E5E7EB" }}>
                    {formatCurrency(totalNetIQD)}
                  </td>
                  <td colSpan={5} style={{ padding: "12px 10px", color: colorScheme.textLight }}>
                    {filteredPayments.length} payments found
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL FOR UNPAID BILLS */}
      {showDetailModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500, padding: "1rem", backdropFilter: "blur(4px)" }} onClick={() => setShowDetailModal(false)}>
          <div style={{ width: "100%", maxWidth: "600px", maxHeight: "85vh", display: "flex", flexDirection: "column", background: "white", borderRadius: "1.25rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", color: colorScheme.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                 {detailData.type === "bought" ? "📦" : "🔄"} {detailData.title}
              </h2>
              <button onClick={() => setShowDetailModal(false)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: colorScheme.textLight }}>✕</button>
            </div>
            <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
              {detailData.items && detailData.items.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", color: colorScheme.textLight }}>Item</th>
                      <th style={{ padding: "10px 12px", textAlign: "center", color: colorScheme.textLight }}>Qty</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", color: colorScheme.textLight }}>Price</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", color: colorScheme.textLight }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.items.map((item, idx) => {
                      const price = detailData.type === "bought" ? (item.basePrice || item.price || 0) : (item.returnPrice || 0);
                      const qty = detailData.type === "bought" ? (item.quantity || 1) : (item.returnQuantity || 0);
                      const total = price * qty;
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #F3F4F6" }}>
                          <td style={{ padding: "10px 12px", fontWeight: "500", color: colorScheme.text }}>{item.name} <br/><span style={{fontSize: "0.7rem", color: colorScheme.textLight}}>{item.barcode}</span></td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>{qty}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>{detailData.currency === "USD" ? formatUSD(price) : formatCurrency(price)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600", color: detailData.type === "bought" ? "#059669" : "#DC2626" }}>{detailData.currency === "USD" ? formatUSD(total) : formatCurrency(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", color: colorScheme.textLight, padding: "2rem" }}>No items detailed for this record.</div>
              )}
              {detailData.note && (
                <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#F3F4F6", borderRadius: "0.5rem", fontSize: "0.8rem", fontStyle: "italic", color: colorScheme.textLight }}>
                  📝 Note: {detailData.note}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BEAUTIFUL STATEMENT MODAL (Payment History) */}
      {showPaymentModal && selectedPayment && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", overflowY: "auto", backdropFilter: "blur(4px)" }} onClick={closePaymentModal}>
          <div style={{ width: "100%", maxWidth: "1000px", maxHeight: "90vh", display: "flex", flexDirection: "column", background: "white", borderRadius: "1.25rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div style={{ background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`, padding: "1.25rem 1.5rem", borderRadius: "1.25rem 1.25rem 0 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ color: "white", margin: 0, fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>📑</span> Payment Statement
                </h2>
                <div style={{ color: "#E0E7FF", fontSize: "0.85rem", marginTop: "0.2rem", fontWeight: "500", letterSpacing: "0.05em" }}>{formatPaymentNumber(selectedPayment)}</div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => handlePrintPayment(selectedPayment)} style={{ background: "white", border: "none", color: colorScheme.dark, fontSize: "0.8rem", cursor: "pointer", borderRadius: "0.5rem", padding: "0.4rem 1rem", fontWeight: "700", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>🖨️ Print</button>
                <button onClick={closePaymentModal} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", fontSize: "1.25rem", cursor: "pointer", borderRadius: "0.5rem", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.3)"} onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.2)"}>✕</button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>

              {/* Top Info Header */}
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem", paddingBottom: "1.25rem", borderBottom: "1px solid #E5E7EB" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Bill To</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: "700", color: colorScheme.text }}>{selectedPayment.companyName}</div>
                  <div style={{ fontSize: "0.8rem", color: colorScheme.textLight, marginTop: "0.25rem" }}>Hardcopy: <span style={{ fontWeight: "600", color: colorScheme.text }}>{selectedPayment.hardcopyBillNumber}</span></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Payment Details</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: "600", color: colorScheme.text }}>{formatDateToDMY(selectedPayment.paymentDate)}</div>
                  <div style={{ fontSize: "0.8rem", color: colorScheme.textLight, marginTop: "0.25rem" }}>Processed by: {getFirstName(selectedPayment.createdByName)}</div>
                </div>
              </div>

              {/* Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                {/* Bought */}
                <div style={{ background: "#F0FDF4", border: "1px solid #A7F3D0", borderRadius: "1rem", padding: "1rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>📦 Total Bought</div>
                  {(() => {
                    const bUSD = selectedPayment.boughtTotalUSD || 0;
                    const bIQD = selectedPayment.boughtTotalIQD || 0;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        {bUSD > 0 && <div style={{ color: "#059669", fontWeight: "700", fontSize: "1.1rem" }}>+{formatUSD(bUSD)}</div>}
                        {bIQD > 0 && <div style={{ color: "#2563eb", fontWeight: "700", fontSize: "1.1rem" }}>+{formatCurrency(bIQD)}</div>}
                        {bUSD === 0 && bIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "1.1rem", fontWeight: "600" }}>$0.00</div>}
                      </div>
                    );
                  })()}
                </div>
                {/* Return */}
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "1rem", padding: "1rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>🔄 Total Return</div>
                  {(() => {
                    const rUSD = selectedPayment.returnTotalUSD || 0;
                    const rIQD = selectedPayment.returnTotalIQD || 0;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        {rUSD > 0 && <div style={{ color: "#dc2626", fontWeight: "700", fontSize: "1.1rem" }}>−{formatUSD(rUSD)}</div>}
                        {rIQD > 0 && <div style={{ color: "#b91c1c", fontWeight: "700", fontSize: "1.1rem" }}>−{formatCurrency(rIQD)}</div>}
                        {rUSD === 0 && rIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "1.1rem", fontWeight: "600" }}>$0.00</div>}
                      </div>
                    );
                  })()}
                </div>
                {/* Net */}
                <div style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", border: "1px solid #C7D2FE", borderRadius: "1rem", padding: "1rem", boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.1)" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>💰 Net Amount Paid</div>
                  {(() => {
                    const nUSD = selectedPayment.netAmountUSD || 0;
                    const nIQD = selectedPayment.netAmountIQD || 0;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        {nUSD !== 0 && <div style={{ color: nUSD > 0 ? "#059669" : "#DC2626", fontWeight: "700", fontSize: "1.15rem" }}>{nUSD > 0 ? "+" : ""}{formatUSD(nUSD)}</div>}
                        {nIQD !== 0 && <div style={{ color: nIQD > 0 ? "#2563eb" : "#B91C1C", fontWeight: "700", fontSize: "1.15rem" }}>{nIQD > 0 ? "+" : ""}{formatCurrency(nIQD)}</div>}
                        {nUSD === 0 && nIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "1.15rem", fontWeight: "600" }}>$0.00</div>}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bought Bills Table */}
              {paymentDetails[selectedPayment.id]?.boughtBills?.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.75rem", color: colorScheme.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{background: "#D1FAE5", padding: "4px", borderRadius: "6px"}}>📦</span> Bought Bills
                  </h3>
                  <div style={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: "0.75rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Bill #</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Date</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Note</th>
                          <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentDetails[selectedPayment.id].boughtBills.map((bill, i) => (
                          <tr key={bill.id} style={{ borderBottom: i === paymentDetails[selectedPayment.id].boughtBills.length - 1 ? "none" : "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                            <td style={{ padding: "10px 12px", fontWeight: "600", color: colorScheme.text }}>#{bill.billNumber || bill.id}</td>
                            <td style={{ padding: "10px 12px", color: colorScheme.textLight }}>{formatDateToDMY(bill.date)}</td>
                            <td style={{ padding: "10px 12px", color: colorScheme.textLight, fontStyle: "italic", fontSize: "0.8rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bill.billNote || "—"}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600", color: "#059669" }}>
                              +{getDisplayAmount(bill.totalAmountUSD || 0, bill.totalAmountIQD || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Returns Table */}
              {paymentDetails[selectedPayment.id]?.returns?.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.75rem", color: colorScheme.text, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{background: "#FEE2E2", padding: "4px", borderRadius: "6px"}}>🔄</span> Returns
                  </h3>
                  <div style={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: "0.75rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Return #</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Date</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Note</th>
                          <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", fontSize: "0.7rem" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentDetails[selectedPayment.id].returns.map((ret, i) => (
                          <tr key={ret.id} style={{ borderBottom: i === paymentDetails[selectedPayment.id].returns.length - 1 ? "none" : "1px solid #F3F4F6", background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                            <td style={{ padding: "10px 12px", fontWeight: "600", color: colorScheme.text }}>#{ret.returnBillNumber || ret.id?.slice(-6)}</td>
                            <td style={{ padding: "10px 12px", color: colorScheme.textLight }}>{formatDateToDMY(ret.returnDate || ret.date)}</td>
                            <td style={{ padding: "10px 12px", color: colorScheme.textLight, fontStyle: "italic", fontSize: "0.8rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ret.returnNote || "—"}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600", color: "#DC2626" }}>
                              -{getDisplayAmount(ret.totalReturnUSD || 0, ret.totalReturnIQD || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment Notes */}
              {selectedPayment.notes && (
                <div style={{ padding: "1rem", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "0.75rem", fontSize: "0.85rem", marginBottom: "1rem" }}>
                  <div style={{ fontWeight: "700", color: "#B45309", marginBottom: "0.25rem" }}>📝 Payment Notes</div>
                  <div style={{ color: colorScheme.text }}>{selectedPayment.notes}</div>
                </div>
              )}

              {/* Attached image (click to enlarge / replace / delete) */}
              {getPaymentImage(selectedPayment) && (
                <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                  <img src={getPaymentImage(selectedPayment)} alt="Bill"
                    style={{ maxWidth: "250px", maxHeight: "250px", borderRadius: "0.5rem", cursor: "pointer", border: "1px solid #E5E7EB", filter: "grayscale(100%)" }}
                    onClick={() => handleViewImage(getPaymentImage(selectedPayment), selectedPayment)} />
                  <div style={{ fontSize: "0.72rem", color: colorScheme.textLight, marginTop: "0.3rem" }}>Click image to enlarge, replace or delete</div>
                </div>
              )}

              {/* Delete Payment Button in Modal */}
              <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => handleDeletePayment(selectedPayment.id)}
                  style={{ padding: "0.7rem 1.5rem", backgroundColor: "#EF4444", color: "white", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontWeight: "700", fontSize: "0.9rem", fontFamily: "inherit", boxShadow: "0 4px 6px rgba(239, 68, 68, 0.2)" }}>
                  🗑️ Delete Payment
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Quick Attach Image Modal */}
      {attachModalOpen && attachTargetPayment && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "1rem", backdropFilter: "blur(4px)" }}
          onClick={() => { if (!attachUploading) { setAttachModalOpen(false); setAttachTargetPayment(null); } }}>
          <div style={{ background: "white", borderRadius: "1rem", padding: "1.5rem", width: "100%", maxWidth: "450px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px solid #E5E7EB" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "700", color: colorScheme.text, display: "flex", alignItems: "center", gap: "6px" }}>
                <Paperclip size={18} color="#7C3AED" /> Attach Bill Image
              </h3>
              <button onClick={() => { if (!attachUploading) { setAttachModalOpen(false); setAttachTargetPayment(null); } }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: "1.1rem" }}>✕</button>
            </div>

            <p style={{ fontSize: "0.85rem", color: colorScheme.textLight, marginBottom: "1.25rem" }}>
              Attach a physical receipt or bill picture to payment <strong>{formatPaymentNumber(attachTargetPayment)}</strong> ({attachTargetPayment.companyName}).
            </p>

            <input type="file" ref={quickFileInputRef} accept="image/*" onChange={(e) => { handleQuickImageSelected(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />
            <input type="file" ref={quickCameraInputRef} accept="image/*" capture="environment" onChange={(e) => { handleQuickImageSelected(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <button type="button" onClick={() => quickFileInputRef.current?.click()} disabled={attachUploading}
                style={{ padding: "0.85rem", backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: "600", cursor: attachUploading ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <ImageIcon size={20} color="#4B5563" /> Choose from Gallery
              </button>
              <button type="button" onClick={() => quickCameraInputRef.current?.click()} disabled={attachUploading}
                style={{ padding: "0.85rem", backgroundColor: "#EDE9FE", color: "#5B21B6", border: "1px solid #C4B5FD", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: "600", cursor: attachUploading ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <Camera size={20} color="#7C3AED" /> Take Photo
              </button>
            </div>

            {attachUploading && (
              <div style={{ textAlign: "center", color: "#7C3AED", fontSize: "0.85rem", fontWeight: "600", padding: "0.5rem" }}>
                ⏳ Compressing & saving image...
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button type="button" onClick={() => { setAttachModalOpen(false); setAttachTargetPayment(null); }} disabled={attachUploading}
                style={{ padding: "0.5rem 1rem", backgroundColor: "#E5E7EB", color: "#374151", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal (Download + Replace / Delete for attached payment images) */}
      {showImageModal && selectedImageUrl && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}
          onClick={closeImageModal}>
          <div style={{ maxWidth: "92vw", maxHeight: "95vh", display: "flex", flexDirection: "column", background: "white", borderRadius: "0.75rem", padding: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
            {imageModalPayment && (
              <div style={{ textAlign: "center", fontSize: "0.8rem", fontWeight: "600", color: colorScheme.textLight, marginBottom: "0.5rem" }}>
                {formatPaymentNumber(imageModalPayment)} — {imageModalPayment.companyName}
              </div>
            )}

            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", justifyContent: "center" }}>
              <img src={selectedImageUrl} alt="Full Bill" style={{ maxWidth: "100%", maxHeight: imageModalPayment ? "62vh" : "75vh", objectFit: "contain", display: "block", filter: "grayscale(100%)", borderRadius: "0.5rem", opacity: imageActionLoading ? 0.5 : 1 }} />
            </div>

            {imageModalPayment && (
              <>
                <input type="file" ref={replaceFileInputRef} accept="image/*" onChange={(e) => { handleReplaceImageSelected(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />
                <input type="file" ref={replaceCameraInputRef} accept="image/*" capture="environment" onChange={(e) => { handleReplaceImageSelected(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />

                {(imageActionLoading || imageProcessing) && (
                  <div style={{ marginTop: "0.6rem", textAlign: "center", color: "#7C3AED", fontSize: "0.82rem", fontWeight: "600", animation: "pulse 1.5s infinite" }}>
                    ⏳ Saving changes...
                  </div>
                )}

                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
                  <button type="button" onClick={() => replaceFileInputRef.current?.click()} disabled={imageActionLoading || imageProcessing}
                    style={{ padding: "0.5rem 1rem", backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: "0.5rem", cursor: imageActionLoading || imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: "600", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <ImageIcon size={15} /> Replace from Gallery
                  </button>
                  <button type="button" onClick={() => replaceCameraInputRef.current?.click()} disabled={imageActionLoading || imageProcessing}
                    style={{ padding: "0.5rem 1rem", backgroundColor: "#EDE9FE", color: "#5B21B6", border: "1px solid #C4B5FD", borderRadius: "0.5rem", cursor: imageActionLoading || imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: "600", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Camera size={15} /> Replace with Photo
                  </button>
                  <button type="button" onClick={handleDeleteAttachedImage} disabled={imageActionLoading || imageProcessing}
                    style={{ padding: "0.5rem 1rem", backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: "0.5rem", cursor: imageActionLoading || imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: "700", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    🗑️ Delete Image
                  </button>
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "0.9rem", flexWrap: "wrap" }}>
              <button onClick={handleDownloadImage} style={{ padding: "0.6rem 1.5rem", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                📥 Save to Gallery
              </button>
              <button onClick={closeImageModal} disabled={imageActionLoading} style={{ padding: "0.6rem 1.5rem", backgroundColor: colorScheme.primary, color: "white", border: "none", borderRadius: "0.5rem", cursor: imageActionLoading ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}