import { useEffect, useState } from "react";
import {
  createApiToken,
  fetchApiTokens,
  formatDateTime,
  getApiErrorMessage,
  revokeApiToken,
  shouldToastApiError,
  type ApiTokenListItem,
} from "../lib/api";
import { useToast } from "../lib/useToast";

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const headingId = `settings-section-${title}`;
  return (
    <section className="orbit-settings-section" aria-labelledby={headingId}>
      <h3 id={headingId} className="orbit-settings-heading">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SettingsField({
  label,
  hint,
  children,
  stacked,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  if (!stacked) return null;
  return (
    <div className="orbit-settings-field orbit-settings-field--stacked">
      <div className="orbit-settings-field-copy">
        <span className="orbit-settings-field-label">{label}</span>
        {hint ? <p className="orbit-settings-field-hint">{hint}</p> : null}
      </div>
      <div className="orbit-settings-field-control orbit-settings-field-control--block">
        {children}
      </div>
    </div>
  );
}

function TokenRow({
  item,
  revoking,
  onRevoke,
}: {
  item: ApiTokenListItem;
  revoking: boolean;
  onRevoke: (id: string) => void;
}) {
  return (
    <div className="orbit-settings-token-row">
      <div className="orbit-settings-token-row-main">
        <p className="orbit-settings-token-name">{item.name}</p>
        <p className="orbit-muted orbit-settings-token-meta">
          <code className="orbit-settings-input-mono">{item.tokenPrefix}…</code>
          <span aria-hidden="true"> · </span>
          创建于 {formatDateTime(item.createdAt)}
          {item.lastUsedAt ? (
            <>
              <span aria-hidden="true"> · </span>
              最近使用 {formatDateTime(item.lastUsedAt)}
            </>
          ) : (
            <>
              <span aria-hidden="true"> · </span>
              尚未使用
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        className="orbit-btn orbit-btn-sm orbit-btn-danger"
        disabled={revoking}
        onClick={() => onRevoke(item.id)}
      >
        撤销
      </button>
    </div>
  );
}

export function ApiTokenSettingsPanel() {
  const toast = useToast();
  const [items, setItems] = useState<ApiTokenListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  async function loadTokens() {
    setLoading(true);
    try {
      const data = await fetchApiTokens();
      setItems(data.items);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "加载失败"));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTokens();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const created = await createApiToken(trimmed);
      setRevealedToken(created.token);
      setName("");
      setItems((prev) => [
        {
          id: created.id,
          name: created.name,
          tokenPrefix: created.tokenPrefix,
          author: created.author,
          createdAt: created.createdAt,
          lastUsedAt: created.lastUsedAt,
        },
        ...prev,
      ]);
      toast.success("Token 已创建");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "创建失败"));
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleCopyToken() {
    if (!revealedToken) return;
    try {
      await navigator.clipboard.writeText(revealedToken);
      toast.success("已复制 Token");
    } catch {
      toast.error("复制失败");
    }
  }

  async function handleRevoke(id: string) {
    if (revokingId) return;
    setRevokingId(id);
    try {
      await revokeApiToken(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast.success("Token 已撤销");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "撤销失败"));
      }
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">API Token</h2>
        <p className="orbit-settings-panel-desc">
          生成 Bearer Token，供脚本、Cursor 或 MCP 客户端调用内容 API。Token 以创建者身份写入内容。
        </p>
      </header>

      <SettingsSection title="新建 Token">
        <div className="orbit-settings-fields">
          <SettingsField
            label="名称"
            hint="便于区分用途，例如「本地脚本」「Cursor MCP」。"
            stacked
          >
            <form className="orbit-settings-inline-form orbit-settings-inline-form--wide" onSubmit={(e) => void handleCreate(e)}>
              <input
                className="orbit-input"
                value={name}
                maxLength={64}
                placeholder="用途说明"
                onChange={(event) => setName(event.target.value)}
              />
              <button
                type="submit"
                className="orbit-btn orbit-btn-primary orbit-btn-sm"
                disabled={creating || !name.trim()}
              >
                {creating ? "创建中…" : "创建"}
              </button>
            </form>
          </SettingsField>
        </div>
      </SettingsSection>

      {revealedToken ? (
        <SettingsSection title="请立即保存">
          <div className="orbit-settings-fields">
            <SettingsField
              label="新 Token"
              hint="明文仅显示一次。请复制保存，关闭页面后无法再次查看。"
              stacked
            >
              <div className="orbit-settings-inline-form orbit-settings-inline-form--wide">
                <input
                  className="orbit-input orbit-settings-input-mono"
                  readOnly
                  value={revealedToken}
                  aria-label="新 API Token"
                />
                <button
                  type="button"
                  className="orbit-btn orbit-btn-sm"
                  onClick={() => void handleCopyToken()}
                >
                  复制
                </button>
                <button
                  type="button"
                  className="orbit-btn orbit-btn-ghost orbit-btn-sm"
                  onClick={() => setRevealedToken(null)}
                >
                  我已保存
                </button>
              </div>
            </SettingsField>
          </div>
        </SettingsSection>
      ) : null}

      <SettingsSection title="使用方式">
        <div className="orbit-settings-fields">
          <SettingsField
            label="请求头"
            hint="在 HTTP 请求中附带 Authorization。可访问文章、搜索、评论、相册与 AI 等接口；设置、账户与 Token 管理仍需浏览器登录。"
            stacked
          >
            <pre className="orbit-settings-code-block">
              <code>{`Authorization: Bearer orb_…`}</code>
            </pre>
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection title="已有 Token">
        <div className="orbit-settings-fields">
          {loading ? (
            <p className="orbit-muted">加载中…</p>
          ) : items.length === 0 ? (
            <p className="orbit-muted">暂无有效 Token。</p>
          ) : (
            <div className="orbit-settings-token-list">
              {items.map((item) => (
                <TokenRow
                  key={item.id}
                  item={item}
                  revoking={revokingId === item.id}
                  onRevoke={(id) => void handleRevoke(id)}
                />
              ))}
            </div>
          )}
        </div>
      </SettingsSection>
    </>
  );
}
