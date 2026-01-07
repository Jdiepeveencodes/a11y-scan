export type ViolationRow = {
  domain: string;
  pageName: string;
  url: string;
  impact: string;
  id: string;
  description: string;
  help: string;
  helpUrl: string;
  nodes: number;
  screenshot?: string;
};


function csvEscape(v: string): string {
  const s = (v ?? "").toString();
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: ViolationRow[]): string {
  const headers = [
    "pageName",
    "url",
    "impact",
    "ruleId",
    "description",
    "help",
    "helpUrl",
    "nodes"
  ];

  const lines = [
    headers.join(","),
    ...rows.map(r =>
      [
        r.pageName,
        r.url,
        r.impact,
        r.id,
        r.description,
        r.help,
        r.helpUrl,
        String(r.nodes)
      ].map(csvEscape).join(",")
    )
  ];

  return lines.join("\n");
}
