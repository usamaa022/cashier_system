"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  createSoldPayment,
  getPharmacies,
  getPharmacySoldBills,
  getPharmacyReturns,
  getSoldPaymentDetails,
  updateSoldPayment,
  getSoldPayments,
  getSoldBills,
  getSaleBillById,
  getReturnById,
} from "@/lib/data";
import { deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Filter, Search, Paperclip, Camera, Image as ImageIcon, X } from "lucide-react";

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
const BILL_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#06B6D4", "#6366F1", "#14B8A6"];
const RETURN_COLORS = ["#EF4444", "#F97316", "#EC4899", "#F59E0B", "#DC2626", "#E11D48"];

const getReturnLabel = (ret, fallbackId = "") =>
  ret?.returnBillNumber || ret?.pharmacyReturnBillNumber || `RET-${String(ret?.id || fallbackId).slice(-6)}`;

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
      if (columnKey === 'pharmacyName') val = item.pharmacyName || '';
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
              style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}
            />
            <span>(Select All)</span>
          </label>
          {displayValues.map(val => (
            <label key={val} title={val} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", color: "#1e293b", flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={selectedValues.includes(val)}
                onChange={(e) => handleCheckbox(val, e.target.checked)}
                style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}
              />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val === "" ? "(Blank)" : val}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc", boxSizing: "border-box", flexShrink: 0 }}>
        <button onClick={() => clearColumnFilter(columnKey)} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: "0.875rem", cursor: "pointer", fontWeight: 600 }}>Clear</button>
        <button onClick={() => setActiveFilterDropdown(null)} style={{ background: "#2563eb", border: "none", color: "white", fontSize: "0.875rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>Apply</button>
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
          background: isActive ? "#dbeafe" : "transparent", 
          color: isActive ? "#2563eb" : "#bdc3c7" 
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

export default function SoldPaymentManagementPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState("");
  const [pharmacySearchTerm, setPharmacySearchTerm] = useState("");
  const [showPharmacyDropdown, setShowPharmacyDropdown] = useState(false);
  const [soldBills, setSoldBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedSoldBills, setSelectedSoldBills] = useState([]);
  const [selectedSoldReturns, setSelectedSoldReturns] = useState([]);
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
  
  // Advanced search filters
  const [advancedSearch, setAdvancedSearch] = useState({
    pharmacyName: "",
    hardcopyBillNumber: "",
    soldBillNumber: "",
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

  // Fast Detail Modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItems, setDetailItems] = useState([]);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailType, setDetailType] = useState("bill");
  const [detailLoading, setDetailLoading] = useState(false);

  // Search states for bills and returns selection
  const [billSearchTerm, setBillSearchTerm] = useState("");
  const [returnSearchTerm, setReturnSearchTerm] = useState("");

  // IMAGE STATE (Form & Quick Attach)
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

  const [currencyTotals, setCurrencyTotals] = useState({ soldUSD: 0, soldIQD: 0, returnUSD: 0, returnIQD: 0, netUSD: 0, netIQD: 0 });
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [printLoading, setPrintLoading] = useState(false);

  const pharmacyInputRef = useRef(null);
  const hardcopyBillNumberRef = useRef(null);
  const pharmacyDropdownRef = useRef(null);

  const colorScheme = {
    primary: "#3B82F6",
    secondary: "#10B981",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    dark: "#1E40AF",
    light: "#93C5FD",
    background: "#FFFFFF",
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
    return d.toISOString().split("T")[0];
  };

  const generatePaymentNumber = () => {
    const currentYear = new Date().getFullYear();
    let maxId = 0;
    paymentHistory.forEach((p) => {
      if (p.paymentNumber && p.paymentNumber.startsWith(`SPAY-${currentYear}-`)) {
        const parts = p.paymentNumber.split('-');
        if (parts.length === 3) {
          const num = parseInt(parts[2], 10);
          if (!isNaN(num) && num > maxId) {
            maxId = num;
          }
        }
      }
    });
    const nextNum = maxId + 1;
    return `SPAY-${currentYear}-${String(nextNum).padStart(3, '0')}`;
  };

  const formatUSD = (amount) => {
    if (!amount || Math.abs(amount) < 0.0001) return "$0.00";
    return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const formatIQD = (amount) => {
    if (!amount || Math.abs(amount) < 0.5) return "0 IQD";
    return new Intl.NumberFormat("en-US").format(Math.round(amount)) + " IQD";
  };

  const getDisplayAmount = (amountUSD, amountIQD) => {
    const parts = [];
    if (amountUSD && Math.abs(amountUSD) > 0.001) parts.push(formatUSD(amountUSD));
    if (amountIQD && Math.abs(amountIQD) > 0.5) parts.push(formatIQD(amountIQD));
    if (parts.length === 0) return "0 IQD";
    return parts.join(" + ");
  };

  const detectBillCurrency = (bill) => {
    if (bill?.currency) return bill.currency;
    if (bill?.items && bill.items.length > 0) {
      const firstItem = bill.items[0];
      if ((firstItem.outPriceIQD || 0) > 0 && !(firstItem.outPriceUSD > 0)) return "IQD";
      if ((firstItem.outPriceUSD || 0) > 0) return "USD";
      if (firstItem.currency) return firstItem.currency;
      if (firstItem.originalCurrency) return firstItem.originalCurrency;
    }
    if ((bill?.totalAmountIQD || 0) > 0 && !(bill?.totalAmountUSD > 0)) return "IQD";
    return "USD";
  };

  const computeBillTotals = (bill) => {
    const currency = detectBillCurrency(bill);
    let totalUSD = 0;
    let totalIQD = 0;

    if (bill.items && Array.isArray(bill.items) && bill.items.length > 0) {
      bill.items.forEach((item) => {
        const qty = Number(item.quantity) || 0;
        if (currency === "IQD") {
          const price = Number(item.outPriceIQD) || Number(item.price) || 0;
          totalIQD += price * qty;
        } else {
          const price = Number(item.outPriceUSD) || Number(item.price) || 0;
          totalUSD += price * qty;
        }
      });
    } else {
      if (currency === "IQD") {
        totalIQD = Number(bill.totalAmountIQD) || Number(bill.totalAmount) || 0;
      } else {
        totalUSD = Number(bill.totalAmountUSD) || Number(bill.totalAmount) || 0;
      }
    }

    return { totalUSD, totalIQD, currency };
  };

  const computeReturnTotals = (ret) => {
    let returnUSD = Number(ret.totalReturnUSD || ret.totalReturnAmountUSD) || 0;
    let returnIQD = Number(ret.totalReturnIQD || ret.totalReturnAmountIQD) || 0;

    if (returnUSD === 0 && returnIQD === 0 && ret.items && Array.isArray(ret.items)) {
      const retCurrency = ret.currency || (ret.items[0]?.currency) || "IQD";
      ret.items.forEach((item) => {
        const qty = Number(item.returnQuantity || item.quantity) || 0;
        const price = Number(item.returnPrice || item.price) || 0;
        if (retCurrency === "USD") returnUSD += price * qty;
        else returnIQD += price * qty;
      });
    } else if (returnUSD === 0 && returnIQD === 0 && ret.totalReturnAmount) {
      const retCurrency = ret.currency || "IQD";
      if (retCurrency === "USD") returnUSD = Number(ret.totalReturnAmount);
      else returnIQD = Number(ret.totalReturnAmount);
    }

    return { returnUSD, returnIQD };
  };

  const getFirstName = useCallback((fullName) => {
    if (!fullName) return "User";
    const namePart = fullName.split("@")[0];
    return namePart.split(" ")[0];
  }, []);

  // --- Bill / Return number helpers for the history table ---
  const getBillNumbers = useCallback((payment) => {
    const ids = payment?.selectedSoldBills || [];
    if (ids.length === 0) return [];
    if (Array.isArray(payment.selectedSoldBillNumbers) && payment.selectedSoldBillNumbers.length === ids.length) {
      return payment.selectedSoldBillNumbers.map(String);
    }
    return ids.map((id) => String(billNumberMap[id] ?? `…${String(id).slice(-4)}`));
  }, [billNumberMap]);

  const getReturnNumbers = useCallback((payment) => {
    const ids = payment?.selectedReturns || [];
    if (ids.length === 0) return [];
    if (Array.isArray(payment.selectedReturnNumbers) && payment.selectedReturnNumbers.length === ids.length) {
      return payment.selectedReturnNumbers.map(String);
    }
    return ids.map((id) => String(returnNumberMap[id] ?? `…${String(id).slice(-4)}`));
  }, [returnNumberMap]);

  // Resolve numbers for older payments that only saved IDs
  useEffect(() => {
    if (!paymentHistory || paymentHistory.length === 0) return;
    let cancelled = false;

    const hasStoredBills = (p) =>
      Array.isArray(p.selectedSoldBillNumbers) &&
      p.selectedSoldBillNumbers.length === (p.selectedSoldBills?.length || 0);
    const hasStoredReturns = (p) =>
      Array.isArray(p.selectedReturnNumbers) &&
      p.selectedReturnNumbers.length === (p.selectedReturns?.length || 0);

    const resolve = async () => {
      try {
        // Bills
        const needBills = paymentHistory.some((p) => (p.selectedSoldBills?.length || 0) > 0 && !hasStoredBills(p));
        if (needBills) {
          const allBills = await getSoldBills();
          if (cancelled) return;
          const map = {};
          allBills.forEach((b) => {
            map[b.id] = String(b.billNumber ?? b.id);
          });
          setBillNumberMap((prev) => ({ ...prev, ...map }));
        }

        // Returns (grouped per pharmacy to keep requests low)
        const byPharmacy = {};
        paymentHistory.forEach((p) => {
          if ((p.selectedReturns?.length || 0) > 0 && !hasStoredReturns(p) && p.pharmacyId) {
            if (!byPharmacy[p.pharmacyId]) byPharmacy[p.pharmacyId] = new Set();
            p.selectedReturns.forEach((id) => byPharmacy[p.pharmacyId].add(id));
          }
        });

        const pharmacyIds = Object.keys(byPharmacy);
        if (pharmacyIds.length > 0) {
          const results = await Promise.all(
            pharmacyIds.map((pid) =>
              getPharmacyReturns(pid, Array.from(byPharmacy[pid])).catch(() => [])
            )
          );
          if (cancelled) return;
          const rMap = {};
          results.flat().forEach((r) => {
            rMap[r.id] = getReturnLabel(r);
          });

          // Fallback for any return still unresolved
          const unresolved = [];
          pharmacyIds.forEach((pid) => {
            byPharmacy[pid].forEach((id) => {
              if (!rMap[id]) unresolved.push(id);
            });
          });
          if (unresolved.length > 0) {
            const extra = await Promise.all(unresolved.map((id) => getReturnById(id).catch(() => null)));
            extra.forEach((r, i) => {
              if (r) rMap[unresolved[i]] = getReturnLabel(r, unresolved[i]);
            });
          }
          if (cancelled) return;
          setReturnNumberMap((prev) => ({ ...prev, ...rMap }));
        }
      } catch (err) {
        console.error("Error resolving bill/return numbers:", err);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [paymentHistory]);

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

  // Save (or clear) the image of an existing payment and keep all local state in sync
  const persistPaymentImage = async (payment, imageValue) => {
    const paymentRef = doc(db, "soldPayments", payment.id);
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

  const filteredPharmacies = pharmacies.filter(
    (pharmacy) =>
      pharmacy.name.toLowerCase().includes(pharmacySearchTerm.toLowerCase()) ||
      pharmacy.code?.toLowerCase().includes(pharmacySearchTerm.toLowerCase())
  );

  const handleSelectPharmacy = (pharmacy) => {
    setSelectedPharmacy(pharmacy.id);
    setPharmacySearchTerm(pharmacy.name);
    setShowPharmacyDropdown(false);
  };

  const handlePharmacyInputChange = (e) => {
    setPharmacySearchTerm(e.target.value);
    setShowPharmacyDropdown(true);
    if (e.target.value === "") setSelectedPharmacy("");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pharmacyDropdownRef.current && !pharmacyDropdownRef.current.contains(event.target)) {
        setShowPharmacyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshPayments = async () => {
    try {
      setHistoryLoading(true);
      const paymentsData = await getSoldPayments();
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
      await loadPharmacies();
    };
    loadInitialData();
  }, [user]);

  const loadPharmacies = async () => {
    try {
      const pharmaciesData = await getPharmacies();
      setPharmacies(pharmaciesData);
    } catch (err) {
      console.error("Error loading pharmacies:", err);
      setError("Failed to load pharmacies");
    }
  };

  useEffect(() => {
    const loadPaymentForEdit = async () => {
      if (!isEditMode || !editPaymentId) return;
      try {
        setLoading(true);
        setError(null);
        const paymentToEdit = await getSoldPaymentDetails(editPaymentId);
        if (paymentToEdit) {
          setSelectedPharmacy(paymentToEdit.pharmacyId);
          const pharmacy = pharmacies.find((c) => c.id === paymentToEdit.pharmacyId);
          setPharmacySearchTerm(pharmacy?.name || "");
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
          setSelectedSoldBills(paymentToEdit.selectedSoldBills || []);
          setSelectedSoldReturns(paymentToEdit.selectedReturns || []);
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
  }, [isEditMode, editPaymentId, pharmacies]);

  useEffect(() => {
    if (!selectedPharmacy) {
      setSoldBills([]);
      setReturns([]);
      if (!isEditMode) {
        setHardcopyBillNumber("");
        setBillImageData(null);
        setOriginalImageData(null);
        setImageHasChanged(false);
      }
      return;
    }
    const loadPharmacyData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [allSoldBills, allReturns] = await Promise.all([
          getPharmacySoldBills(selectedPharmacy, isEditMode ? selectedSoldBills : []),
          getPharmacyReturns(selectedPharmacy, isEditMode ? selectedSoldReturns : []),
        ]);
        const sortedBills = [...allSoldBills].sort((a, b) => {
          const numA = parseInt(a.billNumber) || 0;
          const numB = parseInt(b.billNumber) || 0;
          return numB - numA;
        });
        const sortedReturns = [...allReturns].sort((a, b) => {
          const dateA = a.returnDate?.toDate ? a.returnDate.toDate() : new Date(a.date || 0);
          const dateB = b.returnDate?.toDate ? b.returnDate.toDate() : new Date(b.date || 0);
          return dateB - dateA;
        });
        setSoldBills(sortedBills);
        setReturns(sortedReturns);
      } catch (err) {
        console.error("Error loading pharmacy data:", err);
        setError("Failed to load pharmacy data");
      } finally {
        setLoading(false);
      }
    };
    loadPharmacyData();
  }, [selectedPharmacy, isEditMode, initialLoadComplete]);

  // Recalculate summary totals accurately
  useEffect(() => {
    let soldUSD = 0, soldIQD = 0, returnUSD = 0, returnIQD = 0;

    selectedSoldBills.forEach((billId) => {
      const bill = soldBills.find((b) => b.id === billId);
      if (bill) {
        const { totalUSD, totalIQD } = computeBillTotals(bill);
        soldUSD += totalUSD;
        soldIQD += totalIQD;
      }
    });

    selectedSoldReturns.forEach((returnId) => {
      const returnBill = returns.find((r) => r.id === returnId);
      if (returnBill) {
        const { returnUSD: rUSD, returnIQD: rIQD } = computeReturnTotals(returnBill);
        returnUSD += rUSD;
        returnIQD += rIQD;
      }
    });

    setCurrencyTotals({
      soldUSD,
      soldIQD,
      returnUSD,
      returnIQD,
      netUSD: soldUSD - returnUSD,
      netIQD: soldIQD - returnIQD,
    });
  }, [selectedSoldBills, selectedSoldReturns, soldBills, returns]);

  const toggleSoldBill = (billId) =>
    setSelectedSoldBills((prev) => prev.includes(billId) ? prev.filter((id) => id !== billId) : [...prev, billId]);

  const toggleSoldReturn = (returnId) =>
    setSelectedSoldReturns((prev) => prev.includes(returnId) ? prev.filter((id) => id !== returnId) : [...prev, returnId]);

  const selectAllSoldBills = () =>
    setSelectedSoldBills(selectedSoldBills.length === soldBills.length ? [] : soldBills.map((b) => b.id));

  const selectAllSoldReturns = () =>
    setSelectedSoldReturns(selectedSoldReturns.length === returns.length ? [] : returns.map((r) => r.id));

  const clearSelection = () => {
    setSelectedSoldBills([]);
    setSelectedSoldReturns([]);
  };

  const resetForm = () => {
    setSelectedSoldBills([]);
    setSelectedSoldReturns([]);
    setHardcopyBillNumber("");
    setNotes("");
    setBillImageData(null);
    setOriginalImageData(null);
    setImageHasChanged(false);
    setSelectedPharmacy("");
    setPharmacySearchTerm("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setPaymentDate(new Date().toISOString().split("T")[0]);
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

      if (paymentToDelete.selectedSoldBills && paymentToDelete.selectedSoldBills.length > 0) {
        paymentToDelete.selectedSoldBills.forEach((billId) => {
          const billRef = doc(db, "soldBills", billId); 
          batch.set(billRef, {
            status: "unpaid",
            paymentStatus: "unpaid",
            isPaid: false,
            paymentId: null
          }, { merge: true });
        });
      }

      if (paymentToDelete.selectedReturns && paymentToDelete.selectedReturns.length > 0) {
        paymentToDelete.selectedReturns.forEach((returnId) => {
          const returnRef = doc(db, "returns", returnId); 
          batch.set(returnRef, {
            status: "unprocessed",
            paymentStatus: "unpaid",
            isPaid: false,
            paymentId: null
          }, { merge: true });
        });
      }

      const paymentRef = doc(db, "soldPayments", paymentId);
      batch.delete(paymentRef);

      await batch.commit();

      setSuccess("Payment deleted and bills reverted to unpaid successfully!");
      await refreshPayments();
      
      if (selectedPharmacy === paymentToDelete.pharmacyId) {
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
    if (!selectedPharmacy) {
      setError("Please select a pharmacy");
      pharmacyInputRef.current?.focus();
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
    if (selectedSoldBills.length === 0 && selectedSoldReturns.length === 0) {
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

      const selectedPharmacyData = pharmacies.find((c) => c.id === selectedPharmacy);
      const userDisplayName = user?.name || user?.email || "Unknown User";

      let imageToSave;
      if (isEditMode) {
        imageToSave = imageHasChanged ? (billImageData || null) : (originalImageData || null);
      } else {
        imageToSave = billImageData || null;
      }

      // Save the visible numbers so the history table can show them instantly
      const selectedSoldBillNumbers = selectedSoldBills.map((id) => {
        const b = soldBills.find((x) => x.id === id);
        return String(b?.billNumber ?? billNumberMap[id] ?? String(id).slice(-4));
      });
      const selectedReturnNumbers = selectedSoldReturns.map((id) => {
        const r = returns.find((x) => x.id === id);
        return String(r ? getReturnLabel(r, id) : (returnNumberMap[id] ?? `RET-${String(id).slice(-6)}`));
      });

      const paymentData = {
        pharmacyId: selectedPharmacy,
        pharmacyName: selectedPharmacyData?.name || "Unknown Pharmacy",
        selectedSoldBills,
        selectedReturns: selectedSoldReturns,
        selectedSoldBillNumbers,
        selectedReturnNumbers,
        soldTotalUSD: currencyTotals.soldUSD,
        soldTotalIQD: currencyTotals.soldIQD,
        returnTotalUSD: currencyTotals.returnUSD,
        returnTotalIQD: currencyTotals.returnIQD,
        netAmountUSD: currencyTotals.netUSD,
        netAmountIQD: currencyTotals.netIQD,
        paymentDate: new Date(paymentDate),
        hardcopyBillNumber: hardcopyBillNumber.trim(),
        notes,
        billImageBase64: imageToSave,
        billImageUrl: imageToSave,
        createdBy: user.uid,
        createdByName: userDisplayName,
        paymentType: "sold",
      };

      if (isEditMode) {
        const existingPayment = paymentHistory.find(p => p.id === editPaymentId);
        paymentData.paymentNumber = existingPayment?.paymentNumber || generatePaymentNumber();
        await updateSoldPayment(editPaymentId, paymentData);
        setSuccess("Sold Payment updated successfully!");
        setIsEditMode(false);
        setEditPaymentId(null);
      } else {
        paymentData.paymentNumber = generatePaymentNumber();
        const result = await createSoldPayment(paymentData);
        if (!result || !result.id) throw new Error("Payment creation failed: No payment ID returned.");
        setSuccess("Sold Payment created successfully!");
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
    setSelectedSoldBills([]);
    setSelectedSoldReturns([]);
    setHardcopyBillNumber("");
    setHardcopyBillError(false);
    setNotes("");
    setBillImageData(null);
    setOriginalImageData(null);
    setImageHasChanged(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setSelectedPharmacy("");
    setPharmacySearchTerm("");
    window.history.replaceState({}, "", "/sold-payments");
  };

  const handleUpdatePayment = (payment) => {
    setIsEditMode(true);
    setEditPaymentId(payment.id);
    setSelectedPharmacy(payment.pharmacyId);
    const pharmacy = pharmacies.find((c) => c.id === payment.pharmacyId);
    setPharmacySearchTerm(pharmacy?.name || "");
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
    setSelectedSoldBills(payment.selectedSoldBills || []);
    setSelectedSoldReturns(payment.selectedReturns || []);
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

  // Super fast instant detail view with in-memory caching fallback
  const viewBillDetails = async (billId) => {
    const cachedBill = soldBills.find(b => b.id === billId);
    if (cachedBill && cachedBill.items && cachedBill.items.length > 0) {
      setDetailTitle(`Bill #${cachedBill.billNumber || billId}`);
      setDetailType("bill");
      const bCurr = detectBillCurrency(cachedBill);
      const items = cachedBill.items.map(item => {
        const qty = Number(item.quantity) || 0;
        const price = bCurr === "IQD" 
          ? (Number(item.outPriceIQD) || Number(item.price) || 0)
          : (Number(item.outPriceUSD) || Number(item.price) || 0);

        return {
          ...item,
          displayPrice: bCurr === "IQD" ? formatIQD(price) : formatUSD(price),
          displayTotal: bCurr === "IQD" ? formatIQD(price * qty) : formatUSD(price * qty),
          quantity: qty,
          currency: bCurr,
        };
      });
      setDetailItems(items);
      setShowDetailModal(true);
      return;
    }

    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const billData = await getSaleBillById(billId);
      if (billData) {
        setDetailTitle(`Bill #${billData.billNumber || billId}`);
        setDetailType("bill");
        const bCurr = detectBillCurrency(billData);
        
        const items = (billData.items || []).map(item => {
          const qty = Number(item.quantity) || 0;
          const price = bCurr === "IQD" 
            ? (Number(item.outPriceIQD) || Number(item.price) || 0)
            : (Number(item.outPriceUSD) || Number(item.price) || 0);

          return {
            ...item,
            displayPrice: bCurr === "IQD" ? formatIQD(price) : formatUSD(price),
            displayTotal: bCurr === "IQD" ? formatIQD(price * qty) : formatUSD(price * qty),
            quantity: qty,
            currency: bCurr,
          };
        });
        setDetailItems(items);
      } else {
        setError("Bill not found");
        setShowDetailModal(false);
      }
    } catch (err) {
      console.error("Error loading bill details:", err);
      setError("Failed to load bill details");
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const viewReturnDetails = async (returnId) => {
    const cachedRet = returns.find(r => r.id === returnId);
    if (cachedRet && cachedRet.items && cachedRet.items.length > 0) {
      setDetailTitle(`Return #${cachedRet.returnBillNumber || returnId}`);
      setDetailType("return");
      const retCurr = cachedRet.currency || "IQD";

      const items = cachedRet.items.map(item => {
        const qty = Number(item.returnQuantity || item.quantity) || 0;
        const price = Number(item.returnPrice || item.price) || 0;
        return {
          ...item,
          displayPrice: retCurr === "USD" ? formatUSD(price) : formatIQD(price),
          displayTotal: retCurr === "USD" ? formatUSD(price * qty) : formatIQD(price * qty),
          quantity: qty,
          currency: retCurr,
        };
      });
      setDetailItems(items);
      setShowDetailModal(true);
      return;
    }

    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const returnData = await getReturnById(returnId);
      if (returnData) {
        setDetailTitle(`Return #${returnData.returnBillNumber || returnId}`);
        setDetailType("return");
        const retCurr = returnData.currency || "IQD";

        const items = (returnData.items || []).map(item => {
          const qty = Number(item.returnQuantity || item.quantity) || 0;
          const price = Number(item.returnPrice || item.price) || 0;
          return {
            ...item,
            displayPrice: retCurr === "USD" ? formatUSD(price) : formatIQD(price),
            displayTotal: retCurr === "USD" ? formatUSD(price * qty) : formatIQD(price * qty),
            quantity: qty,
            currency: retCurr,
          };
        });
        setDetailItems(items);
      } else {
        setError("Return not found");
        setShowDetailModal(false);
      }
    } catch (err) {
      console.error("Error loading return details:", err);
      setError("Failed to load return details");
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setDetailItems([]);
    setDetailTitle("");
  };

  const getFilteredBills = () => {
    if (!billSearchTerm.trim()) return soldBills;
    const search = billSearchTerm.toLowerCase().trim();
    return soldBills.filter(bill => {
      if (bill.billNumber && String(bill.billNumber).toLowerCase().includes(search)) return true;
      if (bill.items && Array.isArray(bill.items)) {
        return bill.items.some(item => 
          (item.barcode && item.barcode.toLowerCase().includes(search)) ||
          (item.name && item.name.toLowerCase().includes(search))
        );
      }
      return false;
    });
  };

  const getFilteredReturns = () => {
    if (!returnSearchTerm.trim()) return returns;
    const search = returnSearchTerm.toLowerCase().trim();
    return returns.filter(ret => {
      if (ret.returnBillNumber && ret.returnBillNumber.toLowerCase().includes(search)) return true;
      if (ret.items && Array.isArray(ret.items)) {
        return ret.items.some(item => 
          (item.barcode && item.barcode.toLowerCase().includes(search)) ||
          (item.name && item.name.toLowerCase().includes(search))
        );
      }
      return false;
    });
  };

  const handlePrintPayment = async (payment) => {
    setPrintLoading(true);
    try {
      const allSoldBills = await getSoldBills();
      const allReturns = await getPharmacyReturns(payment.pharmacyId, payment.selectedReturns || []);

      const soldDetails = allSoldBills.filter((bill) =>
        payment.selectedSoldBills?.includes(bill.id)
      );

      const returnDetails = allReturns.filter((ret) =>
        payment.selectedReturns?.includes(ret.id)
      );

      const printWindow = window.open("", "_blank");
      printWindow.document.write(generatePrintHTML(payment, soldDetails, returnDetails));
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    } catch (err) {
      console.error("Error generating print:", err);
      setError("Failed to generate print preview");
    } finally {
      setPrintLoading(false);
    }
  };

  const generatePrintHTML = (payment, soldBillsList, returnsList) => {
    let totalSoldUSD = 0, totalSoldIQD = 0, totalReturnUSD = 0, totalReturnIQD = 0;
    const soldItemsRows = [];
    const returnItemsRows = [];

    if (soldBillsList && soldBillsList.length > 0) {
      soldBillsList.forEach((bill) => {
        const { totalUSD: billUSD, totalIQD: billIQD } = computeBillTotals(bill);
        totalSoldUSD += billUSD;
        totalSoldIQD += billIQD;

        const displayAmounts = [];
        if (billUSD > 0) displayAmounts.push(formatUSD(billUSD));
        if (billIQD > 0) displayAmounts.push(formatIQD(billIQD));
        const displayAmount = displayAmounts.length > 0 ? displayAmounts.join(" + ") : (billIQD > 0 ? formatIQD(billIQD) : "0 IQD");

        const billNote = bill.note || bill.billNote || "";
        soldItemsRows.push(`
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 8px; font-weight: 500;">${bill.billNumber || bill.id}</td>
            <td style="padding: 10px 8px; color: #6b7280;">${formatDateToDMY(bill.date)}</td>
            <td style="padding: 10px 8px; color: #9ca3af; font-style: italic;">${billNote || "—"}</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #059669;">+${displayAmount}</td>
          </tr>
        `);
      });
    }

    if (returnsList && returnsList.length > 0) {
      returnsList.forEach((ret) => {
        const returnNumberDisplay = ret.returnBillNumber || `RET-${ret.id?.slice(-6)}`;
        const { returnUSD, returnIQD } = computeReturnTotals(ret);
        totalReturnUSD += returnUSD;
        totalReturnIQD += returnIQD;

        const displayAmounts = [];
        if (returnUSD > 0) displayAmounts.push(formatUSD(returnUSD));
        if (returnIQD > 0) displayAmounts.push(formatIQD(returnIQD));
        const displayAmount = displayAmounts.length > 0 ? displayAmounts.join(" + ") : (returnIQD > 0 ? formatIQD(returnIQD) : "0 IQD");

        const retNote = ret.returnNote || ret.note || "";
        returnItemsRows.push(`
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 8px; font-weight: 500;">${returnNumberDisplay}</td>
            <td style="padding: 10px 8px; color: #6b7280;">${formatDateToDMY(ret.returnDate || ret.date)}</td>
            <td style="padding: 10px 8px; color: #9ca3af; font-style: italic;">${retNote || "—"}</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #dc2626;">-${displayAmount}</td>
          </tr>
        `);
      });
    }

    const paidUSD = totalSoldUSD - totalReturnUSD;
    const paidIQD = totalSoldIQD - totalReturnIQD;
    const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/Aranlogo.png` : "/Aranlogo.png";

    const getSoldDisplay = () => {
      if (totalSoldUSD > 0 && totalSoldIQD > 0) return `+${formatUSD(totalSoldUSD)} + ${formatIQD(totalSoldIQD)}`;
      if (totalSoldUSD > 0) return `+${formatUSD(totalSoldUSD)}`;
      if (totalSoldIQD > 0) return `+${formatIQD(totalSoldIQD)}`;
      return "0 IQD";
    };

    const getReturnDisplay = () => {
      if (totalReturnUSD > 0 && totalReturnIQD > 0) return `-${formatUSD(totalReturnUSD)} - ${formatIQD(totalReturnIQD)}`;
      if (totalReturnUSD > 0) return `-${formatUSD(totalReturnUSD)}`;
      if (totalReturnIQD > 0) return `-${formatIQD(totalReturnIQD)}`;
      return "0 IQD";
    };

    const getPaidDisplay = () => {
      const parts = [];
      if (paidUSD !== 0) parts.push(paidUSD < 0 ? formatUSD(paidUSD) : `+${formatUSD(paidUSD)}`);
      if (paidIQD !== 0) parts.push(paidIQD < 0 ? formatIQD(paidIQD) : `+${formatIQD(paidIQD)}`);
      return parts.length > 0 ? parts.join(" and ") : "0 IQD";
    };

    return `<!DOCTYPE html>
<html>
  <head>
    <title>Payment Receipt - ${payment.paymentNumber}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;background:white;padding:20px;}
      .receipt{max-width:900px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:24px;background:white;}
      .header{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #3B82F6;}
      .logo{max-height:70px;max-width:220px;object-fit:contain;margin-bottom:8px;}
      .header h1{font-size:20px;font-weight:bold;margin-bottom:6px;color:#3B82F6;}
      .header p{font-size:12px;color:#6b7280;}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:10px;}
      .info-item{margin-bottom:8px;}
      .info-label{font-weight:bold;color:#6b7280;font-size:10px;text-transform:uppercase;margin-bottom:4px;}
      .info-value{font-size:13px;font-weight:600;color:#1f2937;}
      .totals-row{display:flex;justify-content:space-between;gap:16px;margin-bottom:24px;}
      .total-card{flex:1;padding:14px;border-radius:10px;text-align:center;}
      .total-card.sold{background:#d1fae5;border:1px solid #10b981;}
      .total-card.return{background:#fee2e2;border:1px solid #ef4444;}
      .total-card.paid{background:#dbeafe;border:1px solid #3b82f6;}
      .total-label{font-size:10px;text-transform:uppercase;font-weight:700;color:#4b5563;margin-bottom:6px;}
      .total-amount{font-size:15px;font-weight:800;}
      .section{margin-bottom:24px;}
      .section-title{font-size:14px;font-weight:bold;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb;}
      table{width:100%;border-collapse:collapse;}
      th{background:#f3f4f6;padding:10px 8px;text-align:left;font-weight:700;font-size:11px;color:#4b5563;text-transform:uppercase;}
      th:last-child{text-align:right;}
      td:last-child{text-align:right;}
      .notes-box{margin-top:16px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:11px;}
      .footer{margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af;}
      @media print{body{padding:0;margin:0;}.receipt{border:none;padding:16px;}}
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        <img src="${logoUrl}" alt="Aran Logo" class="logo" onerror="this.style.display='none'" />
        <h1>SOLD PAYMENT RECEIPT</h1>
        <p><strong>${payment.paymentNumber || ""}</strong> | ${formatDateToDMY(payment.paymentDate)}</p>
      </div>
      
      <div class="info-grid">
        <div>
          <div class="info-item"><div class="info-label">Pharmacy</div><div class="info-value">${payment.pharmacyName || ""}</div></div>
          <div class="info-item"><div class="info-label">Hardcopy Bill</div><div class="info-value">${payment.hardcopyBillNumber || ""}</div></div>
        </div>
        <div>
          <div class="info-item"><div class="info-label">Created By</div><div class="info-value">${getFirstName(payment.createdByName)}</div></div>
          <div class="info-item"><div class="info-label">Payment Date</div><div class="info-value">${formatDateToDMY(payment.paymentDate)}</div></div>
        </div>
      </div>
      
      <div class="totals-row">
        <div class="total-card sold">
          <div class="total-label">TOTAL SOLD</div>
          <div class="total-amount" style="color:#059669;">${getSoldDisplay()}</div>
        </div>
        <div class="total-card return">
          <div class="total-label">TOTAL RETURN</div>
          <div class="total-amount" style="color:#dc2626;">${getReturnDisplay()}</div>
        </div>
        <div class="total-card paid">
          <div class="total-label">TOTAL PAID</div>
          <div class="total-amount" style="color:#3b82f6;">${getPaidDisplay()}</div>
        </div>
      </div>
      
      ${soldItemsRows.length > 0 ? `
      <div class="section">
        <div class="section-title">💰 SOLD BILLS</div>
        <table>
          <thead>
            <tr><th>Bill Number</th><th>Date</th><th>Note</th><th>Amount</th></tr>
          </thead>
          <tbody>${soldItemsRows.join("")}</tbody>
        </table>
      </div>` : ""}
      
      ${returnItemsRows.length > 0 ? `
      <div class="section">
        <div class="section-title">🔄 RETURNS</div>
        <table>
          <thead>
            <tr><th>Return Number</th><th>Date</th><th>Note</th><th>Amount</th></tr>
          </thead>
          <tbody>${returnItemsRows.join("")}</tbody>
        </table>
      </div>` : ""}
      
      ${payment.notes ? `
      <div class="notes-box">
        <strong>📝 Payment Notes:</strong><br/>${payment.notes}
      </div>` : ""}
      
      <div class="footer">
        <p>Generated on ${formatDateToDMY(new Date())}</p>
      </div>
    </div>
  </body>
</html>`;
  };

  const loadPaymentDetails = async (paymentId) => {
    try {
      const payment = paymentHistory.find((p) => p.id === paymentId);
      if (!payment) return;

      const allSoldBills = await getSoldBills();
      const allReturns = await getPharmacyReturns(payment.pharmacyId, payment.selectedReturns || []);

      const soldDetails = allSoldBills
        .filter((bill) => payment.selectedSoldBills?.includes(bill.id))
        .map((bill) => {
          const { totalUSD, totalIQD } = computeBillTotals(bill);
          return {
            ...bill,
            displayAmount: getDisplayAmount(totalUSD, totalIQD),
            billNote: bill.note || "",
          };
        });

      const returnDetails = allReturns
        .filter((ret) => payment.selectedReturns?.includes(ret.id))
        .map((ret) => {
          const { returnUSD, returnIQD } = computeReturnTotals(ret);
          return {
            ...ret,
            displayAmount: getDisplayAmount(returnUSD, returnIQD),
          };
        });

      setPaymentDetails((prev) => ({
        ...prev,
        [paymentId]: { soldBills: soldDetails, returns: returnDetails },
      }));
    } catch (err) {
      console.error("Error loading payment details:", err);
    }
  };

  const resetAdvancedSearch = () =>
    setAdvancedSearch({ pharmacyName: "", hardcopyBillNumber: "", soldBillNumber: "", returnBillNumber: "", paymentNumber: "", createdBy: "", dateFrom: "", dateTo: "", amountMinUSD: "", amountMaxUSD: "", amountMinIQD: "", amountMaxIQD: "" });

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

      if (key === 'paymentDate') {
        const dateA = a.paymentDate?.toDate ? a.paymentDate.toDate() : new Date(a.paymentDate || 0);
        const dateB = b.paymentDate?.toDate ? b.paymentDate.toDate() : new Date(b.paymentDate || 0);
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (key === 'paymentNumber') {
        return direction === 'asc' ? (a.paymentNumber || '').localeCompare(b.paymentNumber || '') : (b.paymentNumber || '').localeCompare(a.paymentNumber || '');
      } else if (key === 'pharmacyName') {
        return direction === 'asc' ? (a.pharmacyName || '').localeCompare(b.pharmacyName || '') : (b.pharmacyName || '').localeCompare(a.pharmacyName || '');
      } else if (key === 'hardcopyBillNumber') {
        return direction === 'asc' ? (a.hardcopyBillNumber || '').localeCompare(b.hardcopyBillNumber || '') : (b.hardcopyBillNumber || '').localeCompare(a.hardcopyBillNumber || '');
      } else if (key === 'netAmountUSD') {
        return direction === 'asc' ? (a.netAmountUSD || 0) - (b.netAmountUSD || 0) : (b.netAmountUSD || 0) - (a.netAmountUSD || 0);
      } else if (key === 'netAmountIQD') {
        return direction === 'asc' ? (a.netAmountIQD || 0) - (b.netAmountIQD || 0) : (b.netAmountIQD || 0) - (a.netAmountIQD || 0);
      } else if (key === 'billNumbers') {
        const countA = a.selectedSoldBills?.length || 0;
        const countB = b.selectedSoldBills?.length || 0;
        return direction === 'asc' ? countA - countB : countB - countA;
      } else if (key === 'returnNumbers') {
        const countA = a.selectedReturns?.length || 0;
        const countB = b.selectedReturns?.length || 0;
        return direction === 'asc' ? countA - countB : countB - countA;
      } else if (key === 'notes') {
        const noteA = (a.notes || '').trim();
        const noteB = (b.notes || '').trim();
        return direction === 'asc' ? noteA.localeCompare(noteB) : noteB.localeCompare(noteA);
      } else if (key === 'createdByName') {
        const nameA = getFirstName(a.createdByName);
        const nameB = getFirstName(b.createdByName);
        return direction === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
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
          payment.pharmacyName?.toLowerCase().includes(s) ||
          getFirstName(payment.createdByName).toLowerCase().includes(s) ||
          payment.hardcopyBillNumber?.toLowerCase().includes(s) ||
          payment.notes?.toLowerCase().includes(s) ||
          String(payment.netAmountUSD || "").includes(s) ||
          String(payment.netAmountIQD || "").includes(s) ||
          getBillNumbers(payment).some((n) => n.toLowerCase().includes(s)) ||
          getReturnNumbers(payment).some((n) => n.toLowerCase().includes(s));
        if (!basicMatch) return false;
      }

      if (showAdvancedSearch) {
        if (advancedSearch.pharmacyName && !payment.pharmacyName?.toLowerCase().includes(advancedSearch.pharmacyName.toLowerCase())) return false;
        if (advancedSearch.hardcopyBillNumber && !payment.hardcopyBillNumber?.toLowerCase().includes(advancedSearch.hardcopyBillNumber.toLowerCase())) return false;
        if (advancedSearch.paymentNumber && !payment.paymentNumber?.toLowerCase().includes(advancedSearch.paymentNumber.toLowerCase())) return false;
        if (advancedSearch.createdBy) {
          const creatorMatch = (payment.createdByName || "").toLowerCase().includes(advancedSearch.createdBy.toLowerCase()) ||
                               (payment.createdBy || "").toLowerCase() === advancedSearch.createdBy.toLowerCase();
          if (!creatorMatch) return false;
        }
        if (advancedSearch.soldBillNumber) {
          const searchBill = advancedSearch.soldBillNumber.toLowerCase();
          const numberMatch = getBillNumbers(payment).some((n) => n.toLowerCase().includes(searchBill));
          const idMatch = payment.selectedSoldBills?.some((billId) => billId.toLowerCase().includes(searchBill));
          if (!numberMatch && !idMatch) return false;
        }
        if (advancedSearch.returnBillNumber) {
          const searchRet = advancedSearch.returnBillNumber.toLowerCase();
          const numberMatch = getReturnNumbers(payment).some((n) => n.toLowerCase().includes(searchRet));
          const idMatch = payment.selectedReturns?.some((retId) => retId.toLowerCase().includes(searchRet));
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
        if (columnKey === 'pharmacyName') itemValue = payment.pharmacyName || '';
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
  }, [paymentHistory, sortItems, searchTerm, showAdvancedSearch, advancedSearch, columnFilters, formatDateToDMY, getFirstName, getBillNumbers, getReturnNumbers]);

  // Aggregate values for Table Footer
  const totalNetUSD = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (p.netAmountUSD || 0), 0);
  }, [filteredPayments]);

  const totalNetIQD = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (p.netAmountIQD || 0), 0);
  }, [filteredPayments]);

  const formatPaymentNumber = (payment) => {
    if (!payment.paymentNumber) {
      const year = new Date(payment.createdAt?.toDate ? payment.createdAt.toDate() : payment.createdAt || Date.now()).getFullYear();
      return `SPAY-${year}-${payment.id.slice(-4).toUpperCase()}`;
    }
    return payment.paymentNumber;
  };

  const inputStyle = {
    width: "100%",
    padding: "0.75rem",
    border: "1px solid #D1D5DB",
    borderRadius: "0.75rem",
    fontSize: "0.875rem",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "white" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "3rem", height: "3rem", border: "3px solid #F3F4F6", borderTop: "3px solid #3B82F6", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }}></div>
          <p style={{ marginTop: "1rem", color: "#6B7280" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: "0.5rem", background: "white", fontFamily: "var(--font-nrt-reg)", boxSizing: "border-box", overflowX: "hidden", margin: 0 }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; }
        @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
        @keyframes shake { 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-6px);} 40%,80%{transform:translateX(6px);} }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
        .hardcopy-error-shake { animation: shake 0.4s ease; }
        input:focus, textarea:focus, select:focus { outline: 2px solid #3B82F6; outline-offset: 1px; }
        .adv-input { width:100%; padding:0.6rem 0.75rem; border:1px solid #D1D5DB; border-radius:0.6rem; font-size:0.8rem; font-family:inherit; box-sizing:border-box; }
        .adv-input:focus { outline:2px solid #3B82F6; }
        .grid-3col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        .grid-2col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
        @media (max-width: 900px) {
          .grid-3col { grid-template-columns: 1fr 1fr; }
          .grid-2col { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .grid-3col { grid-template-columns: 1fr; }
          .summary-row { flex-direction: column !important; }
          .summary-operator { display: none !important; }
          .info-modal-grid { grid-template-columns: 1fr !important; }
          .adv-grid-3 { grid-template-columns: 1fr !important; }
          .adv-grid-2 { grid-template-columns: 1fr !important; }
        }
        .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .img-btn-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        @media (max-width: 480px) {
          .img-btn-row { flex-direction: column; }
        }
        .bill-item {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .bill-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .bill-actions {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .bill-actions button {
          padding: 0.25rem 0.6rem;
          border: none;
          border-radius: 0.4rem;
          cursor: pointer;
          font-size: 0.7rem;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        .bill-actions button:active {
          transform: scale(0.95);
        }
        .detail-item {
          border-bottom: 1px solid #f3f4f6;
          padding: 0.5rem 0;
        }
        .detail-item:last-child {
          border-bottom: none;
        }
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

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEF2F2", border: `1px solid ${colorScheme.danger}`, borderRadius: "0.75rem", marginBottom: "1rem" }}>
          <p style={{ color: colorScheme.danger, margin: 0 }}>❌ {error}</p>
        </div>
      )}
      {success && (
        <div style={{ padding: "1rem", backgroundColor: "#F0FDF4", border: `1px solid ${colorScheme.success}`, borderRadius: "0.75rem", marginBottom: "1rem" }}>
          <p style={{ color: colorScheme.success, margin: 0 }}>✅ {success}</p>
        </div>
      )}

      {/* Main Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem", width: "100%" }}>

        {/* Pharmacy Information */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "0.5rem", border: "1px solid #E5E7EB", padding: "1rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "700", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "2px solid #3B82F6", color: colorScheme.text }}>
            🏪 Pharmacy Information
          </h2>
          <div className="grid-3col">
            <div style={{ position: "relative" }} ref={pharmacyDropdownRef}>
              <label style={labelStyle}>Select Pharmacy *</label>
              <div style={{ position: "relative" }}>
                <input ref={pharmacyInputRef} type="text" value={pharmacySearchTerm} onChange={handlePharmacyInputChange} 
                  onFocus={() => setShowPharmacyDropdown(true)}
                  onClick={() => setShowPharmacyDropdown(!showPharmacyDropdown)}
                  placeholder="Type or select pharmacy..." style={{ ...inputStyle, paddingRight: "2rem" }} />
                <div onClick={() => setShowPharmacyDropdown(!showPharmacyDropdown)}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: colorScheme.textLight }}>
                  ▼
                </div>
              </div>
              {showPharmacyDropdown && filteredPharmacies.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: "200px", overflowY: "auto", backgroundColor: "white", border: "1px solid #D1D5DB", borderRadius: "0.75rem", marginTop: "0.25rem", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                  {filteredPharmacies.map((pharmacy) => (
                    <div key={pharmacy.id} onClick={() => handleSelectPharmacy(pharmacy)}
                      style={{ padding: "0.75rem", cursor: "pointer", borderBottom: "1px solid #E5E7EB", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#EFF6FF"}
                      onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <div style={{ fontWeight: "600", fontSize: "0.875rem" }}>{pharmacy.name}</div>
                      {pharmacy.code && <div style={{ fontSize: "0.75rem", color: colorScheme.textLight }}>Code: {pharmacy.code}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

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

            <div>
              <label style={labelStyle}>Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Bill Image Section */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "0.5rem", border: "1px solid #E5E7EB", padding: "1rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "700", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "2px solid #3B82F6", color: colorScheme.text }}>
            📷 Bill Image
          </h2>

          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
          <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleCameraChange} style={{ display: "none" }} />

          <div style={{ display: "grid", gridTemplateColumns: billImageData ? "1fr auto" : "1fr", gap: "1.5rem", alignItems: "start" }}>
            <div>
              <label style={labelStyle}>Upload Bill Image (Optional)</label>

              <div className="img-btn-row">
                <button type="button" onClick={triggerFileInput} disabled={imageProcessing}
                  style={{ flex: 1, padding: "0.75rem", backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: "0.75rem", fontSize: "0.875rem", fontWeight: "500", cursor: imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s", textAlign: "center" }}
                  onMouseEnter={e => { if (!imageProcessing) e.currentTarget.style.background = "#E5E7EB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#F3F4F6"; }}>
                  {imageProcessing ? "⏳ Processing..." : "🖼️ Choose from Gallery"}
                </button>
                <button type="button" onClick={triggerCameraInput} disabled={imageProcessing}
                  style={{ flex: 1, padding: "0.75rem", backgroundColor: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE", borderRadius: "0.75rem", fontSize: "0.875rem", fontWeight: "500", cursor: imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s", textAlign: "center" }}
                  onMouseEnter={e => { if (!imageProcessing) e.currentTarget.style.background = "#DBEAFE"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#EFF6FF"; }}>
                  📸 Take Photo
                </button>
              </div>

              {imageProcessing && (
                <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.75rem", backgroundColor: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: "0.5rem", fontSize: "0.8rem", color: "#1E40AF", fontWeight: "600", animation: "pulse 1.5s infinite" }}>
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
                  {imageHasChanged ? "ℹ️ Image removed — will be cleared on save" : "ℹ️ Keeping original image (upload new to replace)"}
                </div>
              )}
            </div>

            {billImageData && !imageProcessing && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "0.7rem", color: colorScheme.textLight, marginBottom: "0.4rem" }}>Preview</p>
                <img src={billImageData} alt="Bill Preview"
                  style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "0.5rem", border: "1px solid #E5E7EB", cursor: "pointer", filter: "grayscale(100%)" }}
                  onClick={() => handleViewImage(billImageData)} />
                <button type="button" onClick={removeImage}
                  style={{ display: "block", margin: "0.4rem auto 0", fontSize: "0.7rem", color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  ✕ Remove image
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bills & Returns Selection */}
        <div className="grid-2col">
          {/* Sold Bills */}
          <div style={{ backgroundColor: colorScheme.card, borderRadius: "0.5rem", border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)", padding: "0.75rem 1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "white", margin: 0 }}>💰 Sold Bills ({soldBills.length})</h2>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {selectedSoldBills.length > 0 && (
                    <button onClick={() => setSelectedSoldBills([])} style={{ backgroundColor: "rgba(239, 68, 68, 0.25)", color: "#FEE2E2", padding: "0.35rem 0.75rem", borderRadius: "0.6rem", border: "1px solid rgba(239, 68, 68, 0.4)", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit", fontWeight: "600" }}>
                      ✕ Clear ({selectedSoldBills.length})
                    </button>
                  )}
                  {!isEditMode && soldBills.length > 0 && (
                    <button onClick={selectAllSoldBills} style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", padding: "0.4rem 0.9rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" }}>
                      {selectedSoldBills.length === soldBills.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>
              </div>
              {selectedSoldBills.length > 0 && <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#BFDBFE" }}>{selectedSoldBills.length} selected</div>}
            </div>
            <div style={{ padding: "0.75rem" }}>
              {soldBills.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <input
                    type="text"
                    placeholder="🔍 Search by bill # or item name..."
                    value={billSearchTerm}
                    onChange={(e) => setBillSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.6rem",
                      fontSize: "0.8rem",
                      fontFamily: "inherit",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              )}
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {loading ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: colorScheme.textLight }}>Loading...</div>
                ) : soldBills.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>{selectedPharmacy ? "No unpaid bills available" : "Select a pharmacy first"}</div>
                ) : getFilteredBills().length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>No bills match your search</div>
                ) : (
                  getFilteredBills().map((bill) => {
                    const isSelected = selectedSoldBills.includes(bill.id);
                    const billNote = bill.billNote || bill.note || "";
                    
                    const { totalUSD, totalIQD, currency } = computeBillTotals(bill);
                    const displayAmount = getDisplayAmount(totalUSD, totalIQD);

                    return (
                      <div key={bill.id} className="bill-item"
                        onClick={() => toggleSoldBill(bill.id)}
                        style={{ 
                          padding: "0.85rem", 
                          marginBottom: "0.6rem", 
                          border: isSelected ? "2px solid #3B82F6" : "1px solid #E5E7EB", 
                          backgroundColor: isSelected ? "#EFF6FF" : "white", 
                          borderRadius: "0.75rem" 
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: "bold", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span>Bill #{bill.billNumber}</span>
                              <span style={{ fontSize: "0.7rem", backgroundColor: currency === "IQD" ? "#dbeafe" : "#dcfce7", color: currency === "IQD" ? "#1e40af" : "#15803d", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                {currency}
                              </span>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: colorScheme.textLight, marginTop: "0.2rem" }}>
                              {formatDateToDMY(bill.date)}
                              {bill.items?.length > 0 && <span style={{ marginLeft: "0.5rem" }}>• {bill.items.length} item{bill.items.length !== 1 ? "s" : ""}</span>}
                            </div>
                            {billNote && <div style={{ fontSize: "0.7rem", color: "#6B7280", marginTop: "0.25rem", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {billNote}</div>}
                          </div>
                          <div style={{ textAlign: "right", marginLeft: "0.5rem", flexShrink: 0 }}>
                            <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#059669" }}>+{displayAmount}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.4rem", flexWrap: "wrap", gap: "0.3rem" }}>
                          <div className="bill-actions">
                            <button onClick={(e) => { e.stopPropagation(); viewBillDetails(bill.id); }}
                              style={{ backgroundColor: "#6B7280", color: "white" }}>
                              👁️ View
                            </button>
                          </div>
                          <div style={{ fontSize: "0.7rem", color: isSelected ? "#3B82F6" : "#10B981", fontWeight: "600" }}>
                            {isSelected ? "✓ Selected" : "● Unpaid"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Returns */}
          <div style={{ backgroundColor: colorScheme.card, borderRadius: "0.5rem", border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", padding: "0.75rem 1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "white", margin: 0 }}>🔄 Returns ({returns.length})</h2>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {selectedSoldReturns.length > 0 && (
                    <button onClick={() => setSelectedSoldReturns([])} style={{ backgroundColor: "rgba(239, 68, 68, 0.25)", color: "#FEE2E2", padding: "0.35rem 0.75rem", borderRadius: "0.6rem", border: "1px solid rgba(239, 68, 68, 0.4)", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit", fontWeight: "600" }}>
                      ✕ Clear ({selectedSoldReturns.length})
                    </button>
                  )}
                  {!isEditMode && returns.length > 0 && (
                    <button onClick={selectAllSoldReturns} style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", padding: "0.4rem 0.9rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" }}>
                      {selectedSoldReturns.length === returns.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>
              </div>
              {selectedSoldReturns.length > 0 && <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#FDE68A" }}>{selectedSoldReturns.length} selected</div>}
            </div>
            <div style={{ padding: "0.75rem" }}>
              {returns.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <input
                    type="text"
                    placeholder="🔍 Search by return # or item name..."
                    value={returnSearchTerm}
                    onChange={(e) => setReturnSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.6rem",
                      fontSize: "0.8rem",
                      fontFamily: "inherit",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              )}
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {loading ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: colorScheme.textLight }}>Loading...</div>
                ) : returns.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>{selectedPharmacy ? "No unprocessed returns available" : "Select a pharmacy first"}</div>
                ) : getFilteredReturns().length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>No returns match your search</div>
                ) : (
                  getFilteredReturns().map((returnBill) => {
                    const isSelected = selectedSoldReturns.includes(returnBill.id);
                    const retNote = returnBill.returnNote || returnBill.note || "";
                    const { returnUSD, returnIQD } = computeReturnTotals(returnBill);
                    const displayAmount = getDisplayAmount(returnUSD, returnIQD);
                    const returnNumberDisplay = returnBill.returnBillNumber || returnBill.pharmacyReturnBillNumber || `RET-${returnBill.id?.slice(-6)}`;
                    
                    return (
                      <div key={returnBill.id} className="bill-item"
                        onClick={() => toggleSoldReturn(returnBill.id)}
                        style={{ 
                          padding: "0.85rem", 
                          marginBottom: "0.6rem", 
                          border: isSelected ? "2px solid #F59E0B" : "1px solid #E5E7EB", 
                          backgroundColor: isSelected ? "#FFFBEB" : "white", 
                          borderRadius: "0.75rem" 
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: "bold", fontSize: "0.875rem" }}>Return #{returnNumberDisplay}</div>
                            <div style={{ fontSize: "0.75rem", color: colorScheme.textLight, marginTop: "0.2rem" }}>
                              {formatDateToDMY(returnBill.returnDate || returnBill.date)}
                              {returnBill.items?.length > 0 && <span style={{ marginLeft: "0.5rem" }}>• {returnBill.items.length} item{returnBill.items.length !== 1 ? "s" : ""}</span>}
                            </div>
                            {retNote && <div style={{ fontSize: "0.7rem", color: "#6B7280", marginTop: "0.25rem", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {retNote}</div>}
                          </div>
                          <div style={{ textAlign: "right", marginLeft: "0.5rem", flexShrink: 0 }}>
                            <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#dc2626" }}>-{displayAmount}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.4rem", flexWrap: "wrap", gap: "0.3rem" }}>
                          <div className="bill-actions">
                            <button onClick={(e) => { e.stopPropagation(); viewReturnDetails(returnBill.id); }}
                              style={{ backgroundColor: "#6B7280", color: "white" }}>
                              👁️️ View
                            </button>
                          </div>
                          <div style={{ fontSize: "0.7rem", color: isSelected ? "#F59E0B" : "#EF4444", fontWeight: "600" }}>
                            {isSelected ? "✓ Selected" : "● Unprocessed"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "0.5rem", border: "1px solid #E5E7EB", padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "2px solid #3B82F6" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: "700", color: colorScheme.text, margin: 0 }}>💰 Payment Summary</h2>
            {(selectedSoldBills.length > 0 || selectedSoldReturns.length > 0) && (
              <button onClick={clearSelection} style={{ padding: "0.3rem 0.8rem", backgroundColor: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: "700" }}>
                ✕ Clear All Selected ({selectedSoldBills.length + selectedSoldReturns.length})
              </button>
            )}
          </div>
          <div className="summary-row" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "stretch" }}>
            <div style={{ flex: "1 1 0", minWidth: "120px", padding: "0.85rem 1rem", backgroundColor: "#F0FDF9", borderRadius: "0.75rem", border: "1px solid #A7F3D0" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: "700", color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>💰 Total Sold</div>
              {currencyTotals.soldUSD > 0 && <div style={{ color: "#059669", fontWeight: "700", fontSize: "0.95rem" }}>+{formatUSD(currencyTotals.soldUSD)}</div>}
              {currencyTotals.soldIQD > 0 && <div style={{ color: "#3B82F6", fontWeight: "700", fontSize: "0.95rem" }}>+{formatIQD(currencyTotals.soldIQD)}</div>}
              {currencyTotals.soldUSD === 0 && currencyTotals.soldIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>—</div>}
            </div>
            <div className="summary-operator" style={{ display: "flex", alignItems: "center", fontSize: "1.25rem", color: colorScheme.textLight, flexShrink: 0 }}>−</div>
            <div style={{ flex: "1 1 0", minWidth: "120px", padding: "0.85rem 1rem", backgroundColor: "#FEF2F2", borderRadius: "0.75rem", border: "1px solid #FECACA" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: "700", color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>🔄 Total Return</div>
              {currencyTotals.returnUSD > 0 && <div style={{ color: "#dc2626", fontWeight: "700", fontSize: "0.95rem" }}>−{formatUSD(currencyTotals.returnUSD)}</div>}
              {currencyTotals.returnIQD > 0 && <div style={{ color: "#b91c1c", fontWeight: "700", fontSize: "0.95rem" }}>−{formatIQD(currencyTotals.returnIQD)}</div>}
              {currencyTotals.returnUSD === 0 && currencyTotals.returnIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>—</div>}
            </div>
            <div className="summary-operator" style={{ display: "flex", alignItems: "center", fontSize: "1.25rem", color: colorScheme.textLight, flexShrink: 0 }}>=</div>
            <div style={{ flex: "1 1 0", minWidth: "120px", padding: "0.85rem 1rem", background: "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)", borderRadius: "0.75rem", border: "1px solid #93C5FD" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: "700", color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>💰 Net Amount</div>
              {currencyTotals.netUSD !== 0 && <div style={{ fontWeight: "800", fontSize: "1rem", color: currencyTotals.netUSD > 0 ? "#059669" : "#dc2626" }}>{currencyTotals.netUSD > 0 ? "+" : ""}{formatUSD(currencyTotals.netUSD)}</div>}
              {currencyTotals.netIQD !== 0 && <div style={{ fontWeight: "800", fontSize: "1rem", color: currencyTotals.netIQD > 0 ? "#3B82F6" : "#b91c1c" }}>{currencyTotals.netIQD > 0 ? "+" : ""}{formatIQD(currencyTotals.netIQD)}</div>}
              {currencyTotals.netUSD === 0 && currencyTotals.netIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>—</div>}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "0.5rem", border: "1px solid #E5E7EB", padding: "1rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid #93C5FD", color: colorScheme.text }}>📝 Payment Notes</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }} placeholder="Add notes about this payment..." />
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {isEditMode && (
            <button onClick={handleCancelEdit} disabled={submitting}
              style={{ flex: "1 1 120px", padding: "0.9rem", backgroundColor: colorScheme.textLight, color: "white", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem", fontWeight: "600" }}>
              Cancel
            </button>
          )}
          {(selectedSoldBills.length > 0 || selectedSoldReturns.length > 0) && (
            <button onClick={clearSelection} disabled={submitting}
              style={{ padding: "0.9rem 1.25rem", backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem", fontWeight: "700" }}>
              ✕ Cancel Selection
            </button>
          )}
          <button onClick={handleSubmit} disabled={submitting || imageProcessing}
            style={{ flex: "2 1 200px", padding: "0.9rem", background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)", color: "white", border: "none", borderRadius: "0.75rem", cursor: submitting || imageProcessing ? "not-allowed" : "pointer", opacity: submitting || imageProcessing ? 0.8 : 1, fontFamily: "inherit", fontSize: "0.95rem", fontWeight: "700" }}>
            {imageProcessing ? "⚙️ Processing image..." : submitting ? "⏳ Saving..." : isEditMode ? (imageHasChanged ? "✏️ Update Payment (Image Changed)" : "✏️ Update Payment") : "✅ Create Payment"}
          </button>
        </div>
      </div>

      {/* Payment History Table Section */}
      <div style={{ backgroundColor: colorScheme.card, borderRadius: "0.5rem", border: "1px solid #E5E7EB", overflow: "hidden", width: "100%" }}>
        <div style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)", padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "white", margin: 0 }}>📋 Sold Payment History</h2>
          {paymentHistory.length > 0 && <div style={{ fontSize: "0.8rem", color: "#BFDBFE", marginTop: "0.25rem" }}>{filteredPayments.length} of {paymentHistory.length} payments</div>}
        </div>

        <div style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <input type="text" placeholder="🔍 Quick search: pharmacy, payment #, hardcopy, bill #, notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: "1 1 200px", padding: "0.75rem 1rem", border: "1px solid #D1D5DB", borderRadius: "0.75rem", fontSize: "0.875rem", fontFamily: "inherit", boxSizing: "border-box" }} />
            
            {Object.keys(columnFilters).length > 0 && (
              <button onClick={() => setColumnFilters({})}
                style={{ padding: "0.75rem 1rem", backgroundColor: "#fee2e2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap" }}>
                ✕ Clear Header Filters
              </button>
            )}

            <button onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              style={{ padding: "0.75rem 1.25rem", backgroundColor: showAdvancedSearch ? "#3B82F6" : colorScheme.textLight, color: "white", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap" }}>
              {showAdvancedSearch ? "▲ Hide Advanced" : "▼ Advanced Search"}
            </button>
          </div>

          {showAdvancedSearch && (
            <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <span style={{ fontWeight: "700", fontSize: "0.9rem", color: colorScheme.text }}>🔍 Advanced Search Filters</span>
                <button onClick={resetAdvancedSearch} style={{ padding: "0.35rem 0.9rem", backgroundColor: "#E5E7EB", color: "#374151", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: "600" }}>✕ Clear All</button>
              </div>
              <div className="adv-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🏪 Pharmacy Name</label>
                  <input className="adv-input" type="text" placeholder="e.g. Aran Pharmacy" value={advancedSearch.pharmacyName} onChange={e => setAdvancedSearch(p => ({ ...p, pharmacyName: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🔖 Payment Number</label>
                  <input className="adv-input" type="text" placeholder="e.g. SPAY-2026-..." value={advancedSearch.paymentNumber} onChange={e => setAdvancedSearch(p => ({ ...p, paymentNumber: e.target.value }))} />
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
              <div className="adv-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>💰 Sold Bill Number</label>
                  <input className="adv-input" type="text" placeholder="Bill number" value={advancedSearch.soldBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, soldBillNumber: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🔄 Return Bill Number</label>
                  <input className="adv-input" type="text" placeholder="Return number" value={advancedSearch.returnBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, returnBillNumber: e.target.value }))} />
                </div>
              </div>
              <div className="adv-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📅 Payment Date — From</label>
                  <input className="adv-input" type="date" value={advancedSearch.dateFrom} onChange={e => setAdvancedSearch(p => ({ ...p, dateFrom: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📅 Payment Date — To</label>
                  <input className="adv-input" type="date" value={advancedSearch.dateTo} onChange={e => setAdvancedSearch(p => ({ ...p, dateTo: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ ...labelStyle, fontSize: "0.72rem" }}>💵 Net Amount USD — Range</label>
                <div className="adv-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
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
                <div className="adv-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#3B82F6", fontWeight: "600", fontSize: "0.7rem" }}>IQD</span>
                    <input className="adv-input" type="number" placeholder="Min IQD" style={{ paddingRight: "3rem" }} value={advancedSearch.amountMinIQD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMinIQD: e.target.value }))} />
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#3B82F6", fontWeight: "600", fontSize: "0.7rem" }}>IQD</span>
                    <input className="adv-input" type="number" placeholder="Max IQD" style={{ paddingRight: "3rem" }} value={advancedSearch.amountMaxIQD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMaxIQD: e.target.value }))} />
                  </div>
                </div>
              </div>
              {Object.values(advancedSearch).some(v => v !== "") && (
                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", backgroundColor: "#DBEAFE", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#1E40AF", fontWeight: "600" }}>
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
                  <TableHeader title="Pharmacy Name" columnKey="pharmacyName" colWidth="auto" {...headerCommon} />
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
                      Loading payment history...
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
                        <td style={{ padding: "12px 10px", fontWeight: "600", color: "#1E40AF", borderRight: "1px solid #E5E7EB" }}>
                          {displayNumber}
                        </td>
                        <td style={{ padding: "12px 10px", fontWeight: "500", color: colorScheme.text, borderRight: "1px solid #E5E7EB" }}>
                          {payment.pharmacyName || "—"}
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
                          {netIQD !== 0 ? (netIQD > 0 ? `+${formatIQD(netIQD)}` : formatIQD(netIQD)) : "—"}
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
                              style={{ padding: "0.3rem 0.5rem", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: "600", fontSize: "0.72rem" }} title="Edit Payment">
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
                    {formatIQD(totalNetIQD)}
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

      {/* Payment Details Statement Modal */}
      {showPaymentModal && selectedPayment && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: "750px", maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: "1rem", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)", padding: "1.25rem 1.5rem", borderRadius: "1rem 1rem 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ color: "white", margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>Payment Details</h2>
                <div style={{ color: "#BFDBFE", fontSize: "0.8rem", marginTop: "0.2rem" }}>{formatPaymentNumber(selectedPayment)}</div>
              </div>
              <button onClick={closePaymentModal} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", fontSize: "1.25rem", cursor: "pointer", borderRadius: "0.5rem", padding: "0.25rem 0.6rem", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <div className="info-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem", padding: "1rem", background: "#F8FAFC", borderRadius: "0.75rem" }}>
                <div><div style={{ fontSize: "0.7rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", marginBottom: "0.2rem" }}>Pharmacy</div><div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{selectedPayment.pharmacyName}</div></div>
                <div><div style={{ fontSize: "0.7rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", marginBottom: "0.2rem" }}>Hardcopy Bill</div><div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{selectedPayment.hardcopyBillNumber}</div></div>
                <div><div style={{ fontSize: "0.7rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", marginBottom: "0.2rem" }}>Payment Date</div><div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{formatDateToDMY(selectedPayment.paymentDate)}</div></div>
                <div><div style={{ fontSize: "0.7rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", marginBottom: "0.2rem" }}>Created By</div><div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{getFirstName(selectedPayment.createdByName)}</div></div>
              </div>

              {/* Sold Bills Table */}
              {paymentDetails[selectedPayment.id]?.soldBills?.length > 0 ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.75rem", color: colorScheme.text }}>💰 Sold Bills ({paymentDetails[selectedPayment.id].soldBills.length})</h3>
                  <div className="table-scroll">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Bill #</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Date</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Note</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentDetails[selectedPayment.id].soldBills.map((bill) => (
                          <tr key={bill.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                            <td style={{ padding: "8px 10px", fontWeight: "600" }}>#{bill.billNumber || bill.id}</td>
                            <td style={{ padding: "8px 10px", color: colorScheme.textLight }}>{formatDateToDMY(bill.date)}</td>
                            <td style={{ padding: "8px 10px", color: colorScheme.textLight, fontStyle: "italic", fontSize: "0.78rem" }}>{bill.billNote || "—"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", color: "#059669" }}>
                              +{bill.displayAmount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: "1.25rem", padding: "0.75rem", background: "#F9FAFB", borderRadius: "0.5rem", fontSize: "0.82rem", color: colorScheme.textLight, textAlign: "center" }}>
                  {paymentDetails[selectedPayment.id] ? "No sold bills in this payment" : "Loading sold bills..."}
                </div>
              )}

              {/* Returns Table */}
              {paymentDetails[selectedPayment.id]?.returns?.length > 0 ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.75rem", color: colorScheme.text }}>🔄 Returns ({paymentDetails[selectedPayment.id].returns.length})</h3>
                  <div className="table-scroll">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Return #</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Date</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Note</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentDetails[selectedPayment.id].returns.map((ret) => (
                          <tr key={ret.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                            <td style={{ padding: "8px 10px", fontWeight: "600" }}>{ret.returnBillNumber || ret.id}</td>
                            <td style={{ padding: "8px 10px", color: colorScheme.textLight }}>{formatDateToDMY(ret.returnDate)}</td>
                            <td style={{ padding: "8px 10px", color: colorScheme.textLight, fontStyle: "italic", fontSize: "0.78rem" }}>{ret.returnNote || "—"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", color: "#dc2626" }}>
                              -{ret.displayAmount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* Net Amount */}
              <div style={{ padding: "1rem", background: "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)", borderRadius: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ fontWeight: "700", marginBottom: "0.5rem", fontSize: "0.85rem", color: "#1E40AF" }}>💰 Net Amount Paid</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#1E40AF" }}>
                  {(() => {
                    const netUSD = selectedPayment.netAmountUSD || 0;
                    const netIQD = selectedPayment.netAmountIQD || 0;
                    const parts = [];
                    if (Math.abs(netUSD) > 0.001) parts.push(<span key="usd" style={{ color: netUSD < 0 ? '#dc2626' : '#059669' }}>{netUSD < 0 ? formatUSD(netUSD) : `+${formatUSD(netUSD)}`}</span>);
                    if (Math.abs(netIQD) > 0.5) parts.push(<span key="iqd" style={{ color: netIQD < 0 ? '#dc2626' : '#059669' }}>{netIQD < 0 ? formatIQD(netIQD) : `+${formatIQD(netIQD)}`}</span>);
                    
                    if (parts.length === 0) return <span style={{ color: '#6b7280' }}>0 IQD</span>;
                    
                    return (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {parts.map((part, i) => (
                          <span key={i}>{part}{i < parts.length - 1 ? <span style={{ color: '#1E40AF' }}> and </span> : ''}</span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {selectedPayment.notes && (
                <div style={{ marginBottom: "1rem", padding: "0.85rem", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "0.75rem", fontSize: "0.85rem" }}>
                  <strong>📝 Notes:</strong>
                  <p style={{ margin: "0.3rem 0 0", color: colorScheme.textLight }}>{selectedPayment.notes}</p>
                </div>
              )}

              {getPaymentImage(selectedPayment) && (
                <div style={{ textAlign: "center" }}>
                  <img src={getPaymentImage(selectedPayment)} alt="Bill"
                    style={{ maxWidth: "250px", maxHeight: "250px", borderRadius: "0.5rem", cursor: "pointer", border: "1px solid #E5E7EB", filter: "grayscale(100%)" }}
                    onClick={() => handleViewImage(getPaymentImage(selectedPayment), selectedPayment)} />
                  <div style={{ fontSize: "0.72rem", color: colorScheme.textLight, marginTop: "0.3rem" }}>Click image to enlarge, replace or delete</div>
                </div>
              )}
              
              <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => handleDeletePayment(selectedPayment.id)}
                  style={{ padding: "0.6rem 1.2rem", backgroundColor: "#EF4444", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.85rem", fontFamily: "inherit" }}>
                  🗑️ Delete Payment
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Fast Detail Modal for viewing bill/return items */}
      {showDetailModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500, padding: "1rem", overflowY: "auto" }}
          onClick={closeDetailModal}>
          <div style={{ width: "100%", maxWidth: "650px", maxHeight: "85vh", overflowY: "auto", background: "white", borderRadius: "1rem", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", padding: "1.5rem" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "2px solid #E5E7EB" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: colorScheme.text, margin: 0 }}>
                {detailType === "bill" ? "💰 " : "🔄 "}{detailTitle}
              </h2>
              <button onClick={closeDetailModal} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: colorScheme.textLight }}>✕</button>
            </div>

            {detailLoading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>Loading details...</div>
            ) : detailItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>No items found</div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "#F3F4F6", borderRadius: "0.5rem", fontWeight: "700", fontSize: "0.8rem", color: colorScheme.textLight, marginBottom: "0.5rem" }}>
                  <span>Item</span>
                  <span style={{ textAlign: "right" }}>Qty</span>
                  <span style={{ textAlign: "right" }}>Price</span>
                  <span style={{ textAlign: "right" }}>Total</span>
                </div>
                {detailItems.map((item, index) => (
                  <div key={index} className="detail-item" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.5rem", padding: "0.6rem 0.75rem", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "0.85rem" }}>{item.name}</div>
                      <div style={{ fontSize: "0.7rem", color: colorScheme.textLight }}>{item.barcode}</div>
                    </div>
                    <div style={{ textAlign: "right", fontWeight: "600", fontSize: "0.85rem" }}>{item.quantity}</div>
                    <div style={{ textAlign: "right", fontSize: "0.85rem" }}>{item.displayPrice}</div>
                    <div style={{ textAlign: "right", fontWeight: "700", fontSize: "0.9rem", color: detailType === "bill" ? "#059669" : "#dc2626" }}>
                      {detailType === "bill" ? "+" : "-"}{item.displayTotal}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "1.25rem", paddingTop: "0.75rem", borderTop: "1px solid #E5E7EB", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={closeDetailModal} style={{ padding: "0.5rem 1.5rem", backgroundColor: "#6B7280", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "600" }}>
                Close
              </button>
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
                <Paperclip size={18} color="#2563EB" /> Attach Bill Image
              </h3>
              <button onClick={() => { if (!attachUploading) { setAttachModalOpen(false); setAttachTargetPayment(null); } }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", fontSize: "1.1rem" }}>✕</button>
            </div>

            <p style={{ fontSize: "0.85rem", color: colorScheme.textLight, marginBottom: "1.25rem" }}>
              Attach a physical receipt or bill picture to payment <strong>{formatPaymentNumber(attachTargetPayment)}</strong> ({attachTargetPayment.pharmacyName}).
            </p>

            <input type="file" ref={quickFileInputRef} accept="image/*" onChange={(e) => { handleQuickImageSelected(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />
            <input type="file" ref={quickCameraInputRef} accept="image/*" capture="environment" onChange={(e) => { handleQuickImageSelected(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              <button type="button" onClick={() => quickFileInputRef.current?.click()} disabled={attachUploading}
                style={{ padding: "0.85rem", backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: "600", cursor: attachUploading ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <ImageIcon size={20} color="#4B5563" /> Choose from Gallery
              </button>
              <button type="button" onClick={() => quickCameraInputRef.current?.click()} disabled={attachUploading}
                style={{ padding: "0.85rem", backgroundColor: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: "600", cursor: attachUploading ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <Camera size={20} color="#2563EB" /> Take Photo
              </button>
            </div>

            {attachUploading && (
              <div style={{ textAlign: "center", color: "#2563EB", fontSize: "0.85rem", fontWeight: "600", padding: "0.5rem" }}>
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

      {/* Image Modal (with Replace / Delete for attached payment images) */}
      {showImageModal && selectedImageUrl && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}
          onClick={closeImageModal}>
          <div style={{ maxWidth: "92vw", maxHeight: "92vh", background: "white", borderRadius: "0.75rem", padding: "0.75rem", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            {imageModalPayment && (
              <div style={{ textAlign: "center", fontSize: "0.8rem", fontWeight: "600", color: colorScheme.textLight, marginBottom: "0.5rem" }}>
                {formatPaymentNumber(imageModalPayment)} — {imageModalPayment.pharmacyName}
              </div>
            )}

            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", justifyContent: "center", position: "relative" }}>
              <img src={selectedImageUrl} alt="Full Bill" style={{ maxWidth: "100%", maxHeight: imageModalPayment ? "68vh" : "80vh", objectFit: "contain", display: "block", filter: "grayscale(100%)", opacity: imageActionLoading ? 0.5 : 1 }} />
            </div>

            {imageModalPayment && (
              <>
                <input type="file" ref={replaceFileInputRef} accept="image/*" onChange={(e) => { handleReplaceImageSelected(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />
                <input type="file" ref={replaceCameraInputRef} accept="image/*" capture="environment" onChange={(e) => { handleReplaceImageSelected(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />

                {(imageActionLoading || imageProcessing) && (
                  <div style={{ marginTop: "0.6rem", textAlign: "center", color: "#2563EB", fontSize: "0.82rem", fontWeight: "600", animation: "pulse 1.5s infinite" }}>
                    ⏳ Saving changes...
                  </div>
                )}

                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
                  <button type="button" onClick={() => replaceFileInputRef.current?.click()} disabled={imageActionLoading || imageProcessing}
                    style={{ padding: "0.5rem 1rem", backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: "0.5rem", cursor: imageActionLoading || imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: "600", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <ImageIcon size={15} /> Replace from Gallery
                  </button>
                  <button type="button" onClick={() => replaceCameraInputRef.current?.click()} disabled={imageActionLoading || imageProcessing}
                    style={{ padding: "0.5rem 1rem", backgroundColor: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE", borderRadius: "0.5rem", cursor: imageActionLoading || imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: "600", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Camera size={15} /> Replace with Photo
                  </button>
                  <button type="button" onClick={handleDeleteAttachedImage} disabled={imageActionLoading || imageProcessing}
                    style={{ padding: "0.5rem 1rem", backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: "0.5rem", cursor: imageActionLoading || imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: "700", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    🗑️ Delete Image
                  </button>
                </div>
              </>
            )}

            <div style={{ textAlign: "center", marginTop: "0.6rem" }}>
              <button onClick={closeImageModal} disabled={imageActionLoading}
                style={{ padding: "0.5rem 1.5rem", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: "0.5rem", cursor: imageActionLoading ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: "600" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}