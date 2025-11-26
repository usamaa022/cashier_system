"use client";
import { useState, useEffect, useRef } from "react";
import { getCompanies, getBoughtBills, getReturnsForCompany } from "@/lib/data";
import Card from "@/components/Card";
import CompanySelectionModal from "@/components/CompanySelectionModal";
import { useReactToPrint } from "react-to-print";

export default function BoughtStatementPage() {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState(""); // <-- Add notes state
  const pdfRef = useRef();

  // Currency formatting function
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date to DD/MM/YYYY
  const formatDateToDDMMYYYY = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleCompanySelect = async (company) => {
    setSelectedCompany(company);
    setShowModal(false);
    setIsLoading(true);
    setError(null);
    try {
      const [billsResult, returnsResult] = await Promise.all([
        getBoughtBills(),
        getReturnsForCompany(company.id)
      ]);

      // Filter bills for the selected company and unpaid status
      const companyBills = billsResult.filter(bill =>
        bill.companyId === company.id &&
        (bill.paymentStatus === "Unpaid" || !bill.paymentStatus)
      );

      // Filter returns for unpaid status
      const unpaidReturns = returnsResult.filter(returnItem =>
        returnItem.paymentStatus !== "Processed" && returnItem.paymentStatus !== "Paid"
      );

      setBills(companyBills);
      setReturns(unpaidReturns);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err.message || "Failed to load data for this company");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate totals
  const totalBeforeReturn = bills.reduce((sum, bill) => {
    const billTotal = bill.items.reduce((itemSum, item) =>
      itemSum + (item.netPrice * item.quantity), 0);
    return sum + billTotal;
  }, 0);

  const totalReturn = returns.reduce((sum, returnItem) => {
    return sum + (returnItem.returnQuantity * returnItem.returnPrice);
  }, 0);

  const totalAfterReturn = totalBeforeReturn - totalReturn;

  // Calculate consignment totals
  const consignmentBills = bills.filter(bill => bill.isConsignment);
  const totalConsignmentBeforeReturn = consignmentBills.reduce((sum, bill) => {
    const billTotal = bill.items.reduce((itemSum, item) =>
      itemSum + (item.netPrice * item.quantity), 0);
    return sum + billTotal;
  }, 0);

  const consignmentReturns = returns.filter(returnItem => returnItem.isConsignment);
  const totalConsignmentReturn = consignmentReturns.reduce((sum, returnItem) => {
    return sum + (returnItem.returnQuantity * returnItem.returnPrice);
  }, 0);

  const totalConsignmentAfterReturn = totalConsignmentBeforeReturn - totalConsignmentReturn;

  const handlePrint = useReactToPrint({
    content: () => pdfRef.current,
    documentTitle: `Bought_Statement_${selectedCompany?.name || 'Company'}_${new Date().toISOString().split('T')[0]}`,
  });

  // Consignment Badge Component
  const ConsignmentBadge = ({ isConsignment }) => {
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${
        isConsignment ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
      }`}>
        {isConsignment ? "تحت صرف" : "Owned"}
      </span>
    );
  };

  return (
    <div className="container py-8">
      {showModal && !selectedCompany && (
        <CompanySelectionModal
          onSelect={handleCompanySelect}
          onClose={() => setShowModal(false)}
        />
      )}
      {selectedCompany && (
        <>
          {isLoading && (
            <div className="mt-2 p-4 bg-blue-50 rounded-lg">
              <p className="text-center text-blue-700">Loading data...</p>
            </div>
          )}
          {error && (
            <div className="alert alert-danger mb-4">
              {error}
              <button onClick={() => setError(null)} className="ml-4 text-red-800">×</button>
            </div>
          )}
          {!isLoading && !error && (
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Bought Statement - {selectedCompany.name}</h1>
                <button
                  onClick={handlePrint}
                  className="btn btn-primary px-4 py-2"
                >
                  Print Statement
                </button>
              </div>
              <div ref={pdfRef} className="p-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold mb-2">BOUGHT STATEMENT - {selectedCompany.name}</h1>
                  <p className="text-sm text-gray-600">
                    Generated on: {formatDateToDDMMYYYY(new Date())}
                  </p>
                </div>

                {/* Purchase Bills Table */}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-4 border-b-2 border-gray-300 pb-2">UNPAID PURCHASE BILLS</h2>
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-2 text-center">Bill #</th>
                          <th className="p-2 text-center">Company Bill #</th>
                          <th className="p-2 text-center">Date</th>
                          <th className="p-2 text-center">Consignment</th>
                          <th className="p-2 text-center">Amount (IQD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bills.length > 0 ? (
                          bills.map((bill, index) => {
                            const billTotal = bill.items.reduce((sum, item) =>
                              sum + (item.netPrice * item.quantity), 0);
                            return (
                              <tr key={bill.billNumber} className={`hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                <td className="p-2 text-left font-bold">#{bill.billNumber}</td>
                                <td className="p-2 text-left">
                                  {bill.companyBillNumber || 'N/A'}
                                </td>
                                <td className="p-2 text-left">
                                  {formatDateToDDMMYYYY(bill.date)}
                                </td>
                                <td className="p-2 text-left">
                                  <ConsignmentBadge isConsignment={bill.isConsignment} />
                                </td>
                                <td className="p-2 text-left font-medium text-green-600">
                                  {formatCurrency(billTotal)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="5" className="p-4 text-center text-gray-500">
                              No unpaid purchase bills found
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan="4" className="p-2 text-right font-bold">Total Before Return:</td>
                          <td className="p-2 text-left font-bold text-lg text-green-600">
                            {formatCurrency(totalBeforeReturn)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Return Bills Table */}
                {returns.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 border-b-2 border-red-300 pb-2 text-red-600">RETURN BILLS</h2>
                    <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead className="bg-red-50">
                          <tr>
                            <th className="p-2 text-center w-1/4">Return #</th>
                            <th className="p-2 text-left w-1/2">Original Bill #</th>
                            <th className="p-2 text-center w-1/4">Return Date</th>
                            <th className="p-2 text-center w-1/4">Consignment</th>
                            <th className="p-2 text-center w-1/4">Return Amount (IQD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returns.map((returnItem, index) => (
                            <tr key={index} className={`hover:bg-red-100 ${index % 2 === 0 ? 'bg-white' : 'bg-red-50'}`}>
                              <td className="p-2 text-left font-sm w-2/5">
                                Return #{returnItem.returnNumber || returnItem.id?.slice(-6) || 'N/A'}
                              </td>
                              <td className="p-2 text-left w-1/5">
                                {returnItem.originalBillNumber || returnItem.billNumber || 'N/A'}
                              </td>
                              <td className="p-2 text-center w-1/5">
                                {formatDateToDDMMYYYY(returnItem.returnDate)}
                              </td>
                              <td className="p-2 text-center w-1/5">
                                <ConsignmentBadge isConsignment={returnItem.isConsignment} />
                              </td>
                              <td className="p-2 text-right font-medium text-red-600 w-1/5">
                                -{formatCurrency(returnItem.returnQuantity * returnItem.returnPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-red-100">
                          <tr>
                            <td colSpan="4" className="p-2 text-right font-bold">Total Return:</td>
                            <td className="p-2 text-right font-bold text-lg text-red-600">
                              -{formatCurrency(totalReturn)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Consignment Summary Section */}
                {(consignmentBills.length > 0 || consignmentReturns.length > 0) && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 border-b-2 border-yellow-300 pb-2 text-yellow-600">CONSIGNMENT SUMMARY</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div className="text-sm font-medium text-yellow-600 mb-1">Total Consignment Before Return</div>
                        <div className="text-xl font-bold text-yellow-800">
                          {formatCurrency(totalConsignmentBeforeReturn)} IQD
                        </div>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div className="text-sm font-medium text-yellow-600 mb-1">Total Consignment Return</div>
                        <div className="text-xl font-bold text-yellow-800">
                          -{formatCurrency(totalConsignmentReturn)} IQD
                        </div>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div className="text-sm font-medium text-yellow-600 mb-1">Total Consignment After Return</div>
                        <div className="text-xl font-bold text-yellow-800">
                          {formatCurrency(totalConsignmentAfterReturn)} IQD
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes Section */}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-4 border-b-2 border-gray-300 pb-2">NOTES</h2>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="Add any notes or comments regarding this statement..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  ></textarea>
                </div>

                {/* Summary Section */}
                <div className="border-t-2 border-gray-300 pt-6 mt-6">
                  <h2 className="text-xl font-semibold mb-4">SUMMARY</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="text-sm font-medium text-gray-600 mb-1">Total Before Return</div>
                      <div className="text-xl font-bold text-gray-800">
                        {formatCurrency(totalBeforeReturn)} IQD
                      </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="text-sm font-medium text-red-600 mb-1">Total Return</div>
                      <div className="text-xl font-bold text-red-800">
                        -{formatCurrency(totalReturn)} IQD
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="text-sm font-medium text-green-600 mb-1">Total After Return</div>
                      <div className="text-xl font-bold text-green-800">
                        {formatCurrency(totalAfterReturn)} IQD
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-gray-300 text-center text-sm text-gray-600">
                  <p>Generated on {formatDateToDDMMYYYY(new Date())}</p>
                  {notes && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="font-semibold mb-2">Notes:</h3>
                      <p className="whitespace-pre-wrap">{notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
