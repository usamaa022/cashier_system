"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { getStoreItems, updateStoreItem, checkDocumentExists, getItemAttachments } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import * as XLSX from 'xlsx';

// Helper function to format date
const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    let dateObj = null;
    if (date && typeof date === 'object') {
      if ('toDate' in date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date.seconds !== undefined) {
        dateObj = new Date(date.seconds * 1000);
      } else if (date._seconds !== undefined) {
        dateObj = new Date(date._seconds * 1000);
      }
    }
    if (!dateObj && date instanceof Date) {
      dateObj = date;
    }
    if (!dateObj && typeof date === 'string') {
      if (date.includes('/')) {
        const [day, month, year] = date.split('/');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      } else if (date.includes('-')) {
        const [year, month, day] = date.split('-');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      } else {
        dateObj = new Date(date);
      }
    }
    if (!dateObj || isNaN(dateObj.getTime())) return "N/A";
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return "N/A";
  }
};

// Helper function to format date and time
const formatDateTime = (date) => {
  if (!date) return "N/A";
  try {
    let dateObj = null;
    if (date && typeof date === 'object') {
      if ('toDate' in date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date.seconds !== undefined) {
        dateObj = new Date(date.seconds * 1000);
      } else if (date._seconds !== undefined) {
        dateObj = new Date(date._seconds * 1000);
      }
    }
    if (!dateObj && date instanceof Date) {
      dateObj = date;
    }
    if (!dateObj && typeof date === 'string') {
      dateObj = new Date(date);
    }
    if (!dateObj || isNaN(dateObj.getTime())) return "N/A";
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    return "N/A";
  }
};

// Helper function to format currency in USD
const formatUSD = (amount) => {
  if (amount === undefined || amount === null) return "$0.00";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Helper function to format currency in IQD
const formatIQD = (amount) => {
  if (amount === undefined || amount === null) return "0 IQD";
  return new Intl.NumberFormat('ar-IQ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount) + " IQD";
};

// Helper function to get branch style
const getBranchStyle = (branch) => {
  if (branch === "Slemany") {
    return {
      backgroundColor: '#dcfce7',
      color: '#166534',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500'
    };
  } else if (branch === "Erbil") {
    return {
      backgroundColor: '#dbeafe',
      color: '#1e40af',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500'
    };
  } else {
    return {
      backgroundColor: '#f3f4f6',
      color: '#4b5563',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500'
    };
  }
};

export default function StorePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [storeItems, setStoreItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [billSearch, setBillSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [groupedItems, setGroupedItems] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [branchFilter, setBranchFilter] = useState("Slemany");
  const [currencyDisplay, setCurrencyDisplay] = useState("USD");
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    quantity: '',
    netPriceUSD: '',
    outPriceUSD: '',
    exchangeRate: '1500'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState({});
  const [selectedBatchForAttachments, setSelectedBatchForAttachments] = useState(null);

  // Memoized fetch function to prevent unnecessary re-renders
  const fetchStoreItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const items = await getStoreItems();

      if (!items || items.length === 0) {
        setStoreItems([]);
        setGroupedItems({});
        setIsLoading(false);
        return;
      }

      let filteredItems;

      if (user?.role === "superAdmin") {
        if (branchFilter === "All Stores") {
          filteredItems = items.filter(item => item.quantity > 0);
        } else {
          filteredItems = items.filter(item =>
            item.branch === branchFilter && item.quantity > 0
          );
        }
      } else {
        const userBranch = user?.branch || "Slemany";
        filteredItems = items.filter(item =>
          item.branch === userBranch && item.quantity > 0
        );
      }

      // Group items by unique combination
      const grouped = {};
      filteredItems.forEach(item => {
        const key = `${item.barcode}-${item.netPriceUSD || 0}-${item.outPriceUSD || 0}-${item.branch}`;

        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            barcode: item.barcode,
            name: item.name,
            netPriceUSD: item.netPriceUSD || 0,
            outPriceUSD: item.outPriceUSD || 0,
            netPriceIQD: item.netPrice || 0,
            outPriceIQD: item.outPrice || 0,
            exchangeRate: item.exchangeRate || 1500,
            branch: item.branch,
            totalQuantity: 0,
            batches: [],
            branches: new Set(),
            boughtBillNumbers: new Set(),
            createdDates: []
          };
        }

        // Extract bill number from various possible fields
        let billNumber = 'N/A';
        if (item.boughtBillNumber && item.boughtBillNumber !== 'N/A') {
          billNumber = item.boughtBillNumber;
        } else if (item.billNumber && item.billNumber !== 'N/A') {
          billNumber = item.billNumber;
        } else if (item.bill_number && item.bill_number !== 'N/A') {
          billNumber = item.bill_number;
        } else if (item.billNo && item.billNo !== 'N/A') {
          billNumber = item.billNo;
        } else if (item.billNum && item.billNum !== 'N/A') {
          billNumber = item.billNum;
        } else {
          // Try to find any field that contains 'bill'
          for (const key in item) {
            if (key.toLowerCase().includes('bill') && item[key] && item[key] !== 'N/A') {
              billNumber = item[key];
              break;
            }
          }
        }

        grouped[key].totalQuantity += item.quantity;
        grouped[key].batches.push({
          id: item.id,
          quantity: item.quantity,
          expireDate: item.expireDate,
          boughtBillNumber: billNumber,
          createdAt: item.createdAt,
          hasAttachments: false
        });
        grouped[key].branches.add(item.branch);
        grouped[key].boughtBillNumbers.add(billNumber);
        if (item.createdAt) {
          grouped[key].createdDates.push(item.createdAt);
        }
      });

      // Process grouped items
      Object.keys(grouped).forEach(key => {
        grouped[key].branches = Array.from(grouped[key].branches);
        grouped[key].boughtBillNumbers = Array.from(grouped[key].boughtBillNumbers);

        // Find earliest creation date
        if (grouped[key].createdDates.length > 0) {
          const validDates = grouped[key].createdDates.filter(d => d && d.getTime);
          if (validDates.length > 0) {
            grouped[key].earliestCreatedAt = new Date(
              Math.min(...validDates.map(d => d.getTime()))
            );
          } else {
            grouped[key].earliestCreatedAt = null;
          }
        } else {
          grouped[key].earliestCreatedAt = null;
        }
      });

      setGroupedItems(grouped);

      // Sort items after grouping
      const sorted = sortItems(Object.values(grouped), sortConfig.key, sortConfig.direction, currencyDisplay);
      setStoreItems(sorted);

      // Fetch attachments
      fetchAllAttachments(Object.values(grouped));

    } catch (err) {
      console.error("Error in fetchStoreItems:", err);
      setError("Failed to load store items. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user, branchFilter, currencyDisplay, sortConfig]);

  const fetchAllAttachments = async (items) => {
    try {
      const attachmentsMap = {};
      const updatedGroupedItems = { ...groupedItems };

      for (const item of items) {
        for (const batch of item.batches) {
          const billNumber = batch.boughtBillNumber;

          if (billNumber && billNumber !== 'N/A') {
            const batchAttachments = await getItemAttachments(billNumber);

            if (batchAttachments && batchAttachments.length > 0) {
              attachmentsMap[batch.id] = batchAttachments;

              // Update the batch to indicate it has attachments
              if (updatedGroupedItems[item.id]) {
                const batchIndex = updatedGroupedItems[item.id].batches.findIndex(b => b.id === batch.id);
                if (batchIndex !== -1) {
                  updatedGroupedItems[item.id].batches[batchIndex].hasAttachments = true;
                }
              }
            }
          }
        }
      }

      setAttachments(attachmentsMap);
      setGroupedItems(updatedGroupedItems);

    } catch (error) {
      console.error("Error in fetchAllAttachments:", error);
    }
  };

  const sortItems = useCallback((items, key, direction, currency) => {
    return [...items].sort((a, b) => {
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
      } else if (key === 'netPrice') {
        const priceA = currency === 'USD' ? a.netPriceUSD : a.netPriceIQD;
        const priceB = currency === 'USD' ? b.netPriceUSD : b.netPriceIQD;
        return direction === 'asc'
          ? priceA - priceB
          : priceB - priceA;
      } else if (key === 'outPrice') {
        const priceA = currency === 'USD' ? a.outPriceUSD : a.outPriceIQD;
        const priceB = currency === 'USD' ? b.outPriceUSD : b.outPriceIQD;
        return direction === 'asc'
          ? priceA - priceB
          : priceB - priceA;
      } else if (key === 'branch') {
        const branchA = a.branches.length > 1 ? 'Multiple' : a.branches[0];
        const branchB = b.branches.length > 1 ? 'Multiple' : b.branches[0];
        return direction === 'asc'
          ? branchA.localeCompare(branchB)
          : branchB.localeCompare(branchA);
      } else if (key === 'boughtBill') {
        const billA = a.boughtBillNumbers.length > 1 ? 'Multiple' : a.boughtBillNumbers[0] || 'N/A';
        const billB = b.boughtBillNumbers.length > 1 ? 'Multiple' : b.boughtBillNumbers[0] || 'N/A';
        return direction === 'asc'
          ? String(billA).localeCompare(String(billB))
          : String(billB).localeCompare(String(billA));
      } else if (key === 'createdAt') {
        const dateA = a.earliestCreatedAt ? new Date(a.earliestCreatedAt) : new Date(0);
        const dateB = b.earliestCreatedAt ? new Date(b.earliestCreatedAt) : new Date(0);
        return direction === 'asc'
          ? dateA - dateB
          : dateB - dateA;
      }
      return 0;
    });
  }, []);

  const handleSort = useCallback((key) => {
    const newDirection = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction: newDirection });

    const sorted = sortItems(
      Object.values(groupedItems),
      key,
      newDirection,
      currencyDisplay
    );
    setStoreItems(sorted);
  }, [groupedItems, currencyDisplay, sortConfig]);

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchStoreItems();
  }, [user, router, branchFilter, fetchStoreItems]);

  // Filter items based on search criteria
  const filteredItems = useMemo(() => {
    return storeItems.filter(item => {
      const matchesName = !searchQuery ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBarcode = !barcodeSearch ||
        item.barcode?.toLowerCase().includes(barcodeSearch.toLowerCase());

      const matchesBill = !billSearch ||
        item.boughtBillNumbers.some(bill =>
          String(bill).toLowerCase().includes(billSearch.toLowerCase())
        );

      let matchesDateRange = true;
      if (fromDate || toDate) {
        const itemDate = item.earliestCreatedAt ? new Date(item.earliestCreatedAt) : null;

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

      return matchesName && matchesBarcode && matchesBill && matchesDateRange;
    });
  }, [storeItems, searchQuery, barcodeSearch, billSearch, fromDate, toDate]);

  // Calculate total quantity and value
  const totalQuantity = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.totalQuantity, 0);
  }, [filteredItems]);

  const totalValueUSD = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.netPriceUSD * item.totalQuantity), 0);
  }, [filteredItems]);

  const totalValueIQD = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.netPriceIQD * item.totalQuantity), 0);
  }, [filteredItems]);

  // Handle currency change
  const handleCurrencyChange = useCallback((e) => {
    setCurrencyDisplay(e.target.value);
    const sorted = sortItems(
      Object.values(groupedItems),
      sortConfig.key,
      sortConfig.direction,
      e.target.value
    );
    setStoreItems(sorted);
  }, [groupedItems, sortConfig]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchStoreItems();
  }, [fetchStoreItems]);

  // Handle branch change
  const handleBranchChange = useCallback((e) => {
    setBranchFilter(e.target.value);
  }, []);

  // Handle clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setBarcodeSearch("");
    setBillSearch("");
    setFromDate("");
    setToDate("");
  }, []);

  // Export to Excel function
  const exportToExcel = () => {
    try {
      const exportData = filteredItems.map(item => {
        const batchDetails = item.batches.map(batch =>
          `${batch.quantity} (${formatDate(batch.expireDate)}) [Bill: ${batch.boughtBillNumber}]`
        ).join('; ');

        return {
          'Item Name': item.name,
          'Barcode': item.barcode,
          'Branch': item.branches.length > 1 ? 'Multiple' : item.branches[0],
          'Bought Bill #': item.boughtBillNumbers.length > 1 ? 'Multiple' : item.boughtBillNumbers[0],
          'Added Date': formatDateTime(item.earliestCreatedAt),
          'Net Price (USD)': formatUSD(item.netPriceUSD),
          'Net Price (IQD)': formatIQD(item.netPriceIQD),
          'Out Price (USD)': formatUSD(item.outPriceUSD),
          'Out Price (IQD)': formatIQD(item.outPriceIQD),
          'Exchange Rate': item.exchangeRate || 1500,
          'Total Quantity': item.totalQuantity,
          'Total Value (USD)': formatUSD(item.netPriceUSD * item.totalQuantity),
          'Total Value (IQD)': formatIQD(item.netPriceIQD * item.totalQuantity),
          'Batches': batchDetails,
          'Earliest Expiry': item.batches.length > 0
            ? formatDate(item.batches.sort((a, b) =>
                new Date(a.expireDate) - new Date(b.expireDate)
              )[0].expireDate)
            : 'N/A'
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);

      const colWidths = [
        { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
        { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
        { wch: 18 }, { wch: 40 }, { wch: 15 }
      ];
      ws['!cols'] = colWidths;

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

  // Render UI
  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '256px' }}>
          <div style={{
            animation: 'spin 1s linear infinite',
            borderRadius: '9999px',
            height: '40px',
            width: '40px',
            borderTop: '2px solid var(--primary)',
            borderBottom: '2px solid var(--primary)'
          }}></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '1rem', backgroundColor: '#f3f4f6' }}>
      <div className="card" style={{ maxWidth: '100%', overflow: 'hidden' }}>
        {/* Header and controls */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>Store Inventory</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                value={currencyDisplay}
                onChange={handleCurrencyChange}
                className="input"
                style={{
                  width: '120px',
                  padding: '8px',
                  fontSize: '14px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  fontWeight: '500',
                  borderRadius: '6px'
                }}
              >
                <option value="USD" style={{ backgroundColor: 'white', color: 'black' }}>$ USD</option>
                <option value="IQD" style={{ backgroundColor: 'white', color: 'black' }}>IQD</option>
              </select>
              <button
                onClick={exportToExcel}
                className="btn btn-success"
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export
              </button>
              <button
                onClick={handleRefresh}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '14px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#dc2626',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{error}</span>
              <button
                onClick={handleRefresh}
                style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Refresh Now
              </button>
            </div>
          )}

          {user?.role === "superAdmin" && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>Branch:</label>
              <select
                value={branchFilter}
                onChange={handleBranchChange}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  maxWidth: '200px',
                  backgroundColor: 'white'
                }}
              >
                <option value="Slemany">Slemany</option>
                <option value="Erbil">Erbil</option>
                <option value="All Stores">All Stores</option>
              </select>
              <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                (Auto-updates)
              </span>
            </div>
          )}

          {/* Enhanced Search Section */}
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '0.5rem'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#4b5563', marginBottom: '4px' }}>
                  Item Name
                </label>
                <input
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    width: '100%'
                  }}
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#4b5563', marginBottom: '4px' }}>
                  Barcode
                </label>
                <input
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    width: '100%'
                  }}
                  placeholder="Search by barcode..."
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#4b5563', marginBottom: '4px' }}>
                  Bill Number
                </label>
                <input
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    width: '100%'
                  }}
                  placeholder="Search by bill #..."
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#4b5563', marginBottom: '4px' }}>
                  From Date
                </label>
                <input
                  type="date"
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    width: '100%'
                  }}
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#4b5563', marginBottom: '4px' }}>
                  To Date
                </label>
                <input
                  type="date"
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    width: '100%'
                  }}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={clearFilters}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              Showing {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
              {user.role !== "superAdmin" && ` in ${user.branch} branch`}
              {user.role === "superAdmin" && branchFilter !== "All Stores" && ` in ${branchFilter} branch`}
              {user.role === "superAdmin" && branchFilter === "All Stores" && ` across all branches`}
            </div>
            <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>
              Total Value: {currencyDisplay === 'USD' ? formatUSD(totalValueUSD) : formatIQD(totalValueIQD)}
            </div>
          </div>
        </div>

        {/* Render table only if filteredItems is not empty */}
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{
              margin: '0 auto 16px',
              height: '48px',
              width: '48px',
              borderRadius: '9999px',
              backgroundColor: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg style={{ height: '24px', width: '24px', color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
              {searchQuery || barcodeSearch || billSearch || fromDate || toDate ? "No items found" : "No items in inventory"}
            </h3>
            <p style={{ color: '#6b7280' }}>
              {searchQuery || barcodeSearch || billSearch || fromDate || toDate ? "Try adjusting your search filters" : "Items will appear here once added to the store"}
            </p>
          </div>
        ) : (
          <div style={{
            overflowX: 'auto',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            maxWidth: '100%',
            WebkitOverflowScrolling: 'touch'
          }}>
            <div style={{ minWidth: '1500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#4b5563', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => handleSort('barcode')}>
                      Barcode {getSortIcon('barcode')}
                    </th>
                    <th style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#4b5563', textAlign: 'left', cursor: 'pointer', minWidth: '300px' }}
                      onClick={() => handleSort('name')}>
                      Item Name {getSortIcon('name')}
                    </th>
                    {user?.role === "superAdmin" && (
                      <th style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#4b5563', textAlign: 'left', cursor: 'pointer' }}
                        onClick={() => handleSort('branch')}>
                        Branch {getSortIcon('branch')}
                      </th>
                    )}
                    <th style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#4b5563', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => handleSort('boughtBill')}>
                      Bought Bill # {getSortIcon('boughtBill')}
                    </th>
                    <th style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#4b5563', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => handleSort('createdAt')}>
                      Added Date {getSortIcon('createdAt')}
                    </th>
                    <th style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#4b5563', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => handleSort('netPrice')}>
                      Net Price {currencyDisplay === 'USD' ? '(USD)' : '(IQD)'} {getSortIcon('netPrice')}
                    </th>
                    <th style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#4b5563', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => handleSort('outPrice')}>
                      Out Price {currencyDisplay === 'USD' ? '(USD)' : '(IQD)'} {getSortIcon('outPrice')}
                    </th>
                    <th style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#4b5563', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => handleSort('quantity')}>
                      Total Qty {getSortIcon('quantity')}
                    </th>
                    <th style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#4b5563', textAlign: 'left' }}>Batches</th>
                    <th style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#4b5563', textAlign: 'left' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background-color 0.2s' }}>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#4b5563', fontFamily: 'monospace' }}>{item.barcode}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#1f2937', fontWeight: '500', minWidth: '300px' }}>{item.name}</td>
                      {user?.role === "superAdmin" && (
                        <td style={{ padding: '12px', fontSize: '13px', color: '#4b5563' }}>
                          {item.branches.length > 1 ? (
                            <span style={getBranchStyle('Multiple')}>Multiple</span>
                          ) : (
                            <span style={getBranchStyle(item.branches[0])}>
                              {item.branches[0]}
                            </span>
                          )}
                        </td>
                      )}
                     
<td style={{ padding: '12px', fontSize: '13px', color: '#4b5563' }}>
  {item.boughtBillNumbers.length > 1 ? (
    <span style={{
      backgroundColor: '#f3f4f6',
      color: '#4b5563',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'monospace'
    }}>
      Multiple
    </span>
  ) : (
    <span style={{
      backgroundColor: item.boughtBillNumbers[0] === 'N/A' ? '#fee2e2' : '#dbeafe',
      color: item.boughtBillNumbers[0] === 'N/A' ? '#991b1b' : '#1e40af',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'monospace'
    }}>
      {item.boughtBillNumbers[0] || 'N/A'}
    </span>
  )}
</td>


                       <td style={{ padding: '12px', fontSize: '13px', color: '#4b5563' }}>
                        {formatDateTime(item.earliestCreatedAt)}
                       </td>
                       <td style={{ padding: '12px', fontSize: '13px', color: '#1f2937' }}>
                        {currencyDisplay === 'USD' ? formatUSD(item.netPriceUSD) : formatIQD(item.netPriceIQD)}
                       </td>
                       <td style={{ padding: '12px', fontSize: '13px', color: '#1f2937' }}>
                        {currencyDisplay === 'USD' ? formatUSD(item.outPriceUSD) : formatIQD(item.outPriceIQD)}
                       </td>
                       <td style={{ padding: '12px', fontSize: '13px', color: '#1f2937', fontWeight: '600' }}>
                        <span style={{
                          backgroundColor: item.totalQuantity > 10 ? '#d1fae5' : '#fee2e2',
                          color: item.totalQuantity > 10 ? '#065f46' : '#991b1b',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          {item.totalQuantity}
                        </span>
                       </td>
                       <td style={{ padding: '12px', fontSize: '13px' }}>
                        <details>
                          <summary style={{ cursor: 'pointer', color: '#3b82f6', fontSize: '12px', fontWeight: '500' }}>
                            {item.batches.length} batch{item.batches.length !== 1 ? 'es' : ''}
                          </summary>
                          <div style={{ marginTop: '8px', backgroundColor: '#f9fafb', borderRadius: '4px', padding: '8px' }}>
                            {item.batches.map((batch, i) => (
                              <div key={i} style={{
                                padding: '6px',
                                borderBottom: i < item.batches.length - 1 ? '1px solid #e5e7eb' : 'none',
                                fontSize: '12px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <span style={{ fontWeight: '500' }}>Qty: {batch.quantity}</span>
                                    <span style={{ color: '#6b7280', marginLeft: '8px' }}> Exp: {formatDate(batch.expireDate)}</span>
                                  </div>
                                  {attachments[batch.id] && attachments[batch.id].length > 0 && (
                                    <button
                                      onClick={() => setSelectedBatchForAttachments(batch)}
                                      style={{
                                        padding: '2px 6px',
                                        fontSize: '10px',
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      📎 {attachments[batch.id].length}
                                    </button>
                                  )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                  <span style={{
                                    backgroundColor: batch.boughtBillNumber === 'N/A' ? '#fee2e2' : '#dbeafe',
                                    color: batch.boughtBillNumber === 'N/A' ? '#991b1b' : '#1e40af',
                                    padding: '2px 4px',
                                    borderRadius: '4px'
                                  }}>
                                    Bill: {batch.boughtBillNumber || 'N/A'}
                                  </span>
                                  <span>Added: {formatDateTime(batch.createdAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                       </td>
                       <td style={{ padding: '12px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => setEditingItem(item)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                            disabled={isLoading}
                          >
                            ✏️ Edit
                          </button>
                        </div>
                       </td>
                      </tr>
                  ))}

                  {/* Total Row */}
                  <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                    <td colSpan={user.role === "superAdmin" ? 7 : 6} style={{ padding: '12px', fontSize: '13px', fontWeight: 'bold', color: '#1f2937', textAlign: 'right' }}>
                      Totals:
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: 'bold', color: '#3b82f6' }}>
                      {totalQuantity}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: 'bold', color: '#3b82f6' }} colSpan="2">
                      Value: {currencyDisplay === 'USD' ? formatUSD(totalValueUSD) : formatIQD(totalValueIQD)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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
            maxWidth: '600px'
          }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '18px', fontWeight: '600' }}>
              Edit {editingItem.name}
            </h3>

            {editingItem.batches.length > 1 && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                fontSize: '14px'
              }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '500', color: '#0369a1' }}>
                  Quantity Distribution
                </p>
                <div style={{ fontSize: '12px', color: '#0c4a6e' }}>
                  {editingItem.batches.map((batch, index) => {
                    const distributedQty = Math.floor(parseInt(editForm.quantity) / editingItem.batches.length);
                    return (
                      <div key={index}>
                        Batch {index + 1}: {distributedQty} units
                        {batch.expireDate && ` (expires: ${formatDate(batch.expireDate)})`}
                        {batch.boughtBillNumber !== 'N/A' && ` - Bill: ${batch.boughtBillNumber}`}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setIsSubmitting(true);
                setError(null);

                const newQuantity = parseInt(editForm.quantity);
                const newNetPriceUSD = parseFloat(editForm.netPriceUSD);
                const newOutPriceUSD = parseFloat(editForm.outPriceUSD);
                const exchangeRate = parseFloat(editForm.exchangeRate) || 1500;

                if (isNaN(newQuantity) || newQuantity < 0) {
                  setError("Please enter a valid quantity (0 or greater)");
                  return;
                }

                if (isNaN(newNetPriceUSD) || newNetPriceUSD < 0 || isNaN(newOutPriceUSD) || newOutPriceUSD < 0) {
                  setError("Please enter valid prices (0 or greater)");
                  return;
                }

                const newNetPriceIQD = Math.round(newNetPriceUSD * exchangeRate);
                const newOutPriceIQD = Math.round(newOutPriceUSD * exchangeRate);

                const distributedQuantities = distributeQuantityAcrossBatches(newQuantity, editingItem.batches);

                const updatePromises = editingItem.batches.map(async (batch, index) => {
                  try {
                    const updateData = {
                      netPriceUSD: newNetPriceUSD,
                      outPriceUSD: newOutPriceUSD,
                      netPrice: newNetPriceIQD,
                      outPrice: newOutPriceIQD,
                      exchangeRate: exchangeRate,
                      quantity: distributedQuantities[index]
                    };

                    await updateStoreItem(batch.id, updateData);
                    return { success: true, batchId: batch.id };
                  } catch (batchError) {
                    console.error(`Error updating batch ${batch.id}:`, batchError);
                    return { success: false, batchId: batch.id, error: batchError.message };
                  }
                });

                const results = await Promise.all(updatePromises);
                const failedUpdates = results.filter(result => !result.success);

                if (failedUpdates.length > 0) {
                  const errorMessage = `Failed to update ${failedUpdates.length} batch(es). Please try again.`;
                  setError(errorMessage);
                  return;
                }

                setEditingItem(null);
                setEditForm({ quantity: '', netPriceUSD: '', outPriceUSD: '', exchangeRate: '1500' });
                await fetchStoreItems();

              } catch (err) {
                console.error("Error updating item:", err);
                setError(err.message || "Failed to update item. Please try again.");
              } finally {
                setIsSubmitting(false);
              }
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Total Quantity:
                </label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({...editForm, quantity: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  required
                  min="0"
                  disabled={isSubmitting}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Exchange Rate (USD to IQD):
                </label>
                <input
                  type="number"
                  step="1"
                  value={editForm.exchangeRate}
                  onChange={(e) => setEditForm({...editForm, exchangeRate: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  required
                  min="1"
                  disabled={isSubmitting}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Net Price (USD):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.netPriceUSD}
                  onChange={(e) => setEditForm({...editForm, netPriceUSD: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  required
                  min="0"
                  disabled={isSubmitting}
                />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  IQD: {formatIQD(parseFloat(editForm.netPriceUSD || 0) * parseFloat(editForm.exchangeRate || 1500))}
                </span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Out Price (USD):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.outPriceUSD}
                  onChange={(e) => setEditForm({...editForm, outPriceUSD: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  required
                  min="0"
                  disabled={isSubmitting}
                />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  IQD: {formatIQD(parseFloat(editForm.outPriceUSD || 0) * parseFloat(editForm.exchangeRate || 1500))}
                </span>
              </div>

              {error && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  color: '#dc2626',
                  marginBottom: '1rem',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setEditForm({ quantity: '', netPriceUSD: '', outPriceUSD: '', exchangeRate: '1500' });
                    setError(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                  disabled={isSubmitting}
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
                    cursor: 'pointer'
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attachments Modal */}
      {selectedBatchForAttachments && (
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
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600' }}>
                Attachments for Bill #{selectedBatchForAttachments.boughtBillNumber}
              </h3>
              <button
                onClick={() => setSelectedBatchForAttachments(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Batch Details:</strong></p>
              <p style={{ fontSize: '12px', margin: '2px 0' }}>Quantity: {selectedBatchForAttachments.quantity}</p>
              <p style={{ fontSize: '12px', margin: '2px 0' }}>Expiry: {formatDate(selectedBatchForAttachments.expireDate)}</p>
              <p style={{ fontSize: '12px', margin: '2px 0' }}>Added: {formatDateTime(selectedBatchForAttachments.createdAt)}</p>
            </div>

            {attachments[selectedBatchForAttachments.id] && attachments[selectedBatchForAttachments.id].length > 0 ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {attachments[selectedBatchForAttachments.id].map((attachment, i) => (
                  <div key={i} style={{
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                        {attachment.fileName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                        Uploaded: {formatDateTime(attachment.uploadedAt)}
                      </div>
                    </div>
                    {attachment.base64Data ? (
                      <img
                        src={attachment.base64Data}
                        alt={attachment.fileName}
                        style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }}
                      />
                    ) : attachment.fileUrl ? (
                      <a
                        href={attachment.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          padding: '6px 12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      >
                        View File
                      </a>
                    ) : (
                      <p style={{ color: '#6b7280', fontSize: '12px' }}>No preview available</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                No attachments found for this bill
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                onClick={() => setSelectedBatchForAttachments(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Helper function to distribute quantity across batches
const distributeQuantityAcrossBatches = (totalQuantity, batches) => {
  const distributed = [];
  let remaining = totalQuantity;

  for (let i = 0; i < batches.length; i++) {
    if (i === batches.length - 1) {
      distributed.push(remaining);
    } else {
      const average = Math.floor(remaining / (batches.length - i));
      distributed.push(average);
      remaining -= average;
    }
  }

  return distributed;
};
