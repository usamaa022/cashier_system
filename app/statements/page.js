"use client";
import { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import { format } from "date-fns";
import { getPharmacies, getPharmacyBills, getReturnsForPharmacy } from "@/lib/data";

export default function StatementPage() {
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);

  // --- NEW STATES FOR SUMMARY FEATURE ---
  const [showSummaryMode, setShowSummaryMode] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [allPharmaciesData, setAllPharmaciesData] = useState([]);

  // Fetch pharmacies on component mount
  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        const data = await getPharmacies();
        setPharmacies(data);
      } catch (err) {
        console.error("Error fetching pharmacies:", err);
      }
    };
    fetchPharmacies();
  }, []);

  // Enhanced Currency Formatting
  const formatCurrency = (amount, currency = "IQD") => {
    const safeAmount = Number(amount) || 0;
    if (currency === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(safeAmount);
    } else {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.round(safeAmount)) + " IQD";
    }
  };

  // Reusable Calculation Logic (for both single and mass summary)
  const calculateNetTotals = (pharmacyBills, pharmacyReturns) => {
    let totalUSD = 0;
    let totalIQD = 0;
    let totalReturnUSD = 0;
    let totalReturnIQD = 0;

    pharmacyBills.forEach(bill => {
      const bCurrency = bill.currency || "USD";
      if (bill.items && Array.isArray(bill.items)) {
        bill.items.forEach(item => {
          const qty = item.quantity || 0;
          const usdPrice = item.outPriceUSD !== undefined ? item.outPriceUSD : (bCurrency === "USD" ? item.price : 0);
          const iqdPrice = item.outPriceIQD !== undefined ? item.outPriceIQD : (bCurrency === "IQD" ? item.price : 0);
          totalUSD += usdPrice * qty;
          totalIQD += iqdPrice * qty;
        });
      }
    });

    pharmacyReturns.forEach(returnItem => {
      const rCurrency = returnItem.currency || returnItem.originalCurrency || "USD";
      const qty = returnItem.returnQuantity || 0;
      const usdPrice = returnItem.returnPriceUSD !== undefined ? returnItem.returnPriceUSD : (rCurrency === "USD" ? returnItem.returnPrice : 0);
      const iqdPrice = returnItem.returnPriceIQD !== undefined ? returnItem.returnPriceIQD : (rCurrency === "IQD" ? returnItem.returnPrice : 0);
      totalReturnUSD += usdPrice * qty;
      totalReturnIQD += iqdPrice * qty;
    });

    return {
      totalUSD,
      totalIQD,
      totalReturnUSD,
      totalReturnIQD,
      netUSD: totalUSD - totalReturnUSD,
      netIQD: totalIQD - totalReturnIQD,
    };
  };

  // Handle single pharmacy selection
  const handlePharmacySelect = useCallback(async (selectedOption) => {
    setShowSummaryMode(false); // Reset summary mode if they search
    
    if (!selectedOption) {
      setSelectedPharmacy(null);
      setBills([]);
      setReturns([]);
      return;
    }
    const pharmacy = selectedOption.value;
    
    setSelectedPharmacy(pharmacy);
    setIsLoading(true);
    setError(null);

    try {
      const [billsResult, returnsResult] = await Promise.all([
        getPharmacyBills(pharmacy.id),
        getReturnsForPharmacy(pharmacy.id),
      ]);

      const unpaidBills = billsResult.bills.filter(
        (bill) => bill.paymentStatus !== "Paid" && bill.paymentStatus !== "Cash"
      );

      const unpaidReturns = returnsResult.filter(
        (returnItem) =>
          returnItem.paymentStatus !== "Processed" &&
          returnItem.paymentStatus !== "Paid"
      );

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
  }, []);

  // --- NEW: Load Summary for ALL Pharmacies ---
  const handleLoadAllSummary = async () => {
    setShowSummaryMode(true);
    setSelectedPharmacy(null); // Clear single search
    setIsLoadingSummary(true);
    setError(null);

    try {
      // Process in parallel for speed
      const results = await Promise.all(
        pharmacies.map(async (pharmacy) => {
          const [billsResult, returnsResult] = await Promise.all([
            getPharmacyBills(pharmacy.id),
            getReturnsForPharmacy(pharmacy.id),
          ]);

          const unpaidBills = billsResult.bills.filter(
            (bill) => bill.paymentStatus !== "Paid" && bill.paymentStatus !== "Cash"
          );
          const unpaidReturns = returnsResult.filter(
            (returnItem) =>
              returnItem.paymentStatus !== "Processed" && returnItem.paymentStatus !== "Paid"
          );
          const uniqueBills = unpaidBills.filter((bill, index, self) =>
            index === self.findIndex(b => b.id === bill.id)
          );

          const totals = calculateNetTotals(uniqueBills, unpaidReturns);
          
          return {
            id: pharmacy.id,
            name: pharmacy.name,
            code: pharmacy.code,
            ...totals
          };
        })
      );

      // Filter out pharmacies with zero debt, and sort by highest USD, then IQD
      const activePharmacies = results
        .filter(p => p.netUSD > 0 || p.netIQD > 0 || p.netUSD < 0 || p.netIQD < 0)
        .sort((a, b) => b.netUSD - a.netUSD || b.netIQD - a.netIQD);

      setAllPharmaciesData(activePharmacies);
    } catch (err) {
      console.error("Error loading mass summary:", err);
      setError("Failed to load summary for all pharmacies.");
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // --- NEW: Export Summary to Excel (CSV) ---
  const handleExportCSV = () => {
    const headers = ["Pharmacy Name", "Code", "Total Sales (USD)", "Total Returns (USD)", "Net Unpaid (USD)", "Total Sales (IQD)", "Total Returns (IQD)", "Net Unpaid (IQD)"];
    
    const rows = allPharmaciesData.map(p => [
      `"${p.name}"`, 
      `"${p.code || ''}"`, 
      p.totalUSD, 
      p.totalReturnUSD, 
      p.netUSD,
      p.totalIQD,
      p.totalReturnIQD,
      p.netIQD
    ]);

    // Calculate totals for CSV Footer
    const grandTotals = allPharmaciesData.reduce((acc, curr) => ({
      netUSD: acc.netUSD + curr.netUSD,
      netIQD: acc.netIQD + curr.netIQD
    }), { netUSD: 0, netIQD: 0 });

    rows.push([]); // Empty row
    rows.push(['"GRAND TOTALS"', '""', '""', '""', grandTotals.netUSD, '""', '""', grandTotals.netIQD]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Pharmacies_Summary_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totals = calculateNetTotals(bills, returns);

  const formatDateForDisplay = (date) => {
    if (!date) return "N/A";
    try {
      return format(new Date(date), "dd/MM/yyyy");
    } catch {
      return "Invalid Date";
    }
  };

  // --- iframe Print Function (unchanged for brevity but fully intact) ---
  const handlePrint = () => {
    // Create a visually hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-1';
    document.body.appendChild(iframe);

    // Get the iframe's document
    const doc = iframe.contentWindow ? iframe.contentWindow.document : iframe.contentDocument;
    
    // Write the exact same beautiful print layout into the iframe
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Statement - ${selectedPharmacy?.name || 'Pharmacy'}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          @page { margin: 0.3in; size: A4; }
          body { font-family: 'Inter', sans-serif; color: #1f2937; font-size: 11px; line-height: 1.4; padding: 0; margin: 0; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; margin-bottom: 15px; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          .print-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 2px solid #2563eb; margin-bottom: 12px; }
          .company-name { font-size: 22px; font-weight: 800; color: #1e40af; margin-bottom: 2px; letter-spacing: -0.5px; }
          .company-info { font-size: 11px; color: #4b5563; }
          .company-logo { max-height: 60px; object-fit: contain; }
          .pharmacy-details { background: #f8fafc; padding: 12px 16px; margin-bottom: 15px; border-radius: 6px; border-left: 3px solid #3b82f6; display: flex; justify-content: space-between; align-items: center; }
          .statement-title { font-size: 18px; font-weight: 700; color: #111827; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
          .section-title { font-weight: 700; color: #1e40af; font-size: 13px; letter-spacing: 0.5px; margin-bottom: 6px; text-transform: uppercase; }
          table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
          table.data-table th { color: #64748b; font-weight: 600; padding: 8px 6px; text-align: left; border-bottom: 1px solid #cbd5e1; text-transform: uppercase; font-size: 10px; }
          table.data-table td { padding: 8px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
          table.data-table tr:last-child td { border-bottom: none; }
          table.data-table tfoot td { font-weight: 700; border-top: 1px solid #cbd5e1; padding-top: 10px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .note-cell { max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #64748b; }
          .summary-section { background: #f8fafc; border-radius: 8px; padding: 16px; }
          table.summary-table { width: 100%; border-collapse: collapse; }
          table.summary-table td { padding: 8px 6px; font-size: 13px; }
          .summary-total td { font-weight: 800; font-size: 15px; color: #047857; border-top: 2px solid #34d399; padding-top: 12px; margin-top: 4px; }
          @media print { 
            body { padding: 0; } 
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="print-header avoid-break">
          <div>
            <div class="company-name">ARAN MED STORE</div>
            <div class="company-info">Slemany - opposite Smart Health Tower</div>
            <div class="company-info">+964 772 533 5252 | +964 751 741 2241</div>
          </div>
          <div>
            <img src="${window.location.origin}/Aranlogo.png" alt="Aran Med Store" class="company-logo" onerror="this.style.display='none'">
          </div>
        </div>
        
        <div class="pharmacy-details avoid-break">
          <div>
            <div style="font-size: 14px; margin-bottom: 2px;"><strong>Pharmacy:</strong> <span style="color:#1d4ed8;">${selectedPharmacy?.name || 'N/A'}</span></div>
            <div style="font-size: 11px; color:#64748b;"><strong>Statement Date:</strong> ${format(new Date(), "dd/MM/yyyy")}</div>
          </div>
          <div class="statement-title">كشف حساب</div>
        </div>
        
        <!-- Unpaid Bills Section -->
        <div class="avoid-break">
          <div class="section-title">Unpaid Sales Bills</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 10%;">Invoice #</th>
                <th class="text-center" style="width: 10%;">Date</th>
                <th class="text-right" style="width: 20%;">Amount (USD)</th>
                <th class="text-right" style="width: 20%;">Amount (IQD)</th>
                <th style="width: 30%;">Note</th>
              </tr>
            </thead>
            <tbody>
              ${bills.length > 0 ? bills.map(bill => {
                let billUSD = 0; let billIQD = 0;
                const bCurrency = bill.currency || "USD";
                if (bill.items) {
                  bill.items.forEach(item => {
                    const qty = item.quantity || 0;
                    const usdP = item.outPriceUSD !== undefined ? item.outPriceUSD : (bCurrency === "USD" ? item.price : 0);
                    const iqdP = item.outPriceIQD !== undefined ? item.outPriceIQD : (bCurrency === "IQD" ? item.price : 0);
                    billUSD += usdP * qty; billIQD += iqdP * qty;
                  });
                }
                return `
                  <tr>
                   <td style="font-weight: 600;">${bill.billNumber || ('BILL-' + (bill.id ? bill.id.slice(-6) : ''))}</td>
                    <td class="text-left">${formatDateForDisplay(bill.date)}</td>
                    <td class="text-center" style="font-weight: 600; color:#1e40af;">${billUSD > 0 ? formatCurrency(billUSD, "USD") : '-'}</td>
                    <td class="text-left" style="font-weight: 600; color:#1e40af;">${billIQD > 0 ? formatCurrency(billIQD, "IQD") : '-'}</td>
                    <td class="note-cell">${bill.note || bill.billNote || '-'}</td>
                  </tr>
                `;
              }).join('') : `<tr><td colspan="5" class="text-center" style="padding: 20px; color: #94a3b8;">No unpaid sales bills found</td></tr>`}
            </tbody>
            ${bills.length > 0 ? `
              <tfoot>
                <tr>
                  <td colspan="2" class="text-right font-bold">Total Sales:</td>
                  <td class="text-center font-bold" style="color:#371184; font-size:13px;">${totals.totalUSD > 0 ? formatCurrency(totals.totalUSD, "USD") : '-'}</td>
                  <td class="text-left font-bold" style="color:#371184; font-size:13px;">${totals.totalIQD > 0 ? formatCurrency(totals.totalIQD, "IQD") : '-'}</td>
                  <td></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
        
        <!-- Returns Section -->
        ${returns.length > 0 ? `
          <div class="avoid-break">
            <div class="section-title" style="color:#b91c1c;">Returned Items</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 12%;">Return #</th>
                  <th style="width: 13%;">Orig Inv #</th>
                  <th style="width: 30%;">Product</th>
                  <th class="text-center" style="width: 5%;">Qty</th>
                  <th class="text-right" style="width: 15%;">Total (USD)</th>
                  <th class="text-right" style="width: 15%;">Total (IQD)</th>
                  <th style="width: 30%;">Return Note</th>
                </tr>
              </thead>
              <tbody>
                ${returns.map((ret, idx) => {
                  const qty = ret.returnQuantity || 0;
                  const rCurr = ret.currency || ret.originalCurrency || "USD";
                  const usdP = ret.returnPriceUSD !== undefined ? ret.returnPriceUSD : (rCurr === "USD" ? ret.returnPrice : 0);
                  const iqdP = ret.returnPriceIQD !== undefined ? ret.returnPriceIQD : (rCurr === "IQD" ? ret.returnPrice : 0);
                  return `
                    <tr>
                     <td style="font-weight: 600;">${ret.returnNumber || ('RET-' + (ret.id ? ret.id.slice(-5) : (idx + 1)))}</td>
                      <td>${ret.billNumber || '-'}</td>
                      <td><div style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;">${ret.name}</div></td>
                      <td class="text-center font-bold">${qty}</td>
                      <td class="text-center" style="color:#dc2626; font-weight: 600;">${usdP > 0 ? '-' + formatCurrency(usdP * qty, "USD") : '-'}</td>
                      <td class="text-center" style="color:#dc2626; font-weight: 600;">${iqdP > 0 ? '-' + formatCurrency(iqdP * qty, "IQD") : '-'}</td>
                      <td class="note-cell">${ret.note || ret.returnNote || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" class="text-right font-bold" style="color:#991b1b;">Total Returns:</td>
                  <td class="text-right font-bold" style="color:#dc2626;">${totals.totalReturnUSD > 0 ? '-' + formatCurrency(totals.totalReturnUSD, "USD") : '-'}</td>
                  <td class="text-center font-bold" style="color:#dc2626;">${totals.totalReturnIQD > 0 ? '-' + formatCurrency(totals.totalReturnIQD, "IQD") : '-'}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ` : ''}
        
        <!-- Summary Section -->
        <div class="summary-section avoid-break">
          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px; text-transform: uppercase;">Financial Summary</div>
          
          <table class="summary-table">
            <tr>
              <td style="color:#475569; font-weight: 600;">Total Unpaid Sales:</td>
              <td class="text-right" style="color:#1e40af; font-weight: 700; width: 140px;">${totals.totalUSD > 0 ? formatCurrency(totals.totalUSD, "USD") : '-'}</td>
              <td class="text-right" style="color:#1e40af; font-weight: 700; width: 140px;">${totals.totalIQD > 0 ? formatCurrency(totals.totalIQD, "IQD") : '-'}</td>
            </tr>
            ${returns.length > 0 ? `
              <tr>
                <td style="color:#475569; font-weight: 600;">Total Returns Deducted:</td>
                <td class="text-right" style="color:#dc2626; font-weight: 700;">${totals.totalReturnUSD > 0 ? '-' + formatCurrency(totals.totalReturnUSD, "USD") : '-'}</td>
                <td class="text-right" style="color:#dc2626; font-weight: 700;">${totals.totalReturnIQD > 0 ? '-' + formatCurrency(totals.totalReturnIQD, "IQD") : '-'}</td>
              </tr>
            ` : ''}
            <tr class="summary-total">
              <td>NET AMOUNT DUE:</td>
              <td class="text-right">${totals.netUSD > 0 ? formatCurrency(totals.netUSD, "USD") : '-'}</td>
              <td class="text-right">${totals.netIQD > 0 ? formatCurrency(totals.netIQD, "IQD") : '-'}</td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 10000);
    }, 800);
  };

  const customSelectStyles = {
    control: (provided) => ({
      ...provided,
      padding: '4px 8px',
      border: '1px solid #ccc',
      cursor: 'text',
      backgroundColor: '#ffffff',
      fontSize: '14px',
      minHeight: '48px',
    }),
  };

  const pharmacyOptions = pharmacies.map(p => ({
    value: p,
    label: `${p.name} ${p.code ? `(${p.code})` : ''}`
  }));

  const getBillTotal = (bill) => {
    let billUSD = 0;
    let billIQD = 0;
    const bCurrency = bill.currency || "USD";
    if (bill.items) {
      bill.items.forEach(item => {
        const qty = item.quantity || 0;
        const usdP = item.outPriceUSD !== undefined ? item.outPriceUSD : (bCurrency === "USD" ? item.price : 0);
        const iqdP = item.outPriceIQD !== undefined ? item.outPriceIQD : (bCurrency === "IQD" ? item.price : 0);
        billUSD += usdP * qty;
        billIQD += iqdP * qty;
      });
    }
    return { billUSD, billIQD };
  };

  // --- INLINE STYLES ---
  const containerStyle = {
    width: "100%", maxWidth: "100%", margin: "0", padding: "10px", boxSizing: "border-box",
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", color: "#1f2937", backgroundColor: "#ffffff", minHeight: "100vh"
  };

  const headerStyle = {
    display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px",
    borderBottom: "2px solid #2563eb", marginBottom: "20px", width: "100%"
  };

  const tableStyle = { width: "100%", borderCollapse: "collapse", marginBottom: "30px", border: "1px solid #cbd5e1" };

  const thStyle = {
    border: "1px solid #cbd5e1", padding: "10px", backgroundColor: "#f8fafc", color: "#1e40af",
    fontWeight: "700", textAlign: "left", textTransform: "uppercase", fontSize: "12px",
  };

  const tdStyle = { border: "1px solid #cbd5e1", padding: "10px", fontSize: "13px", verticalAlign: "middle" };

  const btnStyle = {
    padding: "10px 20px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "6px",
    cursor: "pointer", fontWeight: "bold", fontSize: "14px", display: "inline-block", transition: "0.2s"
  };
  const exportBtnStyle = { ...btnStyle, backgroundColor: "#10b981", marginRight: "10px" };
  const backBtnStyle = { ...btnStyle, backgroundColor: "#64748b", marginRight: "10px" };

  // Calculate Grand Totals for Summary View
  const grandTotalUSD = allPharmaciesData.reduce((acc, curr) => acc + curr.netUSD, 0);
  const grandTotalIQD = allPharmaciesData.reduce((acc, curr) => acc + curr.netIQD, 0);

  return (
    <div style={containerStyle}>
      {/* Brand Header */}
      <div style={{ marginBottom: '30px', width: '100%' }}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#1e40af", margin: "0 0 5px 0" }}>ARAN MED STORE</h1>
            <div style={{ fontSize: "12px", color: "#4b5563" }}>Slemany - opposite Smart Health Tower</div>
            <div style={{ fontSize: "12px", color: "#4b5563" }}>+964 772 533 5252 | +964 751 741 2241</div>
          </div>
          <div>
            <img src="/Aranlogo.png" alt="Aran Med Store" style={{ maxHeight: "60px", objectFit: "contain" }} onError={(e) => e.target.style.display = 'none'} />
          </div>
        </div>

        {/* --- SEARCH AND ACTION BAR --- */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ marginBottom: "10px", fontWeight: "bold", fontSize: "16px" }}>Select Pharmacy to View Statement:</div>
            <Select
              options={pharmacyOptions}
              onChange={handlePharmacySelect}
              value={selectedPharmacy ? { value: selectedPharmacy, label: `${selectedPharmacy.name} ${selectedPharmacy.code ? `(${selectedPharmacy.code})` : ''}` } : null}
              styles={customSelectStyles}
              placeholder="🔍 Search pharmacies by name or code..."
              isClearable
              isSearchable
              noOptionsMessage={() => "No pharmacy found"}
            />
          </div>
          <div>
            <button 
              onClick={handleLoadAllSummary} 
              style={{...btnStyle, height: '48px', backgroundColor: showSummaryMode ? '#1e40af' : '#2563eb'}}
              onMouseOver={(e) => e.target.style.opacity = '0.9'}
              onMouseOut={(e) => e.target.style.opacity = '1'}
            >
              📊 All Pharmacies Summary
            </button>
          </div>
        </div>
      </div>

      {isLoading && <div style={{ textAlign: "center", padding: "50px", fontWeight: "bold" }}>Loading statement data...</div>}
      {isLoadingSummary && <div style={{ textAlign: "center", padding: "50px", fontWeight: "bold", color: "#2563eb" }}>Analyzing all pharmacies balances. Please wait...</div>}
      
      {error && <div style={{ color: "red", fontWeight: "bold", padding: "20px", border: "1px solid red", backgroundColor: "#fff5f5" }}>{error}</div>}

      {/* --- MASS SUMMARY VIEW --- */}
      {showSummaryMode && !isLoadingSummary && allPharmaciesData.length > 0 && (
        <div style={{ width: "100%", animation: "fadeIn 0.3s" }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ color: '#1e40af', margin: 0 }}>All Unpaid Pharmacies</h2>
            <div>
              <button style={exportBtnStyle} onClick={handleExportCSV}>📥 Export to Excel</button>
              <button style={backBtnStyle} onClick={() => setShowSummaryMode(false)}>✕ Close Summary</button>
            </div>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{...thStyle, width: '5%'}}>#</th>
                <th style={{...thStyle, width: '35%'}}>Pharmacy Name</th>
                <th style={{...thStyle, width: '15%'}}>Code</th>
                <th style={{...thStyle, width: '22%', textAlign: 'right', backgroundColor: '#e0f2fe'}}>Net Unpaid (USD)</th>
                <th style={{...thStyle, width: '23%', textAlign: 'right', backgroundColor: '#e0f2fe'}}>Net Unpaid (IQD)</th>
              </tr>
            </thead>
            <tbody>
              {allPharmaciesData.map((p, idx) => (
                <tr key={p.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{...tdStyle, color: '#64748b'}}>{idx + 1}</td>
                  <td style={{...tdStyle, fontWeight: '600', color: '#0f172a'}}>{p.name}</td>
                  <td style={tdStyle}>{p.code || '-'}</td>
                  <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0369a1'}}>
                    {p.netUSD > 0 ? formatCurrency(p.netUSD, "USD") : '-'}
                  </td>
                  <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: '#0369a1'}}>
                    {p.netIQD > 0 ? formatCurrency(p.netIQD, "IQD") : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" style={{...tdStyle, textAlign: "right", fontWeight: "900", fontSize: '16px', backgroundColor: "#1e293b", color: 'white'}}>GRAND TOTAL:</td>
                <td style={{...tdStyle, textAlign: "right", fontWeight: "900", fontSize: '16px', color: "#10b981", backgroundColor: "#1e293b"}}>
                  {formatCurrency(grandTotalUSD, "USD")}
                </td>
                <td style={{...tdStyle, textAlign: "right", fontWeight: "900", fontSize: '16px', color: "#10b981", backgroundColor: "#1e293b"}}>
                  {formatCurrency(grandTotalIQD, "IQD")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showSummaryMode && !isLoadingSummary && allPharmaciesData.length === 0 && (
         <div style={{ textAlign: "center", padding: "40px", border: "1px solid #ccc", color: "#666", borderRadius: "8px" }}>
            <strong>All Clear!</strong> No unpaid pharmacies found.
            <br/><br/>
            <button style={backBtnStyle} onClick={() => setShowSummaryMode(false)}>Go Back</button>
         </div>
      )}

      {/* --- SINGLE STATEMENT VIEW --- */}
      {selectedPharmacy && !showSummaryMode && !isLoading && !error && (
        <div style={{ width: "100%" }}>
          <div style={{ background: "#f8fafc", padding: "12px 16px", marginBottom: "20px", borderLeft: "3px solid #3b82f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "16px", marginBottom: "5px" }}><strong>Pharmacy:</strong> <span style={{ color: "#1d4ed8" }}>{selectedPharmacy.name}</span></div>
              <div style={{ fontSize: "13px", color: "#64748b" }}><strong>Statement Date:</strong> {format(new Date(), "dd/MM/yyyy")}</div>
            </div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>كشف حساب</div>
          </div>

          {!bills.length && !returns.length ? (
            <div style={{ textAlign: "center", padding: "40px", border: "1px solid #ccc", color: "#666" }}>
              <strong>Account Clear.</strong> This pharmacy has no pending unpaid sales or active returns.
            </div>
          ) : (
            <>
              {/* Unpaid Sales Table */}
              {bills.length > 0 && (
                <div>
                  <h2 style={{ fontSize: "16px", color: "#1e40af", textTransform: "uppercase", marginBottom: "10px" }}>Unpaid Sales Bills</h2>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: "15%" }}>Invoice #</th>
                        <th style={{ ...thStyle, width: "15%", textAlign: "center" }}>Date</th>
                        <th style={{ ...thStyle, width: "20%", textAlign: "right" }}>Amount (USD)</th>
                        <th style={{ ...thStyle, width: "20%", textAlign: "right" }}>Amount (IQD)</th>
                        <th style={{ ...thStyle, width: "30%" }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((bill) => {
                        const { billUSD, billIQD } = getBillTotal(bill);
                        return (
                          <tr key={bill.id}>
                            <td style={{ ...tdStyle, fontWeight: "600" }}>{bill.billNumber || `BILL-${bill.id?.slice(-5)}`}</td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>{formatDateForDisplay(bill.date)}</td>
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: "600", color: "#1e40af" }}>
                              {billUSD > 0 ? formatCurrency(billUSD, "USD") : '-'}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: "600", color: "#1e40af" }}>
                              {billIQD > 0 ? formatCurrency(billIQD, "IQD") : '-'}
                            </td>
                            <td style={tdStyle}>{bill.note || bill.billNote || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2" style={{ ...tdStyle, textAlign: "right", fontWeight: "bold", backgroundColor: "#f1f5f9" }}>Total Sales:</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold", color: "#371184", backgroundColor: "#f1f5f9" }}>
                          {totals.totalUSD > 0 ? formatCurrency(totals.totalUSD, "USD") : '-'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold", color: "#371184", backgroundColor: "#f1f5f9" }}>
                          {totals.totalIQD > 0 ? formatCurrency(totals.totalIQD, "IQD") : '-'}
                        </td>
                        <td style={{ ...tdStyle, backgroundColor: "#f1f5f9" }}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Returns Table */}
              {returns.length > 0 && (
                <div>
                  <h2 style={{ fontSize: "16px", color: "#b91c1c", textTransform: "uppercase", marginBottom: "10px" }}>Returned Items</h2>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: "15%" }}>Return #</th>
                        <th style={{ ...thStyle, width: "15%" }}>Orig Inv #</th>
                        <th style={{ ...thStyle, width: "25%" }}>Product</th>
                        <th style={{ ...thStyle, width: "10%", textAlign: "center" }}>Qty</th>
                        <th style={{ ...thStyle, width: "15%", textAlign: "right" }}>Total (USD)</th>
                        <th style={{ ...thStyle, width: "20%", textAlign: "right" }}>Total (IQD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.map((ret, idx) => {
                        const qty = ret.returnQuantity || 0;
                        const rCurr = ret.currency || ret.originalCurrency || "USD";
                        const usdP = ret.returnPriceUSD !== undefined ? ret.returnPriceUSD : (rCurr === "USD" ? ret.returnPrice : 0);
                        const iqdP = ret.returnPriceIQD !== undefined ? ret.returnPriceIQD : (rCurr === "IQD" ? ret.returnPrice : 0);
                        return (
                          <tr key={idx}>
                            <td style={{ ...tdStyle, fontWeight: "600" }}>{ret.returnNumber || `RET-${ret.id?.slice(-5) || idx + 1}`}</td>
                            <td style={tdStyle}>{ret.billNumber || '-'}</td>
                            <td style={{ ...tdStyle, fontWeight: "600" }}>{ret.name}</td>
                            <td style={{ ...tdStyle, textAlign: "center", fontWeight: "bold" }}>{qty}</td>
                            <td style={{ ...tdStyle, textAlign: "right", color: "#dc2626", fontWeight: "600" }}>
                              {usdP > 0 ? '-' + formatCurrency(usdP * qty, "USD") : '-'}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", color: "#dc2626", fontWeight: "600" }}>
                              {iqdP > 0 ? '-' + formatCurrency(iqdP * qty, "IQD") : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="4" style={{ ...tdStyle, textAlign: "right", fontWeight: "bold", color: "#991b1b", backgroundColor: "#f1f5f9" }}>Total Returns:</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold", color: "#dc2626", backgroundColor: "#f1f5f9" }}>
                          {totals.totalReturnUSD > 0 ? '-' + formatCurrency(totals.totalReturnUSD, "USD") : '-'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold", color: "#dc2626", backgroundColor: "#f1f5f9" }}>
                          {totals.totalReturnIQD > 0 ? '-' + formatCurrency(totals.totalReturnIQD, "IQD") : '-'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Summary Section */}
              <div style={{ background: "#f8fafc", padding: "20px", border: "1px solid #cbd5e1", marginTop: "20px" }}>
                <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "15px", textTransform: "uppercase" }}>Financial Summary</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "8px 0", color: "#475569", fontWeight: "600" }}>Total Unpaid Sales:</td>
                      <td style={{ padding: "8px 0", textAlign: "right", color: "#1e40af", fontWeight: "700", width: "150px" }}>
                        {totals.totalUSD > 0 ? formatCurrency(totals.totalUSD, "USD") : '-'}
                      </td>
                      <td style={{ padding: "8px 0", textAlign: "right", color: "#1e40af", fontWeight: "700", width: "150px" }}>
                        {totals.totalIQD > 0 ? formatCurrency(totals.totalIQD, "IQD") : '-'}
                      </td>
                    </tr>
                    {returns.length > 0 && (
                      <tr>
                        <td style={{ padding: "8px 0", color: "#475569", fontWeight: "600" }}>Total Returns Deducted:</td>
                        <td style={{ padding: "8px 0", textAlign: "right", color: "#dc2626", fontWeight: "700" }}>
                          {totals.totalReturnUSD > 0 ? '-' + formatCurrency(totals.totalReturnUSD, "USD") : '-'}
                        </td>
                        <td style={{ padding: "8px 0", textAlign: "right", color: "#dc2626", fontWeight: "700" }}>
                          {totals.totalReturnIQD > 0 ? '-' + formatCurrency(totals.totalReturnIQD, "IQD") : '-'}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: "15px 0 5px 0", borderTop: "2px solid #34d399", fontWeight: "800", fontSize: "18px", color: "#047857" }}>NET AMOUNT DUE:</td>
                      <td style={{ padding: "15px 0 5px 0", borderTop: "2px solid #34d399", textAlign: "right", fontWeight: "800", fontSize: "18px", color: "#047857" }}>
                        {totals.netUSD > 0 ? formatCurrency(totals.netUSD, "USD") : '-'}
                      </td>
                      <td style={{ padding: "15px 0 5px 0", borderTop: "2px solid #34d399", textAlign: "right", fontWeight: "800", fontSize: "18px", color: "#047857" }}>
                        {totals.netIQD > 0 ? formatCurrency(totals.netIQD, "IQD") : '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ textAlign: "right", marginTop: "20px" }}>
                <button 
                  onClick={handlePrint} 
                  style={btnStyle}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
                >
                  🖨️ Print Statement
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}