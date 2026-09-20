export type CommentKind = "bottom" | "inline";
export type CommentableContentType = "moment" | "letter";

export const commentCapabilities: Record<CommentableContentType, Record<CommentKind, boolean>> = {
  moment: { bottom: true, inline: true },
  letter: { bottom: false, inline: true },
};

export function canComment(contentType: string, kind: string): boolean {
  const capabilities = commentCapabilities[contentType as CommentableContentType];
  return Boolean(capabilities?.[kind as CommentKind]);
}

export function getCommentCapabilities(type: string | null | undefined): Record<CommentKind, boolean> {
  return commentCapabilities[type as CommentableContentType] ?? { bottom: false, inline: false };
}
