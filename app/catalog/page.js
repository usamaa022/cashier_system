// app/catalog/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  getCatalogCategories, 
  deleteCatalogItem,
  getCatalogItemsWithStock,
  updateCatalogItem,
  syncStoreItemsToCatalog
} from "@/lib/data";
import CatalogCard from "@/components/CatalogCard";
import CatalogForm from "@/components/CatalogForm";

export default function CatalogPage() {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showAllPrices, setShowAllPrices] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("name");
  const [filterVisible, setFilterVisible] = useState("all");
  const [filterInStock, setFilterInStock] = useState("all");

  const styles = {
    container: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
    },
    header: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    },
    headerTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '16px',
      marginBottom: '16px',
    },
    title: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#0f172a',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    headerButtons: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
    },
    button: {
      padding: '10px 20px',
      borderRadius: '10px',
      border: 'none',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    buttonPrimary: {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
    },
    buttonSecondary: {
      backgroundColor: '#e2e8f0',
      color: '#0f172a',
    },
    buttonSuccess: {
      backgroundColor: '#10b981',
      color: '#ffffff',
    },
    buttonWarning: {
      backgroundColor: '#f59e0b',
      color: '#ffffff',
    },
    filters: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'center',
    },
    searchInput: {
      flex: 1,
      minWidth: '200px',
      padding: '10px 16px',
      border: '2px solid #e2e8f0',
      borderRadius: '10px',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s',
      backgroundColor: '#ffffff',
    },
    select: {
      padding: '10px 16px',
      border: '2px solid #e2e8f0',
      borderRadius: '10px',
      fontSize: '14px',
      outline: 'none',
      backgroundColor: '#ffffff',
      cursor: 'pointer',
    },
    categoryButtons: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
    },
    categoryButton: {
      padding: '6px 16px',
      borderRadius: '20px',
      border: '2px solid #e2e8f0',
      fontSize: '13px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      backgroundColor: '#ffffff',
    },
    categoryButtonActive: {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
      borderColor: '#3b82f6',
    },
    stats: {
      display: 'flex',
      gap: '24px',
      flexWrap: 'wrap',
      padding: '12px 0',
      borderTop: '1px solid #e2e8f0',
      marginTop: '12px',
    },
    stat: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      color: '#64748b',
    },
    statValue: {
      fontWeight: '700',
      color: '#0f172a',
      fontSize: '16px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '24px',
    },
    empty: {
      textAlign: 'center',
      padding: '80px 20px',
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    },
    emptyIcon: {
      fontSize: '64px',
      marginBottom: '16px',
    },
    emptyTitle: {
      fontSize: '24px',
      fontWeight: '600',
      color: '#0f172a',
      marginBottom: '8px',
    },
    loading: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '400px',
      fontSize: '18px',
      color: '#64748b',
    },
    error: {
      backgroundColor: '#fee2e2',
      border: '1px solid #fca5a5',
      color: '#991b1b',
      padding: '12px 16px',
      borderRadius: '10px',
      marginBottom: '16px',
    },
    success: {
      backgroundColor: '#d1fae5',
      border: '1px solid #6ee7b7',
      color: '#065f46',
      padding: '12px 16px',
      borderRadius: '10px',
      marginBottom: '16px',
    },
    syncResult: {
      backgroundColor: '#f1f5f9',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
    },
    syncStats: {
      display: 'flex',
      gap: '24px',
      flexWrap: 'wrap',
    },
    syncStat: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
    },
    syncStatNumber: {
      fontSize: '20px',
      fontWeight: 'bold',
    },
  };

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedItems = await getCatalogItemsWithStock();
      setItems(loadedItems);
      
      const cats = await getCatalogCategories();
      setCategories(["All", ...cats]);
      
      setFilteredItems(loadedItems);
    } catch (err) {
      console.error("Error loading catalog:", err);
      setError("Failed to load catalog items. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    let filtered = [...items];
    
    // Category filter
    if (selectedCategory !== "All") {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    // Visibility filter
    if (filterVisible === "visible") {
      filtered = filtered.filter(item => item.isVisible === true);
    } else if (filterVisible === "hidden") {
      filtered = filtered.filter(item => item.isVisible === false);
    }
    
    // Stock filter
    if (filterInStock === "inStock") {
      filtered = filtered.filter(item => item.inStock === true);
    } else if (filterInStock === "outOfStock") {
      filtered = filtered.filter(item => item.inStock === false);
    }
    
    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.barcode && item.barcode.toLowerCase().includes(query))
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "priceUSD":
          return (a.priceUSD || 0) - (b.priceUSD || 0);
        case "priceIQD":
          return (a.priceIQD || 0) - (b.priceIQD || 0);
        case "newest":
          return new Date(b.createdAt) - new Date(a.createdAt);
        default:
          return 0;
      }
    });
    
    setFilteredItems(filtered);
  }, [items, selectedCategory, searchQuery, sortBy, filterVisible, filterInStock]);

  const handleImportFromStore = async () => {
    if (!confirm("Import all items from store to catalog?")) return;
    
    try {
      setSyncing(true);
      setError(null);
      setSyncResult(null);
      
      const result = await syncStoreItemsToCatalog();
      setSyncResult(result);
      
      await loadItems();
    } catch (err) {
      console.error("Error importing from store:", err);
      setError("Failed to import items: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleAllPrices = () => {
    setShowAllPrices(!showAllPrices);
  };

  const handleToggleVisibility = async (itemId, currentVisibility) => {
    try {
      await updateCatalogItem(itemId, { isVisible: !currentVisibility });
      await loadItems();
    } catch (err) {
      console.error("Error toggling visibility:", err);
      alert("Failed to update visibility: " + err.message);
    }
  };

  const handleTogglePriceVisibility = async (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    try {
      await updateCatalogItem(itemId, { showPrice: !item.showPrice });
      await loadItems();
    } catch (err) {
      console.error("Error toggling price visibility:", err);
      alert("Failed to update price visibility: " + err.message);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const handleFormSave = async () => {
    await loadItems();
    handleFormClose();
  };

  if (loading) {
    return <div style={styles.loading}>⏳ Loading catalog...</div>;
  }

  const visibleCount = filteredItems.filter(i => i.isVisible).length;
  const hiddenCount = filteredItems.filter(i => !i.isVisible).length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>
            📦 Product Catalog
            <span style={{fontSize: '14px', fontWeight: '400', color: '#64748b'}}>
              {items.length} items
            </span>
          </h1>
          <div style={styles.headerButtons}>
            <button
              onClick={handleToggleAllPrices}
              style={{...styles.button, ...(showAllPrices ? styles.buttonWarning : styles.buttonSecondary)}}
            >
              {showAllPrices ? '🔒 Hide All Prices' : '🔓 Show All Prices'}
            </button>
            <button
              onClick={handleImportFromStore}
              disabled={syncing}
              style={{
                ...styles.button,
                ...styles.buttonSuccess,
                opacity: syncing ? 0.6 : 1,
              }}
            >
              {syncing ? '⏳ Syncing...' : '📥 Import from Store'}
            </button>
            <button
              onClick={() => setShowForm(true)}
              style={{...styles.button, ...styles.buttonPrimary}}
            >
              + Add Item
            </button>
          </div>
        </div>

        <div style={styles.filters}>
          <input
            type="text"
            placeholder="🔍 Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={styles.select}
          >
            <option value="name">Sort by Name</option>
            <option value="priceUSD">Sort by Price (USD)</option>
            <option value="priceIQD">Sort by Price (IQD)</option>
            <option value="newest">Sort by Newest</option>
          </select>

          <select
            value={filterVisible}
            onChange={(e) => setFilterVisible(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Items</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
          </select>

          <select
            value={filterInStock}
            onChange={(e) => setFilterInStock(e.target.value)}
            style={styles.select}
          >
            <option value="all">All Stock</option>
            <option value="inStock">In Stock</option>
            <option value="outOfStock">Out of Stock</option>
          </select>
        </div>

        <div style={styles.categoryButtons}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                ...styles.categoryButton,
                ...(selectedCategory === cat ? styles.categoryButtonActive : {}),
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={styles.stats}>
          <div style={styles.stat}>
            <span>📊 Total:</span>
            <span style={styles.statValue}>{items.length}</span>
          </div>
          <div style={styles.stat}>
            <span>👁️ Visible:</span>
            <span style={{...styles.statValue, color: '#10b981'}}>{visibleCount}</span>
          </div>
          <div style={styles.stat}>
            <span>🔒 Hidden:</span>
            <span style={{...styles.statValue, color: '#64748b'}}>{hiddenCount}</span>
          </div>
          <div style={styles.stat}>
            <span>📦 In Stock:</span>
            <span style={{...styles.statValue, color: '#3b82f6'}}>
              {items.filter(i => i.inStock).length}
            </span>
          </div>
          <div style={styles.stat}>
            <span>Showing:</span>
            <span style={styles.statValue}>{filteredItems.length}</span>
          </div>
        </div>
      </div>

      {error && <div style={styles.error}>⚠️ {error}</div>}

      {syncResult && syncResult.created > 0 && (
        <div style={styles.syncResult}>
          <div style={styles.syncStats}>
            <div style={styles.syncStat}>
              <span>✅ Created:</span>
              <span style={{...styles.syncStatNumber, color: '#10b981'}}>{syncResult.created}</span>
            </div>
            <div style={styles.syncStat}>
              <span>⏭️ Skipped:</span>
              <span style={{...styles.syncStatNumber, color: '#f59e0b'}}>{syncResult.skipped}</span>
            </div>
            {syncResult.errors > 0 && (
              <div style={styles.syncStat}>
                <span>❌ Errors:</span>
                <span style={{...styles.syncStatNumber, color: '#ef4444'}}>{syncResult.errors}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📭</div>
          <div style={styles.emptyTitle}>No items found</div>
          <p style={{color: '#64748b'}}>
            {items.length === 0 
              ? 'Import items from the store or add new items manually.'
              : 'Try adjusting your filters or search query.'}
          </p>
          {items.length === 0 && (
            <button
              onClick={handleImportFromStore}
              disabled={syncing}
              style={{
                ...styles.button,
                ...styles.buttonSuccess,
                marginTop: '16px',
              }}
            >
              {syncing ? '⏳ Syncing...' : '📥 Import from Store'}
            </button>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredItems.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onToggleVisibility={handleToggleVisibility}
              onTogglePriceVisibility={handleTogglePriceVisibility}
              showAllPrices={showAllPrices}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CatalogForm
          item={editingItem}
          categories={categories.filter(c => c !== "All")}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
}