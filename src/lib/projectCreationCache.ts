import { BOQItem, Project } from '@/lib/database.types';

export interface OptimisticProjectCard {
  id: string;
  name: string;
  location: string;
  type?: string;
}

export interface CreatedProjectSnapshot {
  project: Project;
  items: BOQItem[];
  createdAt: string;
}

const OPTIMISTIC_PROJECT_KEY = 'zimestimate_optimistic_project';
const CREATED_PROJECT_SNAPSHOT_KEY = 'zimestimate_created_project_snapshot';

const canUseStorage = () => typeof window !== 'undefined';

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const getOptimisticProjectCard = (): OptimisticProjectCard | null => {
  if (!canUseStorage()) return null;
  const parsed = safeParse<OptimisticProjectCard>(sessionStorage.getItem(OPTIMISTIC_PROJECT_KEY));
  if (!parsed?.id || !parsed?.name) return null;
  return {
    id: parsed.id,
    name: parsed.name,
    location: parsed.location || '',
    type: parsed.type,
  };
};

export const setOptimisticProjectCard = (card: OptimisticProjectCard) => {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(
      OPTIMISTIC_PROJECT_KEY,
      JSON.stringify({
        id: card.id,
        name: card.name,
        location: card.location || '',
        type: card.type,
      })
    );
  } catch {
    // Ignore storage errors
  }
};

export const clearOptimisticProjectCard = (projectId?: string) => {
  if (!canUseStorage()) return;
  if (!projectId) {
    sessionStorage.removeItem(OPTIMISTIC_PROJECT_KEY);
    return;
  }

  const current = getOptimisticProjectCard();
  if (current?.id === projectId) {
    sessionStorage.removeItem(OPTIMISTIC_PROJECT_KEY);
  }
};

export const getCreatedProjectSnapshot = (projectId?: string): CreatedProjectSnapshot | null => {
  if (!canUseStorage()) return null;
  const parsed = safeParse<CreatedProjectSnapshot>(sessionStorage.getItem(CREATED_PROJECT_SNAPSHOT_KEY));
  if (!parsed?.project?.id) return null;
  if (projectId && parsed.project.id !== projectId) return null;
  if (!Array.isArray(parsed.items)) return null;
  return parsed;
};

export const setCreatedProjectSnapshot = (snapshot: { project: Project; items: BOQItem[] }) => {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(
      CREATED_PROJECT_SNAPSHOT_KEY,
      JSON.stringify({
        project: snapshot.project,
        items: snapshot.items || [],
        createdAt: new Date().toISOString(),
      } satisfies CreatedProjectSnapshot)
    );
  } catch {
    // Ignore storage errors
  }
};

export const clearCreatedProjectSnapshot = (projectId?: string) => {
  if (!canUseStorage()) return;
  if (!projectId) {
    sessionStorage.removeItem(CREATED_PROJECT_SNAPSHOT_KEY);
    return;
  }

  const snapshot = getCreatedProjectSnapshot(projectId);
  if (snapshot?.project?.id === projectId) {
    sessionStorage.removeItem(CREATED_PROJECT_SNAPSHOT_KEY);
  }
};
