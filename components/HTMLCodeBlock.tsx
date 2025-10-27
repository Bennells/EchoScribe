"use client";

import { useMemo } from "react";

interface HTMLCodeBlockProps {
  code: string;
  showLineNumbers?: boolean;
}

interface Token {
  type: "tag" | "attribute" | "string" | "comment" | "text";
  content: string;
}

export function HTMLCodeBlock({ code, showLineNumbers = true }: HTMLCodeBlockProps) {
  const lines = useMemo(() => {
    return code.split("\n").map((line, lineIndex) => {
      const tokens = tokenizeHTML(line);
      return {
        lineNumber: lineIndex + 1,
        tokens,
        originalLine: line,
      };
    });
  }, [code]);

  return (
    <div className="rounded-lg overflow-hidden border max-w-full bg-muted/30">
      <pre className="p-0 overflow-x-auto text-sm m-0">
        <code className="block font-mono">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="hover:bg-muted/50 transition-colors"
              style={{ display: "flex" }}
            >
              {showLineNumbers && (
                <span
                  className="select-none text-muted-foreground pr-4 pl-4 py-1 text-right border-r border-border inline-block min-w-[60px] sticky left-0 bg-muted/30"
                  style={{ userSelect: "none" }}
                >
                  {line.lineNumber}
                </span>
              )}
              <span className="px-4 py-1 flex-1 whitespace-pre-wrap break-words">
                {line.tokens.length === 0 ? (
                  <span className="text-transparent select-none">·</span>
                ) : (
                  line.tokens.map((token, tokenIdx) => (
                    <span key={tokenIdx} className={getTokenClass(token.type)}>
                      {token.content}
                    </span>
                  ))
                )}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

function getTokenClass(type: Token["type"]): string {
  switch (type) {
    case "tag":
      return "text-blue-600 dark:text-blue-400";
    case "attribute":
      return "text-foreground";
    case "string":
      return "text-foreground";
    case "comment":
      return "text-muted-foreground italic";
    case "text":
      return "text-foreground";
    default:
      return "text-foreground";
  }
}

function tokenizeHTML(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // HTML Comment
    if (line.substring(i, i + 4) === "<!--") {
      const end = line.indexOf("-->", i);
      if (end !== -1) {
        tokens.push({
          type: "comment",
          content: line.substring(i, end + 3),
        });
        i = end + 3;
        continue;
      }
    }

    // HTML Tag
    if (line[i] === "<") {
      const end = line.indexOf(">", i);
      if (end !== -1) {
        const tagContent = line.substring(i, end + 1);
        parseTag(tagContent, tokens);
        i = end + 1;
        continue;
      }
    }

    // Text content
    const nextTag = line.indexOf("<", i);
    if (nextTag === -1) {
      const text = line.substring(i);
      if (text.trim()) {
        tokens.push({ type: "text", content: text });
      } else {
        tokens.push({ type: "text", content: text });
      }
      break;
    } else {
      const text = line.substring(i, nextTag);
      if (text) {
        tokens.push({ type: "text", content: text });
      }
      i = nextTag;
    }
  }

  return tokens;
}

function parseTag(tagContent: string, tokens: Token[]): void {
  // Opening bracket and tag name
  const tagMatch = tagContent.match(/^(<\/?)([\w-]+)/);
  if (tagMatch) {
    tokens.push({ type: "tag", content: tagMatch[1] + tagMatch[2] });
    let rest = tagContent.substring(tagMatch[0].length);

    // Parse attributes
    const attrRegex = /([\w-]+)(=?)("[^"]*"|'[^']*')?/g;
    let match;
    let lastIndex = 0;

    while ((match = attrRegex.exec(rest)) !== null) {
      // Add whitespace before attribute
      if (match.index > lastIndex) {
        const whitespace = rest.substring(lastIndex, match.index);
        tokens.push({ type: "text", content: whitespace });
      }

      // Attribute name
      tokens.push({ type: "attribute", content: match[1] });

      // Equals sign
      if (match[2]) {
        tokens.push({ type: "text", content: match[2] });
      }

      // Attribute value
      if (match[3]) {
        tokens.push({ type: "string", content: match[3] });
      }

      lastIndex = match.index + match[0].length;
    }

    // Remaining part (closing bracket, self-closing slash, etc.)
    if (lastIndex < rest.length) {
      const remaining = rest.substring(lastIndex);
      // Check if it contains closing bracket or self-closing
      if (remaining.includes(">")) {
        const beforeBracket = remaining.substring(0, remaining.indexOf(">"));
        if (beforeBracket) {
          tokens.push({ type: "text", content: beforeBracket });
        }
        tokens.push({ type: "tag", content: ">" });
      } else {
        tokens.push({ type: "text", content: remaining });
      }
    }
  } else {
    // Fallback: treat entire tag as tag token
    tokens.push({ type: "tag", content: tagContent });
  }
}
