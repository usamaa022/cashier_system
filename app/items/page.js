"use client";
import { useState, useEffect } from "react";
import { getInitializedItems, addInitializedItem, updateInitializedItem, deleteInitializedItem, searchInitializedItems } from "@/lib/data";

// Format currency in USD
const formatUSD = (amount) => {
  if (amount === undefined || amount === null) return "$0.00";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export default function ItemsPage() {
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    outPrice: 0,
  });
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [barcodeMode, setBarcodeMode] = useState("auto");
  const [nextBarcode, setNextBarcode] = useState("ar1000");
  const [barcodeError, setBarcodeError] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (items.length > 0 && barcodeMode === "auto") {
      generateNextBarcode();
    } else if (items.length === 0 && barcodeMode === "auto") {
      setNextBarcode("ar1000");
    }
  }, [items, barcodeMode]);

  const fetchItems = async () => {
    try {
      const items = await getInitializedItems();
      setItems(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const searchItems = async () => {
      if (searchQuery.trim() === "") {
        fetchItems();
      } else {
        const results = await searchInitializedItems(searchQuery);
        setItems(results);
      }
    };
    searchItems();
  }, [searchQuery]);

  const generateNextBarcode = () => {
    if (items.length === 0) {
      setNextBarcode("ar1000");
      return;
    }

    const barcodeNumbers = items
      .map(item => item.barcode)
      .filter(barcode => barcode && barcode.toLowerCase().startsWith('ar'))
      .map(barcode => {
        const number = parseInt(barcode.substring(2));
        return isNaN(number) ? 0 : number;
      })
      .filter(num => num > 0);

    if (barcodeNumbers.length === 0) {
      setNextBarcode("ar1000");
      return;
    }

    const maxNumber = Math.max(...barcodeNumbers);
    const nextNumber = maxNumber + 1;
    setNextBarcode(`ar${nextNumber}`);
  };

  const checkBarcodeExists = (barcode, excludeId = null) => {
    return items.some(item => 
      item.barcode.toLowerCase() === barcode.toLowerCase() && 
      (!excludeId || item.id !== excludeId)
    );
  };

  const handleBarcodeModeChange = (mode) => {
    setBarcodeMode(mode);
    setBarcodeError("");
    
    if (mode === "auto") {
      generateNextBarcode();
      setFormData({ ...formData, barcode: nextBarcode });
    } else {
      setFormData({ ...formData, barcode: "" });
    }
  };

  const handleManualBarcodeChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, barcode: value });
    
    if (value && checkBarcodeExists(value, editingItem?.id)) {
      const existingItem = items.find(item => 
        item.barcode.toLowerCase() === value.toLowerCase() && 
        (!editingItem || item.id !== editingItem.id)
      );
      setBarcodeError(`This barcode refers to "${existingItem?.name}" and cannot be reused`);
    } else {
      setBarcodeError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBarcodeError("");
    
    if (!formData.barcode.trim()) {
      setBarcodeError("Barcode is required");
      return;
    }

    if (checkBarcodeExists(formData.barcode, editingItem?.id)) {
      const existingItem = items.find(item => 
        item.barcode.toLowerCase() === formData.barcode.toLowerCase() && 
        (!editingItem || item.id !== editingItem.id)
      );
      setBarcodeError(`This barcode refers to "${existingItem?.name}" and cannot be reused`);
      return;
    }
    
    try {
      const itemData = {
        barcode: formData.barcode,
        name: formData.name,
        outPrice: parseFloat(formData.outPrice) || 0,
        outPricePharmacy: parseFloat(formData.outPrice) || 0,
        outPriceStore: parseFloat(formData.outPrice) || 0,
        outPriceOther: parseFloat(formData.outPrice) || 0,
        netPrice: 0,
      };

      if (editingItem) {
        await updateInitializedItem({ ...itemData, id: editingItem.id });
        setSuccess("Item updated successfully!");
      } else {
        await addInitializedItem(itemData);
        setSuccess("Item added successfully!");
      }
      
      await fetchItems();
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setBarcodeMode("manual");
    setFormData({
      barcode: item.barcode,
      name: item.name,
      outPrice: item.outPrice || item.outPricePharmacy || 0,
    });
    setBarcodeError("");
  };

  const handleDelete = async (itemId) => {
    if (confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteInitializedItem(itemId);
        await fetchItems();
        setSuccess("Item deleted successfully!");
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      barcode: barcodeMode === "auto" ? nextBarcode : "",
      name: "",
      outPrice: 0,
    });
    setEditingItem(null);
    setBarcodeError("");
  };

  const handleCancel = () => {
    resetForm();
  };

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #e0e7ff',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }} />
        <p style={{ color: '#4a5568' }}>Loading...</p>
      </div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem'
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '0.5rem'
          }}>
            Item Management
          </h1>
        
        </div>

        {/* Add/Edit Item Card */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.35rem',
              fontWeight: '600',
              color: '#1e293b'
            }}>
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h2>
            {!editingItem && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleBarcodeModeChange("auto")}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid',
                    borderRadius: '6px',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    background: barcodeMode === "auto" ? '#3b82f6' : 'white',
                    borderColor: barcodeMode === "auto" ? '#3b82f6' : '#e2e8f0',
                    color: barcodeMode === "auto" ? 'white' : '#64748b',
                    transition: 'all 0.2s'
                  }}
                >
                  Auto Barcode
                </button>
                <button
                  onClick={() => handleBarcodeModeChange("manual")}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid',
                    borderRadius: '6px',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    background: barcodeMode === "manual" ? '#3b82f6' : 'white',
                    borderColor: barcodeMode === "manual" ? '#3b82f6' : '#e2e8f0',
                    color: barcodeMode === "manual" ? 'white' : '#64748b',
                    transition: 'all 0.2s'
                  }}
                >
                  Manual Barcode
                </button>
              </div>
            )}
          </div>

          {/* Alerts */}
          {error && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '1.2rem'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              background: '#f0fdf4',
              border: '1px solid #dcfce7',
              borderRadius: '6px',
              color: '#16a34a',
              fontSize: '1.2rem'
            }}>
              {success}
            </div>
          )}

          {barcodeError && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '6px',
              color: '#b45309',
              fontSize: '1.2rem'
            }}>
              {barcodeError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              {/* Barcode Field */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '1.2rem',
                  fontWeight: '500',
                  color: '#475569',
                  marginBottom: '0.25rem'
                }}>
                  Barcode <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: `1px solid ${
                      barcodeError ? '#f59e0b' : '#e2e8f0'
                    }`,
                    borderRadius: '6px',
                    fontSize: '1.2rem',
                    outline: 'none',
                    background: barcodeError ? '#fffbeb' : 'white',
                    fontFamily: 'monospace'
                  }}
                  placeholder={barcodeMode === "auto" ? "Auto-generated" : "Enter barcode"}
                  value={formData.barcode}
                  onChange={handleManualBarcodeChange}
                  readOnly={(barcodeMode === "auto" && !editingItem) || (editingItem && barcodeMode === "auto")}
                  required
                />
                {barcodeMode === "auto" && !editingItem && (
                  <p style={{
                    marginTop: '0.25rem',
                    fontSize: '1.2rem',
                    color: '#3b82f6'
                  }}>
                    Next: {nextBarcode}
                  </p>
                )}
              </div>

              {/* Item Name Field */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '1.2rem',
                  fontWeight: '500',
                  color: '#475569',
                  marginBottom: '0.25rem'
                }}>
                  Item Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1.2rem',
                    outline: 'none'
                  }}
                  placeholder="Enter item name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* Price Field */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '1.2rem',
                  fontWeight: '500',
                  color: '#475569',
                  marginBottom: '0.25rem'
                }}>
                  Price (USD) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1.2rem',
                    outline: 'none'
                  }}
                  placeholder="0.00"
                  value={formData.outPrice}
                  onChange={(e) => setFormData({ ...formData, outPrice: +e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              {editingItem && (
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: '0.625rem 1.25rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1.2rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#e2e8f0';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#f1f5f9';
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                style={{
                  padding: '0.625rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1.2rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#3b82f6';
                }}
              >
                {editingItem ? "Update Item" : "Add Item"}
              </button>
            </div>
          </form>
        </div>

        {/* Item List Card */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {/* Search Header */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ color: '#64748b' }}>
              Total Items: <strong style={{ color: '#1e293b' }}>{items.length}</strong>
            </div>
            <input
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '1.2rem',
                width: '250px',
                outline: 'none'
              }}
              placeholder="Search by name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '600px'
            }}>
              <thead>
                <tr style={{
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  <th style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: '#475569'
                  }}>#</th>
                  <th style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: '#475569'
                  }}>Barcode</th>
                  <th style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: '#475569'
                  }}>Item Name</th>
                  <th style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'right',
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: '#475569'
                  }}>Price</th>
                  <th style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'center',
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: '#475569'
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr 
                    key={item.id} 
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{
                      padding: '0.75rem 1rem',
                      color: '#64748b',
                      fontSize: '1.2rem'
                    }}>
                      {index + 1}
                    </td>
                    <td style={{
                      padding: '0.75rem 1rem'
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        background: '#f1f5f9',
                        color: '#334155',
                        borderRadius: '4px',
                        fontSize: '01.2rem',
                        fontFamily: 'monospace'
                      }}>
                        {item.barcode}
                      </span>
                    </td>
                    <td style={{
                      padding: '0.75rem 1rem',
                      color: '#1e293b',
                      fontWeight: '500',
                      fontSize: '1.2rem'
                    }}>
                      {item.name}
                    </td>
                    <td style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'right',
                      color: '#059669',
                      fontWeight: '600',
                      fontSize: '1.2rem'
                    }}>
                      {formatUSD(item.outPrice || item.outPricePharmacy || 0)}
                    </td>
                    <td style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}>
                        <button
                          onClick={() => handleEdit(item)}
                          style={{
                            padding: '0.375rem',
                            background: 'none',
                            border: 'none',
                            color: '#3b82f6',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#eff6ff';
                            e.target.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'none';
                            e.target.style.transform = 'scale(1)';
                          }}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          style={{
                            padding: '0.375rem',
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#fef2f2';
                            e.target.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'none';
                            e.target.style.transform = 'scale(1)';
                          }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {items.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: '#64748b'
              }}>
                <p style={{ marginBottom: '0.5rem' }}>No items found</p>
                <p style={{ fontSize: '1.2rem' }}>
                  {searchQuery ? "Try a different search" : "Add your first item above"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}