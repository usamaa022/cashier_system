"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  searchInitializedItems,
  createSoldBill,
  getStoreItems,
  searchPharmacies,
  searchSoldBills,
  updateSoldBill,
  storeBase64Image,
  getAllReturns,
  getBase64BillAttachment,
  deleteBase64Attachment,
  getPharmacyReturns,
  getBillAttachmentUrlEnhanced
} from "@/lib/data";
import { auth } from "@/lib/firebase";
import Select from "react-select";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const db = getFirestore();

// Helper function to extract username from email
const getDisplayName = (emailOrName) => {
  if (!emailOrName) return "Unknown User";
  if (!emailOrName.includes('@')) return emailOrName;
  return emailOrName.split('@')[0];
};

// Format date with time
const formatDateTime = (date) => {
  if (!date) return "N/A";
  try {
    let dateObj;
    if (date && typeof date === 'object') {
      if ('toDate' in date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date.seconds !== undefined) {
        dateObj = new Date(date.seconds * 1000);
      } else if (date._seconds !== undefined) {
        dateObj = new Date(date._seconds * 1000);
      }
    }
    if (!dateObj) {
      dateObj = new Date(date);
    }
    if (isNaN(dateObj.getTime())) return "N/A";
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error("Error formatting date/time:", error, date);
    return "N/A";
  }
};

// Format Date (without time)
const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    let dateObj;
    if (date && typeof date === 'object') {
      if ('toDate' in date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date.seconds !== undefined) {
        dateObj = new Date(date.seconds * 1000);
      } else if (date._seconds !== undefined) {
        dateObj = new Date(date._seconds * 1000);
      }
    }
    if (!dateObj) {
      dateObj = new Date(date);
    }
    if (isNaN(dateObj.getTime())) return "N/A";
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error formatting date:", error, date);
    return "N/A";
  }
};

// Format Expire Date
const formatExpireDate = (date) => {
  if (!date) return "N/A";
  try {
    let dateObj;
    if (date.toDate && typeof date.toDate === "function") {
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (date.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else if (typeof date === "string") {
      dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        const match = date.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
        if (match) {
          const [, day, month, year] = match;
          const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
          ];
          const monthIndex = monthNames.findIndex((m) => m.toLowerCase() === month.toLowerCase());
          if (monthIndex !== -1) {
            dateObj = new Date(year, monthIndex, parseInt(day));
          }
        }
        if (isNaN(dateObj.getTime())) {
          const parts = date.split("/");
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const year = parseInt(parts[2]);
            dateObj = new Date(year, month, day);
          }
        }
        if (isNaN(dateObj.getTime())) {
          const parts = date.split("-");
          if (parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            dateObj = new Date(year, month, day);
          }
        }
      }
    } else {
      return "N/A";
    }
    if (isNaN(dateObj.getTime())) return "N/A";
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error formatting expire date:", error, date);
    return "N/A";
  }
};

// Format bill number for display
const formatBillNumber = (billNumber) => {
  if (!billNumber) return "N/A";
  const num = parseInt(billNumber);
  if (isNaN(num)) return billNumber.toString();
  return num.toString();
};

// Helper function to extract branch(es) from a bill
const getBillBranchDisplay = (bill) => {
  if (!bill || !bill.items || bill.items.length === 0) return "N/A";
  const branches = Array.from(new Set(bill.items.map(item => item.branch).filter(Boolean)));
  if (branches.length === 0) return "N/A";
  return branches.join(", ");
};

// Format total display
const formatTotalLine = (usd, iqd) => {
  const parts = [];
  if (usd && Math.abs(usd) > 0.001) parts.push(`$${usd.toFixed(2)}`);
  if (iqd && Math.abs(iqd) > 0.5) parts.push(`${Math.round(iqd).toLocaleString()} IQD`);
  if (parts.length === 0) return "$0.00";
  if (parts.length === 2) return `${parts[0]} | ${parts[1]}`;
  return parts[0];
};

const formatFinancialLine = (usd, iqd, hasUSD, hasIQD) => {
  const parts = [];
  if (hasUSD) parts.push(`$${(usd || 0).toFixed(2)}`);
  if (hasIQD) parts.push(`${Math.round(iqd || 0).toLocaleString()} IQD`);
  if (parts.length === 0) return "$0.00";
  if (parts.length === 2) return `${parts[0]} | ${parts[1]}`;
  return parts[0];
};

// Calculate Financial Summary (Only counting Unpaid sales and Unpaid returns)
const calculatePharmacyFinancialSummary = (
  pharmacyId,
  allBills = [],
  allReturnBills = [],
  currentBillItems = [],
  isPreview = false
) => {
  let totalUnpaidBillsUSD = 0;
  let totalUnpaidBillsIQD = 0;

  let pharmacyHasUSD = false;
  let pharmacyHasIQD = false;

  // 1. Calculate Unpaid Sales Bills
  allBills.forEach((bill) => {
    if (bill.pharmacyId !== pharmacyId) return;
    
    const billStatus = String(bill.paymentStatus || bill.status || "").toLowerCase();
    const isPaid = bill.isPaid === true || billStatus === "paid" || billStatus === "completed" || billStatus === "processed";
    if (isPaid) return; // Skip paid sales bills

    const billCurrency = bill.currency || "USD";

    bill.items?.forEach((item) => {
      if (billCurrency === "IQD") {
        pharmacyHasIQD = true;
        const price = item.outPriceIQD || item.price || 0;
        totalUnpaidBillsIQD += price * item.quantity;
      } else {
        pharmacyHasUSD = true;
        const price = item.outPriceUSD || item.price || 0;
        totalUnpaidBillsUSD += price * item.quantity;
      }
    });
  });

  // Include current bill items if previewing
  if (isPreview && currentBillItems.length > 0) {
    currentBillItems.forEach((item) => {
      const price = item.price || 0;
      if ((item.outPriceIQD || 0) > 0 && !(item.outPriceUSD > 0)) {
        pharmacyHasIQD = true;
        totalUnpaidBillsIQD += price * item.quantity;
      } else if ((item.outPriceUSD || 0) > 0) {
        pharmacyHasUSD = true;
        totalUnpaidBillsUSD += price * item.quantity;
      } else {
        if (item.originalCurrency === "IQD") {
          pharmacyHasIQD = true;
          totalUnpaidBillsIQD += price * item.quantity;
        } else {
          pharmacyHasUSD = true;
          totalUnpaidBillsUSD += price * item.quantity;
        }
      }
    });
  }

  // 2. Calculate Unpaid Return Bills Only
  let totalReturnBillsUSD = 0;
  let totalReturnBillsIQD = 0;

  allReturnBills.forEach((ret) => {
    if (ret.pharmacyId !== pharmacyId) return;

    const returnStatus = String(ret.paymentStatus || ret.status || "").toLowerCase();
    const isPaidOrProcessed = ret.isPaid === true || returnStatus === "paid" || returnStatus === "processed" || returnStatus === "completed";
    if (isPaidOrProcessed) return;

    if (ret.totalReturnAmountUSD !== undefined && ret.totalReturnAmountIQD !== undefined) {
      totalReturnBillsUSD += ret.totalReturnAmountUSD || 0;
      totalReturnBillsIQD += ret.totalReturnAmountIQD || 0;
      return;
    }

    let itemsToProcess = [];

    if (ret.items && Array.isArray(ret.items) && ret.items.length > 0) {
      itemsToProcess = ret.items;
    } else if (ret.barcode) {
      itemsToProcess = [ret];
    } else {
      return;
    }

    itemsToProcess.forEach((item) => {
      const qty = item.returnQuantity || item.quantity || 0;
      if (qty === 0) return;

      const currency = item.currency || ret.currency || "IQD";
      const price = item.returnPrice || item.price || 0;

      if (currency === "IQD") {
        totalReturnBillsIQD += price * qty;
      } else {
        totalReturnBillsUSD += price * qty;
      }
    });
  });

  // Calculate Net Remaining Balance
  const remainingUnpaidUSD = totalUnpaidBillsUSD - totalReturnBillsUSD;
  const remainingUnpaidIQD = totalUnpaidBillsIQD - totalReturnBillsIQD;

  if (totalReturnBillsUSD !== 0) pharmacyHasUSD = true;
  if (totalReturnBillsIQD !== 0) pharmacyHasIQD = true;

  return {
    totalUnpaidBillsUSD,
    totalUnpaidBillsIQD,
    totalReturnBillsUSD,
    totalReturnBillsIQD,
    remainingUnpaidUSD,
    remainingUnpaidIQD,
    pharmacyHasUSD,
    pharmacyHasIQD,
  };
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  container: {
    maxWidth: "100%",
    margin: "0 auto",
    padding: "10px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: "#f5f6fa",
    minHeight: "100vh",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  formContainer: {
    backgroundColor: "white",
    padding: "16px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    border: "1px solid #e1e8ed",
    marginBottom: "20px",
    overflow: "hidden",
  },
  inputGroup: {
    marginBottom: "15px",
    position: "relative",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontWeight: "600",
    color: "#2c3e50",
    fontSize: "15px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "2px solid #e1e8ed",
    borderRadius: "8px",
    fontSize: "16px",
    boxSizing: "border-box",
    backgroundColor: "white",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    outline: "none",
    WebkitAppearance: "none",
  },
  searchSection: {
    marginBottom: "15px",
  },
  suggestionsDropdown: {
    position: "absolute",
    width: "100%",
    backgroundColor: "white",
    border: "2px solid #3498db",
    borderRadius: "8px",
    marginTop: "2px",
    maxHeight: "250px",
    overflowY: "auto",
    zIndex: "1000",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  searchResults: {
    marginTop: "10px",
    backgroundColor: "white",
    border: "2px solid #e1e8ed",
    borderRadius: "8px",
    overflow: "hidden",
    maxWidth: "100%",
  },
  tableScrollWrapper: {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    maxWidth: "100%",
    padding: "4px 0",
  },
  itemGroup: {
    border: "2px solid #e1e8ed",
    marginBottom: "10px",
    borderRadius: "8px",
    overflow: "hidden",
    backgroundColor: "white",
  },
  itemGroupHeader: {
    backgroundColor: "#f8fafc",
    padding: "14px 16px",
    borderBottom: "2px solid #3498db",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    minWidth: "650px",
  },
  tableCell: {
    padding: "10px 8px",
    borderBottom: "1px solid #e1e8ed",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    whiteSpace: "nowrap",
  },
  tableHeader: {
    backgroundColor: "#34495e",
    color: "white",
    padding: "10px 8px",
    textAlign: "left",
    fontSize: "14px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    whiteSpace: "nowrap",
  },
  historyButton: {
    backgroundColor: "#34495e",
    color: "white",
    border: "none",
    padding: "8px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    touchAction: "manipulation",
    display: "flex",
    alignItems: "center",
    gap: "6px"
  },
  selectedItems: {
    marginTop: "20px",
  },
  selectedItem: {
    display: "flex",
    flexDirection: "column",
    padding: "14px",
    border: "2px solid #e1e8ed",
    borderRadius: "8px",
    marginBottom: "10px",
    backgroundColor: "#f8f9fa",
    transition: "all 0.3s ease",
    gap: "10px",
  },
  lockedItem: {
    opacity: 0.85,
    backgroundColor: "#fff5f5",
    border: "2px solid #e74c3c",
  },
  warningBadge: {
    backgroundColor: "#e74c3c",
    color: "white",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "600",
    marginLeft: "6px",
    fontFamily: "'NRT-Bd', sans-serif",
    display: "inline-block",
    marginTop: "4px",
  },
  itemDetails: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontWeight: "600",
    fontSize: "15px",
    marginBottom: "4px",
    color: "#2c3e50",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    wordBreak: "break-word",
  },
  itemMeta: {
    fontSize: "13px",
    color: "#7f8c8d",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  quantityInput: {
    width: "60px",
    padding: "8px",
    border: "2px solid #e1e8ed",
    borderRadius: "6px",
    textAlign: "center",
    fontSize: "15px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    WebkitAppearance: "none",
  },
  priceInput: {
    width: "90px",
    padding: "8px",
    border: "2px solid #e1e8ed",
    borderRadius: "6px",
    textAlign: "center",
    fontSize: "15px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    WebkitAppearance: "none",
  },
  removeButton: {
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    padding: "8px 14px",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    touchAction: "manipulation",
  },
  total: {
    textAlign: "right",
    fontSize: "17px",
    fontWeight: "600",
    marginTop: "12px",
    padding: "12px",
    backgroundColor: "#34495e",
    color: "white",
    borderRadius: "8px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  buttonContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "15px",
  },
  button: {
    backgroundColor: "#3498db",
    color: "white",
    padding: "14px 20px",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    touchAction: "manipulation",
  },
  updateButton: {
    backgroundColor: "#f39c12",
    color: "white",
    padding: "14px 20px",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    touchAction: "manipulation",
  },
  previewButton: {
    backgroundColor: "#6c757d",
    color: "white",
    padding: "14px 20px",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    touchAction: "manipulation",
  },
  cancelButton: {
    backgroundColor: "#dc3545",
    color: "white",
    padding: "14px 20px",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    touchAction: "manipulation",
  },
  buttonDisabled: {
    backgroundColor: "#bdc3c7",
    color: "#7f8c8d",
    padding: "14px 20px",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "not-allowed",
    width: "100%",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    touchAction: "manipulation",
  },
  error: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
    padding: "16px 20px",
    borderRadius: "8px",
    marginBottom: "15px",
    border: "1px solid #f5c6cb",
    fontSize: "15px",
    position: "relative",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  errorIcon: {
    fontSize: "24px",
    flexShrink: 0,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontWeight: "700",
    fontSize: "16px",
    marginBottom: "4px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  errorMessage: {
    fontSize: "14px",
    lineHeight: "1.5",
  },
  errorContact: {
    marginTop: "6px",
    fontSize: "13px",
    color: "#856404",
    backgroundColor: "#fff3cd",
    padding: "6px 12px",
    borderRadius: "4px",
    display: "inline-block",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  errorClose: {
    background: "none",
    border: "none",
    color: "#721c24",
    cursor: "pointer",
    fontSize: "20px",
    padding: "0 4px",
    flexShrink: 0,
    opacity: 0.6,
    transition: "opacity 0.2s ease",
  },
  recentBillsSection: {
    backgroundColor: "white",
    padding: "16px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    border: "1px solid #e1e8ed",
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "15px",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#2c3e50",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    margin: 0,
  },
  advancedSearchButton: {
    backgroundColor: "#3498db",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    touchAction: "manipulation",
  },
  searchFilters: {
    backgroundColor: "#f8f9fa",
    padding: "14px",
    borderRadius: "8px",
    border: "1px solid #e1e8ed",
    marginBottom: "15px",
  },
  filterSection: {
    padding: "4px 0",
  },
  filterSectionTitle: {
    fontSize: "17px",
    fontWeight: "600",
    marginBottom: "12px",
    color: "#2c3e50",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  filterRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
    marginBottom: "10px",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
  },
  filterLabel: {
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "4px",
    color: "#2c3e50",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  filterInput: {
    padding: "10px 12px",
    border: "1px solid #e1e8ed",
    borderRadius: "4px",
    fontSize: "15px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    width: "100%",
    boxSizing: "border-box",
  },
  filterSelect: {
    padding: "10px 12px",
    border: "1px solid #e1e8ed",
    borderRadius: "4px",
    fontSize: "15px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: "white",
    width: "100%",
    boxSizing: "border-box",
  },
  globalSearchGroup: {
    width: "100%",
  },
  globalSearchInput: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e1e8ed",
    borderRadius: "4px",
    fontSize: "15px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    boxSizing: "border-box",
  },
  specificItemsGroup: {
    width: "100%",
  },
  filterActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "10px",
  },
  clearFiltersButton: {
    backgroundColor: "#95a5a6",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "4px",
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    touchAction: "manipulation",
  },
  tableContainer: {
    marginBottom: "10px",
    borderRadius: "8px",
    border: "1px solid #e1e8ed",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  billsTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    minWidth: "750px",
  },
  tableHeaderSortable: {
    backgroundColor: "#34495e",
    color: "white",
    padding: "12px 10px",
    textAlign: "left",
    fontSize: "14px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    cursor: "pointer",
    userSelect: "none",
    transition: "background-color 0.2s ease",
    whiteSpace: "nowrap",
  },
  tableHeaderSortablee: {
    backgroundColor: "#34495e",
    color: "white",
    padding: "12px 10px",
    textAlign: "center",
    fontSize: "14px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    cursor: "pointer",
    userSelect: "none",
    transition: "background-color 0.2s ease",
    whiteSpace: "nowrap",
  },
  tableRowEven: {
    backgroundColor: "#f8f9fa",
  },
  tableRowOdd: {
    backgroundColor: "white",
  },
  selectedRow: {
    backgroundColor: "#e3f2fd",
    borderLeft: "4px solid #2196f3",
  },
  tableCellCenter: {
    padding: "12px 10px",
    borderBottom: "1px solid #e1e8ed",
    textAlign: "center",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  tableCellCenterdatee: {
    padding: "12px 10px",
    borderBottom: "1px solid #e1e8ed",
    textAlign: "left",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    whiteSpace: "nowrap",
  },
  tableCellRightttt: {
    padding: "12px 10px",
    borderBottom: "1px solid #e1e8ed",
    textAlign: "center",
    fontSize: "16px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    fontWeight: "600",
  },
  detailCell: {
    padding: "0",
    borderBottom: "1px solid #e1e8ed",
  },
  paymentBadge: {
    padding: "6px 10px",
    borderRadius: "12px",
    fontSize: "13px",
    fontWeight: "600",
    color: "white",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  branchBadge: {
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    display: "inline-block",
  },
  actionButtons: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    justifyContent: "center",
  },
  editButton: {
    backgroundColor: "#f39c12",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    touchAction: "manipulation",
  },
  printSmallButton: {
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    touchAction: "manipulation",
  },
  whatsappButton: {
    backgroundColor: "#25D366",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    touchAction: "manipulation",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    transition: "all 0.3s ease",
    width: "100%",
  },
  whatsappButtonDisabled: {
    backgroundColor: "#a8e6c1",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "not-allowed",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    touchAction: "manipulation",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    opacity: 0.6,
    width: "100%",
  },
  attachButton: {
    backgroundColor: "#9b59b6",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    width: "100%",
    touchAction: "manipulation",
  },
  uploadButton: {
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    width: "100%",
    marginTop: "3px",
    touchAction: "manipulation",
  },
  rescanButton: {
    backgroundColor: "#f39c12",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    width: "100%",
    marginTop: "3px",
    touchAction: "manipulation",
  },
  viewAttachmentButton: {
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    width: "100%",
    touchAction: "manipulation",
  },
  billDetails: {
    backgroundColor: "#f8f9fa",
    padding: "14px",
    borderRadius: "8px",
    margin: "10px 0",
    border: "1px solid #e1e8ed",
    overflow: "hidden",
  },
  billDetailsHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "12px",
  },
  billDetailsTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#2c3e50",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    margin: 0,
  },
  billDetailsActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  closeDetailsButton: {
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    touchAction: "manipulation",
  },
  rowContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr auto',
    gap: '12px',
    alignItems: 'end',
    marginBottom: '12px',
    padding: '16px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    border: '1px solid #f0f0f0',
  },
  noteRowContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
    marginBottom: '20px',
    padding: '0 16px 16px 16px',
    backgroundColor: '#ffffff',
    borderRadius: '0 0 12px 12px',
    borderLeft: '1px solid #f0f0f0',
    borderRight: '1px solid #f0f0f0',
    borderBottom: '1px solid #f0f0f0',
  },
  noteFieldFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
  },
  textareaFieldFull: {
    padding: '10px 14px',
    fontSize: '14px',
    border: '1.5px solid #e9ecef',
    borderRadius: '8px',
    width: '100%',
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
    color: '#4b5563',
    boxSizing: 'border-box',
  },
  billInfoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
    marginBottom: "15px",
  },
  billInfoItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    flexWrap: "wrap",
  },
  itemsTableContainer: {
    borderRadius: "8px",
    overflow: "hidden",
    border: "1px solid #e1e8ed",
    maxWidth: "100%",
  },
  enhancedItemsTable: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    fontSize: "14px",
    minWidth: "500px",
  },
  enhancedTableHeader: {
    backgroundColor: "#34495e",
    color: "white",
    padding: "12px 10px",
    textAlign: "left",
    fontWeight: "600",
    fontSize: "14px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    border: "none",
    whiteSpace: "nowrap",
  },
  enhancedTableCell: {
    padding: "10px 10px",
    borderBottom: "1px solid #e8ecef",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  enhancedTableRow: {
    transition: "background-color 0.2s ease",
  },
  enhancedTableRowEven: {
    backgroundColor: "#f8f9fa",
  },
  enhancedTableRowOdd: {
    backgroundColor: "white",
  },
  amountCell: {
    fontWeight: "600",
    color: "#2c3e50",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  copyButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    marginLeft: "4px",
    padding: "0 4px",
    touchAction: "manipulation",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "15px",
    gap: "5px",
    flexWrap: "wrap",
  },
  paginationButton: {
    padding: "8px 12px",
    border: "1px solid #e1e8ed",
    backgroundColor: "white",
    color: "#2c3e50",
    cursor: "pointer",
    borderRadius: "4px",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    touchAction: "manipulation",
    minWidth: "40px",
  },
  paginationButtonActive: {
    backgroundColor: "#3498db",
    color: "white",
    borderColor: "#3498db",
  },
  noBills: {
    textAlign: "center",
    color: "#7f8c8d",
    fontSize: "16px",
    padding: "30px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    padding: "10px",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "95%",
    maxHeight: "95vh",
    overflow: "auto",
    boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
  },
  modalHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px",
    borderBottom: "1px solid #e1e8ed",
    backgroundColor: "#f8f9fa",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#2c3e50",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    margin: 0,
  },
  modalActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  printButton: {
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    touchAction: "manipulation",
  },
  closeButton: {
    backgroundColor: "#95a5a6",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    transition: "all 0.3s ease",
    touchAction: "manipulation",
  },
  billTemplate: {
    padding: "20px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    color: "#2c3e50",
    lineHeight: "1.6",
    backgroundColor: "white",
    fontSize: "14px",
  },
  editingBillDisplay: {
    backgroundColor: "#fff3cd",
    border: "1px solid #ffeaa7",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "15px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    color: "#856404",
    fontSize: "16px",
    textAlign: "center",
  },
  dateInput: {
    flex: 1,
    padding: "10px",
    border: "1px solid #e1e8ed",
    borderRadius: "4px",
    fontSize: "15px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    width: "100%",
    boxSizing: "border-box",
  },
  dateField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
  },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  dateInputField: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1.5px solid #e9ecef',
    borderRadius: '8px',
    width: '100%',
    outline: 'none',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    fontWeight: '500',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  selectField: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1.5px solid #e9ecef',
    borderRadius: '8px',
    width: '100%',
    backgroundColor: '#ffffff',
    outline: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#1f2937',
    fontWeight: '500',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  selectedItemControls: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
  },
  itemControlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  itemControlLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
  },
  buttonRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginTop: '15px',
  },
  buttonRowSingle: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '10px',
    marginTop: '15px',
  },
  consignmentContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
  },
  consignmentCheckbox: {
    width: '18px',
    height: '18px',
    accentColor: '#f39c12',
    cursor: 'pointer',
  },
  consignmentLabel: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#2c3e50',
    cursor: 'pointer',
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  historyTableContainer: {
    padding: "20px",
    overflowX: "auto",
  },
  historyTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
    minWidth: "700px",
  },
  historyTableHeader: {
    backgroundColor: "#3498db",
    color: "white",
    padding: "12px",
    textAlign: "center",
    fontWeight: "600",
    fontFamily: "'NRT-Bd', sans-serif",
  },
  historyTableCell: {
    padding: "12px",
    textAlign: "center",
    borderBottom: "1px solid #e1e8ed",
  },
  historyTableRowEven: {
    backgroundColor: "#f8f9fa",
  },
  historyTableRowOdd: {
    backgroundColor: "white",
  },
};

// WhatsApp Icon SVG Component
const WhatsAppIcon = ({ size = 14, color = "white" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 448 512" 
    style={{ width: size, height: size, fill: color, flexShrink: 0 }}
  >
    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.7 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
  </svg>
);

export default function SellingForm({ onBillCreated, userRole, user }) {
  const [allPharmacies, setAllPharmacies] = useState([]);
  const [showPharmacyList, setShowPharmacyList] = useState(false);
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacySuggestions, setPharmacySuggestions] = useState([]);
  const [showPharmacySuggestions, setShowPharmacySuggestions] = useState(false);
  
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState("Unpaid");
  const [billCurrency, setBillCurrency] = useState("USD");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConsignment, setIsConsignment] = useState(false);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [currentBill, setCurrentBill] = useState(null);
  const [note, setNote] = useState("");
  const [recentBills, setRecentBills] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [billsPerPage] = useState(10);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingBillNumber, setEditingBillNumber] = useState(null);
  const [editingBillDisplay, setEditingBillDisplay] = useState("");
  const [itemFilters, setItemFilters] = useState([]);
  const [itemOptions, setItemOptions] = useState([]);
  const [billAttachments, setBillAttachments] = useState({});
  const [uploadingAttachments, setUploadingAttachments] = useState({});
  const [returnBills, setReturnBills] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [returnedItemsMap, setReturnedItemsMap] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'billNumber', direction: 'desc' });
  const [sharingWhatsApp, setSharingWhatsApp] = useState({});
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    paymentStatus: "all",
    pharmacyName: "",
    branch: "all",
    consignment: "all",
    fromDate: "",
    toDate: "",
    globalSearch: "",
  });
  const [pharmacyFilterOptions, setPharmacyFilterOptions] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedItemHistory, setSelectedItemHistory] = useState([]);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState(null);

  const pharmacySearchRef = useRef(null);
  const searchQueryRef = useRef(null);

  const loadReturnedItemsForBill = useCallback(async (billNumber, resolvedPharmacyId) => {
    try {
      const pid = resolvedPharmacyId;
      if (!pid) return {};

      const returns = await getPharmacyReturns(pid);
      const billReturns = returns.filter(ret => String(ret.billNumber) === String(billNumber));

      const returnedMap = {};
      billReturns.forEach(ret => {
        const returnBillNumber = ret.returnBillNumber || ret.id || "Unknown";

        if (ret.items && Array.isArray(ret.items)) {
          ret.items.forEach(item => {
            const key = `${item.barcode}`;
            const returnQty = item.returnQuantity || 0;
            if (returnQty > 0) {
              returnedMap[key] = {
                hasReturn: true,
                returnQuantity: returnQty,
                returnBillNumber: returnBillNumber,
              };
            }
          });
        } else if (ret.barcode) {
          const key = `${ret.barcode}`;
          const returnQty = ret.returnQuantity || 0;
          if (returnQty > 0) {
            returnedMap[key] = {
              hasReturn: true,
              returnQuantity: returnQty,
              returnBillNumber: returnBillNumber,
            };
          }
        }
      });
      return returnedMap;
    } catch (error) {
      console.error("Error loading returned items:", error);
      return {};
    }
  }, []);

  const resetForm = useCallback(() => {
    setIsEditMode(false);
    setEditingBillNumber(null);
    setEditingBillDisplay("");
    setPharmacyId("");
    setPharmacySearch("");
    setPharmacyName("");
    setSelectedItems([]);
    setIsConsignment(false);
    setNote("");
    setSaleDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("Unpaid");
    setBillCurrency("USD");
    setError(null);
    setReturnedItemsMap({});
  }, []);

  const cancelEdit = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const cancelBill = useCallback(() => {
    if (selectedItems.length === 0 && !pharmacyId) {
      return;
    }
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this bill?\n\n" +
      "All selected items will be cleared."
    );
    if (confirmCancel) {
      resetForm();
      setSearchQuery("");
      setSearchResults([]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedItems, pharmacyId, resetForm]);

  const loadAllAttachments = useCallback(async (bills) => {
    const attachments = {};
    await Promise.all(bills.map(async (bill) => {
      try {
        let url = await getBase64BillAttachment(bill.billNumber);
        if (!url) url = await getBillAttachmentUrlEnhanced(bill.billNumber);
        if (url) attachments[bill.billNumber] = url;
      } catch (error) {
        console.error(`Error loading attachment for bill ${bill.billNumber}:`, error);
      }
    }));
    setBillAttachments(prev => ({ ...prev, ...attachments }));
  }, []);

  const validateBillBeforeSubmit = useCallback(() => {
    let warningMessage = "";
    selectedItems.forEach((item) => {
      const price = parseFloat(item.price) || 0;
      const net = item.originalCurrency === "IQD" ? item.netPriceIQD : item.netPriceUSD;
      const netCurrencyLabel = item.originalCurrency === "IQD" ? "IQD" : "$";
      const sellingCurrencyLabel = billCurrency === "IQD" ? "IQD" : "$";

      if (billCurrency === item.originalCurrency && price < net) {
        warningMessage += `• ${item.name}: Selling price (${sellingCurrencyLabel} ${price}) is below net price (${netCurrencyLabel} ${net})\n`;
      }
    });
    if (warningMessage) return window.confirm(`Price Warning:\n${warningMessage}\nDo you want to proceed anyway?`);
    return true;
  }, [selectedItems, billCurrency]);

  const handleItemChange = useCallback((index, field, value) => {
    const updatedItems = [...selectedItems];
    if (updatedItems[index].isLocked) {
      const item = updatedItems[index];
      alert(
        `❌ Cannot edit "${item.name}"!\n\n` +
        `This item has been returned on Return Invoice: ${item.returnBillNumber || "Unknown"}\n` +
        `Returned Quantity: ${item.returnQuantity || 0} units\n\n` +
        `To modify this return, please use the Return Invoice page.`
      );
      return;
    }
    
    if (field === "quantity") {
      const maxQty = updatedItems[index].availableQuantity || 1;
      const val = parseInt(value);
      if (value === "") {
        updatedItems[index].quantity = "";
      } else if (!isNaN(val)) {
        updatedItems[index].quantity = Math.min(Math.max(0, val), maxQty);
      }
    } else if (field === "price") {
      const parsedValue = value === "" ? "" : parseFloat(value);
      updatedItems[index].price = value; 
      
      const calcPrice = parsedValue || 0;
      if (billCurrency === "IQD") {
        updatedItems[index].outPriceIQD = calcPrice;
        updatedItems[index].outPriceUSD = 0;
      } else {
        updatedItems[index].outPriceUSD = calcPrice;
        updatedItems[index].outPriceIQD = 0;
      }
    }
    setSelectedItems(updatedItems);
  }, [selectedItems, billCurrency]);

  const handleBillCurrencyChange = useCallback((e) => {
    const newCurr = e.target.value;
    setBillCurrency(newCurr);

    const updatedItems = selectedItems.map(item => {
      const defaultPrice = newCurr === "USD" ? (item.defaultOutPriceUSD || 0) : (item.defaultOutPriceIQD || 0);
      const initialPrice = defaultPrice > 0 ? defaultPrice : "";
      return {
        ...item,
        price: initialPrice,
        outPriceUSD: newCurr === "USD" ? (initialPrice || 0) : 0,
        outPriceIQD: newCurr === "IQD" ? (initialPrice || 0) : 0,
      };
    });
    setSelectedItems(updatedItems);
  }, [selectedItems]);

  const handleRemoveItem = useCallback((index) => {
    const item = selectedItems[index];
    if (item.isLocked) {
      alert(
        `❌ Cannot remove "${item.name}"!\n\n` +
        `This item has been returned on Return Invoice: ${item.returnBillNumber || "Unknown"}\n` +
        `Returned Quantity: ${item.returnQuantity || 0} units\n\n` +
        `To modify this return, please use the Return Invoice page.`
      );
      return;
    }
    const updatedItems = [...selectedItems];
    updatedItems.splice(index, 1);
    setSelectedItems(updatedItems);
  }, [selectedItems]);

  // ─── LOAD BILL FOR EDITING (LOCKED FOR BILLS WITH RETURNS) ──────
  const loadBillForEditing = useCallback(async (bill) => {
    // 1. Check if the bill has any return invoice attached
    const returnedMap = await loadReturnedItemsForBill(bill.billNumber, bill.pharmacyId);
    const hasAnyReturns = Object.values(returnedMap).some(item => item.hasReturn);

    if (hasAnyReturns) {
      const returnInvoices = Array.from(
        new Set(Object.values(returnedMap).map(i => i.returnBillNumber).filter(Boolean))
      ).join(", ");

      alert(
        `❌ Cannot edit Bill #${formatBillNumber(bill.billNumber)}!\n` +
        `ببورە! ئەم وەسڵی فرۆشە استرجاعی تیا کراوە بە ژمارە وەسڵی استرجاع: ${returnInvoices || "Return Invoices"} ` 
      );
      return;
    }

    setIsEditMode(true);
    setEditingBillNumber(bill.billNumber);
    setEditingBillDisplay(`Bill #${formatBillNumber(bill.billNumber)} - ${bill.pharmacyName || "N/A"} - ${formatDate(bill.date)}`);
    setPharmacyId(bill.pharmacyId);
    setPharmacyName(bill.pharmacyName || "");

    const pharmacyBill = recentBills.find((b) => b.pharmacyId === bill.pharmacyId);
    if (pharmacyBill && pharmacyBill.pharmacyCode) setPharmacySearch(pharmacyBill.pharmacyCode);
    else if (bill.pharmacyName) setPharmacySearch(bill.pharmacyName);

    let billDate = bill.date;
    if (billDate) {
      if (typeof billDate === 'object' && 'toDate' in billDate) {
        billDate = billDate.toDate();
      } else if (billDate instanceof Date) {
        billDate = billDate;
      } else if (typeof billDate === 'string') {
        billDate = new Date(billDate);
      }
      if (billDate instanceof Date && !isNaN(billDate.getTime())) {
        setSaleDate(billDate.toISOString().split("T")[0]);
      } else {
        setSaleDate(new Date().toISOString().split("T")[0]);
      }
    } else {
      setSaleDate(new Date().toISOString().split("T")[0]);
    }

    setPaymentMethod(bill.paymentStatus || "Unpaid");
    setIsConsignment(bill.isConsignment || false);
    setNote(bill.note || "");

    let inferredCurrency = bill.currency || "USD";
    if (!bill.currency && bill.items && bill.items.length > 0) {
      if (bill.items[0].outPriceIQD > 0 && !bill.items[0].outPriceUSD) {
        inferredCurrency = "IQD";
      }
    }
    setBillCurrency(inferredCurrency);
    setReturnedItemsMap(returnedMap);

    const allBills = await searchSoldBills("");

    const processedItems = bill.items.map((item) => {
      const originalCurrency = item.originalCurrency || "USD";
      const branch = item.branch || "Slemany";

      const matchingStoreItems = storeItems.filter(si =>
        si.barcode === item.barcode &&
        si.originalCurrency === originalCurrency &&
        si.branch === branch
      );

      let currentStock = 0;
      for (const si of matchingStoreItems) {
        currentStock += si.quantity || 0;
      }

      let totalSoldQuantity = 0;
      for (const billItem of allBills) {
        if (billItem.billNumber === bill.billNumber) continue;
        const foundItem = billItem.items?.find(i => 
          i.barcode === item.barcode && 
          i.originalCurrency === originalCurrency &&
          i.branch === branch
        );
        if (foundItem) {
          totalSoldQuantity += foundItem.quantity || 0;
        }
      }

      const originalStock = currentStock + totalSoldQuantity + (item.quantity || 0);
      const availableQuantity = originalStock - totalSoldQuantity;

      let bestBatchId = item.batchId;
      if (matchingStoreItems.length > 0) {
        const originalBatch = matchingStoreItems.find(si => si.id === item.batchId);
        if (originalBatch) {
          bestBatchId = originalBatch.id;
        } else {
          const sorted = [...matchingStoreItems].sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
          if (sorted.length > 0 && sorted[0].quantity > 0) {
            bestBatchId = sorted[0].id;
          }
        }
      }

      let displayPrice = item.price || 0;
      if (inferredCurrency === "IQD") {
        displayPrice = item.outPriceIQD || item.price || 0;
      } else {
        displayPrice = item.outPriceUSD || item.price || 0;
      }

      const defUSD = originalCurrency === "USD" ? (item.outPriceUSD || item.price) : 0;
      const defIQD = originalCurrency === "IQD" ? (item.outPriceIQD || item.price) : 0;

      return {
        ...item,
        originalQuantity: item.quantity,
        originalBatchId: item.batchId,
        batchId: bestBatchId || `batch-${item.barcode}-${item.expireDate}`,
        availableQuantity: availableQuantity,
        quantity: item.quantity,
        netPrice: item.netPrice || 0,
        price: displayPrice,
        originalCurrency: originalCurrency || "USD",
        defaultOutPriceUSD: defUSD,
        defaultOutPriceIQD: defIQD,
        outPriceUSD: item.outPriceUSD || (inferredCurrency === "USD" ? displayPrice : 0),
        outPriceIQD: item.outPriceIQD || (inferredCurrency === "IQD" ? displayPrice : 0),
        hasReturn: false,
        isLocked: false,
        returnQuantity: 0,
        returnBillNumber: "",
        currentStock: currentStock,
        totalSoldOtherBills: totalSoldQuantity,
        originalStock: originalStock,
      };
    });

    setSelectedItems(processedItems);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [recentBills, storeItems, loadReturnedItemsForBill]);

 const handleUpdateBill = useCallback(async () => {
    if (!pharmacyId) { setError("Please select a pharmacy."); return; }
    if (selectedItems.length === 0) { setError("Please add at least one item."); return; }
    if (!editingBillNumber) { setError("No bill selected for update."); return; }

    const lockedItems = selectedItems.filter(item => item.isLocked);
    if (lockedItems.length > 0) {
      const lockedDetails = lockedItems.map(item =>
        `• ${item.name}: Returned ${item.returnQuantity || 0} units on ${item.returnBillNumber || "Return Invoice"}`
      ).join("\n");
      alert(
        `❌ Cannot update bill!\n\n` +
        `The following items have been returned and cannot be edited:\n\n` +
        `${lockedDetails}\n\n` +
        `To modify these items, use the Return Invoice(s), not the original sale bill.`
      );
      return;
    }

    if (!validateBillBeforeSubmit()) return;

    setIsLoading(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;
      let updaterEmail = "unknown";
      let updaterName = "Unknown User";
      if (currentUser) {
        updaterEmail = currentUser.email || "unknown";
        updaterName = getDisplayName(currentUser.displayName || currentUser.email);
      } else if (user) {
        updaterEmail = user.email || user.user?.email || "unknown";
        updaterName = getDisplayName(user.displayName || user.name || user.user?.displayName || user.email);
      }

      const preparedItems = selectedItems.map((item) => ({
        id: item.id || null,
        barcode: item.barcode,
        name: item.name,
        quantity: parseInt(item.quantity) || 0,
        originalQuantity: item.originalQuantity !== undefined ? parseInt(item.originalQuantity) : (parseInt(item.quantity) || 0),
        quantity_original: item.originalQuantity !== undefined ? parseInt(item.originalQuantity) : (parseInt(item.quantity) || 0),
        originalBatchId: item.originalBatchId || item.batchId,
        netPriceUSD: item.netPriceUSD || 0,
        netPriceIQD: item.netPriceIQD || 0,
        outPriceUSD: billCurrency === "USD" ? (parseFloat(item.price) || 0) : 0,
        outPriceIQD: billCurrency === "IQD" ? (parseFloat(item.price) || 0) : 0,
        price: parseFloat(item.price) || 0,
        expireDate: item.expireDate,
        batchId: item.batchId,
        originalCurrency: item.originalCurrency || "USD",
        branch: item.branch || "Slemany",
        isConsignment: isConsignment || false,
        consignmentOwnerId: isConsignment ? pharmacyId : null,
        netPriceUSD_original: item.netPriceUSD || 0,
        netPriceIQD_original: item.netPriceIQD || 0,
        outPriceUSD_original: item.outPriceUSD || 0,
        outPriceIQD_original: item.outPriceIQD || 0,
        expireDate_original: item.expireDate || null,
        isConsignment_original: isConsignment || false,
        consignmentOwnerId_original: isConsignment ? pharmacyId : null,
      }));

      const filteredItems = preparedItems.filter(item => item.quantity >= 0);

      if (filteredItems.length === 0) {
        setError("Cannot update bill with no items. Please add at least one item.");
        setIsLoading(false);
        return;
      }

      let dateToSave = saleDate;
      if (editingBillNumber) {
        const originalBill = recentBills.find(b => b.billNumber === editingBillNumber);
        if (originalBill && originalBill.date) {
          const originalDate = new Date(originalBill.date);
          const [year, month, day] = saleDate.split('-').map(Number);
          const preservedDate = new Date(originalDate);
          preservedDate.setFullYear(year);
          preservedDate.setMonth(month - 1);
          preservedDate.setDate(day);
          dateToSave = preservedDate;
        }
      }

      // Calculate totals based on active currency
      let calculatedTotalUSD = 0;
      let calculatedTotalIQD = 0;

      filteredItems.forEach((item) => {
        const qty = parseInt(item.quantity) || 0;
        const unitPrice = parseFloat(item.price) || 0;
        if (billCurrency === "IQD") {
          calculatedTotalIQD += unitPrice * qty;
        } else {
          calculatedTotalUSD += unitPrice * qty;
        }
      });

      const updatedBill = await updateSoldBill(editingBillNumber, {
        items: filteredItems,
        pharmacyId,
        pharmacyName,
        currency: billCurrency,
        date: dateToSave,
        paymentMethod,
        isConsignment,
        note: note.trim(),
        updatedBy: updaterEmail,
        updatedByName: updaterName,
        totalAmountUSD: calculatedTotalUSD,
        totalAmountIQD: calculatedTotalIQD,
        totalAmount: billCurrency === "IQD" ? calculatedTotalIQD : calculatedTotalUSD,
      });

      // Mark the bill to be considered in financial summary during preview
      updatedBill.isNew = true;

      if (onBillCreated) onBillCreated(updatedBill);
      setCurrentBill(updatedBill);

      setIsLoading(false);
      setShowBillPreview(true);

      alert(`✅ Bill #${formatBillNumber(editingBillNumber)} updated successfully!`);

      setTimeout(() => {
        printBill(updatedBill);
      }, 300);

      getStoreItems(true).then(setStoreItems);
      searchSoldBills("").then((bills) => {
        const sorted = bills.sort((a, b) => (parseInt(b.billNumber) || 0) - (parseInt(a.billNumber) || 0));
        setRecentBills(sorted);
        loadAllAttachments(sorted);
        if (selectedBill && selectedBill.billNumber === editingBillNumber) {
          const updated = sorted.find(b => b.billNumber === editingBillNumber);
          if (updated) setSelectedBill(updated);
        }
      });
      getAllReturns().then(setReturnBills);

      resetForm();
    } catch (error) {
      console.error("Error updating bill:", error);
      setError(error.message || "Failed to update bill. Please try again.");
      setIsLoading(false);
    }
  }, [pharmacyId, selectedItems, validateBillBeforeSubmit, editingBillNumber, user, onBillCreated, pharmacyName, saleDate, paymentMethod, isConsignment, note, selectedBill, loadAllAttachments, recentBills, resetForm, billCurrency]);

  const generateSellingBillNumber = useCallback(async () => {
    try {
      const billsRef = collection(db, "soldBills");
      const snapshot = await getDocs(billsRef);
      let maxBillNumber = 260000;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const billNumber = parseInt(data.billNumber);
        if (!isNaN(billNumber) && billNumber > maxBillNumber && billNumber >= 260000 && billNumber < 270000) {
          maxBillNumber = billNumber;
        }
      });
      return maxBillNumber < 260001 ? 260001 : maxBillNumber + 1;
    } catch (error) {
      console.error("Error generating selling bill number:", error);
      return 260000 + (Date.now() % 1000) + 1;
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!pharmacyId) { setError("Please select a pharmacy."); return; }
    
    const validItems = selectedItems.filter(item => {
      const q = parseInt(item.quantity);
      return !isNaN(q) && q >= 0;
    });

    if (validItems.length === 0) { setError("Please add at least one item with a valid quantity."); return; }
    
    if (!validateBillBeforeSubmit()) return;

    setIsLoading(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;
      let creatorEmail = "unknown";
      let creatorName = "Unknown User";
      if (currentUser) {
        creatorEmail = currentUser.email || "unknown";
        creatorName = getDisplayName(currentUser.displayName || currentUser.email);
      } else if (user) {
        creatorEmail = user.email || user.user?.email || "unknown";
        creatorName = getDisplayName(user.displayName || user.name || user.user?.displayName || user.email);
      }

      const preparedItems = validItems.map((item) => ({
        barcode: item.barcode,
        name: item.name,
        quantity: parseInt(item.quantity) || 0,
        netPriceUSD: item.netPriceUSD || 0,
        netPriceIQD: item.netPriceIQD || 0,
        outPriceUSD: billCurrency === "USD" ? (parseFloat(item.price) || 0) : 0,
        outPriceIQD: billCurrency === "IQD" ? (parseFloat(item.price) || 0) : 0,
        basePriceUSD: item.basePriceUSD || 0,
        basePriceIQD: item.basePriceIQD || 0,
        price: parseFloat(item.price) || 0,
        expireDate: item.expireDate,
        batchId: item.batchId,
        originalCurrency: item.originalCurrency || "USD",
        branch: item.branch || "Slemany",
      }));

      const billNumber = await generateSellingBillNumber();

      const bill = await createSoldBill({
        items: preparedItems,
        pharmacyId,
        pharmacyName,
        currency: billCurrency,
        paymentMethod,
        isConsignment,
        note: note.trim(),
        createdBy: creatorEmail,
        createdByName: creatorName,
        billNumber,
      });

      // Mark the bill as new so it's counted in the preview total
      bill.isNew = true;

      if (onBillCreated) onBillCreated(bill);
      setCurrentBill(bill);

      setIsLoading(false);
      setShowBillPreview(true);

      setSelectedItems([]);
      setNote("");
      alert(`Bill #${billNumber} created successfully by ${creatorName}!`);

      // Trigger auto-print
      setTimeout(() => {
        printBill(bill);
      }, 300);

      getStoreItems(true).then(setStoreItems);
      searchSoldBills("").then((bills) => {
        const sorted = bills.sort((a, b) => (parseInt(b.billNumber) || 0) - (parseInt(a.billNumber) || 0));
        setRecentBills(sorted);
        loadAllAttachments(sorted);
      });
      getAllReturns().then(setReturnBills);

    } catch (error) {
      console.error("Error creating bill:", error);
      setError(error.message || "Failed to create bill. Please try again.");
      setIsLoading(false);
    }
  }, [pharmacyId, selectedItems, validateBillBeforeSubmit, user, onBillCreated, paymentMethod, isConsignment, note, pharmacyName, generateSellingBillNumber, loadAllAttachments, billCurrency]);

  const processDocumentImage = useCallback(async (billNumber, base64Image, sourceType) => {
    if (!billNumber) { alert("Please select a bill first"); return; }
    setIsScanning(true);
    setUploadingAttachments((prev) => ({ ...prev, [billNumber]: true }));
    try {
      const optimizedImage = await convertToOptimizedGrayscale(base64Image);
      await deleteBase64Attachment(billNumber);
      await storeBase64Image(billNumber, optimizedImage, `${sourceType}_${Date.now()}.jpg`, 'image/jpeg');
      setBillAttachments((prev) => ({ ...prev, [billNumber]: optimizedImage }));
      setRecentBills((prevBills) =>
        prevBills.map((bill) =>
          bill.billNumber === billNumber ? { ...bill, hasAttachment: true, attachmentUrl: optimizedImage } : bill
        )
      );
      alert("Document processed successfully! Image has been optimized for clarity.");
    } catch (error) {
      console.error(`Error with ${sourceType}:`, error);
      alert(`Processing failed: ${error.message}`);
    } finally {
      setIsScanning(false);
      setUploadingAttachments((prev) => ({ ...prev, [billNumber]: false }));
    }
  }, []);

  const convertToOptimizedGrayscale = (base64Image) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxDimension = 1200;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          let adjusted = luminance;
          if (adjusted < 128) { adjusted = Math.pow(adjusted / 128, 1.2) * 128; }
          else { adjusted = 128 + Math.pow((adjusted - 128) / 128, 0.8) * 128; }
          adjusted = ((adjusted - 128) * 1.1) + 128;
          adjusted = Math.max(0, Math.min(255, adjusted));
          data[i] = adjusted; data[i + 1] = adjusted; data[i + 2] = adjusted;
        }
        ctx.putImageData(imageData, 0, 0);
        const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        const sizeInBytes = Math.round((optimizedBase64.length * 3) / 4);
        if (sizeInBytes > 500 * 1024) {
          const finalCanvas = document.createElement('canvas');
          const finalCtx = finalCanvas.getContext('2d');
          finalCanvas.width = Math.round(width * 0.8);
          finalCanvas.height = Math.round(height * 0.8);
          finalCtx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);
          resolve(finalCanvas.toDataURL('image/jpeg', 0.75));
        } else {
          resolve(optimizedBase64);
        }
      };
      img.onerror = () => resolve(base64Image);
      img.src = base64Image;
    });
  };

  const captureImageFromCamera = () => new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.style.display = 'none';
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) { document.body.removeChild(input); reject(new Error('No file selected')); return; }
      if (!file.type.startsWith('image/')) { alert('Please select an image file'); document.body.removeChild(input); reject(new Error('Not an image file')); return; }
      const reader = new FileReader();
      reader.onload = (e) => { document.body.removeChild(input); resolve(e.target.result); };
      reader.onerror = () => { document.body.removeChild(input); reject(new Error('Failed to read file')); };
      reader.readAsDataURL(file);
    };
    input.oncancel = () => { document.body.removeChild(input); reject(new Error('Camera access cancelled')); };
    document.body.appendChild(input);
    input.click();
  });

  const selectFileFromDevice = () => new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) { document.body.removeChild(input); reject(new Error('No file selected')); return; }
      if (!file.type.startsWith('image/')) { alert('Please select an image file'); document.body.removeChild(input); reject(new Error('Not an image file')); return; }
      const reader = new FileReader();
      reader.onload = (e) => { document.body.removeChild(input); resolve(e.target.result); };
      reader.onerror = () => { document.body.removeChild(input); reject(new Error('Failed to read file')); };
      reader.readAsDataURL(file);
    };
    input.oncancel = () => { document.body.removeChild(input); reject(new Error('File selection cancelled')); };
    document.body.appendChild(input);
    input.click();
  });

  const handleScanDocument = useCallback(async (billNumber) => {
    try {
      const base64Image = await captureImageFromCamera();
      await processDocumentImage(billNumber, base64Image, 'scan');
    } catch (error) {
      console.error('Camera scan error:', error);
      alert(`Camera scan failed: ${error.message}`);
    }
  }, [processDocumentImage]);

  const handleFileUpload = useCallback(async (billNumber) => {
    try {
      const base64Image = await selectFileFromDevice();
      await processDocumentImage(billNumber, base64Image, 'upload');
    } catch (error) {
      console.error('File upload error:', error);
      alert(`File upload failed: ${error.message}`);
    }
  }, [processDocumentImage]);

  const viewAttachment = useCallback(async (billNumber) => {
    try {
      let url = billAttachments[billNumber];
      if (!url) {
        url = await getBase64BillAttachment(billNumber);
        if (!url) url = await getBillAttachmentUrlEnhanced(billNumber);
      }
      if (url) {
        const newWindow = window.open("", "_blank");
        if (newWindow) {
          newWindow.document.write(`
            <!DOCTYPE html><html><head><title>Scanned Document - Bill ${billNumber}</title><meta charset="UTF-8">
            <style>
              *{margin:0;padding:0;box-sizing:border-box;}
              body{font-family:Arial,sans-serif;background:#000;height:100vh;display:flex;flex-direction:column;}
              .header{background:#2c3e50;color:white;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;position:fixed;top:0;left:0;right:0;z-index:1000;}
              .title{font-size:18px;font-weight:bold;}
              .actions{display:flex;gap:10px;flex-wrap:wrap;}
              .button{padding:8px 16px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:14px;}
              .print-button{background-color:#27ae60;color:white;}
              .close-button{background-color:#e74c3c;color:white;}
              .image-container{flex:1;display:flex;align-items:center;justify-content:center;padding:80px 20px 20px 20px;overflow:auto;}
              .image-container img{max-width:100%;max-height:100%;object-fit:contain;}
              @media print{.header{display:none !important;}body{background:white;padding:0;}.image-container{padding:0;margin:0;}}
              @media (max-width: 600px) {
                .header{flex-direction:column;gap:10px;padding:10px;}
                .title{font-size:16px;text-align:center;}
                .actions{width:100%;justify-content:center;}
                .button{padding:6px 12px;font-size:12px;}
                .image-container{padding:70px 10px 10px 10px;}
              }
            </style></head>
            <body>
              <div class="header">
                <div class="title">Scanned Document - Bill ${billNumber}</div>
                <div class="actions">
                  <button class="button print-button" onclick="window.print()">Print</button>
                  <button class="button close-button" onclick="window.close()">Close</button>
                </div>
              </div>
              <div class="image-container">
                <img src="${url}" alt="Scanned Document for Bill ${billNumber}" />
              </div>
            </body></html>
          `);
          newWindow.document.close();
        }
      } else {
        alert("No attachment found for this bill.");
      }
    } catch (error) {
      console.error("Error viewing attachment:", error);
      alert("Failed to load attachment. Please try again.");
    }
  }, [billAttachments]);

  const handleRescan = useCallback(async (billNumber) => {
    try {
      const useCamera = window.confirm(
        'Rescan Document\n\nChoose scanning method:\n• Click OK to use Camera\n• Click Cancel to Upload File'
      );
      if (useCamera) { await handleScanDocument(billNumber); }
      else { await handleFileUpload(billNumber); }
    } catch (error) {
      console.error('Error initiating rescan:', error);
      alert(`Failed to rescan: ${error.message}`);
    }
  }, [handleScanDocument, handleFileUpload]);

  const getBatchesForItem = useCallback((barcode) => {
    return storeItems
      .filter((item) => item.barcode === barcode && item.quantity > 0)
      .map((item) => ({
        ...item,
        expireDate: item.expireDate,
        batchId: item.id,
        netPriceDisplay: item.originalCurrency === "IQD" ? item.netPriceIQD : item.netPriceUSD,
        outPriceDisplay: item.originalCurrency === "IQD" ? item.outPriceIQD : item.outPriceUSD,
        currency: item.originalCurrency || "USD",
        netPriceUSD: item.netPriceUSD,
        netPriceIQD: item.netPriceIQD,
        outPriceUSD: item.outPriceUSD,
        outPriceIQD: item.outPriceIQD,
        originalCurrency: item.originalCurrency || "USD",
        branch: item.branch || "N/A",
      }))
      .sort((a, b) => new Date(a.expireDate) - new Date(b.expireDate));
  }, [storeItems]);

  const handleSelectBatch = useCallback((batch) => {
    const batchCurrency = batch.originalCurrency || "USD";
    let currentItems = [...selectedItems];

    if (batchCurrency !== billCurrency) {
      setBillCurrency(batchCurrency);
      currentItems = currentItems.map(item => {
        const defaultPrice = batchCurrency === "USD" ? (item.defaultOutPriceUSD || 0) : (item.defaultOutPriceIQD || 0);
        const initialPrice = defaultPrice > 0 ? defaultPrice : "";
        return {
          ...item,
          price: initialPrice,
          outPriceUSD: batchCurrency === "USD" ? (initialPrice || 0) : 0,
          outPriceIQD: batchCurrency === "IQD" ? (initialPrice || 0) : 0,
        };
      });
    }

    const existingItemIndex = currentItems.findIndex((item) => item.batchId === batch.batchId);
    
    const defaultOutPriceUSD = batch.outPriceUSD || 0;
    const defaultOutPriceIQD = batch.outPriceIQD || 0;
    
    const initialPrice = batchCurrency === "USD" 
      ? (defaultOutPriceUSD > 0 ? defaultOutPriceUSD : "") 
      : (defaultOutPriceIQD > 0 ? defaultOutPriceIQD : "");

    if (existingItemIndex >= 0) {
      const actualBatch = storeItems.find((item) => item.id === batch.batchId);
      const maxQty = actualBatch ? actualBatch.quantity : batch.quantity;
      const currentQty = parseInt(currentItems[existingItemIndex].quantity) || 0;
      currentItems[existingItemIndex].quantity = Math.min(currentQty + 1, maxQty);
      currentItems[existingItemIndex].availableQuantity = maxQty;
    } else {
      const actualBatch = storeItems.find((item) => item.id === batch.batchId);
      const availableQty = actualBatch ? actualBatch.quantity : batch.quantity;
      currentItems.push({
        ...batch,
        quantity: 1,
        defaultOutPriceUSD: defaultOutPriceUSD,
        defaultOutPriceIQD: defaultOutPriceIQD,
        price: initialPrice,
        netPrice: batch.originalCurrency === "IQD" ? batch.netPriceIQD : batch.netPriceUSD,
        outPrice: initialPrice,
        availableQuantity: availableQty,
        batchId: batch.batchId,
        originalCurrency: batch.originalCurrency || "USD",
        outPriceUSD: batchCurrency === "USD" ? (initialPrice || 0) : 0,
        outPriceIQD: batchCurrency === "IQD" ? (initialPrice || 0) : 0,
        netPriceUSD: batch.netPriceUSD,
        netPriceIQD: batch.netPriceIQD,
        hasReturn: false,
        isLocked: false,
      });
    }
    
    setSelectedItems(currentItems);
    setSearchQuery("");
  }, [selectedItems, storeItems, billCurrency]);

  const groupSearchResults = useCallback((results) => {
    const grouped = {};
    results.forEach((item) => {
      if (!grouped[item.barcode]) {
        grouped[item.barcode] = { ...item, batches: getBatchesForItem(item.barcode) };
      }
    });
    return Object.values(grouped);
  }, [getBatchesForItem]);

  const sortBills = useCallback((bills, key, direction) => {
    return [...bills].sort((a, b) => {
      let aValue, bValue;
      switch (key) {
        case 'billNumber':
          aValue = parseInt(a.billNumber) || 0;
          bValue = parseInt(b.billNumber) || 0;
          break;
        case 'pharmacy':
          aValue = a.pharmacyName || '';
          bValue = b.pharmacyName || '';
          return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        case 'branch':
          aValue = getBillBranchDisplay(a);
          bValue = getBillBranchDisplay(b);
          return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        case 'date':
          aValue = new Date(a.date).getTime() || 0;
          bValue = new Date(b.date).getTime() || 0;
          break;
        case 'amount':
          aValue = a.items?.reduce((sum, item) => {
            const p = item.originalCurrency === "IQD" ? (item.outPriceIQD || 0) : (item.outPriceUSD || 0);
            return sum + (p * item.quantity);
          }, 0) || 0;
          bValue = b.items?.reduce((sum, item) => {
            const p = item.originalCurrency === "IQD" ? (item.outPriceIQD || 0) : (item.outPriceUSD || 0);
            return sum + (p * item.quantity);
          }, 0) || 0;
          break;
        default: return 0;
      }
      return direction === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
    });
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  }, []);

  const getSortIcon = useCallback((key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  }, [sortConfig.key, sortConfig.direction]);

  const showBillTemplate = useCallback(() => {
    if (!pharmacyId) { setError("Please select a pharmacy first."); return; }
    
    const validItems = selectedItems.filter(item => {
      const q = parseInt(item.quantity);
      return !isNaN(q) && q >= 0;
    });

    if (validItems.length === 0) { setError("Please add at least one item."); return; }

    const tempBill = {
      billNumber: "TEMP0000",
      items: validItems.map(item => ({
        ...item,
        outPriceUSD: billCurrency === "USD" ? (parseFloat(item.price) || 0) : 0,
        outPriceIQD: billCurrency === "IQD" ? (parseFloat(item.price) || 0) : 0,
      })),
      date: saleDate,
      pharmacyName,
      pharmacyId,
      currency: billCurrency,
      paymentStatus: paymentMethod,
      isConsignment,
      note,
      createdByName: getDisplayName(user?.name || user?.email || "Current User"),
      isPreview: true,
    };
    setCurrentBill(tempBill);
    setShowBillPreview(true);
  }, [pharmacyId, selectedItems, saleDate, pharmacyName, paymentMethod, isConsignment, note, user, billCurrency]);

  const closeBillPreview = useCallback(() => {
    setShowBillPreview(false);
    setCurrentBill(null);
    if (currentBill && currentBill.billNumber !== "TEMP0000") resetForm();
  }, [currentBill, resetForm]);

const buildBillHTML = useCallback((bill) => {
    const billPaymentMethod = bill.paymentStatus || paymentMethod;

    const financialSummary = calculatePharmacyFinancialSummary(
      bill.pharmacyId,
      recentBills,
      returnBills,
      bill.items,
      bill.isPreview || bill.isNew // Add items if previewing OR if bill was just created and passed here
    );

    const { pharmacyHasUSD, pharmacyHasIQD } = financialSummary;

    const getPaymentStatusColor = (pm) => {
      switch (pm) {
        case "Cash":   return "#27ae60";
        case "Unpaid": return "#e74c3c";
        case "Paid":   return "#3498db";
        default:       return "#95a5a6";
      }
    };

    const billCurr = bill.currency || "USD";

    const currentBillTotalUSD = billCurr === "USD" ? (bill.items?.reduce((sum, item) => sum + ((item.outPriceUSD || item.price || 0) * item.quantity), 0) || 0) : 0;
    const currentBillTotalIQD = billCurr === "IQD" ? (bill.items?.reduce((sum, item) => sum + ((item.outPriceIQD || item.price || 0) * item.quantity), 0) || 0) : 0;

    const displayBillNumber = bill.billNumber === "TEMP0000" ? "TEMP0000" : formatBillNumber(bill.billNumber);
    const creatorDisplayName = getDisplayName(bill.createdByName || "Unknown User");

    const unpaidLine  = formatFinancialLine(financialSummary.totalUnpaidBillsUSD, financialSummary.totalUnpaidBillsIQD, pharmacyHasUSD, pharmacyHasIQD);
    const returnLine  = formatFinancialLine(financialSummary.totalReturnBillsUSD, financialSummary.totalReturnBillsIQD, pharmacyHasUSD, pharmacyHasIQD);
    const remainLine  = formatFinancialLine(financialSummary.remainingUnpaidUSD, financialSummary.remainingUnpaidIQD, pharmacyHasUSD, pharmacyHasIQD);

    const singleBillHTML = `
        <div class="bill-template" style="color: #1a365d;">
          <div class="bill-header" style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">
            <div class="header-content" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: nowrap; width: 100%;">
              <div style="flex: 1; min-width: 0;">
                <h1 class="company-name" style="margin: 0; font-size: 28px; font-weight: bold; color: #1a365d; font-family: 'NRT-Bd', sans-serif;">ARAN MED STORE</h1>
                <p style="font-size:14px;color:#3b4c6b;margin:2px 0 0 0; font-family: 'NRT-Reg', sans-serif;">سلێمانی - بەرامبەر تاوەری تەندروستی سمارت</p>
                <p style="font-size:13px;color:#3b4c6b;margin:0; font-family: 'NRT-Reg', sans-serif;">+964 772 533 5252 | +964 751 741 2241</p>
              </div>
              <div style="flex-shrink: 0; margin-left: 15px;">
                <img src="/Aranlogo.png" alt="Aran Logo" style="height: 70px; object-fit: contain;" />
              </div>
            </div>
          </div>

          <div class="bill-info-grid" style="display: flex; flex-wrap: nowrap; gap: 12px; margin-bottom: 15px; justify-content: space-between;">
            <div class="info-box" style="flex: 1; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <h3 style="font-size: 15px; margin: 0 0 8px 0; color: #1a365d;">Bill To: ${bill.pharmacyName}</h3>
              <div class="info-row" style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px; font-size: 13px;">
                <span class="info-label" style="font-weight: 600; min-width: 80px; color: #1a365d;">Payment:</span>
                <span class="badge" style="background-color:${getPaymentStatusColor(billPaymentMethod)}; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: white;">${billPaymentMethod.toUpperCase()}</span>
              </div>
              <div class="info-row" style="display: flex; align-items: center; gap: 4px; margin-bottom: 0; font-size: 13px;">
                <span class="info-label" style="font-weight: 600; min-width: 80px; color: #1a365d;">Consignment:</span>
                <span style="color: #3b4c6b; font-weight: 500;">${bill.isConsignment ? 'تحت صرف' : 'Owned'}</span>
              </div>
            </div>
            <div class="info-box" style="flex: 1; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div class="info-row" style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px; font-size: 13px;">
                <span class="info-label" style="font-weight: 600; min-width: 80px; color: #1a365d;">Invoice #:</span>
                <span style="color: #3b4c6b; font-weight: 500;">${displayBillNumber}</span>
              </div>
              <div class="info-row" style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px; font-size: 13px;">
                <span class="info-label" style="font-weight: 600; min-width: 80px; color: #1a365d;">Date:</span>
                <span style="color: #3b4c6b; font-weight: 500;">${formatDate(bill.date)}</span>
              </div>
              <div class="info-row" style="display: flex; align-items: center; gap: 4px; margin-bottom: 0; font-size: 13px;">
                <span class="info-label" style="font-weight: 600; min-width: 80px; color: #1a365d;">Created By:</span>
                <span style="color: #3b4c6b; font-weight: 500;">${creatorDisplayName}</span>
              </div>
            </div>
            <div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 10px;">
               <img src="/scann.png" alt="QR Code" style="width: 90px; height: 110px; object-fit: contain;" />
            </div>
          </div>

          <div style="overflow-x:auto;">
            <table class="items-table" style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 12px; font-size: 13px;">
              <thead>
                <tr>
                  <th style="background-color: #1F2B5B; color: #e2e8f0; padding: 12px 8px; text-align: center; border-radius: 8px 0 0 8px; font-family: 'NRT-Bd', sans-serif; border-bottom: 2px solid #e2e8f0;">#</th>
                  <th style="background-color: #1F2B5B; color: #e2e8f0; padding: 12px 8px; text-align: left; font-family: 'NRT-Bd', sans-serif; border-bottom: 2px solid #e2e8f0;">Item Details</th>
                  <th style="background-color: #1F2B5B; color: #e2e8f0; padding: 12px 8px; text-align: center; font-family: 'NRT-Bd', sans-serif; border-bottom: 2px solid #e2e8f0;">Barcode</th>
                  <th style="background-color: #1F2B5B; color: #e2e8f0; padding: 12px 8px; text-align: center; font-family: 'NRT-Bd', sans-serif; border-bottom: 2px solid #e2e8f0;">Qty</th>
                  <th style="background-color: #1F2B5B; color: #e2e8f0; padding: 12px 8px; text-align: right; font-family: 'NRT-Bd', sans-serif; border-bottom: 2px solid #e2e8f0;">Unit Price</th>
                  <th style="background-color: #1F2B5B; color: #e2e8f0; padding: 12px 8px; text-align: right; border-radius: 0 8px 8px 0; font-family: 'NRT-Bd', sans-serif; border-bottom: 2px solid #e2e8f0;">Total</th>
                </tr>
              </thead>
              <tbody>
          ${bill.items?.map((item, idx) => {
                const price = billCurr === "IQD" ? (item.outPriceIQD || item.price || 0) : (item.outPriceUSD || item.price || 0);
                const priceFormatted = billCurr === "IQD" ? Math.round(price).toLocaleString() + " IQD" : "$" + price.toFixed(2);
                const totalFormatted = billCurr === "IQD" ? Math.round(price * item.quantity).toLocaleString() + " IQD" : "$" + (price * item.quantity).toFixed(2);
                return `
                    <tr>
                      <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #1a365d;">${idx + 1}</td>
                      <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">
                        <div style="font-weight: 600; font-family: 'NRT-Bd', sans-serif; font-size: 13px; color: #1a365d;">${item.name}</div>
                      </td>
                      <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-family: monospace; font-size: 13px; color: #3b4c6b;">${item.barcode}</td>
                      <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #1a365d;">${item.quantity}</td>
                      <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1a365d;">${priceFormatted}</td>
                      <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1a365d;">${totalFormatted}</td>
                    </tr>
                  `;
                }).join("")}
                <tr><td colspan="6" style="padding: 4px;"></td></tr>
                <tr class="total-row">
                  <td colspan="5" style="background-color: #f1f5f9 !important; color: #1a365d; text-align: right; padding: 12px 12px; font-size: 14px; font-family: 'NRT-Bd', sans-serif; border-radius: 8px 0 0 8px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0;">CURRENT TOTAL:</td>
                  <td style="background-color: #f1f5f9 !important; color: #1a365d; text-align: right; padding: 12px 12px; font-family: 'NRT-Bd', sans-serif; font-size: 15px; border-radius: 0 8px 8px 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                    ${formatTotalLine(currentBillTotalUSD, currentBillTotalIQD)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="fin-summary" style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
            <div class="fin-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              <span class="fin-label" style="font-weight: 600; color: #1a365d;">Total Unpaid Bills:</span>
              <span class="fin-value" style="color: #3b4c6b; font-weight: 500;">${unpaidLine}</span>
            </div>
            <div class="fin-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              <span class="fin-label" style="font-weight: 600; color: #1a365d;">Total Return Bills:</span>
              <span class="fin-value" style="color:#e74c3c; font-weight: 500;">- ${returnLine}</span>
            </div>
            <div class="fin-row" style="display: flex; justify-content: space-between; padding: 8px 0 2px 0; font-size: 14px; font-weight: 700; color: #e74c3c;">
              <span class="fin-label">Remaining Unpaid Balance:</span>
              <span class="fin-value">${remainLine}</span>
            </div>
          </div>

          ${bill.note ? `
            <div class="note-section" style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
              <h4 style="font-weight: 600; margin: 0 0 4px 0; color: #1a365d; font-size: 14px; font-family: 'NRT-Bd', sans-serif;">Note:</h4>
              <p style="font-size: 13px; color: #3b4c6b; margin: 0;">${bill.note}</p>
            </div>
          ` : ""}

          <div style="margin-top: 10px; text-align: right; page-break-inside: avoid;">
            <div style="width: 250px; height: 1.5px; background-color: #1a365d; margin: 10px 0 8px auto;"></div>
            <p style="font-size: 14px; color: #1a365d; font-style: italic; font-weight: 100; font-family: 'NRT-Reg', sans-serif; margin: 0; padding-right: 15px;">Receiver Signature (Stamp)</p>
          </div>
        </div>
    `;

    return { singleBillHTML, displayBillNumber };
  }, [paymentMethod, recentBills, returnBills]);

  const shareViaWhatsApp = useCallback(async (bill) => {
    if (!bill) {
      alert("No bill selected");
      return;
    }

    const billKey = bill.billNumber;
    setSharingWhatsApp((prev) => ({ ...prev, [billKey]: true }));

    try {
      const displayBillNumber = formatBillNumber(bill.billNumber);
      const shareText = `Invoice #${displayBillNumber}`;

      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "794px";
      container.style.height = "1123px";
      container.style.zIndex = "99999";
      container.style.background = "white";
      container.style.display = "flex";
      container.style.justifyContent = "center";
      container.style.alignItems = "center";
      container.style.overflow = "visible";
      container.style.opacity = "1";
      container.style.visibility = "visible";
      container.style.pointerEvents = "none";

      const { singleBillHTML } = buildBillHTML(bill);

      container.innerHTML = `
        <div id="bill-image-wrap" style="
          width: 794px;
          height: 1123px;
          background: white;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          padding: 50px 60px;
          margin: 0;
          overflow: visible;
        ">
          ${singleBillHTML}
        </div>
      `;

      document.body.appendChild(container);
      container.offsetHeight;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const delay = isMobile ? 1500 : 500;
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(resolve, delay);
        });
      });

      if (typeof window.html2canvas !== 'function') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
          script.onload = () => {
            setTimeout(resolve, 300);
          };
          script.onerror = () => reject(new Error('Failed to load html2canvas'));
          document.head.appendChild(script);
        });
      }

      const element = document.getElementById('bill-image-wrap');
      if (!element) {
        throw new Error('Bill element not found');
      }

      const canvas = await window.html2canvas(element, {
        scale: isMobile ? 3 : 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: true,
        width: 794,
        height: 1123,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        allowTaint: true,
        windowWidth: 794,
        windowHeight: 1123,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById('bill-image-wrap');
          if (clonedEl) {
            clonedEl.style.width = '794px';
            clonedEl.style.height = '1123px';
            clonedEl.style.margin = '0';
            clonedEl.style.opacity = '1';
            clonedEl.style.visibility = 'visible';
            clonedEl.style.overflow = 'visible';
          }
        }
      });

      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const isBlank = !imageData.data.some(channel => channel !== 0);

      if (isBlank) {
        throw new Error('Captured canvas is blank');
      }

      document.body.removeChild(container);

      const fileName = `Bill_${displayBillNumber}.jpg`;
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

      const link = document.createElement('a');
      link.download = fileName;
      link.href = imageDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        const encodedText = encodeURIComponent(shareText);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
      }, 500);

    } catch (err) {
      console.error('Error sharing bill:', err);
      alert('⚠️ Failed to share the bill. Please try again.');
    } finally {
      setSharingWhatsApp((prev) => ({ ...prev, [billKey]: false }));
    }
  }, [buildBillHTML]);

  const printBill = useCallback((bill) => {
    if (!bill) { alert("No bill selected for printing"); return; }

    const { singleBillHTML, displayBillNumber } = buildBillHTML(bill);

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const numCopies = 1; // Print only 1 copy

    if (isMobile) {
      const loadHtml2Pdf = () => {
        return new Promise((resolve, reject) => {
          if (window.html2pdf) { resolve(); return; }
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          script.onload = () => {
            setTimeout(resolve, 200);
          };
          script.onerror = () => reject(new Error("Failed to load PDF library"));
          document.head.appendChild(script);
        });
      };

      const generatePDF = async () => {
        try {
          await loadHtml2Pdf();
          
          const container = document.createElement("div");
          container.style.position = "fixed";
          container.style.top = "50%";
          container.style.left = "50%";
          container.style.transform = "translate(-50%, -50%)";
          container.style.zIndex = "-9999";
          container.style.visibility = "hidden";
          container.style.width = "800px";
          container.style.background = "white";
          container.style.padding = "20px";
          container.style.boxSizing = "border-box";
          
          container.innerHTML = `
            <div id="pdf-wrap" style="width: 100%; max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; color: #2c3e50; box-sizing: border-box;">
              <style>
                #pdf-wrap * { overflow: visible !important; overflow-x: visible !important; box-sizing: border-box; }
                #pdf-wrap .bill-template { max-width: 100%; margin: 0 auto; }
              </style>
              ${singleBillHTML}
            </div>
          `;
          document.body.appendChild(container);

          const opt = {
            margin: [5, 5, 5, 5],
            filename: `Bill_${displayBillNumber}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { 
              scale: 2, 
              useCORS: true, 
              windowWidth: 800,
              width: 800,
              x: 0,
              y: 0,
              scrollX: 0,
              scrollY: 0
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          await window.html2pdf().set(opt).from(container.querySelector('#pdf-wrap')).save();
          document.body.removeChild(container);
        } catch (error) {
          console.error('PDF generation error:', error);
          alert('Failed to generate PDF. Please try again.');
        }
      };

      generatePDF();
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Please allow popups for printing"); return; }
    const fullHTML = Array(numCopies).fill(singleBillHTML).join('<div style="page-break-after: always;"></div>');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill #${displayBillNumber}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @font-face { font-family: 'NRT-Reg'; src: url('/fonts/NRT-Reg.ttf') format('truetype'); }
          @font-face { font-family: 'NRT-Bd';  src: url('/fonts/NRT-Bd.ttf')  format('truetype'); }
          @page { margin: 0; } /* Removes default header/footer from browser print */
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'NRT-Reg', 'Segoe UI', sans-serif;
            padding: 15mm; color: #2c3e50; background: white;
            line-height: 1.4; font-size: 14px;
          }
          .bill-template { max-width: 800px; margin: 0 auto; page-break-inside: avoid; }
          @media print {
            body { padding: 15mm; }
            .bill-template { max-width: 100%; }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
          @media (max-width: 600px) {
            body { padding: 10px; font-size: 12px; }
            .bill-template { max-width: 100%; }
          }
        </style>
      </head>
      <body>
         ${fullHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    }, 500);
  }, [buildBillHTML]);

  const fetchItemSalesHistory = useCallback(async (barcode, pharId) => {
    if (!pharId) { alert("Please select a pharmacy first to view sales history."); return; }
    try {
      const bills = await searchSoldBills("");
      const history = bills
        .filter((bill) => bill.pharmacyId === pharId)
        .flatMap((bill) =>
          bill.items.filter((item) => item.barcode === barcode).map((item) => ({
            ...item, billNumber: bill.billNumber, billDate: bill.date, paymentStatus: bill.paymentStatus,
          }))
        );
      setSelectedItemHistory(history);
      setShowHistoryModal(true);
    } catch (error) {
      setError("Failed to fetch item history.");
    }
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ billNumber: "", itemName: "", paymentStatus: "all", pharmacyName: "", branch: "all", consignment: "all", fromDate: "", toDate: "", globalSearch: "" });
    setItemFilters([]);
  }, []);

  const paginate = useCallback((pageNumber) => setCurrentPage(pageNumber), []);

  const onFocusBorder = useCallback((e) => {
    e.target.style.borderColor = '#3b82f6';
    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
    if (e.target.tagName === 'TEXTAREA') { e.target.style.height = '60px'; e.target.style.resize = 'vertical'; }
  }, []);

  const onBlurBorder = useCallback((e) => {
    e.target.style.borderColor = '#e9ecef';
    e.target.style.boxShadow = 'none';
    if (e.target.tagName === 'TEXTAREA' && !e.target.value) { e.target.style.height = '38px'; e.target.style.resize = 'none'; }
  }, []);

  useEffect(() => {
    const loadPharmacies = async () => {
      try {
        const pharmacies = await searchPharmacies("");
        setAllPharmacies(pharmacies);
      } catch (error) {
        console.error("Error loading pharmacies:", error);
      }
    };
    loadPharmacies();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        try {
          let results = [];
          const searchTerm = searchQuery.trim();
          
          const freshStoreItems = await getStoreItems(true);
          setStoreItems(freshStoreItems);
          
          const searchResults = await searchInitializedItems(searchTerm, "both");
          results = searchResults;
          
          const storeSearchResults = freshStoreItems.filter((item) => {
            if (item.quantity <= 0) return false;
            const nameMatch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const barcodeMatch = item.barcode.toLowerCase().includes(searchTerm.toLowerCase());
            return nameMatch || barcodeMatch;
          });
          
          const allResults = [...results, ...storeSearchResults];
          
          const uniqueResults = allResults.filter((item, index, self) => 
            index === self.findIndex((i) => i.barcode === item.barcode && i.branch === item.branch)
          );
          
          setSearchResults(uniqueResults);
        } catch (err) {
          console.error("Search error:", err);
          const freshStoreItems = await getStoreItems(true);
          setStoreItems(freshStoreItems);
          const searchTerm = searchQuery.trim().toLowerCase();
          const filtered = freshStoreItems.filter((item) => {
            if (item.quantity <= 0) return false;
            return item.name.toLowerCase().includes(searchTerm) || 
                   item.barcode.toLowerCase().includes(searchTerm);
          });
          setSearchResults(filtered);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (pharmacySearch.length > 0) {
        try {
          const results = await searchPharmacies(pharmacySearch);
          setPharmacySuggestions(results);
          setShowPharmacySuggestions(results.length > 0);
        } catch (err) {
          console.error("Error searching pharmacies:", err);
        }
      } else {
        setPharmacySuggestions([]);
        setShowPharmacySuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pharmacySearch]);

  useEffect(() => {
    searchPharmacies("").then((pharmacies) => {
      setPharmacyFilterOptions(pharmacies.map((p) => ({ value: p.name, label: `${p.name} (${p.code})` })));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [items, bills, allReturns] = await Promise.all([
          getStoreItems(),
          searchSoldBills(""),
          getAllReturns(),
        ]);
        setStoreItems(items);
        const sortedBills = bills.sort((a, b) => (parseInt(b.billNumber) || 0) - (parseInt(a.billNumber) || 0));
        setRecentBills(sortedBills);
        setReturnBills(allReturns);
        const uniqueItems = Array.from(new Set(items.map((item) => item.name))).map((name) => {
          const item = items.find((i) => i.name === name);
          return { value: name, label: `${name} (${item.barcode})`, barcode: item.barcode };
        });
        setItemOptions(uniqueItems);
        loadAllAttachments(sortedBills);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please contact Usama (Database Manager) to fix this issue.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [loadAllAttachments]);

  const filteredBills = useMemo(() => {
    const filtered = recentBills.filter((bill) => {
      const displayBillNumber = formatBillNumber(bill.billNumber);
      const matchesBillNumber = !filters.billNumber ||
        displayBillNumber.toString().includes(filters.billNumber) ||
        bill.billNumber.toString().includes(filters.billNumber);
      const matchesPharmacy = !filters.pharmacyName ||
        (bill.pharmacyName && bill.pharmacyName.toLowerCase().includes(filters.pharmacyName.toLowerCase()));
      
      const billBranches = bill.items?.map(i => i.branch).filter(Boolean) || [];
      const matchesBranch = filters.branch === "all" || billBranches.includes(filters.branch);

      const matchesPaymentStatus = filters.paymentStatus === "all" || bill.paymentStatus === filters.paymentStatus;
      const matchesConsignment = filters.consignment === "all" ||
        (filters.consignment === "yes" && bill.isConsignment) ||
        (filters.consignment === "no" && !bill.isConsignment);
      const matchesItemName = !filters.itemName ||
        bill.items.some((item) => item.name.toLowerCase().includes(filters.itemName.toLowerCase()));
      const matchesSpecificItems = itemFilters.length === 0 ||
        bill.items.some((item) => itemFilters.includes(item.name));
      const matchesGlobalSearch = !filters.globalSearch ||
        displayBillNumber.toString().includes(filters.globalSearch) ||
        (bill.pharmacyName && bill.pharmacyName.toLowerCase().includes(filters.globalSearch.toLowerCase())) ||
        billBranches.some(b => b.toLowerCase().includes(filters.globalSearch.toLowerCase())) ||
        bill.items.some((item) =>
          item.name.toLowerCase().includes(filters.globalSearch.toLowerCase()) ||
          item.barcode.includes(filters.globalSearch)
        );
      let matchesDateRange = true;
      if (filters.fromDate || filters.toDate) {
        const billDate = new Date(bill.date);
        if (filters.fromDate) matchesDateRange = matchesDateRange && billDate >= new Date(filters.fromDate);
        if (filters.toDate) {
          const endDate = new Date(filters.toDate);
          endDate.setHours(23, 59, 59, 999);
          matchesDateRange = matchesDateRange && billDate <= endDate;
        }
      }
      return matchesBillNumber && matchesPharmacy && matchesBranch && matchesPaymentStatus && matchesDateRange &&
        matchesConsignment && matchesItemName && matchesGlobalSearch && matchesSpecificItems;
    });
    return sortBills(filtered, sortConfig.key, sortConfig.direction);
  }, [recentBills, filters, itemFilters, sortConfig, sortBills]);

  const indexOfLastBill = currentPage * billsPerPage;
  const indexOfFirstBill = indexOfLastBill - billsPerPage;
  const currentBills = filteredBills.slice(indexOfFirstBill, indexOfLastBill);
  const totalPages = Math.ceil(filteredBills.length / billsPerPage);

  return (
    <>
      <style>{`
        .page-wrapper {
          min-height: 100vh;
          background-color: #f5f6fa;
          padding: 24px;
          box-sizing: border-box;
          font-family: 'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .card-wrapper {
          background-color: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          border: 1px solid #e1e8ed;
          margin-bottom: 20px;
          overflow: hidden;
          box-sizing: border-box;
        }
        .table-responsive {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          width: 100%;
        }
        @media (max-width: 1024px) {
          .page-wrapper {
            padding: 0 !important;
          }
          .card-wrapper {
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            margin-bottom: 16px !important;
          }
          .table-edge-to-edge {
            margin-left: -16px;
            margin-right: -16px;
            width: calc(100% + 32px);
            padding: 0 16px;
            box-sizing: border-box;
          }
          .mobile-padded {
            padding-left: 16px !important;
            padding-right: 16px !important;
            padding-top: 16px !important;
          }
        }
      `}</style>
      <div className="page-wrapper" style={styles.container}>

        <div className="card-wrapper" style={styles.formContainer}>
          {error && (
            <div style={styles.error}>
              <span style={styles.errorIcon}>⚠️</span>
              <div style={styles.errorContent}>
                <div style={styles.errorTitle}>Something went wrong!</div>
                <div style={styles.errorMessage}>{error}</div>
                <div style={styles.errorContact}>
                  📞 Please contact Usama (Database Manager) to fix this issue.
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                style={styles.errorClose}
              >
                ×
              </button>
            </div>
          )}

          {isEditMode && <div style={styles.editingBillDisplay}>📝 Editing: {editingBillDisplay}</div>}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Search Pharmacy (by name or code)</label>
            <div style={{ position: "relative" }}>
              <input
                ref={pharmacySearchRef}
                type="text"
                style={{
                  ...styles.input,
                  backgroundColor: '#f0f7ff',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#1a202c',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                }}
                placeholder="🔍 Type pharmacy name or code..."
                value={pharmacySearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setPharmacySearch(value);
                  if (!value || value.trim() === "") {
                    setPharmacyId("");
                    setPharmacyName("");
                    setPharmacySuggestions(allPharmacies);
                    setShowPharmacyList(true);
                  } else {
                    const searchLower = value.toLowerCase().trim();
                    const filtered = allPharmacies.filter(p => 
                      p.name?.toLowerCase().includes(searchLower) ||
                      p.code?.toString().toLowerCase().includes(searchLower)
                    );
                    setPharmacySuggestions(filtered);
                    setShowPharmacyList(true);
                  }
                }}
                onFocus={(e) => {
                  if (allPharmacies.length > 0) {
                    setPharmacySuggestions(allPharmacies);
                    setShowPharmacyList(true);
                  }
                  e.target.style.borderColor = '#4299e1';
                  e.target.style.boxShadow = '0 0 0 4px rgba(66, 153, 225, 0.15)';
                  e.target.style.backgroundColor = '#ffffff';
                }}
                onBlur={(e) => {
                  setTimeout(() => setShowPharmacyList(false), 200);
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.04)';
                  if (!e.target.value) {
                    e.target.style.backgroundColor = '#f0f7ff';
                  }
                }}
              />
              
              {showPharmacyList && pharmacySuggestions.length > 0 && (
                <div style={{
                  ...styles.suggestionsDropdown,
                  maxHeight: "300px",
                  overflowY: "auto",
                  position: "absolute",
                  width: "100%",
                  zIndex: 1000,
                  backgroundColor: "white",
                  border: "2px solid #4299e1",
                  borderRadius: "10px",
                  marginTop: "4px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}>
                  {pharmacySuggestions.map((pharmacy) => (
                    <div 
                      key={pharmacy.id} 
                      style={{
                        padding: "12px 16px",
                        cursor: "pointer",
                        borderBottom: "1px solid #e8ecef",
                        fontSize: "15px",
                        transition: "all 0.2s ease",
                        fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                      }}
                      onClick={() => {
                        setPharmacyId(pharmacy.id);
                        setPharmacyName(pharmacy.name);
                        setPharmacySearch(`${pharmacy.name} (${pharmacy.code})`);
                        setShowPharmacyList(false);
                        setTimeout(() => searchQueryRef.current?.focus(), 100);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#ebf8ff";
                        e.currentTarget.style.borderLeft = "4px solid #4299e1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "white";
                        e.currentTarget.style.borderLeft = "4px solid transparent";
                      }}
                    >
                      <div style={{ fontWeight: "600", color: "#2c3e50", fontSize: "15px", fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
                        {pharmacy.name}
                      </div>
                      <div style={{ fontSize: "13px", color: "#718096", display: "flex", gap: "12px", marginTop: "2px" }}>
                        <span>📋 Code: {pharmacy.code}</span>
                        {pharmacy.address && <span>📍 {pharmacy.address}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Date, Bill Currency, Payment, Consignment row */}
          <div style={styles.rowContainer}>
            <div style={styles.dateField}>
              <label style={styles.fieldLabel}>Sale Date</label>
              <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} style={styles.dateInputField} onFocus={onFocusBorder} onBlur={onBlurBorder} />
            </div>
            <div style={styles.dateField}>
              <label style={styles.fieldLabel}>Bill Currency</label>
              <select value={billCurrency} onChange={handleBillCurrencyChange} style={styles.selectField} onFocus={onFocusBorder} onBlur={onBlurBorder}>
                <option value="USD">USD ($)</option>
                <option value="IQD">IQD</option>
              </select>
            </div>
            <div style={styles.dateField}>
              <label style={styles.fieldLabel}>Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={styles.selectField} onFocus={onFocusBorder} onBlur={onBlurBorder}>
                <option value="Unpaid">Unpaid</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
            <div style={styles.consignmentContainer}>
              <input type="checkbox" checked={isConsignment} onChange={(e) => setIsConsignment(e.target.checked)} id="isConsignment" style={styles.consignmentCheckbox} />
              <label htmlFor="isConsignment" style={styles.consignmentLabel}>تحت صرف</label>
            </div>
          </div>

          <div style={styles.noteRowContainer}>
            <div style={styles.noteFieldFull}>
              <label style={styles.fieldLabel}>Bill Note</label>
              <textarea 
                placeholder="Add any special notes..." 
                value={note} 
                onChange={(e) => setNote(e.target.value)} 
                style={styles.textareaFieldFull} 
                onFocus={onFocusBorder} 
                onBlur={onBlurBorder} 
              />
            </div>
          </div>

          <div style={styles.searchSection}>
            <label style={styles.label}>Search Items</label>
            <input
              ref={searchQueryRef}
              type="text"
              style={{
                ...styles.input,
                backgroundColor: '#fff5df',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 18px',
                fontSize: '16px',
                fontWeight: '500',
                color: '#1a202c',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Ccircle cx=\'11\' cy=\'11\' r=\'8\'/%3E%3Cpath d=\'M21 21l-4.35-4.35\'/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: '16px center',
                paddingLeft: '48px',
              }}
              placeholder=" Search by barcode or name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={(e) => {
                e.target.style.borderColor = '#4299e1';
                e.target.style.boxShadow = '0 0 0 4px rgba(66, 153, 225, 0.15)';
                e.target.style.backgroundColor = '#fff5df';
                e.target.select();
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.04)';
                if (!e.target.value) {
                  e.target.style.backgroundColor = '#fff5df';
                }
              }}
            />
            {groupSearchResults(searchResults).length > 0 && (
              <div className="table-responsive" style={styles.searchResults}>
                {groupSearchResults(searchResults).map((item) => (
                  <div key={item.barcode} style={styles.itemGroup}>
                    <div style={styles.itemGroupHeader}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontSize: "16px", fontWeight: "700", color: "#2c3e50" }}>{item.name}</span>
                        <span style={{ fontSize: "13px", color: "#3498db", backgroundColor: "#ebf5fb", padding: "2px 8px", borderRadius: "12px", display: "inline-block", fontWeight: "600", width: "fit-content" }}>
                          Barcode: {item.barcode}
                        </span>
                      </div>
                      {pharmacyId && (
                        <button style={styles.historyButton} onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemForHistory(item);
                          fetchItemSalesHistory(item.barcode, pharmacyId);
                        }}>
                          📊 View History
                        </button>
                      )}
                    </div>
                    <div className="table-responsive" style={styles.tableScrollWrapper}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.tableHeader}>Expire Date</th>
                            <th style={{ ...styles.tableHeader, textAlign: "center" }}>Branch</th>
                            <th style={{ ...styles.tableHeader, textAlign: "right" }}>Net Price</th>
                            <th style={{ ...styles.tableHeader, textAlign: "right" }}>Selling Price</th>
                            <th style={{ ...styles.tableHeader, textAlign: "center" }}>Available</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.batches.map((batch, batchIndex) => (
                            <tr 
                              key={`${item.id}-${batchIndex}`}
                              onClick={() => handleSelectBatch(batch)}
                              style={{ cursor: "pointer", transition: "background-color 0.2s" }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                            >
                              <td style={styles.tableCell}>{formatExpireDate(batch.expireDate)}</td>
                              <td style={{ 
                                ...styles.tableCell, 
                                textAlign: "center",
                                fontWeight: "600",
                                color: batch.branch === "Slemany" ? "#16a34a" :
                                       batch.branch === "Erbil" ? "#dc2626" :
                                       batch.branch === "Duhok" ? "#2563eb" :
                                       batch.branch === "Kirkuk" ? "#f59e0b" :
                                       batch.branch === "Kalar" ? "#8b5cf6" :
                                       "#4b5563",
                                backgroundColor: batch.branch === "Slemany" ? "#f0fdf4" :
                                                 batch.branch === "Erbil" ? "#fef2f2" :
                                                 batch.branch === "Duhok" ? "#eff6ff" :
                                                 batch.branch === "Kirkuk" ? "#fffbeb" :
                                                 batch.branch === "Kalar" ? "#f5f3ff" :
                                                 "transparent",
                                padding: "6px 10px",
                                fontSize: "15px"
                              }}>
                                {batch.branch || "N/A"}
                              </td>
                              <td style={{ ...styles.tableCell, textAlign: "right" }}>
                                {batch.currency === "IQD"
                                  ? Math.round(batch.netPriceDisplay).toLocaleString() + " IQD"
                                  : "$" + batch.netPriceDisplay.toFixed(2)}
                              </td>
                              <td style={{ ...styles.tableCell, textAlign: "right" }}>
                                {batch.currency === "IQD"
                                  ? Math.round(batch.outPriceDisplay).toLocaleString() + " IQD"
                                  : "$" + batch.outPriceDisplay.toFixed(2)}
                              </td>
                              <td style={{ ...styles.tableCell, textAlign: "center", fontWeight: "600" }}>{batch.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedItems.length > 0 && (
            <div style={styles.selectedItems}>
              <h3 style={{ marginBottom: "12px", fontSize: "18px", fontWeight: "600", color: "#2c3e50" }}>
                Selected Items
                {isEditMode && selectedItems.some(i => i.isLocked) && (
                  <span style={{
                    fontSize: "13px",
                    fontWeight: "400",
                    color: "#e74c3c",
                    marginLeft: "5px",
                    display: "block",
                    marginTop: "4px"
                  }}>
                    ⚠️ Items with return invoices are locked
                  </span>
                )}
              </h3>
              {selectedItems.map((item, index) => {
                const activePrice = parseFloat(item.price) || 0;

                const isItemIQD = item.originalCurrency === "IQD";
                const netVal = isItemIQD ? (item.netPriceIQD || item.netPrice || 0) : (item.netPriceUSD || item.netPrice || 0);
                const netDisplay = isItemIQD
                  ? Math.round(netVal).toLocaleString() + " IQD"
                  : "$" + netVal.toFixed(2);

                const totalDisplay = billCurrency === "IQD"
                  ? Math.round(activePrice * (item.quantity || 0)).toLocaleString('en-US') + " IQD"
                  : "$" + (activePrice * (item.quantity || 0)).toFixed(2);

                const isLocked = item.isLocked || false;
                const returnQty = item.returnQuantity || 0;
                const returnBillNum = item.returnBillNumber || "";

                return (
                  <div key={index} style={{
                    ...styles.selectedItem,
                    ...(isLocked ? styles.lockedItem : {}),
                    position: "relative",
                  }}>
                    {isLocked && (
                      <div style={{ position: "absolute", bottom: "0", left: "0", right: "0", height: "3px", backgroundColor: "#e74c3c", borderRadius: "0 0 8px 8px" }} />
                    )}

                    <div style={{ ...styles.itemDetails, position: "relative", zIndex: "1" }}>
                      <div style={styles.itemName}>
                        {item.name}
                        {isLocked && (
                          <span style={styles.warningBadge}>🔒 Returned ({returnQty})</span>
                        )}
                      </div>
                      <div style={styles.itemMeta}>
                        {item.barcode} • Exp: {formatExpireDate(item.expireDate)}
                        {isEditMode && ` • Avail: ${item.availableQuantity}`}
                        <div>Net: {netDisplay}</div>
                        {isLocked && (
                          <div style={{
                            color: "#c0392b", fontWeight: "600", marginTop: "4px", padding: "6px 10px",
                            backgroundColor: "#fff0f0", borderRadius: "6px", border: "1px solid #e74c3c", fontSize: "13px",
                          }}>
                            🔒 Return Invoice: {returnBillNum || "Unknown"} ({returnQty} unit{returnQty !== 1 ? "s" : ""})
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={styles.selectedItemControls}>
                      <div style={styles.itemControlGroup}>
                        <span style={styles.itemControlLabel}>Qty:</span>
                        <input
                          type="number"
                          min="0"
                          max={item.availableQuantity}
                          style={{
                            ...styles.quantityInput,
                            width: "60px",
                            ...(isLocked ? { backgroundColor: "#f0f0f0", cursor: "not-allowed", borderColor: "#e74c3c", opacity: "0.65" } : {})
                          }}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          onFocus={(e) => {
                            e.target.select();
                            if (isLocked) {
                              e.target.blur();
                              alert(`🔒 "${item.name}" is locked!\n\nReturn Invoice: ${returnBillNum || "Unknown"}\nReturned: ${returnQty} unit${returnQty !== 1 ? "s" : ""}\n\nUse the Return Invoice page to modify this.`);
                            }
                          }}
                          readOnly={isLocked}
                          inputMode="numeric"
                        />
                        <span style={{ fontSize: "13px", color: "#7f8c8d" }}>/ {item.availableQuantity}</span>
                      </div>

                      <div style={styles.itemControlGroup}>
                        <span style={styles.itemControlLabel}>Price:</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          style={{
                            ...styles.priceInput,
                            width: "90px",
                            ...(isLocked ? { backgroundColor: "#f0f0f0", cursor: "not-allowed", borderColor: "#e74c3c", opacity: "0.65" } : {})
                          }}
                          value={
                            item.price === "" || item.price === undefined
                              ? ""
                              : (billCurrency === "IQD" 
                                  ? Number(item.price).toLocaleString('en-US') 
                                  : item.price)
                          }
                          placeholder="0"
                          onChange={(e) => {
                            const rawVal = e.target.value.replace(/,/g, '');
                            handleItemChange(index, "price", rawVal);
                          }}
                          onFocus={(e) => {
                            e.target.select();
                            if (isLocked) { e.target.blur(); alert(`🔒 Locked.`); }
                          }}
                          readOnly={isLocked}
                        />
                        <span style={{ fontSize: "13px", color: "#7f8c8d" }}>{billCurrency === "IQD" ? "IQD" : "USD"}</span>
                      </div>

                      <div style={{ fontWeight: "600", minWidth: "80px", textAlign: "right", color: "#2c3e50", fontSize: "15px" }}>
                        {totalDisplay}
                      </div>

                      <button
                        style={{
                          ...styles.removeButton,
                          padding: "6px 12px",
                          fontSize: "13px",
                          ...(isLocked ? { opacity: 0.45, cursor: "not-allowed", backgroundColor: "#95a5a6" } : {})
                        }}
                        onClick={() => handleRemoveItem(index)}
                        title={isLocked ? `Locked — returned on ${returnBillNum}` : "Remove item"}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
              <div style={styles.total}>
                Total: {(() => {
                  const totalAmount = selectedItems.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (item.quantity || 0)), 0);
                  return billCurrency === "IQD" ? Math.round(totalAmount).toLocaleString('en-US') + " IQD" : "$" + totalAmount.toFixed(2);
                })()}
              </div>
            </div>
          )}

          <div>
            {isEditMode ? (
              <div style={styles.buttonContainer}>
                <button
                  style={isLoading || selectedItems.length === 0 || !pharmacyId ? styles.buttonDisabled : styles.updateButton}
                  disabled={isLoading || selectedItems.length === 0 || !pharmacyId}
                  onClick={handleUpdateBill}
                >
                  {isLoading ? "Updating..." : "Update Bill"}
                </button>
                <button style={styles.cancelButton} onClick={cancelEdit}>Cancel</button>
              </div>
            ) : (
              <>
                <div style={styles.buttonRow}>
                  <button
                    style={isLoading || selectedItems.length === 0 || !pharmacyId ? styles.buttonDisabled : styles.button}
                    disabled={isLoading || selectedItems.length === 0 || !pharmacyId}
                    onClick={handleSubmit}
                  >
                    {isLoading ? "Processing..." : "Create Sale Bill"}
                  </button>
                  <button
                    style={selectedItems.length === 0 || !pharmacyId ? styles.buttonDisabled : styles.previewButton}
                    disabled={selectedItems.length === 0 || !pharmacyId}
                    onClick={showBillTemplate}
                  >
                    Show Bill Preview
                  </button>
                </div>
                <div style={styles.buttonRowSingle}>
                  <button
                    style={selectedItems.length === 0 && !pharmacyId ? styles.buttonDisabled : styles.cancelButton}
                    disabled={selectedItems.length === 0 && !pharmacyId}
                    onClick={cancelBill}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
                  >
                    Cancel Bill
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent bills section */}
        <div className="card-wrapper" style={styles.recentBillsSection}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Recent Sales Bills</h3>
            <button style={styles.advancedSearchButton} onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}>
              {showAdvancedSearch ? "Hide Search" : "Advanced Search"}
            </button>
          </div>
          {showAdvancedSearch && (
            <div style={styles.searchFilters}>
              <div style={styles.filterSection}>
                <h4 style={styles.filterSectionTitle}>Search Filters</h4>
                <div style={styles.filterRow}>
                  <div style={styles.globalSearchGroup}>
                    <label style={styles.filterLabel}>Global Search</label>
                    <input
                      type="text"
                      style={styles.globalSearchInput}
                      placeholder="Search bill #, item, barcode, pharmacy, branch..."
                      value={filters.globalSearch}
                      onChange={(e) => setFilters(prev => ({ ...prev, globalSearch: e.target.value }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={styles.filterGroup}>
                    <label style={styles.filterLabel}>Bill Number</label>
                    <input
                      type="text"
                      style={styles.filterInput}
                      placeholder="Enter bill number"
                      value={filters.billNumber}
                      onChange={(e) => setFilters(prev => ({ ...prev, billNumber: e.target.value }))}
                    />
                  </div>
                  <div style={styles.filterGroup}>
                    <label style={styles.filterLabel}>Pharmacy Name</label>
                    <Select
                      options={pharmacyFilterOptions}
                      value={pharmacyFilterOptions.find(opt => opt.value === filters.pharmacyName)}
                      onChange={(selected) => setFilters(prev => ({ ...prev, pharmacyName: selected?.value || "" }))}
                      placeholder="Select pharmacy..."
                      isClearable
                      isSearchable
                    />
                  </div>
                </div>
                <div style={styles.filterRow}>
                  <div style={styles.specificItemsGroup}>
                    <label style={styles.filterLabel}>Specific Items</label>
                    <Select
                      isMulti
                      options={itemOptions}
                      value={itemOptions.filter((option) => itemFilters.includes(option.value))}
                      onChange={(selected) => setItemFilters(selected.map((option) => option.value))}
                      placeholder="Select items..."
                      isClearable
                      isSearchable
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div style={styles.filterGroup}>
                    <label style={styles.filterLabel}>Payment Status</label>
                    <select style={styles.filterSelect} value={filters.paymentStatus} onChange={(e) => setFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}>
                      <option value="all">All Payments</option>
                      <option value="Cash">Cash</option>
                      <option value="Unpaid">Unpaid</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>

                  <div style={styles.filterGroup}>
                    <label style={styles.filterLabel}>Branch</label>
                    <select style={styles.filterSelect} value={filters.branch} onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}>
                      <option value="all">All Branches</option>
                      <option value="Slemany">Slemany</option>
                      <option value="Erbil">Erbil</option>
                    </select>
                  </div>

                  <div style={styles.filterGroup}>
                    <label style={styles.filterLabel}>Consignment</label>
                    <select style={styles.filterSelect} value={filters.consignment} onChange={(e) => setFilters(prev => ({ ...prev, consignment: e.target.value }))}>
                      <option value="all">All Types</option>
                      <option value="yes">Consignment</option>
                      <option value="no">Owned</option>
                    </select>
                  </div>
                  <div style={styles.filterGroup}>
                    <label style={styles.filterLabel}>From Date</label>
                    <input type="date" style={styles.dateInput} value={filters.fromDate} onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))} />
                  </div>
                  <div style={styles.filterGroup}>
                    <label style={styles.filterLabel}>To Date</label>
                    <input type="date" style={styles.dateInput} value={filters.toDate} onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))} />
                  </div>
                </div>
                <div style={styles.filterActions}>
                  <button style={styles.clearFiltersButton} onClick={clearFilters}>
                    Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          )}
          {filteredBills.length === 0 ? (
            <p style={styles.noBills}>No bills found matching your criteria.</p>
          ) : (
            <>
              <div className="table-responsive table-edge-to-edge" style={styles.tableContainer}>
                <table style={styles.billsTable}>
                  <thead>
                    <tr>
                      <th style={styles.tableHeaderSortable} onClick={() => handleSort('billNumber')}>
                        Bill # {getSortIcon('billNumber')}
                      </th>
                      <th style={styles.tableHeaderSortable} onClick={() => handleSort('pharmacy')}>
                        Pharmacy {getSortIcon('pharmacy')}
                      </th>
                      <th style={styles.tableHeaderSortable} onClick={() => handleSort('branch')}>
                        Branch {getSortIcon('branch')}
                      </th>
                      <th style={styles.tableHeaderSortable} onClick={() => handleSort('date')}>
                        Date & Time {getSortIcon('date')}
                      </th>
                      <th style={styles.tableHeaderSortablee} onClick={() => handleSort('amount')}>
                        Total Amount {getSortIcon('amount')}
                      </th>
                      <th style={styles.tableHeader}>Payment</th>
                      <th style={styles.tableHeader}>Signature</th>
                      <th style={styles.tableHeader}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentBills.map((bill, index) => {
                      const billCurr = bill.currency || "USD";
                      const totalAmountUSD = billCurr === "USD" ? (bill.items?.reduce((sum, item) => sum + ((item.outPriceUSD || item.price || 0) * item.quantity), 0) || 0) : 0;
                      const totalAmountIQD = billCurr === "IQD" ? (bill.items?.reduce((sum, item) => sum + ((item.outPriceIQD || item.price || 0) * item.quantity), 0) || 0) : 0;
                      const branchStr = getBillBranchDisplay(bill);

                      // Determine if bill is locked
                      const hasReturn = returnBills.some(r => String(r.billNumber) === String(bill.billNumber));
                      const isLocked = hasReturn;
                      const lockReason = hasReturn ? "Bill has return invoices attached" : "Edit Bill";

                      return (
                        <React.Fragment key={bill.id || `${bill.billNumber}-${index}`}>
                          <tr
                            style={{
                              ...(index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd),
                              ...(selectedBill?.billNumber === bill.billNumber ? styles.selectedRow : {}),
                              cursor: "pointer",
                            }}
                            onClick={() => setSelectedBill(selectedBill?.billNumber === bill.billNumber ? null : bill)}
                          >
                            <td style={styles.tableCellCenter}>
                              {formatBillNumber(bill.billNumber)}
                              <button
                                style={styles.copyButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(bill.billNumber.toString());
                                  const button = e.currentTarget;
                                  button.innerHTML = "✓";
                                  button.style.color = "#27ae60";
                                  setTimeout(() => {
                                    button.innerHTML = "📋";
                                    button.style.color = "#2c3e50";
                                  }, 1000);
                                }}
                                title="Copy Bill Number"
                              >
                                📋
                              </button>
                            </td>
                            <td style={styles.tableCell}>{bill.pharmacyName || "N/A"}</td>
                            
                            <td style={styles.tableCellCenter}>
                              <span style={{
                                ...styles.branchBadge,
                                color: branchStr === "Slemany" ? "#16a34a" :
                                       branchStr === "Erbil" ? "#dc2626" :
                                       branchStr === "Duhok" ? "#2563eb" :
                                       branchStr === "Kirkuk" ? "#f59e0b" :
                                       branchStr === "Kalar" ? "#8b5cf6" : "#4b5563",
                                backgroundColor: branchStr === "Slemany" ? "#f0fdf4" :
                                                 branchStr === "Erbil" ? "#fef2f2" :
                                                 branchStr === "Duhok" ? "#eff6ff" :
                                                 branchStr === "Kirkuk" ? "#fffbeb" :
                                                 branchStr === "Kalar" ? "#f5f3ff" : "#f3f4f6",
                              }}>
                                {branchStr}
                              </span>
                            </td>

                            <td style={styles.tableCellCenterdatee}>{formatDateTime(bill.date)}</td>
                            <td style={styles.tableCellRightttt}>{formatTotalLine(totalAmountUSD, totalAmountIQD)}</td>
                            <td style={styles.tableCellCenter}>
                              <span style={{
                                ...styles.paymentBadge,
                                backgroundColor: bill.paymentStatus === "Cash" ? "#27ae60" : bill.paymentStatus === "Paid" ? "#3498db" : "#e74c3c",
                              }}>
                                {bill.paymentStatus}
                              </span>
                            </td>
                            <td style={styles.tableCellCenter}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
                                {billAttachments[bill.billNumber] ? (
                                  <>
                                    <button
                                      style={styles.viewAttachmentButton}
                                      onClick={(e) => { e.stopPropagation(); viewAttachment(bill.billNumber); }}
                                      title="View Scanned Document"
                                    >
                                      📄 View
                                    </button>
                                    <button
                                      style={styles.rescanButton}
                                      onClick={(e) => { e.stopPropagation(); handleRescan(bill.billNumber); }}
                                      disabled={uploadingAttachments[bill.billNumber]}
                                      title="Rescan Document"
                                    >
                                      🔄 Rescan
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      style={uploadingAttachments[bill.billNumber] ? { ...styles.attachButton, opacity: 0.6 } : styles.attachButton}
                                      onClick={(e) => { e.stopPropagation(); handleScanDocument(bill.billNumber); }}
                                      disabled={uploadingAttachments[bill.billNumber]}
                                      title="Scan Document with Camera"
                                    >
                                      {uploadingAttachments[bill.billNumber] ? "⏳ Processing..." : "📷 Scan"}
                                    </button>
                                    <button
                                      style={uploadingAttachments[bill.billNumber] ? { ...styles.uploadButton, opacity: 0.6 } : styles.uploadButton}
                                      onClick={(e) => { e.stopPropagation(); handleFileUpload(bill.billNumber); }}
                                      disabled={uploadingAttachments[bill.billNumber]}
                                      title="Upload File"
                                    >
                                      {uploadingAttachments[bill.billNumber] ? "⏳ Processing..." : "📁 Upload"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                            <td style={styles.tableCellCenter}>
                              <div style={styles.actionButtons}>
                                <button
                                  style={{
                                    ...styles.editButton,
                                    ...(isLocked ? { backgroundColor: "#95a5a6", opacity: 0.6, cursor: "not-allowed" } : {})
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    loadBillForEditing(bill);
                                  }}
                                  title={lockReason}
                                >
                                  {isLocked ? "🔒 Locked" : "Edit"}
                                </button>
                                <button
                                  style={styles.printSmallButton}
                                  onClick={(e) => { e.stopPropagation(); printBill(bill); }}
                                  title="Print Bill"
                                >
                                  Print
                                </button>
                                <button
                                  style={sharingWhatsApp[bill.billNumber] ? styles.whatsappButtonDisabled : styles.whatsappButton}
                                  disabled={!!sharingWhatsApp[bill.billNumber]}
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    shareViaWhatsApp(bill); 
                                  }}
                                  title="Send via WhatsApp"
                                  onMouseEnter={(e) => {
                                    if (!sharingWhatsApp[bill.billNumber]) {
                                      e.currentTarget.style.backgroundColor = "#128C7E";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!sharingWhatsApp[bill.billNumber]) {
                                      e.currentTarget.style.backgroundColor = "#25D366";
                                    }
                                  }}
                                >
                                  {sharingWhatsApp[bill.billNumber] ? (
                                    "⏳..."
                                  ) : (
                                    <>
                                      <WhatsAppIcon size={14} color="white" />
                                      WhatsApp
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {selectedBill?.billNumber === bill.billNumber && (
                            <tr>
                              <td colSpan="8" style={styles.detailCell}>
                                <div style={styles.billDetails}>
                                  <div style={styles.billDetailsHeader}>
                                    <h4 style={styles.billDetailsTitle}>Bill #{formatBillNumber(bill.billNumber)} Details</h4>
                                    <div style={styles.billDetailsActions}>
                                      <button style={styles.printButton} onClick={() => printBill(bill)}>Print Bill</button>
                                      <button
                                        style={{
                                          ...styles.printButton,
                                          backgroundColor: sharingWhatsApp[bill.billNumber] ? "#a8e6c1" : "#25D366",
                                          cursor: sharingWhatsApp[bill.billNumber] ? "not-allowed" : "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "8px",
                                        }}
                                        disabled={!!sharingWhatsApp[bill.billNumber]}
                                        onClick={() => shareViaWhatsApp(bill)}
                                        onMouseEnter={(e) => {
                                          if (!sharingWhatsApp[bill.billNumber]) {
                                            e.currentTarget.style.backgroundColor = "#128C7E";
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!sharingWhatsApp[bill.billNumber]) {
                                            e.currentTarget.style.backgroundColor = "#25D366";
                                          }
                                        }}
                                      >
                                        {sharingWhatsApp[bill.billNumber] ? (
                                          "⏳ Preparing..."
                                        ) : (
                                          <>
                                            <WhatsAppIcon size={16} color="white" />
                                            Send via WhatsApp
                                          </>
                                        )}
                                      </button>
                                      <button style={styles.closeDetailsButton} onClick={() => setSelectedBill(null)}>×</button>
                                    </div>
                                  </div>
                                  <div style={styles.billInfoGrid}>
                                    <div style={styles.billInfoItem}><strong>Pharmacy:</strong> {bill.pharmacyName || "N/A"}</div>
                                    <div style={styles.billInfoItem}><strong>Branch:</strong> {branchStr}</div>
                                    <div style={styles.billInfoItem}><strong>Date:</strong> {formatDateTime(bill.date)}</div>
                                    <div style={styles.billInfoItem}><strong>Created By:</strong> {getDisplayName(bill.createdByName)}</div>
                                    <div style={styles.billInfoItem}>
                                      <strong>Payment Status:</strong>
                                      <span style={{
                                        ...styles.paymentBadge,
                                        backgroundColor: bill.paymentStatus === "Cash" ? "#27ae60" : bill.paymentStatus === "Paid" ? "#3498db" : "#e74c3c",
                                      }}>
                                        {bill.paymentStatus}
                                      </span>
                                    </div>
                                    <div style={styles.billInfoItem}>
                                      <strong>Consignment:</strong>
                                      <span style={{
                                        ...styles.paymentBadge,
                                        backgroundColor: bill.isConsignment ? "#f39c12" : "#2ecc71",
                                      }}>
                                        {bill.isConsignment ? "تحت صرف" : "Owned"}
                                      </span>
                                    </div>
                                    <div style={styles.billInfoItem}><strong>Note:</strong> {bill.note || ""}</div>
                                  </div>
                                  <div className="table-responsive" style={styles.itemsTableContainer}>
                                    <table style={styles.enhancedItemsTable}>
                                      <thead>
                                        <tr>
                                          <th style={styles.enhancedTableHeader}>#</th>
                                          <th style={styles.enhancedTableHeader}>Item Details</th>
                                          <th style={{ ...styles.enhancedTableHeader, textAlign: "center" }}>Barcode</th>
                                          <th style={{ ...styles.enhancedTableHeader, textAlign: "center" }}>Branch</th>
                                          <th style={{ ...styles.enhancedTableHeader, textAlign: "center" }}>Quantity</th>
                                          <th style={{ ...styles.enhancedTableHeader, textAlign: "right" }}>Unit Price</th>
                                          <th style={{ ...styles.enhancedTableHeader, textAlign: "right" }}>Total Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {bill.items?.map((item, idx) => {
                                          const cCurrency = bill.currency || "USD";
                                          const price = cCurrency === "IQD" ? (item.outPriceIQD || item.price || 0) : (item.outPriceUSD || item.price || 0);
                                          const priceDisplay = cCurrency === "IQD"
                                            ? Math.round(price).toLocaleString() + " IQD"
                                            : "$" + price.toFixed(2);
                                          const totalDisplayItem = cCurrency === "IQD"
                                            ? Math.round(price * item.quantity).toLocaleString() + " IQD"
                                            : "$" + (price * item.quantity).toFixed(2);

                                          return (
                                            <tr
                                              key={idx}
                                              style={{
                                                ...styles.enhancedTableRow,
                                                ...(idx % 2 === 0 ? styles.enhancedTableRowEven : styles.enhancedTableRowOdd),
                                              }}
                                            >
                                              <td style={{ ...styles.enhancedTableCell, textAlign: "center", fontWeight: "600" }}>
                                                {idx + 1}
                                              </td>
                                              <td style={styles.enhancedTableCell}>
                                                <div style={{ fontWeight: "600", marginBottom: "4px", fontFamily: "'NRT-Bd', sans-serif" }}>
                                                  {item.name}
                                                </div>
                                                <div style={{ fontSize: "15px", color: "#7f8c8d" }}>
                                                  Exp: {formatExpireDate(item.expireDate)}
                                                </div>
                                              </td>
                                              <td style={{ ...styles.enhancedTableCell, textAlign: "center", fontFamily: "'NRT-Reg', monospace" }}>
                                                {item.barcode}
                                              </td>
                                              <td style={{ ...styles.enhancedTableCell, textAlign: "center" }}>
                                                {item.branch || "N/A"}
                                              </td>
                                              <td style={{ ...styles.enhancedTableCell, textAlign: "center", fontWeight: "600" }}>
                                                {item.quantity}
                                              </td>
                                              <td style={{ ...styles.enhancedTableCell, textAlign: "right", ...styles.amountCell }}>
                                                {priceDisplay}
                                              </td>
                                              <td style={{ ...styles.enhancedTableCell, textAlign: "right", ...styles.amountCell }}>
                                                {totalDisplayItem}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                        <tr style={{ backgroundColor: "#2c3e50", color: "white" }}>
                                          <td colSpan="6" style={{ ...styles.enhancedTableCell, textAlign: "right", fontWeight: "600", color: "white" }}>
                                            GRAND TOTAL:
                                          </td>
                                          <td style={{ ...styles.enhancedTableCell, textAlign: "right", fontWeight: "600", color: "white", fontSize: "18px" }}>
                                            {formatTotalLine(totalAmountUSD, totalAmountIQD)}
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={styles.pagination}>
                  <button style={styles.paginationButton} onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      style={{ ...styles.paginationButton, ...(page === currentPage ? styles.paginationButtonActive : {}) }}
                      onClick={() => paginate(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button style={styles.paginationButton} onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modals */}
        {showBillPreview && currentBill && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>
                  Bill #{currentBill.billNumber === "TEMP0000" ? "TEMP0000" : formatBillNumber(currentBill.billNumber)} Preview
                </h2>
                <div style={styles.modalActions}>
                  <button style={styles.printButton} onClick={() => printBill(currentBill)}>Print Bill</button>
                  <button
                    style={{
                      ...styles.printButton,
                      backgroundColor: sharingWhatsApp[currentBill.billNumber] ? "#a8e6c1" : "#25D366",
                      cursor: sharingWhatsApp[currentBill.billNumber] ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                    disabled={!!sharingWhatsApp[currentBill.billNumber]}
                    onClick={() => shareViaWhatsApp(currentBill)}
                    onMouseEnter={(e) => {
                      if (!sharingWhatsApp[currentBill.billNumber]) {
                        e.currentTarget.style.backgroundColor = "#128C7E";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!sharingWhatsApp[currentBill.billNumber]) {
                        e.currentTarget.style.backgroundColor = "#25D366";
                      }
                    }}
                  >
                    {sharingWhatsApp[currentBill.billNumber] ? (
                      "⏳ Preparing..."
                    ) : (
                      <>
                        <WhatsAppIcon size={16} color="white" />
                        Send via WhatsApp
                      </>
                    )}
                  </button>
                  <button style={styles.closeButton} onClick={closeBillPreview}>Close</button>
                </div>
              </div>
              <div style={styles.billTemplate} dangerouslySetInnerHTML={{ __html: `
                <div style="padding-top: 0px; font-size: 15px;">
                  <div style="margin-bottom: 0px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap;">
                      <div style="flex: 1; min-width: 200px;">
                        <h1 style="margin: 0 0 2px 0; font-size: 24px; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">ARAN MED STORE</h1>
                        <p style="margin: 0 0 3px 0; font-size: 15px; color: #34495e; font-family: 'NRT-Reg', sans-serif;">سلێمانی - بەرامبەر تاوەری تەندروستی سمارت</p>
                        <p style="margin: 0; font-size: 15px; color: #34495e; font-family: 'NRT-Reg', sans-serif;">+964 772 533 5252 | +964 751 741 2241</p>
                      </div>
                      <div style="flex-shrink: 0; text-align: right;">
                        <img src="/Aranlogo.png" alt="Aran Logo" style="width: 200px; max-width: 100%; object-fit: contain; display: inline-block;" />
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;">
                    <div style="flex: 1; min-width: 200px; padding: 12px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e1e8ed;">
                      <h3 style="margin: 0 0 8px 0; font-family: 'NRT-Bd', sans-serif; font-size: 16px; color: #2c3e50;">Bill To: ${currentBill.pharmacyName}</h3>
                      <table style="width: 100%; font-family: 'NRT-Reg', sans-serif; font-size: 14px;">
                        <tr>
                          <td style="font-weight: 600; padding: 3px 10px 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; width: 90px;">Payment:</td>
                          <td style="padding: 3px 0;">
                            <div style="background-color: ${currentBill.paymentStatus === "Cash" ? "#27ae60" : currentBill.paymentStatus === "Paid" ? "#3498db" : "#e74c3c"}; display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 14px; font-weight: 600; color: #fff;">
                              ${currentBill.paymentStatus.toUpperCase()}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style="font-weight: 600; padding: 3px 10px 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; width: 90px;">Consignment:</td>
                          <td style="padding: 3px 0;">
                            <div style="display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 14px; font-weight: 500; color: #34495E">
                              ${currentBill.isConsignment ? 'تحت صرف' : 'Owned'}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <div style="flex: 1; min-width: 200px; padding: 12px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e1e8ed;">
                      <table style="width: 100%; font-family: 'NRT-Reg', sans-serif; font-size: 14px;">
                        <tr>
                          <td style="font-weight: 600; padding: 3px 10px 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">Invoice #:</td>
                          <td style="padding: 3px 0; color: #34495e; font-weight: 500;">${currentBill.billNumber === "TEMP0000" ? "TEMP0000" : formatBillNumber(currentBill.billNumber)}</td>
                        </tr>
                        <tr>
                          <td style="font-weight: 600; padding: 3px 10px 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">Invoice Date:</td>
                          <td style="padding: 3px 0; color: #34495e; font-weight: 500;">${formatDate(currentBill.date)}</td>
                        </tr>
                        <tr>
                          <td style="font-weight: 600; padding: 3px 10px 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">Created By:</td>
                          <td style="padding: 3px 0; color: #34495e; font-weight: 500;">${currentBill.createdByName || "Current User"}</td>
                        </tr>
                      </table>
                    </div>

                    <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                      <img src="/scann.png" alt="QR Code" style="margin-top:10px; width: 110px; max-width: 90%;" />
                    </div>
                  </div>

                  <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 15px; font-size: 14px; min-width: 500px;">
                      <thead>
                        <tr style="background-color: #1e3a8a; color: white;">
                          <th style="padding: 12px 8px; text-align: center; border-radius: 8px 0 0 8px; font-family: 'NRT-Bd', sans-serif;">#</th>
                          <th style="padding: 12px 8px; text-align: left; font-family: 'NRT-Bd', sans-serif;">Item Details</th>
                          <th style="padding: 12px 8px; text-align: center; font-family: 'NRT-Bd', sans-serif;">Barcode</th>
                          <th style="padding: 12px 8px; text-align: center; font-family: 'NRT-Bd', sans-serif;">Qty</th>
                          <th style="padding: 12px 8px; text-align: right; font-family: 'NRT-Bd', sans-serif;">Unit Price</th>
                          <th style="padding: 12px 8px; text-align: right; border-radius: 0 8px 8px 0; font-family: 'NRT-Bd', sans-serif;">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBill.items?.map((item, idx) => {
                          const cb = currentBill.currency || "USD";
                          const price = cb === "IQD"
                            ? (item.outPriceIQD || item.price || 0)
                            : (item.outPriceUSD || item.price || 0);
                          const priceFormatted = cb === "IQD"
                            ? Math.round(price).toLocaleString() + " IQD"
                            : "$" + price.toFixed(2);
                          const totalFormatted = cb === "IQD"
                            ? Math.round(price * item.quantity).toLocaleString() + " IQD"
                            : "$" + (price * item.quantity).toFixed(2);
                          return `
                            <tr>
                              <td style="padding: 10px 8px; border-bottom: 1px solid #e1e8ed; text-align: center; font-weight: 600;">${idx + 1}</td>
                              <td style="padding: 10px 8px; border-bottom: 1px solid #e1e8ed;">
                                <div style="font-weight: 600; margin-bottom: 2px; font-family: 'NRT-Bd', sans-serif; font-size: 14px;">${item.name}</div>
                                <div style="font-size: 13px; color: #7f8c8d;">Exp: ${formatExpireDate(item.expireDate)}</div>
                              </td>
                              <td style="padding: 10px 8px; border-bottom: 1px solid #e1e8ed; text-align: center; font-family: monospace; font-size: 14px;">${item.barcode}</td>
                              <td style="padding: 10px 8px; border-bottom: 1px solid #e1e8ed; text-align: center; font-weight: 600;">${item.quantity}</td>
                              <td style="padding: 10px 8px; border-bottom: 1px solid #e1e8ed; text-align: right; font-weight: 600;">${priceFormatted}</td>
                              <td style="padding: 10px 8px; border-bottom: 1px solid #e1e8ed; text-align: right; font-weight: 600;">${totalFormatted}</td>
                            </tr>
                          `;
                        }).join("")}
                        <tr class="total-row">
                          <td colspan="5" style="background-color: #20c38f !important; color: white; text-align: right; padding: 12px 8px; font-size: 15px; font-family: 'NRT-Bd', sans-serif; border-radius: 8px 0 0 8px;">CURRENT TOTAL:</td>
                          <td style="background-color: #1e3a8a !important; color: white; text-align: right; padding: 12px 8px; font-family: 'NRT-Bd', sans-serif; font-size: 15px; border-radius: 0 8px 8px 0;">
                            ${formatTotalLine(
                              currentBill.items?.reduce((sum, item) => {
                                if (currentBill.currency === "USD") return sum + ((item.outPriceUSD || item.price || 0) * item.quantity);
                                return sum;
                              }, 0) || 0,
                              currentBill.items?.reduce((sum, item) => {
                                if (currentBill.currency === "IQD") return sum + ((item.outPriceIQD || item.price || 0) * item.quantity);
                                return sum;
                              }, 0) || 0
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  ${currentBill.note ? `
                    <div style="background-color: #fff8e1; padding: 10px; border-radius: 8px; border: 1px solid #ffecb3; margin-bottom: 15px;">
                      <h4 style="font-weight: 600; margin: 0 0 4px 0; color: #e67e22; font-size: 14px; font-family: 'NRT-Bd', sans-serif;">Note:</h4>
                      <p style="font-size: 14px; color: #2c3e50; line-height: 1.4; margin: 0; font-family: 'NRT-Reg', sans-serif;">${currentBill.note}</p>
                    </div>
                  ` : ""}

                  <div style="margin-top: 80px; text-align: right; page-break-inside: avoid;">
                    <div style="width: 250px; height: 1.5px; background-color: #2c3e50; margin: 10px 0 8px auto;"></div>
                    <p style="font-size: 14px; color: #34495e; font-style: italic; font-weight: 600; font-family: 'NRT-Reg', sans-serif; margin: 0; padding-right: 15px;">Receiver Signature (Stamp)</p>
                  </div>
                </div>
              `}} />
            </div>
          </div>
        )}

        {showHistoryModal && selectedItemForHistory && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalContent, maxWidth: "700px" }}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Sales History for {selectedItemForHistory.name}</h2>
                <button style={styles.closeButton} onClick={() => setShowHistoryModal(false)}>Close</button>
              </div>
              <div style={styles.historyTableContainer}>
                {selectedItemHistory.length === 0 ? (
                  <p style={{ textAlign: "center", padding: "20px" }}>No sales history found for this item to the selected pharmacy.</p>
                ) : (
                  <div className="table-responsive">
                    <table style={styles.historyTable}>
                      <thead>
                        <tr>
                          <th style={styles.historyTableHeader}>Bill #</th>
                          <th style={styles.historyTableHeader}>Date</th>
                          <th style={styles.historyTableHeader}>Net Price</th>
                          <th style={styles.historyTableHeader}>Sale Price</th>
                          <th style={styles.historyTableHeader}>Quantity</th>
                          <th style={styles.historyTableHeader}>Total</th>
                          <th style={styles.historyTableHeader}>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItemHistory.map((entry, index) => (
                          <tr key={index} style={index % 2 === 0 ? styles.historyTableRowEven : styles.historyTableRowOdd}>
                            <td style={styles.historyTableCell}>{formatBillNumber(entry.billNumber)}</td>
                            <td style={styles.historyTableCell}>{formatDate(entry.billDate)}</td>
                            <td style={styles.historyTableCell}>
                              {entry.originalCurrency === "IQD"
                                ? Math.round(entry.netPriceIQD || entry.netPrice).toLocaleString() + " IQD"
                                : "$" + (entry.netPriceUSD || entry.netPrice).toFixed(2)}
                            </td>
                            <td style={styles.historyTableCell}>
                              {entry.originalCurrency === "IQD"
                                ? Math.round(entry.outPriceIQD || entry.price).toLocaleString() + " IQD"
                                : "$" + (entry.outPriceUSD || entry.price).toFixed(2)}
                            </td>
                            <td style={styles.historyTableCell}>{entry.quantity}</td>
                            <td style={styles.historyTableCell}>
                              {entry.originalCurrency === "IQD"
                                ? Math.round((entry.outPriceIQD || entry.price) * entry.quantity).toLocaleString() + " IQD"
                                : "$" + ((entry.outPriceUSD || entry.price) * entry.quantity).toFixed(2)}
                            </td>
                            <td style={styles.historyTableCell}>
                              <span style={{
                                padding: "4px 10px", borderRadius: "4px", color: "white",
                                backgroundColor: entry.paymentStatus === "Cash" ? "#27ae60" : entry.paymentStatus === "Paid" ? "#3498db" : "#e74c3c",
                                display: "inline-block",
                              }}>
                                {entry.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}