"use client";

// Minimal, safe Markdown for AI readings: headings, **bold**, *italic*,
// bullet and numbered lists, and paragraphs. Builds React elements directly —
// no HTML injection, no dependency. Readings used to show raw asterisks.

import type { ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  // **bold** first, then *italic* / _italic_
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(
        <strong key={`${keyBase}-${i++}`} className="font-semibold text-(--color-gold-soft)">
          {tok.slice(2, -2)}
        </strong>
      );
    } else {
      out.push(<em key={`${keyBase}-${i++}`}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "ul"; items: { text: string; indent: number }[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

function parse(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line.trim());
    if (h) {
      flush();
      blocks.push({ kind: "h", level: h[1].length, text: h[2] });
      continue;
    }
    const ul = /^(\s*)[-*•]\s+(.*)$/.exec(line);
    if (ul) {
      flush();
      const prev = blocks[blocks.length - 1];
      const item = { text: ul[2], indent: Math.min(2, Math.floor(ul[1].length / 2)) };
      if (prev?.kind === "ul") prev.items.push(item);
      else blocks.push({ kind: "ul", items: [item] });
      continue;
    }
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      flush();
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === "ol") prev.items.push(ol[1]);
      else blocks.push({ kind: "ol", items: [ol[1]] });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parse(text);
  return (
    <div className={`space-y-2 text-sm leading-relaxed ${className}`}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        if (b.kind === "h") {
          return (
            <p key={k} className={`pt-1 font-semibold text-(--color-gold-soft) ${b.level <= 2 ? "text-base" : "text-sm"}`}>
              {inline(b.text, k)}
            </p>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={k} className="space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2" style={{ paddingLeft: `${it.indent * 1}rem` }}>
                  <span className="accent-text select-none">•</span>
                  <span>{inline(it.text, `${k}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.kind === "ol") {
          return (
            <ol key={k} className="space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="accent-text select-none tabular-nums">{j + 1}.</span>
                  <span>{inline(it, `${k}-${j}`)}</span>
                </li>
              ))}
            </ol>
          );
        }
        return <p key={k}>{inline(b.text, k)}</p>;
      })}
    </div>
  );
}

