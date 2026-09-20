import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  fetchTags,
  createTag,
  updateTag,
  deleteTag,
  type TagItem,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";

/**
 * 全站动态标签的唯一事实来源 Hook (Single Source of Truth)
 */
export function useMomentTags() {
  const queryClient = useQueryClient();

  const {
    data: tags = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<TagItem[]>({
    queryKey: queryKeys.tags,
    queryFn: fetchTags,
    staleTime: 1000 * 60 * 5, // 5分钟缓存
  });

  const tagMap = useMemo(() => {
    const map: Record<string, TagItem> = {};
    for (const t of tags) {
      map[t.id] = t;
    }
    return map;
  }, [tags]);

  const createMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; color?: string; sortOrder?: number };
    }) => updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });

  return {
    tags,
    tagMap,
    isLoading,
    isError,
    refetch,
    createTag: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTag: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTag: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
