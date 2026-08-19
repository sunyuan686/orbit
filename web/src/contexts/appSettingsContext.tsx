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
  fetchAppSettings,
  getApiErrorMessage,
  shouldToastApiError,
  type AppSettings,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../hooks/useToast";

interface AppSettingsContextValue {
  settings: AppSettings | null;
  loading: boolean;
  reload: () => Promise<void>;
  setSettings: (settings: AppSettings) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { error: toastError } = useToast();
  const queryClient = useQueryClient();
  const toastedError = useRef<unknown>(null);

  const { data: settings = null, isPending: loading, error } = useQuery({
    queryKey: queryKeys.appSettings,
    queryFn: fetchAppSettings,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!error || toastedError.current === error) return;
    toastedError.current = error;
    if (shouldToastApiError(error)) {
      toastError(getApiErrorMessage(error, "加载设置失败"));
    }
  }, [error, toastError]);

  const reload = useCallback(async () => {
    try {
      await queryClient.fetchQuery({
        queryKey: queryKeys.appSettings,
        queryFn: fetchAppSettings,
        staleTime: 0,
      });
    } catch (err) {
      if (shouldToastApiError(err)) {
        toastError(getApiErrorMessage(err, "加载设置失败"));
      }
    }
  }, [queryClient, toastError]);

  const setSettings = useCallback(
    (next: AppSettings) => {
      queryClient.setQueryData(queryKeys.appSettings, next);
    },
    [queryClient]
  );

  const value = useMemo(
    () => ({ settings, loading, reload, setSettings }),
    [settings, loading, reload, setSettings]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return ctx;
}
