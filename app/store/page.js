"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import * as XLSX from 'xlsx';
import { onSnapshot, collection, query, where, orderBy, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Filter, Search } from "lucide-react";

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

// NRT font style for all content
const nrtFontStyle = {
  fontFamily: 'var(--font-nrt-regular), "NRT Regular", Tahoma, sans-serif',
};

const nrtFontBoldStyle = {
  fontFamily: 'var(--font-nrt-bold), "NRT Bold", Tahoma, sans-serif',
  fontWeight: '700',
};

// Helper functions
const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    let dateObj;
    if (date?.toDate) {
      dateObj = date.toDate();
    } else if (date?.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    }

    if (!dateObj || isNaN(dateObj.getTime())) return "N/A";

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "N/A";
  }
};

const formatDateTime = (date) => {
  if (!date) return "N/A";
  try {
    let dateObj;
    if (date?.toDate) {
      dateObj = date.toDate();
    } else if (date?.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    }

    if (!dateObj || isNaN(dateObj.getTime())) return "N/A";

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
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

const getBranchStyle = (branch) => {
  const styles = {
    Slemany: { bg: '#dcfce7', text: '#166534' },
    Erbil: { bg: '#ffe69c', text: '#9f5103' },
    default: { bg: '#f3f4f6', text: '#4b5563' }
  };
  return {
    backgroundColor: styles[branch]?.bg || styles.default.bg,
    color: styles[branch]?.text || styles.default.text,
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    ...nrtFontStyle
  };
};

const getExpiryStyle = (expireDate) => {
  if (!expireDate) return {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    status: 'N/A'
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expireDate);
  expiry.setHours(0, 0, 0, 0);
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(today.getFullYear() + 1);

  if (expiry < today) {
    return {
      backgroundColor: '#fee2e2',
      color: '#991b1b',
      status: 'Expired'
    };
  } else if (expiry <= oneYearFromNow) {
    return {
      backgroundColor: '#fdcb98',
      color: '#9f5103',
      status: 'Expiring Soon'
    };
  } else {
    return {
      backgroundColor: '#dcfce7',
      color: '#166534',
      status: 'Safe'
    };
  }
};

// =========================================================================
// FILTER DROPDOWN COMPONENT
// =========================================================================
const ExcelFilterDropdown = ({ 
  columnKey, 
  type = "string",
  alignLeft = false,
  storeItems,
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
    storeItems.forEach(item => {
      let val = "";
      if (columnKey === 'barcode') val = item.barcode;
      if (columnKey === 'name') val = item.name;
      if (columnKey === 'branch') val = item.branch;
      if (columnKey === 'boughtBill') val = item.boughtBillNumber || 'N/A';
      if (columnKey === 'createdAt') val = formatDateTime(item.createdAt);
      if (columnKey === 'priceType') val = item.priceType;
      if (columnKey === 'basePriceUSD') val = item.basePriceUSD;
      if (columnKey === 'netPriceUSD') val = item.netPriceUSD;
      if (columnKey === 'outPriceUSD') val = item.outPriceUSD;
      if (columnKey === 'basePriceIQD') val = item.basePriceIQD;
      if (columnKey === 'netPriceIQD') val = item.netPriceIQD;
      if (columnKey === 'outPriceIQD') val = item.outPriceIQD;
      if (columnKey === 'quantity') val = item.totalQuantity;
      if (columnKey === 'expireDate') val = formatDate(item.expireDate);

      vals.add(String(val ?? ""));
    });
    return Array.from(vals).sort();
  }, [storeItems, columnKey]);

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
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)", 
            zIndex: 9999, 
            width: "260px", 
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
                style={{ border: "none", outline: "none", width: "100%", boxSizing: "border-box", fontSize: "0.875rem", marginLeft: "0.5rem" }}
              />
            </div>

            <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
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
  storeItems,
  columnFilters,
  activeFilterDropdown,
  setActiveFilterDropdown,
  handleUpdateColumnFilter,
  clearColumnFilter
}) => (
  <th style={{
    backgroundColor: "#34495e", color: "white", padding: "12px 10px",
    textAlign: "left", fontSize: "14px", fontFamily: "'NRT-Bd', sans-serif",
    whiteSpace: "nowrap", borderRight: "1px solid #576574",
    width: colWidth || "auto",
    minWidth: colWidth || "auto"
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
      <div onClick={() => handleSort(columnKey)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
        {title}
        <span style={{ fontSize: "11px", color: "#bdc3c7" }}>
          {getSortIcon(columnKey)}
        </span>
      </div>
      <ExcelFilterDropdown 
        columnKey={columnKey} 
        type={type} 
        alignLeft={alignLeft}
        storeItems={storeItems}
        columnFilters={columnFilters}
        activeFilterDropdown={activeFilterDropdown}
        setActiveFilterDropdown={setActiveFilterDropdown}
        handleUpdateColumnFilter={handleUpdateColumnFilter}
        clearColumnFilter={clearColumnFilter}
      />
    </div>
  </th>
);

export default function StorePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [storeItems, setStoreItems] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [billSearch, setBillSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expireBefore, setExpireBefore] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    quantity: '',
    priceType: 'USD',
    basePriceUSD: '',
    netPriceUSD: '',
    outPriceUSD: '',
    basePriceIQD: '',
    netPriceIQD: '',
    outPriceIQD: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [branchFilter, setBranchFilter] = useState("Slemany");
  const [branchFilterInitialized, setBranchFilterInitialized] = useState(false);

  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);

  // --- ROBUST SUPER ADMIN CHECK (Supports case variations: superAdmin, superadmin, super_admin) ---
  const userRole = (user?.role || "").trim().toLowerCase();
  const isSuperAdmin = userRole === "superadmin" || userRole === "super_admin";
  const canSeeBasePrice = isSuperAdmin;

  useEffect(() => {
    if (!user) return;

    if (!branchFilterInitialized) {
      setBranchFilter(isSuperAdmin ? "All Stores" : (user.branch || "Slemany"));
      setBranchFilterInitialized(true);
      return;
    }

    if (!isSuperAdmin) {
      setBranchFilter(user.branch || "Slemany");
    }
  }, [user, branchFilterInitialized, isSuperAdmin]);

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

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!branchFilterInitialized) return;

    setIsLoading(true);
    setError(null);

    const setupQuery = () => {
      try {
        let q;

        if (isSuperAdmin && branchFilter !== "All Stores") {
          q = query(
            collection(db, "storeItems"),
            where("branch", "==", branchFilter),
            orderBy("createdAt", "desc")
          );
        } else if (!isSuperAdmin) {
          q = query(
            collection(db, "storeItems"),
            where("branch", "==", user.branch || "Slemany"),
            orderBy("createdAt", "desc")
          );
        } else {
          q = query(
            collection(db, "storeItems"),
            orderBy("createdAt", "desc")
          );
        }

        let fallbackUnsubscribe = null;

        const mainUnsubscribe = onSnapshot(
          q,
          (querySnapshot) => {
            const items = [];
            querySnapshot.forEach((docSnap) => {
              items.push({ id: docSnap.id, ...docSnap.data() });
            });
            processItems(items);
          },
          (err) => {
            console.error("Firestore error:", err);
            setError("Failed to load items. Please try again.");

            if (err.code === "failed-precondition" && err.message.includes("requires an index")) {
              console.warn("Composite index missing, using fallback query");

              let fallbackQuery;
              if (isSuperAdmin && branchFilter !== "All Stores") {
                fallbackQuery = query(
                  collection(db, "storeItems"),
                  where("branch", "==", branchFilter),
                  orderBy("createdAt", "desc")
                );
              } else if (!isSuperAdmin) {
                fallbackQuery = query(
                  collection(db, "storeItems"),
                  where("branch", "==", user.branch || "Slemany"),
                  orderBy("createdAt", "desc")
                );
              } else {
                fallbackQuery = query(
                  collection(db, "storeItems"),
                  orderBy("createdAt", "desc")
                );
              }

              fallbackUnsubscribe = onSnapshot(
                fallbackQuery,
                (fallbackSnapshot) => {
                  const allItems = [];
                  fallbackSnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    if (data.quantity > 0) {
                      allItems.push({ id: docSnap.id, ...data });
                    }
                  });
                  processItems(allItems);
                },
                (fallbackError) => {
                  console.error("Fallback query failed:", fallbackError);
                  setError("Failed to load items with fallback query. Please try again later.");
                  setIsLoading(false);
                }
              );
            }
          }
        );

        return () => {
          mainUnsubscribe();
          if (fallbackUnsubscribe) fallbackUnsubscribe();
        };
      } catch (err) {
        console.error("Error setting up query:", err);
        setError("Failed to set up data connection. Please refresh the page.");
        setIsLoading(false);
        return () => {};
      }
    };

    const processItems = (items) => {
      try {
        const grouped = {};
        items.forEach(item => {
          if (Number(item.quantity) <= 0) return;

          const rawCurrency = String(item.originalCurrency || item.currency || item.priceType || 'USD').toUpperCase();
          const isIqd = rawCurrency === 'IQD' || rawCurrency.includes('DINAR');
          const priceType = isIqd ? 'IQD' : 'USD';

          let basePriceUSD = 0;
          let netPriceUSD = 0;
          let outPriceUSD = 0;
          let basePriceIQD = 0;
          let netPriceIQD = 0;
          let outPriceIQD = 0;

          if (isIqd) {
            basePriceIQD = Number(item.basePriceIQD || item.basePrice || (item.priceType === 'IQD' ? item.price : 0)) || 0;
            netPriceIQD = Number(item.netPriceIQD || item.netPrice) || 0;
            outPriceIQD = Number(item.outPriceIQD || item.outPrice) || 0;
          } else {
            basePriceUSD = Number(item.basePriceUSD || item.basePrice || (item.priceType === 'USD' ? item.price : 0)) || 0;
            netPriceUSD = Number(item.netPriceUSD || item.netPrice) || 0;
            outPriceUSD = Number(item.outPriceUSD || item.outPrice) || 0;
          }

          const boughtBill = item.boughtBillNumber || item.billNumber || 'N/A';
          const branch = item.branch || 'Slemany';

          const expireDateKey = item.expireDate?.seconds ? item.expireDate.seconds : String(item.expireDate || 'none');
          const key = `${item.barcode}-${priceType}-${basePriceUSD}-${netPriceUSD}-${outPriceUSD}-${basePriceIQD}-${netPriceIQD}-${outPriceIQD}-${branch}-${boughtBill}-${expireDateKey}`;

          if (!grouped[key]) {
            grouped[key] = {
              id: item.id,
              barcode: item.barcode,
              name: item.name,
              priceType: priceType,
              basePriceUSD: basePriceUSD,
              netPriceUSD: netPriceUSD,
              outPriceUSD: outPriceUSD,
              basePriceIQD: basePriceIQD,
              netPriceIQD: netPriceIQD,
              outPriceIQD: outPriceIQD,
              branch: branch,
              boughtBillNumber: boughtBill,
              totalQuantity: 0,
              expireDate: item.expireDate?.toDate ? item.expireDate.toDate() : item.expireDate,
              createdAt: item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt
            };
          }
          grouped[key].totalQuantity += Number(item.quantity) || 0;
        });

        setStoreItems(Object.values(grouped));
        setIsLoading(false);
      } catch (err) {
        console.error("Error processing items:", err);
        setIsLoading(false);
      }
    };

    const unsubscribe = setupQuery();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user, router, branchFilter, branchFilterInitialized, isSuperAdmin]);

  const sortItems = useCallback((items) => {
    return [...items].sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction;

      if (key === 'name') {
        return direction === 'asc' ? a.name?.localeCompare(b.name) : b.name?.localeCompare(a.name);
      } else if (key === 'barcode') {
        return direction === 'asc' ? a.barcode?.localeCompare(b.barcode) : b.barcode?.localeCompare(a.barcode);
      } else if (key === 'quantity') {
        return direction === 'asc' ? a.totalQuantity - b.totalQuantity : b.totalQuantity - a.totalQuantity;
      } else if (key === 'basePriceUSD') {
        return direction === 'asc' ? a.basePriceUSD - b.basePriceUSD : b.basePriceUSD - a.basePriceUSD;
      } else if (key === 'netPriceUSD') {
        return direction === 'asc' ? a.netPriceUSD - b.netPriceUSD : b.netPriceUSD - a.netPriceUSD;
      } else if (key === 'outPriceUSD') {
        return direction === 'asc' ? a.outPriceUSD - b.outPriceUSD : b.outPriceUSD - a.outPriceUSD;
      } else if (key === 'basePriceIQD') {
        return direction === 'asc' ? a.basePriceIQD - b.basePriceIQD : b.basePriceIQD - a.basePriceIQD;
      } else if (key === 'netPriceIQD') {
        return direction === 'asc' ? a.netPriceIQD - b.netPriceIQD : b.netPriceIQD - a.netPriceIQD;
      } else if (key === 'outPriceIQD') {
        return direction === 'asc' ? a.outPriceIQD - b.outPriceIQD : b.outPriceIQD - a.outPriceIQD;
      } else if (key === 'branch') {
        return direction === 'asc' ? a.branch.localeCompare(b.branch) : b.branch.localeCompare(a.branch);
      } else if (key === 'boughtBill') {
        return direction === 'asc' ? String(a.boughtBillNumber).localeCompare(String(b.boughtBillNumber)) : String(b.boughtBillNumber).localeCompare(String(a.boughtBillNumber));
      } else if (key === 'createdAt') {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (key === 'expireDate') {
        const dateA = a.expireDate ? new Date(a.expireDate) : new Date(0);
        const dateB = b.expireDate ? new Date(b.expireDate) : new Date(0);
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return 0;
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

  const handleBranchChange = (e) => {
    setBranchFilter(e.target.value);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setBarcodeSearch("");
    setBillSearch("");
    setFromDate("");
    setToDate("");
    setExpireBefore("");
    setColumnFilters({});
  };

  const handleExpireBeforeChange = (e) => {
    setExpireBefore(e.target.value);
  };

  const handleUpdateColumnFilter = useCallback((columnKey, updates) => {
    if (!canSeeBasePrice && (columnKey === 'basePriceUSD' || columnKey === 'basePriceIQD')) return;

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
  }, [canSeeBasePrice]);

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
        case 'isEmpty': return !itemValue || itemValue === "N/A" || itemValue === "-";
        case 'isNotEmpty': return !!itemValue && itemValue !== "N/A" && itemValue !== "-";
        default: return true;
      }
    }
    return true;
  };

  const filteredItems = useMemo(() => {
    const sorted = sortItems(storeItems);

    return sorted.filter(item => {
      const matchesName = !searchQuery || item.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBarcode = !barcodeSearch || item.barcode?.toLowerCase().includes(barcodeSearch.toLowerCase());
      const matchesBill = !billSearch || String(item.boughtBillNumber).toLowerCase().includes(billSearch.toLowerCase());

      let matchesDateRange = true;
      if (fromDate || toDate) {
        const itemDate = item.createdAt ? new Date(item.createdAt) : null;
        if (itemDate) {
          if (fromDate) {
            const from = new Date(fromDate);
            from.setHours(0, 0, 0, 0);
            if (itemDate < from) matchesDateRange = false;
          }
          if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
            if (itemDate > to) matchesDateRange = false;
          }
        }
      }

      let matchesExpireBefore = true;
      if (expireBefore) {
        const expireDate = new Date(expireBefore);
        expireDate.setHours(23, 59, 59, 999);
        if (item.expireDate && new Date(item.expireDate) > expireDate) {
          matchesExpireBefore = false;
        }
      }

      if (!(matchesName && matchesBarcode && matchesBill && matchesDateRange && matchesExpireBefore)) return false;

      for (const [columnKey, filterData] of Object.entries(columnFilters)) {
        if (!canSeeBasePrice && (columnKey === 'basePriceUSD' || columnKey === 'basePriceIQD')) continue;

        let itemValue = "";
        if (columnKey === 'barcode') itemValue = item.barcode;
        if (columnKey === 'name') itemValue = item.name;
        if (columnKey === 'branch') itemValue = item.branch;
        if (columnKey === 'boughtBill') itemValue = item.boughtBillNumber || 'N/A';
        if (columnKey === 'createdAt') itemValue = formatDateTime(item.createdAt);
        if (columnKey === 'priceType') itemValue = item.priceType;
        if (columnKey === 'basePriceUSD') itemValue = item.basePriceUSD;
        if (columnKey === 'netPriceUSD') itemValue = item.netPriceUSD;
        if (columnKey === 'outPriceUSD') itemValue = item.outPriceUSD;
        if (columnKey === 'basePriceIQD') itemValue = item.basePriceIQD;
        if (columnKey === 'netPriceIQD') itemValue = item.netPriceIQD;
        if (columnKey === 'outPriceIQD') itemValue = item.outPriceIQD;
        if (columnKey === 'quantity') itemValue = item.totalQuantity;
        if (columnKey === 'expireDate') itemValue = formatDate(item.expireDate);

        const isNum = ['basePriceUSD','netPriceUSD','outPriceUSD','basePriceIQD','netPriceIQD','outPriceIQD','quantity'].includes(columnKey);

        if (!evaluateFilter(itemValue, filterData, isNum ? "number" : "string")) return false;
      }

      return true;
    });
  }, [storeItems, searchQuery, barcodeSearch, billSearch, fromDate, toDate, expireBefore, sortItems, columnFilters, canSeeBasePrice]);

  const totalQuantity = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.totalQuantity, 0);
  }, [filteredItems]);

  const totalBaseValueUSD = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.basePriceUSD * item.totalQuantity), 0);
  }, [filteredItems]);

  const totalNetValueUSD = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.netPriceUSD * item.totalQuantity), 0);
  }, [filteredItems]);

  const totalBaseValueIQD = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.basePriceIQD * item.totalQuantity), 0);
  }, [filteredItems]);

  const totalNetValueIQD = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.netPriceIQD * item.totalQuantity), 0);
  }, [filteredItems]);

  const exportToExcel = () => {
    try {
      const exportData = filteredItems.map(item => {
        const expiryStyle = getExpiryStyle(item.expireDate);
        const row = {
          'Barcode': item.barcode,
          'Item Name': item.name,
          'Total Quantity': item.totalQuantity,
        };

        if (canSeeBasePrice) {
          row['Base Price (USD)'] = item.basePriceUSD ? formatUSD(item.basePriceUSD) : '-';
        }
        row['Net Price (USD)'] = item.netPriceUSD ? formatUSD(item.netPriceUSD) : '-';
        row['Out Price (USD)'] = item.outPriceUSD ? formatUSD(item.outPriceUSD) : '-';

        if (canSeeBasePrice) {
          row['Base Price (IQD)'] = item.basePriceIQD ? formatIQD(item.basePriceIQD) : '-';
        }
        row['Net Price (IQD)'] = item.netPriceIQD ? formatIQD(item.netPriceIQD) : '-';
        row['Out Price (IQD)'] = item.outPriceIQD ? formatIQD(item.outPriceIQD) : '-';

        if (canSeeBasePrice) {
          row['Total Base Value (USD)'] = item.basePriceUSD ? formatUSD(item.basePriceUSD * item.totalQuantity) : '-';
        }
        row['Total Net Value (USD)'] = item.netPriceUSD ? formatUSD(item.netPriceUSD * item.totalQuantity) : '-';

        if (canSeeBasePrice) {
          row['Total Base Value (IQD)'] = item.basePriceIQD ? formatIQD(item.basePriceIQD * item.totalQuantity) : '-';
        }
        row['Total Net Value (IQD)'] = item.netPriceIQD ? formatIQD(item.netPriceIQD * item.totalQuantity) : '-';

        row['Added Date'] = formatDateTime(item.createdAt);
        row['Expiry Date'] = item.expireDate ? formatDate(item.expireDate) : 'N/A';
        row['Expiry Status'] = item.expireDate ? expiryStyle.status : 'N/A';
        row['Bought Bill #'] = item.boughtBillNumber;
        row['Currency'] = item.priceType;
        row['Branch'] = item.branch;

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Store Inventory");

      const date = new Date();
      const dateStr = `${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}`;
      const filename = `store_inventory_${branchFilter}_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      setError("Failed to export data. Please try again.");
    }
  };

  if (!user) return null;

  if (isLoading) {
    return (
      <div style={{ width: '100%', margin: 0, padding: 0, boxSizing: 'border-box', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', ...nrtFontStyle }}>
        <div style={{
          animation: 'spin 1s linear infinite',
          borderRadius: '9999px',
          height: '40px',
          width: '40px',
          borderTop: '2px solid #3b82f6',
          borderBottom: '2px solid #3b82f6'
        }}></div>
      </div>
    );
  }

  // Barcode, Name, Qty, [Base USD], Net USD, Out USD, [Base IQD], Net IQD, Out IQD, Added Date, Expiry Date, Bought Bill, Currency, Branch, Actions
  const columnsCount = (canSeeBasePrice ? 14 : 12) + 1;

  return (
    <div style={{ width: '100%', margin: 0, padding: 0, boxSizing: 'border-box', backgroundColor: 'white', ...nrtFontStyle, minHeight: '100vh' }}>

      <div style={{ width: '100%', boxSizing: 'border-box' }}>

        <div style={{ padding: '15px 15px 0 15px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: 0, ...nrtFontBoldStyle }}>Store Inventory</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={exportToExcel}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  ...nrtFontStyle
                }}
              >
                Export to Excel
              </button>
              <button
                onClick={handleRefresh}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  ...nrtFontStyle
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              marginBottom: '1rem',
              ...nrtFontStyle
            }}>
              {error}
              <button
                onClick={handleRefresh}
                style={{
                  marginLeft: '1rem',
                  padding: '4px 8px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
            </div>
          )}

          {isSuperAdmin && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Branch:</label>
              <select
                value={branchFilter}
                onChange={handleBranchChange}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  width: '200px',
                  ...nrtFontStyle
                }}
              >
                <option value="Slemany">Slemany</option>
                <option value="Erbil">Erbil</option>
                <option value="All Stores">All Stores</option>
              </select>
            </div>
          )}

          <div style={{
            padding: '10px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            marginBottom: '1.5rem',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', ...nrtFontStyle }}>From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', ...nrtFontStyle }}>To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', ...nrtFontStyle }}>Expires Before</label>
                <input
                  type="date"
                  value={expireBefore}
                  onChange={handleExpireBeforeChange}
                  style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={clearFilters}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  ...nrtFontStyle
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', ...nrtFontStyle }}>
              Showing {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
              {isSuperAdmin && branchFilter !== "All Stores" && ` in ${branchFilter}`}
              {isSuperAdmin && branchFilter === "All Stores" && ` across all branches`}
              {!isSuperAdmin && ` in ${user.branch || "Slemany"}`}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', display: 'flex', gap: '1rem', ...nrtFontBoldStyle }}>
              <div>Total USD Value: {canSeeBasePrice && <>Base: {formatUSD(totalBaseValueUSD)} | </>}Net: {formatUSD(totalNetValueUSD)}</div>
              <div>Total IQD Value: {canSeeBasePrice && <>Base: {formatIQD(totalBaseValueIQD)} | </>}Net: {formatIQD(totalNetValueIQD)}</div>
            </div>
          </div>
        </div>

        {/* Table container */}
        <div style={{
          width: '100%',
          overflowX: 'auto',
          overflowY: 'auto',
          minHeight: '65vh',
          maxHeight: '85vh',
          borderTop: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <table style={{ width: '100%', margin: 0, borderCollapse: 'collapse', minWidth: '1000px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                {/* 1. Barcode */}
                <TableHeader title="Barcode" columnKey="barcode" colWidth="110px" alignLeft={true} sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                {/* 2. Item Name */}
                <TableHeader title="Item Name" columnKey="name" colWidth="auto" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                {/* 3. Quantity */}
                <TableHeader title="Quantity" columnKey="quantity" type="number" colWidth="90px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                {/* 4. Prices */}
                {canSeeBasePrice && (
                  <TableHeader title="Base Price (USD)" columnKey="basePriceUSD" type="number" colWidth="110px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                )}
                <TableHeader title="Net Price (USD)" columnKey="netPriceUSD" type="number" colWidth="110px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Out Price (USD)" columnKey="outPriceUSD" type="number" colWidth="110px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                {canSeeBasePrice && (
                  <TableHeader title="Base Price (IQD)" columnKey="basePriceIQD" type="number" colWidth="110px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                )}
                <TableHeader title="Net Price (IQD)" columnKey="netPriceIQD" type="number" colWidth="110px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                <TableHeader title="Out Price (IQD)" columnKey="outPriceIQD" type="number" colWidth="110px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                {/* 5. Added Date */}
                <TableHeader title="Added Date" columnKey="createdAt" colWidth="140px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />

                {/* 6. Expiry Date */}
                <TableHeader title="Expiry Date" columnKey="expireDate" colWidth="120px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                {/* 7. Bought Bill # */}
                <TableHeader title="Bought Bill #" columnKey="boughtBill" colWidth="120px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                {/* 8. Currency */}
                <TableHeader title="Currency" columnKey="priceType" colWidth="90px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />

                {/* 9. Branch */}
                <TableHeader title="Branch" columnKey="branch" colWidth="90px" sortConfig={sortConfig} handleSort={handleSort} getSortIcon={getSortIcon} storeItems={storeItems} columnFilters={columnFilters} activeFilterDropdown={activeFilterDropdown} setActiveFilterDropdown={setActiveFilterDropdown} handleUpdateColumnFilter={handleUpdateColumnFilter} clearColumnFilter={clearColumnFilter} />
                
                {/* 10. Actions */}
                <th style={{ padding: '12px', textAlign: 'left', backgroundColor: "#34495e", color: "white", width: "80px", borderRight: 'none', ...nrtFontBoldStyle }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={columnsCount} style={{ textAlign: 'center', padding: '3.5rem', backgroundColor: '#f9fafb', color: '#6b7280', ...nrtFontStyle }}>
                    <div style={{ margin: '0 auto 12px', height: '44px', width: '44px', borderRadius: '9999px', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Search size={20} color="#9ca3af" />
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#1f2937', marginBottom: '4px' }}>
                      {fromDate || toDate || expireBefore || Object.keys(columnFilters).length > 0 ? "No matching records found" : "No items in store"}
                    </div>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      {fromDate || toDate || expireBefore || Object.keys(columnFilters).length > 0 ? "Try adjusting or clearing your active filters" : "Items will appear here once added to stock"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const expiryStyle = getExpiryStyle(item.expireDate);
                  const isUSD = item.priceType === 'USD';
                  const isZeroQuantity = item.totalQuantity === 0;

                  return (
                    <tr key={index} style={{
                      borderBottom: '1px solid #e5e7eb',
                      ...nrtFontStyle,
                      opacity: isZeroQuantity ? '0.6' : '1',
                      backgroundColor: isZeroQuantity ? '#f9fafb' : 'transparent'
                    }}>
                      {/* 1. Barcode */}
                      <td style={{ padding: '12px', fontFamily: 'monospace', borderRight: '1px solid #e5e7eb', ...nrtFontStyle }}>{item.barcode}</td>

                      {/* 2. Item Name */}
                      <td style={{ padding: '12px', fontWeight: '500', borderRight: '1px solid #e5e7eb', wordBreak: 'break-word', whiteSpace: 'normal', ...nrtFontStyle }}>{item.name}</td>

                      {/* 3. Quantity */}
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}>
                        <span style={{
                          backgroundColor: isZeroQuantity ? '#f3f4f6' : (item.totalQuantity > 10 ? '#d1fae5' : '#fee2e2'),
                          color: isZeroQuantity ? '#6b7280' : (item.totalQuantity > 10 ? '#065f46' : '#991b1b'),
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                          ...nrtFontStyle
                        }}>
                          {item.totalQuantity} {isZeroQuantity && '(Out of Stock)'}
                        </span>
                      </td>

                      {/* 4. Prices */}
                      {canSeeBasePrice && (
                        <td style={{
                          padding: '12px', borderRight: '1px solid #e5e7eb',
                          backgroundColor: isUSD ? '#f0fdf4' : '#f9fafb',
                          color: isUSD ? '#065f46' : '#9ca3af',
                          ...nrtFontStyle
                        }}>
                          {isUSD ? formatUSD(item.basePriceUSD) : '-'}
                        </td>
                      )}
                      <td style={{
                        padding: '12px', borderRight: '1px solid #e5e7eb',
                        backgroundColor: isUSD ? '#f0fdf4' : '#f9fafb',
                        color: isUSD ? '#065f46' : '#9ca3af',
                        ...nrtFontStyle
                      }}>
                        {isUSD ? formatUSD(item.netPriceUSD) : '-'}
                      </td>
                      <td style={{
                        padding: '12px', borderRight: '1px solid #e5e7eb',
                        backgroundColor: isUSD ? '#f0fdf4' : '#f9fafb',
                        color: isUSD ? '#065f46' : '#9ca3af',
                        ...nrtFontStyle
                      }}>
                        {isUSD ? formatUSD(item.outPriceUSD) : '-'}
                      </td>

                      {canSeeBasePrice && (
                        <td style={{
                          padding: '12px', borderRight: '1px solid #e5e7eb',
                          backgroundColor: !isUSD ? '#fef3c7' : '#f9fafb',
                          color: !isUSD ? '#92400e' : '#9ca3af',
                          ...nrtFontStyle
                        }}>
                          {!isUSD ? formatIQD(item.basePriceIQD) : '-'}
                        </td>
                      )}
                      <td style={{
                        padding: '12px', borderRight: '1px solid #e5e7eb',
                        backgroundColor: !isUSD ? '#fef3c7' : '#f9fafb',
                        color: !isUSD ? '#92400e' : '#9ca3af',
                        ...nrtFontStyle
                      }}>
                        {!isUSD ? formatIQD(item.netPriceIQD) : '-'}
                      </td>
                      <td style={{
                        padding: '12px', borderRight: '1px solid #e5e7eb',
                        backgroundColor: !isUSD ? '#fef3c7' : '#f9fafb',
                        color: !isUSD ? '#92400e' : '#9ca3af',
                        ...nrtFontStyle
                      }}>
                        {!isUSD ? formatIQD(item.outPriceIQD) : '-'}
                      </td>

                      {/* 5. Added Date */}
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb', ...nrtFontStyle }}>{formatDateTime(item.createdAt)}</td>

                      {/* 6. Expiry Date */}
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}>
                        {item.expireDate ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{
                              backgroundColor: expiryStyle.backgroundColor,
                              color: expiryStyle.color,
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '500',
                              ...nrtFontStyle
                            }}>
                              {formatDate(item.expireDate)}
                            </span>
                            {expiryStyle.status !== 'Safe' && (
                              <span style={{
                                backgroundColor: expiryStyle.backgroundColor,
                                color: expiryStyle.color,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '600',
                                ...nrtFontStyle
                              }}>
                                {expiryStyle.status}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{
                            backgroundColor: '#f3f4f6',
                            color: '#6b7280',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            ...nrtFontStyle
                          }}>
                            N/A
                          </span>
                        )}
                      </td>

                      {/* 7. Bought Bill # */}
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}>
                        <span style={{
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          ...nrtFontStyle
                        }}>
                          {item.boughtBillNumber || 'N/A'}
                        </span>
                      </td>

                      {/* 8. Currency */}
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}>
                        <span style={{
                          backgroundColor: isUSD ? '#dbeafe' : '#fef3c7',
                          color: isUSD ? '#1e40af' : '#92400e',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          ...nrtFontStyle
                        }}>
                          {item.priceType}
                        </span>
                      </td>

                      {/* 9. Branch */}
                      <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}>
                        <span style={getBranchStyle(item.branch)}>{item.branch}</span>
                      </td>

                      {/* 10. Actions */}
                      <td style={{ padding: '12px', borderRight: 'none' }}>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setEditForm({
                              quantity: item.totalQuantity,
                              priceType: item.priceType,
                              basePriceUSD: item.basePriceUSD || '',
                              netPriceUSD: item.netPriceUSD || '',
                              outPriceUSD: item.outPriceUSD || '',
                              basePriceIQD: item.basePriceIQD || '',
                              netPriceIQD: item.netPriceIQD || '',
                              outPriceIQD: item.outPriceIQD || ''
                            });
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            ...nrtFontStyle
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 1 }}>
              <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #e5e7eb', boxShadow: '0 -2px 4px rgba(0,0,0,0.05)' }}>
                {/* Matches 1. Barcode & 2. Item Name */}
                <td colSpan={2} style={{ padding: '12px', textAlign: 'right', fontWeight: '600', borderRight: '1px solid #e5e7eb', ...nrtFontBoldStyle }}>
                  Totals:
                </td>

                {/* Matches 3. Quantity */}
                <td style={{ padding: '12px', fontWeight: '600', color: '#1f2937', borderRight: '1px solid #e5e7eb', ...nrtFontBoldStyle }}>
                  {totalQuantity}
                </td>

                {/* Matches 4. USD Prices (3 cols if superAdmin, else 2 cols) */}
                <td colSpan={canSeeBasePrice ? 3 : 2} style={{ padding: '12px', fontWeight: '600', color: '#065f46', borderRight: '1px solid #e5e7eb', ...nrtFontBoldStyle }}>
                  {canSeeBasePrice && <>USD Base: {formatUSD(totalBaseValueUSD)}<br/></>}
                  USD Net: {formatUSD(totalNetValueUSD)}
                </td>

                {/* Matches IQD Prices (3 cols if superAdmin, else 2 cols) */}
                <td colSpan={canSeeBasePrice ? 3 : 2} style={{ padding: '12px', fontWeight: '600', color: '#92400e', borderRight: '1px solid #e5e7eb', ...nrtFontBoldStyle }}>
                  {canSeeBasePrice && <>IQD Base: {formatIQD(totalBaseValueIQD)}<br/></>}
                  IQD Net: {formatIQD(totalNetValueIQD)}
                </td>

                {/* Matches 5. Added Date */}
                <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}></td>

                {/* Matches 6. Expiry Date */}
                <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}></td>

                {/* Matches 7. Bought Bill # */}
                <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}></td>

                {/* Matches 8. Currency */}
                <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}></td>

                {/* Matches 9. Branch */}
                <td style={{ padding: '12px', borderRight: '1px solid #e5e7eb' }}></td>

                {/* Matches 10. Actions */}
                <td style={{ padding: '12px', borderRight: 'none' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            ...nrtFontStyle
          }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '18px', fontWeight: '600', ...nrtFontBoldStyle }}>
              Edit {editingItem.name}
            </h3>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setIsSubmitting(true);

                const newQuantity = parseInt(editForm.quantity);

                if (isNaN(newQuantity) || newQuantity < 0) {
                  setError("Please enter a valid quantity");
                  return;
                }

                const updateData = {
                  quantity: newQuantity,
                };

                if (editForm.priceType === 'USD') {
                  const basePriceUSD = canSeeBasePrice
                    ? parseFloat(editForm.basePriceUSD)
                    : (editingItem.basePriceUSD || 0);
                  const netPriceUSD = parseFloat(editForm.netPriceUSD);
                  const outPriceUSD = parseFloat(editForm.outPriceUSD);

                  if (isNaN(basePriceUSD) || basePriceUSD < 0 ||
                      isNaN(netPriceUSD) || netPriceUSD < 0 ||
                      isNaN(outPriceUSD) || outPriceUSD < 0) {
                    setError("Please enter valid USD prices");
                    return;
                  }

                  if (canSeeBasePrice && netPriceUSD < basePriceUSD) {
                    setError("Net price cannot be less than base price");
                    return;
                  }

                  if (outPriceUSD < netPriceUSD) {
                    setError("Out price cannot be less than net price");
                    return;
                  }

                  updateData.basePriceUSD = basePriceUSD;
                  updateData.netPriceUSD = netPriceUSD;
                  updateData.outPriceUSD = outPriceUSD;
                } else {
                  const basePriceIQD = canSeeBasePrice
                    ? parseFloat(editForm.basePriceIQD)
                    : (editingItem.basePriceIQD || 0);
                  const netPriceIQD = parseFloat(editForm.netPriceIQD);
                  const outPriceIQD = parseFloat(editForm.outPriceIQD);

                  if (isNaN(basePriceIQD) || basePriceIQD < 0 ||
                      isNaN(netPriceIQD) || netPriceIQD < 0 ||
                      isNaN(outPriceIQD) || outPriceIQD < 0) {
                    setError("Please enter valid IQD prices");
                    return;
                  }

                  if (canSeeBasePrice && netPriceIQD < basePriceIQD) {
                    setError("Net price cannot be less than base price");
                    return;
                  }

                  if (outPriceIQD < netPriceIQD) {
                    setError("Out price cannot be less than net price");
                    return;
                  }

                  updateData.basePriceIQD = basePriceIQD;
                  updateData.netPriceIQD = netPriceIQD;
                  updateData.outPriceIQD = outPriceIQD;
                }

                await updateDoc(doc(db, "storeItems", editingItem.id), updateData);

                setEditingItem(null);
                setError(null);
              } catch (err) {
                console.error("Error updating item:", err);
                setError(err.message || "Failed to update item");
              } finally {
                setIsSubmitting(false);
              }
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Quantity</label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({...editForm, quantity: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', ...nrtFontStyle }}
                  required
                  min="0"
                />
              </div>

              {/* Read-Only Currency Display */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Currency</label>
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: editForm.priceType === 'USD' ? '#dbeafe' : '#fef3c7',
                  color: editForm.priceType === 'USD' ? '#1e40af' : '#92400e',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'inline-block'
                }}>
                  {editForm.priceType === 'USD' ? 'USD ($)' : 'IQD (د.ع)'}
                </div>
              </div>

              {editForm.priceType === 'USD' ? (
                <>
                  {canSeeBasePrice && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Base Price (USD) - Purchase Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.basePriceUSD}
                        onChange={(e) => setEditForm({...editForm, basePriceUSD: e.target.value})}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', ...nrtFontStyle }}
                        required
                        min="0"
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Net Price (USD) - Including Expenses</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.netPriceUSD}
                      onChange={(e) => setEditForm({...editForm, netPriceUSD: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', ...nrtFontStyle }}
                      required
                      min="0"
                    />
                    {canSeeBasePrice && (
                      <small style={{ color: '#6b7280', ...nrtFontStyle }}>Must be greater than or equal to base price</small>
                    )}
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Out Price (USD) - Selling Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.outPriceUSD}
                      onChange={(e) => setEditForm({...editForm, outPriceUSD: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', ...nrtFontStyle }}
                      required
                      min="0"
                    />
                    <small style={{ color: '#6b7280', ...nrtFontStyle }}>Must be greater than or equal to net price</small>
                  </div>
                </>
              ) : (
                <>
                  {canSeeBasePrice && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Base Price (IQD) - Purchase Price</label>
                      <input
                        type="number"
                        value={editForm.basePriceIQD}
                        onChange={(e) => setEditForm({...editForm, basePriceIQD: e.target.value})}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', ...nrtFontStyle }}
                        required
                        min="0"
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Net Price (IQD) - Including Expenses</label>
                    <input
                      type="number"
                      value={editForm.netPriceIQD}
                      onChange={(e) => setEditForm({...editForm, netPriceIQD: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', ...nrtFontStyle }}
                      required
                      min="0"
                    />
                    {canSeeBasePrice && (
                      <small style={{ color: '#6b7280', ...nrtFontStyle }}>Must be greater than or equal to base price</small>
                    )}
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Out Price (IQD) - Selling Price</label>
                    <input
                      type="number"
                      value={editForm.outPriceIQD}
                      onChange={(e) => setEditForm({...editForm, outPriceIQD: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', ...nrtFontStyle }}
                      required
                      min="0"
                    />
                    <small style={{ color: '#6b7280', ...nrtFontStyle }}>Must be greater than or equal to net price</small>
                  </div>
                </>
              )}

              {error && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#991b1b',
                  marginBottom: '1rem',
                  ...nrtFontStyle
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setError(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    ...nrtFontStyle
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    ...nrtFontStyle
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}