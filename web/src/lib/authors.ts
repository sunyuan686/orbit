export const CANONICAL_AUTHORS = ["小圆子", "小麟子"] as const;
export type CanonicalAuthor = (typeof CANONICAL_AUTHORS)[number];

/**
 * 解析当前可用的展示作者：优先已有内容的规范作者，否则回退到登录账号名。
 * 用于「我是否是这条内容/评论的作者」判断与编辑页作者展示。
 */
export function resolveEditorAuthor(
  existingAuthor: string | null | undefined,
  sessionName: string | undefined
): string | null {
  if (
    existingAuthor &&
    CANONICAL_AUTHORS.includes(existingAuthor as CanonicalAuthor)
  ) {
    return existingAuthor;
  }
  if (sessionName && CANONICAL_AUTHORS.includes(sessionName as CanonicalAuthor)) {
    return sessionName;
  }
  return null;
}
