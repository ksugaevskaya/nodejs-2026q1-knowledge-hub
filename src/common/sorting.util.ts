import { SortOrder } from './types';

export function sortItems<T>(
  items: T[],
  sortBy?: string,
  order: SortOrder = 'asc',
): T[] {
  if (!sortBy) {
    return items;
  }

  const sorted = [...items].sort((a, b) => {
    const aValue = (a as Record<string, unknown>)[sortBy];
    const bValue = (b as Record<string, unknown>)[sortBy];

    if (aValue < bValue) {
      return order === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return order === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return sorted;
}
