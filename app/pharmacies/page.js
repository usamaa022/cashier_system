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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [searchQuery, setSearchQuery] = useState({
    name: "",
    code: "",
    phone: "",
    city: ""
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
    const filterPharmacies = () => {
      const filtered = pharmacies.filter(pharmacy => {
        return (
          pharmacy.name.toLowerCase().includes(searchQuery.name.toLowerCase()) &&
          pharmacy.code.toLowerCase().includes(searchQuery.code.toLowerCase()) &&
          (pharmacy.phone || "").toLowerCase().includes(searchQuery.phone.toLowerCase()) &&
          (pharmacy.city || "").toLowerCase().includes(searchQuery.city.toLowerCase())
        );
      });
      setFilteredPharmacies(filtered);
    };
    filterPharmacies();
  }, [searchQuery, pharmacies]);

  const handleAddSuccess = () => {
    setRefreshTrigger(!refreshTrigger);
  };

  const handleEdit = (pharmacy) => {
    setEditingPharmacy(pharmacy);
  };

  const handleCancel = () => {
    setEditingPharmacy(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this pharmacy?")) {
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

  return (
    <div style={{ fontFamily: "var(--font-nrt-reg)" }}>
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
          maxWidth: "1600px",
          marginLeft: "auto",
          marginRight: "auto",
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
          <input
            type="text"
            placeholder="Name"
            value={editingPharmacy?.name || ""}
            onChange={(e) => setEditingPharmacy({...editingPharmacy, name: e.target.value})}
            style={{
              padding: "0.75rem",
              border: "1px solid #e2e8f0",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontFamily: "var(--font-nrt-reg)"
            }}
          />
          <input
            type="text"
            placeholder="Code"
            value={editingPharmacy?.code || ""}
            onChange={(e) => setEditingPharmacy({...editingPharmacy, code: e.target.value})}
            style={{
              padding: "0.75rem",
              border: "1px solid #e2e8f0",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontFamily: "var(--font-nrt-reg)"
            }}
          />
          <input
            type="text"
            placeholder="Phone"
            value={editingPharmacy?.phone || ""}
            onChange={(e) => setEditingPharmacy({...editingPharmacy, phone: e.target.value})}
            style={{
              padding: "0.75rem",
              border: "1px solid #e2e8f0",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontFamily: "var(--font-nrt-reg)"
            }}
          />
          <input
            type="text"
            placeholder="City"
            value={editingPharmacy?.city || ""}
            onChange={(e) => setEditingPharmacy({...editingPharmacy, city: e.target.value})}
            style={{
              padding: "0.75rem",
              border: "1px solid #e2e8f0",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontFamily: "var(--font-nrt-reg)"
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button
            onClick={handleAddSuccess}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontFamily: "var(--font-nrt-bd)"
            }}
          >
            {editingPharmacy ? "Update" : "Add"}
          </button>
          {editingPharmacy && (
            <button
              onClick={handleCancel}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#9ca3af",
                color: "#fff",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-bd)"
              }}
            >
              Cancel
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
            <input
              type="text"
              name="name"
              placeholder="Name"
              value={searchQuery.name}
              onChange={handleSearchChange}
              style={{
                padding: "0.5rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
            />
            <input
              type="text"
              name="code"
              placeholder="Code"
              value={searchQuery.code}
              onChange={handleSearchChange}
              style={{
                padding: "0.5rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
            />
            <input
              type="text"
              name="phone"
              placeholder="Phone"
              value={searchQuery.phone}
              onChange={handleSearchChange}
              style={{
                padding: "0.5rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
            />
            <input
              type="text"
              name="city"
              placeholder="City"
              value={searchQuery.city}
              onChange={handleSearchChange}
              style={{
                padding: "0.5rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
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
                  fontFamily: "var(--font-nrt-bd)"
                }}>Name</th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)"
                }}>Code</th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)"
                }}>Phone</th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)"
                }}>City</th>
                <th style={{
                  padding: "0.75rem",
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)"
                }}>Actions</th>
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
                    Loading pharmacies...
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
                    No pharmacies found.
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
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{pharmacy.phone || 'N/A'}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{pharmacy.city || 'N/A'}</td>
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
                          fontFamily: "var(--font-nrt-bd)"
                        }}
                      >
                        Edit
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
                          fontFamily: "var(--font-nrt-bd)"
                        }}
                      >
                        Delete
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
