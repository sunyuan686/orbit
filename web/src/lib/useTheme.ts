import { useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "orbit-theme";

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDark(dark: boolean) {
  const root = document.documentElement;
  root.setAttribute("data-theme-switching", "");
  root.classList.toggle("dark", dark);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.removeAttribute("data-theme-switching");
    });
  });
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored || "system";
  });

  // 应用主题
  const apply = useCallback((t: Theme) => {
    if (t === "system") {
      applyDark(getSystemDark());
    } else {
      applyDark(t === "dark");
    }
  }, []);

  // 初始化 + theme 变化时应用
  useEffect(() => {
    apply(theme);
  }, [theme, apply]);

  // 监听系统偏好变化（仅 system 模式下响应）
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyDark(mq.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (t === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, t);
    }
  }, []);

  return { theme, setTheme };
}
