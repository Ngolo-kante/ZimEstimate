
const WizardStyles = () => (
  <style jsx global>{`
    /* Global & Wizard Styles */
    /* Animations */
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(20px) scale(0.95); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    .animate-slideIn { animation: slideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-float { animation: float 6s ease-in-out infinite; }

    .boq-wizard-container,
    .boq-builder {
      font-family: var(--font-body);
    }

    .wizard-shell {
      min-height: 100vh;
      background: var(--color-background);
      display: flex;
    }
    .wizard-shell.has-sidebar {
      padding-bottom: 0;
    }

    .wizard-sidebar-wrapper {
      position: sticky;
      top: 0;
      height: 100vh;
      flex-shrink: 0;
      z-index: 10;
    }

    .boq-wizard-container {
      flex: 1;
      width: 100%;
      max-width: 1920px;
      margin: 0 auto;
      padding: 0 32px 80px;
    }

    .wizard-shell.has-sidebar .boq-wizard-container {
      max-width: none;
      padding: 32px 56px 40px;
    }

    /* Main Content Layout - Full width when sidebar present */
    .wizard-content-split {
      display: block;
      min-height: 600px;
    }

    /* Without sidebar - use old split layout */
    .wizard-shell:not(.has-sidebar) .wizard-content-split {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 48px;
      align-items: start;
    }

    .wizard-form-area {
      background: var(--color-surface);
      border-radius: 24px;
      padding: 40px 48px;
      box-shadow: 0 16px 34px rgba(6, 20, 47, 0.08);
      border: 1px solid var(--color-border-light);
      width: 100%;
      max-width: 100%;
    }

    /* Full width form when sidebar is present */
    .wizard-shell.has-sidebar .wizard-form-area {
      max-width: 100%;
    }

    .wizard-summary-area {
      position: sticky;
      top: 40px;
      height: auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Hide summary area when sidebar is present */
    .wizard-shell.has-sidebar .wizard-summary-area {
      display: none;
    }

    .summary-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border-light);
      border-radius: 22px;
      padding: 24px;
      box-shadow: 0 14px 30px rgba(6, 20, 47, 0.1);
    }

    .summary-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
    }

    .summary-kicker {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: var(--color-text-muted);
      font-weight: 600;
    }

    .summary-step {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-secondary);
      background: rgba(6, 20, 47, 0.04);
      border-radius: 999px;
      padding: 4px 10px;
    }

    .summary-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .summary-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-text-muted);
      font-weight: 600;
    }

    .summary-value {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .summary-value.is-filled {
      color: var(--color-text);
      font-weight: 600;
    }

    .summary-value.is-empty {
      color: var(--color-text-muted);
      font-weight: 500;
    }


    .summary-divider {
      height: 1px;
      background: var(--color-border-light);
      margin: 16px 0;
    }

    .summary-room-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .summary-room {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      border-radius: 12px;
      background: rgba(6, 20, 47, 0.04);
      font-size: 0.8rem;
      color: var(--color-text-secondary);
      font-weight: 600;
    }

    .summary-room span:last-child {
      color: var(--color-text);
    }

    .summary-next {
      margin-top: 12px;
      padding: 14px;
      border-radius: 14px;
      background: rgba(6, 20, 47, 0.03);
      border: 1px solid var(--color-border-light);
    }

    .summary-next span {
      display: block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-weight: 600;
      color: var(--color-text-muted);
      margin-bottom: 6px;
    }

    .summary-next p {
      margin: 0;
      font-size: 0.85rem;
      color: var(--color-text-secondary);
    }

    @media (max-width: 1024px) {
      .wizard-content-split {
        grid-template-columns: 1fr;
        gap: 32px;
      }
      .wizard-summary-area {
        position: static;
        order: -1;
      }
      .summary-card {
        box-shadow: none;
      }
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
      border: 2px solid var(--color-border-light);
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
      box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.18);
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
      background: var(--color-border-light);
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
      text-align: left;
      margin-bottom: var(--spacing-lg);
    }

    .step-kicker {
      font-size: 0.7rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--color-text-muted);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .step-title {
      font-size: 2rem;
      font-weight: 700;
      color: var(--color-text);
      font-family: var(--font-heading);
      margin: 0 0 8px 0;
      letter-spacing: -0.02em;
    }

    .step-subtitle {
      font-size: 1rem;
      color: var(--color-text-secondary);
      margin: 0;
      line-height: 1.6;
    }

    /* Enhanced Wizard Card - Vision AI Style */
    .wizard-card {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border-light);
      box-shadow: 0 12px 24px rgba(6, 20, 47, 0.08);
      padding: var(--spacing-xl);
    }

    .wizard-validation-banner {
      margin: 0;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(220, 38, 38, 0.32);
      background: rgba(254, 242, 242, 0.9);
      color: #991b1b;
      font-size: 0.82rem;
      font-weight: 600;
    }

    /* Enhanced Form Group */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }

    .form-group.has-error .wizard-label {
      color: #991b1b;
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

    .field-error {
      margin: 4px 0 0;
      font-size: 0.8rem;
      font-weight: 600;
      color: #b91c1c;
    }

    .wizard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    /* Wider grid when sidebar is present - use 3 columns on large screens */
    .wizard-shell.has-sidebar .wizard-grid {
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 28px;
    }

    @media (max-width: 1200px) {
       .wizard-grid { grid-template-columns: 1fr 1fr; }
    }

    @media (max-width: 768px) {
      .wizard-grid { grid-template-columns: 1fr; }
    }

    .wizard-card--stack {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xl);
    }

    .wizard-main-content {
      padding-top: 24px;
      padding-bottom: 24px;
    }

    /* Better spacing when sidebar present */
    .wizard-shell.has-sidebar .wizard-main-content {
      padding-top: 0;
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

    .estimate-header {
      margin-bottom: 32px;
    }

    .estimate-header .step-kicker {
      margin-bottom: 8px;
    }

    .choice-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 16px;
    }

    .choice-card {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 16px;
      border-radius: 16px;
      border: 1px solid var(--color-border-light);
      background: var(--color-surface);
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
    }

    .choice-card:hover {
      border-color: var(--color-accent-light);
      background: rgba(78, 154, 247, 0.08);
    }

    .choice-card.selected {
      border-color: var(--color-accent);
      background: rgba(78, 154, 247, 0.12);
      box-shadow: 0 12px 24px rgba(6, 20, 47, 0.12);
    }

    .choice-grid.has-error .choice-card:not(.selected) {
      border-color: rgba(220, 38, 38, 0.4);
      background: rgba(254, 242, 242, 0.46);
    }

    .choice-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: rgba(6, 20, 47, 0.04);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-secondary);
      flex-shrink: 0;
    }

    .choice-card.selected .choice-icon {
      color: var(--color-accent);
      background: rgba(59, 130, 246, 0.12);
    }

    .choice-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 4px;
    }

    .choice-description {
      font-size: 0.85rem;
      color: var(--color-text-secondary);
      margin: 0;
      line-height: 1.5;
    }

    .grid-span-2 {
      grid-column: 1 / -1;
    }

    .required {
      margin-left: 6px;
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--color-danger);
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

    .pill-grid--three {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .pill-grid.has-error .pill-option:not(.selected) {
      border-color: rgba(220, 38, 38, 0.45);
      background: rgba(254, 242, 242, 0.65);
    }

    .pill-option {
      border: 1px solid var(--color-border-light);
      background: var(--color-surface);
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
      color: var(--color-accent-dark);
      flex-shrink: 0;
    }

    .pill-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0; /* Allows text truncation/wrapping inside flex item */
    }

    .pill-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .pill-subtitle {
      font-size: 0.75rem;
      color: var(--color-text-secondary);
      line-height: 1.4;
    }

    /* Brick/Block Type Selector - Compact Strip */
    .brick-strip {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 4px 0;
      -webkit-overflow-scrolling: touch;
    }

    .brick-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 10px 16px 12px;
      border: 2px solid var(--color-border-light);
      background: var(--color-surface);
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 90px;
      flex-shrink: 0;
    }

    .brick-chip:hover {
      border-color: #93c5fd;
      background: rgba(59, 130, 246, 0.04);
      transform: translateY(-2px);
    }

    .brick-chip.selected {
      border-color: var(--color-primary);
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(255, 255, 255, 1));
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
    }

    .brick-strip.has-error .brick-chip:not(.selected) {
      border-color: rgba(220, 38, 38, 0.45);
      background: rgba(254, 242, 242, 0.65);
    }

    .brick-chip-thumb {
      position: relative;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      /* overflow: hidden; Removed to allow tick to show */
      background: linear-gradient(135deg, var(--color-background), var(--color-border));
      border: 2px solid var(--color-border-light);
    }

    .brick-chip.selected .brick-chip-thumb {
      border-color: var(--color-primary);
    }

    .brick-chip-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .brick-chip-check {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
      z-index: 10;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .brick-chip-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-text);
      text-align: center;
      line-height: 1.2;
    }

    .brick-chip-rate {
      font-size: 0.7rem;
      color: var(--color-text-muted);
      font-weight: 500;
    }

    @media (max-width: 600px) {
      .brick-strip {
        gap: 6px;
      }
      .brick-chip {
        padding: 8px 12px 10px;
        min-width: 80px;
      }
      .brick-chip-thumb {
        width: 48px;
        height: 48px;
      }
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
      background: var(--color-surface);
      font-weight: 600;
      flex-shrink: 0;
    }

    .room-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .room-grid--compact {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .room-input {
      background: var(--color-surface);
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

    .room-input--row {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
    }

    .room-input--row label {
      font-size: 0.75rem;
    }

    .room-input--row input {
      width: 64px;
      text-align: center;
      font-weight: 700;
    }

    .plan-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
      gap: 24px;
      margin-top: var(--spacing-lg);
      align-items: start;
    }

    .plan-layout--single {
      grid-template-columns: minmax(0, 1fr);
    }

    .plan-inputs {
      background: var(--color-background);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: var(--spacing-lg);
    }

    .plan-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: var(--spacing-md);
    }

    .plan-header h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .plan-header p {
      margin: 6px 0 0;
      font-size: 0.85rem;
      color: var(--color-text-secondary);
    }

    .plan-preview {
      border-radius: 18px;
      border: 1px solid var(--color-border);
      background: linear-gradient(135deg, var(--color-surface), var(--color-mist));
      padding: var(--spacing-lg);
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    }

    .plan-preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-md);
      gap: 12px;
    }

    .plan-preview-header h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .plan-preview-header span {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .plan-preview-hint {
      display: block;
      font-size: 0.7rem;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-weight: 600;
      margin-top: 4px;
    }

    .plan-preview-actions {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .plan-add-room-btn {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .plan-add-room-btn:hover {
      border-color: var(--color-accent);
      color: var(--color-accent-dark);
    }

    .plan-add-room-menu {
      position: absolute;
      top: 36px;
      right: 0;
      background: var(--color-surface);
      border: 1px solid var(--color-border-light);
      border-radius: 12px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
      padding: 8px;
      display: grid;
      gap: 6px;
      min-width: 180px;
      z-index: 5;
    }

    .plan-add-room-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 6px 8px;
      border-radius: 10px;
      background: var(--color-background);
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .plan-add-room-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .plan-room-adjust {
      width: 24px;
      height: 24px;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      color: var(--color-text-secondary);
    }

    .plan-room-adjust:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .plan-room-count {
      min-width: 18px;
      text-align: center;
      font-weight: 700;
      color: var(--color-text);
    }

    .plan-canvas {
      min-height: 260px;
      border-radius: 16px;
      border: 1px dashed #cbd5f5;
      background: repeating-linear-gradient(
        0deg,
        rgba(148, 163, 184, 0.12),
        rgba(148, 163, 184, 0.12) 1px,
        transparent 1px,
        transparent 32px
      ),
      repeating-linear-gradient(
        90deg,
        rgba(148, 163, 184, 0.12),
        rgba(148, 163, 184, 0.12) 1px,
        transparent 1px,
        transparent 32px
      );
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 12px;
      padding: 16px;
      position: relative;
    }

    .plan-canvas.is-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-background);
    }

    .plan-empty {
      font-size: 0.9rem;
      color: var(--color-text-secondary);
      text-align: center;
      padding: 12px;
    }

    .plan-dimension {
      position: absolute;
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--color-text-secondary);
      background: #edf2f7;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid var(--color-border-dark);
    }

    .plan-dimension--x {
      top: -16px;
      left: 50%;
      transform: translateX(-50%);
    }

    .plan-dimension--y {
      left: -24px;
      top: 50%;
      transform: translateY(-50%) rotate(-90deg);
    }

    .plan-room {
      background: var(--color-surface);
      border-radius: 12px;
      border: 1px solid #dbeafe;
      padding: 10px;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-text);
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 70px;
      box-shadow: 0 8px 16px rgba(59, 130, 246, 0.08);
    }

    .plan-room--bedrooms { background: #eff6ff; }
    .plan-room--bathrooms { background: #ecfdf5; }
    .plan-room--kitchen { background: #fff7ed; }
    .plan-room--livingRoom { background: #fef9c3; }
    .plan-room--diningRoom { background: #fce7f3; }
    .plan-room--veranda { background: var(--color-mist); }
    .plan-room--garage1,
    .plan-room--garage2 { background: #ede9fe; }
    .plan-room--pantry { background: #ecfeff; }

    @media (max-width: 900px) {
      .pill-grid { grid-template-columns: 1fr; }
      .pill-grid--two { grid-template-columns: 1fr; }
      .pill-grid--three { grid-template-columns: 1fr; }
      .room-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .plan-layout { grid-template-columns: 1fr; }
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

    .wizard-select.wizard-input-error {
      border-color: rgba(220, 38, 38, 0.62);
      background: rgba(254, 242, 242, 0.45);
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

    .wizard-actions--right {
      justify-content: flex-end;
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

    .scope-selection.has-error .scope-card:not(.selected) {
      border-color: rgba(220, 38, 38, 0.4);
      background: rgba(254, 242, 242, 0.52);
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
      max-width: 100%;
      width: 100%;
      margin: 0;
    }

    .stage-selector-container.has-error {
      border-color: rgba(220, 38, 38, 0.4);
      background: rgba(254, 242, 242, 0.36);
    }

    .stage-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--spacing-md);
    }

    @media (max-width: 900px) {
      .stage-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .stage-grid {
        grid-template-columns: 1fr;
      }
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
      border: 1px dashed var(--color-accent);
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
      color: var(--color-text);
    }

    .price-update-text p {
      margin: 6px 0 0;
      font-size: 0.85rem;
      color: var(--color-text-secondary);
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
      color: var(--color-accent) !important;
      border-color: var(--color-accent) !important;
    }

    .ai-suggest-btn:hover {
      background: rgba(99, 102, 241, 0.1) !important;
    }

    .ai-suggest-btn svg {
      color: var(--color-accent) !important;
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
      background: var(--color-border-dark);
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: var(--color-text-muted);
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
      background: var(--color-background) !important;
    }

    .dropdown-item:active {
      background: var(--color-mist) !important;
    }
    /* Sidebar Layout - New Design */
    .wizard-layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 48px;
      max-width: 1280px;
      margin: 0 auto;
      padding: 32px 24px;
    }

    @media (max-width: 1024px) {
      .wizard-layout {
        grid-template-columns: 1fr;
        padding: 24px 16px;
      }
      .wizard-sidebar {
        display: none;
      }
    }

    .wizard-sidebar {
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: sticky;
      top: 100px;
      height: fit-content;
    }

    .sidebar-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      font-weight: 700;
      margin-bottom: 8px;
      padding-left: 4px;
    }

    .progress-card {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px;
      background: white;
      border: 1px solid var(--color-border);
      border-radius: 16px;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .progress-card.active {
      border-color: var(--color-accent);
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.1);
      transform: translateX(4px);
    }

    .progress-card.completed {
      background: var(--color-background);
      border-color: transparent;
    }

    .progress-indicator {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid var(--color-border-dark);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 0px;
      transition: all 0.3s ease;
      background: white;
    }

    .progress-card.active .progress-indicator {
      border-color: var(--color-accent);
      background: var(--color-accent);
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
    }
    
    .progress-card.active .progress-indicator svg {
      color: white;
    }

    .progress-card.completed .progress-indicator {
      border-color: var(--color-accent);
      background: var(--color-accent);
    }
    
    .progress-card.completed .progress-indicator svg {
      color: white;
    }

    .progress-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .progress-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--color-text-secondary);
      transition: color 0.2s;
    }
    
    .progress-card.active .progress-title {
      color: var(--color-text);
    }

    .progress-description {
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
    
    .progress-card.active .progress-description {
      color: var(--color-accent);
    }

    /* Override container styles for layout */
    .boq-wizard-container {
      max-width: none;
      margin: 0;
      padding: 0;
    }

    /* Content Split Layout */
    .wizard-content-split {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 48px;
      align-items: start;
    }

    @media (max-width: 1280px) {
      .wizard-content-split {
        grid-template-columns: 1fr 320px;
        gap: 32px;
      }
    }
    
    @media (max-width: 1024px) {
      .wizard-content-split {
        grid-template-columns: 1fr;
      }
      .wizard-illustration-area {
        display: none;
      }
    }

    .wizard-illustration-area {
      position: sticky;
      top: 100px;
      height: fit-content;
    }

    .step-illustration {
      width: 100%;
      aspect-ratio: 1;
      background: var(--color-background);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
      border: 1px dashed var(--color-border);
      position: relative;
      overflow: hidden;
    }
    
    .blob-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80%;
      height: 80%;
      background: #eff6ff;
      border-radius: 50%;
      z-index: 1;
      filter: blur(40px);
      opacity: 0.8;
    }

    /* Adjust form container max-width when illustration is present */
    .wizard-content-split .wizard-card {
      max-width: 100% !important;
    }
  `}</style>
);
export default WizardStyles;
