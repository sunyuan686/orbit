import { useLocation } from "react-router-dom";
import { TabItem } from "./TabItem";
import {
  MomentIcon,
  AlbumIcon,
  LetterIcon,
  UsIcon,
  PlusIcon,
} from "../OrbitIcons";

export interface TabBarProps {
  onComposeClick: () => void;
  unreadLetterCount?: number;
}

export function TabBar({ onComposeClick, unreadLetterCount }: TabBarProps) {
  const location = useLocation();
  const path = location.pathname;

  // 判断是否处于各支柱页面
  const isMoment = path === "/" || path.startsWith("/moment");
  const isAlbum = path.startsWith("/albums");
  const isLetter = path.startsWith("/letter");
  const isUs = path.startsWith("/us") || path.startsWith("/settings") || path.startsWith("/memories");

  return (
    <nav
      aria-label="底部导航栏"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface)]/90 backdrop-blur-md border-t border-[var(--color-border-light)]"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 6px)",
      }}
    >
      <div className="max-w-md mx-auto h-13 flex items-center justify-between px-2">
        <TabItem
          to="/"
          label="动态"
          icon={<MomentIcon size="md" />}
          isActiveOverride={isMoment}
        />
        <TabItem
          to="/albums"
          label="相册"
          icon={<AlbumIcon size="md" />}
          isActiveOverride={isAlbum}
        />

        {/* 核心中央即时创建按钮 */}
        <div className="flex-1 flex items-center justify-center">
          <button
            type="button"
            onClick={onComposeClick}
            aria-label={isLetter ? "写信" : "新建"}
            title={isLetter ? "写信" : "新建"}
            className="w-11 h-11 rounded-full bg-[var(--color-text-primary)] text-[var(--color-surface)] flex items-center justify-center shadow-md active:scale-95 transition-[transform,background-color,box-shadow] duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <PlusIcon size="md" className="stroke-[2.2]" />
          </button>
        </div>

        <TabItem
          to="/letter"
          label="信箱"
          icon={<LetterIcon size="md" />}
          badge={unreadLetterCount}
          isActiveOverride={isLetter}
        />
        <TabItem
          to="/us"
          label="我们"
          icon={<UsIcon size="md" />}
          isActiveOverride={isUs}
        />
      </div>
    </nav>
  );
}
