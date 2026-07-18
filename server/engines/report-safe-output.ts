/**
 * Safe, deliberately small output primitives for issued report artifacts.
 *
 * Report templates must pass untrusted text through these functions instead of
 * interpolating it into HTML. Markdown support is intentionally limited: raw
 * HTML and links are emitted as inert text rather than being interpreted.
 */

const ATTRIBUTE_CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;
const BIDI_OVERRIDE_CHARACTERS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

function normalizeUntrustedValue(value: unknown): string {
  return String(value ?? "")
    .replace(ATTRIBUTE_CONTROL_CHARACTERS, "\uFFFD")
    // These controls can make a visible value differ from its logical value.
    // Arabic letters remain untouched; layout direction belongs to the template.
    .replace(BIDI_OVERRIDE_CHARACTERS, "\uFFFD");
}

function normalizeMarkdownValue(value: unknown): string {
  // Preserve line boundaries because they carry the allowlisted markdown shape.
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "\uFFFD")
    .replace(BIDI_OVERRIDE_CHARACTERS, "\uFFFD");
}

/** Escape a value placed between HTML tags. */
export function escapeReportText(value: unknown): string {
  return normalizeUntrustedValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a value placed inside a quoted HTML attribute. */
export function escapeReportAttribute(value: unknown): string {
  return escapeReportText(value);
}

/**
 * Accept only absolute HTTP(S) evidence URLs. This intentionally rejects
 * relative URLs, protocol-relative URLs, data URLs, and executable schemes.
 */
export function normalizeReportEvidenceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (/[\u0000-\u001F\u007F]/.test(value)) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Return an escaped safe URL suitable for a quoted href attribute. */
export function escapeReportEvidenceUrl(value: unknown): string | null {
  const url = normalizeReportEvidenceUrl(value);
  return url === null ? null : escapeReportAttribute(url);
}

function formatInlineMarkdown(value: string): string {
  // Escape first. Later substitutions can introduce only allowlisted tags.
  let output = escapeReportText(value);
  output = output.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return output;
}

/**
 * Render the small, deterministic markdown subset allowed in report narrative:
 * headings, paragraphs, unordered lists, bold, and italic. Links and raw HTML
 * are intentionally not interpreted, so hostile markup remains visible text.
 */
export function renderReportMarkdown(markdown: unknown): string {
  const lines = normalizeMarkdownValue(markdown).replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let paragraph: string[] = [];
  let inList = false;

  const closeParagraph = () => {
    if (paragraph.length > 0) {
      output.push(`<p>${formatInlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) {
      output.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    const listItem = /^\s*[-+*]\s+(.+?)\s*$/.exec(line);

    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
    } else if (listItem) {
      closeParagraph();
      if (!inList) {
        output.push("<ul>");
        inList = true;
      }
      output.push(`<li>${formatInlineMarkdown(listItem[1])}</li>`);
    } else if (line.trim().length === 0) {
      closeParagraph();
      closeList();
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  }

  closeParagraph();
  closeList();
  return output.join("\n");
}
