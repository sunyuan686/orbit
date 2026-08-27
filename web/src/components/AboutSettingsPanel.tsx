import { usePwaInstall } from "../hooks/usePwaInstall";
import { Badge, Button, Section } from "./ui";

export function AboutSettingsPanel() {
  const { isStandalone, canPrompt, setGuideOpen, triggerInstall } = usePwaInstall();

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">关于</h2>
      </header>

      <Section title="应用">
        <div className="orbit-settings-info-card">
          <div className="orbit-settings-info-row">
            <span className="orbit-settings-info-label">版本</span>
            <div className="orbit-settings-info-value">
              <span className="orbit-settings-mono-val">Orbit v0.2.0</span>
              <Badge variant="accent">最新</Badge>
            </div>
          </div>

          <div className="orbit-settings-info-row">
            <span className="orbit-settings-info-label">运行环境</span>
            <div className="orbit-settings-info-value">
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
