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
  Calendar,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  BarChart3,
  PieChart,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Minus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Cell,
} from "recharts";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";

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
const fetchCollection = async (collectionName, filters = {}) => {
  try {
    let q = collection(db, collectionName);
    if (filters.where) {
      q = query(q, where(...filters.where));
    }
    if (filters.orderBy) {
      q = query(q, orderBy(...filters.orderBy));
    }
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
    billType: "all",
    searchQuery: "",
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedSections, setExpandedSections] = useState({
    sales: true,
    purchases: true,
    inventory: true,
    customers: true,
  });
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
    const { dateRange, selectedMonth, selectedYear, currency, billType, searchQuery } = filters;

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
      } else if (dateRange === "custom" && (billYear !== targetYear || billMonth !== targetMonth)) {
        return false;
      }

      // Currency filter
      if (currency !== "all") {
        const hasCurrency = bill.items?.some((item) => item.currency === currency);
        if (!hasCurrency) return false;
      }

      // Bill type filter
      if (billType === "sold" && !bill.isSold) return false;
      if (billType === "bought" && bill.isSold) return false;

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

    // Initialize metrics
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
      purchasesUSD: 0,
      purchasesIQD: 0,
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

      boughtBills.forEach((bill) => {
        const billDate = new Date(bill.date);
        if (billDate.getFullYear() === targetYear && billDate.getMonth() === month - 1) {
          const day = billDate.getDate() - 1;
          bill.items?.forEach((item) => {
            const qty = item.quantity || 0;
            const currency = item.currency || bill.currency || "IQD";
            if (currency === "USD") {
              dailyData[day].purchasesUSD += (item.basePriceUSD || item.price || 0) * qty;
            } else {
              dailyData[day].purchasesIQD += (item.basePriceIQD || item.price || 0) * qty;
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

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const resetFilters = () => {
    setFilters({
      dateRange: "month",
      selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      selectedYear: new Date().getFullYear(),
      currency: "all",
      billType: "all",
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
    }}>
      {/* --- Header --- */}
      <div style={{
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #e2e8f0",
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "1rem 1.5rem",
      }}>
        <div style={{
          maxWidth: "1400px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div>
              <h1 style={{
                fontSize: "1.75rem",
                fontWeight: "700",
                background: "linear-gradient(to right, #2563eb, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                margin: 0,
              }}>
                Pharmacy Dashboard
              </h1>
              <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0.25rem 0 0 0" }}>
                Real-time business insights
              </p>
            </div>
            <button
              onClick={handleRefresh}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                background: COLORS.primary,
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "500",
                transition: "background 0.2s",
              }}
            >
              <RefreshCw style={{ width: "1rem", height: "1rem" }} />
              Refresh
            </button>
          </div>

          {/* --- Global Filters --- */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "center",
            background: "#f8fafc",
            padding: "1rem",
            borderRadius: "0.75rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#475569" }}>Date Range:</span>
              <select
                value={filters.dateRange}
                onChange={(e) => handleFilterChange("dateRange", e.target.value)}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  background: "white",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {filters.dateRange === "month" && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#475569" }}>Month:</span>
                <select
                  value={filters.selectedMonth}
                  onChange={(e) => handleFilterChange("selectedMonth", e.target.value)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #e2e8f0",
                    background: "white",
                    fontSize: "0.875rem",
                    cursor: "pointer",
                  }}
                >
                  {availableYears.map((year) =>
                    monthNames.map((month, idx) => {
                      const monthValue = `${year}-${String(idx + 1).padStart(2, "0")}`;
                      return (
                        <option key={monthValue} value={monthValue}>
                          {month} {year}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            )}

            {filters.dateRange === "year" && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#475569" }}>Year:</span>
                <select
                  value={filters.selectedYear}
                  onChange={(e) => handleFilterChange("selectedYear", parseInt(e.target.value))}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #e2e8f0",
                    background: "white",
                    fontSize: "0.875rem",
                    cursor: "pointer",
                  }}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#475569" }}>Currency:</span>
              <select
                value={filters.currency}
                onChange={(e) => handleFilterChange("currency", e.target.value)}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  background: "white",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Currencies</option>
                <option value="USD">USD ($)</option>
                <option value="IQD">IQD (ع.د)</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: "500", color: "#475569" }}>Bill Type:</span>
              <select
                value={filters.billType}
                onChange={(e) => handleFilterChange("billType", e.target.value)}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  background: "white",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Bills</option>
                <option value="sold">Sales Only</option>
                <option value="bought">Purchases Only</option>
              </select>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flex: 1,
              minWidth: "200px",
            }}>
              <div style={{
                position: "relative",
                flex: 1,
              }}>
                <Search
                  style={{
                    position: "absolute",
                    left: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "1rem",
                    height: "1rem",
                    color: "#94a3b8",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search products, customers, or suppliers..."
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange("searchQuery", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem 0.5rem 2.5rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
              {filters.searchQuery && (
                <button
                  onClick={() => handleFilterChange("searchQuery", "")}
                  style={{
                    padding: "0.5rem",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                  }}
                >
                  <X style={{ width: "1rem", height: "1rem" }} />
                </button>
              )}
            </div>

            <button
              onClick={resetFilters}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                background: "#f1f5f9",
                color: "#475569",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "500",
                transition: "background 0.2s",
              }}
            >
              <X style={{ width: "1rem", height: "1rem" }} />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* --- Main Content --- */}
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "1.5rem",
      }}>
        {/* --- Tabs --- */}
        <div style={{
          display: "flex",
          gap: "0.25rem",
          marginBottom: "1.5rem",
          borderBottom: "1px solid #e2e8f0",
          overflowX: "auto",
        }}>
          {["overview", "sales", "purchases", "inventory", "customers"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.75rem 1.5rem",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? `2px solid ${COLORS.primary}` : "none",
                color: activeTab === tab ? COLORS.primary : "#64748b",
                fontSize: "0.875rem",
                fontWeight: "500",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* --- Overview Tab --- */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* --- KPI Cards --- */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "1rem",
            }}>
              {/* Sales USD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
                transition: "box-shadow 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Total Sales (USD)</p>
                    <p style={{ fontSize: "1.75rem", fontWeight: "700", color: "#1e293b", margin: "0.25rem 0" }}>
                      {formatCurrency(metrics.sales.USD, "USD")}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      {metrics.sales.count} invoices • {formatNumber(metrics.sales.items)} items
                    </p>
                  </div>
                  <div style={{
                    background: "#dbeafe",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                  }}>
                    <DollarSign style={{ width: "1.5rem", height: "1.5rem", color: COLORS.USD }} />
                  </div>
                </div>
              </div>

              {/* Sales IQD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
                transition: "box-shadow 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Total Sales (IQD)</p>
                    <p style={{ fontSize: "1.75rem", fontWeight: "700", color: "#1e293b", margin: "0.25rem 0" }}>
                      {formatCurrency(metrics.sales.IQD, "IQD")}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      {metrics.sales.count} invoices • {formatNumber(metrics.sales.items)} items
                    </p>
                  </div>
                  <div style={{
                    background: "#d1fae5",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                  }}>
                    <DollarSign style={{ width: "1.5rem", height: "1.5rem", color: COLORS.IQD }} />
                  </div>
                </div>
              </div>

              {/* Purchases USD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
                transition: "box-shadow 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Total Purchases (USD)</p>
                    <p style={{ fontSize: "1.75rem", fontWeight: "700", color: "#1e293b", margin: "0.25rem 0" }}>
                      {formatCurrency(metrics.purchases.USD, "USD")}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      {metrics.purchases.count} invoices • {formatNumber(metrics.purchases.items)} items
                    </p>
                  </div>
                  <div style={{
                    background: "#fee2e2",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                  }}>
                    <ShoppingCart style={{ width: "1.5rem", height: "1.5rem", color: "#ef4444" }} />
                  </div>
                </div>
              </div>

              {/* Purchases IQD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
                transition: "box-shadow 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Total Purchases (IQD)</p>
                    <p style={{ fontSize: "1.75rem", fontWeight: "700", color: "#1e293b", margin: "0.25rem 0" }}>
                      {formatCurrency(metrics.purchases.IQD, "IQD")}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      {metrics.purchases.count} invoices • {formatNumber(metrics.purchases.items)} items
                    </p>
                  </div>
                  <div style={{
                    background: "#fee2e2",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                  }}>
                    <ShoppingCart style={{ width: "1.5rem", height: "1.5rem", color: "#ef4444" }} />
                  </div>
                </div>
              </div>

              {/* Profit USD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: `1px solid ${metrics.profit.USD >= 0 ? "#d1fae5" : "#fee2e2"}`,
                padding: "1.25rem",
                transition: "box-shadow 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Profit (USD)</p>
                    <p style={{
                      fontSize: "1.75rem",
                      fontWeight: "700",
                      color: metrics.profit.USD >= 0 ? COLORS.profit : COLORS.loss,
                      margin: "0.25rem 0",
                    }}>
                      {formatCurrency(metrics.profit.USD, "USD")}
                    </p>
                    <p style={{
                      fontSize: "0.75rem",
                      color: metrics.profit.USD >= 0 ? COLORS.profit : COLORS.loss,
                      margin: "0.25rem 0 0 0",
                    }}>
                      {metrics.profit.USD >= 0 ? "↑ Profit" : "↓ Loss"}
                    </p>
                  </div>
                  <div style={{
                    background: metrics.profit.USD >= 0 ? "#d1fae5" : "#fee2e2",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                  }}>
                    {metrics.profit.USD >= 0 ? (
                      <TrendingUp style={{ width: "1.5rem", height: "1.5rem", color: COLORS.profit }} />
                    ) : (
                      <TrendingDown style={{ width: "1.5rem", height: "1.5rem", color: COLORS.loss }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Profit IQD */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: `1px solid ${metrics.profit.IQD >= 0 ? "#d1fae5" : "#fee2e2"}`,
                padding: "1.25rem",
                transition: "box-shadow 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Profit (IQD)</p>
                    <p style={{
                      fontSize: "1.75rem",
                      fontWeight: "700",
                      color: metrics.profit.IQD >= 0 ? COLORS.profit : COLORS.loss,
                      margin: "0.25rem 0",
                    }}>
                      {formatCurrency(metrics.profit.IQD, "IQD")}
                    </p>
                    <p style={{
                      fontSize: "0.75rem",
                      color: metrics.profit.IQD >= 0 ? COLORS.profit : COLORS.loss,
                      margin: "0.25rem 0 0 0",
                    }}>
                      {metrics.profit.IQD >= 0 ? "↑ Profit" : "↓ Loss"}
                    </p>
                  </div>
                  <div style={{
                    background: metrics.profit.IQD >= 0 ? "#d1fae5" : "#fee2e2",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                  }}>
                    {metrics.profit.IQD >= 0 ? (
                      <TrendingUp style={{ width: "1.5rem", height: "1.5rem", color: COLORS.profit }} />
                    ) : (
                      <TrendingDown style={{ width: "1.5rem", height: "1.5rem", color: COLORS.loss }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Stock Value */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
                transition: "box-shadow 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Inventory Value</p>
                    <p style={{ fontSize: "1.5rem", fontWeight: "700", color: "#1e293b", margin: "0.25rem 0" }}>
                      {formatCurrency(metrics.stock.USD, "USD")} + {formatCurrency(metrics.stock.IQD, "IQD")}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      {formatNumber(data.storeItems.length)} products
                    </p>
                  </div>
                  <div style={{
                    background: "#f3e8ff",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                  }}>
                    <Package style={{ width: "1.5rem", height: "1.5rem", color: "#8b5cf6" }} />
                  </div>
                </div>
              </div>

              {/* Customers */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
                transition: "box-shadow 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Customers</p>
                    <p style={{ fontSize: "1.75rem", fontWeight: "700", color: "#1e293b", margin: "0.25rem 0" }}>
                      {formatNumber(data.pharmacies.length)}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      {formatNumber(data.companies.length)} suppliers
                    </p>
                  </div>
                  <div style={{
                    background: "#fed7aa",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                  }}>
                    <Users style={{ width: "1.5rem", height: "1.5rem", color: "#f97316" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* --- Charts Row --- */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
              gap: "1.5rem",
            }}>
              {/* Monthly Sales vs Purchases (USD) */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}>
                  <div>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                      Sales vs Purchases (USD)
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      {filters.dateRange === "month" ? `Month: ${monthNames[parseInt(filters.selectedMonth.split("-")[1]) - 1]} ${filters.selectedMonth.split("-")[0]}` : `Year: ${filters.selectedYear}`}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Currency:</span>
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      color: COLORS.USD,
                      background: "#dbeafe",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                    }}>
                      USD
                    </span>
                  </div>
                </div>
                <div style={{ height: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(value) => formatCurrency(value, "USD")}
                      />
                      <Tooltip
                        formatter={(value, name) => [formatCurrency(value, "USD"), name]}
                        contentStyle={{
                          borderRadius: "0.5rem",
                          border: "none",
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                          background: "white",
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
                padding: "1.25rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}>
                  <div>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                      Sales vs Purchases (IQD)
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      {filters.dateRange === "month" ? `Month: ${monthNames[parseInt(filters.selectedMonth.split("-")[1]) - 1]} ${filters.selectedMonth.split("-")[0]}` : `Year: ${filters.selectedYear}`}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Currency:</span>
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      color: COLORS.IQD,
                      background: "#d1fae5",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                    }}>
                      IQD
                    </span>
                  </div>
                </div>
                <div style={{ height: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(value) => formatCurrency(value, "IQD")}
                      />
                      <Tooltip
                        formatter={(value, name) => [formatCurrency(value, "IQD"), name]}
                        contentStyle={{
                          borderRadius: "0.5rem",
                          border: "none",
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                          background: "white",
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
            </div>

            {/* --- Daily Trends --- */}
            {filters.dateRange === "month" && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
                gap: "1.5rem",
              }}>
                {/* Daily Sales Trend (USD) */}
                <div style={{
                  background: "white",
                  borderRadius: "0.75rem",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                  border: "1px solid #e2e8f0",
                  padding: "1.25rem",
                }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}>
                    <div>
                      <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                        Daily Sales Trend (USD)
                      </h3>
                      <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                        {monthNames[parseInt(filters.selectedMonth.split("-")[1]) - 1]} {filters.selectedMonth.split("-")[0]}
                      </p>
                    </div>
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      color: COLORS.USD,
                      background: "#dbeafe",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                    }}>
                      USD
                    </span>
                  </div>
                  <div style={{ height: "250px" }}>
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
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          interval={Math.ceil(chartData.dailyData.length / 10)}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          tickFormatter={(value) => formatCurrency(value, "USD")}
                        />
                        <Tooltip
                          formatter={(value, name) => [formatCurrency(value, "USD"), name]}
                          contentStyle={{
                            borderRadius: "0.5rem",
                            border: "none",
                            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            background: "white",
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

                {/* Daily Sales Trend (IQD) */}
                <div style={{
                  background: "white",
                  borderRadius: "0.75rem",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                  border: "1px solid #e2e8f0",
                  padding: "1.25rem",
                }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}>
                    <div>
                      <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                        Daily Sales Trend (IQD)
                      </h3>
                      <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                        {monthNames[parseInt(filters.selectedMonth.split("-")[1]) - 1]} {filters.selectedMonth.split("-")[0]}
                      </p>
                    </div>
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      color: COLORS.IQD,
                      background: "#d1fae5",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                    }}>
                      IQD
                    </span>
                  </div>
                  <div style={{ height: "250px" }}>
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
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          interval={Math.ceil(chartData.dailyData.length / 10)}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          tickFormatter={(value) => formatCurrency(value, "IQD")}
                        />
                        <Tooltip
                          formatter={(value, name) => [formatCurrency(value, "IQD"), name]}
                          contentStyle={{
                            borderRadius: "0.5rem",
                            border: "none",
                            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            background: "white",
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
              </div>
            )}

            {/* --- Top Products --- */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
              gap: "1.5rem",
            }}>
              {/* Top Products (USD) */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                    Top Products (USD)
                  </h3>
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: "500",
                    color: COLORS.USD,
                    background: "#dbeafe",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                  }}>
                    USD
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {metrics.topProducts.USD.length > 0 ? (
                    metrics.topProducts.USD.map((product, idx) => (
                      <div
                        key={`${product.barcode}-${product.currency}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          background: "#f8fafc",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <div style={{
                          width: "1.5rem",
                          height: "1.5rem",
                          borderRadius: "50%",
                          background: COLORS.USD,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "0.875rem", fontWeight: "500", color: "#1e293b", margin: 0 }}>
                            {product.name}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                            Barcode: {product.barcode} • Qty: {formatNumber(product.totalQuantity)}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: "0.875rem", fontWeight: "600", color: COLORS.USD, margin: 0 }}>
                            {formatCurrency(product.totalRevenue, "USD")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
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
                padding: "1.25rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                    Top Products (IQD)
                  </h3>
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: "500",
                    color: COLORS.IQD,
                    background: "#d1fae5",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.25rem",
                  }}>
                    IQD
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {metrics.topProducts.IQD.length > 0 ? (
                    metrics.topProducts.IQD.map((product, idx) => (
                      <div
                        key={`${product.barcode}-${product.currency}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          background: "#f8fafc",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <div style={{
                          width: "1.5rem",
                          height: "1.5rem",
                          borderRadius: "50%",
                          background: COLORS.IQD,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "0.875rem", fontWeight: "500", color: "#1e293b", margin: 0 }}>
                            {product.name}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                            Barcode: {product.barcode} • Qty: {formatNumber(product.totalQuantity)}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: "0.875rem", fontWeight: "600", color: COLORS.IQD, margin: 0 }}>
                            {formatCurrency(product.totalRevenue, "IQD")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                      No products found
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* --- Top Customers & Suppliers --- */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
              gap: "1.5rem",
            }}>
              {/* Top Customers */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                    Top Customers
                  </h3>
                  <Building2 style={{ width: "1.25rem", height: "1.25rem", color: "#64748b" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {metrics.topCustomers.length > 0 ? (
                    metrics.topCustomers.map((customer, idx) => (
                      <div
                        key={customer.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          background: "#f8fafc",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <div style={{
                          width: "1.5rem",
                          height: "1.5rem",
                          borderRadius: "50%",
                          background: COLORS.primary,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "0.875rem", fontWeight: "500", color: "#1e293b", margin: 0 }}>
                            {customer.name}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                            {customer.count} invoices
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                            USD: {formatCurrency(customer.total.USD, "USD")}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                            IQD: {formatCurrency(customer.total.IQD, "IQD")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                      No customers found
                    </div>
                  )}
                </div>
              </div>

              {/* Top Suppliers */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                    Top Suppliers
                  </h3>
                  <Building2 style={{ width: "1.25rem", height: "1.25rem", color: "#64748b" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {metrics.topSuppliers.length > 0 ? (
                    metrics.topSuppliers.map((supplier, idx) => (
                      <div
                        key={supplier.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          background: "#f8fafc",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <div style={{
                          width: "1.5rem",
                          height: "1.5rem",
                          borderRadius: "50%",
                          background: COLORS.primary,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "0.875rem", fontWeight: "500", color: "#1e293b", margin: 0 }}>
                            {supplier.name}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                            {supplier.count} invoices
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                            USD: {formatCurrency(supplier.total.USD, "USD")}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                            IQD: {formatCurrency(supplier.total.IQD, "IQD")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                      No suppliers found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Sales Tab --- */}
        {activeTab === "sales" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "1rem",
            }}>
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Total Sales (USD)</p>
                <p style={{ fontSize: "2rem", fontWeight: "700", color: COLORS.USD, margin: "0.5rem 0" }}>
                  {formatCurrency(metrics.sales.USD, "USD")}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  {metrics.sales.count} invoices • {formatNumber(metrics.sales.items)} items
                </p>
              </div>
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Total Sales (IQD)</p>
                <p style={{ fontSize: "2rem", fontWeight: "700", color: COLORS.IQD, margin: "0.5rem 0" }}>
                  {formatCurrency(metrics.sales.IQD, "IQD")}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  {metrics.sales.count} invoices • {formatNumber(metrics.sales.items)} items
                </p>
              </div>
            </div>

            {/* Sales Table */}
            <div style={{
              background: "white",
              borderRadius: "0.75rem",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              border: "1px solid #e2e8f0",
              padding: "1.25rem",
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                  Sales Records
                </h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    style={{
                      padding: "0.5rem 1rem",
                      background: COLORS.primary,
                      color: "white",
                      border: "none",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Download style={{ width: "1rem", height: "1rem" }} />
                    Export
                  </button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Date</th>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Customer</th>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Items</th>
                      <th style={{ textAlign: "right", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Total (USD)</th>
                      <th style={{ textAlign: "right", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Total (IQD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.soldBills.length > 0 ? (
                      filteredData.soldBills.map((bill) => {
                        const totalUSD = bill.items?.reduce((sum, item) =>
                          item.currency === "USD" ? sum + (item.outPriceUSD || 0) * (item.quantity || 0) : sum, 0) || 0;
                        const totalIQD = bill.items?.reduce((sum, item) =>
                          item.currency === "IQD" ? sum + (item.outPriceIQD || 0) * (item.quantity || 0) : sum, 0) || 0;
                        const customer = data.pharmacies.find((p) => p.id === bill.customerId);
                        return (
                          <tr key={bill.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                              {new Date(bill.date).toLocaleDateString()}
                            </td>
                            <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                              {customer?.name || "Unknown"}
                            </td>
                            <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                              {formatNumber(bill.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0)}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", color: COLORS.USD, fontWeight: "500" }}>
                              {formatCurrency(totalUSD, "USD")}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", color: COLORS.IQD, fontWeight: "500" }}>
                              {formatCurrency(totalIQD, "IQD")}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                          No sales records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- Purchases Tab --- */}
        {activeTab === "purchases" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "1rem",
            }}>
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Total Purchases (USD)</p>
                <p style={{ fontSize: "2rem", fontWeight: "700", color: "#ef4444", margin: "0.5rem 0" }}>
                  {formatCurrency(metrics.purchases.USD, "USD")}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  {metrics.purchases.count} invoices • {formatNumber(metrics.purchases.items)} items
                </p>
              </div>
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Total Purchases (IQD)</p>
                <p style={{ fontSize: "2rem", fontWeight: "700", color: "#ef4444", margin: "0.5rem 0" }}>
                  {formatCurrency(metrics.purchases.IQD, "IQD")}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  {metrics.purchases.count} invoices • {formatNumber(metrics.purchases.items)} items
                </p>
              </div>
            </div>

            {/* Purchases Table */}
            <div style={{
              background: "white",
              borderRadius: "0.75rem",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              border: "1px solid #e2e8f0",
              padding: "1.25rem",
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                  Purchase Records
                </h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    style={{
                      padding: "0.5rem 1rem",
                      background: COLORS.primary,
                      color: "white",
                      border: "none",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Download style={{ width: "1rem", height: "1rem" }} />
                    Export
                  </button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Date</th>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Supplier</th>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Items</th>
                      <th style={{ textAlign: "right", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Total (USD)</th>
                      <th style={{ textAlign: "right", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Total (IQD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.boughtBills.length > 0 ? (
                      filteredData.boughtBills.map((bill) => {
                        const totalUSD = bill.items?.reduce((sum, item) => {
                          const currency = item.currency || bill.currency || "IQD";
                          return currency === "USD" ? sum + (item.basePriceUSD || item.price || 0) * (item.quantity || 0) : sum;
                        }, 0) || 0;
                        const totalIQD = bill.items?.reduce((sum, item) => {
                          const currency = item.currency || bill.currency || "IQD";
                          return currency === "IQD" ? sum + (item.basePriceIQD || item.price || 0) * (item.quantity || 0) : sum;
                        }, 0) || 0;
                        const supplier = data.companies.find((c) => c.id === bill.supplierId);
                        return (
                          <tr key={bill.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                              {new Date(bill.date).toLocaleDateString()}
                            </td>
                            <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                              {supplier?.name || "Unknown"}
                            </td>
                            <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                              {formatNumber(bill.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0)}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", color: "#ef4444", fontWeight: "500" }}>
                              {formatCurrency(totalUSD, "USD")}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", color: "#ef4444", fontWeight: "500" }}>
                              {formatCurrency(totalIQD, "IQD")}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                          No purchase records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- Inventory Tab --- */}
        {activeTab === "inventory" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "1rem",
            }}>
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Stock Value (USD)</p>
                <p style={{ fontSize: "2rem", fontWeight: "700", color: COLORS.USD, margin: "0.5rem 0" }}>
                  {formatCurrency(metrics.stock.USD, "USD")}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  {formatNumber(filteredData.storeItems.filter((i) => i.currency === "USD").length)} products
                </p>
              </div>
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Stock Value (IQD)</p>
                <p style={{ fontSize: "2rem", fontWeight: "700", color: COLORS.IQD, margin: "0.5rem 0" }}>
                  {formatCurrency(metrics.stock.IQD, "IQD")}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  {formatNumber(filteredData.storeItems.filter((i) => i.currency === "IQD").length)} products
                </p>
              </div>
            </div>

            {/* Inventory Table */}
            <div style={{
              background: "white",
              borderRadius: "0.75rem",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              border: "1px solid #e2e8f0",
              padding: "1.25rem",
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                  Inventory Items
                </h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    style={{
                      padding: "0.5rem 1rem",
                      background: COLORS.primary,
                      color: "white",
                      border: "none",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Download style={{ width: "1rem", height: "1rem" }} />
                    Export
                  </button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Name</th>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Barcode</th>
                      <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Currency</th>
                      <th style={{ textAlign: "right", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Quantity</th>
                      <th style={{ textAlign: "right", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Unit Price</th>
                      <th style={{ textAlign: "right", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.storeItems.length > 0 ? (
                      filteredData.storeItems.map((item) => {
                        const unitPrice = item.currency === "USD" ? (item.netPriceUSD || 0) : (item.netPriceIQD || 0);
                        const totalValue = unitPrice * (item.quantity || 0);
                        return (
                          <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                              {item.name}
                            </td>
                            <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                              {item.barcode}
                            </td>
                            <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                              <span style={{
                                fontWeight: "500",
                                color: item.currency === "USD" ? COLORS.USD : COLORS.IQD,
                              }}>
                                {item.currency}
                              </span>
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", color: "#1e293b" }}>
                              {formatNumber(item.quantity || 0)}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", color: "#1e293b" }}>
                              {formatCurrency(unitPrice, item.currency)}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", fontWeight: "500", color: item.currency === "USD" ? COLORS.USD : COLORS.IQD }}>
                              {formatCurrency(totalValue, item.currency)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                          No inventory items found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- Customers Tab --- */}
        {activeTab === "customers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "1rem",
            }}>
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Total Customers</p>
                <p style={{ fontSize: "2rem", fontWeight: "700", color: COLORS.primary, margin: "0.5rem 0" }}>
                  {formatNumber(data.pharmacies.length)}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  {formatNumber(metrics.topCustomers.length)} active
                </p>
              </div>
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "500", margin: 0 }}>Total Suppliers</p>
                <p style={{ fontSize: "2rem", fontWeight: "700", color: COLORS.primary, margin: "0.5rem 0" }}>
                  {formatNumber(data.companies.length)}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  {formatNumber(metrics.topSuppliers.length)} active
                </p>
              </div>
            </div>

            {/* Customers and Suppliers Tables */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
              gap: "1.5rem",
            }}>
              {/* Customers Table */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                    Customers
                  </h3>
                  <button
                    style={{
                      padding: "0.5rem 1rem",
                      background: COLORS.primary,
                      color: "white",
                      border: "none",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Download style={{ width: "1rem", height: "1rem" }} />
                    Export
                  </button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Name</th>
                        <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Contact</th>
                        <th style={{ textAlign: "right", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Total Purchases</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pharmacies.length > 0 ? (
                        data.pharmacies.map((pharmacy) => {
                          const totalPurchases = filteredData.soldBills
                            .filter((bill) => bill.customerId === pharmacy.id)
                            .reduce((sum, bill) => {
                              const billTotal = bill.items?.reduce((itemSum, item) => {
                                const price = item.currency === "USD" ? (item.outPriceUSD || 0) : (item.outPriceIQD || 0);
                                return itemSum + price * (item.quantity || 0);
                              }, 0) || 0;
                              return sum + billTotal;
                            }, 0);
                          return (
                            <tr key={pharmacy.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                                {pharmacy.name}
                              </td>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                                {pharmacy.phone || "N/A"}
                              </td>
                              <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", fontWeight: "500", color: COLORS.primary }}>
                                {formatCurrency(totalPurchases, "IQD")}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="3" style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                            No customers found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Suppliers Table */}
              <div style={{
                background: "white",
                borderRadius: "0.75rem",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                padding: "1.25rem",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
                    Suppliers
                  </h3>
                  <button
                    style={{
                      padding: "0.5rem 1rem",
                      background: COLORS.primary,
                      color: "white",
                      border: "none",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Download style={{ width: "1rem", height: "1rem" }} />
                    Export
                  </button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Name</th>
                        <th style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Contact</th>
                        <th style={{ textAlign: "right", padding: "0.75rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "500" }}>Total Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.companies.length > 0 ? (
                        data.companies.map((company) => {
                          const totalSales = filteredData.boughtBills
                            .filter((bill) => bill.supplierId === company.id)
                            .reduce((sum, bill) => {
                              const billTotal = bill.items?.reduce((itemSum, item) => {
                                const currency = item.currency || bill.currency || "IQD";
                                const price = currency === "USD" ? (item.basePriceUSD || item.price || 0) : (item.basePriceIQD || item.price || 0);
                                return itemSum + price * (item.quantity || 0);
                              }, 0) || 0;
                              return sum + billTotal;
                            }, 0);
                          return (
                            <tr key={company.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                                {company.name}
                              </td>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1e293b" }}>
                                {company.phone || "N/A"}
                              </td>
                              <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "0.875rem", fontWeight: "500", color: COLORS.primary }}>
                                {formatCurrency(totalSales, "IQD")}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="3" style={{ textAlign: "center", padding: "1.5rem", color: "#64748b" }}>
                            No suppliers found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}