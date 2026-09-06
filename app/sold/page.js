"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { searchSoldBills, getPharmacies, getBase64BillAttachment, getBillAttachmentUrlEnhanced } from "@/lib/data";
import React from "react";
import Select from "react-select";
import * as XLSX from 'xlsx';
import { Search, X, Filter, ChevronDown, Check, Maximize2, Minimize2, Download, Image as ImageIcon } from "lucide-react";

// ============================================================
// Shared Reusable Uiverse Wi-Fi Loader Component
// ============================================================
const WifiLoader = ({ text = "processing" }) => (
  <div className="bf-global-loader-overlay">
    <div className="bf-wifi-loader">
      <svg className="circle-outer" viewBox="0 0 86 86">
        <circle className="back" cx="43" cy="43" r="40"></circle>
        <circle className="front" cx="43" cy="43" r="40"></circle>
      </svg>
      <svg className="circle-middle" viewBox="0 0 60 60">
        <circle className="back" cx="30" cy="30" r="27"></circle>
        <circle className="front" cx="30" cy="30" r="27"></circle>
      </svg>
      <svg className="circle-inner" viewBox="0 0 34 34">
        <circle className="back" cx="17" cy="17" r="14"></circle>
        <circle className="front" cx="17" cy="17" r="14"></circle>
      </svg>
      <div className="text" data-text={text}></div>
    </div>
  </div>
);

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

// --- Formatters ---
const formatNumberIQD = (num) => num ? Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "0";
const formatNumberUSD = (num) => num ? Number(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "0";

const formatExpireDate = (date) => {
  if (!date) return "N/A";
  try {
    let dateObj;
    if (date.toDate && typeof date.toDate === "function") dateObj = date.toDate();
    else if (date instanceof Date) dateObj = date;
    else if (date.seconds) dateObj = new Date(date.seconds * 1000);
    else if (typeof date === "string") {
      dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        const parts = date.split("/");
        if (parts.length === 3) dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (isNaN(dateObj.getTime())) {
          const parts2 = date.split("-");
          if (parts2.length === 3) dateObj = new Date(parseInt(parts2[0]), parseInt(parts2[1]) - 1, parseInt(parts2[2]));
        }
      }
    } else return "N/A";
    
    if (!dateObj || isNaN(dateObj.getTime())) return "N/A";
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return "N/A";
  }
};

const formatDateTime = (date) => {
  if (!date) return 'N/A';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// =========================================================================
// DEFINED OUTSIDE TO PREVENT RE-RENDERS & FIX TEXT BOX FOCUS BUGS
// =========================================================================
const ExcelFilterDropdown = ({ 
  columnKey, 
  type = "string", 
  isDate = false, 
  isTime = false,
  alignRight = false,
  allItems,
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
    allItems.forEach(item => {
      let val = item[columnKey];
      if (isTime) val = item._formattedBuyDate;
      else if (isDate) val = item._formattedExpireDate;
      vals.add(String(val ?? ""));
    });
    return Array.from(vals).sort();
  }, [allItems, columnKey, isDate, isTime]);

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
          color: isActive ? "#2563eb" : "#94a3b8", 
          transition: "all 0.2s" 
        }}
      >
        <Filter size={14} />
      </div>

      {isOpen && (
        <div 
          style={{ 
            position: "absolute", 
            top: "100%", 
            ...(alignRight ? { right: 0, left: "auto" } : { left: 0, right: "auto" }), 
            marginTop: "0.5rem", 
            background: "white", 
            border: "1px solid #cbd5e1", 
            borderRadius: "0.5rem", 
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)", 
            zIndex: 100, 
            width: "260px", 
            display: "flex", 
            flexDirection: "column", 
            cursor: "default", 
            overflow: "hidden" 
          }} 
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p style={{ margin: "0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Condition</p>
            <select 
              value={operator || operators[0].value} 
              onChange={(e) => handleUpdateColumnFilter(columnKey, { operator: e.target.value })}
              style={{ width: "100%", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none", background: "white", boxSizing: "border-box" }}
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
                style={{ width: "100%", padding: "0.4rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }} 
              />
            )}
          </div>

          <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", flex: 1, boxSizing: "border-box" }}>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600", color: "#475569" }}>Values</p>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", marginBottom: "0.5rem", boxSizing: "border-box" }}>
              <Search size={14} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Search values..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                onKeyDown={(e) => e.stopPropagation()}
                style={{ border: "none", outline: "none", width: "100%", fontSize: "0.875rem", marginLeft: "0.5rem", boxSizing: "border-box" }} 
              />
            </div>

            <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", padding: "0.25rem", cursor: "pointer", fontWeight: "500", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem", marginBottom: "0.25rem" }}>
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
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val === "undefined" || val === "null" || val === "" ? "(Blank)" : val}</span>
                </label>
              ))}
              {displayValues.length === 0 && <div style={{ fontSize: "0.875rem", color: "#94a3b8", textAlign: "center", padding: "1rem 0" }}>No matches found</div>}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
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
  isDate = false, 
  isTime = false, 
  type = "string", 
  color = "#334155", 
  isLast = false, 
  minWidth,
  alignRight = false,
  sortConfig,
  handleSort,
  allItems,
  columnFilters,
  activeFilterDropdown,
  setActiveFilterDropdown,
  handleUpdateColumnFilter,
  clearColumnFilter
}) => (
  <th style={{ 
    padding: "0.75rem", 
    borderBottom: "2px solid #cbd5e1", 
    borderRight: isLast ? "none" : "1px solid #cbd5e1", 
    verticalAlign: "middle", 
    whiteSpace: "nowrap",
    minWidth: minWidth || "auto",
    backgroundColor: "#f8fafc" 
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: "600", color: color, fontSize: "0.875rem" }}>
      <div onClick={() => handleSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem", flex: 1, userSelect: "none" }}>
        {title}
        <span style={{ color: "#94a3b8", fontSize: "0.75rem", width: "12px" }}>
          {sortConfig.key === columnKey ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </div>
      <div style={{ paddingLeft: "0.5rem", borderLeft: "1px solid #e2e8f0", marginLeft: "0.5rem" }}>
        <ExcelFilterDropdown 
          columnKey={columnKey} 
          title={title} 
          type={type} 
          isDate={isDate} 
          isTime={isTime}
          alignRight={alignRight}
          allItems={allItems}
          columnFilters={columnFilters}
          activeFilterDropdown={activeFilterDropdown}
          setActiveFilterDropdown={setActiveFilterDropdown}
          handleUpdateColumnFilter={handleUpdateColumnFilter}
          clearColumnFilter={clearColumnFilter}
        />
      </div>
    </div>
  </th>
);

export default function SoldPage() {
  const [bills, setBills] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [userRole, setUserRole] = useState('user');
  const [isLoading, setIsLoading] = useState(true);
  
  const [globalFilters, setGlobalFilters] = useState({
    startDate: "",
    endDate: "",
  });

  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const [attachmentModal, setAttachmentModal] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [noImageFound, setNoImageFound] = useState(false);

  // ============================================================
  // Notification System
  // ============================================================
  const [notifications, setNotifications] = useState([]);

  const notify = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== id)); }, 5000);
  }, []);

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>;
      case 'error':
        return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 9-6 6m0-6 6 6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>;
      case 'warning':
        return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 13V8m0 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>;
      case 'info':
      default:
        return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 11h2v5m-2 0h4m-2.592-8.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>;
    }
  };

  useEffect(() => {
    const rawRole = (localStorage.getItem('userRole') || 'user').toLowerCase();
    const role = rawRole === 'superadmin' ? 'superAdmin' : rawRole;
    setUserRole(role);
    
    const handleClickOutside = (e) => {
      if (!e.target.closest('.filter-dropdown-container')) {
        setActiveFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [billsData, pharmaciesData] = await Promise.all([
          searchSoldBills(""),
          getPharmacies()
        ]);
        
        const billsWithAttachments = await Promise.all(
          billsData.map(async (bill) => {
            try {
              let url = await getBase64BillAttachment(bill.billNumber);
              if (!url) url = await getBillAttachmentUrlEnhanced(bill.billNumber);
              return { ...bill, attachment: url || null, hasAttachment: !!url };
            } catch (error) {
              return { ...bill, attachment: null, hasAttachment: false };
            }
          })
        );
        
        billsWithAttachments.sort((a, b) => new Date(b.date) - new Date(a.date));
        setBills(billsWithAttachments);
        setPharmacies(pharmaciesData);
      } catch (error) {
        notify("error", "Failed to fetch sales data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [notify]);

  const allItems = useMemo(() =>
    bills.flatMap(bill =>
      bill.items?.map(item => {
        const billCurrency = bill.currency || 'USD'; 
        const isIQD = billCurrency === 'IQD';
        const isUSD = billCurrency === 'USD';

        const priceIQD = isIQD ? (item.outPriceIQD || item.price || 0) : 0;
        const priceUSD = isUSD ? (item.outPriceUSD || item.price || 0) : 0;

        let finalCreator = "Unknown User";
        let creatorId = "unknown";
        
        if (bill.createdByName && bill.createdByName !== "Unknown User" && bill.createdByName !== "unknown" && bill.createdByName.trim() !== "") {
          finalCreator = bill.createdByName;
          creatorId = bill.createdBy || "unknown";
        } else if (bill.creatorDisplayName && bill.creatorDisplayName !== "Unknown User" && bill.creatorDisplayName.trim() !== "") {
          finalCreator = bill.creatorDisplayName;
          creatorId = bill.createdBy || bill.creatorId || "unknown";
        } else if (bill.createdBy && bill.createdBy !== "unknown" && bill.createdBy.trim() !== "") {
          if (bill.createdBy.includes('@')) {
            finalCreator = bill.createdBy.split('@')[0];
          } else {
            finalCreator = bill.createdBy;
          }
          creatorId = bill.createdBy;
        } else if (bill.creatorName && bill.creatorName.trim() !== "") {
          finalCreator = bill.creatorName;
          creatorId = bill.createdBy || "unknown";
        } else if (bill.addedByName && bill.addedByName.trim() !== "") {
          finalCreator = bill.addedByName;
          creatorId = bill.addedBy || "unknown";
        } else if (bill.updatedByName && bill.updatedByName.trim() !== "") {
          finalCreator = bill.updatedByName;
          creatorId = bill.updatedBy || "unknown";
        } else if (item.createdByName && item.createdByName.trim() !== "") {
          finalCreator = item.createdByName;
          creatorId = item.createdBy || "unknown";
        } else if (item.createdBy && item.createdBy.trim() !== "") {
          if (item.createdBy.includes('@')) {
            finalCreator = item.createdBy.split('@')[0];
          } else {
            finalCreator = item.createdBy;
          }
          creatorId = item.createdBy;
        } else if (bill.userName && bill.userName.trim() !== "") {
          finalCreator = bill.userName;
          creatorId = bill.userId || "unknown";
        } else {
          const storedName = localStorage.getItem('userDisplayName');
          const storedEmail = localStorage.getItem('userEmail');
          if (storedName && storedName !== "Unknown User") {
            finalCreator = storedName;
          } else if (storedEmail) {
            finalCreator = storedEmail.split('@')[0];
          }
        }

        return {
          ...item,
          billNumber: String(bill.billNumber),
          saleDate: bill.date,
          pharmacyId: bill.pharmacyId,
          pharmacyName: pharmacies.find(p => p.id === bill.pharmacyId)?.name || bill.pharmacyName || 'Unknown',
          branch: item.branch || bill.branch || 'N/A',
          paymentStatus: bill.paymentStatus || 'Unpaid',
          isConsignment: bill.isConsignment ? 'تحت صرف' : 'Owned',
          attachment: bill.attachment || item.attachment || null,
          hasAttachment: (bill.hasAttachment || item.attachment) ? 'Yes' : 'No',
          creator: finalCreator,
          creatorId: creatorId,
          billCurrency,
          priceIQD, priceUSD,
          totalPriceIQD: isIQD ? (priceIQD * (item.quantity || 0)) : 0,
          totalPriceUSD: isUSD ? (priceUSD * (item.quantity || 0)) : 0,
          originalCurrency: item.originalCurrency || 'USD',
          
          netPriceIQD: Number(item.netPriceIQD) || Number(item.netPriceIQD_original) || 0,
          netPriceUSD: Number(item.netPriceUSD) || Number(item.netPriceUSD_original) || 0,
          basePriceIQD: Number(item.basePriceIQD) || Number(item.basePriceIQD_original) || 0,
          basePriceUSD: Number(item.basePriceUSD) || Number(item.basePriceUSD_original) || 0,
          
          expireDate: item.expireDate || null,
          
          _formattedSaleDate: formatDateTime(bill.date),
          _formattedExpireDate: formatExpireDate(item.expireDate)
        };
      }) || []
    ), [bills, pharmacies]
  );

  const evaluateFilter = (itemValue, filterData) => {
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
        case 'contains': if (!valStr.includes(searchStr)) return false; break;
        case 'equals': if (valStr !== searchStr && valNum !== searchNum) return false; break;
        case 'notEquals': if (valNum === searchNum) return false; break;
        case 'startsWith': if (!valStr.startsWith(searchStr)) return false; break;
        case 'endsWith': if (!valStr.endsWith(searchStr)) return false; break;
        case 'greaterThan': if (valNum <= searchNum) return false; break;
        case 'greaterThanOrEqual': if (valNum < searchNum) return false; break;
        case 'lessThan': if (valNum >= searchNum) return false; break;
        case 'lessThanOrEqual': if (valNum > searchNum) return false; break;
        case 'isEmpty': if (itemValue !== null && itemValue !== undefined && itemValue !== '') return false; break;
        case 'isNotEmpty': if (itemValue === null || itemValue === undefined || itemValue === '') return false; break;
        default: break;
      }
    }
    return true;
  };

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (globalFilters.startDate || globalFilters.endDate) {
        const saleDate = item.saleDate?.toDate ? item.saleDate.toDate() : new Date(item.saleDate);
        if (globalFilters.startDate) {
          const start = new Date(globalFilters.startDate.split('/').reverse().join('-'));
          if (saleDate < start) return false;
        }
        if (globalFilters.endDate) {
          const end = new Date(globalFilters.endDate.split('/').reverse().join('-'));
          end.setHours(23, 59, 59, 999);
          if (saleDate > end) return false;
        }
      }

      for (const [columnKey, filterData] of Object.entries(columnFilters)) {
        let itemValue = item[columnKey];
        if (columnKey === 'saleDate') itemValue = item._formattedSaleDate;
        if (columnKey === 'expireDate') itemValue = item._formattedExpireDate;
        
        if (!evaluateFilter(itemValue, filterData)) return false;
      }
      return true;
    });
  }, [allItems, globalFilters, columnFilters]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      if (!sortConfig.key) return 0;
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (["saleDate", "expireDate"].includes(sortConfig.key)) {
        aValue = aValue?.toDate ? aValue.toDate().getTime() : new Date(aValue).getTime();
        bValue = bValue?.toDate ? bValue.toDate().getTime() : new Date(bValue).getTime();
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortConfig]);

  const itemsWithUniqueId = sortedItems.map((item, index) => ({
    ...item, uniqueId: `${item.billNumber}-${item.barcode}-${index}`,
  }));

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

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

  const clearColumnFilter = (columnKey) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
  };

  const downloadImage = async (url, billNumber) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Invoice_${billNumber}_Attachment.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      notify("error", "Failed to download image.");
    }
  };

  const exportToExcel = () => {
    if (userRole !== 'superAdmin') return notify("warning", "Only Super Admins are authorized to export data.");
    if (itemsWithUniqueId.length === 0) return notify("warning", "No data to export.");

    const exportData = itemsWithUniqueId.map((item, index) => ({
      '#': index + 1,
      'ناوی کاڵا': item.name,
      'بارکۆد': item.barcode,
      'لەک': item.branch,
      'عدد': item.quantity,
      'نرخ (دینار)': item.billCurrency === 'IQD' ? formatNumberIQD(item.priceIQD) : "0",
      'کۆی گشتی (دینار)': item.billCurrency === 'IQD' ? formatNumberIQD(item.totalPriceIQD) : "0",
      'نرخ ($)': item.billCurrency === 'USD' ? formatNumberUSD(item.priceUSD) : "0",
      'کۆی گشتی ($)': item.billCurrency === 'USD' ? formatNumberUSD(item.totalPriceUSD) : "0",
      'ژمارەی پسوڵە': item.billNumber,
      'دەرمانخانە': item.pharmacyName,
      'بەرواری فرۆشتن': item._formattedSaleDate,
      'دۆخی تحت صرف': item.isConsignment,
      'بەرواری بەسەرچوون': item._formattedExpireDate,
      'جۆری پارەدان': item.paymentStatus,
      'بەیز (دینار)': formatNumberIQD(item.basePriceIQD),
      'نێت (دینار)': formatNumberIQD(item.netPriceIQD),
      'بەیز ($)': formatNumberUSD(item.basePriceUSD),
      'نێت ($)': formatNumberUSD(item.netPriceUSD),
      'دروستکەر': item.creator,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sold Items");
    XLSX.writeFile(wb, `sold_items_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleOpenAttachment = async (item) => {
    setAttachmentModal(item);
    setIsFullscreen(false);
    setNoImageFound(false);
    
    if (item.attachment) {
      setImagePreview(item.attachment);
      return;
    }

    setIsImageLoading(true);
    setImagePreview(null);
    try {
      let url = await getBase64BillAttachment(item.billNumber);
      if (!url) url = await getBillAttachmentUrlEnhanced(item.billNumber);
      
      if (url) {
        setImagePreview(url);
        setBills(prev => prev.map(bill => 
          bill.billNumber === item.billNumber 
            ? { ...bill, attachment: url, hasAttachment: true } 
            : bill
        ));
      } else {
        setNoImageFound(true);
      }
    } catch (error) {
      setNoImageFound(true);
    } finally {
      setIsImageLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .page-container {
          font-family: system-ui, sans-serif;
          max-width: 100%;
          width: 100%;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding: 1.5rem 1.5rem 0 1.5rem;
        }
        .filter-section {
          display: flex;
          gap: 1rem;
          background-color: #fff;
          border-radius: 0.75rem;
          padding: 1.25rem;
          margin: 0 1.5rem 1.5rem 1.5rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        .table-responsive-wrapper {
          background-color: #fff;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          border-left: none;
          border-right: none;
          border-radius: 0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          min-height: 700px;
          padding-bottom: 8rem;
          box-sizing: border-box;
          width: 100%;
        }
        
        @media (max-width: 1024px) {
          .header-section {
            padding: 1rem 1rem 0 1rem;
            margin-bottom: 0.5rem;
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }
          .filter-section {
            flex-direction: column;
            margin: 0 1rem 1rem 1rem;
            padding: 1rem;
          }
        }
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }

        /* OVERLAY LOADER CSS */
        .bf-global-loader-overlay {
          position: fixed; 
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(255, 255, 255, 0.85); 
          backdrop-filter: blur(8px); 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center; 
          z-index: 999999;
          margin: 0;
          padding: 0;
        }
        .bf-wifi-loader { --background: #62abff; --front-color: #ef4d86; --front-color-in: #fbb216; --back-color: #c3c8de; --text-color: #414856; width: 64px; height: 64px; border-radius: 50px; position: relative; display: flex; justify-content: center; align-items: center; }
        .bf-wifi-loader svg { position: absolute; display: flex; justify-content: center; align-items: center; }
        .bf-wifi-loader svg circle { position: absolute; fill: none; stroke-width: 6px; stroke-linecap: round; stroke-linejoin: round; transform: rotate(-100deg); transform-origin: center; }
        .bf-wifi-loader svg circle.back { stroke: var(--back-color); }
        .bf-wifi-loader svg circle.front { stroke: var(--front-color); }
        .bf-wifi-loader svg.circle-outer { height: 86px; width: 86px; }
        .bf-wifi-loader svg.circle-outer circle { stroke-dasharray: 62.75 188.25; }
        .bf-wifi-loader svg.circle-outer circle.back { animation: circle-outer135 1.8s ease infinite 0.3s; }
        .bf-wifi-loader svg.circle-outer circle.front { animation: circle-outer135 1.8s ease infinite 0.15s; }
        .bf-wifi-loader svg.circle-middle { height: 60px; width: 60px; }
        .bf-wifi-loader svg.circle-middle circle { stroke: var(--front-color-in); stroke-dasharray: 42.5 127.5; }
        .bf-wifi-loader svg.circle-middle circle.back { animation: circle-middle6123 1.8s ease infinite 0.25s; }
        .bf-wifi-loader svg.circle-middle circle.front { animation: circle-middle6123 1.8s ease infinite 0.1s; }
        .bf-wifi-loader svg.circle-inner { height: 34px; width: 34px; }
        .bf-wifi-loader svg.circle-inner circle { stroke-dasharray: 22 66; }
        .bf-wifi-loader svg.circle-inner circle.back { animation: circle-inner162 1.8s ease infinite 0.2s; }
        .bf-wifi-loader svg.circle-inner circle.front { animation: circle-inner162 1.8s ease infinite 0.05s; }
        .bf-wifi-loader .text { position: absolute; bottom: -40px; display: flex; justify-content: center; align-items: center; text-transform: lowercase; font-weight: 600; font-size: 15px; letter-spacing: 0.2px; }
        .bf-wifi-loader .text::before, .bf-wifi-loader .text::after { content: attr(data-text); }
        .bf-wifi-loader .text::before { color: var(--text-color); }
        .bf-wifi-loader .text::after { color: var(--front-color-in); animation: text-animation76 3.6s ease infinite; position: absolute; left: 0; }
        @keyframes circle-outer135 { 0% { stroke-dashoffset: 25; } 25% { stroke-dashoffset: 0; } 65% { stroke-dashoffset: 301; } 80% { stroke-dashoffset: 276; } 100% { stroke-dashoffset: 276; } }
        @keyframes circle-middle6123 { 0% { stroke-dashoffset: 17; } 25% { stroke-dashoffset: 0; } 65% { stroke-dashoffset: 204; } 80% { stroke-dashoffset: 187; } 100% { stroke-dashoffset: 187; } }
        @keyframes circle-inner162 { 0% { stroke-dashoffset: 9; } 25% { stroke-dashoffset: 0; } 65% { stroke-dashoffset: 106; } 80% { stroke-dashoffset: 97; } 100% { stroke-dashoffset: 97; } }
        @keyframes text-animation76 { 0% { clip-path: inset(0 100% 0 0); } 50% { clip-path: inset(0); } 100% { clip-path: inset(0 0 0 100%); } }

        /* TOAST NOTIFICATIONS CSS */
        .notification-container { position: fixed; top: 2%; right: 2%; z-index: 9999999; max-width: 400px; --content-color: black; --background-color: #f3f3f3; --font-size-content: 0.85em; --icon-size: 1.25em; display: flex; flex-direction: column; gap: 0.5em; list-style-type: none; font-family: inherit; color: var(--content-color); margin: 0; padding: 0; }
        .notification-item { position: relative; display: flex; justify-content: space-between; align-items: center; flex-direction: row; gap: 1em; overflow: hidden; padding: 12px 18px; border-radius: 8px; box-shadow: rgba(0, 0, 0, 0.2) 0px 8px 24px; background-color: var(--background-color); transition: all 250ms ease; animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; --grid-color: rgba(225, 225, 225, 0.7); background-image: linear-gradient(0deg, transparent 23%, var(--grid-color) 24%, var(--grid-color) 25%, transparent 26%, transparent 73%, var(--grid-color) 74%, var(--grid-color) 75%, transparent 76%, transparent), linear-gradient(90deg, transparent 23%, var(--grid-color) 24%, var(--grid-color) 25%, transparent 26%, transparent 73%, var(--grid-color) 74%, var(--grid-color) 75%, transparent 76%, transparent); background-size: 55px 55px; }
        @keyframes slideIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .notification-item svg { transition: 250ms ease; }
        .notification-item:hover { transform: scale(1.02); }
        .notification-item:active { transform: scale(1.05); }
        .notification-item .notification-close { padding: 2px; border-radius: 5px; transition: all 250ms; cursor: pointer; }
        .notification-item .notification-close:hover { background-color: rgba(204, 204, 204, 0.45); }
        .notification-item .notification-close:hover svg { color: rgb(0, 0, 0); }
        .notification-item .notification-close:active svg { transform: scale(1.1); }
        .notification-container svg { width: var(--icon-size); height: var(--icon-size); color: var(--content-color); }
        .notification-icon { display: flex; align-items: center; }

        .notification-item.success { color: #047857; background-color: #7dffbc; --grid-color: rgba(16, 185, 129, 0.25); } .notification-item.success svg { color: #047857; } .notification-item.success .notification-progress-bar { background-color: #047857; } .notification-item.success:hover { background-color: #5bffaa; }
        .notification-item.info { color: #1e3a8a; background-color: #7eb8ff; --grid-color: rgba(59, 131, 246, 0.25); } .notification-item.info svg { color: #1e3a8a; } .notification-item.info .notification-progress-bar { background-color: #1e3a8a; } .notification-item.info:hover { background-color: #5ba5ff; }
        .notification-item.warning { color: #78350f; background-color: #ffe57e; --grid-color: rgba(245, 159, 11, 0.25); } .notification-item.warning svg { color: #78350f; } .notification-item.warning .notification-progress-bar { background-color: #78350f; } .notification-item.warning:hover { background-color: #ffde59; }
        .notification-item.error { color: #7f1d1d; background-color: #ff7e7e; --grid-color: rgba(239, 68, 68, 0.25); } .notification-item.error svg { color: #7f1d1d; } .notification-item.error .notification-progress-bar { background-color: #7f1d1d; } .notification-item.error:hover { background-color: #ff5f5f; }
        .notification-content { display: flex; justify-content: flex-start; align-items: center; gap: 0.75em; }
        .notification-text { font-size: var(--font-size-content); font-weight: 600; user-select: none; }
        .notification-progress-bar { position: absolute; bottom: 0; left: 0; height: 3px; background: var(--content-color); width: 100%; transform: translateX(100%); animation: progressBar 5s linear forwards; }
        @keyframes progressBar { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
      `}</style>

      {/* PAGE LOAD LOADER OVERLAY */}
      {isLoading && <WifiLoader text="loading sales data..." />}

      {/* GLOBAL TOAST NOTIFICATIONS */}
      <ul className="notification-container">
        {notifications.map((note) => (
          <li key={note.id} className={`notification-item ${note.type}`}>
            <div className="notification-content">
              <div className="notification-icon">{getNotificationIcon(note.type)}</div>
              <div className="notification-text">{note.message}</div>
            </div>
            <div className="notification-icon notification-close" onClick={() => dismissNotification(note.id)}>
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18 17.94 6M18 18 6.06 6"></path></svg>
            </div>
            <div className="notification-progress-bar"></div>
          </li>
        ))}
      </ul>

      <div className="page-container">
        
        <div className="header-section">
          <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", color: "#0f172a", margin: 0 }}>Sales History</h1>
          <div style={{ display: "flex", gap: "1rem" }}>
            {Object.keys(columnFilters).length > 0 && (
              <button onClick={() => setColumnFilters({})} style={{ padding: "0.5rem 1rem", backgroundColor: "#fef2f2", color: "#ef4444", border: "1px solid #fca5a5", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", transition: "background 0.2s" }}>
                Clear Filters
              </button>
            )}
            
            {userRole === 'superAdmin' && (
              <button onClick={exportToExcel} style={{ padding: "0.5rem 1.25rem", backgroundColor: "#10b981", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)", transition: "background 0.2s" }}>
                Export to Excel 📊
              </button>
            )}
          </div>
        </div>

        <div className="filter-section">
          <div style={{ flex: 1, width: "100%" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#475569", display: "block", marginBottom: "0.375rem" }}>Start Date</label>
            <input type="date" value={globalFilters.startDate ? globalFilters.startDate.split('/').reverse().join('-') : ''} onChange={(e) => setGlobalFilters({...globalFilters, startDate: e.target.value ? e.target.value.split('-').reverse().join('/') : ''})} style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", outline: "none", color: "#0f172a", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1, width: "100%" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#475569", display: "block", marginBottom: "0.375rem" }}>End Date</label>
            <input type="date" value={globalFilters.endDate ? globalFilters.endDate.split('/').reverse().join('-') : ''} onChange={(e) => setGlobalFilters({...globalFilters, endDate: e.target.value ? e.target.value.split('-').reverse().join('/') : ''})} style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", outline: "none", color: "#0f172a", boxSizing: "border-box" }} />
          </div>
        </div>

        <div className="table-responsive-wrapper">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: userRole === 'superAdmin' ? "2600px" : "2200px", textAlign: "left" }}>
            <thead style={{ backgroundColor: "#f8fafc", position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <TableHeader title="Product Name" columnKey="name" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Barcode" columnKey="barcode" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Qty" columnKey="quantity" type="number" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Price (IQD)" columnKey="priceIQD" type="number" color="#059669" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Total (IQD)" columnKey="totalPriceIQD" type="number" color="#059669" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Price ($)" columnKey="priceUSD" type="number" color="#2563eb" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Total ($)" columnKey="totalPriceUSD" type="number" color="#2563eb" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Invoice #" columnKey="billNumber" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                <TableHeader title="Client" columnKey="pharmacyName" minWidth="250px" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                <TableHeader title="Sell Date & Time" columnKey="saleDate" isTime={true} sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Expire Date" columnKey="expireDate" isDate={true} sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Status" columnKey="paymentStatus" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                <TableHeader title="Branch" columnKey="branch" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Consignment" columnKey="isConsignment" sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                {/* ⬅️ Last 2 columns open filter to left side */}
                <TableHeader title="Attachment" columnKey="hasAttachment" alignRight={true} sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Creator" columnKey="creator" alignRight={true} isLast={userRole !== 'superAdmin'} sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                {userRole === 'superAdmin' && (
                  <>
                    <TableHeader title="Base (IQD)" columnKey="basePriceIQD" type="number" color="#d97706" alignRight={true} sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                    <TableHeader title="Net (IQD)" columnKey="netPriceIQD" type="number" color="#ea580c" alignRight={true} sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                    <TableHeader title="Base ($)" columnKey="basePriceUSD" type="number" color="#d97706" alignRight={true} sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                    <TableHeader title="Net ($)" columnKey="netPriceUSD" type="number" color="#ea580c" alignRight={true} isLast={true} sortConfig={sortConfig} handleSort={handleSort} allItems={allItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                  </>
                )}
              </tr>
            </thead>
            
            <tbody>
              {itemsWithUniqueId.length === 0 ? (
                <tr><td colSpan="25" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8", fontSize: "1.125rem" }}>No records match the current filters.</td></tr>
              ) : (
                itemsWithUniqueId.map((item, index) => (
                  <tr key={item.uniqueId} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: index % 2 === 0 ? "white" : "#fafafa", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="#f1f5f9"} onMouseOut={e=>e.currentTarget.style.background=index % 2 === 0 ? "white" : "#fafafa"}>
                    
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", fontWeight: "500", color: "#0f172a", borderRight: "1px solid #e2e8f0" }}>{item.name}</td>
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{item.barcode}</td>
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", fontWeight: "600", color: "#334155", borderRight: "1px solid #e2e8f0" }}>{item.quantity}</td>
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#059669", borderRight: "1px solid #e2e8f0" }}>{item.billCurrency === 'IQD' ? formatNumberIQD(item.priceIQD) : ""}</td>
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#059669", fontWeight: "bold", borderRight: "1px solid #e2e8f0" }}>{item.billCurrency === 'IQD' ? formatNumberIQD(item.totalPriceIQD) : ""}</td>
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#2563eb", borderRight: "1px solid #e2e8f0" }}>{item.billCurrency === 'USD' ? formatNumberUSD(item.priceUSD) : ""}</td>
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#2563eb", fontWeight: "bold", borderRight: "1px solid #e2e8f0" }}>{item.billCurrency === 'USD' ? formatNumberUSD(item.totalPriceUSD) : ""}</td>
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", fontFamily: "monospace", color: "#475569", borderRight: "1px solid #e2e8f0" }}>{item.billNumber}</td>
                    
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#0f172a", fontWeight: "500", borderRight: "1px solid #e2e8f0", minWidth: "250px", whiteSpace: "normal", wordWrap: "break-word" }}>{item.pharmacyName}</td>
                    
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#475569", borderRight: "1px solid #e2e8f0" }}>{item._formattedSaleDate}</td>
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", borderRight: "1px solid #e2e8f0", color: (new Date(item.expireDate) < new Date() && item.expireDate !== null) ? "#dc2626" : "#475569", fontWeight: (new Date(item.expireDate) < new Date() && item.expireDate !== null) ? "bold" : "normal" }}>{item._formattedExpireDate}</td>
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.75rem", borderRight: "1px solid #e2e8f0" }}>
                      <span style={{ padding: "0.25rem 0.6rem", borderRadius: "0.375rem", background: item.paymentStatus === 'Paid' ? '#dcfce7' : item.paymentStatus === 'Cash' ? '#e0e7ff' : '#fee2e2', color: item.paymentStatus === 'Paid' ? '#166534' : item.paymentStatus === 'Cash' ? '#1e40af' : '#991b1b', fontWeight: "600", border: `1px solid ${item.paymentStatus === 'Paid' ? '#bbf7d0' : item.paymentStatus === 'Cash' ? '#c7d2fe' : '#fecaca'}` }}>
                        {item.paymentStatus}
                      </span>
                    </td>

                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", borderRight: "1px solid #e2e8f0" }}>
                      <span style={{ 
                        padding: "0.25rem 0.6rem", 
                        borderRadius: "0.375rem", 
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        color: item.branch === "Slemany" ? "#16a34a" : item.branch === "Erbil" ? "#dc2626" : item.branch === "Duhok" ? "#2563eb" : item.branch === "Kirkuk" ? "#f59e0b" : item.branch === "Kalar" ? "#8b5cf6" : "#4b5563",
                        backgroundColor: item.branch === "Slemany" ? "#f0fdf4" : item.branch === "Erbil" ? "#fef2f2" : item.branch === "Duhok" ? "#eff6ff" : item.branch === "Kirkuk" ? "#fffbeb" : item.branch === "Kalar" ? "#f5f3ff" : "#f1f5f9",
                        border: `1px solid ${item.branch === "Slemany" ? "#bbf7d0" : item.branch === "Erbil" ? "#fecaca" : item.branch === "Duhok" ? "#bfdbfe" : item.branch === "Kirkuk" ? "#fde68a" : item.branch === "Kalar" ? "#ddd6fe" : "#e2e8f0"}`
                      }}>
                        {item.branch}
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.75rem", borderRight: "1px solid #e2e8f0" }}>
                      <span style={{ padding: "0.25rem 0.6rem", borderRadius: "0.375rem", background: item.isConsignment === 'تحت صرف' ? '#fef3c7' : '#f1f5f9', color: item.isConsignment === 'تحت صرف' ? '#92400e' : '#475569', fontWeight: "600", border: `1px solid ${item.isConsignment === 'تحت صرف' ? '#fde68a' : '#e2e8f0'}` }}>
                        {item.isConsignment}
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem 0.75rem", borderRight: "1px solid #e2e8f0" }}>
                      {item.hasAttachment === 'Yes' ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenAttachment(item); }} 
                          style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", backgroundColor: "#f8fafc", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600", transition: "all 0.2s" }} 
                          onMouseOver={e=>e.currentTarget.style.backgroundColor="#eff6ff"} 
                          onMouseOut={e=>e.currentTarget.style.backgroundColor="#f8fafc"}
                        >
                          <ImageIcon size={14} /> View
                        </button>
                      ) : (
                        <span style={{ color: "#cbd5e1", fontSize: "0.875rem" }}>None</span>
                      )}
                    </td>
                    
                    <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#475569", borderRight: userRole === 'superAdmin' ? "1px solid #e2e8f0" : "none" }}>
                      {item.creator}
                    </td>

                    {userRole === 'superAdmin' && (
                      <>
                        <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#d97706", borderRight: "1px solid #e2e8f0" }}>{item.basePriceIQD ? formatNumberIQD(item.basePriceIQD) : "0"}</td>
                        <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#ea580c", borderRight: "1px solid #e2e8f0" }}>{item.netPriceIQD ? formatNumberIQD(item.netPriceIQD) : "0"}</td>
                        <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#d97706", borderRight: "1px solid #e2e8f0" }}>{item.basePriceUSD ? formatNumberUSD(item.basePriceUSD) : "0"}</td>
                        <td style={{ padding: "0.875rem 0.75rem", fontSize: "0.875rem", color: "#ea580c", borderRight: "1px solid #e2e8f0" }}>{item.netPriceUSD ? formatNumberUSD(item.netPriceUSD) : "0"}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Attachment View Modal */}
      {attachmentModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isFullscreen ? "#000000" : "rgba(15, 23, 42, 0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: isFullscreen ? "0" : "1.5rem", transition: "background-color 0.3s ease" }}>
          <div style={{ backgroundColor: isFullscreen ? "#000000" : "white", borderRadius: isFullscreen ? "0" : "0.75rem", width: "100%", height: isFullscreen ? "100%" : "auto", maxWidth: isFullscreen ? "none" : "36rem", display: "flex", flexDirection: "column", boxShadow: isFullscreen ? "none" : "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", overflow: "hidden", transition: "all 0.3s ease" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderBottom: isFullscreen ? "1px solid #334155" : "1px solid #e2e8f0", backgroundColor: isFullscreen ? "#0f172a" : "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: isFullscreen ? "#f8fafc" : "#0f172a", margin: 0 }}>Invoice #{attachmentModal.billNumber}</h3>
                <span style={{ fontSize: "0.875rem", color: isFullscreen ? "#94a3b8" : "#64748b" }}>{attachmentModal.pharmacyName}</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {imagePreview && (
                  <button onClick={() => downloadImage(imagePreview, attachmentModal.billNumber)} style={{ background: "#2563eb", border: "none", color: "white", display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 0.75rem", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "500", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background="#1d4ed8"} onMouseOut={e=>e.currentTarget.style.background="#2563eb"}>
                    <Download size={16} /> Save to Gallery
                  </button>
                )}
                <button onClick={() => setAttachmentModal(null)} style={{ background: isFullscreen ? "#334155" : "#f1f5f9", border: "none", color: isFullscreen ? "#f8fafc" : "#475569", width: "36px", height: "36px", borderRadius: "0.375rem", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }} onMouseOver={e=>e.currentTarget.style.background=isFullscreen ? "#475569" : "#e2e8f0"} onMouseOut={e=>e.currentTarget.style.background=isFullscreen ? "#334155" : "#f1f5f9"}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, padding: isFullscreen ? "0" : "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: isFullscreen ? "#000000" : "#f8fafc", minHeight: "300px", position: "relative" }}>
              {isImageLoading ? (
                <div style={{ textAlign: "center", color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                  <div style={{ width: "40px", height: "40px", border: "3px solid #cbd5e1", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
                  <p style={{ margin: 0, fontWeight: "500" }}>Fetching attachment from server...</p>
                </div>
              ) : imagePreview ? (
                <>
                  <img 
                    src={imagePreview} 
                    alt="Invoice Attachment" 
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    style={{ maxWidth: "100%", maxHeight: isFullscreen ? "100vh" : "60vh", objectFit: "contain", borderRadius: isFullscreen ? "0" : "0.5rem", boxShadow: isFullscreen ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)", cursor: "zoom-in", transition: "all 0.3s ease" }} 
                  />
                  <button onClick={() => setIsFullscreen(!isFullscreen)} style={{ position: "absolute", bottom: "1rem", right: "1rem", background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(255,255,255,0.2)", color: "white", padding: "0.5rem", borderRadius: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                    {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </button>
                </>
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                  <ImageIcon size={48} opacity={0.5} />
                  <p style={{ margin: 0, fontWeight: "500" }}>{noImageFound ? "No attachment found for this invoice" : "No Image Available"}</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}