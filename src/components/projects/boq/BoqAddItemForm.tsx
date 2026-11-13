'use client';

import Button from '@/components/ui/Button';
import { isLaborCategory } from '@/lib/calculations/laborSubstages';
import { CaretDown } from '@phosphor-icons/react';

export interface BoqAddItemFormProps {
    category: string;
    selectLabel: string;
    availableMaterials: Array<{ id: string; name: string }>;
    newMaterialId: string;
    setNewMaterialId: (id: string) => void;
    newQuantity: string;
    setNewQuantity: (quantity: string) => void;
    isAdding: boolean;
    onCancel: () => void;
    onAdd: () => void;
}

/** Picking a material or labour line and a quantity to add to the stage. */
export default function BoqAddItemForm({
    category,
    selectLabel,
    availableMaterials,
    newMaterialId,
    setNewMaterialId,
    newQuantity,
    setNewQuantity,
    isAdding,
    onCancel,
    onAdd,
}: BoqAddItemFormProps) {
    return (
            <div className="add-form">
                <div className="form-grid">
                    <div className="form-group span-2">
                        <label>{selectLabel}</label>
                        <div className="select-wrapper">
                            <select
                                value={newMaterialId}
                                onChange={(e) => setNewMaterialId(e.target.value)}
                            >
                                <option value="">{isLaborCategory(category) ? 'Select labor or service...' : 'Select material...'}</option>
                                {availableMaterials.map((material) => (
                                    <option key={material.id} value={material.id}>
                                        {material.name}
                                    </option>
                                ))}
                            </select>
                            <CaretDown size={14} className="select-arrow" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Quantity</label>
                        <input
                            type="number"
                            value={newQuantity}
                            onChange={(e) => setNewQuantity(e.target.value)}
                            min="0"
                            step="0.01"
                        />
                    </div>
                </div>
                <div className="form-actions">
                    <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
                    <Button variant="primary" size="sm" loading={isAdding} onClick={onAdd}>Add Item</Button>
                </div>
            </div>
    );
}
