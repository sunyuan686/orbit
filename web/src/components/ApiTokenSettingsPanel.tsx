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
import { useToast } from "../hooks/useToast";
import { Button, Input, Field, Section } from "./ui";

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
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={revoking}
        loading={revoking}
        onClick={() => onRevoke(item.id)}
      >
        撤销 Token
      </Button>
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

      <Section title="新建 Token">
        <Field
          label="名称"
          hint="便于区分用途，例如「本地脚本」「Cursor MCP」。"
        >
          <form className="orbit-settings-inline-form orbit-settings-inline-form--wide" onSubmit={(e) => void handleCreate(e)}>
            <Input
              value={name}
              maxLength={64}
              placeholder="用途说明"
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={creating || !name.trim()}
              loading={creating}
            >
              创建
            </Button>
          </form>
        </Field>
      </Section>

      {revealedToken ? (
        <Section title="请立即保存">
          <Field
            label="新 Token"
            hint="明文仅显示一次。请复制保存，关闭页面后无法再次查看。"
          >
            <div className="orbit-settings-inline-form orbit-settings-inline-form--wide">
              <Input
                mono
                readOnly
                value={revealedToken}
                aria-label="新 API Token"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleCopyToken()}
              >
                复制
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRevealedToken(null)}
              >
                我已保存
              </Button>
            </div>
          </Field>
        </Section>
      ) : null}

      <Section title="使用方式">
        <Field
          label="请求头"
          hint="在 HTTP 请求中附带 Authorization。可访问文章、搜索、评论、相册与 AI 等接口；设置、账户与 Token 管理仍需浏览器登录。"
        >
          <pre className="orbit-settings-code-block">
            <code>{`Authorization: Bearer orb_…`}</code>
          </pre>
        </Field>
      </Section>

      <Section title="已有 Token">
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
      </Section>
    </>
  );
}
