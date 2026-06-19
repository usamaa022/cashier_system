// components/CatalogCard.jsx
"use client";

import { useState } from "react";

export default function CatalogCard({ 
  item, 
  onEdit, 
  onToggleVisibility,
  onTogglePriceVisibility,
  showAllPrices 
}) {
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const images = item.images || [];
  const hasMultipleImages = images.length > 1;

  const styles = {
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      border: '1px solid rgba(0, 0, 0, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
      transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
      boxShadow: isHovered ? '0 12px 40px rgba(0, 0, 0, 0.12)' : '0 4px 20px rgba(0, 0, 0, 0.08)',
    },
    imageContainer: {
      position: 'relative',
      height: '220px',
      backgroundColor: '#f8fafc',
      overflow: 'hidden',
      cursor: 'pointer',
    },
    image: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transition: 'transform 0.3s ease',
    },
    imagePlaceholder: {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#94a3b8',
      fontSize: '48px',
      flexDirection: 'column',
      gap: '8px',
    },
    imageCounter: {
      position: 'absolute',
      bottom: '12px',
      right: '12px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: '#ffffff',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
      backdropFilter: 'blur(4px)',
    },
    imageDots: {
      position: 'absolute',
      bottom: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '6px',
    },
    dot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    },
    dotActive: {
      backgroundColor: '#ffffff',
      width: '20px',
      borderRadius: '4px',
    },
    dotInactive: {
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    navButton: {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      color: '#ffffff',
      border: 'none',
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      cursor: 'pointer',
      fontSize: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      backdropFilter: 'blur(4px)',
    },
    visibilityBadge: {
      position: 'absolute',
      top: '12px',
      right: '12px',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '600',
      color: '#ffffff',
      letterSpacing: '0.5px',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    content: {
      padding: '16px',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    name: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#0f172a',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      margin: 0,
    },
    category: {
      fontSize: '12px',
      color: '#64748b',
      backgroundColor: '#f1f5f9',
      padding: '4px 12px',
      borderRadius: '12px',
      display: 'inline-block',
      alignSelf: 'flex-start',
    },
    description: {
      fontSize: '13px',
      color: '#64748b',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      margin: '4px 0',
      lineHeight: '1.5',
    },
    prices: {
      display: 'flex',
      gap: '16px',
      padding: '8px 0',
      borderTop: '1px solid #f1f5f9',
      marginTop: '4px',
    },
    priceItem: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    },
    priceLabel: {
      fontSize: '10px',
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      fontWeight: '600',
    },
    priceValue: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#0f172a',
    },
    priceHidden: {
      fontSize: '14px',
      color: '#94a3b8',
      fontStyle: 'italic',
    },
    actions: {
      display: 'flex',
      gap: '8px',
      marginTop: '8px',
      paddingTop: '12px',
      borderTop: '1px solid #f1f5f9',
    },
    button: {
      flex: 1,
      padding: '8px 12px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '500',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    buttonEdit: {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
    },
    buttonPrice: {
      backgroundColor: '#8b5cf6',
      color: '#ffffff',
    },
    buttonVisibility: {
      backgroundColor: '#10b981',
      color: '#ffffff',
    },
  };

  const nextImage = (e) => {
    e.stopPropagation();
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = (e) => {
    e.stopPropagation();
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const currentImage = images.length > 0 ? images[currentImageIndex] : null;
  const showPrice = item.showPrice !== false && showAllPrices !== false;

  return (
    <div 
      style={styles.card}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Section */}
      <div style={styles.imageContainer}>
        {currentImage && !imageError ? (
          <img
            src={currentImage}
            alt={item.name}
            style={styles.image}
            onError={() => setImageError(true)}
          />
        ) : (
          <div style={styles.imagePlaceholder}>
            <span>📦</span>
            <span style={{fontSize: '12px'}}>No Image</span>
          </div>
        )}
        
        {/* Visibility Badge */}
        <div style={{
          ...styles.visibilityBadge,
          backgroundColor: item.isVisible ? 'rgba(16, 185, 129, 0.9)' : 'rgba(100, 116, 139, 0.9)',
        }}>
          {item.isVisible ? '● Visible' : '○ Hidden'}
        </div>

        {/* Image Navigation */}
        {hasMultipleImages && (
          <>
            <button style={{...styles.navButton, left: '8px'}} onClick={prevImage}>
              ‹
            </button>
            <button style={{...styles.navButton, right: '8px'}} onClick={nextImage}>
              ›
            </button>
            <div style={styles.imageDots}>
              {images.map((_, index) => (
                <button
                  key={index}
                  style={{
                    ...styles.dot,
                    ...(index === currentImageIndex ? styles.dotActive : styles.dotInactive),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                />
              ))}
            </div>
            <div style={styles.imageCounter}>
              {currentImageIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div style={styles.content}>
        <h3 style={styles.name}>{item.name}</h3>
        <span style={styles.category}>{item.category || 'Uncategorized'}</span>
        
        {item.description && (
          <p style={styles.description}>{item.description}</p>
        )}

        {/* Prices */}
        <div style={styles.prices}>
          <div style={styles.priceItem}>
            <span style={styles.priceLabel}>USD</span>
            {showPrice ? (
              <span style={styles.priceValue}>${Number(item.priceUSD || 0).toFixed(2)}</span>
            ) : (
              <span style={styles.priceHidden}>••••</span>
            )}
          </div>
          <div style={styles.priceItem}>
            <span style={styles.priceLabel}>IQD</span>
            {showPrice ? (
              <span style={styles.priceValue}>{Number(item.priceIQD || 0).toLocaleString()}</span>
            ) : (
              <span style={styles.priceHidden}>••••</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            onClick={() => onEdit(item)}
            style={{...styles.button, ...styles.buttonEdit}}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => onTogglePriceVisibility(item.id)}
            style={{...styles.button, ...styles.buttonPrice}}
            onMouseOver={(e) => e.target.style.backgroundColor = '#7c3aed'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#8b5cf6'}
          >
            {showPrice ? '🔒 Hide Price' : '🔓 Show Price'}
          </button>
          <button
            onClick={() => onToggleVisibility(item.id, item.isVisible)}
            style={{...styles.button, ...styles.buttonVisibility}}
            onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
          >
            {item.isVisible ? '👁️ Hide' : '👁️ Show'}
          </button>
        </div>
      </div>
    </div>
  );
}