// ui.js
import { formatBRL } from "./utils.js";

export function setOptions(selectEl, options, { includeAll=false, allLabel="Todos" } = {}) {
  selectEl.innerHTML = "";
  if (includeAll) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = allLabel;
    selectEl.appendChild(opt);
  }
  for (const optVal of options) {
    const opt = document.createElement("option");
    opt.value = optVal;
    opt.textContent = optVal;
    selectEl.appendChild(opt);
  }
}

export function renderExpenses(listEl, expenses, handlers) {
  listEl.innerHTML = "";
  for (const e of expenses) {
    const item = document.createElement("div");
    item.className = "item";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="item-title">${escapeHTML(e.description || "(sem descrição)")}</div>
      <div class="item-sub">
        <span class="badge">${e.date}</span>
        <span class="badge">${escapeHTML(e.category)} • ${escapeHTML(e.subcategory)}</span>
        <span class="badge">${labelKind(e.kind)}</span>
        <span class="badge">${labelPayment(e.paymentMethod, e.card)}${labelInstallments(e.paymentMethod, e.installments) ? ` • ${labelInstallments(e.paymentMethod, e.installments)}` : ""}</span>
        <span class="badge">${labelPriority(e.priority)}</span>
        ${deliveryBadges(e)}
        ${fuelBadges(e)}
        ${e.merchant ? `<span class="badge">${escapeHTML(e.merchant)}</span>` : ""}
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost" data-action="edit">Editar</button>
        <button class="btn btn-danger" data-action="delete">Excluir</button>
      </div>
    `;

    const right = document.createElement("div");
    right.innerHTML = `<div class="item-amount">${formatBRL(e.amount)}</div>`;

    item.appendChild(left);
    item.appendChild(right);

    item.querySelector('[data-action="edit"]').addEventListener("click", () => handlers.onEdit(e.id));
    item.querySelector('[data-action="delete"]').addEventListener("click", () => handlers.onDelete(e.id));

    listEl.appendChild(item);
  }
}

function labelPayment(method, card) {
  if (method === "credito") return `Crédito${card ? ` (${card})` : ""}`;
  if (method === "debito") return "Débito";
  return "Pix";
}

function labelInstallments(method, installments) {
  if (method !== "credito") return "";
  const n = Number(installments || 1);
  if (!Number.isFinite(n) || n <= 1) return "";
  return `${n}x`;
}

function fuelBadges(e) {
  if (e.subcategory !== "Combustível") return "";
  const parts = [];
  if (e.fuelType) parts.push(`<span class="badge">${labelFuelType(e.fuelType)}</span>`);
  if (Number.isFinite(Number(e.fuelPricePerLiter)) && Number(e.fuelPricePerLiter) > 0) {
    parts.push(`<span class="badge">${formatBRL(e.fuelPricePerLiter)}/L</span>`);
  }
  return parts.join("");
}

function labelFuelType(t) {
  if (t === "etanol") return "Etanol";
  if (t === "etanol_aditivado") return "Etanol aditivado";
  if (t === "gasolina") return "Gasolina";
  if (t === "gasolina_aditivada") return "Gasolina aditivada";
  return String(t || "");
}

function labelPriority(p) {
  if (p === "essencial") return "Alta";
  if (p === "importante") return "Média";
  return "Baixa";
}

function labelKind(k) {
  if (k === "conta") return "Conta";
  if (k === "doacao") return "Doação";
  return "Compra";
}

function deliveryBadges(e) {
  if (e.subcategory !== "Delivery") return "";
  if (!e.deliveryProvider) return "";
  const label = labelDeliveryProvider(e.deliveryProvider, e.deliveryProviderOther);
  return label ? `<span class="badge">${escapeHTML(label)}</span>` : "";
}

function labelDeliveryProvider(p, other) {
  if (p === "ifood") return "iFood";
  if (p === "99") return "99";
  if (p === "outros") return other ? other : "Outros";
  return String(p || "");
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
