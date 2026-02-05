'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  Circle,
  TrendUp,
  TrendDown,
  Minus,
  ShoppingCart,
} from '@phosphor-icons/react';
import { useCurrency } from './CurrencyToggle';
import { BOQItem } from '@/lib/database.types';

interface PurchaseTrackerProps {
  item: BOQItem;
  onUpdate: (itemId: string, updates: {
    actual_quantity?: number | null;
    actual_price_usd?: number | null;
    is_purchased?: boolean;
    purchased_date?: string | null;
  }) => void;
  onPurchase?: () => void; // Callback for purchase celebration
}

export default function PurchaseTracker({ item, onUpdate, onPurchase }: PurchaseTrackerProps) {
  const { formatPrice, exchangeRate } = useCurrency();
  const [isEditing, setIsEditing] = useState(false);
  const [actualQty, setActualQty] = useState(item.actual_quantity?.toString() || '');
  const [actualPrice, setActualPrice] = useState(item.actual_price_usd?.toString() || '');
  const [showConfetti, setShowConfetti] = useState(false);

  const [confettiPieces, setConfettiPieces] = useState<Array<{ left: string, animationDelay: string, backgroundColor: string }>>([]);

  // Generate confetti styles on client-side only to avoid hydration mismatch
  useEffect(() => {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    // eslint-disable-next-line
    setConfettiPieces([...Array(30)].map(() => ({
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 0.5}s`,
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
    })));
  }, []);

  const isPurchased = item.is_purchased;
  const hasActualData = item.actual_quantity !== null || item.actual_price_usd !== null;

  // Calculate variance
  const estimatedTotal = item.quantity * item.unit_price_usd;
  const actualTotal = (item.actual_quantity || item.quantity) * (item.actual_price_usd || item.unit_price_usd);
  const variance = hasActualData ? actualTotal - estimatedTotal : 0;
  const variancePercent = estimatedTotal > 0 ? (variance / estimatedTotal) * 100 : 0;

  const handleSave = () => {
    onUpdate(item.id, {
      actual_quantity: actualQty ? parseFloat(actualQty) : null,
      actual_price_usd: actualPrice ? parseFloat(actualPrice) : null,
      is_purchased: true,
      purchased_date: new Date().toISOString(),
    });
    setIsEditing(false);

    // Trigger confetti celebration
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2500);
    onPurchase?.();
  };

  const handleMarkPurchased = () => {
    if (!isPurchased) {
      setIsEditing(true);
    } else {
      // Unmark as purchased
      onUpdate(item.id, {
        is_purchased: false,
        actual_quantity: null,
        actual_price_usd: null,
        purchased_date: null,
      });
    }
  };

  const handleCancel = () => {
    setActualQty(item.actual_quantity?.toString() || '');
    setActualPrice(item.actual_price_usd?.toString() || '');
    setIsEditing(false);
  };

  return (
    <div className={`purchase-tracker ${isPurchased ? 'purchased' : ''}`}>
      {/* Confetti celebration */}
      {showConfetti && (
        <div className="confetti-container">
          {confettiPieces.map((style, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={style}
            />
          ))}
        </div>
      )}
      <div className="tracker-main">
        <button
          className={`status-btn ${isPurchased ? 'checked' : ''}`}
          onClick={handleMarkPurchased}
          title={isPurchased ? 'Mark as not purchased' : 'Mark as purchased'}
        >
          {isPurchased ? (
            <CheckCircle size={24} weight="fill" />
          ) : (
            <Circle size={24} weight="regular" />
          )}
        </button>

        <div className="item-info">
          <span className={`item-name ${isPurchased ? 'purchased' : ''}`}>
            {item.material_name}
          </span>
          <div className="item-details">
            <span className="estimated">
              Est: {item.quantity} {item.unit} @ {formatPrice(item.unit_price_usd, item.unit_price_zwg)}
            </span>
            {hasActualData && (
              <span className="actual">
                Actual: {item.actual_quantity || item.quantity} {item.unit} @ {formatPrice(item.actual_price_usd || item.unit_price_usd, (item.actual_price_usd || item.unit_price_usd) * exchangeRate)}
              </span>
            )}
          </div>
        </div>

        <div className="tracker-right">
          {hasActualData && (
            <div className={`variance ${variance > 0 ? 'over' : variance < 0 ? 'under' : 'on'}`}>
              {variance > 0 ? (
                <TrendUp size={16} weight="bold" />
              ) : variance < 0 ? (
                <TrendDown size={16} weight="bold" />
              ) : (
                <Minus size={16} weight="bold" />
              )}
              <span>
                {variance > 0 ? '+' : ''}{formatPrice(variance, variance * exchangeRate)}
                <small>({variancePercent > 0 ? '+' : ''}{variancePercent.toFixed(0)}%)</small>
              </span>
            </div>
          )}

          {!isEditing && isPurchased && (
            <button className="edit-btn" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="edit-panel">
          <div className="edit-header">
            <ShoppingCart size={18} weight="light" />
            <span>Enter actual purchase details</span>
          </div>
          <div className="edit-fields">
            <div className="field">
              <label>Actual Quantity</label>
              <div className="input-group">
                <input
                  type="number"
                  value={actualQty}
                  onChange={(e) => setActualQty(e.target.value)}
                  placeholder={item.quantity.toString()}
                  min="0"
                  step="0.01"
                />
                <span className="unit">{item.unit}</span>
              </div>
            </div>
            <div className="field">
              <label>Actual Price (USD)</label>
              <div className="input-group">
                <span className="prefix">$</span>
                <input
                  type="number"
                  value={actualPrice}
                  onChange={(e) => setActualPrice(e.target.value)}
                  placeholder={item.unit_price_usd.toString()}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          <div className="edit-actions">
            <button className="cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
            <button className="save-btn" onClick={handleSave}>
              Save & Mark Purchased
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .purchase-tracker {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          padding: var(--spacing-md);
          transition: all 0.2s ease;
        }

        .purchase-tracker:hover {
          border-color: var(--color-border);
        }

        .purchase-tracker.purchased {
          background: var(--color-success-bg, rgba(16, 185, 129, 0.05));
          border-color: var(--color-success);
        }

        .tracker-main {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .status-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: var(--color-border);
          transition: all 0.2s ease;
        }

        .status-btn:hover {
          color: var(--color-accent);
        }

        .status-btn.checked {
          color: var(--color-success);
        }

        .item-info {
          flex: 1;
          min-width: 0;
        }

        .item-name {
          font-weight: 500;
          color: var(--color-text);
          display: block;
        }

        .item-name.purchased {
          text-decoration: line-through;
          color: var(--color-text-secondary);
        }

        .item-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 4px;
        }

        .estimated, .actual {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .actual {
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        .tracker-right {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .variance {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .variance.over {
          background: var(--color-error-bg, rgba(239, 68, 68, 0.1));
          color: var(--color-error);
        }

        .variance.under {
          background: var(--color-success-bg, rgba(16, 185, 129, 0.1));
          color: var(--color-success);
        }

        .variance.on {
          background: var(--color-border-light);
          color: var(--color-text-secondary);
        }

        .variance small {
          margin-left: 4px;
          opacity: 0.8;
        }

        .edit-btn {
          padding: 6px 12px;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .edit-btn:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .edit-panel {
          margin-top: var(--spacing-md);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--color-border-light);
        }

        .edit-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-bottom: var(--spacing-md);
        }

        .edit-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .input-group {
          display: flex;
          align-items: center;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }

        .input-group input {
          flex: 1;
          border: none;
          padding: var(--spacing-sm);
          font-size: 0.875rem;
          outline: none;
          background: transparent;
        }

        .input-group .prefix,
        .input-group .unit {
          padding: var(--spacing-sm);
          background: var(--color-border-light);
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-sm);
          margin-top: var(--spacing-md);
        }

        .cancel-btn,
        .save-btn {
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-sm);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-btn {
          background: none;
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
        }

        .cancel-btn:hover {
          background: var(--color-background);
        }

        .save-btn {
          background: var(--color-success);
          border: none;
          color: white;
        }

        .save-btn:hover {
          background: var(--color-success-dark, #059669);
        }

        @media (max-width: 640px) {
          .edit-fields {
            grid-template-columns: 1fr;
          }

          .tracker-main {
            flex-wrap: wrap;
          }
        }

        /* Confetti Animation */
        .confetti-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
          z-index: 100;
        }

        .confetti-piece {
          position: absolute;
          width: 10px;
          height: 10px;
          top: -10px;
          animation: confetti-fall 2.5s ease-out forwards;
        }

        .confetti-piece:nth-child(odd) {
          border-radius: 50%;
        }

        .confetti-piece:nth-child(even) {
          transform: rotate(45deg);
        }

        @keyframes confetti-fall {
          0% {
            top: -10px;
            opacity: 1;
            transform: translateX(0) rotate(0deg);
          }
          100% {
            top: 100%;
            opacity: 0;
            transform: translateX(calc(-50px + 100px * var(--random, 0.5))) rotate(720deg);
          }
        }

        .purchase-tracker {
          position: relative;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
