"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  createBoughtPayment,
  getCompanies,
  getCompanyBoughtBills,
  getReturnsForCompany,
  getBoughtPaymentDetails,
  updateBoughtPayment,
  getBoughtPayments,
  getBoughtBills,
} from "@/lib/data";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function BoughtPaymentManagementPage() {
  const { user } = useAuth();
  const router = useRouter();

  // State declarations
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [boughtBills, setBoughtBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedBoughtBills, setSelectedBoughtBills] = useState([]);
  const [selectedBoughtReturns, setSelectedBoughtReturns] = useState([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [hardcopyBillNumber, setHardcopyBillNumber] = useState("");
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
  const [filterStatus, setFilterStatus] = useState("all");
  const [advancedSearch, setAdvancedSearch] = useState({
    companyName: "",
    hardcopyBillNumber: "",
    boughtBillNumber: "",
    returnedBillNumber: "",
    notes: "",
    dateFrom: "",
    dateTo: "",
    amountFrom: "",
    amountTo: "",
  });
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [amountRange, setAmountRange] = useState([0, 50000000]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [billImage, setBillImage] = useState(null);
  const [billImageUrl, setBillImageUrl] = useState("");
  const [billImagePreview, setBillImagePreview] = useState(null);

  // Refs for error focus
  const companySelectRef = useRef(null);
  const hardcopyBillNumberRef = useRef(null);

  // Color Scheme
  const colorScheme = {
    primary: "#8B5CF6",
    secondary: "#06B6D4",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#8B5CF6",
    dark: "#7C3AED",
    light: "#A78BFA",
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#1F2937",
    textLight: "#6B7280",
  };

  // Check authentication in useEffect
  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      setIsLoading(false);
    }
  }, [user, router]);

  // Format currency with commas and IQD
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return "0 IQD";
    return new Intl.NumberFormat("en-US").format(amount) + " IQD";
  };

  // Format date to dd/mm/yyyy
  const formatDateToDMY = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Parse date from dd/mm/yyyy to Date object
  const parseDMYToDate = (dateString) => {
    if (!dateString) return null;
    const [day, month, year] = dateString.split("/");
    return new Date(year, month - 1, day);
  };

  // Refresh payments after creation/update
  const refreshPayments = async () => {
    try {
      setHistoryLoading(true);
      const paymentsData = await getBoughtPayments();
      paymentsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });
      setPaymentHistory(paymentsData);
      if (paymentsData.length > 0) {
        const amounts = paymentsData.map((p) => p.netAmount || 0);
        const maxAmount = Math.max(...amounts);
        setAmountRange([0, Math.ceil(maxAmount / 1000000) * 1000000]);
      }
    } catch (error) {
      console.error("Error refreshing payments:", error);
      setError("Failed to refresh payment history");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load initial data after authentication
  useEffect(() => {
    if (!user) return;
    
    const loadInitialData = async () => {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get("edit");
        if (editId) {
          setIsEditMode(true);
          setEditPaymentId(editId);
        }
      }
      await loadPaymentHistory();
      await loadCompanies();
    };
    
    loadInitialData();
  }, [user]);

  const loadCompanies = async () => {
    try {
      const companiesData = await getCompanies();
      setCompanies(companiesData);
    } catch (error) {
      console.error("Error loading companies:", error);
      setError("Failed to load companies");
    }
  };

  const loadPaymentHistory = async () => {
    await refreshPayments();
  };

  useEffect(() => {
    const loadPaymentForEdit = async () => {
      if (!isEditMode || !editPaymentId) return;
      try {
        setLoading(true);
        setError(null);
        const paymentToEdit = await getBoughtPaymentDetails(editPaymentId);
        if (paymentToEdit) {
          setSelectedCompany(paymentToEdit.companyId);
          setHardcopyBillNumber(paymentToEdit.hardcopyBillNumber);
          setBillImageUrl(paymentToEdit.billImageUrl || "");
          setBillImagePreview(paymentToEdit.billImageUrl || null);
          let paymentDateValue;
          if (paymentToEdit.paymentDate) {
            if (paymentToEdit.paymentDate.toDate) {
              paymentDateValue = paymentToEdit.paymentDate.toDate();
            } else if (paymentToEdit.paymentDate instanceof Date) {
              paymentDateValue = paymentToEdit.paymentDate;
            } else {
              paymentDateValue = new Date(paymentToEdit.paymentDate);
            }
          } else {
            paymentDateValue = new Date();
          }
          setPaymentDate(paymentDateValue.toISOString().split("T")[0]);
          setNotes(paymentToEdit.notes || "");
          setSelectedBoughtBills(paymentToEdit.selectedBoughtBills || []);
          setSelectedBoughtReturns(paymentToEdit.selectedBoughtReturns || []);
        }
      } catch (error) {
        console.error("Error loading payment for edit:", error);
        setError("Failed to load payment for editing");
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    };
    loadPaymentForEdit();
  }, [isEditMode, editPaymentId]);

  useEffect(() => {
    if (!selectedCompany) {
      setBoughtBills([]);
      setReturns([]);
      if (!isEditMode) {
        setHardcopyBillNumber("");
        setBillImageUrl("");
        setBillImagePreview(null);
      }
      return;
    }
    const loadCompanyData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [allBoughtBills, allReturns] = await Promise.all([
          getCompanyBoughtBills(selectedCompany, isEditMode ? selectedBoughtBills : []),
          getReturnsForCompany(selectedCompany, isEditMode ? selectedBoughtReturns : []),
        ]);
        setBoughtBills(allBoughtBills);
        setReturns(allReturns);
      } catch (error) {
        console.error("Error loading company data:", error);
        setError("Failed to load company data");
      } finally {
        setLoading(false);
      }
    };
    loadCompanyData();
  }, [selectedCompany, isEditMode, initialLoadComplete]);

  const loadPaymentDetails = async (paymentId) => {
    try {
      const payment = paymentHistory.find((p) => p.id === paymentId);
      if (!payment) return;
      const boughtBills = await getBoughtBills();
      const returns = await getReturnsForCompany(payment.companyId);
      const boughtDetails = boughtBills.filter((bill) => payment.selectedBoughtBills?.includes(bill.id));
      const returnDetails = returns.filter((r) => payment.selectedBoughtReturns?.includes(r.id));
      setPaymentDetails((prev) => ({
        ...prev,
        [paymentId]: { boughtBills: boughtDetails, returns: returnDetails },
      }));
    } catch (error) {
      console.error("Error loading payment details:", error);
    }
  };

  const boughtTotal = selectedBoughtBills.reduce((total, billId) => {
    const bill = boughtBills.find((b) => b.id === billId);
    return total + (bill?.totalAmount || 0);
  }, 0);

  const returnTotal = selectedBoughtReturns.reduce((total, returnId) => {
    const returnBill = returns.find((r) => r.id === returnId);
    return total + (returnBill?.totalReturn || 0);
  }, 0);

  const totalAfterReturn = boughtTotal - returnTotal;

  const toggleBoughtBill = (billId) => {
    setSelectedBoughtBills((prev) => (prev.includes(billId) ? prev.filter((id) => id !== billId) : [...prev, billId]));
  };

  const toggleBoughtReturn = (returnId) => {
    setSelectedBoughtReturns((prev) => (prev.includes(returnId) ? prev.filter((id) => id !== returnId) : [...prev, returnId]));
  };

  const selectAllBoughtBills = () => {
    if (selectedBoughtBills.length === boughtBills.length) {
      setSelectedBoughtBills([]);
    } else {
      setSelectedBoughtBills(boughtBills.map((bill) => bill.id));
    }
  };

  const selectAllBoughtReturns = () => {
    if (selectedBoughtReturns.length === returns.length) {
      setSelectedBoughtReturns([]);
    } else {
      setSelectedBoughtReturns(returns.map((returnBill) => returnBill.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let hasError = false;
    if (!selectedCompany) {
      setError("Please select a company");
      companySelectRef.current?.focus();
      hasError = true;
    }
    if (!hardcopyBillNumber.trim()) {
      setError("Hardcopy Bill Number is required");
      hardcopyBillNumberRef.current?.focus();
      hasError = true;
    }
    if (selectedBoughtBills.length === 0 && selectedBoughtReturns.length === 0) {
      setError("Please select at least one bill or return to process");
      hasError = true;
    }
    if (hasError) return;

    try {
      setSubmitting(true);
      setError(null);

      let imageUrl = billImageUrl;
      if (billImage) {
        const storage = getStorage();
        const storageRef = ref(storage, `boughtPayments/${Date.now()}_${billImage.name}`);
        await uploadBytes(storageRef, billImage);
        imageUrl = await getDownloadURL(storageRef);
      }

      const selectedCompanyData = companies.find((c) => c.id === selectedCompany);
      const userDisplayName = user?.name || user?.email || "Unknown User";
      const paymentData = {
        companyId: selectedCompany,
        companyName: selectedCompanyData?.name || "Unknown Company",
        selectedBoughtBills,
        selectedBoughtReturns,
        boughtTotal,
        returnTotal,
        netAmount: totalAfterReturn,
        paymentDate: new Date(paymentDate),
        hardcopyBillNumber: hardcopyBillNumber.trim(),
        notes,
        billImageUrl: imageUrl,
        createdBy: user.uid,
        createdByName: userDisplayName,
        paymentType: "bought",
        createdAt: new Date(),
      };

      let result;
      if (isEditMode) {
        result = await updateBoughtPayment(editPaymentId, paymentData);
        setSuccess(`Bought Payment ${result.paymentNumber} updated successfully!`);
      } else {
        result = await createBoughtPayment(paymentData);
        setSuccess(`Bought Payment ${result.paymentNumber} created successfully!`);
      }

      if (!isEditMode) {
        setSelectedBoughtBills([]);
        setSelectedBoughtReturns([]);
        setHardcopyBillNumber("");
        setNotes("");
        setBillImage(null);
        setBillImagePreview(null);
        setBillImageUrl("");
      }

      await refreshPayments();
    } catch (error) {
      console.error(`Error ${isEditMode ? "updating" : "creating"} bought payment:`, error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditPaymentId(null);
    setSelectedBoughtBills([]);
    setSelectedBoughtReturns([]);
    setHardcopyBillNumber("");
    setNotes("");
    setBillImage(null);
    setBillImagePreview(null);
    setBillImageUrl("");
    window.history.replaceState({}, "", "/bought-payments");
  };

  const handleUpdatePayment = (payment) => {
    setIsEditMode(true);
    setEditPaymentId(payment.id);
    setSelectedCompany(payment.companyId);
    setHardcopyBillNumber(payment.hardcopyBillNumber);
    setBillImageUrl(payment.billImageUrl || "");
    setBillImagePreview(payment.billImageUrl || null);
    let paymentDateValue;
    if (payment.paymentDate) {
      if (payment.paymentDate.toDate) {
        paymentDateValue = payment.paymentDate.toDate();
      } else if (payment.paymentDate instanceof Date) {
        paymentDateValue = payment.paymentDate;
      } else {
        paymentDateValue = new Date(payment.paymentDate);
      }
    } else {
      paymentDateValue = new Date();
    }
    setPaymentDate(paymentDateValue.toISOString().split("T")[0]);
    setNotes(payment.notes || "");
    setSelectedBoughtBills(payment.selectedBoughtBills || []);
    setSelectedBoughtReturns(payment.selectedBoughtReturns || []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewPayment = async (payment) => {
    setSelectedPayment(payment);
    await loadPaymentDetails(payment.id);
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedPayment(null);
  };

  const handleAdvancedSearchChange = (field, value) => {
    setAdvancedSearch((prev) => ({ ...prev, [field]: value }));
  };

  const handleAmountRangeChange = (values) => {
    setAmountRange(values);
    setAdvancedSearch((prev) => ({ ...prev, amountFrom: values[0], amountTo: values[1] }));
  };

  const resetAdvancedSearch = () => {
    setAdvancedSearch({
      companyName: "",
      hardcopyBillNumber: "",
      boughtBillNumber: "",
      returnedBillNumber: "",
      notes: "",
      dateFrom: "",
      dateTo: "",
      amountFrom: "",
      amountTo: "",
    });
    setAmountRange([0, 50000000]);
  };

  const filteredPayments = paymentHistory.filter((payment) => {
    const basicSearch =
      searchTerm === "" ||
      payment.paymentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.createdByName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.hardcopyBillNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const statusFilter = filterStatus === "all" || payment.status === filterStatus;
    let advancedFilter = true;
    if (showAdvancedSearch) {
      if (advancedSearch.companyName && !payment.companyName?.toLowerCase().includes(advancedSearch.companyName.toLowerCase())) {
        advancedFilter = false;
      }
      if (advancedSearch.hardcopyBillNumber && !payment.hardcopyBillNumber?.toLowerCase().includes(advancedSearch.hardcopyBillNumber.toLowerCase())) {
        advancedFilter = false;
      }
      if (advancedSearch.dateFrom || advancedSearch.dateTo) {
        let paymentDate;
        if (payment.createdAt?.toDate) {
          paymentDate = payment.createdAt.toDate();
        } else if (payment.createdAt instanceof Date) {
          paymentDate = payment.createdAt;
        } else {
          paymentDate = new Date(payment.createdAt);
        }
        if (advancedSearch.dateFrom) {
          const fromDate = parseDMYToDate(advancedSearch.dateFrom);
          if (fromDate && paymentDate < fromDate) advancedFilter = false;
        }
        if (advancedSearch.dateTo) {
          const toDate = parseDMYToDate(advancedSearch.dateTo);
          if (toDate) {
            toDate.setHours(23, 59, 59, 999);
            if (paymentDate > toDate) advancedFilter = false;
          }
        }
      }
      const paymentAmount = payment.netAmount || 0;
      if (advancedSearch.amountFrom && paymentAmount < Number(advancedSearch.amountFrom)) {
        advancedFilter = false;
      }
      if (advancedSearch.amountTo && paymentAmount > Number(advancedSearch.amountTo)) {
        advancedFilter = false;
      }
    }
    return basicSearch && statusFilter && advancedFilter;
  });

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + (payment.netAmount || 0), 0);

  // Show loading state while checking authentication
  if (!user || isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "3rem",
            height: "3rem",
            border: "3px solid #F3F4F6",
            borderTop: "3px solid #8B5CF6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto"
          }}></div>
          <p style={{ marginTop: "1rem", color: "#6B7280" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "1rem",
        background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
        fontFamily: "var(--font-nrt-reg)",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: "bold",
            background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: "0.5rem",
            fontFamily: "var(--font-nrt-bd)",
          }}
        >
          {isEditMode ? "Update Bought Payment" : "Bought Payment Management"}
        </h1>
        {isEditMode && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#FEF3C7",
              border: `2px solid ${colorScheme.warning}`,
              borderRadius: "0.75rem",
              marginTop: "1rem",
            }}
          >
            <p
              style={{
                color: "#92400E",
                fontSize: "0.9rem",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontFamily: "var(--font-nrt-reg)",
              }}
            >
              <span style={{ fontSize: "1.2rem", fontWeight: "bold" }}>✏️</span>
              <strong>Edit Mode:</strong> You are updating an existing bought payment.
            </p>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#FEF2F2",
            border: `1px solid ${colorScheme.danger}`,
            borderRadius: "0.75rem",
            marginBottom: "1rem",
            fontFamily: "var(--font-nrt-reg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg
              style={{
                width: "1.5rem",
                height: "1.5rem",
                marginRight: "0.75rem",
                color: colorScheme.danger,
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3
                style={{
                  fontWeight: "600",
                  color: colorScheme.danger,
                  margin: 0,
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                Error
              </h3>
              <p
                style={{
                  color: colorScheme.danger,
                  marginTop: "0.25rem",
                  margin: 0,
                  fontFamily: "var(--font-nrt-reg)",
                }}
              >
                {error}
              </p>
            </div>
          </div>
        </div>
      )}
      {success && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#F0FDF4",
            border: `1px solid ${colorScheme.success}`,
            borderRadius: "0.75rem",
            marginBottom: "1rem",
            fontFamily: "var(--font-nrt-reg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg
              style={{
                width: "1.5rem",
                height: "1.5rem",
                marginRight: "0.75rem",
                color: colorScheme.success,
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <h3
                style={{
                  fontWeight: "600",
                  color: colorScheme.success,
                  margin: 0,
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                Success!
              </h3>
              <p
                style={{
                  color: colorScheme.success,
                  marginTop: "0.25rem",
                  margin: 0,
                  fontFamily: "var(--font-nrt-reg)",
                }}
              >
                {success}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Form Section */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>
        {/* Company Information */}
        <div
          style={{
            width: "100%",
            backgroundColor: colorScheme.card,
            borderRadius: "1rem",
            border: "1px solid #E5E7EB",
            padding: "1.5rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          }}
        >
          <h2
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              fontSize: "1.25rem",
              fontWeight: "600",
              color: colorScheme.text,
              marginBottom: "1.5rem",
              paddingBottom: "0.75rem",
              borderBottom: `2px solid ${colorScheme.primary}`,
              fontFamily: "var(--font-nrt-bd)",
            }}
          >
            <div
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: "0.5rem",
                backgroundColor: colorScheme.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              🏢
            </div>
            Company Information
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", width: "100%" }}>
            <div style={{ width: "100%" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: colorScheme.text,
                  marginBottom: "0.5rem",
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                Select Company
              </label>
              <select
                ref={companySelectRef}
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: !selectedCompany ? `1px solid ${colorScheme.danger}` : "1px solid #D1D5DB",
                  borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                  transition: "all 0.2s",
                  backgroundColor: "white",
                  fontFamily: "var(--font-nrt-reg)",
                }}
                required
              >
                <option value="">Choose a company...</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id} style={{ fontFamily: "var(--font-nrt-reg)" }}>
                    {company.name} ({company.code})
                  </option>
                ))}
              </select>
              {isEditMode && (
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: colorScheme.textLight,
                    marginTop: "0.5rem",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                >
                  Company cannot be changed in edit mode
                </p>
              )}
            </div>
            <div style={{ width: "100%" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: colorScheme.text,
                  marginBottom: "0.5rem",
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                Hardcopy Bill Number *
              </label>
              <input
                ref={hardcopyBillNumberRef}
                type="text"
                value={hardcopyBillNumber}
                onChange={(e) => setHardcopyBillNumber(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: !hardcopyBillNumber.trim() ? `1px solid ${colorScheme.danger}` : "1px solid #D1D5DB",
                  borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                  transition: "all 0.2s",
                  backgroundColor: "white",
                  fontFamily: "var(--font-nrt-reg)",
                }}
                placeholder="Enter hardcopy bill number (e.g., BILL-001, INV-2024-001)"
                required
              />
            </div>
            <div style={{ width: "100%" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: colorScheme.text,
                  marginBottom: "0.5rem",
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                Payment Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #D1D5DB",
                  borderRadius: "0.75rem",
                  fontSize: "0.875rem",
                  transition: "all 0.2s",
                  backgroundColor: "white",
                  fontFamily: "var(--font-nrt-reg)",
                }}
                required
              />
            </div>
          </div>
        </div>

        {/* Bill Image Upload */}
        <div
          style={{
            width: "100%",
            backgroundColor: colorScheme.card,
            borderRadius: "1rem",
            border: "1px solid #E5E7EB",
            padding: "1.5rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          }}
        >
          <h2
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              fontSize: "1.25rem",
              fontWeight: "600",
              color: colorScheme.text,
              marginBottom: "1.5rem",
              paddingBottom: "0.75rem",
              borderBottom: `2px solid ${colorScheme.primary}`,
              fontFamily: "var(--font-nrt-bd)",
            }}
          >
            <div
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: "0.5rem",
                backgroundColor: colorScheme.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              📷
            </div>
            Bill Image
          </h2>
          <div style={{ width: "100%" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: colorScheme.text,
                marginBottom: "0.5rem",
                fontFamily: "var(--font-nrt-bd)",
              }}
            >
              Upload Bill Image (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                setBillImage(file);
                setBillImagePreview(URL.createObjectURL(file));
              }}
              style={{ width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.75rem" }}
            />
            {billImagePreview && (
              <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <img
                  src={billImagePreview}
                  alt="Bill Preview"
                  style={{ maxWidth: "200px", maxHeight: "200px", borderRadius: "0.5rem", border: "1px solid #E5E7EB" }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Bought Bills and Returns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Bought Bills Section */}
          <div
            style={{
              backgroundColor: colorScheme.card,
              borderRadius: "1rem",
              border: "1px solid #E5E7EB",
              overflow: "hidden",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`,
                padding: "1.25rem",
                borderRadius: "15px 15px 0 0",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    color: "white",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  <span>📦</span>
                  Bought Bills ({boughtBills.length})
                </h2>
                {!isEditMode && boughtBills.length > 0 && (
                  <button
                    onClick={selectAllBoughtBills}
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "white",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.75rem",
                      fontSize: "0.75rem",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontWeight: "600",
                      fontFamily: "var(--font-nrt-bd)",
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = "rgba(255, 255, 255, 0.3)")}
                    onMouseOut={(e) => (e.target.style.backgroundColor = "rgba(255, 255, 255, 0.2)")}
                  >
                    {selectedBoughtBills.length === boughtBills.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
            </div>
            <div style={{ padding: "1.25rem", maxHeight: "500px", overflowY: "auto" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "3rem 2rem" }}>
                  <div
                    style={{
                      width: "3rem",
                      height: "3rem",
                      border: "3px solid #F3F4F6",
                      borderTop: `3px solid ${colorScheme.primary}`,
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                      margin: "0 auto",
                    }}
                  ></div>
                  <p
                    style={{
                      color: colorScheme.textLight,
                      marginTop: "1rem",
                      fontSize: "0.875rem",
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  >
                    Loading bills...
                  </p>
                </div>
              ) : boughtBills.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 2rem" }}>
                  <div style={{ fontSize: "3rem", color: "#9CA3AF", marginBottom: "1rem" }}>📄</div>
                  <p
                    style={{
                      color: colorScheme.textLight,
                      fontSize: "0.875rem",
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  >
                    {selectedCompany ? "No unpaid bills available" : "Select company to view bills"}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {boughtBills.map((bill) => (
                    <div
                      key={bill.id}
                      onClick={() => toggleBoughtBill(bill.id)}
                      style={{
                        padding: "1rem",
                        border: selectedBoughtBills.includes(bill.id) ? `2px solid ${colorScheme.primary}` : "1px solid #E5E7EB",
                        backgroundColor: selectedBoughtBills.includes(bill.id) ? "#F5F3FF" : "white",
                        borderRadius: "0.75rem",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        boxShadow: selectedBoughtBills.includes(bill.id) ? "0 4px 12px rgba(139, 92, 246, 0.15)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                        fontFamily: "var(--font-nrt-reg)",
                      }}
                      onMouseOver={(e) => {
                        e.target.style.transform = "translateY(-2px)";
                        e.target.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.1)";
                      }}
                      onMouseOut={(e) => {
                        e.target.style.transform = "translateY(0)";
                        e.target.style.boxShadow = selectedBoughtBills.includes(bill.id)
                          ? "0 4px 12px rgba(139, 92, 246, 0.15)"
                          : "0 1px 3px rgba(0, 0, 0, 0.1)";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "700",
                              color: colorScheme.text,
                              fontSize: "0.9rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              fontFamily: "var(--font-nrt-bd)",
                            }}
                          >
                            <span
                              style={{
                                width: "20px",
                                height: "20px",
                                borderRadius: "50%",
                                backgroundColor: selectedBoughtBills.includes(bill.id) ? colorScheme.primary : "#E5E7EB",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.7rem",
                                color: selectedBoughtBills.includes(bill.id) ? "white" : "#9CA3AF",
                                fontWeight: "bold",
                              }}
                            >
                              {selectedBoughtBills.includes(bill.id) ? "✓" : ""}
                            </span>
                            Bill #{bill.billNumber}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: colorScheme.textLight,
                              marginTop: "0.5rem",
                              marginLeft: "1.75rem",
                              fontFamily: "var(--font-nrt-reg)",
                            }}
                          >
                            {formatDateToDMY(bill.date)} • {bill.items?.length || 0} items
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: selectedBoughtBills.includes(bill.id) ? colorScheme.primary : colorScheme.danger,
                              marginTop: "0.5rem",
                              fontWeight: "600",
                              marginLeft: "1.75rem",
                              fontFamily: "var(--font-nrt-reg)",
                            }}
                          >
                            {selectedBoughtBills.includes(bill.id) ? "✓ Selected for Payment" : "● Unpaid"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", marginLeft: "0.5rem" }}>
                          <div
                            style={{
                              fontWeight: "bold",
                              color: colorScheme.success,
                              fontSize: "1rem",
                              fontFamily: "var(--font-nrt-bd)",
                            }}
                          >
                            {formatCurrency(bill.totalAmount)}
                          </div>
                          {selectedBoughtBills.includes(bill.id) && (
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: colorScheme.primary,
                                marginTop: "0.5rem",
                                fontWeight: "600",
                                fontFamily: "var(--font-nrt-reg)",
                              }}
                            >
                              ✓ Selected
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Returns Section */}
          <div
            style={{
              backgroundColor: colorScheme.card,
              borderRadius: "1rem",
              border: "1px solid #E5E7EB",
              overflow: "hidden",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${colorScheme.secondary} 0%, #0891B2 100%)`,
                padding: "1.25rem",
                borderRadius: "15px 15px 0 0",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    color: "white",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  <span>🔄</span>
                  Returns ({returns.length})
                </h2>
                {!isEditMode && returns.length > 0 && (
                  <button
                    onClick={selectAllBoughtReturns}
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "white",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.75rem",
                      fontSize: "0.75rem",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontWeight: "600",
                      fontFamily: "var(--font-nrt-bd)",
                    }}
                    onMouseOver={(e) => (e.target.style.backgroundColor = "rgba(255, 255, 255, 0.3)")}
                    onMouseOut={(e) => (e.target.style.backgroundColor = "rgba(255, 255, 255, 0.2)")}
                  >
                    {selectedBoughtReturns.length === returns.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
            </div>
            <div style={{ padding: "1.25rem", maxHeight: "500px", overflowY: "auto" }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "3rem 2rem" }}>
                  <div
                    style={{
                      width: "3rem",
                      height: "3rem",
                      border: "3px solid #F3F4F6",
                      borderTop: `3px solid ${colorScheme.secondary}`,
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                      margin: "0 auto",
                    }}
                  ></div>
                  <p
                    style={{
                      color: colorScheme.textLight,
                      marginTop: "1rem",
                      fontSize: "0.875rem",
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  >
                    Loading returns...
                  </p>
                </div>
              ) : returns.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 2rem" }}>
                  <div style={{ fontSize: "3rem", color: "#9CA3AF", marginBottom: "1rem" }}>🔄</div>
                  <p
                    style={{
                      color: colorScheme.textLight,
                      fontSize: "0.875rem",
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  >
                    {selectedCompany ? "No returns available" : "Select company to view returns"}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {returns.map((returnBill) => {
                    const returnId = returnBill.id;
                    const returnNumber = returnBill.id ? `Return #${returnBill.id.slice(-6)}` : "Return #N/A";
                    const itemCount = returnBill.items ? returnBill.items.length : 1;
                    const returnAmount = returnBill.totalReturn || 0;
                    return (
                      <div
                        key={returnBill.id}
                        onClick={() => toggleBoughtReturn(returnBill.id)}
                        style={{
                          padding: "1rem",
                          border: selectedBoughtReturns.includes(returnBill.id) ? `2px solid ${colorScheme.secondary}` : "1px solid #E5E7EB",
                          backgroundColor: selectedBoughtReturns.includes(returnBill.id) ? "#ECFEFF" : "white",
                          borderRadius: "0.75rem",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          boxShadow: selectedBoughtReturns.includes(returnBill.id) ? "0 4px 12px rgba(6, 182, 212, 0.15)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                          fontFamily: "var(--font-nrt-reg)",
                        }}
                        onMouseOver={(e) => {
                          e.target.style.transform = "translateY(-2px)";
                          e.target.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.1)";
                        }}
                        onMouseOut={(e) => {
                          e.target.style.transform = "translateY(0)";
                          e.target.style.boxShadow = selectedBoughtReturns.includes(returnBill.id)
                            ? "0 4px 12px rgba(6, 182, 212, 0.15)"
                            : "0 1px 3px rgba(0, 0, 0, 0.1)";
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontWeight: "700",
                                color: colorScheme.text,
                                fontSize: "0.9rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontFamily: "var(--font-nrt-bd)",
                              }}
                            >
                              <span
                                style={{
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "50%",
                                  backgroundColor: selectedBoughtReturns.includes(returnBill.id) ? colorScheme.secondary : "#E5E7EB",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "0.7rem",
                                  color: selectedBoughtReturns.includes(returnBill.id) ? "white" : "#9CA3AF",
                                  fontWeight: "bold",
                                }}
                              >
                                {selectedBoughtReturns.includes(returnBill.id) ? "✓" : ""}
                              </span>
                              {returnNumber}
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: colorScheme.textLight,
                                marginTop: "0.5rem",
                                marginLeft: "1.75rem",
                                fontFamily: "var(--font-nrt-reg)",
                              }}
                            >
                              {formatDateToDMY(returnBill.date)} • {itemCount} items
                            </div>
                            {returnBill.items && returnBill.items.length > 0 && (
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: colorScheme.textLight,
                                  marginTop: "0.5rem",
                                  marginLeft: "1.75rem",
                                  fontFamily: "var(--font-nrt-reg)",
                                }}
                              >
                                Items: {returnBill.items.slice(0, 2).map((item) => item.name).join(", ")}
                                {returnBill.items.length > 2 && ` +${returnBill.items.length - 2} more`}
                              </div>
                            )}
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: selectedBoughtReturns.includes(returnBill.id) ? colorScheme.secondary : colorScheme.danger,
                                marginTop: "0.5rem",
                                fontWeight: "600",
                                marginLeft: "1.75rem",
                                fontFamily: "var(--font-nrt-reg)",
                              }}
                            >
                              {selectedBoughtReturns.includes(returnBill.id) ? "✓ Selected for Processing" : "● Unprocessed"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", marginLeft: "0.5rem" }}>
                            <div
                              style={{
                                fontWeight: "bold",
                                color: colorScheme.danger,
                                fontSize: "1rem",
                                fontFamily: "var(--font-nrt-bd)",
                              }}
                            >
                              -{formatCurrency(returnAmount)}
                            </div>
                            {selectedBoughtReturns.includes(returnBill.id) && (
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: colorScheme.secondary,
                                  marginTop: "0.5rem",
                                  fontWeight: "600",
                                  fontFamily: "var(--font-nrt-reg)",
                                }}
                              >
                                ✓ Selected
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Summary and Notes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Payment Summary */}
          <div
            style={{
              backgroundColor: colorScheme.card,
              borderRadius: "1rem",
              border: "1px solid #E5E7EB",
              padding: "1.5rem",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          >
            <h2
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                fontSize: "1.25rem",
                fontWeight: "600",
                color: colorScheme.text,
                marginBottom: "1.5rem",
                paddingBottom: "0.75rem",
                borderBottom: `2px solid ${colorScheme.secondary}`,
                fontFamily: "var(--font-nrt-bd)",
              }}
            >
              <div
                style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "0.5rem",
                  backgroundColor: colorScheme.secondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                }}
              >
                💰
              </div>
              Payment Summary
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  backgroundColor: "#F0FDF9",
                  borderRadius: "0.75rem",
                  border: `1px solid ${colorScheme.success}`,
                }}
              >
                <span
                  style={{
                    color: colorScheme.text,
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Bought Bills:
                </span>
                <span
                  style={{
                    fontWeight: "bold",
                    color: colorScheme.success,
                    fontSize: "1rem",
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  {formatCurrency(boughtTotal)} ({selectedBoughtBills.length} bill(s))
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  backgroundColor: "#FEF2F2",
                  borderRadius: "0.75rem",
                  border: `1px solid ${colorScheme.danger}`,
                }}
              >
                <span
                  style={{
                    color: colorScheme.text,
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Returns:
                </span>
                <span
                  style={{
                    fontWeight: "bold",
                    color: colorScheme.danger,
                    fontSize: "1rem",
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  -{formatCurrency(returnTotal)} ({selectedBoughtReturns.length} return(s))
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1.25rem",
                  borderTop: "2px solid #E5E7EB",
                  marginTop: "0.5rem",
                  width: "100%",
                  backgroundColor: "#F8FAFC",
                  borderRadius: "0.75rem",
                }}
              >
                <span
                  style={{
                    fontWeight: "bold",
                    color: colorScheme.text,
                    fontSize: "1.1rem",
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Net Amount:
                </span>
                <span
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: colorScheme.primary,
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  {formatCurrency(totalAfterReturn)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div
            style={{
              backgroundColor: colorScheme.card,
              borderRadius: "1rem",
              border: "1px solid #E5E7EB",
              padding: "1.5rem",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          >
            <h2
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                fontSize: "1.25rem",
                fontWeight: "600",
                color: colorScheme.text,
                marginBottom: "1.5rem",
                paddingBottom: "0.75rem",
                borderBottom: `2px solid ${colorScheme.light}`,
                fontFamily: "var(--font-nrt-bd)",
              }}
            >
              <div
                style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "0.5rem",
                  backgroundColor: colorScheme.light,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                }}
              >
                📝
              </div>
              Notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              style={{
                width: "100%",
                resize: "vertical",
                minHeight: "100px",
                padding: "0.75rem",
                border: "1px solid #D1D5DB",
                borderRadius: "0.75rem",
                fontSize: "0.875rem",
                transition: "all 0.2s",
                backgroundColor: "white",
                fontFamily: "var(--font-nrt-reg)",
              }}
              placeholder="Add any notes about this payment..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "1rem", width: "100%" }}>
          {isEditMode && (
            <button
              onClick={handleCancelEdit}
              style={{
                flex: 1,
                padding: "1rem",
                backgroundColor: colorScheme.textLight,
                color: "white",
                border: "none",
                borderRadius: "0.75rem",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s",
                fontSize: "1rem",
                fontFamily: "var(--font-nrt-bd)",
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#4B5563")}
              onMouseOut={(e) => (e.target.style.backgroundColor = colorScheme.textLight)}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedCompany || !hardcopyBillNumber.trim() || (selectedBoughtBills.length === 0 && selectedBoughtReturns.length === 0)}
            style={{
              flex: 2,
              padding: "1rem",
              background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`,
              color: "white",
              border: "none",
              borderRadius: "0.75rem",
              fontWeight: "600",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              fontSize: "1rem",
              opacity: submitting ? 0.7 : 1,
              fontFamily: "var(--font-nrt-bd)",
            }}
            onMouseOver={(e) => {
              if (!e.target.disabled) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 8px 25px rgba(139, 92, 246, 0.3)";
              }
            }}
            onMouseOut={(e) => {
              if (!e.target.disabled) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "none";
              }
            }}
          >
            {submitting ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <div
                  style={{
                    width: "1.25rem",
                    height: "1.25rem",
                    border: "2px solid transparent",
                    borderTop: "2px solid white",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></div>
                {isEditMode ? "Updating..." : "Processing..."}
              </div>
            ) : (
              `${isEditMode ? "Update" : "Create"} Payment - ${formatCurrency(totalAfterReturn)}`
            )}
          </button>
        </div>
      </div>

      {/* Payment History Section */}
      <div
        style={{
          backgroundColor: colorScheme.card,
          borderRadius: "1rem",
          border: "1px solid #E5E7EB",
          marginBottom: "1rem",
          overflow: "hidden",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`,
            padding: "1.5rem 2rem",
            borderRadius: "1rem 1rem 0 0",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2
                style={{
                  fontSize: "1.75rem",
                  fontWeight: "bold",
                  color: "white",
                  margin: 0,
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                Bought Payment History
              </h2>
              <p
                style={{
                  color: "#DDD6FE",
                  fontSize: "1rem",
                  margin: "0.5rem 0 0 0",
                  fontFamily: "var(--font-nrt-reg)",
                }}
              >
                View and manage all bought payment records
              </p>
            </div>
            <div
              style={{
                width: "4rem",
                height: "4rem",
                borderRadius: "50%",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
              }}
            >
              💳
            </div>
          </div>
        </div>

      {/* Stats and Actions */}
      <div style={{ padding: "2rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: "1.5rem",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <div
              style={{
                background: "white",
                padding: "1.25rem 1.5rem",
                borderRadius: "1rem",
                minWidth: "140px",
                border: `1px solid #E5E7EB`,
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: colorScheme.textLight,
                  fontWeight: "600",
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                Total Processed
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: colorScheme.success,
                  marginTop: "0.25rem",
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                {formatCurrency(totalAmount)}
              </div>
            </div>
            <div
              style={{
                background: "white",
                padding: "1.25rem 1.5rem",
                borderRadius: "1rem",
                minWidth: "140px",
                border: `1px solid #E5E7EB`,
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: colorScheme.textLight,
                  fontWeight: "600",
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                Total Payments
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: colorScheme.primary,
                  marginTop: "0.25rem",
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                {filteredPayments.length}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "250px",
                padding: "0.75rem 1rem",
                border: `1px solid #D1D5DB`,
                borderRadius: "0.75rem",
                fontSize: "0.875rem",
                transition: "all 0.2s",
                backgroundColor: "white",
                fontFamily: "var(--font-nrt-reg)",
              }}
            />
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: colorScheme.textLight,
                color: "white",
                border: "none",
                borderRadius: "0.75rem",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-bd)",
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#4B5563")}
              onMouseOut={(e) => (e.target.style.backgroundColor = colorScheme.textLight)}
            >
              {showAdvancedSearch ? "Hide" : "Advanced"} Search
            </button>
          </div>
        </div>

        {/* Advanced Search Panel */}
        {showAdvancedSearch && (
          <div
            style={{
              background: "#F8FAFC",
              marginBottom: "2rem",
              padding: "2rem",
              borderRadius: "1rem",
              border: `1px solid #E5E7EB`,
            }}
          >
            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: "600",
                marginBottom: "1.5rem",
                color: colorScheme.text,
                fontFamily: "var(--font-nrt-bd)",
              }}
            >
              Advanced Search
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "0.75rem",
                    color: colorScheme.text,
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Company Name
                </label>
                <input
                  type="text"
                  value={advancedSearch.companyName}
                  onChange={(e) => handleAdvancedSearchChange("companyName", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid #D1D5DB`,
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                    backgroundColor: "white",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "0.75rem",
                    color: colorScheme.text,
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Hardcopy Bill #
                </label>
                <input
                  type="text"
                  value={advancedSearch.hardcopyBillNumber}
                  onChange={(e) => handleAdvancedSearchChange("hardcopyBillNumber", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid #D1D5DB`,
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                    backgroundColor: "white",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                  placeholder="Enter bill number"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "0.75rem",
                    color: colorScheme.text,
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Bought Bill #
                </label>
                <input
                  type="text"
                  value={advancedSearch.boughtBillNumber}
                  onChange={(e) => handleAdvancedSearchChange("boughtBillNumber", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid #D1D5DB`,
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                    backgroundColor: "white",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                  placeholder="Enter bought bill number"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "0.75rem",
                    color: colorScheme.text,
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Returned Bill #
                </label>
                <input
                  type="text"
                  value={advancedSearch.returnedBillNumber}
                  onChange={(e) => handleAdvancedSearchChange("returnedBillNumber", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid #D1D5DB`,
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                    backgroundColor: "white",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                  placeholder="Enter returned bill number"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "0.75rem",
                    color: colorScheme.text,
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Notes
                </label>
                <input
                  type="text"
                  value={advancedSearch.notes}
                  onChange={(e) => handleAdvancedSearchChange("notes", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid #D1D5DB`,
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                    backgroundColor: "white",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                  placeholder="Search in notes"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "0.75rem",
                    color: colorScheme.text,
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Date From (dd/mm/yyyy)
                </label>
                <input
                  type="text"
                  value={advancedSearch.dateFrom}
                  onChange={(e) => handleAdvancedSearchChange("dateFrom", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid #D1D5DB`,
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                    backgroundColor: "white",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "0.75rem",
                    color: colorScheme.text,
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Date To (dd/mm/yyyy)
                </label>
                <input
                  type="text"
                  value={advancedSearch.dateTo}
                  onChange={(e) => handleAdvancedSearchChange("dateTo", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid #D1D5DB`,
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    transition: "all 0.2s",
                    backgroundColor: "white",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "1rem",
                    color: colorScheme.text,
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Amount Range: {formatCurrency(amountRange[0])} - {formatCurrency(amountRange[1])}
                </label>
                <div style={{ position: "relative", height: "40px", margin: "1rem 0" }}>
                  <input
                    type="range"
                    min="0"
                    max="50000000"
                    step="100000"
                    value={amountRange[0]}
                    onChange={(e) => handleAmountRangeChange([parseInt(e.target.value), amountRange[1]])}
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "8px",
                      background: "transparent",
                      outline: "none",
                      zIndex: 2,
                    }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="50000000"
                    step="100000"
                    value={amountRange[1]}
                    onChange={(e) => handleAmountRangeChange([amountRange[0], parseInt(e.target.value)])}
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "8px",
                      background: "transparent",
                      outline: "none",
                      zIndex: 3,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "8px",
                      background: `linear-gradient(to right,
                        ${colorScheme.primary} 0%,
                        ${colorScheme.primary} ${(amountRange[0] / 50000000) * 100}%,
                        #E5E7EB ${(amountRange[0] / 50000000) * 100}%,
                        #E5E7EB ${(amountRange[1] / 50000000) * 100}%,
                        ${colorScheme.primary} ${(amountRange[1] / 50000000) * 100}%,
                        ${colorScheme.primary} 100%)`,
                      borderRadius: "4px",
                      zIndex: 1,
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: colorScheme.textLight,
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  >
                    0 IQD
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: colorScheme.textLight,
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  >
                    50,000,000 IQD
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <input
                    type="number"
                    value={advancedSearch.amountFrom}
                    onChange={(e) => handleAdvancedSearchChange("amountFrom", e.target.value)}
                    placeholder="From"
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      border: `1px solid #D1D5DB`,
                      borderRadius: "0.75rem",
                      fontSize: "0.875rem",
                      transition: "all 0.2s",
                      backgroundColor: "white",
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  />
                  <input
                    type="number"
                    value={advancedSearch.amountTo}
                    onChange={(e) => handleAdvancedSearchChange("amountTo", e.target.value)}
                    placeholder="To"
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      border: `1px solid #D1D5DB`,
                      borderRadius: "0.75rem",
                      fontSize: "0.875rem",
                      transition: "all 0.2s",
                      backgroundColor: "white",
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button
                onClick={resetAdvancedSearch}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: colorScheme.textLight,
                  color: "white",
                  border: "none",
                  borderRadius: "0.75rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-bd)",
                }}
                onMouseOver={(e) => (e.target.style.backgroundColor = "#4B5563")}
                onMouseOut={(e) => (e.target.style.backgroundColor = colorScheme.textLight)}
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div>
          {historyLoading ? (
            <div
              style={{
                background: "white",
                textAlign: "center",
                padding: "4rem 2rem",
                borderRadius: "1rem",
                border: `1px solid #E5E7EB`,
              }}
            >
              <div
                style={{
                  width: "4rem",
                  height: "4rem",
                  border: "4px solid #F3F4F6",
                  borderTop: `4px solid ${colorScheme.primary}`,
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto",
                }}
              ></div>
              <p
                style={{
                  color: colorScheme.textLight,
                  marginTop: "1.5rem",
                  fontSize: "1rem",
                  fontFamily: "var(--font-nrt-reg)",
                }}
              >
                Loading payments...
              </p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div
              style={{
                background: "white",
                textAlign: "center",
                padding: "4rem 2rem",
                borderRadius: "1rem",
                border: `1px solid #E5E7EB`,
              }}
            >
              <div style={{ fontSize: "4rem", color: "#9CA3AF", marginBottom: "1.5rem" }}>💸</div>
              <h3
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "600",
                  color: colorScheme.text,
                  marginBottom: "1rem",
                  fontFamily: "var(--font-nrt-bd)",
                }}
              >
                No payments found
              </h3>
              <p
                style={{
                  color: colorScheme.textLight,
                  marginBottom: "2rem",
                  fontSize: "1rem",
                  fontFamily: "var(--font-nrt-reg)",
                }}
              >
                {paymentHistory.length === 0 ? "Get started by creating your first payment" : "No payments match your search criteria"}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: "1.5rem" }}>
              {filteredPayments.map((payment) => (
                <div key={payment.id}>
                  <div
                    style={{
                      background: "white",
                      borderRadius: "1rem",
                      border: "1px solid #E5E7EB",
                      transition: "all 0.3s ease",
                      overflow: "hidden",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = "0 12px 25px rgba(0, 0, 0, 0.1)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.05)";
                    }}
                  >
                    {/* Payment Header */}
                    <div
                      style={{
                        background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`,
                        padding: "1.25rem 1.5rem",
                        borderRadius: "1rem 1rem 0 0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <h3
                            style={{
                              fontSize: "1.1rem",
                              fontWeight: "bold",
                              color: "white",
                              margin: "0 0 0.5rem 0",
                              fontFamily: "var(--font-nrt-bd)",
                            }}
                          >
                            {payment.paymentNumber}
                          </h3>
                          <p
                            style={{
                              color: "#DDD6FE",
                              fontSize: "0.9rem",
                              margin: "0 0 0.25rem 0",
                              fontFamily: "var(--font-nrt-reg)",
                            }}
                          >
                            {payment.companyName}
                          </p>
                          {payment.hardcopyBillNumber && (
                            <p
                              style={{
                                color: "#DDD6FE",
                                fontSize: "0.8rem",
                                margin: "0",
                                fontFamily: "var(--font-nrt-reg)",
                              }}
                            >
                              Bill: {payment.hardcopyBillNumber}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: "1.5rem",
                              fontWeight: "bold",
                              color: "white",
                              fontFamily: "var(--font-nrt-bd)",
                            }}
                          >
                            {formatCurrency(payment.netAmount)}
                          </div>
                          <div
                            style={{
                              color: "#DDD6FE",
                              fontSize: "0.8rem",
                              marginTop: "0.25rem",
                              fontFamily: "var(--font-nrt-reg)",
                            }}
                          >
                            {formatDateToDMY(payment.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Payment Details */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", margin: "1.5rem" }}>
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: colorScheme.success,
                            fontWeight: "600",
                            fontFamily: "var(--font-nrt-bd)",
                          }}
                        >
                          Bought
                        </div>
                        <div
                          style={{
                            fontSize: "1.25rem",
                            fontWeight: "bold",
                            color: colorScheme.success,
                            marginTop: "0.25rem",
                            fontFamily: "var(--font-nrt-bd)",
                          }}
                        >
                          +{formatCurrency(payment.boughtTotal)}
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: colorScheme.danger,
                            fontWeight: "600",
                            fontFamily: "var(--font-nrt-bd)",
                          }}
                        >
                          Returns
                        </div>
                        <div
                          style={{
                            fontSize: "1.25rem",
                            fontWeight: "bold",
                            color: colorScheme.danger,
                            marginTop: "0.25rem",
                            fontFamily: "var(--font-nrt-bd)",
                          }}
                        >
                          -{formatCurrency(payment.returnTotal)}
                        </div>
                      </div>
                    </div>
                    {/* Summary */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.9rem",
                        color: colorScheme.textLight,
                        padding: "0 1.5rem",
                        fontFamily: "var(--font-nrt-reg)",
                      }}
                    >
                      <div>
                        <div>Bills: {payment.selectedBoughtBills?.length || 0}</div>
                        <div>Returns: {payment.selectedBoughtReturns?.length || 0}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div>By: {payment.createdByName}</div>
                      </div>
                    </div>
                    {/* Bill Image */}
                    {payment.billImageUrl && (
                      <div style={{ margin: "1rem", textAlign: "center" }}>
                        <img
                          src={payment.billImageUrl}
                          alt="Bill"
                          style={{ maxWidth: "150px", maxHeight: "150px", borderRadius: "0.5rem", border: "1px solid #E5E7EB" }}
                        />
                      </div>
                    )}
                    {/* Notes Preview */}
                    {payment.notes && (
                      <div
                        style={{
                          margin: "1rem 1.5rem",
                          padding: "0.75rem",
                          backgroundColor: "#FEF3C7",
                          borderRadius: "0.5rem",
                          border: `1px solid ${colorScheme.warning}`,
                        }}
                      >
                        <p
                          style={{
                            fontSize: "0.8rem",
                            color: "#92400E",
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontFamily: "var(--font-nrt-reg)",
                          }}
                        >
                          {payment.notes}
                        </p>
                      </div>
                    )}
                    {/* Action Buttons */}
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        margin: "1.5rem",
                        paddingTop: "1rem",
                        borderTop: "1px solid #E5E7EB",
                      }}
                    >
                      <button
                        onClick={() => handleViewPayment(payment)}
                        style={{
                          flex: 1,
                          padding: "0.75rem",
                          fontSize: "0.9rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          backgroundColor: colorScheme.textLight,
                          color: "white",
                          border: "none",
                          borderRadius: "0.75rem",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          fontFamily: "var(--font-nrt-bd)",
                        }}
                        onMouseOver={(e) => (e.target.style.backgroundColor = "#4B5563")}
                        onMouseOut={(e) => (e.target.style.backgroundColor = colorScheme.textLight)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Details
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdatePayment(payment);
                        }}
                        style={{
                          flex: 1,
                          padding: "0.75rem",
                          fontSize: "0.9rem",
                          backgroundColor: colorScheme.secondary,
                          color: "white",
                          border: "none",
                          borderRadius: "0.75rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                          fontWeight: "600",
                          transition: "all 0.2s",
                          fontFamily: "var(--font-nrt-bd)",
                        }}
                        onMouseOver={(e) => {
                          e.target.style.backgroundColor = "#0891B2";
                          e.target.style.transform = "translateY(-1px)";
                        }}
                        onMouseOut={(e) => {
                          e.target.style.backgroundColor = colorScheme.secondary;
                          e.target.style.transform = "translateY(0)";
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Payment Details Modal */}
    {showPaymentModal && selectedPayment && (
      <div
        style={{
          position: "fixed",

          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "1rem",
        }}
      >
        <div
          style={{
            width:"55%",
            background: "white",
            borderRadius: "1rem",
            // width: "90%",
            // maxWidth: "900px",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1.5rem 2rem",
              borderBottom: "1px solid #E5E7EB",
              background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`,
              color: "white",
              borderRadius: "1rem 1rem 0 0",
            }}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: "600",
                margin: 0,
                fontFamily: "var(--font-nrt-bd)",
              }}
            >
              Bought Payment Details - {selectedPayment.paymentNumber}
            </h2>
            <button
              onClick={closePaymentModal}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                border: "none",
                cursor: "pointer",
                padding: "0.5rem",
                borderRadius: "0.5rem",
                color: "white",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = "rgba(255, 255, 255, 0.3)")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "rgba(255, 255, 255, 0.2)")}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div style={{ padding: "2rem" , width:"1200px",}}>
            {/* Header Section */}
            <div
              style={{
                display: "flex",

                justifyContent: "space-between",
                marginBottom: "1.5rem",
                paddingBottom: "1.5rem",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: "600",
                    color: colorScheme.text,
                    margin: "0 0 0.5rem 0",
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  {selectedPayment.companyName}
                </h3>
                <p
                  style={{
                    color: colorScheme.textLight,
                    margin: "0.25rem 0",
                    fontSize: "1rem",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                >
                  Hardcopy Bill: {selectedPayment.hardcopyBillNumber}
                </p>
                <p
                  style={{
                    color: colorScheme.textLight,
                    margin: "0.25rem 0",
                    fontSize: "1rem",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                >
                  Date: {formatDateToDMY(selectedPayment.paymentDate)}
                </p>
              </div>
              <div>
                <div
                  style={{
                    background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`,
                    color: "white",
                    padding: "1.5rem 2rem",
                    borderRadius: "1rem",
                    textAlign: "center",
                    minWidth: "180px",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: "1rem",
                      opacity: 0.9,
                      marginBottom: "0.5rem",
                      fontWeight: "600",
                      fontFamily: "var(--font-nrt-bd)",
                    }}
                  >
                    Net Amount
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "2rem",
                      fontWeight: "bold",
                      fontFamily: "var(--font-nrt-bd)",
                    }}
                  >
                    {formatCurrency(selectedPayment.netAmount || 0)}
                  </span>
                </div>
              </div>
            </div>
            {/* Bill Image */}
            {selectedPayment.billImageUrl && (
              <div style={{ textAlign: "center", margin: "1.5rem 0" }}>
                <img
                  src={selectedPayment.billImageUrl}
                  alt="Bill"
                  style={{ maxWidth: "300px", maxHeight: "300px", borderRadius: "0.5rem", border: "1px solid #E5E7EB" }}
                />
              </div>
            )}
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "1.5rem",
                  background: "#F5F3FF",
                  borderRadius: "1rem",
                  border: `2px solid ${colorScheme.primary}`,
                }}
              >
                <div style={{ fontSize: "2rem", marginRight: "1rem", color: colorScheme.primary }}>📦</div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: colorScheme.text,
                      marginBottom: "0.5rem",
                      fontWeight: "600",
                      fontFamily: "var(--font-nrt-bd)",
                    }}
                  >
                    Bought Bills
                  </div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      color: colorScheme.success,
                      marginBottom: "0.25rem",
                      fontFamily: "var(--font-nrt-bd)",
                    }}
                  >
                    {formatCurrency(selectedPayment.boughtTotal || 0)}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: colorScheme.textLight,
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  >
                    {selectedPayment.selectedBoughtBills?.length || 0} bills
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "1.5rem",
                  background: "#ECFEFF",
                  borderRadius: "1rem",
                  border: `2px solid ${colorScheme.secondary}`,
                }}
              >
                <div style={{ fontSize: "2rem", marginRight: "1rem", color: colorScheme.secondary }}>🔄</div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: colorScheme.text,
                      marginBottom: "0.5rem",
                      fontWeight: "600",
                      fontFamily: "var(--font-nrt-bd)",
                    }}
                  >
                    Returns
                  </div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      color: colorScheme.danger,
                      marginBottom: "0.25rem",
                      fontFamily: "var(--font-nrt-bd)",
                    }}
                  >
                    -{formatCurrency(selectedPayment.returnTotal || 0)}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: colorScheme.textLight,
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  >
                    {selectedPayment.selectedBoughtReturns?.length || 0} returns
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "1.5rem",
                  background: "#F8FAFC",
                  borderRadius: "1rem",
                  border: `2px solid #E5E7EB`,
                }}
              >
                <div style={{ fontSize: "2rem", marginRight: "1rem", color: colorScheme.textLight }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: colorScheme.text,
                      marginBottom: "0.5rem",
                      fontWeight: "600",
                      fontFamily: "var(--font-nrt-bd)",
                    }}
                  >
                    Created By
                  </div>
                  <div
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      color: colorScheme.text,
                      marginBottom: "0.25rem",
                      fontFamily: "var(--font-nrt-bd)",
                    }}
                  >
                    {selectedPayment.createdByName || "Unknown"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: colorScheme.textLight,
                      fontFamily: "var(--font-nrt-reg)",
                    }}
                  >
                    {formatDateToDMY(selectedPayment.createdAt)}
                  </div>
                </div>
              </div>
            </div>
            {/* Bills and Returns Sections */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {/* Bought Bills Section */}
              {paymentDetails[selectedPayment.id]?.boughtBills?.length > 0 && (
                <div
                  style={{
                    background: "#F8FAFC",
                    borderRadius: "1rem",
                    padding: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1.5rem",
                      paddingBottom: "1rem",
                      borderBottom: `2px solid ${colorScheme.primary}`,
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: "600",
                        color: colorScheme.text,
                        margin: 0,
                        fontFamily: "var(--font-nrt-bd)",
                      }}
                    >
                      Bought Bills ({paymentDetails[selectedPayment.id].boughtBills.length})
                    </h4>
                    <span
                      style={{
                        fontWeight: "600",
                        color: colorScheme.textLight,
                        fontFamily: "var(--font-nrt-reg)",
                      }}
                    >
                      Total: {formatCurrency(selectedPayment.boughtTotal || 0)}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
                    {paymentDetails[selectedPayment.id].boughtBills.map((bill) => {
                      const billTotal =
                        bill.totalAmount ||
                        bill.items?.reduce((sum, item) => sum + (((item.basePrice || item.netPrice) || 0) * (item.quantity || 0)), 0) ||
                        0;
                      return (
                        <div
                          key={bill.id}
                          style={{
                            background: "white",
                            borderRadius: "0.75rem",
                            padding: "1.25rem",
                            border: `1px solid #E5E7EB`,
                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                            borderLeft: `4px solid ${colorScheme.primary}`,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontWeight: "600",
                                  color: colorScheme.text,
                                  fontSize: "1rem",
                                  marginBottom: "0.25rem",
                                  fontFamily: "var(--font-nrt-bd)",
                                }}
                              >
                                Bill #{bill.billNumber}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  color: colorScheme.textLight,
                                  fontFamily: "var(--font-nrt-reg)",
                                }}
                              >
                                {formatDateToDMY(bill.date)}
                              </div>
                            </div>
                            <div
                              style={{
                                fontWeight: "bold",
                                color: colorScheme.success,
                                fontSize: "1.25rem",
                                fontFamily: "var(--font-nrt-bd)",
                              }}
                            >
                              {formatCurrency(billTotal)}
                            </div>
                          </div>
                          <div style={{ marginBottom: "1rem" }}>
                            {bill.items?.slice(0, 3).map((item, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "0.5rem 0",
                                  borderBottom: "1px solid #F3F4F6",
                                  fontFamily: "var(--font-nrt-reg)",
                                }}
                              >
                                <span style={{ fontSize: "0.85rem", color: colorScheme.text, flex: 1 }}>{item.name}</span>
                                <span style={{ fontSize: "0.75rem", color: colorScheme.textLight }}>
                                  x{item.quantity} • {formatCurrency(item.basePrice || item.netPrice || 0)}
                                </span>
                              </div>
                            ))}
                            {bill.items?.length > 3 && (
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: colorScheme.textLight,
                                  textAlign: "center",
                                  padding: "0.5rem",
                                  background: "#F9FAFB",
                                  borderRadius: "0.25rem",
                                  marginTop: "0.5rem",
                                  fontFamily: "var(--font-nrt-reg)",
                                }}
                              >
                                +{bill.items.length - 3} more items
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "0.75rem",
                              color: colorScheme.textLight,
                              paddingTop: "0.5rem",
                              borderTop: "1px solid #E5E7EB",
                              fontFamily: "var(--font-nrt-reg)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: colorScheme.success }}></span>
                              Paid in this payment
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Returns Section */}
              {paymentDetails[selectedPayment.id]?.returns?.length > 0 && (
                <div
                  style={{
                    background: "#F8FAFC",
                    borderRadius: "1rem",
                    padding: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1.5rem",
                      paddingBottom: "1rem",
                      borderBottom: `2px solid ${colorScheme.secondary}`,
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: "600",
                        color: colorScheme.text,
                        margin: 0,
                        fontFamily: "var(--font-nrt-bd)",
                      }}
                    >
                      Returns ({paymentDetails[selectedPayment.id].returns.length})
                    </h4>
                    <span
                      style={{
                        fontWeight: "600",
                        color: colorScheme.textLight,
                        fontFamily: "var(--font-nrt-reg)",
                      }}
                    >
                      Total: -{formatCurrency(selectedPayment.returnTotal || 0)}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
                    {paymentDetails[selectedPayment.id].returns.map((r) => {
                      const returnTotal =
                        r.totalReturn ||
                        (r.items
                          ? r.items.reduce((sum, item) => sum + ((item.returnPrice || 0) * (item.returnQuantity || 0)), 0)
                          : (r.returnPrice || 0) * (r.returnQuantity || 0));
                      return (
                        <div
                          key={r.id}
                          style={{
                            background: "white",
                            borderRadius: "0.75rem",
                            padding: "1.25rem",
                            border: `1px solid #E5E7EB`,
                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                            borderLeft: `4px solid ${colorScheme.secondary}`,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontWeight: "600",
                                  color: colorScheme.text,
                                  fontSize: "1rem",
                                  marginBottom: "0.25rem",
                                  fontFamily: "var(--font-nrt-bd)",
                                }}
                              >
                                Return #{r.returnNumber || r.id?.slice(-6) || "N/A"}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  color: colorScheme.textLight,
                                  fontFamily: "var(--font-nrt-reg)",
                                }}
                              >
                                {formatDateToDMY(r.date)}
                              </div>
                            </div>
                            <div
                              style={{
                                fontWeight: "bold",
                                color: colorScheme.danger,
                                fontSize: "1.25rem",
                                fontFamily: "var(--font-nrt-bd)",
                              }}
                            >
                              -{formatCurrency(returnTotal)}
                            </div>
                          </div>
                          <div style={{ marginBottom: "1rem" }}>
                            {r.items?.slice(0, 3).map((item, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "0.5rem 0",
                                  borderBottom: "1px solid #F3F4F6",
                                  fontFamily: "var(--font-nrt-reg)",
                                }}
                              >
                                <span style={{ fontSize: "0.85rem", color: colorScheme.text, flex: 1 }}>{item.name}</span>
                                <span style={{ fontSize: "0.75rem", color: colorScheme.danger }}>
                                  x{item.returnQuantity} • -{formatCurrency(item.returnPrice || 0)}
                                </span>
                              </div>
                            ))}
                            {r.items?.length > 3 && (
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: colorScheme.textLight,
                                  textAlign: "center",
                                  padding: "0.5rem",
                                  background: "#F9FAFB",
                                  borderRadius: "0.25rem",
                                  marginTop: "0.5rem",
                                  fontFamily: "var(--font-nrt-reg)",
                                }}
                              >
                                +{r.items.length - 3} more items
                              </div>
                            )}
                            {!r.items && (
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "0.5rem 0",
                                  borderBottom: "1px solid #F3F4F6",
                                  fontFamily: "var(--font-nrt-reg)",
                                }}
                              >
                                <span style={{ fontSize: "0.85rem", color: colorScheme.text, flex: 1 }}>{r.name}</span>
                                <span style={{ fontSize: "0.75rem", color: colorScheme.danger }}>
                                  x{r.returnQuantity} • -{formatCurrency(r.returnPrice || 0)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "0.75rem",
                              color: colorScheme.textLight,
                              paddingTop: "0.5rem",
                              borderTop: "1px solid #E5E7EB",
                              fontFamily: "var(--font-nrt-reg)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: colorScheme.success }}></span>
                              Processed in this payment
                            </div>
                            {r.billNumber && (
                              <div style={{ color: colorScheme.textLight }}>From Bill: {r.billNumber}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {/* Notes Section */}
            {selectedPayment.notes && (
              <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #E5E7EB" }}>
                <h4
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: colorScheme.text,
                    marginBottom: "1rem",
                    fontFamily: "var(--font-nrt-bd)",
                  }}
                >
                  Notes
                </h4>
                <div
                  style={{
                    background: "#FFFBEB",
                    border: `1px solid ${colorScheme.warning}`,
                    borderRadius: "0.75rem",
                    padding: "1.25rem",
                    color: "#92400E",
                    fontSize: "0.9rem",
                    lineHeight: "1.6",
                    fontFamily: "var(--font-nrt-reg)",
                  }}
                >
                  {selectedPayment.notes}
                </div>
              </div>
            )}
          </div>
          <div
            style={{
              padding: "1.5rem 2rem",
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={closePaymentModal}
              style={{
                padding: "0.75rem 1.5rem",
                background: `linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.dark} 100%)`,
                color: "white",
                borderRadius: "0.75rem",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s",
                border: "none",
                fontSize: "1rem",
                fontFamily: "var(--font-nrt-bd)",
              }}
              onMouseOver={(e) => {
                e.target.style.transform = "translateY(-1px)";
                e.target.style.boxShadow = "0 4px 12px rgba(139, 92, 246, 0.3)";
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "none";
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

 {/* Global Styles */}
 <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.3s ease-in;
        }
      `}</style>
    </div>
  );
}