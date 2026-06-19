"use client";
import { useState, useEffect } from "react";
import { getSoldBills, getReturnsForPharmacy, formatDate } from "@/lib/data";
import { useRouter } from "next/navigation";

export default function PaymentDetailsModal({ payment, onClose }) {
  const [soldBillsDetails, setSoldBillsDetails] = useState([]);
  const [returnBillsDetails, setReturnBillsDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadPaymentDetails = async () => {
      try {
        setLoading(true);

        // Load sold bills details
        const allSoldBills = await getSoldBills();
        const paidSoldBills = allSoldBills.filter(bill =>
          payment.selectedSoldBills && payment.selectedSoldBills.includes(bill.id)
        );
        setSoldBillsDetails(paidSoldBills);

        // Load return bills details
        if (payment.selectedReturns && payment.selectedReturns.length > 0) {
          const allReturns = await getReturnsForPharmacy(payment.pharmacyId);
          const paidReturns = allReturns.filter(returnBill =>
            payment.selectedReturns.includes(returnBill.id)
          );
          setReturnBillsDetails(paidReturns);
        }

      } catch (error) {
        console.error("Error loading payment details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (payment) {
      loadPaymentDetails();
    }
  }, [payment]);

  const handleEditPayment = () => {
    router.push(`/payments/create?edit=${payment.id}`);
    onClose();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  if (!payment) return null;

  return (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
<div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">Payment Details</h2>
              <p className="text-blue-100 text-lg">{payment.paymentNumber}</p>
              <div className="flex flex-wrap gap-4 mt-2">
                <p className="text-blue-100 text-sm">
                  <strong>Pharmacy:</strong> {payment.pharmacyName}
                </p>
                <p className="text-blue-100 text-sm">
                  <strong>Date:</strong> {formatDate(payment.paymentDate)}
                </p>
                {payment.hardcopyBillNumber && (
                  <p className="text-blue-100 text-sm">
                    <strong>Bill #:</strong> {payment.hardcopyBillNumber}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={handleEditPayment}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-blue-100 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <div className="text-green-600 text-sm font-semibold mb-1">Sold Bills</div>
              <div className="text-2xl font-bold text-green-700">{payment.selectedSoldBills?.length || 0}</div>
              <div className="text-green-600 text-sm">+{formatCurrency(payment.soldTotal)} IQD</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-red-600 text-sm font-semibold mb-1">Returns</div>
              <div className="text-2xl font-bold text-red-700">{payment.selectedReturns?.length || 0}</div>
              <div className="text-red-600 text-sm">-{formatCurrency(payment.returnTotal)} IQD</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <div className="text-blue-600 text-sm font-semibold mb-1">Net Amount</div>
              <div className="text-2xl font-bold text-blue-700">{formatCurrency(payment.netAmount)} IQD</div>
              <div className="text-blue-600 text-sm">Final Payment</div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading payment details...</p>
            </div>
          ) : (
            <>
              {/* Sold Bills Section */}
              {soldBillsDetails.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Paid Sale Bills</h3>
                  <div className="space-y-3">
                    {soldBillsDetails.map((bill) => {
                      const billTotal = bill.items?.reduce((sum, item) =>
                        sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0;

                      return (
                        <div key={bill.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-900">Bill #{bill.billNumber}</h4>
                              <p className="text-sm text-gray-600">
                                {formatDate(bill.date)} • {bill.items?.length || 0} items
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600">{formatCurrency(billTotal)} IQD</div>
                            </div>
                          </div>

                          {/* Bill Items */}
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="p-2 text-left font-semibold text-gray-700">Item</th>
                                  <th className="p-2 text-center font-semibold text-gray-700">Qty</th>
                                  <th className="p-2 text-right font-semibold text-gray-700">Price</th>
                                  <th className="p-2 text-right font-semibold text-gray-700">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bill.items?.map((item, index) => (
                                  <tr key={index} className="border-t border-gray-100">
                                    <td className="p-2 text-gray-800">{item.name}</td>
                                    <td className="p-2 text-center text-gray-600">{item.quantity}</td>
                                    <td className="p-2 text-right text-gray-600">{formatCurrency(item.price)}</td>
                                    <td className="p-2 text-right font-medium text-green-600">
                                      {formatCurrency((item.price || 0) * (item.quantity || 0))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Return Bills Section */}
              {returnBillsDetails.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Processed Returns</h3>
                  <div className="space-y-3">
                    {returnBillsDetails.map((returnBill) => {
                      const returnTotal = (returnBill.returnQuantity || 0) * (returnBill.returnPrice || 0);

                      return (
                        <div key={returnBill.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-gray-900">Return #{returnBill.id?.slice(-6)}</h4>
                              <p className="text-sm text-gray-600">
                                Bill: #{returnBill.billNumber} • {returnBill.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                Barcode: {returnBill.barcode}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-red-600">-{formatCurrency(returnTotal)} IQD</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No Items Message */}
              {soldBillsDetails.length === 0 && returnBillsDetails.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl text-gray-300 mb-3">📄</div>
                  <p className="text-gray-600">No detailed bill information available.</p>
                </div>
              )}

              {/* Notes */}
              {payment.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-yellow-800 mb-2">Notes</h3>
                  <p className="text-yellow-700">{payment.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              <strong>Created by:</strong> {payment.createdByName} • {formatDate(payment.createdAt)}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
