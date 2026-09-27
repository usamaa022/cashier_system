"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getExpenses, createExpense, deleteExpense, toFirestoreTimestamp } from "@/lib/data";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as XLSX from 'xlsx';
import { 
  PlusCircle, 
  Trash2, 
  Search, 
  Filter, 
  X, 
  TrendingDown,
  Edit,
  FileSpreadsheet,
  Camera,
  Image as ImageIcon,
  Download,
  Paperclip
} from "lucide-react";

const CATEGORIES = [
  "Rent", 
  "Utilities (Electricity/Water)", 
  "Salaries", 
  "Transportation", 
  "Maintenance", 
  "Marketing", 
  "Office Supplies", 
  "General / Miscellaneous"
];

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

const nrtFontStyle = {
  fontFamily: 'var(--font-nrt-regular), "NRT Regular", Tahoma, sans-serif',
};

const nrtFontBoldStyle = {
  fontFamily: 'var(--font-nrt-bold), "NRT Bold", Tahoma, sans-serif',
  fontWeight: '700',
};

// --- Helper Functions ---
const formatDateDisplay = (dateVal) => {
  if (!dateVal) return "N/A";
  try {
    let d;
    if (dateVal?.toDate) d = dateVal.toDate();
    else if (dateVal?.seconds) d = new Date(dateVal.seconds * 1000);
    else if (dateVal instanceof Date) d = dateVal;
    else if (typeof dateVal === 'string') d = new Date(dateVal);
    else return "N/A";

    if (isNaN(d.getTime())) return "N/A";
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return "N/A";
  }
};

const formatUSD = (amount) => {
  if (amount === undefined || amount === null || Math.abs(amount) < 0.001) return "-";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatIQD = (amount) => {
  if (amount === undefined || amount === null || Math.abs(amount) < 0.5) return "-";
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(amount)) + " IQD";
};

const getDisplayNameOnly = (fullNameOrEmail) => {
  if (!fullNameOrEmail) return "Unknown";
  const part = fullNameOrEmail.split("@")[0];
  return part.charAt(0).toUpperCase() + part.slice(1);
};

// --- Date Range & Excel Filter Dropdown Component ---
const ExcelFilterDropdown = ({ 
  columnKey, 
  type = "string",
  alignLeft = false,
  expensesList,
  columnFilters,
  activeFilterDropdown,
  setActiveFilterDropdown,
  handleUpdateColumnFilter,
  clearColumnFilter
}) => {
  const [search, setSearch] = useState("");
  const isOpen = activeFilterDropdown === columnKey;
  const operators = type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;

  const filterState = columnFilters[columnKey] || { 
    operator: columnKey === 'date' ? 'dateRange' : operators[0].value, 
    textValue: '', 
    selectedValues: [],
    startDate: '',
    endDate: '' 
  };
  const { operator, textValue, selectedValues, startDate, endDate } = filterState;

  const uniqueValues = useMemo(() => {
    const vals = new Set();
    expensesList.forEach(item => {
      let val = "";
      if (columnKey === 'date') val = formatDateDisplay(item.date);
      if (columnKey === 'title') val = item.title;
      if (columnKey === 'category') val = item.category;
      if (columnKey === 'branch') val = item.branch;
      if (columnKey === 'amountUSD') val = item.currency === "USD" ? item.amount : "";
      if (columnKey === 'amountIQD') val = item.currency === "IQD" ? item.amount : "";
      if (columnKey === 'createdByName') val = getDisplayNameOnly(item.createdByName || "Unknown");
      if (columnKey === 'attachment') val = item.attachment ? "Yes" : "No";
      if (columnKey === 'note') val = item.note || "";

      if (val !== "") vals.add(String(val ?? ""));
    });
    return Array.from(vals).sort();
  }, [expensesList, columnKey]);

  const displayValues = uniqueValues.filter(v => v.toLowerCase().includes(search.toLowerCase()));
  const isActive = !!(textValue || startDate || endDate || (selectedValues && selectedValues.length > 0));

  const handleCheckbox = (val, checked) => {
    const current = selectedValues || [];
    const updated = checked ? [...current, val] : current.filter(v => v !== val);
    handleUpdateColumnFilter(columnKey, { selectedValues: updated });
  };

  const handleSelectAll = (checked) => {
    handleUpdateColumnFilter(columnKey, { selectedValues: checked ? [...uniqueValues] : [] });
  };

  return (
    <div className="filter-dropdown-container" style={{ position: "relative", display: "inline-block" }}>
      <div
        onClick={(e) => { 
          e.stopPropagation(); 
          setActiveFilterDropdown(isOpen ? null : columnKey); 
        }}
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

      {isOpen && (
        <div 
          style={{ 
            position: "absolute", 
            top: "100%", 
            ...(alignLeft ? { left: 0, right: "auto" } : { right: 0, left: "auto" }),
            marginTop: "0.5rem", 
            background: "white", 
            border: "1px solid #cbd5e1", 
            borderRadius: "0.5rem", 
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)", 
            zIndex: 99999, 
            width: "280px", 
            maxWidth: "85vw", 
            display: "flex", 
            flexDirection: "column", 
            cursor: "default", 
            overflow: "hidden", 
            color: "#2c3e50" 
          }} 
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p style={{ margin: "0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>
              {columnKey === 'date' ? "Filter Date Range (DD/MM/YYYY)" : "Condition"}
            </p>

            {columnKey === 'date' ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", width: "40px" }}>From:</span>
                  <input
                    type="date"
                    value={startDate || ""}
                    onChange={(e) => handleUpdateColumnFilter(columnKey, { startDate: e.target.value, operator: 'dateRange' })}
                    style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none", backgroundColor: "white" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", width: "40px" }}>To:</span>
                  <input
                    type="date"
                    value={endDate || ""}
                    onChange={(e) => handleUpdateColumnFilter(columnKey, { endDate: e.target.value, operator: 'dateRange' })}
                    style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none", backgroundColor: "white" }}
                  />
                </div>
              </div>
            ) : (
              <>
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
                    style={{ width: "100%", boxSizing: "border-box", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none", backgroundColor: "white", color: "#2c3e50" }}
                  />
                )}
              </>
            )}
          </div>

          {columnKey !== 'date' && (
            <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", flex: 1, boxSizing: "border-box" }}>
              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Values</p>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", marginBottom: "0.5rem", boxSizing: "border-box", backgroundColor: "white" }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search values..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{ border: "none", outline: "none", width: "100%", boxSizing: "border-box", fontSize: "0.875rem", marginLeft: "0.5rem", backgroundColor: "transparent" }}
                />
              </div>

              <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", fontWeight: "500", borderBottom: "1px solid #f1f5f9" }}>
                  <input
                    type="checkbox"
                    checked={selectedValues.length === uniqueValues.length && uniqueValues.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}
                  />
                  <span>(Select All)</span>
                </label>
                {displayValues.map(val => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", color: "#1e293b" }}>
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
          )}

          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc", boxSizing: "border-box" }}>
            <button onClick={() => clearColumnFilter(columnKey)} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: "0.875rem", cursor: "pointer", fontWeight: 600 }}>Clear</button>
            <button onClick={() => setActiveFilterDropdown(null)} style={{ background: "#2563eb", border: "none", color: "white", fontSize: "0.875rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
};

const TableHeader = ({ 
  title, 
  columnKey, 
  type = "string", 
  colWidth,
  alignLeft = false,
  sortConfig,
  handleSort,
  getSortIcon,
  expensesList,
  columnFilters,
  activeFilterDropdown,
  setActiveFilterDropdown,
  handleUpdateColumnFilter,
  clearColumnFilter
}) => {
  const isActive = activeFilterDropdown === columnKey;
  return (
    <th style={{
      backgroundColor: "#34495e", color: "white", padding: "14px 12px",
      textAlign: "left", fontSize: "14px", fontFamily: "'NRT-Bd', sans-serif",
      whiteSpace: "nowrap", borderRight: "1px solid #576574",
      width: colWidth || "auto",
      minWidth: colWidth || "auto",
      position: "relative",
      zIndex: isActive ? 9999 : 1
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div onClick={() => handleSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
          {title}
          <span style={{ fontSize: "11px", color: "#bdc3c7" }}>
            {getSortIcon(columnKey)}
          </span>
        </div>
        <ExcelFilterDropdown 
          columnKey={columnKey} 
          type={type} 
          alignLeft={alignLeft}
          expensesList={expensesList}
          columnFilters={columnFilters}
          activeFilterDropdown={activeFilterDropdown}
          setActiveFilterDropdown={setActiveFilterDropdown}
          handleUpdateColumnFilter={handleUpdateColumnFilter}
          clearColumnFilter={clearColumnFilter}
        />
      </div>
    </th>
  );
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form State (Add / Edit Modal)
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    currency: "USD",
    category: "General",
    date: new Date().toISOString().split("T")[0],
    branch: user?.branch || "Slemany",
    note: "",
    attachment: null
  });

  // Full Screen Image Viewer Modal
  const [fullScreenImage, setFullScreenImage] = useState(null);

  // Hidden File & Camera Input Refs (Canvas Compression Approach)
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Sorting & Column Filters
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);

  const isSuperAdmin = user?.role === "superAdmin" || (user?.role || "").toLowerCase() === "superadmin";

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchExpenses();
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

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await getExpenses();
      setExpenses(data);
    } catch (err) {
      console.error("Error loading expenses:", err);
      setError("Failed to load expenses list.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditId(null);
    setForm({
      title: "",
      amount: "",
      currency: "USD",
      category: "General",
      date: new Date().toISOString().split("T")[0],
      branch: user?.branch || "Slemany",
      note: "",
      attachment: null
    });
    setShowModal(true);
    setError(null);
  };

  const handleOpenEdit = (item) => {
    setIsEditing(true);
    setEditId(item.id);
    const d = new Date(item.date);
    const dateFormatted = !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
    
    setForm({
      title: item.title || "",
      amount: item.amount || "",
      currency: item.currency || "USD",
      category: item.category || "General",
      date: dateFormatted,
      branch: item.branch || (user?.branch || "Slemany"),
      note: item.note || "",
      attachment: item.attachment || null
    });
    setShowModal(true);
    setError(null);
  };

  // Canvas Image Compression (Converts image to lightweight Base64 string directly)
  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = img.width;
            let height = img.height;
            const maxWidth = 800;
            if (width > maxWidth) {
              height = (maxWidth / width) * height;
              width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            const compressedImage = canvas.toDataURL('image/jpeg', 0.85);
            setForm(prev => ({ ...prev, attachment: compressedImage }));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please select a valid image file.');
      }
    }
  };

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const downloadImage = (imageData) => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `expense_receipt_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.amount || !form.date) {
      setError("Please fill in all required fields.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const userDisplayName = getDisplayNameOnly(user?.name || user?.email || "Unknown");

      if (isEditing && editId) {
        const expenseRef = doc(db, "expenses", editId);
        await updateDoc(expenseRef, {
          title: form.title.trim(),
          amount: parseFloat(form.amount),
          currency: form.currency,
          category: form.category,
          date: toFirestoreTimestamp(form.date),
          branch: isSuperAdmin ? form.branch : (user?.branch || "Slemany"),
          note: form.note ? form.note.trim() : "",
          attachment: form.attachment || null,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || "unknown"
        });
        setSuccess("Expense updated successfully!");
      } else {
        await createExpense({
          ...form,
          amount: parseFloat(form.amount),
          branch: isSuperAdmin ? form.branch : (user?.branch || "Slemany"),
          attachment: form.attachment || null,
          createdBy: user?.uid || "unknown",
          createdByName: userDisplayName
        });
        setSuccess("Expense recorded successfully!");
      }

      setShowModal(false);
      await fetchExpenses();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      console.error("Error saving expense:", err);
      setError(err.message || "Failed to save expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense record?")) return;
    try {
      setError(null);
      await deleteExpense(id);
      setSuccess("Expense deleted successfully.");
      setExpenses(prev => prev.filter(item => item.id !== id));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting expense:", err);
      setError("Failed to delete expense record.");
    }
  };

  const handleUpdateColumnFilter = useCallback((columnKey, updates) => {
    setColumnFilters(prev => {
      const current = prev[columnKey] || { operator: '', textValue: '', selectedValues: [], startDate: '', endDate: '' };
      const next = { ...current, ...updates };
      if (!next.operator && !next.textValue && !next.startDate && !next.endDate && (!next.selectedValues || next.selectedValues.length === 0)) {
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

  const evaluateFilter = (itemValue, filterData, type = "string", rawItemDate = null) => {
    if (!filterData) return true;
    const { operator, textValue, selectedValues, startDate, endDate } = filterData;

    if (operator === 'dateRange' && rawItemDate) {
      const itemTime = new Date(rawItemDate).setHours(0,0,0,0);
      if (startDate) {
        const startTime = new Date(startDate).setHours(0,0,0,0);
        if (itemTime < startTime) return false;
      }
      if (endDate) {
        const endTime = new Date(endDate).setHours(23,59,59,999);
        if (itemTime > endTime) return false;
      }
      return true;
    }

    if (selectedValues && selectedValues.length > 0) {
      if (!selectedValues.includes(String(itemValue))) return false;
    }

    if (operator && (textValue !== "" || ['isEmpty', 'isNotEmpty'].includes(operator))) {
      const valStr = String(itemValue || '').toLowerCase();
      const searchStr = String(textValue).toLowerCase();
      const valNum = Number(itemValue);
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
        case 'isEmpty': return !itemValue || itemValue === "N/A" || itemValue === "-";
        case 'isNotEmpty': return !!itemValue && itemValue !== "N/A" && itemValue !== "-";
        default: return true;
      }
    }
    return true;
  };

  const sortItems = useCallback((items) => {
    return [...items].sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction;
      let valA, valB;

      if (key === 'date') {
        valA = new Date(a.date).getTime() || 0;
        valB = new Date(b.date).getTime() || 0;
      } else if (key === 'title') {
        valA = a.title || ''; valB = b.title || '';
      } else if (key === 'category') {
        valA = a.category || ''; valB = b.category || '';
      } else if (key === 'branch') {
        valA = a.branch || ''; valB = b.branch || '';
      } else if (key === 'amountUSD') {
        valA = a.currency === 'USD' ? Number(a.amount) || 0 : 0;
        valB = b.currency === 'USD' ? Number(b.amount) || 0 : 0;
      } else if (key === 'amountIQD') {
        valA = a.currency === 'IQD' ? Number(a.amount) || 0 : 0;
        valB = b.currency === 'IQD' ? Number(b.amount) || 0 : 0;
      } else if (key === 'attachment') {
        valA = a.attachment ? 1 : 0;
        valB = b.attachment ? 1 : 0;
      } else if (key === 'createdByName') {
        valA = a.createdByName || ''; valB = b.createdByName || '';
      } else {
        valA = a[key] || ''; valB = b[key] || '';
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return direction === 'asc' ? valA.localeCompare(valB) : b.localeCompare(valA);
      }
      return direction === 'asc' ? valA - valB : valB - valA;
    });
  }, [sortConfig]);

  const handleSort = (key) => {
    const newDirection = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction: newDirection });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Filter and Search Logic with Branch Isolation
  const filteredExpenses = useMemo(() => {
    const baseList = expenses.filter(item => {
      if (!isSuperAdmin && user?.branch) {
        return (item.branch || "").toLowerCase() === user.branch.toLowerCase();
      }
      return true;
    });

    const sorted = sortItems(baseList);

    return sorted.filter(item => {
      for (const [columnKey, filterData] of Object.entries(columnFilters)) {
        let itemValue = "";
        if (columnKey === 'date') itemValue = formatDateDisplay(item.date);
        if (columnKey === 'title') itemValue = item.title;
        if (columnKey === 'category') itemValue = item.category;
        if (columnKey === 'branch') itemValue = item.branch;
        if (columnKey === 'amountUSD') itemValue = item.currency === 'USD' ? item.amount : "";
        if (columnKey === 'amountIQD') itemValue = item.currency === 'IQD' ? item.amount : "";
        if (columnKey === 'attachment') itemValue = item.attachment ? "Yes" : "No";
        if (columnKey === 'createdByName') itemValue = getDisplayNameOnly(item.createdByName || "Unknown");
        if (columnKey === 'note') itemValue = item.note || "";

        const isNum = ['amountUSD', 'amountIQD'].includes(columnKey);
        if (!evaluateFilter(itemValue, filterData, isNum ? "number" : "string", columnKey === 'date' ? item.date : null)) return false;
      }
      return true;
    });
  }, [expenses, isSuperAdmin, user, sortItems, columnFilters]);

  const totals = useMemo(() => {
    let usd = 0;
    let iqd = 0;
    filteredExpenses.forEach(item => {
      if (item.currency === "USD") usd += Number(item.amount) || 0;
      else iqd += Number(item.amount) || 0;
    });
    return { usd, iqd };
  }, [filteredExpenses]);

  // Export to Excel function
  const exportToExcel = () => {
    try {
      const exportData = filteredExpenses.map(item => {
        const row = {
          'Date': formatDateDisplay(item.date),
          'Expense Title': item.title,
          'Category': item.category,
          'Branch': item.branch,
          'Amount (USD)': item.currency === 'USD' ? item.amount : '-',
          'Amount (IQD)': item.currency === 'IQD' ? item.amount : '-',
          'Has Attachment': item.attachment ? "Yes" : "No",
          'Note / Description': item.note || ""
        };
        if (isSuperAdmin) {
          row['Created By'] = getDisplayNameOnly(item.createdByName || 'Unknown');
        }
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Store Expenses");

      const date = new Date();
      const dateStr = `${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}`;
      const filename = `store_expenses_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error("Error exporting expenses to Excel:", error);
      setError("Failed to export data to Excel.");
    }
  };

  if (!user || loading) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <div style={{ width: "40px", height: "40px", border: "3px solid #cbd5e1", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style jsx>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const tableColSpan = isSuperAdmin ? 10 : 9;

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#f8fafc", padding: 0, margin: 0, ...nrtFontStyle, boxSizing: "border-box", overflowX: "hidden" }}>
      <div style={{ width: "100%", margin: 0, padding: 0, boxSizing: "border-box" }}>
        
        {/* Header Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px", padding: "20px 20px 0 20px", width: "100%", boxSizing: "border-box" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "10px", ...nrtFontBoldStyle }}>
              <TrendingDown color="#ef4444" size={30} /> Store Expenses
            </h1>
            <p style={{ color: "#64748b", fontSize: "15px", margin: 0 }}>
              {isSuperAdmin ? "Manage and filter operational store expenses across all branches." : `Managing operational expenses for branch: ${user.branch}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={exportToExcel}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                transition: "all 0.2s"
              }}
            >
              <FileSpreadsheet size={18} /> Export to Excel
            </button>
            <button
              onClick={handleOpenAdd}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
                transition: "all 0.2s"
              }}
            >
              <PlusCircle size={18} /> Add New Expense
            </button>
          </div>
        </div>

        {/* Success / Error Banners */}
        <div style={{ padding: "0 20px", width: "100%", boxSizing: "border-box" }}>
          {error && (
            <div style={{ padding: "12px 16px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b", marginBottom: "16px", fontSize: "14px", fontWeight: "600" }}>
              ❌ {error}
            </div>
          )}
          {success && (
            <div style={{ padding: "12px 16px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534", marginBottom: "16px", fontSize: "14px", fontWeight: "600" }}>
              ✅ {success}
            </div>
          )}
        </div>

        {/* Totals Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "20px", padding: "0 20px", width: "100%", boxSizing: "border-box" }}>
          <div style={{ backgroundColor: "white", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>Total Expenses (USD)</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#ef4444" }}>
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.usd)}
            </div>
          </div>
          <div style={{ backgroundColor: "white", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>Total Expenses (IQD)</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#ef4444" }}>
              {new Intl.NumberFormat('en-US').format(Math.round(totals.iqd))} IQD
            </div>
          </div>
          <div style={{ backgroundColor: "white", padding: "18px 20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>Filtered Records</div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#2563eb" }}>
              {filteredExpenses.length} <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "normal" }}>items</span>
            </div>
          </div>
        </div>

        {/* Expenses Table with Excel Filters */}
        <div style={{ backgroundColor: "white", borderRadius: 0, borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", boxShadow: "none", width: "100%", margin: 0 }}>
          <div style={{ overflowX: "auto", minHeight: "60vh", maxHeight: "80vh", width: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px", minWidth: "1200px" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr style={{ backgroundColor: "#34495e", color: "white", borderBottom: "1px solid #475569" }}>
                  <TableHeader 
                    title="Date" 
                    columnKey="date" 
                    colWidth="130px" 
                    alignLeft={true}
                    sortConfig={sortConfig} 
                    handleSort={handleSort} 
                    getSortIcon={getSortIcon} 
                    expensesList={expenses} 
                    columnFilters={columnFilters} 
                    activeFilterDropdown={activeFilterDropdown} 
                    setActiveFilterDropdown={setActiveFilterDropdown} 
                    handleUpdateColumnFilter={handleUpdateColumnFilter} 
                    clearColumnFilter={clearColumnFilter} 
                  />
                  <TableHeader 
                    title="Expense Title" 
                    columnKey="title" 
                    colWidth="auto" 
                    sortConfig={sortConfig} 
                    handleSort={handleSort} 
                    getSortIcon={getSortIcon} 
                    expensesList={expenses} 
                    columnFilters={columnFilters} 
                    activeFilterDropdown={activeFilterDropdown} 
                    setActiveFilterDropdown={setActiveFilterDropdown} 
                    handleUpdateColumnFilter={handleUpdateColumnFilter} 
                    clearColumnFilter={clearColumnFilter} 
                  />
                  <TableHeader 
                    title="Category" 
                    columnKey="category" 
                    colWidth="180px" 
                    sortConfig={sortConfig} 
                    handleSort={handleSort} 
                    getSortIcon={getSortIcon} 
                    expensesList={expenses} 
                    columnFilters={columnFilters} 
                    activeFilterDropdown={activeFilterDropdown} 
                    setActiveFilterDropdown={setActiveFilterDropdown} 
                    handleUpdateColumnFilter={handleUpdateColumnFilter} 
                    clearColumnFilter={clearColumnFilter} 
                  />
                  <TableHeader 
                    title="Branch" 
                    columnKey="branch" 
                    colWidth="110px" 
                    sortConfig={sortConfig} 
                    handleSort={handleSort} 
                    getSortIcon={getSortIcon} 
                    expensesList={expenses} 
                    columnFilters={columnFilters} 
                    activeFilterDropdown={activeFilterDropdown} 
                    setActiveFilterDropdown={setActiveFilterDropdown} 
                    handleUpdateColumnFilter={handleUpdateColumnFilter} 
                    clearColumnFilter={clearColumnFilter} 
                  />
                  <TableHeader 
                    title="Amount (USD)" 
                    columnKey="amountUSD" 
                    type="number"
                    colWidth="140px" 
                    sortConfig={sortConfig} 
                    handleSort={handleSort} 
                    getSortIcon={getSortIcon} 
                    expensesList={expenses} 
                    columnFilters={columnFilters} 
                    activeFilterDropdown={activeFilterDropdown} 
                    setActiveFilterDropdown={setActiveFilterDropdown} 
                    handleUpdateColumnFilter={handleUpdateColumnFilter} 
                    clearColumnFilter={clearColumnFilter} 
                  />
                  <TableHeader 
                    title="Amount (IQD)" 
                    columnKey="amountIQD" 
                    type="number"
                    colWidth="150px" 
                    sortConfig={sortConfig} 
                    handleSort={handleSort} 
                    getSortIcon={getSortIcon} 
                    expensesList={expenses} 
                    columnFilters={columnFilters} 
                    activeFilterDropdown={activeFilterDropdown} 
                    setActiveFilterDropdown={setActiveFilterDropdown} 
                    handleUpdateColumnFilter={handleUpdateColumnFilter} 
                    clearColumnFilter={clearColumnFilter} 
                  />
                  <TableHeader 
                    title="Attachment" 
                    columnKey="attachment" 
                    type="string"
                    colWidth="120px" 
                    sortConfig={sortConfig} 
                    handleSort={handleSort} 
                    getSortIcon={getSortIcon} 
                    expensesList={expenses} 
                    columnFilters={columnFilters} 
                    activeFilterDropdown={activeFilterDropdown} 
                    setActiveFilterDropdown={setActiveFilterDropdown} 
                    handleUpdateColumnFilter={handleUpdateColumnFilter} 
                    clearColumnFilter={clearColumnFilter} 
                  />
                  {isSuperAdmin && (
                    <TableHeader 
                      title="Created By" 
                      columnKey="createdByName" 
                      colWidth="140px" 
                      sortConfig={sortConfig} 
                      handleSort={handleSort} 
                      getSortIcon={getSortIcon} 
                      expensesList={expenses} 
                      columnFilters={columnFilters} 
                      activeFilterDropdown={activeFilterDropdown} 
                      setActiveFilterDropdown={setActiveFilterDropdown} 
                      handleUpdateColumnFilter={handleUpdateColumnFilter} 
                      clearColumnFilter={clearColumnFilter} 
                    />
                  )}
                  <TableHeader 
                    title="Note / Description" 
                    columnKey="note" 
                    colWidth="240px" 
                    sortConfig={sortConfig} 
                    handleSort={handleSort} 
                    getSortIcon={getSortIcon} 
                    expensesList={expenses} 
                    columnFilters={columnFilters} 
                    activeFilterDropdown={activeFilterDropdown} 
                    setActiveFilterDropdown={setActiveFilterDropdown} 
                    handleUpdateColumnFilter={handleUpdateColumnFilter} 
                    clearColumnFilter={clearColumnFilter} 
                  />
                  <th style={{ padding: "14px 16px", fontWeight: "700", textAlign: "center", width: "130px", backgroundColor: "#34495e", color: "white" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={tableColSpan} style={{ padding: "60px", textAlign: "center", color: "#64748b", fontSize: "15px" }}>
                      No expense records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((item, idx) => {
                    const isUSD = item.currency === "USD";
                    return (
                      <tr key={item.id || idx} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: idx % 2 === 0 ? "white" : "#fafafa" }}>
                        <td style={{ padding: "16px", color: "#475569", whiteSpace: "nowrap" }}>
                          {formatDateDisplay(item.date)}
                        </td>
                        <td style={{ padding: "16px", fontWeight: "700", color: "#0f172a" }}>
                          {item.title}
                        </td>
                        <td style={{ padding: "16px" }}>
                          <span style={{ backgroundColor: "#e2e8f0", color: "#334155", padding: "4px 10px", borderRadius: "6px", fontSize: "13px", fontWeight: "600" }}>
                            {item.category}
                          </span>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <span style={{ backgroundColor: item.branch === "Slemany" ? "#dcfce7" : "#fef3c7", color: item.branch === "Slemany" ? "#166534" : "#92400e", padding: "4px 10px", borderRadius: "6px", fontSize: "13px", fontWeight: "700" }}>
                            {item.branch}
                          </span>
                        </td>
                        <td style={{ padding: "16px", textAlign: "right", fontWeight: "800", color: isUSD ? "#059669" : "#94a3b8", fontSize: "15px" }}>
                          {isUSD ? formatUSD(item.amount) : "—"}
                        </td>
                        <td style={{ padding: "16px", textAlign: "right", fontWeight: "800", color: !isUSD ? "#d97706" : "#94a3b8", fontSize: "15px" }}>
                          {!isUSD ? formatIQD(item.amount) : "—"}
                        </td>
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          {item.attachment ? (
                            <button
                              type="button"
                              onClick={() => setFullScreenImage(item.attachment)}
                              style={{
                                background: "#dcfce7",
                                border: "1px solid #bbf7d0",
                                color: "#166534",
                                borderRadius: "6px",
                                padding: "4px 8px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "600",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              title="Click to view full image"
                            >
                              <Paperclip size={13} /> View
                            </button>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                          )}
                        </td>
                        {isSuperAdmin && (
                          <td style={{ padding: "16px", color: "#475569", fontWeight: "600", fontSize: "13px" }}>
                            {getDisplayNameOnly(item.createdByName || "Unknown")}
                          </td>
                        )}
                        <td style={{ padding: "16px", color: "#64748b", maxWidth: "240px", wordBreak: "break-word", fontSize: "13px" }}>
                          {item.note || "—"}
                        </td>
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              style={{ padding: "6px 12px", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <Edit size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              style={{ padding: "6px 12px", backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add / Edit Expense Modal */}
        {showModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
            <div style={{ backgroundColor: "white", borderRadius: "12px", width: "100%", maxWidth: "540px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", ...nrtFontStyle }}>
              <div style={{ background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)", padding: "16px 20px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 20 }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", ...nrtFontBoldStyle }}>
                  {isEditing ? "Edit Expense Record" : "Insert New Expense"}
                </h3>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "white", fontSize: "18px", cursor: "pointer" }}><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Expense Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Office electricity bill"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", outline: "none" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Amount *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", outline: "none" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Currency *</label>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", outline: "none", backgroundColor: "white" }}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="IQD">IQD (د.ع)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Category *</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", outline: "none", backgroundColor: "white" }}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Branch *</label>
                    <select
                      value={form.branch}
                      disabled={!isSuperAdmin}
                      onChange={(e) => setForm({ ...form, branch: e.target.value })}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", outline: "none", backgroundColor: isSuperAdmin ? "white" : "#f1f5f9", cursor: isSuperAdmin ? "pointer" : "not-allowed" }}
                    >
                      <option value="Slemany">Slemany</option>
                      <option value="Erbil">Erbil</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Date *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", outline: "none" }}
                  />
                </div>

                {/* Attachment Section (Canvas compression matching BuyingList) */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                    Bill / Receipt Picture
                  </label>
                  
                  {form.attachment ? (
                    <div style={{ border: "2px solid #e2e8f0", borderRadius: "8px", padding: "10px", backgroundColor: "#f8fafc", textAlign: "center" }}>
                      <img 
                        src={form.attachment} 
                        alt="Receipt Preview" 
                        style={{ maxHeight: "180px", maxWidth: "100%", objectFit: "contain", borderRadius: "6px", cursor: "zoom-in", margin: "0 auto", display: "block" }} 
                        onClick={() => setFullScreenImage(form.attachment)}
                        title="Click to zoom in"
                      />
                      <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "10px" }}>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, attachment: null }))}
                          style={{ padding: "6px 12px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <X size={14} /> Remove Picture
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Hidden File Inputs */}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept="image/*" 
                        style={{ display: "none" }} 
                      />
                      <input 
                        type="file" 
                        ref={cameraInputRef} 
                        onChange={handleFileUpload} 
                        accept="image/*" 
                        capture="environment" 
                        style={{ display: "none" }} 
                      />

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <button
                          type="button"
                          onClick={triggerFileInput}
                          style={{ padding: "10px", backgroundColor: "#f1f5f9", border: "1px dashed #cbd5e1", borderRadius: "8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", color: "#475569", fontWeight: "600", fontSize: "13px" }}
                        >
                          <ImageIcon size={20} color="#64748b" /> Choose Image File
                        </button>
                        <button
                          type="button"
                          onClick={handleCameraCapture}
                          style={{ padding: "10px", backgroundColor: "#10b981", border: "none", borderRadius: "8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", color: "white", fontWeight: "600", fontSize: "13px" }}
                        >
                          <Camera size={20} color="white" /> Take Photo
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Note / Description</label>
                  <textarea
                    rows={3}
                    placeholder="Add additional notes or receipt numbers..."
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", outline: "none", resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{ padding: "9px 16px", backgroundColor: "#e2e8f0", color: "#334155", border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ padding: "9px 20px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
                  >
                    {submitting ? "Saving..." : (isEditing ? "Update Expense" : "Save Expense")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Full Screen Image Modal */}
        {fullScreenImage && (
          <div 
            onClick={(e) => { if (e.target === e.currentTarget) setFullScreenImage(null); }}
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100001, padding: "1rem" }}
          >
            <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <img 
                src={fullScreenImage} 
                alt="Full screen attachment" 
                style={{ maxWidth: "90vw", maxHeight: "75vh", objectFit: "contain", borderRadius: "8px" }} 
              />
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button 
                  onClick={() => setFullScreenImage(null)} 
                  style={{ padding: "0.5rem 1rem", border: "none", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", backgroundColor: "#ef4444", color: "white" }}
                >
                  <X size={18} /> Close
                </button>
                <button 
                  onClick={() => downloadImage(fullScreenImage)} 
                  style={{ padding: "0.5rem 1rem", border: "none", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", backgroundColor: "#2563eb", color: "white" }}
                >
                  <Download size={18} /> Save to Gallery
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}