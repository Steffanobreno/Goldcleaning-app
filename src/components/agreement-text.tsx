import { Fragment, type ReactNode } from "react";

// Renders the agreement's simple format: "## " headings, "- " bullets, **bold**.
// Plain React elements only (no HTML injection).

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

export function AgreementText({ title, body }: { title: string; body: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`u${blocks.length}`} className="list-disc space-y-1 pl-5">
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("- ")) bullets.push(line.slice(2));
    else {
      flush();
      if (line.startsWith("## ")) blocks.push(<h3 key={`h${blocks.length}`} className="pt-2 font-bold">{inline(line.slice(3))}</h3>);
      else if (line) blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
    }
  }
  flush();
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      <h2 className="text-base font-bold">{title}</h2>
      {blocks}
    </div>
  );
}
