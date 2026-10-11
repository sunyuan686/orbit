import React from "react";
import { NavLink } from "react-router-dom";

export interface TabItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  isActiveOverride?: boolean;
  tabKey?: "moment" | "albums" | "letter" | "us";
}

export function TabItem({
  to,
  label,
  icon,
  badge,
  isActiveOverride,
  tabKey,
}: TabItemProps) {
  return (
    <NavLink
      to={to}
      // 底栏切换是「换地方」而非「往里走」：用 replace 不累积历史条目，
      // 否则每点一次底栏就多一条记录，返回手势会退化成「访问轨迹」而不是层级回退。
      replace
      onClick={() => {
        if (isActiveOverride && tabKey) {
          window.dispatchEvent(
            new CustomEvent("orbit:scroll-tab-to-top", {
              detail: { tab: tabKey },
            })
          );
        }
      }}
      className={({ isActive }) => {
        const active = isActiveOverride !== undefined ? isActiveOverride : isActive;
        return [
          "orbit-tab-item flex-1 flex flex-col items-center justify-center py-1.5 px-1 relative transition-colors duration-150 select-none",
          active
            ? "text-[var(--color-primary)] font-medium is-active"
            : "text-[var(--color-text-muted)]",
        ].join(" ");
      }}
    >
      <div className="relative flex items-center justify-center w-6 h-6 mb-0.5">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-mono leading-none flex items-center justify-center font-bold">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span className="text-[11px] leading-tight tracking-tight font-sans">
        {label}
      </span>
    </NavLink>
  );
}
