"use client";
import { useState, useEffect, useRef } from "react";
import React from 'react';
import { getBoughtBills, getCompanies, deleteBoughtBill, formatDate, updateBoughtBill } from "@/lib/data";
import Card from "./Card";
import { useRouter } from "next/navigation";
import Select from "react-select";

// Helper function to format numbers
const formatNumber = (number) => {
  if (!number && number !== 0) return '0';
  return new Intl.NumberFormat('en-US').format(number);
};

// Helper function to format date to DD/MM/YYYY
const formatDateToDDMMYYYY = (date) => {
  if (!date) return 'N/A';

  // Handle Firestore Timestamp
  if (date.toDate) {
    const d = date.toDate();
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Handle Date object
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return 'N/A';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Handle string date (YYYY-MM-DD or other formats)
  if (typeof date === 'string') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Handle timestamp with seconds
  if (date.seconds) {
    const d = new Date(date.seconds * 1000);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return 'N/A';
};

// Helper function to parse any date format
const parseDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue.toDate) {
    return dateValue.toDate();
  } else if (dateValue.seconds) {
    return new Date(dateValue.seconds * 1000);
  } else if (typeof dateValue === 'string') {
    if (dateValue.includes('/')) {
      const [day, month, year] = dateValue.split('/');
      return new Date(year, month - 1, day);
    }
    return new Date(dateValue);
  } else if (dateValue instanceof Date) {
    return dateValue;
  }
  return null;
};

// Helper function to convert date to YYYY-MM-DD format for input fields
const formatDateForInput = (date) => {
  if (!date) return '';

  let dateObj;

  // Handle different date formats
  if (date.toDate) {
    dateObj = date.toDate();
  } else if (date.seconds) {
    dateObj = new Date(date.seconds * 1000);
  } else if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    if (date.includes('/')) {
      const [day, month, year] = date.split('/');
      dateObj = new Date(year, month - 1, day);
    } else {
      dateObj = new Date(date);
    }
  } else {
    return '';
  }

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
  const [imagePreview, setImagePreview] = useState(null);
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

  const handleUpdateBill = async (bill) => {
    try {
      const company = companies.find(c => c.id === bill.companyId);
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
        billNote: bill.billNote || "",
        totalTransportFee: bill.totalTransportFee || 0,
        totalExternalExpense: bill.totalExternalExpense || 0,
        items: bill.items.map(item => ({
          ...item,
          basePrice: item.basePrice || item.netPrice || 0,
          expireDate: item.expireDate ? formatDateForInput(item.expireDate) : "",
          pharmacyPrice: item.outPricePharmacy || item.outPrice || 0,
          storePrice: item.outPriceStore || item.outPrice || 0,
          otherPrice: item.outPriceOther || item.outPrice || 0,
          costRatio: item.costRatio || 0,
          finalCostPerPiece: item.netPrice || 0
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
    setImagePreview(bill.attachment || null);
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

  const saveAttachment = async () => {
    if (!imagePreview || !attachmentModal) return;
    try {
      await updateBoughtBill(attachmentModal.billNumber, {
        attachment: imagePreview,
        attachmentDate: new Date().toISOString()
      });
      setBills(bills.map(bill =>
        bill.billNumber === attachmentModal.billNumber ?
        {...bill, attachment: imagePreview} : bill
      ));
      closeAttachmentModal();
      alert('Attachment saved successfully!');
    } catch (error) {
      console.error('Error saving attachment:', error);
      alert('Failed to save attachment. Please try again.');
    }
  };

  const removeAttachment = async () => {
    if (!attachmentModal) return;
    try {
      await updateBoughtBill(attachmentModal.billNumber, {
        attachment: null,
        attachmentDate: null
      });
      setBills(bills.map(bill =>
        bill.billNumber === attachmentModal.billNumber ?
        {...bill, attachment: null} : bill
      ));
      setImagePreview(null);
      alert('Attachment removed successfully!');
    } catch (error) {
      console.error('Error removing attachment:', error);
      alert('Failed to remove attachment. Please try again.');
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
          return "status-badge-paid";
        case "Unpaid":
          return "status-badge-unpaid";
        default:
          return "status-badge-unpaid";
      }
    };
    return (
      <span className={`status-badge ${getStatusStyles()}`}>
        {status}
      </span>
    );
  };

  const ConsignmentBadge = ({ isConsignment }) => {
    return (
      <span className={`status-badge ${isConsignment ? "status-badge-consignment" : "status-badge-owned"}`}>
        {isConsignment ? "تحت صرف" : "Owned"}
      </span>
    );
  };

  return (
    <Card title="Purchase History">
      {/* Search Filters Section */}
      <div className="card mb-6 border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-700 text-lg">Search Filters</h3>
          <button
            type="button"
            className="btn btn-secondary text-xs py-0.5 px-2"
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          >
            {showAdvancedSearch ? "Hide Advance Search" : "Advance Search"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <label className="label">Company</label>
            <input
              className="payment-input"
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
            <label className="label">Filter by Items</label>
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
                  border: '1px solid var(--border)',
                  '&:hover': {
                    borderColor: 'var(--primary)'
                  }
                })
              }}
            />
          </div>
        </div>
        {showAdvancedSearch && (
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="label">Bill Number</label>
                <input
                  className="payment-input"
                  placeholder="Enter bill #"
                  value={filters.billNumber}
                  onChange={(e) => handleFilterChange('billNumber', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Company Bill #</label>
                <input
                  className="payment-input"
                  placeholder="Enter company bill #"
                  value={filters.companyBillNumber}
                  onChange={(e) => handleFilterChange('companyBillNumber', e.target.value)}
                />
              </div>
              <div>
                <label className="label">From Date</label>
                <input
                  type="date"
                  className="payment-input"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
              <div>
                <label className="label">To Date</label>
                <input
                  type="date"
                  className="payment-input"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Payment Status</label>
                <select
                  className="payment-select"
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
                <label className="label">Consignment Status</label>
                <select
                  className="payment-select"
                  value={filters.consignmentStatus}
                  onChange={(e) => handleFilterChange('consignmentStatus', e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="consignment">تحت صرف (Consignment)</option>
                  <option value="owned">Owned</option>
                </select>
              </div>
              <div>
                <label className="label">Global Search</label>
                <input
                  className="payment-input"
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
        <table className="table">
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
                  className={`cursor-pointer fade-in ${
                    selectedBill?.billNumber === bill.billNumber ?
                    'bg-blue-50 border-l-4 border-blue-500' :
                    ''
                  }`}
                >
                  <td>
                    <span className="font-bold text-blue-600">#{bill.billNumber}</span>
                  </td>
                  <td>
                    <div className="font-semibold text-gray-900">
                      {companies.find(c => c.id === bill.companyId)?.name || 'Unknown Company'}
                    </div>
                  </td>
                  <td>
                    <div className="text-gray-600 font-medium">
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
                        className="btn btn-success text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAttachmentModal(bill);
                        }}
                      >
                        📎 View
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary text-xs"
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
                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateBill(bill);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger text-xs"
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
                      <div className="p-6 bg-blue-50 border-t border-blue-200">
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="font-bold text-blue-800 text-lg">
                            📋 Bill #{bill.billNumber} - Complete Details
                          </h4>
                          <div className="text-sm text-gray-600">
                            Total Items: {bill.items.length}
                          </div>
                        </div>
                        {/* Bill Header Information */}
                        <div style={{background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden'}}>
  <table style={{width: '100%', borderCollapse: 'collapse'}}>
    <tbody>
      <tr style={{borderBottom: '1px solid #f1f5f9'}}>
        <td style={{padding: '12px 16px', fontWeight: 600, color: '#475569', width: '25%'}}>Company</td>
        <td style={{padding: '12px 16px', color: '#2563eb'}}>{companies.find(c => c.id === bill.companyId)?.name || 'Unknown'} ({companies.find(c => c.id === bill.companyId)?.code || 'N/A'})</td>
      </tr>

      <tr style={{borderBottom: '1px solid #f1f5f9'}}>
        <td style={{padding: '12px 16px', fontWeight: 600, color: '#475569'}}>Bill Date</td>
        <td style={{padding: '12px 16px', color: '#64748b'}}>{formatDateToDDMMYYYY(bill.date)}</td>
      </tr>
      <tr style={{borderBottom: '1px solid #f1f5f9'}}>
        <td style={{padding: '12px 16px', fontWeight: 600, color: '#475569'}}>Company Bill #</td>
        <td style={{padding: '12px 16px', color: '#64748b'}}>{bill.companyBillNumber || 'N/A'}</td>
      </tr>
      <tr style={{borderBottom: '1px solid #f1f5f9'}}>
        <td style={{padding: '12px 16px', fontWeight: 600, color: '#475569'}}>Branch</td>
        <td style={{padding: '12px 16px', color: '#64748b'}}>{bill.branch || 'Slemany'}</td>
      </tr>
      <tr style={{borderBottom: '1px solid #f1f5f9'}}>
        <td style={{padding: '12px 16px', fontWeight: 600, color: '#475569'}}>Payment Status</td>
        <td style={{padding: '12px 16px'}}><PaymentStatusBadge status={bill.paymentStatus || "Unpaid"} /></td>
      </tr>
      <tr style={{borderBottom: '1px solid #f1f5f9'}}>
        <td style={{padding: '12px 16px', fontWeight: 600, color: '#475569'}}>Consignment</td>
        <td style={{padding: '12px 16px'}}><ConsignmentBadge isConsignment={bill.isConsignment} /></td>
      </tr>
      <tr>
        <td style={{padding: '12px 16px', fontWeight: 600, color: '#475569'}}>Expense %</td>
        <td style={{padding: '12px 16px', color: '#16a34a', fontWeight: 700}}>{bill.expensePercentage || 7}%</td>
      </tr>
      <tr>
        <td className="text-red-600" style={{padding: '12px 16px', fontWeight: 600, }}>Transport Fee:</td>
        <td className="text-red-600" style={{padding: '12px 16px',  fontWeight: 700}}>{formatNumber(bill.totalTransportFee || 0)} IQD</td>
      </tr>
      <tr>
        <td className="text-red-600" style={{padding: '12px 16px', fontWeight: 600, }}>Other Expenses:</td>
        <td className="text-red-600" style={{padding: '12px 16px',  fontWeight: 700}}>{formatNumber(bill.totalExternalExpense || 0)} IQD</td>
      </tr>
      <tr>
        <td  style={{padding: '12px 16px', fontWeight: 600, color: '#475569'}}>Bill Notes</td>
        <td  style={{padding: '12px 16px',  fontWeight: 700}}>{bill.billNote}</td>
      </tr>
      <tr>
        <td  style={{padding: '12px 16px', fontWeight: 600, color: '#475569'}}>Store Price</td>
        <td  style={{padding: '12px 16px',  fontWeight: 700}}>{bill.storePrice}</td>
      </tr>
      <tr>
        <td  style={{padding: '12px 16px', fontWeight: 600, color: '#475569'}}>Pharmacy Price</td>
        <td  style={{padding: '12px 16px',  fontWeight: 700}}>{bill.pharmacyPrice}</td>
      </tr>
      <tr>
        <td  style={{padding: '12px 16px', fontWeight: 600, color: '#475569'}}>Other Price</td>
        <td  style={{padding: '12px 16px',  fontWeight: 700}}>{bill.otherPrice}</td>
      </tr>
    </tbody>
  </table>
</div>
                
      
                        {/* Items Table */}
                        <div className="overflow-x-auto mb-6">
                            <table className="table min-w-full bg-white rounded-lg border">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="whitespace-nowrap p-3 text-left font-semibold">Barcode</th>
                                  <th className="whitespace-nowrap p-3 text-left font-semibold">Item Name</th>
                                  <th className="whitespace-nowrap p-1 text-center font-semibold">Quantity</th>
                                  <th className="whitespace-nowrap p-3 text-left font-semibold">Base Price</th>
                                  <th className="whitespace-nowrap p-3 text-left font-semibold">Subtotal</th>
                                  <th className="whitespace-nowrap p-3 text-left font-semibold">Net Price</th>
                                  <th className="whitespace-nowrap p-3 text-left font-semibold">Expire Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bill.items.map((item, index) => {
                                  const expireDate = item.expireDate ? formatDateToDDMMYYYY(item.expireDate) : "N/A";
                                  const basePrice = item.basePrice || item.netPrice || 0;
                                  const quantity = item.quantity || 0;
                                  const subtotal = basePrice * quantity;
                                  
                                  return (
                                    <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
  <td className="whitespace-nowrap p-2">
    <code className="bg-blue-50 px-2 py-1 rounded text-xs font-mono text-blue-700 border">
      {item.barcode}
    </code>
  </td>
  <td className="whitespace-nowrap p-2 font-medium text-gray-900 text-sm">
    {item.name}
  </td>
  <td className="whitespace-nowrap p-2 text-center">
    <span className="inline-flex items-center justify-center w-7 h-7 bg-green-100 text-green-800 rounded-full font-bold text-xs">
      {quantity}
    </span>
  </td>
  <td className="whitespace-nowrap p-2 text-left font-bold text-blue-700 text-sm">
    {formatNumber(basePrice)}
  </td>
  <td className="whitespace-nowrap p-2 text-left font-bold text-purple-700 text-sm">
    {formatNumber(subtotal)}
  </td>
  <td className="whitespace-nowrap p-2 text-left font-bold text-green-700 text-sm">
    {formatNumber(item.netPrice || 0)}
  </td>
  <td className="whitespace-nowrap p-2 text-center">
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      !item.expireDate || item.expireDate === 'N/A'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-green-100 text-green-800'
    }`}>
      {item.expireDate}
    </span>
  </td>
</tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                <tr>
                                  <td colSpan="4" className="whitespace-nowrap p-3 text-right font-bold text-gray-700">
                                    Total:
                                  </td>
                                  <td className="whitespace-nowrap p-3 text-left font-bold text-xl text-purple-700">
                                    {formatNumber(bill.items.reduce((total, item) => {
                                      const basePrice = item.basePrice || item.netPrice || 0;
                                      const quantity = item.quantity || 0;
                                      return total + (basePrice * quantity);
                                    }, 0))}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                          <button
                            className="btn btn-primary flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateBill(bill);
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Bill
                          </button>
                          <button
                            className="btn btn-secondary flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAttachmentModal(bill);
                            }}
                          >
                            {bill.attachment ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                Manage Attachment
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Add Attachment
                              </>
                            )}
                          </button>
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
          <div className="text-gray-400 text-6xl mb-4">📦</div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No bills found</h3>
          <p className="text-gray-500">Try adjusting your search filters or create a new purchase bill.</p>
        </div>
      )}

      {/* Attachment Modal */}
      {attachmentModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                Bill #{attachmentModal.billNumber} - Attachment
              </h3>
              <button
                onClick={closeAttachmentModal}
                className="modal-close-btn"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {imagePreview ? (
                <div className="mb-6">
                  <img
                    src={imagePreview}
                    alt="Bill Attachment"
                    className="w-full h-64 object-contain border-2 border-gray-200 rounded-lg shadow-inner"
                  />
                  <div className="text-center mt-3 text-sm text-green-600 font-medium">
                    ✅ Current Attachment Preview
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg mb-6">
                  <div className="text-4xl mb-2">📎</div>
                  <div>No attachment yet</div>
                </div>
              )}
              <div className="space-y-4 mb-6">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={triggerFileInput}
                  className="payment-btn payment-btn-secondary w-full"
                >
                  📁 Choose File from Device
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={removeAttachment}
                  className="payment-btn payment-btn-danger flex-1"
                  disabled={!attachmentModal.attachment}
                >
                  Remove
                </button>
                <button
                  onClick={closeAttachmentModal}
                  className="payment-btn payment-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAttachment}
                  className="payment-btn payment-btn-primary flex-1"
                  disabled={!imagePreview}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
