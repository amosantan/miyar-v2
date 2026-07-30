export const PUBLIC_SHARE_ROBOTS_DIRECTIVE =
  "noindex, nofollow, noarchive" as const;

export function installPublicShareRobotsMeta(
  targetDocument: Document = document
): () => void {
  const existing = targetDocument.querySelector<HTMLMetaElement>(
    'meta[name="robots"]'
  );
  const previous = existing?.content;
  const meta = existing ?? targetDocument.createElement("meta");
  if (!existing) {
    meta.name = "robots";
    targetDocument.head.appendChild(meta);
  }
  meta.content = PUBLIC_SHARE_ROBOTS_DIRECTIVE;
  return () => {
    if (existing && previous !== undefined) {
      existing.content = previous;
    } else {
      meta.remove();
    }
  };
}
