"use client";
import { useState, useEffect, useRef } from "react";
import Card from "@/components/Card";
import PharmacySelectionModal from "@/components/PharmacySelectionModal";
import { format } from "date-fns";
import { useReactToPrint } from "react-to-print";
import { getPharmacies, getPharmacyBills, getReturnsForPharmacy } from "@/lib/data";

export default function StatementPage() {
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const pdfRef = useRef();
  

  // Currency formatting function
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const handlePharmacySelect = async (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setShowModal(false);
    setIsLoading(true);
    setError(null);
    try {
      const [billsResult, returnsResult] = await Promise.all([
        getPharmacyBills(pharmacy.id),
        getReturnsForPharmacy(pharmacy.id)
      ]);
      
      // Filter out paid and cash bills - only show unpaid bills
      const unpaidBills = billsResult.bills.filter(bill => 
        bill.paymentStatus !== "Paid" && bill.paymentStatus !== "Cash"
      );
      
      // FIX: Filter returns to only show UNPAID returns (not based on bill status)
      const unpaidReturns = returnsResult.filter(returnItem => 
        returnItem.paymentStatus !== "Processed" && returnItem.paymentStatus !== "Paid"
      );
      
      setBills(unpaidBills);
      setReturns(unpaidReturns);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err.message || "Failed to load data for this pharmacy");
    } finally {
      setIsLoading(false);
    }
  };

  const totalBeforeReturn = bills.reduce((sum, bill) => {
    const billTotal = bill.items.reduce((itemSum, item) =>
      itemSum + (item.price * item.quantity), 0);
    return sum + billTotal;
  }, 0);

  const totalReturn = returns.reduce((sum, returnItem) => {
    return sum + (returnItem.returnQuantity * returnItem.returnPrice);
  }, 0);

  const totalAfterReturn = totalBeforeReturn - totalReturn;

  const formatDateForDisplay = (date) => {
    if (!date) return 'N/A';
    return format(new Date(date), 'MMM dd, yyyy');
  };

  const handlePrint = useReactToPrint({
    content: () => pdfRef.current,
    documentTitle: `Statement_${selectedPharmacy?.name || 'Pharmacy'}_${format(new Date(), 'yyyyMMdd')}`,
  });

  return (
    <div className="container py-8">
      {showModal && !selectedPharmacy && (
        <PharmacySelectionModal
          onSelect={handlePharmacySelect}
          onClose={() => setShowModal(false)}
        />
      )}
      {selectedPharmacy && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">
              Statement for {selectedPharmacy.name}
            </h1>
            <button
              className="btn btn-primary"
              onClick={handlePrint}
            >
              Print Statement
            </button>
          </div>
          
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
              <div ref={pdfRef} className="p-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold mb-2">STATEMENT OF ACCOUNT - UNPAID BILLS</h1>
                  <h2 className="text-xl font-semibold mb-1">{selectedPharmacy.name}</h2>
                  <p className="text-sm text-gray-600">
                    {format(new Date(), 'MMM dd, yyyy hh:mm a')}
                  </p>
                </div>
                
                {/* Sales Bills Table */}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold mb-4 border-b-2 border-gray-300 pb-2">UNPAID SALES BILLS</h2>
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-2 text-center">Bill #</th>
                          <th className="p-2 text-center">Date</th>
                          <th className="p-2 text-center">Payment Status</th>
                          <th className="p-2 text-center">Amount (IQD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bills.length > 0 ? (
                          bills.map((bill, index) => {
                            const billTotal = bill.items.reduce((sum, item) =>
                              sum + (item.price * item.quantity), 0);
                            return (
                              <tr key={bill.id} className={`hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                <td className="p-2 text-center">{bill.billNumber}</td>
                                <td className="p-2 text-center">
                                  {formatDateForDisplay(bill.date)}
                                </td>
                                <td className="p-2 text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    bill.paymentStatus === 'Paid' || bill.paymentStatus === 'Cash' 
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {bill.paymentStatus}
                                  </span>
                                </td>
                                <td className="p-2 text-right font-medium">
                                  {formatCurrency(billTotal)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="4" className="p-4 text-center text-gray-500">
                              No unpaid sales bills found
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan="3" className="p-2 text-right font-bold">Total Unpaid Sales:</td>
                          <td className="p-2 text-right font-bold text-lg">
                            {formatCurrency(totalBeforeReturn)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Returned Items Table */}
                {returns.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 border-b-2 border-gray-300 pb-2 text-red-600">RETURNED ITEMS (FROM UNPAID BILLS)</h2>
                    <div className="overflow-x-auto">
                      <table className="table w-full">
                        <thead className="bg-red-50">
                          <tr>
                            <th className="p-2 text-center">Return #</th>
                            <th className="p-2 text-center">Original Bill #</th>
                            <th className="p-2 text-center">Item</th>
                            <th className="p-2 text-center">Barcode</th>
                            <th className="p-2 text-center">Return Qty</th>
                            <th className="p-2 text-center">Return Price (IQD)</th>
                            <th className="p-2 text-center">Return Date</th>
                            <th className="p-2 text-center">Total (IQD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returns.map((returnItem, index) => (
                            <tr key={index} className={`hover:bg-red-100 ${index % 2 === 0 ? 'bg-white' : 'bg-red-50'}`}>
                              <td className="p-2 text-center font-medium">
                                Return #{returnItem.returnNumber || returnItem.id?.slice(-6) || 'N/A'}
                              </td>
                              <td className="p-2 text-center">{returnItem.billNumber || 'N/A'}</td>
                              <td className="p-2 text-center">{returnItem.name}</td>
                              <td className="p-2 text-center">{returnItem.barcode}</td>
                              <td className="p-2 text-center">{returnItem.returnQuantity}</td>
                              <td className="p-2 text-center">
                                {formatCurrency(returnItem.returnPrice)}
                              </td>
                              <td className="p-2 text-center">
                                {returnItem.returnDate ?
                                  formatDateForDisplay(returnItem.returnDate) : 'N/A'}
                              </td>
                              <td className="p-2 text-right font-medium">
                                {formatCurrency(returnItem.returnQuantity * returnItem.returnPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-red-100">
                          <tr>
                            <td colSpan="7" className="p-2 text-left font-bold">Total Returns:</td>
                            <td className="p-2 text-left font-bold text-lg">
                              {formatCurrency(totalReturn)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Summary Section */}
                <div className="border-t-2 border-gray-300 pt-6 mt-6">
                  <h2 className="text-xl font-semibold mb-4">SUMMARY</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="text-sm font-medium text-gray-600 mb-1">Total Unpaid Sales</div>
                      <div className="text-xl font-bold text-gray-800">
                        {formatCurrency(totalBeforeReturn)} IQD
                      </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="text-sm font-medium text-red-600 mb-1">Total Returns</div>
                      <div className="text-xl font-bold text-red-800">
                        -{formatCurrency(totalReturn)} IQD
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="text-sm font-medium text-green-600 mb-1">Net Amount Due</div>
                      <div className="text-xl font-bold text-green-800">
                        {formatCurrency(totalAfterReturn)} IQD
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-gray-300 text-center text-sm text-gray-600">
                  <p>Generated on {format(new Date(), 'MMMM dd, yyyy')}</p>
                  <p className="mt-1">This statement includes only unpaid bills and returns</p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}