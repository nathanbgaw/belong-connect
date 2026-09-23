import type { ReactNode } from "react";

/** Just enough markdown for a chat reply: paragraphs, bullets, bold, links. */
function inline(text: string, key: number): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={`${key}-${i++}`}>{m[1].slice(2, -2)}</strong>);
    else if (m[2]) {
      const label = m[2].slice(1, m[2].indexOf("]"));
      parts.push(<a key={`${key}-${i++}`} href={m[3]} target="_blank" rel="noreferrer">{label}</a>);
    } else if (m[4]) {
      parts.push(<a key={`${key}-${i++}`} href={m[4]} target="_blank" rel="noreferrer">{m[4].replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  let list: string[] = [];
  let k = 0;
  const flushPara = () => {
    if (para.length) blocks.push(<p key={k++}>{inline(para.join(" "), k)}</p>);
    para = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(<ul key={k++}>{list.map((l, i) => <li key={i}>{inline(l, k * 100 + i)}</li>)}</ul>);
    list = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/^#{1,6}\s+/, "");
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flushPara();
      list.push(bullet[1]);
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className="prose-chat">{blocks}</div>;
}
