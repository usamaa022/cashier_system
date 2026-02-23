"use client";
import { useState, useEffect, useRef } from "react";
import React from 'react';
import { getBoughtBills, getCompanies, deleteBoughtBill, updateBoughtBill } from "@/lib/data";
import Card from "./Card";
import { useRouter } from "next/navigation";
import Select from "react-select";

// Helper function to format numbers with decimals
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

// Helper function to format date to DD/MM/YYYY
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

// Helper function to format date for display in table cells
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

// Helper function to parse any date format
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

// Helper function to convert date to YYYY-MM-DD format for input fields
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
  const fileInputRef = useRef(null);
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
    setFilters({...filters, [field]: value});
  };

  const handleCompanySelect = (company) => {
    setFilters({...filters, companySearch: company.name, companyId: company.id});
    setShowCompanySuggestions(false);
  };

  const itemOptions = availableItems.map(item => ({
    value: item,
    label: item
  }));

  const filteredBills = bills.filter(bill => {
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

  const formatPrice = (item, priceField = 'outPrice') => {
    if (!item) return '0';
    const exchangeRate = item.exchangeRate || 1500;
    const priceUSD = item[`${priceField}USD`] || item[priceField] / exchangeRate || 0;
    const priceIQD = item[priceField] || priceUSD * exchangeRate || 0;
    if (displayCurrency === "USD") return `$${formatNumber(priceUSD)}`;
    else return `${formatNumber(priceIQD)} IQD`;
  };

  const formatTotalPrice = (priceUSD, exchangeRate = 1500) => {
    if (displayCurrency === "USD") return `$${formatNumber(priceUSD)}`;
    else return `${formatNumber(priceUSD * exchangeRate)} IQD`;
  };

  const handleUpdateBill = async (bill) => {
    try {
      const company = companies.find(c => c.id === bill.companyId);
      const exchangeRate = bill.exchangeRate || 1500;
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
        billNote: bill.billNote || "",
        totalTransportFeeUSD: bill.totalTransportFeeUSD || (bill.totalTransportFee ? bill.totalTransportFee / exchangeRate : 0),
        totalExternalExpenseUSD: bill.totalExternalExpenseUSD || (bill.totalExternalExpense ? bill.totalExternalExpense / exchangeRate : 0),
        items: bill.items.map(item => ({
          ...item,
          basePriceUSD: item.basePriceUSD || (item.basePrice ? item.basePrice / exchangeRate : 0),
          basePrice: item.basePrice || item.basePriceUSD * exchangeRate || 0,
          outPriceUSD: item.outPriceUSD || (item.outPrice ? item.outPrice / exchangeRate : 0),
          outPrice: item.outPrice || item.outPriceUSD * exchangeRate || 0,
          expireDate: item.expireDate ? formatDateForInput(item.expireDate) : "",
          costRatio: item.costRatio || 0,
        }))
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

  const saveAttachment = async () => {
    if (!attachmentPreview || !attachmentModal) return;
    try {
      await updateBoughtBill(attachmentModal.billNumber, {
        attachment: attachmentPreview,
        attachmentDate: new Date().toISOString()
      });
      
      setBills(bills.map(bill =>
        bill.billNumber === attachmentModal.billNumber ?
        {...bill, attachment: attachmentPreview} : bill
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
          {...bill, attachment: null} : bill
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
          return "badge badge-success";
        case "Unpaid":
          return "badge badge-warning";
        default:
          return "badge badge-warning";
      }
    };
    return (
      <span className={getStatusStyles()}>
        {status}
      </span>
    );
  };

  const ConsignmentBadge = ({ isConsignment }) => {
    return (
      <span className={`badge ${isConsignment ? "badge-consignment" : "badge-owned"}`}>
        {isConsignment ? "تحت صرف" : "Owned"}
      </span>
    );
  };

  const toggleCurrency = () => {
    setDisplayCurrency(prev => prev === "USD" ? "IQD" : "USD");
  };

  // Function to calculate cost price (base price + expenses)
  const calculateCostPrice = (item, bill) => {
    const basePrice = item.basePriceUSD || (item.basePrice ? item.basePrice / (bill.exchangeRate || 1500) : 0);
    
    // If it's consignment, cost is 0 (we don't own it yet)
    if (bill.isConsignment) {
      return 0;
    }
    
    // Calculate expenses per item based on cost ratio
    const totalBaseCost = bill.items.reduce((sum, i) => sum + ((i.basePriceUSD || 0) * (i.quantity || 0)), 0);
    const itemBaseCost = (item.basePriceUSD || 0) * (item.quantity || 0);
    const itemRatio = totalBaseCost > 0 ? itemBaseCost / totalBaseCost : 0;
    
    const transportPerItem = ((bill.totalTransportFeeUSD || 0) * itemRatio) / (item.quantity || 1);
    const externalExpensePerItem = ((bill.totalExternalExpenseUSD || 0) * itemRatio) / (item.quantity || 1);
    
    // Cost price = base price + (expense% of base price) + transport + external expenses
    const expenseAmount = basePrice * ((bill.expensePercentage || 7) / 100);
    const costPrice = basePrice + expenseAmount + transportPerItem + externalExpensePerItem;
    
    return costPrice;
  };

  return (
    <>
      <style jsx global>{`
        /* Table Container Styles */
        .table-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          margin-top: 1rem;
        }

        /* Main Table Styles */
        .purchase-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 0.9rem;
        }

        .purchase-table thead tr {
          background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
          border-bottom: 2px solid #e2e8f0;
        }

        .purchase-table th {
          padding: 1rem 1rem;
          font-weight: 600;
          color: #1e293b;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          white-space: nowrap;
          border-bottom: 2px solid #e2e8f0;
          position: relative;
        }

        .purchase-table th:after {
          content: '';
          position: absolute;
          right: 0;
          top: 25%;
          height: 50%;
          width: 1px;
          background: linear-gradient(to bottom, transparent, #cbd5e1, transparent);
        }

        .purchase-table th:last-child:after {
          display: none;
        }

        .purchase-table td {
          padding: 1rem 1rem;
          color: #334155;
          border-bottom: 1px solid #e2e8f0;
          transition: all 0.2s ease;
        }

        .purchase-table tbody tr {
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .purchase-table tbody tr:hover {
          background-color: #f8fafc;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .purchase-table tbody tr.selected-row {
          background: linear-gradient(to right, #eff6ff, #ffffff);
          border-left: 4px solid #3b82f6;
        }

        /* Bill Number Styles */
        .bill-number {
          font-weight: 700;
          color: #2563eb;
          background: #eff6ff;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.85rem;
          display: inline-block;
          border: 1px solid #bfdbfe;
        }

        /* Company Name Styles */
        .company-name {
          font-weight: 600;
          color: #0f172a;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .company-code {
          font-size: 0.7rem;
          color: #64748b;
          font-weight: normal;
        }

        /* Date Styles */
        .date-cell {
          font-family: 'Courier New', monospace;
          font-weight: 500;
          color: #475569;
        }

        /* Badge Styles */
        .badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .badge-success {
          background: linear-gradient(to bottom, #dcfce7, #bbf7d0);
          color: #166534;
          border: 1px solid #86efac;
        }

        .badge-warning {
          background: linear-gradient(to bottom, #fef9c3, #fef08a);
          color: #854d0e;
          border: 1px solid #facc15;
        }

        .badge-consignment {
          background: linear-gradient(to bottom, #f3e8ff, #e9d5ff);
          color: #6b21a8;
          border: 1px solid #c084fc;
        }

        .badge-owned {
          background: linear-gradient(to bottom, #dcfce7, #bbf7d0);
          color: #166534;
          border: 1px solid #4ade80;
        }

        /* Action Button Styles */
        .action-buttons {
          display: flex;
          gap: 0.375rem;
          flex-wrap: wrap;
        }

        .btn-icon {
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-size: 0.7rem;
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
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .btn-edit {
          background: #eff6ff;
          color: #1e40af;
          border-color: #bfdbfe;
        }

        .btn-edit:hover {
          background: #dbeafe;
        }

        .btn-delete {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .btn-delete:hover {
          background: #fee2e2;
        }

        .btn-attach {
          background: #f1f5f9;
          color: #334155;
          border-color: #cbd5e1;
        }

        .btn-attach:hover {
          background: #e2e8f0;
        }

        .btn-view {
          background: #f0fdf4;
          color: #166534;
          border-color: #86efac;
        }

        .btn-view:hover {
          background: #dcfce7;
        }

        /* Expanded Details Panel */
        .details-panel {
          background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
          border-top: 2px solid #3b82f6;
          border-bottom: 1px solid #e2e8f0;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .details-content {
          padding: 1.5rem;
        }

        /* Info Grid */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
          margin-bottom: 1.5rem;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .info-label {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #64748b;
        }

        .info-value {
          font-size: 1rem;
          font-weight: 600;
          color: #0f172a;
        }

        .info-value.company {
          color: #2563eb;
        }

        .info-value.expense {
          color: #16a34a;
        }

        .info-value.transport {
          color: #dc2626;
        }

        /* Items Table inside Details */
        .items-table-container {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          margin: 1rem 0;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .items-table th {
          background: #f8fafc;
          padding: 0.75rem 1rem;
          font-weight: 600;
          color: #334155;
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.03em;
          border-bottom: 2px solid #e2e8f0;
        }

        .items-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e2e8f0;
          color: #1e293b;
        }

        .items-table tbody tr:hover {
          background: #f8fafc;
        }

        .items-table tfoot {
          background: #f8fafc;
          font-weight: 600;
        }

        .barcode-cell {
          font-family: 'Courier New', monospace;
          background: #f1f5f9;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          color: #2563eb;
        }

        .quantity-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          background: #f1f5f9;
          color: #0f172a;
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

        .expire-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.7rem;
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
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .filter-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .filter-header h3 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #0f172a;
          margin: 0;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
        }

        .filter-input {
          width: 100%;
          padding: 0.625rem;
          border: 1px solid #e2e8f0;
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
          font-size: 0.8rem;
          font-weight: 500;
          color: #475569;
          margin-bottom: 0.25rem;
        }

        /* Currency Toggle */
        .currency-toggle {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 1rem;
        }

        .currency-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .currency-button:hover {
          background: #dbeafe;
          transform: translateY(-1px);
        }

        .currency-button svg {
          width: 1rem;
          height: 1rem;
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
          border-bottom: 1px solid #e2e8f0;
          padding: 1rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }

        .modal-header h3 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #0f172a;
          margin: 0;
        }

        .modal-close {
          color: #94a3b8;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .modal-close svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .modal-close:hover {
          color: #475569;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .attachment-preview {
          width: 100%;
          height: 200px;
          object-fit: contain;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          margin-bottom: 1rem;
          background: #f8fafc;
        }

        .attachment-placeholder {
          text-align: center;
          padding: 2rem;
          border: 2px dashed #e2e8f0;
          border-radius: 8px;
          color: #94a3b8;
          margin-bottom: 1rem;
        }

        .attachment-placeholder .icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .modal-actions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .modal-btn {
          padding: 0.625rem;
          border-radius: 8px;
          font-weight: 500;
          font-size: 0.9rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
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
          background: #64748b;
          color: white;
        }

        .modal-btn-cancel:hover {
          background: #475569;
        }

        .modal-btn-save {
          background: #3b82f6;
          color: white;
        }

        .modal-btn-save:hover:not(:disabled) {
          background: #2563eb;
        }

        .file-input {
          display: none;
        }

        .file-upload-btn {
          width: 100%;
          padding: 0.625rem;
          background: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 1rem;
        }

        .file-upload-btn:hover {
          background: #e2e8f0;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 3rem;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .empty-state-icon {
          font-size: 3rem;
          color: #cbd5e1;
          margin-bottom: 1rem;
        }

        .empty-state-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #475569;
          margin-bottom: 0.5rem;
        }

        .empty-state-text {
          color: #64748b;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .purchase-table {
            font-size: 0.8rem;
          }
          
          .purchase-table th,
          .purchase-table td {
            padding: 0.75rem 0.5rem;
          }
          
          .info-grid {
            grid-template-columns: 1fr;
          }
          
          .action-buttons {
            flex-direction: column;
          }
          
          .modal-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <Card title="Purchase History">
        {/* Currency Toggle */}
        <div className="currency-toggle">
          <button onClick={toggleCurrency} className="currency-button">
            <span>Show in {displayCurrency === "USD" ? "IQD" : "USD"}</span>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
        </div>

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
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
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
                    minHeight: '42px',
                    fontSize: '14px',
                    border: '1px solid #e2e8f0',
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

        {/* Bills Table */}
        <div className="table-container">
          <table className="purchase-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Company</th>
                <th>Date</th>
                <th>Status</th>
                <th>Consignment</th>
                <th>Attachment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(bill => (
                <React.Fragment key={bill.billNumber}>
                  <tr
                    onClick={() => toggleBillDetails(bill)}
                    className={selectedBill?.billNumber === bill.billNumber ? 'selected-row' : ''}
                  >
                    <td>
                      <span className="bill-number">#{bill.billNumber}</span>
                    </td>
                    <td>
                      <div className="company-name">
                        {companies.find(c => c.id === bill.companyId)?.name || 'Unknown Company'}
                        <span className="company-code">
                          Code: {companies.find(c => c.id === bill.companyId)?.code || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="date-cell">{formatDateToDDMMYYYY(bill.date)}</td>
                    <td><PaymentStatusBadge status={bill.paymentStatus || "Unpaid"} /></td>
                    <td><ConsignmentBadge isConsignment={bill.isConsignment} /></td>
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
                                Total Items: {bill.items.length} | Exchange Rate: {bill.exchangeRate || 1500} IQD/USD
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
                                <span className="info-value transport">
                                  {formatTotalPrice(bill.totalTransportFeeUSD || (bill.totalTransportFee ? bill.totalTransportFee / (bill.exchangeRate || 1500) : 0), bill.exchangeRate)}
                                </span>
                              </div>
                              <div className="info-item">
                                <span className="info-label">Other Expenses</span>
                                <span className="info-value transport">
                                  {formatTotalPrice(bill.totalExternalExpenseUSD || (bill.totalExternalExpense ? bill.totalExternalExpense / (bill.exchangeRate || 1500) : 0), bill.exchangeRate)}
                                </span>
                              </div>
                              <div className="info-item" style={{ gridColumn: '1/-1' }}>
                                <span className="info-label">Bill Notes</span>
                                <span className="info-value">{bill.billNote || 'No notes'}</span>
                              </div>
                            </div>

                            {/* Items Table - Simplified with only Out Price */}
                            <div className="items-table-container">
                              <h5 className="font-semibold text-gray-700 mb-3 text-sm px-4 pt-4">Items List</h5>
                              <table className="items-table">
                                <thead>
                                  <tr>
                                    <th>Barcode</th>
                                    <th>Item Name</th>
                                    <th className="text-center">Qty</th>
                                    <th className="text-right">Base Price</th>
                                    <th className="text-right">Cost Price</th>
                                    <th className="text-right">Subtotal</th>
                                    <th className="text-right">Out Price</th>
                                    <th className="text-center">Expire Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bill.items.map((item, index) => {
                                    const expireDate = formatExpireDate(item.expireDate);
                                    const basePriceUSD = item.basePriceUSD || (item.basePrice ? item.basePrice / (bill.exchangeRate || 1500) : 0);
                                    const basePriceIQD = item.basePrice || basePriceUSD * (bill.exchangeRate || 1500);
                                    const outPriceUSD = item.outPriceUSD || (item.outPrice ? item.outPrice / (bill.exchangeRate || 1500) : 0);
                                    const outPriceIQD = item.outPrice || outPriceUSD * (bill.exchangeRate || 1500);
                                    const quantity = item.quantity || 0;
                                    
                                    // Calculate cost price
                                    const costPriceUSD = calculateCostPrice(item, bill);
                                    const costPriceIQD = costPriceUSD * (bill.exchangeRate || 1500);
                                    
                                    const subtotalUSD = basePriceUSD * quantity;
                                    const subtotalIQD = basePriceIQD * quantity;

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
                                          {displayCurrency === "USD" ? (
                                            <span className="price-usd">${formatNumber(basePriceUSD)}</span>
                                          ) : (
                                            <span className="price-iqd">{formatNumber(basePriceIQD)} IQD</span>
                                          )}
                                        </td>
                                        <td className="text-right">
                                          {bill.isConsignment ? (
                                            <span className="cost-price">-</span>
                                          ) : (
                                            displayCurrency === "USD" ? (
                                              <span className="cost-price">${formatNumber(costPriceUSD)}</span>
                                            ) : (
                                              <span className="cost-price">{formatNumber(costPriceIQD)} IQD</span>
                                            )
                                          )}
                                        </td>
                                        <td className="text-right">
                                          {displayCurrency === "USD" ? (
                                            <span className="price-usd">${formatNumber(subtotalUSD)}</span>
                                          ) : (
                                            <span className="price-iqd">{formatNumber(subtotalIQD)} IQD</span>
                                          )}
                                        </td>
                                        <td className="text-right">
                                          {displayCurrency === "USD" ? (
                                            <span className="price-usd">${formatNumber(outPriceUSD)}</span>
                                          ) : (
                                            <span className="price-iqd">{formatNumber(outPriceIQD)} IQD</span>
                                          )}
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
                                    <td colSpan="5" className="text-right font-bold">Total:</td>
                                    <td className="text-right font-bold">
                                      {displayCurrency === "USD" ? (
                                        <span className="price-usd">
                                          ${formatNumber(bill.items.reduce((total, item) => {
                                            const basePriceUSD = item.basePriceUSD || (item.basePrice ? item.basePrice / (bill.exchangeRate || 1500) : 0);
                                            return total + (basePriceUSD * (item.quantity || 0));
                                          }, 0))}
                                        </span>
                                      ) : (
                                        <span className="price-iqd">
                                          {formatNumber(bill.items.reduce((total, item) => {
                                            const basePriceIQD = item.basePrice || (item.basePriceUSD ? item.basePriceUSD * (bill.exchangeRate || 1500) : 0);
                                            return total + (basePriceIQD * (item.quantity || 0));
                                          }, 0))} IQD
                                        </span>
                                      )}
                                    </td>
                                    <td colSpan="2"></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            {/* Action Buttons */}
                            {/* <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
                              <button
                                className="btn-icon btn-edit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateBill(bill);
                                }}
                              >
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Bill
                              </button>
                              <button
                                className="btn-icon btn-attach"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAttachmentModal(bill);
                                }}
                              >
                                {bill.attachment ? (
                                  <>
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    Manage Attachment
                                  </>
                                ) : (
                                  <>
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Add Attachment
                                  </>
                                )}
                              </button>
                            </div> */}
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

        {/* Empty State */}
        {filteredBills.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3 className="empty-state-title">No bills found</h3>
            <p className="empty-state-text">Try adjusting your search filters or create a new purchase bill.</p>
          </div>
        )}

        {/* Attachment Modal */}
        {attachmentModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Bill #{attachmentModal.billNumber} - Attachment</h3>
                <button onClick={closeAttachmentModal} className="modal-close">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                {attachmentPreview ? (
                  <img
                    src={attachmentPreview}
                    alt="Bill Attachment"
                    className="attachment-preview"
                    style={{ filter: 'grayscale(100%)' }}
                  />
                ) : (
                  <div className="attachment-placeholder">
                    <div className="icon">📎</div>
                    <div>No attachment yet</div>
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
                  📁 Choose File from Device
                </button>

                <div className="modal-actions">
                  <button
                    onClick={removeAttachment}
                    className="modal-btn modal-btn-remove"
                    disabled={!attachmentModal.attachment && !attachmentPreview}
                  >
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
      </Card>
    </>
  );
}