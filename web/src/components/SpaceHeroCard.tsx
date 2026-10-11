import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSpace } from "../contexts/spaceContext";
import { queryKeys } from "../lib/queryKeys";
import {
  fetchSpaceStatus,
  formatSpaceTagline,
  type SpaceAuthor,
} from "../lib/api";
import { MemoriesIcon } from "./OrbitIcons";
import { useLayer } from "../hooks/useLayer";
import { UserAboutSheet } from "./UserAboutSheet";
import { SpaceCovenantSheet } from "./SpaceCovenantSheet";

export interface SpaceHeroCardProps {
  onEditClick?: () => void;
}

export function SpaceHeroCard({ onEditClick }: SpaceHeroCardProps) {
  const { profile, loading: spaceLoading } = useSpace();

  const statusQuery = useQuery({
    queryKey: queryKeys.spaceStatus,
    queryFn: fetchSpaceStatus,
  });

  const authors: SpaceAuthor[] = statusQuery.data?.authors ?? [];
  const tagline = formatSpaceTagline(profile);
  const hasAnniversary = profile?.daysTogether != null && profile.daysTogether > 0;

  const {
    isOpen: aboutOpen,
    open: openAbout,
    close: closeAbout,
  } = useLayer("user-about");

  const {
    isOpen: covenantOpen,
    open: openCovenant,
    close: closeCovenant,
  } = useLayer("space-covenant");

  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);

  const selectedAuthor = useMemo(() => {
    if (!selectedAuthorId) return authors[0] ?? null;
    return authors.find((a) => a.id === selectedAuthorId) ?? authors[0] ?? null;
  }, [authors, selectedAuthorId]);

  const handleAuthorClick = (author: SpaceAuthor) => {
    setSelectedAuthorId(author.id);
    openAbout();
  };

  return (
    <>
      <section className="orbit-home-hero" aria-labelledby="space-hero-title">
      <svg
        className="orbit-home-hero-orbit"
        viewBox="0 0 200 120"
        aria-hidden
      >
        <ellipse cx="100" cy="60" rx="92" ry="44" />
        <circle
          className="orbit-home-hero-planet orbit-home-hero-planet--a"
          cx="100"
          cy="16"
          r="4"
        />
        <circle
          className="orbit-home-hero-planet orbit-home-hero-planet--b"
          cx="100"
          cy="104"
          r="4"
        />
      </svg>
      <div className="orbit-home-hero-main">
        {spaceLoading ? (
          <p className="orbit-muted">加载中…</p>
        ) : hasAnniversary ? (
          <>
            <p className="orbit-home-hero-eyebrow" id="space-hero-title">
              {authors.length > 0 ? (
                authors.map((author, index) => (
                  <span key={author.id}>
                    {index > 0 && <span className="opacity-50 px-1.5 font-normal select-none">&</span>}
                    <button
                      type="button"
                      onClick={() => handleAuthorClick(author)}
                      className="cursor-pointer hover:text-[var(--color-accent)] transition-colors border-b border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] pb-0.5"
                      title={`查看关于${author.name}的随身手帖`}
                    >
                      {author.name}
                    </button>
                  </span>
                ))
              ) : (
                "我们的空间"
              )}
            </p>
            <button
              type="button"
              onClick={openCovenant}
              className="orbit-home-hero-days text-left cursor-pointer group hover:opacity-90 transition-opacity block"
              title="查看我们的约定"
              aria-label={`在一起第 ${profile!.daysTogether} 天，点击查看我们的约定`}
            >
              <span className="group-hover:text-[var(--color-accent)] transition-colors">
                {profile!.daysTogether!.toLocaleString("zh-CN")}
              </span>
              <span className="orbit-home-hero-days-unit">天</span>
            </button>
          </>
        ) : (
          <>
            <p className="orbit-home-hero-eyebrow" id="space-hero-title">
              {authors.length > 0 ? (
                authors.map((author, index) => (
                  <span key={author.id}>
                    {index > 0 && <span className="opacity-50 px-1.5 font-normal select-none">&</span>}
                    <button
                      type="button"
                      onClick={() => handleAuthorClick(author)}
                      className="cursor-pointer hover:text-[var(--color-accent)] transition-colors border-b border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] pb-0.5"
                      title={`查看关于${author.name}的随身手帖`}
                    >
                      {author.name}
                    </button>
                  </span>
                ))
              ) : (
                "我们的空间"
              )}
            </p>
            <p className="orbit-home-hero-greeting">{tagline}</p>
            <p className="orbit-home-hero-sub">
              <button
                type="button"
                onClick={onEditClick ?? openCovenant}
                className="orbit-text-link cursor-pointer"
              >
                设置纪念日
              </button>
              ，让每一天都有计数
            </p>
          </>
        )}
      </div>
      <div className="orbit-home-hero-side">
        <Link to="/memories" className="orbit-home-hero-link" title="漫游记忆星图">
          <MemoriesIcon size="sm" />
          <span>记忆星图</span>
        </Link>
      </div>
    </section>

    <UserAboutSheet
      isOpen={aboutOpen}
      onClose={closeAbout}
      author={selectedAuthor}
      onUpdated={() => {
        statusQuery.refetch();
      }}
    />
    <SpaceCovenantSheet
      isOpen={covenantOpen}
      onClose={closeCovenant}
    />
  </>
);
}
