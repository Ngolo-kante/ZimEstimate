'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  FileArrowUp,
  Image as ImageIcon,
  X,
  SpinnerGap,
  Check,
  House,
  Ruler,
  Door,
  Cube,
  Lightning,
  ArrowRight,
  Warning,
} from '@phosphor-icons/react';

interface AnalysisResult {
  rooms: {
    name: string;
    area: number;
    dimensions: { width: number; length: number };
  }[];
  totalArea: number;
  doors: number;
  windows: number;
  estimatedCost: { usd: number; zwg: number };
  confidence: number;
  warnings: string[];
}

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(priceUsd, priceZwg)}</>;
}

export default function VisionTakeoffPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
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

    // Validate file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Please upload an image (PNG, JPG) or PDF file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setUploadedFile(file);

    // Create preview for images
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

  const analyzeFloorPlan = async () => {
    if (!uploadedFile) return;

    setAnalyzing(true);
    setProgress(0);
    setError(null);

    // Simulate AI analysis with progressive steps
    const steps = [
      { progress: 15, step: 'Detecting floor plan boundaries...' },
      { progress: 30, step: 'Identifying room layouts...' },
      { progress: 50, step: 'Measuring dimensions...' },
      { progress: 65, step: 'Counting doors and windows...' },
      { progress: 80, step: 'Calculating material requirements...' },
      { progress: 95, step: 'Generating cost estimate...' },
    ];

    for (const { progress, step } of steps) {
      setProgress(progress);
      setProgressStep(step);
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    }

    // Simulate analysis result (in production, this would call an AI API)
    const simulatedResult: AnalysisResult = {
      rooms: [
        { name: 'Living Room', area: 24, dimensions: { width: 6, length: 4 } },
        { name: 'Master Bedroom', area: 16, dimensions: { width: 4, length: 4 } },
        { name: 'Bedroom 2', area: 12, dimensions: { width: 4, length: 3 } },
        { name: 'Bedroom 3', area: 12, dimensions: { width: 4, length: 3 } },
        { name: 'Kitchen', area: 12, dimensions: { width: 4, length: 3 } },
        { name: 'Bathroom 1', area: 6, dimensions: { width: 3, length: 2 } },
        { name: 'Bathroom 2', area: 4, dimensions: { width: 2, length: 2 } },
        { name: 'Corridor', area: 8, dimensions: { width: 8, length: 1 } },
      ],
      totalArea: 94,
      doors: 8,
      windows: 12,
      estimatedCost: { usd: 32500, zwg: 975000 },
      confidence: 87,
      warnings: [
        'Some room boundaries may need manual verification',
        'Window sizes estimated from standard dimensions',
      ],
    };

    setProgress(100);
    setProgressStep('Analysis complete!');
    await new Promise((r) => setTimeout(r, 500));

    setResult(simulatedResult);
    setAnalyzing(false);
  };

  const proceedToBOQ = () => {
    // In production, would pass the analysis result
    router.push('/boq/new?method=vision&source=takeoff');
  };

  return (
    <MainLayout title="Vision Takeoff">
      <div className="takeoff-page">
        {/* Upload Section */}
        {!result && (
          <Card className="upload-card">
            <CardContent>
              <div className="upload-header">
                <h2>Upload Floor Plan</h2>
                <p>Our AI will analyze your blueprint and automatically extract room dimensions, count doors and windows, and estimate material requirements.</p>
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
                      <img src={previewUrl} alt="Floor plan preview" className="preview-image" />
                    ) : (
                      <div className="pdf-icon">
                        <FileArrowUp size={48} weight="light" />
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
                      <ImageIcon size={48} weight="light" />
                    </div>
                    <p className="drop-text">
                      Drag and drop your floor plan here, or <span>browse</span>
                    </p>
                    <p className="drop-hint">Supports PNG, JPG, or PDF up to 10MB</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="error-message">
                  <Warning size={18} />
                  {error}
                </div>
              )}

              {uploadedFile && !analyzing && (
                <Button onClick={analyzeFloorPlan} className="analyze-btn">
                  <Lightning size={18} weight="fill" />
                  Analyze with AI
                </Button>
              )}

              {analyzing && (
                <div className="analyzing-state">
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
            <Card className="results-summary">
              <CardContent>
                <div className="summary-header">
                  <div className="summary-icon">
                    <Check size={24} weight="bold" />
                  </div>
                  <div>
                    <h2>Analysis Complete</h2>
                    <p className="confidence">
                      AI Confidence: <strong>{result.confidence}%</strong>
                    </p>
                  </div>
                </div>

                <div className="summary-stats">
                  <div className="stat">
                    <Ruler size={24} weight="light" />
                    <div>
                      <span className="value">{result.totalArea} m²</span>
                      <span className="label">Total Area</span>
                    </div>
                  </div>
                  <div className="stat">
                    <House size={24} weight="light" />
                    <div>
                      <span className="value">{result.rooms.length}</span>
                      <span className="label">Rooms</span>
                    </div>
                  </div>
                  <div className="stat">
                    <Door size={24} weight="light" />
                    <div>
                      <span className="value">{result.doors}</span>
                      <span className="label">Doors</span>
                    </div>
                  </div>
                  <div className="stat">
                    <Cube size={24} weight="light" />
                    <div>
                      <span className="value">{result.windows}</span>
                      <span className="label">Windows</span>
                    </div>
                  </div>
                </div>

                <div className="estimated-cost">
                  <span className="cost-label">Estimated Construction Cost</span>
                  <span className="cost-value">
                    <PriceDisplay priceUsd={result.estimatedCost.usd} priceZwg={result.estimatedCost.zwg} />
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="rooms-list">
              <CardContent>
                <h3>Room Breakdown</h3>
                <div className="rooms-table">
                  <div className="table-header">
                    <span>Room</span>
                    <span>Dimensions</span>
                    <span>Area</span>
                  </div>
                  {result.rooms.map((room, index) => (
                    <div key={index} className="table-row">
                      <span className="room-name">{room.name}</span>
                      <span className="room-dims">{room.dimensions.width}m × {room.dimensions.length}m</span>
                      <span className="room-area">{room.area} m²</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {result.warnings.length > 0 && (
              <Card className="warnings-card">
                <CardContent>
                  <h3><Warning size={18} /> Notes</h3>
                  <ul className="warnings-list">
                    {result.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="action-buttons">
              <Button variant="secondary" onClick={clearFile}>
                Upload Different Plan
              </Button>
              <Button onClick={proceedToBOQ} icon={<ArrowRight size={18} />}>
                Generate BOQ from Analysis
              </Button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .takeoff-page {
          max-width: 800px;
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

        .analyze-btn {
          width: 100%;
          margin-top: var(--spacing-lg);
        }

        .analyzing-state {
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

        .results-summary .summary-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-xl);
        }

        .summary-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--color-success);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .summary-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }

        .confidence {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .confidence strong {
          color: var(--color-success);
        }

        .summary-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-xl);
        }

        .stat {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          background: var(--color-background);
          border-radius: var(--radius-md);
          color: var(--color-accent);
        }

        .stat .value {
          display: block;
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .stat .label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .estimated-cost {
          text-align: center;
          padding: var(--spacing-lg);
          background: linear-gradient(135deg, var(--color-primary) 0%, #1a2a4d 100%);
          border-radius: var(--radius-md);
        }

        .cost-label {
          display: block;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: var(--spacing-xs);
        }

        .cost-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--color-accent);
        }

        .rooms-list h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-md) 0;
        }

        .rooms-table {
          display: flex;
          flex-direction: column;
        }

        .table-header,
        .table-row {
          display: grid;
          grid-template-columns: 1fr 1fr 80px;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) 0;
        }

        .table-header {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--color-text-secondary);
          border-bottom: 1px solid var(--color-border-light);
        }

        .table-row {
          border-bottom: 1px solid var(--color-border-light);
        }

        .room-name {
          font-weight: 500;
          color: var(--color-text);
        }

        .room-dims,
        .room-area {
          color: var(--color-text-secondary);
        }

        .room-area {
          text-align: right;
          font-weight: 500;
        }

        .warnings-card h3 {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-size: 0.875rem;
          color: var(--color-warning);
          margin: 0 0 var(--spacing-md) 0;
        }

        .warnings-list {
          margin: 0;
          padding-left: var(--spacing-lg);
          color: var(--color-text-secondary);
          font-size: 0.875rem;
        }

        .warnings-list li {
          margin-bottom: var(--spacing-xs);
        }

        .action-buttons {
          display: flex;
          gap: var(--spacing-md);
          justify-content: flex-end;
        }

        @media (max-width: 768px) {
          .summary-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </MainLayout>
  );
}
