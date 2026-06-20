"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  ShoppingCart,
  Building2,
  Users,
  RefreshCw,
  Search,
  Download,
  Loader2,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// --- Helper Functions ---
const formatCurrency = (amount, currency = "IQD") => {
  if (amount === undefined || amount === null) return "0";
  const num = Number(amount);
  if (isNaN(num)) return "0";

  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } else {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "IQD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  }
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return "0";
  return new Intl.NumberFormat("en-US").format(num);
};

const COLORS = {
  USD: "#3B82F6",
  IQD: "#10B981",
  profit: "#059669",
  loss: "#EF4444",
  primary: "#2563EB",
  secondary: "#64748B",
};

// --- Firebase Data Fetching ---
const fetchCollection = async (collectionName) => {
  try {
    const q = collection(db, collectionName);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
};

// --- Main Component ---
export default function DashboardPage() {
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    soldBills: [],
    boughtBills: [],
    storeItems: [],
    companies: [],
    pharmacies: [],
    employees: [],
  });
  const [filters, setFilters] = useState({
    dateRange: "month",
    selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    selectedYear: new Date().getFullYear(),
    currency: "all",
    searchQuery: "",
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const [soldBills, boughtBills, storeItems, companies, pharmacies, employees] =
        await Promise.all([
          fetchCollection("soldBills"),
          fetchCollection("boughtBills"),
          fetchCollection("storeItems"),
          fetchCollection("companies"),
          fetchCollection("pharmacies"),
          fetchCollection("employees"),
        ]);

      setData({
        soldBills,
        boughtBills,
        storeItems,
        companies,
        pharmacies,
        employees,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  // --- Filtered Data ---
  const filteredData = useMemo(() => {
    const { dateRange, selectedMonth, selectedYear, currency, searchQuery } = filters;

    // Parse selected month/year
    const [year, month] = selectedMonth.split("-").map(Number);
    const targetYear = dateRange === "year" ? selectedYear : year;
    const targetMonth = dateRange === "month" ? month - 1 : undefined;

    // Filter bills
    const filterBill = (bill) => {
      const billDate = new Date(bill.date);
      const billYear = billDate.getFullYear();
      const billMonth = billDate.getMonth();

      // Date filter
      if (dateRange === "month" && (billYear !== targetYear || billMonth !== targetMonth)) {
        return false;
      } else if (dateRange === "year" && billYear !== targetYear) {
        return false;
      }

      // Currency filter
      if (currency !== "all") {
        const hasCurrency = bill.items?.some((item) => item.currency === currency);
        if (!hasCurrency) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCustomer = bill.customerName?.toLowerCase().includes(query);
        const matchesSupplier = bill.supplierName?.toLowerCase().includes(query);
        const matchesItem = bill.items?.some((item) => item.name?.toLowerCase().includes(query));
        if (!matchesCustomer && !matchesSupplier && !matchesItem) return false;
      }

      return true;
    };

    return {
      soldBills: data.soldBills.filter((bill) => filterBill({ ...bill, isSold: true })),
      boughtBills: data.boughtBills.filter((bill) => filterBill({ ...bill, isSold: false })),
      storeItems: data.storeItems.filter((item) => {
        if (currency !== "all" && item.currency !== currency) return false;
        if (searchQuery && !item.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      }),
      companies: data.companies.filter((company) => {
        if (searchQuery && !company.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      }),
      pharmacies: data.pharmacies.filter((pharmacy) => {
        if (searchQuery && !pharmacy.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      }),
    };
  }, [data, filters]);

  // --- Metrics Calculations ---
  const metrics = useMemo(() => {
    const { soldBills, boughtBills, storeItems } = filteredData;

    const metrics = {
      sales: { USD: 0, IQD: 0, count: 0, items: 0 },
      purchases: { USD: 0, IQD: 0, count: 0, items: 0 },
      profit: { USD: 0, IQD: 0 },
      stock: { USD: 0, IQD: 0 },
      topProducts: { USD: [], IQD: [] },
      topCustomers: [],
      topSuppliers: [],
    };

    // Calculate sales metrics
    soldBills.forEach((bill) => {
      metrics.sales.count++;
      bill.items?.forEach((item) => {
        const qty = item.quantity || 0;
        metrics.sales.items += qty;
        if (item.currency === "USD") {
          metrics.sales.USD += (item.outPriceUSD || 0) * qty;
        } else {
          metrics.sales.IQD += (item.outPriceIQD || 0) * qty;
        }
      });
    });

    // Calculate purchases metrics
    boughtBills.forEach((bill) => {
      metrics.purchases.count++;
      bill.items?.forEach((item) => {
        const qty = item.quantity || 0;
        metrics.purchases.items += qty;
        const currency = item.currency || bill.currency || "IQD";
        if (currency === "USD") {
          metrics.purchases.USD += (item.basePriceUSD || item.price || 0) * qty;
        } else {
          metrics.purchases.IQD += (item.basePriceIQD || item.price || 0) * qty;
        }
      });
    });

    // Calculate profit
    metrics.profit.USD = metrics.sales.USD - metrics.purchases.USD;
    metrics.profit.IQD = metrics.sales.IQD - metrics.purchases.IQD;

    // Calculate stock value
    storeItems.forEach((item) => {
      const qty = item.quantity || 0;
      if (item.currency === "USD") {
        metrics.stock.USD += (item.netPriceUSD || 0) * qty;
      } else {
        metrics.stock.IQD += (item.netPriceIQD || 0) * qty;
      }
    });

    // Top products by revenue (split by currency)
    const productRevenue = {};
    soldBills.forEach((bill) => {
      bill.items?.forEach((item) => {
        const key = `${item.barcode}-${item.currency}`;
        if (!productRevenue[key]) {
          productRevenue[key] = {
            ...item,
            totalRevenue: 0,
            totalQuantity: 0,
          };
        }
        const qty = item.quantity || 0;
        const price = item.currency === "USD" ? (item.outPriceUSD || 0) : (item.outPriceIQD || 0);
        productRevenue[key].totalRevenue += price * qty;
        productRevenue[key].totalQuantity += qty;
      });
    });

    // Split top products by currency
    const productsUSD = Object.values(productRevenue)
      .filter((p) => p.currency === "USD")
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);
    const productsIQD = Object.values(productRevenue)
      .filter((p) => p.currency === "IQD")
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);
    metrics.topProducts.USD = productsUSD;
    metrics.topProducts.IQD = productsIQD;

    // Top customers (pharmacies)
    const customerSales = {};
    soldBills.forEach((bill) => {
      if (bill.customerId) {
        const customer = data.pharmacies.find((p) => p.id === bill.customerId);
        if (customer) {
          const name = customer.name || "Unknown";
          if (!customerSales[name]) {
            customerSales[name] = { name, total: { USD: 0, IQD: 0 }, count: 0 };
          }
          bill.items?.forEach((item) => {
            const qty = item.quantity || 0;
            if (item.currency === "USD") {
              customerSales[name].total.USD += (item.outPriceUSD || 0) * qty;
            } else {
              customerSales[name].total.IQD += (item.outPriceIQD || 0) * qty;
            }
          });
          customerSales[name].count++;
        }
      }
    });
    metrics.topCustomers = Object.values(customerSales)
      .sort((a, b) => (b.total.USD + b.total.IQD) - (a.total.USD + a.total.IQD))
      .slice(0, 5);

    // Top suppliers (companies)
    const supplierPurchases = {};
    boughtBills.forEach((bill) => {
      if (bill.supplierId) {
        const supplier = data.companies.find((c) => c.id === bill.supplierId);
        if (supplier) {
          const name = supplier.name || "Unknown";
          if (!supplierPurchases[name]) {
            supplierPurchases[name] = { name, total: { USD: 0, IQD: 0 }, count: 0 };
          }
          bill.items?.forEach((item) => {
            const qty = item.quantity || 0;
            const currency = item.currency || bill.currency || "IQD";
            if (currency === "USD") {
              supplierPurchases[name].total.USD += (item.basePriceUSD || item.price || 0) * qty;
            } else {
              supplierPurchases[name].total.IQD += (item.basePriceIQD || item.price || 0) * qty;
            }
          });
          supplierPurchases[name].count++;
        }
      }
    });
    metrics.topSuppliers = Object.values(supplierPurchases)
      .sort((a, b) => (b.total.USD + b.total.IQD) - (a.total.USD + a.total.IQD))
      .slice(0, 5);

    return metrics;
  }, [filteredData, data]);

  // --- Chart Data ---
  const chartData = useMemo(() => {
    const { soldBills, boughtBills } = filteredData;
    const { dateRange, selectedMonth, selectedYear } = filters;
    const [year, month] = selectedMonth.split("-").map(Number);
    const targetYear = dateRange === "year" ? selectedYear : year;

    // Monthly data (for yearly view)
    const monthlyData = Array(12).fill().map((_, i) => ({
      month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
      salesUSD: 0,
      salesIQD: 0,
      purchasesUSD: 0,
      purchasesIQD: 0,
    }));

    soldBills.forEach((bill) => {
      const billDate = new Date(bill.date);
      if (billDate.getFullYear() === targetYear) {
        const monthIdx = billDate.getMonth();
        bill.items?.forEach((item) => {
          const qty = item.quantity || 0;
          if (item.currency === "USD") {
            monthlyData[monthIdx].salesUSD += (item.outPriceUSD || 0) * qty;
          } else {
            monthlyData[monthIdx].salesIQD += (item.outPriceIQD || 0) * qty;
          }
        });
      }
    });

    boughtBills.forEach((bill) => {
      const billDate = new Date(bill.date);
      if (billDate.getFullYear() === targetYear) {
        const monthIdx = billDate.getMonth();
        bill.items?.forEach((item) => {
          const qty = item.quantity || 0;
          const currency = item.currency || bill.currency || "IQD";
          if (currency === "USD") {
            monthlyData[monthIdx].purchasesUSD += (item.basePriceUSD || item.price || 0) * qty;
          } else {
            monthlyData[monthIdx].purchasesIQD += (item.basePriceIQD || item.price || 0) * qty;
          }
        });
      }
    });

    // Daily data (for monthly view)
    const daysInMonth = new Date(targetYear, month, 0).getDate();
    const dailyData = Array(daysInMonth).fill().map((_, i) => ({
      day: i + 1,
      salesUSD: 0,
      salesIQD: 0,
    }));

    if (dateRange === "month") {
      soldBills.forEach((bill) => {
        const billDate = new Date(bill.date);
        if (billDate.getFullYear() === targetYear && billDate.getMonth() === month - 1) {
          const day = billDate.getDate() - 1;
          bill.items?.forEach((item) => {
            const qty = item.quantity || 0;
            if (item.currency === "USD") {
              dailyData[day].salesUSD += (item.outPriceUSD || 0) * qty;
            } else {
              dailyData[day].salesIQD += (item.outPriceIQD || 0) * qty;
            }
          });
        }
      });
    }

    return { monthlyData, dailyData };
  }, [filteredData, filters]);

  // --- Handler Functions ---
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const resetFilters = () => {
    setFilters({
      dateRange: "month",
      selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      selectedYear: new Date().getFullYear(),
      currency: "all",
      searchQuery: "",
    });
  };

  // --- Available Years and Months ---
  const availableYears = useMemo(() => {
    const years = new Set();
    [...data.soldBills, ...data.boughtBills].forEach((bill) => {
      if (bill.date) years.add(new Date(bill.date).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [data.soldBills, data.boughtBills]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // --- Loading State ---
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #f8fafc, #ffffff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <Loader2
            style={{
              width: "3rem",
              height: "3rem",
              animation: "spin 1s linear infinite",
              color: COLORS.primary,
              margin: "0 auto 1rem",
            }}
          />
          <p style={{ color: "#64748b", fontSize: "1.125rem" }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // --- Render ---
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(to bottom right, #f8fafc, #ffffff, #f8fafc)",
      fontFamily: "Inter, system-ui, sans-serif",
      width: "100%",
      overflowX: "hidden",
    }}>
      {/* --- Header --- */}
      <div style={{
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #e2e8f0",
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "0.75rem 1rem",
        width: "100%",
      }}>
        <div style={{
          maxWidth: "1280px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}>
            <div>
              <h1 style={{
                fontSize: "1.25rem",
                fontWeight: "700",
                background: "linear-gradient(to right, #2563eb, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                margin: 0,
              }}>
                Dashboard
              </h1>
              <p style={{ color: "#64748b", fontSize: "0.75rem", margin: "0.25rem 0 0 0" }}>
                Real-time business insights
              </p>
            </div>
            <button
              onClick={handleRefresh}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 0.8rem",
                background: COLORS.primary,
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: "500",
                transition: "background 0.2s",
              }}
            >
              <RefreshCw style={{ width: "1rem", height: "1rem" }} />
              Refresh
            </button>
          </div>

          {/* --- Filters --- */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "center",
            background: "#f8fafc",
            padding: "0.75rem",
            borderRadius: "0.75rem",
          }}>
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange("dateRange", e.target.value)}
              style={{
                padding: "0.3rem 0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
                background: "white",
                fontSize: "0.75rem",
                cursor: "pointer",
                flex: "1 1 auto",
                minWidth: "80px",
              }}
            >
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>

            {filters.dateRange === "month" && (
              <select
                value={filters.selectedMonth}
                onChange={(e) => handleFilterChange("selectedMonth", e.target.value)}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  background: "white",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  flex: "1 1 auto",
                  minWidth: "100px",
                }}
              >
                {availableYears.map((year) =>
                  monthNames.map((month, idx) => {
                    const monthValue = `${year}-${String(idx + 1).padStart(2, "0")}`;
                    return (
                      <option key={monthValue} value={monthValue}>
                        {month.substring(0, 3)} {year}
                      </option>
                    );
                  })
                )}
              </select>
            )}

            {filters.dateRange === "year" && (
              <select
                value={filters.selectedYear}
                onChange={(e) => handleFilterChange("selectedYear", parseInt(e.target.value))}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  background: "white",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  flex: "1 1 auto",
                  minWidth: "80px",
                }}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}

            <select
              value={filters.currency}
              onChange={(e) => handleFilterChange("currency", e.target.value)}
              style={{
                padding: "0.3rem 0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
                background: "white",
                fontSize: "0.75rem",
                cursor: "pointer",
                flex: "1 1 auto",
                minWidth: "80px",
              }}
            >
              <option value="all">All</option>
              <option value="USD">USD</option>
              <option value="IQD">IQD</option>
            </select>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              flex: "2 1 150px",
              minWidth: "120px",
            }}>
              <Search style={{ width: "0.8rem", height: "0.8rem", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Search..."
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange("searchQuery", e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.3rem 0.5rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.75rem",
                  background: "white",
                }}
              />
              {filters.searchQuery && (
                <button
                  onClick={() => handleFilterChange("searchQuery", "")}
                  style={{
                    padding: "0.2rem",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                  }}
                >
                  <X style={{ width: "0.8rem", height: "0.8rem" }} />
                </button>
              )}
            </div>

            <button
              onClick={resetFilters}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.3rem 0.6rem",
                background: "#f1f5f9",
                color: "#475569",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "0.7rem",
                fontWeight: "500",
              }}
            >
              <X style={{ width: "0.7rem", height: "0.7rem" }} />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* --- Main Content --- */}
      <div style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "0.75rem",
        width: "100%",
      }}>
        {/* --- Tabs --- */}
        <div style={{
          display: "flex",
          gap: "0.25rem",
          marginBottom: "1rem",
          borderBottom: "1px solid #e2e8f0",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}>
          {["overview", "sales", "purchases", "inventory", "customers"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.5rem 1rem",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? `2px solid ${COLORS.primary}` : "none",
                color: activeTab === tab ? COLORS.primary : "#64748b",
                fontSize: "0.75rem",
                fontWeight: "500",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
                flexShrink: 0,
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* --- Overview Tab --- */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* --- KPI Cards --- */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.75rem",
            }}>
              {/* Sales USD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "0.75rem",
              }}>
                <p style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Sales (USD)</p>
                <p style={{ fontSize: "1rem", fontWeight: "700", color: COLORS.USD, margin: "0.25rem 0" }}>
                  {formatCurrency(metrics.sales.USD, "USD")}
                </p>
                <p style={{ fontSize: "0.55rem", color: "#64748b", margin: 0 }}>
                  {formatNumber(metrics.sales.count)} inv
                </p>
              </div>

              {/* Sales IQD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "0.75rem",
              }}>
                <p style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Sales (IQD)</p>
                <p style={{ fontSize: "1rem", fontWeight: "700", color: COLORS.IQD, margin: "0.25rem 0" }}>
                  {formatCurrency(metrics.sales.IQD, "IQD")}
                </p>
                <p style={{ fontSize: "0.55rem", color: "#64748b", margin: 0 }}>
                  {formatNumber(metrics.sales.items)} items
                </p>
              </div>

              {/* Purchases USD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "0.75rem",
              }}>
                <p style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Purchases (USD)</p>
                <p style={{ fontSize: "1rem", fontWeight: "700", color: "#ef4444", margin: "0.25rem 0" }}>
                  {formatCurrency(metrics.purchases.USD, "USD")}
                </p>
                <p style={{ fontSize: "0.55rem", color: "#64748b", margin: 0 }}>
                  {formatNumber(metrics.purchases.count)} inv
                </p>
              </div>

              {/* Purchases IQD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "0.75rem",
              }}>
                <p style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Purchases (IQD)</p>
                <p style={{ fontSize: "1rem", fontWeight: "700", color: "#ef4444", margin: "0.25rem 0" }}>
                  {formatCurrency(metrics.purchases.IQD, "IQD")}
                </p>
                <p style={{ fontSize: "0.55rem", color: "#64748b", margin: 0 }}>
                  {formatNumber(metrics.purchases.items)} items
                </p>
              </div>

              {/* Profit USD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: `1px solid ${metrics.profit.USD >= 0 ? "#d1fae5" : "#fee2e2"}`,
                padding: "0.75rem",
              }}>
                <p style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Profit (USD)</p>
                <p style={{
                  fontSize: "1rem",
                  fontWeight: "700",
                  color: metrics.profit.USD >= 0 ? COLORS.profit : COLORS.loss,
                  margin: "0.25rem 0",
                }}>
                  {formatCurrency(metrics.profit.USD, "USD")}
                </p>
                <p style={{
                  fontSize: "0.55rem",
                  color: metrics.profit.USD >= 0 ? COLORS.profit : COLORS.loss,
                  margin: 0,
                }}>
                  {metrics.profit.USD >= 0 ? "↑" : "↓"}
                </p>
              </div>

              {/* Profit IQD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: `1px solid ${metrics.profit.IQD >= 0 ? "#d1fae5" : "#fee2e2"}`,
                padding: "0.75rem",
              }}>
                <p style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Profit (IQD)</p>
                <p style={{
                  fontSize: "1rem",
                  fontWeight: "700",
                  color: metrics.profit.IQD >= 0 ? COLORS.profit : COLORS.loss,
                  margin: "0.25rem 0",
                }}>
                  {formatCurrency(metrics.profit.IQD, "IQD")}
                </p>
                <p style={{
                  fontSize: "0.55rem",
                  color: metrics.profit.IQD >= 0 ? COLORS.profit : COLORS.loss,
                  margin: 0,
                }}>
                  {metrics.profit.IQD >= 0 ? "↑" : "↓"}
                </p>
              </div>

              {/* Stock */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "0.75rem",
              }}>
                <p style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Stock Value</p>
                <p style={{ fontSize: "0.8rem", fontWeight: "700", color: "#1e293b", margin: "0.25rem 0" }}>
                  {formatCurrency(metrics.stock.USD, "USD")}
                </p>
                <p style={{ fontSize: "0.7rem", color: "#64748b", margin: 0 }}>
                  {formatCurrency(metrics.stock.IQD, "IQD")}
                </p>
              </div>
            </div>

            {/* --- Charts --- */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "0.75rem",
            }}>
              {/* Monthly Sales vs Purchases (USD) */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "0.75rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                  flexWrap: "wrap",
                  gap: "0.25rem",
                }}>
                  <div>
                    <h3 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                      Sales vs Purchases (USD)
                    </h3>
                    <p style={{ fontSize: "0.6rem", color: "#64748b", margin: "0.1rem 0 0 0" }}>
                      {filters.dateRange === "month" ? `${monthNames[parseInt(filters.selectedMonth.split("-")[1]) - 1].substring(0, 3)} ${filters.selectedMonth.split("-")[0]}` : `Year: ${filters.selectedYear}`}
                    </p>
                  </div>
                  <span style={{
                    fontSize: "0.6rem",
                    fontWeight: "500",
                    color: COLORS.USD,
                    background: "#dbeafe",
                    padding: "0.15rem 0.4rem",
                    borderRadius: "0.25rem",
                  }}>
                    USD
                  </span>
                </div>
                <div style={{ height: "200px", width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        interval={1}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        tickFormatter={(value) => formatCurrency(value, "USD")}
                        width={50}
                      />
                      <Tooltip
                        formatter={(value, name) => [formatCurrency(value, "USD"), name]}
                        contentStyle={{
                          borderRadius: "0.5rem",
                          border: "none",
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                          background: "white",
                          fontSize: "0.7rem",
                        }}
                      />
                      <Bar
                        dataKey="salesUSD"
                        fill={COLORS.USD}
                        radius={[4, 4, 0, 0]}
                        name="Sales (USD)"
                      />
                      <Bar
                        dataKey="purchasesUSD"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        name="Purchases (USD)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Sales vs Purchases (IQD) */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "0.75rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                  flexWrap: "wrap",
                  gap: "0.25rem",
                }}>
                  <div>
                    <h3 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                      Sales vs Purchases (IQD)
                    </h3>
                    <p style={{ fontSize: "0.6rem", color: "#64748b", margin: "0.1rem 0 0 0" }}>
                      {filters.dateRange === "month" ? `${monthNames[parseInt(filters.selectedMonth.split("-")[1]) - 1].substring(0, 3)} ${filters.selectedMonth.split("-")[0]}` : `Year: ${filters.selectedYear}`}
                    </p>
                  </div>
                  <span style={{
                    fontSize: "0.6rem",
                    fontWeight: "500",
                    color: COLORS.IQD,
                    background: "#d1fae5",
                    padding: "0.15rem 0.4rem",
                    borderRadius: "0.25rem",
                  }}>
                    IQD
                  </span>
                </div>
                <div style={{ height: "200px", width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        interval={1}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        tickFormatter={(value) => formatCurrency(value, "IQD")}
                        width={50}
                      />
                      <Tooltip
                        formatter={(value, name) => [formatCurrency(value, "IQD"), name]}
                        contentStyle={{
                          borderRadius: "0.5rem",
                          border: "none",
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                          background: "white",
                          fontSize: "0.7rem",
                        }}
                      />
                      <Bar
                        dataKey="salesIQD"
                        fill={COLORS.IQD}
                        radius={[4, 4, 0, 0]}
                        name="Sales (IQD)"
                      />
                      <Bar
                        dataKey="purchasesIQD"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        name="Purchases (IQD)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Daily Sales Trend (USD) */}
              {filters.dateRange === "month" && (
                <div style={{
                  background: "white",
                  borderRadius: "0.75rem",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                  border: "1px solid #e2e8f0",
                  padding: "0.75rem",
                }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                    flexWrap: "wrap",
                    gap: "0.25rem",
                  }}>
                    <div>
                      <h3 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                        Daily Sales (USD)
                      </h3>
                      <p style={{ fontSize: "0.6rem", color: "#64748b", margin: "0.1rem 0 0 0" }}>
                        {monthNames[parseInt(filters.selectedMonth.split("-")[1]) - 1].substring(0, 3)} {filters.selectedMonth.split("-")[0]}
                      </p>
                    </div>
                    <span style={{
                      fontSize: "0.6rem",
                      fontWeight: "500",
                      color: COLORS.USD,
                      background: "#dbeafe",
                      padding: "0.15rem 0.4rem",
                      borderRadius: "0.25rem",
                    }}>
                      USD
                    </span>
                  </div>
                  <div style={{ height: "180px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData.dailyData}>
                        <defs>
                          <linearGradient id="salesGradientUSD" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.USD} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.USD} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 8, fill: "#64748b" }}
                          interval={Math.ceil(chartData.dailyData.length / 8)}
                        />
                        <YAxis
                          tick={{ fontSize: 9, fill: "#64748b" }}
                          tickFormatter={(value) => formatCurrency(value, "USD")}
                          width={45}
                        />
                        <Tooltip
                          formatter={(value, name) => [formatCurrency(value, "USD"), name]}
                          contentStyle={{
                            borderRadius: "0.5rem",
                            border: "none",
                            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            background: "white",
                            fontSize: "0.7rem",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="salesUSD"
                          stroke={COLORS.USD}
                          strokeWidth={2}
                          fill="url(#salesGradientUSD)"
                          name="Sales (USD)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Daily Sales Trend (IQD) */}
              {filters.dateRange === "month" && (
                <div style={{
                  background: "white",
                  borderRadius: "0.75rem",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                  border: "1px solid #e2e8f0",
                  padding: "0.75rem",
                }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                    flexWrap: "wrap",
                    gap: "0.25rem",
                  }}>
                    <div>
                      <h3 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                        Daily Sales (IQD)
                      </h3>
                      <p style={{ fontSize: "0.6rem", color: "#64748b", margin: "0.1rem 0 0 0" }}>
                        {monthNames[parseInt(filters.selectedMonth.split("-")[1]) - 1].substring(0, 3)} {filters.selectedMonth.split("-")[0]}
                      </p>
                    </div>
                    <span style={{
                      fontSize: "0.6rem",
                      fontWeight: "500",
                      color: COLORS.IQD,
                      background: "#d1fae5",
                      padding: "0.15rem 0.4rem",
                      borderRadius: "0.25rem",
                    }}>
                      IQD
                    </span>
                  </div>
                  <div style={{ height: "180px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData.dailyData}>
                        <defs>
                          <linearGradient id="salesGradientIQD" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.IQD} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.IQD} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 8, fill: "#64748b" }}
                          interval={Math.ceil(chartData.dailyData.length / 8)}
                        />
                        <YAxis
                          tick={{ fontSize: 9, fill: "#64748b" }}
                          tickFormatter={(value) => formatCurrency(value, "IQD")}
                          width={45}
                        />
                        <Tooltip
                          formatter={(value, name) => [formatCurrency(value, "IQD"), name]}
                          contentStyle={{
                            borderRadius: "0.5rem",
                            border: "none",
                            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            background: "white",
                            fontSize: "0.7rem",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="salesIQD"
                          stroke={COLORS.IQD}
                          strokeWidth={2}
                          fill="url(#salesGradientIQD)"
                          name="Sales (IQD)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* --- Top Products --- */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "0.75rem",
            }}>
              {/* Top Products (USD) */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "0.75rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                  flexWrap: "wrap",
                  gap: "0.25rem",
                }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                    Top Products (USD)
                  </h3>
                  <span style={{
                    fontSize: "0.6rem",
                    fontWeight: "500",
                    color: COLORS.USD,
                    background: "#dbeafe",
                    padding: "0.15rem 0.4rem",
                    borderRadius: "0.25rem",
                  }}>
                    USD
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {metrics.topProducts.USD.length > 0 ? (
                    metrics.topProducts.USD.slice(0, 5).map((product, idx) => (
                      <div
                        key={`${product.barcode}-${product.currency}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.5rem",
                          background: "#f8fafc",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <div style={{
                          width: "1.2rem",
                          height: "1.2rem",
                          borderRadius: "50%",
                          background: COLORS.USD,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.6rem",
                          fontWeight: "bold",
                          flexShrink: 0,
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "0.7rem", fontWeight: "500", color: "#1e293b", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {product.name}
                          </p>
                          <p style={{ fontSize: "0.55rem", color: "#64748b", margin: 0 }}>
                            Qty: {formatNumber(product.totalQuantity)}
                          </p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: "0.7rem", fontWeight: "600", color: COLORS.USD, margin: 0 }}>
                            {formatCurrency(product.totalRevenue, "USD")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", padding: "1rem", color: "#64748b", fontSize: "0.75rem" }}>
                      No products found
                    </div>
                  )}
                </div>
              </div>

              {/* Top Products (IQD) */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "0.75rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                  flexWrap: "wrap",
                  gap: "0.25rem",
                }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                    Top Products (IQD)
                  </h3>
                  <span style={{
                    fontSize: "0.6rem",
                    fontWeight: "500",
                    color: COLORS.IQD,
                    background: "#d1fae5",
                    padding: "0.15rem 0.4rem",
                    borderRadius: "0.25rem",
                  }}>
                    IQD
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {metrics.topProducts.IQD.length > 0 ? (
                    metrics.topProducts.IQD.slice(0, 5).map((product, idx) => (
                      <div
                        key={`${product.barcode}-${product.currency}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.5rem",
                          background: "#f8fafc",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <div style={{
                          width: "1.2rem",
                          height: "1.2rem",
                          borderRadius: "50%",
                          background: COLORS.IQD,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.6rem",
                          fontWeight: "bold",
                          flexShrink: 0,
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "0.7rem", fontWeight: "500", color: "#1e293b", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {product.name}
                          </p>
                          <p style={{ fontSize: "0.55rem", color: "#64748b", margin: 0 }}>
                            Qty: {formatNumber(product.totalQuantity)}
                          </p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: "0.7rem", fontWeight: "600", color: COLORS.IQD, margin: 0 }}>
                            {formatCurrency(product.totalRevenue, "IQD")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", padding: "1rem", color: "#64748b", fontSize: "0.75rem" }}>
                      No products found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Other Tabs (simplified for mobile) --- */}
        {(activeTab === "sales" || activeTab === "purchases" || activeTab === "inventory" || activeTab === "customers") && (
          <div style={{
            background: "white",
            borderRadius: "0.75rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e2e8f0",
            padding: "1rem",
            textAlign: "center",
          }}>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} data is being loaded...
            </p>
            <p style={{ color: "#94a3b8", fontSize: "0.75rem", marginTop: "0.25rem" }}>
              Total {activeTab === "sales" ? "sales" : activeTab === "purchases" ? "purchases" : activeTab === "inventory" ? "items" : "customers"}:{" "}
              {activeTab === "sales" && formatNumber(filteredData.soldBills.length)}
              {activeTab === "purchases" && formatNumber(filteredData.boughtBills.length)}
              {activeTab === "inventory" && formatNumber(filteredData.storeItems.length)}
              {activeTab === "customers" && formatNumber(data.pharmacies.length)}
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}