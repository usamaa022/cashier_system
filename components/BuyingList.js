"use client";
import { useState, useEffect, useRef } from "react";
import React from 'react';
import { getBoughtBills, getCompanies, deleteBoughtBill, updateBoughtBill } from "@/lib/data";
import Card from "./Card";
import { useRouter } from "next/navigation";
import Select from "react-select";
import { FiChevronUp, FiChevronDown, FiX, FiDownload, FiCamera, FiImage } from "react-icons/fi";

// Helper functions
const formatNumber = (number) => {
  if (!number && number !== 0) return '0';
  if (Number.isInteger(number)) {
    return new Intl.NumberFormat('en-US').format(number);
  } else {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  }
};

const formatDateToDDMMYYYY = (date) => {
  if (!date) return 'N/A';

  try {
    let dateObj = null;

    if (date?.toDate && typeof date.toDate === 'function') {
      dateObj = date.toDate();
    } else if (date?.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      if (date.includes('-')) {
        const [year, month, day] = date.split('-');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      } else if (date.includes('/')) {
        const [day, month, year] = date.split('/');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      }
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    console.error("Error formatting date:", e);
  }

  return 'N/A';
};

const formatExpireDate = (expireDate) => {
  if (!expireDate) return 'N/A';

  try {
    let dateObj = null;

    if (expireDate?.toDate && typeof expireDate.toDate === 'function') {
      dateObj = expireDate.toDate();
    } else if (expireDate?.seconds) {
      dateObj = new Date(expireDate.seconds * 1000);
    } else if (expireDate instanceof Date) {
      dateObj = expireDate;
    } else if (typeof expireDate === 'string') {
      if (expireDate.includes('-')) {
        const [year, month, day] = expireDate.split('-');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      } else if (expireDate.includes('/')) {
        const [day, month, year] = expireDate.split('/');
        dateObj = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
      }
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    console.error("Error formatting expire date:", e);
  }

  return 'N/A';
};

const parseDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue.toDate) return dateValue.toDate();
  if (dateValue.seconds) return new Date(dateValue.seconds * 1000);
  if (typeof dateValue === 'string') {
    if (dateValue.includes('/')) {
      const [day, month, year] = dateValue.split('/');
      return new Date(year, month - 1, day);
    }
    return new Date(dateValue);
  }
  if (dateValue instanceof Date) return dateValue;
  return null;
};

const formatDateForInput = (date) => {
  if (!date) return '';
  let dateObj;
  if (date.toDate) dateObj = date.toDate();
  else if (date.seconds) dateObj = new Date(date.seconds * 1000);
  else if (date instanceof Date) dateObj = date;
  else if (typeof date === 'string') {
    if (date.includes('/')) {
      const [day, month, year] = date.split('/');
      dateObj = new Date(year, month - 1, day);
    } else dateObj = new Date(date);
  } else return '';
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// FIXED: Get out price based on bill's currency
const getOutPrice = (item, billCurrency) => {
  if (billCurrency === "USD") {
    return item.outPriceUSD !== undefined && item.outPriceUSD !== null ? item.outPriceUSD : 0;
  } else {
    return item.outPriceIQD !== undefined && item.outPriceIQD !== null ? item.outPriceIQD : 0;
  }
};

// FIXED: Get purchase price based on bill's currency
const getPurchasePrice = (item, billCurrency) => {
  if (billCurrency === "USD") {
    return item.basePriceUSD !== undefined && item.basePriceUSD !== null ? item.basePriceUSD : 0;
  } else {
    return item.basePriceIQD !== undefined && item.basePriceIQD !== null ? item.basePriceIQD : 0;
  }
};

// FIXED: Get net price based on bill's currency
const getNetPrice = (item, billCurrency) => {
  if (billCurrency === "USD") {
    if (item.netPriceUSD !== undefined && item.netPriceUSD !== null) {
      return item.netPriceUSD;
    }
    return item.netPrice !== undefined ? item.netPrice : item.basePriceUSD || 0;
  } else {
    if (item.netPriceIQD !== undefined && item.netPriceIQD !== null) {
      return item.netPriceIQD;
    }
    return item.netPrice !== undefined ? item.netPrice : item.basePriceIQD || 0;
  }
};

// FIXED: Get transport fee based on bill's currency
const getTransportFee = (bill, currency) => {
  if (currency === "USD") {
    return bill.totalTransportFeeUSD || 0;
  } else {
    return bill.totalTransportFeeIQD || 0;
  }
};

// FIXED: Get external expense based on bill's currency
const getExternalExpense = (bill, currency) => {
  if (currency === "USD") {
    return bill.totalExternalExpenseUSD || 0;
  } else {
    return bill.totalExternalExpenseIQD || 0;
  }
};

export default function BuyingList({ refreshTrigger }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    companySearch: "",
    companyBillNumber: "",
    startDate: "",
    endDate: "",
    paymentStatus: "all",
    consignmentStatus: "all",
  });
  const [itemFilters, setItemFilters] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [bills, setBills] = useState([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [attachmentModal, setAttachmentModal] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [sortConfig, setSortConfig] = useState({ key: 'billNumber', direction: 'desc' });
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const billsData = await getBoughtBills();
        setBills(billsData);
        const companiesData = await getCompanies();
        setCompanies(companiesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, [refreshTrigger]);

  useEffect(() => {
    const items = new Set();
    bills.forEach(bill => {
      bill.items.forEach(item => {
        items.add(item.name);
      });
    });
    setAvailableItems(Array.from(items));
  }, [bills]);

  useEffect(() => {
    if (filters.companySearch.length > 0) {
      const results = companies.filter(company =>
        company.name.toLowerCase().includes(filters.companySearch.toLowerCase())
      );
      setCompanySuggestions(results);
      setShowCompanySuggestions(results.length > 0);
    } else {
      setCompanySuggestions([]);
      setShowCompanySuggestions(false);
    }
  }, [filters.companySearch, companies]);

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleCompanySelect = (company) => {
    setFilters({ ...filters, companySearch: company.name, companyId: company.id });
    setShowCompanySuggestions(false);
  };

  const itemOptions = availableItems.map(item => ({
    value: item,
    label: item
  }));

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedAndFilteredBills = () => {
    const filtered = bills.filter(bill => {
      const matchesBillNumber = !filters.billNumber ||
        bill.billNumber.toString().includes(filters.billNumber);
      const matchesCompanyBillNumber = !filters.companyBillNumber ||
        bill.companyBillNumber?.toString().includes(filters.companyBillNumber);
      const matchesCompany = !filters.companySearch ||
        companies.find(c => c.id === bill.companyId)?.name.toLowerCase().includes(filters.companySearch.toLowerCase());
      const billDate = parseDate(bill.date);
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
      const endDate = filters.endDate ? new Date(filters.endDate) : null;
      const matchesStartDate = !startDate || (billDate && billDate >= startDate);
      const matchesEndDate = !endDate || (billDate && billDate <= endDate);
      const matchesPaymentStatus = filters.paymentStatus === "all" ||
        bill.paymentStatus === filters.paymentStatus;
      const matchesConsignmentStatus = filters.consignmentStatus === "all" ||
        (filters.consignmentStatus === "consignment" && bill.isConsignment) ||
        (filters.consignmentStatus === "owned" && !bill.isConsignment);
      const matchesSearch = !searchQuery ||
        bill.items.some(item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.barcode.includes(searchQuery)
        ) ||
        bill.billNumber.toString().includes(searchQuery);
      const matchesItemFilters = itemFilters.length === 0 ||
        bill.items.some(item => itemFilters.includes(item.name));
      return matchesBillNumber && matchesCompanyBillNumber && matchesCompany &&
        matchesStartDate && matchesEndDate &&
        matchesPaymentStatus && matchesSearch && matchesItemFilters &&
        matchesConsignmentStatus;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'billNumber') {
          aValue = a.billNumber;
          bValue = b.billNumber;
        } else if (sortConfig.key === 'company') {
          aValue = companies.find(c => c.id === a.companyId)?.name || '';
          bValue = companies.find(c => c.id === b.companyId)?.name || '';
        } else if (sortConfig.key === 'date') {
          aValue = parseDate(a.date)?.getTime() || 0;
          bValue = parseDate(b.date)?.getTime() || 0;
        } else if (sortConfig.key === 'paymentStatus') {
          aValue = a.paymentStatus || '';
          bValue = b.paymentStatus || '';
        } else if (sortConfig.key === 'consignment') {
          aValue = a.isConsignment ? 'Consignment' : 'Owned';
          bValue = b.isConsignment ? 'Consignment' : 'Owned';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  };

  const sortedAndFilteredBills = getSortedAndFilteredBills();

  const handleUpdateBill = async (bill) => {
    try {
      const company = companies.find(c => c.id === bill.companyId);
      const exchangeRate = bill.exchangeRate || 1500;
      const currency = bill.currency || "USD";

      const billWithCompanyData = {
        ...bill,
        companyId: bill.companyId,
        companyName: company?.name || '',
        companyCode: company?.code || '',
        companySearch: company?.name || '',
        billDate: formatDateForInput(bill.date),
        branch: bill.branch || "Slemany",
        paymentStatus: bill.paymentStatus || "Unpaid",
        isConsignment: bill.isConsignment || false,
        expensePercentage: bill.expensePercentage || 7,
        exchangeRate: exchangeRate,
        currency: currency,
        billNote: bill.billNote || "",
        totalTransportFee: getTransportFee(bill, currency),
        totalExternalExpense: getExternalExpense(bill, currency),
        items: bill.items.map(item => {
          const price = currency === "USD" ? item.basePriceUSD : item.basePriceIQD;
          return {
            ...item,
            basePriceUSD: item.basePriceUSD,
            basePriceIQD: item.basePriceIQD,
            netPriceUSD: item.netPriceUSD,
            netPriceIQD: item.netPriceIQD,
            expireDate: item.expireDate ? formatDateForInput(item.expireDate) : "",
          };
        })
      };

      localStorage.setItem('editingBill', JSON.stringify(billWithCompanyData));
      router.push('/buying?edit=true');
    } catch (error) {
      console.error("Error preparing bill for edit:", error);
      alert("Failed to load bill for editing. Please try again.");
    }
  };

  const handleDeleteBill = async (billNumber) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      try {
        await deleteBoughtBill(billNumber);
        const updatedBills = await getBoughtBills();
        setBills(updatedBills);
        setSelectedBill(null);
      } catch (error) {
        console.error("Error deleting bill:", error);
      }
    }
  };

  const toggleBillDetails = (bill) => {
    setSelectedBill(selectedBill?.billNumber === bill.billNumber ? null : bill);
  };

  const openAttachmentModal = (bill) => {
    setAttachmentModal(bill);
    setAttachmentPreview(bill.attachment || null);
  };

  const closeAttachmentModal = () => {
    setAttachmentModal(null);
    setAttachmentPreview(null);
  };

  const openFullScreen = (imageData) => {
    setFullScreenImage(imageData);
  };

  const closeFullScreen = () => {
    setFullScreenImage(null);
  };

  const downloadImage = (imageData) => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `attachment_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
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
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const gray = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
              data[i] = gray;
              data[i + 1] = gray;
              data[i + 2] = gray;
            }
            ctx.putImageData(imageData, 0, 0);
            const compressedImage = canvas.toDataURL('image/jpeg', 0.7);
            setAttachmentPreview(compressedImage);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please select an image file.');
      }
    }
  };

  const handleCameraCapture = async () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const saveAttachment = async () => {
    if (!attachmentPreview || !attachmentModal) return;
    try {
      await updateBoughtBill(attachmentModal.billNumber, {
        attachment: attachmentPreview,
        attachmentDate: new Date().toISOString()
      });

      setBills(bills.map(bill =>
        bill.billNumber === attachmentModal.billNumber ?
          { ...bill, attachment: attachmentPreview } : bill
      ));

      setAttachmentModal(prev => ({
        ...prev,
        attachment: attachmentPreview
      }));

      alert('Attachment saved successfully!');
    } catch (error) {
      console.error('Error saving attachment:', error);
      alert('Failed to save attachment. Please try again.');
    }
  };

  const removeAttachment = async () => {
    if (!attachmentModal) return;

    if (confirm("Are you sure you want to remove this attachment?")) {
      try {
        await updateBoughtBill(attachmentModal.billNumber, {
          attachment: null,
          attachmentDate: null
        });

        setBills(bills.map(bill =>
          bill.billNumber === attachmentModal.billNumber ?
            { ...bill, attachment: null } : bill
        ));

        setAttachmentModal(prev => ({
          ...prev,
          attachment: null
        }));
        setAttachmentPreview(null);

        alert('Attachment removed successfully!');
      } catch (error) {
        console.error('Error removing attachment:', error);
        alert('Failed to remove attachment. Please try again.');
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const PaymentStatusBadge = ({ status }) => {
    const getStatusStyles = () => {
      switch (status) {
        case "Paid":
        case "Cash":
          return "bg-yellow-100 text-yellow-800 border border-yellow-300";
        case "Unpaid":
          return "bg-orange-100 text-orange-800 border border-orange-300";
        default:
          return "bg-orange-100 text-orange-800 border border-orange-300";
      }
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyles()}`}>
        {status}
      </span>
    );
  };

  const ConsignmentBadge = ({ isConsignment }) => {
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
        isConsignment ? "bg-purple-100 text-purple-800 border-purple-300" : "bg-green-100 text-green-800 border-green-300"
      }`}>
        {isConsignment ? "تحت صرف" : "OWNED"}
      </span>
    );
  };

  const toggleCurrency = () => {
    setDisplayCurrency(prev => prev === "USD" ? "IQD" : "USD");
  };

  return (
    <>
      <style jsx global>{`
        /* Main Container - Full width with max-width */
        .buying-list-wrapper {
          max-width: 100%;
          margin: 0 auto;
          padding: 0.75rem;
          width: 100%;
        }

        /* Table Container Styles */
        .table-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          margin-top: 1rem;
          width: 100%;
        }

        /* Scrollable Table Wrapper */
        .table-scroll-wrapper {
          overflow-x: auto;
          overflow-y: auto;
          max-height: 600px;
          -webkit-overflow-scrolling: touch;
          width: 100%;
        }

        .table-scroll-wrapper::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .table-scroll-wrapper::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }

        .table-scroll-wrapper::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        .table-scroll-wrapper::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Main Table Styles */
        .purchase-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 14px;
          min-width: 700px;
        }

        .purchase-table thead tr {
          background: #f8fafc;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .purchase-table th {
          padding: 0.75rem;
          font-weight: 600;
          color: #4b5563;
          text-align: left;
          border-bottom: 2px solid #e5e7eb;
          position: sticky;
          top: 0;
          background: #f8fafc;
          z-index: 10;
          font-size: 13px;
          white-space: nowrap;
        }

        .purchase-table th:not(:last-child) {
          border-right: 1px solid #e5e7eb;
        }

        .purchase-table th.sortable {
          cursor: pointer;
          user-select: none;
        }

        .purchase-table th.sortable:hover {
          background-color: #f1f5f9;
        }

        .purchase-table td {
          padding: 0.75rem;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
          transition: all 0.2s ease;
          font-size: 13px;
        }

        .purchase-table td:not(:last-child) {
          border-right: 1px solid #e5e7eb;
        }

        .purchase-table tbody tr {
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .purchase-table tbody tr:hover {
          background-color: #f9fafb;
        }

        .purchase-table tbody tr.selected-row {
          background: #f0f9ff;
        }

        /* Badge Styles */
        .badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        /* Action Button Styles */
        .action-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .btn-icon {
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          transition: all 0.2s ease;
          border: 1px solid transparent;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        .btn-icon:hover {
          transform: translateY(-1px);
        }

        .btn-edit {
          background: #dbeafe;
          color: #1e40af;
          border-color: #93c5fd;
        }

        .btn-edit:hover {
          background: #bfdbfe;
        }

        .btn-delete {
          background: #fee2e2;
          color: #991b1b;
          border-color: #fca5a5;
        }

        .btn-delete:hover {
          background: #fecaca;
        }

        .btn-attach {
          background: #f3f4f6;
          color: #374151;
          border-color: #d1d5db;
        }

        .btn-attach:hover {
          background: #e5e7eb;
        }

        .btn-view {
          background: #dcfce7;
          color: #166534;
          border-color: #bbf7d0;
        }

        .btn-view:hover {
          background: #bbf7d0;
        }

        /* Expanded Details Panel */
        .details-panel {
          background: #f9fafb;
          border-top: 2px solid #3b82f6;
          border-bottom: 1px solid #e5e7eb;
        }

        .details-content {
          padding: 1rem;
        }

        /* Info Grid */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
          background: white;
          border-radius: 8px;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          margin-bottom: 1rem;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .info-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #6b7280;
        }

        .info-value {
          font-size: 0.95rem;
          font-weight: 600;
          color: #111827;
        }

        /* Items Table inside Details */
        .items-table-container {
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
          margin: 0.75rem 0;
          overflow-x: auto;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
          min-width: 600px;
        }

        .items-table th {
          background: #f9fafb;
          padding: 0.5rem 0.75rem;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          font-size: 0.8rem;
          letter-spacing: 0.03em;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
          white-space: nowrap;
        }

        .items-table th:not(:last-child) {
          border-right: 1px solid #e5e7eb;
        }

        .items-table td {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #e5e7eb;
          color: #111827;
          font-size: 0.85rem;
        }

        .items-table td:not(:last-child) {
          border-right: 1px solid #e5e7eb;
        }

        .items-table tbody tr:hover {
          background: #f9fafb;
        }

        .barcode-cell {
          font-family: 'Courier New', monospace;
          background: #f3f4f6;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-size: 0.85rem;
          color: #2563eb;
        }

        .quantity-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.8rem;
          padding: 0.1rem 0.4rem;
          background: #f3f4f6;
          color: #111827;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 0.85rem;
        }

        .price-usd {
          color: #2563eb;
          font-weight: 600;
        }

        .price-iqd {
          color: #854d0e;
          font-weight: 600;
        }

        .cost-price {
          color: #b45309;
          font-weight: 600;
        }

        .purchase-price {
          font-weight: 600;
        }

        .expire-badge {
          display: inline-block;
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .expire-ok {
          background: #dcfce7;
          color: #166534;
        }

        .expire-na {
          background: #fef9c3;
          color: #854d0e;
        }

        /* Filter Section Styles */
        .filter-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .filter-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .filter-header h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
        }

        @media (min-width: 640px) {
          .filter-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .filter-grid {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
        }

        .filter-input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }

        .filter-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .filter-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 500;
          color: #4b5563;
          margin-bottom: 0.25rem;
        }

        /* Currency Toggle */
        .currency-toggle {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 0.75rem;
        }

        .currency-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.8rem;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .currency-button:hover {
          background: #dbeafe;
        }

        /* Attachment Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 50;
          backdrop-filter: blur(4px);
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .modal-header {
          position: sticky;
          top: 0;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          padding: 0.75rem 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }

        .modal-header h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .modal-close {
          color: #9ca3af;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .modal-close:hover {
          color: #6b7280;
        }

        .modal-body {
          padding: 1rem;
        }

        .attachment-preview {
          width: 100%;
          height: 180px;
          object-fit: contain;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 0.75rem;
          background: #f9fafb;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .attachment-preview:hover {
          transform: scale(1.02);
        }

        .attachment-placeholder {
          text-align: center;
          padding: 1.5rem;
          border: 2px dashed #e5e7eb;
          border-radius: 8px;
          color: #9ca3af;
          margin-bottom: 0.75rem;
        }

        .modal-actions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .modal-btn {
          padding: 0.5rem;
          border-radius: 8px;
          font-weight: 500;
          font-size: 0.85rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .modal-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-btn-remove {
          background: #ef4444;
          color: white;
        }

        .modal-btn-remove:hover:not(:disabled) {
          background: #dc2626;
        }

        .modal-btn-cancel {
          background: #6b7280;
          color: white;
        }

        .modal-btn-cancel:hover {
          background: #4b5563;
        }

        .modal-btn-save {
          background: #3b82f6;
          color: white;
        }

        .modal-btn-save:hover:not(:disabled) {
          background: #2563eb;
        }

        .modal-btn-camera {
          background: #10b981;
          color: white;
        }

        .modal-btn-camera:hover {
          background: #059669;
        }

        .file-input {
          display: none;
        }

        .file-upload-btn {
          width: 100%;
          padding: 0.5rem;
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 0.5rem;
        }

        .file-upload-btn:hover {
          background: #e5e7eb;
        }

        /* Full Screen Image Viewer */
        .fullscreen-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }

        .fullscreen-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .fullscreen-image {
          max-width: 90vw;
          max-height: 75vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .fullscreen-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .fullscreen-btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .fullscreen-btn-close {
          background: #ef4444;
          color: white;
        }

        .fullscreen-btn-close:hover {
          background: #dc2626;
        }

        .fullscreen-btn-download {
          background: #3b82f6;
          color: white;
        }

        .fullscreen-btn-download:hover {
          background: #2563eb;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        }

        .empty-state-icon {
          font-size: 2.5rem;
          color: #d1d5db;
          margin-bottom: 0.75rem;
        }

        .empty-state-title {
          font-size: 1rem;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 0.5rem;
        }

        .empty-state-text {
          color: #9ca3af;
          font-size: 0.9rem;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .purchase-table {
            font-size: 0.75rem;
            min-width: 600px;
          }

          .purchase-table th,
          .purchase-table td {
            padding: 0.5rem 0.4rem;
          }

          .info-grid {
            grid-template-columns: 1fr 1fr;
          }

          .action-buttons {
            flex-direction: column;
            gap: 0.25rem;
          }

          .modal-actions {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .info-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Price display styles */
        .price-display {
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: right;
        }

        .price-usd-display {
          color: #2563eb;
          font-weight: 600;
        }

        .price-iqd-display {
          color: #854d0e;
          font-weight: 600;
        }

        .purchase-price {
          font-weight: 600;
        }

        .currency-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 9px;
          font-weight: 600;
          margin-left: 4px;
        }

        .currency-usd {
          background: #dbeafe;
          color: #1e40af;
        }

        .currency-iqd {
          background: #fef3c7;
          color: #92400e;
        }
      `}</style>

      <div className="buying-list-wrapper">
        <Card title="Purchase History">
          {/* Search Filters Section */}
          <div className="filter-section">
            <div className="filter-header">
              <h3>Search Filters</h3>
              <button
                type="button"
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-1 px-2 rounded"
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              >
                {showAdvancedSearch ? "Hide Advanced Search" : "Advanced Search"}
              </button>
            </div>
            <div className="filter-grid mb-4">
              <div className="relative">
                <label className="filter-label">Company</label>
                <input
                  className="filter-input"
                  placeholder="Search company..."
                  value={filters.companySearch}
                  onChange={(e) => handleFilterChange('companySearch', e.target.value)}
                  onFocus={() => setShowCompanySuggestions(true)}
                />
                {showCompanySuggestions && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                    {companySuggestions.map(company => (
                      <div
                        key={company.id}
                        className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                        onClick={() => handleCompanySelect(company)}
                      >
                        <div className="font-semibold text-sm text-gray-900">{company.name}</div>
                        <div className="text-xs text-gray-500 mt-1">Code: {company.code}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="filter-label">Filter by Items</label>
                <Select
                  isMulti
                  options={itemOptions}
                  onChange={(selected) => setItemFilters(selected.map(option => option.value))}
                  placeholder="Select specific items..."
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: '36px',
                      fontSize: '13px',
                      border: '1px solid #e5e7eb',
                      '&:hover': {
                        borderColor: '#3b82f6'
                      }
                    })
                  }}
                />
              </div>
            </div>
            {showAdvancedSearch && (
              <div className="border-t pt-4 space-y-4">
                <div className="filter-grid">
                  <div>
                    <label className="filter-label">Bill Number</label>
                    <input
                      className="filter-input"
                      placeholder="Enter bill #"
                      value={filters.billNumber}
                      onChange={(e) => handleFilterChange('billNumber', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="filter-label">Company Bill #</label>
                    <input
                      className="filter-input"
                      placeholder="Enter company bill #"
                      value={filters.companyBillNumber}
                      onChange={(e) => handleFilterChange('companyBillNumber', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="filter-label">From Date</label>
                    <input
                      type="date"
                      className="filter-input"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="filter-label">To Date</label>
                    <input
                      type="date"
                      className="filter-input"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    />
                  </div>
                </div>
                <div className="filter-grid">
                  <div>
                    <label className="filter-label">Payment Status</label>
                    <select
                      className="filter-input"
                      value={filters.paymentStatus}
                      onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="Unpaid">Unpaid</option>
                      <option value="Cash">Cash</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                  <div>
                    <label className="filter-label">Consignment Status</label>
                    <select
                      className="filter-input"
                      value={filters.consignmentStatus}
                      onChange={(e) => handleFilterChange('consignmentStatus', e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="consignment">تحت صرف (Consignment)</option>
                      <option value="owned">Owned</option>
                    </select>
                  </div>
                  <div>
                    <label className="filter-label">Global Search</label>
                    <input
                      className="filter-input"
                      placeholder="Search by item name or barcode..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bills Table - Scrollable */}
          <div className="table-container">
            <div className="table-scroll-wrapper">
              <table className="purchase-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => requestSort('billNumber')}>
                      BILL #
                    </th>
                    <th className="sortable" onClick={() => requestSort('company')}>
                      COMPANY
                    </th>
                    <th className="sortable" onClick={() => requestSort('date')}>
                      DATE
                    </th>
                    <th className="sortable" onClick={() => requestSort('paymentStatus')}>
                      STATUS
                    </th>
                    <th className="sortable" onClick={() => requestSort('consignment')}>
                      CONSIGNMENT
                    </th>
                    <th>ATTACHMENT</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFilteredBills.map(bill => (
                    <React.Fragment key={bill.billNumber}>
                      <tr
                        onClick={() => toggleBillDetails(bill)}
                        className={selectedBill?.billNumber === bill.billNumber ? 'selected-row' : ''}
                      >
                        <td>
                          <span className="font-medium text-blue-600">#{bill.billNumber}</span>
                        </td>
                        <td>
                          <div className="font-medium">
                            {companies.find(c => c.id === bill.companyId)?.name || 'Unknown Company'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Code: {companies.find(c => c.id === bill.companyId)?.code || 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div className="text-sm text-gray-700">
                            {formatDateToDDMMYYYY(bill.date)}
                          </div>
                        </td>
                        <td>
                          <PaymentStatusBadge status={bill.paymentStatus || "Unpaid"} />
                        </td>
                        <td>
                          <ConsignmentBadge isConsignment={bill.isConsignment} />
                        </td>
                        <td>
                          {bill.attachment ? (
                            <button
                              className="btn-icon btn-view"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAttachmentModal(bill);
                              }}
                            >
                              📎 View
                            </button>
                          ) : (
                            <button
                              className="btn-icon btn-attach"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAttachmentModal(bill);
                              }}
                            >
                              ＋ Attach
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn-icon btn-edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateBill(bill);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-icon btn-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBill(bill.billNumber);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {selectedBill?.billNumber === bill.billNumber && (
                        <tr>
                          <td colSpan="7" className="p-0">
                            <div className="details-panel">
                              <div className="details-content">
                                {/* Bill Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
                                  <h4 className="font-bold text-blue-800 text-lg">
                                    📋 Bill #{bill.billNumber} - Complete Details
                                  </h4>
                                  <div className="text-sm text-gray-600">
                                    Total Items: {bill.items.length} | Currency: {bill.currency || "USD"}
                                  </div>
                                </div>

                                {/* Bill Information Grid */}
                                <div className="info-grid">
                                  <div className="info-item">
                                    <span className="info-label">Company</span>
                                    <span className="info-value company">
                                      {companies.find(c => c.id === bill.companyId)?.name || 'Unknown'} 
                                      ({companies.find(c => c.id === bill.companyId)?.code || 'N/A'})
                                    </span>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Bill Date</span>
                                    <span className="info-value">{formatDateToDDMMYYYY(bill.date)}</span>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Company Bill #</span>
                                    <span className="info-value">{bill.companyBillNumber || 'N/A'}</span>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Branch</span>
                                    <span className="info-value">{bill.branch || 'Slemany'}</span>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Payment Status</span>
                                    <PaymentStatusBadge status={bill.paymentStatus || "Unpaid"} />
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Consignment</span>
                                    <ConsignmentBadge isConsignment={bill.isConsignment} />
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Expense %</span>
                                    <span className="info-value expense">{bill.expensePercentage || 7}%</span>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Transport Fee</span>
                                    <div className="price-display">
                                      {bill.currency === "USD" ? (
                                        <div className="price-usd-display">
                                          ${formatNumber(bill.totalTransportFeeUSD || 0)}
                                        </div>
                                      ) : (
                                        <div className="price-iqd-display">
                                          {formatNumber(bill.totalTransportFeeIQD || 0)} IQD
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="info-item">
                                    <span className="info-label">Other Expenses</span>
                                    <div className="price-display">
                                      {bill.currency === "USD" ? (
                                        <div className="price-usd-display">
                                          ${formatNumber(bill.totalExternalExpenseUSD || 0)}
                                        </div>
                                      ) : (
                                        <div className="price-iqd-display">
                                          {formatNumber(bill.totalExternalExpenseIQD || 0)} IQD
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="info-item" style={{ gridColumn: '1/-1' }}>
                                    <span className="info-label">Bill Notes</span>
                                    <span className="info-value">{bill.billNote || 'No notes'}</span>
                                  </div>
                                </div>

                                {/* Items Table */}
                                <div className="items-table-container">
                                  <h5 className="font-semibold text-gray-700 mb-3 text-sm px-4 pt-4">Items List</h5>
                                  <table className="items-table">
                                    <thead>
                                      <tr>
                                        <th>Barcode</th>
                                        <th>Item Name</th>
                                        <th className="text-center">Qty</th>
                                        <th className="text-right">Base Price</th>
                                        <th className="text-right">Net Price</th>
                                        <th className="text-right">Out Price</th>
                                        <th className="text-center">Expire Date</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {bill.items.map((item, index) => {
                                        const expireDate = formatExpireDate(item.expireDate);
                                        const quantity = item.quantity || 0;
                                        const billCurrency = bill.currency || "USD";

                                        const basePrice = getPurchasePrice(item, billCurrency);
                                        const netPrice = getNetPrice(item, billCurrency);
                                        const outPrice = getOutPrice(item, billCurrency);

                                        return (
                                          <tr key={index}>
                                            <td>
                                              <code className="barcode-cell">{item.barcode}</code>
                                            </td>
                                            <td>{item.name}</td>
                                            <td className="text-center">
                                              <span className="quantity-badge">{quantity}</span>
                                            </td>
                                            <td className="text-right">
                                              <div className="price-display">
                                                <div className="purchase-price">
                                                  {billCurrency === "USD" 
                                                    ? `$${formatNumber(basePrice)}` 
                                                    : `${formatNumber(basePrice)} IQD`}
                                                  <span className={`currency-badge currency-${billCurrency.toLowerCase()}`}>
                                                    {billCurrency}
                                                  </span>
                                                </div>
                                              </div>
                                            </td>
                                            <td className="text-right">
                                              <div className="price-display">
                                                <div className="purchase-price" style={{ color: '#4f46e5', fontWeight: 'bold' }}>
                                                  {billCurrency === "USD" 
                                                    ? `$${formatNumber(netPrice)}` 
                                                    : `${formatNumber(netPrice)} IQD`}
                                                  <span className={`currency-badge currency-${billCurrency.toLowerCase()}`}>
                                                    {billCurrency}
                                                  </span>
                                                </div>
                                              </div>
                                            </td>
                                            <td className="text-right">
                                              <div className="price-display">
                                                <div className="purchase-price" style={{ color: '#059669', fontWeight: 'bold' }}>
                                                  {billCurrency === "USD" 
                                                    ? `$${formatNumber(outPrice)}` 
                                                    : `${formatNumber(outPrice)} IQD`}
                                                  <span className={`currency-badge currency-${billCurrency.toLowerCase()}`}>
                                                    {billCurrency}
                                                  </span>
                                                </div>
                                              </div>
                                            </td>
                                            <td className="text-center">
                                              <span className={`expire-badge ${expireDate === 'N/A' ? 'expire-na' : 'expire-ok'}`}>
                                                {expireDate}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot>
                                      <tr>
                                        <td colSpan="3" className="text-right font-bold">Total:</td>
                                        <td className="text-right font-bold">
                                          <div className="price-display">
                                            {bill.currency === "USD" 
                                              ? `$${formatNumber(bill.items.reduce((total, item) => total + (getPurchasePrice(item, bill.currency) * item.quantity), 0))}`
                                              : `${formatNumber(bill.items.reduce((total, item) => total + (getPurchasePrice(item, bill.currency) * item.quantity), 0))} IQD`}
                                          </div>
                                        </td>
                                        <td className="text-right font-bold">
                                          <div className="price-display" style={{ color: '#4f46e5' }}>
                                            {bill.currency === "USD" 
                                              ? `$${formatNumber(bill.items.reduce((total, item) => total + (getNetPrice(item, bill.currency) * item.quantity), 0))}`
                                              : `${formatNumber(bill.items.reduce((total, item) => total + (getNetPrice(item, bill.currency) * item.quantity), 0))} IQD`}
                                          </div>
                                        </td>
                                        <td className="text-right font-bold">
                                          <div className="price-display" style={{ color: '#059669' }}>
                                            {bill.currency === "USD" 
                                              ? `$${formatNumber(bill.items.reduce((total, item) => total + (getOutPrice(item, bill.currency) * item.quantity), 0))}`
                                              : `${formatNumber(bill.items.reduce((total, item) => total + (getOutPrice(item, bill.currency) * item.quantity), 0))} IQD`}
                                          </div>
                                        </td>
                                        <td></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Empty State */}
          {sortedAndFilteredBills.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <h3 className="empty-state-title">No bills found</h3>
              <p className="empty-state-text">Try adjusting your search filters or create a new purchase bill.</p>
            </div>
          )}

          {/* Attachment Modal */}
          {attachmentModal && (
            <div className="modal-overlay" onClick={(e) => {
              if (e.target === e.currentTarget) closeAttachmentModal();
            }}>
              <div className="modal-content">
                <div className="modal-header">
                  <h3>Bill #{attachmentModal.billNumber} - Attachment</h3>
                  <button onClick={closeAttachmentModal} className="modal-close">
                    <FiX size={20} />
                  </button>
                </div>
                <div className="modal-body">
                  {attachmentPreview ? (
                    <img
                      src={attachmentPreview}
                      alt="Bill Attachment"
                      className="attachment-preview"
                      style={{ filter: 'grayscale(100%)' }}
                      onClick={() => openFullScreen(attachmentPreview)}
                      title="Click to view full screen"
                    />
                  ) : (
                    <div className="attachment-placeholder">
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📎</div>
                      <div>No attachment yet</div>
                      <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', color: '#d1d5db' }}>
                        Upload an image or take a photo
                      </div>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="file-input"
                  />
                  <button onClick={triggerFileInput} className="file-upload-btn">
                    <FiImage style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Choose File from Device
                  </button>

                  <button onClick={handleCameraCapture} className="file-upload-btn" style={{ background: '#10b981', color: 'white', border: 'none' }}>
                    <FiCamera style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Take Photo with Camera
                  </button>

                  <input
                    type="file"
                    ref={cameraInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    capture="environment"
                    className="file-input"
                  />

                  <div className="modal-actions">
                    <button
                      onClick={removeAttachment}
                      className="modal-btn modal-btn-remove"
                      disabled={!attachmentModal.attachment && !attachmentPreview}
                    >
                      <FiX size={14} />
                      Remove
                    </button>
                    <button
                      onClick={closeAttachmentModal}
                      className="modal-btn modal-btn-cancel"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveAttachment}
                      className="modal-btn modal-btn-save"
                      disabled={!attachmentPreview || attachmentPreview === attachmentModal.attachment}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full Screen Image Viewer */}
          {fullScreenImage && (
            <div className="fullscreen-overlay" onClick={(e) => {
              if (e.target === e.currentTarget) closeFullScreen();
            }}>
              <div className="fullscreen-content">
                <img
                  src={fullScreenImage}
                  alt="Full screen attachment"
                  className="fullscreen-image"
                />
                <div className="fullscreen-actions">
                  <button
                    onClick={closeFullScreen}
                    className="fullscreen-btn fullscreen-btn-close"
                  >
                    <FiX size={18} />
                    Close
                  </button>
                  <button
                    onClick={() => downloadImage(fullScreenImage)}
                    className="fullscreen-btn fullscreen-btn-download"
                  >
                    <FiDownload size={18} />
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}