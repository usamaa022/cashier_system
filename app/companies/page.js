"use client";
import { useState, useEffect } from "react";
import { getCompanies, addCompany, updateCompany, deleteCompany } from "@/lib/data";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [editingCompany, setEditingCompany] = useState(null);
  const [newCompany, setNewCompany] = useState({
    name: "",
    code: "",
    phone: "",
    city: "",
    location: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const [searchQuery, setSearchQuery] = useState({
    name: "",
    code: "",
    phone: "",
    city: "",
    location: ""
  });
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc"
  });

  // Fetch companies on load and when refreshTrigger changes
  useEffect(() => {
    fetchCompanies();
  }, [refreshTrigger]);

  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      const companiesData = await getCompanies();
      setCompanies(companiesData);
      setFilteredCompanies(companiesData);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort companies when search or sort changes
  useEffect(() => {
    let filtered = companies.filter(company => {
      return (
        company.name.toLowerCase().includes(searchQuery.name.toLowerCase()) &&
        (company.code || "").toLowerCase().includes(searchQuery.code.toLowerCase()) &&
        (company.phone || "").toLowerCase().includes(searchQuery.phone.toLowerCase()) &&
        (company.city || "").toLowerCase().includes(searchQuery.city.toLowerCase()) &&
        (company.location || "").toLowerCase().includes(searchQuery.location.toLowerCase())
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
          const aNum = parseFloat(aValue.toString().replace(/[^\d.-]/g, ''));
          const bNum = parseFloat(bValue.toString().replace(/[^\d.-]/g, ''));
          
          // If both values contain valid numbers, sort numerically
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
          }
          // If only one has a number, put the one with number first
          if (!isNaN(aNum) && isNaN(bNum)) return -1;
          if (isNaN(aNum) && !isNaN(bNum)) return 1;
        }
        
        // For name or other fields, use string comparison
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

    setFilteredCompanies(filtered);
  }, [searchQuery, companies, sortConfig]);

  // Handle form submission (add or update)
  const handleAddCompany = async () => {
    try {
      if (!newCompany.name || !newCompany.code) {
        setError("ناو و کۆد پێویستە");
        setSuccess("");
        return;
      }
      
      await addCompany(newCompany);
      setSuccess("کۆمپانیا بە سەرکەوتوویی زیادکرا!");
      setError("");
      setNewCompany({
        name: "",
        code: "",
        phone: "",
        city: "",
        location: ""
      });
      setRefreshTrigger(!refreshTrigger);
    } catch (err) {
      setError(err.message);
      setSuccess("");
    }
  };

  const handleUpdateCompany = async () => {
    try {
      if (!editingCompany.name || !editingCompany.code) {
        setError("ناو و کۆد پێویستە");
        setSuccess("");
        return;
      }
      
      await updateCompany(editingCompany.id, editingCompany);
      setSuccess("کۆمپانیا بە سەرکەوتوویی نوێکرایەوە!");
      setError("");
      setEditingCompany(null);
      setRefreshTrigger(!refreshTrigger);
    } catch (err) {
      setError(err.message);
      setSuccess("");
    }
  };

  // Reset form
  const resetForm = () => {
    setEditingCompany(null);
    setNewCompany({
      name: "",
      code: "",
      phone: "",
      city: "",
      location: ""
    });
    setError("");
    setSuccess("");
  };

  // Edit company
  const handleEdit = (company) => {
    setEditingCompany({ ...company });
    setNewCompany({
      name: "",
      code: "",
      phone: "",
      city: "",
      location: ""
    });
    setError("");
    setSuccess("");
  };

  // Delete company
  const handleDelete = async (id) => {
    if (confirm("دڵنیایت دەتەوێت ئەم کۆمپانیا بسڕیتەوە؟")) {
      try {
        await deleteCompany(id);
        setSuccess("کۆمپانیا بە سەرکەوتوویی سڕایەوە!");
        setError("");
        setRefreshTrigger(!refreshTrigger);
      } catch (err) {
        setError(err.message);
        setSuccess("");
      }
    }
  };

  // Handle input changes
  const handleNewCompanyChange = (e) => {
    const { name, value } = e.target;
    setNewCompany(prev => ({ ...prev, [name]: value }));
  };

  const handleEditingCompanyChange = (e) => {
    const { name, value } = e.target;
    setEditingCompany(prev => ({ ...prev, [name]: value }));
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchQuery(prev => ({ ...prev, [name]: value }));
  };

  // Handle sorting
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
    <div style={{ 
      fontFamily: "var(--font-nrt-reg)", 
      maxWidth: "1600px", 
      margin: "0 auto",
      padding: "1.5rem"
    }}>
      <h1 style={{
        fontSize: "1.75rem",
        fontWeight: "bold",
        marginBottom: "1.5rem",
        color: "#1e293b",
        textAlign: "center",
        fontFamily: "var(--font-nrt-bd)"
      }}>
        گۆڕانکاری کۆمپانیا
      </h1>

      {/* Error Message */}
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
            onClick={() => setError("")}
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

      {/* Success Message */}
      {success && (
        <div style={{
          padding: "1rem",
          backgroundColor: "#86efac",
          color: "#166534",
          borderRadius: "0.375rem",
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-nrt-reg)"
        }}>
          {success}
          <button
            onClick={() => setSuccess("")}
            style={{
              background: "none",
              border: "none",
              color: "#166534",
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

      {/* Add/Edit Company Form */}
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
          {editingCompany ? "گۆڕانکاری کۆمپانیا" : "دروستکردنی ئەکاونتی کۆمپانیا"}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
          <div>
            <label style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-reg)"
            }}>ناوی کۆمپانیا</label>
            <input
              type="text"
              name="name"
              placeholder="ناوی کۆمپانیا"
              value={editingCompany ? editingCompany.name : newCompany.name}
              onChange={editingCompany ? handleEditingCompanyChange : handleNewCompanyChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
              required
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
              value={editingCompany ? editingCompany.code : newCompany.code}
              onChange={editingCompany ? handleEditingCompanyChange : handleNewCompanyChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)",
                ...(editingCompany && { backgroundColor: "#f1f5f9", cursor: "not-allowed" })
              }}
              required
              readOnly={!!editingCompany}
            />
          </div>
          <div>
            <label style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-reg)"
            }}>ژمارەی تەلەفون</label>
            <input
              type="text"
              name="phone"
              placeholder="07XX XXX XXXX"
              value={editingCompany ? editingCompany.phone : newCompany.phone}
              onChange={editingCompany ? handleEditingCompanyChange : handleNewCompanyChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
              required
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
              value={editingCompany ? editingCompany.city : newCompany.city}
              onChange={editingCompany ? handleEditingCompanyChange : handleNewCompanyChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
              required
            />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={{
              display: "block",
              marginBottom: "0.25rem",
              fontSize: "0.875rem",
              color: "#4b5563",
              fontFamily: "var(--font-nrt-reg)"
            }}>ناونیشان</label>
            <input
              type="text"
              name="location"
              placeholder="ناونیشانی تەواو"
              value={editingCompany ? editingCompany.location : newCompany.location}
              onChange={editingCompany ? handleEditingCompanyChange : handleNewCompanyChange}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-reg)"
              }}
              required
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button
            onClick={editingCompany ? handleUpdateCompany : handleAddCompany}
            style={{
              padding: "0.5rem 1.5rem",
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontFamily: "var(--font-nrt-bd)",
              minWidth: "120px"
            }}
          >
            {editingCompany ? "نوێکردنەوە" : "زیادکردن"}
          </button>
          {(editingCompany || newCompany.name || newCompany.code || newCompany.phone || newCompany.city || newCompany.location) && (
            <button
              onClick={resetForm}
              style={{
                padding: "0.5rem 1.5rem",
                backgroundColor: "#9ca3af",
                color: "#fff",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontFamily: "var(--font-nrt-bd)",
                minWidth: "120px"
              }}
            >
              پاشگەزبوونەوە
            </button>
          )}
        </div>
      </div>

      {/* Search and Companies List */}
      <div style={{
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: "0.5rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        padding: "1.5rem",
        fontFamily: "var(--font-nrt-reg)"
      }}>
        {/* Search Section */}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
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
              }}>ژمارەی تەلەفون</label>
              <input
                type="text"
                name="phone"
                placeholder="ژمارەی تەلەفون"
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
            <div style={{ gridColumn: "span 2" }}>
              <label style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.875rem",
                color: "#4b5563",
                fontFamily: "var(--font-nrt-reg)"
              }}>ناونیشان</label>
              <input
                type="text"
                name="location"
                placeholder="ناونیشان"
                value={searchQuery.location}
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

        {/* Sorting Indicator */}
        <div style={{
          marginBottom: "1rem",
          color: "#4b5563",
          fontSize: "0.875rem",
          fontFamily: "var(--font-nrt-reg)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          <span>پێڕستکردن:</span>
          {sortConfig.key === "name" ? (
            <span>بەپێی ناو{getSortLabel("name")}</span>
          ) : sortConfig.key === "code" ? (
            <span>بەپێی کۆد{getSortLabel("code")}</span>
          ) : (
            <span>نه‌کراوە</span>
          )}
        </div>

        {/* Companies Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "800px",
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
                  fontFamily: "var(--font-nrt-bd)"
                }}>
                  ژمارەی تەلەفون
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
                  textAlign: "left",
                  fontWeight: "bold",
                  color: "#334155",
                  fontFamily: "var(--font-nrt-bd)"
                }}>
                  ناونیشان
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
                  <td colSpan="6" style={{
                    padding: "1rem",
                    textAlign: "center",
                    color: "#64748b",
                    fontFamily: "var(--font-nrt-reg)"
                  }}>
                    کۆمپانیاکان بار دەکرێن...
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{
                    padding: "1rem",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontFamily: "var(--font-nrt-reg)"
                  }}>
                    هیچ کۆمپانیایەک نەدۆزرایەوە.
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr
                    key={company.id}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      ":hover": { backgroundColor: "#f8fafc" }
                    }}
                  >
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{company.code}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{company.name}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{company.phone || '---'}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{company.city || '---'}</td>
                    <td style={{ padding: "0.75rem", fontFamily: "var(--font-nrt-reg)" }}>{company.location || '---'}</td>
                    <td style={{
                      padding: "0.75rem",
                      display: "flex",
                      gap: "0.5rem",
                      justifyContent: "center"
                    }}>
                      <button
                        onClick={() => handleEdit(company)}
                        style={{
                          padding: "0.25rem 0.75rem",
                          backgroundColor: "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: "0.25rem",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          fontFamily: "var(--font-nrt-bd)",
                          minWidth: "70px"
                        }}
                      >
                        گۆڕانکاری
                      </button>
                      <button
                        onClick={() => handleDelete(company.id)}
                        style={{
                          padding: "0.25rem 0.75rem",
                          backgroundColor: "#ef4444",
                          color: "#fff",
                          border: "none",
                          borderRadius: "0.25rem",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          fontFamily: "var(--font-nrt-bd)",
                          minWidth: "70px"
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