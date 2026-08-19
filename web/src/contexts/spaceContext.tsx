import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSpace,
  getApiErrorMessage,
  shouldToastApiError,
  type SpaceProfile,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../hooks/useToast";

interface SpaceContextValue {
  profile: SpaceProfile | null;
  loading: boolean;
  reload: () => Promise<void>;
  setProfile: (profile: SpaceProfile) => void;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

export function SpaceProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const toastedError = useRef<unknown>(null);

  const { data: profile = null, isPending: loading, error } = useQuery({
    queryKey: queryKeys.space,
    queryFn: fetchSpace,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!error || toastedError.current === error) return;
    toastedError.current = error;
    if (shouldToastApiError(error)) {
      toast.error(getApiErrorMessage(error, "加载空间档案失败"));
    }
  }, [error, toast]);

  const reload = useCallback(async () => {
    try {
      await queryClient.fetchQuery({
        queryKey: queryKeys.space,
        queryFn: fetchSpace,
        staleTime: 0,
      });
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "加载空间档案失败"));
      }
    }
  }, [queryClient, toast]);

  const setProfile = useCallback(
    (next: SpaceProfile) => {
      queryClient.setQueryData(queryKeys.space, next);
    },
    [queryClient]
  );

  const value = useMemo(
    () => ({ profile, loading, reload, setProfile }),
    [profile, loading, reload, setProfile]
  );

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace(): SpaceContextValue {
  const ctx = useContext(SpaceContext);
  if (!ctx) {
    throw new Error("useSpace must be used within SpaceProvider");
  }
  return ctx;
}
