"use client";
import React, { useEffect } from "react";

const PaymentBill = ({
  pharmacyName,
  pharmacyCode,
  soldBills = [],
  returns = [],
  hardcopyBillNumber,
  paymentNumber,
  soldTotal,
  returnTotal,
  netAmount,
  createdByName,
  paymentDate,
  notes,
  autoPrint = false
}) => {
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US").format(amount || 0) + " IQD";
  };

  // Format date
  const formatDate = (date) => {
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

  // Calculate return total with fallback
  const calculateReturnTotal = (ret) => {
    if (ret.totalReturn) return ret.totalReturn;
    if (ret.items && Array.isArray(ret.items)) {
      return ret.items.reduce((sum, item) => {
        const price = item.returnPrice || item.price || item.unitPrice || 0;
        const quantity = item.returnQuantity || item.quantity || 1;
        return sum + (price * quantity);
      }, 0);
    }
    return 0;
  };

  // Auto print if enabled
  useEffect(() => {
    if (autoPrint && paymentNumber) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, paymentNumber]);

  return (
    <>
      {/* Hidden on screen, visible when printing */}
      <div className="payment-bill" style={{ 
        display: 'none',
        fontFamily: 'Arial, sans-serif'
      }}>
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .payment-bill,
            .payment-bill * {
              visibility: visible !important;
              display: block !important;
            }
            
            .payment-bill {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              min-height: 100vh !important;
              background: white !important;
              z-index: 999999 !important;
            }
            
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
          }
        `}</style>

        {/* Receipt Container - Ultra Compact for one page */}
        <div style={{
          width: '210mm',
          minHeight: '297mm',
          margin: '0 auto',
          padding: '12mm',
          backgroundColor: 'white',
          fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
          color: '#1a202c',
          boxSizing: 'border-box',
          fontSize: '10px',
          lineHeight: '1.25'
        }}>
          {/* Header - Logo and Store Name in one compact row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '15px',
            paddingBottom: '10px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '12px 15px',
            borderRadius: '8px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src="/Aranlogo.png" 
                alt="Aran Med Store Logo"
                style={{
                  width: '45px',
                  height: '45px',
                  objectFit: 'contain',
                  backgroundColor: 'white',
                  padding: '5px',
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              />
              <div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  margin: '0 0 2px 0',
                  letterSpacing: '0.3px',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  ARAN MED STORE
                </div>
                <div style={{ fontSize: '9px', opacity: '0.9', fontFamily: "'Inter', sans-serif" }}>
                  Sulaymaniyah • Opposite Smart Health Tower • +964 772 533 5252
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '11px',
                opacity: '0.9',
                marginBottom: '3px',
                fontFamily: "'Inter', sans-serif"
              }}>
                PAYMENT RECEIPT
              </div>
              <div style={{
                fontSize: '14px',
                fontWeight: '700',
                fontFamily: "'Inter', sans-serif"
              }}>
                {paymentNumber}
              </div>
            </div>
          </div>

          {/* Pharmacy & Payment Info - Modern Card Style */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '15px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
              padding: '10px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(253, 160, 133, 0.2)'
            }}>
              <div style={{
                fontSize: '10px',
                fontWeight: '600',
                marginBottom: '6px',
                color: '#7b341e',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span>🏥</span> Pharmacy Details
              </div>
              <div style={{ fontSize: '9px', color: '#744210' }}>
                <div><strong>Name:</strong> {pharmacyName}</div>
                <div><strong>Code:</strong> {pharmacyCode}</div>
                <div><strong>Hardcopy Bill:</strong> {hardcopyBillNumber}</div>
              </div>
            </div>
            
            <div style={{
              background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              padding: '10px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(168, 237, 234, 0.2)'
            }}>
              <div style={{
                fontSize: '10px',
                fontWeight: '600',
                marginBottom: '6px',
                color: '#2d3748',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span>👤</span> Payment Details
              </div>
              <div style={{ fontSize: '9px', color: '#4a5568' }}>
                <div><strong>Processed By:</strong> {createdByName}</div>
                <div><strong>Payment Date:</strong> {formatDate(paymentDate)}</div>
                <div><strong>Status:</strong> Completed ✓</div>
              </div>
            </div>
          </div>

          {/* Sold Bills Section - Modern Design */}
          {soldBills.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
                padding: '8px 10px',
                background: 'linear-gradient(135deg, #38b2ac 0%, #319795 100%)',
                borderRadius: '6px',
                color: 'white',
                boxShadow: '0 2px 8px rgba(56, 178, 172, 0.2)'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>💰</span> PAID SOLD BILLS ({soldBills.length})
                </div>
                <div style={{ fontSize: '10px', opacity: '0.9' }}>
                  Total: {formatCurrency(soldTotal)}
                </div>
              </div>
              
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                overflow: 'hidden'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '9px'
                }}>
                  <thead>
                    <tr style={{ 
                      background: 'linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%)',
                      borderBottom: '2px solid #38b2ac'
                    }}>
                      <th style={{ 
                        padding: '8px 6px', 
                        textAlign: 'left', 
                        fontWeight: '600',
                        color: '#22543d'
                      }}>Bill #</th>
                      <th style={{ 
                        padding: '8px 6px', 
                        textAlign: 'center', 
                        fontWeight: '600',
                        color: '#22543d'
                      }}>Date</th>
                      <th style={{ 
                        padding: '8px 6px', 
                        textAlign: 'right', 
                        fontWeight: '600',
                        color: '#22543d'
                      }}>Amount (IQD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soldBills.map((bill, index) => {
                      const billTotal = calculateBillTotal(bill);
                      
                      return (
                        <tr key={bill.id || index} style={{ 
                          borderBottom: '1px solid #edf2f7',
                          backgroundColor: index % 2 === 0 ? 'white' : '#f7fafc',
                          transition: 'background-color 0.2s'
                        }}>
                          <td style={{ 
                            padding: '7px 6px',
                            fontWeight: '500',
                            color: '#2d3748'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                width: '16px',
                                height: '16px',
                                backgroundColor: '#38b2ac',
                                color: 'white',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '8px',
                                fontWeight: 'bold'
                              }}>{index + 1}</span>
                              {bill.billNumber || `BILL-${index + 1}`}
                            </div>
                          </td>
                          <td style={{ 
                            padding: '7px 6px', 
                            textAlign: 'center',
                            color: '#4a5568'
                          }}>
                            {formatDate(bill.date)}
                          </td>
                          <td style={{ 
                            padding: '7px 6px', 
                            textAlign: 'right',
                            fontWeight: '600',
                            color: '#22543d'
                          }}>
                            {formatCurrency(billTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {/* Sold Bills Total - Modern Style */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 12px',
                  background: 'linear-gradient(135deg, #9ae6b4 0%, #68d391 100%)',
                  borderTop: '2px solid #38b2ac'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '18px',
                      height: '18px',
                      backgroundColor: '#22543d',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px'
                    }}>∑</span>
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#22543d' }}>
                      Total Sold Amount:
                    </span>
                  </div>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: '700',
                    color: '#22543d',
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}>
                    {formatCurrency(soldTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Returns Section - Modern Design */}
          {returns.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
                padding: '8px 10px',
                background: 'linear-gradient(135deg, #fc8181 0%, #f56565 100%)',
                borderRadius: '6px',
                color: 'white',
                boxShadow: '0 2px 8px rgba(252, 129, 129, 0.2)'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>🔄</span> PROCESSED RETURNS ({returns.length})
                </div>
                <div style={{ fontSize: '10px', opacity: '0.9' }}>
                  Total: -{formatCurrency(returnTotal)}
                </div>
              </div>
              
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                overflow: 'hidden'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '9px'
                }}>
                  <thead>
                    <tr style={{ 
                      background: 'linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%)',
                      borderBottom: '2px solid #fc8181'
                    }}>
                      <th style={{ 
                        padding: '8px 6px', 
                        textAlign: 'left', 
                        fontWeight: '600',
                        color: '#742a2a'
                      }}>Return #</th>
                      <th style={{ 
                        padding: '8px 6px', 
                        textAlign: 'center', 
                        fontWeight: '600',
                        color: '#742a2a'
                      }}>Date</th>
                      <th style={{ 
                        padding: '8px 6px', 
                        textAlign: 'right', 
                        fontWeight: '600',
                        color: '#742a2a'
                      }}>Amount (IQD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((ret, index) => {
                      const returnTotalAmount = calculateReturnTotal(ret);
                      
                      return (
                        <tr key={ret.id || index} style={{ 
                          borderBottom: '1px solid #edf2f7',
                          backgroundColor: index % 2 === 0 ? 'white' : '#f7fafc'
                        }}>
                          <td style={{ 
                            padding: '7px 6px',
                            fontWeight: '500',
                            color: '#2d3748'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{
                                width: '16px',
                                height: '16px',
                                backgroundColor: '#fc8181',
                                color: 'white',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '8px',
                                fontWeight: 'bold'
                              }}>{index + 1}</span>
                              {ret.returnNumber || `RET-${ret.id ? ret.id.slice(-4) : index + 1}`}
                              {ret.billNumber && (
                                <span style={{
                                  fontSize: '8px',
                                  color: '#718096',
                                  backgroundColor: '#edf2f7',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  marginLeft: '4px'
                                }}>
                                  From: {ret.billNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ 
                            padding: '7px 6px', 
                            textAlign: 'center',
                            color: '#4a5568'
                          }}>
                            {formatDate(ret.date)}
                          </td>
                          <td style={{ 
                            padding: '7px 6px', 
                            textAlign: 'right',
                            fontWeight: '600',
                            color: '#742a2a'
                          }}>
                            -{formatCurrency(returnTotalAmount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {/* Returns Total - Modern Style */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 12px',
                  background: 'linear-gradient(135deg, #feb2b2 0%, #fc8181 100%)',
                  borderTop: '2px solid #fc8181'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '18px',
                      height: '18px',
                      backgroundColor: '#742a2a',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px'
                    }}>∑</span>
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#742a2a' }}>
                      Total Returns:
                    </span>
                  </div>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: '700',
                    color: '#742a2a',
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}>
                    -{formatCurrency(returnTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Summary - Modern Premium Design */}
          <div style={{
            margin: '15px 0',
            padding: '15px',
            background: 'linear-gradient(135deg, #4c51bf 0%, #2d3748 100%)',
            borderRadius: '10px',
            color: 'white',
            textAlign: 'center',
            boxShadow: '0 4px 15px rgba(76, 81, 191, 0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Decorative elements */}
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '50%'
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: '-15px',
              left: '-15px',
              width: '60px',
              height: '60px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '50%'
            }}></div>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: '600',
                marginBottom: '15px',
                letterSpacing: '0.5px',
                opacity: '0.9'
              }}>
                FINAL PAYMENT SETTLEMENT
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '15px',
                textAlign: 'left'
              }}>
                <div style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  padding: '12px',
                  borderRadius: '8px',
                  backdropFilter: 'blur(5px)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <div style={{ 
                    fontSize: '9px', 
                    marginBottom: '6px', 
                    opacity: '0.8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>📈</span> Total Sales
                  </div>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '700', 
                    color: '#68d391',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    +{formatCurrency(soldTotal)}
                  </div>
                  <div style={{ 
                    fontSize: '8px', 
                    opacity: '0.7',
                    marginTop: '4px'
                  }}>
                    {soldBills.length} bill(s) processed
                  </div>
                </div>
                
                <div style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  padding: '12px',
                  borderRadius: '8px',
                  backdropFilter: 'blur(5px)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <div style={{ 
                    fontSize: '9px', 
                    marginBottom: '6px', 
                    opacity: '0.8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>📉</span> Total Returns
                  </div>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '700', 
                    color: '#fc8181',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    -{formatCurrency(returnTotal)}
                  </div>
                  <div style={{ 
                    fontSize: '8px', 
                    opacity: '0.7',
                    marginTop: '4px'
                  }}>
                    {returns.length} return(s) processed
                  </div>
                </div>
              </div>
              
              <div style={{
                borderTop: '2px solid rgba(255,255,255,0.3)',
                paddingTop: '15px',
                marginTop: '10px'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  marginBottom: '10px', 
                  opacity: '0.9',
                  letterSpacing: '1px'
                }}>
                  NET AMOUNT PAYABLE
                </div>
                <div style={{
                  fontSize: '28px',
                  fontWeight: '800',
                  margin: '10px 0',
                  color: 'white',
                  textShadow: '0 3px 6px rgba(0,0,0,0.4)',
                  fontFamily: "'Inter', sans-serif",
                  letterSpacing: '0.5px'
                }}>
                  {formatCurrency(netAmount)}
                </div>
                <div style={{ 
                  fontSize: '9px', 
                  opacity: '0.8',
                  fontStyle: 'italic',
                  marginTop: '5px'
                }}>
                  المبلغ النهائي المستحق للدفع
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section - Modern */}
          {notes && (
            <div style={{
              marginBottom: '12px',
              padding: '10px',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              borderRadius: '8px',
              borderLeft: '4px solid #f59e0b'
            }}>
              <div style={{
                fontSize: '10px',
                fontWeight: '600',
                color: '#92400e',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span>📝</span> NOTES
              </div>
              <div style={{
                fontSize: '9px',
                color: '#92400e',
                fontStyle: 'italic'
              }}>
                {notes}
              </div>
            </div>
          )}

          {/* Stats Counter - Modern */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '15px'
          }}>
            <div style={{
              textAlign: 'center',
              padding: '8px',
              background: 'linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%)',
              borderRadius: '6px',
              border: '1px solid #38b2ac'
            }}>
              <div style={{ fontSize: '9px', color: '#22543d', marginBottom: '3px' }}>
                Bills Count
              </div>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '700', 
                color: '#22543d'
              }}>
                {soldBills.length}
              </div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '8px',
              background: 'linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%)',
              borderRadius: '6px',
              border: '1px solid #fc8181'
            }}>
              <div style={{ fontSize: '9px', color: '#742a2a', marginBottom: '3px' }}>
                Returns Count
              </div>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '700', 
                color: '#742a2a'
              }}>
                {returns.length}
              </div>
            </div>
          </div>

          {/* Footer - Minimal */}
          <div style={{
            marginTop: '15px',
            paddingTop: '10px',
            borderTop: '1px solid #e2e8f0',
            fontSize: '8px',
            color: '#718096',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '5px', fontWeight: '600', fontSize: '9px', color: '#4a5568' }}>
              ARAN MED STORE • Official Payment Receipt
            </div>
            <div>
              System-generated receipt • Valid for accounting • تم إنشاء هذا الإيصال تلقائياً<br/>
              For inquiries: +964 772 533 5252 • Receipt ID: {paymentNumber}
            </div>
          </div>

          {/* Signature Area - Modern */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '20px',
            paddingTop: '15px',
            borderTop: '1px dashed #cbd5e0'
          }}>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{
                borderBottom: '1px solid #94a3b8',
                paddingBottom: '12px',
                marginBottom: '8px',
                height: '18px'
              }}></div>
              <div style={{ fontSize: '9px', fontWeight: '600', color: '#4a5568' }}>
                Customer Signature
              </div>
              <div style={{ fontSize: '8px', color: '#94a3b8' }}>توقيع العميل</div>
            </div>
            
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{
                borderBottom: '1px solid #94a3b8',
                paddingBottom: '12px',
                marginBottom: '8px',
                height: '18px'
              }}></div>
              <div style={{ fontSize: '9px', fontWeight: '600', color: '#4a5568' }}>
                Authorized Signatory
              </div>
              <div style={{ fontSize: '8px', color: '#94a3b8' }}>
                {createdByName}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentBill;