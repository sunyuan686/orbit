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
}

export function formatWriteContentApprovalSummary(
  input: WriteContentApprovalInput
): string {
  const action = ACTION_LABEL[input.action ?? ""] ?? input.action ?? "写入";
  const type = CONTENT_TYPE_LABEL[input.type ?? ""] ?? input.type ?? "";
  const title = input.title?.trim();
  const bodyPreview = input.body?.trim()
    ? input.body.trim().slice(0, 200) +
      (input.body.trim().length > 200 ? "…" : "")
    : "";

  const lines = [`${action}${type ? ` · ${type}` : ""}`];
  if (title) lines.push(`标题：${title}`);
  if (input.id) lines.push(`ID：${input.id}`);
  if (bodyPreview) lines.push(bodyPreview);
  return lines.join("\n");
}
