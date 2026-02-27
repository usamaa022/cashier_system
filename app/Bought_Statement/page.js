"use client";
import React, { useState, useRef } from "react";
import { getBoughtBills, getReturnsForCompany } from "@/lib/data";
import CompanySelectionModal from "@/components/CompanySelectionModal";
import { useReactToPrint } from "react-to-print";

const BoughtStatementPage = () => {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState("");
  const printRef = useRef();

  // Currency formatting function
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date to DD/MM/YYYY
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'N/A';
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return 'N/A';
    }
  };

  const handleCompanySelect = async (company) => {
    setSelectedCompany(company);
    setShowModal(false);
    setIsLoading(true);
    setError(null);
    
    try {
      const [billsData, returnsData] = await Promise.all([
        getBoughtBills(),
        getReturnsForCompany(company.id)
      ]);

      // Filter bills for selected company with unpaid status
      const companyBills = billsData.filter(bill => 
        bill.companyId === company.id && 
        (bill.paymentStatus === "Unpaid" || !bill.paymentStatus)
      );

      // Filter unpaid returns
      const unpaidReturns = returnsData.filter(ret => 
        ret.paymentStatus !== "Processed" && ret.paymentStatus !== "Paid"
      );

      setBills(companyBills);
      setReturns(unpaidReturns);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate totals using USD fields
  const totalBeforeReturn = bills.reduce((sum, bill) => {
    const billTotal = bill.items?.reduce((itemSum, item) => {
      // Use basePriceUSD which is already in dollars
      const priceInUSD = item.basePriceUSD || 0;
      return itemSum + (priceInUSD * item.quantity);
    }, 0) || 0;
    return sum + billTotal;
  }, 0);

  const totalReturn = returns.reduce((sum, ret) => {
    return sum + (ret.returnQuantity * ret.returnPrice);
  }, 0);

  const totalAfterReturn = totalBeforeReturn - totalReturn;

  // Print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Bought_Statement_${selectedCompany?.name || 'Company'}`,
    onBeforePrint: () => Promise.resolve(),
    onAfterPrint: () => console.log('Print completed'),
    onPrintError: (error) => {
      console.error('Print error:', error);
      alert('Failed to print. Please try again.');
    }
  });

  // Styles
  const containerStyle = {
    minHeight: "100vh",
    backgroundColor: "#f3f4f6",
    padding: "32px 24px"
  };

  const mainStyle = {
    maxWidth: "1400px",
    margin: "0 auto"
  };

  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    backgroundColor: "white",
    padding: "20px 28px",
    borderRadius: "16px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
  };

  const buttonGroupStyle = {
    display: "flex",
    gap: "12px"
  };

  const buttonBaseStyle = {
    padding: "10px 24px",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.2s",
    border: "none"
  };

  const printButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: "#2563eb",
    color: "white"
  };

  const changeButtonStyle = {
    ...buttonBaseStyle,
    backgroundColor: "white",
    color: "#4b5563",
    border: "1px solid #e5e7eb"
  };

  const printableStyle = {
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "16px",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)"
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "18px",
    marginBottom: "30px"
  };

  const thStyle = {
    backgroundColor: "#f8fafc",
    padding: "14px 12px",
    textAlign: "left",
    border: "1px solid #e2e8f0",
    fontWeight: "600",
    fontSize: "17px",
    textTransform: "uppercase",
    letterSpacing: "0.05em"
  };

  const tdStyle = {
    padding: "14px 12px",
    border: "1px solid #e2e8f0",
    verticalAlign: "top"
  };

  const noteCellStyle = {
    ...tdStyle,
    maxWidth: "400px",
    minWidth: "250px",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    lineHeight: "1.5"
  };

  const summaryCardStyle = {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px 24px",
    marginBottom: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  };

  if (showModal) {
    return (
      <div style={containerStyle}>
        <CompanySelectionModal
          onSelect={handleCompanySelect}
          onClose={() => setShowModal(false)}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: "center", padding: "40px", color: "#2563eb" }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ backgroundColor: "#fef2f2", padding: "20px", borderRadius: "12px", color: "#991b1b" }}>
          {error}
          <button 
            onClick={() => setError(null)} 
            style={{ 
              marginLeft: "12px", 
              textDecoration: "underline", 
              background: "none", 
              border: "none", 
              color: "#991b1b", 
              cursor: "pointer" 
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!selectedCompany) {
    return null;
  }

  return (
    <div style={containerStyle}>
      <div style={mainStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: "700", color: "#111827", marginBottom: "6px" }}>
              Bought Statement - {selectedCompany.name}
            </h1>
            <p style={{ fontSize: "16px", color: "#6b7280" }}>{selectedCompany.name}</p>
          </div>
          <div style={buttonGroupStyle}>
            <button
              onClick={() => setShowModal(true)}
              style={changeButtonStyle}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#f9fafb";
                e.target.style.borderColor = "#d1d5db";
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "white";
                e.target.style.borderColor = "#e5e7eb";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Change Company
            </button>
            {/* <button
              onClick={handlePrint}
              disabled={!bills.length && !returns.length}
              style={{
                ...printButtonStyle,
                opacity: !bills.length && !returns.length ? 0.5 : 1,
                cursor: !bills.length && !returns.length ? "not-allowed" : "pointer"
              }}
              onMouseEnter={(e) => {
                if (bills.length || returns.length) {
                  e.target.style.backgroundColor = "#1d4ed8";
                  e.target.style.transform = "translateY(-1px)";
                  e.target.style.boxShadow = "0 4px 6px -1px rgba(37,99,235,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (bills.length || returns.length) {
                  e.target.style.backgroundColor = "#2563eb";
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <path d="M6 9V3h12v6" />
                <rect x="6" y="15" width="12" height="6" rx="2" />
              </svg>
              Print Statement
            </button> */}
          </div>
        </div>

        {/* Printable Content */}
        <div ref={printRef} style={printableStyle}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "40px", borderBottom: "2px solid #e5e7eb", paddingBottom: "20px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#111827", marginBottom: "8px" }}>
                 {selectedCompany.name} - کشف حساب کڕین
            </h1>
            <p style={{ fontSize: "16px", color: "#6b7280", marginTop: "4px" }}>
              Generated on: {formatDate(new Date())}
            </p>
          </div>

          {/* Purchase Bills */}
          <div style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", marginBottom: "16px", borderBottom: "2px solid #e5e7eb", paddingBottom: "8px" }}>
              UNPAID PURCHASE BILLS
            </h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Bill #</th>
                  <th style={thStyle}>Company Bill #</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Amount ($)</th>
                  <th style={{...thStyle, width: "30%"}}>Note</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill, idx) => {
                  const total = bill.items?.reduce((sum, item) => {
                    const priceInUSD = item.basePriceUSD || 0;
                    return sum + (priceInUSD * item.quantity);
                  }, 0) || 0;
                  
                  return (
                    <tr key={bill.id || idx} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                      <td style={{...tdStyle, fontWeight: "600"}}>#{bill.billNumber}</td>
                      <td style={tdStyle}>{bill.companyBillNumber || 'N/A'}</td>
                      <td style={tdStyle}>{formatDate(bill.date)}</td>
                      <td style={{ ...tdStyle, color: "#059669", fontWeight: "600" }}>${formatCurrency(total)}</td>
                      <td style={noteCellStyle}>{bill.billNote || '-'}</td>
                    </tr>
                  );
                })}
                {!bills.length && (
                  <tr>
                    <td colSpan="5" style={{ ...tdStyle, textAlign: "center", padding: "40px", color: "#6b7280" }}>
                      No unpaid purchase bills found
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "700" }}>
                  <td colSpan="3" style={{ ...tdStyle, textAlign: "right" }}>TOTAL BEFORE RETURN:</td>
                  <td style={{ ...tdStyle, color: "#059669", fontSize: "16px" }}>${formatCurrency(totalBeforeReturn)}</td>
                  <td style={tdStyle}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Return Bills */}
          {returns.length > 0 && (
            <div style={{ marginBottom: "40px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#991b1b", marginBottom: "16px", borderBottom: "2px solid #fecaca", paddingBottom: "8px" }}>
                RETURN BILLS
              </h2>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Return #</th>
                    <th style={thStyle}>Original Bill</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Amount ($)</th>
                    <th style={{...thStyle, width: "30%"}}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((ret, idx) => {
                    const returnPriceInUSD = ret.returnPriceUSD || (ret.returnPrice / 1500) || 0;
                    const returnTotal = ret.returnQuantity * returnPriceInUSD;
                    
                    return (
                      <tr key={ret.id || idx} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#fef2f2" }}>
                        <td style={tdStyle}>#{ret.returnNumber || ret.id?.slice(-6) || 'N/A'}</td>
                        <td style={tdStyle}>{ret.originalBillNumber || ret.billNumber || 'N/A'}</td>
                        <td style={tdStyle}>{formatDate(ret.returnDate || ret.date)}</td>
                        <td style={{ ...tdStyle, color: "#dc2626", fontWeight: "600" }}>
                        -${formatCurrency(ret.returnQuantity * ret.returnPrice)}
                      </td>
                        <td style={noteCellStyle}>{ret.returnNote || ret.note || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: "#fee2e2", fontWeight: "700" }}>
                    <td colSpan="3" style={{ ...tdStyle, textAlign: "right" }}>TOTAL RETURN:</td>
                    <td style={{ ...tdStyle, color: "#dc2626", fontSize: "16px" }}>-${formatCurrency(totalReturn)}</td>
                    <td style={tdStyle}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Summary - Stacked vertically with full width */}
          <div style={{ marginTop: "40px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", marginBottom: "16px", borderBottom: "2px solid #e5e7eb", paddingBottom: "8px" }}>
              SUMMARY
            </h2>
            <div style={summaryCardStyle}>
              <span style={{ fontSize: "16px", fontWeight: "500", color: "#4b5563" }}>Total Before Return</span>
              <span style={{ fontSize: "24px", fontWeight: "700", color: "#059669" }}>${formatCurrency(totalBeforeReturn)}</span>
            </div>
            <div style={summaryCardStyle}>
              <span style={{ fontSize: "16px", fontWeight: "500", color: "#4b5563" }}>Total Returns</span>
              <span style={{ fontSize: "24px", fontWeight: "700", color: "#dc2626" }}>-${formatCurrency(totalReturn)}</span>
            </div>
            <div style={{
              ...summaryCardStyle,
              backgroundColor: totalAfterReturn > 0 ? "#f0fdf4" : "#fef2f2",
              borderColor: totalAfterReturn > 0 ? "#bbf7d0" : "#fecaca"
            }}>
              <span style={{  fontSize: "16px", fontWeight: "600", color: totalAfterReturn > 0 ? "#166534" : "#991b1b" }}>
                BALANCE DUE
              </span>
              <span style={{ fontSize: "24px", fontWeight: "800", color: totalAfterReturn > 0 ? "#059669" : "#dc2626" }}>
                ${formatCurrency(totalAfterReturn)}
              </span>
            </div>
          </div>

          {/* Notes Display - Full width */}
          {notes && (
            <div style={{ 
              marginTop: "30px", 
              padding: "24px", 
              backgroundColor: "#f8fafc", 
              borderRadius: "12px", 
              border: "1px solid #e2e8f0",
              width: "100%"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937", marginBottom: "12px" }}>Notes:</h3>
              <p style={{ 
                fontSize: "16px", 
                color: "#4b5563", 
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
                minHeight: "60px"
              }}>{notes}</p>
            </div>
          )}

          {/* Footer */}
          <div style={{ 
            marginTop: "40px", 
            paddingTop: "20px", 
            borderTop: "1px solid #e5e7eb", 
            textAlign: "center", 
            fontSize: "12px", 
            color: "#9ca3af" 
          }}>
   
            <p style={{ marginTop: "4px" }}>Generated on {formatDate(new Date())}</p>
          </div>
        </div>

        {/* Notes Editor - Full width below print area */}
        <div style={{ 
          marginTop: "24px", 
          backgroundColor: "white", 
          borderRadius: "16px", 
          padding: "28px",
          width: "100%"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5L20 7l-9 9H7v-4l9-9z" />
            </svg>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937" }}>
              Statement Notes
            </h3>
          </div>
       
          <textarea
            style={{
              width: "100%",
              padding: "16px 20px",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              fontSize: "15px",
              lineHeight: "1.6",
              minHeight: "120px",
              resize: "vertical",
              fontFamily: "inherit",
              backgroundColor: "#f8fafc"
            }}
            placeholder="Enter your notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default BoughtStatementPage;