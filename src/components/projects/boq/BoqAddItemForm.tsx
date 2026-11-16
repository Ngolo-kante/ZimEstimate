'use client';

import { useId } from 'react';

import { Field, FieldGroup, FieldLabel } from '@/components/shadcn/field';
import { Input } from '@/components/shadcn/input';
import { NativeSelect } from '@/components/shadcn/native-select';


import Button from '@/components/ui/Button';
import { isLaborCategory } from '@/lib/calculations/laborSubstages';

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
    const controlId = useId();
    return (
            <div className="add-form">
                <FieldGroup className="!grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field className="min-w-0">
                        <FieldLabel htmlFor={`${controlId}-1`}>{selectLabel}</FieldLabel>
                        <div className="select-wrapper">
                            <NativeSelect id={`${controlId}-1`} className="w-full [&_select]:!h-11 [&_select]:bg-sc-background [&_select]:text-base [&_select]:transition-none"
                                value={newMaterialId}
                                onChange={(e) => setNewMaterialId(e.target.value)}
                            >
                                <option value="">{isLaborCategory(category) ? 'Select labour or service...' : 'Select material...'}</option>
                                {availableMaterials.map((material) => (
                                    <option key={material.id} value={material.id}>
                                        {material.name}
                                    </option>
                                ))}
                            </NativeSelect>

                        </div>
                    </Field>
                    <Field className="min-w-0">
                        <FieldLabel htmlFor={`${controlId}-2`}>Quantity</FieldLabel>
                        <Input id={`${controlId}-2`} className="!h-11 bg-sc-background text-sc-foreground transition-none"
                            type="number" inputMode="decimal"
                            value={newQuantity}
                            onChange={(e) => setNewQuantity(e.target.value)}
                            min="0"
                            step="0.01"
                        />
                    </Field>
                </FieldGroup>
                <div className="form-actions">
                    <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
                    <Button variant="primary" size="sm" loading={isAdding} onClick={onAdd}>Add item</Button>
                </div>
            </div>
    );
}
