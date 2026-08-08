import { Link, useNavigate } from "react-router-dom";
import { TYPE_LABEL } from "../lib/api";
import { ArrowLeftIcon, NotFoundIcon } from "./OrbitIcons";

type NotFoundStateProps = {
  /** 资源类型（如 diary, letter, memo, timeline 等） */
  type?: string;
  /** 自定义主标题 */
  title?: string;
  /** 自定义副标题描述 */
  description?: string;
  /** 点击返回列表或自定义回调 */
  onBack?: () => void;
};

export function NotFoundState({
  type,
  title,
  description,
  onBack,
}: NotFoundStateProps) {
  const navigate = useNavigate();

  const typeLabel = type ? (TYPE_LABEL[type] || "列表") : "列表";
  const displayTitle = title || "记录似乎散落在星海中";
  const displayDescription =
    description ||
    `或许是链接输入有误，或者这篇${type ? TYPE_LABEL[type] || "内容" : "内容"}已被作者收回。没关系，在漫漫轨道上，依然有许多美好的时光值得重温。`;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (type) {
      navigate(`/${type}`);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="orbit-not-found-container" role="status">
      <div className="orbit-not-found-card">
        {/* 背景光晕与装饰矢量星轨图 */}
        <div className="orbit-not-found-illustration">
          <div className="orbit-not-found-glow" aria-hidden />
          <div className="orbit-not-found-icon-wrapper">
            <NotFoundIcon className="orbit-not-found-svg" />
          </div>
        </div>

        {/* 衬线标题与描述 */}
        <div className="orbit-not-found-body">
          <span className="orbit-not-found-badge">404 NOT FOUND</span>
          <h2 className="orbit-not-found-title">{displayTitle}</h2>
          <p className="orbit-not-found-desc">{displayDescription}</p>
        </div>

        {/* 快捷操作区 */}
        <div className="orbit-not-found-actions">
          <button
            type="button"
            onClick={handleBack}
            className="orbit-btn orbit-btn-primary orbit-not-found-btn"
          >
            <ArrowLeftIcon size="sm" />
            返回{typeLabel}
          </button>

          {type && (
            <Link
              to={`/${type}/new`}
              className="orbit-btn orbit-not-found-btn"
            >
              写新{TYPE_LABEL[type] || "内容"}
            </Link>
          )}

          <Link
            to="/"
            className="orbit-btn orbit-btn-ghost orbit-not-found-btn"
          >
            回到首页
          </Link>
        </div>
      </div>
    </div>
  );
}
