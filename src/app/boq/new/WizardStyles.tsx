
const WizardStyles = () => (
  <style jsx global>{`
    /* Global & Wizard Styles */
    .boq-wizard-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 0;
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

    /* Enhanced Step Header - Vision AI Style */
    .step-header {
      text-align: center;
      margin-bottom: var(--spacing-xl);
    }

    .step-header h2 {
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--color-text);
      margin: 0 0 var(--spacing-sm) 0;
      letter-spacing: -0.02em;
    }

    .step-header p {
      font-size: 1rem;
      color: var(--color-text-secondary);
      margin: 0;
      line-height: 1.6;
    }

    /* Enhanced Wizard Card - Vision AI Style */
    .wizard-card {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      padding: var(--spacing-xl);
    }

    /* Enhanced Form Group */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .wizard-label {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text);
    }

    .wizard-label svg {
      color: var(--color-text-secondary);
    }

    .wizard-hint {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-top: var(--spacing-xs);
    }

    .wizard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    @media (max-width: 768px) {
      .wizard-grid { grid-template-columns: 1fr; }
    }

    .wizard-card--stack {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xl);
    }

    .wizard-section {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-lg);
    }

    .wizard-section-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--spacing-md);
    }

    .wizard-section-header h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .wizard-section-header p {
      margin: 6px 0 0;
      font-size: 0.9rem;
      color: var(--color-text-secondary);
    }

    .section-kicker {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--color-text-muted);
      font-weight: 600;
      margin-bottom: 6px;
    }

    .wizard-divider {
      height: 1px;
      background: var(--color-border-light);
      border-radius: 999px;
    }

    .grid-span-2 {
      grid-column: 1 / -1;
    }

    .required {
      margin-left: 6px;
      font-size: 0.7rem;
      font-weight: 600;
      color: #ef4444;
    }

    .optional {
      margin-left: 6px;
      font-size: 0.7rem;
      font-weight: 500;
      color: var(--color-text-muted);
    }

    .pill-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .pill-grid--two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .pill-option {
      border: 1px solid var(--color-border);
      background: #fff;
      border-radius: 14px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--color-text);
    }

    .pill-option:hover {
      border-color: #93c5fd;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.12);
      transform: translateY(-1px);
    }

    .pill-option.selected {
      border-color: var(--color-primary);
      background: linear-gradient(135deg, rgba(226, 232, 255, 0.8), rgba(255, 255, 255, 1));
      box-shadow: 0 12px 26px rgba(37, 99, 235, 0.18);
    }

    .pill-icon {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: rgba(59, 130, 246, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #2563eb;
      flex-shrink: 0;
    }

    .pill-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .pill-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .pill-subtitle {
      font-size: 0.75rem;
      color: var(--color-text-secondary);
    }

    .input-with-suffix {
      position: relative;
    }

    .input-with-suffix .wizard-select {
      padding-right: 54px;
    }

    .input-suffix {
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text-muted);
    }

    .optional-rooms {
      margin-top: var(--spacing-lg);
      padding: var(--spacing-lg);
      border-radius: var(--radius-lg);
      border: 1px dashed var(--color-border);
      background: linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.9));
    }

    .optional-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-md);
    }

    .optional-header h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .optional-header p {
      margin: 6px 0 0;
      font-size: 0.85rem;
      color: var(--color-text-secondary);
    }

    .optional-chip {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      background: #fff;
      font-weight: 600;
      flex-shrink: 0;
    }

    .room-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .room-input {
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: all 0.2s ease;
    }

    .room-input label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      font-weight: 600;
    }

    .room-input input {
      border: none;
      outline: none;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--color-text);
      background: transparent;
    }

    .room-input input::placeholder {
      color: var(--color-text-muted);
      font-weight: 500;
    }

    .room-input:focus-within {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px var(--color-accent-bg);
    }

    @media (max-width: 900px) {
      .pill-grid { grid-template-columns: 1fr; }
      .pill-grid--two { grid-template-columns: 1fr; }
      .room-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 520px) {
      .room-grid { grid-template-columns: 1fr; }
    }

    .select-wrapper {
      position: relative;
    }

    /* Enhanced Inputs - Vision AI Style */
    .wizard-select {
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: 1rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      appearance: none;
      outline: none;
      transition: all 0.2s ease;
    }

    .wizard-select:focus {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px var(--color-accent-bg);
    }

    .wizard-select::placeholder {
      color: var(--color-text-muted);
    }

    .select-icon {
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--color-text-muted);
    }

    /* Enhanced Wizard Actions - Vision AI Style */
    .wizard-actions {
      display: flex;
      justify-content: space-between;
      gap: var(--spacing-md);
      margin-top: var(--spacing-xl);
      padding-top: var(--spacing-lg);
      border-top: 1px solid var(--color-border-light);
    }

    /* Enhanced Scope Selection - Vision AI Style */
    .scope-selection {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-lg);
      max-width: 700px;
      margin: 0 auto var(--spacing-xl) auto;
    }
    @media (max-width: 640px) {
      .scope-selection { grid-template-columns: 1fr; }
    }

    .scope-card {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      gap: var(--spacing-md);
      padding: var(--spacing-lg);
      background: var(--color-surface);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }

    .scope-card:hover {
      border-color: var(--color-accent-light);
      background: var(--color-accent-bg);
    }

    .scope-card.selected {
      border-color: var(--color-accent);
      background: var(--color-accent-bg);
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
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 4px;
    }

    .scope-content p {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin: 0;
    }

    .check-icon {
      position: absolute;
      top: var(--spacing-lg);
      right: var(--spacing-lg);
      color: var(--color-accent);
    }

    /* Enhanced Stage Grid - Vision AI Style */
    .stage-selector-container {
      background: var(--color-background);
      padding: var(--spacing-lg);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
      max-width: 700px;
      margin: 0 auto;
    }

    .stage-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: var(--spacing-md);
    }

    .stage-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--spacing-md);
      background: var(--color-surface);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      gap: var(--spacing-sm);
      transition: all 0.2s ease;
      position: relative;
    }

    .stage-card:hover {
      border-color: var(--color-accent);
      transform: translateY(-2px);
    }

    .stage-card.selected {
      border-color: var(--color-accent);
      background: var(--color-accent-bg);
      box-shadow: 0 4px 12px rgba(78, 154, 247, 0.15);
    }

    .stage-icon {
      color: var(--color-text-muted);
    }
    .stage-card.selected .stage-icon {
      color: var(--color-accent);
    }

    .stage-card span {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .stage-check {
      position: absolute;
      top: 8px;
      right: 8px;
      color: var(--color-accent);
    }

    /* Tips Section - Vision AI Style */
    .tips-section {
      margin-top: var(--spacing-xl);
      padding: var(--spacing-lg);
      background: var(--color-background);
      border-radius: var(--radius-lg);
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
    }

    .tips-section h3 {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-text);
      margin: 0 0 var(--spacing-md) 0;
    }

    .tips-section ul {
      margin: 0;
      padding-left: var(--spacing-lg);
    }

    .tips-section li {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      margin-bottom: var(--spacing-xs);
    }

    .tips-section li:last-child {
      margin-bottom: 0;
    }

    /* Builder (Step 4) & Common */
    .boq-builder {
      max-width: 960px;
      margin: 0 auto;
    }

    .builder-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-xl);
      padding-bottom: var(--spacing-lg);
      border-bottom: 1px solid var(--color-border-light);
    }

    .builder-header h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--color-text);
      margin: 0 0 var(--spacing-xs) 0;
      line-height: 1.2;
    }

    .builder-meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      font-size: 0.875rem;
      color: var(--color-text-secondary);
    }

    .meta-dot {
      color: var(--color-text-muted);
    }

    .builder-error {
      font-size: 0.75rem;
      color: var(--color-error);
      margin-top: var(--spacing-xs);
    }

    .header-actions {
      display: flex;
      gap: var(--spacing-sm);
      flex-shrink: 0;
    }

    /* Save Status Indicator */
    .save-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8125rem;
      font-weight: 500;
    }

    .save-status.saved {
      color: var(--color-success);
    }

    .save-status.saving {
      color: var(--color-accent);
    }

    .save-status.unsaved {
      color: var(--color-warning, #f59e0b);
    }

    .save-status svg {
      flex-shrink: 0;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .animate-pulse {
      animation: pulse 1.5s ease-in-out infinite;
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

    /* Milestone Cards - Vision AI Enhanced */
    .milestones-section {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .milestone-card {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: all 0.2s ease;
      background: var(--color-surface);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .milestone-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .milestone-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md) var(--spacing-lg);
      cursor: pointer;
      background: var(--color-surface);
      transition: background 0.15s ease;
    }

    .milestone-header:hover {
      background: var(--color-background);
    }

    .milestone-icon {
      width: 44px;
      height: 44px;
      background: var(--color-background);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-accent);
      flex-shrink: 0;
    }

    .milestone-info {
      flex: 1;
      min-width: 0;
    }

    .milestone-info h3 {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
      color: var(--color-text);
    }

    .milestone-info p {
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
      margin: var(--spacing-xs) 0 0 0;
    }

    .milestone-summary {
      text-align: right;
      margin-right: var(--spacing-md);
    }

    .item-count {
      display: block;
      font-size: 0.75rem;
      color: var(--color-text-secondary);
    }

    .milestone-total {
      font-weight: 700;
      font-size: 1rem;
      color: var(--color-text);
    }

    .expand-btn {
      background: none;
      border: none;
      color: var(--color-text-muted);
      transition: transform 0.2s ease;
    }

    .milestone-content {
      border-top: 1px solid var(--color-border-light);
      padding: var(--spacing-lg);
      background: var(--color-background);
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

    /* Price Update Banner */
    .price-update-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 18px 20px;
      margin: 12px 0 24px 0;
      border-radius: 16px;
      border: 1px solid #bae6fd;
      background: linear-gradient(135deg, rgba(224, 242, 254, 0.9), rgba(255, 255, 255, 0.95));
      box-shadow: 0 12px 24px rgba(14, 116, 144, 0.08);
    }

    .price-update-content {
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 1;
    }

    .price-update-text h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
    }

    .price-update-text p {
      margin: 6px 0 0;
      font-size: 0.85rem;
      color: #334155;
    }

    .price-update-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    @media (max-width: 900px) {
      .price-update-banner {
        flex-direction: column;
        align-items: flex-start;
      }

      .price-update-actions {
        width: 100%;
      }
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

    /* Save Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(2px);
    }

    .save-modal {
      background: white;
      border-radius: var(--radius-lg);
      padding: var(--spacing-xl);
      max-width: 420px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: modalSlideUp 0.3s ease;
    }

    @keyframes modalSlideUp {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .modal-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto var(--spacing-md);
      background: var(--color-accent-bg);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-accent);
    }

    .save-modal h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--color-text);
      margin: 0 0 var(--spacing-sm) 0;
    }

    .save-modal p {
      font-size: 0.9375rem;
      color: var(--color-text-secondary);
      margin: 0 0 var(--spacing-lg) 0;
      line-height: 1.5;
    }

    .modal-actions {
      display: flex;
      gap: var(--spacing-sm);
      justify-content: center;
      flex-wrap: wrap;
    }

    /* Dropdown Menus */
    .dropdown-container {
      position: relative;
    }

    .dropdown-menu {
      animation: dropdownFadeIn 0.2s ease;
    }

    @keyframes dropdownFadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dropdown-item:hover {
      background: #f8fafc !important;
    }

    .dropdown-item:active {
      background: #f1f5f9 !important;
    }
  `}</style>
);
export default WizardStyles;
