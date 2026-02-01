
const WizardStyles = () => (
  <style jsx global>{`
    /* Global & Wizard Styles */
    .boq-wizard-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }

    .wizard-progress {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 48px;
      gap: 0;
      width: 100%;
    }

    .step-wrapper {
      display: flex;
      align-items: center;
    }

    .step-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      position: relative;
      z-index: 2;
      min-width: 80px;
      opacity: 0.6;
      transition: all 0.3s ease;
    }

    .step-item.active {
      opacity: 1;
    }

    .step-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--color-surface);
      border: 2px solid var(--color-border);
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1rem;
      transition: all 0.3s ease;
    }

    .step-item.active .step-circle {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: var(--color-text-inverse);
      box-shadow: 0 0 0 4px rgba(78, 154, 247, 0.2);
    }

    .step-item span {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-secondary);
    }

    .step-item.active span {
      color: var(--color-accent-dark);
    }

    .step-line {
      position: relative;
      top: -14px;
      width: 60px;
      height: 3px;
      background: var(--color-border);
      margin: 0 8px;
      z-index: 1;
    }

    @media (max-width: 640px) {
      .step-line { width: 30px; }
      .step-item { min-width: 60px; }
      .step-circle { width: 32px; height: 32px; font-size: 0.875rem; }
    }

    .step-line.active {
      background: var(--color-accent);
    }

    .wizard-step {
      animation: fadeIn 0.4s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .step-header {
      text-align: center;
      margin-bottom: 40px;
    }

    .step-header h2 {
      font-size: 2rem;
      font-weight: 800;
      color: var(--color-primary);
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }

    .step-header p {
      font-size: 1.125rem;
      color: var(--color-text-secondary);
    }

    .wizard-card {
      background: var(--color-surface);
      border-radius: 16px;
      border: 1px solid var(--color-border);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .wizard-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .wizard-hint {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      margin-top: 6px;
    }

    .wizard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    @media (max-width: 768px) {
      .wizard-grid { grid-template-columns: 1fr; }
    }

    .select-wrapper {
      position: relative;
    }

    .wizard-select {
      width: 100%;
      padding: 12px 16px;
      font-size: 1rem;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text);
      appearance: none;
      outline: none;
      transition: border 0.2s ease;
    }

    .wizard-select:focus {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 2px rgba(78, 154, 247, 0.1);
    }

    .select-icon {
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--color-text-muted);
    }

    .wizard-actions {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--color-border-light);
    }

    .scope-selection {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }
    @media (max-width: 640px) {
      .scope-selection { grid-template-columns: 1fr; }
    }

    .scope-card {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      gap: 16px;
      padding: 24px;
      background: var(--color-surface);
      border: 2px solid var(--color-border);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }

    .scope-card:hover {
      border-color: var(--color-accent-light);
      background: #EEF5FC;
    }
    
    .scope-card.selected {
      border-color: var(--color-accent);
      background: #EEF5FC;
    }

    .scope-icon {
      color: var(--color-text-muted);
      min-width: 32px;
    }
    
    .scope-card.selected .scope-icon {
      color: var(--color-accent);
    }

    .scope-content h3 {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--color-primary);
      margin-bottom: 4px;
    }

    .scope-content p {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .check-icon {
      position: absolute;
      top: 24px;
      right: 24px;
      color: var(--color-accent);
    }

    /* Stage Grid Styles */
    .stage-selector-container {
      background: var(--color-background);
      padding: 24px;
      border-radius: 12px;
      border: 1px solid var(--color-border);
    }

    .stage-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }

    .stage-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      cursor: pointer;
      gap: 12px;
      transition: all 0.2s ease;
      position: relative;
    }

    .stage-card:hover {
      border-color: var(--color-accent);
    }

    .stage-card.selected {
      border-color: var(--color-accent);
      background: #EEF5FC;
      box-shadow: 0 4px 6px -1px rgba(78, 154, 247, 0.1);
    }
    
    .stage-icon {
      color: var(--color-text-muted);
    }
    .stage-card.selected .stage-icon {
      color: var(--color-accent);
    }

    .stage-card span {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-primary);
    }

    .stage-check {
      position: absolute;
      top: 8px;
      right: 8px;
      color: var(--color-accent);
    }

    /* Builder (Step 4) & Common */
    .boq-builder {
      max-width: 900px;
      margin: 0 auto;
    }

    .builder-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    .builder-header h1 {
      font-size: 2rem;
      font-weight: 700;
      color: var(--color-primary);
      margin: 0 0 8px 0;
      line-height: 1.2;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .project-details-card {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      border-radius: 16px;
      margin-bottom: 24px;
    }

    .total-card {
      background: var(--color-surface);
      border: 1px solid var(--color-accent);
      border-radius: 16px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(78, 154, 247, 0.1);
    }
    
    .total-grid {
      display: grid;
      grid-template-columns: 1fr 1px 1fr;
      gap: 24px;
      align-items: center;
    }
    @media (max-width: 768px) {
      .total-grid { grid-template-columns: 1fr; }
    }

    .total-main {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .total-label {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .total-value {
      font-size: 2rem;
      font-weight: 800;
      color: var(--color-primary-dark);
    }
    
    .qty-warning {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 8px;
      background: #FEF3C7;
      color: #92400E;
      font-size: 0.75rem;
      border-radius: 4px;
      font-weight: 500;
    }
    
    .total-breakdown {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .breakdown-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
    }
    
    .breakdown-label { color: var(--color-text-secondary); }
    .breakdown-value { font-weight: 600; color: var(--color-text); }

    /* Milestone Cards */
    .milestone-card {
      border: 1px solid var(--color-border);
      border-radius: 12px;
      margin-bottom: 16px;
      overflow: hidden;
      transition: all 0.2s ease;
      background: var(--color-surface);
    }
    
    .milestone-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      cursor: pointer;
      background: var(--color-surface);
    }
    
    .milestone-header:hover { background: var(--color-background); }
    
    .milestone-icon {
      width: 40px;
      height: 40px;
      background: var(--color-background);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary);
    }
    
    .milestone-info { flex: 1; }
    .milestone-info h3 { font-size: 1rem; font-weight: 600; margin: 0; color: var(--color-text); }
    .milestone-info p { font-size: 0.875rem; color: var(--color-text-secondary); margin: 0; }
    
    .milestone-summary {
      text-align: right;
      margin-right: 16px;
    }
    
    .item-count { display: block; font-size: 0.75rem; color: var(--color-text-secondary); }
    .milestone-total { font-weight: 600; color: var(--color-primary-light); }
    
    .expand-btn {
      background: none;
      border: none;
      color: var(--color-text-muted);
    }

    .milestone-content {
      border-top: 1px solid var(--color-border);
      padding: 16px;
      background: #FAFAFA;
    }
    
    .ai-generate-btn {
      width: 100%;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #F0F9FF; /* Light Blue */
      border: 1px dashed #3B82F6;
      border-radius: 8px;
      color: #2563EB;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .ai-generate-btn:hover { background: #DBEAFE; }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .materials-list { display: flex; flex-direction: column; gap: 8px; }
    
    .material-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr auto;
      gap: 16px;
      align-items: center;
      background: white;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--color-border-light);
    }
    
    .material-info { display: flex; flex-direction: column; }
    .material-name { font-weight: 500; color: var(--color-text); font-size: 0.9375rem; }
    .material-desc { font-size: 0.75rem; color: var(--color-text-muted); }
    .material-unit-price { font-size: 0.75rem; color: var(--color-text-secondary); }
    
    .qty-display {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      font-size: 0.875rem;
      color: var(--color-text);
      cursor: pointer;
      width: fit-content;
    }
    
    .qty-display:hover { border-color: var(--color-accent); }
    
    .qty-display.empty {
      background: #EEF5FC;
      color: var(--color-accent-dark);
      border-color: var(--color-accent);
      border-style: dashed;
    }
    
    .qty-edit { display: flex; gap: 4px; }
    .qty-edit input {
      width: 80px;
      padding: 6px 8px;
      border: 1px solid var(--color-accent);
      border-radius: 6px;
      font-size: 0.8125rem;
      outline: none;
    }
    .qty-edit button {
      padding: 6px;
      background: var(--color-background);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      color: var(--color-text-secondary);
    }
    
    .material-total { font-weight: 600; font-size: 0.875rem; color: var(--color-text); text-align: right; }
    .remove-btn { padding: 8px; background: none; border: none; cursor: pointer; color: var(--color-text-muted); }
    .remove-btn:hover { color: var(--color-error); }
    
    .add-material-form {
      background: var(--color-surface);
      border-radius: 12px;
      padding: 16px;
      margin-top: 16px;
      border: 1px solid var(--color-border);
    }
    
    .form-row { display: flex; gap: 12px; align-items: flex-end; }
    .form-field.material-field { flex: 1; }
    .form-field.qty-field { width: 140px; }
    .form-field input { padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; outline: none; }
    .form-field input:focus { border-color: var(--color-accent); }
    
    .add-material-actions { display: flex; gap: 8px; margin-top: 16px; }

    @media (max-width: 768px) {
      .material-row { grid-template-columns: 1fr; gap: 8px; }
      .form-row { flex-direction: column; }
      .qty-field { width: 100%; }
    }

    /* Step Progress Bar (for Step 4 BOQ Builder) */
    .step-progress-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 0 32px 0;
      margin-bottom: 24px;
      background: var(--color-surface);
      border-radius: 12px;
      border: 1px solid var(--color-border-light);
    }

    .step-progress-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      min-width: 80px;
    }

    .step-node {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--color-border-light);
      border: 2px solid var(--color-border);
      color: var(--color-text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
      transition: all 0.3s ease;
      z-index: 2;
    }

    .step-node.active {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: white;
    }

    .step-node.completed {
      background: var(--color-success, #22C55E);
      border-color: var(--color-success, #22C55E);
      color: white;
    }

    .step-progress-item .step-label {
      margin-top: 8px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
    }

    .step-progress-item .step-label.active {
      color: var(--color-accent-dark);
    }

    .step-connector {
      position: absolute;
      top: 16px;
      left: 50%;
      width: 80px;
      height: 3px;
      background: var(--color-border);
      z-index: 1;
    }

    .step-connector.active {
      background: var(--color-success, #22C55E);
    }

    @media (max-width: 640px) {
      .step-progress-bar { padding: 16px 8px 24px 8px; }
      .step-progress-item { min-width: 60px; }
      .step-node { width: 28px; height: 28px; font-size: 0.75rem; }
      .step-connector { width: 50px; }
    }

    /* Currency Toggle Bar */
    .currency-toggle-bar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 12px 16px;
      background: var(--color-background);
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .currency-label {
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
      font-weight: 500;
    }

    .currency-toggle-group {
      display: flex;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      overflow: hidden;
    }

    .currency-btn {
      padding: 8px 16px;
      font-size: 0.8125rem;
      font-weight: 600;
      background: transparent;
      border: none;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .currency-btn:first-child {
      border-right: 1px solid var(--color-border);
    }

    .currency-btn.active {
      background: var(--color-accent);
      color: white;
    }

    .currency-btn:hover:not(.active) {
      background: var(--color-border-light);
    }

    .currency-symbol {
      font-weight: 700;
    }

    /* Grand Total Section */
    .grand-total-section {
      margin-top: 32px;
      padding-bottom: 100px; /* Space for floating bar */
    }

    /* Floating Summary Bar */
    .floating-summary-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-top: 1px solid var(--color-border);
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
      z-index: 100;
      padding: 12px 24px;
    }

    .floating-summary-content {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .floating-summary-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .floating-total {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-primary);
    }

    .floating-items {
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
      padding-left: 12px;
      border-left: 1px solid var(--color-border);
    }

    @media (max-width: 640px) {
      .floating-summary-bar { padding: 10px 16px; }
      .floating-total { font-size: 1rem; }
      .floating-items { display: none; }
    }

    /* AI Suggest Button - Indigo Theme */
    .ai-suggest-btn {
      color: #6366F1 !important;
      border-color: #6366F1 !important;
    }

    .ai-suggest-btn:hover {
      background: rgba(99, 102, 241, 0.1) !important;
    }

    .ai-suggest-btn svg {
      color: #6366F1 !important;
    }

    /* Material Dropdown Container Fix */
    .add-material-form,
    .milestone-content {
      position: relative;
      overflow: visible !important;
    }

    /* Modernization Polish */
    .wizard-card {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
    }

    .scope-card,
    .stage-card,
    .milestone-card {
      transition: all 0.25s ease;
    }

    .scope-card:hover,
    .stage-card:hover {
      transform: translateY(-2px);
    }

    /* Custom Scrollbar */
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out forwards;
    }
  `}</style>
);
export default WizardStyles;
