"use client";

import { useState, useEffect, useRef } from "react";
import { createCatalogItem, updateCatalogItem, uploadCatalogImages } from "@/lib/data";

const UNITS = ["piece", "box", "pack", "bottle", "kg", "g", "liter", "ml", "strip", "vial", "ampule", "tablet", "capsule"];

export default function CatalogForm({ item, categories = [], onClose, onSave }) {
  const isEditing = !!item;
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    images: [],
    category: "",
    newCategory: "",
    showNewCat: false,
    priceUSD: "",
    priceIQD: "",
    showPrice: true,
    isVisible: false,
    unit: "piece",
    barcode: "",
    expiryDate: "",
  });

  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (item) {
      const exp = item.expiryDate || item.expireDate;
      let expStr = "";
      try {
        if (exp) {
          const d = exp?.toDate ? exp.toDate() : new Date(exp);
          if (!isNaN(d)) expStr = d.toISOString().split("T")[0];
        }
      } catch {}
      setForm({
        name: item.name || "",
        description: item.description || "",
        images: item.images || [],
        category: item.category || "",
        newCategory: "",
        showNewCat: false,
        priceUSD: item.priceUSD?.toString() || "",
        priceIQD: item.priceIQD?.toString() || "",
        showPrice: item.showPrice !== false,
        isVisible: item.isVisible || false,
        unit: item.unit || "piece",
        barcode: item.barcode || "",
        expiryDate: expStr,
      });
      setPreviews(item.images || []);
    }
  }, [item]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleFiles = async (files) => {
    const valid = Array.from(files).filter(f => {
      if (!f.type.startsWith("image/")) { setError(`${f.name} is not an image`); return false; }
      if (f.size > 5 * 1024 * 1024) { setError(`${f.name} exceeds 5 MB`); return false; }
      return true;
    });
    if (!valid.length) return;

    // local preview first
    const localPreviews = await Promise.all(valid.map(f => new Promise(res => {
      const r = new FileReader();
      r.onloadend = () => res(r.result);
      r.readAsDataURL(f);
    })));
    setPreviews(p => [...p, ...localPreviews]);

    try {
      setUploading(true); setError(null);
      const urls = await uploadCatalogImages(valid, form.name || "item");
      setForm(p => ({ ...p, images: [...p.images, ...urls] }));
      // replace local blob previews with real URLs
      setPreviews(p => {
        const base = p.slice(0, p.length - localPreviews.length);
        return [...base, ...urls];
      });
    } catch (e) {
      setError("Upload failed: " + e.message);
      setPreviews(p => p.slice(0, p.length - localPreviews.length));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (idx) => {
    setForm(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
    setPreviews(p => p.filter((_, i) => i !== idx));
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Item name is required");
    const cat = form.showNewCat ? form.newCategory.trim() : form.category;
    if (!cat) return setError("Category is required");
    if (!form.priceUSD && !form.priceIQD) return setError("At least one price is required");

    try {
      setSaving(true); setError(null);
      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        images: form.images,
        category: cat,
        priceUSD: parseFloat(form.priceUSD) || 0,
        priceIQD: parseFloat(form.priceIQD) || 0,
        showPrice: form.showPrice,
        isVisible: form.isVisible,
        unit: form.unit,
        barcode: form.barcode.trim(),
        expiryDate: form.expiryDate || null,
      };
      if (isEditing) await updateCatalogItem(item.id, data);
      else await createCatalogItem(data);
      onSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="form-modal">
        {/* Header */}
        <div className="form-header">
          <div className="form-header-left">
            <div className="form-icon">{isEditing ? "✏️" : "➕"}</div>
            <div>
              <h2 className="form-title">{isEditing ? "Edit Item" : "New Catalog Item"}</h2>
              <p className="form-subtitle">Medical equipment catalog entry</p>
            </div>
          </div>
          <button className="form-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="form-body">
          {error && <div className="form-error">⚠ {error}</div>}

          {/* Two-column layout */}
          <div className="form-grid">

            {/* LEFT */}
            <div className="form-col">

              {/* Name */}
              <div className="field">
                <label className="field-label">Item Name <span className="req">*</span></label>
                <input className="field-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Blood Pressure Monitor" />
              </div>

              {/* Barcode */}
              <div className="field">
                <label className="field-label">Barcode</label>
                <input className="field-input" value={form.barcode} onChange={e => set("barcode", e.target.value)} placeholder="Scan or type barcode" />
              </div>

              {/* Category */}
              <div className="field">
                <label className="field-label">Category <span className="req">*</span></label>
                {!form.showNewCat ? (
                  <div className="cat-row">
                    <select
                      className="field-input field-select"
                      value={form.category}
                      onChange={e => set("category", e.target.value)}
                    >
                      <option value="">Select category…</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" className="cat-new-btn" onClick={() => set("showNewCat", true)}>+ New</button>
                  </div>
                ) : (
                  <div className="cat-row">
                    <input
                      className="field-input"
                      placeholder="New category name"
                      value={form.newCategory}
                      onChange={e => set("newCategory", e.target.value)}
                      autoFocus
                    />
                    <button type="button" className="cat-cancel-btn" onClick={() => { set("showNewCat", false); set("newCategory", ""); }}>✕</button>
                  </div>
                )}
              </div>

              {/* Prices */}
              <div className="field">
                <label className="field-label">Prices <span className="req">*</span></label>
                <div className="price-row">
                  <div className="price-field">
                    <span className="price-cur iqd">IQD</span>
                    <input className="field-input price-input" type="number" min="0" step="1" value={form.priceIQD} onChange={e => set("priceIQD", e.target.value)} placeholder="0" />
                  </div>
                  <div className="price-field">
                    <span className="price-cur usd">$</span>
                    <input className="field-input price-input" type="number" min="0" step="0.01" value={form.priceUSD} onChange={e => set("priceUSD", e.target.value)} placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* Unit + Expiry */}
              <div className="two-col-fields">
                <div className="field">
                  <label className="field-label">Unit</label>
                  <select className="field-input field-select" value={form.unit} onChange={e => set("unit", e.target.value)}>
                    {UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Expiry Date</label>
                  <input className="field-input" type="date" value={form.expiryDate} onChange={e => set("expiryDate", e.target.value)} />
                </div>
              </div>

              {/* Description */}
              <div className="field">
                <label className="field-label">Description</label>
                <textarea className="field-input field-textarea" rows="3" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Short product description…" />
              </div>

              {/* Toggles */}
              <div className="toggle-row">
                <ToggleField
                  label="Visible in catalog"
                  sublabel="Customers can see this item"
                  checked={form.isVisible}
                  onChange={v => set("isVisible", v)}
                  color="blue"
                />
                <ToggleField
                  label="Show price"
                  sublabel="Display price publicly"
                  checked={form.showPrice}
                  onChange={v => set("showPrice", v)}
                  color="purple"
                />
              </div>

            </div>

            {/* RIGHT — images */}
            <div className="form-col">
              <div className="field">
                <label className="field-label">Images</label>
                <div
                  className={`drop-zone ${dragging ? "drop-zone-active" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={e => handleFiles(e.target.files)} />
                  {uploading ? (
                    <div className="drop-loading">
                      <div className="spinner" />
                      <span>Uploading…</span>
                    </div>
                  ) : (
                    <>
                      <div className="drop-icon">📷</div>
                      <p className="drop-text">Click or drag images here</p>
                      <p className="drop-hint">PNG, JPG, WEBP — max 5 MB each</p>
                    </>
                  )}
                </div>

                {previews.length > 0 && (
                  <div className="image-grid">
                    {previews.map((src, i) => (
                      <div key={i} className="image-thumb">
                        <img src={src} alt="" className="thumb-img" />
                        <button type="button" className="thumb-remove" onClick={() => removeImage(i)}>✕</button>
                        {i === 0 && <span className="thumb-primary">Primary</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="form-footer">
            <button type="button" className="footer-btn cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="footer-btn submit-btn" disabled={saving || uploading}>
              {saving ? <><div className="spinner spinner-sm" /> Saving…</> : isEditing ? "💾 Update Item" : "✓ Create Item"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .form-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999; padding: 16px;
        }
        .form-modal {
          background: #0d1020;
          border: 1px solid #1e2130;
          border-radius: 20px;
          width: 100%; max-width: 860px;
          max-height: 92vh;
          display: flex; flex-direction: column;
          box-shadow: 0 30px 80px rgba(0,0,0,0.8);
          overflow: hidden;
        }

        /* Header */
        .form-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 24px;
          background: #090b12;
          border-bottom: 1px solid #1a2035;
          flex-shrink: 0;
        }
        .form-header-left { display: flex; align-items: center; gap: 14px; }
        .form-icon { font-size: 28px; }
        .form-title { margin: 0; font-size: 20px; font-weight: 700; color: #e2e8f0; }
        .form-subtitle { margin: 0; font-size: 12px; color: #4a5568; }
        .form-close {
          background: #1a2035; border: 1px solid #2a3350;
          color: #718096; width: 32px; height: 32px; border-radius: 8px;
          font-size: 14px; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .form-close:hover { background: #ff4444; color: #fff; border-color: #ff4444; }

        .form-body { overflow-y: auto; padding: 24px; flex: 1; }
        .form-error {
          background: rgba(239,68,68,0.1); border: 1px solid rgba(248,113,113,0.3);
          color: #fca5a5; padding: 10px 14px; border-radius: 8px; font-size: 13px;
          margin-bottom: 16px;
        }

        /* Grid */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
        .form-col { display: flex; flex-direction: column; gap: 14px; }

        /* Fields */
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 12px; font-weight: 600; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; }
        .req { color: #f87171; }
        .field-input {
          background: #090b12; border: 1px solid #1e2130;
          border-radius: 10px; padding: 10px 13px;
          color: #e2e8f0; font-size: 14px; outline: none; width: 100%;
          transition: border-color 0.2s;
        }
        .field-input:focus { border-color: #63b3ed; box-shadow: 0 0 0 3px rgba(99,179,237,0.1); }
        .field-select { appearance: none; cursor: pointer; }
        .field-textarea { resize: vertical; min-height: 80px; }

        /* Category */
        .cat-row { display: flex; gap: 8px; }
        .cat-row .field-input { flex: 1; }
        .cat-new-btn, .cat-cancel-btn {
          padding: 10px 14px; border-radius: 10px; border: none;
          font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;
        }
        .cat-new-btn { background: rgba(99,179,237,0.15); color: #63b3ed; }
        .cat-cancel-btn { background: rgba(239,68,68,0.15); color: #f87171; }

        /* Prices */
        .price-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .price-field { position: relative; }
        .price-cur {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          font-size: 11px; font-weight: 800; letter-spacing: 0.5px;
          pointer-events: none;
        }
        .iqd { color: #a78bfa; }
        .usd { color: #34d399; }
        .price-input { padding-left: 40px !important; }

        /* Two col */
        .two-col-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        /* Toggles */
        .toggle-row { display: flex; flex-direction: column; gap: 8px; }
        .toggle-field {
          display: flex; align-items: center; gap: 12px;
          background: #090b12; border: 1px solid #1e2130;
          border-radius: 10px; padding: 10px 14px; cursor: pointer;
          transition: border-color 0.2s;
        }
        .toggle-field:hover { border-color: #2a3350; }
        .toggle-info { flex: 1; }
        .toggle-name { font-size: 13px; font-weight: 600; color: #e2e8f0; }
        .toggle-sub { font-size: 11px; color: #4a5568; }
        .t-track {
          width: 36px; height: 20px; border-radius: 10px;
          background: #1a2035; position: relative; transition: background 0.25s; flex-shrink: 0;
        }
        .t-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 14px; height: 14px; border-radius: 50%; background: #4a5568;
          transition: all 0.25s ease;
        }
        .t-on-blue .t-track { background: rgba(99,179,237,0.3); }
        .t-on-blue .t-thumb { background: #63b3ed; left: calc(100% - 17px); }
        .t-on-purple .t-track { background: rgba(139,92,246,0.3); }
        .t-on-purple .t-thumb { background: #a78bfa; left: calc(100% - 17px); }

        /* Drop zone */
        .drop-zone {
          border: 2px dashed #1e2130; border-radius: 12px;
          padding: 32px 16px; text-align: center; cursor: pointer;
          background: #090b12; transition: all 0.2s;
        }
        .drop-zone:hover, .drop-zone-active {
          border-color: #63b3ed; background: rgba(99,179,237,0.05);
        }
        .drop-icon { font-size: 36px; margin-bottom: 8px; }
        .drop-text { margin: 0; font-size: 13px; color: #a0aec0; font-weight: 500; }
        .drop-hint { margin: 4px 0 0; font-size: 11px; color: #4a5568; }
        .drop-loading { display: flex; flex-direction: column; align-items: center; gap: 10px; color: #63b3ed; font-size: 13px; }

        /* Image grid */
        .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px; margin-top: 12px; }
        .image-thumb { position: relative; border-radius: 8px; overflow: hidden; aspect-ratio: 1; background: #090b12; }
        .thumb-img { width: 100%; height: 100%; object-fit: cover; }
        .thumb-remove {
          position: absolute; top: 3px; right: 3px;
          background: rgba(239,68,68,0.85); border: none; color: #fff;
          width: 18px; height: 18px; border-radius: 50%; font-size: 10px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .thumb-primary {
          position: absolute; bottom: 0; left: 0; right: 0;
          background: rgba(99,179,237,0.8); color: #fff; font-size: 9px;
          font-weight: 700; text-align: center; padding: 2px 0; letter-spacing: 0.5px;
        }

        /* Footer */
        .form-footer {
          display: flex; gap: 10px; justify-content: flex-end;
          padding-top: 20px; border-top: 1px solid #1a2035; margin-top: 4px;
        }
        .footer-btn {
          padding: 11px 24px; border-radius: 10px; font-size: 14px;
          font-weight: 600; cursor: pointer; border: none; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px;
        }
        .cancel-btn { background: #1a2035; color: #718096; }
        .cancel-btn:hover { background: #212940; color: #a0aec0; }
        .submit-btn { background: #63b3ed; color: #0a0f1e; }
        .submit-btn:hover { background: #90cdf4; }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Spinner */
        .spinner {
          width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        .spinner-sm { width: 14px; height: 14px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function ToggleField({ label, sublabel, checked, onChange, color }) {
  return (
    <div className={`toggle-field t-on-${checked ? color : "off"}`} onClick={() => onChange(!checked)}>
      <div className="toggle-info">
        <div className="toggle-name">{label}</div>
        <div className="toggle-sub">{sublabel}</div>
      </div>
      <div className="t-track">
        <div className="t-thumb" />
      </div>
    </div>
  );
}