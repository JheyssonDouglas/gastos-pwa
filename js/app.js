// app.js
import {
  loadConfig, addExpense, updateExpense, deleteExpense, getAllExpenses,
  getExpenseById, clearAll, saveConfig
} from "./db.js";

import {
  uid, todayISO, parseAmount, formatBRL,
  inRangeISO, includesText, toCSV, downloadFile, toLocalISOString, normalizeCreatedAt
} from "./utils.js";

import { setOptions, renderExpenses } from "./ui.js";
import { initCharts, buildInsights, renderCharts } from "./charts.js";

const cfg = loadConfig();

const CUSTOM_OPTION_VALUE = "__custom__";

const els = {
  themeToggle: document.getElementById("themeToggle"),
  themeIcon: document.getElementById("themeIcon"),

  tabs: Array.from(document.querySelectorAll(".tab")),
  panels: {
    home: document.getElementById("tab-home"),
    expenses: document.getElementById("tab-expenses"),
    insights: document.getElementById("tab-insights"),
    settings: document.getElementById("tab-settings"),
  },

  // form
  form: document.getElementById("expenseForm"),
  date: document.getElementById("date"),
  amount: document.getElementById("amount"),
  category: document.getElementById("category"),
  subcategory: document.getElementById("subcategory"),
  kind: document.getElementById("kind"),
  deliveryFields: document.getElementById("deliveryFields"),
  deliveryProvider: document.getElementById("deliveryProvider"),
  deliveryOtherField: document.getElementById("deliveryOtherField"),
  deliveryProviderOther: document.getElementById("deliveryProviderOther"),
  paymentMethod: document.getElementById("paymentMethod"),
  cardField: document.getElementById("cardField"),
  card: document.getElementById("card"),
  priority: document.getElementById("priority"),
  merchant: document.getElementById("merchant"),
  description: document.getElementById("description"),
  editingId: document.getElementById("editingId"),

  quickCopyLast: document.getElementById("quickCopyLast"),

  installmentsField: document.getElementById("installmentsField"),
  installments: document.getElementById("installments"),

  fuelFields: document.getElementById("fuelFields"),
  fuelPricePerLiter: document.getElementById("fuelPricePerLiter"),
  fuelType: document.getElementById("fuelType"),

  // list + filters
  list: document.getElementById("expenseList"),
  emptyState: document.getElementById("emptyState"),
  totalPill: document.getElementById("totalPill"),
  rangeStart: document.getElementById("rangeStart"),
  rangeEnd: document.getElementById("rangeEnd"),
  filterCategory: document.getElementById("filterCategory"),
  filterPayment: document.getElementById("filterPayment"),
  searchText: document.getElementById("searchText"),
  clearFilters: document.getElementById("clearFilters"),

  // insights
  periodMode: document.getElementById("periodMode"),
  insStart: document.getElementById("insStart"),
  insEnd: document.getElementById("insEnd"),
  refreshInsights: document.getElementById("refreshInsights"),
  insightsPill: document.getElementById("insightsPill"),
  statTotal: document.getElementById("statTotal"),
  statAvg: document.getElementById("statAvg"),
  statTopCat: document.getElementById("statTopCat"),

  // settings
  exportJson: document.getElementById("exportJson"),
  importJson: document.getElementById("importJson"),
  importFile: document.getElementById("importFile"),
  exportCsv: document.getElementById("exportCsv"),
  exportSheets: document.getElementById("exportSheets"),
  resetAll: document.getElementById("resetAll"),
  toast: document.getElementById("toast"),
};

let allExpenses = [];
let lastExpense = null;

let toastTimer = null;

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.style.display = "block";
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.style.display = "none";
  }, 2200);
}

// ---------- PWA ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}

// ---------- THEME ----------
initTheme();
els.themeToggle.addEventListener("click", toggleTheme);

function initTheme() {
  const saved = localStorage.getItem("gastos_theme");
  const theme = saved || "light";
  document.documentElement.setAttribute("data-theme", theme);
  els.themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("gastos_theme", next);
  els.themeIcon.textContent = next === "dark" ? "☀️" : "🌙";
}

// ---------- TABS ----------
els.tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    els.tabs.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    Object.values(els.panels).forEach(p => p.classList.remove("active"));
    els.panels[tab].classList.add("active");

    if (tab === "insights") refreshInsights();
  });
});

// ---------- INIT SELECTS ----------
refreshCategoryOptions();
setOptions(els.card, cfg.cards);

function getCategoryNames() {
  return Object.keys(cfg.categories || {});
}

function ensureCategoryExists(categoryName) {
  const name = String(categoryName || "").trim();
  if (!name) return;
  cfg.categories = cfg.categories || {};
  if (!cfg.categories[name]) cfg.categories[name] = ["Diversos"];
}

function ensureSubcategoryExists(categoryName, subcategoryName) {
  const cat = String(categoryName || "").trim();
  const sub = String(subcategoryName || "").trim();
  if (!cat || !sub) return;
  ensureCategoryExists(cat);
  const list = cfg.categories[cat];
  if (!list.includes(sub)) list.push(sub);
}

function setOptionsWithCustom(selectEl, options, { includeAll=false, allLabel="Todos", customLabel="Outros…" } = {}) {
  setOptions(selectEl, options, { includeAll, allLabel });
  const opt = document.createElement("option");
  opt.value = CUSTOM_OPTION_VALUE;
  opt.textContent = customLabel;
  selectEl.appendChild(opt);
}

function refreshCategoryOptions({ keepSelection=true } = {}) {
  const prev = keepSelection ? els.category.value : "";
  const prevFilter = keepSelection ? els.filterCategory.value : "";
  const categoryNames = getCategoryNames();

  setOptionsWithCustom(els.category, categoryNames);
  setOptions(els.filterCategory, categoryNames, { includeAll: true, allLabel: "Todas" });

  if (keepSelection) {
    if (categoryNames.includes(prev)) els.category.value = prev;
    if (prevFilter && categoryNames.includes(prevFilter)) els.filterCategory.value = prevFilter;
  }
}

function refreshSubcategories({ keepSelection=true } = {}) {
  const cat = els.category.value;
  const prevSub = keepSelection ? els.subcategory.value : "";

  const subs = (cfg.categories && cfg.categories[cat]) ? cfg.categories[cat] : ["Diversos"];
  setOptionsWithCustom(els.subcategory, subs);

  if (keepSelection && prevSub && subs.includes(prevSub)) {
    els.subcategory.value = prevSub;
  }

  updateFuelFieldsVisibility();
  updateDeliveryFieldsVisibility();
}

function isFuelSelected() {
  return els.subcategory.value === "Combustível";
}

function isDeliverySelected() {
  return els.subcategory.value === "Delivery";
}

function updateDeliveryFieldsVisibility() {
  const show = isDeliverySelected();
  els.deliveryFields.style.display = show ? "flex" : "none";
  if (!show) {
    els.deliveryProvider.value = "";
    els.deliveryOtherField.style.display = "none";
    els.deliveryProviderOther.value = "";
    return;
  }

  const isOther = els.deliveryProvider.value === "outros";
  els.deliveryOtherField.style.display = isOther ? "block" : "none";
  if (!isOther) els.deliveryProviderOther.value = "";
}

function updateFuelFieldsVisibility() {
  const show = isFuelSelected();
  els.fuelFields.style.display = show ? "flex" : "none";
  if (!show) {
    els.fuelPricePerLiter.value = "";
    els.fuelType.value = "";
  }
}

async function handleCategoryChange() {
  if (els.category.value === CUSTOM_OPTION_VALUE) {
    const name = prompt("Nova categoria: (ex: Pets, Beleza, Trabalho)")
      ?.trim();
    if (!name) {
      els.category.value = getCategoryNames()[0] || "Outros";
      refreshSubcategories({ keepSelection: false });
      return;
    }

    ensureCategoryExists(name);
    saveConfig(cfg);

    refreshCategoryOptions({ keepSelection: false });
    els.category.value = name;
    refreshSubcategories({ keepSelection: false });
    return;
  }

  refreshSubcategories({ keepSelection: false });
}

async function handleSubcategoryChange() {
  if (els.subcategory.value !== CUSTOM_OPTION_VALUE) return;

  const cat = els.category.value;
  const name = prompt(`Nova subcategoria para "${cat}": (ex: Padaria, Bar, Oficina)`)?.trim();
  if (!name) {
    refreshSubcategories({ keepSelection: false });
    return;
  }

  ensureSubcategoryExists(cat, name);
  saveConfig(cfg);

  refreshSubcategories({ keepSelection: false });
  els.subcategory.value = name;
}

els.category.addEventListener("change", handleCategoryChange);
els.subcategory.addEventListener("change", handleSubcategoryChange);
els.subcategory.addEventListener("change", updateFuelFieldsVisibility);
els.subcategory.addEventListener("change", updateDeliveryFieldsVisibility);
els.deliveryProvider.addEventListener("change", updateDeliveryFieldsVisibility);
refreshSubcategories({ keepSelection: false });

els.paymentMethod.addEventListener("change", () => {
  const isCredit = els.paymentMethod.value === "credito";
  els.cardField.style.display = isCredit ? "block" : "none";
  els.installmentsField.style.display = isCredit ? "block" : "none";
  if (!isCredit) els.card.value = "";
  if (!isCredit) els.installments.value = "1";
});

els.quickCopyLast.addEventListener("click", () => {
  if (!lastExpense) return alert("Ainda não existe gasto anterior para copiar.");
  fillForm({
    ...lastExpense,
    id: "",
    date: todayISO(),
    amount: "",
    description: lastExpense.description || "",
    installments: lastExpense.installments ?? "1",
    fuelPricePerLiter: lastExpense.fuelPricePerLiter ?? "",
    fuelType: lastExpense.fuelType ?? "",
    kind: lastExpense.kind ?? "compra",
    deliveryProvider: lastExpense.deliveryProvider ?? "",
    deliveryProviderOther: lastExpense.deliveryProviderOther ?? ""
  }, false);
  els.amount.focus();
});

// ---------- FORM SUBMIT ----------
els.form.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const isEditing = Boolean(els.editingId.value);

  const payload = {
    date: els.date.value,
    amount: parseAmount(els.amount.value),
    category: els.category.value,
    subcategory: els.subcategory.value,
    kind: els.kind.value,
    deliveryProvider: isDeliverySelected() ? (els.deliveryProvider.value || "") : "",
    deliveryProviderOther: isDeliverySelected() && els.deliveryProvider.value === "outros" ? (els.deliveryProviderOther.value || "").trim() : "",
    paymentMethod: els.paymentMethod.value,
    card: els.paymentMethod.value === "credito" ? (els.card.value || "") : "",
    installments: els.paymentMethod.value === "credito" ? Number(els.installments.value || 1) : 1,
    fuelPricePerLiter: isFuelSelected() && els.fuelPricePerLiter.value !== "" ? Number(els.fuelPricePerLiter.value) : undefined,
    fuelType: isFuelSelected() ? (els.fuelType.value || "") : "",
    priority: els.priority.value,
    merchant: (els.merchant.value || "").trim(),
    description: (els.description.value || "").trim(),
  };

  if (!payload.date) return alert("Selecione a data.");
  if (!(payload.amount > 0)) return alert("Informe um valor maior que zero.");

  if (isEditing) {
    await updateExpense(els.editingId.value, { ...payload });
    els.editingId.value = "";
  } else {
    await addExpense({
      id: uid(),
      ...payload,
      createdAt: toLocalISOString(new Date())
    });
  }

  showToast(isEditing ? "Gasto atualizado." : "Gasto salvo.");

  els.form.reset();
  els.date.value = todayISO();
  refreshSubcategories();
  els.cardField.style.display = "none";
  els.installmentsField.style.display = "none";
  els.installments.value = "1";
  els.fuelFields.style.display = "none";
  els.fuelPricePerLiter.value = "";
  els.fuelType.value = "";
  els.kind.value = "compra";
  els.deliveryFields.style.display = "none";
  els.deliveryProvider.value = "";
  els.deliveryOtherField.style.display = "none";
  els.deliveryProviderOther.value = "";
  await reload();
});

// ---------- LIST FILTERS ----------
[
  els.rangeStart, els.rangeEnd, els.filterCategory,
  els.filterPayment, els.searchText
].forEach(el => el.addEventListener("input", renderList));

els.clearFilters.addEventListener("click", () => {
  els.rangeStart.value = "";
  els.rangeEnd.value = "";
  els.filterCategory.value = "";
  els.filterPayment.value = "";
  els.searchText.value = "";
  renderList();
});

// ---------- SETTINGS ----------
els.exportJson.addEventListener("click", async () => {
  const data = await getAllExpenses();
  const normalized = data.map(e => ({
    ...e,
    createdAt: normalizeCreatedAt(e.createdAt)
  }));
  const json = JSON.stringify({ version: 1, exportedAt: toLocalISOString(new Date()), expenses: normalized }, null, 2);
  downloadFile(`gastos-backup-${todayISO()}.json`, json, "application/json");
});

els.exportCsv.addEventListener("click", async () => {
  const data = await getAllExpenses();
  const csv = toCSV(data);
  downloadFile(`gastos-${todayISO()}.csv`, csv, "text/csv;charset=utf-8");
});

els.exportSheets.addEventListener("click", async () => {
  const data = await getAllExpenses();
  const csv = toCSV(data);
  downloadFile(`gastos-${todayISO()}.csv`, csv, "text/csv;charset=utf-8");

  // Abre planilha nova. Depois: Arquivo > Importar > Upload > selecione o CSV.
  window.open("https://sheet.new", "_blank");
});

els.importJson.addEventListener("click", () => els.importFile.click());

els.importFile.addEventListener("change", async () => {
  const file = els.importFile.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const obj = JSON.parse(text);
    if (!obj?.expenses || !Array.isArray(obj.expenses)) throw new Error("Arquivo inválido.");

    // Import: adiciona/atualiza por id
    for (const e of obj.expenses) {
      if (!e.id) continue;
      await updateExpense(e.id, e).catch(async () => {
        await addExpense(e);
      });
    }

    alert("Importação concluída!");
    els.importFile.value = "";
    await reload();
  } catch (err) {
    console.error(err);
    alert("Falha ao importar. Verifique se é um JSON exportado pelo app.");
  }
});

els.resetAll.addEventListener("click", async () => {
  const ok = confirm("Tem certeza? Isso apaga TODOS os gastos deste aparelho.");
  if (!ok) return;
  await clearAll();
  await reload();
  alert("Tudo apagado.");
});

// ---------- INSIGHTS ----------
initCharts();
els.refreshInsights.addEventListener("click", refreshInsights);

function refreshInsights() {
  const mode = els.periodMode.value;
  const start = els.insStart.value;
  const end = els.insEnd.value;

  // Usa dados já carregados, filtra
  const filtered = allExpenses
    .filter(e => inRangeISO(e.date, start, end))
    .sort((a,b) => a.date.localeCompare(b.date));

  const normalizedMode = (mode === "range") ? "daily" : mode; // range = daily com start/end
  const ins = buildInsights(filtered, normalizedMode);
  renderCharts(ins);

  els.statTotal.textContent = formatBRL(ins.stats.total);
  els.statAvg.textContent = formatBRL(ins.stats.avg);
  els.statTopCat.textContent = ins.stats.topCategory || "—";

  const labelMode = ({
    daily: "Diária", weekly: "Semanal", monthly: "Mensal", yearly: "Anual", range: "Range"
  })[mode] || "—";
  els.insightsPill.textContent = `Período: ${labelMode}${start || end ? ` (${start || "…"} → ${end || "…"})` : ""}`;
}

// ---------- LOAD ----------
async function reload() {
  allExpenses = await getAllExpenses();
  lastExpense = allExpenses[0] || null;

  renderList();
  refreshInsights();
}

function renderList() {
  const start = els.rangeStart.value;
  const end = els.rangeEnd.value;
  const cat = els.filterCategory.value;
  const pay = els.filterPayment.value;
  const q = els.searchText.value;

  const filtered = allExpenses.filter(e => {
    if (!inRangeISO(e.date, start, end)) return false;
    if (cat && e.category !== cat) return false;
    if (pay && e.paymentMethod !== pay) return false;
    if (!includesText(e, q)) return false;
    return true;
  });

  const total = filtered.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  els.totalPill.textContent = `Total: ${formatBRL(total)}`;

  els.emptyState.style.display = filtered.length ? "none" : "block";

  renderExpenses(els.list, filtered, {
    onEdit: async (id) => {
      const e = await getExpenseById(id);
      if (!e) return;
      fillForm(e, true);
      els.tabs.forEach(b => b.classList.remove("active"));
      const homeTab = els.tabs.find(t => t.dataset.tab === "home");
      if (homeTab) homeTab.classList.add("active");
      Object.values(els.panels).forEach(p => p.classList.remove("active"));
      els.panels.home.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onDelete: async (id) => {
      const ok = confirm("Excluir este gasto?");
      if (!ok) return;
      await deleteExpense(id);
      await reload();
    }
  });
}

function fillForm(e, editing) {
  if (e?.category) ensureCategoryExists(e.category);
  if (e?.category && e?.subcategory) ensureSubcategoryExists(e.category, e.subcategory);
  saveConfig(cfg);
  refreshCategoryOptions({ keepSelection: true });

  els.date.value = e.date || todayISO();
  els.amount.value = e.amount ?? "";
  els.category.value = e.category || (getCategoryNames()[0] || "Outros");
  refreshSubcategories({ keepSelection: false });
  els.subcategory.value = e.subcategory || (cfg.categories[els.category.value]?.[0] || "Diversos");
  updateFuelFieldsVisibility();
  updateDeliveryFieldsVisibility();
  els.kind.value = e.kind || "compra";

  if (isDeliverySelected()) {
    els.deliveryProvider.value = e.deliveryProvider || "";
    els.deliveryProviderOther.value = e.deliveryProviderOther || "";
    updateDeliveryFieldsVisibility();
  }
  els.paymentMethod.value = e.paymentMethod || "pix";

  const isCredit = els.paymentMethod.value === "credito";
  els.cardField.style.display = isCredit ? "block" : "none";
  els.installmentsField.style.display = isCredit ? "block" : "none";
  els.card.value = isCredit ? (e.card || "") : "";
  els.installments.value = String(isCredit ? (e.installments ?? 1) : 1);

  if (isFuelSelected()) {
    els.fuelPricePerLiter.value = (e.fuelPricePerLiter ?? "") === null ? "" : String(e.fuelPricePerLiter ?? "");
    els.fuelType.value = e.fuelType || "";
  }

  els.priority.value = e.priority || "essencial";
  els.merchant.value = e.merchant || "";
  els.description.value = e.description || "";

  els.editingId.value = editing ? e.id : "";
}

// defaults
els.date.value = todayISO();
reload();
