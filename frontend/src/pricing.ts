import { useCallback } from "react";

import { useApi } from "@/src/hooks";

// Resolves the locked price for a customer: their type's list price, else the product's base price.
export function usePriceResolver() {
  const types = useApi<any[]>("/customer-types");
  return useCallback(
    (customer: any | null, productId: string, base: number) => {
      const t = customer?.type_id ? types.data?.find((x) => x.id === customer.type_id) : null;
      const p = t?.prices?.[productId];
      return p !== undefined && p !== null ? Number(p) : Number(base || 0);
    },
    [types.data],
  );
}

export function useTypeName() {
  const types = useApi<any[]>("/customer-types");
  return (id?: string | null) => (id ? types.data?.find((t) => t.id === id)?.name : undefined);
}
