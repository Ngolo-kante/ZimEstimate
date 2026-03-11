'use client';

import type { LaborConfig } from '@/lib/quick-projects/engine/types';

interface LaborSectionProps {
  labor: LaborConfig;
  materialsTotal: number;
  currency: 'USD' | 'ZWG';
  zwgRate: number;
  onChange: (l: LaborConfig) => void;
}

export default function LaborSection({ labor, materialsTotal, currency, zwgRate, onChange }: LaborSectionProps) {
  const sym = currency === 'ZWG' ? 'ZWG' : '$';
  const pct = labor.percentage ?? 25;
  const rate = labor.dailyRateUsd ?? 35;
  const days = labor.days ?? 5;
  const workers = labor.workerCount ?? 2;

  const laborCostUsd = labor.method === 'percentage'
    ? materialsTotal * (pct / 100)
    : rate * days * workers;

  const laborDisplay = currency === 'ZWG' ? laborCostUsd * zwgRate : laborCostUsd;

  return (
    <div className="labor-section">
      <div className="labor-section__header">
        <span className="labor-section__title">Labor</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={labor.enabled}
            onChange={(e) => onChange({ ...labor, enabled: e.target.checked })}
          />
          <span className="toggle-switch__track" />
          <span className="toggle-switch__label">{labor.enabled ? 'Included' : 'Excluded'}</span>
        </label>
      </div>

      {labor.enabled && (
        <div className="labor-section__body">
          {/* Method selector */}
          <div className="labor-method-tabs">
            <button
              type="button"
              className={`labor-tab ${labor.method === 'percentage' ? 'labor-tab--active' : ''}`}
              onClick={() => onChange({ ...labor, method: 'percentage' })}
            >
              % of materials
            </button>
            <button
              type="button"
              className={`labor-tab ${labor.method === 'daily_rate' ? 'labor-tab--active' : ''}`}
              onClick={() => onChange({ ...labor, method: 'daily_rate' })}
            >
              Daily rate
            </button>
          </div>

          {/* Percentage config */}
          {labor.method === 'percentage' && (
            <div className="labor-config-row">
              <label>Labor as % of materials</label>
              <div className="labor-input-group">
                <input
                  type="number"
                  className="labor-input"
                  value={pct}
                  min={1} max={100}
                  onChange={(e) => onChange({ ...labor, percentage: parseInt(e.target.value) || 25 })}
                />
                <span>%</span>
              </div>
              <span className="labor-calc">= {sym} {laborDisplay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Daily rate config */}
          {labor.method === 'daily_rate' && (
            <div className="labor-config-daily">
              <div className="labor-config-row">
                <label>Daily rate (USD)</label>
                <div className="labor-input-group">
                  <span>$</span>
                  <input
                    type="number"
                    className="labor-input"
                    value={rate}
                    min={1}
                    onChange={(e) => onChange({ ...labor, dailyRateUsd: parseFloat(e.target.value) || 35 })}
                  />
                  <span>/day/builder</span>
                </div>
              </div>
              <div className="labor-config-row">
                <label>Number of builders</label>
                <input
                  type="number"
                  className="labor-input"
                  value={workers}
                  min={1} max={20}
                  onChange={(e) => onChange({ ...labor, workerCount: parseInt(e.target.value) || 2 })}
                />
              </div>
              <div className="labor-config-row">
                <label>Working days</label>
                <input
                  type="number"
                  className="labor-input"
                  value={days}
                  min={1} max={365}
                  onChange={(e) => onChange({ ...labor, days: parseInt(e.target.value) || 5 })}
                />
              </div>
              <div className="labor-total-row">
                <span>Labor total</span>
                <strong>{sym} {laborDisplay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
