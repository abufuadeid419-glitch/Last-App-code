import { useMutation, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/ui";

export function useApi<T = any>(path: string, enabled = true) {
  return useQuery<T>({ queryKey: [path], queryFn: () => api<T>(path), enabled });
}

export function useMutate<B = any>(method: string, path: string | ((b: B) => string), success?: string, onDone?: (r: any) => void) {
  const toast = useToast();
  return useMutation({
    mutationFn: (body: B) =>
      api(typeof path === "function" ? path(body) : path, { method, body: method === "DELETE" ? undefined : body }),
    onSuccess: (r) => {
      queryClient.invalidateQueries();
      if (success) toast(success);
      onDone?.(r);
    },
    onError: (e: any) => toast(e.message, "error"),
  });
}

// Bottom padding for content inside a tab screen.
export function useBottomChrome() {
  const insets = useSafeAreaInsets();
  return usesNativeTabs ? insets.bottom : 0;
}
