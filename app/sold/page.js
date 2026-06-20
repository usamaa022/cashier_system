"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { searchSoldBills, getPharmacies, getBase64BillAttachment, getBillAttachmentUrlEnhanced } from "@/lib/data";
import React from "react";
import Select from "react-select";
import * as XLSX from 'xlsx';

export default function SoldPage() {
  // State for data and UI
  const [bills, setBills] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userRole, setUserRole] = useState('user');
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    paymentStatus: "all",
    pharmacyId: "",
    startDate: "",
    endDate: "",
    hasAttachment: "all",
    consignmentStatus: "all",
    quantityMin: "",
    quantityMax: "",
    priceMin: "",
    priceMax: "",
    totalPriceMin: "",
    totalPriceMax: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemFilters, setItemFilters] = useState([]);
  const [attachmentModal, setAttachmentModal] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Fetch user role on component mount
  useEffect(() => {
    const role = localStorage.getItem('userRole') || 'user';
    setUserRole(role);
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [billsData, pharmaciesData] = await Promise.all([
          searchSoldBills(""),
          getPharmacies()
        ]);
        
        // Fetch attachments for each bill
        const billsWithAttachments = await Promise.all(
          billsData.map(async (bill) => {
            try {
              let url = await getBase64BillAttachment(bill.billNumber);
              if (!url) {
                url = await getBillAttachmentUrlEnhanced(bill.billNumber);
              }
              return { ...bill, attachment: url || null, hasAttachment: !!url };
            } catch (error) {
              console.error(`Error fetching attachment for bill ${bill.billNumber}:`, error);
              return { ...bill, attachment: null, hasAttachment: false };
            }
          })
        );
        
        billsWithAttachments.sort((a, b) => new Date(b.date) - new Date(a.date));
        setBills(billsWithAttachments);
        setPharmacies(pharmaciesData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Process all items with proper currency separation
  const allItems = useMemo(() =>
    bills.flatMap(bill =>
      bill.items?.map(item => {
        // Determine which currency this item uses
        const isIQD = item.originalCurrency === 'IQD';
        const isUSD = item.originalCurrency === 'USD';

        // Only one currency should have values
        const priceIQD = isIQD ? (item.outPriceIQD || item.price || 0) : 0;
        const priceUSD = isUSD ? (item.outPriceUSD || item.price || 0) : 0;
        const totalPriceIQD = isIQD ? (priceIQD * (item.quantity || 0)) : 0;
        const totalPriceUSD = isUSD ? (priceUSD * (item.quantity || 0)) : 0;

        return {
          ...item,
          billNumber: bill.billNumber,
          billDate: bill.date,
          saleDate: bill.date,
          saleTime: bill.date?.toDate ? bill.date.toDate() : new Date(bill.date),
          pharmacyId: bill.pharmacyId,
          pharmacyName: pharmacies.find(p => p.id === bill.pharmacyId)?.name || 'Unknown',
          paymentStatus: bill.paymentStatus,
          isConsignment: bill.isConsignment,
          // IMPORTANT: Pass attachment from bill to item
          attachment: bill.attachment || item.attachment || null,
          hasAttachment: bill.hasAttachment || false,
          attachmentDate: bill.attachmentDate || item.attachmentDate || null,
          // Currency fields - only one should have values
          priceIQD,
          priceUSD,
          totalPriceIQD,
          totalPriceUSD,
          originalCurrency: item.originalCurrency || (isIQD ? 'IQD' : 'USD'),
          // Admin-only fields
          netPrice: item.netPrice || 0,
          basePrice: item.basePrice || 0,
          netPriceUSD: isUSD ? (item.netPriceUSD || 0) : 0,
          netPriceIQD: isIQD ? (item.netPriceIQD || 0) : 0,
          basePriceUSD: isUSD ? (item.basePriceUSD || 0) : 0,
          basePriceIQD: isIQD ? (item.basePriceIQD || 0) : 0,
          // Pass expireDate from item
          expireDate: item.expireDate || null,
        };
      }) || []
    ), [bills, pharmacies]
  );

  // Extract unique item names for filters
  useEffect(() => {
    const items = new Set();
    allItems.forEach(item => {
      if (item.name) items.add(item.name);
    });
    setAvailableItems(Array.from(items));
  }, [allItems]);

  // Filter and sort functions
  const handleFilterChange = (field, value) => {
    setFilters({...filters, [field]: value});
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  // Filter items based on all criteria
  const filteredItems = allItems.filter(item => {
    try {
      const matchesBillNumber = !filters.billNumber || item.billNumber.toString().includes(filters.billNumber);
      const matchesItemName = !filters.itemName || item.name.toLowerCase().includes(filters.itemName.toLowerCase());

      let matchesSearch = true;
      if (searchQuery) {
        const searchTerms = searchQuery.toLowerCase().split(" ");
        matchesSearch = searchTerms.some(term =>
          item.name.toLowerCase().includes(term) ||
          item.barcode.includes(term) ||
          item.billNumber.toString().includes(term) ||
          item.pharmacyName.toLowerCase().includes(term)
        );
      }

      let matchesPaymentStatus = true;
      if (filters.paymentStatus !== "all") {
        matchesPaymentStatus = item.paymentStatus?.toLowerCase() === filters.paymentStatus.toLowerCase();
      }

      let matchesPharmacy = true;
      if (filters.pharmacyId) {
        matchesPharmacy = item.pharmacyId === filters.pharmacyId;
      }

      let matchesDateRange = true;
      if (filters.startDate || filters.endDate) {
        const saleDate = item.saleDate?.toDate ? item.saleDate.toDate() : new Date(item.saleDate);
        if (filters.startDate) {
          const startDate = new Date(filters.startDate.split('/').reverse().join('-'));
          matchesDateRange = matchesDateRange && saleDate >= startDate;
        }
        if (filters.endDate) {
          const endDate = new Date(filters.endDate.split('/').reverse().join('-'));
          endDate.setHours(23, 59, 59, 999);
          matchesDateRange = matchesDateRange && saleDate <= endDate;
        }
      }

      let matchesAttachment = true;
      if (filters.hasAttachment !== "all") {
        matchesAttachment = filters.hasAttachment === "yes" ? !!item.hasAttachment : !item.hasAttachment;
      }

      const matchesConsignmentStatus = filters.consignmentStatus === "all" ||
        (filters.consignmentStatus === "consignment" && item.isConsignment) ||
        (filters.consignmentStatus === "owned" && !item.isConsignment);

      const matchesItemFilters = itemFilters.length === 0 || itemFilters.includes(item.name);

      // Filter by price based on the item's currency
      let matchesPrice = true;
      if (filters.priceMin) {
        const price = item.originalCurrency === 'IQD' ? item.priceIQD : item.priceUSD;
        matchesPrice = price >= parseFloat(filters.priceMin);
      }
      if (filters.priceMax) {
        const price = item.originalCurrency === 'IQD' ? item.priceIQD : item.priceUSD;
        matchesPrice = matchesPrice && price <= parseFloat(filters.priceMax);
      }

      // Filter by total price based on the item's currency
      let matchesTotalPrice = true;
      if (filters.totalPriceMin) {
        const totalPrice = item.originalCurrency === 'IQD' ? item.totalPriceIQD : item.totalPriceUSD;
        matchesTotalPrice = totalPrice >= parseFloat(filters.totalPriceMin);
      }
      if (filters.totalPriceMax) {
        const totalPrice = item.originalCurrency === 'IQD' ? item.totalPriceIQD : item.totalPriceUSD;
        matchesTotalPrice = matchesTotalPrice && totalPrice <= parseFloat(filters.totalPriceMax);
      }

      let matchesQuantity = true;
      if (filters.quantityMin) {
        matchesQuantity = item.quantity >= parseFloat(filters.quantityMin);
      }
      if (filters.quantityMax) {
        matchesQuantity = matchesQuantity && item.quantity <= parseFloat(filters.quantityMax);
      }

      return matchesBillNumber && matchesItemName && matchesSearch && matchesPaymentStatus &&
        matchesPharmacy && matchesDateRange && matchesAttachment && matchesItemFilters &&
        matchesConsignmentStatus && matchesQuantity && matchesPrice && matchesTotalPrice;
    } catch (error) {
      console.error("Error filtering item:", error, item);
      return false;
    }
  });

  // Apply sorting to filtered items
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    if (sortConfig.key === "saleDate" || sortConfig.key === "expireDate") {
      aValue = aValue?.toDate ? aValue.toDate() : new Date(aValue);
      bValue = bValue?.toDate ? bValue.toDate() : new Date(bValue);
    }

    if (sortConfig.key === "pharmacyName") {
      aValue = a.pharmacyName;
      bValue = b.pharmacyName;
    }

    if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Generate unique IDs and calculate totals
  const itemsWithUniqueId = sortedItems.map((item, index) => ({
    ...item,
    uniqueId: `${item.billNumber}-${item.barcode}-${index}`,
  }));

  const totalQuantity = itemsWithUniqueId.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalSumIQD = itemsWithUniqueId.reduce((sum, item) => sum + (item.totalPriceIQD || 0), 0);
  const totalSumUSD = itemsWithUniqueId.reduce((sum, item) => sum + (item.totalPriceUSD || 0), 0);

  // Format functions - IQD without decimals, USD with decimals
  const formatNumberIQD = (num) => {
    if (num === null || num === undefined || num === 0) return "0";
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatNumberUSD = (num) => {
    if (num === null || num === undefined || num === 0) return "0";
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const formatExpireDate = (date) => {
    if (!date) return 'N/A';
    try {
      let dateObj;
      
      // Handle Firestore Timestamp
      if (date && typeof date === 'object') {
        if ('toDate' in date && typeof date.toDate === 'function') {
          dateObj = date.toDate();
        } else if (date.seconds !== undefined) {
          dateObj = new Date(date.seconds * 1000);
        } else if (date._seconds !== undefined) {
          dateObj = new Date(date._seconds * 1000);
        } else if (date instanceof Date) {
          dateObj = date;
        }
      }
      
      // If still not a valid date, try string parsing
      if (!dateObj || isNaN(dateObj.getTime())) {
        if (typeof date === 'string') {
          // Try different formats
          const formats = [
            // DD/MM/YYYY
            (d) => {
              const parts = d.split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parseInt(parts[2]);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                  return new Date(year, month, day);
                }
              }
              return null;
            },
            // YYYY-MM-DD
            (d) => {
              const parts = d.split('-');
              if (parts.length === 3) {
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const day = parseInt(parts[2]);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                  return new Date(year, month, day);
                }
              }
              return null;
            },
            // MM/DD/YYYY
            (d) => {
              const parts = d.split('/');
              if (parts.length === 3) {
                const month = parseInt(parts[0]) - 1;
                const day = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                  return new Date(year, month, day);
                }
              }
              return null;
            }
          ];
          
          for (const parser of formats) {
            const result = parser(date);
            if (result && !isNaN(result.getTime())) {
              dateObj = result;
              break;
            }
          }
        }
      }

      if (!dateObj || isNaN(dateObj.getTime())) return 'N/A';

      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting expire date:', error, date);
      return 'N/A';
    }
  };

  // Attachment modal functions
  const openAttachmentModal = async (item) => {
    setAttachmentModal(item);
    
    // Check if item has attachment already
    if (item.attachment) {
      setImagePreview(item.attachment);
      return;
    }
    
    // Try to fetch attachment from Firebase
    try {
      let url = await getBase64BillAttachment(item.billNumber);
      if (!url) {
        url = await getBillAttachmentUrlEnhanced(item.billNumber);
      }
      
      if (url) {
        setImagePreview(url);
        // Update the item with the attachment
        setBills(prevBills => 
          prevBills.map(bill => 
            bill.billNumber === item.billNumber 
              ? { ...bill, attachment: url, hasAttachment: true } 
              : bill
          )
        );
      } else {
        setImagePreview(null);
      }
    } catch (error) {
      console.error('Error loading attachment:', error);
      setImagePreview(null);
    }
  };

  const closeAttachmentModal = () => {
    setAttachmentModal(null);
    setImagePreview(null);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      alert('Please select an image file.');
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  // Export to Excel with dual currency
  const exportToExcel = () => {
    if (itemsWithUniqueId.length === 0) {
      alert("No data to export.");
      return;
    }

    const exportData = itemsWithUniqueId.map((item, index) => ({
      '#': index + 1,
      'ناوی کاڵا': item.name,
      'بارکۆد': item.barcode,
      'عدد': item.quantity,
      'نرخ (دینار)': item.originalCurrency === 'IQD' ? formatNumberIQD(item.priceIQD || 0) : "0",
      'کۆی گشتی (دینار)': item.originalCurrency === 'IQD' ? formatNumberIQD(item.totalPriceIQD) : "0",
      'نرخ ($)': item.originalCurrency === 'USD' ? formatNumberUSD(item.priceUSD || 0) : "0",
      'کۆی گشتی ($)': item.originalCurrency === 'USD' ? formatNumberUSD(item.totalPriceUSD) : "0",
      'ژمارەی پسوڵە': item.billNumber,
      'دەرمانخانە': item.pharmacyName,
      'بەرواری فرۆشتن': formatDate(item.saleDate),
      'جۆری پارەدان': item.paymentStatus === 'Cash' ? 'Cash' : item.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
      'دۆخی تحت صرف': item.isConsignment ? 'تحت صرف' : 'خاوەنیاری',
      'بەرواری بەسەرچوون': formatExpireDate(item.expireDate),
      'هاوپێچ': item.hasAttachment ? 'هەیە' : 'نیە'
    }));

    // Add summary rows
    exportData.push({});
    exportData.push({
      '#': 'کۆی گشتی',
      'ناوی کاڵا': '',
      'بارکۆد': '',
      'عدد': totalQuantity,
      'نرخ (دینار)': '',
      'کۆی گشتی (دینار)': formatNumberIQD(totalSumIQD),
      'نرخ ($)': '',
      'کۆی گشتی ($)': formatNumberUSD(totalSumUSD),
      'ژمارەی پسوڵە': '',
      'دەرمانخانە': '',
      'بەرواری فرۆشتن': '',
      'جۆری پارەدان': '',
      'دۆخی تحت صرف': '',
      'بەرواری بەسەرچوون': '',
      'هاوپێچ': ''
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wscols = [
      { wch: 5 },   // #
      { wch: 30 },  // ناوی کاڵا
      { wch: 15 },  // بارکۆد
      { wch: 10 },  // عدد
      { wch: 15 },  // نرخ (دینار)
      { wch: 15 },  // کۆی گشتی (دینار)
      { wch: 15 },  // نرخ ($)
      { wch: 15 },  // کۆی گشتی ($)
      { wch: 15 },  // ژمارەی پسوڵە
      { wch: 20 },  // دەرمانخانە
      { wch: 20 },  // بەرواری فرۆشتن
      { wch: 12 },  // جۆری پارەدان
      { wch: 12 },  // دۆخی تحت صرف
      { wch: 15 },  // بەرواری بەسەرچوون
      { wch: 10 }   // هاوپێچ
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sold Items");
    const fileName = `sold_items_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    alert(`Exported ${itemsWithUniqueId.length} items to Excel successfully!`);
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      billNumber: "",
      itemName: "",
      paymentStatus: "all",
      pharmacyId: "",
      startDate: "",
      endDate: "",
      hasAttachment: "all",
      consignmentStatus: "all",
      quantityMin: "",
      quantityMax: "",
      priceMin: "",
      priceMax: "",
      totalPriceMin: "",
      totalPriceMax: ""
    });
    setSearchQuery("");
    setItemFilters([]);
    setSortConfig({ key: null, direction: "asc" });
  };

  // Select options
  const itemOptions = availableItems.map(item => ({ value: item, label: item }));
  const pharmacyOptions = pharmacies.map(pharmacy => ({
    value: pharmacy.id,
    label: `${pharmacy.name} (${pharmacy.code || 'No Code'})`
  }));

  // Consignment badge component
  const ConsignmentBadge = ({ isConsignment }) => (
    <span style={{
      padding: "0.25rem 0.75rem",
      borderRadius: "9999px",
      fontSize: "0.75rem",
      fontWeight: "500",
      backgroundColor: isConsignment ? "#fef3c7" : "#d1fae5",
      color: isConsignment ? "#92400e" : "#065f46"
    }}>
      {isConsignment ? "تحت صرف" : "Owned"}
    </span>
  );

  // Payment status badge
  const PaymentStatusBadge = ({ status }) => (
    <span style={{
      padding: "0.25rem 0.75rem",
      borderRadius: "9999px",
      fontSize: "0.75rem",
      fontWeight: "500",
      backgroundColor:
        status === 'Cash' ? "#d1fae5" :
        status === 'Paid' ? "#dbeafe" : "#fee2e2",
      color:
        status === 'Cash' ? "#065f46" :
        status === 'Paid' ? "#1e40af" : "#991b1b"
    }}>
      {status === 'Cash' ? 'Cash' : status === 'Paid' ? 'Paid' : 'Unpaid'}
    </span>
  );

  // Loading and error states
  if (isLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", fontFamily: "var(--font-nrt-reg)" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", marginBottom: "1.5rem", color: "#1e293b", fontFamily: "var(--font-nrt-bd)" }}>
          مێژووی فرۆشتنەکان
        </h1>
        <div style={{ color: "#64748b" }}>پیشاندانی سەرجەم فرۆشراوەکان..</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", fontFamily: "var(--font-nrt-reg)" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", marginBottom: "1.5rem", color: "#1e293b", fontFamily: "var(--font-nrt-bd)" }}>
          مێژووی فرۆشتنەکان
        </h1>
        <div style={{ padding: "1rem", backgroundColor: "#fca5a5", color: "#991b1b", borderRadius: "0.375rem", fontFamily: "var(--font-nrt-reg)" }}>
          {error}
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div style={{ fontFamily: "var(--font-nrt-reg)", maxWidth: "95%", margin: "0 auto", padding: "1.5rem" }}>
      {/* Header */}
      <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", marginBottom: "1.5rem", color: "#1e293b", textAlign: "center", fontFamily: "var(--font-nrt-bd)" }}>
        مێژووی فرۆشتنەکان
      </h1>

      {/* Export Button */}
      <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={exportToExcel}
          disabled={itemsWithUniqueId.length === 0}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: itemsWithUniqueId.length === 0 ? "#9ca3af" : "#10b981",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: itemsWithUniqueId.length === 0 ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            fontFamily: "var(--font-nrt-bd)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          Export to Excel 📊
        </button>
      </div>

      {/* Filters Section */}
      <div style={{ backgroundColor: "#fff", borderRadius: "0.5rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: "bold", marginBottom: "1rem", color: "#1e293b", fontFamily: "var(--font-nrt-bd)", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.75rem" }}>
          فلتەرەکانی گەڕان
        </h3>

        {/* First Row of Filters */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>ژمارەی پسوڵە</label>
            <input
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", outline: "none" }}
              placeholder="ژمارەی پسوڵە"
              value={filters.billNumber}
              onChange={(e) => handleFilterChange('billNumber', e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>ناوی کاڵا</label>
            <input
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", outline: "none" }}
              placeholder="ناوی کاڵا"
              value={filters.itemName}
              onChange={(e) => handleFilterChange('itemName', e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>جۆری پارەدان</label>
            <select
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", backgroundColor: "white", outline: "none" }}
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
            >
              <option value="all">هەموو</option>
              <option value="Cash">Cash</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>دەرمانخانە</label>
            <Select
              options={pharmacyOptions}
              value={pharmacyOptions.find(opt => opt.value === filters.pharmacyId)}
              onChange={(selected) => handleFilterChange('pharmacyId', selected?.value || "")}
              placeholder="هەڵبژاردنی دەرمانخانە"
              styles={{
                control: (base) => ({ ...base, minHeight: "38px", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", borderColor: "#e2e8f0" }),
                menu: (base) => ({ ...base, fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)" })
              }}
              isClearable
            />
          </div>
        </div>

        {/* Second Row of Filters */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>لە بەرواری فرۆشتن</label>
            <input
              type="text"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", outline: "none" }}
              placeholder="dd/mm/yyyy"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>بۆ بەرواری فرۆشتن</label>
            <input
              type="text"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", outline: "none" }}
              placeholder="dd/mm/yyyy"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>دۆخی تحت صرف</label>
            <select
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", backgroundColor: "white", outline: "none" }}
              value={filters.consignmentStatus}
              onChange={(e) => handleFilterChange('consignmentStatus', e.target.value)}
            >
              <option value="all">هەموو</option>
              <option value="consignment">تحت صرف</option>
              <option value="owned">Owned</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>هاوپێچ</label>
            <select
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", backgroundColor: "white", outline: "none" }}
              value={filters.hasAttachment}
              onChange={(e) => handleFilterChange('hasAttachment', e.target.value)}
            >
              <option value="all">هەموو</option>
              <option value="yes">هەیە</option>
              <option value="no">نیە</option>
            </select>
          </div>
        </div>

        {/* Third Row - Quantity and Price Ranges */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>کەمترین عدد</label>
            <input
              type="number"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", outline: "none" }}
              placeholder="کەمترین"
              value={filters.quantityMin}
              onChange={(e) => handleFilterChange('quantityMin', e.target.value)}
              min="0"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>زۆرترین عدد</label>
            <input
              type="number"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", outline: "none" }}
              placeholder="زۆرترین"
              value={filters.quantityMax}
              onChange={(e) => handleFilterChange('quantityMax', e.target.value)}
              min="0"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>کەمترین نرخ</label>
            <input
              type="number"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", outline: "none" }}
              placeholder="نرخ"
              value={filters.priceMin}
              onChange={(e) => handleFilterChange('priceMin', e.target.value)}
              min="0"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>زۆرترین نرخ</label>
            <input
              type="number"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", outline: "none" }}
              placeholder="نرخ"
              value={filters.priceMax}
              onChange={(e) => handleFilterChange('priceMax', e.target.value)}
              min="0"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>کەمترین کۆی گشتی</label>
            <input
              type="number"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", outline: "none" }}
              placeholder="کۆی گشتی"
              value={filters.totalPriceMin}
              onChange={(e) => handleFilterChange('totalPriceMin', e.target.value)}
              min="0"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>زۆرترین کۆی گشتی</label>
            <input
              type="number"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", outline: "none" }}
              placeholder="کۆی گشتی"
              value={filters.totalPriceMax}
              onChange={(e) => handleFilterChange('totalPriceMax', e.target.value)}
              min="0"
            />
          </div>
        </div>

        {/* Item Filter and Reset Button */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.375rem", fontSize: "0.875rem", fontWeight: "500", color: "#4b5563", fontFamily: "var(--font-nrt-bd)" }}>هەڵبژاردنی کاڵای تایبەت</label>
            <Select
              isMulti
              options={itemOptions}
              onChange={(selected) => setItemFilters(selected.map(option => option.value))}
              placeholder="هەڵبژاردنی کاڵای تایبەت..."
              styles={{
                control: (base) => ({ ...base, minHeight: "38px", fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)", borderColor: "#e2e8f0" }),
                menu: (base) => ({ ...base, fontSize: "0.875rem", fontFamily: "var(--font-nrt-reg)" })
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={resetFilters}
              style={{
                padding: "0.375rem 0.75rem",
                backgroundColor: "#9ca3af",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontFamily: "var(--font-nrt-bd)",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem"
              }}
            >
              ♻️ پاککردنەوەی فلتەرەکان
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#f0f9ff", borderRadius: "0.375rem", border: "1px solid #bae6fd", fontFamily: "var(--font-nrt-reg)", fontSize: "0.875rem" }}>
        <strong>ئەنجامەکان: {itemsWithUniqueId.length}</strong> |
        <span style={{ marginLeft: "0.75rem", color: "#475569" }}>
          پێڕستکردن: {sortConfig.key ?
            `${sortConfig.key === "name" ? "ناوی کاڵا" :
              sortConfig.key === "barcode" ? "بارکۆد" :
              sortConfig.key === "quantity" ? "عدد" :
              sortConfig.key === "priceIQD" ? "نرخ (دینار)" :
              sortConfig.key === "priceUSD" ? "نرخ ($)" :
              sortConfig.key === "totalPriceIQD" ? "کۆی گشتی (دینار)" :
              sortConfig.key === "totalPriceUSD" ? "کۆی گشتی ($)" :
              sortConfig.key === "billNumber" ? "ژمارەی پسوڵە" :
              sortConfig.key === "pharmacyName" ? "دەرمانخانە" :
              sortConfig.key === "saleDate" ? "بەرواری فرۆشتن" :
              sortConfig.key === "paymentStatus" ? "جۆری پارەدان" :
              sortConfig.key === "isConsignment" ? "دۆخی تحت صرف" :
              sortConfig.key === "expireDate" ? "بەرواری بەسەرچوون" : sortConfig.key}
            ${sortConfig.direction === "asc" ? "(بەرەوچوون)" : "(بەرەوژێر)"}` :
            "پێڕست نه‌کراوە"}
        </span>
      </div>

      {/* Main Table */}
      <div style={{ backgroundColor: "#fff", borderRadius: "0.5rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1800px", fontFamily: "var(--font-nrt-reg)" }}>
            <thead style={{ backgroundColor: "#f1f5f9", position: "sticky", top: 0 }}>
              <tr>
                <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#334155", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("name")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    ناوی کاڵا <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{getSortIndicator("name")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#334155", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("barcode")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    بارکۆد <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{getSortIndicator("barcode")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: "bold", color: "#334155", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("quantity")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    عدد <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{getSortIndicator("quantity")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#059669", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("priceIQD")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                    نرخ (دینار) <span style={{ fontSize: "0.75rem", color: "#059669" }}>{getSortIndicator("priceIQD")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#059669", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("totalPriceIQD")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                    کۆی گشتی (دینار) <span style={{ fontSize: "0.75rem", color: "#059669" }}>{getSortIndicator("totalPriceIQD")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#1e40af", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("priceUSD")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                    نرخ ($) <span style={{ fontSize: "0.75rem", color: "#1e40af" }}>{getSortIndicator("priceUSD")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#1e40af", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("totalPriceUSD")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                    کۆی گشتی ($) <span style={{ fontSize: "0.75rem", color: "#1e40af" }}>{getSortIndicator("totalPriceUSD")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: "bold", color: "#334155", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("billNumber")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    ژمارەی پسوڵە <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{getSortIndicator("billNumber")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#334155", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("pharmacyName")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    دەرمانخانە <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{getSortIndicator("pharmacyName")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: "bold", color: "#334155", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("saleDate")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    بەرواری فرۆشتن <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{getSortIndicator("saleDate")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: "bold", color: "#334155", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("paymentStatus")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    جۆری پارەدان <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{getSortIndicator("paymentStatus")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: "bold", color: "#334155", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("isConsignment")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    دۆخی تحت صرف <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{getSortIndicator("isConsignment")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: "bold", color: "#334155", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("expireDate")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    بەرواری بەسەرچوون <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{getSortIndicator("expireDate")}</span>
                  </div>
                </th>

                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: "bold", color: "#334155", fontFamily: "var(--font-nrt-bd)", borderBottom: "2px solid #e5e7eb" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    هاوپێچ
                  </div>
                </th>

                {['admin', 'superAdmin'].includes(userRole) && (
                  <>
                    <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#ea580c", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("netPriceIQD")}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                        نەت پرایس (دینار) <span style={{ fontSize: "0.75rem", color: "#ea580c" }}>{getSortIndicator("netPriceIQD")}</span>
                      </div>
                    </th>
                    <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#ea580c", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("netPriceUSD")}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                        نەت پرایس ($) <span style={{ fontSize: "0.75rem", color: "#ea580c" }}>{getSortIndicator("netPriceUSD")}</span>
                      </div>
                    </th>
                    <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#ea580c", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("basePriceIQD")}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                        بەیس پرایس (دینار) <span style={{ fontSize: "0.75rem", color: "#ea580c" }}>{getSortIndicator("basePriceIQD")}</span>
                      </div>
                    </th>
                    <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "bold", color: "#ea580c", fontFamily: "var(--font-nrt-bd)", cursor: "pointer", borderBottom: "2px solid #e5e7eb" }} onClick={() => handleSort("basePriceUSD")}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
                        بەیس پرایس ($) <span style={{ fontSize: "0.75rem", color: "#ea580c" }}>{getSortIndicator("basePriceUSD")}</span>
                      </div>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {itemsWithUniqueId.length === 0 ? (
                <tr>
                  <td colSpan={['admin', 'superAdmin'].includes(userRole) ? "20" : "16"} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontFamily: "var(--font-nrt-reg)" }}>
                    هیچ کاڵایەکی فرۆشراو نەدۆزرایەوە بەپێی فلتەرەکان.
                  </td>
                </tr>
              ) : (
                itemsWithUniqueId.map((item, index) => (
                  <tr
                    key={item.uniqueId}
                    style={{
                      backgroundColor: index % 2 === 0 ? "white" : "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", fontWeight: "500", borderBottom: "1px solid #e2e8f0" }}>
                      {item.name}
                    </td>

                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", fontSize: "0.875rem", color: "#4b5563", borderBottom: "1px solid #e2e8f0" }}>
                      {item.barcode}
                    </td>

                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
                      {item.quantity}
                    </td>

                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "right", borderBottom: "1px solid #e2e8f0", color: "#059669", fontWeight: item.originalCurrency === 'IQD' ? "600" : "normal" }}>
                      {item.originalCurrency === 'IQD' ? `${formatNumberIQD(item.priceIQD)} IQD` : ""}
                    </td>

                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "right", borderBottom: "1px solid #e2e8f0", color: "#059669", fontWeight: item.originalCurrency === 'IQD' ? "600" : "normal" }}>
                      {item.originalCurrency === 'IQD' ? `${formatNumberIQD(item.totalPriceIQD)} IQD` : ""}
                    </td>

                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "right", borderBottom: "1px solid #e2e8f0", color: "#1e40af", fontWeight: item.originalCurrency === 'USD' ? "600" : "normal" }}>
                      {item.originalCurrency === 'USD' ? `${formatNumberUSD(item.priceUSD)} $` : ""}
                    </td>

                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "right", borderBottom: "1px solid #e2e8f0", color: "#1e40af", fontWeight: item.originalCurrency === 'USD' ? "600" : "normal" }}>
                      {item.originalCurrency === 'USD' ? `${formatNumberUSD(item.totalPriceUSD)} $` : ""}
                    </td>

                    <td style={{ padding: "0.75rem", fontFamily: "monospace", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
                      {item.billNumber}
                    </td>

                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", borderBottom: "1px solid #e2e8f0" }}>
                      {item.pharmacyName}
                    </td>

                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "center", fontSize: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>
                      {formatDate(item.saleDate)}
                    </td>

                    <td style={{ padding: "0.75rem", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
                      <PaymentStatusBadge status={item.paymentStatus} />
                    </td>

                    <td style={{ padding: "0.75rem", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
                      <ConsignmentBadge isConsignment={item.isConsignment} />
                    </td>

                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "center", fontSize: "0.75rem", color: item.expireDate && item.expireDate !== 'N/A' && new Date(item.expireDate) < new Date() ? "#dc2626" : "#4b5563", borderBottom: "1px solid #e2e8f0" }}>
                      {formatExpireDate(item.expireDate)}
                    </td>

                    <td style={{ padding: "0.75rem", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
                      {item.hasAttachment || item.attachment ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAttachmentModal(item);
                          }}
                          style={{
                            padding: "0.25rem 0.5rem",
                            backgroundColor: "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "0.25rem",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontFamily: "var(--font-nrt-bd)"
                          }}
                        >
                          📎 بینین
                        </button>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>نیە</span>
                      )}
                    </td>

                    {['admin', 'superAdmin'].includes(userRole) && (
                      <>
                        <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "right", borderBottom: "1px solid #e2e8f0", color: "#ea580c" }}>
                          {item.originalCurrency === 'IQD' && item.netPriceIQD ? formatNumberIQD(item.netPriceIQD) + " IQD" : ""}
                        </td>
                        <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "right", borderBottom: "1px solid #e2e8f0", color: "#ea580c" }}>
                          {item.originalCurrency === 'USD' && item.netPriceUSD ? formatNumberUSD(item.netPriceUSD) + " $" : ""}
                        </td>
                        <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "right", borderBottom: "1px solid #e2e8f0", color: "#ea580c" }}>
                          {item.originalCurrency === 'IQD' && item.basePriceIQD ? formatNumberIQD(item.basePriceIQD) + " IQD" : ""}
                        </td>
                        <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)", textAlign: "right", borderBottom: "1px solid #e2e8f0", color: "#ea580c" }}>
                          {item.originalCurrency === 'USD' && item.basePriceUSD ? formatNumberUSD(item.basePriceUSD) + " $" : ""}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot style={{ backgroundColor: "#f1f5f9", borderTop: "2px solid #e5e7eb" }}>
              <tr>
                <td colSpan="2" style={{ padding: "0.75rem", textAlign: "right", fontFamily: "var(--font-nrt-bd)", fontWeight: "bold" }}>
                  کۆی گشتی {itemsWithUniqueId.length} کاڵا
                </td>
                <td style={{ padding: "0.75rem", textAlign: "center", fontFamily: "var(--font-nrt-bd)", fontWeight: "bold" }}>
                  {totalQuantity}
                </td>
                <td colSpan="2" style={{ padding: "0.75rem", textAlign: "right", fontFamily: "var(--font-nrt-bd)", fontWeight: "bold", color: "#059669" }}>
                  {formatNumberIQD(totalSumIQD)} IQD
                </td>
                <td colSpan="2" style={{ padding: "0.75rem", textAlign: "right", fontFamily: "var(--font-nrt-bd)", fontWeight: "bold", color: "#1e40af" }}>
                  {formatNumberUSD(totalSumUSD)} $
                </td>
                <td colSpan={['admin', 'superAdmin'].includes(userRole) ? "12" : "8"} style={{ padding: "0.75rem", textAlign: "right", fontFamily: "var(--font-nrt-reg)" }}>
                  :کۆی گشتی
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Attachment Modal */}
      {attachmentModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
          padding: "1rem"
        }}>
          <div style={{ backgroundColor: "white", borderRadius: "0.5rem", maxWidth: "28rem", width: "100%" }}>
            <div style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1f2937", fontFamily: "var(--font-nrt-bd)" }}>
                  پسوڵەی #{attachmentModal.billNumber} - 
                </h3>
                <button
                  onClick={closeAttachmentModal}
                  style={{ backgroundColor: "transparent", border: "none", fontSize: "1.25rem", color: "#6b7280", cursor: "pointer", padding: "0.25rem" }}
                >
                  ✕
                </button>
              </div>

              {imagePreview ? (
                <div style={{ marginBottom: "1rem" }}>
                  <img
                    src={imagePreview}
                    alt="هاوبەشی پسوڵە"
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      margin: "0 auto",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.375rem",
                      maxHeight: "16rem",
                      display: "block"
                    }}
                  />
              
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af", fontSize: "0.875rem" }}>
                  هیچ هاوبەشێک نیە
                </div>
              )}

              <div style={{ marginBottom: "1rem" }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  style={{ display: "none" }}
                />
                {/* <button
                  onClick={triggerFileInput}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    marginBottom: "0.5rem",
                    backgroundColor: "transparent",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-nrt-reg)",
                    color: "#374151",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem"
                  }}
                >
                  📁 هەڵبژاردنی فایل
                </button> */}
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={closeAttachmentModal}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    backgroundColor: "#9ca3af",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-nrt-bd)"
                  }}
                >
                  داخستن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}