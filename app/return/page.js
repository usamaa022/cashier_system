"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import {
  getAllReturns,
  getPharmacies,
  getSoldBills,
  returnItemsToStore,
  deleteReturnBillAndRestoreToSale,
  updateReturnItems,
  getReturnById,
  getFilteredReturns,
  getUsers
} from "@/lib/data";
import Select from "react-select";
import * as XLSX from 'xlsx';
import {
  FaPrint, FaEdit, FaTrash, FaCheck, FaTimes, FaRedo,
  FaFileInvoice, FaBuilding, FaFilter, FaDollarSign,
  FaBox, FaBarcode, FaStickyNote, FaStore, FaClipboardList,
  FaSort, FaSortUp, FaSortDown, FaLock, FaUnlock, FaFileExcel
} from 'react-icons/fa';

export default function ReturnHistory() {
  const [returns, setReturns] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [soldBills, setSoldBills] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [editingReturn, setEditingReturn] = useState(null);
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    barcode: "",
    paymentStatus: "all",
    pharmacyName: "",
    note: "",
    pharmacyReturnBillNumber: ""
  });
  const [returnItems, setReturnItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [pharmacyReturnBillNumber, setPharmacyReturnBillNumber] = useState("");
  const [returnBillNumber, setReturnBillNumber] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Sorting state
  const [returnSort, setReturnSort] = useState({ col: "returnDate", dir: "desc" });
  const [billSort, setBillSort] = useState({ col: "billNumber", dir: "desc" });

  // Ref for scrolling to edit section
  const editSectionRef = useRef(null);

  // Helper functions - Define these BEFORE they're used
  const escapeHtml = (text) => {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      let d;
      if (date.toDate) d = date.toDate();
      else if (date instanceof Date) d = date;
      else if (typeof date === 'string') d = new Date(date);
      else if (date.seconds) d = new Date(date.seconds * 1000);
      else return "N/A";
      if (isNaN(d.getTime())) return "N/A";
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return "N/A"; }
  };

  const formatCurrency = (amount, currency = "IQD") => {
    if (amount === null || amount === undefined) amount = 0;
    if (currency === "USD") {
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
      return `$${formatted}`;
    } else {
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
      return `${formatted} IQD`;
    }
  };

  const getDisplayItems = (returnItem) => {
    if (!returnItem) return [];
    if (returnItem.items && Array.isArray(returnItem.items) && returnItem.items.length > 0) {
      const firstItem = returnItem.items[0];
      if (firstItem.name || firstItem.barcode || firstItem.returnQuantity !== undefined) {
        return returnItem.items;
      }
    }
    return returnItem.items || [];
  };

  const getBillCurrency = (bill) => {
    if (bill?.currency) return bill.currency;
    if (bill?.items && bill.items.length > 0) {
      const firstItem = bill.items[0];
      if (firstItem?.originalCurrency) return firstItem.originalCurrency;
      if (firstItem?.currency) return firstItem.currency;
      if ((firstItem?.outPriceUSD || 0) > 0) return "USD";
    }
    return "IQD";
  };

  const getItemPrice = (item, billCurrency) => {
    if (billCurrency === "USD") {
      return item.outPriceUSD || item.priceUSD || item.sellingPriceUSD || item.outPrice || 0;
    } else {
      return item.outPriceIQD || item.outPrice || item.price || item.sellingPriceIQD || 0;
    }
  };

  const getAlreadyReturnedQuantity = (barcode, billId, pharmacyId, currentReturns, excludeReturnId = null) => {
    let totalReturned = 0;
    currentReturns.forEach(returnBill => {
      if (returnBill.id !== excludeReturnId &&
        returnBill.pharmacyId === pharmacyId &&
        returnBill.billId === billId &&
        returnBill.items) {
        const item = returnBill.items.find(i => i.barcode === barcode);
        if (item) totalReturned += item.returnQuantity || 0;
      }
    });
    return totalReturned;
  };

  const calculateReturnTotal = (items) => {
    return items.reduce((sum, item) => sum + ((item.returnPrice || 0) * (item.returnQuantity || 0)), 0);
  };

  const parseCurrency = (value) => {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const getStatusBadge = (status) => {
    if (status === "Paid") {
      return {
        backgroundColor: "#dcfce7",
        color: "#15803d",
        border: "1px solid #86efac"
      };
    }
    if (status === "Processed") {
      return {
        backgroundColor: "#ffedd5",
        color: "#c2410c",
        border: "1px solid #fdba74"
      };
    }
    return {
      backgroundColor: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fcd34d"
    };
  };

  const isEditable = (returnItem) => {
    return returnItem.paymentStatus !== "Processed";
  };

  const SortIcon = ({ col, sortState }) => {
    if (sortState.col !== col) return <FaSort size={10} style={{ opacity: 0.4, marginLeft: 4 }} />;
    return sortState.dir === "asc"
      ? <FaSortUp size={10} style={{ marginLeft: 4, color: "#7c3aed" }} />
      : <FaSortDown size={10} style={{ marginLeft: 4, color: "#7c3aed" }} />;
  };

  const compareValues = (a, b, dir) => {
    if (a === null || a === undefined) return dir === "asc" ? -1 : 1;
    if (b === null || b === undefined) return dir === "asc" ? 1 : -1;
    if (typeof a === "string" && typeof b === "string") {
      return dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
    }
    return dir === "asc" ? (a > b ? 1 : a < b ? -1 : 0) : (a < b ? 1 : a > b ? -1 : 0);
  };

  // Define filteredReturns BEFORE using it in useCallback
  const filteredReturns = (returns || [])
    .filter(returnItem => {
      if (!returnItem) return false;
      if (filters.billNumber && !returnItem.billNumber?.toString().includes(filters.billNumber)) return false;
      if (filters.itemName && !returnItem.items?.some(i => i?.name?.toLowerCase().includes(filters.itemName.toLowerCase()))) return false;
      if (filters.barcode && !returnItem.items?.some(i => i?.barcode?.toLowerCase().includes(filters.barcode.toLowerCase()))) return false;
      if (filters.paymentStatus !== "all" && returnItem.paymentStatus !== filters.paymentStatus) return false;
      if (filters.pharmacyName && !returnItem.pharmacyName?.toLowerCase().includes(filters.pharmacyName.toLowerCase())) return false;
      if (filters.note && !returnItem.returnBillNote?.toLowerCase().includes(filters.note.toLowerCase())) return false;
      if (filters.pharmacyReturnBillNumber && !returnItem.pharmacyReturnBillNumber?.toLowerCase().includes(filters.pharmacyReturnBillNumber.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const { col, dir } = returnSort;
      let aVal, bVal;
      switch (col) {
        case "returnBillNumber": aVal = a.returnBillNumber; bVal = b.returnBillNumber; break;
        case "pharmacyName": aVal = a.pharmacyName; bVal = b.pharmacyName; break;
        case "billNumber": aVal = Number(a.billNumber) || 0; bVal = Number(b.billNumber) || 0; break;
        case "currency": aVal = a.currency; bVal = b.currency; break;
        case "totalReturnQty": aVal = a.totalReturnQty || 0; bVal = b.totalReturnQty || 0; break;
        case "totalReturnAmount": aVal = a.totalReturnAmount || 0; bVal = b.totalReturnAmount || 0; break;
        case "returnDate": aVal = a.returnDate instanceof Date ? a.returnDate.getTime() : 0; bVal = b.returnDate instanceof Date ? b.returnDate.getTime() : 0; break;
        case "paymentStatus": aVal = a.paymentStatus; bVal = b.paymentStatus; break;
        default: aVal = a.returnDate instanceof Date ? a.returnDate.getTime() : 0; bVal = b.returnDate instanceof Date ? b.returnDate.getTime() : 0;
      }
      return compareValues(aVal, bVal, dir);
    });

  const filteredBills = (soldBills || [])
    .filter(bill => {
      if (!selectedPharmacy?.id || !bill) return false;
      if (bill.pharmacyId !== selectedPharmacy.id) return false;
      if (filters.billNumber && !bill.billNumber?.toString().includes(filters.billNumber)) return false;
      if (filters.itemName && !bill.items?.some(i => i?.name?.toLowerCase().includes(filters.itemName.toLowerCase()))) return false;
      if (filters.barcode && !bill.items?.some(i => i?.barcode?.toLowerCase().includes(filters.barcode.toLowerCase()))) return false;
      return true;
    })
    .sort((a, b) => {
      const { col, dir } = billSort;
      let aVal, bVal;
      switch (col) {
        case "billNumber": aVal = Number(a.billNumber) || 0; bVal = Number(b.billNumber) || 0; break;
        case "date": aVal = a.date instanceof Date ? a.date.getTime() : 0; bVal = b.date instanceof Date ? b.date.getTime() : 0; break;
        case "currency": aVal = getBillCurrency(a); bVal = getBillCurrency(b); break;
        case "totalAmount": {
          const ca = getBillCurrency(a);
          aVal = ca === "USD" ? a.totalAmountUSD || 0 : a.totalAmountIQD || 0;
          const cb = getBillCurrency(b);
          bVal = cb === "USD" ? b.totalAmountUSD || 0 : b.totalAmountIQD || 0;
          break;
        }
        case "items": aVal = a.items?.length || 0; bVal = b.items?.length || 0; break;
        default: aVal = Number(a.billNumber) || 0; bVal = Number(b.billNumber) || 0;
      }
      return compareValues(aVal, bVal, dir);
    });

  // Generate return bill number
  const generateReturnBillNumberLocal = (existingReturns = []) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `RET-${year}${month}-`;

    let maxSeq = 0;
    existingReturns.forEach(r => {
      if (r.returnBillNumber && r.returnBillNumber.startsWith(prefix)) {
        const seq = parseInt(r.returnBillNumber.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });

    return `${prefix}${maxSeq + 1}`;
  };

  // ── Export to Excel Function ──────────────────────────────────────────────
  const exportToExcel = useCallback(() => {
    try {
      setIsExporting(true);
      
      // Prepare data for export
      const exportData = filteredReturns.map(returnItem => {
        const currency = returnItem.currency || "IQD";
        const itemsList = getDisplayItems(returnItem);
        const itemsDetails = itemsList.map(item => 
          `${item.name} (${item.barcode}): ${item.returnQuantity} x ${formatCurrency(item.returnPrice, item.currency || currency)}`
        ).join("; ");
        
        return {
          "Return Bill Number": returnItem.returnBillNumber || "",
          "Pharmacy Return #": returnItem.pharmacyReturnBillNumber || "",
          "Pharmacy Name": returnItem.pharmacyName || "",
          "Original Bill Number": returnItem.billNumber || "",
          "Return Date": formatDate(returnItem.returnDate),
          "Currency": currency,
          "Total Quantity": returnItem.totalReturnQty || 0,
          "Total Amount": returnItem.totalReturnAmount || 0,
          "Payment Status": returnItem.paymentStatus || "",
          "Note": returnItem.returnBillNote || "",
          "Items Returned": itemsDetails
        };
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns (basic implementation)
      const colWidths = [
        {wch:20}, // Return Bill Number
        {wch:20}, // Pharmacy Return #
        {wch:25}, // Pharmacy Name
        {wch:18}, // Original Bill Number
        {wch:18}, // Return Date
        {wch:10}, // Currency
        {wch:12}, // Total Quantity
        {wch:15}, // Total Amount
        {wch:15}, // Payment Status
        {wch:30}, // Note
        {wch:50}  // Items Returned
      ];
      ws['!cols'] = colWidths;
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Return History");
      
      // Generate filename with current date
      const fileName = `Return_History_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Save file
      XLSX.writeFile(wb, fileName);
      
      setSuccessMessage("Export to Excel completed successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      setError(`Failed to export: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  }, [filteredReturns]);

  // ── Print Function (Direct print without modal) ──────────────────────────
  const handlePrint = useCallback((returnItem) => {
    if (!returnItem) return;

    const currency = returnItem.currency || "IQD";
    const items = getDisplayItems(returnItem);

    // Ensure pharmacy name is properly displayed
    const pharmacyNameDisplay = returnItem.pharmacyName || "N/A";
    const pharmacyReturnNumberDisplay = returnItem.pharmacyReturnBillNumber || "N/A";

    const itemRows = items.map((item, idx) => {
      const itemCurrency = item.currency || currency;
      const qty = item.returnQuantity || 0;
      const price = item.returnPrice || 0;
      const total = price * qty;
      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:12px;border:1px solid #e5e7eb;">${idx + 1}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-weight:500;">${escapeHtml(item.name || "")}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;text-align:center;font-family:monospace;font-size:12px;">${item.barcode || ""}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;text-align:center;">
            <span style="background:#fef3c7;padding:4px 10px;border-radius:6px;display:inline-block;">${qty}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;text-align:right;">${formatCurrency(price, itemCurrency)}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;text-align:right;font-weight:bold;color:#059669;">${formatCurrency(total, itemCurrency)}</td>
        </tr>`;
    }).join("");

    const statusBg = returnItem.paymentStatus === "Paid" ? "#10b981" : "#f59e0b";
    const statusColor = returnItem.paymentStatus === "Paid" ? "white" : "#92400e";
    const noteHtml = returnItem.returnBillNote
      ? `<div style="background:#eff6ff;padding:15px;border-radius:10px;margin-bottom:25px;border-left:4px solid #3b82f6;">
           <strong style="color:#1e40af;">📝 Note:</strong> <span style="color:#1e3a8a;">${escapeHtml(returnItem.returnBillNote)}</span>
         </div>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Return Bill - ${returnItem.returnBillNumber}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none; }
      @page { size: A4; margin: 1.5cm; }
    }
    * { box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', 'Poppins', Arial, sans-serif; 
      background: #f0f2f5;
      margin: 0;
      padding: 20px;
    }
    .print-container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .print-content {
      padding: 40px;
    }
    @media print {
      body { background: white; padding: 0; }
      .print-container { box-shadow: none; border-radius: 0; }
      .print-content { padding: 20px; }
    }
    .header {
      text-align: center;
      margin-bottom: 35px;
      border-bottom: 3px solid #7c3aed;
      padding-bottom: 25px;
    }
    .logo {
      height: 80px;
      object-fit: contain;
      margin-bottom: 15px;
    }
    .company-name {
      font-size: 32px;
      font-weight: bold;
      color: #7c3aed;
      margin: 0;
      letter-spacing: 1px;
    }
    .tagline {
      font-size: 14px;
      color: #6b7280;
      margin-top: 8px;
    }
    .contact-info {
      font-size: 12px;
      color: #6b7280;
      margin-top: 10px;
      line-height: 1.5;
    }
    .bill-banner {
      background: linear-gradient(135deg, #7c3aed 0%, #9b4dff 100%);
      color: white;
      padding: 25px;
      border-radius: 16px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .bill-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .bill-info p {
      margin: 8px 0;
      font-size: 14px;
    }
    .status-badge {
      background: ${statusBg};
      color: ${statusColor};
      padding: 5px 15px;
      border-radius: 25px;
      display: inline-block;
      font-weight: 600;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .items-table th {
      background: #7c3aed;
      color: white;
      padding: 14px;
      font-weight: 600;
      font-size: 13px;
    }
    .items-table td {
      padding: 12px;
      border: 1px solid #e5e7eb;
    }
    .items-table tbody tr:hover {
      background: #f9fafb;
    }
    .total-row {
      background: #f3f4f6;
      font-weight: bold;
    }
    .total-amount {
      color: #059669;
      font-size: 18px;
      font-weight: bold;
    }
    .signatures {
      margin-top: 50px;
      border-top: 2px dashed #9ca3af;
      padding-top: 30px;
      display: flex;
      justify-content: space-between;
      gap: 40px;
    }
    .signature-line {
      flex: 1;
      text-align: center;
    }
    .signature-dash {
      border-top: 2px solid #4b5563;
      width: 80%;
      margin: 40px auto 10px;
      padding-top: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
    }
    .thankyou {
      font-size: 18px;
      font-weight: bold;
      color: #7c3aed;
      margin: 20px 0 10px;
    }
    .print-date {
      font-size: 10px;
      color: #9ca3af;
    }
    @media (max-width: 640px) {
      .print-content { padding: 20px; }
      .bill-banner { flex-direction: column; gap: 15px; }
      .signatures { flex-direction: column; gap: 20px; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="print-content">
      <div class="header" style="display: flex; align-items: center; gap: 15px; width: 100%; padding: 10px 0;">
        <div class="logo-container" style="flex-shrink: 0;">
          <img src="/Aranlogo.png" alt="Aran Med Store" class="logo" style="height: 50px; width: auto;" onerror="this.style.display='none'" />
        </div>
        <div class="company-info" style="flex-grow: 1;">
          <h1 class="company-name" style="margin: 0; font-size: 1.5em;">ARAN MED STORE</h1>
          <p class="tagline" style="margin: 5px 0 0 0; font-size: 0.9em;">Medicine Trading & Distribution | Quality Healthcare Solutions</p>
        </div>
        <div class="contact-info" style="flex-shrink: 0; text-align: right; font-size: 0.8em;">
          <p style="margin: 2px 0;">📞 +964 772 533 5252 | +964 751 741 2241</p>
          <p style="margin: 2px 0;">📍 سلێمانی بەرامبەر تاوەری تەندروستی سمارت</p>
          <p style="margin: 2px 0;">✉️ info@aranmedstore.com</p>
        </div>
      </div>

<div class="bill-banner" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; gap: 20px; background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%); padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
  <div style="flex-grow: 1; color: black;">
    <p style="margin: 8px 0; font-size: 1em; font-weight: 500;">
      <strong style="color: black;">📄 Return #:</strong> ${returnItem.returnBillNumber}
    </p>
    <p style="margin: 8px 0; font-size: 1em; font-weight: 500;">
      <strong style="color: black;">🏪 Pharmacy:</strong> ${escapeHtml(pharmacyNameDisplay)}
    </p>
    <p style="margin: 8px 0; font-size: 1em; font-weight: 500;">
      <strong style="color: black;">📅 Date:</strong> ${formatDate(returnItem.returnDate)}
    </p>
  </div>
  <div style="text-align: right; flex-shrink: 0; color: black;">
    <p style="margin: 8px 0; font-size: 1em; font-weight: 500;">
      <strong style="color: black;">🏥 Pharmacy Return #:</strong> ${escapeHtml(pharmacyReturnNumberDisplay)}
    </p>
    <p style="margin: 8px 0; font-size: 1em; font-weight: 500;">
      <strong style="color: black;">🧾 Original Bill:</strong> ${returnItem.billNumber}
    </p>
    <p style="margin: 8px 0; font-size: 1em; font-weight: 500;">
      <strong style="color: black;">🔖 Status:</strong>
      <span class="status-badge" style="background-color: rgba(0, 0, 0, 0.2); color: black; padding: 5px 10px; border-radius: 5px; display: inline-block; font-weight: 600;">
        ${returnItem.paymentStatus}
      </span>
    </p>
  </div>
</div>

      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item Name</th>
            <th>Barcode</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows || `<tr><td colspan="6" style="padding:40px;text-align:center;color:#9ca3af;">No items found</td></tr>`}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="4" style="padding:14px;text-align:right;"><strong>TOTAL AMOUNT:</strong></td>
            <td style="padding:14px;"></td>
            <td style="padding:14px;text-align:right;" class="total-amount">
              ${formatCurrency(returnItem.totalReturnAmount, currency)}
            </td>
          </tr>
        </tfoot>
      </table>
      ${noteHtml}
      
      <!-- Signatures -->
      <div class="signatures">
        <div class="signature-line">
          <div class="signature-dash"></div>
          <p style="font-size:12px;color:#6b7280;margin:0;">Pharmacy Representative<br>Signature &amp; Stamp</p>
        </div>
        <div class="signature-line">
          <div class="signature-dash"></div>
          <p style="font-size:12px;color:#6b7280;margin:0;">Aran Company Representative<br>Signature &amp; Stamp</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p class="print-date">Printed on: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Open a new window/tab for printing
    const printWindow = window.open("", "_blank", "width=1000,height=800,toolbar=yes,scrollbars=yes,resizable=yes");
    if (!printWindow) {
      alert("Please allow popups to print. Check your browser settings.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Wait for images to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      }, 500);
    };
  }, []);

  // Event Handlers
  const toggleReturnSort = (col) => {
    setReturnSort(prev => ({
      col,
      dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc"
    }));
  };

  const toggleBillSort = (col) => {
    setBillSort(prev => ({
      col,
      dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc"
    }));
  };

  const handlePharmacySelect = (selectedOption) => {
    setSelectedPharmacy(selectedOption?.value || null);
    setSelectedBill(null);
    setSelectedReturn(null);
    setEditingReturn(null);
    setReturnItems([]);
    setPharmacyReturnBillNumber("");
    setReturnNote("");
    setExpandedBillId(null);
    setError(null);
    setSuccessMessage(null);
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const toggleBillSelection = (bill) => {
    if (selectedBill?.id === bill.id) {
      setSelectedBill(null);
      setExpandedBillId(null);
      setReturnItems([]);
    } else {
      setSelectedBill(bill);
      setExpandedBillId(bill.id);
      initializeReturnItems(bill);
    }
  };

  const initializeReturnItems = (bill) => {
    if (!bill || !bill.items || !Array.isArray(bill.items)) {
      setError("Invalid bill selected");
      return;
    }
    try {
      const newReturnBillNumber = generateReturnBillNumberLocal(returns);
      setReturnBillNumber(newReturnBillNumber);

      const billCurrency = getBillCurrency(bill);
      const existingReturns = returns.filter(r =>
        r.pharmacyId === selectedPharmacy?.id && r.billId === bill.id
      );

      const itemsWithReturnInfo = bill.items
        .filter(item => item && item.barcode)
        .map(item => {
          const alreadyReturned = getAlreadyReturnedQuantity(
            item.barcode, bill.id, selectedPharmacy?.id, existingReturns
          );
          const originalQty = item.originalQuantity || item.quantity || 0;
          const availableQty = Math.max(0, originalQty - alreadyReturned);
          const itemPrice = getItemPrice(item, billCurrency);
          return {
            id: item.id,
            barcode: item.barcode,
            name: item.name || 'Unknown Item',
            billNumber: bill.billNumber,
            billId: bill.id,
            returnQuantity: 0,
            returnPrice: itemPrice,
            originalQuantity: originalQty,
            alreadyReturned: alreadyReturned,
            availableQuantity: availableQty,
            currency: billCurrency,
            expireDate: item.expireDate
          };
        })
        .filter(item => item.availableQuantity > 0);

      if (itemsWithReturnInfo.length === 0) {
        setError("No items available for return. All items have been fully returned.");
        setReturnItems([]);
      } else {
        setReturnItems(itemsWithReturnInfo);
      }
    } catch (error) {
      console.error("Error initializing return items:", error);
      setError(`Error initializing return items: ${error.message}`);
    }
  };

  const handleCancelBillSelection = () => {
    setSelectedBill(null);
    setExpandedBillId(null);
    setReturnItems([]);
    setPharmacyReturnBillNumber("");
    setReturnNote("");
    setReturnBillNumber("");
    setError(null);
    setSuccessMessage(null);
  };

  const handleReturnQuantityChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    let inputQty = parseInt(value);
    if (isNaN(inputQty)) inputQty = 0;
    inputQty = Math.max(0, inputQty);
    const maxAllowed = newReturnItems[index].maxReturnable || newReturnItems[index].originalQuantity;
    newReturnItems[index].returnQuantity = Math.min(inputQty, maxAllowed);
    setReturnItems(newReturnItems);
  };

  const handleReturnPriceChange = (index, value) => {
    const newReturnItems = [...returnItems];
    if (!newReturnItems[index]) return;
    newReturnItems[index].returnPrice = parseCurrency(value);
    setReturnItems(newReturnItems);
  };

  const handleDeleteReturnItemFromList = (index) => {
    const itemName = returnItems[index]?.name || "Item";
    if (confirm(`Remove "${itemName}" from return?`)) {
      setReturnItems(returnItems.filter((_, i) => i !== index));
      setSuccessMessage(`"${itemName}" removed`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleSubmitReturn = async () => {
    if (!selectedPharmacy?.id || !selectedBill) {
      setError("Please select a pharmacy and bill");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      setError("Please select at least one item to return");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const invalidItems = itemsToReturn.filter(item => item.returnQuantity > item.availableQuantity);
    if (invalidItems.length > 0) {
      setError(`Cannot return more than available: ${invalidItems.map(i => i.name).join(", ")}`);
      setTimeout(() => setError(null), 5000);
      return;
    }
    try {
      setIsSubmitting(true);
      const totalReturnAmount = calculateReturnTotal(itemsToReturn);
      const totalReturnQty = itemsToReturn.reduce((sum, i) => sum + (i.returnQuantity || 0), 0);

      const preparedItems = itemsToReturn.map(item => ({
        barcode: item.barcode,
        name: item.name,
        billNumber: selectedBill.billNumber,
        billId: selectedBill.id,
        originalQuantity: item.originalQuantity,
        returnQuantity: item.returnQuantity,
        returnPrice: item.returnPrice,
        originalPrice: item.returnPrice,
        netPrice: item.returnPrice,
        outPrice: item.returnPrice,
        expireDate: item.expireDate || null,
        pharmacyId: selectedPharmacy.id,
        pharmacyName: selectedPharmacy.name,
        pharmacyReturnBillNumber: pharmacyReturnBillNumber || "",
        availableQuantity: item.availableQuantity,
        alreadyReturned: item.alreadyReturned,
        newRemainingQuantity: item.originalQuantity - (item.alreadyReturned + item.returnQuantity),
        currency: item.currency,
        returnBillNumber: returnBillNumber,
        returnBillNote: returnNote
      }));

      const result = await returnItemsToStore(
        selectedPharmacy.id,
        preparedItems,
        returnNote,
        returnBillNumber,
        totalReturnAmount,
        totalReturnQty
      );

      setSuccessMessage(`Return processed successfully! Bill: ${result.returnBillNumber || returnBillNumber}`);
      setSelectedBill(null);
      setExpandedBillId(null);
      setReturnItems([]);
      setPharmacyReturnBillNumber("");
      setReturnNote("");
      setReturnBillNumber("");

      const filteredReturnsData = await getFilteredReturns(
        selectedPharmacy.id,
        filters.note,
        filters.pharmacyReturnBillNumber
      );
      setReturns(filteredReturnsData);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error processing return:", error);
      setError(`Failed to process return: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReturn = async (returnItem) => {
    if (!returnItem) { alert("Invalid return item"); return; }
    const msg = returnItem.paymentStatus === "Paid"
      ? "⚠️ This return has been PAID. Delete anyway?"
      : "Delete this return?";
    if (confirm(msg)) {
      try {
        const deleteId = returnItem.documentId || returnItem.id;
        await deleteReturnBillAndRestoreToSale(deleteId);
        setSuccessMessage("Return deleted successfully!");
        const filteredReturnsData = await getFilteredReturns(
          selectedPharmacy?.id, filters.note, filters.pharmacyReturnBillNumber
        );
        setReturns(filteredReturnsData);
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        console.error("Error deleting return:", error);
        setError(`Failed to delete: ${error.message}`);
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  const handleEditReturn = async (returnItem) => {
    if (!returnItem?.documentId && !returnItem?.id) {
      alert("Invalid return item");
      return;
    }

    if (returnItem.paymentStatus === "Processed") {
      alert("⚠️ This return is Processed and cannot be edited. Change it to Unpaid first.");
      return;
    }

    if (returnItem.paymentStatus === "Paid" &&
      !confirm("⚠️ This return is PAID. Continue editing?")) {
      return;
    }

    try {
      const editId = returnItem.documentId || returnItem.id;
      const returnDetails = await getReturnById(editId);
      if (!returnDetails?.items) throw new Error("Could not fetch return details");

      setEditingReturn(returnDetails);
      setSelectedPharmacy({ id: returnDetails.pharmacyId, name: returnDetails.pharmacyName });
      setPharmacyReturnBillNumber(returnDetails.pharmacyReturnBillNumber || "");
      setReturnBillNumber(returnDetails.returnBillNumber);
      setReturnNote(returnDetails.returnBillNote || "");

      const returnCurrency = returnDetails.currency || "IQD";

      const otherReturns = returns.filter(r =>
        r.billId === returnDetails.items[0]?.billId &&
        r.id !== returnDetails.id
      );

      const editableItems = returnDetails.items.map(item => {
        const alreadyReturnedByOthers = getAlreadyReturnedQuantity(
          item.barcode,
          item.billId,
          returnDetails.pharmacyId,
          otherReturns,
          returnDetails.id
        );
        const originalQty = item.originalQuantity || 0;
        const maxReturnable = originalQty;
        
        return {
          ...item,
          returnQuantity: item.returnQuantity || 0,
          returnPrice: item.returnPrice || 0,
          originalQuantity: originalQty,
          availableQuantity: maxReturnable - alreadyReturnedByOthers,
          maxReturnable: maxReturnable,
          alreadyReturnedByOthers: alreadyReturnedByOthers,
          newRemainingQuantity: originalQty - (alreadyReturnedByOthers + (item.returnQuantity || 0)),
          currency: returnCurrency
        };
      });

      setReturnItems(editableItems);
      setSuccessMessage(`Editing ${returnDetails.returnBillNumber}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error loading return:", error);
      setError(`Failed to load return: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleUpdateReturn = async () => {
    if (!editingReturn?.returnBillNumber) {
      setError("No return selected for editing");
      return;
    }
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      setError("Please select at least one item");
      return;
    }
    const invalidItems = itemsToReturn.filter(item => item.returnQuantity > (item.maxReturnable || item.originalQuantity));
    if (invalidItems.length > 0) {
      setError(`Cannot return more than original quantity for: ${invalidItems.map(i => i.name).join(", ")}`);
      return;
    }
    try {
      setIsSubmitting(true);
      const preparedItems = itemsToReturn.map(item => ({
        id: item.id,
        barcode: item.barcode,
        name: item.name,
        billNumber: item.billNumber,
        billId: item.billId,
        originalQuantity: item.originalQuantity,
        returnQuantity: item.returnQuantity,
        returnPrice: item.returnPrice,
        originalPrice: item.originalPrice || item.returnPrice,
        netPrice: item.netPrice || item.returnPrice,
        outPrice: item.returnPrice,
        expireDate: item.expireDate,
        pharmacyId: editingReturn.pharmacyId,
        pharmacyReturnBillNumber: pharmacyReturnBillNumber,
        newRemainingQuantity: item.originalQuantity - (item.alreadyReturnedByOthers + item.returnQuantity),
        currency: item.currency
      }));

      const totalAmount = calculateReturnTotal(preparedItems);
      const totalQty = preparedItems.reduce((sum, i) => sum + (i.returnQuantity || 0), 0);

      await updateReturnItems(editingReturn.returnBillNumber, preparedItems, totalAmount, totalQty);

      setSuccessMessage("Return updated successfully!");
      setEditingReturn(null);
      setReturnItems([]);
      setPharmacyReturnBillNumber("");
      setReturnNote("");

      const filteredReturnsData = await getFilteredReturns(
        selectedPharmacy?.id, filters.note, filters.pharmacyReturnBillNumber
      );
      setReturns(filteredReturnsData);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error updating return:", error);
      setError(`Failed to update: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingReturn(null);
    setReturnItems([]);
    setPharmacyReturnBillNumber("");
    setReturnNote("");
    setSelectedBill(null);
    setExpandedBillId(null);
    setError(null);
    setSuccessMessage(null);
  };

  const toggleReturnDetails = (returnItem) => {
    setSelectedReturn(selectedReturn?.id === returnItem.id ? null : returnItem);
  };

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [allReturns, pharmaciesData, soldBillsData, usersData] = await Promise.all([
          getAllReturns(),
          getPharmacies(),
          getSoldBills(),
          getUsers()
        ]);
        setReturns(allReturns || []);
        setPharmacies((pharmaciesData || []).filter(p => p && p.id));
        setSoldBills((soldBillsData || []).filter(b => b && b.id));
        setUsers(usersData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch data. Please try again. " + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const loadReturns = async () => {
      if (!selectedPharmacy?.id) return;
      try {
        const filteredReturnsData = await getFilteredReturns(
          selectedPharmacy.id,
          filters.note,
          filters.pharmacyReturnBillNumber
        );
        setReturns(filteredReturnsData || []);
      } catch (error) {
        console.error("Error fetching returns:", error);
      }
    };
    loadReturns();
  }, [selectedPharmacy, filters.note, filters.pharmacyReturnBillNumber]);

  useEffect(() => {
    if (editingReturn && editSectionRef.current) {
      setTimeout(() => {
        editSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [editingReturn]);

  // Styles
  const styles = {
    container: { minHeight: "100vh", backgroundColor: "#f3f4f6", padding: "24px", fontFamily: "'NRT-Reg', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    innerContainer: { maxWidth: "95%", margin: "0 auto" },
    header: { marginBottom: "24px" },
    headerTitle: { fontSize: "28px", fontWeight: "bold", color: "#1f2937", display: "flex", alignItems: "center", gap: "8px", fontFamily: "'NRT-Bd', sans-serif", marginBottom: "4px" },
    headerSubtitle: { color: "#6b7280", fontSize: "14px" },
    alertError: { marginBottom: "16px", padding: "16px", backgroundColor: "#fee2e2", borderLeft: "4px solid #ef4444", color: "#991b1b", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" },
    alertSuccess: { marginBottom: "16px", padding: "16px", backgroundColor: "#d1fae5", borderLeft: "4px solid #10b981", color: "#065f46", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" },
    card: { backgroundColor: "white", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "24px", overflow: "hidden" },
    cardHeader: { padding: "20px", borderBottom: "1px solid #e5e7eb", background: "linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)" },
    cardTitle: { fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", color: "#374151", fontSize: "18px", fontFamily: "'NRT-Bd', sans-serif" },
    cardBody: { padding: "20px" },
    filterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "16px" },
    filterGroup: { display: "flex", flexDirection: "column", gap: "6px" },
    filterLabel: { fontSize: "14px", fontWeight: "500", color: "#4b5563", display: "flex", alignItems: "center", gap: "6px" },
    filterInput: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", transition: "all 0.2s" },
    tableContainer: { overflowX: "auto" },
    table: { width: "100%", borderCollapse: "collapse" },
    tableHeader: { backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
    tableHeaderCell: { padding: "14px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" },
    tableRow: { borderBottom: "1px solid #e5e7eb", cursor: "pointer", transition: "backgroundColor 0.2s" },
    tableCell: { padding: "14px 16px", fontSize: "14px", color: "#4b5563" },
    badge: { display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: "6px", fontSize: "14px", fontWeight: "500" },
    badgePrimary: { backgroundColor: "#dbeafe", color: "#1e40af" },
    badgeWarning: { backgroundColor: "#fef3c7", color: "#92400e" },
    badgePurple: { backgroundColor: "#f3e8ff", color: "#7c3aed" },
    badgeGreen: { backgroundColor: "#d1fae5", color: "#065f46" },
    btn: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer", border: "none", transition: "all 0.2s" },
    btnPrimary: { backgroundColor: "#7c3aed", color: "white" },
    btnSecondary: { backgroundColor: "#6b7280", color: "white" },
    btnDanger: { backgroundColor: "#ef4444", color: "white" },
    btnSuccess: { backgroundColor: "#10b981", color: "white" },
    btnWarning: { backgroundColor: "#f59e0b", color: "white" },
    btnOutline: { backgroundColor: "transparent", border: "1px solid #d1d5db", color: "#4b5563" },
    btnSmall: { padding: "5px 10px", fontSize: "14px" },
    btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
    quantityInput: { width: "80px", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "6px", textAlign: "center", fontSize: "14px" },
    priceInput: { width: "110px", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "6px", textAlign: "right", fontSize: "14px" },
    flexBetween: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  };

  if (isLoading && returns.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.innerContainer}>
          <h1 style={styles.headerTitle}>Return History</h1>
          <div style={{ ...styles.card, textAlign: "center", padding: "40px" }}>Loading return history...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.innerContainer}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>
            <FaClipboardList style={{ color: "#7c3aed" }} /> Return History
          </h1>
          <p style={styles.headerSubtitle}>Manage and track all product returns</p>
        </div>

        {/* Messages */}
        {error && <div style={styles.alertError}><FaTimes /> {error}</div>}
        {successMessage && <div style={styles.alertSuccess}><FaCheck /> {successMessage}</div>}

        {/* ── Filters ─────────────────────────────────────────────────────────── */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.flexBetween}>
              <h3 style={styles.cardTitle}><FaFilter style={{ color: "#7c3aed" }} /> Search Filters</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={exportToExcel}
                  disabled={isExporting || filteredReturns.length === 0}
                  style={{ ...styles.btn, ...styles.btnSuccess, ...styles.btnSmall }}
                >
                  <FaFileExcel /> {isExporting ? "Exporting..." : "Export to Excel"}
                </button>
              </div>
            </div>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.filterGrid}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaStore size={14} /> Pharmacy</label>
                <Select
                  options={[{ value: null, label: "All Pharmacies" }, ...pharmacies.map(p => ({ value: p, label: p.name }))]}
                  onChange={handlePharmacySelect}
                  placeholder="Select pharmacy..."
                  isClearable
                  maxMenuHeight={320}
                />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaBox size={14} /> Item Name</label>
                <input style={styles.filterInput} placeholder="Search by item name..." value={filters.itemName} onChange={e => handleFilterChange("itemName", e.target.value)} />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaBarcode size={14} /> Barcode</label>
                <input style={styles.filterInput} placeholder="Search by barcode..." value={filters.barcode} onChange={e => handleFilterChange("barcode", e.target.value)} />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaDollarSign size={14} /> Payment Status</label>
                <select style={styles.filterInput} value={filters.paymentStatus} onChange={e => handleFilterChange("paymentStatus", e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Processed">Processed</option>
                </select>
              </div>
            </div>
           
            <div style={styles.filterGrid}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaFileInvoice size={14} /> Bill Number</label>
                <input style={styles.filterInput} placeholder="Bill number..." value={filters.billNumber} onChange={e => handleFilterChange("billNumber", e.target.value)} />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaStickyNote size={14} /> Note</label>
                <input style={styles.filterInput} placeholder="Search by note..." value={filters.note} onChange={e => handleFilterChange("note", e.target.value)} />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}><FaBuilding size={14} />Pharmacy Return #</label>
                <input style={styles.filterInput} placeholder="Search by pharmacy return bill number.." value={filters.pharmacyReturnBillNumber} onChange={e => handleFilterChange("pharmacyReturnBillNumber", e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Returns History Table ────────────────────────────────────────────── */}
        <div style={styles.card}>
          <div style={{ ...styles.cardHeader, ...styles.flexBetween }}>
            <h3 style={styles.cardTitle}><FaClipboardList style={{ color: "#7c3aed" }} /> Return History {selectedPharmacy && `— ${selectedPharmacy.name}`}</h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ ...styles.badge, ...styles.badgePurple }}>Total: {filteredReturns.length}</span>
            </div>
          </div>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead style={styles.tableHeader}>
                <tr>
                  {[
                    { key: "returnBillNumber", label: "Return #" },
                    { key: "pharmacyName", label: "Pharmacy" },
                    { key: "billNumber", label: "Original Bill" },
                    { key: "currency", label: "Currency" },
                    { key: "totalReturnQty", label: "Total Qty", align: "center" },
                    { key: "totalReturnAmount", label: "Total Amount", align: "right" },
                    { key: "returnDate", label: "Date" },
                    { key: "paymentStatus", label: "Status" },
                  ].map(({ key, label, align }) => (
                    <th key={key} style={{ ...styles.tableHeaderCell, textAlign: align || "left" }} onClick={() => toggleReturnSort(key)}>
                      {label} <SortIcon col={key} sortState={returnSort} />
                    </th>
                  ))}
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.map(returnItem => {
                  const currency = returnItem.currency || "IQD";
                  const displayItems = getDisplayItems(returnItem);
                  const statusStyle = getStatusBadge(returnItem.paymentStatus);
                  const canEdit = isEditable(returnItem);

                  return (
                    <React.Fragment key={returnItem.id}>
                      <tr
                        style={styles.tableRow}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f9fafb"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                        onClick={() => toggleReturnDetails(returnItem)}
                      >
                        <td style={styles.tableCell}>
                          <div style={{ fontWeight: "bold", color: "#6d28d9", fontSize: "14px" }}>{returnItem.returnBillNumber}</div>
                          {returnItem.pharmacyReturnBillNumber && (
                            <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "2px" }}>Pharmacy: {returnItem.pharmacyReturnBillNumber}</div>
                          )}
                          <button
                            style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnPrimary, marginTop: "6px", fontSize: "14px", padding: "3px 8px" }}
                            onClick={e => { 
                              e.stopPropagation(); 
                              handlePrint(returnItem);
                            }}
                          >
                            <FaPrint size={10} /> Print
                          </button>
                        </td>
                        <td style={styles.tableCell}>{returnItem.pharmacyName}</td>
                        <td style={styles.tableCell}><span style={{ ...styles.badge, ...styles.badgePrimary }}>{returnItem.billNumber}</span></td>
                        <td style={styles.tableCell}>
                          <span style={{ ...styles.badge, ...(currency === 'USD' ? styles.badgeGreen : styles.badgePurple) }}>{currency}</span>
                        </td>
                        <td style={{ ...styles.tableCell, textAlign: "center" }}>
                          <span style={{ ...styles.badge, ...styles.badgeWarning }}>{returnItem.totalReturnQty || 0}</span>
                        </td>
                        <td style={{ ...styles.tableCell, textAlign: "right", fontWeight: "bold", color: "#059669" }}>
                          {formatCurrency(returnItem.totalReturnAmount, currency)}
                        </td>
                        <td style={styles.tableCell}>{formatDate(returnItem.returnDate)}</td>
                        <td style={styles.tableCell}>
                          <span style={{ ...styles.badge, ...statusStyle }}>
                            {returnItem.paymentStatus === "Paid"
                              ? <FaCheck size={10} style={{ marginRight: "3px" }} />
                              : returnItem.paymentStatus === "Processed"
                                ? <FaLock size={10} style={{ marginRight: "3px" }} />
                                : <FaTimes size={10} style={{ marginRight: "3px" }} />
                            }
                            {returnItem.paymentStatus}
                          </span>
                        </td>
                        <td style={styles.tableCell}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {canEdit ? (
                              <button
                                style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSmall }}
                                onClick={e => { e.stopPropagation(); handleEditReturn(returnItem); }}
                                title="Edit"
                              >
                                <FaEdit size={11} /> Edit
                              </button>
                            ) : (
                              <button
                                style={{ ...styles.btn, ...styles.btnSmall, backgroundColor: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" }}
                                title="Change to Unpaid to edit"
                                onClick={e => { e.stopPropagation(); alert("This return is Processed. Change it to Unpaid first to edit."); }}
                              >
                                <FaLock size={11} /> Locked
                              </button>
                            )}
                            <button
                              style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }}
                              onClick={e => { e.stopPropagation(); handleDeleteReturn(returnItem); }}
                              title="Delete"
                            >
                              <FaTrash size={11} /> Delete
                            </button>
                          </div>
                        </td>
                       </tr>

                      {/* Expanded Detail Row */}
                      {selectedReturn?.id === returnItem.id && (
                        <tr>
                          <td colSpan="9" style={{ padding: "20px", backgroundColor: "#f9fafb" }}>
                            <div style={{ backgroundColor: "white", borderRadius: "8px", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                              <h4 style={{ fontWeight: "bold", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <FaBox style={{ color: "#7c3aed" }} /> Returned Items Details
                              </h4>
                              {displayItems.length > 0 ? (
                                <div style={{ overflowX: "auto" }}>
                                  <table style={{ width: "100%", fontSize: "15px", borderCollapse: "collapse" }}>
                                    <thead style={{ backgroundColor: "#f3f4f6" }}>
                                      <tr>
                                        <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>#</th>
                                        <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Item Name</th>
                                        <th style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>Barcode</th>
                                        <th style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>Return Qty</th>
                                        <th style={{ padding: "10px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>Price</th>
                                        <th style={{ padding: "10px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {displayItems.map((item, idx) => {
                                        const itemCurrency = item.currency || currency;
                                        const qty = item.returnQuantity || 0;
                                        const price = item.returnPrice || 0;
                                        const total = price * qty;
                                        return (
                                          <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                            <td style={{ padding: "10px" }}>{idx + 1}</td>
                                            <td style={{ padding: "10px" }}>{item.name || "—"}</td>
                                            <td style={{ padding: "10px", textAlign: "center", fontFamily: "monospace", fontSize: "14px" }}>{item.barcode || "—"}</td>
                                            <td style={{ padding: "10px", textAlign: "center" }}>
                                              <span style={{ ...styles.badge, ...styles.badgeWarning }}>{qty}</span>
                                            </td>
                                            <td style={{ padding: "10px", textAlign: "right" }}>{formatCurrency(price, itemCurrency)}</td>
                                            <td style={{ padding: "10px", textAlign: "right", fontWeight: "bold", color: "#059669" }}>{formatCurrency(total, itemCurrency)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p style={{ color: "#9ca3af", textAlign: "center", padding: "20px" }}>No item details available</p>
                              )}
                              {returnItem.returnBillNote && (
                                <div style={{ marginTop: "12px", padding: "10px", backgroundColor: "#dbeafe", borderRadius: "6px" }}>
                                  <strong>Note:</strong> {returnItem.returnBillNote}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredReturns.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: "60px", textAlign: "center", color: "#6b7280" }}>
                      <FaBox size={48} style={{ color: "#d1d5db", marginBottom: "16px", display: "block", margin: "0 auto 16px" }} />
                      <p>No returns found</p>
                      <p style={{ fontSize: "14px", marginTop: "4px" }}>Try adjusting your filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Create / Edit Return Section ─────────────────────────────────────── */}
        {selectedPharmacy?.id && (
          <div style={styles.card} ref={editSectionRef}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>
                {editingReturn
                  ? <><FaEdit style={{ color: "#ea580c" }} /> Edit Return — {editingReturn.returnBillNumber}</>
                  : <><FaRedo style={{ color: "#10b981" }} /> Create New Return</>}
              </h3>
            </div>
            <div style={styles.cardBody}>
              {/* Meta fields */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Return Bill Number</label>
                  <input style={{ ...styles.filterInput, backgroundColor: "#f9fafb", fontFamily: "monospace" }} value={returnBillNumber} readOnly placeholder="Auto-generated" />
                  <small style={{ fontSize: "14px", color: "#6b7280" }}>Auto-generated sequential number</small>
                </div>
                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Pharmacy Return Invoice #</label>
                  <input style={styles.filterInput} value={pharmacyReturnBillNumber} onChange={e => setPharmacyReturnBillNumber(e.target.value)} placeholder="Optional" />
                </div>
                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Note</label>
                  <input style={styles.filterInput} value={returnNote} onChange={e => setReturnNote(e.target.value)} placeholder="Add a note..." />
                </div>
              </div>

              {/* Bill list (create mode) */}
              {!editingReturn ? (
                <>
                  <h4 style={{ fontWeight: "bold", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <FaFileInvoice /> Available Bills for Return
                  </h4>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%" }}>
                      <thead style={{ backgroundColor: "#f9fafb" }}>
                        <tr>
                          {[
                            { key: "billNumber", label: "Bill #" },
                            { key: "date", label: "Date" },
                            { key: "currency", label: "Currency", align: "center" },
                            { key: "totalAmount", label: "Total Amount", align: "right" },
                            { key: "items", label: "Items", align: "center" },
                          ].map(({ key, label, align }) => (
                            <th key={key} style={{ ...styles.tableHeaderCell, textAlign: align || "left" }} onClick={() => toggleBillSort(key)}>
                              {label} <SortIcon col={key} sortState={billSort} />
                            </th>
                          ))}
                          <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBills.map(bill => {
                          const currency = getBillCurrency(bill);
                          const total = currency === "USD"
                            ? (bill.totalAmountUSD || bill.items?.reduce((s, i) => s + (getItemPrice(i, "USD") * (i.quantity || 0)), 0) || 0)
                            : (bill.totalAmountIQD || bill.items?.reduce((s, i) => s + (getItemPrice(i, "IQD") * (i.quantity || 0)), 0) || 0);
                          const isExpanded = expandedBillId === bill.id;
                          return (
                            <React.Fragment key={bill.id}>
                              <tr
                                style={{ borderBottom: "1px solid #e5e7eb", cursor: "pointer", backgroundColor: isExpanded ? "#faf5ff" : "transparent" }}
                                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = "#f9fafb"; }}
                                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = "transparent"; }}
                                onClick={() => toggleBillSelection(bill)}
                              >
                                <td style={{ padding: "12px", fontWeight: "bold", color: "#6d28d9" }}>{bill.billNumber}</td>
                                <td style={{ padding: "12px", fontSize: "14px" }}>{formatDate(bill.date)}</td>
                                <td style={{ padding: "12px", textAlign: "center" }}>
                                  <span style={{ ...styles.badge, ...(currency === 'USD' ? styles.badgeGreen : styles.badgePurple) }}>{currency}</span>
                                </td>
                                <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold" }}>{formatCurrency(total, currency)}</td>
                                <td style={{ padding: "12px", textAlign: "center" }}>
                                  <span style={{ ...styles.badge, backgroundColor: "#e5e7eb", color: "#374151" }}>{bill.items?.length || 0}</span>
                                </td>
                                <td style={{ padding: "12px", textAlign: "center" }}>
                                  <button
                                    style={{ ...styles.btn, ...styles.btnPrimary, ...styles.btnSmall }}
                                    onClick={e => { e.stopPropagation(); toggleBillSelection(bill); }}
                                  >
                                    {isExpanded ? "Close" : "Select"}
                                  </button>
                                </td>
                              </tr>

                              {isExpanded && selectedBill?.id === bill.id && (
                                <tr>
                                  <td colSpan="6" style={{ padding: "20px", backgroundColor: "#f9fafb" }}>
                                    <div style={{ backgroundColor: "white", borderRadius: "8px", padding: "16px" }}>
                                      <h5 style={{ fontWeight: "bold", marginBottom: "12px" }}>Items to Return</h5>
                                      {returnItems.length > 0 ? (
                                        <>
                                          <div style={{ overflowX: "auto" }}>
                                            <table style={{ width: "100%", fontSize: "14px" }}>
                                              <thead style={{ backgroundColor: "#f3f4f6" }}>
                                                <tr>
                                                  <th style={{ padding: "8px", textAlign: "left" }}>Item</th>
                                                  <th style={{ padding: "8px", textAlign: "center" }}>Original</th>
                                                  <th style={{ padding: "8px", textAlign: "center" }}>Returned</th>
                                                  <th style={{ padding: "8px", textAlign: "center" }}>Available</th>
                                                  <th style={{ padding: "8px", textAlign: "center" }}>Return Qty</th>
                                                  <th style={{ padding: "8px", textAlign: "right" }}>Price</th>
                                                  <th style={{ padding: "8px", textAlign: "right" }}>Total</th>
                                                  <th style={{ padding: "8px", textAlign: "center" }}>Action</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {returnItems.map((item, idx) => {
                                                  const total = (item.returnQuantity || 0) * (item.returnPrice || 0);
                                                  return (
                                                    <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                                      <td style={{ padding: "8px" }}>
                                                        <div style={{ fontWeight: "500" }}>{item.name}</div>
                                                        <div style={{ fontSize: "14px", color: "#6b7280" }}>{item.barcode}</div>
                                                      </td>
                                                      <td style={{ padding: "8px", textAlign: "center" }}>{item.originalQuantity}</td>
                                                      <td style={{ padding: "8px", textAlign: "center", color: "#ea580c" }}>{item.alreadyReturned}</td>
                                                      <td style={{ padding: "8px", textAlign: "center", fontWeight: "bold", color: "#059669" }}>{item.availableQuantity}</td>
                                                      <td style={{ padding: "8px", textAlign: "center" }}>
                                                        <input type="number" min="0" max={item.availableQuantity} value={item.returnQuantity} onChange={e => handleReturnQuantityChange(idx, e.target.value)} style={styles.quantityInput} />
                                                      </td>
                                                      <td style={{ padding: "8px", textAlign: "right" }}>
                                                        <input type="number" step="0.01" value={item.returnPrice} onChange={e => handleReturnPriceChange(idx, e.target.value)} style={styles.priceInput} />
                                                      </td>
                                                      <td style={{ padding: "8px", textAlign: "right", fontWeight: "bold", color: "#059669" }}>{formatCurrency(total, item.currency)}</td>
                                                      <td style={{ padding: "8px", textAlign: "center" }}>
                                                        <button style={{ ...styles.btn, ...styles.btnDanger, padding: "4px 8px", fontSize: "14px" }} onClick={() => handleDeleteReturnItemFromList(idx)}>
                                                          <FaTrash size={10} /> Remove
                                                        </button>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                              <tfoot style={{ backgroundColor: "#f9fafb", fontWeight: "bold" }}>
                                                <tr>
                                                  <td colSpan="4" style={{ padding: "8px", textAlign: "right" }}>Totals:</td>
                                                  <td style={{ padding: "8px", textAlign: "center" }}>{returnItems.reduce((s, i) => s + (i.returnQuantity || 0), 0)}</td>
                                                  <td></td>
                                                  <td style={{ padding: "8px", textAlign: "right", color: "#059669" }}>
                                                    {formatCurrency(returnItems.reduce((s, i) => s + ((i.returnQuantity || 0) * (i.returnPrice || 0)), 0), returnItems[0]?.currency)}
                                                  </td>
                                                  <td></td>
                                                </tr>
                                              </tfoot>
                                            </table>
                                          </div>
                                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                                            <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={handleCancelBillSelection}>Cancel</button>
                                            <button
                                              style={{ ...styles.btn, ...styles.btnSuccess }}
                                              onClick={handleSubmitReturn}
                                              disabled={isSubmitting || returnItems.filter(i => i.returnQuantity > 0).length === 0}
                                            >
                                              {isSubmitting ? "Processing..." : <><FaRedo /> Submit Return</>}
                                            </button>
                                          </div>
                                        </>
                                      ) : (
                                        <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                                          <FaBox size={32} style={{ color: "#d1d5db", marginBottom: "12px", display: "block", margin: "0 auto 12px" }} />
                                          <p>No items available for return</p>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {filteredBills.length === 0 && (
                          <tr>
                            <td colSpan="6" style={{ padding: "60px", textAlign: "center", color: "#6b7280" }}>
                              <FaFileInvoice size={48} style={{ color: "#d1d5db", marginBottom: "16px", display: "block", margin: "0 auto 16px" }} />
                              <p>No bills found for this pharmacy</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                /* Edit mode */
                <>
                  <h4 style={{ fontWeight: "bold", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <FaEdit style={{ color: "#ea580c" }} /> Edit Return Items
                  </h4>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%" }}>
                      <thead style={{ backgroundColor: "#f9fafb" }}>
                        <tr>
                          <th style={styles.tableHeaderCell}>Item</th>
                          <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>Original</th>
                          <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>Others Returned</th>
                          <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>Max Returnable</th>
                          <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>Current Return Qty</th>
                          <th style={{ ...styles.tableHeaderCell, textAlign: "right" }}>Price</th>
                          <th style={{ ...styles.tableHeaderCell, textAlign: "right" }}>Total</th>
                          <th style={{ ...styles.tableHeaderCell, textAlign: "center" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnItems.map((item, idx) => {
                          const total = (item.returnQuantity || 0) * (item.returnPrice || 0);
                          return (
                            <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                              <td style={{ padding: "12px" }}>
                                <div style={{ fontWeight: "500" }}>{item.name}</div>
                                <div style={{ fontSize: "14px", color: "#6b7280" }}>{item.barcode}</div>
                              </td>
                              <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold" }}>{item.originalQuantity}</td>
                              <td style={{ padding: "12px", textAlign: "center", color: "#ea580c" }}>{item.alreadyReturnedByOthers || 0}</td>
                              <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold", color: "#059669" }}>
                                {item.maxReturnable || item.originalQuantity}
                                <div style={{ fontSize: "14px", color: "#6b7280" }}>(Original quantity)</div>
                              </td>
                              <td style={{ padding: "12px", textAlign: "center" }}>
                                <input
                                  type="number"
                                  min="0"
                                  max={item.maxReturnable || item.originalQuantity}
                                  value={item.returnQuantity}
                                  onChange={e => handleReturnQuantityChange(idx, e.target.value)}
                                  style={styles.quantityInput}
                                />
                                <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "2px" }}>
                                  Can return up to original
                                </div>
                              </td>
                              <td style={{ padding: "12px", textAlign: "right" }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.returnPrice}
                                  onChange={e => handleReturnPriceChange(idx, e.target.value)}
                                  style={styles.priceInput}
                                />
                              </td>
                              <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", color: "#059669" }}>{formatCurrency(total, item.currency)}</td>
                              <td style={{ padding: "12px", textAlign: "center" }}>
                                <button style={{ ...styles.btn, ...styles.btnDanger, padding: "4px 8px", fontSize: "14px" }} onClick={() => handleDeleteReturnItemFromList(idx)}>
                                  <FaTrash size={10} /> Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot style={{ backgroundColor: "#f9fafb", fontWeight: "bold" }}>
                        <tr>
                          <td colSpan="4" style={{ padding: "12px", textAlign: "right" }}>Totals:</td>
                          <td style={{ padding: "12px", textAlign: "center" }}>{returnItems.reduce((s, i) => s + (i.returnQuantity || 0), 0)}</td>
                          <td></td>
                          <td style={{ padding: "12px", textAlign: "right", color: "#059669" }}>
                            {formatCurrency(returnItems.reduce((s, i) => s + ((i.returnQuantity || 0) * (i.returnPrice || 0)), 0), returnItems[0]?.currency)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                    <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={handleCancelEdit}>Cancel Edit</button>
                    <button
                      style={{ ...styles.btn, ...styles.btnWarning }}
                      onClick={handleUpdateReturn}
                      disabled={isSubmitting || returnItems.filter(i => i.returnQuantity > 0).length === 0}
                    >
                      {isSubmitting ? "Updating..." : <><FaEdit /> Update Return</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}