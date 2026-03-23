'use client';

interface ContractorMarkupProps {
  markupPct: number;
  subtotalUsd: number;
  currency: 'USD' | 'ZWG';
  zwgRate: number;
  onChange: (pct: number) => void;
}

export default function ContractorMarkup({ markupPct, subtotalUsd, currency, zwgRate, onChange }: ContractorMarkupProps) {
  const sym = currency === 'ZWG' ? 'ZWG' : '$';
  const markupUsd = subtotalUsd * (markupPct / 100);
  const markupDisplay = currency === 'ZWG' ? markupUsd * zwgRate : markupUsd;

  return (
    <div className="markup-section">
      <div className="markup-section__header">
        <span className="markup-section__title">Contractor Markup</span>
        <span className="markup-section__badge">Contractor only</span>
      </div>
      <p className="markup-section__hint">
        This markup is only visible to you. Use &quot;Client view&quot; to share the BOQ without markup details.
      </p>
      <div className="markup-row">
        <label>Markup percentage</label>
        <div className="markup-input-group">
          <input
            type="number"
            className="markup-input"
            value={markupPct}
            min={0} max={100} step={1}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          />
          <span>%</span>
        </div>
        {markupPct > 0 && (
          <span className="markup-value">
            + {sym} {markupDisplay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
}
