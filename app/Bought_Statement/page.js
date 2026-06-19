"use client";
import React, { useState, useRef } from "react";
import { getBoughtBills, getReturnsForCompany } from "@/lib/data";
import CompanySelectionModal from "@/components/CompanySelectionModal";

const BoughtStatementPage = () => {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState("");
  const printRef = useRef(null);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

  const formatIQD = (amount) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);

  const toDate = (val) => {
    if (!val) return null;
    if (typeof val.toDate === "function") return val.toDate();
    if (val instanceof Date) return val;
    if (val.seconds !== undefined) return new Date(val.seconds * 1000);
    if (typeof val === "string" || typeof val === "number") return new Date(val);
    return null;
  };

  const formatDate = (val) => {
    const d = toDate(val);
    if (!d || isNaN(d.getTime())) return "N/A";
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getFullYear()}`;
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bought Statement - ${selectedCompany?.name || ""}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: white; padding: 24px; }
            h1 { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 6px; }
            h2 { font-size: 14px; font-weight: 700; margin: 24px 0 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
            p.subtitle { text-align: center; color: #6b7280; font-size: 12px; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th { background: #f8fafc; padding: 8px 7px; text-align: left; border: 1px solid #e2e8f0; font-weight: 700; font-size: 11px; text-transform: uppercase; }
            th.right { text-align: right; }
            td { padding: 8px 7px; border: 1px solid #e2e8f0; vertical-align: top; }
            td.right { text-align: right; }
            td.center { text-align: center; color: #9ca3af; }
            tr.alt { background: #f8fafc; }
            tr.alt-red { background: #fef2f2; }
            tfoot tr { background: #f1f5f9; font-weight: 700; }
            tfoot tr.red { background: #fee2e2; }
            .usd { color: #059669; font-weight: 700; }
            .iqd { color: #0284c7; font-weight: 700; }
            .ret-usd { color: #dc2626; font-weight: 700; }
            .ret-iqd { color: #b91c1c; font-weight: 700; }
            .summary { margin-top: 20px; }
            .summary-row { display: flex; justify-content: space-between; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; background: #f8fafc; }
            .summary-row.balance { background: #f0fdf4; border-color: #bbf7d0; }
            .summary-label { font-size: 13px; font-weight: 500; color: #4b5563; flex: 1; }
            .summary-usd { font-size: 16px; font-weight: 800; color: #059669; flex: 1; text-align: right; }
            .summary-iqd { font-size: 16px; font-weight: 800; color: #0284c7; flex: 1; text-align: right; }
            .summary-header { display: flex; padding: 0 4px; margin-bottom: 4px; }
            .summary-header span { flex: 1; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; }
            .summary-header span:nth-child(2) { text-align: right; color: #059669; }
            .summary-header span:nth-child(3) { text-align: right; color: #0284c7; }
            .notes-box { margin-top: 20px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
            .notes-box h3 { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
            .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
            @media print { body { padding: 12px; } }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleCompanySelect = async (company) => {
    setSelectedCompany(company);
    setShowModal(false);
    setIsLoading(true);
    setError(null);
    try {
      const [billsData, returnsData] = await Promise.all([
        getBoughtBills(),
        getReturnsForCompany(company.id),
      ]);

      const companyBills = billsData.filter(
        (bill) =>
          bill.companyId === company.id &&
          (bill.paymentStatus === "Unpaid" || !bill.paymentStatus)
      );

      // Group returns by returnBillNumber
      const returnsMap = new Map();

      returnsData.forEach((ret) => {
        let returnBillNumber = ret.returnBillNumber || ret.returnNumber;

        if (!returnBillNumber) {
          returnBillNumber = `BRET-${ret.id.slice(-6).toUpperCase()}`;
        }

        if (!returnsMap.has(returnBillNumber)) {
          returnsMap.set(returnBillNumber, {
            id: returnBillNumber,
            returnBillNumber: returnBillNumber,
            billNumber: ret.billNumber,
            date: ret.returnDate || ret.date,
            note: ret.returnNote || "",
            totalUSD: 0,
            totalIQD: 0,
            items: [],
            currency: null,
            paymentStatus: ret.paymentStatus,
          });
        }

        const group = returnsMap.get(returnBillNumber);
        const qty = ret.returnQuantity || 0;
        const itemCurrency = ret.currency || "USD";

        if (!group.currency) {
          group.currency = itemCurrency;
        }

        if (itemCurrency === "USD") {
          const priceUSD = ret.returnPriceUSD || ret.returnPrice || 0;
          const total = qty * priceUSD;
          group.totalUSD += total;
        } else if (itemCurrency === "IQD") {
          const priceIQD = ret.returnPriceIQD || ret.returnPrice || 0;
          const total = qty * priceIQD;
          group.totalIQD += total;
        }

        group.items.push(ret);

        if (!group.date && ret.returnDate) {
          group.date = ret.returnDate;
        }
        if (!group.note && ret.returnNote) {
          group.note = ret.returnNote;
        }
      });

      const groupedReturns = Array.from(returnsMap.values()).filter(
        (ret) => ret.paymentStatus !== "Processed" && ret.paymentStatus !== "Paid"
      );

      setBills(companyBills);
      setReturns(groupedReturns);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const billTotals = bills.map((bill) => {
    const currency = bill.currency || "USD";
    if (currency === "USD") {
      const usd = bill.items?.reduce((s, item) => s + (item.basePriceUSD || item.netPriceUSD || 0) * (item.quantity || 0), 0) || 0;
      return { usd, iqd: null, currency: "USD" };
    } else {
      const iqd = bill.items?.reduce((s, item) => s + (item.basePriceIQD || item.netPriceIQD || 0) * (item.quantity || 0), 0) || 0;
      return { usd: null, iqd, currency: "IQD" };
    }
  });

  const totalBeforeReturnUSD = billTotals.reduce((s, t) => s + (t.usd || 0), 0);
  const totalBeforeReturnIQD = billTotals.reduce((s, t) => s + (t.iqd || 0), 0);

  const totalReturnUSD = returns.reduce((s, r) => s + r.totalUSD, 0);
  const totalReturnIQD = returns.reduce((s, r) => s + r.totalIQD, 0);
  const totalAfterReturnUSD = totalBeforeReturnUSD - totalReturnUSD;
  const totalAfterReturnIQD = totalBeforeReturnIQD - totalReturnIQD;

  const containerStyle = { minHeight: "100vh", backgroundColor: "#f3f4f6", padding: "32px 24px" };
  const mainStyle = { maxWidth: "65%", margin: "0 auto" };
  const headerStyle = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: "24px", backgroundColor: "white", padding: "20px 28px",
    borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
  };
  const btnBase = {
    padding: "10px 24px", borderRadius: "10px", fontSize: "15px", fontWeight: "500",
    cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
    transition: "all 0.2s", border: "none",
  };
  const printableStyle = {
    backgroundColor: "white", padding: "40px", borderRadius: "16px",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
  };
  const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "15px", marginBottom: "30px" };
  const thStyle = {
    backgroundColor: "#f8fafc", padding: "12px 10px", textAlign: "left",
    border: "1px solid #e2e8f0", fontWeight: "600", fontSize: "13px",
    textTransform: "uppercase", letterSpacing: "0.04em",
  };
  const thRight = { ...thStyle, textAlign: "right" };
  const tdStyle = { padding: "12px 10px", border: "1px solid #e2e8f0", verticalAlign: "top" };
  const tdRight = { ...tdStyle, textAlign: "right" };
  const tdCenter = { ...tdStyle, textAlign: "center", color: "#9ca3af" };
  const noteCellStyle = { ...tdStyle, maxWidth: "300px", wordBreak: "break-word", whiteSpace: "pre-wrap" };
  const summaryRowStyle = {
    backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px",
    padding: "16px 20px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "16px",
  };

  if (showModal)
    return (
      <div style={containerStyle}>
        <CompanySelectionModal onSelect={handleCompanySelect} onClose={() => setShowModal(false)} />
      </div>
    );

  if (isLoading)
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: "center", padding: "40px", color: "#2563eb" }}>Loading...</div>
      </div>
    );

  if (error)
    return (
      <div style={containerStyle}>
        <div style={{ backgroundColor: "#fef2f2", padding: "20px", borderRadius: "12px", color: "#991b1b" }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "12px", textDecoration: "underline", background: "none", border: "none", color: "#991b1b", cursor: "pointer" }}>
            Dismiss
          </button>
        </div>
      </div>
    );

  if (!selectedCompany) return null;

  return (
    <div style={containerStyle}>
      <div style={mainStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: "700", color: "#111827", marginBottom: "6px" }}>
              Bought Statement — {selectedCompany.name}
            </h1>
            <p style={{ fontSize: "16px", color: "#6b7280" }}>{selectedCompany.name}</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => setShowModal(true)}
              style={{ ...btnBase, backgroundColor: "white", color: "#4b5563", border: "1px solid #e5e7eb" }}
            >
              Change Company
            </button>
            <button
              onClick={handlePrint}
              disabled={!bills.length && !returns.length}
              style={{
                ...btnBase, backgroundColor: "#2563eb", color: "white",
                opacity: !bills.length && !returns.length ? 0.5 : 1,
                cursor: !bills.length && !returns.length ? "not-allowed" : "pointer",
              }}
            >
              🖨️ Print Statement
            </button>
          </div>
        </div>

        <div ref={printRef} style={printableStyle}>
          <div style={{ textAlign: "center", marginBottom: "40px", borderBottom: "2px solid #e5e7eb", paddingBottom: "20px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#111827", marginBottom: "8px" }}>
              {selectedCompany.name} - كشف حساب کڕین
            </h1>
            <p className="subtitle" style={{ fontSize: "16px", color: "#6b7280", marginTop: "4px" }}>
              Generated on: {formatDate(new Date())}
            </p>
          </div>

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
                  <th style={thRight}>Amount ($)</th>
                  <th style={thRight}>Amount (IQD)</th>
                  <th style={{ ...thStyle, width: "22%" }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill, idx) => {
                  const { usd, iqd, currency } = billTotals[idx];
                  return (
                    <tr key={bill.id || idx} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                      <td style={{ ...tdStyle, fontWeight: "600" }}>#{bill.billNumber}</td>
                      <td style={tdStyle}>{bill.companyBillNumber || "N/A"}</td>
                      <td style={tdStyle}>{formatDate(bill.date)}</td>
                      {currency === "USD"
                        ? <td className="right usd" style={{ ...tdRight, color: "#059669", fontWeight: "600" }}>${formatCurrency(usd)}</td>
                        : <td className="center" style={tdCenter}>—</td>}
                      {currency === "IQD"
                        ? <td className="right iqd" style={{ ...tdRight, color: "#0284c7", fontWeight: "600" }}>{formatIQD(iqd)} IQD</td>
                        : <td className="center" style={tdCenter}>—</td>}
                      <td style={noteCellStyle}>{bill.billNote || "—"}</td>
                    </tr>
                  );
                })}
                {!bills.length && (
                  <tr>
                    <td colSpan="6" style={{ ...tdStyle, textAlign: "center", padding: "40px", color: "#6b7280" }}>
                      No unpaid purchase bills found
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "700" }}>
                  <td colSpan="3" style={{ ...tdStyle, textAlign: "right" }}>TOTAL BEFORE RETURN:</td>
                  <td className="right usd" style={{ ...tdRight, color: "#059669", fontSize: "15px" }}>
                    {totalBeforeReturnUSD > 0 ? `$${formatCurrency(totalBeforeReturnUSD)}` : "—"}
                  </td>
                  <td className="right iqd" style={{ ...tdRight, color: "#0284c7", fontSize: "15px" }}>
                    {totalBeforeReturnIQD > 0 ? `${formatIQD(totalBeforeReturnIQD)} IQD` : "—"}
                  </td>
                  <td style={tdStyle} />
                </tr>
              </tfoot>
            </table>
          </div>

          {returns.length > 0 && (
            <div style={{ marginBottom: "40px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#991b1b", marginBottom: "16px", borderBottom: "2px solid #fecaca", paddingBottom: "8px" }}>
                RETURN BILLS
              </h2>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Return Bill #</th>
                    <th style={thStyle}>Original Bill</th>
                    <th style={thStyle}>Date</th>
                    <th style={thRight}>Amount ($)</th>
                    <th style={thRight}>Amount (IQD)</th>
                    <th style={{ ...thStyle, width: "22%" }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((ret, idx) => (
                    <tr key={ret.id} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#fef2f2" }}>
                      <td style={tdStyle}>
                        {ret.returnBillNumber || `BRET-${ret.id.slice(-6).toUpperCase()}`}
                      </td>
                      <td style={tdStyle}>{ret.billNumber || "N/A"}</td>
                      <td style={tdStyle}>{formatDate(ret.date)}</td>
                      {ret.totalUSD > 0 ? (
                        <td className="right ret-usd" style={{ ...tdRight, color: "#dc2626", fontWeight: "600" }}>
                          -${formatCurrency(ret.totalUSD)}
                        </td>
                      ) : (
                        <td className="center" style={tdCenter}>—</td>
                      )}
                      {ret.totalIQD > 0 ? (
                        <td className="right ret-iqd" style={{ ...tdRight, color: "#b91c1c", fontWeight: "600" }}>
                          -{formatIQD(ret.totalIQD)} IQD
                        </td>
                      ) : (
                        <td className="center" style={tdCenter}>—</td>
                      )}
                      <td style={noteCellStyle}>{ret.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: "#fee2e2", fontWeight: "700" }}>
                    <td colSpan="3" style={{ ...tdStyle, textAlign: "right" }}>TOTAL RETURN:</td>
                    <td className="right ret-usd" style={{ ...tdRight, color: "#dc2626", fontSize: "15px" }}>
                      {totalReturnUSD > 0 ? `-$${formatCurrency(totalReturnUSD)}` : "—"}
                    </td>
                    <td className="right ret-iqd" style={{ ...tdRight, color: "#b91c1c", fontSize: "15px" }}>
                      {totalReturnIQD > 0 ? `-${formatIQD(totalReturnIQD)} IQD` : "—"}
                    </td>
                    <td style={tdStyle} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div style={{ marginTop: "40px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", marginBottom: "16px", borderBottom: "2px solid #e5e7eb", paddingBottom: "8px" }}>
              SUMMARY
            </h2>
            <div className="summary-header" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "4px", padding: "0 4px" }}>
              <span style={{ fontWeight: "600", color: "#6b7280", fontSize: "13px", textTransform: "uppercase" }}>Description</span>
              <span style={{ fontWeight: "600", color: "#059669", fontSize: "13px", textTransform: "uppercase", textAlign: "right" }}>USD ($)</span>
              <span style={{ fontWeight: "600", color: "#0284c7", fontSize: "13px", textTransform: "uppercase", textAlign: "right" }}>IQD</span>
            </div>
            <div className="summary-row" style={summaryRowStyle}>
              <span className="summary-label" style={{ fontSize: "15px", fontWeight: "500", color: "#4b5563", flex: 1 }}>Total Before Return</span>
              <span className="summary-usd" style={{ fontSize: "20px", fontWeight: "700", color: "#059669", flex: 1, textAlign: "right" }}>
                {totalBeforeReturnUSD > 0 ? `$${formatCurrency(totalBeforeReturnUSD)}` : "—"}
              </span>
              <span className="summary-iqd" style={{ fontSize: "20px", fontWeight: "700", color: "#0284c7", flex: 1, textAlign: "right" }}>
                {totalBeforeReturnIQD > 0 ? `${formatIQD(totalBeforeReturnIQD)} IQD` : "—"}
              </span>
            </div>
            <div className="summary-row" style={summaryRowStyle}>
              <span className="summary-label" style={{ fontSize: "15px", fontWeight: "500", color: "#4b5563", flex: 1 }}>Total Returns</span>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "#dc2626", flex: 1, textAlign: "right" }}>
                {totalReturnUSD > 0 ? `-$${formatCurrency(totalReturnUSD)}` : "—"}
              </span>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "#b91c1c", flex: 1, textAlign: "right" }}>
                {totalReturnIQD > 0 ? `-${formatIQD(totalReturnIQD)} IQD` : "—"}
              </span>
            </div>
            <div className="summary-row balance" style={{ ...summaryRowStyle, backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px" }}>
              <span className="summary-label" style={{ fontSize: "16px", fontWeight: "700", color: "#166534", flex: 1 }}>BALANCE DUE</span>
              <span className="summary-usd" style={{ fontSize: "22px", fontWeight: "800", color: totalAfterReturnUSD >= 0 ? "#059669" : "#dc2626", flex: 1, textAlign: "right" }}>
                {totalBeforeReturnUSD > 0 || totalReturnUSD > 0 ? `$${formatCurrency(totalAfterReturnUSD)}` : "—"}
              </span>
              <span className="summary-iqd" style={{ fontSize: "22px", fontWeight: "800", color: totalAfterReturnIQD >= 0 ? "#0284c7" : "#b91c1c", flex: 1, textAlign: "right" }}>
                {totalBeforeReturnIQD > 0 || totalReturnIQD > 0 ? `${formatIQD(totalAfterReturnIQD)} IQD` : "—"}
              </span>
            </div>
          </div>

          {notes && (
            <div className="notes-box" style={{ marginTop: "30px", padding: "24px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#1f2937", marginBottom: "12px" }}>Notes:</h3>
              <p style={{ fontSize: "15px", color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>{notes}</p>
            </div>
          )}

          <div className="footer" style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px solid #e5e7eb", textAlign: "center", fontSize: "12px", color: "#9ca3af" }}>
            <p>Generated on {formatDate(new Date())}</p>
          </div>
        </div>

        <div style={{ marginTop: "24px", backgroundColor: "white", borderRadius: "16px", padding: "28px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1f2937", marginBottom: "12px" }}>Statement Notes</h3>
          <textarea
            style={{ width: "100%", padding: "16px 20px", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "15px", lineHeight: "1.6", minHeight: "120px", resize: "vertical", fontFamily: "inherit", backgroundColor: "#f8fafc" }}
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