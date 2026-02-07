'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Image from 'next/image';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  Camera,
  X,
  SpinnerGap,
  Check,
  PencilSimple,
  Trash,
  ArrowRight,
  Warning,
  Scan,
  FileText,
} from '@phosphor-icons/react';

interface ExtractedItem {
  id: string;
  material: string;
  quantity: number;
  unit: string;
  unitPrice: { usd: number; zwg: number };
  total: { usd: number; zwg: number };
  confidence: number;
  needsReview: boolean;
}

interface ScanResult {
  supplierName: string;
  quoteDate: string;
  quoteNumber: string;
  items: ExtractedItem[];
  subtotal: { usd: number; zwg: number };
  vat: { usd: number; zwg: number };
  total: { usd: number; zwg: number };
  overallConfidence: number;
}

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(priceUsd, priceZwg)}</>;
}

export default function QuoteScannerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    setError(null);
    setResult(null);

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Please upload an image (PNG, JPG) or PDF file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setUploadedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const scanQuote = async () => {
    if (!uploadedFile) return;

    setScanning(true);
    setProgress(0);
    setError(null);

    const steps = [
      { progress: 15, step: 'Preprocessing image...' },
      { progress: 30, step: 'Running OCR text extraction...' },
      { progress: 50, step: 'Identifying line items...' },
      { progress: 65, step: 'Extracting quantities and prices...' },
      { progress: 80, step: 'Matching to material database...' },
      { progress: 95, step: 'Validating extracted data...' },
    ];

    for (const { progress, step } of steps) {
      setProgress(progress);
      setProgressStep(step);
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 300));
    }

    // Simulated OCR result
    const simulatedResult: ScanResult = {
      supplierName: 'Baines Building Supplies',
      quoteDate: '2026-01-28',
      quoteNumber: 'QT-2026-0142',
      items: [
        {
          id: '1',
          material: 'Common Cement Brick',
          quantity: 5000,
          unit: 'bricks',
          unitPrice: { usd: 0.075, zwg: 2.25 },
          total: { usd: 375, zwg: 11250 },
          confidence: 95,
          needsReview: false,
        },
        {
          id: '2',
          material: 'Standard Cement 32.5N',
          quantity: 40,
          unit: 'bags',
          unitPrice: { usd: 10, zwg: 300 },
          total: { usd: 400, zwg: 12000 },
          confidence: 98,
          needsReview: false,
        },
        {
          id: '3',
          material: 'River Sand (Concrete)',
          quantity: 8,
          unit: 'cubes',
          unitPrice: { usd: 45, zwg: 1350 },
          total: { usd: 360, zwg: 10800 },
          confidence: 92,
          needsReview: false,
        },
        {
          id: '4',
          material: 'Rebar Y12 (6m)',
          quantity: 25,
          unit: 'lengths',
          unitPrice: { usd: 8, zwg: 240 },
          total: { usd: 200, zwg: 6000 },
          confidence: 88,
          needsReview: false,
        },
        {
          id: '5',
          material: 'Unknown Material',
          quantity: 6,
          unit: 'rolls',
          unitPrice: { usd: 15, zwg: 450 },
          total: { usd: 90, zwg: 2700 },
          confidence: 45,
          needsReview: true,
        },
      ],
      subtotal: { usd: 1425, zwg: 42750 },
      vat: { usd: 214, zwg: 6413 },
      total: { usd: 1639, zwg: 49163 },
      overallConfidence: 84,
    };

    setProgress(100);
    setProgressStep('Scan complete!');
    await new Promise((r) => setTimeout(r, 500));

    setResult(simulatedResult);
    setScanning(false);
  };

  const removeItem = (itemId: string) => {
    if (!result) return;
    setResult({
      ...result,
      items: result.items.filter((item) => item.id !== itemId),
    });
  };

  const importToEstimate = () => {
    router.push('/boq/new?method=ocr&source=quote-scan');
  };

  return (
    <MainLayout title="Quote Scanner">
      <div className="scanner-page">
        {/* Upload Section */}
        {!result && (
          <Card className="upload-card">
            <CardContent>
              <div className="upload-header">
                <h2>Scan Supplier Quote</h2>
                <p>Upload a photo or scan of a handwritten or printed quote. Our AI will extract materials, quantities, and prices automatically.</p>
              </div>

              <div
                className={`drop-zone ${dragActive ? 'active' : ''} ${uploadedFile ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !uploadedFile && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileInput}
                  hidden
                />

                {uploadedFile ? (
                  <div className="file-preview">
                    {previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt="Quote preview"
                        width={640}
                        height={360}
                        className="preview-image"
                        unoptimized
                      />
                    ) : (
                      <div className="pdf-icon">
                        <FileText size={48} weight="light" />
                        <span>PDF Document</span>
                      </div>
                    )}
                    <div className="file-info">
                      <span className="file-name">{uploadedFile.name}</span>
                      <span className="file-size">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <button className="clear-btn" onClick={(e) => { e.stopPropagation(); clearFile(); }}>
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <div className="drop-content">
                    <div className="drop-icon">
                      <Camera size={48} weight="light" />
                    </div>
                    <p className="drop-text">
                      Take a photo or <span>upload</span> a quote
                    </p>
                    <p className="drop-hint">Supports handwritten and printed quotes (PNG, JPG, PDF)</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="error-message">
                  <Warning size={18} />
                  {error}
                </div>
              )}

              {uploadedFile && !scanning && (
                <Button onClick={scanQuote} className="scan-btn">
                  <Scan size={18} />
                  Extract with OCR
                </Button>
              )}

              {scanning && (
                <div className="scanning-state">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="progress-info">
                    <SpinnerGap size={18} className="spinner" />
                    <span>{progressStep}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {result && (
          <div className="results-section">
            <Card className="quote-header">
              <CardContent>
                <div className="header-content">
                  <div className="header-icon">
                    <Check size={24} weight="bold" />
                  </div>
                  <div className="header-info">
                    <h2>{result.supplierName}</h2>
                    <p>Quote #{result.quoteNumber} • {result.quoteDate}</p>
                    <p className="confidence">
                      OCR Confidence: <strong>{result.overallConfidence}%</strong>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="items-card">
              <CardContent>
                <h3>Extracted Items</h3>
                <p className="items-hint">Review and correct any items flagged for attention</p>

                <div className="items-table">
                  <div className="table-header">
                    <span>Material</span>
                    <span>Qty</span>
                    <span>Unit Price</span>
                    <span>Total</span>
                    <span></span>
                  </div>
                  {result.items.map((item) => (
                    <div
                      key={item.id}
                      className={`table-row ${item.needsReview ? 'needs-review' : ''}`}
                    >
                      <span className="material-cell">
                        {item.material}
                        {item.needsReview && (
                          <span className="review-badge">
                            <Warning size={14} /> Needs Review
                          </span>
                        )}
                      </span>
                      <span className="qty-cell">
                        {item.quantity} {item.unit}
                      </span>
                      <span className="price-cell">
                        <PriceDisplay priceUsd={item.unitPrice.usd} priceZwg={item.unitPrice.zwg} />
                      </span>
                      <span className="total-cell">
                        <PriceDisplay priceUsd={item.total.usd} priceZwg={item.total.zwg} />
                      </span>
                      <span className="actions-cell">
                        <button className="action-btn edit" title="Edit">
                          <PencilSimple size={16} />
                        </button>
                        <button
                          className="action-btn delete"
                          title="Remove"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash size={16} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="totals">
                  <div className="total-row">
                    <span>Subtotal</span>
                    <span><PriceDisplay priceUsd={result.subtotal.usd} priceZwg={result.subtotal.zwg} /></span>
                  </div>
                  <div className="total-row">
                    <span>VAT (15%)</span>
                    <span><PriceDisplay priceUsd={result.vat.usd} priceZwg={result.vat.zwg} /></span>
                  </div>
                  <div className="total-row grand">
                    <span>Total</span>
                    <span><PriceDisplay priceUsd={result.total.usd} priceZwg={result.total.zwg} /></span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="action-buttons">
              <Button variant="secondary" onClick={clearFile}>
                Scan Another Quote
              </Button>
              <Button onClick={importToEstimate} icon={<ArrowRight size={18} />}>
                Import to Estimate
              </Button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .scanner-page {
          max-width: 900px;
          margin: 0 auto;
        }

        .upload-header {
          text-align: center;
          margin-bottom: var(--spacing-xl);
        }

        .upload-header h2 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .upload-header p {
          color: var(--color-text-secondary);
          margin: 0;
        }

        .drop-zone {
          border: 2px dashed var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--spacing-xl);
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--color-background);
        }

        .drop-zone:hover,
        .drop-zone.active {
          border-color: var(--color-accent);
          background: rgba(252, 163, 17, 0.05);
        }

        .drop-zone.has-file {
          cursor: default;
          border-style: solid;
        }

        .drop-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--color-surface);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--spacing-md);
          color: var(--color-accent);
        }

        .drop-text {
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .drop-text span {
          color: var(--color-accent);
          text-decoration: underline;
        }

        .drop-hint {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin: 0;
        }

        .file-preview {
          position: relative;
        }

        .preview-image {
          max-width: 100%;
          max-height: 300px;
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-md);
        }

        .pdf-icon {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-xl);
          color: var(--color-accent);
        }

        .file-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .file-name {
          font-weight: 500;
          color: var(--color-text);
        }

        .file-size {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .clear-btn {
          position: absolute;
          top: 0;
          right: 0;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--color-text-secondary);
          transition: all 0.2s ease;
        }

        .clear-btn:hover {
          background: var(--color-error);
          border-color: var(--color-error);
          color: white;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          background: rgba(239, 68, 68, 0.1);
          border-radius: var(--radius-md);
          color: var(--color-error);
          margin-top: var(--spacing-md);
        }

        .scan-btn {
          width: 100%;
          margin-top: var(--spacing-lg);
        }

        .scanning-state {
          margin-top: var(--spacing-lg);
        }

        .progress-bar {
          height: 8px;
          background: var(--color-background);
          border-radius: var(--radius-full);
          overflow: hidden;
          margin-bottom: var(--spacing-md);
        }

        .progress-fill {
          height: 100%;
          background: var(--color-accent);
          border-radius: var(--radius-full);
          transition: width 0.3s ease;
        }

        .progress-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          color: var(--color-text-secondary);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .results-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .quote-header .header-content {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .header-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--color-success);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .header-info h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }

        .header-info p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 4px 0 0 0;
        }

        .confidence strong {
          color: var(--color-success);
        }

        .items-card h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .items-hint {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-lg) 0;
        }

        .items-table {
          margin-bottom: var(--spacing-lg);
        }

        .table-header,
        .table-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 80px;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-md);
          align-items: center;
        }

        .table-header {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--color-text-secondary);
          background: var(--color-background);
          border-radius: var(--radius-md);
        }

        .table-row {
          border-bottom: 1px solid var(--color-border-light);
        }

        .table-row.needs-review {
          background: rgba(251, 191, 36, 0.1);
        }

        .material-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .review-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: var(--color-warning);
        }

        .price-cell,
        .total-cell {
          font-weight: 500;
        }

        .total-cell {
          color: var(--color-text);
        }

        .actions-cell {
          display: flex;
          gap: var(--spacing-xs);
        }

        .action-btn {
          background: none;
          border: none;
          padding: var(--spacing-xs);
          cursor: pointer;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          background: var(--color-background);
        }

        .action-btn.delete:hover {
          color: var(--color-error);
        }

        .totals {
          border-top: 1px solid var(--color-border);
          padding-top: var(--spacing-md);
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          padding: var(--spacing-xs) 0;
          color: var(--color-text-secondary);
        }

        .total-row.grand {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
          border-top: 1px solid var(--color-border);
          margin-top: var(--spacing-sm);
          padding-top: var(--spacing-md);
        }

        .action-buttons {
          display: flex;
          gap: var(--spacing-md);
          justify-content: flex-end;
        }

        @media (max-width: 768px) {
          .table-header,
          .table-row {
            grid-template-columns: 1fr 1fr;
          }

          .price-cell {
            display: none;
          }
        }
      `}</style>
    </MainLayout>
  );
}
