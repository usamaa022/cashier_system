"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Card from "@/components/Card";
import PharmacySelectionModal from "@/components/PharmacySelectionModal";
import { format } from "date-fns";
import { getPharmacies, getPharmacyBills, getReturnsForPharmacy } from "@/lib/data";

export default function StatementPage() {
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);

  // Fetch pharmacies on component mount
  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        const pharmacies = await getPharmacies();
        setPharmacies(pharmacies);
      } catch (err) {
        console.error("Error fetching pharmacies:", err);
      }
    };
    fetchPharmacies();
  }, []);

  // Currency formatting function
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Handle pharmacy selection
  const handlePharmacySelect = useCallback(
    async (pharmacy) => {
      setSelectedPharmacy(pharmacy);
      setShowModal(false);
      setIsLoading(true);
      setError(null);
      try {
        const [billsResult, returnsResult] = await Promise.all([
          getPharmacyBills(pharmacy.id),
          getReturnsForPharmacy(pharmacy.id),
        ]);

        // Filter out paid and cash bills - only show unpaid bills
        const unpaidBills = billsResult.bills.filter(
          (bill) => bill.paymentStatus !== "Paid" && bill.paymentStatus !== "Cash"
        );

        // Filter returns to only show UNPAID returns
        const unpaidReturns = returnsResult.filter(
          (returnItem) =>
            returnItem.paymentStatus !== "Processed" &&
            returnItem.paymentStatus !== "Paid"
        );

        // Remove duplicates by bill ID
        const uniqueBills = unpaidBills.filter((bill, index, self) =>
          index === self.findIndex(b => b.id === bill.id)
        );

        setBills(uniqueBills);
        setReturns(unpaidReturns);
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err.message || "Failed to load data for this pharmacy");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Calculate totals
  const totalBeforeReturn = bills.reduce((sum, bill) => {
    const billTotal = bill.items?.reduce(
      (itemSum, item) => itemSum + (item.price || 0) * (item.quantity || 0),
      0
    ) || 0;
    return sum + billTotal;
  }, 0);

  const totalReturn = returns.reduce((sum, returnItem) => {
    return sum + (returnItem.returnQuantity || 0) * (returnItem.returnPrice || 0);
  }, 0);

  const totalAfterReturn = totalBeforeReturn - totalReturn;

  // Format date for display - dd/mm/yyyy
  const formatDateForDisplay = (date) => {
    if (!date) return "N/A";
    try {
      return format(new Date(date), "dd/MM/yyyy");
    } catch {
      return "Invalid Date";
    }
  };

  // Handle print
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print the statement.");
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Statement for ${selectedPharmacy?.name || 'Pharmacy'}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          @page { 
            margin: 0.5in; 
            @top-center {
              content: "Aran Med Store - Statement";
              font-size: 10px;
              color: #666;
            }
          }
          
          body { 
            font-family: 'Inter', 'Segoe UI', Arial, sans-serif; 
            margin: 0;
            padding: 0;
            color: #1f2937;
            font-size: 12px;
            line-height: 1.5;
          }
          
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 20px;
            margin-bottom: 20px;
            border-bottom: 2px solid #3b82f6;
          }
          
          .header-left {
            text-align: left;
          }
          
          .company-name {
            font-size: 24px;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 5px;
            letter-spacing: -0.5px;
          }
          
          .company-info {
            font-size: 11px;
            color: #4b5563;
            margin-bottom: 3px;
          }
          
          .logo-container {
            display: flex;
            justify-content: flex-end;
            align-items: center;
          }
          
          .company-logo {
            max-height: 85px;
            object-fit: contain;
          }
          
          .statement-title {
            font-size: 18px;
            font-weight: 600;
            margin: 15px 0 10px 0;
            color: #111827;
            text-align: center;
          }
          
          .pharmacy-details {
            background: #f8fafc;
            padding: 12px;
            margin: 15px 0;
            border-radius: 6px;
            border-left: 4px solid #3b82f6;
            border: 1px solid #e5e7eb;
          }
          
          .date-info {
            text-align: right;
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 10px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            font-size: 11px;
            border: 1px solid #e5e7eb;
            table-layout: auto;
          }
          
          th {
            background-color: #f9fafb;
            color: #374151;
            font-weight: 600;
            padding: 10px 8px;
            border: 1px solid #e5e7eb;
            text-align: left;
            font-size: 11px;
            white-space: nowrap;
          }
          
          td {
            padding: 8px;
            border: 1px solid #f3f4f6;
            text-align: left;
            vertical-align: top;
            white-space: nowrap;
          }
          
          .note-column {
            white-space: normal;
            word-wrap: break-word;
            min-width: 150px;
            max-width: 400px;
          }
          
          tfoot td {
            background-color: #f8fafc;
            font-weight: 600;
            border-top: 2px solid #e5e7eb;
          }
          
          .section-title {
            background-color: #f9fafb;
            padding: 10px;
            margin: 20px 0 10px 0;
            border-left: 4px solid #3b82f6;
            font-weight: 600;
            color: #111827;
            border-radius: 4px;
          }
          
          .summary-section {
            margin-top: 25px;
            padding: 18px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          
          .summary-total {
            font-weight: 700;
            font-size: 14px;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 2px solid #e5e7eb;
            color: #059669;
          }
          
          .footer {
            margin-top: 35px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 10px;
          }
          
          .text-right {
            text-align: right;
          }
          
          .text-center {
            text-align: center;
          }
          
          .font-bold {
            font-weight: 700;
          }
          
          .border-bottom {
            border-bottom: 1px solid #e5e7eb;
          }
          
          @media print {
            body { margin: 0.5in; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div class="header-left">
            <div class="company-name">ARAN MED STORE</div>
            <div class="company-info">Slemany - opposite Smart Health Tower</div>
            <div class="company-info">+964 772 533 5252 | +964 751 741 2241</div>
          </div>
          <div class="logo-container">
            <img src="${window.location.origin}/Aranlogo.png" alt="Aran Med Store Logo" class="company-logo ">
          </div>
        </div>
        
        <div class="date-info">
          ${format(new Date(), "dd/MM/yyyy 'at' hh:mm a")}
        </div>
        
        <div class="statement-title" style="fonttt">کشف حساب</div>
        
        <div class="pharmacy-details">
          <strong>Pharmacy:</strong> ${selectedPharmacy?.name || 'N/A'}<br>
          <strong>Statement Period:</strong> As of ${format(new Date(), "dd/MM/yyyy")}
        </div>
        
        <!-- Unpaid Bills Section -->
        <div class="section-title">UNPAID SALES BILLS</div>
        <table>
          <thead>
            <tr>
              <th>Bill #</th>
              <th>Date</th>
              <th class="text-right">Amount (IQD)</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${bills.length > 0 ? bills.map(bill => {
              const billTotal = bill.items?.reduce(
                (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
                0
              ) || 0;
              return `
                <tr>
                  <td>${bill.billNumber || `BILL-${bill.id?.slice(-6)}`}</td>
                  <td>${formatDateForDisplay(bill.date)}</td>
                  <td class="text-right">${formatCurrency(billTotal)}</td>
                  <td class="note-column">${bill.note || bill.billNote || '-'}</td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="4" class="text-center" style="padding: 20px; color: #6b7280;">
                  No unpaid sales bills found
                </td>
              </tr>
            `}
          </tbody>
          ${bills.length > 0 ? `
            <tfoot>
              <tr>
                <td colspan="2" class="text-right font-bold">Total Unpaid Sales:</td>
                <td class="text-right font-bold">${formatCurrency(totalBeforeReturn)}</td>
                <td></td>
              </tr>
            </tfoot>
          ` : ''}
        </table>
        
        <!-- Returns Section -->
        ${returns.length > 0 ? `
          <div class="section-title">RETURNED ITEMS</div>
          <table>
            <thead>
              <tr>
                <th>Pharmacy Return #</th>
                <th>Original Bill #</th>
                <th>Item</th>
                <th>Qty</th>
                <th class="text-right">Total</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              ${returns.map((returnItem, index) => `
                <tr>
                  <td>${returnItem.returnNumber || `RETURN-${returnItem.id?.slice(-6) || index + 1}`}</td>
                  <td>${returnItem.billNumber || '-'}</td>
                  <td>${returnItem.name}<br><small style="color: #6b7280; font-size: 10px;">${returnItem.barcode || 'No barcode'}</small></td>
                  <td>${returnItem.returnQuantity}</td>
                  <td class="text-right">-${formatCurrency((returnItem.returnQuantity || 0) * (returnItem.returnPrice || 0))}</td>
                  <td class="note-column">${returnItem.note || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="text-right font-bold">Total Returns:</td>
                <td class="text-right font-bold">-${formatCurrency(totalReturn)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        ` : ''}
        
        <!-- Summary Section -->
        <div class="summary-section">
          <div class="statement-title" style="font-size: 16px; margin: 0 0 12px 0;">SUMMARY</div>
          <div class="summary-row">
            <span>Total Unpaid Sales:</span>
            <span class="font-bold">${formatCurrency(totalBeforeReturn)} IQD</span>
          </div>
          ${returns.length > 0 ? `
            <div class="summary-row">
              <span>Less: Total Returns:</span>
              <span class="font-bold">-${formatCurrency(totalReturn)} IQD</span>
            </div>
          ` : ''}
          <div class="summary-row summary-total">
            <span>NET AMOUNT DUE:</span>
            <span class="font-bold">${formatCurrency(totalAfterReturn)} IQD</span>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div>Generated on: ${format(new Date(), "dd/MM/yyyy 'at' hh:mm a")}</div>
          <div>This statement includes only unpaid bills and returns from unpaid bills</div>
          <div style="margin-top: 5px;">Thank you for your business</div>
        </div>
        
        <script>
          setTimeout(() => {
            window.print();
            setTimeout(() => window.close(), 500);
          }, 100);
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  // Handle pharmacy change
  const handleChangePharmacy = () => {
    setShowModal(true);
    setSelectedPharmacy(null);
    setBills([]);
    setReturns([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
      {showModal && (
        <PharmacySelectionModal
          pharmacies={pharmacies}
          onSelect={handlePharmacySelect}
          onClose={() => setShowModal(false)}
        />
      )}
      
      {selectedPharmacy && (
        <div className="max-w-7xl mx-auto">
          {/* Header Card */}
          <Card className="mb-6 shadow-lg border border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-4 flex-1">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800 mb-2" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                    ARAN MED STORE
                  </h1>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-medium text-gray-600" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Pharmacy:</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                      {selectedPharmacy.name}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                    Generated on: {format(new Date(), "dd/MM/yyyy 'at' hh:mm a")}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <img 
                  src="/Aranlogo.png" 
                  alt="Aran Med Store Logo" 
                  style={{
                    height: "100px",
                    objectFit: "contain"
                  }}
                />
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleChangePharmacy}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: "#ffffff",
                      color: "#374151",
                      fontSize: "14px",
                      fontWeight: "600",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#f9fafb";
                      e.target.style.borderColor = "#9ca3af";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#ffffff";
                      e.target.style.borderColor = "#d1d5db";
                    }}
                  >
                    <svg 
                      style={{ 
                        width: "16px", 
                        height: "16px" 
                      }} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                    </svg>
                    Change Pharmacy
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={isLoading || error || (!bills.length && !returns.length)}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#2563eb",
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: "600",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
                      boxShadow: "0 1px 3px rgba(37, 99, 235, 0.3)",
                      opacity: (isLoading || error || (!bills.length && !returns.length)) ? 0.5 : 1,
                      cursor: (isLoading || error || (!bills.length && !returns.length)) ? "not-allowed" : "pointer"
                    }}
                    onMouseEnter={(e) => {
                      if (!(isLoading || error || (!bills.length && !returns.length))) {
                        e.target.style.backgroundColor = "#1d4ed8";
                        e.target.style.boxShadow = "0 2px 4px rgba(37, 99, 235, 0.4)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!(isLoading || error || (!bills.length && !returns.length))) {
                        e.target.style.backgroundColor = "#2563eb";
                        e.target.style.boxShadow = "0 1px 3px rgba(37, 99, 235, 0.3)";
                      }
                    }}
                  >
                    <svg 
                      style={{ 
                        width: "16px", 
                        height: "16px" 
                      }} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Statement
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <Card className="mb-6 border border-gray-200">
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Loading statement data...</p>
              </div>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Card className="mb-6 border-red-200 bg-red-50 border">
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="text-red-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-700" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Error Loading Data</h3>
                    <p className="text-red-600 text-sm mt-1" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>{error}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Main Content */}
          {!isLoading && !error && (
            <div className="space-y-6">
              {/* Unpaid Bills Card */}
              <Card className="shadow-md border border-gray-200">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>UNPAID SALES BILLS</h2>
                  <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                    Total: {bills.length} bill{bills.length !== 1 ? 's' : ''}
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ tableLayout: "auto" }}>
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Bill #</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Date</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Amount (IQDD)</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider  min-w-[200px]" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {bills.length > 0 ? (
                        bills.map((bill) => {
                          const billTotal = bill.items?.reduce(
                            (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
                            0
                          ) || 0;
                          return (
                            <tr key={bill.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                                {bill.billNumber || `BILL-${bill.id?.slice(-5)}`}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-600 whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                                {formatDateForDisplay(bill.date)}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-600 whitespace-nowrap text-center" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                                {formatCurrency(billTotal)}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-600 break-words max-w-md" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                                <div className="truncate" title={bill.note || bill.billNote || ""}>
                                  {bill.note || bill.billNote || "-"}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center justify-center">
                              <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="text-gray-600" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>No unpaid sales bills found</p>
                              <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>All bills are either paid or cash transactions</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {bills.length > 0 && (
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan="2" className="px-4 py-3 text-right text-sm font-semibold text-gray-700" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                            Total Unpaid Sales:
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-blue-700 text-right" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                            {formatCurrency(totalBeforeReturn)} IQD
                          </td>
                          <td className="px-4 py-3"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </Card>

              {/* Returns Card (only if returns exist) */}
              {returns.length > 0 && (
                <Card className="shadow-md border border-gray-200">
                  <div className="border-b border-gray-200 px-6 py-4">
                    <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>RETURNED ITEMS</h2>
                    <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                      Total: {returns.length} return{returns.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ tableLayout: "auto" }}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Pharmacy Return #</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Original Bill #</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Item</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Qty</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Total</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {returns.map((returnItem, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                              {returnItem.returnNumber || `RETURN-${returnItem.id?.slice(-6) || index + 1}`}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600 whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                              {returnItem.billNumber || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600 whitespace-nowrap" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                              <div className="font-medium">{returnItem.name}</div>
                              {returnItem.barcode && (
                                <div className="text-xs text-gray-500 mt-1">Barcode: {returnItem.barcode}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm  text-gray-600 whitespace-nowrap text-center" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                              {returnItem.returnQuantity}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-center text-red-600 whitespace-nowrap " style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                              -{formatCurrency((returnItem.returnQuantity || 0) * (returnItem.returnPrice || 0))}
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600 break-words max-w-md" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                              {returnItem.note || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan="4" className="px-4 py-3 text-right text-sm font-semibold text-gray-700" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                            Total Returns:
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-center text-red-600 " style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
                            -{formatCurrency(totalReturn)} IQD
                          </td>
                          <td className="px-4 py-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              )}

              {/* Summary Card */}
              {(bills.length > 0 || returns.length > 0) && (
                <Card className="shadow-md border border-gray-200">
                  <div className="border-b border-gray-200 px-6 py-4">
                    <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>SUMMARY</h2>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                        <div className="text-sm font-medium text-blue-700 mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Total Unpaid Sales</div>
                        <div className="text-2xl font-bold text-blue-800" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>{formatCurrency(totalBeforeReturn)}</div>
                        <div className="text-xs text-blue-600 mt-2" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>{bills.length} unpaid bill{bills.length !== 1 ? 's' : ''}</div>
                      </div>
                      
                      {returns.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-5 border border-red-100">
                          <div className="text-sm font-medium text-red-700 mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Total Returns</div>
                          <div className="text-2xl font-bold text-red-800" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>-{formatCurrency(totalReturn)}</div>
                          <div className="text-xs text-red-600 mt-2" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>{returns.length} return{returns.length !== 1 ? 's' : ''}</div>
                        </div>
                      )}
                      
                      <div className="bg-green-50 rounded-lg p-5 border border-green-100">
                        <div className="text-sm font-medium text-green-700 mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Net Amount Due</div>
                        <div className="text-2xl font-bold text-green-800" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>{formatCurrency(totalAfterReturn)}</div>
                        <div className="text-xs text-green-600 mt-2" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Final amount to be paid</div>
                      </div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-gray-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                          <div className="text-sm text-gray-600" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Pharmacy</div>
                          <div className="font-medium text-gray-800" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>{selectedPharmacy.name}</div>
                        </div>
                        <div className="text-center sm:text-left">
                          <div className="text-sm text-gray-600" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Statement Date</div>
                          <div className="font-medium text-gray-800" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>{format(new Date(), "dd/MM/yyyy")}</div>
                        </div>
                        <div className="text-center sm:text-left">
                          <div className="text-sm text-gray-600" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Currency</div>
                          <div className="font-medium text-gray-800" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>Iraqi Dinar (IQD)</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Empty State */}
              {!bills.length && !returns.length && !isLoading && !error && (
                <Card className="text-center py-12 border border-gray-200">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-700 mb-2" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>No Unpaid Transactions</h3>
                  <p className="text-gray-500 mb-6" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>All bills for this pharmacy are either paid or cash transactions.</p>
                  <button
                    onClick={handleChangePharmacy}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#2563eb",
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: "600",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
                      boxShadow: "0 1px 3px rgba(37, 99, 235, 0.3)"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#1d4ed8";
                      e.target.style.boxShadow = "0 2px 4px rgba(37, 99, 235, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#2563eb";
                      e.target.style.boxShadow = "0 1px 3px rgba(37, 99, 235, 0.3)";
                    }}
                  >
                    Select Another Pharmacy
                  </button>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}