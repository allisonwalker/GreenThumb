const EM_DASH = "\u2014";

/** Strip leftover markdown and em dashes from assistant text shown in Ask. */
export function sanitizeAssistantReply(text: string): string {
  let out = text.replace(/\r\n/g, "\n");
  out = unwrapFencedCode(out);
  out = unwrapInlineCode(out);
  out = stripHeadingPrefixes(out);
  out = unwrapEmphasis(out);
  out = stripMarkdownBullets(out);
  out = flattenGfmTables(out);
  out = stripHorizontalRules(out);
  out = replaceEmDashes(out);
  out = stripLeftoverMarkers(out);
  return collapseBlankLines(out).trim();
}

function unwrapFencedCode(text: string): string {
  return text.replace(/```[\w-]*\r?\n?([\s\S]*?)```/g, (_, body: string) =>
    body.replace(/\s+$/, ""),
  );
}

function unwrapInlineCode(text: string): string {
  return text.replace(/`([^`\n]+)`/g, "$1").replace(/`/g, "");
}

function stripHeadingPrefixes(text: string): string {
  return text.replace(/^ {0,3}#{1,6}[ \t]+/gm, "");
}

function unwrapEmphasis(text: string): string {
  let out = text.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  out = out.replace(/__([^_\n]+)__/g, "$1");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1$2");
  out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, "$1$2");
  out = out.replace(/\*\*/g, "");
  out = out.replace(/__/g, "");
  return out;
}

function stripMarkdownBullets(text: string): string {
  return text.replace(/^(\s*)\*(?=\s+\S)/gm, "$1");
}

function flattenGfmTables(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)) {
        return "";
      }
      if (!/\|/.test(line)) {
        return line;
      }
      const cells = line
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (cells.length < 2) {
        return line;
      }
      return cells.join(", ");
    })
    .join("\n");
}

function stripHorizontalRules(text: string): string {
  return text.replace(/^\s*([-*_])\1{2,}\s*$/gm, "");
}

function replaceEmDashes(text: string): string {
  const pieces: string[] = [];
  let last = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== EM_DASH) {
      continue;
    }
    const before = text.slice(last, index);
    const after = text.slice(index + 1);
    const leftChar = before.match(/(\S)\s*$/)?.[1] ?? "";
    const rightChar = after.match(/^\s*(\S)/)?.[1] ?? "";
    const tight =
      !/\s$/.test(before) &&
      !/^\s/.test(after) &&
      /[A-Za-z0-9]/.test(leftChar) &&
      /[A-Za-z0-9]/.test(rightChar);

    pieces.push(tight ? before : before.replace(/[ \t]+$/, ""));
    if (tight) {
      pieces.push("-");
    } else if (!rightChar) {
      pieces.push(/[.!?]/.test(leftChar) ? "" : ".");
    } else if (/[A-Z]/.test(rightChar)) {
      pieces.push(/[.!?]/.test(leftChar) ? " " : ". ");
    } else {
      pieces.push(", ");
    }

    if (!tight) {
      const spacesAfter = after.match(/^\s*/)?.[0].length ?? 0;
      index += spacesAfter;
    }
    last = index + 1;
  }
  pieces.push(text.slice(last));
  return pieces.join("").replace(/[ \t]+/g, " ");
}

function stripLeftoverMarkers(text: string): string {
  return text.replace(/(?<![A-Za-z0-9])\*(?![A-Za-z0-9])/g, "");
}

function collapseBlankLines(text: string): string {
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}
