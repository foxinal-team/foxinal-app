export type InventoryLayout = "list" | "grid";
export type InventorySort = "asc" | "desc";

const LAYOUT_KEY = "foxinal-inventory-layout";
const SORT_KEY = "foxinal-inventory-sort";

export function loadInventoryLayout(): InventoryLayout {
  try {
    const value = localStorage.getItem(LAYOUT_KEY);
    return value === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export function saveInventoryLayout(layout: InventoryLayout) {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function loadInventorySort(): InventorySort {
  try {
    const value = localStorage.getItem(SORT_KEY);
    return value === "desc" ? "desc" : "asc";
  } catch {
    return "asc";
  }
}

export function saveInventorySort(sort: InventorySort) {
  try {
    localStorage.setItem(SORT_KEY, sort);
  } catch {
    // Ignore quota / private mode failures.
  }
}
