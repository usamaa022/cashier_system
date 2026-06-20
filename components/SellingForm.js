"use client";
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import {
  searchInitializedItems,
  createSoldBill,
  getStoreItems,
  searchPharmacies,
  searchSoldBills,
  updateSoldBill,
  uploadBillAttachmentWithMetadata,
  getBillAttachmentUrlEnhanced,
  deleteBillAttachment,
  storeBase64Image,
  getAllReturns,
  getBase64BillAttachment,
  deleteBase64Attachment,
  getPharmacyReturns,
} from "@/lib/data";
import { auth } from "@/lib/firebase";
import Select from "react-select";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirestore, doc, updateDoc, getDoc, collection, getDocs, query, limit, orderBy, setDoc, where, serverTimestamp, Timestamp, runTransaction, writeBatch } from "firebase/firestore";

const storage = getStorage();
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

// Format Currency based on item's original currency
const formatCurrency = (amount, currency = "USD") => {
  if (amount === undefined || amount === null) {
    return currency === "USD" ? "$0.00" : "0 IQD";
  }
  if (currency === "USD") {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } else {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount)) + " IQD";
  }
};

// Format total display — only show currencies that have a non-zero value
const formatTotalLine = (usd, iqd) => {
  const parts = [];
  if (usd && Math.abs(usd) > 0.001) parts.push(`$${usd.toFixed(2)}`);
  if (iqd && Math.abs(iqd) > 0.5) parts.push(`${Math.round(iqd).toLocaleString()} IQD`);
  if (parts.length === 0) return "$0.00";
  if (parts.length === 2) return `${parts[0]}  |  ${parts[1]}`;
  return parts[0];
};

// Format financial summary line — always show a value even if zero, for both currencies present in the bill set
const formatFinancialLine = (usd, iqd, hasUSD, hasIQD) => {
  const parts = [];
  if (hasUSD) parts.push(`$${(usd || 0).toFixed(2)}`);
  if (hasIQD) parts.push(`${Math.round(iqd || 0).toLocaleString()} IQD`);
  if (parts.length === 0) return "$0.00";
  if (parts.length === 2) return `${parts[0]}  |  ${parts[1]}`;
  return parts[0];
};

// ─── FIXED calculatePharmacyFinancialSummary ──────────────────────────────────
const calculatePharmacyFinancialSummary = (
  pharmacyId,
  allBills = [],
  allReturnBills = [],
  currentBillItems = [],
  isPreview = false
) => {
  let totalUnpaidBillsUSD = 0;
  let totalUnpaidBillsIQD = 0;

  // Track which currencies this pharmacy uses so we always show both columns
  let pharmacyHasUSD = false;
  let pharmacyHasIQD = false;

  // Calculate unpaid bills
  allBills.forEach((bill) => {
    if (bill.pharmacyId !== pharmacyId) return;
    if (bill.paymentStatus !== "Unpaid") return;

    bill.items?.forEach((item) => {
      if (item.originalCurrency === "IQD") {
        pharmacyHasIQD = true;
        totalUnpaidBillsIQD += (item.outPriceIQD || 0) * item.quantity;
      } else {
        pharmacyHasUSD = true;
        totalUnpaidBillsUSD += (item.outPriceUSD || 0) * item.quantity;
      }
    });
  });

  // Add current bill items if preview
  if (isPreview && currentBillItems.length > 0) {
    currentBillItems.forEach((item) => {
      const price =
        item.originalCurrency === "IQD"
          ? item.outPriceIQD || item.price || 0
          : item.outPriceUSD || item.price || 0;
      if (item.originalCurrency === "IQD") {
        pharmacyHasIQD = true;
        totalUnpaidBillsIQD += price * item.quantity;
      } else {
        pharmacyHasUSD = true;
        totalUnpaidBillsUSD += price * item.quantity;
      }
    });
  }

  // Calculate return bills — USD returns offset USD, IQD returns offset IQD only
  let totalReturnBillsUSD = 0;
  let totalReturnBillsIQD = 0;

  allReturnBills.forEach((ret) => {
    if (ret.pharmacyId !== pharmacyId) return;

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

      const currency = item.originalCurrency || item.currency || "USD";

      if (currency === "IQD") {
        const price = item.returnPriceIQD || item.outPriceIQD || item.returnPrice || item.price || 0;
        totalReturnBillsIQD += price * qty;
      } else {
        const price = item.returnPriceUSD || item.outPriceUSD || item.returnPrice || item.price || 0;
        totalReturnBillsUSD += price * qty;
      }
    });
  });

  // FIX: Each currency is independent — no cross-currency subtraction, no clamping to 0
  // A negative remaining means the pharmacy has credit in that currency
  const remainingUnpaidUSD = totalUnpaidBillsUSD - totalReturnBillsUSD;
  const remainingUnpaidIQD = totalUnpaidBillsIQD - totalReturnBillsIQD;

  // Detect which currencies are actually in play for this pharmacy
  // (also check returns in case bills were all paid but returns exist)
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
  header: {
    fontSize: "24px",
    fontWeight: "700",
    marginBottom: "20px",
    color: "#2c3e50",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: "1px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "15px",
    marginBottom: "15px",
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
  textarea: {
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
    resize: "vertical",
    minHeight: "80px",
  },
  select: {
    width: "100%",
    padding: "12px 14px",
    border: "2px solid #e1e8ed",
    borderRadius: "8px",
    fontSize: "16px",
    boxSizing: "border-box",
    backgroundColor: "white",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    outline: "none",
    WebkitAppearance: "none",
  },
  checkboxContainer: {
    display: "flex",
    alignItems: "center",
    marginBottom: "15px",
    padding: "12px",
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
    border: "1px solid #e1e8ed",
  },
  checkbox: {
    marginRight: "10px",
    width: "18px",
    height: "18px",
    accentColor: "#3498db",
  },
  checkboxLabel: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#2c3e50",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
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
    maxHeight: "200px",
    overflowY: "auto",
    zIndex: "1000",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  suggestionItem: {
    padding: "12px 14px",
    cursor: "pointer",
    borderBottom: "1px solid #e1e8ed",
    fontSize: "15px",
    transition: "background-color 0.2s ease",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  searchResults: {
    marginTop: "10px",
    backgroundColor: "white",
    border: "2px solid #e1e8ed",
    borderRadius: "8px",
    overflow: "hidden",
    maxWidth: "100%",
    overflowX: "auto",
  },
  itemGroup: {
    border: "2px solid #e1e8ed",
    marginBottom: "10px",
    borderRadius: "8px",
    overflow: "hidden",
    backgroundColor: "white",
  },
  itemGroupHeader: {
    backgroundColor: "#34495e",
    padding: "12px 14px",
    fontWeight: "600",
    color: "white",
    fontSize: "15px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "flex-start",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    minWidth: "600px",
  },
  tableCell: {
    padding: "10px 8px",
    borderBottom: "1px solid #e1e8ed",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  tableHeader: {
    backgroundColor: "#34495e",
    color: "white",
    padding: "10px 8px",
    textAlign: "left",
    fontSize: "14px",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  addButton: {
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    padding: "8px 14px",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    touchAction: "manipulation",
  },
  historyButton: {
    backgroundColor: "#8e44ad",
    color: "white",
    border: "none",
    padding: "8px 14px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'NRT-Bd', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    touchAction: "manipulation",
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
  editModeButtons: {
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
    backgroundColor: "#95a5a6",
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
    backgroundColor: "#95a5a6",
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
    backgroundColor: "#ffeaa7",
    color: "#d63031",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "15px",
    border: "1px solid #fab1a0",
    fontSize: "15px",
    position: "relative",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
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
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    marginBottom: "10px",
    borderRadius: "8px",
    border: "1px solid #e1e8ed",
    maxWidth: "100%",
  },
  billsTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
    fontFamily: "'NRT-Reg', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    minWidth: "700px",
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
    overflowX: "auto",
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
    zIndex: 1000,
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
  rowContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'stretch',
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    border: '1px solid #f0f0f0',
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
  noteField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
  },
  textareaField: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1.5px solid #e9ecef',
    borderRadius: '8px',
    width: '100%',
    height: '38px',
    resize: 'none',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
    color: '#4b5563',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  consignmentContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingTop: '4px',
  },
  consignmentCheckbox: {
    width: '16px',
    height: '16px',
    margin: 0,
    cursor: 'pointer',
    accentColor: '#f59e0b',
  },
  consignmentLabel: {
    fontSize: '13px',
    color: '#6b7280',
    cursor: 'pointer',
    fontWeight: '500',
  },
  itemControls: {
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
  selectedItemRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
  },
  selectedItemControls: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
  },
};

// ─── EnhancedBillDetailsTable ─────────────────────────────────────────────────
const EnhancedBillDetailsTable = memo(({ items }) => {
  const totalAmountUSD = items?.reduce((sum, item) => sum + ((item.outPriceUSD || 0) * item.quantity), 0) || 0;
  const totalAmountIQD = items?.reduce((sum, item) => sum + ((item.outPriceIQD || 0) * item.quantity), 0) || 0;

  return (
    <div style={styles.itemsTableContainer}>
      <table style={styles.enhancedItemsTable}>
        <thead>
          <tr>
            <th style={styles.enhancedTableHeader}>#</th>
            <th style={styles.enhancedTableHeader}>Item Details</th>
            <th style={{ ...styles.enhancedTableHeader, textAlign: "center" }}>Barcode</th>
            <th style={{ ...styles.enhancedTableHeader, textAlign: "center" }}>Quantity</th>
            <th style={{ ...styles.enhancedTableHeader, textAlign: "right" }}>Unit Price</th>
            <th style={{ ...styles.enhancedTableHeader, textAlign: "right" }}>Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {items?.map((item, index) => {
            const price = item.originalCurrency === "IQD" ? (item.outPriceIQD || 0) : (item.outPriceUSD || 0);
            const priceDisplay = item.originalCurrency === "IQD"
              ? Math.round(price).toLocaleString() + " IQD"
              : "$" + price.toFixed(2);
            const totalDisplayItem = item.originalCurrency === "IQD"
              ? Math.round(price * item.quantity).toLocaleString() + " IQD"
              : "$" + (price * item.quantity).toFixed(2);

            return (
              <tr
                key={index}
                style={{
                  ...styles.enhancedTableRow,
                  ...(index % 2 === 0 ? styles.enhancedTableRowEven : styles.enhancedTableRowOdd),
                }}
              >
                <td style={{ ...styles.enhancedTableCell, textAlign: "center", fontWeight: "600" }}>
                  {index + 1}
                </td>
                <td style={styles.enhancedTableCell}>
                  <div style={{ fontWeight: "600", marginBottom: "4px", fontFamily: "'NRT-Bd', sans-serif" }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: "15px", color: "#7f8c8d" }}>
                    Exp: {formatExpireDate(item.expireDate)}
                    {item.originalCurrency && ` • Currency: ${item.originalCurrency}`}
                  </div>
                </td>
                <td style={{ ...styles.enhancedTableCell, textAlign: "center", fontFamily: "'NRT-Reg', monospace" }}>
                  {item.barcode}
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
            <td colSpan="5" style={{ ...styles.enhancedTableCell, textAlign: "right", fontWeight: "600", color: "white" }}>
              GRAND TOTAL:
            </td>
            <td style={{ ...styles.enhancedTableCell, textAlign: "right", fontWeight: "600", color: "white", fontSize: "18px" }}>
              {formatTotalLine(totalAmountUSD, totalAmountIQD)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});
EnhancedBillDetailsTable.displayName = 'EnhancedBillDetailsTable';

// ─── ScannerAttachmentButton ──────────────────────────────────────────────────
const ScannerAttachmentButton = memo(({ bill, isUploading, onScan, onUpload, onView, onRescan, hasAttachment }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
      {hasAttachment ? (
        <>
          <button
            style={styles.viewAttachmentButton}
            onClick={(e) => { e.stopPropagation(); onView(bill.billNumber); }}
            title="View Scanned Document"
          >
            📄 View
          </button>
          <button
            style={styles.rescanButton}
            onClick={(e) => { e.stopPropagation(); onRescan(bill.billNumber); }}
            disabled={isUploading}
            title="Rescan Document"
          >
            🔄 Rescan
          </button>
        </>
      ) : (
        <>
          <button
            style={isUploading ? { ...styles.attachButton, opacity: 0.6 } : styles.attachButton}
            onClick={(e) => { e.stopPropagation(); onScan(bill.billNumber); }}
            disabled={isUploading}
            title="Scan Document with Camera"
          >
            {isUploading ? "⏳ Processing..." : "📷 Scan"}
          </button>
          <button
            style={isUploading ? { ...styles.uploadButton, opacity: 0.6 } : styles.uploadButton}
            onClick={(e) => { e.stopPropagation(); onUpload(bill.billNumber); }}
            disabled={isUploading}
            title="Upload File"
          >
            {isUploading ? "⏳ Processing..." : "📁 Upload"}
          </button>
        </>
      )}
    </div>
  );
});
ScannerAttachmentButton.displayName = 'ScannerAttachmentButton';

// ─── AdvancedSearchFilters ────────────────────────────────────────────────────
const AdvancedSearchFilters = memo(({
  filters,
  setFilters,
  itemFilters,
  setItemFilters,
  pharmacyFilterOptions,
  itemOptions,
  clearFilters
}) => {
  const [localGlobalSearch, setLocalGlobalSearch] = useState(filters.globalSearch);
  const [localBillNumber, setLocalBillNumber] = useState(filters.billNumber);
  const [localPharmacyName, setLocalPharmacyName] = useState(filters.pharmacyName);
  const [localFromDate, setLocalFromDate] = useState(filters.fromDate);
  const [localToDate, setLocalToDate] = useState(filters.toDate);
  const [localPaymentStatus, setLocalPaymentStatus] = useState(filters.paymentStatus);
  const [localConsignment, setLocalConsignment] = useState(filters.consignment);

  const debounceTimer = useRef(null);

  const updateGlobalSearch = useCallback((value) => {
    setLocalGlobalSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, globalSearch: value }));
    }, 500);
  }, [setFilters]);

  const updateBillNumber = useCallback((value) => {
    setLocalBillNumber(value);
    setFilters(prev => ({ ...prev, billNumber: value }));
  }, [setFilters]);

  const updatePharmacyName = useCallback((value) => {
    setLocalPharmacyName(value);
    setFilters(prev => ({ ...prev, pharmacyName: value }));
  }, [setFilters]);

  const updateFromDate = useCallback((value) => {
    setLocalFromDate(value);
    setFilters(prev => ({ ...prev, fromDate: value }));
  }, [setFilters]);

  const updateToDate = useCallback((value) => {
    setLocalToDate(value);
    setFilters(prev => ({ ...prev, toDate: value }));
  }, [setFilters]);

  const updatePaymentStatus = useCallback((value) => {
    setLocalPaymentStatus(value);
    setFilters(prev => ({ ...prev, paymentStatus: value }));
  }, [setFilters]);

  const updateConsignment = useCallback((value) => {
    setLocalConsignment(value);
    setFilters(prev => ({ ...prev, consignment: value }));
  }, [setFilters]);

  useEffect(() => {
    setLocalGlobalSearch(filters.globalSearch);
    setLocalBillNumber(filters.billNumber);
    setLocalPharmacyName(filters.pharmacyName);
    setLocalFromDate(filters.fromDate);
    setLocalToDate(filters.toDate);
    setLocalPaymentStatus(filters.paymentStatus);
    setLocalConsignment(filters.consignment);
  }, [filters]);

  useEffect(() => {
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);

  const handleClearFilters = useCallback(() => {
    clearFilters();
    setItemFilters([]);
    setLocalGlobalSearch("");
    setLocalBillNumber("");
    setLocalPharmacyName("");
    setLocalFromDate("");
    setLocalToDate("");
    setLocalPaymentStatus("all");
    setLocalConsignment("all");
  }, [clearFilters, setItemFilters]);

  return (
    <div style={styles.searchFilters}>
      <div style={styles.filterSection}>
        <h4 style={styles.filterSectionTitle}>Search Filters</h4>
        <div style={styles.filterRow}>
          <div style={styles.globalSearchGroup}>
            <label style={styles.filterLabel}>Global Search</label>
            <input
              type="text"
              style={styles.globalSearchInput}
              placeholder="Search bill #, item, barcode, pharmacy..."
              value={localGlobalSearch}
              onChange={(e) => updateGlobalSearch(e.target.value)}
            />
          </div>
        </div>
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Bill Number</label>
            <input
              type="text"
              style={styles.filterInput}
              placeholder="Enter bill number"
              value={localBillNumber}
              onChange={(e) => updateBillNumber(e.target.value)}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Pharmacy Name</label>
            <Select
              options={pharmacyFilterOptions}
              value={pharmacyFilterOptions.find(opt => opt.value === localPharmacyName)}
              onChange={(selected) => updatePharmacyName(selected?.value || "")}
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
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Payment Status</label>
            <select style={styles.filterSelect} value={localPaymentStatus} onChange={(e) => updatePaymentStatus(e.target.value)}>
              <option value="all">All Payments</option>
              <option value="Cash">Cash</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Consignment</label>
            <select style={styles.filterSelect} value={localConsignment} onChange={(e) => updateConsignment(e.target.value)}>
              <option value="all">All Types</option>
              <option value="yes">Consignment</option>
              <option value="no">Owned</option>
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>From Date</label>
            <input type="date" style={styles.dateInput} value={localFromDate} onChange={(e) => updateFromDate(e.target.value)} />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>To Date</label>
            <input type="date" style={styles.dateInput} value={localToDate} onChange={(e) => updateToDate(e.target.value)} />
          </div>
        </div>
        <div style={styles.filterActions}>
          <button style={styles.clearFiltersButton} onClick={handleClearFilters}>
            Clear All Filters
          </button>
        </div>
      </div>
    </div>
  );
});
AdvancedSearchFilters.displayName = 'AdvancedSearchFilters';

// ─── BillPreview ──────────────────────────────────────────────────────────────
const BillPreview = memo(({ bill, onClose, onPrint, paymentMethod, recentBills, returnBills }) => {
  const financialSummary = calculatePharmacyFinancialSummary(
    bill.pharmacyId,
    recentBills || [],
    returnBills || [],
    bill.items,
    bill.isPreview || false
  );

  const { pharmacyHasUSD, pharmacyHasIQD } = financialSummary;
  const billPaymentMethod = bill.paymentStatus || paymentMethod;

  const getPaymentStatusColor = (pm) => {
    switch (pm) {
      case "Cash":   return "#27ae60";
      case "Unpaid": return "#e74c3c";
      case "Paid":   return "#3498db";
      default:       return "#95a5a6";
    }
  };

  const currentBillTotalUSD = bill.items?.reduce((sum, item) => {
    if (item.originalCurrency !== "IQD") return sum + ((item.outPriceUSD || item.price || 0) * item.quantity);
    return sum;
  }, 0) || 0;

  const currentBillTotalIQD = bill.items?.reduce((sum, item) => {
    if (item.originalCurrency === "IQD") return sum + ((item.outPriceIQD || item.price || 0) * item.quantity);
    return sum;
  }, 0) || 0;

  const displayBillNumber = bill.billNumber === "TEMP0000" ? "TEMP0000" : formatBillNumber(bill.billNumber);
  const creatorDisplayName = getDisplayName(bill.createdByName || "Unknown User");

  const unpaidLine   = formatFinancialLine(financialSummary.totalUnpaidBillsUSD, financialSummary.totalUnpaidBillsIQD, pharmacyHasUSD, pharmacyHasIQD);
  const returnLine   = formatFinancialLine(financialSummary.totalReturnBillsUSD, financialSummary.totalReturnBillsIQD, pharmacyHasUSD, pharmacyHasIQD);
  const remainLine   = formatFinancialLine(financialSummary.remainingUnpaidUSD, financialSummary.remainingUnpaidIQD, pharmacyHasUSD, pharmacyHasIQD);

  const htmlContent = `
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
          <h3 style="margin: 0 0 8px 0; font-family: 'NRT-Bd', sans-serif; font-size: 16px; color: #2c3e50;">Bill To: ${bill.pharmacyName}</h3>
          <table style="width: 100%; font-family: 'NRT-Reg', sans-serif; font-size: 14px;">
            <tr>
              <td style="font-weight: 600; padding: 3px 10px 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; width: 90px;">Payment:</td>
              <td style="padding: 3px 0;">
                <div style="background-color: ${getPaymentStatusColor(billPaymentMethod)}; display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 14px; font-weight: 600; color: #fff;">
                  ${billPaymentMethod.toUpperCase()}
                </div>
              </td>
            </tr>
            <tr>
              <td style="font-weight: 600; padding: 3px 10px 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; width: 90px;">Consignment:</td>
              <td style="padding: 3px 0;">
                <div style="display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 14px; font-weight: 500; color: #34495E">
                  ${bill.isConsignment ? 'تحت صرف' : 'Owned'}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <div style="flex: 1; min-width: 200px; padding: 12px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e1e8ed;">
          <table style="width: 100%; font-family: 'NRT-Reg', sans-serif; font-size: 14px;">
            <tr>
              <td style="font-weight: 600; padding: 3px 10px 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">Invoice #:</td>
              <td style="padding: 3px 0; color: #34495e; font-weight: 500;">${displayBillNumber}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; padding: 3px 10px 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">Invoice Date:</td>
              <td style="padding: 3px 0; color: #34495e; font-weight: 500;">${formatDate(bill.date)}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; padding: 3px 10px 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif;">Created By:</td>
              <td style="padding: 3px 0; color: #34495e; font-weight: 500;">${creatorDisplayName}</td>
            </tr>
          </table>
        </div>

        <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          <img src="/scann.png" alt="scan me" style="margin-top:10px; width: 100px; max-width: 100%;" />
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 14px; min-width: 500px;">
          <thead>
            <tr style="background-color: #3498db; color: white;">
              <th style="padding: 8px; text-align: center; font-family: 'NRT-Bd', sans-serif;">#</th>
              <th style="padding: 8px; text-align: left; font-family: 'NRT-Bd', sans-serif;">Item Details</th>
              <th style="padding: 8px; text-align: center; font-family: 'NRT-Bd', sans-serif;">Barcode</th>
              <th style="padding: 8px; text-align: center; font-family: 'NRT-Bd', sans-serif;">Qty</th>
              <th style="padding: 8px; text-align: right; font-family: 'NRT-Bd', sans-serif;">Unit Price</th>
              <th style="padding: 8px; text-align: right; font-family: 'NRT-Bd', sans-serif;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${bill.items?.map((item, index) => {
              const price = item.originalCurrency === "IQD"
                ? (item.outPriceIQD || item.price || 0)
                : (item.outPriceUSD || item.price || 0);
              const priceFormatted = item.originalCurrency === "IQD"
                ? Math.round(price).toLocaleString() + " IQD"
                : "$" + price.toFixed(2);
              const totalFormatted = item.originalCurrency === "IQD"
                ? Math.round(price * item.quantity).toLocaleString() + " IQD"
                : "$" + (price * item.quantity).toFixed(2);
              return `
                <tr style="border-bottom: 1px solid #e1e8ed;">
                  <td style="padding: 6px; text-align: center; font-weight: 600;">${index + 1}</td>
                  <td style="padding: 6px;">
                    <div style="font-weight: 600; margin-bottom: 2px; font-family: 'NRT-Bd', sans-serif; font-size: 14px;">${item.name}</div>
                    <div style="font-size: 13px; color: #7f8c8d;">Exp: ${formatExpireDate(item.expireDate)}</div>
                  </td>
                  <td style="padding: 6px; text-align: center; font-family: monospace; font-size: 14px;">${item.barcode}</td>
                  <td style="padding: 6px; text-align: center; font-weight: 600;">${item.quantity}</td>
                  <td style="padding: 6px; text-align: right; font-weight: 600;">${priceFormatted}</td>
                  <td style="padding: 6px; text-align: right; font-weight: 600;">${totalFormatted}</td>
                </tr>
              `;
            }).join("")}
            <tr style="background-color: #34495E; font-weight: 700;">
              <td colspan="5" style="padding: 10px; color: white; text-align: right; font-size: 16px; font-family: 'NRT-Bd', sans-serif;">CURRENT TOTAL:</td>
              <td style="padding: 10px; text-align: right; color: white; font-family: 'NRT-Bd', sans-serif; font-size: 16px;">
                ${formatTotalLine(currentBillTotalUSD, currentBillTotalIQD)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="background-color: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #e1e8ed; margin-bottom: 15px; font-size: 14px;">
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e1e8ed; flex-wrap: wrap;">
          <span style="font-family: 'NRT-Reg', sans-serif;">Total Unpaid Bills:</span>
          <span style="font-family: 'NRT-Bd', sans-serif; font-weight: 600;">${unpaidLine}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e1e8ed; flex-wrap: wrap;">
          <span style="font-family: 'NRT-Reg', sans-serif;">Total Return Bills:</span>
          <span style="font-family: 'NRT-Bd', sans-serif; font-weight: 600; color: #e74c3c;">- ${returnLine}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; flex-wrap: wrap;">
          <span style="font-family: 'NRT-Bd', sans-serif; font-weight: 600; color: #e74c3c;">Remaining Unpaid Balance:</span>
          <span style="font-family: 'NRT-Bd', sans-serif; font-weight: 600; color: #e74c3c;">${remainLine}</span>
        </div>
      </div>

      ${bill.note ? `
        <div style="background-color: #fff8e1; padding: 10px; border-radius: 8px; border: 1px solid #ffecb3; margin-bottom: 15px;">
          <h4 style="font-weight: 600; margin: 0 0 4px 0; color: #e67e22; font-size: 14px; font-family: 'NRT-Bd', sans-serif;">Note:</h4>
          <p style="font-size: 14px; color: #2c3e50; line-height: 1.4; margin: 0; font-family: 'NRT-Reg', sans-serif;">${bill.note}</p>
        </div>
      ` : ""}

      <div style="margin-top: 15px; text-align: right;">
        <div style="width: 200px; height: 1px; background-color: #3498db; margin: 10px 0 5px auto;"></div>
        <p style="font-size: 13px; color: #7f8c8d; font-style: italic; font-family: 'NRT-Reg', sans-serif; margin: 0;">Receiver Signature (Stamp)</p>
      </div>
    </div>
  `;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            Bill #{displayBillNumber} Preview
          </h2>
          <div style={styles.modalActions}>
            <button style={styles.printButton} onClick={() => onPrint(bill)}>Print Bill</button>
            <button style={styles.closeButton} onClick={onClose}>Close</button>
          </div>
        </div>
        <div style={styles.billTemplate} dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
    </div>
  );
});
BillPreview.displayName = 'BillPreview';

// ─── ItemHistoryModal ─────────────────────────────────────────────────────────
const ItemHistoryModal = memo(({ item, history, onClose }) => {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Sales History for {item.name}</h2>
          <button style={styles.closeButton} onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: "20px", overflowX: "auto" }}>
          {history.length === 0 ? (
            <p>No sales history found for this item to the selected pharmacy.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px", minWidth: "500px" }}>
              <thead>
                <tr style={{ backgroundColor: "#3498db", color: "white" }}>
                  <th style={{ padding: "12px", textAlign: "left" }}>Bill #</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Date</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Net Price</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Sale Price</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Quantity</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Total</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Payment</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? "#f8f9fa" : "white" }}>
                    <td style={{ padding: "12px" }}>{formatBillNumber(entry.billNumber)}</td>
                    <td style={{ padding: "12px" }}>{formatDate(entry.billDate)}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      {entry.originalCurrency === "IQD"
                        ? Math.round(entry.netPriceIQD || entry.netPrice).toLocaleString() + " IQD"
                        : "$" + (entry.netPriceUSD || entry.netPrice).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      {entry.originalCurrency === "IQD"
                        ? Math.round(entry.outPriceIQD || entry.price).toLocaleString() + " IQD"
                        : "$" + (entry.outPriceUSD || entry.price).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{entry.quantity}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      {entry.originalCurrency === "IQD"
                        ? Math.round((entry.outPriceIQD || entry.price) * entry.quantity).toLocaleString() + " IQD"
                        : "$" + ((entry.outPriceUSD || entry.price) * entry.quantity).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        padding: "6px 10px", borderRadius: "4px", color: "white",
                        backgroundColor: entry.paymentStatus === "Cash" ? "#27ae60" : entry.paymentStatus === "Paid" ? "#3498db" : "#e74c3c",
                      }}>
                        {entry.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
});
ItemHistoryModal.displayName = 'ItemHistoryModal';

// ─── RecentBills ──────────────────────────────────────────────────────────────
const RecentBills = memo(({
  showAdvancedSearch,
  setShowAdvancedSearch,
  filteredBills,
  currentBills,
  selectedBill,
  setSelectedBill,
  uploadingAttachments,
  loadBillForEditing,
  printBill,
  currentPage,
  totalPages,
  paginate,
  sortConfig,
  handleSort,
  getSortIcon,
  filters,
  setFilters,
  itemFilters,
  setItemFilters,
  pharmacyFilterOptions,
  itemOptions,
  clearFilters,
  onViewAttachment,
  onScanDocument,
  onFileUpload,
  onRescan,
  billAttachments
}) => {
  return (
    <div style={styles.recentBillsSection}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>Recent Sales Bills</h3>
        <button style={styles.advancedSearchButton} onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}>
          {showAdvancedSearch ? "Hide Search" : "Advanced Search"}
        </button>
      </div>
      {showAdvancedSearch && (
        <AdvancedSearchFilters
          filters={filters}
          setFilters={setFilters}
          itemFilters={itemFilters}
          setItemFilters={setItemFilters}
          pharmacyFilterOptions={pharmacyFilterOptions}
          itemOptions={itemOptions}
          clearFilters={clearFilters}
        />
      )}
      {filteredBills.length === 0 ? (
        <p style={styles.noBills}>No bills found matching your criteria.</p>
      ) : (
        <>
          <div style={styles.tableContainer}>
            <table style={styles.billsTable}>
              <thead>
                <tr>
                  <th style={styles.tableHeaderSortable} onClick={() => handleSort('billNumber')}>
                    Bill # {getSortIcon('billNumber')}
                  </th>
                  <th style={styles.tableHeaderSortable} onClick={() => handleSort('pharmacy')}>
                    Pharmacy {getSortIcon('pharmacy')}
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
                  const totalAmountUSD = bill.items?.reduce((sum, item) => sum + ((item.outPriceUSD || 0) * item.quantity), 0) || 0;
                  const totalAmountIQD = bill.items?.reduce((sum, item) => sum + ((item.outPriceIQD || 0) * item.quantity), 0) || 0;

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
                          <ScannerAttachmentButton
                            bill={bill}
                            isUploading={uploadingAttachments[bill.billNumber]}
                            onScan={onScanDocument}
                            onUpload={onFileUpload}
                            onView={onViewAttachment}
                            onRescan={onRescan}
                            hasAttachment={!!billAttachments[bill.billNumber]}
                          />
                        </td>
                        <td style={styles.tableCellCenter}>
                          <div style={styles.actionButtons}>
                            <button
                              style={styles.editButton}
                              onClick={(e) => { e.stopPropagation(); loadBillForEditing(bill); }}
                              title="Edit Bill"
                            >
                              Edit
                            </button>
                            <button
                              style={styles.printSmallButton}
                              onClick={(e) => { e.stopPropagation(); printBill(bill); }}
                              title="Print Bill"
                            >
                              Print
                            </button>
                          </div>
                        </td>
                      </tr>
                      {selectedBill?.billNumber === bill.billNumber && (
                        <tr>
                          <td colSpan="7" style={styles.detailCell}>
                            <div style={styles.billDetails}>
                              <div style={styles.billDetailsHeader}>
                                <h4 style={styles.billDetailsTitle}>Bill #{formatBillNumber(bill.billNumber)} Details</h4>
                                <div style={styles.billDetailsActions}>
                                  <button style={styles.printButton} onClick={() => printBill(bill)}>Print Bill</button>
                                  <button style={styles.closeDetailsButton} onClick={() => setSelectedBill(null)}>×</button>
                                </div>
                              </div>
                              <div style={styles.billInfoGrid}>
                                <div style={styles.billInfoItem}><strong>Pharmacy:</strong> {bill.pharmacyName || "N/A"}</div>
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
                              <EnhancedBillDetailsTable items={bill.items} />
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
  );
});
RecentBills.displayName = 'RecentBills';

// ─── Main SellingForm Component ───────────────────────────────────────────────
export default function SellingForm({ onBillCreated, userRole, user }) {
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacySuggestions, setPharmacySuggestions] = useState([]);
  const [showPharmacySuggestions, setShowPharmacySuggestions] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState("Unpaid");
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
  const [filters, setFilters] = useState({
    billNumber: "",
    itemName: "",
    paymentStatus: "all",
    pharmacyName: "",
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
  const fileInputRef = useRef(null);

  // ── FIX: Accept pharmacyId as explicit param to avoid stale closure ─────────
  const loadReturnedItemsForBill = useCallback(async (billNumber, resolvedPharmacyId) => {
    try {
      const pid = resolvedPharmacyId;
      if (!pid) return {};

      const returns = await getPharmacyReturns(pid);
      const billReturns = returns.filter(ret => ret.billNumber === billNumber);

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

  // ── Attachment helpers ──────────────────────────────────────────────────────
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
    const existingItemIndex = selectedItems.findIndex((item) => item.batchId === batch.batchId);
    const displayPrice = batch.originalCurrency === "IQD" ? batch.outPriceIQD : batch.outPriceUSD;
    const displayNetPrice = batch.originalCurrency === "IQD" ? batch.netPriceIQD : batch.netPriceUSD;

    if (existingItemIndex >= 0) {
      const updatedItems = [...selectedItems];
      const actualBatch = storeItems.find((item) => item.id === batch.batchId);
      const maxQty = actualBatch ? actualBatch.quantity : batch.quantity;
      updatedItems[existingItemIndex].quantity = Math.min(updatedItems[existingItemIndex].quantity + 1, maxQty);
      updatedItems[existingItemIndex].availableQuantity = maxQty;
      setSelectedItems(updatedItems);
    } else {
      const actualBatch = storeItems.find((item) => item.id === batch.batchId);
      const availableQty = actualBatch ? actualBatch.quantity : batch.quantity;
      setSelectedItems([...selectedItems, {
        ...batch,
        quantity: 1,
        price: displayPrice,
        netPrice: displayNetPrice,
        outPrice: displayPrice,
        availableQuantity: availableQty,
        batchId: batch.batchId,
        originalCurrency: batch.originalCurrency || "USD",
        outPriceUSD: batch.outPriceUSD,
        outPriceIQD: batch.outPriceIQD,
        netPriceUSD: batch.netPriceUSD,
        netPriceIQD: batch.netPriceIQD,
        hasReturn: false,
        isLocked: false,
      }]);
    }
    setSearchQuery("");
  }, [selectedItems, storeItems]);

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
      const actualBatch = storeItems.find((item) => item.id === updatedItems[index].batchId);
      const maxQty = actualBatch ? actualBatch.quantity : updatedItems[index].availableQuantity;
      updatedItems[index].quantity = Math.min(Math.max(1, parseInt(value) || 1), maxQty);
      updatedItems[index].availableQuantity = maxQty;
    } else if (field === "price") {
      const price = parseFloat(value) || 0;
      updatedItems[index].price = price;
      if (updatedItems[index].originalCurrency === "IQD") {
        updatedItems[index].outPriceIQD = price;
        updatedItems[index].outPriceUSD = 0;
      } else {
        updatedItems[index].outPriceUSD = price;
        updatedItems[index].outPriceIQD = 0;
      }
    }
    setSelectedItems(updatedItems);
  }, [selectedItems, storeItems]);

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

  // ── Search items (debounced) ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        try {
          let results = [];
          const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/);
          try {
            if (/^\d+$/.test(searchQuery.trim())) {
              const barcodeResults = await searchInitializedItems(searchQuery.trim(), "barcode");
              results = [...results, ...barcodeResults];
            }
            const nameResults = await searchInitializedItems(searchQuery.trim(), "name");
            results = [...results, ...nameResults];
          } catch {
            results = storeItems.filter((item) =>
              searchTerms.some((term) => item.name.toLowerCase().includes(term) || item.barcode.toLowerCase().includes(term))
            );
          }
          results = results.filter((item, index, self) => index === self.findIndex((i) => i.barcode === item.barcode));
          results = results.filter((item) =>
            searchTerms.some((term) => item.name.toLowerCase().includes(term) || (item.barcode && item.barcode.toLowerCase().includes(term)))
          );
          setSearchResults(results);
        } catch (err) {
          const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/);
          setSearchResults(storeItems.filter((item) =>
            searchTerms.some((term) => item.name.toLowerCase().includes(term) || (item.barcode && item.barcode.toLowerCase().includes(term)))
          ));
        }
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, storeItems]);

  // ── Pharmacy search (debounced) ─────────────────────────────────────────────
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

  // ── Load pharmacy filter options ────────────────────────────────────────────
  useEffect(() => {
    searchPharmacies("").then((pharmacies) => {
      setPharmacyFilterOptions(pharmacies.map((p) => ({ value: p.name, label: `${p.name} (${p.code})` })));
    }).catch(console.error);
  }, []);

  // ── Load all attachments ────────────────────────────────────────────────────
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

  // ── Initial data fetch ──────────────────────────────────────────────────────
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
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [loadAllAttachments]);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validateBillBeforeSubmit = useCallback(() => {
    let warningMessage = "";
    selectedItems.forEach((item) => {
      if (item.price < item.netPrice) {
        const sym = item.originalCurrency === "IQD" ? "IQD" : "$";
        warningMessage += `• ${item.name}: Selling price (${sym} ${item.price}) is below net price (${sym} ${item.netPrice})\n`;
      }
    });
    if (warningMessage) return window.confirm(`Price Warning:\n${warningMessage}\nDo you want to proceed anyway?`);
    return true;
  }, [selectedItems]);

  // ── Generate bill number ────────────────────────────────────────────────────
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

  // ── Submit (create) ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!pharmacyId) { setError("Please select a pharmacy."); return; }
    if (selectedItems.length === 0) { setError("Please add at least one item."); return; }
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

      const preparedItems = selectedItems.map((item) => ({
        barcode: item.barcode, name: item.name, quantity: item.quantity,
        netPriceUSD: item.netPriceUSD, netPriceIQD: item.netPriceIQD,
        outPriceUSD: item.outPriceUSD, outPriceIQD: item.outPriceIQD,
        price: item.price, expireDate: item.expireDate, batchId: item.batchId,
        originalCurrency: item.originalCurrency || "USD",
      }));

      const billNumber = await generateSellingBillNumber();

      const bill = await createSoldBill({
        items: preparedItems, pharmacyId, pharmacyName, paymentMethod,
        isConsignment, note: note.trim(), createdBy: creatorEmail,
        createdByName: creatorName, billNumber,
      });

      if (onBillCreated) onBillCreated(bill);
      setCurrentBill(bill);

      setIsLoading(false);
      setShowBillPreview(true);

      setSelectedItems([]);
      setNote("");
      alert(`Bill #${billNumber} created successfully by ${creatorName}!`);

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
  }, [pharmacyId, selectedItems, validateBillBeforeSubmit, user, onBillCreated, paymentMethod, isConsignment, note, pharmacyName, generateSellingBillNumber, loadAllAttachments]);

  // ── Update (edit) ───────────────────────────────────────────────────────────
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
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        netPriceUSD: item.netPriceUSD,
        netPriceIQD: item.netPriceIQD,
        outPriceUSD: item.outPriceUSD,
        outPriceIQD: item.outPriceIQD,
        price: item.price,
        expireDate: item.expireDate,
        batchId: item.batchId,
        originalCurrency: item.originalCurrency || "USD",
        isLocked: item.isLocked || false,
        hasReturn: item.hasReturn || false,
        returnQuantity: item.returnQuantity || 0,
        returnBillNumber: item.returnBillNumber || "",
      }));

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

      const updatedBill = await updateSoldBill(editingBillNumber, {
        items: preparedItems,
        pharmacyId,
        pharmacyName,
        date: dateToSave,
        paymentMethod,
        isConsignment,
        note: note.trim(),
        updatedBy: updaterEmail,
        updatedByName: updaterName,
        updatedAt: serverTimestamp(),
      });

      if (onBillCreated) onBillCreated(updatedBill);
      setCurrentBill(updatedBill);

      setIsLoading(false);
      setShowBillPreview(true);

      alert(`Bill #${formatBillNumber(editingBillNumber)} updated successfully!`);

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
  }, [pharmacyId, selectedItems, validateBillBeforeSubmit, editingBillNumber, user, onBillCreated, pharmacyName, saleDate, paymentMethod, isConsignment, note, selectedBill, loadAllAttachments, recentBills]);

  // ── Load bill for editing ───────────────────────────────────────────────────
  const loadBillForEditing = useCallback(async (bill) => {
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

    const returnedMap = await loadReturnedItemsForBill(bill.billNumber, bill.pharmacyId);
    setReturnedItemsMap(returnedMap);

    const processedItems = bill.items.map((item) => {
      const key = `${item.barcode}`;
      const returnData = returnedMap[key] || {};
      const hasReturn = returnData.hasReturn || false;
      const returnQty = returnData.returnQuantity || 0;
      const returnBillNum = returnData.returnBillNumber || "";

      const actualBatch = storeItems.find((si) => si.barcode === item.barcode && si.id === item.batchId);
      return {
        ...item,
        batchId: item.batchId || `batch-${item.barcode}-${item.expireDate}`,
        availableQuantity: actualBatch ? actualBatch.quantity : item.quantity,
        netPrice: item.originalCurrency === "IQD" ? (item.netPriceIQD || item.netPrice) : (item.netPriceUSD || item.netPrice),
        price: item.originalCurrency === "IQD" ? (item.outPriceIQD || item.price) : (item.outPriceUSD || item.price),
        originalCurrency: item.originalCurrency || "USD",
        hasReturn: hasReturn,
        isLocked: hasReturn,
        returnQuantity: returnQty,
        returnBillNumber: returnBillNum,
      };
    });
    setSelectedItems(processedItems);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [recentBills, storeItems, loadReturnedItemsForBill]);

  const resetForm = useCallback(() => {
    setIsEditMode(false); setEditingBillNumber(null); setEditingBillDisplay("");
    setPharmacyId(""); setPharmacySearch(""); setPharmacyName("");
    setSelectedItems([]); setIsConsignment(false); setNote("");
    setSaleDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("Unpaid"); setError(null);
    setReturnedItemsMap({});
  }, []);

  const cancelEdit = useCallback(() => resetForm(), [resetForm]);

  const showBillTemplate = useCallback(() => {
    if (!pharmacyId) { setError("Please select a pharmacy first."); return; }
    if (selectedItems.length === 0) { setError("Please add at least one item."); return; }

    const tempBill = {
      billNumber: "TEMP0000",
      items: selectedItems.map(item => ({
        ...item,
        outPriceUSD: item.originalCurrency === "USD" ? (item.outPriceUSD || item.price) : 0,
        outPriceIQD: item.originalCurrency === "IQD" ? (item.outPriceIQD || item.price) : 0,
      })),
      date: saleDate,
      pharmacyName,
      pharmacyId,
      paymentStatus: paymentMethod,
      isConsignment,
      note,
      createdByName: getDisplayName(user?.name || user?.email || "Current User"),
      isPreview: true,
    };
    setCurrentBill(tempBill);
    setShowBillPreview(true);
  }, [pharmacyId, selectedItems, saleDate, pharmacyName, paymentMethod, isConsignment, note, user]);

  const closeBillPreview = useCallback(() => {
    setShowBillPreview(false);
    setCurrentBill(null);
    if (currentBill && currentBill.billNumber !== "TEMP0000") resetForm();
  }, [currentBill, resetForm]);

  // ── Print bill ──────────────────────────────────────────────────────────────
  const printBill = useCallback((bill) => {
    if (!bill) { alert("No bill selected for printing"); return; }
    const printWindow = window.open("", "_blank");
    if (!printWindow) { alert("Please allow popups for printing"); return; }

    const billPaymentMethod = bill.paymentStatus || paymentMethod;

    const financialSummary = calculatePharmacyFinancialSummary(
      bill.pharmacyId,
      recentBills,
      returnBills,
      bill.items,
      false
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

    const currentBillTotalUSD = bill.items?.reduce((sum, item) => {
      if (item.originalCurrency !== "IQD") return sum + ((item.outPriceUSD || item.price || 0) * item.quantity);
      return sum;
    }, 0) || 0;

    const currentBillTotalIQD = bill.items?.reduce((sum, item) => {
      if (item.originalCurrency === "IQD") return sum + ((item.outPriceIQD || item.price || 0) * item.quantity);
      return sum;
    }, 0) || 0;

    const displayBillNumber = bill.billNumber === "TEMP0000" ? "TEMP0000" : formatBillNumber(bill.billNumber);
    const creatorDisplayName = getDisplayName(bill.createdByName || "Unknown User");

    const unpaidLine  = formatFinancialLine(financialSummary.totalUnpaidBillsUSD, financialSummary.totalUnpaidBillsIQD, pharmacyHasUSD, pharmacyHasIQD);
    const returnLine  = formatFinancialLine(financialSummary.totalReturnBillsUSD, financialSummary.totalReturnBillsIQD, pharmacyHasUSD, pharmacyHasIQD);
    const remainLine  = formatFinancialLine(financialSummary.remainingUnpaidUSD, financialSummary.remainingUnpaidIQD, pharmacyHasUSD, pharmacyHasIQD);

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
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'NRT-Reg', 'Segoe UI', sans-serif;
            padding: 15px; color: #2c3e50; background: white;
            line-height: 1.4; font-size: 14px;
          }
          .bill-template { max-width: 800px; margin: 0 auto; }
          .bill-header { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 3px solid #3498db; }
          .header-content { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; }
          .company-name { font-size: 24px; font-weight: 700; margin: 0 0 3px 0; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; }
          .bill-info-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
          .info-box { flex: 1; min-width: 180px; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e1e8ed; }
          .info-box h3 { font-size: 15px; margin: 0 0 6px 0; font-family: 'NRT-Bd', sans-serif; }
          .info-row { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; font-size: 13px; flex-wrap: wrap; }
          .info-label { font-weight: 600; color: #2c3e50; font-family: 'NRT-Bd', sans-serif; min-width: 80px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: white; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; min-width: 450px; }
          .items-table th { background-color: #3498db; color: white; padding: 8px; font-family: 'NRT-Bd', sans-serif; font-size: 13px; }
          .items-table td { padding: 6px 8px; border-bottom: 1px solid #e1e8ed; font-size: 13px; }
          .items-table tr:nth-child(even) td { background-color: #f8f9fa; }
          .total-row td { background-color: #34495e !important; color: white; font-weight: 700; font-size: 15px; font-family: 'NRT-Bd', sans-serif; }
          .fin-summary { background: #f8f9fa; padding: 10px; border-radius: 8px; border: 1px solid #e1e8ed; margin-bottom: 12px; }
          .fin-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e1e8ed; font-size: 13px; flex-wrap: wrap; }
          .fin-row:last-child { border-bottom: none; font-weight: 700; color: #e74c3c; font-size: 14px; }
          .fin-label { font-family: 'NRT-Reg', sans-serif; }
          .fin-value { font-family: 'NRT-Bd', sans-serif; font-weight: 600; }
          .note-section { background: #fff8e1; padding: 10px; border-radius: 8px; border: 1px solid #ffecb3; margin-bottom: 12px; }
          @media print {
            body { padding: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .bill-template { max-width: 100%; }
          }
          @media (max-width: 600px) {
            body { padding: 10px; font-size: 12px; }
            .company-name { font-size: 20px; }
            .header-content { flex-direction: column; align-items: center; text-align: center; }
            .info-box { min-width: 100%; }
            .items-table { font-size: 12px; min-width: 350px; }
            .items-table th, .items-table td { padding: 5px; }
          }
        </style>
      </head>
      <body>
        <div class="bill-template">
          <div class="bill-header">
            <div class="header-content">
              <div>
                <h1 class="company-name">ARAN MED STORE</h1>
                <p style="font-size:14px;color:#34495e;margin:0 0 2px 0">سلێمانی - بەرامبەر تاوەری تەندروستی سمارت</p>
                <p style="font-size:13px;color:#34495e;margin:0">+964 772 533 5252 | +964 751 741 2241</p>
              </div>
              <div>
                <img src="/Aranlogo.png" alt="Aran Logo" style="width:160px;max-width:100%;object-fit:contain;" />
              </div>
            </div>
          </div>

          <div class="bill-info-grid">
            <div class="info-box">
              <h3>Bill To: ${bill.pharmacyName}</h3>
              <div class="info-row">
                <span class="info-label">Payment:</span>
                <span class="badge" style="background-color:${getPaymentStatusColor(billPaymentMethod)}">${billPaymentMethod.toUpperCase()}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Consignment:</span>
                <span>${bill.isConsignment ? 'تحت صرف' : 'Owned'}</span>
              </div>
            </div>
            <div class="info-box">
              <div class="info-row"><span class="info-label">Invoice #:</span><span>${displayBillNumber}</span></div>
              <div class="info-row"><span class="info-label">Date:</span><span>${formatDate(bill.date)}</span></div>
              <div class="info-row"><span class="info-label">Created By:</span><span>${creatorDisplayName}</span></div>
            </div>
            <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;">
              <img src="/scann.png" alt="scan me" style="width:80px;max-width:100%;" />
            </div>
          </div>

          <div style="overflow-x:auto;">
            <table class="items-table">
              <thead>
                <tr>
                  <th style="text-align:center">#</th>
                  <th style="text-align:left">Item Details</th>
                  <th style="text-align:center">Barcode</th>
                  <th style="text-align:center">Qty</th>
                  <th style="text-align:right">Unit Price</th>
                  <th style="text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${bill.items?.map((item, idx) => {
                  const price = item.originalCurrency === "IQD"
                    ? (item.outPriceIQD || item.price || 0)
                    : (item.outPriceUSD || item.price || 0);
                  const priceFormatted = item.originalCurrency === "IQD"
                    ? Math.round(price).toLocaleString() + " IQD" : "$" + price.toFixed(2);
                  const totalFormatted = item.originalCurrency === "IQD"
                    ? Math.round(price * item.quantity).toLocaleString() + " IQD" : "$" + (price * item.quantity).toFixed(2);
                  return `
                    <tr>
                      <td style="text-align:center;font-weight:600">${idx + 1}</td>
                      <td>
                        <div style="font-weight:600;font-family:'NRT-Bd',sans-serif;font-size:13px;">${item.name}</div>
                        <div style="font-size:12px;color:#7f8c8d">Exp: ${formatExpireDate(item.expireDate)}</div>
                      </td>
                      <td style="text-align:center;font-family:monospace;font-size:13px;">${item.barcode}</td>
                      <td style="text-align:center;font-weight:600">${item.quantity}</td>
                      <td style="text-align:right;font-weight:600">${priceFormatted}</td>
                      <td style="text-align:right;font-weight:600">${totalFormatted}</td>
                    </tr>
                  `;
                }).join("")}
                <tr class="total-row">
                  <td colspan="5" style="text-align:right;padding:8px;">CURRENT TOTAL:</td>
                  <td style="text-align:right;padding:8px;font-size:15px">${formatTotalLine(currentBillTotalUSD, currentBillTotalIQD)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="fin-summary">
            <div class="fin-row">
              <span class="fin-label">Total Unpaid Bills:</span>
              <span class="fin-value">${unpaidLine}</span>
            </div>
            <div class="fin-row">
              <span class="fin-label">Total Return Bills:</span>
              <span class="fin-value" style="color:#e74c3c">- ${returnLine}</span>
            </div>
            <div class="fin-row">
              <span class="fin-label">Remaining Unpaid Balance:</span>
              <span class="fin-value" style="color:#e74c3c">${remainLine}</span>
            </div>
          </div>

          ${bill.note ? `
            <div class="note-section">
              <h4 style="font-weight:600;margin:0 0 4px 0;color:#e67e22;font-size:14px;font-family:'NRT-Bd',sans-serif">Note:</h4>
              <p style="font-size:13px;color:#2c3e50;margin:0">${bill.note}</p>
            </div>
          ` : ""}

          <div style="margin-top:20px;text-align:right">
            <div style="width:200px;height:1px;background:#3498db;margin:10px 0 5px auto;"></div>
            <p style="font-size:12px;color:#7f8c8d;font-style:italic">Receiver Signature (Stamp)</p>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    }, 500);
  }, [paymentMethod, recentBills, returnBills]);

  // ── Sorting ─────────────────────────────────────────────────────────────────
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

  // ── Filter bills ────────────────────────────────────────────────────────────
  const filteredBills = useMemo(() => {
    const filtered = recentBills.filter((bill) => {
      const displayBillNumber = formatBillNumber(bill.billNumber);
      const matchesBillNumber = !filters.billNumber ||
        displayBillNumber.toString().includes(filters.billNumber) ||
        bill.billNumber.toString().includes(filters.billNumber);
      const matchesPharmacy = !filters.pharmacyName ||
        (bill.pharmacyName && bill.pharmacyName.toLowerCase().includes(filters.pharmacyName.toLowerCase()));
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
      return matchesBillNumber && matchesPharmacy && matchesPaymentStatus && matchesDateRange &&
        matchesConsignment && matchesItemName && matchesGlobalSearch && matchesSpecificItems;
    });
    return sortBills(filtered, sortConfig.key, sortConfig.direction);
  }, [recentBills, filters, itemFilters, sortConfig, sortBills]);

  const indexOfLastBill = currentPage * billsPerPage;
  const indexOfFirstBill = indexOfLastBill - billsPerPage;
  const currentBills = filteredBills.slice(indexOfFirstBill, indexOfLastBill);
  const totalPages = Math.ceil(filteredBills.length / billsPerPage);

  const paginate = useCallback((pageNumber) => setCurrentPage(pageNumber), []);

  const clearFilters = useCallback(() => {
    setFilters({ billNumber: "", itemName: "", paymentStatus: "all", pharmacyName: "", consignment: "all", fromDate: "", toDate: "", globalSearch: "" });
    setItemFilters([]);
  }, []);

  const handlePharmacySelect = useCallback((pharmacy) => {
    setPharmacyId(pharmacy.id);
    setPharmacyName(pharmacy.name);
    setPharmacySearch(`${pharmacy.name} (${pharmacy.code})`);
    setShowPharmacySuggestions(false);
    setTimeout(() => searchQueryRef.current?.focus(), 100);
  }, []);

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

  const groupSearchResults = useCallback((results) => {
    const grouped = {};
    results.forEach((item) => {
      if (!grouped[item.barcode]) {
        grouped[item.barcode] = { ...item, batches: getBatchesForItem(item.barcode) };
      }
    });
    return Object.values(grouped);
  }, [getBatchesForItem]);

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

  useEffect(() => { window.handleRescan = handleRescan; }, [handleRescan]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.header}>{isEditMode ? `Edit Bill #${formatBillNumber(editingBillNumber)}` : "Create New Sale"}</div>

      <div style={styles.formContainer}>
        {error && (
          <div style={styles.error}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{ float: "right", background: "none", border: "none", color: "#d63031", cursor: "pointer", fontSize: "18px" }}
            >
              ×
            </button>
          </div>
        )}

        {isEditMode && <div style={styles.editingBillDisplay}>📝 Editing: {editingBillDisplay}</div>}

        {/* Pharmacy search */}
        <div style={styles.inputGroup}>
          <label style={styles.label}>Search Pharmacy (by name or code)</label>
          <input
            ref={pharmacySearchRef}
            type="text"
            style={styles.input}
            placeholder="Type pharmacy name or code..."
            value={pharmacySearch}
            onChange={(e) => {
              setPharmacySearch(e.target.value);
              if (!e.target.value) { setPharmacyId(""); setPharmacyName(""); }
            }}
            onFocus={() => setShowPharmacySuggestions(true)}
          />
          {showPharmacySuggestions && pharmacySuggestions.length > 0 && (
            <div style={styles.suggestionsDropdown}>
              {pharmacySuggestions.map((pharmacy) => (
                <div key={pharmacy.id} style={styles.suggestionItem} onClick={() => handlePharmacySelect(pharmacy)}>
                  <div style={{ fontWeight: "600", color: "#2c3e50", fontSize: "15px" }}>{pharmacy.name}</div>
                  <div style={{ fontSize: "13px", color: "#7f8c8d" }}>Code: {pharmacy.code}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Date / Payment / Note / Consignment row */}
        <div style={styles.rowContainer}>
          <div style={styles.dateField}>
            <label style={styles.fieldLabel}>Sale Date</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} style={styles.dateInputField} onFocus={onFocusBorder} onBlur={onBlurBorder} />
          </div>
          <div style={styles.dateField}>
            <label style={styles.fieldLabel}>Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={styles.selectField} onFocus={onFocusBorder} onBlur={onBlurBorder}>
              <option value="Unpaid">Unpaid</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
          <div style={styles.noteField}>
            <label style={styles.fieldLabel}>Bill Note (Optional)</label>
            <textarea placeholder="Add any special notes..." value={note} onChange={(e) => setNote(e.target.value)} style={styles.textareaField} onFocus={onFocusBorder} onBlur={onBlurBorder} />
          </div>
          <div style={styles.consignmentContainer}>
            <input type="checkbox" checked={isConsignment} onChange={(e) => setIsConsignment(e.target.checked)} id="isConsignment" style={styles.consignmentCheckbox} />
            <label htmlFor="isConsignment" style={styles.consignmentLabel}>تحت صرف</label>
          </div>
        </div>

        {/* Item search */}
        <div style={styles.searchSection}>
          <label style={styles.label}>Search Items</label>
          <input
            ref={searchQueryRef}
            type="text"
            style={styles.input}
            placeholder="Search by barcode or name (supports multiple terms)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          {groupSearchResults(searchResults).length > 0 && (
            <div style={styles.searchResults}>
              {groupSearchResults(searchResults).map((item) => (
                <div key={item.barcode} style={styles.itemGroup}>
                  <div style={styles.itemGroupHeader}>
                    {item.name} - {item.barcode}
                    {pharmacyId && (
                      <button style={styles.historyButton} onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItemForHistory(item);
                        fetchItemSalesHistory(item.barcode, pharmacyId);
                      }}>
                        View History
                      </button>
                    )}
                  </div>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.tableHeader}>Expire Datee</th>
                        <th style={{ ...styles.tableHeader, textAlign: "center" }}>Branch</th>
                        <th style={{ ...styles.tableHeader, textAlign: "right" }}>Net Price</th>
                        <th style={{ ...styles.tableHeader, textAlign: "right" }}>Selling Price</th>
                        <th style={{ ...styles.tableHeader, textAlign: "right" }}>Available</th>
                        <th style={{ ...styles.tableHeader, textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.batches.map((batch, batchIndex) => (
                        <tr key={`${item.id}-${batchIndex}`}>
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
                            fontSize:"15px"
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
                          <td style={{ ...styles.tableCell, textAlign: "right" }}>{batch.quantity}</td>
                          <td style={{ ...styles.tableCell, textAlign: "center" }}>
                            <button style={styles.addButton} onClick={() => handleSelectBatch(batch)}>Add</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected items list - IMPROVED MOBILE SUPPORT */}
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
              const priceDisplay = item.originalCurrency === "IQD"
                ? Math.round(item.price).toLocaleString() + " IQD" : "$" + item.price.toFixed(2);
              const netDisplay = item.originalCurrency === "IQD"
                ? Math.round(item.netPrice).toLocaleString() + " IQD" : "$" + item.netPrice.toFixed(2);
              const totalDisplay = item.originalCurrency === "IQD"
                ? Math.round(item.price * item.quantity).toLocaleString() + " IQD"
                : "$" + (item.price * item.quantity).toFixed(2);

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
                    <div style={{
                      position: "absolute",
                      bottom: "0", left: "0", right: "0",
                      height: "3px",
                      backgroundColor: "#e74c3c",
                      borderRadius: "0 0 8px 8px",
                    }} />
                  )}

                  <div style={{ ...styles.itemDetails, position: "relative", zIndex: "1" }}>
                    <div style={styles.itemName}>
                      {item.name}
                      {isLocked && (
                        <span style={styles.warningBadge}>
                          🔒 Returned ({returnQty})
                        </span>
                      )}
                    </div>
                    <div style={styles.itemMeta}>
                      {item.barcode} • Exp: {formatExpireDate(item.expireDate)}
                      {isEditMode && ` • Avail: ${item.availableQuantity}`}
                      <div>Net: {netDisplay} • Currency: {item.originalCurrency || "USD"}</div>
                      {isLocked && (
                        <div style={{
                          color: "#c0392b",
                          fontWeight: "600",
                          marginTop: "4px",
                          padding: "6px 10px",
                          backgroundColor: "#fff0f0",
                          borderRadius: "6px",
                          border: "1px solid #e74c3c",
                          fontSize: "13px",
                        }}>
                          🔒 Return Invoice: {returnBillNum || "Unknown"} ({returnQty} unit{returnQty !== 1 ? "s" : ""})
                        </div>
                      )}
                    </div>
                  </div>

                  {/* IMPROVED: Mobile-friendly controls with auto-select on focus */}
                  <div style={styles.selectedItemControls}>
                    {/* Quantity - with auto-select on focus */}
                    <div style={styles.itemControlGroup}>
                      <span style={styles.itemControlLabel}>Qty:</span>
                      <input
                        type="number"
                        min="1"
                        max={item.availableQuantity}
                        style={{
                          ...styles.quantityInput,
                          width: "60px",
                          ...(isLocked ? {
                            backgroundColor: "#f0f0f0",
                            cursor: "not-allowed",
                            borderColor: "#e74c3c",
                            opacity: "0.65",
                          } : {})
                        }}
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        onFocus={(e) => {
                          // SELECT ALL TEXT on focus for easy replacement
                          e.target.select();
                          if (isLocked) {
                            e.target.blur();
                            alert(
                              `🔒 "${item.name}" is locked!\n\n` +
                              `Return Invoice: ${returnBillNum || "Unknown"}\n` +
                              `Returned: ${returnQty} unit${returnQty !== 1 ? "s" : ""}\n\n` +
                              `Use the Return Invoice page to modify this.`
                            );
                          }
                        }}
                        readOnly={isLocked}
                        inputMode="numeric"
                      />
                      <span style={{ fontSize: "13px", color: "#7f8c8d" }}>/ {item.availableQuantity}</span>
                    </div>

                    {/* Price - with auto-select on focus */}
                    <div style={styles.itemControlGroup}>
                      <span style={styles.itemControlLabel}>Price:</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        style={{
                          ...styles.priceInput,
                          width: "80px",
                          ...(isLocked ? {
                            backgroundColor: "#f0f0f0",
                            cursor: "not-allowed",
                            borderColor: "#e74c3c",
                            opacity: "0.65",
                          } : {})
                        }}
                        value={item.price}
                        onChange={(e) => handleItemChange(index, "price", e.target.value)}
                        onFocus={(e) => {
                          // SELECT ALL TEXT on focus for easy replacement
                          e.target.select();
                          if (isLocked) {
                            e.target.blur();
                            alert(
                              `🔒 "${item.name}" is locked!\n\n` +
                              `Return Invoice: ${returnBillNum || "Unknown"}\n` +
                              `Returned: ${returnQty} unit${returnQty !== 1 ? "s" : ""}\n\n` +
                              `Use the Return Invoice page to modify this.`
                            );
                          }
                        }}
                        onBlur={(e) => {
                          if (!isLocked && parseFloat(e.target.value) < item.netPrice) {
                            alert(`Warning: Selling price is below net price.`);
                          }
                        }}
                        readOnly={isLocked}
                        inputMode="decimal"
                      />
                      <span style={{ fontSize: "13px", color: "#7f8c8d" }}>
                        {item.originalCurrency === "IQD" ? "IQD" : "USD"}
                      </span>
                    </div>

                    {/* Total */}
                    <div style={{
                      fontWeight: "600",
                      minWidth: "80px",
                      textAlign: "right",
                      color: "#2c3e50",
                      fontSize: "15px",
                    }}>
                      {totalDisplay}
                    </div>

                    {/* Remove button */}
                    <button
                      style={{
                        ...styles.removeButton,
                        padding: "6px 12px",
                        fontSize: "13px",
                        ...(isLocked ? {
                          opacity: 0.45,
                          cursor: "not-allowed",
                          backgroundColor: "#95a5a6",
                        } : {})
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
                const totalUSD = selectedItems.reduce((sum, item) =>
                  item.originalCurrency === "USD" ? sum + ((item.outPriceUSD || item.price) * item.quantity) : sum, 0);
                const totalIQD = selectedItems.reduce((sum, item) =>
                  item.originalCurrency === "IQD" ? sum + ((item.outPriceIQD || item.price) * item.quantity) : sum, 0);
                return formatTotalLine(totalUSD, totalIQD);
              })()}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={isEditMode ? styles.editModeButtons : styles.buttonContainer}>
          {isEditMode ? (
            <>
              <button
                style={isLoading || selectedItems.length === 0 || !pharmacyId ? styles.buttonDisabled : styles.updateButton}
                disabled={isLoading || selectedItems.length === 0 || !pharmacyId}
                onClick={handleUpdateBill}
              >
                {isLoading ? "Updating..." : "Update Bill"}
              </button>
              <button style={styles.cancelButton} onClick={cancelEdit}>Cancel</button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Recent bills table */}
      <RecentBills
        showAdvancedSearch={showAdvancedSearch}
        setShowAdvancedSearch={setShowAdvancedSearch}
        filteredBills={filteredBills}
        currentBills={currentBills}
        selectedBill={selectedBill}
        setSelectedBill={setSelectedBill}
        uploadingAttachments={uploadingAttachments}
        loadBillForEditing={loadBillForEditing}
        printBill={printBill}
        currentPage={currentPage}
        totalPages={totalPages}
        paginate={paginate}
        sortConfig={sortConfig}
        handleSort={handleSort}
        getSortIcon={getSortIcon}
        filters={filters}
        setFilters={setFilters}
        itemFilters={itemFilters}
        setItemFilters={setItemFilters}
        pharmacyFilterOptions={pharmacyFilterOptions}
        itemOptions={itemOptions}
        clearFilters={clearFilters}
        onViewAttachment={viewAttachment}
        onScanDocument={handleScanDocument}
        onFileUpload={handleFileUpload}
        onRescan={handleRescan}
        billAttachments={billAttachments}
      />

      {/* Modals */}
      {showBillPreview && currentBill && (
        <BillPreview
          bill={currentBill}
          onClose={closeBillPreview}
          onPrint={printBill}
          paymentMethod={paymentMethod}
          recentBills={recentBills}
          returnBills={returnBills}
        />
      )}
      {showHistoryModal && selectedItemForHistory && (
        <ItemHistoryModal
          item={selectedItemForHistory}
          history={selectedItemHistory}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}