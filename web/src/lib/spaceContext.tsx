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
  fetchSpace,
  getApiErrorMessage,
  shouldToastApiError,
  type SpaceProfile,
} from "./api";
import { useToast } from "./useToast";

interface SpaceContextValue {
  profile: SpaceProfile | null;
  loading: boolean;
  reload: () => Promise<void>;
  setProfile: (profile: SpaceProfile) => void;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

export function SpaceProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [profile, setProfile] = useState<SpaceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchSpace();
      setProfile(next);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "加载空间档案失败"));
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(
    () => ({ profile, loading, reload, setProfile }),
    [profile, loading, reload]
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
