"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  createSoldPayment,
  getPharmacies,
  getPharmacySoldBills,
  getPharmacyReturns,
  getSoldPaymentDetails,
  updateSoldPayment,
  getSoldPayments,
  getSoldBills,
  getSaleBillById,
  getReturnById,
} from "@/lib/data";

export default function SoldPaymentManagementPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState("");
  const [pharmacySearchTerm, setPharmacySearchTerm] = useState("");
  const [showPharmacyDropdown, setShowPharmacyDropdown] = useState(false);
  const [soldBills, setSoldBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedSoldBills, setSelectedSoldBills] = useState([]);
  const [selectedSoldReturns, setSelectedSoldReturns] = useState([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [hardcopyBillNumber, setHardcopyBillNumber] = useState("");
  const [hardcopyBillError, setHardcopyBillError] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [advancedSearch, setAdvancedSearch] = useState({
    pharmacyName: "",
    hardcopyBillNumber: "",
    soldBillNumber: "",
    returnBillNumber: "",
    paymentNumber: "",
    dateFrom: "",
    dateTo: "",
    amountMinUSD: "",
    amountMaxUSD: "",
    amountMinIQD: "",
    amountMaxIQD: "",
  });
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // State for viewing bill/return details
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItems, setDetailItems] = useState([]);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailType, setDetailType] = useState("bill");
  const [detailLoading, setDetailLoading] = useState(false);

  // Search states for bills and returns
  const [billSearchTerm, setBillSearchTerm] = useState("");
  const [returnSearchTerm, setReturnSearchTerm] = useState("");

  // IMAGE STATE
  const [billImageData, setBillImageData] = useState(null);
  const [originalImageData, setOriginalImageData] = useState(null);
  const [imageHasChanged, setImageHasChanged] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [currencyTotals, setCurrencyTotals] = useState({ soldUSD: 0, soldIQD: 0, returnUSD: 0, returnIQD: 0, netUSD: 0, netIQD: 0 });
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [printLoading, setPrintLoading] = useState(false);

  const pharmacyInputRef = useRef(null);
  const hardcopyBillNumberRef = useRef(null);
  const pharmacyDropdownRef = useRef(null);

  const colorScheme = {
    primary: "#3B82F6",
    secondary: "#10B981",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    dark: "#1E40AF",
    light: "#93C5FD",
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#1F2937",
    textLight: "#6B7280",
  };

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      setIsLoading(false);
    }
  }, [user, router]);

  const formatDateToDMY = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateToYMD = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toISOString().split("T")[0];
  };

  const generatePaymentNumber = (docId) => {
    const currentYear = new Date().getFullYear();
    const shortId = docId ? docId.slice(-8).toUpperCase() : Math.random().toString(36).slice(-8).toUpperCase();
    return `SPAY-${currentYear}-${shortId}`;
  };

  const formatCurrency = (amount, currency = "IQD") => {
    if (amount === undefined || amount === null || amount === 0) {
      return currency === "USD" ? "$0.00" : "0 IQD";
    }
    if (currency === "USD") {
      return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    } else {
      return new Intl.NumberFormat("en-US").format(Math.round(amount)) + " IQD";
    }
  };

  const getDisplayAmount = (amountUSD, amountIQD) => {
    const parts = [];
    if (amountUSD && amountUSD > 0) parts.push(formatUSD(amountUSD));
    if (amountIQD && amountIQD > 0) parts.push(formatIQD(amountIQD));
    if (amountIQD < 0) parts.push(formatIQD(amountIQD));
    if (amountUSD < 0) parts.push(formatUSD(amountUSD));
    if (parts.length === 0) return "0 IQD";
    return parts.join(" + ");
  };

  const formatUSD = (amount) => {
    if (!amount || amount === 0) return "$0.00";
    return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const formatIQD = (amount) => {
    if (!amount || amount === 0) return "0 IQD";
    return new Intl.NumberFormat("en-US").format(Math.round(amount)) + " IQD";
  };

  const getFirstName = (fullName) => {
    if (!fullName) return "User";
    const namePart = fullName.split("@")[0];
    return namePart.split(" ")[0];
  };

  const processImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setImageProcessing(true);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        let width = img.width;
        let height = img.height;
        const maxWidth = 800;
        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height);
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
        const base64 = canvas.toDataURL("image/jpeg", 0.7);
        setBillImageData(base64);
        setImageHasChanged(true);
        setImageProcessing(false);
      };
      img.onerror = () => {
        setError("Failed to load image. Please try another file.");
        setImageProcessing(false);
      };
      img.src = readerEvent.target.result;
    };
    reader.onerror = () => {
      setError("Failed to read file. Please try again.");
      setImageProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e) => {
    processImageFile(e.target.files[0]);
  };

  const handleCameraChange = (e) => {
    processImageFile(e.target.files[0]);
  };

  const triggerFileInput = () => fileInputRef.current?.click();
  const triggerCameraInput = () => cameraInputRef.current?.click();

  const removeImage = () => {
    setBillImageData(null);
    setImageHasChanged(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const filteredPharmacies = pharmacies.filter(
    (pharmacy) =>
      pharmacy.name.toLowerCase().includes(pharmacySearchTerm.toLowerCase()) ||
      pharmacy.code?.toLowerCase().includes(pharmacySearchTerm.toLowerCase())
  );

  const handleSelectPharmacy = (pharmacy) => {
    setSelectedPharmacy(pharmacy.id);
    setPharmacySearchTerm(pharmacy.name);
    setShowPharmacyDropdown(false);
  };

  const handlePharmacyInputChange = (e) => {
    setPharmacySearchTerm(e.target.value);
    setShowPharmacyDropdown(true);
    if (e.target.value === "") setSelectedPharmacy("");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pharmacyDropdownRef.current && !pharmacyDropdownRef.current.contains(event.target)) {
        setShowPharmacyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshPayments = async () => {
    try {
      setHistoryLoading(true);
      const paymentsData = await getSoldPayments();
      paymentsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      setPaymentHistory(paymentsData);
    } catch (err) {
      console.error("Error refreshing payments:", err);
      setError("Failed to refresh payment history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const loadInitialData = async () => {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get("edit");
        if (editId) { setIsEditMode(true); setEditPaymentId(editId); }
      }
      await refreshPayments();
      await loadPharmacies();
    };
    loadInitialData();
  }, [user]);

  const loadPharmacies = async () => {
    try {
      const pharmaciesData = await getPharmacies();
      setPharmacies(pharmaciesData);
    } catch (err) {
      console.error("Error loading pharmacies:", err);
      setError("Failed to load pharmacies");
    }
  };

  useEffect(() => {
    const loadPaymentForEdit = async () => {
      if (!isEditMode || !editPaymentId) return;
      try {
        setLoading(true);
        setError(null);
        const paymentToEdit = await getSoldPaymentDetails(editPaymentId);
        if (paymentToEdit) {
          setSelectedPharmacy(paymentToEdit.pharmacyId);
          const pharmacy = pharmacies.find((c) => c.id === paymentToEdit.pharmacyId);
          setPharmacySearchTerm(pharmacy?.name || "");
          setHardcopyBillNumber(paymentToEdit.hardcopyBillNumber);
          const existingImage = paymentToEdit.billImageBase64 || paymentToEdit.billImageUrl || null;
          setBillImageData(existingImage);
          setOriginalImageData(existingImage);
          setImageHasChanged(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          if (cameraInputRef.current) cameraInputRef.current.value = "";
          if (paymentToEdit.paymentDate) {
            setPaymentDate(formatDateToYMD(paymentToEdit.paymentDate));
          } else {
            setPaymentDate(new Date().toISOString().split("T")[0]);
          }
          setNotes(paymentToEdit.notes || "");
          setSelectedSoldBills(paymentToEdit.selectedSoldBills || []);
          setSelectedSoldReturns(paymentToEdit.selectedReturns || []);
        }
      } catch (err) {
        console.error("Error loading payment for edit:", err);
        setError("Failed to load payment for editing");
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    };
    loadPaymentForEdit();
  }, [isEditMode, editPaymentId, pharmacies]);

  useEffect(() => {
    if (!selectedPharmacy) {
      setSoldBills([]);
      setReturns([]);
      if (!isEditMode) {
        setHardcopyBillNumber("");
        setBillImageData(null);
        setOriginalImageData(null);
        setImageHasChanged(false);
      }
      return;
    }
    const loadPharmacyData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [allSoldBills, allReturns] = await Promise.all([
          getPharmacySoldBills(selectedPharmacy, isEditMode ? selectedSoldBills : []),
          getPharmacyReturns(selectedPharmacy, isEditMode ? selectedSoldReturns : []),
        ]);
        const sortedBills = [...allSoldBills].sort((a, b) => {
          const numA = parseInt(a.billNumber) || 0;
          const numB = parseInt(b.billNumber) || 0;
          return numB - numA;
        });
        const sortedReturns = [...allReturns].sort((a, b) => {
          const dateA = a.returnDate?.toDate ? a.returnDate.toDate() : new Date(a.date || 0);
          const dateB = b.returnDate?.toDate ? b.returnDate.toDate() : new Date(b.date || 0);
          return dateB - dateA;
        });
        setSoldBills(sortedBills);
        setReturns(sortedReturns);
      } catch (err) {
        console.error("Error loading pharmacy data:", err);
        setError("Failed to load pharmacy data");
      } finally {
        setLoading(false);
      }
    };
    loadPharmacyData();
  }, [selectedPharmacy, isEditMode, initialLoadComplete]);

  useEffect(() => {
    let soldUSD = 0, soldIQD = 0, returnUSD = 0, returnIQD = 0;
    selectedSoldBills.forEach((billId) => {
      const bill = soldBills.find((b) => b.id === billId);
      if (bill) {
        soldUSD += bill.totalAmountUSD || 0;
        soldIQD += bill.totalAmountIQD || 0;
      }
    });
    selectedSoldReturns.forEach((returnId) => {
      const returnBill = returns.find((r) => r.id === returnId);
      if (returnBill) {
        returnUSD += returnBill.totalReturnUSD || 0;
        returnIQD += returnBill.totalReturnIQD || 0;
      }
    });
    setCurrencyTotals({ soldUSD, soldIQD, returnUSD, returnIQD, netUSD: soldUSD - returnUSD, netIQD: soldIQD - returnIQD });
  }, [selectedSoldBills, selectedSoldReturns, soldBills, returns]);

  const toggleSoldBill = (billId) =>
    setSelectedSoldBills((prev) => prev.includes(billId) ? prev.filter((id) => id !== billId) : [...prev, billId]);

  const toggleSoldReturn = (returnId) =>
    setSelectedSoldReturns((prev) => prev.includes(returnId) ? prev.filter((id) => id !== returnId) : [...prev, returnId]);

  const selectAllSoldBills = () =>
    setSelectedSoldBills(selectedSoldBills.length === soldBills.length ? [] : soldBills.map((b) => b.id));

  const selectAllSoldReturns = () =>
    setSelectedSoldReturns(selectedSoldReturns.length === returns.length ? [] : returns.map((r) => r.id));

  const resetForm = () => {
    setSelectedSoldBills([]);
    setSelectedSoldReturns([]);
    setHardcopyBillNumber("");
    setNotes("");
    setBillImageData(null);
    setOriginalImageData(null);
    setImageHasChanged(false);
    setSelectedPharmacy("");
    setPharmacySearchTerm("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setPaymentDate(new Date().toISOString().split("T")[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setHardcopyBillError(false);

    let hasError = false;
    if (!selectedPharmacy) {
      setError("Please select a pharmacy");
      pharmacyInputRef.current?.focus();
      hasError = true;
    }
    if (!hardcopyBillNumber.trim()) {
      setHardcopyBillError(true);
      if (!hasError) {
        hardcopyBillNumberRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => hardcopyBillNumberRef.current?.focus(), 400);
      }
      hasError = true;
    }
    if (selectedSoldBills.length === 0 && selectedSoldReturns.length === 0) {
      if (!hasError) setError("Please select at least one bill or return to process");
      hasError = true;
    }
    if (hasError) return;

    if (imageProcessing) {
      setError("Image is still processing. Please wait a moment.");
      return;
    }

    try {
      setSubmitting(true);

      const selectedPharmacyData = pharmacies.find((c) => c.id === selectedPharmacy);
      const userDisplayName = user?.name || user?.email || "Unknown User";

      let imageToSave;
      if (isEditMode) {
        imageToSave = imageHasChanged ? (billImageData || null) : (originalImageData || null);
      } else {
        imageToSave = billImageData || null;
      }

      const paymentData = {
        pharmacyId: selectedPharmacy,
        pharmacyName: selectedPharmacyData?.name || "Unknown Pharmacy",
        selectedSoldBills,
        selectedReturns: selectedSoldReturns,
        soldTotalUSD: currencyTotals.soldUSD,
        soldTotalIQD: currencyTotals.soldIQD,
        returnTotalUSD: currencyTotals.returnUSD,
        returnTotalIQD: currencyTotals.returnIQD,
        netAmountUSD: currencyTotals.netUSD,
        netAmountIQD: currencyTotals.netIQD,
        paymentDate: new Date(paymentDate),
        hardcopyBillNumber: hardcopyBillNumber.trim(),
        notes,
        billImageBase64: imageToSave,
        billImageUrl: imageToSave,
        createdBy: user.uid,
        createdByName: userDisplayName,
        paymentType: "sold",
      };

      if (isEditMode) {
        const existingPayment = paymentHistory.find(p => p.id === editPaymentId);
        paymentData.paymentNumber = existingPayment?.paymentNumber || generatePaymentNumber(editPaymentId);
        await updateSoldPayment(editPaymentId, paymentData);
        setSuccess("Sold Payment updated successfully!");
        setIsEditMode(false);
        setEditPaymentId(null);
      } else {
        const result = await createSoldPayment(paymentData);
        if (!result || !result.id) throw new Error("Payment creation failed: No payment ID returned.");
        const paymentNumber = generatePaymentNumber(result.id);
        await updateSoldPayment(result.id, { ...paymentData, paymentNumber });
        setSuccess("Sold Payment created successfully!");
      }

      resetForm();
      await refreshPayments();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error creating/updating payment:", err);
      setError(err.message || "Failed to process payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditPaymentId(null);
    setSelectedSoldBills([]);
    setSelectedSoldReturns([]);
    setHardcopyBillNumber("");
    setHardcopyBillError(false);
    setNotes("");
    setBillImageData(null);
    setOriginalImageData(null);
    setImageHasChanged(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setSelectedPharmacy("");
    setPharmacySearchTerm("");
    window.history.replaceState({}, "", "/sold-payments");
  };

  const handleUpdatePayment = (payment) => {
    setIsEditMode(true);
    setEditPaymentId(payment.id);
    setSelectedPharmacy(payment.pharmacyId);
    const pharmacy = pharmacies.find((c) => c.id === payment.pharmacyId);
    setPharmacySearchTerm(pharmacy?.name || "");
    setHardcopyBillNumber(payment.hardcopyBillNumber);
    setHardcopyBillError(false);
    const existingImage = payment.billImageBase64 || payment.billImageUrl || null;
    setBillImageData(existingImage);
    setOriginalImageData(existingImage);
    setImageHasChanged(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (payment.paymentDate) {
      setPaymentDate(formatDateToYMD(payment.paymentDate));
    } else {
      setPaymentDate(new Date().toISOString().split("T")[0]);
    }
    setNotes(payment.notes || "");
    setSelectedSoldBills(payment.selectedSoldBills || []);
    setSelectedSoldReturns(payment.selectedReturns || []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewPayment = async (payment) => {
    setSelectedPayment(payment);
    await loadPaymentDetails(payment.id);
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => { setShowPaymentModal(false); setSelectedPayment(null); };
  const handleViewImage = (imageData) => { setSelectedImageUrl(imageData); setShowImageModal(true); };
  const closeImageModal = () => { setShowImageModal(false); setSelectedImageUrl(""); };

  const viewBillDetails = async (billId) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const billData = await getSaleBillById(billId);
      if (billData) {
        setDetailTitle(`Bill #${billData.billNumber || billId}`);
        setDetailType("bill");
        const items = (billData.items || []).map(item => ({
          ...item,
          displayPrice: getDisplayAmount(item.outPriceUSD || 0, item.outPriceIQD || 0),
          displayTotal: getDisplayAmount(
            (item.outPriceUSD || 0) * (item.quantity || 0),
            (item.outPriceIQD || 0) * (item.quantity || 0)
          ),
          quantity: item.quantity || 0,
          currency: item.originalCurrency || "USD",
        }));
        setDetailItems(items);
      } else {
        setError("Bill not found");
        setShowDetailModal(false);
      }
    } catch (err) {
      console.error("Error loading bill details:", err);
      setError("Failed to load bill details");
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const viewReturnDetails = async (returnId) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const returnData = await getReturnById(returnId);
      if (returnData) {
        setDetailTitle(`Return #${returnData.returnBillNumber || returnId}`);
        setDetailType("return");
        const items = (returnData.items || []).map(item => ({
          ...item,
          displayPrice: getDisplayAmount(
            item.returnPrice && item.currency === "USD" ? item.returnPrice : 0,
            item.returnPrice && item.currency === "IQD" ? item.returnPrice : 0
          ),
          displayTotal: getDisplayAmount(
            (item.returnPrice || 0) * (item.returnQuantity || 0),
            0
          ),
          quantity: item.returnQuantity || 0,
          currency: item.currency || "USD",
        }));
        setDetailItems(items);
      } else {
        setError("Return not found");
        setShowDetailModal(false);
      }
    } catch (err) {
      console.error("Error loading return details:", err);
      setError("Failed to load return details");
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setDetailItems([]);
    setDetailTitle("");
  };

  const getFilteredBills = () => {
    if (!billSearchTerm.trim()) return soldBills;
    const search = billSearchTerm.toLowerCase().trim();
    return soldBills.filter(bill => {
      if (bill.billNumber && String(bill.billNumber).toLowerCase().includes(search)) return true;
      if (bill.items && Array.isArray(bill.items)) {
        return bill.items.some(item => 
          (item.barcode && item.barcode.toLowerCase().includes(search)) ||
          (item.name && item.name.toLowerCase().includes(search))
        );
      }
      return false;
    });
  };

  const getFilteredReturns = () => {
    if (!returnSearchTerm.trim()) return returns;
    const search = returnSearchTerm.toLowerCase().trim();
    return returns.filter(ret => {
      if (ret.returnBillNumber && ret.returnBillNumber.toLowerCase().includes(search)) return true;
      if (ret.items && Array.isArray(ret.items)) {
        return ret.items.some(item => 
          (item.barcode && item.barcode.toLowerCase().includes(search)) ||
          (item.name && item.name.toLowerCase().includes(search))
        );
      }
      return false;
    });
  };

  const handlePrintPayment = async (payment) => {
    setPrintLoading(true);
    try {
      const allSoldBills = await getSoldBills();
      const allReturns = await getPharmacyReturns(payment.pharmacyId, payment.selectedReturns || []);

      const soldDetails = allSoldBills.filter((bill) =>
        payment.selectedSoldBills?.includes(bill.id)
      );

      const returnDetails = allReturns.filter((ret) =>
        payment.selectedReturns?.includes(ret.id)
      );

      const printWindow = window.open("", "_blank");
      printWindow.document.write(generatePrintHTML(payment, soldDetails, returnDetails));
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    } catch (err) {
      console.error("Error generating print:", err);
      setError("Failed to generate print preview");
    } finally {
      setPrintLoading(false);
    }
  };

  const generatePrintHTML = (payment, soldBillsList, returnsList) => {
    let totalSoldUSD = 0, totalSoldIQD = 0, totalReturnUSD = 0, totalReturnIQD = 0;
    const soldItemsRows = [];
    const returnItemsRows = [];

    if (soldBillsList && soldBillsList.length > 0) {
      soldBillsList.forEach((bill) => {
        const billUSD = Number(bill.totalAmountUSD) || 0;
        const billIQD = Number(bill.totalAmountIQD) || 0;
        totalSoldUSD += billUSD;
        totalSoldIQD += billIQD;

        const displayAmounts = [];
        if (billUSD > 0) displayAmounts.push(formatUSD(billUSD));
        if (billIQD > 0) displayAmounts.push(formatIQD(billIQD));
        const displayAmount = displayAmounts.length > 0 ? displayAmounts.join(" + ") : (billIQD > 0 ? formatIQD(billIQD) : "0 IQD");

        const billNote = bill.note || bill.billNote || "";
        soldItemsRows.push(`
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 8px; font-weight: 500;">${bill.billNumber || bill.id}</td>
            <td style="padding: 10px 8px; color: #6b7280;">${formatDateToDMY(bill.date)}</td>
            <td style="padding: 10px 8px; color: #9ca3af; font-style: italic;">${billNote || "—"}</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #059669;">+${displayAmount}</td>
          </tr>
        `);
      });
    }

    if (returnsList && returnsList.length > 0) {
      returnsList.forEach((ret) => {
        const returnNumberDisplay = ret.returnBillNumber || `RET-${ret.id?.slice(-6)}`;
        const returnUSD = Number(ret.totalReturnUSD) || 0;
        const returnIQD = Number(ret.totalReturnIQD) || 0;
        totalReturnUSD += returnUSD;
        totalReturnIQD += returnIQD;

        const displayAmounts = [];
        if (returnUSD > 0) displayAmounts.push(formatUSD(returnUSD));
        if (returnIQD > 0) displayAmounts.push(formatIQD(returnIQD));
        const displayAmount = displayAmounts.length > 0 ? displayAmounts.join(" + ") : (returnIQD > 0 ? formatIQD(returnIQD) : "0 IQD");

        const retNote = ret.returnNote || ret.note || "";
        returnItemsRows.push(`
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 8px; font-weight: 500;">${returnNumberDisplay}</td>
            <td style="padding: 10px 8px; color: #6b7280;">${formatDateToDMY(ret.returnDate || ret.date)}</td>
            <td style="padding: 10px 8px; color: #9ca3af; font-style: italic;">${retNote || "—"}</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #dc2626;">-${displayAmount}</td>
          </tr>
        `);
      });
    }

    const paidUSD = totalSoldUSD - totalReturnUSD;
    const paidIQD = totalSoldIQD - totalReturnIQD;
    const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/Aranlogo.png` : "/Aranlogo.png";

    const getSoldDisplay = () => {
      if (totalSoldUSD > 0 && totalSoldIQD > 0) return `+${formatUSD(totalSoldUSD)} + ${formatIQD(totalSoldIQD)}`;
      if (totalSoldUSD > 0) return `+${formatUSD(totalSoldUSD)}`;
      if (totalSoldIQD > 0) return `+${formatIQD(totalSoldIQD)}`;
      return "0 IQD";
    };

    const getReturnDisplay = () => {
      if (totalReturnUSD > 0 && totalReturnIQD > 0) return `-${formatUSD(totalReturnUSD)} - ${formatIQD(totalReturnIQD)}`;
      if (totalReturnUSD > 0) return `-${formatUSD(totalReturnUSD)}`;
      if (totalReturnIQD > 0) return `-${formatIQD(totalReturnIQD)}`;
      return "0 IQD";
    };

    const getPaidDisplay = () => {
      if (paidIQD !== 0) {
        return paidIQD < 0 ? formatIQD(paidIQD) : `+${formatIQD(paidIQD)}`;
      }
      if (paidUSD !== 0) {
        return paidUSD < 0 ? formatUSD(paidUSD) : `+${formatUSD(paidUSD)}`;
      }
      return "0 IQD";
    };

    return `<!DOCTYPE html>
<html>
  <head>
    <title>Payment Receipt - ${payment.paymentNumber}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;background:white;padding:20px;}
      .receipt{max-width:900px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:24px;background:white;}
      .header{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #3B82F6;}
      .logo{max-height:70px;max-width:220px;object-fit:contain;margin-bottom:8px;}
      .header h1{font-size:20px;font-weight:bold;margin-bottom:6px;color:#3B82F6;}
      .header p{font-size:12px;color:#6b7280;}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:10px;}
      .info-item{margin-bottom:8px;}
      .info-label{font-weight:bold;color:#6b7280;font-size:10px;text-transform:uppercase;margin-bottom:4px;}
      .info-value{font-size:13px;font-weight:600;color:#1f2937;}
      .totals-row{display:flex;justify-content:space-between;gap:16px;margin-bottom:24px;}
      .total-card{flex:1;padding:14px;border-radius:10px;text-align:center;}
      .total-card.sold{background:#d1fae5;border:1px solid #10b981;}
      .total-card.return{background:#fee2e2;border:1px solid #ef4444;}
      .total-card.paid{background:#dbeafe;border:1px solid #3b82f6;}
      .total-label{font-size:10px;text-transform:uppercase;font-weight:700;color:#4b5563;margin-bottom:6px;}
      .total-amount{font-size:15px;font-weight:800;}
      .section{margin-bottom:24px;}
      .section-title{font-size:14px;font-weight:bold;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb;}
      table{width:100%;border-collapse:collapse;}
      th{background:#f3f4f6;padding:10px 8px;text-align:left;font-weight:700;font-size:11px;color:#4b5563;text-transform:uppercase;}
      th:last-child{text-align:right;}
      td:last-child{text-align:right;}
      .notes-box{margin-top:16px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:11px;}
      .footer{margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af;}
      @media print{body{padding:0;margin:0;}.receipt{border:none;padding:16px;}}
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        <img src="${logoUrl}" alt="Aran Logo" class="logo" onerror="this.style.display='none'" />
        <h1>SOLD PAYMENT RECEIPT</h1>
        <p><strong>${payment.paymentNumber || ""}</strong> | ${formatDateToDMY(payment.paymentDate)}</p>
      </div>
      
      <div class="info-grid">
        <div>
          <div class="info-item"><div class="info-label">Pharmacy</div><div class="info-value">${payment.pharmacyName || ""}</div></div>
          <div class="info-item"><div class="info-label">Hardcopy Bill</div><div class="info-value">${payment.hardcopyBillNumber || ""}</div></div>
        </div>
        <div>
          <div class="info-item"><div class="info-label">Created By</div><div class="info-value">${getFirstName(payment.createdByName)}</div></div>
          <div class="info-item"><div class="info-label">Payment Date</div><div class="info-value">${formatDateToDMY(payment.paymentDate)}</div></div>
        </div>
      </div>
      
      <div class="totals-row">
        <div class="total-card sold">
          <div class="total-label">TOTAL SOLD</div>
          <div class="total-amount" style="color:#059669;">${getSoldDisplay()}</div>
        </div>
        <div class="total-card return">
          <div class="total-label">TOTAL RETURN</div>
          <div class="total-amount" style="color:#dc2626;">${getReturnDisplay()}</div>
        </div>
        <div class="total-card paid">
          <div class="total-label">TOTAL PAID</div>
          <div class="total-amount" style="color:${paidIQD < 0 ? '#dc2626' : '#059669'};">${getPaidDisplay()}</div>
        </div>
      </div>
      
      ${soldItemsRows.length > 0 ? `
      <div class="section">
        <div class="section-title">💰 SOLD BILLS</div>
        <table>
          <thead>
            <tr><th>Bill Number</th><th>Date</th><th>Note</th><th>Amount</th></tr>
          </thead>
          <tbody>${soldItemsRows.join("")}</tbody>
        </table>
      </div>` : ""}
      
      ${returnItemsRows.length > 0 ? `
      <div class="section">
        <div class="section-title">🔄 RETURNS</div>
        <table>
          <thead>
            <tr><th>Return Number</th><th>Date</th><th>Note</th><th>Amount</th></tr>
          </thead>
          <tbody>${returnItemsRows.join("")}</tbody>
        </table>
      </div>` : ""}
      
      ${payment.notes ? `
      <div class="notes-box">
        <strong>📝 Payment Notes:</strong><br/>${payment.notes}
      </div>` : ""}
      
      <div class="footer">
        <p>Generated on ${formatDateToDMY(new Date())}</p>
      </div>
    </div>
  </body>
</html>`;
  };

  const loadPaymentDetails = async (paymentId) => {
    try {
      const payment = paymentHistory.find((p) => p.id === paymentId);
      if (!payment) return;

      const allSoldBills = await getSoldBills();
      const allReturns = await getPharmacyReturns(payment.pharmacyId, payment.selectedReturns || []);

      const soldDetails = allSoldBills
        .filter((bill) => payment.selectedSoldBills?.includes(bill.id))
        .map((bill) => ({
          ...bill,
          displayAmount: getDisplayAmount(bill.totalAmountUSD || 0, bill.totalAmountIQD || 0),
          billNote: bill.note || "",
        }));

      const returnDetails = allReturns
        .filter((ret) => payment.selectedReturns?.includes(ret.id))
        .map((ret) => ({
          ...ret,
          displayAmount: getDisplayAmount(ret.totalReturnUSD || 0, ret.totalReturnIQD || 0),
        }));

      setPaymentDetails((prev) => ({
        ...prev,
        [paymentId]: { soldBills: soldDetails, returns: returnDetails },
      }));
    } catch (err) {
      console.error("Error loading payment details:", err);
    }
  };

  const resetAdvancedSearch = () =>
    setAdvancedSearch({ pharmacyName: "", hardcopyBillNumber: "", soldBillNumber: "", returnBillNumber: "", paymentNumber: "", dateFrom: "", dateTo: "", amountMinUSD: "", amountMaxUSD: "", amountMinIQD: "", amountMaxIQD: "" });

  const filteredPayments = paymentHistory.filter((payment) => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const basicMatch =
        payment.paymentNumber?.toLowerCase().includes(s) ||
        payment.pharmacyName?.toLowerCase().includes(s) ||
        getFirstName(payment.createdByName).toLowerCase().includes(s) ||
        payment.hardcopyBillNumber?.toLowerCase().includes(s) ||
        payment.notes?.toLowerCase().includes(s) ||
        String(payment.netAmountUSD || "").includes(s) ||
        String(payment.netAmountIQD || "").includes(s);
      if (!basicMatch) return false;
    }
    if (!showAdvancedSearch) return true;
    if (advancedSearch.pharmacyName && !payment.pharmacyName?.toLowerCase().includes(advancedSearch.pharmacyName.toLowerCase())) return false;
    if (advancedSearch.hardcopyBillNumber && !payment.hardcopyBillNumber?.toLowerCase().includes(advancedSearch.hardcopyBillNumber.toLowerCase())) return false;
    if (advancedSearch.paymentNumber && !payment.paymentNumber?.toLowerCase().includes(advancedSearch.paymentNumber.toLowerCase())) return false;
    if (advancedSearch.soldBillNumber) {
      const searchBill = advancedSearch.soldBillNumber.toLowerCase();
      if (!payment.selectedSoldBills?.some((billId) => billId.toLowerCase().includes(searchBill))) return false;
    }
    if (advancedSearch.returnBillNumber) {
      const searchRet = advancedSearch.returnBillNumber.toLowerCase();
      if (!payment.selectedReturns?.some((retId) => retId.toLowerCase().includes(searchRet))) return false;
    }
    if (advancedSearch.dateFrom || advancedSearch.dateTo) {
      let paymentDateObj;
      if (payment.paymentDate?.toDate) paymentDateObj = payment.paymentDate.toDate();
      else if (payment.paymentDate instanceof Date) paymentDateObj = payment.paymentDate;
      else paymentDateObj = new Date(payment.paymentDate);
      if (advancedSearch.dateFrom) {
        const fromDate = new Date(advancedSearch.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (paymentDateObj < fromDate) return false;
      }
      if (advancedSearch.dateTo) {
        const toDate = new Date(advancedSearch.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (paymentDateObj > toDate) return false;
      }
    }
    if (advancedSearch.amountMinUSD !== "" && !isNaN(advancedSearch.amountMinUSD) && (payment.netAmountUSD || 0) < Number(advancedSearch.amountMinUSD)) return false;
    if (advancedSearch.amountMaxUSD !== "" && !isNaN(advancedSearch.amountMaxUSD) && (payment.netAmountUSD || 0) > Number(advancedSearch.amountMaxUSD)) return false;
    if (advancedSearch.amountMinIQD !== "" && !isNaN(advancedSearch.amountMinIQD) && (payment.netAmountIQD || 0) < Number(advancedSearch.amountMinIQD)) return false;
    if (advancedSearch.amountMaxIQD !== "" && !isNaN(advancedSearch.amountMaxIQD) && (payment.netAmountIQD || 0) > Number(advancedSearch.amountMaxIQD)) return false;
    return true;
  });

  const formatPaymentNumber = (payment) => {
    if (!payment.paymentNumber) return generatePaymentNumber(payment.id);
    return payment.paymentNumber;
  };

  const inputStyle = {
    width: "100%",
    padding: "0.75rem",
    border: "1px solid #D1D5DB",
    borderRadius: "0.75rem",
    fontSize: "0.875rem",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
  const labelStyle = { display: "block", fontSize: "0.8rem", fontWeight: "600", marginBottom: "0.4rem", color: colorScheme.text };

  const getPaymentImage = (payment) => payment.billImageBase64 || payment.billImageUrl || null;

  if (!user || isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "3rem", height: "3rem", border: "3px solid #F3F4F6", borderTop: "3px solid #3B82F6", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }}></div>
          <p style={{ marginTop: "1rem", color: "#6B7280" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", padding: "1rem", background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)", fontFamily: "var(--font-nrt-reg)", boxSizing: "border-box", overflowX: "hidden" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
        @keyframes shake { 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-6px);} 40%,80%{transform:translateX(6px);} }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
        .hardcopy-error-shake { animation: shake 0.4s ease; }
        input:focus, textarea:focus, select:focus { outline: 2px solid #3B82F6; outline-offset: 1px; }
        .adv-input { width:100%; padding:0.6rem 0.75rem; border:1px solid #D1D5DB; border-radius:0.6rem; font-size:0.8rem; font-family:inherit; box-sizing:border-box; }
        .adv-input:focus { outline:2px solid #3B82F6; }
        .grid-3col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        .grid-2col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.25rem; }
        @media (max-width: 900px) {
          .grid-3col { grid-template-columns: 1fr 1fr; }
          .grid-2col { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .grid-3col { grid-template-columns: 1fr; }
          .grid-cards { grid-template-columns: 1fr; }
          .summary-row { flex-direction: column !important; }
          .summary-operator { display: none !important; }
          .info-modal-grid { grid-template-columns: 1fr !important; }
          .adv-grid-3 { grid-template-columns: 1fr !important; }
          .adv-grid-2 { grid-template-columns: 1fr !important; }
        }
        .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .img-btn-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        @media (max-width: 480px) {
          .img-btn-row { flex-direction: column; }
        }
        .bill-item {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .bill-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .bill-actions {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .bill-actions button {
          padding: 0.25rem 0.6rem;
          border: none;
          border-radius: 0.4rem;
          cursor: pointer;
          font-size: 0.7rem;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        .bill-actions button:active {
          transform: scale(0.95);
        }
        .detail-item {
          border-bottom: 1px solid #f3f4f6;
          padding: 0.5rem 0;
        }
        .detail-item:last-child {
          border-bottom: none;
        }
      `}</style>

      {/* Header */}
      {/* <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: "bold", background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "0.25rem", fontFamily: "var(--font-nrt-bd)" }}>
          {isEditMode ? "✏️ Update Sold Payment" : "💰 Sold Payment Management"}
        </h1>
      </div> */}

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#FEF2F2", border: `1px solid ${colorScheme.danger}`, borderRadius: "0.75rem", marginBottom: "1rem" }}>
          <p style={{ color: colorScheme.danger, margin: 0 }}>❌ {error}</p>
        </div>
      )}
      {success && (
        <div style={{ padding: "1rem", backgroundColor: "#F0FDF4", border: `1px solid ${colorScheme.success}`, borderRadius: "0.75rem", marginBottom: "1rem" }}>
          <p style={{ color: colorScheme.success, margin: 0 }}>✅ {success}</p>
        </div>
      )}

      {/* Main Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>

        {/* Pharmacy Information */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "700", marginBottom: "1.25rem", paddingBottom: "0.6rem", borderBottom: "2px solid #3B82F6", color: colorScheme.text }}>
            🏪 Pharmacy Information
          </h2>
          <div className="grid-3col">
            <div style={{ position: "relative" }} ref={pharmacyDropdownRef}>
              <label style={labelStyle}>Select Pharmacy *</label>
              <input ref={pharmacyInputRef} type="text" value={pharmacySearchTerm} onChange={handlePharmacyInputChange} onFocus={() => setShowPharmacyDropdown(true)}
                placeholder="Type to search pharmacy..." style={inputStyle} />
              {showPharmacyDropdown && filteredPharmacies.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: "200px", overflowY: "auto", backgroundColor: "white", border: "1px solid #D1D5DB", borderRadius: "0.75rem", marginTop: "0.25rem", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                  {filteredPharmacies.map((pharmacy) => (
                    <div key={pharmacy.id} onClick={() => handleSelectPharmacy(pharmacy)}
                      style={{ padding: "0.75rem", cursor: "pointer", borderBottom: "1px solid #E5E7EB", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#EFF6FF"}
                      onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <div style={{ fontWeight: "600", fontSize: "0.875rem" }}>{pharmacy.name}</div>
                      {pharmacy.code && <div style={{ fontSize: "0.75rem", color: colorScheme.textLight }}>Code: {pharmacy.code}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Hardcopy Bill Number *</label>
              <input ref={hardcopyBillNumberRef} type="text" value={hardcopyBillNumber}
                onChange={(e) => { setHardcopyBillNumber(e.target.value); if (e.target.value.trim()) setHardcopyBillError(false); }}
                className={hardcopyBillError ? "hardcopy-error-shake" : ""}
                style={{ ...inputStyle, border: hardcopyBillError ? "2px solid #EF4444" : "1px solid #D1D5DB", boxShadow: hardcopyBillError ? "0 0 0 3px rgba(239,68,68,0.15)" : undefined }}
                placeholder="Enter hardcopy bill number" />
              {hardcopyBillError && (
                <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.75rem", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#DC2626", fontWeight: "600" }}>
                  ⚠️ Hardcopy Bill Number is required.
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Bill Image Section */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "700", marginBottom: "1.25rem", paddingBottom: "0.6rem", borderBottom: "2px solid #3B82F6", color: colorScheme.text }}>
            📷 Bill Image
          </h2>

          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />
          <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleCameraChange} style={{ display: "none" }} />

          <div style={{ display: "grid", gridTemplateColumns: billImageData ? "1fr auto" : "1fr", gap: "1.5rem", alignItems: "start" }}>
            <div>
              <label style={labelStyle}>Upload Bill Image (Optional — auto-converted to grayscale)</label>

              <div className="img-btn-row">
                <button type="button" onClick={triggerFileInput} disabled={imageProcessing}
                  style={{ flex: 1, padding: "0.75rem", backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB", borderRadius: "0.75rem", fontSize: "0.875rem", fontWeight: "500", cursor: imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s", textAlign: "center" }}
                  onMouseEnter={e => { if (!imageProcessing) e.currentTarget.style.background = "#E5E7EB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#F3F4F6"; }}>
                  {imageProcessing ? "⏳ Processing..." : "🖼️ Choose from Gallery"}
                </button>
                <button type="button" onClick={triggerCameraInput} disabled={imageProcessing}
                  style={{ flex: 1, padding: "0.75rem", backgroundColor: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE", borderRadius: "0.75rem", fontSize: "0.875rem", fontWeight: "500", cursor: imageProcessing ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s", textAlign: "center" }}
                  onMouseEnter={e => { if (!imageProcessing) e.currentTarget.style.background = "#DBEAFE"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#EFF6FF"; }}>
                  📸 Take Photo
                </button>
              </div>

              {imageProcessing && (
                <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.75rem", backgroundColor: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: "0.5rem", fontSize: "0.8rem", color: "#1E40AF", fontWeight: "600", animation: "pulse 1.5s infinite" }}>
                  ⚙️ Converting to grayscale...
                </div>
              )}

              {billImageData && !imageProcessing && (
                <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.75rem", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#166534", fontWeight: "600" }}>
                  ✅ Image ready — will be saved with payment
                </div>
              )}

              {!billImageData && !imageProcessing && isEditMode && (
                <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.75rem", backgroundColor: imageHasChanged ? "#FEF3C7" : "#F3F4F6", border: `1px solid ${imageHasChanged ? "#FDE68A" : "#E5E7EB"}`, borderRadius: "0.5rem", fontSize: "0.78rem", color: imageHasChanged ? "#92400E" : colorScheme.textLight, fontWeight: "600" }}>
                  {imageHasChanged ? "ℹ️ Image removed — will be cleared on save" : "ℹ️ Keeping original image (upload new to replace)"}
                </div>
              )}
            </div>

            {billImageData && !imageProcessing && (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "0.7rem", color: colorScheme.textLight, marginBottom: "0.4rem" }}>Preview</p>
                <img src={billImageData} alt="Bill Preview"
                  style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "0.5rem", border: "1px solid #E5E7EB", cursor: "pointer", filter: "grayscale(100%)" }}
                  onClick={() => handleViewImage(billImageData)} />
                <button type="button" onClick={removeImage}
                  style={{ display: "block", margin: "0.4rem auto 0", fontSize: "0.7rem", color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  ✕ Remove image
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bills & Returns Sections */}
        <div className="grid-2col">
          {/* Sold Bills */}
          <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "white", margin: 0 }}>💰 Sold Bills ({soldBills.length})</h2>
                {!isEditMode && soldBills.length > 0 && (
                  <button onClick={selectAllSoldBills} style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", padding: "0.4rem 0.9rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" }}>
                    {selectedSoldBills.length === soldBills.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {selectedSoldBills.length > 0 && <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#BFDBFE" }}>{selectedSoldBills.length} selected</div>}
            </div>
            <div style={{ padding: "1rem" }}>
              {soldBills.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <input
                    type="text"
                    placeholder="🔍 Search by bill # or item name..."
                    value={billSearchTerm}
                    onChange={(e) => setBillSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.6rem",
                      fontSize: "0.8rem",
                      fontFamily: "inherit",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              )}
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {loading ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: colorScheme.textLight }}>Loading...</div>
                ) : soldBills.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>{selectedPharmacy ? "No unpaid bills available" : "Select a pharmacy first"}</div>
                ) : getFilteredBills().length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>No bills match your search</div>
                ) : (
                  getFilteredBills().map((bill) => {
                    const isSelected = selectedSoldBills.includes(bill.id);
                    const billNote = bill.billNote || bill.note || "";
                    const displayAmount = getDisplayAmount(bill.totalAmountUSD || 0, bill.totalAmountIQD || 0);
                    return (
                      <div key={bill.id} className="bill-item"
                        onClick={() => toggleSoldBill(bill.id)}
                        style={{ 
                          padding: "0.85rem", 
                          marginBottom: "0.6rem", 
                          border: isSelected ? "2px solid #3B82F6" : "1px solid #E5E7EB", 
                          backgroundColor: isSelected ? "#EFF6FF" : "white", 
                          borderRadius: "0.75rem" 
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: "bold", fontSize: "0.875rem" }}>Bill #{bill.billNumber}</div>
                            <div style={{ fontSize: "0.75rem", color: colorScheme.textLight, marginTop: "0.2rem" }}>
                              {formatDateToDMY(bill.date)}
                              {bill.items?.length > 0 && <span style={{ marginLeft: "0.5rem" }}>• {bill.items.length} item{bill.items.length !== 1 ? "s" : ""}</span>}
                            </div>
                            {billNote && <div style={{ fontSize: "0.7rem", color: "#6B7280", marginTop: "0.25rem", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {billNote}</div>}
                          </div>
                          <div style={{ textAlign: "right", marginLeft: "0.5rem", flexShrink: 0 }}>
                            <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#059669" }}>+{displayAmount}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.4rem", flexWrap: "wrap", gap: "0.3rem" }}>
                          <div className="bill-actions">
                            <button onClick={(e) => { e.stopPropagation(); viewBillDetails(bill.id); }}
                              style={{ backgroundColor: "#6B7280", color: "white" }}>
                              👁️ View
                            </button>
                          </div>
                          <div style={{ fontSize: "0.7rem", color: isSelected ? "#3B82F6" : "#10B981", fontWeight: "600" }}>
                            {isSelected ? "✓ Selected" : "● Unpaid"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Returns */}
          <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: "bold", color: "white", margin: 0 }}>🔄 Returns ({returns.length})</h2>
                {!isEditMode && returns.length > 0 && (
                  <button onClick={selectAllSoldReturns} style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white", padding: "0.4rem 0.9rem", borderRadius: "0.6rem", border: "none", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" }}>
                    {selectedSoldReturns.length === returns.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {selectedSoldReturns.length > 0 && <div style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#FDE68A" }}>{selectedSoldReturns.length} selected</div>}
            </div>
            <div style={{ padding: "1rem" }}>
              {returns.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <input
                    type="text"
                    placeholder="🔍 Search by return # or item name..."
                    value={returnSearchTerm}
                    onChange={(e) => setReturnSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.6rem",
                      fontSize: "0.8rem",
                      fontFamily: "inherit",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              )}
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {loading ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: colorScheme.textLight }}>Loading...</div>
                ) : returns.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>{selectedPharmacy ? "No unprocessed returns available" : "Select a pharmacy first"}</div>
                ) : getFilteredReturns().length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>No returns match your search</div>
                ) : (
                  getFilteredReturns().map((returnBill) => {
                    const isSelected = selectedSoldReturns.includes(returnBill.id);
                    const retNote = returnBill.returnNote || returnBill.note || "";
                    const returnUSD = Number(returnBill.totalReturnUSD) || 0;
                    const returnIQD = Number(returnBill.totalReturnIQD) || 0;
                    const displayAmount = getDisplayAmount(returnUSD, returnIQD);
                    const returnNumberDisplay = returnBill.returnBillNumber || returnBill.pharmacyReturnBillNumber || `RET-${returnBill.id?.slice(-6)}`;
                    return (
                      <div key={returnBill.id} className="bill-item"
                        onClick={() => toggleSoldReturn(returnBill.id)}
                        style={{ 
                          padding: "0.85rem", 
                          marginBottom: "0.6rem", 
                          border: isSelected ? "2px solid #F59E0B" : "1px solid #E5E7EB", 
                          backgroundColor: isSelected ? "#FFFBEB" : "white", 
                          borderRadius: "0.75rem" 
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: "bold", fontSize: "0.875rem" }}>Return #{returnNumberDisplay}</div>
                            <div style={{ fontSize: "0.75rem", color: colorScheme.textLight, marginTop: "0.2rem" }}>
                              {formatDateToDMY(returnBill.returnDate || returnBill.date)}
                              {returnBill.items?.length > 0 && <span style={{ marginLeft: "0.5rem" }}>• {returnBill.items.length} item{returnBill.items.length !== 1 ? "s" : ""}</span>}
                            </div>
                            {retNote && <div style={{ fontSize: "0.7rem", color: "#6B7280", marginTop: "0.25rem", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {retNote}</div>}
                          </div>
                          <div style={{ textAlign: "right", marginLeft: "0.5rem", flexShrink: 0 }}>
                            <div style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#dc2626" }}>-{displayAmount}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.4rem", flexWrap: "wrap", gap: "0.3rem" }}>
                          <div className="bill-actions">
                            <button onClick={(e) => { e.stopPropagation(); viewReturnDetails(returnBill.id); }}
                              style={{ backgroundColor: "#6B7280", color: "white" }}>
                              👁️ View
                            </button>
                          </div>
                          <div style={{ fontSize: "0.7rem", color: isSelected ? "#F59E0B" : "#EF4444", fontWeight: "600" }}>
                            {isSelected ? "✓ Selected" : "● Unprocessed"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "2px solid #3B82F6", color: colorScheme.text }}>💰 Payment Summary</h2>
          <div className="summary-row" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "stretch" }}>
            <div style={{ flex: "1 1 0", minWidth: "120px", padding: "0.85rem 1rem", backgroundColor: "#F0FDF9", borderRadius: "0.75rem", border: "1px solid #A7F3D0" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: "700", color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>💰 Total Sold</div>
              {currencyTotals.soldUSD > 0 && <div style={{ color: "#059669", fontWeight: "700", fontSize: "0.95rem" }}>+{formatUSD(currencyTotals.soldUSD)}</div>}
              {currencyTotals.soldIQD > 0 && <div style={{ color: "#3B82F6", fontWeight: "700", fontSize: "0.95rem" }}>+{formatIQD(currencyTotals.soldIQD)}</div>}
              {currencyTotals.soldUSD === 0 && currencyTotals.soldIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>—</div>}
            </div>
            <div className="summary-operator" style={{ display: "flex", alignItems: "center", fontSize: "1.25rem", color: colorScheme.textLight, flexShrink: 0 }}>−</div>
            <div style={{ flex: "1 1 0", minWidth: "120px", padding: "0.85rem 1rem", backgroundColor: "#FEF2F2", borderRadius: "0.75rem", border: "1px solid #FECACA" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: "700", color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>🔄 Total Return</div>
              {currencyTotals.returnUSD > 0 && <div style={{ color: "#dc2626", fontWeight: "700", fontSize: "0.95rem" }}>−{formatUSD(currencyTotals.returnUSD)}</div>}
              {currencyTotals.returnIQD > 0 && <div style={{ color: "#b91c1c", fontWeight: "700", fontSize: "0.95rem" }}>−{formatIQD(currencyTotals.returnIQD)}</div>}
              {currencyTotals.returnUSD === 0 && currencyTotals.returnIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>—</div>}
            </div>
            <div className="summary-operator" style={{ display: "flex", alignItems: "center", fontSize: "1.25rem", color: colorScheme.textLight, flexShrink: 0 }}>=</div>
            <div style={{ flex: "1 1 0", minWidth: "120px", padding: "0.85rem 1rem", background: "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)", borderRadius: "0.75rem", border: "1px solid #93C5FD" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: "700", color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>💰 Net Amount</div>
              {currencyTotals.netUSD !== 0 && <div style={{ fontWeight: "800", fontSize: "1rem", color: currencyTotals.netUSD > 0 ? "#059669" : "#dc2626" }}>{currencyTotals.netUSD > 0 ? "+" : ""}{formatUSD(currencyTotals.netUSD)}</div>}
              {currencyTotals.netIQD !== 0 && <div style={{ fontWeight: "800", fontSize: "1rem", color: currencyTotals.netIQD > 0 ? "#3B82F6" : "#b91c1c" }}>{currencyTotals.netIQD > 0 ? "+" : ""}{formatIQD(currencyTotals.netIQD)}</div>}
              {currencyTotals.netUSD === 0 && currencyTotals.netIQD === 0 && <div style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>—</div>}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid #93C5FD", color: colorScheme.text }}>📝 Payment Notes</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }} placeholder="Add notes about this payment..." />
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {isEditMode && (
            <button onClick={handleCancelEdit} disabled={submitting}
              style={{ flex: "1 1 120px", padding: "0.9rem", backgroundColor: colorScheme.textLight, color: "white", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem", fontWeight: "600" }}>
              Cancel
            </button>
          )}
          <button onClick={handleSubmit} disabled={submitting || imageProcessing}
            style={{ flex: "2 1 200px", padding: "0.9rem", background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)", color: "white", border: "none", borderRadius: "0.75rem", cursor: submitting || imageProcessing ? "not-allowed" : "pointer", opacity: submitting || imageProcessing ? 0.8 : 1, fontFamily: "inherit", fontSize: "0.95rem", fontWeight: "700" }}>
            {imageProcessing ? "⚙️ Processing image..." : submitting ? "⏳ Saving..." : isEditMode ? (imageHasChanged ? "✏️ Update Payment (Image Changed)" : "✏️ Update Payment") : "✅ Create Payment"}
          </button>
        </div>
      </div>

      {/* Payment History */}
      <div style={{ backgroundColor: colorScheme.card, borderRadius: "1rem", border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "white", margin: 0 }}>📋 Sold Payment History</h2>
          {paymentHistory.length > 0 && <div style={{ fontSize: "0.8rem", color: "#BFDBFE", marginTop: "0.25rem" }}>{filteredPayments.length} of {paymentHistory.length} payments</div>}
        </div>

        <div style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <input type="text" placeholder="🔍 Quick search: pharmacy, payment #, hardcopy, notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: "1 1 200px", padding: "0.75rem 1rem", border: "1px solid #D1D5DB", borderRadius: "0.75rem", fontSize: "0.875rem", fontFamily: "inherit", boxSizing: "border-box" }} />
            <button onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              style={{ padding: "0.75rem 1.25rem", backgroundColor: showAdvancedSearch ? "#3B82F6" : colorScheme.textLight, color: "white", border: "none", borderRadius: "0.75rem", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: "600", whiteSpace: "nowrap" }}>
              {showAdvancedSearch ? "▲ Hide Advanced" : "▼ Advanced Search"}
            </button>
          </div>

          {showAdvancedSearch && (
            <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <span style={{ fontWeight: "700", fontSize: "0.9rem", color: colorScheme.text }}>🔍 Advanced Search Filters</span>
                <button onClick={resetAdvancedSearch} style={{ padding: "0.35rem 0.9rem", backgroundColor: "#E5E7EB", color: "#374151", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: "600" }}>✕ Clear All</button>
              </div>
              <div className="adv-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🏪 Pharmacy Name</label>
                  <input className="adv-input" type="text" placeholder="e.g. Aran Pharmacy" value={advancedSearch.pharmacyName} onChange={e => setAdvancedSearch(p => ({ ...p, pharmacyName: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🔖 Payment Number</label>
                  <input className="adv-input" type="text" placeholder="e.g. SPAY-2026-..." value={advancedSearch.paymentNumber} onChange={e => setAdvancedSearch(p => ({ ...p, paymentNumber: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📋 Hardcopy Bill Number</label>
                  <input className="adv-input" type="text" placeholder="Hardcopy bill #" value={advancedSearch.hardcopyBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, hardcopyBillNumber: e.target.value }))} />
                </div>
              </div>
              <div className="adv-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>💰 Sold Bill Number (ID)</label>
                  <input className="adv-input" type="text" placeholder="Bill ID fragment" value={advancedSearch.soldBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, soldBillNumber: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🔄 Return Bill Number (ID)</label>
                  <input className="adv-input" type="text" placeholder="Return ID fragment" value={advancedSearch.returnBillNumber} onChange={e => setAdvancedSearch(p => ({ ...p, returnBillNumber: e.target.value }))} />
                </div>
              </div>
              <div className="adv-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📅 Payment Date — From</label>
                  <input className="adv-input" type="date" value={advancedSearch.dateFrom} onChange={e => setAdvancedSearch(p => ({ ...p, dateFrom: e.target.value }))} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: "0.72rem" }}>📅 Payment Date — To</label>
                  <input className="adv-input" type="date" value={advancedSearch.dateTo} onChange={e => setAdvancedSearch(p => ({ ...p, dateTo: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ ...labelStyle, fontSize: "0.72rem" }}>💵 Net Amount USD — Range</label>
                <div className="adv-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#059669", fontWeight: "700", fontSize: "0.85rem" }}>$</span>
                    <input className="adv-input" type="number" placeholder="Min USD" style={{ paddingLeft: "1.5rem" }} value={advancedSearch.amountMinUSD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMinUSD: e.target.value }))} />
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#059669", fontWeight: "700", fontSize: "0.85rem" }}>$</span>
                    <input className="adv-input" type="number" placeholder="Max USD" style={{ paddingLeft: "1.5rem" }} value={advancedSearch.amountMaxUSD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMaxUSD: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: "0.72rem" }}>🇮🇶 Net Amount IQD — Range</label>
                <div className="adv-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#3B82F6", fontWeight: "600", fontSize: "0.7rem" }}>IQD</span>
                    <input className="adv-input" type="number" placeholder="Min IQD" style={{ paddingRight: "3rem" }} value={advancedSearch.amountMinIQD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMinIQD: e.target.value }))} />
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#3B82F6", fontWeight: "600", fontSize: "0.7rem" }}>IQD</span>
                    <input className="adv-input" type="number" placeholder="Max IQD" style={{ paddingRight: "3rem" }} value={advancedSearch.amountMaxIQD} onChange={e => setAdvancedSearch(p => ({ ...p, amountMaxIQD: e.target.value }))} />
                  </div>
                </div>
              </div>
              {Object.values(advancedSearch).some(v => v !== "") && (
                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", backgroundColor: "#DBEAFE", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#1E40AF", fontWeight: "600" }}>
                  ✓ {Object.values(advancedSearch).filter(v => v !== "").length} filter{Object.values(advancedSearch).filter(v => v !== "").length !== 1 ? "s" : ""} active — {filteredPayments.length} result{filteredPayments.length !== 1 ? "s" : ""} found
                </div>
              )}
            </div>
          )}

          {historyLoading ? (
            <div style={{ textAlign: "center", padding: "4rem", color: colorScheme.textLight }}>Loading payment history...</div>
          ) : filteredPayments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem", color: colorScheme.textLight }}>{paymentHistory.length === 0 ? "No payments yet" : "No payments match your search"}</div>
          ) : (
            <div className="grid-cards">
              {filteredPayments.map((payment) => {
                const displayNumber = formatPaymentNumber(payment);
                const paymentImage = getPaymentImage(payment);
                const netDisplayAmount = getDisplayAmount(payment.netAmountUSD || 0, payment.netAmountIQD || 0);
                return (
                  <div key={payment.id} style={{ border: "1px solid #E5E7EB", borderRadius: "1rem", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)", padding: "0.9rem 1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: "bold", color: "white", fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayNumber}</div>
                          <div style={{ fontSize: "0.78rem", color: "#BFDBFE", marginTop: "0.1rem" }}>{payment.pharmacyName}</div>
                          <div style={{ fontSize: "0.72rem", color: "#93C5FD", marginTop: "0.1rem" }}>{formatDateToDMY(payment.paymentDate)}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "0.5rem" }}>
                          <div style={{ fontWeight: "bold", color: "white", fontSize: "0.85rem" }}>{netDisplayAmount}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "0.9rem 1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", fontSize: "0.8rem", color: colorScheme.textLight, flexWrap: "wrap", gap: "0.25rem" }}>
                        <span>💰 Bills: <strong>{payment.selectedSoldBills?.length || 0}</strong></span>
                        <span>🔄 Returns: <strong>{payment.selectedReturns?.length || 0}</strong></span>
                        <span>👤 <strong>{getFirstName(payment.createdByName)}</strong></span>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <button onClick={() => handleViewPayment(payment)}
                          style={{ flex: "1 1 40px", padding: "0.45rem 0.3rem", backgroundColor: "#6B7280", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.75rem", fontFamily: "inherit" }}>
                          👁️ View
                        </button>
                        <button onClick={() => handlePrintPayment(payment)}
                          style={{ flex: "1 1 40px", padding: "0.45rem 0.3rem", backgroundColor: "#F59E0B", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.75rem", fontFamily: "inherit" }}>
                          🖨️ Print
                        </button>
                        {paymentImage ? (
                          <button onClick={() => handleViewImage(paymentImage)}
                            style={{ flex: "1 1 40px", padding: "0.45rem 0.3rem", backgroundColor: "#10B981", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.75rem", fontFamily: "inherit" }}>
                            🖼️ Image
                          </button>
                        ) : (
                          <button disabled style={{ flex: "1 1 40px", padding: "0.45rem 0.3rem", backgroundColor: "#E5E7EB", color: "#9CA3AF", border: "none", borderRadius: "0.5rem", cursor: "not-allowed", fontWeight: "600", fontSize: "0.75rem" }}>🖼️ —</button>
                        )}
                        <button onClick={() => handleUpdatePayment(payment)}
                          style={{ flex: "1 1 40px", padding: "0.45rem 0.3rem", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: "600", fontSize: "0.75rem", fontFamily: "inherit" }}>
                          ✏️ Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Payment Details Modal */}
      {showPaymentModal && selectedPayment && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: "750px", maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: "1rem", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)", padding: "1.25rem 1.5rem", borderRadius: "1rem 1rem 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ color: "white", margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>Payment Details</h2>
                <div style={{ color: "#BFDBFE", fontSize: "0.8rem", marginTop: "0.2rem" }}>{formatPaymentNumber(selectedPayment)}</div>
              </div>
              <button onClick={closePaymentModal} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", fontSize: "1.25rem", cursor: "pointer", borderRadius: "0.5rem", padding: "0.25rem 0.6rem", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <div className="info-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem", padding: "1rem", background: "#F8FAFC", borderRadius: "0.75rem" }}>
                <div><div style={{ fontSize: "0.7rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", marginBottom: "0.2rem" }}>Pharmacy</div><div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{selectedPayment.pharmacyName}</div></div>
                <div><div style={{ fontSize: "0.7rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", marginBottom: "0.2rem" }}>Hardcopy Bill</div><div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{selectedPayment.hardcopyBillNumber}</div></div>
                <div><div style={{ fontSize: "0.7rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", marginBottom: "0.2rem" }}>Payment Date</div><div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{formatDateToDMY(selectedPayment.paymentDate)}</div></div>
                <div><div style={{ fontSize: "0.7rem", fontWeight: "700", color: colorScheme.textLight, textTransform: "uppercase", marginBottom: "0.2rem" }}>Created By</div><div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{getFirstName(selectedPayment.createdByName)}</div></div>
              </div>

              {/* Sold Bills Table */}
              {paymentDetails[selectedPayment.id]?.soldBills?.length > 0 ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.75rem", color: colorScheme.text }}>💰 Sold Bills ({paymentDetails[selectedPayment.id].soldBills.length})</h3>
                  <div className="table-scroll">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Bill #</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Date</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Note</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentDetails[selectedPayment.id].soldBills.map((bill) => (
                          <tr key={bill.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                            <td style={{ padding: "8px 10px", fontWeight: "600" }}>#{bill.billNumber || bill.id}</td>
                            <td style={{ padding: "8px 10px", color: colorScheme.textLight }}>{formatDateToDMY(bill.date)}</td>
                            <td style={{ padding: "8px 10px", color: colorScheme.textLight, fontStyle: "italic", fontSize: "0.78rem" }}>{bill.billNote || "—"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: "700", color: "#059669" }}>
                              +{getDisplayAmount(bill.totalAmountUSD || 0, bill.totalAmountIQD || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: "1.25rem", padding: "0.75rem", background: "#F9FAFB", borderRadius: "0.5rem", fontSize: "0.82rem", color: colorScheme.textLight, textAlign: "center" }}>
                  {paymentDetails[selectedPayment.id] ? "No sold bills in this payment" : "Loading sold bills..."}
                </div>
              )}

              {/* Returns Table */}
              {paymentDetails[selectedPayment.id]?.returns?.length > 0 ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "0.75rem", color: colorScheme.text }}>🔄 Returns ({paymentDetails[selectedPayment.id].returns.length})</h3>
                  <div className="table-scroll">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ background: "#F3F4F6" }}>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Return #</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Date</th>
                          <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Note</th>
                          <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: colorScheme.textLight, fontSize: "0.72rem", textTransform: "uppercase" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentDetails[selectedPayment.id].returns.map((ret) => (
                          <tr key={ret.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                            <td style={{ padding: "10px 12px", fontWeight: "600" }}>{ret.returnBillNumber || ret.id}</td>
                            <td style={{ padding: "10px 12px", color: colorScheme.textLight }}>{formatDateToDMY(ret.returnDate)}</td>
                            <td style={{ padding: "10px 12px", color: colorScheme.textLight, fontStyle: "italic", fontSize: "0.78rem" }}>{ret.returnNote || "—"}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: "#dc2626" }}>
                              -{getDisplayAmount(ret.totalReturnUSD || 0, ret.totalReturnIQD || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* Net Amount */}
              <div style={{ padding: "1rem", background: "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)", borderRadius: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ fontWeight: "700", marginBottom: "0.5rem", fontSize: "0.85rem", color: "#1E40AF" }}>💰 Net Amount Paid</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: selectedPayment.netAmountIQD < 0 ? "#dc2626" : "#059669" }}>
                  {(() => {
                    const netUSD = selectedPayment.netAmountUSD || 0;
                    const netIQD = selectedPayment.netAmountIQD || 0;
                    if (netIQD !== 0) {
                      return netIQD < 0 ? formatIQD(netIQD) : `+${formatIQD(netIQD)}`;
                    }
                    if (netUSD !== 0) {
                      return netUSD < 0 ? formatUSD(netUSD) : `+${formatUSD(netUSD)}`;
                    }
                    return "0 IQD";
                  })()}
                </div>
              </div>

              {selectedPayment.notes && (
                <div style={{ marginBottom: "1rem", padding: "0.85rem", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "0.75rem", fontSize: "0.85rem" }}>
                  <strong>📝 Notes:</strong>
                  <p style={{ margin: "0.3rem 0 0", color: colorScheme.textLight }}>{selectedPayment.notes}</p>
                </div>
              )}

              {getPaymentImage(selectedPayment) && (
                <div style={{ textAlign: "center" }}>
                  <img src={getPaymentImage(selectedPayment)} alt="Bill"
                    style={{ maxWidth: "250px", maxHeight: "250px", borderRadius: "0.5rem", cursor: "pointer", border: "1px solid #E5E7EB", filter: "grayscale(100%)" }}
                    onClick={() => handleViewImage(getPaymentImage(selectedPayment))} />
                  <div style={{ fontSize: "0.72rem", color: colorScheme.textLight, marginTop: "0.3rem" }}>Click image to enlarge</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal for viewing bill/return items */}
      {showDetailModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500, padding: "1rem", overflowY: "auto" }}
          onClick={closeDetailModal}>
          <div style={{ width: "100%", maxWidth: "650px", maxHeight: "85vh", overflowY: "auto", background: "white", borderRadius: "1rem", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", padding: "1.5rem" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "2px solid #E5E7EB" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: colorScheme.text, margin: 0 }}>
                {detailType === "bill" ? "💰 " : "🔄 "}{detailTitle}
              </h2>
              <button onClick={closeDetailModal} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: colorScheme.textLight }}>✕</button>
            </div>

            {detailLoading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>Loading details...</div>
            ) : detailItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: colorScheme.textLight }}>No items found</div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "#F3F4F6", borderRadius: "0.5rem", fontWeight: "700", fontSize: "0.8rem", color: colorScheme.textLight, marginBottom: "0.5rem" }}>
                  <span>Item</span>
                  <span style={{ textAlign: "right" }}>Qty</span>
                  <span style={{ textAlign: "right" }}>Price</span>
                  <span style={{ textAlign: "right" }}>Total</span>
                </div>
                {detailItems.map((item, index) => (
                  <div key={index} className="detail-item" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.5rem", padding: "0.6rem 0.75rem", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "0.85rem" }}>{item.name}</div>
                      <div style={{ fontSize: "0.7rem", color: colorScheme.textLight }}>{item.barcode}</div>
                    </div>
                    <div style={{ textAlign: "right", fontWeight: "600", fontSize: "0.85rem" }}>{item.quantity}</div>
                    <div style={{ textAlign: "right", fontSize: "0.85rem" }}>{item.displayPrice}</div>
                    <div style={{ textAlign: "right", fontWeight: "700", fontSize: "0.9rem", color: detailType === "bill" ? "#059669" : "#dc2626" }}>
                      {detailType === "bill" ? "+" : "-"}{item.displayTotal}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "1.25rem", paddingTop: "0.75rem", borderTop: "1px solid #E5E7EB", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={closeDetailModal} style={{ padding: "0.5rem 1.5rem", backgroundColor: "#6B7280", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "600" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedImageUrl && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}
          onClick={closeImageModal}>
          <div style={{ maxWidth: "90vw", maxHeight: "90vh", background: "white", borderRadius: "0.75rem", padding: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
            <img src={selectedImageUrl} alt="Full Bill" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", display: "block", filter: "grayscale(100%)" }} />
            <div style={{ textAlign: "center", marginTop: "0.6rem" }}>
              <button onClick={closeImageModal} style={{ padding: "0.5rem 1.5rem", backgroundColor: "#3B82F6", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "600" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}