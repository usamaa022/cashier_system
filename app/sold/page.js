"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { searchSoldBills, getPharmacies } from "@/lib/data";
import React from "react";
import Select from "react-select";
import * as XLSX from 'xlsx';

export default function SoldPage() {
  const [bills, setBills] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
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
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc"
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [billsData, pharmaciesData] = await Promise.all([
          searchSoldBills(""),
          getPharmacies()
        ]);
        billsData.sort((a, b) => new Date(b.date) - new Date(a.date));
        setBills(billsData);
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

  // Use useMemo to prevent recalculating allItems on every render
  const allItems = useMemo(() => 
    bills.flatMap(bill => 
      bill.items?.map(item => ({
        ...item,
        billNumber: bill.billNumber,
        billDate: bill.date, // This is the sale date
        saleDate: bill.date, // Add sale date field
        pharmacyId: bill.pharmacyId,
        pharmacyName: pharmacies.find(p => p.id === bill.pharmacyId)?.name || 'Unknown',
        paymentStatus: bill.paymentStatus,
        isConsignment: bill.isConsignment,
        attachment: bill.attachment,
        attachmentDate: bill.attachmentDate,
        totalPrice: (item.price || 0) * (item.quantity || 0)
      })) || []
    ), [bills, pharmacies]
  );

  // Extract unique item names
  useEffect(() => {
    const items = new Set();
    allItems.forEach(item => {
      if (item.name) {
        items.add(item.name);
      }
    });
    setAvailableItems(Array.from(items));
  }, [allItems]);

  const handleFilterChange = (field, value) => {
    setFilters({...filters, [field]: value});
  };

  const itemOptions = availableItems.map(item => ({
    value: item,
    label: item
  }));

  const pharmacyOptions = pharmacies.map(pharmacy => ({
    value: pharmacy.id,
    label: `${pharmacy.name} (${pharmacy.code || 'No Code'})`
  }));

  // Format number with commas for IQD
  const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Filter items based on all criteria
  const filteredItems = allItems.filter(item => {
    try {
      // Text-based filters
      const matchesBillNumber = !filters.billNumber ||
                            item.billNumber.toString().includes(filters.billNumber);
      
      const matchesItemName = !filters.itemName ||
                            item.name.toLowerCase().includes(filters.itemName.toLowerCase());
      
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
      
      // Dropdown filters
      let matchesPaymentStatus = true;
      if (filters.paymentStatus !== "all") {
        matchesPaymentStatus = item.paymentStatus?.toLowerCase() === filters.paymentStatus.toLowerCase();
      }
      
      let matchesPharmacy = true;
      if (filters.pharmacyId) {
        matchesPharmacy = item.pharmacyId === filters.pharmacyId;
      }
      
      // Date range filter
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
      
      // Attachment filter
      let matchesAttachment = true;
      if (filters.hasAttachment !== "all") {
        if (filters.hasAttachment === "yes") {
          matchesAttachment = !!item.attachment;
        } else {
          matchesAttachment = !item.attachment;
        }
      }
      
      // Consignment status filter
      const matchesConsignmentStatus = filters.consignmentStatus === "all" ||
                            (filters.consignmentStatus === "consignment" && item.isConsignment) ||
                            (filters.consignmentStatus === "owned" && !item.isConsignment);
      
      // Item name filter (multiple selection)
      const matchesItemFilters = itemFilters.length === 0 ||
                              itemFilters.includes(item.name);
      
      // Quantity range filter
      let matchesQuantity = true;
      if (filters.quantityMin) {
        matchesQuantity = matchesQuantity && (item.quantity >= parseFloat(filters.quantityMin));
      }
      if (filters.quantityMax) {
        matchesQuantity = matchesQuantity && (item.quantity <= parseFloat(filters.quantityMax));
      }
      
      // Price range filter
      let matchesPrice = true;
      if (filters.priceMin) {
        matchesPrice = matchesPrice && (item.price >= parseFloat(filters.priceMin));
      }
      if (filters.priceMax) {
        matchesPrice = matchesPrice && (item.price <= parseFloat(filters.priceMax));
      }
      
      // Total price range filter
      let matchesTotalPrice = true;
      const totalPrice = (item.price || 0) * (item.quantity || 0);
      if (filters.totalPriceMin) {
        matchesTotalPrice = matchesTotalPrice && (totalPrice >= parseFloat(filters.totalPriceMin));
      }
      if (filters.totalPriceMax) {
        matchesTotalPrice = matchesTotalPrice && (totalPrice <= parseFloat(filters.totalPriceMax));
      }

      return matchesBillNumber && matchesItemName && matchesSearch && matchesPaymentStatus &&
             matchesPharmacy && matchesDateRange && matchesAttachment && matchesItemFilters &&
             matchesConsignmentStatus && matchesQuantity && matchesPrice && matchesTotalPrice;
    } catch (error) {
      console.error("Error filtering item:", error, item);
      return false;
    }
  });

  // Sorting function
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

  // Apply sorting to filtered items
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];
    
    // Special handling for date fields
    if (sortConfig.key === "saleDate" || sortConfig.key === "expireDate") {
      aValue = aValue?.toDate ? aValue.toDate() : new Date(aValue);
      bValue = bValue?.toDate ? bValue.toDate() : new Date(bValue);
    }
    
    // Special handling for pharmacy name (nested)
    if (sortConfig.key === "pharmacyName") {
      aValue = a.pharmacyName;
      bValue = b.pharmacyName;
    }
    
    // Special handling for total price (calculated)
    if (sortConfig.key === "totalPrice") {
      aValue = (a.price || 0) * (a.quantity || 0);
      bValue = (b.price || 0) * (b.quantity || 0);
    }
    
    if (aValue < bValue) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  const toggleItemDetails = (item) => {
    setSelectedItem(selectedItem?.uniqueId === item.uniqueId ? null : item);
  };

  // Generate unique ID for each item
  const itemsWithUniqueId = sortedItems.map((item, index) => ({
    ...item,
    uniqueId: `${item.billNumber}-${item.barcode}-${index}`,
    totalPrice: (item.price || 0) * (item.quantity || 0)
  }));

  // Calculate totals
  const totalQuantity = itemsWithUniqueId.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalSum = itemsWithUniqueId.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatExpireDate = (date) => {
    if (!date) return 'N/A';
    try {
      let dateObj;
      if (date.toDate && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else {
        dateObj = new Date(date);
      }
      
      if (isNaN(dateObj.getTime())) {
        return 'N/A';
      }
      
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting expire date:', error, date);
      return 'N/A';
    }
  };

  const openAttachmentModal = (billData) => {
    setAttachmentModal(billData);
    setImagePreview(billData.attachment || null);
  };

  const closeAttachmentModal = () => {
    setAttachmentModal(null);
    setImagePreview(null);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please select an image file.');
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Export to Excel function
  const exportToExcel = () => {
    try {
      if (itemsWithUniqueId.length === 0) {
        alert("No data to export.");
        return;
      }

      // Prepare data for export
      const exportData = itemsWithUniqueId.map((item, index) => ({
        '#': index + 1,
        'ناوی کاڵا': item.name,
        'بارکۆد': item.barcode,
        'عدد': item.quantity,
        'نرخ (دینار)': formatNumber(item.price?.toFixed(2) || "0"),
        'کۆی گشتی (دینار)': formatNumber(item.totalPrice.toFixed(2)),
        'ژمارەی پسوڵە': item.billNumber,
        'دەرمانخانە': item.pharmacyName,
        'بەرواری فرۆشتن': formatDate(item.saleDate),
        'جۆری پارەدان': item.paymentStatus === 'Cash' ? 'Cash' : item.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
        'دۆخی تحت صرف': item.isConsignment ? 'تحت صرف' : 'خاوەنیاری',
        'بەرواری بەسەرچوون': formatExpireDate(item.expireDate),
        'هاوپێچ': item.attachment ? 'هەیە' : 'نیە'
      }));

      // Add summary row
      exportData.push({}); // Empty row
      exportData.push({
        '#': 'کۆی گشتی',
        'ناوی کاڵا': '',
        'بارکۆد': '',
        'عدد': totalQuantity,
        'نرخ (دینار)': '',
        'کۆی گشتی (دینار)': formatNumber(totalSum.toFixed(2)),
        'ژمارەی پسوڵە': '',
        'دەرمانخانە': '',
        'بەرواری فرۆشتن': '',
        'جۆری پارەدان': '',
        'دۆخی تحت صرف': '',
        'بەرواری بەسەرچوون': '',
        'هاوپێچ': ''
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      const wscols = [
        { wch: 5 },   // #
        { wch: 30 },  // ناوی کاڵا
        { wch: 15 },  // بارکۆد
        { wch: 10 },  // عدد
        { wch: 15 },  // نرخ (دینار)
        { wch: 15 },  // کۆی گشتی (دینار)
        { wch: 15 },  // ژمارەی پسوڵە
        { wch: 20 },  // دەرمانخانە
        { wch: 15 },  // بەرواری فرۆشتن
        { wch: 12 },  // جۆری پارەدان
        { wch: 12 },  // دۆخی تحت صرف
        { wch: 15 },  // بەرواری بەسەرچوون
        { wch: 10 }   // هاوپێچ
      ];
      ws['!cols'] = wscols;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sold Items");

      // Generate file name
      const fileName = `sold_items_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Save file
      XLSX.writeFile(wb, fileName);
      
      alert(`Exported ${itemsWithUniqueId.length} items to Excel successfully!`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Failed to export to Excel. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div style={{
        padding: "2rem",
        textAlign: "center",
        fontFamily: "var(--font-nrt-reg)"
      }}>
        <h1 style={{
          fontSize: "1.75rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
          color: "#1e293b",
          fontFamily: "var(--font-nrt-bd)"
        }}>
          مێژووی فرۆشتنەکان
        </h1>
        <div style={{ color: "#64748b" }}>بارکردنی مێژووی فرۆشتنەکان...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: "2rem",
        fontFamily: "var(--font-nrt-reg)"
      }}>
        <h1 style={{
          fontSize: "1.75rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
          color: "#1e293b",
          fontFamily: "var(--font-nrt-bd)"
        }}>
          مێژووی فرۆشتنەکان
        </h1>
        <div style={{
          padding: "1rem",
          backgroundColor: "#fca5a5",
          color: "#991b1b",
          borderRadius: "0.375rem",
          fontFamily: "var(--font-nrt-reg)"
        }}>
          {error}
        </div>
      </div>
    );
  }

  const ConsignmentBadge = ({ isConsignment }) => {
    return (
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
  };
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
    setSelectedItem(null);
  };
  return (
    <div style={{
      fontFamily: "var(--font-nrt-reg)",
      maxWidth: "1800px",
      margin: "0 auto",
      padding: "1.5rem"
    }}>
      <h1 style={{
        fontSize: "1.75rem",
        fontWeight: "bold",
        marginBottom: "1.5rem",
        color: "#1e293b",
        textAlign: "center",
        fontFamily: "var(--font-nrt-bd)"
      }}>
        مێژووی فرۆشتنەکان
      </h1>

      {/* Export Button */}
      <div style={{
        marginBottom: "1rem",
        display: "flex",
        justifyContent: "flex-end"
      }}>
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
   



 
  



      {/* Search Filters Section */}
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "0.5rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        padding: "1.5rem",
        marginBottom: "1.5rem"
      }}>
        <h3 style={{
          fontSize: "1.125rem",
          fontWeight: "bold",
          marginBottom: "1rem",
          color: "#1e293b",
          fontFamily: "var(--font-nrt-bd)",
          borderBottom: "2px solid #e5e7eb",
          paddingBottom: "0.75rem"
        }}>
          فلتەرەکانی گەڕان
        </h3>

        {/* First Row of Filters */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1rem"
        }}>
          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>ژمارەی پسوڵە</label>
            <input
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none",
                transition: "border-color 0.2s",
                ":focus": {
                  borderColor: "#3b82f6",
                  boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)"
                }
              }}
              placeholder="ژمارەی پسوڵە"
              value={filters.billNumber}
              onChange={(e) => handleFilterChange('billNumber', e.target.value)}
            />
          </div>

          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>ناوی کاڵا</label>
            <input
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              placeholder="ناوی کاڵا"
              value={filters.itemName}
              onChange={(e) => handleFilterChange('itemName', e.target.value)}
            />
          </div>

          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>جۆری پارەدان</label>
            <select
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                backgroundColor: "white",
                outline: "none",
                transition: "border-color 0.2s"
              }}
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
            >
              <option value="all">all</option>
              <option value="Cash">Cash</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>دەرمانخانە</label>
            <Select
              options={pharmacyOptions}
              value={pharmacyOptions.find(opt => opt.value === filters.pharmacyId)}
              onChange={(selected) => handleFilterChange('pharmacyId', selected?.value || "")}
              placeholder="هەڵبژاردنی دەرمانخانە"
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: "38px",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)",
                  borderColor: "#e2e8f0",
                  ":hover": {
                    borderColor: "#3b82f6"
                  }
                }),
                menu: (base) => ({
                  ...base,
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)"
                })
              }}
              isClearable
            />
          </div>
        </div>

        {/* Second Row of Filters */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1rem"
        }}>
          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>لە بەرواری فرۆشتن</label>
            <input
              type="text"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none"
              }}
              placeholder="dd/mm/yyyy"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>بۆ بەرواری فرۆشتن</label>
            <input
              type="text"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none"
              }}
              placeholder="dd/mm/yyyy"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          {/* <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>هاوپێچ</label>
            <select
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                backgroundColor: "white",
                outline: "none"
              }}
              value={filters.hasAttachment}
              onChange={(e) => handleFilterChange('hasAttachment', e.target.value)}
            >
              <option value="all">هەموو پسوڵەکان</option>
              <option value="yes">هاوپێچ هەیە</option>
              <option value="no">هاوپێچ نیە</option>
            </select>
          </div> */}

          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>دۆخی تحت صرف</label>
            <select
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                backgroundColor: "white",
                outline: "none"
              }}
              value={filters.consignmentStatus}
              onChange={(e) => handleFilterChange('consignmentStatus', e.target.value)}
            >
              <option value="all">هەموو</option>
              <option value="consignment">تحت صرف</option>
              <option value="owned">Owned</option>
            </select>
          </div>
        </div>

        {/* Third Row - Quantity and Price Ranges */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "1rem",
          marginBottom: "1rem"
        }}>
          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>کەمترین عدد </label>
            <input
              type="number"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none"
              }}
              placeholder="کەمترین"
              value={filters.quantityMin}
              onChange={(e) => handleFilterChange('quantityMin', e.target.value)}
              min="0"
            />
          </div>

          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>زۆرترین عدد</label>
            <input
              type="number"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none"
              }}
              placeholder="زۆرترین"
              value={filters.quantityMax}
              onChange={(e) => handleFilterChange('quantityMax', e.target.value)}
              min="0"
            />
          </div>

          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>کەمترین نرخ</label>
            <input
              type="number"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none"
              }}
              placeholder="دینار"
              value={filters.priceMin}
              onChange={(e) => handleFilterChange('priceMin', e.target.value)}
              min="0"
            />
          </div>

          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>زۆرترین نرخ</label>
            <input
              type="number"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none"
              }}
              placeholder="دینار"
              value={filters.priceMax}
              onChange={(e) => handleFilterChange('priceMax', e.target.value)}
              min="0"
            />
          </div>

          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>کەمترین کۆی گشتی</label>
            <input
              type="number"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none"
              }}
              placeholder="دینار"
              value={filters.totalPriceMin}
              onChange={(e) => handleFilterChange('totalPriceMin', e.target.value)}
              min="0"
            />
          </div>

          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>زۆرترین کۆی گشتی</label>
            <input
              type="number"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none"
              }}
              placeholder="دینار"
              value={filters.totalPriceMax}
              onChange={(e) => handleFilterChange('totalPriceMax', e.target.value)}
              min="0"
            />
          </div>
        </div>

        {/* Item Filter and Global Search */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: "1rem"
        }}>
          <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>هەڵبژاردنی کاڵای تایبەت</label>
            <Select
              isMulti
              options={itemOptions}
              onChange={(selected) => setItemFilters(selected.map(option => option.value))}
              placeholder="هەڵبژاردنی کاڵای تایبەت..."
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: "38px",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)",
                  borderColor: "#e2e8f0"
                }),
                menu: (base) => ({
                  ...base,
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)"
                })
              }}
            />
            
          </div>
                <div>
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
      gap: "0.25rem",
      marginLeft:"700px",
      marginTop:"40px"
    }}
  >
    ♻️
    پاککردنەوەی فلتەرەکان
  </button>
                </div>
          {/* <div>
            <label style={{
              display: "block",
              marginBottom: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-bd)"
            }}>گەڕانی گشتی</label>
            <input
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                outline: "none"
              }}
              placeholder="گەڕان بەپێی ژمارەی پسوڵە، کاڵا، بارکۆد، دەرمانخانە..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div> */}
        </div>
      </div>

      {/* Results Count */}
      <div style={{
        marginBottom: "1rem",
        padding: "0.75rem",
        backgroundColor: "#f0f9ff",
        borderRadius: "0.375rem",
        border: "1px solid #bae6fd",
        fontFamily: "var(--font-nrt-reg)",
        fontSize: "0.875rem"
      }}>
        <strong>ئەنجامەکان: {itemsWithUniqueId.length}</strong> | 
        <span style={{ marginLeft: "0.75rem", color: "#475569" }}>
          پێڕستکردن: {sortConfig.key ? 
            `${sortConfig.key === "name" ? "ناوی کاڵا" : 
              sortConfig.key === "quantity" ? "عدد" :
              sortConfig.key === "price" ? "نرخ" :
              sortConfig.key === "billNumber" ? "ژمارەی پسوڵە" :
              sortConfig.key === "pharmacyName" ? "دەرمانخانە" :
              sortConfig.key === "saleDate" ? "بەرواری فرۆشتن" :
              sortConfig.key === "totalPrice" ? "کۆی گشتی" : sortConfig.key} 
            ${sortConfig.direction === "asc" ? "(بەرەوچوون)" : "(بەرەوژێر)"}` : 
            "پێڕست نه‌کراوە"}
        </span>
      </div>

      {/* Main Table */}
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "0.5rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        overflow: "hidden"
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "1200px",
            fontFamily: "var(--font-nrt-reg)"
          }}>
            <thead style={{ backgroundColor: "#f1f5f9" }}>
              <tr>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)",
                  cursor: "pointer",
                  borderBottom: "2px solid #e5e7eb"
                }} onClick={() => handleSort("name")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    ناوی کاڵا
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {getSortIndicator("name")}
                    </span>
                  </div>
                </th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)",
                  cursor: "pointer",
                  borderBottom: "2px solid #e5e7eb"
                }} onClick={() => handleSort("quantity")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    عدد
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {getSortIndicator("quantity")}
                    </span>
                  </div>
                </th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)",
                  cursor: "pointer",
                  borderBottom: "2px solid #e5e7eb"
                }} onClick={() => handleSort("price")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    نرخ (دینار)
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {getSortIndicator("price")}
                    </span>
                  </div>
                </th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)",
                  cursor: "pointer",
                  borderBottom: "2px solid #e5e7eb"
                }} onClick={() => handleSort("totalPrice")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    کۆی گشتی (دینار)
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {getSortIndicator("totalPrice")}
                    </span>
                  </div>
                </th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)",
                  cursor: "pointer",
                  borderBottom: "2px solid #e5e7eb"
                }} onClick={() => handleSort("billNumber")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    ژمارەی پسوڵە
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {getSortIndicator("billNumber")}
                    </span>
                  </div>
                </th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)",
                  cursor: "pointer",
                  borderBottom: "2px solid #e5e7eb"
                }} onClick={() => handleSort("pharmacyName")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    دەرمانخانە
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {getSortIndicator("pharmacyName")}
                    </span>
                  </div>
                </th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)",
                  cursor: "pointer",
                  borderBottom: "2px solid #e5e7eb"
                }} onClick={() => handleSort("saleDate")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    بەرواری فرۆشتن
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {getSortIndicator("saleDate")}
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {itemsWithUniqueId.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{
                    padding: "2rem",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontFamily: "var(--font-nrt-reg)"
                  }}>
                    هیچ کاڵایەکی فرۆشراو نەدۆزرایەوە بەپێی فلتەرەکان.
                  </td>
                </tr>
              ) : (
                itemsWithUniqueId.map((item, index) => (
                  <React.Fragment key={item.uniqueId}>
                    <tr
                      onClick={() => toggleItemDetails(item)}
                      style={{
                        cursor: "pointer",
                        backgroundColor: index % 2 === 0 ? "white" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        ":hover": { backgroundColor: "#f1f5f9" },
                        ...(selectedItem?.uniqueId === item.uniqueId && {
                          backgroundColor: "#dbeafe"
                        })
                      }}
                    >
                      <td style={{
                        padding: "0.75rem",
                        fontFamily: "var(--font-nrt-reg)",
                        fontWeight: "500",
                        borderBottom: selectedItem?.uniqueId === item.uniqueId ? "none" : "1px solid #e2e8f0"
                      }}>
                        {item.name}
                      </td>
                      <td style={{
                        padding: "0.75rem",
                        fontFamily: "var(--font-nrt-reg)",
                        textAlign: "center",
                        borderBottom: selectedItem?.uniqueId === item.uniqueId ? "none" : "1px solid #e2e8f0"
                      }}>
                        {item.quantity}
                      </td>
                      <td style={{
                        padding: "0.75rem",
                        fontFamily: "var(--font-nrt-reg)",
                        textAlign: "right",
                        borderBottom: selectedItem?.uniqueId === item.uniqueId ? "none" : "1px solid #e2e8f0"
                      }}>
                        {formatNumber(item.price?.toFixed(2) || "0")} IQD
                      </td>
                      <td style={{
                        padding: "0.75rem",
                        fontFamily: "var(--font-nrt-reg)",
                        textAlign: "right",
                        fontWeight: "600",
                        color: "#059669",
                        borderBottom: selectedItem?.uniqueId === item.uniqueId ? "none" : "1px solid #e2e8f0"
                      }}>
                        {formatNumber(item.totalPrice.toFixed(2))} IQD
                      </td>
                      <td style={{
                        padding: "0.75rem",
                        fontFamily: "var(--font-nrt-reg)",
                        textAlign: "center",
                        fontFamily: "monospace",
                        borderBottom: selectedItem?.uniqueId === item.uniqueId ? "none" : "1px solid #e2e8f0"
                      }}>
                        {item.billNumber}
                      </td>
                      <td style={{
                        padding: "0.75rem",
                        fontFamily: "var(--font-nrt-reg)",
                        borderBottom: selectedItem?.uniqueId === item.uniqueId ? "none" : "1px solid #e2e8f0"
                      }}>
                        {item.pharmacyName}
                      </td>
                      <td style={{
                        padding: "0.75rem",
                        fontFamily: "var(--font-nrt-reg)",
                        textAlign: "center",
                        borderBottom: selectedItem?.uniqueId === item.uniqueId ? "none" : "1px solid #e2e8f0"
                      }}>
                        {formatDate(item.saleDate)}
                      </td>
                    </tr>

                    {/* Item Details Panel */}
                    {selectedItem?.uniqueId === item.uniqueId && (
                      <tr>
                        <td colSpan="7" style={{ padding: "0", backgroundColor: "#eff6ff" }}>
                          <div style={{
                            padding: "1.5rem",
                            borderTop: "2px solid #3b82f6",
                            borderBottom: "2px solid #3b82f6"
                          }}>
                            <h4 style={{
                              fontSize: "1.125rem",
                              fontWeight: "bold",
                              marginBottom: "1rem",
                              color: "#1e40af",
                              fontFamily: "var(--font-nrt-bd)",
                              textAlign: "center"
                            }}>
                              وردەکاری کاڵا - {item.name} - {item.billNumber}
                            </h4>
                            
                            <div style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3, 1fr)",
                              gap: "1.5rem"
                            }}>
                              {/* Column 1: Basic Info */}
                              <div>
                                <div style={{
                                  backgroundColor: "white",
                                  borderRadius: "0.5rem",
                                  padding: "1rem",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                                }}>
                                  <h5 style={{
                                    fontWeight: "600",
                                    marginBottom: "0.75rem",
                                    color: "#374151",
                                    borderBottom: "1px solid #e5e7eb",
                                    paddingBottom: "0.5rem",
                                    fontFamily: "var(--font-nrt-bd)"
                                  }}>
                                    زانیاری بنەڕەتی
                                  </h5>
                                  <table style={{ width: "100%", fontFamily: "var(--font-nrt-reg)" }}>
                                    <tbody>
                                      <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>بارکۆد:</td>
                                        <td style={{ padding: "0.375rem 0", fontWeight: "500" }}>{item.barcode}</td>
                                      </tr>
                                      <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>بڕ:</td>
                                        <td style={{ padding: "0.375rem 0", fontWeight: "500" }}>{item.quantity}</td>
                                      </tr>
                                      <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>نرخ:</td>
                                        <td style={{ padding: "0.375rem 0", fontWeight: "500" }}>{formatNumber(item.price?.toFixed(2) || "0")} IQD</td>
                                      </tr>
                                      <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>کۆی گشتی:</td>
                                        <td style={{ padding: "0.375rem 0", fontWeight: "600", color: "#059669" }}>
                                          {formatNumber(item.totalPrice.toFixed(2))} IQD
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Column 2: Bill Info */}
                              <div>
                                <div style={{
                                  backgroundColor: "white",
                                  borderRadius: "0.5rem",
                                  padding: "1rem",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                                }}>
                                  <h5 style={{
                                    fontWeight: "600",
                                    marginBottom: "0.75rem",
                                    color: "#374151",
                                    borderBottom: "1px solid #e5e7eb",
                                    paddingBottom: "0.5rem",
                                    fontFamily: "var(--font-nrt-bd)"
                                  }}>
                                    زانیاری پسوڵە
                                  </h5>
                                  <table style={{ width: "100%", fontFamily: "var(--font-nrt-reg)" }}>
                                    <tbody>
                                      <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>ژمارەی پسوڵە:</td>
                                        <td style={{ padding: "0.375rem 0", fontWeight: "500" }}>{item.billNumber}</td>
                                      </tr>
                                      <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>بەرواری فرۆشتن:</td>
                                        <td style={{ padding: "0.375rem 0", fontWeight: "500" }}>{formatDate(item.saleDate)}</td>
                                      </tr>
                                      <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>جۆری پارەدان:</td>
                                        <td style={{ padding: "0.375rem 0" }}>
                                          <span style={{
                                            padding: "0.125rem 0.5rem",
                                            borderRadius: "0.25rem",
                                            fontSize: "0.75rem",
                                            fontWeight: "500",
                                            backgroundColor: 
                                              item.paymentStatus === 'Cash' ? "#d1fae5" :
                                              item.paymentStatus === 'Paid' ? "#dbeafe" : "#fee2e2",
                                            color: 
                                              item.paymentStatus === 'Cash' ? "#065f46" :
                                              item.paymentStatus === 'Paid' ? "#1e40af" : "#991b1b"
                                          }}>
                                            {item.paymentStatus === 'Cash' ? 'Cash' : 
                                             item.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}
                                          </span>
                                        </td>
                                      </tr>
                                      <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>دۆخی تحت صرف:</td>
                                        <td style={{ padding: "0.375rem 0" }}>
                                          <ConsignmentBadge isConsignment={item.isConsignment} />
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Column 3: Additional Info */}
                              <div>
                                <div style={{
                                  backgroundColor: "white",
                                  borderRadius: "0.5rem",
                                  padding: "1rem",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                                }}>
                                  <h5 style={{
                                    fontWeight: "600",
                                    marginBottom: "0.75rem",
                                    color: "#374151",
                                    borderBottom: "1px solid #e5e7eb",
                                    paddingBottom: "0.5rem",
                                    fontFamily: "var(--font-nrt-bd)"
                                  }}>
                                    زانیاری زیاتر
                                  </h5>
                                  <table style={{ width: "100%", fontFamily: "var(--font-nrt-reg)" }}>
                                    <tbody>
                                      <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>ناوی دەرمانخانە:</td>
                                        <td style={{ padding: "0.375rem 0", fontWeight: "500" }}>{item.pharmacyName}</td>
                                      </tr>
                                      <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>بەرواری بەسەرچوون:</td>
                                        <td style={{ padding: "0.375rem 0", fontWeight: "500" }}>{formatExpireDate(item.expireDate)}</td>
                                      </tr>
                                      {/* <tr>
                                        <td style={{ padding: "0.375rem 0", color: "#6b7280", fontSize: "0.875rem" }}>هاوپێچ:</td>
                                        <td style={{ padding: "0.375rem 0", fontWeight: "500" }}>
                                          {item.attachment ? 'هەیە' : 'نیە'}
                                        </td>
                                      </tr> */}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>

                            {/* Attachment Button */}
                            {item.attachment && (
                              <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAttachmentModal(item.billData);
                                  }}
                                  style={{
                                    padding: "0.5rem 1.5rem",
                                    backgroundColor: "#10b981",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "0.375rem",
                                    cursor: "pointer",
                                    fontSize: "0.875rem",
                                    fontFamily: "var(--font-nrt-bd)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.5rem"
                                  }}
                                >
                                  <span>📎</span>
                                  بینینی هاوبەشی پسوڵە
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
            {/* Totals Row */}
            <tfoot style={{
              backgroundColor: "#f1f5f9",
              borderTop: "2px solid #e5e7eb"
            }}>
              <tr>
              <td style={{
                  padding: "0.75rem",
                  fontFamily: "var(--font-nrt-bd)",
                  textAlign: "right",
                  fontWeight: "bold"
                }}>
                  {totalQuantity}
                </td>
                <td style={{
                  padding: "0.75rem",
                  fontFamily: "var(--font-nrt-bd)",
                  textAlign: "left",
                  fontWeight: "bold"
                }}>
                 :کۆی گشتی عدد
                </td>
                <td style={{
                  padding: "0.75rem",
                  fontFamily: "var(--font-nrt-bd)",
                  textAlign: "right",
                  fontWeight: "bold",
                  color: "#059669"
                }}>
                  {formatNumber(totalSum.toFixed(2))} IQD
                </td>
                <td style={{
                  padding: "0.75rem",
                  fontFamily: "var(--font-nrt-reg)",
                  textAlign: "right"
                }}>
                  کۆی گشتی
                </td>
           
                <td colSpan="3" style={{
                  padding: "0.75rem",
                  textAlign: "center",
                  fontFamily: "var(--font-nrt-reg)"
                }}>
                  کۆی گشتی {itemsWithUniqueId.length} کاڵا
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
          <div style={{
            backgroundColor: "white",
            borderRadius: "0.5rem",
            maxWidth: "28rem",
            width: "100%"
          }}>
            <div style={{ padding: "1.5rem" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem"
              }}>
                <h3 style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  color: "#1f2937",
                  fontFamily: "var(--font-nrt-bd)"
                }}>
                  پسوڵەی #{attachmentModal.billNumber} - هاوبەش
                </h3>
                <button
                  onClick={closeAttachmentModal}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    fontSize: "1.25rem",
                    color: "#6b7280",
                    cursor: "pointer",
                    padding: "0.25rem"
                  }}
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
                  <div style={{
                    textAlign: "center",
                    marginTop: "0.5rem",
                    color: "#6b7280",
                    fontSize: "0.875rem"
                  }}>
                    هاوبەشی ئێستا
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "#9ca3af",
                  fontSize: "0.875rem"
                }}>
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

                <button
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
                </button>
              </div>
              
              <div style={{
                display: "flex",
                gap: "0.5rem"
              }}>
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