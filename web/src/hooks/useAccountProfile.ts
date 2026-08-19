import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAccountProfile,
  updateVoiceTranscribeMode,
  type VoiceTranscribeMode,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";

export function useAccountProfile() {
  const queryClient = useQueryClient();
  const { data: profile = null, isLoading } = useQuery({
    queryKey: queryKeys.accountProfile,
    queryFn: fetchAccountProfile,
    staleTime: 5 * 60_000,
  });

  const updateVoiceModeMutation = useMutation({
    mutationFn: (mode: VoiceTranscribeMode) => updateVoiceTranscribeMode(mode),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.accountProfile, updated);
    },
  });

  return {
    profile,
    isLoading,
    updateVoiceMode: updateVoiceModeMutation.mutateAsync,
  };
}
