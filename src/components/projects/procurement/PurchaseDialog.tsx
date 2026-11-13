'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import Button from '@/components/ui/Button';
import { DOCUMENT_ACCEPT } from '@/lib/documentFiles';
import type { BOQItem, Supplier } from '@/lib/database.types';
import type { ItemWithPurchases, PurchaseFormErrors, PurchaseFormValues } from '@/lib/projects/procurement';
import { Camera, Minus, Paperclip, Plus, X } from '@phosphor-icons/react';

export interface PurchaseDialogProps {
  purchaseDialog: RefObject<HTMLDialogElement | null>;
  cameraInput: RefObject<HTMLInputElement | null>;
  selectedItemForPurchase: BOQItem;
  itemsWithPurchases: ItemWithPurchases[];
  suppliers: Supplier[];
  purchaseForm: PurchaseFormValues;
  setPurchaseForm: Dispatch<SetStateAction<PurchaseFormValues>>;
  formErrors: PurchaseFormErrors;
  setFormErrors: Dispatch<SetStateAction<PurchaseFormErrors>>;
  purchaseError: string | null;
  purchaseStatus: string;
  isSavingPurchase: boolean;
  closePurchase: () => void;
  selectReceipt: (picked?: File) => void | Promise<void>;
  onSavePurchase: () => void | Promise<void>;
}

/** Logging a purchase against one BOQ line, with an optional receipt. */
export default function PurchaseDialog({
  purchaseDialog,
  cameraInput,
  selectedItemForPurchase,
  itemsWithPurchases,
  suppliers,
  purchaseForm,
  setPurchaseForm,
  formErrors,
  setFormErrors,
  purchaseError,
  purchaseStatus,
  isSavingPurchase,
  closePurchase,
  selectReceipt,
  onSavePurchase,
}: PurchaseDialogProps) {
  return (
    <dialog ref={purchaseDialog} className="modal-overlay purchase-dialog" aria-labelledby="purchase-modal-title"
      onCancel={e => { e.preventDefault(); closePurchase(); }}
      onClick={e => { if (e.target === e.currentTarget) closePurchase(); }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 id="purchase-modal-title">Record purchase</h3>
            <p className="modal-item-name">{selectedItemForPurchase.material_name}</p>
          </div>
          <button type="button" className="modal-close !h-11 !w-11" aria-label="Close purchase form" disabled={isSavingPurchase} onClick={closePurchase}>
            <X size={20} />
          </button>
        </div>
        <fieldset className="modal-body purchase-fields" disabled={isSavingPurchase}>
          <div className="modal-item-info">
            <div className="info-cell">
              <span className="info-label">BOQ Qty</span>
              <span className="info-value">{Number(selectedItemForPurchase.quantity).toFixed(1)} {selectedItemForPurchase.unit}</span>
            </div>
            <div className="info-cell">
              <span className="info-label">Purchased</span>
              <span className="info-value">{itemsWithPurchases.find(i => i.id === selectedItemForPurchase.id)?.totalPurchased.toFixed(1) || '0'} {selectedItemForPurchase.unit}</span>
            </div>
            <div className="info-cell highlight">
              <span className="info-label">Remaining</span>
              <span className="info-value">{itemsWithPurchases.find(i => i.id === selectedItemForPurchase.id)?.remainingQty.toFixed(1) || selectedItemForPurchase.quantity} {selectedItemForPurchase.unit}</span>
            </div>
          </div>

          <div className="form-section">
            <div className={`form-field ${formErrors.supplierName ? 'has-error' : ''}`}>
              <label htmlFor="supplier-input">
                Supplier Name <span className="required">*</span>
              </label>
              <input
                id="supplier-input"
                type="text"
                list="supplier-list"
                value={purchaseForm.supplierName}
                onChange={(e) => {
                  setPurchaseForm({ ...purchaseForm, supplierName: e.target.value });
                  if (formErrors.supplierName) setFormErrors({ ...formErrors, supplierName: undefined });
                }}
                placeholder="e.g. PPC Zimbabwe"
                className={formErrors.supplierName ? 'error' : ''}
              />
              <datalist id="supplier-list">
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.name} />
                ))}
              </datalist>
              {formErrors.supplierName && <span className="field-error">{formErrors.supplierName}</span>}
            </div>

            <div className="form-row three-col">
              <div className={`form-field ${formErrors.quantity ? 'has-error' : ''}`}>
                <label htmlFor="qty-input">
                  Quantity <span className="required">*</span>
                </label>
                <input
                  id="qty-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={purchaseForm.quantity}
                  onChange={(e) => {
                    setPurchaseForm({ ...purchaseForm, quantity: e.target.value });
                    if (formErrors.quantity) setFormErrors({ ...formErrors, quantity: undefined });
                  }}
                  placeholder="0.00"
                  className={formErrors.quantity ? 'error' : ''}
                />
                <div className="quantity-actions">
                  <button type="button" aria-label="Decrease quantity by one" onClick={() => setPurchaseForm(f => ({ ...f, quantity: String(Math.max(0, Number(f.quantity) - 1)) }))}><Minus size={18} /></button>
                  <button type="button" aria-label="Increase quantity by one" onClick={() => setPurchaseForm(f => ({ ...f, quantity: String((Number(f.quantity) || 0) + 1) }))}><Plus size={18} /></button>
                  <button type="button" onClick={() => setPurchaseForm(f => ({ ...f, quantity: String(Math.max(0, itemsWithPurchases.find(i => i.id === selectedItemForPurchase.id)?.remainingQty ?? Number(selectedItemForPurchase.quantity))) }))}>Use remaining</button>
                </div>
                {formErrors.quantity && <span className="field-error">{formErrors.quantity}</span>}
              </div>
              <div className={`form-field ${formErrors.unitPrice ? 'has-error' : ''}`}>
                <label htmlFor="price-input">
                  Unit Price (USD) <span className="required">*</span>
                </label>
                <input
                  id="price-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={purchaseForm.unitPrice}
                  onChange={(e) => {
                    setPurchaseForm({ ...purchaseForm, unitPrice: e.target.value });
                    if (formErrors.unitPrice) setFormErrors({ ...formErrors, unitPrice: undefined });
                  }}
                  placeholder="0.00"
                  className={formErrors.unitPrice ? 'error' : ''}
                />
                {formErrors.unitPrice && <span className="field-error">{formErrors.unitPrice}</span>}
              </div>
              <div className={`form-field ${formErrors.purchasedAt ? 'has-error' : ''}`}>
                <label htmlFor="date-input">
                  Date <span className="required">*</span>
                </label>
                <input
                  id="date-input"
                  type="date"
                  value={purchaseForm.purchasedAt}
                  onChange={(e) => {
                    setPurchaseForm({ ...purchaseForm, purchasedAt: e.target.value });
                    if (formErrors.purchasedAt) setFormErrors({ ...formErrors, purchasedAt: undefined });
                  }}
                  className={formErrors.purchasedAt ? 'error' : ''}
                />
                {formErrors.purchasedAt && <span className="field-error">{formErrors.purchasedAt}</span>}
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="notes-input">Notes <span className="optional">(optional)</span></label>
              <input
                id="notes-input"
                type="text"
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                placeholder="Invoice reference, delivery notes..."
              />
            </div>

            <div className="form-field">
              <label>Receipt <span className="optional">(optional)</span></label>
              <div className="file-upload-area">
                <input
                  type="file"
                  id="receipt-file-input"
                  accept={DOCUMENT_ACCEPT}
                  onChange={e => { selectReceipt(e.target.files?.[0]); e.target.value = ''; }}
                />
                <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { selectReceipt(e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" className="receipt-camera" onClick={() => cameraInput.current?.click()}><Camera size={18} /> Take receipt photo</button>
                <label htmlFor="receipt-file-input" className="file-upload-label">
                  <Paperclip size={18} />
                  {purchaseForm.receiptFile ? (
                    <span className="file-name">{purchaseForm.receiptFile.name}</span>
                  ) : (
                    <span className="file-placeholder">Attach receipt (image or PDF)</span>
                  )}
                </label>
              </div>
            </div>
            <p role="status" className="purchase-status">{purchaseStatus}</p>
            {purchaseError && <p role="alert" className="field-error">{purchaseError}</p>}
          </div>
        </fieldset>
        <div className="modal-footer purchase-footer">
          <div className="purchase-total"><span>Total (USD)</span><strong>${((Number(purchaseForm.quantity) || 0) * (Number(purchaseForm.unitPrice) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
          <Button variant="secondary" disabled={isSavingPurchase} onClick={closePurchase}>
            Cancel
          </Button>
          <Button onClick={onSavePurchase} loading={isSavingPurchase}>
            {purchaseError ? 'Retry save' : 'Save purchase'}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
