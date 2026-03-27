'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Gear, Check } from '@phosphor-icons/react';

export default function AdminSettingsPage() {
  const { checking } = useAdminAuth();
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    platformName: 'ZimEstimate',
    supportEmail: 'support@zimestimate.co.zw',
    defaultCurrency: 'USD',
    allowRegistrations: true,
    requireEmailVerification: true,
    maintenanceMode: false,
    scraperEnabled: true,
    scraperFrequencyHours: 24,
    maxFreeProjects: 3,
    basicMonthlyUSD: 19,
    proMonthlyUSD: 49,
    enterpriseMonthlyUSD: 149,
    featuredSlots: 5,
    commissionPct: 5,
  });

  if (checking) return <div className="admin-loading">Loading...</div>;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (key: string, val: string | number | boolean) =>
    setSettings(prev => ({ ...prev, [key]: val }));

  return (
    <div className="admin-page">
      <div className="page-header">
        <div className="header-left">
          <Gear size={22} weight="duotone" className="page-icon" />
          <div>
            <h1>System Settings</h1>
            <p>Platform-wide configuration and feature toggles</p>
          </div>
        </div>
        <button className={`btn-save ${saved ? 'saved' : ''}`} onClick={handleSave}>
          {saved ? <><Check size={15} /> Saved</> : 'Save Changes'}
        </button>
      </div>

      <div className="settings-grid">
        <div className="settings-section">
          <div className="section-title">General</div>
          <div className="field-group">
            <label>Platform Name</label>
            <input className="text-input" value={settings.platformName} onChange={e => set('platformName', e.target.value)} />
          </div>
          <div className="field-group">
            <label>Support Email</label>
            <input className="text-input" type="email" value={settings.supportEmail} onChange={e => set('supportEmail', e.target.value)} />
          </div>
          <div className="field-group">
            <label>Default Currency</label>
            <select className="select-input" value={settings.defaultCurrency} onChange={e => set('defaultCurrency', e.target.value)}>
              <option>USD</option>
              <option>ZWL</option>
            </select>
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Allow New Registrations</div>
              <div className="toggle-desc">When off, only existing users can log in</div>
            </div>
            <button className={`toggle ${settings.allowRegistrations ? 'on' : 'off'}`} onClick={() => set('allowRegistrations', !settings.allowRegistrations)} />
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Require Email Verification</div>
              <div className="toggle-desc">New accounts must verify email before access</div>
            </div>
            <button className={`toggle ${settings.requireEmailVerification ? 'on' : 'off'}`} onClick={() => set('requireEmailVerification', !settings.requireEmailVerification)} />
          </div>
          <div className="toggle-row danger">
            <div>
              <div className="toggle-label">Maintenance Mode</div>
              <div className="toggle-desc">Show maintenance page to all non-admin visitors</div>
            </div>
            <button className={`toggle ${settings.maintenanceMode ? 'on' : 'off'}`} onClick={() => set('maintenanceMode', !settings.maintenanceMode)} />
          </div>
        </div>

        <div className="settings-section">
          <div className="section-title">Pricing Tiers (USD/month)</div>
          <div className="field-group">
            <label>Free Plan — Max Projects</label>
            <input className="text-input num" type="number" value={settings.maxFreeProjects} onChange={e => set('maxFreeProjects', Number(e.target.value))} />
          </div>
          <div className="field-group">
            <label>Basic Plan</label>
            <div className="input-prefix-wrap"><span className="prefix">$</span><input className="text-input num prefixed" type="number" value={settings.basicMonthlyUSD} onChange={e => set('basicMonthlyUSD', Number(e.target.value))} /></div>
          </div>
          <div className="field-group">
            <label>Pro Plan</label>
            <div className="input-prefix-wrap"><span className="prefix">$</span><input className="text-input num prefixed" type="number" value={settings.proMonthlyUSD} onChange={e => set('proMonthlyUSD', Number(e.target.value))} /></div>
          </div>
          <div className="field-group">
            <label>Enterprise Plan</label>
            <div className="input-prefix-wrap"><span className="prefix">$</span><input className="text-input num prefixed" type="number" value={settings.enterpriseMonthlyUSD} onChange={e => set('enterpriseMonthlyUSD', Number(e.target.value))} /></div>
          </div>

          <div className="section-title" style={{ marginTop: 24 }}>Marketplace</div>
          <div className="field-group">
            <label>Featured Supplier Slots</label>
            <input className="text-input num" type="number" value={settings.featuredSlots} onChange={e => set('featuredSlots', Number(e.target.value))} />
          </div>
          <div className="field-group">
            <label>Commission Rate (%)</label>
            <input className="text-input num" type="number" value={settings.commissionPct} onChange={e => set('commissionPct', Number(e.target.value))} />
          </div>

          <div className="section-title" style={{ marginTop: 24 }}>Scraper</div>
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Scraper Enabled</div>
              <div className="toggle-desc">Auto-collect material prices</div>
            </div>
            <button className={`toggle ${settings.scraperEnabled ? 'on' : 'off'}`} onClick={() => set('scraperEnabled', !settings.scraperEnabled)} />
          </div>
          <div className="field-group">
            <label>Run Every (hours)</label>
            <input className="text-input num" type="number" value={settings.scraperFrequencyHours} onChange={e => set('scraperFrequencyHours', Number(e.target.value))} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .admin-page { padding: 28px 32px; max-width: 1000px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .page-icon { color: #2563eb; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .btn-save { background: #2563eb; color: white; border: none; border-radius: 8px; padding: 9px 18px; font-size: 0.875rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s; }
        .btn-save.saved { background: #059669; }
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .settings-section { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
        .section-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; margin-bottom: -4px; }
        .field-group { display: flex; flex-direction: column; gap: 6px; }
        label { font-size: 0.8125rem; font-weight: 600; color: #374151; }
        .text-input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 0.875rem; color: #1e293b; outline: none; }
        .text-input:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(147, 197, 253, 0.2); }
        .text-input.num { width: 100px; }
        .select-input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 0.875rem; color: #1e293b; outline: none; background: white; }
        .input-prefix-wrap { display: flex; align-items: center; gap: 0; }
        .prefix { background: #f1f5f9; border: 1px solid #e2e8f0; border-right: none; border-radius: 8px 0 0 8px; padding: 8px 10px; font-size: 0.875rem; color: #64748b; }
        .text-input.prefixed { border-radius: 0 8px 8px 0; width: 80px; }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0; }
        .toggle-row.danger .toggle-label { color: #dc2626; }
        .toggle-label { font-size: 0.8125rem; font-weight: 600; color: #374151; }
        .toggle-desc { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
        .toggle { width: 40px; height: 22px; border-radius: 20px; border: none; cursor: pointer; position: relative; flex-shrink: 0; transition: background 0.2s; }
        .toggle::after { content: ''; position: absolute; top: 3px; width: 16px; height: 16px; background: white; border-radius: 50%; transition: left 0.2s; }
        .toggle.on { background: #2563eb; }
        .toggle.on::after { left: 21px; }
        .toggle.off { background: #cbd5e1; }
        .toggle.off::after { left: 3px; }
        .admin-loading { padding: 60px; text-align: center; color: #94a3b8; }
        @media (max-width: 768px) { .settings-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
