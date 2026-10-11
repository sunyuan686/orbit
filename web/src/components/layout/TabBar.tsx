import { useLocation } from "react-router-dom";
import { TabItem } from "./TabItem";
import { getActiveTabKey } from "../../lib/tabNavigation";
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
  const activeTabKey = getActiveTabKey(location.pathname);

  // 由单一真相源判断当前激活支柱
  const isMoment = activeTabKey === "moment";
  const isAlbum = activeTabKey === "albums";
  const isLetter = activeTabKey === "letter";
  const isUs = activeTabKey === "us";

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
          tabKey="moment"
        />
        <TabItem
          to="/albums"
          label="相册"
          icon={<AlbumIcon size="md" />}
          isActiveOverride={isAlbum}
          tabKey="albums"
        />

        {/* 核心中央即时创建按钮 */}
        <div className="flex-1 flex items-center justify-center">
          <button
            type="button"
            onClick={onComposeClick}
            aria-label={isLetter ? "写信" : "新建"}
            title={isLetter ? "写信" : "新建"}
            className="w-10 h-10 rounded-full bg-[var(--color-text-primary)] text-[var(--color-surface)] dark:bg-[var(--color-surface-raised)] dark:border dark:border-[var(--color-border)] dark:text-[var(--color-text-primary)] flex items-center justify-center shadow-xs active:scale-95 transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
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
          tabKey="letter"
        />
        <TabItem
          to="/us"
          label="我们"
          icon={<UsIcon size="md" />}
          isActiveOverride={isUs}
          tabKey="us"
        />
      </div>
    </nav>
  );
}
