// app/pharmacies/page.js
"use client";
import { useState, useEffect } from "react";
import {
  getPharmacies,
  addPharmacy,
  updatePharmacy,
  deletePharmacy
} from "@/lib/data";

export default function PharmaciesPage() {
  const [pharmacies, setPharmacies] = useState([]);
  const [filteredPharmacies, setFilteredPharmacies] = useState([]);
  const [editingPharmacy, setEditingPharmacy] = useState(null);
  const [newPharmacy, setNewPharmacy] = useState({
    name: "",
    code: "",
    phone: "",
    city: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [searchQuery, setSearchQuery] = useState({
    name: "",
    code: "",
    phone: "",
    city: ""
  });
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc"
  });

  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        setIsLoading(true);
        const data = await getPharmacies();
        setPharmacies(data);
        setFilteredPharmacies(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPharmacies();
  }, [refreshTrigger]);

  useEffect(() => {
    let filtered = pharmacies.filter(pharmacy => {
      return (
        pharmacy.name.toLowerCase().includes(searchQuery.name.toLowerCase()) &&
        pharmacy.code.toLowerCase().includes(searchQuery.code.toLowerCase()) &&
        (pharmacy.phone || "").toLowerCase().includes(searchQuery.phone.toLowerCase()) &&
        (pharmacy.city || "").toLowerCase().includes(searchQuery.city.toLowerCase())
      );
    });

    // Apply sorting with numeric sorting for codes
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key] || "";
        let bValue = b[sortConfig.key] || "";
        
        // Special handling for code field - try numeric sorting first
        if (sortConfig.key === "code") {
          // Try to extract numbers from the code
          const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ''));
          const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ''));
          
          // If both values contain valid numbers, sort numerically
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
          }
          // If only one has a number, put the one with number first
          if (!isNaN(aNum) && isNaN(bNum)) return -1;
          if (isNaN(aNum) && !isNaN(bNum)) return 1;
        }
        
        // For name or if code doesn't contain numbers, use string comparison
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
        
        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredPharmacies(filtered);
  }, [searchQuery, pharmacies, sortConfig]);

  const handleAddPharmacy = async () => {
    try {
      if (!newPharmacy.name || !newPharmacy.code) {
        setError("ناو و کۆد پێویستە");
        return;
      }
      
      await addPharmacy(newPharmacy);
      setNewPharmacy({ name: "", code: "", phone: "", city: "" });
      setRefreshTrigger(!refreshTrigger);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdatePharmacy = async () => {
    try {
      if (!editingPharmacy.name || !editingPharmacy.code) {
        setError("ناو و کۆد پێویستە");
        return;
      }
      
      await updatePharmacy(editingPharmacy.id, editingPharmacy);
      setEditingPharmacy(null);
      setRefreshTrigger(!refreshTrigger);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (pharmacy) => {
    setEditingPharmacy({ ...pharmacy });
    setNewPharmacy({ name: "", code: "", phone: "", city: "" });
  };

  const handleCancel = () => {
    setEditingPharmacy(null);
    setNewPharmacy({ name: "", code: "", phone: "", city: "" });
  };

  const handleDelete = async (id) => {
    if (window.confirm("دڵنیایت دەتەوێت ئەم دەرمانخانە بسڕیتەوە؟")) {
      try {
        await deletePharmacy(id);
        setRefreshTrigger(!refreshTrigger);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchQuery(prev => ({ ...prev, [name]: value }));
  };

  const handleNewPharmacyChange = (e) => {
    const { name, value } = e.target;
    setNewPharmacy(prev => ({ ...prev, [name]: value }));
  };

  const handleEditingPharmacyChange = (e) => {
    const { name, value } = e.target;
    setEditingPharmacy(prev => ({ ...prev, [name]: value }));
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const getSortLabel = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " (بەرەوچوون) " : " (بەرەوژێر) ";
  };

  return (
    <div style={{ fontFamily: "var(--font-nrt-reg)", maxWidth: "1600px", margin: "0 auto" }}>
      <h1 style={{
        fontSize: "1.75rem",
        fontWeight: "bold",
        marginBottom: "1.5rem",
        color: "#1e293b",
        textAlign: "center",
        fontFamily: "var(--font-nrt-bd)"
      }}>
        دەرمانخانەکان
      </h1>

      {error && (
        <div style={{
          padding: "1rem",
          backgroundColor: "#fca5a5",
          color: "#991b1b",
          borderRadius: "0.375rem",
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-nrt-reg)"
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              color: "#991b1b",
              fontSize: "1.25rem",
              cursor: "pointer",
              marginLeft: "1rem",
              fontFamily: "var(--font-nrt-bd)"
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Full-width form section */}
      <div style={{
        width: "100%",
        marginBottom: "1.5rem",
        backgroundColor: "#fff",
        borderRadius: "0.5rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        padding: "1.5rem",
        fontFamily: "var(--font-nrt-reg)"
      }}>
        <h2 style={{
          fontSize: "1.25rem",
          fontWeight: "bold",
          marginBottom: "1rem",
          color: "#1e293b",
          fontFamily: "var(--font-nrt-bd)"
        }}>
          {editingPharmacy ? "گۆڕانکاری لە دەرمانخانە" : "دروستکردنی دەرمانخانە"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
          <div>
            <label style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-reg)"
            }}>ناو</label>
            <input
              type="text"
              name="name"
              placeholder="ناوی دەرمانخانە"
              value={editingPharmacy ? editingPharmacy.name : newPharmacy.name}
              onChange={editingPharmacy ? handleEditingPharmacyChange : handleNewPharmacyChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
            />
          </div>
          <div>
            <label style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-reg)"
            }}>کۆد</label>
            <input
              type="text"
              name="code"
              placeholder="کۆدی دەرمانخانە"
              value={editingPharmacy ? editingPharmacy.code : newPharmacy.code}
              onChange={editingPharmacy ? handleEditingPharmacyChange : handleNewPharmacyChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
            />
          </div>
          <div>
            <label style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-reg)"
            }}>ژمارەی مۆبایل</label>
            <input
              type="text"
              name="phone"
              placeholder="ژمارەی مۆبایل "
              value={editingPharmacy ? editingPharmacy.phone : newPharmacy.phone}
              onChange={editingPharmacy ? handleEditingPharmacyChange : handleNewPharmacyChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
            />
          </div>
          <div>
            <label style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-reg)"
            }}>شاری سەرەکی</label>
            <input
              type="text"
              name="city"
              placeholder="شاری سەرەکی"
              value={editingPharmacy ? editingPharmacy.city : newPharmacy.city}
              onChange={editingPharmacy ? handleEditingPharmacyChange : handleNewPharmacyChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button
            onClick={editingPharmacy ? handleUpdatePharmacy : handleAddPharmacy}
            style={{
              padding: "0.5rem 1.5rem",
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontFamily: "var(--font-nrt-bd)",
              minWidth: "80px"
            }}
          >
            {editingPharmacy ? "نوێکردنەوە" : "زیادکردن"}
          </button>
          {(editingPharmacy || (newPharmacy.name || newPharmacy.code || newPharmacy.phone || newPharmacy.city)) && (
            <button
              onClick={handleCancel}
              style={{
                padding: "0.5rem 1.5rem",
                backgroundColor: "#9ca3af",
                color: "#fff",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-bd)",
                minWidth: "80px"
              }}
            >
              پاشگەزبوونەوە
            </button>
          )}
        </div>
      </div>

      {/* Advanced search and table section */}
      <div style={{
        width: "100%",
        marginBottom: "1.5rem",
        backgroundColor: "#fff",
        borderRadius: "0.5rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        padding: "1.5rem",
        fontFamily: "var(--font-nrt-reg)"
      }}>
        <div style={{
          marginBottom: "1.5rem",
          padding: "1rem",
          backgroundColor: "#f1f5f9",
          borderRadius: "0.375rem"
        }}>
          <h3 style={{
            fontSize: "1.125rem",
            fontWeight: "bold",
            marginBottom: "0.75rem",
            color: "#1e293b",
            fontFamily: "var(--font-nrt-bd)"
          }}>
            گەڕان
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
            <div>
              <label style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.875rem",
                color: "#4b5563",
                fontFamily: "var(--font-nrt-reg)"
              }}>ناو</label>
              <input
                type="text"
                name="name"
                placeholder="ناو"
                value={searchQuery.name}
                onChange={handleSearchChange}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)"
                }}
              />
            </div>
            <div>
              <label style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.875rem",
                color: "#4b5563",
                fontFamily: "var(--font-nrt-reg)"
              }}>کۆد</label>
              <input
                type="text"
                name="code"
                placeholder="کۆد"
                value={searchQuery.code}
                onChange={handleSearchChange}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)"
                }}
              />
            </div>
            <div>
              <label style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.875rem",
                color: "#4b5563",
                fontFamily: "var(--font-nrt-reg)"
              }}>ژمارەی مۆبایل</label>
              <input
                type="text"
                name="phone"
                placeholder="ژمارەی مۆبایل"
                value={searchQuery.phone}
                onChange={handleSearchChange}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)"
                }}
              />
            </div>
            <div>
              <label style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.875rem",
                color: "#4b5563",
                fontFamily: "var(--font-nrt-reg)"
              }}>شار</label>
              <input
                type="text"
                name="city"
                placeholder="شار"
                value={searchQuery.city}
                onChange={handleSearchChange}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-nrt-reg)"
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{
            marginBottom: "1rem",
            color: "#4b5563",
            fontSize: "0.875rem",
            fontFamily: "var(--font-nrt-reg)"
          }}>
            {sortConfig.key === "name" ? (
              <>پێڕستکردن بەپێی ناو{getSortLabel("name")}</>
            ) : sortConfig.key === "code" ? (
              <>پێڕستکردن بەپێی کۆد{getSortLabel("code")}</>
            ) : (
              <>پێڕست نه‌کراوە</>
            )}
          </div>
          
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "600px",
            fontFamily: "var(--font-nrt-reg)"
          }}>
            <thead style={{ backgroundColor: "#f1f5f9" }}>
              <tr>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)",
                  cursor: "pointer",
                  position: "relative"
                }} onClick={() => handleSort("name")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    ناو
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {getSortIndicator("name")}
                    </span>
                  </div>
                </th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)",
                  cursor: "pointer",
                  position: "relative"
                }} onClick={() => handleSort("code")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    کۆد
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {getSortIndicator("code")}
                    </span>
                  </div>
                </th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)"
                }}>
                  ژمارەی مۆبایل
                </th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)"
                }}>
                  شار
                </th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)"
                }}>
                  کردارەکان
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" style={{
                    padding: "1rem",
                    textAlign: "center",
                    color: "#64748b",
                    fontFamily: "var(--font-nrt-reg)"
                  }}>
                    دەرمانخانەکان بار دەکرێن...
                  </td>
                </tr>
              ) : filteredPharmacies.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{
                    padding: "1rem",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontFamily: "var(--font-nrt-reg)"
                  }}>
                    هیچ دەرمانخانەیەک نەدۆزرایەوە.
                  </td>
                </tr>
              ) : (
                filteredPharmacies.map((pharmacy) => (
                  <tr
                    key={pharmacy.id}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      ":hover": { backgroundColor: "#f8fafc" }
                    }}
                  >
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{pharmacy.name}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{pharmacy.code}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{pharmacy.phone || '---'}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{pharmacy.city || '---'}</td>
                    <td style={{
                      padding: "0.75rem",
                      display: "flex",
                      gap: "0.5rem",
                      justifyContent: "center"
                    }}>
                      <button
                        onClick={() => handleEdit(pharmacy)}
                        style={{
                          padding: "0.25rem 0.75rem",
                          backgroundColor: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: "0.25rem",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          fontFamily: "var(--font-nrt-bd)",
                          minWidth: "60px"
                        }}
                      >
                        گۆڕانکاری
                      </button>
                      <button
                        onClick={() => handleDelete(pharmacy.id)}
                        style={{
                          padding: "0.25rem 0.75rem",
                          backgroundColor: "#ef4444",
                          color: "#fff",
                          border: "none",
                          borderRadius: "0.25rem",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          fontFamily: "var(--font-nrt-bd)",
                          minWidth: "60px"
                        }}
                      >
                        سڕینەوە
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}