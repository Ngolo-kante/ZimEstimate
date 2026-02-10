export default function StyleGuidePage() {
  return (
    <main className="ds-page">
      <header className="ds-hero">
        <div>
          <h1>Component Style Guide</h1>
          <p>
            Token-driven UI building blocks for ZimEstimate. Use these primitives to
            keep buttons, cards, inputs, and tables consistent across the app.
          </p>
        </div>
        <div className="ds-surface">
          <div className="ds-card-meta">
            <span>Tokens</span>
            <span>v1 · Feb 10, 2026</span>
          </div>
          <p>
            Built on the Design Direction Draft with electric blue accents, deep navy
            foundations, and data-forward layouts.
          </p>
        </div>
      </header>

      <section className="ds-section">
        <h2>Buttons</h2>
        <p>Primary actions, secondary utilities, and destructive states.</p>
        <div className="ds-row">
          <button className="ds-btn ds-btn--primary">Primary</button>
          <button className="ds-btn ds-btn--secondary">Secondary</button>
          <button className="ds-btn ds-btn--ghost">Ghost</button>
          <button className="ds-btn ds-btn--danger">Danger</button>
          <button className="ds-btn ds-btn--primary" disabled>
            Disabled
          </button>
        </div>
        <div className="ds-row" style={{ marginTop: "var(--space-4)" }}>
          <button className="ds-btn ds-btn--primary ds-btn--sm">Small</button>
          <button className="ds-btn ds-btn--primary">Medium</button>
          <button className="ds-btn ds-btn--primary ds-btn--lg">Large</button>
        </div>
      </section>

      <section className="ds-section">
        <h2>Cards</h2>
        <p>Data surfaces with consistent padding, radius, and shadow.</p>
        <div className="ds-grid ds-grid-3">
          <article className="ds-card">
            <div className="ds-card-meta">
              <span>Project</span>
              <span>Draft</span>
            </div>
            <h3>Hillcrest Duplex</h3>
            <p>Bulawayo · 2 floors · 240 sqm</p>
            <div className="ds-card-actions">
              <button className="ds-btn ds-btn--secondary ds-btn--sm">View</button>
              <button className="ds-btn ds-btn--primary ds-btn--sm">Edit</button>
            </div>
          </article>
          <article className="ds-card">
            <div className="ds-card-meta">
              <span>Procurement</span>
              <span>3 RFQs</span>
            </div>
            <h3>Material Requests</h3>
            <p>Track suppliers, compare quotes, and accept bids.</p>
            <div className="ds-card-actions">
              <button className="ds-btn ds-btn--secondary ds-btn--sm">Review</button>
            </div>
          </article>
          <article className="ds-card">
            <div className="ds-card-meta">
              <span>Budget</span>
              <span>USD</span>
            </div>
            <h3>Spend Snapshot</h3>
            <p>Budget remaining: $32,450 · Variance: -4.8%</p>
            <div className="ds-card-actions">
              <button className="ds-btn ds-btn--ghost ds-btn--sm">Details</button>
            </div>
          </article>
        </div>
      </section>

      <section className="ds-section">
        <h2>Inputs</h2>
        <p>Form fields for data entry, filters, and settings.</p>
        <div className="ds-grid ds-grid-2">
          <div className="ds-field">
            <label className="ds-label" htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              className="ds-input"
              placeholder="e.g. Sunrise Extension"
            />
            <span className="ds-helper">Required for all new projects.</span>
          </div>
          <div className="ds-field">
            <label className="ds-label" htmlFor="scope">Project scope</label>
            <select id="scope" className="ds-select" defaultValue="entire_house">
              <option value="entire_house">Entire house</option>
              <option value="extension">Extension</option>
              <option value="renovation">Renovation</option>
            </select>
            <span className="ds-helper">Used to preload material stages.</span>
          </div>
          <div className="ds-field">
            <label className="ds-label" htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              className="ds-textarea"
              placeholder="Capture site constraints or supplier notes."
            />
            <span className="ds-helper">Optional. Visible to your team only.</span>
          </div>
          <div className="ds-field">
            <label className="ds-label" htmlFor="budget">Target budget</label>
            <input
              id="budget"
              className="ds-input"
              placeholder="$0.00"
            />
            <span className="ds-helper ds-error">Budget must be greater than zero.</span>
          </div>
        </div>
      </section>

      <section className="ds-section">
        <h2>Tables</h2>
        <p>Dense information with clear hierarchy and hover states.</p>
        <div className="ds-surface">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Supplier</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Price (USD)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Hollow core blocks</td>
                <td>Chinhoyi Materials</td>
                <td>1,200</td>
                <td>pcs</td>
                <td>$0.85</td>
              </tr>
              <tr>
                <td>Portland cement</td>
                <td>BuildPro</td>
                <td>150</td>
                <td>bags</td>
                <td>$10.40</td>
              </tr>
              <tr>
                <td>Reinforcement steel</td>
                <td>Masvingo Steel</td>
                <td>2.4</td>
                <td>tons</td>
                <td>$890.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
