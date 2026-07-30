import { formatWriteContentDateLabel } from "./beijing-date";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  diary: "日记",
  timeline: "时间线",
  message: "留言",
  letter: "信件",
  memo: "备忘录",
};

const ACTION_LABEL: Record<string, string> = {
  create: "创建",
  update: "更新",
  delete: "删除",
};

export interface WriteContentApprovalInput {
  action?: string;
  type?: string;
  id?: string;
  title?: string;
  body?: string;
  date?: string;
  parentId?: string;
  key?: string;
}

const APPROVAL_BODY_PREVIEW_MAX = 1200;

function formatApprovalBodyPreview(body?: string): string | undefined {
  const trimmed = body?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= APPROVAL_BODY_PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, APPROVAL_BODY_PREVIEW_MAX)}…`;
}

export function formatWriteContentApprovalSummary(
  input: WriteContentApprovalInput
): string {
  const action = ACTION_LABEL[input.action ?? ""] ?? input.action ?? "写入";
  const type = CONTENT_TYPE_LABEL[input.type ?? ""] ?? input.type ?? "";
  const title = input.title?.trim();
  const bodyPreview = formatApprovalBodyPreview(input.body);
  const entryDate = formatWriteContentDateLabel(input.date, input.action);
  const isDelete = input.action === "delete";

  const lines: string[] = [
    isDelete
      ? "以下内容将从 Orbit 空间删除，请审阅："
      : "以下内容将写入 Orbit 空间，请审阅：",
    "",
    `${action}${type ? ` · ${type}` : ""}`,
  ];

  if (input.id) lines.push(`条目 ID：${input.id}`);
  if (title) lines.push(`标题：${title}`);
  if (input.key?.trim()) lines.push(`备忘录 Key：${input.key.trim()}`);
  if (entryDate) lines.push(`日期：${entryDate}`);
  if (input.parentId?.trim()) {
    lines.push(`关联条目：${input.parentId.trim()}`);
  }

  if (bodyPreview) {
    lines.push("", "正文预览", bodyPreview);
  } else if (!isDelete && (input.action === "create" || input.action === "update")) {
    lines.push("", "（无正文内容）");
  }

  return lines.join("\n");
}
