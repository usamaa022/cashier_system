// components/CatalogForm.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { createCatalogItem, updateCatalogItem, uploadCatalogImages } from "@/lib/data";

export default function CatalogForm({ item, categories, onClose, onSave }) {
  const isEditing = !!item;
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    images: [],
    category: "",
    priceUSD: "",
    priceIQD: "",
    showPrice: true,
    isVisible: false,
    unit: "piece",
    barcode: "",
    specifications: {},
  });
  
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || "",
        description: item.description || "",
        images: item.images || [],
        category: item.category || "",
        priceUSD: item.priceUSD?.toString() || "",
        priceIQD: item.priceIQD?.toString() || "",
        showPrice: item.showPrice !== false,
        isVisible: item.isVisible || false,
        unit: item.unit || "piece",
        barcode: item.barcode || "",
        specifications: item.specifications || {},
      });
      setImagePreviews(item.images || []);
    }
  }, [item]);

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      backdropFilter: 'blur(4px)',
    },
    modal: {
      backgroundColor: '#ffffff',
      borderRadius: '20px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      width: '100%',
      maxWidth: '700px',
      maxHeight: '90vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      padding: '20px 24px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#f8fafc',
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      margin: 0,
      color: '#0f172a',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '28px',
      cursor: 'pointer',
      color: '#64748b',
      padding: '0 8px',
      transition: 'color 0.2s',
    },
    form: {
      padding: '24px',
      overflowY: 'auto',
      flex: 1,
    },
    formGroup: {
      marginBottom: '20px',
    },
    label: {
      display: 'block',
      fontSize: '13px',
      fontWeight: '600',
      color: '#0f172a',
      marginBottom: '6px',
    },
    input: {
      width: '100%',
      padding: '10px 14px',
      border: '2px solid #e2e8f0',
      borderRadius: '10px',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s',
      backgroundColor: '#ffffff',
    },
    textarea: {
      width: '100%',
      padding: '10px 14px',
      border: '2px solid #e2e8f0',
      borderRadius: '10px',
      fontSize: '14px',
      outline: 'none',
      resize: 'vertical',
      minHeight: '80px',
      transition: 'border-color 0.2s',
      backgroundColor: '#ffffff',
    },
    select: {
      width: '100%',
      padding: '10px 14px',
      border: '2px solid #e2e8f0',
      borderRadius: '10px',
      fontSize: '14px',
      outline: 'none',
      backgroundColor: '#ffffff',
      transition: 'border-color 0.2s',
    },
    checkbox: {
      marginRight: '10px',
      width: '18px',
      height: '18px',
      accentColor: '#3b82f6',
    },
    error: {
      backgroundColor: '#fee2e2',
      border: '1px solid #fca5a5',
      color: '#991b1b',
      padding: '12px 16px',
      borderRadius: '10px',
      marginBottom: '16px',
    },
    imageUpload: {
      border: '2px dashed #e2e8f0',
      borderRadius: '10px',
      padding: '20px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      backgroundColor: '#f8fafc',
    },
    imageGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
      gap: '12px',
      marginTop: '12px',
    },
    imageItem: {
      position: 'relative',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#f1f5f9',
      aspectRatio: '1',
    },
    imagePreview: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    removeImage: {
      position: 'absolute',
      top: '4px',
      right: '4px',
      backgroundColor: 'rgba(239, 68, 68, 0.9)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '50%',
      width: '24px',
      height: '24px',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background-color 0.2s',
    },
    priceRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
    },
    specRow: {
      display: 'flex',
      gap: '8px',
      marginBottom: '8px',
    },
    specList: {
      marginTop: '8px',
    },
    specItem: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 12px',
      backgroundColor: '#f8fafc',
      borderRadius: '6px',
      marginBottom: '4px',
      fontSize: '13px',
    },
    actions: {
      display: 'flex',
      gap: '12px',
      paddingTop: '20px',
      borderTop: '1px solid #e5e7eb',
    },
    button: {
      flex: 1,
      padding: '12px 20px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    buttonPrimary: {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
    },
    buttonSecondary: {
      backgroundColor: '#e2e8f0',
      color: '#0f172a',
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    if (value === "add-new") {
      setShowNewCategoryInput(true);
      setFormData(prev => ({ ...prev, category: "" }));
    } else {
      setShowNewCategoryInput(false);
      setFormData(prev => ({ ...prev, category: value }));
    }
  };

  const handleAddNewCategory = () => {
    if (newCategory.trim()) {
      setFormData(prev => ({ ...prev, category: newCategory.trim() }));
      setNewCategory("");
      setShowNewCategoryInput(false);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate files
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} is larger than 5MB`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Preview
    const previews = [];
    for (const file of validFiles) {
      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onloadend = () => {
          previews.push(reader.result);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setImagePreviews(prev => [...prev, ...previews]);

    // Upload to Firebase
    try {
      setUploadingImages(true);
      setError(null);
      const urls = await uploadCatalogImages(validFiles, formData.name || 'item');
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...urls]
      }));
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload images: ' + err.message);
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddSpec = () => {
    if (newSpecKey.trim() && newSpecValue.trim()) {
      setFormData(prev => ({
        ...prev,
        specifications: {
          ...prev.specifications,
          [newSpecKey.trim()]: newSpecValue.trim()
        }
      }));
      setNewSpecKey("");
      setNewSpecValue("");
    }
  };

  const handleRemoveSpec = (key) => {
    setFormData(prev => {
      const newSpecs = { ...prev.specifications };
      delete newSpecs[key];
      return { ...prev, specifications: newSpecs };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      if (!formData.name.trim()) {
        throw new Error("Item name is required");
      }
      if (!formData.category.trim()) {
        throw new Error("Category is required");
      }
      if (!formData.priceUSD && !formData.priceIQD) {
        throw new Error("At least one price is required");
      }
      
      const dataToSave = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        images: formData.images,
        category: formData.category.trim(),
        priceUSD: parseFloat(formData.priceUSD) || 0,
        priceIQD: parseFloat(formData.priceIQD) || 0,
        showPrice: formData.showPrice,
        isVisible: formData.isVisible,
        unit: formData.unit,
        barcode: formData.barcode.trim(),
        specifications: formData.specifications,
      };
      
      if (isEditing) {
        await updateCatalogItem(item.id, dataToSave);
      } else {
        await createCatalogItem(dataToSave);
      }
      
      onSave();
    } catch (err) {
      console.error("Error saving item:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {isEditing ? "✏️ Edit Item" : "➕ New Catalog Item"}
          </h2>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>⚠️ {error}</div>}

          {/* Name */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Item Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              style={styles.input}
              required
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {/* Barcode */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Barcode</label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
              style={styles.input}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {/* Category */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Category *</label>
            <select
              name="category"
              value={formData.category || ""}
              onChange={handleCategoryChange}
              style={styles.select}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            >
              <option value="">Select a category</option>
              {categories && categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="add-new">➕ Add New</option>
            </select>
          </div>

          {showNewCategoryInput && (
            <div style={{display: 'flex', gap: '8px', marginTop: '-12px', marginBottom: '20px'}}>
              <input
                type="text"
                placeholder="New category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{...styles.input, flex: 1}}
              />
              <button
                type="button"
                onClick={handleAddNewCategory}
                style={{...styles.button, ...styles.buttonPrimary, padding: '8px 16px'}}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setShowNewCategoryInput(false); setNewCategory(""); }}
                style={{...styles.button, ...styles.buttonSecondary, padding: '8px 16px'}}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Prices */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Prices *</label>
            <div style={styles.priceRow}>
              <div>
                <label style={{...styles.label, fontSize: '12px', color: '#64748b'}}>USD</label>
                <input
                  type="number"
                  name="priceUSD"
                  value={formData.priceUSD}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  style={styles.input}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={{...styles.label, fontSize: '12px', color: '#64748b'}}>IQD</label>
                <input
                  type="number"
                  name="priceIQD"
                  value={formData.priceIQD}
                  onChange={handleChange}
                  step="1"
                  min="0"
                  style={styles.input}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Unit */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Unit</label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="piece">Piece</option>
              <option value="box">Box</option>
              <option value="pack">Pack</option>
              <option value="bottle">Bottle</option>
              <option value="kg">Kilogram</option>
              <option value="g">Gram</option>
              <option value="liter">Liter</option>
              <option value="ml">Milliliter</option>
            </select>
          </div>

          {/* Images */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Images</label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              style={{display: 'none'}}
            />
            <div 
              style={styles.imageUpload}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.target.style.borderColor = '#3b82f6'; }}
              onDragLeave={(e) => { e.preventDefault(); e.target.style.borderColor = '#e2e8f0'; }}
              onDrop={(e) => {
                e.preventDefault();
                e.target.style.borderColor = '#e2e8f0';
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                  const fakeEvent = { target: { files } };
                  handleImageUpload(fakeEvent);
                }
              }}
            >
              {uploadingImages ? (
                <div>⏳ Uploading...</div>
              ) : (
                <>
                  <div style={{fontSize: '32px'}}>📷</div>
                  <div style={{fontWeight: '500'}}>Click or drag to upload images</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>PNG, JPG, GIF up to 5MB each</div>
                </>
              )}
            </div>
            
            {imagePreviews.length > 0 && (
              <div style={styles.imageGrid}>
                {imagePreviews.map((preview, index) => (
                  <div key={index} style={styles.imageItem}>
                    <img src={preview} alt={`Image ${index + 1}`} style={styles.imagePreview} />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      style={styles.removeImage}
                      onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                      onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.9)'}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              style={styles.textarea}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {/* Specifications */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Specifications</label>
            <div style={styles.specRow}>
              <input
                type="text"
                placeholder="Key"
                value={newSpecKey}
                onChange={(e) => setNewSpecKey(e.target.value)}
                style={{...styles.input, flex: 1}}
              />
              <input
                type="text"
                placeholder="Value"
                value={newSpecValue}
                onChange={(e) => setNewSpecValue(e.target.value)}
                style={{...styles.input, flex: 1}}
              />
              <button
                type="button"
                onClick={handleAddSpec}
                style={{...styles.button, ...styles.buttonPrimary, padding: '8px 16px', flex: '0.5'}}
              >
                Add
              </button>
            </div>
            {Object.keys(formData.specifications).length > 0 && (
              <div style={styles.specList}>
                {Object.entries(formData.specifications).map(([key, value]) => (
                  <div key={key} style={styles.specItem}>
                    <span><strong>{key}:</strong> {value}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSpec(key)}
                      style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer'}}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div style={styles.formGroup}>
            <label style={{...styles.label, display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
              <input
                type="checkbox"
                name="showPrice"
                checked={formData.showPrice}
                onChange={handleChange}
                style={styles.checkbox}
              />
              Show price publicly
            </label>
            <label style={{...styles.label, display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
              <input
                type="checkbox"
                name="isVisible"
                checked={formData.isVisible}
                onChange={handleChange}
                style={styles.checkbox}
              />
              Visible in catalog
            </label>
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <button
              type="submit"
              disabled={loading || uploadingImages}
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...((loading || uploadingImages) ? styles.buttonDisabled : {}),
              }}
            >
              {loading ? "⏳ Saving..." : isEditing ? "💾 Update" : "➕ Create"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={styles.buttonSecondary}
              onMouseOver={(e) => e.target.style.backgroundColor = '#cbd5e1'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#e2e8f0'}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}