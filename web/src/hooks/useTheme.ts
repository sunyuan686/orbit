import { useState, useEffect, useCallback, useRef } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "orbit-theme";

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDark(dark: boolean, isInitial = false) {
  const root = document.documentElement;
  const isDarkNow = root.classList.contains("dark");

  if (isInitial && isDarkNow === dark) {
    // 首帧已由 index.html 同步脚本注入，避免初次挂载时无谓触发 data-theme-switching 重排
    return;
  }

  root.setAttribute("data-theme-switching", "");
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";

  const themeColorMetas = document.querySelectorAll('meta[name="theme-color"]');
  themeColorMetas.forEach((meta) => {
    meta.setAttribute("content", dark ? "#131315" : "#fafaf9");
  });

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
  const initialApplied = useRef(false);

  // 应用主题
  const apply = useCallback((t: Theme) => {
    const dark = t === "system" ? getSystemDark() : t === "dark";
    const isInitial = !initialApplied.current;
    initialApplied.current = true;
    applyDark(dark, isInitial);
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
