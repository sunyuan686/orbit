import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import {
  IosShareIcon,
  AddToHomeScreenIcon,
  PlusIcon,
  MonitorIcon,
  AlertIcon,
  CheckIcon,
} from "./OrbitIcons";
import { usePwaInstall } from "../hooks/usePwaInstall";

interface PwaInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PwaInstallGuideModal({ isOpen, onClose }: PwaInstallGuideModalProps) {
  const { isIOS, isInAppBrowser, isStandalone } = usePwaInstall();

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isStandalone ? "已安装为独立应用" : "添加 Orbit 到主屏幕"}
      subtitle={
        isStandalone
          ? "你已在独立应用模式下运行 Orbit"
          : "像原生 App 一样享受全屏阅读与实时推送通知"
      }
      maxWidth="30rem"
      footer={
        <div className="flex justify-end w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>
            我知道了
          </Button>
        </div>
      }
    >
      <div className="orbit-pwa-guide-content space-y-4 text-sm">
        {isStandalone ? (
          <div className="orbit-pwa-guide-step flex items-start gap-3 p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)]">
            <div className="orbit-pwa-guide-step-icon text-[var(--accent)] shrink-0 mt-0.5">
              <CheckIcon size="md" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-[var(--text-primary)]">
                当前设备已完成安装
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                你已从桌面或主屏幕打开 Orbit，享有完整的沉浸式刊物排版与系统推送支持。
              </p>
            </div>
          </div>
        ) : isInAppBrowser ? (
          <div className="space-y-3">
            <div className="orbit-pwa-guide-step flex items-start gap-3 p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)]">
              <div className="orbit-pwa-guide-step-icon text-[var(--accent)] shrink-0 mt-0.5">
                <AlertIcon size="md" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-[var(--text-primary)]">
                  请在系统浏览器中打开
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  当前处于应用内置窗口中，无法直接添加主屏幕。请点击右上角{" "}
                  <span className="font-mono font-medium">···</span>，选择
                  {isIOS ? "「在 Safari 中打开」。" : "「在浏览器中打开」。"}
                </p>
              </div>
            </div>
          </div>
        ) : isIOS ? (
          <div className="space-y-3">
            {/* Step 1 */}
            <div className="orbit-pwa-guide-step flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <div className="orbit-pwa-guide-step-num font-mono text-xs text-[var(--text-muted)] mt-0.5">
                01
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                  <span>轻触底部工具栏的「分享」按钮</span>
                  <span className="inline-flex items-center justify-center p-1 rounded border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)]">
                    <IosShareIcon size="sm" />
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  在 Safari 底部导航栏中央（iPad 在右上方工具栏）找到分享图标。
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="orbit-pwa-guide-step flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <div className="orbit-pwa-guide-step-num font-mono text-xs text-[var(--text-muted)] mt-0.5">
                02
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                  <span>在菜单中选择「添加到主屏幕」</span>
                  <span className="inline-flex items-center justify-center p-1 rounded border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)]">
                    <AddToHomeScreenIcon size="sm" />
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  向上轻划分享面板，向下翻找并点击「添加到主屏幕」选项。
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="orbit-pwa-guide-step flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <div className="orbit-pwa-guide-step-num font-mono text-xs text-[var(--text-muted)] mt-0.5">
                03
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                  <span>点击右上角的「添加」</span>
                  <span className="inline-flex items-center justify-center p-1 rounded border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)]">
                    <PlusIcon size="sm" />
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  确认应用名称为 Orbit，点击右上角添加即可出现在桌面。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-[var(--border-light)] bg-[var(--surface-raised)] text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="text-[var(--accent)] shrink-0 mt-0.5" aria-hidden="true">
                <AlertIcon size="sm" />
              </span>
              <p>
                <strong className="text-[var(--text-primary)]">重要提示</strong>
                ：受 iOS 系统策略限制，若需使用 Web Push
                手机推送通知，必须将 Orbit 添加到主屏幕后，从主屏幕图标启动并在设置中开启。
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="orbit-pwa-guide-step flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <div className="orbit-pwa-guide-step-num font-mono text-xs text-[var(--text-muted)] mt-0.5">
                <MonitorIcon size="sm" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-medium text-[var(--text-primary)]">
                  桌面或移动端浏览器安装
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  • <strong>Chrome / Edge</strong>：点击地址栏右侧的「安装应用」图标，或点击浏览器菜单中的「安装 Orbit」。<br />
                  • <strong>macOS Safari 17+</strong>：点击顶部菜单栏「文件」→「添加到程序坞...」。<br />
                  • <strong>Android</strong>：点击浏览器右上角菜单，选择「添加到主屏幕」或「安装应用」。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
