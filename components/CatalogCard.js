"use client";

import { useState } from "react";
import { deleteCatalogItem } from "@/lib/data";

export default function CatalogCard({ item, onEdit, onToggleVisibility, onTogglePriceVisibility, showAllPrices, onDelete }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const images = item.images || [];
  const showPrice = item.showPrice !== false && showAllPrices !== false;

  const formatExpiry = (d) => {
    if (!d) return null;
    try {
      const date = d?.toDate ? d.toDate() : new Date(d);
      if (isNaN(date)) return null;
      const now = new Date();
      const diff = (date - now) / (1000 * 60 * 60 * 24);
      const str = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      return { str, urgent: diff < 90, expired: diff < 0 };
    } catch { return null; }
  };

  const expiry = formatExpiry(item.expiryDate || item.expireDate);
  const stock = item.stock?.totalQuantity ?? 0;

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try { await deleteCatalogItem(item.id); onDelete?.(item.id); }
    catch (e) { alert("Delete failed: " + e.message); setDeleting(false); setConfirmDelete(false); }
  };

  return (
    <div className={`catalog-card ${!item.isVisible ? "card-hidden" : ""}`}>

      {/* ── Image Zone ── */}
      <div className="card-image-zone">
        {images.length > 0 && !imgError ? (
          <img
            src={images[imgIdx]}
            alt={item.name}
            className="card-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="card-img-placeholder">
            <span className="placeholder-icon">💊</span>
          </div>
        )}

        {/* image nav */}
        {images.length > 1 && (
          <>
            <button className="img-nav img-nav-l" onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}>‹</button>
            <button className="img-nav img-nav-r" onClick={() => setImgIdx((i) => (i + 1) % images.length)}>›</button>
            <div className="img-dots">
              {images.map((_, i) => (
                <button key={i} className={`img-dot ${i === imgIdx ? "img-dot-active" : ""}`} onClick={() => setImgIdx(i)} />
              ))}
            </div>
          </>
        )}

        {/* stock pill */}
        <div className={`stock-pill ${stock > 0 ? "in-stock" : "out-stock"}`}>
          {stock > 0 ? `✓ ${stock} in stock` : "✗ Out of stock"}
        </div>

        {/* expiry ribbon */}
        {expiry && (
          <div className={`expiry-ribbon ${expiry.expired ? "exp-red" : expiry.urgent ? "exp-amber" : "exp-green"}`}>
            {expiry.expired ? "EXPIRED" : "EXP"} {expiry.str}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="card-body">
        <div className="card-meta-row">
          <span className="card-category">{item.category || "Uncategorized"}</span>
          {item.barcode && <span className="card-barcode">#{item.barcode}</span>}
        </div>

        <h3 className="card-name">{item.name}</h3>

        {item.description && (
          <p className="card-desc">{item.description}</p>
        )}

        {/* ── Price Block ── */}
        <div className="price-block">
          {showPrice ? (
            <div className="prices-row">
              {item.priceIQD > 0 && (
                <div className="price-chip price-iqd">
                  <span className="price-label">IQD</span>
                  <span className="price-val">{Number(item.priceIQD).toLocaleString()}</span>
                </div>
              )}
              {item.priceUSD > 0 && (
                <div className="price-chip price-usd">
                  <span className="price-label">USD</span>
                  <span className="price-val">${Number(item.priceUSD).toFixed(2)}</span>
                </div>
              )}
              {!item.priceIQD && !item.priceUSD && (
                <span className="no-price">No price set</span>
              )}
            </div>
          ) : (
            <div className="price-hidden-row">
              <span className="price-hidden-dots">● ● ● ●</span>
              <span className="price-hidden-label">Price hidden</span>
            </div>
          )}
        </div>

        {/* ── Toggle Controls ── */}
        <div className="card-toggles">
          {/* Visibility toggle */}
          <button
            className={`toggle-btn ${item.isVisible ? "toggle-on" : "toggle-off"}`}
            onClick={() => onToggleVisibility(item.id, item.isVisible)}
            title={item.isVisible ? "Hide from catalog" : "Show in catalog"}
          >
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-label">{item.isVisible ? "Visible" : "Hidden"}</span>
          </button>

          {/* Price visibility toggle */}
          <button
            className={`toggle-btn ${item.showPrice !== false ? "toggle-price-on" : "toggle-price-off"}`}
            onClick={() => onTogglePriceVisibility(item.id)}
            title={item.showPrice !== false ? "Hide price" : "Show price"}
          >
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-label">{item.showPrice !== false ? "Price on" : "Price off"}</span>
          </button>
        </div>

        {/* ── Action Row ── */}
        <div className="card-actions">
          <button className="action-btn btn-edit" onClick={() => onEdit(item)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>

          {confirmDelete ? (
            <button className="action-btn btn-confirm-delete" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Confirm?"}
            </button>
          ) : (
            <button className="action-btn btn-delete" onClick={() => setConfirmDelete(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Delete
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .catalog-card {
          background: #0f1117;
          border: 1px solid #1e2130;
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s;
          position: relative;
        }
        .catalog-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,179,237,0.15);
          border-color: #2a3350;
        }
        .card-hidden { opacity: 0.55; }

        /* Image */
        .card-image-zone {
          position: relative;
          height: 200px;
          background: #090b10;
          overflow: hidden;
        }
        .card-img {
          width: 100%; height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }
        .catalog-card:hover .card-img { transform: scale(1.04); }
        .card-img-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #0d1424 0%, #111827 100%);
        }
        .placeholder-icon { font-size: 52px; opacity: 0.35; }

        /* Image nav */
        .img-nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(0,0,0,0.7); border: none; color: #fff;
          width: 28px; height: 28px; border-radius: 50%;
          font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.2s;
        }
        .img-nav:hover { background: rgba(99,179,237,0.8); }
        .img-nav-l { left: 8px; }
        .img-nav-r { right: 8px; }
        .img-dots {
          position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
          display: flex; gap: 5px;
        }
        .img-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: rgba(255,255,255,0.35); border: none; cursor: pointer; padding: 0;
          transition: all 0.2s;
        }
        .img-dot-active { background: #63b3ed; width: 18px; border-radius: 4px; }

        /* Pills */
        .stock-pill {
          position: absolute; top: 10px; left: 10px;
          padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
          letter-spacing: 0.3px; backdrop-filter: blur(6px);
        }
        .in-stock { background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(52,211,153,0.3); }
        .out-stock { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(248,113,113,0.25); }

        .expiry-ribbon {
          position: absolute; bottom: 0; left: 0; right: 0;
          text-align: center; font-size: 10px; font-weight: 700;
          letter-spacing: 0.8px; padding: 4px 0;
          backdrop-filter: blur(4px);
        }
        .exp-red { background: rgba(220,38,38,0.75); color: #fca5a5; }
        .exp-amber { background: rgba(245,158,11,0.7); color: #fde68a; }
        .exp-green { background: rgba(5,150,105,0.6); color: #6ee7b7; }

        /* Body */
        .card-body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 10px; }

        .card-meta-row { display: flex; justify-content: space-between; align-items: center; }
        .card-category {
          font-size: 11px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase;
          color: #63b3ed; background: rgba(99,179,237,0.1); border: 1px solid rgba(99,179,237,0.2);
          padding: 2px 8px; border-radius: 6px;
        }
        .card-barcode { font-size: 10px; color: #4a5568; font-family: 'Courier New', monospace; }

        .card-name {
          font-size: 15px; font-weight: 700; color: #e2e8f0;
          margin: 0; line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .card-desc {
          font-size: 12px; color: #4a5568; margin: 0; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }

        /* Price */
        .price-block { border-top: 1px solid #1a2035; padding-top: 10px; }
        .prices-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .price-chip {
          display: flex; flex-direction: column; gap: 1px;
          padding: 6px 10px; border-radius: 8px; min-width: 80px;
        }
        .price-iqd { background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.2); }
        .price-usd { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); }
        .price-label { font-size: 9px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #718096; }
        .price-iqd .price-label { color: #a78bfa; }
        .price-usd .price-label { color: #34d399; }
        .price-val { font-size: 16px; font-weight: 800; color: #e2e8f0; }
        .no-price { font-size: 12px; color: #4a5568; font-style: italic; }
        .price-hidden-row { display: flex; align-items: center; gap: 8px; }
        .price-hidden-dots { letter-spacing: 4px; font-size: 10px; color: #2d3748; }
        .price-hidden-label { font-size: 11px; color: #4a5568; }

        /* Toggles */
        .card-toggles { display: flex; gap: 8px; }
        .toggle-btn {
          flex: 1; display: flex; align-items: center; gap: 6px;
          background: #0d1020; border: 1px solid #1e2130; border-radius: 8px;
          padding: 7px 10px; cursor: pointer; transition: all 0.2s;
          font-size: 11px; font-weight: 600; color: #4a5568;
        }
        .toggle-btn:hover { border-color: #2a3350; }
        .toggle-track {
          width: 28px; height: 15px; border-radius: 8px; background: #1a2035;
          position: relative; flex-shrink: 0; transition: background 0.2s;
        }
        .toggle-thumb {
          position: absolute; top: 2px; left: 2px;
          width: 11px; height: 11px; border-radius: 50%; background: #4a5568;
          transition: all 0.2s ease;
        }

        /* Visibility ON */
        .toggle-on .toggle-track { background: rgba(99,179,237,0.25); }
        .toggle-on .toggle-thumb { background: #63b3ed; left: calc(100% - 13px); }
        .toggle-on { color: #63b3ed; border-color: rgba(99,179,237,0.2); }

        /* Price ON */
        .toggle-price-on .toggle-track { background: rgba(139,92,246,0.25); }
        .toggle-price-on .toggle-thumb { background: #a78bfa; left: calc(100% - 13px); }
        .toggle-price-on { color: #a78bfa; border-color: rgba(139,92,246,0.2); }

        .toggle-label { white-space: nowrap; }

        /* Actions */
        .card-actions { display: flex; gap: 6px; margin-top: auto; padding-top: 2px; }
        .action-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
          padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 600;
          border: none; cursor: pointer; transition: all 0.2s;
        }
        .btn-edit {
          background: rgba(99,179,237,0.1); color: #63b3ed;
          border: 1px solid rgba(99,179,237,0.2);
        }
        .btn-edit:hover { background: rgba(99,179,237,0.2); }
        .btn-delete {
          background: rgba(239,68,68,0.08); color: #f87171;
          border: 1px solid rgba(248,113,113,0.15);
        }
        .btn-delete:hover { background: rgba(239,68,68,0.18); }
        .btn-confirm-delete {
          background: rgba(239,68,68,0.25); color: #fca5a5;
          border: 1px solid rgba(248,113,113,0.4);
          animation: pulse 0.8s ease infinite alternate;
        }
        @keyframes pulse { from { opacity: 0.8; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}