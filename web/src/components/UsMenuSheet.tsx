import { useEffect } from "react";
import { Link } from "react-router-dom";
import { authClient } from "../lib/api";
import { useTheme, type Theme } from "../hooks/useTheme";
import { usePwaInstall } from "../hooks/usePwaInstall";
import {
  SettingsIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  AddToHomeScreenIcon,
  ChevronRightIcon,
  UploadIcon,
} from "./OrbitIcons";

interface UsMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UsMenuSheet({ isOpen, onClose }: UsMenuSheetProps) {
  const { data: session } = authClient.useSession();
  const { theme, setTheme } = useTheme();
  const { triggerInstall, isStandalone } = usePwaInstall();

  // 关闭时防止 body 滚动
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  const cycleTheme = () => {
    const next: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
    setTheme(next[theme]);
  };

  if (!isOpen) return null;

  const user = session?.user;
  const displayName = user?.name || user?.email?.split("@")[0] || "用户";
  const avatarChar = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-start" role="dialog" aria-modal="true">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 侧边抽屉面板 */}
      <div
        className="relative z-10 h-full bg-[var(--color-surface)] shadow-2xl flex flex-col justify-between orbit-us-menu-panel"
        style={{
          width: "75vw",
          maxWidth: "290px",
          paddingTop: "max(env(safe-area-inset-top, 0px), 1rem)",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.75rem)",
        }}
      >
        <div className="flex flex-col">
          {/* 1. 顶部：通透轻盈的个人身份卡片 */}
          <div className="px-5 pt-3 pb-5 border-b border-[var(--color-border-light)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-primary)] flex items-center justify-center font-heading font-medium text-sm shrink-0">
              {avatarChar}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-medium text-[var(--color-text-primary)] truncate text-base leading-tight">
                {displayName}
              </p>
              {user?.email && (
                <p className="text-xs text-[var(--color-text-muted)] truncate font-sans mt-0.5">
                  {user.email}
                </p>
              )}
            </div>
          </div>

          {/* 2. 中部：单行呼吸感系统入口（无二级冗余说明） */}
          <div className="px-3 pt-4 space-y-2">
            {/* 系统设置：层内跳页面用 replace，返回时不再浮出已关闭的菜单 */}
            <Link
              to="/settings"
              replace
              className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-[var(--color-surface-raised)]/50 hover:bg-[var(--color-surface-raised)] transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <SettingsIcon size="sm" className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors shrink-0" />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">系统设置</span>
              </div>
              <ChevronRightIcon size="sm" className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors opacity-70" />
            </Link>

            {/* 数据导入与导出（预留系统位） */}
            <div className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-[var(--color-surface-raised)]/20 border border-dashed border-[var(--color-border)]">
              <div className="flex items-center gap-3 min-w-0">
                <UploadIcon size="sm" className="text-[var(--color-text-muted)] opacity-60 shrink-0" />
                <span className="text-sm font-medium text-[var(--color-text-muted)]">数据导入与导出</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-border-light)] text-[var(--color-text-muted)] font-sans">
                即将推出
              </span>
            </div>
          </div>
        </div>

        {/* 3. 底部：实用系统小工具底栏 */}
        <div
          className={`px-3 pt-3 pb-2 border-t border-[var(--color-border-light)] flex items-center ${
            isStandalone ? "justify-center" : "justify-around"
          }`}
        >
          {/* 外观模式切换 */}
          <button
            type="button"
            onClick={cycleTheme}
            className="flex items-center gap-2 py-2 px-2.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            title="切换外观"
          >
            {theme === "dark" ? <MoonIcon size="sm" /> : theme === "system" ? <MonitorIcon size="sm" /> : <SunIcon size="sm" />}
            <span>{theme === "dark" ? "深色模式" : theme === "system" ? "系统外观" : "浅色模式"}</span>
          </button>

          {!isStandalone && (
            <>
              <div className="h-4 w-px bg-[var(--color-border-light)]" />

              {/* 安装到桌面 / 客户端 */}
              <button
                type="button"
                onClick={() => void triggerInstall()}
                className="flex items-center gap-2 py-2 px-2.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
                title="添加应用到主屏幕"
              >
                <AddToHomeScreenIcon size="sm" />
                <span>安装到桌面</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
