"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getCompanies, searchInitializedItems, createBoughtBill, updateBoughtBill } from "@/lib/data";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  FiPlus, FiTrash2, FiSearch, FiPercent, FiDollarSign, FiFileText, 
  FiPackage, FiUser, FiCalendar, FiCreditCard, FiTruck, 
  FiAlertTriangle, FiX, FiRefreshCw, FiShoppingCart, FiCheckCircle,
  FiArrowRight
} from "react-icons/fi";

// Format number with commas (e.g., 3,000 or 3,000.50)
const formatNumber = (number) => {
  if (!number && number !== 0) return '0';
  const num = typeof number === 'string' ? parseFloat(number.replace(/,/g, '')) : number;
  if (isNaN(num)) return '0';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(num);
};

// Parse formatted number back to number
const parseFormattedNumber = (formattedValue) => {
  if (!formattedValue) return '';
  return formattedValue.toString().replace(/,/g, '');
};

// Handle input with comma formatting
const handleNumberInput = (value, setter) => {
  const rawValue = value.replace(/,/g, '');
  if (rawValue === '' || isNaN(parseFloat(rawValue))) {
    setter('');
  } else {
    setter(formatNumber(rawValue));
  }
};

const formatDateToDDMMYYYY = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDDMMYYYYToInput = (dateString) => {
  if (!dateString) return '';
  if (dateString.includes('/')) {
    const [day, month, year] = dateString.split('/');
    return `${year}-${month}-${day}`;
  }
  return dateString;
};

const formatDateForInput = (date) => {
  if (!date) return '';
  let dateObj;
  if (date?.toDate) {
    dateObj = date.toDate();
  } else if (date?.seconds) {
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

// Inline styles
const styles = {
  container: {
    minHeight: '100vh',
    padding: '12px',
    width: '100%',
    maxWidth: '100%',
    overflowX: 'hidden',
  },
  mainCard: {
    maxWidth: '1280px',
    margin: '0 auto',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    padding: '16px 20px',
    color: 'white',
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: '12px',
    opacity: 0.8,
    marginTop: '4px',
    marginBottom: 0,
  },
  content: {
    padding: '16px',
  },
  section: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '16px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingBottom: '10px',
    borderBottom: '2px solid #e2e8f0',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
    marginBottom: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#475569',
    marginBottom: '4px',
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '13px',
    transition: 'all 0.2s',
    outline: 'none',
    backgroundColor: 'white',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    padding: '8px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '13px',
    backgroundColor: 'white',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
  },
  currencyButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  currencyBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: 'none',
    fontSize: '13px',
    width: '100%',
  },
  currencyBtnActiveUSD: {
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
  },
  currencyBtnActiveIQD: {
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
  },
  currencyBtnInactive: {
    backgroundColor: '#e2e8f0',
    color: '#475569',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '12px',
    minWidth: '600px',
  },
  th: {
    padding: '8px',
    textAlign: 'left',
    backgroundColor: '#f1f5f9',
    fontSize: '11px',
    fontWeight: '600',
    color: '#475569',
    borderBottom: '2px solid #e2e8f0',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '6px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '12px',
  },
  addButton: {
    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '12px',
    width: '100%',
    justifyContent: 'center',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: '6px',
  },
  submitButton: {
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    justifyContent: 'center',
  },
  resetButton: {
    background: 'white',
    color: '#64748b',
    border: '1px solid #cbd5e1',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    justifyContent: 'center',
  },
  cancelButton: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '10px 14px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#dc2626',
    fontSize: '13px',
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    padding: '10px 14px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#16a34a',
    fontSize: '13px',
  },
  totalBox: {
    backgroundColor: '#eef2ff',
    borderRadius: '10px',
    padding: '12px 16px',
    marginTop: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
  },
  totalLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#4338ca',
  },
  totalValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#4338ca',
  },
  suggestionBox: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  suggestionItem: {
    padding: '8px 10px',
    cursor: 'pointer',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '13px',
  },
  relative: {
    position: 'relative',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #e2e8f0',
  },
  rightGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
  },
  searchWrapper: {
    position: 'relative',
    marginBottom: '16px',
  },
  searchIcon: {
    position: 'absolute',
    left: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
  },
  searchInput: {
    width: '100%',
    padding: '8px 10px 8px 34px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '13px',
    backgroundColor: 'white',
    boxSizing: 'border-box',
  },
  tableWrapper: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  smallInput: {
    width: '60px',
    padding: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  priceInput: {
    width: '100%',
    minWidth: '80px',
    padding: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    textAlign: 'right',
    boxSizing: 'border-box',
  },
  outPriceInput: {
    width: '100%',
    minWidth: '80px',
    padding: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    textAlign: 'right',
    backgroundColor: '#fef3c7',
    boxSizing: 'border-box',
  },
  textInput: {
    width: '100%',
    minWidth: '80px',
    padding: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    boxSizing: 'border-box',
  },
};

export default function BuyingForm({ onBillCreated }) {
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [companyBillNumber, setCompanyBillNumber] = useState("");
  const [billDate, setBillDate] = useState(formatDateForInput(new Date()));
  const [branch, setBranch] = useState("Slemany");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");
  const [isConsignment, setIsConsignment] = useState(false);
  const [expensePercentage, setExpensePercentage] = useState("7");
  const [billNote, setBillNote] = useState("");
  const [billItems, setBillItems] = useState([]);
  const [transportFee, setTransportFee] = useState("0");
  const [externalExpense, setExternalExpense] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [suggestions, setSuggestions] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const searchInputRef = useRef(null);
  const companySearchRef = useRef(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Refs for keyboard navigation
  const itemInputRefs = useRef({});
  const transportFeeRef = useRef(null);
  const externalExpenseRef = useRef(null);
  const expensePercentageRef = useRef(null);
  const billNoteRef = useRef(null);
  const submitButtonRef = useRef(null);

  const createEmptyItem = () => ({
    barcode: "",
    name: "",
    quantity: "1",
    price: "",
    outPrice: "",
    expireDate: ""
  });

  const calculateNetPrice = (item, totalQuantity, transportFeeVal, externalExpenseVal, expensePercentageVal) => {
    const basePrice = parseFloat(parseFormattedNumber(item.price)) || 0;
    const quantity = parseFloat(item.quantity) || 1;
    if (totalQuantity === 0) return basePrice;
    
    const itemShare = quantity / totalQuantity;
    const transportPerItem = (transportFeeVal * itemShare) / quantity;
    const expensePerItem = (externalExpenseVal * itemShare) / quantity;
    const expenseAmount = basePrice * (expensePercentageVal / 100);
    const netPrice = basePrice + transportPerItem + expensePerItem + expenseAmount;
    return parseFloat(netPrice.toFixed(2));
  };

  const initializeFormWithBillData = (billData) => {
    setCompanyId(billData.companyId);
    setCompanySearch(billData.companyName || billData.companySearch || "");
    setCompanyCode(billData.companyCode || "");
    setCompanyBillNumber(billData.companyBillNumber || "");
    setBillDate(billData.billDate || formatDateForInput(new Date(billData.date)));
    setBranch(billData.branch || "Slemany");
    setPaymentStatus(billData.paymentStatus || "Unpaid");
    setIsConsignment(billData.isConsignment || false);
    setExpensePercentage(String(billData.expensePercentage || 7));
    setBillNote(billData.billNote || "");
    setCurrency(billData.currency || "USD");
    setTransportFee(formatNumber(billData.totalTransportFeeUSD || 0));
    setExternalExpense(formatNumber(billData.totalExternalExpenseUSD || 0));

    if (billData.items && billData.items.length > 0) {
      const initializedItems = billData.items.map(item => {
        let expireDate = "";
        if (item.expireDate && item.expireDate !== 'N/A') {
          if (typeof item.expireDate === 'string') {
            if (item.expireDate.includes('/')) {
              expireDate = parseDDMMYYYYToInput(item.expireDate);
            } else if (item.expireDate.includes('-')) {
              expireDate = item.expireDate;
            }
          } else if (item.expireDate?.toDate) {
            const d = item.expireDate.toDate();
            expireDate = formatDateForInput(d);
          } else if (item.expireDate?.seconds) {
            const d = new Date(item.expireDate.seconds * 1000);
            expireDate = formatDateForInput(d);
          }
        }

        let price = 0;
        let outPrice = 0;
        if (billData.currency === "USD") {
          price = item.basePriceUSD || item.basePrice || 0;
          outPrice = item.outPriceUSD || item.outPrice || 0;
        } else {
          price = item.basePriceIQD || item.basePrice || 0;
          outPrice = item.outPriceIQD || item.outPrice || 0;
        }

        return {
          barcode: item.barcode || "",
          name: item.name || "",
          quantity: String(item.quantity || 1),
          price: formatNumber(price),
          outPrice: formatNumber(outPrice),
          expireDate: expireDate,
          netPrice: item.netPrice || 0
        };
      });
      setBillItems(initializedItems);
    }
  };

  // Check if we're in edit mode
  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam === 'true') {
      const storedBill = localStorage.getItem('editingBill');
      if (storedBill) {
        try {
          const billData = JSON.parse(storedBill);
          setIsEditing(true);
          setEditingBill(billData);
          initializeFormWithBillData(billData);
        } catch (error) {
          console.error("Error parsing editing bill:", error);
          setError("Failed to load bill for editing. Please try again.");
        }
      }
    } else {
      if (billItems.length === 0) {
        setBillItems([createEmptyItem()]);
      }
    }
  }, [searchParams]);

  // Company search
  useEffect(() => {
    const fetchCompanies = async () => {
      if (companySearch.length > 0) {
        try {
          const companies = await getCompanies();
          const results = companies.filter(company =>
            company.name.toLowerCase().includes(companySearch.toLowerCase()) ||
            company.code.toString().includes(companySearch)
          );
          setCompanySuggestions(results);
          setShowCompanySuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching companies:", error);
        }
      } else {
        setCompanySuggestions([]);
        setShowCompanySuggestions(false);
      }
    };
    const timer = setTimeout(fetchCompanies, 300);
    return () => clearTimeout(timer);
  }, [companySearch]);

  // Item search
  useEffect(() => {
    const fetchItems = async () => {
      if (searchQuery.length > 0) {
        try {
          const results = await searchInitializedItems(searchQuery, "both");
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch (error) {
          console.error("Error fetching items:", error);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCompanySelect = useCallback((company) => {
    setCompanyId(company.id);
    setCompanySearch(company.name);
    setCompanyCode(company.code);
    setShowCompanySuggestions(false);
    setError(null);
  }, []);

  const handleItemSelect = useCallback((item) => {
    const newItem = {
      ...createEmptyItem(),
      barcode: item.barcode,
      name: item.name,
      outPrice: item.outPrice ? formatNumber(item.outPrice) : "",
      expireDate: item.expireDate && item.expireDate !== 'N/A' ?
        (typeof item.expireDate === 'string' ?
          (item.expireDate.includes('/') ?
            parseDDMMYYYYToInput(item.expireDate) :
            item.expireDate) :
          formatDateForInput(item.expireDate.toDate())) : ""
    };
    setBillItems(prev => [...prev.filter(item => item.barcode || item.name), newItem]);
    setShowSuggestions(false);
    setSearchQuery("");
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
  }, []);

  const handleItemChange = useCallback((index, field, value) => {
    setBillItems(prev => {
      const updatedItems = [...prev];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return updatedItems;
    });
  }, []);

  const resetForm = useCallback(() => {
    setCompanyId("");
    setCompanySearch("");
    setCompanyCode("");
    setCompanyBillNumber("");
    setBillDate(formatDateForInput(new Date()));
    setBranch("Slemany");
    setPaymentStatus("Unpaid");
    setIsConsignment(false);
    setExpensePercentage("7");
    setBillNote("");
    setCurrency("USD");
    setTransportFee("0");
    setExternalExpense("0");
    setBillItems([createEmptyItem()]);
    setError(null);
    setSuccessMessage(null);
    setIsEditing(false);
    setEditingBill(null);
    localStorage.removeItem('editingBill');
  }, []);

  const handleCancel = () => {
    resetForm();
    router.push('/buying');
  };

  // Keyboard navigation handler
  const handleKeyDown = (e, index, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const navigationOrder = [
        { type: 'item', field: 'barcode', index: index },
        { type: 'item', field: 'name', index: index },
        { type: 'item', field: 'quantity', index: index },
        { type: 'item', field: 'price', index: index },
        { type: 'item', field: 'outPrice', index: index },
        { type: 'item', field: 'expireDate', index: index },
        { type: 'global', field: 'transportFee' },
        { type: 'global', field: 'externalExpense' },
        { type: 'global', field: 'expensePercentage' },
        { type: 'global', field: 'billNote' },
        { type: 'global', field: 'submit' },
      ];
      
      let currentPos = -1;
      for (let i = 0; i < navigationOrder.length; i++) {
        const item = navigationOrder[i];
        if (item.type === 'item' && item.index === index && item.field === field) {
          currentPos = i;
          break;
        } else if (item.type === 'global' && item.field === field) {
          currentPos = i;
          break;
        }
      }
      
      if (currentPos !== -1 && currentPos + 1 < navigationOrder.length) {
        const next = navigationOrder[currentPos + 1];
        
        if (next.type === 'item') {
          const nextInput = itemInputRefs.current[`${next.index}-${next.field}`];
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        } else if (next.type === 'global') {
          if (next.field === 'transportFee' && transportFeeRef.current) {
            transportFeeRef.current.focus();
            transportFeeRef.current.select();
          } else if (next.field === 'externalExpense' && externalExpenseRef.current) {
            externalExpenseRef.current.focus();
            externalExpenseRef.current.select();
          } else if (next.field === 'expensePercentage' && expensePercentageRef.current) {
            expensePercentageRef.current.focus();
            expensePercentageRef.current.select();
          } else if (next.field === 'billNote' && billNoteRef.current) {
            billNoteRef.current.focus();
          } else if (next.field === 'submit' && submitButtonRef.current) {
            submitButtonRef.current.focus();
            submitButtonRef.current.click();
          }
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!companyId) {
        setError("Please select a company.");
        setIsLoading(false);
        return;
      }

      const validItems = billItems.filter(item =>
        item.barcode && item.name && parseFloat(item.quantity) > 0 && item.price
      );

      if (validItems.length === 0) {
        setError("Please add at least one valid item with a price.");
        setIsLoading(false);
        return;
      }

      const totalQuantity = validItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
      const transportFeeValue = parseFloat(parseFormattedNumber(transportFee)) || 0;
      const externalExpenseValue = parseFloat(parseFormattedNumber(externalExpense)) || 0;
      const expensePercentageValue = parseFloat(parseFormattedNumber(expensePercentage)) || 0;

      const itemsWithNetPrices = validItems.map(item => {
        let expireDateValue = null;
        if (item.expireDate) {
          try {
            if (typeof item.expireDate === 'string' && item.expireDate.includes('-')) {
              const [year, month, day] = item.expireDate.split('-');
              if (year && month && day) {
                expireDateValue = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));
              }
            }
          } catch (dateError) {
            console.error("Error parsing expire date:", dateError);
          }
        }

        const netPrice = calculateNetPrice(
          item, totalQuantity, transportFeeValue, externalExpenseValue, expensePercentageValue
        );
        
        const priceValue = parseFloat(parseFormattedNumber(item.price)) || 0;
        const outPriceValue = parseFloat(parseFormattedNumber(item.outPrice)) || (priceValue * 1.5);

        const itemData = {
          barcode: item.barcode,
          name: item.name,
          quantity: parseInt(item.quantity) || 1,
          expireDate: expireDateValue,
          branch: branch,
          isConsignment: isConsignment,
          consignmentOwnerId: isConsignment ? companyId : null,
          netPrice: netPrice,
          price: priceValue,
          outPrice: outPriceValue,
          currency: currency,
        };

        if (currency === "USD") {
          itemData.basePriceUSD = priceValue;
          itemData.basePriceIQD = priceValue;
          itemData.netPriceUSD = netPrice;
          itemData.netPriceIQD = netPrice;
          itemData.outPriceUSD = outPriceValue;
          itemData.outPriceIQD = outPriceValue;
        } else {
          itemData.basePriceIQD = priceValue;
          itemData.basePriceUSD = priceValue;
          itemData.netPriceIQD = netPrice;
          itemData.netPriceUSD = netPrice;
          itemData.outPriceIQD = outPriceValue;
          itemData.outPriceUSD = outPriceValue;
        }

        return itemData;
      });

      const additionalData = {
        expensePercentage: expensePercentageValue,
        billNote: billNote || "",
        currency: currency,
        transportFee: transportFeeValue,
        externalExpense: externalExpenseValue,
        totalTransportFeeUSD: transportFeeValue,
        totalTransportFeeIQD: transportFeeValue,
        totalExternalExpenseUSD: externalExpenseValue,
        totalExternalExpenseIQD: externalExpenseValue,
        billDate: billDate,
        exchangeRate: 1,
      };

      if (isEditing) {
        await updateBoughtBill(editingBill.billNumber, {
          companyId,
          companyBillNumber,
          date: billDate,
          paymentStatus,
          isConsignment,
          items: itemsWithNetPrices,
          ...additionalData,
          branch
        });
        setSuccessMessage(`Bill #${editingBill.billNumber} updated successfully!`);
        setTimeout(() => {
          resetForm();
          router.push('/buying');
        }, 1500);
      } else {
        const bill = await createBoughtBill(
          companyId, itemsWithNetPrices, null, paymentStatus, companyBillNumber, isConsignment, additionalData
        );
        if (onBillCreated) onBillCreated(bill);
        setSuccessMessage(`Bill #${bill.billNumber} created successfully!`);
        setTimeout(() => {
          resetForm();
        }, 1500);
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      setError(error.message || `Failed to ${isEditing ? 'update' : 'create'} bill. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = useCallback(() => {
    setBillItems(prev => [...prev.filter(item => item.barcode || item.name), createEmptyItem()]);
    setTimeout(() => {
      const newIndex = billItems.filter(item => item.barcode || item.name).length;
      const barcodeInput = itemInputRefs.current[`${newIndex}-barcode`];
      if (barcodeInput) {
        barcodeInput.focus();
      }
    }, 100);
  }, [billItems]);

  const removeItem = useCallback((index) => {
    setBillItems(prev => {
      const updatedItems = [...prev];
      updatedItems.splice(index, 1);
      if (updatedItems.length === 0) {
        return [createEmptyItem()];
      }
      return updatedItems;
    });
  }, []);

  const totalBasePrice = billItems.reduce((sum, item) =>
    sum + ((parseFloat(parseFormattedNumber(item.price)) || 0) * (parseFloat(item.quantity) || 0)), 0);

  const totalQuantity = billItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const validItemsCount = billItems.filter(item => item.barcode || item.name).length;

  return (
    <div style={styles.container}>
      <div style={styles.mainCard}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>
            {isEditing ? `Edit Bill #${editingBill?.billNumber}` : "Create Purchase Bill"}
          </h1>
          <p style={styles.headerSubtitle}>
            Enter purchase details in your preferred currency - Press Enter to navigate between fields
          </p>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Success Message */}
          {successMessage && (
            <div style={styles.successBox}>
              <FiCheckCircle size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={styles.errorBox}>
              <FiAlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Currency Selection */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                <FiDollarSign size={16} />
                Currency Selection
              </h2>
              <div style={styles.currencyButtons}>
                <button
                  type="button"
                  onClick={() => setCurrency("USD")}
                  style={{
                    ...styles.currencyBtn,
                    ...(currency === "USD" ? styles.currencyBtnActiveUSD : styles.currencyBtnInactive)
                  }}
                >
                  🇺🇸 USD - US Dollar
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("IQD")}
                  style={{
                    ...styles.currencyBtn,
                    ...(currency === "IQD" ? styles.currencyBtnActiveIQD : styles.currencyBtnInactive)
                  }}
                >
                  🇮🇶 IQD - Iraqi Dinar
                </button>
              </div>
            </div>

            {/* Company Information */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                <FiUser size={16} />
                Company Information
              </h2>
              <div style={styles.formRow}>
                <div style={{ ...styles.formGroup, ...styles.relative }}>
                  <label style={styles.label}>Company Search</label>
                  <div style={styles.relative}>
                    <input
                      ref={companySearchRef}
                      type="text"
                      style={styles.input}
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      placeholder="Search by code or name..."
                      required
                    />
                    {showCompanySuggestions && companySuggestions.length > 0 && (
                      <div style={styles.suggestionBox}>
                        {companySuggestions.map((company) => (
                          <div
                            key={company.id}
                            style={styles.suggestionItem}
                            onClick={() => handleCompanySelect(company)}
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            <div style={{ fontWeight: 500 }}>{company.name}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Code: {company.code}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Bill Date</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Company Bill Number</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={companyBillNumber}
                    onChange={(e) => setCompanyBillNumber(e.target.value)}
                    placeholder="Enter company bill #"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Payment Method</label>
                  <select
                    style={styles.select}
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    required
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Cash">Cash</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Branch</label>
                  <select
                    style={styles.select}
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                  >
                    <option value="Slemany">Slemany</option>
                    <option value="Erbil">Erbil</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                <FiPackage size={16} />
                Bill Items ({validItemsCount})
              </h2>
              
              <button type="button" onClick={addItem} style={styles.addButton}>
                <FiPlus size={14} /> Add Item
              </button>

              {/* Search Items */}
              <div style={styles.searchWrapper}>
                <FiSearch style={styles.searchIcon} size={14} />
                <input
                  ref={searchInputRef}
                  type="text"
                  style={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search items by barcode or name..."
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div style={styles.suggestionBox}>
                    {suggestions.map((item) => (
                      <div
                        key={item.id}
                        style={styles.suggestionItem}
                        onClick={() => handleItemSelect(item)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <div style={{ fontWeight: 500 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Barcode: {item.barcode}
                          {item.expireDate && item.expireDate !== 'N/A' && ` | Expires: ${item.expireDate}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Barcode</th>
                      <th style={styles.th}>Item Name</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Qty</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Buy Price ({currency})</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Out Price ({currency})</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Net Price ({currency})</th>
                      <th style={styles.th}>Expire Date</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billItems.map((item, index) => {
                      const netPrice = calculateNetPrice(
                        item,
                        totalQuantity || 1,
                        parseFloat(parseFormattedNumber(transportFee)) || 0,
                        parseFloat(parseFormattedNumber(externalExpense)) || 0,
                        parseFloat(parseFormattedNumber(expensePercentage)) || 0
                      );
                      return (
                        <tr key={index}>
                          <td style={styles.td}>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-barcode`] = el}
                              style={styles.textInput}
                              value={item.barcode || ''}
                              onChange={(e) => handleItemChange(index, "barcode", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'barcode')}
                              placeholder="Barcode"
                            />
                          </td>
                          <td style={styles.td}>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-name`] = el}
                              style={styles.textInput}
                              value={item.name || ''}
                              onChange={(e) => handleItemChange(index, "name", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'name')}
                              placeholder="Item name"
                            />
                          </td>
                          <td style={{ ...styles.td, textAlign: 'center' }}>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-quantity`] = el}
                              type="number"
                              min="1"
                              step="1"
                              style={styles.smallInput}
                              value={item.quantity || 1}
                              onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'quantity')}
                            />
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-price`] = el}
                              type="text"
                              style={styles.priceInput}
                              value={item.price}
                              onChange={(e) => {
                                const formatted = formatNumber(e.target.value);
                                handleItemChange(index, "price", formatted);
                                const rawPrice = parseFloat(e.target.value.replace(/,/g, ''));
                                if (rawPrice && !isNaN(rawPrice) && (!item.outPrice || item.outPrice === '')) {
                                  const autoOutPrice = rawPrice * 1.5;
                                  handleItemChange(index, "outPrice", formatNumber(autoOutPrice));
                                }
                              }}
                              onKeyDown={(e) => handleKeyDown(e, index, 'price')}
                              placeholder="0.00"
                            />
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-outPrice`] = el}
                              type="text"
                              style={styles.outPriceInput}
                              value={item.outPrice || ''}
                              onChange={(e) => {
                                const formatted = formatNumber(e.target.value);
                                handleItemChange(index, "outPrice", formatted);
                              }}
                              onKeyDown={(e) => handleKeyDown(e, index, 'outPrice')}
                              placeholder="Selling price"
                            />
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold', color: '#4f46e5' }}>
                            {formatNumber(netPrice)}
                          </td>
                          <td style={styles.td}>
                            <input
                              ref={(el) => itemInputRefs.current[`${index}-expireDate`] = el}
                              type="date"
                              style={styles.textInput}
                              value={item.expireDate || ''}
                              onChange={(e) => handleItemChange(index, "expireDate", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'expireDate')}
                            />
                          </td>
                          <td style={{ ...styles.td, textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              style={styles.deleteButton}
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Base Price */}
              <div style={styles.totalBox}>
                <span style={styles.totalLabel}>Total Base Price:</span>
                <span style={styles.totalValue}>{formatNumber(totalBasePrice)} {currency}</span>
              </div>
            </div>

            {/* Expenses Section */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                <FiTruck size={16} />
                Additional Costs
              </h2>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Transport Fee ({currency})</label>
                  <input
                    ref={transportFeeRef}
                    type="text"
                    step="0.01"
                    min="0"
                    value={transportFee}
                    onChange={(e) => handleNumberInput(e.target.value, setTransportFee)}
                    onKeyDown={(e) => handleKeyDown(e, null, 'transportFee')}
                    style={styles.input}
                    placeholder="0.00"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Other Expenses ({currency})</label>
                  <input
                    ref={externalExpenseRef}
                    type="text"
                    step="0.01"
                    min="0"
                    value={externalExpense}
                    onChange={(e) => handleNumberInput(e.target.value, setExternalExpense)}
                    onKeyDown={(e) => handleKeyDown(e, null, 'externalExpense')}
                    style={styles.input}
                    placeholder="0.00"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Expense Percentage (%)</label>
                  <input
                    ref={expensePercentageRef}
                    type="text"
                    min="0"
                    max="100"
                    step="0.1"
                    value={expensePercentage}
                    onChange={(e) => handleNumberInput(e.target.value, setExpensePercentage)}
                    onKeyDown={(e) => handleKeyDown(e, null, 'expensePercentage')}
                    style={styles.input}
                    placeholder="7"
                  />
                </div>
              </div>
            </div>

            {/* Bill Notes */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                <FiFileText size={16} />
                Bill Notes
              </h2>
              <textarea
                ref={billNoteRef}
                style={{ ...styles.input, width: '100%', minHeight: '60px' }}
                value={billNote}
                onChange={(e) => setBillNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (submitButtonRef.current) {
                      submitButtonRef.current.focus();
                      submitButtonRef.current.click();
                    }
                  }
                }}
                placeholder="Add any notes for this bill... (Press Enter to submit)"
              />
            </div>

            {/* Consignment Option */}
            <div style={styles.section}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isConsignment}
                  onChange={(e) => setIsConsignment(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500, fontSize: '13px' }}>Consignment (تحت صرف)</span>
              </label>
            </div>

            {/* Actions */}
            <div style={styles.buttonGroup}>
              <button type="button" onClick={resetForm} style={styles.resetButton}>
                <FiRefreshCw size={14} /> Reset Form
              </button>
              <div style={styles.rightGroup}>
                {isEditing && (
                  <button type="button" onClick={handleCancel} style={styles.cancelButton}>
                    <FiX size={14} /> Cancel
                  </button>
                )}
                <button 
                  ref={submitButtonRef}
                  type="submit" 
                  disabled={isLoading} 
                  style={{
                    ...styles.submitButton,
                    opacity: isLoading ? 0.6 : 1,
                    cursor: isLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isLoading ? (
                    <>Processing...</>
                  ) : isEditing ? (
                    <>Update Bill</>
                  ) : (
                    <>Create Bill</>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}