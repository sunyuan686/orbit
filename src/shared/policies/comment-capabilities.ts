export type CommentKind = "bottom" | "inline";
export type CommentableContentType = "diary" | "timeline" | "memo" | "message" | "letter";

export const commentCapabilities: Record<CommentableContentType, Record<CommentKind, boolean>> = {
  diary: { bottom: true, inline: true },
  timeline: { bottom: true, inline: true },
  memo: { bottom: true, inline: true },
  message: { bottom: false, inline: false },
  letter: { bottom: false, inline: true },
};

export function canComment(contentType: string, kind: string): boolean {
  const capabilities = commentCapabilities[contentType as CommentableContentType];
  return Boolean(capabilities?.[kind as CommentKind]);
}

export function getCommentCapabilities(type: string | null | undefined): Record<CommentKind, boolean> {
  return commentCapabilities[type as CommentableContentType] ?? { bottom: false, inline: false };
}
