"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import PaymentBill from "@/components/PaymentBill";
import {
  createPayment,
  getPharmacies,
  getPharmacySoldBills,
  getPharmacyReturns,
  formatDate,
  getPaymentDetails,
  updatePayment,
  getPayments,
  getSoldBills,
  getReturnsForPharmacy
} from "@/lib/data";

export default function PaymentManagementPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState("");
  const [soldBills, setSoldBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedSoldBills, setSelectedSoldBills] = useState([]);
  const [selectedReturns, setSelectedReturns] = useState([]);
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
    pharmacyName: "",
    hardcopyBillNumber: "",
    soldBillNumber: "",
    returnedBillNumber: "",
    notes: "",
    dateFrom: "",
    dateTo: "",
    amountFrom: "",
    amountTo: ""
  });
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [amountRange, setAmountRange] = useState([0, 50000000]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBillData, setPaymentBillData] = useState(null);
  const hardcopyBillNumberRef = useRef(null);
  const pharmacySelectRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  // Format currency with commas and IQD
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US').format(amount || 0) + " IQD";
  };

  // Format date to dd/mm/yyyy
  const formatDateToDMY = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Parse date from dd/mm/yyyy to Date object
  const parseDMYToDate = (dateString) => {
    if (!dateString) return null;
    const [day, month, year] = dateString.split('/');
    return new Date(year, month - 1, day);
  };

  // Load data on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId) {
      setIsEditMode(true);
      setEditPaymentId(editId);
    }
    loadPaymentHistory();
    loadPharmacies();
  }, []);

  // Load pharmacies
  const loadPharmacies = async () => {
    try {
      const pharmaciesData = await getPharmacies();
      setPharmacies(pharmaciesData);
    } catch (error) {
      console.error("Error loading pharmacies:", error);
      setError("Failed to load pharmacies");
    }
  };

  // Load payment history
  const loadPaymentHistory = async () => {
    try {
      setHistoryLoading(true);
      const paymentsData = await getPayments();
      setPaymentHistory(paymentsData);
      if (paymentsData.length > 0) {
        const amounts = paymentsData.map(p => p.netAmount || 0);
        const maxAmount = Math.max(...amounts);
        setAmountRange([0, Math.ceil(maxAmount / 1000000) * 1000000]);
      }
    } catch (error) {
      console.error("Error loading payments:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load payment for edit
  useEffect(() => {
    const loadPaymentForEdit = async () => {
      if (!isEditMode || !editPaymentId) return;
      try {
        setLoading(true);
        setError(null);
        const paymentToEdit = await getPaymentDetails(editPaymentId);
        if (paymentToEdit) {
          setSelectedPharmacy(paymentToEdit.pharmacyId);
          setHardcopyBillNumber(paymentToEdit.hardcopyBillNumber);
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
          setSelectedSoldBills(paymentToEdit.selectedSoldBills || []);
          setSelectedReturns(paymentToEdit.selectedReturns || []);
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

  // Load pharmacy data
  useEffect(() => {
    if (!selectedPharmacy) {
      setSoldBills([]);
      setReturns([]);
      if (!isEditMode) {
        setHardcopyBillNumber("");
      }
      return;
    }
    const loadPharmacyData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [allSoldBills, allReturns] = await Promise.all([
          getPharmacySoldBills(selectedPharmacy, isEditMode ? selectedSoldBills : []),
          getPharmacyReturns(selectedPharmacy, isEditMode ? selectedReturns : [])
        ]);
        setSoldBills(allSoldBills);
        setReturns(allReturns);
      } catch (error) {
        console.error("Error loading pharmacy data:", error);
        setError("Failed to load pharmacy data");
      } finally {
        setLoading(false);
      }
    };
    loadPharmacyData();
  }, [selectedPharmacy, isEditMode, initialLoadComplete]);

  // Load payment details
  const loadPaymentDetails = async (paymentId) => {
    try {
      const payment = paymentHistory.find(p => p.id === paymentId);
      if (!payment) return { soldBills: [], returns: [] };
      const soldBills = await getSoldBills();
      const returns = await getReturnsForPharmacy(payment.pharmacyId);
      const soldDetails = soldBills.filter(bill => payment.selectedSoldBills?.includes(bill.id));
      const returnDetails = returns.filter(r => payment.selectedReturns?.includes(r.id));
      setPaymentDetails(prev => ({
        ...prev,
        [paymentId]: { soldBills: soldDetails, returns: returnDetails }
      }));
      return { soldBills: soldDetails, returns: returnDetails };
    } catch (error) {
      console.error("Error loading payment details:", error);
      return { soldBills: [], returns: [] };
    }
  };

  // Calculate totals
  const soldTotal = selectedSoldBills.reduce((total, billId) => {
    const bill = soldBills.find(b => b.id === billId);
    return total + (bill?.totalAmount || 0);
  }, 0);

  const returnTotal = selectedReturns.reduce((total, returnId) => {
    const returnBill = returns.find(r => r.id === returnId);
    return total + (returnBill?.totalReturn || 0);
  }, 0);

  const totalAfterReturn = soldTotal - returnTotal;

  // Toggle bill/return selection
  const toggleSoldBill = (billId) => {
    setSelectedSoldBills(prev =>
      prev.includes(billId)
        ? prev.filter(id => id !== billId)
        : [...prev, billId]
    );
  };

  const toggleReturn = (returnId) => {
    setSelectedReturns(prev =>
      prev.includes(returnId)
        ? prev.filter(id => id !== returnId)
        : [...prev, returnId]
    );
  };

  // Select all bills/returns
  const selectAllSoldBills = () => {
    if (selectedSoldBills.length === soldBills.length) {
      setSelectedSoldBills([]);
    } else {
      setSelectedSoldBills(soldBills.map(bill => bill.id));
    }
  };

  const selectAllReturns = () => {
    if (selectedReturns.length === returns.length) {
      setSelectedReturns([]);
    } else {
      setSelectedReturns(returns.map(returnBill => returnBill.id));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    let hasError = false;

    if (!selectedPharmacy) {
      setError("Please select a pharmacy");
      pharmacySelectRef.current?.focus();
      pharmacySelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasError = true;
    }

    if (!hardcopyBillNumber.trim()) {
      setError("Hardcopy Bill Number is required");
      hardcopyBillNumberRef.current?.focus();
      hardcopyBillNumberRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasError = true;
    }

    if (selectedSoldBills.length === 0 && selectedReturns.length === 0) {
      setError("Please select at least one bill or return to process");
      hasError = true;
    }

    if (hasError) return;

    try {
      setSubmitting(true);
      setError(null);
      const selectedPharmacyData = pharmacies.find(p => p.id === selectedPharmacy);
      const userDisplayName = user?.name || user?.email || 'Unknown User';
      const paymentData = {
        pharmacyId: selectedPharmacy,
        pharmacyName: selectedPharmacyData?.name || 'Unknown Pharmacy',
        selectedSoldBills: selectedSoldBills,
        selectedReturns: selectedReturns,
        soldTotal: soldTotal,
        returnTotal: returnTotal,
        netAmount: totalAfterReturn,
        paymentDate: new Date(paymentDate),
        hardcopyBillNumber: hardcopyBillNumber.trim(),
        notes: notes,
        createdBy: user.uid,
        createdByName: userDisplayName
      };

      let result;
      if (isEditMode) {
        result = await updatePayment(editPaymentId, paymentData);
        setSuccess(`Payment ${result.paymentNumber} updated successfully!`);
      } else {
        result = await createPayment(paymentData);
        setSuccess(`Payment ${result.paymentNumber} created successfully!`);
      }

      // Get the selected sold bills and returns data
      const selectedSoldBillsData = soldBills.filter(bill => selectedSoldBills.includes(bill.id));
      const selectedReturnsData = returns.filter(returnBill => selectedReturns.includes(returnBill.id));

      // Prepare the data for printing
      const billPrintData = {
        pharmacyName: selectedPharmacyData?.name || "Unknown Pharmacy",
        pharmacyCode: selectedPharmacyData?.code || "N/A",
        soldBills: selectedSoldBillsData,
        returns: selectedReturnsData,
        hardcopyBillNumber,
        paymentNumber: result.paymentNumber,
        soldTotal,
        returnTotal,
        netAmount: totalAfterReturn,
        createdByName: userDisplayName,
        paymentDate: new Date(paymentDate),
        notes,
      };

      // Set the data and trigger print
      setPaymentBillData(billPrintData);
      setTimeout(() => {
        window.print();
      }, 300);

      if (!isEditMode) {
        setSelectedSoldBills([]);
        setSelectedReturns([]);
        setHardcopyBillNumber("");
        setNotes("");
      }
      await loadPaymentHistory();
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} payment:`, error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

// Quick Print Function with Beautiful Advanced Design
const printPaymentQuick = async (payment) => {
  try {
    setError(null);
    setSuccess(`Printing ${payment.paymentNumber}...`);
    
    // Get details quickly
    const details = await loadPaymentDetails(payment.id);
    const selectedPharmacyData = pharmacies.find(p => p.id === payment.pharmacyId);
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Format functions
    const formatCurrencyForPrint = (amount) => {
      return new Intl.NumberFormat('en-US').format(amount || 0) + " IQD";
    };
    
    const formatDateForPrint = (date) => {
      if (!date) return "";
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return "";
      }
    };
    
    // Calculate bill total with fallback
    const calculateBillTotal = (bill) => {
      if (bill.totalAmount) return bill.totalAmount;
      if (bill.items && Array.isArray(bill.items)) {
        return bill.items.reduce((sum, item) => {
          const price = item.price || item.unitPrice || 0;
          const quantity = item.quantity || 1;
          return sum + (price * quantity);
        }, 0);
      }
      return 0;
    };
    
    // Calculate return total with fallback - FIXED to handle 0 values
    const calculateReturnTotal = (ret) => {
      if (ret.totalReturn !== undefined && ret.totalReturn !== null) {
        return ret.totalReturn;
      }
      if (ret.amount !== undefined && ret.amount !== null) {
        return ret.amount;
      }
      if (ret.total !== undefined && ret.total !== null) {
        return ret.total;
      }
      if (ret.items && Array.isArray(ret.items)) {
        return ret.items.reduce((sum, item) => {
          const price = item.returnPrice || item.price || item.unitPrice || 0;
          const quantity = item.returnQuantity || item.quantity || 1;
          return sum + (price * quantity);
        }, 0);
      }
      return 0;
    };
    
    // Create the HTML content with advanced design
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Receipt - ${payment.paymentNumber}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #1a202c;
            background: white;
            font-size: 10px;
            line-height: 1.25;
          }
          .container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 12mm;
            box-sizing: border-box;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 15px;
            padding: 12px 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 8px;
            color: white;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
          }
          .logo {
            width: 45px;
            height: 45px;
            object-fit: contain;
            background-color: white;
            padding: 5px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .info-card {
            background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(253, 160, 133, 0.2);
          }
          .payment-card {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(168, 237, 234, 0.2);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
            margin: 5px 0;
          }
          th {
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
          }
          .sold-header {
            background: linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%);
            color: #22543d;
            border-bottom: 2px solid #38b2ac;
          }
          .return-header {
            background: linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%);
            color: #742a2a;
            border-bottom: 2px solid #fc8181;
          }
          td {
            padding: 7px 6px;
            border-bottom: 1px solid #edf2f7;
          }
          .summary-box {
            margin: 15px 0;
            padding: 15px;
            background: linear-gradient(135deg, #4c51bf 0%, #2d3748 100%);
            border-radius: 10px;
            color: white;
            text-align: center;
            box-shadow: 0 4px 15px rgba(76, 81, 191, 0.3);
          }
          .net-amount {
            font-size: 28px;
            font-weight: 800;
            margin: 10px 0;
            color: white;
            text-shadow: 0 3px 6px rgba(0,0,0,0.4);
          }
          .section-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding: 8px 10px;
            border-radius: 6px;
            color: white;
            box-shadow: 0 2px 8px rgba(56, 178, 172, 0.2);
          }
          .sold-title {
            background: linear-gradient(135deg, #38b2ac 0%, #319795 100%);
          }
          .return-title {
            background: linear-gradient(135deg, #fc8181 0%, #f56565 100%);
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 9px 12px;
            border-top: 2px solid;
          }
          .sold-total {
            background: linear-gradient(135deg, #9ae6b4 0%, #68d391 100%);
            border-top-color: #38b2ac;
          }
          .return-total {
            background: linear-gradient(135deg, #feb2b2 0%, #fc8181 100%);
            border-top-color: #fc8181;
          }
          .index-circle {
            width: 16px;
            height: 16px;
            background-color: #38b2ac;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            font-weight: bold;
          }
          .return-circle {
            background-color: #fc8181;
          }
          @media print {
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header - Logo and Store Name -->
          <div class="header">
            <div style="display: flex; align-items: center; gap: 12px;">
             
              <div>
                <div style="font-size: 18px; font-weight: 700; margin: 0 0 2px 0; letter-spacing: 0.3px;">
                  ARAN MED STORE
                </div>
                <div style="font-size: 9px; opacity: 0.9;">
                  Sulaymaniyah • Opposite Smart Health Tower • +964 772 533 5252
                </div>
              </div>
            </div>
            
            <div style="text-align: right;">
        <img src="/Aranlogo.png" alt="Aran Med Store Logo" class="" style="width:150px">
            </div>
          </div>
          
          <!-- Pharmacy & Payment Info -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
            <div class="info-card">
              <div style="font-size: 10px; font-weight: 600; margin-bottom: 6px; color: #7b341e; display: flex; align-items: center; gap: 5px;">
                <span>🏥</span> Pharmacy Details
              </div>
              <div style="font-size: 9px; color: #744210;">
                <div><strong>Name:</strong> ${payment.pharmacyName}</div>
                <div><strong>Code:</strong> ${selectedPharmacyData?.code || "PH-" + (payment.pharmacyId?.slice(-4) || "N/A")}</div>
                <div><strong>Hardcopy payment number:</strong> ${payment.hardcopyBillNumber}</div>
              </div>
            </div>
            
            <div class="payment-card">
              <div style="font-size: 10px; font-weight: 600; margin-bottom: 6px; color: #2d3748; display: flex; align-items: center; gap: 5px;">
                <span>👤</span> Payment Details
              </div>
              <div style="font-size: 9px; color: #4a5568;">
                <div><strong>Processed By:</strong> ${payment.createdByName}</div>
                <div><strong>Payment Date:</strong> ${formatDateForPrint(payment.paymentDate)}</div>
                <div><strong>system payment number: </strong> ${payment.paymentNumber}</div>
              </div>
            </div>
          </div>
          
          <!-- Sold Bills Section -->
          ${details?.soldBills?.length > 0 ? `
            <div style="margin-bottom: 15px;">
              
              <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                <table>
                  <thead>
                    <tr class="sold-header">
                      <th>Bill # 💰 PAID SOLD BILLS (${details.soldBills.length})</th>
                      <th style="text-align: center;">Date</th>
                      <th style="text-align: right;">Amount (IQD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${details.soldBills.map((bill, index) => {
                      const billTotal = calculateBillTotal(bill);
                      return `
                        <tr style="border-bottom: 1px solid #edf2f7; background-color: ${index % 2 === 0 ? 'white' : '#f7fafc'};">
                          <td>
                            <div style="display: flex; align-items: center; gap: 4px;">
                              <div class="index-circle">${index + 1}</div>
                              ${bill.billNumber || 'BILL-' + (index + 1)}
                            </div>
                          </td>
                          <td style="text-align: center; color: #4a5568;">
                            ${formatDateForPrint(bill.date)}
                          </td>
                          <td style="text-align: right; font-weight: 600; color: #22543d;">
                            ${formatCurrencyForPrint(billTotal)}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
                
                <div class="total-row sold-total">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 18px; height: 18px; background-color: #22543d; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px;">∑</div>
                    <span style="font-size: 10px; font-weight: 600; color: #22543d;">
                      Total Sold Amount:
                    </span>
                  </div>
                  <span style="font-size: 12px; font-weight: 700; color: #22543d; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                    ${formatCurrencyForPrint(payment.soldTotal)}
                  </span>
                </div>
              </div>
            </div>
          ` : ''}
          
          <!-- Returns Section -->
          ${details?.returns?.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                <table>
                  <thead>
                    <tr class="return-header">
                      <th>Return #  🔄 PROCESSED RETURNS (${details.returns.length})</th>
                      <th style="text-align: center;">Date</th>
                      <th style="text-align: right;">Amount (IQD)</th>
                    </tr>
                  </thead>
                <tbody>
  ${details.returns.map((ret, index) => {
    // Calculate return total with better fallback logic
    let returnTotal = calculateReturnTotal(ret);
    
    // Get return number - use pharmacyReturnNumber if available
    const returnNumber = ret.pharmacyReturnNumber || ret.returnNumber || ret.returnId || 'RET-' + (ret.id ? ret.id.slice(-4) : index + 1);
    const fromBill = ret.billNumber ? '<span style="font-size: 8px; color: #718096; background-color: #edf2f7; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">From: ' + ret.billNumber + '</span>' : '';
    return `
      <tr style="border-bottom: 1px solid #edf2f7; background-color: ${index % 2 === 0 ? 'white' : '#f7fafc'};">
        <td>
          <div style="display: flex; align-items: center; gap: 4px;">
            <div class="index-circle return-circle">${index + 1}</div>
            ${returnNumber}
            ${fromBill}
          </div>
        </td>
        <td style="text-align: center; color: #4a5568;">
          ${formatDateForPrint(ret.date)}
        </td>
        <td style="text-align: right; font-weight: 600; color: #742a2a;">
          ${returnTotal > 0 ? '-' : ''}${formatCurrencyForPrint(returnTotal)}
        </td>
      </tr>
    `;
  }).join('')}
</tbody>
                </table>
                
                <div class="total-row return-total">
                  <div style="display: flex; align-items: center; gap: 6px;">

                    <span style="font-size: 10px; font-weight: 600; color: #742a2a;">
                      Total Returns:
                    </span>
                  </div>
                  <span style="font-size: 12px; font-weight: 700; color: #742a2a; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                    ${payment.returnTotal > 0 ? '-' : ''}${formatCurrencyForPrint(payment.returnTotal)}
                  </span>
                </div>
              </div>
            </div>
          ` : ''}
          
          <!-- Payment Summary -->
<div style="border-top: 2px solid rgba(255,255,255,0.3); padding-top: 15px; margin-top: 10px; text-align: center;">
  <div style="font-size: 11px; margin-bottom: 10px; opacity: 0.9; letter-spacing: 1px; font-family: 'NRT-Bd', sans-serif;">
    NET AMOUNT PAYABLE
  </div>
  <div class="" style="font-size: 28px; font-weight: 800; color: white; font-family: 'NRT-Bd', sans-serif;">
    ${formatCurrencyForPrint(payment.netAmount)}
  </div>
  <div style="font-size: 9px; opacity: 0.8; font-style: italic; margin-top: 5px; font-family: 'NRT-Reg', sans-serif;">
    
  </div>
</div>
          
          ${payment.notes ? `
            <!-- Notes -->
            <div style="margin-bottom: 12px; padding: 10px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; border-left: 4px solid #f59e0b;">
              <div style="font-size: 10px; font-weight: 600; color: #92400e; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
                <span>📝</span> NOTES
              </div>
              <div style="font-size: 9px; color: #92400e; font-style: italic;">
                ${payment.notes}
              </div>
            </div>
          ` : ''}
          

          
         
          
          <!-- Signature Area -->
        
          <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 15px; border-top: 1px dashed #cbd5e0;">
            <div style="text-align: center; width: 45%;">
              <div style="border-bottom: 1px solid #94a3b8; padding-bottom: 12px; margin-bottom: 8px; height: 18px;"></div>
              <div style="font-size: 9px; font-weight: 600; color: #4a5568;">Customer Signature</div>
              <div style="font-size: 8px; color: #94a3b8;">توقيع العميل</div>
            </div>
            
            <div style="text-align: center; width: 45%;">
              <div style="border-bottom: 1px solid #94a3b8; padding-bottom: 12px; margin-bottom: 8px; height: 18px;"></div>
              <div style="font-size: 9px; font-weight: 600; color: #4a5568;">Authorized Signatory</div>
              <div style="font-size: 8px; color: #94a3b8;">${payment.createdByName}</div>
            </div>
          </div>
           <!-- Footer -->
          <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 8px; color: #718096; text-align: center;">
            <div style="margin-bottom: 5px; font-weight: 600; font-size: 9px; color: #4a5568;">
              ARAN MED STORE • Official Payment Receipt
            </div>
            <div>
              System-generated receipt • Valid for accounting <br>
              For inquiries: +964 772 533 5252 • Receipt ID: ${payment.paymentNumber}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Write and print
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Focus and print
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
        setSuccess(`Payment ${payment.paymentNumber} printed successfully!`);
      };
    }, 500);
    
  } catch (error) {
    console.error("Print error:", error);
    setError("Failed to print");
  }
};

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditPaymentId(null);
    setSelectedSoldBills([]);
    setSelectedReturns([]);
    setHardcopyBillNumber("");
    setNotes("");
    window.history.replaceState({}, '', '/payments/create');
  };

  // Update payment
  const handleUpdatePayment = (payment) => {
    setIsEditMode(true);
    setEditPaymentId(payment.id);
    setSelectedPharmacy(payment.pharmacyId);
    setHardcopyBillNumber(payment.hardcopyBillNumber);
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
    setSelectedSoldBills(payment.selectedSoldBills || []);
    setSelectedReturns(payment.selectedReturns || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // View payment details
  const handleViewPayment = async (payment) => {
    setSelectedPayment(payment);
    await loadPaymentDetails(payment.id);
    setShowPaymentModal(true);
  };

  // Close modal
  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedPayment(null);
  };

  // Advanced search
  const handleAdvancedSearchChange = (field, value) => {
    setAdvancedSearch(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Amount range
  const handleAmountRangeChange = (values) => {
    setAmountRange(values);
    setAdvancedSearch(prev => ({
      ...prev,
      amountFrom: values[0],
      amountTo: values[1]
    }));
  };

  // Reset advanced search
  const resetAdvancedSearch = () => {
    setAdvancedSearch({
      pharmacyName: "",
      hardcopyBillNumber: "",
      soldBillNumber: "",
      returnedBillNumber: "",
      notes: "",
      dateFrom: "",
      dateTo: "",
      amountFrom: "",
      amountTo: ""
    });
    setAmountRange([0, 50000000]);
  };

  // Filter payments
  const filteredPayments = paymentHistory.filter(payment => {
    const basicSearch = searchTerm === "" ||
      payment.paymentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.pharmacyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.createdByName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.hardcopyBillNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const statusFilter = filterStatus === "all" || payment.status === filterStatus;

    let advancedFilter = true;
    if (showAdvancedSearch) {
      if (advancedSearch.pharmacyName && !payment.pharmacyName?.toLowerCase().includes(advancedSearch.pharmacyName.toLowerCase())) {
        advancedFilter = false;
      }
      if (advancedSearch.hardcopyBillNumber && !payment.hardcopyBillNumber?.toLowerCase().includes(advancedSearch.hardcopyBillNumber.toLowerCase())) {
        advancedFilter = false;
      }
      if (advancedSearch.soldBillNumber) {
        const hasSoldBill = paymentDetails[payment.id]?.soldBills?.some(bill =>
          bill.billNumber?.toLowerCase().includes(advancedSearch.soldBillNumber.toLowerCase())
        );
        if (!hasSoldBill) advancedFilter = false;
      }
      if (advancedSearch.returnedBillNumber) {
        const hasReturnBill = paymentDetails[payment.id]?.returns?.some(returnBill =>
          returnBill.returnNumber?.toLowerCase().includes(advancedSearch.returnedBillNumber.toLowerCase()) ||
          returnBill.billNumber?.toLowerCase().includes(advancedSearch.returnedBillNumber.toLowerCase())
        );
        if (!hasReturnBill) advancedFilter = false;
      }
      if (advancedSearch.notes && !payment.notes?.toLowerCase().includes(advancedSearch.notes.toLowerCase())) {
        advancedFilter = false;
      }
      if (advancedSearch.dateFrom) {
        const paymentDate = new Date(payment.paymentDate);
        const fromDate = parseDMYToDate(advancedSearch.dateFrom);
        if (fromDate && paymentDate < fromDate) advancedFilter = false;
      }
      if (advancedSearch.dateTo) {
        const paymentDate = new Date(payment.paymentDate);
        const toDate = parseDMYToDate(advancedSearch.dateTo);
        if (toDate) {
          toDate.setHours(23, 59, 59, 999);
          if (paymentDate > toDate) advancedFilter = false;
        }
      }
      const paymentAmount = payment.netAmount || 0;
      if (advancedSearch.amountFrom && paymentAmount < advancedSearch.amountFrom) {
        advancedFilter = false;
      }
      if (advancedSearch.amountTo && paymentAmount > advancedSearch.amountTo) {
        advancedFilter = false;
      }
    }

    return basicSearch && statusFilter && advancedFilter;
  });

  // Total amount
  const totalAmount = filteredPayments.reduce((sum, payment) => sum + payment.netAmount, 0);

  return (
    <div
      className="payment-container bg-gradient-blue"
      style={{
        minHeight: '100vh',
        padding: '1rem',
        fontFamily: "var(--font-nrt-reg)"
      }}
    >
      {/* Header */}
      <div className="payment-header">
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: "bold",
            marginBottom: "1rem",
            color: "#1e293b",
            fontFamily: "var(--font-nrt-bd)"
          }}
        >
          {isEditMode ? 'Update Payment' : 'Payment Management'}
        </h1>
        {isEditMode && (
          <div style={{
            marginTop: "0.5rem",
            padding: "0.75rem",
            backgroundColor: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: "0.375rem",
            fontFamily: "var(--font-nrt-reg)"
          }}>
            <p style={{ color: "#92400e", fontSize: "0.875rem", margin: 0 }}>
              <strong>Edit Mode:</strong> You are updating an existing payment. Previously selected items are shown and can be modified.
            </p>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div style={{
          padding: "1rem",
          backgroundColor: "#fca5a5",
          color: "#991b1b",
          borderRadius: "0.375rem",
          marginBottom: "1rem",
          fontFamily: "var(--font-nrt-reg)"
        }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg
              style={{ width: '1.5rem', height: '1.5rem', marginRight: '0.75rem' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 style={{ fontWeight: '600', color: '#dc2626', margin: 0, fontFamily: "var(--font-nrt-bd)" }}>Error</h3>
              <p style={{ color: '#dc2626', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div style={{
          padding: "1rem",
          backgroundColor: "#dcfce7",
          color: "#166534",
          borderRadius: "0.375rem",
          marginBottom: "1rem",
          fontFamily: "var(--font-nrt-reg)"
        }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg
              style={{ width: '1.5rem', height: '1.5rem', marginRight: '0.75rem' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <h3 style={{ fontWeight: '600', color: '#16a34a', margin: 0, fontFamily: "var(--font-nrt-bd)" }}>Success!</h3>
              <p style={{ color: '#16a34a', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Create/Update Payment Section */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "1rem",
        marginBottom: "2rem"
      }}>
        {/* Pharmacy Information - Full Width */}
        <div style={{
          width: "100%",
          backgroundColor: "#fff",
          borderRadius: "0.5rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          padding: "1.5rem",
          fontFamily: "var(--font-nrt-reg)"
        }}>
          <h2 style={{
            fontSize: "1.25rem",
            fontWeight: "bold",
            marginBottom: "1rem",
            color: "#1e293b",
            fontFamily: "var(--font-nrt-bd)"
          }}>
            Pharmacy Information
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
            <div style={{ width: "100%" }}>
              <label style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "0.25rem",
                fontFamily: "var(--font-nrt-bd)"
              }}>
                Select Pharmacy
              </label>
              <select
                ref={pharmacySelectRef}
                value={selectedPharmacy}
                onChange={(e) => setSelectedPharmacy(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: !selectedPharmacy ? "1px solid #ef4444" : "1px solid #e2e8f0",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)"
                }}
                required
              >
                <option value="">Choose a pharmacy...</option>
                {pharmacies.map(pharmacy => (
                  <option key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name} ({pharmacy.code})
                  </option>
                ))}
              </select>
              {isEditMode && (
                <p style={{
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  marginTop: "0.25rem",
                  fontFamily: "var(--font-nrt-reg)"
                }}>
                  Pharmacy cannot be changed in edit mode
                </p>
              )}
            </div>
            <div style={{ width: "100%" }}>
              <label style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "0.25rem",
                fontFamily: "var(--font-nrt-bd)"
              }}>
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
                  border: !hardcopyBillNumber.trim() ? "1px solid #ef4444" : "1px solid #e2e8f0",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)"
                }}
                placeholder="Enter hardcopy bill number (e.g., BILL-001, INV-2024-001)"
                required
              />
            </div>
            <div style={{ width: "100%" }}>
              <label style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "0.25rem",
                fontFamily: "var(--font-nrt-bd)"
              }}>
                Payment Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)"
                }}
                required
              />
            </div>
          </div>
        </div>

        {/* Sold Bills and Returns - Next Row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          width: "100%"
        }}>
          {/* Sold Bills Section */}
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "0.5rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            padding: "1.5rem",
            fontFamily: "var(--font-nrt-reg)"
          }}>
            <div style={{
              backgroundColor: '#10b981',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              marginBottom: "1rem"
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: 'white',
                  margin: 0,
                  fontFamily: "var(--font-nrt-bd)"
                }}>
                  Sold Bills ({soldBills.length})
                </h2>
                {!isEditMode && (
                  <button
                    onClick={selectAllSoldBills}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "var(--font-nrt-reg)"
                    }}
                  >
                    {selectedSoldBills.length === soldBills.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
            </div>
            <div style={{ padding: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div className="loading-spinner" style={{ width: '2rem', height: '2rem', borderTopColor: '#10b981', margin: '0 auto' }}></div>
                  <p style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.875rem', fontFamily: "var(--font-nrt-reg)" }}>Loading bills...</p>
                </div>
              ) : soldBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ fontSize: '2rem', color: '#9ca3af', marginBottom: '0.5rem' }}>📄</div>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', fontFamily: "var(--font-nrt-reg)" }}>
                    {selectedPharmacy ? "No unpaid bills available" : "Select pharmacy"}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {soldBills.map((bill) => (
                    <div
                      key={bill.id}
                      onClick={() => toggleSoldBill(bill.id)}
                      style={{
                        padding: '0.75rem',
                        marginBottom: '0',
                        border: selectedSoldBills.includes(bill.id) ? '2px solid #10b981' : '1px solid #e5e7eb',
                        backgroundColor: selectedSoldBills.includes(bill.id) ? '#f0fdf4' : 'white',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontFamily: "var(--font-nrt-reg)"
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.875rem', fontFamily: "var(--font-nrt-bd)" }}>Bill #{bill.billNumber}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>
                            {formatDate(bill.date)} • {bill.items.length} items
                          </div>
                          <div style={{ fontSize: '0.75rem', color: selectedSoldBills.includes(bill.id) ? '#10b981' : '#dc2626', marginTop: '0.25rem', fontWeight: '500', fontFamily: "var(--font-nrt-reg)" }}>
                            {selectedSoldBills.includes(bill.id) ? 'Selected for Payment' : 'Unpaid'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '0.5rem' }}>
                          <div style={{ fontWeight: 'bold', color: '#059669', fontSize: '0.875rem', fontFamily: "var(--font-nrt-bd)" }}>
                            {formatCurrency(bill.totalAmount)}
                          </div>
                          {selectedSoldBills.includes(bill.id) && (
                            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>
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
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "0.5rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            padding: "1.5rem",
            fontFamily: "var(--font-nrt-reg)"
          }}>
            <div style={{
              backgroundColor: '#f59e0b',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              marginBottom: "1rem"
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: 'white',
                  margin: 0,
                  fontFamily: "var(--font-nrt-bd)"
                }}>
                  Returns ({returns.length})
                </h2>
                {!isEditMode && (
                  <button
                    onClick={selectAllReturns}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "var(--font-nrt-reg)"
                    }}
                  >
                    {selectedReturns.length === returns.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
            </div>
            <div style={{ padding: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div className="loading-spinner" style={{ width: '2rem', height: '2rem', borderTopColor: '#f59e0b', margin: '0 auto' }}></div>
                  <p style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.875rem', fontFamily: "var(--font-nrt-reg)" }}>Loading returns...</p>
                </div>
              ) : returns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ fontSize: '2rem', color: '#9ca3af', marginBottom: '0.5rem' }}>🔄</div>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', fontFamily: "var(--font-nrt-reg)" }}>
                    {selectedPharmacy ? "No returns available" : "Select pharmacy"}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {returns.map((returnBill) => {
                    const returnId = returnBill.id;
                    // Use pharmacyReturnNumber if available, otherwise fall back to other identifiers
                    const returnNumber = returnBill.pharmacyReturnNumber || 
                                      returnBill.returnNumber || 
                                      (returnBill.id ? `Return #${returnBill.id.slice(-6)}` : 'Return #N/A');
                    const itemCount = returnBill.items ? returnBill.items.length : 1;
                    const returnAmount = returnBill.totalReturn || 0;
                    return (
                      <div
                        key={returnBill.id}
                        onClick={() => toggleReturn(returnBill.id)}
                        style={{
                          padding: '0.75rem',
                          marginBottom: '0',
                          border: selectedReturns.includes(returnBill.id) ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                          backgroundColor: selectedReturns.includes(returnBill.id) ? '#fffbeb' : 'white',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontFamily: "var(--font-nrt-reg)"
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.875rem', fontFamily: "var(--font-nrt-bd)" }}>
                              {returnNumber}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>
                              {formatDate(returnBill.date)} • {itemCount} items
                            </div>
                            {returnBill.billNumber && (
                              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>
                                From Bill: {returnBill.billNumber}
                              </div>
                            )}
                            <div style={{ fontSize: '0.75rem', color: selectedReturns.includes(returnBill.id) ? '#f59e0b' : '#dc2626', marginTop: '0.25rem', fontWeight: '500', fontFamily: "var(--font-nrt-reg)" }}>
                              {selectedReturns.includes(returnBill.id) ? 'Selected for Processing' : 'Unprocessed'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', marginLeft: '0.5rem' }}>
                            <div style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '0.875rem', fontFamily: "var(--font-nrt-bd)" }}>
                              {returnAmount > 0 ? '-' : ''}{formatCurrency(returnAmount)}
                            </div>
                            {selectedReturns.includes(returnBill.id) && (
                              <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>
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

        {/* Payment Summary and Notes - Same Row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          width: "100%"
        }}>
          {/* Payment Summary */}
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "0.5rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            padding: "1.5rem",
            fontFamily: "var(--font-nrt-reg)"
          }}>
            <h2 style={{
              fontSize: "1.25rem",
              fontWeight: "bold",
              marginBottom: "1rem",
              color: "#1e293b",
              fontFamily: "var(--font-nrt-bd)"
            }}>
              Payment Summary
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', width: '100%' }}>
                <span style={{ color: '#4b5563', fontSize: '0.875rem', fontFamily: "var(--font-nrt-reg)" }}>Sold Bills:</span>
                <span style={{ fontWeight: '600', color: '#059669', fontFamily: "var(--font-nrt-bd)" }}>
                  {formatCurrency(soldTotal)} ({selectedSoldBills.length} bill(s))
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', width: '100%' }}>
                <span style={{ color: '#4b5563', fontSize: '0.875rem', fontFamily: "var(--font-nrt-reg)" }}>Returns:</span>
                <span style={{ fontWeight: '600', color: '#dc2626', fontFamily: "var(--font-nrt-bd)" }}>
                  {returnTotal > 0 ? '-' : ''}{formatCurrency(returnTotal)} ({selectedReturns.length} return(s))
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderTop: '1px solid #e5e7eb', marginTop: '0.5rem', width: '100%' }}>
                <span style={{ fontWeight: 'bold', color: '#1f2937', fontFamily: "var(--font-nrt-bd)" }}>Net Amount:</span>
                <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#2563eb', fontFamily: "var(--font-nrt-bd)" }}>
                  {formatCurrency(totalAfterReturn)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "0.5rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            padding: "1.5rem",
            fontFamily: "var(--font-nrt-reg)"
          }}>
            <h2 style={{
              fontSize: "1.25rem",
              fontWeight: "bold",
              marginBottom: "1rem",
              color: "#1e293b",
              fontFamily: "var(--font-nrt-bd)"
            }}>
              Notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes about this payment..."
              style={{
                width: '100%',
                resize: 'vertical',
                minHeight: '80px',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontFamily: "var(--font-nrt-reg)"
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: "flex",
          gap: "0.5rem",
          width: "100%"
        }}>
          <button
            onClick={() => {
              setSelectedPharmacy("");
              setSelectedSoldBills([]);
              setSelectedReturns([]);
              setHardcopyBillNumber("");
              setNotes("");
              setError(null);
              setSuccess(null);
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontFamily: "var(--font-nrt-bd)"
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedPharmacy || !hardcopyBillNumber.trim() || (selectedSoldBills.length === 0 && selectedReturns.length === 0)}
            style={{
              flex: 2,
              padding: '0.75rem',
              backgroundColor: submitting ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontFamily: "var(--font-nrt-bd)"
            }}
          >
            {submitting ? (
              <>
                <div className="loading-spinner" style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem', borderTopColor: 'white' }}></div>
                {isEditMode ? 'Updating...' : 'Processing...'}
              </>
            ) : (
              `${isEditMode ? 'Update' : 'Create'} Payment - ${formatCurrency(totalAfterReturn)}`
            )}
          </button>
        </div>
      </div>

      {/* Payment Bill (Hidden, for printing) */}
      {paymentBillData && (
        <div style={{ display: 'none' }}>
          <PaymentBill {...paymentBillData} />
        </div>
      )}

      {/* Payment History Section */}
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "0.5rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        padding: "1.5rem",
        fontFamily: "var(--font-nrt-reg)"
      }}>
        <div style={{
          backgroundColor: '#3b82f6',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem 0.5rem 0 0',
          margin: '-1rem -1rem 1rem -1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: 'white',
              margin: 0,
              fontFamily: "var(--font-nrt-bd)"
            }}>
              Payment History
            </h2>
            <p style={{ color: '#bfdbfe', fontSize: '1rem', margin: 0, fontFamily: "var(--font-nrt-reg)" }}>View and manage all payment records</p>
          </div>
        </div>

        {/* Stats and Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "0.5rem",
              boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.1)",
              padding: '0.75rem 1rem',
              minWidth: '120px',
              fontFamily: "var(--font-nrt-reg)"
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: "var(--font-nrt-reg)" }}>Total Processed</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669', fontFamily: "var(--font-nrt-bd)" }}>{formatCurrency(totalAmount)}</div>
            </div>
            <div style={{
              backgroundColor: "#fff",
              borderRadius: "0.5rem",
              boxShadow: "0 2px 4px -1px rgba(0, 0, 0, 0.1)",
              padding: '0.75rem 1rem',
              minWidth: '120px',
              fontFamily: "var(--font-nrt-reg)"
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: "var(--font-nrt-reg)" }}>Total Payments</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#2563eb', fontFamily: "var(--font-nrt-bd)" }}>{filteredPayments.length}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '200px',
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontFamily: "var(--font-nrt-reg)"
              }}
            />
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontFamily: "var(--font-nrt-bd)"
              }}
            >
              {showAdvancedSearch ? 'Hide' : 'Advanced'} Search
            </button>
          </div>
        </div>

        {/* Advanced Search Panel */}
        {showAdvancedSearch && (
          <div style={{
            backgroundColor: "#f8fafc",
            borderRadius: "0.5rem",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            fontFamily: "var(--font-nrt-reg)"
          }}>
            <h3 style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              marginBottom: "1rem",
              color: "#1e293b",
              fontFamily: "var(--font-nrt-bd)"
            }}>
              Advanced Search
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Pharmacy Name</label>
                <input
                  type="text"
                  value={advancedSearch.pharmacyName}
                  onChange={(e) => handleAdvancedSearchChange('pharmacyName', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontFamily: "var(--font-nrt-reg)"
                  }}
                  placeholder="Enter pharmacy name"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Hardcopy Bill #</label>
                <input
                  type="text"
                  value={advancedSearch.hardcopyBillNumber}
                  onChange={(e) => handleAdvancedSearchChange('hardcopyBillNumber', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontFamily: "var(--font-nrt-reg)"
                  }}
                  placeholder="Enter bill number"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Sold Bill #</label>
                <input
                  type="text"
                  value={advancedSearch.soldBillNumber}
                  onChange={(e) => handleAdvancedSearchChange('soldBillNumber', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontFamily: "var(--font-nrt-reg)"
                  }}
                  placeholder="Enter sold bill number"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Returned Bill #</label>
                <input
                  type="text"
                  value={advancedSearch.returnedBillNumber}
                  onChange={(e) => handleAdvancedSearchChange('returnedBillNumber', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontFamily: "var(--font-nrt-reg)"
                  }}
                  placeholder="Enter returned bill number"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Notes</label>
                <input
                  type="text"
                  value={advancedSearch.notes}
                  onChange={(e) => handleAdvancedSearchChange('notes', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontFamily: "var(--font-nrt-reg)"
                  }}
                  placeholder="Search in notes"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Date From (dd/mm/yyyy)</label>
                <input
                  type="text"
                  value={advancedSearch.dateFrom}
                  onChange={(e) => handleAdvancedSearchChange('dateFrom', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontFamily: "var(--font-nrt-reg)"
                  }}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Date To (dd/mm/yyyy)</label>
                <input
                  type="text"
                  value={advancedSearch.dateTo}
                  onChange={(e) => handleAdvancedSearchChange('dateTo', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontFamily: "var(--font-nrt-reg)"
                  }}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>
                  Amount Range: {formatCurrency(amountRange[0])} - {formatCurrency(amountRange[1])}
                </label>
                <div style={{ position: 'relative', height: '40px', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="range"
                    min="0"
                    max="50000000"
                    step="10000"
                    value={amountRange[0]}
                    onChange={(e) => handleAmountRangeChange([parseInt(e.target.value), amountRange[1]])}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '6px',
                      background: `linear-gradient(to right, #e5e7eb 0%, #e5e7eb ${(amountRange[0] / 50000000) * 100}%, #3b82f6 ${(amountRange[0] / 50000000) * 100}%, #3b82f6 ${(amountRange[1] / 50000000) * 100}%, #e5e7eb ${(amountRange[1] / 50000000) * 100}%, #e5e7eb 100%)`,
                      borderRadius: '3px',
                      outline: 'none',
                    }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="50000000"
                    step="10000"
                    value={amountRange[1]}
                    onChange={(e) => handleAmountRangeChange([amountRange[0], parseInt(e.target.value)])}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '6px',
                      background: 'transparent',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: "var(--font-nrt-reg)" }}>0 IQD</span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: "var(--font-nrt-reg)" }}>50,000,000 IQD</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="number"
                    value={advancedSearch.amountFrom}
                    onChange={(e) => handleAdvancedSearchChange('amountFrom', e.target.value)}
                    placeholder="From"
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      fontFamily: "var(--font-nrt-reg)"
                    }}
                  />
                  <input
                    type="number"
                    value={advancedSearch.amountTo}
                    onChange={(e) => handleAdvancedSearchChange('amountTo', e.target.value)}
                    placeholder="To"
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      fontFamily: "var(--font-nrt-reg)"
                    }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={resetAdvancedSearch}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontFamily: "var(--font-nrt-bd)"
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div>
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem 2rem', fontFamily: "var(--font-nrt-reg)" }}>
              <div className="loading-spinner" style={{ width: '3rem', height: '3rem', borderTopColor: '#2563eb', margin: '0 auto' }}></div>
              <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading payments...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 2rem', fontFamily: "var(--font-nrt-reg)" }}>
              <div style={{ fontSize: '3rem', color: '#9ca3af', marginBottom: '1rem' }}>💸</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>No payments found</h3>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                {paymentHistory.length === 0 ? "Get started by creating your first payment" : "No payments match your search criteria"}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
              {filteredPayments.map((payment) => (
                <div key={payment.id}>
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      transition: 'all 0.2s ease',
                      fontFamily: "var(--font-nrt-reg)"
                    }}
                  >
                    {/* Payment Header */}
                    <div style={{
                      backgroundColor: '#3b82f6',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem 0.5rem 0 0',
                      margin: '-1rem -1rem 1rem -1rem',
                      color: 'white'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '0 0 0.25rem 0', fontFamily: "var(--font-nrt-bd)" }}>{payment.paymentNumber}</h3>
                          <p style={{ color: '#bfdbfe', fontSize: '0.875rem', margin: 0, fontFamily: "var(--font-nrt-reg)" }}>{payment.pharmacyName}</p>
                          {payment.hardcopyBillNumber && (
                            <p style={{ color: '#bfdbfe', fontSize: '0.75rem', margin: '0.25rem 0 0 0', fontFamily: "var(--font-nrt-reg)" }}>Bill: {payment.hardcopyBillNumber}</p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: "var(--font-nrt-bd)" }}>{formatCurrency(payment.netAmount)}</div>
                          <div style={{ color: '#bfdbfe', fontSize: '0.75rem', fontFamily: "var(--font-nrt-reg)" }}>{formatDateToDMY(payment.createdAt)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Payment Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '500', fontFamily: "var(--font-nrt-bd)" }}>Sold</div>
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#047857', fontFamily: "var(--font-nrt-bd)" }}>+{formatCurrency(payment.soldTotal)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '500', fontFamily: "var(--font-nrt-bd)" }}>Returns</div>
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#b91c1c', fontFamily: "var(--font-nrt-bd)" }}>{payment.returnTotal > 0 ? '-' : ''}{formatCurrency(payment.returnTotal)}</div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: '#6b7280', fontFamily: "var(--font-nrt-reg)" }}>
                      <div>
                        <div>Bills: {payment.selectedSoldBills?.length || 0}</div>
                        <div>Returns: {payment.selectedReturns?.length || 0}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div>By: {payment.createdByName}</div>
                      </div>
                    </div>

                    {/* Notes Preview */}
                    {payment.notes && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#fef3c7', borderRadius: '0.25rem', border: '1px solid #f59e0b' }}>
                        <p style={{ fontSize: '0.75rem', color: '#92400e', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "var(--font-nrt-reg)" }}>{payment.notes}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                      <button
                        onClick={() => handleViewPayment(payment)}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          fontSize: '0.875rem',
                          backgroundColor: '#e5e7eb',
                          color: '#374151',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                          fontFamily: "var(--font-nrt-bd)"
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                          padding: '0.5rem',
                          fontSize: '0.875rem',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                          fontFamily: "var(--font-nrt-bd)"
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Update
                      </button>
                      <button
                          onClick={(e) => {
                            e.stopPropagation();
                            printPaymentQuick(payment); // Use quick print function
                          }}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            fontSize: '0.875rem',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.25rem',
                            fontFamily: "var(--font-nrt-bd)",
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H5a2 2 0 00-2 2v4h14z" />
                          </svg>
                          Print
                        </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Details Modal */}
      {showPaymentModal && selectedPayment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          fontFamily: "var(--font-nrt-reg)"
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#1e293b',
                margin: 0,
                fontFamily: "var(--font-nrt-bd)"
              }}>
                Payment Details - {selectedPayment.paymentNumber}
              </h2>
              <button
                onClick={closePaymentModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {/* Header Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', margin: '0 0 0.5rem 0', fontFamily: "var(--font-nrt-bd)" }}>{selectedPayment.pharmacyName}</h3>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.25rem 0', fontFamily: "var(--font-nrt-reg)" }}>Hardcopy Payment Number: {selectedPayment.hardcopyBillNumber}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, fontFamily: "var(--font-nrt-reg)" }}>Date: {formatDateToDMY(selectedPayment.paymentDate)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb', fontFamily: "var(--font-nrt-bd)" }}>{formatCurrency(selectedPayment.netAmount)}</div>
                </div>
              </div>

              {/* Summary Cards in Horizontal Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{
                  backgroundColor: '#f0fdf4',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  border: '1px solid #bbf7d0'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Sold Bills</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#047857', marginBottom: '0.25rem', fontFamily: "var(--font-nrt-bd)" }}>{formatCurrency(selectedPayment.soldTotal)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: "var(--font-nrt-reg)" }}>{selectedPayment.selectedSoldBills?.length || 0} bills</div>
                </div>
                <div style={{
                  backgroundColor: '#fef2f2',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  border: '1px solid #fee2e2'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Returns</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#b91c1c', marginBottom: '0.25rem', fontFamily: "var(--font-nrt-bd)" }}>{selectedPayment.returnTotal > 0 ? '-' : ''}{formatCurrency(selectedPayment.returnTotal)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: "var(--font-nrt-reg)" }}>{selectedPayment.selectedReturns?.length || 0} returns</div>
                </div>
                <div style={{
                  backgroundColor: '#f3f4f6',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Created By</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem', fontFamily: "var(--font-nrt-bd)" }}>{selectedPayment.createdByName || 'Unknown'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: "var(--font-nrt-reg)" }}>{formatDateToDMY(selectedPayment.createdAt)}</div>
                </div>
              </div>

              {/* Bills and Returns in Horizontal Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Sold Bills Section */}
                {paymentDetails[selectedPayment.id]?.soldBills?.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1e293b', fontFamily: "var(--font-nrt-bd)" }}>Sold Bills ({paymentDetails[selectedPayment.id].soldBills.length})</h4>
                      <span style={{ fontSize: '0.875rem', color: '#059669', fontFamily: "var(--font-nrt-reg)" }}>
                        Total: {formatCurrency(selectedPayment.soldTotal)}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {paymentDetails[selectedPayment.id].soldBills.map(bill => {
                        const billTotal = bill.totalAmount || bill.items?.reduce((sum, item) =>
                          sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0;
                        return (
                          <div key={bill.id} style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            backgroundColor: '#f8fafc'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <div>
                                <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.875rem', fontFamily: "var(--font-nrt-bd)" }}>Bill #{bill.billNumber}</div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>
                                  {formatDate(bill.date)} • {bill.items.length} items
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', color: '#059669', fontSize: '0.875rem', fontFamily: "var(--font-nrt-bd)" }}>
                                  {formatCurrency(billTotal)}
                                </div>
                              </div>
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                              {bill.items?.slice(0, 3).map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.75rem', fontFamily: "var(--font-nrt-reg)" }}>
                                  <span>{item.name}</span>
                                  <span>x{item.quantity} • {formatCurrency(item.price || 0)}</span>
                                </div>
                              ))}
                              {bill.items?.length > 3 && (
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>
                                  +{bill.items.length - 3} more items
                                </div>
                              )}
                            </div>
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#059669', fontFamily: "var(--font-nrt-reg)" }}>
                              Paid in this payment
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Returns Section */}
                {paymentDetails[selectedPayment.id]?.returns?.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1e293b', fontFamily: "var(--font-nrt-bd)" }}>Returns ({paymentDetails[selectedPayment.id].returns.length})</h4>
                      <span style={{ fontSize: '0.875rem', color: '#dc2626', fontFamily: "var(--font-nrt-reg)" }}>
                        Total: {selectedPayment.returnTotal > 0 ? '-' : ''}{formatCurrency(selectedPayment.returnTotal)}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {paymentDetails[selectedPayment.id].returns.map(r => {
                        const returnTotal = r.totalReturn ||
                          (r.items ? r.items.reduce((sum, item) =>
                            sum + ((item.returnPrice || 0) * (item.returnQuantity || 0)), 0) :
                          (r.returnPrice || 0) * (r.returnQuantity || 0));
                        return (
                          <div key={r.id} style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            backgroundColor: '#f8fafc'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <div>
                                <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.875rem', fontFamily: "var(--font-nrt-bd)" }}>
                                  Return #{r.pharmacyReturnNumber || r.returnNumber || r.id?.slice(-6) || 'N/A'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>
                                  {formatDate(r.date)}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '0.875rem', fontFamily: "var(--font-nrt-bd)" }}>
                                  {returnTotal > 0 ? '-' : ''}{formatCurrency(returnTotal)}
                                </div>
                              </div>
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                              {r.items?.slice(0, 3).map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.75rem', fontFamily: "var(--font-nrt-reg)" }}>
                                  <span>{item.name}</span>
                                  <span style={{ color: '#dc2626' }}>x{item.returnQuantity} • {returnTotal > 0 ? '-' : ''}{formatCurrency(item.returnPrice || 0)}</span>
                                </div>
                              ))}
                              {r.items?.length > 3 && (
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', fontFamily: "var(--font-nrt-reg)" }}>
                                  +{r.items.length - 3} more items
                                </div>
                              )}
                              {!r.items && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.75rem', fontFamily: "var(--font-nrt-reg)" }}>
                                  <span>{r.name}</span>
                                  <span style={{ color: '#dc2626' }}>x{r.returnQuantity} • {returnTotal > 0 ? '-' : ''}{formatCurrency(r.returnPrice || 0)}</span>
                                </div>
                              )}
                            </div>
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#059669', fontFamily: "var(--font-nrt-reg)" }}>
                              Processed in this payment
                            </div>
                            {r.billNumber && (
                              <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280', fontFamily: "var(--font-nrt-reg)" }}>
                                From Bill: {r.billNumber}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes Section */}
              {selectedPayment.notes && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem', fontFamily: "var(--font-nrt-bd)" }}>Notes</h4>
                  <div style={{
                    padding: '1rem',
                    backgroundColor: '#fef3c7',
                    borderRadius: '0.5rem',
                    border: '1px solid #fde68a',
                    fontFamily: "var(--font-nrt-reg)"
                  }}>
                    {selectedPayment.notes}
                  </div>
                </div>
              )}
            </div>
            <div style={{
              padding: '1rem',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={closePaymentModal}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontFamily: "var(--font-nrt-bd)"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}