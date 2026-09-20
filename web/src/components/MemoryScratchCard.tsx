import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSpaceTodayKey } from "@orbit/shared";
import {
  fetchDailyScratchCard,
  fetchRandomScratchCard,
  type ScratchCardData,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../hooks/useToast";
import { ScratchCard } from "./ScratchCard";
import { RefreshIcon } from "./OrbitIcons";

export function MemoryScratchCard() {
  const toast = useToast();
  const todayDateKey = useMemo(() => getSpaceTodayKey(), []);

  const [customCard, setCustomCard] = useState<ScratchCardData | null>(null);
  const [scratchSeed, setScratchSeed] = useState<string | number>(todayDateKey);
  const [isDailyRevealed, setIsDailyRevealed] = useState(() => {
    try {
      return (
        localStorage.getItem(`orbit_scratch_revealed_${todayDateKey}`) === "true"
      );
    } catch {
      return false;
    }
  });
  const [isRoamRevealed, setIsRoamRevealed] = useState(false);
  const [isDrawingRoam, setIsDrawingRoam] = useState(false);

  const scratchCardQuery = useQuery({
    queryKey: queryKeys.scratchCard(todayDateKey),
    queryFn: () => fetchDailyScratchCard(todayDateKey),
  });

  const currentCard: ScratchCardData | null =
    customCard ?? scratchCardQuery.data?.card ?? null;
  const isCurrentCardDaily = !customCard;
  const isCurrentRevealed = isCurrentCardDaily
    ? isDailyRevealed
    : isRoamRevealed;

  const handleScratchComplete = () => {
    if (isCurrentCardDaily) {
      setIsDailyRevealed(true);
      try {
        localStorage.setItem(`orbit_scratch_revealed_${todayDateKey}`, "true");
      } catch {
        // ignore
      }
    } else {
      setIsRoamRevealed(true);
    }
  };

  const handleDrawRoamCard = async () => {
    if (isDrawingRoam) return;
    setIsDrawingRoam(true);
    try {
      const res = await fetchRandomScratchCard(currentCard?.id);
      setCustomCard(res.card);
      setScratchSeed(`${res.card.id}-${Date.now()}`);
      setIsRoamRevealed(false);
    } catch {
      toast.error("抽取失败，请重试");
    } finally {
      setIsDrawingRoam(false);
    }
  };

  if (!scratchCardQuery.isLoading && !currentCard) {
    return null;
  }

  return (
    <section className="orbit-home-section" aria-label="时光记忆卡">
      <div className="orbit-scratch-card" data-type={currentCard?.type}>
        {scratchCardQuery.isLoading && !currentCard ? (
          <div className="orbit-scratch-skeleton" aria-hidden />
        ) : currentCard ? (
          <>
            {isCurrentRevealed && (
              <button
                type="button"
                className={`orbit-scratch-float-btn${
                  isDrawingRoam ? " is-spinning" : ""
                }`}
                onClick={handleDrawRoamCard}
                disabled={isDrawingRoam}
                title="换一段记忆"
                aria-label="换一段记忆"
              >
                <RefreshIcon size="sm" />
              </button>
            )}
            <ScratchCard
              seed={scratchSeed}
              isAlreadyRevealed={isCurrentRevealed}
              onScratchComplete={handleScratchComplete}
              coverText={
                isCurrentCardDaily ? "拂 开 旧 时 光" : "时 光 漫 游"
              }
              autoOpenModal={!isCurrentRevealed && Boolean(customCard)}
            >
              <div className="orbit-scratch-card-body">
                <div className="orbit-scratch-card-top">
                  {currentCard.badge && (
                    <span className="orbit-scratch-badge">
                      {currentCard.badge}
                    </span>
                  )}
                  {currentCard.meta && (
                    <span className="orbit-scratch-meta">
                      {currentCard.meta}
                    </span>
                  )}
                </div>
                {currentCard.title && (
                  <h3 className="orbit-scratch-title">
                    {currentCard.title}
                  </h3>
                )}
                <blockquote className="orbit-scratch-quote">
                  “{currentCard.quote}”
                </blockquote>
                {currentCard.link && (
                  <Link
                    to={currentCard.link}
                    className="orbit-scratch-link"
                  >
                    {currentCard.linkText || "查看全文 →"}
                  </Link>
                )}
              </div>
            </ScratchCard>
          </>
        ) : null}
      </div>
    </section>
  );
}
