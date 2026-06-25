import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchAppSettings,
  getApiErrorMessage,
  shouldToastApiError,
  type AccentPreset,
  type AppSettings,
} from "./api";
import { applyAccentPreset } from "./accent";
import { useToast } from "./useToast";

interface AppSettingsContextValue {
  settings: AppSettings | null;
  loading: boolean;
  reload: () => Promise<void>;
  setSettings: (settings: AppSettings) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const applySettings = useCallback((next: AppSettings) => {
    setSettingsState(next);
    applyAccentPreset(next.accentPreset);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchAppSettings();
      applySettings(next);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "加载设置失败"));
      }
    } finally {
      setLoading(false);
    }
  }, [applySettings, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setSettings = useCallback(
    (next: AppSettings) => {
      applySettings(next);
    },
    [applySettings]
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

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return ctx;
}

export type { AccentPreset };
