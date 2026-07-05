/** 编辑页展示用：优先已有内容作者名，否则当前登录爱称 */
export function resolveEditorAuthor(
  existingAuthor: string | null | undefined,
  sessionName: string | undefined
): string | null {
  if (existingAuthor?.trim()) return existingAuthor.trim();
  if (sessionName?.trim()) return sessionName.trim();
  return null;
}
