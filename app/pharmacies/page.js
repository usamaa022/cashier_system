"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from 'xlsx';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Download,
  AlertCircle,
  Building2,
  Hash,
  Phone,
  MapPin,
  X,
  CheckCircle2,
  Loader2,
  Filter
} from "lucide-react";
import {
  getPharmacies,
  addPharmacy,
  updatePharmacy,
  deletePharmacy
} from "@/lib/data";

// --- Advanced Filter Operators ---
const STRING_OPERATORS = [
  { value: "contains", label: "لەخۆدەگرێت (Contains)" },
  { value: "equals", label: "یەکسانە بە (Equals)" },
  { value: "startsWith", label: "دەستپێدەکات بە (Starts with)" },
  { value: "endsWith", label: "کۆتایی دێت بە (Ends with)" },
  { value: "isEmpty", label: "بەتاڵە (Is empty)" },
  { value: "isNotEmpty", label: "بەتاڵ نییە (Is not empty)" }
];

const NUMBER_OPERATORS = [
  { value: "equals", label: "یەکسانە بە (Equals)" },
  { value: "notEquals", label: "یەکسان نییە (Not equals)" },
  { value: "greaterThan", label: "> گەورەترە لە" },
  { value: "greaterThanOrEqual", label: ">= گەورەتر یان یەکسانە" },
  { value: "lessThan", label: "< بچووکترە لە" },
  { value: "lessThanOrEqual", label: "<= بچووکتر یان یەکسانە" },
  { value: "isEmpty", label: "بەتاڵە (Is empty)" },
  { value: "isNotEmpty", label: "بەتاڵ نییە (Is not empty)" }
];

// Helper wrapper for input fields
const InputWrapper = ({ label, icon: Icon, children, errorMsg }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
    <label style={{ 
      fontSize: "0.9rem", 
      color: "#475569", 
      display: "flex", 
      alignItems: "center", 
      gap: "0.4rem",
      fontFamily: "var(--font-nrt-bd)"
    }}>
      <Icon size={16} color="#64748b" /> {label}
    </label>
    {children}
    {errorMsg && (
      <span style={{ color: "#ef4444", fontSize: "0.8rem", fontFamily: "var(--font-nrt-reg)" }}>
        {errorMsg}
      </span>
    )}
  </div>
);

// --- Excel Filter Dropdown Component ---
const ExcelFilterDropdown = ({ 
  columnKey, 
  type = "string",
  alignLeft = false,
  pharmacies,
  columnFilters,
  activeFilterDropdown,
  setActiveFilterDropdown,
  handleUpdateColumnFilter,
  clearColumnFilter
}) => {
  const [search, setSearch] = useState("");
  const isOpen = activeFilterDropdown === columnKey;
  const operators = type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;

  const filterState = columnFilters[columnKey] || { operator: operators[0].value, textValue: '', selectedValues: [] };
  const { operator, textValue, selectedValues } = filterState;

  const uniqueValues = useMemo(() => {
    const vals = new Set();
    pharmacies.forEach(item => {
      let val = "";
      if (columnKey === 'name') val = item.name;
      if (columnKey === 'code') val = item.code;
      if (columnKey === 'phone') val = item.phone || '';
      if (columnKey === 'phone2') val = item.phone2 || '';
      if (columnKey === 'city') val = item.city || '';

      vals.add(String(val ?? ""));
    });
    return Array.from(vals).sort();
  }, [pharmacies, columnKey]);

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
          color: isActive ? "#2563eb" : "#94a3b8" 
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
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)", 
            zIndex: 9999, 
            width: "270px", 
            maxWidth: "85vw", 
            display: "flex", 
            flexDirection: "column", 
            cursor: "default", 
            overflow: "hidden", 
            color: "#2c3e50",
            direction: "rtl",
            textAlign: "right"
          }} 
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p style={{ margin: "0", fontSize: "0.75rem", fontWeight: "600", color: "#475569", fontFamily: "var(--font-nrt-bd)" }}>مەرج (Condition)</p>
            <select
              value={operator || operators[0].value}
              onChange={(e) => handleUpdateColumnFilter(columnKey, { operator: e.target.value })}
              style={{ width: "100%", boxSizing: "border-box", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.85rem", outline: "none", background: "white", fontFamily: "var(--font-nrt-reg)" }}
            >
              {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
            {!['isEmpty', 'isNotEmpty'].includes(operator) && (
              <input
                type={type === "number" ? "number" : "text"}
                placeholder="نرخ بنووسە..."
                value={textValue || ""}
                onChange={(e) => handleUpdateColumnFilter(columnKey, { textValue: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ width: "100%", boxSizing: "border-box", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.85rem", outline: "none", fontFamily: "var(--font-nrt-reg)" }}
              />
            )}
          </div>

          <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", flex: 1, boxSizing: "border-box" }}>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569", fontFamily: "var(--font-nrt-bd)" }}>نرخەکان (Values)</p>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", marginBottom: "0.5rem", boxSizing: "border-box" }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="گەڕان لە نرخەکان..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ border: "none", outline: "none", width: "100%", boxSizing: "border-box", fontSize: "0.85rem", marginRight: "0.5rem", fontFamily: "var(--font-nrt-reg)" }}
              />
            </div>

            <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", padding: "0.25rem", cursor: "pointer", fontWeight: "500", borderBottom: "1px solid #f1f5f9", fontFamily: "var(--font-nrt-bd)" }}>
                <input
                  type="checkbox"
                  checked={selectedValues.length === uniqueValues.length && uniqueValues.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}
                />
                <span>(دیاریکردنی هەمووی)</span>
              </label>
              {displayValues.map(val => (
                <label key={val} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", padding: "0.25rem", cursor: "pointer", color: "#1e293b", fontFamily: "var(--font-nrt-reg)" }}>
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(val)}
                    onChange={(e) => handleCheckbox(val, e.target.checked)}
                    style={{ cursor: "pointer", width: "1rem", height: "1rem", accentColor: "#2563eb" }}
                  />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val === "" ? "(بەتاڵ)" : val}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc", boxSizing: "border-box" }}>
            <button onClick={() => clearColumnFilter(columnKey)} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-nrt-bd)" }}>پاککردنەوە</button>
            <button onClick={() => setActiveFilterDropdown(null)} style={{ background: "#2563eb", border: "none", color: "white", fontSize: "0.85rem", padding: "0.4rem 1rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-nrt-bd)" }}>جێبەجێکردن</button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Table Header with Sort & Excel Filter Dropdown ---
const TableHeader = ({ 
  title, 
  columnKey, 
  type = "string", 
  colWidth,
  alignLeft = false,
  sortConfig,
  handleSort,
  pharmacies,
  columnFilters,
  activeFilterDropdown,
  setActiveFilterDropdown,
  handleUpdateColumnFilter,
  clearColumnFilter
}) => {
  const isActive = activeFilterDropdown === columnKey;
  return (
    <th style={{
      backgroundColor: "#34495e", color: "white", padding: "12px 14px",
      textAlign: "right", fontSize: "14px", fontFamily: "var(--font-nrt-bd)",
      whiteSpace: "nowrap", borderLeft: "1px solid #576574",
      width: colWidth || "auto",
      minWidth: colWidth || "auto",
      position: "relative",
      zIndex: isActive ? 9999 : 1
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        <div onClick={() => handleSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", flex: 1, userSelect: "none" }}>
          {title}
          <span style={{ fontSize: "11px", color: "#bdc3c7" }}>
            {sortConfig.key === columnKey ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </div>
        <ExcelFilterDropdown 
          columnKey={columnKey} 
          type={type} 
          alignLeft={alignLeft}
          pharmacies={pharmacies}
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

export default function PharmaciesPage() {
  const [pharmacies, setPharmacies] = useState([]);
  const [editingPharmacy, setEditingPharmacy] = useState(null);
  
  const [newPharmacy, setNewPharmacy] = useState({
    name: "",
    code: "",
    phone: "",
    phone2: "",
    city: "سلێمانی"
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [codeError, setCodeError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  
  // Search query inputs
  const [searchQuery, setSearchQuery] = useState({
    name: "",
    code: "",
    city: ""
  });
  
  // Sorting & Header Column Filter states
  const [sortConfig, setSortConfig] = useState({
    key: "code",
    direction: "desc"
  });
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);

  const cities = [
    "سلێمانی",
    "هەولێر",
    "دهۆک",
    "کەرکوک",
    "کەلار",
    "بەغداد",
    "هەڵەبجە"
  ];

  // Helper: Automatically generate the next available code
  const generateNextCode = (pharmaciesList) => {
    if (!pharmaciesList || pharmaciesList.length === 0) return "1";
    let max = 0;
    pharmaciesList.forEach(p => {
      const num = parseInt((p.code || "").toString().replace(/\D/g, ''));
      if (!isNaN(num) && num > max) max = num;
    });
    return (max + 1).toString();
  };

  const resetForm = (list = pharmacies) => {
    setEditingPharmacy(null);
    setNewPharmacy({ 
      name: "", 
      code: generateNextCode(list), 
      phone: "", 
      phone2: "", 
      city: "سلێمانی" 
    });
    setCodeError("");
  };

  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        setIsLoading(true);
        const data = await getPharmacies();
        setPharmacies(data);
        
        // Auto-assign code if we are not editing
        if (!editingPharmacy) {
          setNewPharmacy(prev => ({ ...prev, code: generateNextCode(data) }));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPharmacies();
  }, [refreshTrigger]);

  // Click outside listener for dropdowns
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

  const evaluateFilter = (itemValue, filterData, type = "string") => {
    if (!filterData) return true;
    const { operator, textValue, selectedValues } = filterData;

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
        case 'isEmpty': return !itemValue || itemValue === "N/A" || itemValue === "-" || itemValue === "---";
        case 'isNotEmpty': return !!itemValue && itemValue !== "N/A" && itemValue !== "-" && itemValue !== "---";
        default: return true;
      }
    }
    return true;
  };

  // Master Filter & Sort Memoization
  const filteredPharmacies = useMemo(() => {
    let result = pharmacies.filter(pharmacy => {
      const matchesName = !searchQuery.name || (pharmacy.name || "").toLowerCase().includes(searchQuery.name.toLowerCase());
      const matchesCode = !searchQuery.code || (pharmacy.code || "").toString().toLowerCase().includes(searchQuery.code.toLowerCase());
      const matchesCity = !searchQuery.city || (pharmacy.city || "").toLowerCase().includes(searchQuery.city.toLowerCase());

      if (!(matchesName && matchesCode && matchesCity)) return false;

      for (const [columnKey, filterData] of Object.entries(columnFilters)) {
        let itemValue = "";
        if (columnKey === 'name') itemValue = pharmacy.name;
        if (columnKey === 'code') itemValue = pharmacy.code;
        if (columnKey === 'phone') itemValue = pharmacy.phone || '';
        if (columnKey === 'phone2') itemValue = pharmacy.phone2 || '';
        if (columnKey === 'city') itemValue = pharmacy.city || '';

        const isNum = columnKey === 'code';
        if (!evaluateFilter(itemValue, filterData, isNum ? "number" : "string")) return false;
      }

      return true;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key] || "";
        let bValue = b[sortConfig.key] || "";
        
        if (sortConfig.key === "code") {
          const aNum = parseFloat(aValue.toString().replace(/[^\d.-]/g, ''));
          const bNum = parseFloat(bValue.toString().replace(/[^\d.-]/g, ''));
          
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
          }
          if (!isNaN(aNum) && isNaN(bNum)) return -1;
          if (isNaN(aNum) && !isNaN(bNum)) return 1;
        }
        
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
        
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [pharmacies, searchQuery, columnFilters, sortConfig]);

  // Validation Helper
  const checkDuplicateCode = (code, currentId = null) => {
    return pharmacies.some(p => p.code.toString().toLowerCase() === code.toString().toLowerCase() && p.id !== currentId);
  };

  const handleAddPharmacy = async () => {
    if (!newPharmacy.name || !newPharmacy.code) {
      setError("تکایە ناو و کۆد پڕبکەرەوە.");
      return;
    }
    if (checkDuplicateCode(newPharmacy.code)) {
      setCodeError("ئەم کۆدە پێشتر بەکارهاتووە! تکایە کۆدێکی تر بنووسە.");
      return;
    }
    
    try {
      await addPharmacy(newPharmacy);
      setRefreshTrigger(!refreshTrigger);
      resetForm(pharmacies);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdatePharmacy = async () => {
    if (!editingPharmacy || !editingPharmacy.id) return;
    if (!editingPharmacy.name || !editingPharmacy.code) {
      setError("تکایە ناو و کۆد پڕبکەرەوە.");
      return;
    }
    if (checkDuplicateCode(editingPharmacy.code, editingPharmacy.id)) {
      setCodeError("ئەم کۆدە پێشتر بۆ دەرمانخانەیەکی تر بەکارهاتووە!");
      return;
    }
    
    try {
      await updatePharmacy(editingPharmacy);
      setRefreshTrigger(!refreshTrigger);
      resetForm(pharmacies);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (pharmacy) => {
    setEditingPharmacy({ ...pharmacy });
    setCodeError("");
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("دڵنیایت دەتەوێت ئەم دەرمانخانەیە بسڕیتەوە؟")) {
      try {
        await deletePharmacy(id);
        setRefreshTrigger(!refreshTrigger);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchQuery(prev => ({ ...prev, [name]: value }));
  };

  const handleFormChange = (e, isEditing) => {
    const { name, value } = e.target;
    
    if (isEditing) {
      setEditingPharmacy(prev => ({ ...prev, [name]: value }));
      if (name === 'code') {
        setCodeError(checkDuplicateCode(value, editingPharmacy.id) ? "ئەم کۆدە پێشتر بەکارهاتووە!" : "");
      }
    } else {
      setNewPharmacy(prev => ({ ...prev, [name]: value }));
      if (name === 'code') {
        setCodeError(checkDuplicateCode(value) ? "ئەم کۆدە پێشتر بەکارهاتووە!" : "");
      }
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleWhatsApp = (phone) => {
    if (!phone) return alert("ژمارەی مۆبایل بۆ ئەم دەرمانخانەیە نییە");
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('964') ? cleanPhone : `964${cleanPhone.replace(/^0+/, '')}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const exportToExcel = () => {
    try {
      const exportData = filteredPharmacies.map((pharmacy, index) => ({
        'ژمارە': index + 1,
        'ناو': pharmacy.name,
        'کۆد': pharmacy.code,
        'ژمارەی مۆبایل (کڕین)': pharmacy.phone || '---',
        'ژمارەی مۆبایل (ئەژمێردار)': pharmacy.phone2 || '---',
        'شار': pharmacy.city || '---',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, 'دەرمانخانەکان');
      XLSX.writeFile(wb, `دەرمانخانەکان_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    } catch (err) {
      setError('Export failed: ' + err.message);
    }
  };

  const activeForm = editingPharmacy || newPharmacy;

  return (
    <div dir="rtl" style={{ fontFamily: "var(--font-nrt-reg)", width: "100%", minHeight: "100vh", padding: 0, margin: 0, boxSizing: "border-box", overflowX: "hidden" }}>
      
      {/* CSS For Enhanced Inputs & Transitions */}
      <style dangerouslySetInnerHTML={{__html: `
        *, *::before, *::after { box-sizing: border-box; }
        .nice-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          outline: none;
          font-size: 0.95rem;
          font-family: var(--font-nrt-reg);
          background-color: #f8fafc;
          transition: all 0.2s ease-in-out;
          color: #0f172a;
          box-sizing: border-box;
        }
        .nice-input:focus {
          border-color: #3b82f6;
          background-color: #ffffff;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
        }
        .nice-input::placeholder {
          color: #94a3b8;
        }
        .error-input {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
        }
        .error-input:focus {
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15) !important;
        }
      `}} />

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem", padding: "1.5rem 1.5rem 0 1.5rem", width: "100%", boxSizing: "border-box" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontFamily: "var(--font-nrt-bd)", color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Building2 size={28} color="#2563eb" /> دەرمانخانەکان
          </h1>
          <p style={{ margin: "0.25rem 0 0 0", color: "#64748b", fontSize: "0.95rem" }}>بەڕێوەبردن و تۆمارکردنی لیستی دەرمانخانەکان</p>
        </div>
        <button
          onClick={exportToExcel}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1.25rem", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "0.5rem", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", transition: "background 0.2s", boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)" }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = "#059669"}
          onMouseOut={e => e.currentTarget.style.backgroundColor = "#10b981"}
        >
          <Download size={18} /> Export to Excel 
        </button>
      </div>

      {/* ERROR MESSAGE */}
      <div style={{ padding: "0 1.5rem", width: "100%", boxSizing: "border-box" }}>
        {error && (
          <div style={{ padding: "1rem", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "0.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #fca5a5", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "var(--font-nrt-bd)" }}>
              <AlertCircle size={20} /> {error}
            </div>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer" }}><X size={20} /></button>
          </div>
        )}
      </div>

      {/* CREATE / EDIT FORM */}
      <div style={{ backgroundColor: "white", borderRadius: 0, borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", boxShadow: "none", padding: "1.5rem", marginBottom: "1.5rem", width: "100%", boxSizing: "border-box" }}>
        <h2 style={{ fontSize: "1.25rem", fontFamily: "var(--font-nrt-bd)", color: "#1e293b", marginBottom: "1.5rem", borderBottom: "2px solid #f1f5f9", paddingBottom: "0.75rem" }}>
          {editingPharmacy ? "گۆڕانکاری لە دەرمانخانە" : "تۆمارکردنی دەرمانخانەی نوێ"}
        </h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem", width: "100%", boxSizing: "border-box" }}>
          <InputWrapper label="ناوی دەرمانخانە" icon={Building2}>
            <input
              type="text"
              name="name"
              className="nice-input"
              value={activeForm.name}
              onChange={(e) => handleFormChange(e, !!editingPharmacy)}
            />
          </InputWrapper>

          <InputWrapper label="کۆدی دەرمانخانە " icon={Hash} errorMsg={codeError}>
            <input
              type="text"
              name="code"
              className={`nice-input ${codeError ? 'error-input' : ''}`}
              value={activeForm.code}
              onChange={(e) => handleFormChange(e, !!editingPharmacy)}
            />
          </InputWrapper>

          <InputWrapper label="ژمارەی مۆبایل (بەرپرسی کڕین)" icon={Phone}>
            <input
              type="text"
              name="phone"
              className="nice-input"
              placeholder="07XX XXX XXXX"
              value={activeForm.phone}
              onChange={(e) => handleFormChange(e, !!editingPharmacy)}
              style={{ direction: "ltr", textAlign: "right" }}
            />
          </InputWrapper>

          <InputWrapper label="ژمارەی مۆبایل (محاسب)" icon={Phone}>
            <input
              type="text"
              name="phone2"
              className="nice-input"
              placeholder="07XX XXX XXXX"
              value={activeForm.phone2}
              onChange={(e) => handleFormChange(e, !!editingPharmacy)}
              style={{ direction: "ltr", textAlign: "right" }}
            />
          </InputWrapper>

          <InputWrapper label="شار" icon={MapPin}>
            <select
              name="city"
              className="nice-input"
              value={activeForm.city}
              onChange={(e) => handleFormChange(e, !!editingPharmacy)}
              style={{ cursor: "pointer" }}
            >
              {cities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
          </InputWrapper>
        </div>

        <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", width: "100%", boxSizing: "border-box" }}>
          <button
            onClick={editingPharmacy ? handleUpdatePharmacy : handleAddPharmacy}
            disabled={!!codeError}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", backgroundColor: codeError ? "#94a3b8" : "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", fontFamily: "var(--font-nrt-bd)", cursor: codeError ? "not-allowed" : "pointer", transition: "background 0.2s" }}
          >
            {editingPharmacy ? <><CheckCircle2 size={18} /> پاشەکەوتکردنی گۆڕانکاری</> : <><Plus size={18} /> زیادکردنی دەرمانخانە</>}
          </button>
          
          {(editingPharmacy || newPharmacy.name || newPharmacy.phone) && (
            <button
              onClick={() => resetForm(pharmacies)}
              style={{ padding: "0.75rem 1.5rem", backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "0.5rem", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", transition: "all 0.2s" }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = "#e2e8f0"}
              onMouseOut={e => e.currentTarget.style.backgroundColor = "#f1f5f9"}
            >
              پاشگەزبوونەوە / پاککردنەوە
            </button>
          )}
        </div>
      </div>

      {/* SEARCH AND FILTER SECTION */}
      <div style={{ backgroundColor: "white", borderRadius: 0, borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", boxShadow: "none", overflow: "hidden", width: "100%", boxSizing: "border-box" }}>
        
        <div style={{ backgroundColor: "#f8fafc", padding: "1.5rem", borderBottom: "1px solid #e2e8f0", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", color: "#0f172a", fontFamily: "var(--font-nrt-bd)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Search size={20} color="#64748b" /> گەڕانی خێرا
            </div>
            {Object.keys(columnFilters).length > 0 && (
              <button
                onClick={() => setColumnFilters({})}
                style={{
                  background: "#fee2e2",
                  color: "#ef4444",
                  fontSize: "0.8rem",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #fca5a5",
                  cursor: "pointer",
                  fontFamily: "var(--font-nrt-bd)"
                }}
              >
                پاککردنەوەی هەموو فلتەرەکانی خشتە
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", width: "100%", boxSizing: "border-box" }}>
            <input
              type="text"
              name="name"
              className="nice-input"
              placeholder="گەڕان بەپێی ناو..."
              value={searchQuery.name}
              onChange={handleSearchChange}
            />
            <input
              type="text"
              name="code"
              className="nice-input"
              placeholder="گەڕان بەپێی کۆد..."
              value={searchQuery.code}
              onChange={handleSearchChange}
            />
            <input
              type="text"
              name="city"
              className="nice-input"
              placeholder="گەڕان بەپێی شار..."
              value={searchQuery.city}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        <div style={{ padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", borderBottom: "1px solid #e2e8f0", width: "100%", boxSizing: "border-box" }}>
          <span style={{ color: "#475569", fontFamily: "var(--font-nrt-bd)" }}>
            کۆی گشتی دۆزراوەکان: <span style={{ color: "#2563eb", fontWeight: 800 }}>{filteredPharmacies.length}</span> دەرمانخانە
          </span>
        </div>

        {/* TABLE WITH ADVANCED COLUMN FILTERS */}
        <div style={{ overflowX: "auto", width: "100%", boxSizing: "border-box" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px", textAlign: "right", margin: 0 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <TableHeader 
                  title="ناو" 
                  columnKey="name" 
                  colWidth="auto"
                  sortConfig={sortConfig} 
                  handleSort={handleSort} 
                  pharmacies={pharmacies} 
                  columnFilters={columnFilters} 
                  activeFilterDropdown={activeFilterDropdown} 
                  setActiveFilterDropdown={setActiveFilterDropdown} 
                  handleUpdateColumnFilter={handleUpdateColumnFilter} 
                  clearColumnFilter={clearColumnFilter} 
                />
                <TableHeader 
                  title="کۆد" 
                  columnKey="code" 
                  type="number"
                  colWidth="130px"
                  sortConfig={sortConfig} 
                  handleSort={handleSort} 
                  pharmacies={pharmacies} 
                  columnFilters={columnFilters} 
                  activeFilterDropdown={activeFilterDropdown} 
                  setActiveFilterDropdown={setActiveFilterDropdown} 
                  handleUpdateColumnFilter={handleUpdateColumnFilter} 
                  clearColumnFilter={clearColumnFilter} 
                />
                <TableHeader 
                  title="ژ.مۆبایل (کڕین)" 
                  columnKey="phone" 
                  colWidth="190px"
                  sortConfig={sortConfig} 
                  handleSort={handleSort} 
                  pharmacies={pharmacies} 
                  columnFilters={columnFilters} 
                  activeFilterDropdown={activeFilterDropdown} 
                  setActiveFilterDropdown={setActiveFilterDropdown} 
                  handleUpdateColumnFilter={handleUpdateColumnFilter} 
                  clearColumnFilter={clearColumnFilter} 
                />
                <TableHeader 
                  title="ژ.مۆبایل (محاسب)" 
                  columnKey="phone2" 
                  colWidth="190px"
                  sortConfig={sortConfig} 
                  handleSort={handleSort} 
                  pharmacies={pharmacies} 
                  columnFilters={columnFilters} 
                  activeFilterDropdown={activeFilterDropdown} 
                  setActiveFilterDropdown={setActiveFilterDropdown} 
                  handleUpdateColumnFilter={handleUpdateColumnFilter} 
                  clearColumnFilter={clearColumnFilter} 
                />
                <TableHeader 
                  title="شار" 
                  columnKey="city" 
                  colWidth="150px"
                  sortConfig={sortConfig} 
                  handleSort={handleSort} 
                  pharmacies={pharmacies} 
                  columnFilters={columnFilters} 
                  activeFilterDropdown={activeFilterDropdown} 
                  setActiveFilterDropdown={setActiveFilterDropdown} 
                  handleUpdateColumnFilter={handleUpdateColumnFilter} 
                  clearColumnFilter={clearColumnFilter} 
                />
                <th style={{ backgroundColor: "#34495e", color: "white", padding: "12px 14px", borderBottom: "2px solid #576574", textAlign: "center", width: "160px", fontFamily: "var(--font-nrt-bd)" }}>
                  کردارەکان
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
                    <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto 1rem", color: "#2563eb" }} />
                    زانیارییەکان باردەکرێن...
                  </td>
                </tr>
              ) : filteredPharmacies.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8", fontFamily: "var(--font-nrt-bd)" }}>
                    هیچ دەرمانخانەیەک نەدۆزرایەوە بەم مەرج و فلتەرانە.
                  </td>
                </tr>
              ) : (
                filteredPharmacies.map((pharmacy) => (
                  <tr key={pharmacy.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                    <td style={{ padding: "1rem", fontFamily: "var(--font-nrt-bd)", color: "#0f172a" }}>{pharmacy.name}</td>
                    <td style={{ padding: "1rem", color: "#475569" }}>
                      <span style={{ backgroundColor: "#e2e8f0", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.85rem", fontFamily: "var(--font-nrt-bd)" }}>{pharmacy.code}</span>
                    </td>
                    <td style={{ padding: "1rem", color: "#475569", direction: "ltr", textAlign: "right" }}>
                      {pharmacy.phone ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                          {pharmacy.phone}
                          <button onClick={() => handleWhatsApp(pharmacy.phone)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} title="ناردنی وەتسئەپ">
                            <img src="/whatsappicon.png" alt="WA" style={{ width: "22px", transition: "transform 0.2s" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.1)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"} />    
                          </button>
                        </div>
                      ) : "---"}
                    </td>
                    <td style={{ padding: "1rem", color: "#475569", direction: "ltr", textAlign: "right" }}>
                      {pharmacy.phone2 ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                          {pharmacy.phone2}
                          <button onClick={() => handleWhatsApp(pharmacy.phone2)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} title="ناردنی وەتسئەپ">
                            <img src="/whatsappicon.png" alt="WA" style={{ width: "22px", transition: "transform 0.2s" }} onMouseOver={e => e.currentTarget.style.transform="scale(1.1)"} onMouseOut={e => e.currentTarget.style.transform="scale(1)"} />    
                          </button>
                        </div>
                      ) : "---"}
                    </td>
                    <td style={{ padding: "1rem", color: "#475569" }}>{pharmacy.city || "---"}</td>
                    <td style={{ padding: "1rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                      <button
                        onClick={() => handleEdit(pharmacy)}
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.5rem 0.75rem", backgroundColor: "#eff6ff", color: "#2563eb", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontFamily: "var(--font-nrt-bd)", fontSize: "0.85rem", transition: "background 0.2s" }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = "#dbeafe"}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = "#eff6ff"}
                      >
                        <Edit3 size={16} /> دەستکاری
                      </button>
                      <button
                        onClick={() => handleDelete(pharmacy.id)}
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.5rem 0.75rem", backgroundColor: "#fef2f2", color: "#dc2626", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontFamily: "var(--font-nrt-bd)", fontSize: "0.85rem", transition: "background 0.2s" }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = "#fee2e2"}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = "#fef2f2"}
                      >
                        <Trash2 size={16} /> سڕینەوە
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}