"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { getStoreItems, updateStoreItem } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import * as XLSX from 'xlsx';
import { onSnapshot, collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  if (amount === undefined || amount === null || amount === 0) return "-";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatIQD = (amount) => {
  if (amount === undefined || amount === null || amount === 0) return "-";
  // Use English/Western numbers only
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount) + " IQD";
};

const getBranchStyle = (branch) => {
  const styles = {
    Slemany: { bg: '#dcfce7', text: '#166534' },
    Erbil: { bg: '#dbeafe', text: '#1e40af' },
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

// Main component
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
  const [branchFilter, setBranchFilter] = useState(
    user?.role === "superAdmin" ? "All Stores" : user?.branch || "Slemany"
  );

  // Fetch store items with proper error handling and fallback
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    setError(null);

    const setupQuery = () => {
      try {
        let q;

        if (user.role === "superAdmin" && branchFilter !== "All Stores") {
          q = query(
            collection(db, "storeItems"),
            where("branch", "==", branchFilter),
            orderBy("createdAt", "desc")
          );
        } else if (user.role !== "superAdmin") {
          q = query(
            collection(db, "storeItems"),
            where("branch", "==", user.branch),
  
            orderBy("createdAt", "desc")
          );
        } else {
          q = query(
            collection(db, "storeItems"),

            orderBy("createdAt", "desc")
          );
        }

        return onSnapshot(
          q,
          (querySnapshot) => {
            const items = [];
            querySnapshot.forEach((doc) => {
              items.push({ id: doc.id, ...doc.data() });
            });
            processItems(items);
          },
          (error) => {
            console.error("Firestore error:", error);
            setError("Failed to load items. Please try again.");

            if (error.code === "failed-precondition" && error.message.includes("requires an index")) {
              console.warn("Composite index missing, using fallback query");

              let fallbackQuery;
              if (user.role === "superAdmin" && branchFilter !== "All Stores") {
                fallbackQuery = query(
                  collection(db, "storeItems"),
                  where("branch", "==", branchFilter),
                  orderBy("createdAt", "desc")
                );
              } else if (user.role !== "superAdmin") {
                fallbackQuery = query(
                  collection(db, "storeItems"),
                  where("branch", "==", user.branch),
                  orderBy("createdAt", "desc")
                );
              } else {
                fallbackQuery = query(
                  collection(db, "storeItems"),
                  orderBy("createdAt", "desc")
                );
              }

              return onSnapshot(
                fallbackQuery,
                (fallbackSnapshot) => {
                  const allItems = [];
                  fallbackSnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.quantity > 0) {
                      allItems.push({ id: doc.id, ...data });
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
          let priceType = 'USD';
          let basePriceUSD = 0;
          let netPriceUSD = 0;
          let outPriceUSD = 0;
          let basePriceIQD = 0;
          let netPriceIQD = 0;
          let outPriceIQD = 0;
          
          if (item.basePriceUSD || item.netPriceUSD || item.outPriceUSD) {
            priceType = 'USD';
            basePriceUSD = item.basePriceUSD || 0;
            netPriceUSD = item.netPriceUSD || 0;
            outPriceUSD = item.outPriceUSD || 0;
          } else if (item.basePriceIQD || item.netPriceIQD || item.outPriceIQD) {
            priceType = 'IQD';
            basePriceIQD = item.basePriceIQD || 0;
            netPriceIQD = item.netPriceIQD || 0;
            outPriceIQD = item.outPriceIQD || 0;
          }
          
          const key = `${item.barcode}-${priceType}-${basePriceUSD}-${netPriceUSD}-${outPriceUSD}-${basePriceIQD}-${netPriceIQD}-${outPriceIQD}-${item.branch}-${item.boughtBillNumber}`;

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
              branch: item.branch,
              boughtBillNumber: item.boughtBillNumber,
              totalQuantity: 0,
              expireDate: item.expireDate?.toDate ? item.expireDate.toDate() : item.expireDate,
              createdAt: item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt
            };
          }
          grouped[key].totalQuantity += item.quantity;
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
  }, [user, router, branchFilter]);

  // Sort items
  const sortItems = useCallback((items) => {
    return [...items].sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction;

      if (key === 'name') {
        return direction === 'asc'
          ? a.name?.localeCompare(b.name)
          : b.name?.localeCompare(a.name);
      } else if (key === 'barcode') {
        return direction === 'asc'
          ? a.barcode?.localeCompare(b.barcode)
          : b.barcode?.localeCompare(a.barcode);
      } else if (key === 'quantity') {
        return direction === 'asc'
          ? a.totalQuantity - b.totalQuantity
          : b.totalQuantity - a.totalQuantity;
      } else if (key === 'basePriceUSD') {
        return direction === 'asc' 
          ? a.basePriceUSD - b.basePriceUSD 
          : b.basePriceUSD - a.basePriceUSD;
      } else if (key === 'netPriceUSD') {
        return direction === 'asc' 
          ? a.netPriceUSD - b.netPriceUSD 
          : b.netPriceUSD - a.netPriceUSD;
      } else if (key === 'outPriceUSD') {
        return direction === 'asc' 
          ? a.outPriceUSD - b.outPriceUSD 
          : b.outPriceUSD - a.outPriceUSD;
      } else if (key === 'basePriceIQD') {
        return direction === 'asc' 
          ? a.basePriceIQD - b.basePriceIQD 
          : b.basePriceIQD - a.basePriceIQD;
      } else if (key === 'netPriceIQD') {
        return direction === 'asc' 
          ? a.netPriceIQD - b.netPriceIQD 
          : b.netPriceIQD - a.netPriceIQD;
      } else if (key === 'outPriceIQD') {
        return direction === 'asc' 
          ? a.outPriceIQD - b.outPriceIQD 
          : b.outPriceIQD - a.outPriceIQD;
      } else if (key === 'branch') {
        return direction === 'asc'
          ? a.branch.localeCompare(b.branch)
          : b.branch.localeCompare(a.branch);
      } else if (key === 'boughtBill') {
        return direction === 'asc'
          ? String(a.boughtBillNumber).localeCompare(String(b.boughtBillNumber))
          : String(b.boughtBillNumber).localeCompare(String(a.boughtBillNumber));
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
  };

  const handleExpireBeforeChange = (e) => {
    setExpireBefore(e.target.value);
  };

  // Filter items based on search criteria
  const filteredItems = useMemo(() => {
    const sorted = sortItems(storeItems);

    return sorted.filter(item => {
      const matchesName = !searchQuery ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBarcode = !barcodeSearch ||
        item.barcode?.toLowerCase().includes(barcodeSearch.toLowerCase());

      const matchesBill = !billSearch ||
        String(item.boughtBillNumber).toLowerCase().includes(billSearch.toLowerCase());

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

      return matchesName && matchesBarcode && matchesBill && matchesDateRange && matchesExpireBefore;
    });
  }, [storeItems, searchQuery, barcodeSearch, billSearch, fromDate, toDate, expireBefore, sortItems]);

  // Calculate totals
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

  // Export to Excel
  const exportToExcel = () => {
    try {
      const exportData = filteredItems.map(item => {
        const expiryStyle = getExpiryStyle(item.expireDate);
        return {
          'Item Name': item.name,
          'Barcode': item.barcode,
          'Branch': item.branch,
          'Bought Bill #': item.boughtBillNumber,
          'Added Date': formatDateTime(item.createdAt),
          'Currency': item.priceType,
          'Base Price (USD)': item.basePriceUSD ? formatUSD(item.basePriceUSD) : '-',
          'Net Price (USD)': item.netPriceUSD ? formatUSD(item.netPriceUSD) : '-',
          'Out Price (USD)': item.outPriceUSD ? formatUSD(item.outPriceUSD) : '-',
          'Base Price (IQD)': item.basePriceIQD ? formatIQD(item.basePriceIQD) : '-',
          'Net Price (IQD)': item.netPriceIQD ? formatIQD(item.netPriceIQD) : '-',
          'Out Price (IQD)': item.outPriceIQD ? formatIQD(item.outPriceIQD) : '-',
          'Total Quantity': item.totalQuantity,
          'Total Base Value (USD)': item.basePriceUSD ? formatUSD(item.basePriceUSD * item.totalQuantity) : '-',
          'Total Net Value (USD)': item.netPriceUSD ? formatUSD(item.netPriceUSD * item.totalQuantity) : '-',
          'Total Base Value (IQD)': item.basePriceIQD ? formatIQD(item.basePriceIQD * item.totalQuantity) : '-',
          'Total Net Value (IQD)': item.netPriceIQD ? formatIQD(item.netPriceIQD * item.totalQuantity) : '-',
          'Expiry Date': item.expireDate ? formatDate(item.expireDate) : 'N/A',
          'Expiry Status': item.expireDate ? expiryStyle.status : 'N/A'
        };
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
      <div style={{ width: '100%', minHeight: '100vh', padding: '2rem', ...nrtFontStyle }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '256px' }}>
          <div style={{
            animation: 'spin 1s linear infinite',
            borderRadius: '9999px',
            height: '40px',
            width: '40px',
            borderTop: '2px solid #3b82f6',
            borderBottom: '2px solid #3b82f6'
          }}></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '1rem', backgroundColor: '#f3f4f6', ...nrtFontStyle }}>
      <div style={{ maxWidth: '100%', overflow: 'hidden', backgroundColor: 'white', borderRadius: '8px', padding: '1.5rem' }}>
        {/* Header and controls */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', ...nrtFontBoldStyle }}>Store Inventory</h2>
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

          {/* Branch filter for superAdmin */}
          {user?.role === "superAdmin" && (
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

          {/* Search Section */}
          <div style={{
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', ...nrtFontStyle }}>Item Name</label>
                <input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', ...nrtFontStyle }}>Barcode</label>
                <input
                  placeholder="Search by barcode..."
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontFamily: 'monospace', ...nrtFontStyle }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', ...nrtFontStyle }}>Bill Number</label>
                <input
                  placeholder="Search by bill #..."
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', ...nrtFontStyle }}>From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', ...nrtFontStyle }}>To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', ...nrtFontStyle }}>Expires Before</label>
                <input
                  type="date"
                  value={expireBefore}
                  onChange={handleExpireBeforeChange}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
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
              {user.role === "superAdmin" && branchFilter !== "All Stores" && ` in ${branchFilter}`}
              {user.role === "superAdmin" && branchFilter === "All Stores" && ` across all branches`}
              {user.role !== "superAdmin" && ` in ${user.branch}`}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', display: 'flex', gap: '1rem', ...nrtFontBoldStyle }}>
              <div>Total USD Value: Net: {formatUSD(totalNetValueUSD)}</div>
              <div>Total IQD Value: Net: {formatIQD(totalNetValueIQD)}</div>
            </div>
          </div>
        </div>

        {/* Table */}
        // Table rendering
{filteredItems.length === 0 ? (
  <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'white', borderRadius: '8px', ...nrtFontStyle }}>
    <div style={{ margin: '0 auto 16px', height: '48px', width: '48px', borderRadius: '9999px', backgroundColor: '#f3f4f6' }}>
      <svg style={{ height: '24px', width: '24px', color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    </div>
    <h3 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600', ...nrtFontBoldStyle }}>
      {searchQuery || barcodeSearch || billSearch || fromDate || toDate || expireBefore ? "No items found" : "No items in inventory"}
    </h3>
    <p style={{ color: '#6b7280', ...nrtFontStyle }}>
      {searchQuery || barcodeSearch || billSearch || fromDate || toDate || expireBefore
        ? "Try adjusting your search filters"
        : "Items will appear here once added to the store"}
    </p>
  </div>
) : (
  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1600px' }}>
      <thead>
        <tr style={{ backgroundColor: '#f9fafb' }}>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('barcode')}>
            Barcode {getSortIcon('barcode')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', minWidth: '250px', ...nrtFontBoldStyle }} onClick={() => handleSort('name')}>
            Item Name {getSortIcon('name')}
          </th>
          {user?.role === "superAdmin" && (
            <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('branch')}>
              Branch {getSortIcon('branch')}
            </th>
          )}
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('boughtBill')}>
            Bought Bill # {getSortIcon('boughtBill')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('createdAt')}>
            Added Date {getSortIcon('createdAt')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', ...nrtFontBoldStyle }}>Currency</th>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('basePriceUSD')}>
            Base Price (USD) {getSortIcon('basePriceUSD')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('netPriceUSD')}>
            Net Price (USD) {getSortIcon('netPriceUSD')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('outPriceUSD')}>
            Out Price (USD) {getSortIcon('outPriceUSD')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('basePriceIQD')}>
            Base Price (IQD) {getSortIcon('basePriceIQD')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('netPriceIQD')}>
            Net Price (IQD) {getSortIcon('netPriceIQD')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('outPriceIQD')}>
            Out Price (IQD) {getSortIcon('outPriceIQD')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('quantity')}>
            Quantity {getSortIcon('quantity')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', cursor: 'pointer', ...nrtFontBoldStyle }} onClick={() => handleSort('expireDate')}>
            Expiry Date {getSortIcon('expireDate')}
          </th>
          <th style={{ padding: '12px', textAlign: 'left', ...nrtFontBoldStyle }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {filteredItems.map((item, index) => {
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
              <td style={{ padding: '12px', fontFamily: 'monospace', ...nrtFontStyle }}>{item.barcode}</td>
              <td style={{ padding: '12px', fontWeight: '500', ...nrtFontStyle }}>{item.name}</td>
              {user?.role === "superAdmin" && (
                <td style={{ padding: '12px' }}>
                  <span style={getBranchStyle(item.branch)}>{item.branch}</span>
                </td>
              )}
              <td style={{ padding: '12px' }}>
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
              <td style={{ padding: '12px', ...nrtFontStyle }}>{formatDateTime(item.createdAt)}</td>
              <td style={{ padding: '12px' }}>
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
              {/* USD Columns */}
              <td style={{ 
                padding: '12px', 
                backgroundColor: isUSD ? '#f0fdf4' : '#f9fafb',
                color: isUSD ? '#065f46' : '#9ca3af',
                ...nrtFontStyle
              }}>
                {isUSD ? formatUSD(item.basePriceUSD) : '-'}
              </td>
              <td style={{ 
                padding: '12px', 
                backgroundColor: isUSD ? '#f0fdf4' : '#f9fafb',
                color: isUSD ? '#065f46' : '#9ca3af',
                ...nrtFontStyle
              }}>
                {isUSD ? formatUSD(item.netPriceUSD) : '-'}
              </td>
              <td style={{ 
                padding: '12px', 
                backgroundColor: isUSD ? '#f0fdf4' : '#f9fafb',
                color: isUSD ? '#065f46' : '#9ca3af',
                ...nrtFontStyle
              }}>
                {isUSD ? formatUSD(item.outPriceUSD) : '-'}
              </td>
              {/* IQD Columns */}
              <td style={{ 
                padding: '12px', 
                backgroundColor: !isUSD ? '#fef3c7' : '#f9fafb',
                color: !isUSD ? '#92400e' : '#9ca3af',
                ...nrtFontStyle
              }}>
                {!isUSD ? formatIQD(item.basePriceIQD) : '-'}
              </td>
              <td style={{ 
                padding: '12px', 
                backgroundColor: !isUSD ? '#fef3c7' : '#f9fafb',
                color: !isUSD ? '#92400e' : '#9ca3af',
                ...nrtFontStyle
              }}>
                {!isUSD ? formatIQD(item.netPriceIQD) : '-'}
              </td>
              <td style={{ 
                padding: '12px', 
                backgroundColor: !isUSD ? '#fef3c7' : '#f9fafb',
                color: !isUSD ? '#92400e' : '#9ca3af',
                ...nrtFontStyle
              }}>
                {!isUSD ? formatIQD(item.outPriceIQD) : '-'}
              </td>
              <td style={{ padding: '12px' }}>
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
              <td style={{ padding: '12px' }}>
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
              <td style={{ padding: '12px' }}>
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
        })}
      </tbody>
      <tfoot>
        <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
          <td colSpan={user.role === "superAdmin" ? 6 : 5} style={{ padding: '12px', textAlign: 'right', fontWeight: '600', ...nrtFontBoldStyle }}>
            Totals:
          </td>
          <td style={{ padding: '12px', fontWeight: '600', color: '#1f2937', ...nrtFontBoldStyle }}>
            {totalQuantity}
          </td>
          <td colSpan="2" style={{ padding: '12px', fontWeight: '600', color: '#065f46', ...nrtFontBoldStyle }}>
            USD Base: {formatUSD(totalBaseValueUSD)}<br/>
            USD Net: {formatUSD(totalNetValueUSD)}
          </td>
          <td colSpan="2" style={{ padding: '12px', fontWeight: '600', color: '#92400e', ...nrtFontBoldStyle }}>
            IQD Base: {formatIQD(totalBaseValueIQD)}<br/>
            IQD Net: {formatIQD(totalNetValueIQD)}
          </td>
          <td style={{ padding: '12px' }}></td>
          <td style={{ padding: '12px' }}></td>
        </tr>
      </tfoot>
    </table>
  </div>
)}
      </div>

      {/* Edit Modal */}
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
                  priceType: editForm.priceType
                };

                if (editForm.priceType === 'USD') {
                  const basePriceUSD = parseFloat(editForm.basePriceUSD);
                  const netPriceUSD = parseFloat(editForm.netPriceUSD);
                  const outPriceUSD = parseFloat(editForm.outPriceUSD);

                  if (isNaN(basePriceUSD) || basePriceUSD < 0 || 
                      isNaN(netPriceUSD) || netPriceUSD < 0 || 
                      isNaN(outPriceUSD) || outPriceUSD < 0) {
                    setError("Please enter valid USD prices");
                    return;
                  }

                  if (netPriceUSD < basePriceUSD) {
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
                  updateData.basePriceIQD = null;
                  updateData.netPriceIQD = null;
                  updateData.outPriceIQD = null;
                } else {
                  const basePriceIQD = parseFloat(editForm.basePriceIQD);
                  const netPriceIQD = parseFloat(editForm.netPriceIQD);
                  const outPriceIQD = parseFloat(editForm.outPriceIQD);

                  if (isNaN(basePriceIQD) || basePriceIQD < 0 || 
                      isNaN(netPriceIQD) || netPriceIQD < 0 || 
                      isNaN(outPriceIQD) || outPriceIQD < 0) {
                    setError("Please enter valid IQD prices");
                    return;
                  }

                  if (netPriceIQD < basePriceIQD) {
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
                  updateData.basePriceUSD = null;
                  updateData.netPriceUSD = null;
                  updateData.outPriceUSD = null;
                }

                await updateStoreItem(editingItem.id, updateData);

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
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                  required
                  min="0"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Currency</label>
                <select
                  value={editForm.priceType}
                  onChange={(e) => setEditForm({...editForm, priceType: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="IQD">IQD (د.ع)</option>
                </select>
              </div>

              {editForm.priceType === 'USD' ? (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Base Price (USD) - Purchase Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.basePriceUSD}
                      onChange={(e) => setEditForm({...editForm, basePriceUSD: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                      required
                      min="0"
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Net Price (USD) - Including Expenses</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.netPriceUSD}
                      onChange={(e) => setEditForm({...editForm, netPriceUSD: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                      required
                      min="0"
                    />
                    <small style={{ color: '#6b7280', ...nrtFontStyle }}>Must be greater than or equal to base price</small>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Out Price (USD) - Selling Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.outPriceUSD}
                      onChange={(e) => setEditForm({...editForm, outPriceUSD: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                      required
                      min="0"
                    />
                    <small style={{ color: '#6b7280', ...nrtFontStyle }}>Must be greater than or equal to net price</small>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Base Price (IQD) - Purchase Price</label>
                    <input
                      type="number"
                      value={editForm.basePriceIQD}
                      onChange={(e) => setEditForm({...editForm, basePriceIQD: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                      required
                      min="0"
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Net Price (IQD) - Including Expenses</label>
                    <input
                      type="number"
                      value={editForm.netPriceIQD}
                      onChange={(e) => setEditForm({...editForm, netPriceIQD: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
                      required
                      min="0"
                    />
                    <small style={{ color: '#6b7280', ...nrtFontStyle }}>Must be greater than or equal to base price</small>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', ...nrtFontStyle }}>Out Price (IQD) - Selling Price</label>
                    <input
                      type="number"
                      value={editForm.outPriceIQD}
                      onChange={(e) => setEditForm({...editForm, outPriceIQD: e.target.value})}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', ...nrtFontStyle }}
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