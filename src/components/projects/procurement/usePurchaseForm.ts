'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useToast } from '@/components/ui/Toast';
import { validateDocumentFile } from '@/lib/documentFiles';
import { prepareImageForUpload } from '@/lib/compressImage';
import { createPurchaseRecord, uploadDocument, updateBOQItem } from '@/lib/services/projects';
import type { BOQItem, ProjectDocument, PurchaseRecord, Supplier } from '@/lib/database.types';
import {
  toIsoMidday,
  validatePurchaseForm,
  type ItemWithPurchases,
  type PurchaseFormErrors,
  type PurchaseFormValues,
} from '@/lib/projects/procurement';

const emptyForm = (unitPrice = ''): PurchaseFormValues => ({
  supplierName: '',
  quantity: '',
  unitPrice,
  purchasedAt: new Date().toISOString().split('T')[0],
  notes: '',
  receiptFile: null,
});

/**
 * The purchase dialog: opening it for a line, its form, attaching a receipt,
 * and saving. A save in progress cannot be started twice or closed.
 */
export function usePurchaseForm({
  projectId,
  suppliers,
  itemsWithPurchases,
  setPurchases,
  setReceiptDocs,
  setExpandedItems,
  onItemsRefresh,
}: {
  projectId: string;
  suppliers: Supplier[];
  itemsWithPurchases: ItemWithPurchases[];
  setPurchases: Dispatch<SetStateAction<PurchaseRecord[]>>;
  setReceiptDocs: Dispatch<SetStateAction<ProjectDocument[]>>;
  setExpandedItems: Dispatch<SetStateAction<Set<string>>>;
  onItemsRefresh: () => Promise<void>;
}) {
  const { success, error: showError } = useToast();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItemForPurchase, setSelectedItemForPurchase] = useState<BOQItem | null>(null);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const purchaseBusy = useRef(false);
  const purchaseDialog = useRef<HTMLDialogElement>(null);
  const uploadedReceipt = useRef<{ file: File; id: string } | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (showPurchaseModal) purchaseDialog.current?.showModal();
  }, [showPurchaseModal]);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<PurchaseFormErrors>({});
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormValues>(emptyForm());

  const resetPurchaseForm = () => {
    uploadedReceipt.current = null;
    setPurchaseError(null);
    setPurchaseStatus('');
    setPurchaseForm(emptyForm());
    setFormErrors({});
  };

  const openPurchaseModal = (item: BOQItem) => {
    if (purchaseBusy.current) return;
    uploadedReceipt.current = null;
    setPurchaseError(null);
    setPurchaseStatus('');
    setSelectedItemForPurchase(item);
    setPurchaseForm(emptyForm(item.unit_price_usd ? String(item.unit_price_usd) : ''));
    setFormErrors({});
    setShowPurchaseModal(true);
  };

  const validateForm = (): boolean => {
    const errors = validatePurchaseForm(purchaseForm);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const closePurchase = () => {
    if (purchaseBusy.current) return;
    setShowPurchaseModal(false);
    resetPurchaseForm();
    setSelectedItemForPurchase(null);
  };

  const selectReceipt = async (picked?: File) => {
    if (!picked) return;
    // A receipt photo only has to stay legible: shrunk before the size check,
    // it is accepted at any phone resolution and uploads far faster.
    const file = await prepareImageForUpload(picked, 'record');
    const error = validateDocumentFile(file);
    setPurchaseError(error);
    if (!error) {
      uploadedReceipt.current = null;
      setPurchaseForm(current => ({ ...current, receiptFile: file }));
    }
  };

  const handleSavePurchase = async () => {
    if (purchaseBusy.current || !selectedItemForPurchase || !validateForm()) return;
    purchaseBusy.current = true;
    setIsSavingPurchase(true);
    setPurchaseError(null);
    const supplierName = purchaseForm.supplierName.trim();
    const quantity = Number(purchaseForm.quantity);
    const unitPrice = Number(purchaseForm.unitPrice);
    const itemId = selectedItemForPurchase.id;
    const matchedSupplier = suppliers.find(supplier => supplier.name.toLowerCase() === supplierName.toLowerCase());
    setSavingItemId(itemId);
    try {
      let receiptDocumentId = uploadedReceipt.current?.file === purchaseForm.receiptFile ? uploadedReceipt.current.id : null;
      if (purchaseForm.receiptFile && !receiptDocumentId) {
        setPurchaseStatus('Uploading receipt…');
        const { document, error } = await uploadDocument(projectId, purchaseForm.receiptFile, 'receipt', `Receipt for ${selectedItemForPurchase.material_name}`);
        if (error || !document) throw error || new Error('Receipt upload did not complete.');
        receiptDocumentId = document.id;
        uploadedReceipt.current = { file: purchaseForm.receiptFile, id: document.id };
        setReceiptDocs(prev => [document, ...prev.filter(d => d.id !== document.id)]);
      }
      setPurchaseStatus('Saving purchase…');
      const { record, error } = await createPurchaseRecord({
        project_id: projectId, boq_item_id: itemId, supplier_name: supplierName,
        supplier_id: matchedSupplier?.id || null, quantity, unit_price_usd: unitPrice,
        purchased_at: toIsoMidday(purchaseForm.purchasedAt), notes: purchaseForm.notes || null,
        receipt_document_id: receiptDocumentId,
      });
      if (error || !record) throw error || new Error('Purchase could not be saved.');
      setPurchases(prev => [record, ...prev.filter(p => p.id !== record.id)]);
      setExpandedItems(prev => new Set(prev).add(itemId));
      // Once the purchase exists, a refresh failure must not invite a duplicate retry.
      setShowPurchaseModal(false);
      const currentItem = itemsWithPurchases.find(i => i.id === itemId);
      const newTotalPurchased = (currentItem?.totalPurchased || 0) + quantity;
      try {
        const { error: syncError } = await updateBOQItem(itemId, {
          actual_quantity: newTotalPurchased, actual_price_usd: unitPrice,
          is_purchased: newTotalPurchased >= Number(selectedItemForPurchase.quantity),
          purchased_date: new Date().toISOString(),
        });
        if (syncError) throw syncError;
        await onItemsRefresh();
        success('Purchase saved');
      } catch {
        showError('Purchase saved. Refresh the project to update the totals.');
      }
      setSelectedItemForPurchase(null);
      resetPurchaseForm();
    } catch (err) {
      setPurchaseError(`${err instanceof Error ? err.message : 'Could not save purchase.'} Your details are kept here. Please retry.`);
      setPurchaseStatus('');
    } finally {
      purchaseBusy.current = false;
      setIsSavingPurchase(false);
      setSavingItemId(null);
    }
  };

  return {
    showPurchaseModal,
    selectedItemForPurchase,
    isSavingPurchase,
    purchaseError,
    purchaseStatus,
    purchaseDialog,
    cameraInput,
    savingItemId,
    formErrors,
    setFormErrors,
    purchaseForm,
    setPurchaseForm,
    openPurchaseModal,
    closePurchase,
    selectReceipt,
    handleSavePurchase,
  };
}
