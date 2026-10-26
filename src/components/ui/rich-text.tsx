/**
 * Minimal, safe text renderer for admin-editable content (policies, descriptions).
 * Supports "## heading", "- list item" and blank-line paragraphs. No HTML is ever
 * interpreted — React escapes everything — so there is no XSS surface.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        const nodes: React.ReactNode[] = [];
        let list: string[] = [];
        const flush = (key: string) => {
          if (list.length) {
            nodes.push(
              <ul key={key}>
                {list.map((li, j) => (
                  <li key={j}>{li}</li>
                ))}
              </ul>,
            );
            list = [];
          }
        };
        lines.forEach((line, j) => {
          const l = line.trim();
          if (l.startsWith("## ")) {
            flush(`ul-${j}`);
            nodes.push(<h2 key={j}>{l.slice(3)}</h2>);
          } else if (l.startsWith("- ")) {
            list.push(l.slice(2));
          } else {
            flush(`ul-${j}`);
            nodes.push(<p key={j}>{l}</p>);
          }
        });
        flush("ul-end");
        return <div key={i}>{nodes}</div>;
      })}
    </div>
  );
}
