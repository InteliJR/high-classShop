// Utilitários de export client-side (sem dependência externa).

type Cell = string | number;

/**
 * Serializa em CSV com separador ";" (padrão do Excel pt-BR).
 *
 * O prefixo "R$ " é removido de propósito: com separador ";" e vírgula
 * decimal, "2.400.000,00" é lido como NÚMERO pelo Excel pt-BR; com o símbolo
 * na frente viraria texto e não somaria. Na tela e no PDF o R$ permanece.
 */
export function toCsv(columns: string[], rows: Cell[][]): string {
  const escape = (v: Cell) => {
    const s = String(v ?? "").replace(/^R\$\s/, "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns, ...rows].map((r) => r.map(escape).join(";")).join("\n");
}

// CSV com BOM UTF-8 (abre correto no Excel pt-BR).
export function downloadCsv(
  filename: string,
  columns: string[],
  rows: Cell[][],
) {
  const blob = new Blob(["﻿" + toCsv(columns, rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// "PDF" via impressão do navegador (Salvar como PDF) — sem lib, num iframe
// oculto pra não depender de pop-up.
export function openPrintablePdf(
  title: string,
  columns: string[],
  rows: Cell[][],
) {
  const esc = (v: unknown) =>
    String(v ?? "").replace(
      /[<>&]/g,
      (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string,
    );
  const thead = `<tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(
    title,
  )}</title><style>
    body{font-family:system-ui,sans-serif;padding:16px;color:#111}
    h1{font-size:15px;margin:0 0 12px}
    table{border-collapse:collapse;width:100%;font-size:10px}
    th,td{border:1px solid #ccc;padding:3px 6px;text-align:left;vertical-align:top}
    th{background:#f3f4f6}
    @page{size:landscape;margin:12mm}
  </style></head><body><h1>${esc(
    title,
  )}</h1><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    document.body.removeChild(iframe);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 250);
}
