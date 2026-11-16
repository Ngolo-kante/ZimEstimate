export interface ZbmsMapping {
  materialId: string;
  zbmsProductIds: number[];
  factor: number;
  unit: string;
  note: string;
}

// Intentionally empty until the owner confirms docs/tasks/zbms-matches.md.
export const ZBMS_PRODUCTS: ZbmsMapping[] = [];
