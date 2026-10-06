import { useSyncExternalStore } from "react";

import { cartCount, createCartStore } from "./cart-store";

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const cartStore = createCartStore(safeLocalStorage());

export const useCartLines = () =>
  useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getSnapshot);

export const useCartCount = () => cartCount(useCartLines());
