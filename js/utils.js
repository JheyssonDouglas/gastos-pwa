// utils.js
export function uid() {
  // UUID simples (suficiente pro app)
  return crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function todayISO() {
  const d = new Date();
  return toISODate(d);
}

export function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

export function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toLocalISOString(date = new Date()) {
  const d = (date instanceof Date) ? date : new Date(date);
  const pad2 = (n) => String(n).padStart(2, "0");
  const pad3 = (n) => String(n).padStart(3, "0");

  const yyyy = d.getFullYear();
  const MM = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  const ms = pad3(d.getMilliseconds());

  // getTimezoneOffset: minutos para somar ao horário local e chegar no UTC
  // Ex: UTC-03 => offset = +180. Queremos o sinal invertido.
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const abs = Math.abs(tzMin);
  const tzh = pad2(Math.floor(abs / 60));
  const tzm = pad2(abs % 60);

  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}.${ms}${sign}${tzh}:${tzm}`;
}

export function normalizeCreatedAt(value) {
  if (!value) return value;
  const s = String(value);
  // Valores antigos gravados com toISOString() ficam em UTC e terminam com 'Z'
  if (s.endsWith("Z")) return toLocalISOString(new Date(s));
  return s;
}

export function formatBRL(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function inRangeISO(dateISO, startISO, endISO) {
  if (startISO && dateISO < startISO) return false;
  if (endISO && dateISO > endISO) return false;
  return true;
}

export function includesText(expense, q) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = `${expense.description || ""} ${expense.merchant || ""} ${expense.category || ""} ${expense.subcategory || ""}`.toLowerCase();
  return hay.includes(s);
}

export function weekKey(dateISO) {
  // chave ISO-like: YYYY-Www (sem perfeccionismo, suficiente pra agrupar)
  const d = new Date(dateISO + "T00:00:00");
  const onejan = new Date(d.getFullYear(),0,1);
  const dayOfYear = Math.floor((d - onejan) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + onejan.getDay()) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2,"0")}`;
}

export function monthKey(dateISO) {
  return dateISO.slice(0, 7); // YYYY-MM
}

export function yearKey(dateISO) {
  return dateISO.slice(0, 4);
}

export function summarizeTopCategory(byCategoryMap) {
  let top = { k: "—", v: 0 };
  for (const [k, v] of Object.entries(byCategoryMap)) {
    if (v > top.v) top = { k, v };
  }
  return top.k;
}

export function toCSV(expenses) {
  const headers = [
    "id","date","amount","category","subcategory","kind","deliveryProvider","deliveryProviderOther","paymentMethod","card","installments","fuelPricePerLiter","fuelType","priority","merchant","description","createdAt"
  ];
  const escape = (x) => {
    const s = String(x ?? "");
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const rows = expenses.map(e => headers.map(h => {
    if (h === "createdAt") return escape(normalizeCreatedAt(e[h]));
    return escape(e[h]);
  }).join(","));
  return [headers.join(","), ...rows].join("\n");
}

export function downloadFile(filename, content, mime="text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      cell += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      cell = "";
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
      row = [];
      continue;
    }

    if (ch === "\r") continue;

    cell += ch;
  }

  row.push(cell);
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);

  if (!rows.length) return [];
  const headers = rows[0].map(h => String(h || "").trim());
  const out = [];

  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = rows[r][c] ?? "";
    }
    out.push(obj);
  }

  return out;
}
