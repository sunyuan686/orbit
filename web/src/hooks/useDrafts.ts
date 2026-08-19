import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { fetchDrafts, type EntrySummary } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";

/**
 * 跨组件共享的声明式草稿数据 Hook
 * 单一事实来源 (Single Source of Truth)
 */
export function useDrafts(type: string | undefined) {
  const queryClient = useQueryClient();
  const normalizedType = type || "";

  const query = useQuery<EntrySummary[]>({
    queryKey: queryKeys.drafts(normalizedType),
    queryFn: () => fetchDrafts(normalizedType),
    enabled: Boolean(normalizedType),
    staleTime: 1000 * 30, // 30秒内保持缓存
  });

  const invalidate = useCallback(() => {
    if (!normalizedType) return Promise.resolve();
    return queryClient.invalidateQueries({
      queryKey: queryKeys.drafts(normalizedType),
    });
  }, [queryClient, normalizedType]);

  return {
    drafts: query.data ?? [],
    count: query.data?.length ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    invalidate,
  };
}
