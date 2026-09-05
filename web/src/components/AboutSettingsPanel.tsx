import { useState } from "react";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { usePwaUpdate } from "../hooks/usePwaUpdate";
import { useToast } from "../hooks/useToast";
import { Badge, Button, Section } from "./ui";

export function AboutSettingsPanel() {
  const { isStandalone, canPrompt, setGuideOpen, triggerInstall } = usePwaInstall();
  const { needRefresh, checking, checkForUpdate, applyUpdate, forceRefresh } = usePwaUpdate();
  const toast = useToast();
  const [clearing, setClearing] = useState(false);

  async function handleCheckUpdate() {
    try {
      const result = await checkForUpdate();
      if (result.hasUpdate) {
        toast.success("发现新版本，已准备就绪");
      } else {
        toast.success(`当前已是最新版本 (v${__APP_VERSION__})`);
      }
    } catch {
      toast.error("检查更新失败，请稍后重试");
    }
  }

  async function handleApplyUpdate() {
    try {
      await applyUpdate();
    } catch {
      toast.error("激活更新失败，请尝试清除缓存刷新");
    }
  }

  async function handleForceRefresh() {
    setClearing(true);
    toast.success("正在清除本地缓存并重新拉取…");
    try {
      await forceRefresh();
    } catch {
      toast.error("清除缓存失败，正在直接重载");
      window.location.reload();
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">关于</h2>
      </header>

      <Section title="应用">
        <div className="orbit-settings-info-card">
          <div className="orbit-settings-info-row">
            <div className="flex flex-col gap-0.5">
              <span className="orbit-settings-info-label">版本</span>
              <span className="orbit-settings-mono-val whitespace-nowrap">Orbit v{__APP_VERSION__}</span>
            </div>
            <div className="orbit-settings-info-value shrink-0">
              <Badge variant={needRefresh ? "accent" : "default"}>
                {checking ? "检查中…" : needRefresh ? "发现新版本" : "已是最新"}
              </Badge>

              {needRefresh ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void handleApplyUpdate()}
                >
                  立即更新
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={checking}
                  onClick={() => void handleCheckUpdate()}
                >
                  检查更新
                </Button>
              )}
            </div>
          </div>

          <div className="orbit-settings-info-row">
            <span className="orbit-settings-info-label">缓存</span>
            <div className="orbit-settings-info-value shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={clearing}
                onClick={() => void handleForceRefresh()}
              >
                清除缓存
              </Button>
            </div>
          </div>

          <div className="orbit-settings-info-row">
            <span className="orbit-settings-info-label">运行环境</span>
            <div className="orbit-settings-info-value shrink-0">
              <Badge variant={isStandalone ? "accent" : "default"}>
                {isStandalone ? "独立应用" : "浏览器网页"}
              </Badge>

              {!isStandalone && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (canPrompt) {
                      void triggerInstall();
                    } else {
                      setGuideOpen(true);
                    }
                  }}
                >
                  {canPrompt ? "安装应用" : "查看安装指引"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
