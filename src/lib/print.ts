/**
 * Reliable thermal printing helper.
 *
 * Popup windows are frequently blocked, and `window.print()` on the app itself
 * prints the whole screen chrome instead of the document we care about. Both
 * problems disappear when the document is rendered inside a hidden iframe and
 * that iframe is printed directly.
 */

/** Escapes user-supplied text so order notes can never break the print markup. */
export const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Fluid width: the printer's own printable area defines the page box, so the
 * body simply fills 100% of it instead of a hard-coded millimetre width that
 * gets clipped on 58mm rolls or on printers with wider hardware margins.
 */
const BASE_STYLE = `@page{size:auto;margin:2mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;width:100%;max-width:100%;
direction:rtl;text-align:right;font-size:12px;line-height:1.45;color:#000;background:#fff;
overflow-wrap:break-word;word-wrap:break-word;word-break:break-word;hyphens:auto}
h1{font-size:15px;margin:0 0 2px;text-align:center;overflow-wrap:break-word}
div,td,span,b,small{overflow-wrap:break-word;word-break:break-word;max-width:100%}
table{width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed}
td{padding:2px 0;vertical-align:top;overflow-wrap:break-word}
td:last-child{width:22%;text-align:left;white-space:nowrap}
.line{border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between;gap:6px;align-items:baseline}
.row>span,.row>b{min-width:0}
.item{margin:6px 0}
.opt{font-size:11px}
.note{font-size:11px;font-weight:700}
small{font-size:11px}
@media print{body{width:100%}}`;

/**
 * Prints an HTML fragment (body content only) on the user's selected printer.
 * Returns false when the browser refuses to create the print surface.
 */
export function printDocument(title: string, bodyHtml: string, extraStyle = ""): boolean {
  if (typeof document === "undefined") return false;

  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>${esc(title)}</title><style>${BASE_STYLE}
${extraStyle}</style></head><body>${bodyHtml}</body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:80mm;height:100vh;border:0;visibility:hidden";
  document.body.appendChild(frame);

  const cleanup = () => {
    window.setTimeout(() => frame.remove(), 1000);
  };

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Fonts/layout need one frame before the print snapshot is taken.
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* printing unavailable — nothing else to do */
    }
    cleanup();
  }, 250);

  return true;
}
