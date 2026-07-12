import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AiArticleMeta = {
  articleId: string;
  title: string;
};

type AiArticleContextValue = {
  meta: AiArticleMeta | null;
  setMeta: (meta: AiArticleMeta | null) => void;
};

const AiArticleContext = createContext<AiArticleContextValue | null>(null);

export function AiArticleProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<AiArticleMeta | null>(null);
  const value = useMemo(() => ({ meta, setMeta }), [meta]);
  return (
    <AiArticleContext.Provider value={value}>{children}</AiArticleContext.Provider>
  );
}

export function useAiArticleMeta() {
  const ctx = useContext(AiArticleContext);
  if (!ctx) {
    throw new Error("useAiArticleMeta must be used within AiArticleProvider");
  }
  return ctx;
}
