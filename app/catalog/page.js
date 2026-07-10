"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCatalogCategories,
  getCatalogItemsWithStock,
  updateCatalogItem,
  syncStoreItemsToCatalog,
} from "@/lib/data";
import CatalogCard from "@/components/CatalogCard";
import CatalogForm from "@/components/CatalogForm";

// ── tiny icon helpers ──────────────────────────────────────────────
const Icon = ({ d }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const SORT_OPTIONS = [
  { value: "name_asc",    label: "Name A → Z" },
  { value: "name_desc",   label: "Name Z → A" },
  { value: "priceUSD_asc",  label: "Price USD ↑" },
  { value: "priceUSD_desc", label: "Price USD ↓" },
  { value: "priceIQD_asc",  label: "Price IQD ↑" },
  { value: "priceIQD_desc", label: "Price IQD ↓" },
  { value: "newest",      label: "Newest first" },
  { value: "stock_desc",  label: "Most stock" },
];

export default function CatalogPage() {
  const [items, setItems]               = useState([]);
  const [filtered, setFiltered]         = useState([]);
  const [categories, setCategories]     = useState(["All"]);
  const [activeCat, setActiveCat]       = useState("All");
  const [search, setSearch]             = useState("");
  const [sortBy, setSortBy]             = useState("name_asc");
  const [filterVisible, setFilterVisible] = useState("all");   // all | visible | hidden
  const [filterStock, setFilterStock]   = useState("all");      // all | inStock | outOfStock
  const [showAllPrices, setShowAllPrices] = useState(true);
  const [loading, setLoading]           = useState(true);
  const [syncing, setSyncing]           = useState(false);
  const [syncResult, setSyncResult]     = useState(null);
  const [error, setError]               = useState(null);
  const [showForm, setShowForm]         = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [viewMode, setViewMode]         = useState("grid");     // grid | list

  // ── load ──
  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [its, cats] = await Promise.all([getCatalogItemsWithStock(), getCatalogCategories()]);
      setItems(its);
      setCategories(["All", ...cats]);
    } catch (e) {
      setError("Failed to load catalog: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── filter + sort ──
  useEffect(() => {
    let out = [...items];

    if (activeCat !== "All") out = out.filter(i => i.category === activeCat);
    if (filterVisible === "visible") out = out.filter(i => i.isVisible);
    if (filterVisible === "hidden")  out = out.filter(i => !i.isVisible);
    if (filterStock === "inStock")   out = out.filter(i => i.inStock);
    if (filterStock === "outOfStock")out = out.filter(i => !i.inStock);

    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.barcode?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    }

    out.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":    return a.name.localeCompare(b.name);
        case "name_desc":   return b.name.localeCompare(a.name);
        case "priceUSD_asc":  return (a.priceUSD||0) - (b.priceUSD||0);
        case "priceUSD_desc": return (b.priceUSD||0) - (a.priceUSD||0);
        case "priceIQD_asc":  return (a.priceIQD||0) - (b.priceIQD||0);
        case "priceIQD_desc": return (b.priceIQD||0) - (a.priceIQD||0);
        case "newest":    return new Date(b.createdAt||0) - new Date(a.createdAt||0);
        case "stock_desc":  return (b.stock?.totalQuantity||0) - (a.stock?.totalQuantity||0);
        default: return 0;
      }
    });

    setFiltered(out);
  }, [items, activeCat, filterVisible, filterStock, search, sortBy]);

  // ── actions ──
  const handleSync = async () => {
    if (!confirm("Sync all store items into the catalog? Existing names are skipped.")) return;
    setSyncing(true); setSyncResult(null); setError(null);
    try {
      const r = await syncStoreItemsToCatalog();
      setSyncResult(r);
      await load();
    } catch (e) {
      setError("Sync failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleVisibility = async (id, current) => {
    try {
      await updateCatalogItem(id, { isVisible: !current });
      setItems(prev => prev.map(i => i.id === id ? { ...i, isVisible: !current } : i));
    } catch (e) { alert("Failed: " + e.message); }
  };

  const handleTogglePrice = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const next = item.showPrice === false ? true : false;
    try {
      await updateCatalogItem(id, { showPrice: next });
      setItems(prev => prev.map(i => i.id === id ? { ...i, showPrice: next } : i));
    } catch (e) { alert("Failed: " + e.message); }
  };

  const handleEdit = (item) => { setEditItem(item); setShowForm(true); };
  const handleDelete = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const handleSave = async () => { await load(); setShowForm(false); setEditItem(null); };
  const handleClose = () => { setShowForm(false); setEditItem(null); };

  // ── stats ──
  const totalItems    = items.length;
  const visibleCount  = items.filter(i => i.isVisible).length;
  const inStockCount  = items.filter(i => i.inStock).length;
  const outStockCount = items.filter(i => !i.inStock).length;

  if (loading) return (
    <div className="page-loading">
      <div className="loading-spinner" />
      <span>Loading catalog…</span>
    </div>
  );

  return (
    <div className="catalog-page">

      {/* ══════════ TOP HEADER ══════════ */}
      <div className="page-header">
        <div className="page-header-top">
          <div className="page-title-block">
            <span className="page-icon">⚕️</span>
            <div>
              <h1 className="page-title">Product Catalog</h1>
              <p className="page-sub">{totalItems} items · {visibleCount} visible · {inStockCount} in stock</p>
            </div>
          </div>

          <div className="header-actions">
            {/* Hide / Show all prices */}
            <button
              className={`hdr-btn ${showAllPrices ? "hdr-btn-active" : "hdr-btn-ghost"}`}
              onClick={() => setShowAllPrices(p => !p)}
              title={showAllPrices ? "Hide all prices" : "Show all prices"}
            >
              {showAllPrices ? "🔒 Hide All Prices" : "🔓 Show All Prices"}
            </button>

            {/* Sync */}
            <button className={`hdr-btn hdr-btn-sync ${syncing ? "hdr-btn-loading" : ""}`} onClick={handleSync} disabled={syncing}>
              {syncing ? <><div className="spinner-xs" /> Syncing…</> : "📥 Sync from Store"}
            </button>

            {/* Add */}
            <button className="hdr-btn hdr-btn-primary" onClick={() => setShowForm(true)}>
              + Add Item
            </button>
          </div>
        </div>

        {/* Sync result banner */}
        {syncResult && (
          <div className="sync-banner">
            <span className="sync-stat green">✓ {syncResult.created} created</span>
            <span className="sync-stat amber">↷ {syncResult.skipped} skipped</span>
            {syncResult.errors > 0 && <span className="sync-stat red">✗ {syncResult.errors} errors</span>}
            <button className="sync-dismiss" onClick={() => setSyncResult(null)}>✕</button>
          </div>
        )}

        {error && (
          <div className="error-banner">⚠ {error} <button className="sync-dismiss" onClick={() => setError(null)}>✕</button></div>
        )}

        {/* ── Stats row ── */}
        <div className="stats-row">
          <StatPill icon="📦" label="Total"    value={totalItems}   color="blue" />
          <StatPill icon="👁"  label="Visible"  value={visibleCount} color="green" />
          <StatPill icon="🔒" label="Hidden"   value={totalItems - visibleCount} color="gray" />
          <StatPill icon="✓"  label="In Stock" value={inStockCount}  color="emerald" />
          <StatPill icon="✗"  label="Out of Stock" value={outStockCount} color="red" />
          <StatPill icon="🔍" label="Showing"  value={filtered.length} color="purple" />
        </div>

        {/* ── Search + Filters bar ── */}
        <div className="filter-bar">
          {/* Search */}
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Search by name, barcode, category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="search-clear" onClick={() => setSearch("")}>✕</button>}
          </div>

          {/* Sort */}
          <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Visibility filter */}
          <select className="filter-select" value={filterVisible} onChange={e => setFilterVisible(e.target.value)}>
            <option value="all">All items</option>
            <option value="visible">Visible only</option>
            <option value="hidden">Hidden only</option>
          </select>

          {/* Stock filter */}
          <select className="filter-select" value={filterStock} onChange={e => setFilterStock(e.target.value)}>
            <option value="all">All stock</option>
            <option value="inStock">In stock</option>
            <option value="outOfStock">Out of stock</option>
          </select>

          {/* View mode */}
          <div className="view-toggle">
            <button className={`view-btn ${viewMode === "grid" ? "view-active" : ""}`} onClick={() => setViewMode("grid")} title="Grid view">⊞</button>
            <button className={`view-btn ${viewMode === "list" ? "view-active" : ""}`} onClick={() => setViewMode("list")} title="List view">☰</button>
          </div>
        </div>

        {/* ── Category tabs ── */}
        <div className="cat-tabs">
          {categories.map(c => (
            <button
              key={c}
              className={`cat-tab ${activeCat === c ? "cat-tab-active" : ""}`}
              onClick={() => setActiveCat(c)}
            >
              {c}
              {c !== "All" && (
                <span className="cat-count">{items.filter(i => i.category === c).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ GRID / LIST ══════════ */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3 className="empty-title">No items found</h3>
          <p className="empty-sub">
            {items.length === 0
              ? "Sync items from the store or add manually."
              : "Try changing your filters or search term."}
          </p>
          {items.length === 0 && (
            <button className="hdr-btn hdr-btn-sync" onClick={handleSync} disabled={syncing}>
              {syncing ? "Syncing…" : "📥 Sync from Store"}
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="catalog-grid">
          {filtered.map(item => (
            <CatalogCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onToggleVisibility={handleToggleVisibility}
              onTogglePriceVisibility={handleTogglePrice}
              showAllPrices={showAllPrices}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="catalog-list">
          {filtered.map(item => (
            <ListRow
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onToggleVisibility={handleToggleVisibility}
              onTogglePriceVisibility={handleTogglePrice}
              showAllPrices={showAllPrices}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ══════════ FORM MODAL ══════════ */}
      {showForm && (
        <CatalogForm
          item={editItem}
          categories={categories.filter(c => c !== "All")}
          onClose={handleClose}
          onSave={handleSave}
        />
      )}

      <style jsx global>{`
        * { box-sizing: border-box; }
        body { background: #060810; }

        /* ── Page ── */
        .catalog-page {
          min-height: 100vh;
          background: #060810;
          padding: 24px;
          max-width: 1600px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ── Header ── */
        .page-header {
          background: #0d1020;
          border: 1px solid #1e2130;
          border-radius: 18px;
          padding: 22px 24px 16px;
          margin-bottom: 24px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .page-header-top {
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 16px;
        }
        .page-title-block { display: flex; align-items: center; gap: 14px; }
        .page-icon { font-size: 36px; }
        .page-title { margin: 0; font-size: 26px; font-weight: 800; color: #e2e8f0; }
        .page-sub { margin: 2px 0 0; font-size: 13px; color: #4a5568; }

        /* ── Header buttons ── */
        .header-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .hdr-btn {
          padding: 10px 18px; border-radius: 10px; border: none;
          font-size: 13px; font-weight: 600; cursor: pointer;
          transition: all 0.2s; display: flex; align-items: center; gap: 7px;
          white-space: nowrap;
        }
        .hdr-btn-ghost { background: #1a2035; color: #718096; border: 1px solid #2a3350; }
        .hdr-btn-ghost:hover { background: #212940; color: #a0aec0; }
        .hdr-btn-active { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(251,191,36,0.25); }
        .hdr-btn-active:hover { background: rgba(245,158,11,0.25); }
        .hdr-btn-sync { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(52,211,153,0.2); }
        .hdr-btn-sync:hover { background: rgba(16,185,129,0.22); }
        .hdr-btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }
        .hdr-btn-primary { background: #63b3ed; color: #0a0f1e; font-weight: 700; }
        .hdr-btn-primary:hover { background: #90cdf4; }

        /* ── Banners ── */
        .sync-banner {
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
          background: rgba(16,185,129,0.07); border: 1px solid rgba(52,211,153,0.15);
          border-radius: 10px; padding: 10px 14px;
        }
        .sync-stat { font-size: 13px; font-weight: 600; }
        .sync-stat.green { color: #34d399; }
        .sync-stat.amber { color: #fbbf24; }
        .sync-stat.red   { color: #f87171; }
        .sync-dismiss {
          margin-left: auto; background: none; border: none; color: #4a5568;
          cursor: pointer; font-size: 14px;
        }
        .error-banner {
          display: flex; align-items: center; gap: 10px;
          background: rgba(239,68,68,0.08); border: 1px solid rgba(248,113,113,0.2);
          color: #fca5a5; border-radius: 10px; padding: 10px 14px; font-size: 13px;
        }

        /* ── Stats ── */
        .stats-row {
          display: flex; gap: 10px; flex-wrap: wrap;
          padding-top: 4px; border-top: 1px solid #1a2035;
        }
        .stat-pill {
          display: flex; align-items: center; gap: 7px;
          background: #090b12; border: 1px solid #1e2130;
          border-radius: 10px; padding: 7px 12px;
          min-width: 100px;
        }
        .stat-icon { font-size: 14px; }
        .stat-info { display: flex; flex-direction: column; }
        .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #4a5568; font-weight: 600; }
        .stat-value { font-size: 18px; font-weight: 800; }
        .stat-blue    .stat-value { color: #63b3ed; }
        .stat-green   .stat-value { color: #4ade80; }
        .stat-gray    .stat-value { color: #718096; }
        .stat-emerald .stat-value { color: #34d399; }
        .stat-red     .stat-value { color: #f87171; }
        .stat-purple  .stat-value { color: #a78bfa; }

        /* ── Filter bar ── */
        .filter-bar {
          display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
        }
        .search-wrap {
          flex: 1; min-width: 200px; position: relative; display: flex; align-items: center;
        }
        .search-icon {
          position: absolute; left: 13px; pointer-events: none; font-size: 14px;
        }
        .search-input {
          width: 100%; padding: 10px 36px 10px 38px;
          background: #090b12; border: 1px solid #1e2130;
          border-radius: 10px; color: #e2e8f0; font-size: 14px; outline: none;
          transition: border-color 0.2s;
        }
        .search-input:focus { border-color: #63b3ed; }
        .search-input::placeholder { color: #4a5568; }
        .search-clear {
          position: absolute; right: 10px;
          background: none; border: none; color: #4a5568;
          cursor: pointer; font-size: 14px; padding: 2px;
        }
        .search-clear:hover { color: #f87171; }

        .filter-select {
          padding: 10px 14px;
          background: #090b12; border: 1px solid #1e2130;
          border-radius: 10px; color: #a0aec0; font-size: 13px;
          outline: none; cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234a5568' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 30px;
          transition: border-color 0.2s;
        }
        .filter-select:focus { border-color: #63b3ed; }

        /* View toggle */
        .view-toggle {
          display: flex; background: #090b12;
          border: 1px solid #1e2130; border-radius: 10px; overflow: hidden;
        }
        .view-btn {
          padding: 8px 13px; border: none; background: none;
          color: #4a5568; cursor: pointer; font-size: 16px; transition: all 0.2s;
        }
        .view-btn:hover { color: #a0aec0; }
        .view-active { background: #1a2035 !important; color: #63b3ed !important; }

        /* ── Category tabs ── */
        .cat-tabs {
          display: flex; gap: 6px; flex-wrap: wrap;
          overflow-x: auto; padding-bottom: 2px;
        }
        .cat-tab {
          padding: 6px 14px; border-radius: 20px;
          border: 1px solid #1e2130; background: #090b12;
          color: #718096; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; white-space: nowrap;
          display: flex; align-items: center; gap: 5px;
        }
        .cat-tab:hover { border-color: #2a3350; color: #a0aec0; }
        .cat-tab-active {
          background: rgba(99,179,237,0.15);
          border-color: rgba(99,179,237,0.35);
          color: #63b3ed;
        }
        .cat-count {
          background: rgba(255,255,255,0.08); border-radius: 10px;
          padding: 1px 6px; font-size: 10px;
        }

        /* ── Grid ── */
        .catalog-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        /* ── List view ── */
        .catalog-list { display: flex; flex-direction: column; gap: 8px; }
        .list-row {
          background: #0d1020; border: 1px solid #1e2130; border-radius: 12px;
          display: flex; align-items: center; gap: 14px; padding: 12px 16px;
          transition: all 0.2s;
        }
        .list-row:hover { border-color: #2a3350; transform: translateX(2px); }
        .list-thumb {
          width: 52px; height: 52px; border-radius: 8px; overflow: hidden;
          background: #090b12; flex-shrink: 0;
        }
        .list-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .list-thumb-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; opacity: 0.4; }
        .list-main { flex: 1; min-width: 0; }
        .list-name { font-size: 14px; font-weight: 700; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .list-meta { display: flex; gap: 8px; align-items: center; margin-top: 3px; flex-wrap: wrap; }
        .list-cat { font-size: 11px; color: #63b3ed; background: rgba(99,179,237,0.1); padding: 1px 7px; border-radius: 5px; }
        .list-stock-ok { font-size: 11px; color: #34d399; }
        .list-stock-no { font-size: 11px; color: #f87171; }
        .list-exp { font-size: 11px; color: #fbbf24; }
        .list-prices { display: flex; gap: 8px; align-items: center; }
        .list-price { font-size: 14px; font-weight: 700; }
        .list-price-iqd { color: #a78bfa; }
        .list-price-usd { color: #34d399; }
        .list-hidden { font-size: 12px; color: #4a5568; letter-spacing: 3px; }
        .list-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .list-btn {
          padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600;
          border: none; cursor: pointer; transition: all 0.2s;
        }
        .list-btn-edit { background: rgba(99,179,237,0.1); color: #63b3ed; }
        .list-btn-edit:hover { background: rgba(99,179,237,0.2); }
        .list-vis-on { background: rgba(16,185,129,0.1); color: #34d399; }
        .list-vis-on:hover { background: rgba(16,185,129,0.2); }
        .list-vis-off { background: rgba(100,116,139,0.1); color: #718096; }
        .list-vis-off:hover { background: rgba(100,116,139,0.2); }

        /* ── Empty ── */
        .empty-state {
          text-align: center; padding: 80px 20px;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
        }
        .empty-icon { font-size: 64px; opacity: 0.4; }
        .empty-title { font-size: 22px; font-weight: 700; color: #4a5568; margin: 0; }
        .empty-sub { font-size: 14px; color: #2d3748; margin: 0; }

        /* ── Loading ── */
        .page-loading {
          min-height: 100vh; background: #060810;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; color: #4a5568; font-size: 16px;
        }
        .loading-spinner {
          width: 40px; height: 40px;
          border: 3px solid #1e2130; border-top-color: #63b3ed;
          border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* spinners */
        .spinner-xs {
          width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,0.2); border-top-color: currentColor;
          border-radius: 50%; animation: spin 0.6s linear infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}

// ── Stat pill ──────────────────────────────────────────────────────
function StatPill({ icon, label, value, color }) {
  return (
    <div className={`stat-pill stat-${color}`}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
      </div>
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────
function ListRow({ item, onEdit, onToggleVisibility, onTogglePriceVisibility, showAllPrices, onDelete }) {
  const images = item.images || [];
  const showPrice = item.showPrice !== false && showAllPrices !== false;

  const formatExpiry = (d) => {
    if (!d) return null;
    try {
      const date = d?.toDate ? d.toDate() : new Date(d);
      if (isNaN(date)) return null;
      const diff = (date - new Date()) / (1000 * 60 * 60 * 24);
      return { str: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), urgent: diff < 90 };
    } catch { return null; }
  };

  const expiry = formatExpiry(item.expiryDate || item.expireDate);
  const stock = item.stock?.totalQuantity ?? 0;

  return (
    <div className="list-row" style={{ opacity: item.isVisible ? 1 : 0.55 }}>
      <div className="list-thumb">
        {images[0]
          ? <img src={images[0]} alt={item.name} />
          : <div className="list-thumb-ph">💊</div>
        }
      </div>

      <div className="list-main">
        <div className="list-name">{item.name}</div>
        <div className="list-meta">
          <span className="list-cat">{item.category || "Uncategorized"}</span>
          {stock > 0
            ? <span className="list-stock-ok">✓ {stock} in stock</span>
            : <span className="list-stock-no">✗ Out of stock</span>
          }
          {expiry && <span className="list-exp">⏰ {expiry.str}</span>}
          {item.barcode && <span style={{ fontSize: 11, color: "#2d3748" }}>#{item.barcode}</span>}
        </div>
      </div>

      <div className="list-prices">
        {showPrice ? (
          <>
            {item.priceIQD > 0 && <span className="list-price list-price-iqd">{Number(item.priceIQD).toLocaleString()} IQD</span>}
            {item.priceUSD > 0 && <span className="list-price list-price-usd">${Number(item.priceUSD).toFixed(2)}</span>}
          </>
        ) : <span className="list-hidden">● ● ●</span>}
      </div>

      <div className="list-actions">
        <button className="list-btn list-btn-edit" onClick={() => onEdit(item)}>Edit</button>
        <button
          className={`list-btn ${item.isVisible ? "list-vis-on" : "list-vis-off"}`}
          onClick={() => onToggleVisibility(item.id, item.isVisible)}
        >
          {item.isVisible ? "👁 Visible" : "○ Hidden"}
        </button>
      </div>
    </div>
  );
}