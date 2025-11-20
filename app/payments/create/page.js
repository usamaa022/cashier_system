"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { 
  createPayment, 
  getPharmacies, 
  getPharmacySoldBills, 
  getPharmacyReturns,
  formatDate,
  getPaymentDetails
} from "@/lib/data";

export default function CreatePaymentPage() {
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
  
  // Check if we're in edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState(null);

  useEffect(() => {
    // Check for edit mode in URL
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    if (editId) {
      setIsEditMode(true);
      setEditPaymentId(editId);
    }
  }, []);

  useEffect(() => {
    const loadPharmacies = async () => {
      try {
        const pharmaciesData = await getPharmacies();
        setPharmacies(pharmaciesData);
      } catch (error) {
        console.error("Error loading pharmacies:", error);
        setError("Failed to load pharmacies");
      }
    };
    loadPharmacies();
  }, []);

  // Load payment data for editing
  useEffect(() => {
    const loadPaymentForEdit = async () => {
      if (!isEditMode || !editPaymentId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch the payment details to edit
        const paymentToEdit = await getPaymentDetails(editPaymentId);
        
        if (paymentToEdit) {
          // Set all the form fields with the payment data
          setSelectedPharmacy(paymentToEdit.pharmacyId);
          setHardcopyBillNumber(paymentToEdit.hardcopyBillNumber);
          setPaymentDate(paymentToEdit.paymentDate.toISOString().split("T")[0]);
          setNotes(paymentToEdit.notes || "");
          
          // Note: The bills and returns will be loaded automatically when pharmacy is selected
          // We'll set the selected items after the data loads
        }
      } catch (error) {
        console.error("Error loading payment for edit:", error);
        setError("Failed to load payment for editing");
      } finally {
        setLoading(false);
      }
    };
    
    loadPaymentForEdit();
  }, [isEditMode, editPaymentId]);

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
        
        // Get ALL bills and returns first
        const [allSoldBills, allReturns] = await Promise.all([
          getPharmacySoldBills(selectedPharmacy),
          getPharmacyReturns(selectedPharmacy)
        ]);
        
        // Filter out paid bills - only show unpaid ones
        const unpaidSoldBills = allSoldBills.filter(bill => 
          bill.paymentStatus !== "Paid" && bill.paymentStatus !== "Cash"
        );
        
        // Filter out processed returns - only show unpaid ones
        const unpaidReturns = allReturns.filter(returnBill => 
          returnBill.paymentStatus !== "Processed"
        );
        
        setSoldBills(unpaidSoldBills);
        setReturns(unpaidReturns);
        
        // If we're in edit mode, select the previously selected items
        if (isEditMode && editPaymentId) {
          try {
            const paymentToEdit = await getPaymentDetails(editPaymentId);
            if (paymentToEdit) {
              // Only select items that are still available (unpaid)
              const availableSoldBills = paymentToEdit.selectedSoldBills?.filter(billId =>
                unpaidSoldBills.some(bill => bill.id === billId)
              ) || [];
              
              const availableReturns = paymentToEdit.selectedReturns?.filter(returnId =>
                unpaidReturns.some(returnBill => returnBill.id === returnId)
              ) || [];
              
              setSelectedSoldBills(availableSoldBills);
              setSelectedReturns(availableReturns);
            }
          } catch (error) {
            console.error("Error setting selected items for edit:", error);
          }
        } else {
          setSelectedSoldBills([]);
          setSelectedReturns([]);
        }
        
      } catch (error) {
        console.error("Error loading pharmacy data:", error);
        setError("Failed to load pharmacy data");
      } finally {
        setLoading(false);
      }
    };
    
    loadPharmacyData();
  }, [selectedPharmacy, isEditMode, editPaymentId]);

  const soldTotal = selectedSoldBills.reduce((total, billId) => {
    const bill = soldBills.find(b => b.id === billId);
    return total + (bill?.totalAmount || 0);
  }, 0);

  const returnTotal = selectedReturns.reduce((total, returnId) => {
    const returnBill = returns.find(r => r.id === returnId);
    return total + (returnBill?.totalReturn || 0);
  }, 0);

  const totalAfterReturn = soldTotal - returnTotal;

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedPharmacy) {
      setError("Please select a pharmacy");
      return;
    }
    if (!hardcopyBillNumber.trim()) {
      setError("Please enter hardcopy bill number");
      return;
    }
    if (selectedSoldBills.length === 0 && selectedReturns.length === 0) {
      setError("Please select at least one bill or return to process");
      return;
    }
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
        // Update existing payment
        // You'll need to implement updatePayment function in data.js
        // For now, we'll show an alert and create a new payment
        alert("Update payment functionality will be implemented soon. Creating a new payment instead.");
        
        // Create new payment as fallback
        result = await createPayment(paymentData);
        setSuccess(`New payment ${result.paymentNumber} created successfully! (Update feature coming soon)`);
      } else {
        // Create new payment
        result = await createPayment(paymentData);
        setSuccess(`Payment ${result.paymentNumber} created successfully!`);
      }
      
      // Reset form only for new payments
      if (!isEditMode) {
        setSelectedPharmacy("");
        setSelectedSoldBills([]);
        setSelectedReturns([]);
        setHardcopyBillNumber("");
        setNotes("");
      }
      
      setTimeout(() => {
        router.push("/payments/history");
      }, 2000);
      
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} payment:`, error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    // Go back to payment history
    router.push("/payments/history");
  };

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="payment-container bg-gradient-blue" style={{ minHeight: '100vh', padding: '1rem' }}>
      {/* Header */}
      <div className="payment-header">
        <h1 className="text-4xl font-bold">
          {isEditMode ? 'Update Payment' : 'Create Payment'}
        </h1>
        <p className="text-xl text-gray-600">
          {isEditMode ? 'Update existing payment details' : 'Process payments for unpaid bills and returns'}
        </p>
        {isEditMode && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              <strong>Edit Mode:</strong> You are updating an existing payment. 
              Only unpaid bills and returns are available for selection.
            </p>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="alert alert-error fade-in">
          <div className="flex items-center">
            <svg style={{ width: '1.5rem', height: '1.5rem', marginRight: '0.75rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 style={{ fontWeight: '600', color: '#dc2626' }}>Error</h3>
              <p style={{ color: '#dc2626', marginTop: '0.25rem' }}>{error}</p>
            </div>
          </div>
        </div>
      )}
      {success && (
        <div className="alert alert-success fade-in">
          <div className="flex items-center">
            <svg style={{ width: '1.5rem', height: '1.5rem', marginRight: '0.75rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <h3 style={{ fontWeight: '600', color: '#16a34a' }}>Success!</h3>
              <p style={{ color: '#16a34a', marginTop: '0.25rem' }}>{success}</p>
            </div>
          </div>
        </div>
      )}

      <div className="payment-grid" style={{ gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
        {/* Left Column - Form and Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Pharmacy Selection */}
          <div className="payment-card">
            <h2 className="payment-card-header">
              <svg style={{ width: '1.5rem', height: '1.5rem', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Pharmacy Information
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                  Select Pharmacy
                </label>
                <select
                  value={selectedPharmacy}
                  onChange={(e) => setSelectedPharmacy(e.target.value)}
                  className="payment-select"
                  required
                  disabled={isEditMode} // Disable pharmacy change in edit mode
                >
                  <option value="">Choose a pharmacy...</option>
                  {pharmacies.map(pharmacy => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name} ({pharmacy.code})
                    </option>
                  ))}
                </select>
                {isEditMode && (
                  <p className="text-xs text-gray-500 mt-1">
                    Pharmacy cannot be changed in edit mode
                  </p>
                )}
              </div>
              
              {/* Hardcopy Bill Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                  Hardcopy Bill Number *
                </label>
                <input
                  type="text"
                  value={hardcopyBillNumber}
                  onChange={(e) => setHardcopyBillNumber(e.target.value)}
                  className="payment-input"
                  placeholder="Enter hardcopy bill number (e.g., BILL-001, INV-2024-001)"
                  required
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="payment-input"
                  required
                />
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="payment-card">
            <h2 className="payment-card-header">
              <svg style={{ width: '1.5rem', height: '1.5rem', color: '#059669' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Payment Summary
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                <span style={{ color: '#4b5563', fontSize: '0.875rem' }}>Sold Bills:</span>
                <span style={{ fontWeight: '600', color: '#059669' }}>
                  {soldTotal.toFixed(2)} IQD
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                <span style={{ color: '#4b5563', fontSize: '0.875rem' }}>Returns:</span>
                <span style={{ fontWeight: '600', color: '#dc2626' }}>
                  -{returnTotal.toFixed(2)} IQD
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderTop: '1px solid #e5e7eb', marginTop: '0.5rem' }}>
                <span style={{ fontWeight: 'bold', color: '#1f2937' }}>Net Amount:</span>
                <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#2563eb' }}>
                  {totalAfterReturn.toFixed(2)} IQD
                </span>
              </div>

              {/* Additional Info */}
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Selected Bills:</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>
                    {selectedSoldBills.length} of {soldBills.length}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Selected Returns:</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>
                    {selectedReturns.length} of {returns.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="payment-card">
            <h2 className="payment-card-header">
              <svg style={{ width: '1.5rem', height: '1.5rem', color: '#7c3aed' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="payment-textarea"
              placeholder="Add any notes about this payment..."
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isEditMode && (
              <button
                onClick={handleCancelEdit}
                className="payment-btn payment-btn-secondary"
                style={{ flex: 1, padding: '0.75rem' }}
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedPharmacy || !hardcopyBillNumber.trim() || (selectedSoldBills.length === 0 && selectedReturns.length === 0)}
              className="payment-btn payment-btn-primary"
              style={{ flex: 2, padding: '0.75rem' }}
            >
              {submitting ? (
                <>
                  <div className="loading-spinner" style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem', borderTopColor: 'white' }}></div>
                  {isEditMode ? 'Updating...' : 'Processing...'}
                </>
              ) : (
                `${isEditMode ? 'Update' : 'Create'} Payment - ${totalAfterReturn.toFixed(2)} IQD`
              )}
            </button>
          </div>
        </div>

        {/* Right Column - Bills and Returns in 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: 'fit-content' }}>
          {/* Sold Bills Section */}
          <div className="payment-card" style={{ overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#10b981', padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', margin: 0 }}>
                  Unpaid Bills ({soldBills.length})
                </h2>
                <button
                  onClick={selectAllSoldBills}
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
                >
                  {selectedSoldBills.length === soldBills.length ? "Deselect All" : "Select All"}
                </button>
              </div>
            </div>
            <div style={{ padding: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div className="loading-spinner" style={{ width: '2rem', height: '2rem', borderTopColor: '#10b981', margin: '0 auto' }}></div>
                  <p style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.875rem' }}>Loading bills...</p>
                </div>
              ) : soldBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ fontSize: '2rem', color: '#9ca3af', marginBottom: '0.5rem' }}>📄</div>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {selectedPharmacy ? "No unpaid bills available" : "Select pharmacy"}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {soldBills.map((bill) => (
                    <div
                      key={bill.id}
                      className={`selectable-item ${selectedSoldBills.includes(bill.id) ? 'selected' : ''}`}
                      onClick={() => toggleSoldBill(bill.id)}
                      style={{ 
                        padding: '0.75rem', 
                        marginBottom: '0',
                        border: selectedSoldBills.includes(bill.id) ? '2px solid #10b981' : '1px solid #e5e7eb',
                        backgroundColor: selectedSoldBills.includes(bill.id) ? '#f0fdf4' : 'white',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.875rem' }}>Bill #{bill.billNumber}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {formatDate(bill.date)} • {bill.items.length} items
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.25rem', fontWeight: '500' }}>
                            Unpaid
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '0.5rem' }}>
                          <div style={{ fontWeight: 'bold', color: '#059669', fontSize: '0.875rem' }}>
                            {bill.totalAmount.toFixed(2)} IQD
                          </div>
                          {selectedSoldBills.includes(bill.id) && (
                            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
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
          <div className="payment-card" style={{ overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#f59e0b', padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'white', margin: 0 }}>
                  Returns ({returns.length})
                </h2>
                <button
                  onClick={selectAllReturns}
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
                >
                  {selectedReturns.length === returns.length ? "Deselect All" : "Select All"}
                </button>
              </div>
            </div>
            <div style={{ padding: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div className="loading-spinner" style={{ width: '2rem', height: '2rem', borderTopColor: '#f59e0b', margin: '0 auto' }}></div>
                  <p style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.875rem' }}>Loading returns...</p>
                </div>
              ) : returns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ fontSize: '2rem', color: '#9ca3af', marginBottom: '0.5rem' }}>🔄</div>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {selectedPharmacy ? "No returns available" : "Select pharmacy"}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {returns.map((returnBill) => (
                    <div
                      key={returnBill.id}
                      className={`selectable-item ${selectedReturns.includes(returnBill.id) ? 'selected' : ''}`}
                      onClick={() => toggleReturn(returnBill.id)}
                      style={{ 
                        padding: '0.75rem', 
                        marginBottom: '0',
                        border: selectedReturns.includes(returnBill.id) ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                        backgroundColor: selectedReturns.includes(returnBill.id) ? '#fffbeb' : 'white',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '0.875rem' }}>Return #{returnBill.id.slice(-6)}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {formatDate(returnBill.date)} • {returnBill.items?.length || 0} items
                          </div>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            marginTop: '0.25rem', 
                            fontWeight: '500',
                            color: returnBill.paymentStatus === 'Processed' ? '#059669' : '#dc2626'
                          }}>
                            {returnBill.paymentStatus === 'Processed' ? 'Paid' : 'Unpaid'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '0.5rem' }}>
                          <div style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '0.875rem' }}>
                            -{returnBill.totalReturn.toFixed(2)} IQD
                          </div>
                          {selectedReturns.includes(returnBill.id) && (
                            <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>
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
        </div>
      </div>
    </div>
  );
}