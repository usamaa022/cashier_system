"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getPayments, formatDate } from "@/lib/data";
import PaymentDetailsModal from "@/components/PaymentDetailModal";

export default function PaymentHistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [advancedSearch, setAdvancedSearch] = useState({
    pharmacyName: "",
    hardcopyBillNumber: "",
    notes: "",
    dateFrom: "",
    dateTo: "",
    itemName: "",
    billNumber: ""
  });
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    const loadPayments = async () => {
      try {
        const paymentsData = await getPayments();
        setPayments(paymentsData);
      } catch (error) {
        console.error("Error loading payments:", error);
      } finally {
        setLoading(false);
      }
    };
    loadPayments();
  }, [user, router]);

  const filteredPayments = payments.filter(payment => {
    // Basic search
    const basicSearch = searchTerm === "" || 
      payment.paymentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.pharmacyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.createdByName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.hardcopyBillNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const statusFilter = filterStatus === "all" || payment.status === filterStatus;

    // Advanced search
    let advancedFilter = true;
    if (showAdvancedSearch) {
      if (advancedSearch.pharmacyName && !payment.pharmacyName?.toLowerCase().includes(advancedSearch.pharmacyName.toLowerCase())) {
        advancedFilter = false;
      }
      if (advancedSearch.hardcopyBillNumber && !payment.hardcopyBillNumber?.toLowerCase().includes(advancedSearch.hardcopyBillNumber.toLowerCase())) {
        advancedFilter = false;
      }
      if (advancedSearch.notes && !payment.notes?.toLowerCase().includes(advancedSearch.notes.toLowerCase())) {
        advancedFilter = false;
      }
      if (advancedSearch.dateFrom) {
        const paymentDate = new Date(payment.paymentDate);
        const fromDate = new Date(advancedSearch.dateFrom);
        if (paymentDate < fromDate) advancedFilter = false;
      }
      if (advancedSearch.dateTo) {
        const paymentDate = new Date(payment.paymentDate);
        const toDate = new Date(advancedSearch.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (paymentDate > toDate) advancedFilter = false;
      }
    }
    return basicSearch && statusFilter && advancedFilter;
  });

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + payment.netAmount, 0);

  const handleAdvancedSearchChange = (field, value) => {
    setAdvancedSearch(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetAdvancedSearch = () => {
    setAdvancedSearch({
      pharmacyName: "",
      hardcopyBillNumber: "",
      notes: "",
      dateFrom: "",
      dateTo: "",
      itemName: "",
      billNumber: ""
    });
  };

  // NEW: Function to handle update payment
  const handleUpdatePayment = (payment) => {
    // Navigate to create payment page with payment ID for editing
    router.push(`/payments/create?edit=${payment.id}`);
  };

  // NEW: Function to handle view payment details
  const handleViewPaymentDetails = (payment) => {
    setSelectedPayment(payment);
    setShowPaymentModal(true);
  };

  if (!user) return null;

  return (
    <div className="payment-container bg-gradient-blue" style={{ minHeight: '100vh', padding: '1rem' }}>
      {/* Header */}
      <div className="payment-header">
        <h1 className="text-4xl font-bold">Payment History</h1>
        <p className="text-xl text-gray-600">View and manage all payment records</p>
      </div>

      {/* Stats and Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="payment-card" style={{ padding: '0.75rem 1rem', minWidth: '120px' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total Processed</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669' }}>{totalAmount.toFixed(2)} IQD</div>
          </div>
          
          <div className="payment-card" style={{ padding: '0.75rem 1rem', minWidth: '120px' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total Payments</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#2563eb' }}>{filteredPayments.length}</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="payment-input"
            style={{ width: '200px' }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="payment-select"
            style={{ width: '120px' }}
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className="payment-btn payment-btn-secondary"
            style={{ padding: '0.5rem 1rem' }}
          >
            {showAdvancedSearch ? 'Hide' : 'Advanced'} Search
          </button>
        </div>
        
        <button
          onClick={() => router.push("/payments/create")}
          className="payment-btn payment-btn-primary"
          style={{ padding: '0.5rem 1rem' }}
        >
          New Payment
        </button>
      </div>

      {/* Advanced Search Panel */}
      {showAdvancedSearch && (
        <div className="payment-card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Advanced Search</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Pharmacy Name
              </label>
              <input
                type="text"
                value={advancedSearch.pharmacyName}
                onChange={(e) => handleAdvancedSearchChange('pharmacyName', e.target.value)}
                className="payment-input"
                placeholder="Enter pharmacy name"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Hardcopy Bill #
              </label>
              <input
                type="text"
                value={advancedSearch.hardcopyBillNumber}
                onChange={(e) => handleAdvancedSearchChange('hardcopyBillNumber', e.target.value)}
                className="payment-input"
                placeholder="Enter bill number"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Notes
              </label>
              <input
                type="text"
                value={advancedSearch.notes}
                onChange={(e) => handleAdvancedSearchChange('notes', e.target.value)}
                className="payment-input"
                placeholder="Search in notes"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Date From
              </label>
              <input
                type="date"
                value={advancedSearch.dateFrom}
                onChange={(e) => handleAdvancedSearchChange('dateFrom', e.target.value)}
                className="payment-input"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Date To
              </label>
              <input
                type="date"
                value={advancedSearch.dateTo}
                onChange={(e) => handleAdvancedSearchChange('dateTo', e.target.value)}
                className="payment-input"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              onClick={resetAdvancedSearch}
              className="payment-btn payment-btn-secondary"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedPayment ? '1fr 400px' : '1fr', gap: '1.5rem' }}>
        {/* Payments Grid */}
        <div>
          {loading ? (
            <div className="payment-card text-center" style={{ padding: '3rem 2rem' }}>
              <div className="loading-spinner" style={{ width: '3rem', height: '3rem', borderTopColor: '#2563eb', margin: '0 auto' }}></div>
              <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading payments...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="payment-card text-center" style={{ padding: '3rem 2rem' }}>
              <div style={{ fontSize: '3rem', color: '#9ca3af', marginBottom: '1rem' }}>💸</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.5rem' }}>No payments found</h3>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                {payments.length === 0 
                  ? "Get started by creating your first payment" 
                  : "No payments match your search criteria"}
              </p>
              <button
                onClick={() => router.push("/payments/create")}
                className="payment-btn payment-btn-primary"
              >
                Create Payment
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
              {filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="payment-card fade-in"
                  style={{ 
                    cursor: 'pointer',
                    border: selectedPayment?.id === payment.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    transform: selectedPayment?.id === payment.id ? 'scale(1.02)' : 'scale(1)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Payment Header */}
                  <div style={{ backgroundColor: '#3b82f6', padding: '0.75rem 1rem', borderRadius: '0.5rem 0.5rem 0 0', margin: '-1rem -1rem 1rem -1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', margin: '0 0 0.25rem 0' }}>
                          {payment.paymentNumber}
                        </h3>
                        <p style={{ color: '#bfdbfe', fontSize: '0.875rem', margin: 0 }}>
                          {payment.pharmacyName}
                        </p>
                        {payment.hardcopyBillNumber && (
                          <p style={{ color: '#bfdbfe', fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>
                            Bill: {payment.hardcopyBillNumber}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>
                          {payment.netAmount?.toFixed(2)} IQD
                        </div>
                        <div style={{ color: '#bfdbfe', fontSize: '0.75rem' }}>
                          {formatDate(payment.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '500' }}>Sold</div>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#047857' }}>+{payment.soldTotal?.toFixed(2)}</div>
                    </div>
                    
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '500' }}>Returns</div>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#b91c1c' }}>-{payment.returnTotal?.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
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
                      <p style={{ fontSize: '0.75rem', color: '#92400e', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {payment.notes}
                      </p>
                    </div>
                  )}

                  {/* NEW: Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={() => handleViewPaymentDetails(payment)}
                      className="payment-btn payment-btn-secondary"
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleUpdatePayment(payment)}
                      className="payment-btn"
                      style={{ 
                        flex: 1, 
                        padding: '0.5rem', 
                        fontSize: '0.875rem',
                        backgroundColor: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer'
                      }}
                    >
                      Update
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Details Sidebar - Removed since we're using modal now */}
      </div>

      {/* Payment Details Modal */}
      {showPaymentModal && selectedPayment && (
        <PaymentDetailsModal 
          payment={selectedPayment}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPayment(null);
          }}
        />
      )}
    </div>
  );
}