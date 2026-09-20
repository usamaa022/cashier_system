"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getCompanies, searchInitializedItems, createBoughtBill, updateBoughtBill, getBoughtBills } from "@/lib/data";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FiPlus, FiTrash2, FiSearch, FiPercent, FiDollarSign, FiFileText,
  FiPackage, FiUser, FiCalendar, FiCreditCard, FiTruck,
  FiAlertTriangle, FiX, FiRefreshCw, FiShoppingCart, FiCheckCircle,
  FiArrowRight, FiInfo, FiTag, FiCornerDownLeft, FiClock, FiEye
} from "react-icons/fi";

// ============================================================
// Shared Reusable Uiverse Wi-Fi Loader Component
// ============================================================
const WifiLoader = ({ text = "processing", isButton = false }) => (
  <div style={isButton ? { transform: 'scale(0.55)', width: '40px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 8px 0 -10px' } : {}}>
    <div className={`bf-wifi-loader ${isButton ? 'bf-wifi-loader-btn' : ''}`}>
      <svg className="circle-outer" viewBox="0 0 86 86">
        <circle className="back" cx="43" cy="43" r="40"></circle>
        <circle className="front" cx="43" cy="43" r="40"></circle>
      </svg>
      <svg className="circle-middle" viewBox="0 0 60 60">
        <circle className="back" cx="30" cy="30" r="27"></circle>
        <circle className="front" cx="30" cy="30" r="27"></circle>
      </svg>
      <svg className="circle-inner" viewBox="0 0 34 34">
        <circle className="back" cx="17" cy="17" r="14"></circle>
        <circle className="front" cx="17" cy="17" r="14"></circle>
      </svg>
      <div className="text" data-text={text}></div>
    </div>
  </div>
);

// ============================================================
// Date Formatting & Parsing Helpers
// ============================================================

const formatNumber = (number) => {
  if (!number && number !== 0) return '0';
  const num = typeof number === 'string' ? parseFloat(number.replace(/,/g, '')) : number;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(num);
};

const formatForInput = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  const str = String(val).replace(/,/g, '');
  const parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join('.');
};

const parseFormattedNumber = (formattedValue) => {
  if (!formattedValue) return '';
  return formattedValue.toString().replace(/,/g, '');
};

const formatDateToDDMMYYYY = (date) => {
  if (!date) return '';
  let d = null;
  if (date?.toDate && typeof date.toDate === 'function') d = date.toDate();
  else if (date?.seconds) d = new Date(date.seconds * 1000);
  else if (date instanceof Date) d = date;
  else if (typeof date === 'string') {
    if (date === 'N/A' || !date.trim()) return '';
    if (date.includes('/')) { const [day, month, year] = date.split('/'); d = new Date(year, month - 1, day); }
    else if (date.includes('-')) { const [year, month, day] = date.split('-'); d = new Date(year, month - 1, day); }
    else d = new Date(date);
  }
  if (!d || isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const parseDateString = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.trim();
  if (!str || str === 'N/A') return null;
  const now = new Date();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), now.getHours(), now.getMinutes(), now.getSeconds());
  } else if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), now.getHours(), now.getMinutes(), now.getSeconds());
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const selectOnFocus = (e) => { requestAnimationFrame(() => { try { e.target.select(); } catch (_) {} }); };

export default function BuyingForm({ onBillCreated }) {
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [companyBillNumber, setCompanyBillNumber] = useState("");
  const [billDate, setBillDate] = useState(formatDateToDDMMYYYY(new Date()));
  const [branch, setBranch] = useState("Slemany");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");
  const [isConsignment, setIsConsignment] = useState(false);
  const [expensePercentage, setExpensePercentage] = useState("7");
  const [billNote, setBillNote] = useState("");
  const [billItems, setBillItems] = useState([]);
  const [transportFee, setTransportFee] = useState("0");
  const [externalExpense, setExternalExpense] = useState("0");
  const [currency, setCurrency] = useState(""); 
  const [suggestions, setSuggestions] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  
  // Loading States
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [currencyError, setCurrencyError] = useState(false);

  // Notification State
  const [notifications, setNotifications] = useState([]);

  // Item Purchase History State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const searchInputRef = useRef(null);
  const companySearchRef = useRef(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const itemInputRefs = useRef({});
  const transportFeeRef = useRef(null);
  const externalExpenseRef = useRef(null);
  const expensePercentageRef = useRef(null);
  const billNoteRef = useRef(null);
  const submitButtonRef = useRef(null);

  // Notifications
  const notify = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== id)); }, 5000);
  }, []);

  const dismissNotification = (id) => { setNotifications(prev => prev.filter(n => n.id !== id)); };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>;
      case 'error': return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 9-6 6m0-6 6 6m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>;
      case 'warning': return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 13V8m0 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>;
      case 'info': default: return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 11h2v5m-2 0h4m-2.592-8.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>;
    }
  };

  const createEmptyItem = () => ({ barcode: "", name: "", quantity: "1", price: "", outPrice: "", expireDate: "" });

  const calculateNetPrice = (item, totalQuantity, transportFeeVal, externalExpenseVal, expensePercentageVal) => {
    const basePrice = parseFloat(parseFormattedNumber(item.price)) || 0;
    const quantity = parseFloat(item.quantity) || 0;
    if (totalQuantity === 0 || quantity === 0) return basePrice;
    const itemShare = quantity / totalQuantity;
    return parseFloat((basePrice + ((transportFeeVal * itemShare) / quantity) + ((externalExpenseVal * itemShare) / quantity) + (basePrice * (expensePercentageVal / 100))).toFixed(2));
  };

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const companiesData = await getCompanies();
        setAllCompanies(companiesData);
      } catch (err) {
        notify("error", "Failed to load supplier list.");
      } finally {
        setIsPageLoading(false);
      }
    };
    loadCompanies();
  }, [notify]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (companySearch.trim() === '') setCompanySuggestions(allCompanies);
      else {
        const searchLower = companySearch.toLowerCase().trim();
        setCompanySuggestions(allCompanies.filter(c => c.name.toLowerCase().includes(searchLower) || (c.code && c.code.toString().toLowerCase().includes(searchLower))));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [companySearch, allCompanies]);

  const handleCompanyFocus = () => { setShowCompanySuggestions(true); setCompanySuggestions(allCompanies); };
  const handleCompanyBlur = () => { setTimeout(() => { setShowCompanySuggestions(false); }, 200); };

  const initializeFormWithBillData = (billData) => {
    setCompanyId(billData.companyId); 
    setCompanySearch(billData.companyName || billData.companySearch || ""); 
    setCompanyCode(billData.companyCode || ""); 
    setCompanyBillNumber(billData.companyBillNumber || ""); 
    setBillDate(formatDateToDDMMYYYY(billData.billDate || billData.date)); 
    setBranch(billData.branch || "Slemany"); 
    setPaymentStatus(billData.paymentStatus || "Unpaid"); 
    setIsConsignment(billData.isConsignment || false); 
    setExpensePercentage(String(billData.expensePercentage ?? 7)); 
    setBillNote(billData.billNote || ""); 
    setCurrency(billData.currency || "USD"); 
    setTransportFee(String(billData.totalTransportFeeUSD || billData.totalTransportFeeIQD || billData.transportFee || 0)); 
    setExternalExpense(String(billData.totalExternalExpenseUSD || billData.totalExternalExpenseIQD || billData.externalExpense || 0));
    
    if (billData.items && billData.items.length > 0) {
      setBillItems(billData.items.map(item => {
        let resolvedPrice = 0;
        if (billData.currency === "USD") {
          resolvedPrice = item.basePriceUSD || item.price || item.basePrice || 0;
        } else {
          resolvedPrice = item.basePriceIQD || item.price || item.basePrice || 0;
        }
        if (!resolvedPrice) resolvedPrice = item.price || item.basePrice || 0;

        let resolvedOutPrice = 0;
        if (billData.currency === "USD") {
          resolvedOutPrice = item.outPriceUSD || item.outPrice || 0;
        } else {
          resolvedOutPrice = item.outPriceIQD || item.outPrice || 0;
        }
        if (!resolvedOutPrice) resolvedOutPrice = item.outPrice || 0;

        return { 
          barcode: item.barcode || "", 
          name: item.name || "", 
      quantity: String(item.quantity !== undefined && item.quantity !== null ? item.quantity : 0),
          price: resolvedPrice > 0 ? String(resolvedPrice) : "", 
          outPrice: resolvedOutPrice > 0 ? String(resolvedOutPrice) : "", 
          expireDate: formatDateToDDMMYYYY(item.expireDate), 
          netPrice: item.netPrice || 0 
        };
      }));
    }
  };

  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      const storedBill = localStorage.getItem('editingBill');
      if (storedBill) {
        try { 
          const billData = JSON.parse(storedBill); 
          setIsEditing(true); 
          setEditingBill(billData); 
          initializeFormWithBillData(billData); 
        } catch (err) { 
          notify("error", "Failed to load bill data for editing."); 
        }
      }
    } else if (billItems.length === 0) {
      setBillItems([createEmptyItem()]);
    }
  }, [searchParams, notify]);

  useEffect(() => {
    const fetchItems = async () => {
      if (searchQuery.length > 0) {
        try {
          const results = await searchInitializedItems(searchQuery, "both");
          const searchLower = searchQuery.toLowerCase().trim();
          const filteredResults = results.filter(item => item.name?.toLowerCase().includes(searchLower) || item.barcode?.toLowerCase().includes(searchLower));
          const uniqueResults = []; const seenSet = new Set();
          for (const item of filteredResults) {
            const bCode = (item.barcode || "").trim().toLowerCase(); const iName = (item.name || "").trim().toLowerCase();
            if (!bCode && !iName) continue;
            const uniqueKey = `${bCode}:::${iName}`;
            if (!seenSet.has(uniqueKey)) { seenSet.add(uniqueKey); uniqueResults.push(item); }
          }
          setSuggestions(uniqueResults); setShowSuggestions(uniqueResults.length > 0);
        } catch (err) { console.error("Error fetching items:", err); }
      } else { setSuggestions([]); setShowSuggestions(false); }
    };
    const timer = setTimeout(fetchItems, 250); return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleViewHistory = async (e, item) => {
    e.stopPropagation(); setHistoryItem(item); setHistoryModalOpen(true); setIsHistoryLoading(true); setHistoryRecords([]);
    try {
      const boughtBills = await getBoughtBills(); const records = [];
      boughtBills.forEach((bill) => {
        if (bill.items && Array.isArray(bill.items)) {
          bill.items.forEach((bi) => {
            if ((bi.barcode && item.barcode && String(bi.barcode) === String(item.barcode)) || (bi.name && item.name && bi.name.toLowerCase() === item.name.toLowerCase())) {
              const billCurr = bi.originalCurrency || bill.currency || "USD";
              records.push({ billNumber: bill.billNumber, companyBillNumber: bill.companyBillNumber || "-", companyName: bill.companyName || "Unknown Company", date: bill.date, quantity: bi.quantity || 0, buyPrice: billCurr === "USD" ? (bi.basePriceUSD || bi.price || 0) : (bi.basePriceIQD || bi.price || 0), outPrice: billCurr === "USD" ? (bi.outPriceUSD || 0) : (bi.outPriceIQD || 0), currency: billCurr, branch: bi.branch || bill.branch || "—", expireDate: bi.expireDate || "—" });
            }
          });
        }
      });
      records.sort((a, b) => new Date(b.date) - new Date(a.date)); setHistoryRecords(records);
    } catch (err) { notify("error", "Failed to retrieve item purchase history."); } finally { setIsHistoryLoading(false); }
  };

  const handleCompanySelect = useCallback((company) => {
    setCompanyId(company.id); setCompanySearch(company.name); setCompanyCode(company.code); setShowCompanySuggestions(false);
    if (company.currency) { setCurrency(company.currency); setCurrencyError(false); setTimeout(() => searchInputRef.current?.focus(), 100); }
    else if (!currency) { setCurrencyError(true); const currencyToggle = document.querySelector('.bf-currency-toggle'); if (currencyToggle) currencyToggle.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [currency]);

  const handleItemSelect = useCallback((item) => {
    if (!currency) { 
      setCurrencyError(true); 
      notify("warning", "Please select a currency before adding items."); 
      const currencyToggle = document.querySelector('.bf-currency-toggle'); 
      if (currencyToggle) currencyToggle.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
      return; 
    }
    const newItem = { 
      ...createEmptyItem(), 
      barcode: item.barcode, 
      name: item.name, 
      quantity: "1",
      price: "", 
      outPrice: "", 
      expireDate: formatDateToDDMMYYYY(item.expireDate) 
    };
    setBillItems(prev => { 
      const filtered = prev.filter(i => i.barcode || i.name); 
      const newIndex = filtered.length; 
      const updated = [...filtered, newItem]; 
      setTimeout(() => { 
        const qtyInput = itemInputRefs.current[`${newIndex}-quantity`]; 
        if (qtyInput) { qtyInput.focus(); qtyInput.select(); } 
      }, 80); 
      return updated; 
    });
    setShowSuggestions(false); setSearchQuery(""); setCurrencyError(false);
  }, [currency, notify]);

  const handleItemChange = useCallback((index, field, value) => { 
    setBillItems(prev => { 
      const updatedItems = [...prev]; 
      updatedItems[index] = { ...updatedItems[index], [field]: value }; 
      return updatedItems; 
    }); 
  }, []);

  const resetForm = useCallback(() => { 
    setCompanyId(""); setCompanySearch(""); setCompanyCode(""); setCompanyBillNumber(""); 
    setBillDate(formatDateToDDMMYYYY(new Date())); setBranch("Slemany"); setPaymentStatus("Unpaid"); 
    setIsConsignment(false); setExpensePercentage("7"); setBillNote(""); setCurrency(""); 
    setTransportFee("0"); setExternalExpense("0"); setBillItems([createEmptyItem()]); 
    setIsEditing(false); setEditingBill(null); setCurrencyError(false); 
    localStorage.removeItem('editingBill'); 
  }, []);

  const handleCancel = () => { resetForm(); router.push('/buying'); };

  const handleKeyDown = (e, index, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const navOrder = [ 
        { type: 'item', field: 'barcode', index }, 
        { type: 'item', field: 'name', index }, 
        { type: 'item', field: 'quantity', index }, 
        { type: 'item', field: 'price', index }, 
        { type: 'item', field: 'outPrice', index }, 
        { type: 'item', field: 'expireDate', index }, 
        { type: 'global', field: 'transportFee' }, 
        { type: 'global', field: 'externalExpense' }, 
        { type: 'global', field: 'expensePercentage' }, 
        { type: 'global', field: 'billNote' }, 
        { type: 'global', field: 'submit' } 
      ];
      let currentPos = -1;
      for (let i = 0; i < navOrder.length; i++) { 
        if ((navOrder[i].type === 'item' && navOrder[i].index === index && navOrder[i].field === field) || (navOrder[i].type === 'global' && navOrder[i].field === field)) { 
          currentPos = i; 
          break; 
        } 
      }
      if (currentPos !== -1 && currentPos + 1 < navOrder.length) {
        const next = navOrder[currentPos + 1];
        if (next.type === 'item') { 
          const nextInput = itemInputRefs.current[`${next.index}-${next.field}`]; 
          if (nextInput) { nextInput.focus(); nextInput.select(); } 
        } else if (next.type === 'global') {
          if (next.field === 'transportFee' && transportFeeRef.current) { transportFeeRef.current.focus(); transportFeeRef.current.select(); }
          else if (next.field === 'externalExpense' && externalExpenseRef.current) { externalExpenseRef.current.focus(); externalExpenseRef.current.select(); }
          else if (next.field === 'expensePercentage' && expensePercentageRef.current) { expensePercentageRef.current.focus(); expensePercentageRef.current.select(); }
          else if (next.field === 'billNote' && billNoteRef.current) billNoteRef.current.focus();
          else if (next.field === 'submit' && submitButtonRef.current) { submitButtonRef.current.focus(); submitButtonRef.current.click(); }
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currency) { setCurrencyError(true); notify("error", "Please select a currency before submitting."); return; }
    setIsLoading(true);
    try {
      if (!companyId) { notify("error", "Please select a supplier company."); setIsLoading(false); return; }

      // Validate base items presence
      const activeRows = billItems.filter(item => item.barcode || item.name || item.price || item.outPrice);
      if (activeRows.length === 0) {
        notify("error", "Please add at least one item.");
        setIsLoading(false);
        return;
      }

      // Check all active lines
      for (let i = 0; i < activeRows.length; i++) {
        const itm = activeRows[i];
        const buyPr = parseFloat(parseFormattedNumber(itm.price));
        const outPr = parseFloat(parseFormattedNumber(itm.outPrice));
        const qtyRaw = itm.quantity !== "" && itm.quantity !== null && itm.quantity !== undefined ? parseFloat(itm.quantity) : NaN;

        if (!itm.barcode || !itm.name) {
          notify("error", `Item row #${i + 1} is missing barcode or product name.`);
          setIsLoading(false);
          return;
        }

        // Qty rule: Must be entered. In edit mode, 0 is allowed to cancel an item. In create mode, must be > 0.
        if (isNaN(qtyRaw)) {
          notify("error", `Please enter a valid quantity for "${itm.name}".`);
          setIsLoading(false);
          return;
        }

        if (!isEditing && qtyRaw <= 0) {
          notify("error", `Quantity for "${itm.name}" must be greater than 0.`);
          setIsLoading(false);
          return;
        }

        if (isEditing && qtyRaw < 0) {
          notify("error", `Quantity for "${itm.name}" cannot be negative.`);
          setIsLoading(false);
          return;
        }

        if (isNaN(buyPr) || buyPr <= 0) {
          notify("error", `Please enter a valid Buy Price for "${itm.name}".`);
          setIsLoading(false);
          return;
        }

        if (isNaN(outPr) || outPr <= 0) {
          notify("error", `Selling Price (Out Price) is required for "${itm.name}". Please fill it before saving.`);
          setIsLoading(false);
          return;
        }
      }

      const validItems = activeRows;
      const totalQuantity = validItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
      const transportFeeValue = parseFloat(parseFormattedNumber(transportFee)) || 0;
      const externalExpenseValue = parseFloat(parseFormattedNumber(externalExpense)) || 0;
      const expensePercentageValue = parseFloat(parseFormattedNumber(expensePercentage)) || 0;

      const itemsWithNetPrices = validItems.map(item => {
        const expireDateValue = parseDateString(item.expireDate);
        const netPrice = calculateNetPrice(item, totalQuantity, transportFeeValue, externalExpenseValue, expensePercentageValue);
        const priceValue = parseFloat(parseFormattedNumber(item.price)) || 0;
        const outPriceValue = parseFloat(parseFormattedNumber(item.outPrice)) || 0;
        const qtyVal = parseInt(item.quantity, 10);

        const itemData = { 
          barcode: item.barcode, 
          name: item.name, 
          quantity: isNaN(qtyVal) ? 0 : qtyVal, 
          expireDate: expireDateValue, 
          branch, 
          isConsignment, 
          consignmentOwnerId: isConsignment ? companyId : null, 
          netPrice, 
          price: priceValue, 
          outPrice: outPriceValue, 
          currency 
        };
        
        if (currency === "USD") { 
          itemData.basePriceUSD = priceValue; 
          itemData.basePriceIQD = 0; 
          itemData.netPriceUSD = netPrice; 
          itemData.netPriceIQD = 0; 
          itemData.outPriceUSD = outPriceValue; 
          itemData.outPriceIQD = 0; 
        } else { 
          itemData.basePriceIQD = priceValue; 
          itemData.basePriceUSD = 0; 
          itemData.netPriceIQD = netPrice; 
          itemData.netPriceUSD = 0; 
          itemData.outPriceIQD = outPriceValue; 
          itemData.outPriceUSD = 0; 
        }
        return itemData;
      });

      const parsedBillDate = parseDateString(billDate) || new Date();
      const additionalData = { 
        expensePercentage: expensePercentageValue, 
        billNote: billNote || "", 
        currency, 
        transportFee: transportFeeValue, 
        externalExpense: externalExpenseValue, 
        totalTransportFeeUSD: currency === "USD" ? transportFeeValue : 0, 
        totalTransportFeeIQD: currency === "IQD" ? transportFeeValue : 0, 
        totalExternalExpenseUSD: currency === "USD" ? externalExpenseValue : 0, 
        totalExternalExpenseIQD: currency === "IQD" ? externalExpenseValue : 0, 
        billDate: parsedBillDate, 
        exchangeRate: 1 
      };

      if (isEditing) {
        await updateBoughtBill(editingBill.billNumber, { 
          companyId, 
          companyBillNumber, 
          date: parsedBillDate, 
          paymentStatus, 
          isConsignment, 
          items: itemsWithNetPrices, 
          ...additionalData, 
          branch 
        });
        notify("success", `Bill #${editingBill.billNumber} updated successfully!`); 
        setTimeout(() => { resetForm(); router.push('/buying'); }, 1500);
      } else {
        const bill = await createBoughtBill(companyId, itemsWithNetPrices, null, paymentStatus, companyBillNumber, isConsignment, additionalData);
        if (onBillCreated) onBillCreated(bill);
        notify("success", `Bill #${bill.billNumber} created successfully!`); 
        setTimeout(() => { resetForm(); }, 1500);
      }
    } catch (err) { 
      console.error("Error in handleSubmit:", err); 
      notify("error", err.message || `Failed to ${isEditing ? 'update' : 'create'} bill.`); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const removeItem = useCallback((index) => { 
    setBillItems(prev => { 
      const updatedItems = [...prev]; 
      updatedItems.splice(index, 1); 
      if (updatedItems.length === 0) return [createEmptyItem()]; 
      return updatedItems; 
    }); 
  }, []);

  const totalBasePrice = billItems.reduce((sum, item) => sum + ((parseFloat(parseFormattedNumber(item.price)) || 0) * (parseFloat(item.quantity) || 0)), 0);
  const totalQuantity = billItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const validItemsCount = billItems.filter(item => item.barcode || item.name).length;

  return (
    <div className="bf-root style-reset">
      <style jsx global>{`
        .style-reset * { box-sizing: border-box; }
        .bf-root { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #f1f5f9; min-height: 100vh; padding: 0.5rem; color: #0f172a; width: 100%; overflow-x: hidden; margin: 0; position: relative; }
        .bf-card { width: 100%; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; }
        .bf-header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 1.25rem 1.5rem; color: #ffffff; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; align-items: center; justify-content: space-between; }
        .bf-header-badge { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; color: #38bdf8; display: inline-flex; align-items: center; gap: 0.375rem; }
        .bf-section { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem; margin-bottom: 1rem; position: relative; }
        .bf-section-company { z-index: 50; } .bf-section-items { z-index: 40; }
        .bf-section-title { font-size: 0.875rem; font-weight: 700; color: #334155; text-transform: uppercase; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #f1f5f9; }
        .bf-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
        .bf-form-group { display: flex; flex-direction: column; gap: 0.375rem; position: relative; }
        .bf-label { font-size: 0.8125rem; font-weight: 600; color: #475569; }
        .bf-label-required { color: #ef4444; margin-left: 0.25rem; }
        .bf-input, .bf-select, .bf-textarea { width: 100%; padding: 0.625rem 0.875rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; color: #0f172a; outline: none; }
        .bf-input:focus, .bf-select:focus, .bf-textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
        .bf-input-error { border-color: #ef4444 !important; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15) !important; }
        .bf-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; max-height: 260px; overflow-y: auto; z-index: 1000; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15); }
        .bf-dropdown-item { padding: 0.625rem 0.875rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 0.8125rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
        .bf-dropdown-item:hover { background: #eff6ff; }
        .bf-history-pill-btn { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 6px; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; }
        .bf-history-pill-btn:hover { background: #0284c7; color: #ffffff; border-color: #0284c7; }
        .bf-currency-toggle { display: inline-flex; background: #f1f5f9; padding: 0.25rem; border-radius: 10px; border: 2px solid #e2e8f0; gap: 0.25rem; }
        .bf-currency-toggle-error { border: 2px solid #ef4444 !important; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2); }
        .bf-currency-btn { padding: 0.5rem 1.25rem; border-radius: 8px; font-size: 0.8125rem; font-weight: 700; cursor: pointer; border: none; background: transparent; color: #64748b; }
        .bf-currency-btn.active-usd { background: #2563eb; color: #ffffff; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); }
        .bf-currency-btn.active-iqd { background: #059669; color: #ffffff; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2); }
        .bf-currency-error-text { color: #ef4444; font-size: 0.75rem; font-weight: 500; display: flex; align-items: center; gap: 0.25rem; margin-top: 0.25rem; }
        
        /* Table and inputs responsive styles */
        .bf-table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 8px; border: 1px solid #e2e8f0; width: 100%; margin-bottom: 0.5rem; }
        .bf-table { width: 100%; min-width: 820px; border-collapse: collapse; font-size: 0.8125rem; text-align: left; }
        .bf-table th { background: #f8fafc; padding: 0.75rem 0.625rem; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; font-size: 0.75rem; white-space: nowrap; }
        .bf-table td { padding: 0.5rem 0.625rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .bf-table tr:hover { background: #f8fafc; }
        .bf-table-input { padding: 0.45rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.875rem; width: 100%; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
        .bf-table-input:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15); }
        
        /* Explicit min-widths to prevent mobile clipping */
        .col-barcode { min-width: 130px; }
        .col-name { min-width: 180px; }
        .col-qty { min-width: 75px; text-align: center; font-weight: 700; }
        .col-price { min-width: 105px; text-align: right; }
        .col-outprice { min-width: 105px; text-align: right; background: #fffbeb !important; border-color: #fde68a !important; }
        .col-net { min-width: 95px; text-align: right; font-weight: 700; color: #2563eb; }
        .col-expire { min-width: 110px; }
        .col-action { width: 44px; text-align: center; }

        .bf-summary-bar { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
        .bf-summary-item { display: flex; flex-direction: column; }
        .bf-summary-label { font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; }
        .bf-summary-value { font-size: 1.25rem; font-weight: 800; color: #0f172a; }
        .bf-actions { display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; }
        .bf-btn { padding: 0.625rem 1.25rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 0.5rem; }
        .bf-btn-secondary { background: #ffffff; color: #475569; border: 1px solid #cbd5e1; }
        .bf-btn-secondary:hover { background: #f1f5f9; }
        .bf-btn-danger { background: #ef4444; color: #ffffff; }
        .bf-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 99999; padding: 1rem; }
        .bf-global-loader-overlay { position: fixed; inset: 0; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(8px); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 999999; }
        .bf-modal-content { background: #ffffff; border-radius: 12px; width: 100%; max-width: 860px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden; border: 1px solid #e2e8f0; }
        .bf-modal-header { background: #1e293b; color: #ffffff; padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; }
        .bf-modal-body { padding: 1.25rem; overflow-y: auto; flex: 1; }

        .bf-animated-btn { --main-size: 0.875rem; --color-text: #ffffff; --color-background: #10b981; --color-background-hover: #059669; --color-outline: rgba(16, 185, 129, 0.3); --color-shadow: rgba(0, 0, 0, 0.25); cursor: pointer; display: inline-flex; justify-content: center; align-items: center; text-decoration: none; border: none; border-radius: 9999px; padding: 0.625rem 1.25rem; font-family: inherit; font-weight: 600; font-size: var(--main-size); color: var(--color-text); background: var(--color-background); box-shadow: 0 0 0.2em 0 var(--color-background); transition: 1s; }
        .bf-animated-btn:disabled { opacity: 0.6; cursor: not-allowed; pointer-events: none; }
        .bf-animated-btn:active:not(:disabled) { transform: scale(0.95); }
        .bf-animated-btn:hover:not(:disabled) { outline: 0.1em solid transparent; outline-offset: 0.2em; box-shadow: 0 0 1em 0 var(--color-background); animation: bf-ripple 1s linear infinite, bf-colorize 1s infinite; transition: 0.5s; }
        .bf-animated-btn span { margin-right: 0.3em; transition: 0.5s; }
        .bf-animated-btn:hover:not(:disabled) span { text-shadow: 3px 3px 5px var(--color-shadow); }
        .bf-animated-btn:active:not(:disabled) span { text-shadow: none; }
        .bf-animated-btn > svg { height: 1.2em; width: 1.2em; fill: var(--color-text); margin-right: -0.16em; position: relative; transition: 0.5s; }
        .bf-animated-btn:hover:not(:disabled) > svg { margin-right: 0.66em; transition: 0.5s; filter: drop-shadow(3px 3px 2.5px var(--color-shadow)); }
        .bf-animated-btn:active:not(:disabled) > svg { filter: none; }
        .bf-animated-btn > svg polygon:nth-child(1) { transition: 0.4s; transform: translateX(-60%); }
        .bf-animated-btn > svg polygon:nth-child(2) { transition: 0.5s; transform: translateX(-30%); }
        .bf-animated-btn:hover:not(:disabled) > svg polygon:nth-child(1) { transform: translateX(0%); animation: bf-opacity 1s infinite 0.6s; }
        .bf-animated-btn:hover:not(:disabled) > svg polygon:nth-child(2) { transform: translateX(0%); animation: bf-opacity 1s infinite 0.4s; }
        .bf-animated-btn:hover:not(:disabled) > svg polygon:nth-child(3) { animation: bf-opacity 1s infinite 0.2s; }
        @keyframes bf-opacity { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes bf-colorize { 0% { background: var(--color-background); } 50% { background: var(--color-background-hover); } 100% { background: var(--color-background); } }
        @keyframes bf-ripple { 0% { outline: 0em solid transparent; outline-offset: -0.1em; } 50% { outline: 0.2em solid var(--color-outline); outline-offset: 0.2em; } 100% { outline: 0.4em solid transparent; outline-offset: 0.4em; } }

        .bf-wifi-loader { --background: #62abff; --front-color: #ef4d86; --front-color-in: #fbb216; --back-color: #c3c8de; --text-color: #414856; width: 64px; height: 64px; border-radius: 50px; position: relative; display: flex; justify-content: center; align-items: center; }
        .bf-wifi-loader svg { position: absolute; display: flex; justify-content: center; align-items: center; }
        .bf-wifi-loader svg circle { position: absolute; fill: none; stroke-width: 6px; strokeLinecap: round; strokeLinejoin: round; transform: rotate(-100deg); transform-origin: center; }
        .bf-wifi-loader svg circle.back { stroke: var(--back-color); }
        .bf-wifi-loader svg circle.front { stroke: var(--front-color); }
        .bf-wifi-loader svg.circle-outer { height: 86px; width: 86px; }
        .bf-wifi-loader svg.circle-outer circle { stroke-dasharray: 62.75 188.25; }
        .bf-wifi-loader svg.circle-outer circle.back { animation: circle-outer135 1.8s ease infinite 0.3s; }
        .bf-wifi-loader svg.circle-outer circle.front { animation: circle-outer135 1.8s ease infinite 0.15s; }
        .bf-wifi-loader svg.circle-middle { height: 60px; width: 60px; }
        .bf-wifi-loader svg.circle-middle circle { stroke: var(--front-color-in); stroke-dasharray: 42.5 127.5; }
        .bf-wifi-loader svg.circle-middle circle.back { animation: circle-middle6123 1.8s ease infinite 0.25s; }
        .bf-wifi-loader svg.circle-middle circle.front { animation: circle-middle6123 1.8s ease infinite 0.1s; }
        .bf-wifi-loader svg.circle-inner { height: 34px; width: 34px; }
        .bf-wifi-loader svg.circle-inner circle { stroke-dasharray: 22 66; }
        .bf-wifi-loader svg.circle-inner circle.back { animation: circle-inner162 1.8s ease infinite 0.2s; }
        .bf-wifi-loader svg.circle-inner circle.front { animation: circle-inner162 1.8s ease infinite 0.05s; }
        .bf-wifi-loader .text { position: absolute; bottom: -40px; display: flex; justify-content: center; align-items: center; text-transform: lowercase; font-weight: 600; font-size: 15px; letter-spacing: 0.2px; }
        .bf-wifi-loader .text::before, .bf-wifi-loader .text::after { content: attr(data-text); }
        .bf-wifi-loader .text::before { color: var(--text-color); }
        .bf-wifi-loader .text::after { color: var(--front-color-in); animation: text-animation76 3.6s ease infinite; position: absolute; left: 0; }
        @keyframes circle-outer135 { 0% { stroke-dashoffset: 25; } 25% { stroke-dashoffset: 0; } 65% { stroke-dashoffset: 301; } 80% { stroke-dashoffset: 276; } 100% { stroke-dashoffset: 276; } }
        @keyframes circle-middle6123 { 0% { stroke-dashoffset: 17; } 25% { stroke-dashoffset: 0; } 65% { stroke-dashoffset: 204; } 80% { stroke-dashoffset: 187; } 100% { stroke-dashoffset: 187; } }
        @keyframes circle-inner162 { 0% { stroke-dashoffset: 9; } 25% { stroke-dashoffset: 0; } 65% { stroke-dashoffset: 106; } 80% { stroke-dashoffset: 97; } 100% { stroke-dashoffset: 97; } }
        @keyframes text-animation76 { 0% { clip-path: inset(0 100% 0 0); } 50% { clip-path: inset(0); } 100% { clip-path: inset(0 0 0 100%); } }

        .notification-container { position: fixed; top: 2%; right: 2%; z-index: 9999999; max-width: 400px; --content-color: black; --background-color: #f3f3f3; --font-size-content: 0.85em; --icon-size: 1.25em; display: flex; flex-direction: column; gap: 0.5em; list-style-type: none; font-family: inherit; color: var(--content-color); margin: 0; padding: 0; }
        .notification-item { position: relative; display: flex; justify-content: space-between; align-items: center; flex-direction: row; gap: 1em; overflow: hidden; padding: 12px 18px; border-radius: 8px; box-shadow: rgba(0, 0, 0, 0.2) 0px 8px 24px; background-color: var(--background-color); transition: all 250ms ease; animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; --grid-color: rgba(225, 225, 225, 0.7); background-image: linear-gradient(0deg, transparent 23%, var(--grid-color) 24%, var(--grid-color) 25%, transparent 26%, transparent 73%, var(--grid-color) 74%, var(--grid-color) 75%, transparent 76%, transparent), linear-gradient(90deg, transparent 23%, var(--grid-color) 24%, var(--grid-color) 25%, transparent 26%, transparent 73%, var(--grid-color) 74%, var(--grid-color) 75%, transparent 76%, transparent); background-size: 55px 55px; }
        @keyframes slideIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .notification-item svg { transition: 250ms ease; }
        .notification-item:hover { transform: scale(1.02); }
        .notification-item:active { transform: scale(1.05); }
        .notification-item .notification-close { padding: 2px; border-radius: 5px; transition: all 250ms; cursor: pointer; }
        .notification-item .notification-close:hover { background-color: rgba(204, 204, 204, 0.45); }
        .notification-item .notification-close:hover svg { color: rgb(0, 0, 0); }
        .notification-container svg { width: var(--icon-size); height: var(--icon-size); color: var(--content-color); }
        .notification-icon { display: flex; align-items: center; }
        .notification-item.success { color: #047857; background-color: #7dffbc; --grid-color: rgba(16, 185, 129, 0.25); } .notification-item.success svg { color: #047857; } .notification-item.success .notification-progress-bar { background-color: #047857; }
        .notification-item.error { color: #7f1d1d; background-color: #ff7e7e; --grid-color: rgba(239, 68, 68, 0.25); } .notification-item.error svg { color: #7f1d1d; } .notification-item.error .notification-progress-bar { background-color: #7f1d1d; }
        .notification-item.warning { color: #78350f; background-color: #ffe57e; --grid-color: rgba(245, 159, 11, 0.25); } .notification-item.warning svg { color: #78350f; } .notification-item.warning .notification-progress-bar { background-color: #78350f; }
        .notification-item.info { color: #1e3a8a; background-color: #7eb8ff; --grid-color: rgba(59, 131, 246, 0.25); } .notification-item.info svg { color: #1e3a8a; } .notification-item.info .notification-progress-bar { background-color: #1e3a8a; }
        .notification-content { display: flex; justify-content: flex-start; align-items: center; gap: 0.75em; }
        .notification-text { font-size: var(--font-size-content); font-weight: 600; user-select: none; }
        .notification-progress-bar { position: absolute; bottom: 0; left: 0; height: 3px; background: var(--content-color); width: 100%; transform: translateX(100%); animation: progressBar 5s linear forwards; }
      `}</style>

      {/* PAGE LOAD & SUBMIT LOADER */}
      {(isPageLoading || isLoading) && (
        <div className="bf-global-loader-overlay">
          <WifiLoader text={isPageLoading ? "loading..." : (isEditing ? "updating..." : "saving...")} />
        </div>
      )}

      {/* TOAST NOTIFICATIONS */}
      <ul className="notification-container">
        {notifications.map((note) => (
          <li key={note.id} className={`notification-item ${note.type}`}>
            <div className="notification-content">
              <div className="notification-icon">{getNotificationIcon(note.type)}</div>
              <div className="notification-text">{note.message}</div>
            </div>
            <div className="notification-icon notification-close" onClick={() => dismissNotification(note.id)}>
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18 17.94 6M18 18 6.06 6"></path></svg>
            </div>
            <div className="notification-progress-bar"></div>
          </li>
        ))}
      </ul>

      <div className="bf-card">
        <div className="bf-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ background: "rgba(255,255,255,0.1)", padding: "0.5rem", borderRadius: "8px", display: "flex" }}><FiShoppingCart size={22} color="#ffffff" /></div>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>{isEditing ? `Edit Purchase Bill #${editingBill?.billNumber}` : "New Purchase Entry"}</h1>
              <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{isEditing ? "Modifying existing document records" : "Record inventory acquisition & supplier costs"}</span>
            </div>
          </div>
          <div className="bf-header-badge"><FiInfo size={13} /><span>{isEditing ? "EDIT MODE" : "NEW DRAFT"}</span></div>
        </div>

        <div style={{ padding: "0.75rem" }}>
          <form onSubmit={handleSubmit}>
            <div className="bf-section bf-section-company">
              <div className="bf-section-title"><FiUser size={16} /><span>1. Supplier & Currency Setup</span></div>
              <div className="bf-grid-3" style={{ marginBottom: "1rem" }}>
                <div className="bf-form-group">
                  <label className="bf-label">Operating Currency <span className="bf-label-required">*</span></label>
                  <div className={`bf-currency-toggle ${currencyError ? 'bf-currency-toggle-error' : ''}`}>
                    <button type="button" onClick={() => { setCurrency("USD"); setCurrencyError(false); }} className={`bf-currency-btn ${currency === "USD" ? "active-usd" : ""}`}>USD ($)</button>
                    <button type="button" onClick={() => { setCurrency("IQD"); setCurrencyError(false); }} className={`bf-currency-btn ${currency === "IQD" ? "active-iqd" : ""}`}>IQD (د.ع)</button>
                  </div>
                  {currencyError && <div className="bf-currency-error-text"><FiAlertTriangle size={14} /> Please select a currency before adding items</div>}
                </div>
                <div className="bf-form-group" style={{ gridColumn: "span 2" }}>
                  <label className="bf-label">Supplier Company *</label>
                  <div style={{ position: "relative" }}>
                    <input ref={companySearchRef} type="text" className="bf-input" value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} onFocus={handleCompanyFocus} onBlur={handleCompanyBlur} placeholder="Search company by code or name..." required />
                    {showCompanySuggestions && companySuggestions.length > 0 && (
                      <div className="bf-dropdown">
                        {companySuggestions.map((company) => (
                          <div key={company.id} className="bf-dropdown-item" onClick={() => handleCompanySelect(company)} onMouseDown={(e) => e.preventDefault()}>
                            <div><div style={{ fontWeight: 600, color: '#0f172a' }}>{company.name}</div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>Code: {company.code} {company.currency && `• Default Currency: ${company.currency}`}</div></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="bf-grid-3">
                <div className="bf-form-group"><label className="bf-label">Bill Date (dd/mm/yyyy) *</label><input type="text" className="bf-input" value={billDate} onChange={(e) => setBillDate(e.target.value)} placeholder="dd/mm/yyyy" required /></div>
                <div className="bf-form-group"><label className="bf-label">Supplier Reference / Invoice #</label><input type="text" className="bf-input" value={companyBillNumber} onChange={(e) => setCompanyBillNumber(e.target.value)} onFocus={selectOnFocus} placeholder="e.g. INV-2026-001" /></div>
                <div className="bf-form-group"><label className="bf-label">Payment Terms</label><select className="bf-select" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="Unpaid">Unpaid</option><option value="Cash">Cash</option></select></div>
                <div className="bf-form-group"><label className="bf-label">Destination Branch</label><select className="bf-select" value={branch} onChange={(e) => setBranch(e.target.value)}><option value="Slemany">Slemany Branch</option><option value="Erbil">Erbil Branch</option></select></div>
                <div className="bf-form-group" style={{ justifyContent: "center" }}><label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginTop: "1.25rem", userSelect: "none" }}><input type="checkbox" checked={isConsignment} onChange={(e) => setIsConsignment(e.target.checked)} style={{ width: "1.125rem", height: "1.125rem", accentColor: "#2563eb", cursor: "pointer" }} /><span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Consignment Item (تحت صرف)</span></label></div>
              </div>
            </div>

            <div className="bf-section bf-section-items">
              <div className="bf-section-title"><FiPackage size={16} /><span>2. Line Items ({validItemsCount})</span></div>
              <div className="bf-form-group" style={{ marginBottom: "1rem" }}>
                <label className="bf-label">Quick Search Catalog & Add Item</label>
                <div style={{ position: "relative" }}>
                  <FiSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} size={16} />
                  <input
                    ref={searchInputRef} type="text" className={`bf-input ${currencyError ? 'bf-input-error' : ''}`} style={{ paddingLeft: "2.25rem", background: "#fffbeb", borderColor: currencyError ? "#ef4444" : "#fde68a" }} value={searchQuery}
                    onChange={(e) => { if (!currency) return; setSearchQuery(e.target.value); }}
                    onFocus={(e) => { if (!currency) { e.preventDefault(); e.target.blur(); setCurrencyError(true); return; } e.target.style.borderColor = '#4299e1'; e.target.style.boxShadow = '0 0 0 4px rgba(66, 153, 225, 0.15)'; e.target.style.backgroundColor = '#fff5df'; e.target.select(); }}
                    onBlur={(e) => { e.target.style.borderColor = '#fde68a'; e.target.style.boxShadow = 'none'; if (!e.target.value) e.target.style.backgroundColor = '#fffbeb'; }}
                    placeholder={currency ? "Type barcode or product name to auto-fill..." : "⚠️ Please select a currency first..."}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="bf-dropdown">
                      {suggestions.map((item, index) => (
                        <div key={`sugg-${index}`} className="bf-dropdown-item" onClick={() => handleItemSelect(item)} onMouseDown={(e) => e.preventDefault()}>
                          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: "#0f172a" }}>{item.name}</div><div style={{ fontSize: "0.75rem", color: "#64748b" }}>Barcode: {item.barcode} {item.expireDate && item.expireDate !== 'N/A' && `| Expires: ${formatDateToDDMMYYYY(item.expireDate)}`}</div></div>
                          <button type="button" className="bf-history-pill-btn" onClick={(e) => handleViewHistory(e, item)}><FiClock size={12} /><span>History</span></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bf-table-container">
                <table className="bf-table">
                  <thead><tr><th style={{ width: "16%" }}>Barcode</th><th style={{ width: "24%" }}>Product Description</th><th style={{ width: "10%", textAlign: "center" }}>Qty</th><th style={{ width: "13%", textAlign: "right" }}>Buy Price ({currency || '?'})</th><th style={{ width: "13%", textAlign: "right" }}>Selling Price ({currency || '?'}) *</th><th style={{ width: "11%", textAlign: "right" }}>Net Cost ({currency || '?'})</th><th style={{ width: "10%" }}>Expire Date</th><th style={{ width: "3%", textAlign: "center" }}></th></tr></thead>
                  <tbody>
                    {billItems.map((item, index) => {
                      const netPrice = calculateNetPrice(item, totalQuantity || 1, parseFloat(parseFormattedNumber(transportFee)) || 0, parseFloat(parseFormattedNumber(externalExpense)) || 0, parseFloat(parseFormattedNumber(expensePercentage)) || 0);
                      return (
                        <tr key={index}>
                          <td><input ref={(el) => itemInputRefs.current[`${index}-barcode`] = el} type="text" className="bf-table-input col-barcode" value={item.barcode || ''} onChange={(e) => handleItemChange(index, "barcode", e.target.value)} onKeyDown={(e) => handleKeyDown(e, index, 'barcode')} onFocus={selectOnFocus} placeholder="Barcode" /></td>
                          <td><input ref={(el) => itemInputRefs.current[`${index}-name`] = el} type="text" className="bf-table-input col-name" value={item.name || ''} onChange={(e) => handleItemChange(index, "name", e.target.value)} onKeyDown={(e) => handleKeyDown(e, index, 'name')} onFocus={selectOnFocus} placeholder="Product name" /></td>
                          <td style={{ textAlign: "center" }}><input ref={(el) => itemInputRefs.current[`${index}-quantity`] = el} type="number" min="0" step="1" className="bf-table-input col-qty" value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", e.target.value)} onKeyDown={(e) => handleKeyDown(e, index, 'quantity')} onFocus={selectOnFocus} placeholder="0" /></td>
                          <td><input ref={(el) => itemInputRefs.current[`${index}-price`] = el} type="text" inputMode="decimal" className="bf-table-input col-price" value={formatForInput(item.price)} onChange={(e) => { const raw = e.target.value.replace(/,/g, ''); const clean = raw.replace(/[^0-9.]/g, ''); if ((clean.match(/\./g) || []).length > 1) return; handleItemChange(index, "price", clean); }} onKeyDown={(e) => handleKeyDown(e, index, 'price')} onFocus={selectOnFocus} placeholder="0.00" /></td>
                          <td><input ref={(el) => itemInputRefs.current[`${index}-outPrice`] = el} type="text" inputMode="decimal" className="bf-table-input col-outprice" value={formatForInput(item.outPrice)} onChange={(e) => { const raw = e.target.value.replace(/,/g, ''); const clean = raw.replace(/[^0-9.]/g, ''); if ((clean.match(/\./g) || []).length > 1) return; handleItemChange(index, "outPrice", clean); }} onKeyDown={(e) => handleKeyDown(e, index, 'outPrice')} onFocus={selectOnFocus} placeholder="0.00" /></td>
                          <td className="col-net">{formatNumber(netPrice)}</td>
                          <td><input ref={(el) => itemInputRefs.current[`${index}-expireDate`] = el} type="text" className="bf-table-input col-expire" placeholder="dd/mm/yyyy" value={item.expireDate || ''} onChange={(e) => handleItemChange(index, "expireDate", e.target.value)} onKeyDown={(e) => handleKeyDown(e, index, 'expireDate')} /></td>
                          <td className="col-action"><button type="button" onClick={() => removeItem(index)} style={{ background: "#fef2f2", border: "none", color: "#ef4444", padding: "0.4rem", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><FiTrash2 size={15} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bf-section">
              <div className="bf-section-title"><FiTruck size={16} /><span>3. Additional Expenses & Notes</span></div>
              <div className="bf-grid-3" style={{ marginBottom: "1rem" }}>
                <div className="bf-form-group"><label className="bf-label">Transport Costs ({currency || '?'})</label><input ref={transportFeeRef} type="text" inputMode="decimal" className="bf-input" value={formatForInput(transportFee)} onChange={(e) => { const clean = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, ''); if ((clean.match(/\./g) || []).length > 1) return; setTransportFee(clean); }} onKeyDown={(e) => handleKeyDown(e, null, 'transportFee')} onFocus={selectOnFocus} placeholder="0.00" /></div>
                <div className="bf-form-group"><label className="bf-label">Other Overhead / Customs ({currency || '?'})</label><input ref={externalExpenseRef} type="text" inputMode="decimal" className="bf-input" value={formatForInput(externalExpense)} onChange={(e) => { const clean = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, ''); if ((clean.match(/\./g) || []).length > 1) return; setExternalExpense(clean); }} onKeyDown={(e) => handleKeyDown(e, null, 'externalExpense')} onFocus={selectOnFocus} placeholder="0.00" /></div>
                <div className="bf-form-group"><label className="bf-label">Expense Margin (%)</label><input ref={expensePercentageRef} type="text" inputMode="decimal" className="bf-input" value={formatForInput(expensePercentage)} onChange={(e) => { const clean = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, ''); if ((clean.match(/\./g) || []).length > 1) return; setExpensePercentage(clean); }} onKeyDown={(e) => handleKeyDown(e, null, 'expensePercentage')} onFocus={selectOnFocus} placeholder="7" /></div>
              </div>
              <div className="bf-form-group"><label className="bf-label">Internal Notes / Memo</label><textarea ref={billNoteRef} className="bf-textarea" style={{ minHeight: "70px", resize: "vertical" }} value={billNote} onChange={(e) => setBillNote(e.target.value)} placeholder="Enter invoice notes or purchase remarks..." /></div>
            </div>

            <div className="bf-summary-bar">
              <div className="bf-summary-item"><span className="bf-summary-label">Total Units</span><span className="bf-summary-value">{totalQuantity}</span></div>
              <div className="bf-summary-item"><span className="bf-summary-label">Total Base Subtotal</span><span className="bf-summary-value" style={{ color: "#2563eb" }}>{formatNumber(totalBasePrice)} {currency || '?'}</span></div>
            </div>

            <div className="bf-actions">
              <button type="button" onClick={resetForm} className="bf-btn bf-btn-secondary"><FiRefreshCw size={14} /> Clear Form</button>
              {isEditing && <button type="button" onClick={handleCancel} className="bf-btn bf-btn-danger"><FiX size={14} /> Cancel Edit</button>}
              <button type="submit" disabled={isLoading} className="bf-animated-btn">
                <span>{isEditing ? "Save & Update Bill" : "Finalize & Save Bill"}</span>
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polygon points="3,6 9,12 3,18 5,18 11,12 5,6" /><polygon points="9,6 15,12 9,18 11,18 17,12 11,6" /><polygon points="15,6 21,12 15,18 17,18 23,12 17,6" /></svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {historyModalOpen && (
        <div className="bf-modal-overlay" onClick={() => setHistoryModalOpen(false)}>
          <div className="bf-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="bf-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><FiClock size={18} color="#38bdf8" /><div><h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Purchase History: {historyItem?.name}</h3><span style={{ fontSize: "0.75rem", opacity: 0.75 }}>Barcode: {historyItem?.barcode}</span></div></div>
              <button type="button" onClick={() => setHistoryModalOpen(false)} style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", display: "flex" }}><FiX size={20} /></button>
            </div>
            <div className="bf-modal-body">
              {isHistoryLoading ? (
                <div style={{ padding: "4rem 2.5rem", display: "flex", justifyContent: "center", alignItems: "center", color: "#64748b" }}><WifiLoader text="loading..." /></div>
              ) : historyRecords.length === 0 ? (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}><FiPackage size={36} style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} /><p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "#64748b" }}>No Previous Purchase History Found</p></div>
              ) : (
                <div className="bf-table-container">
                  <table className="bf-table">
                    <thead><tr><th>Date</th><th>Supplier / Company</th><th>Bill #</th><th style={{ textAlign: "center" }}>Qty</th><th style={{ textAlign: "right" }}>Buy Price</th><th style={{ textAlign: "right" }}>Selling Price</th><th>Branch</th></tr></thead>
                    <tbody>
                      {historyRecords.map((rec, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>{formatDateToDDMMYYYY(rec.date)}</td>
                          <td><div style={{ fontWeight: 600, color: "#1e293b" }}>{rec.companyName}</div></td>
                          <td style={{ fontWeight: 600, color: "#2563eb" }}>#{rec.billNumber}</td>
                          <td style={{ textAlign: "center", fontWeight: 700 }}>{rec.quantity}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#059669" }}>{rec.currency === "USD" ? `$${formatNumber(rec.buyPrice)}` : `${formatNumber(rec.buyPrice)} IQD`}</td>
                          <td style={{ textAlign: "right", fontWeight: 600, color: "#2563eb" }}>{rec.currency === "USD" ? `$${formatNumber(rec.outPrice)}` : `${formatNumber(rec.outPrice)} IQD`}</td>
                          <td><span style={{ background: "#f1f5f9", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>{rec.branch}</span></td>
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
  );
}