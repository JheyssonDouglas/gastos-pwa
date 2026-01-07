// app.js
import {
  loadConfig, addExpense, updateExpense, deleteExpense, getAllExpenses,
  getExpenseById, clearAll, saveConfig, upsertExpenses
} from "./db.js";

import {
  uid, todayISO, parseAmount, formatBRL,
  inRangeISO, includesText, toCSV, parseCSV, downloadFile, toLocalISOString, normalizeCreatedAt
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
  addCardBtn: document.getElementById("addCardBtn"),
  priority: document.getElementById("priority"),
  merchant: document.getElementById("merchant"),
  description: document.getElementById("description"),
  editingId: document.getElementById("editingId"),

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
  insStartField: document.getElementById("insStartField"),
  insEndField: document.getElementById("insEndField"),
  insStart: document.getElementById("insStart"),
  insEnd: document.getElementById("insEnd"),
  refreshInsights: document.getElementById("refreshInsights"),
  insightsPill: document.getElementById("insightsPill"),
  statTotal: document.getElementById("statTotal"),
  statAvg: document.getElementById("statAvg"),
  statTopCat: document.getElementById("statTopCat"),

  // settings
  exportCsv: document.getElementById("exportCsv"),
  importCsv: document.getElementById("importCsv"),
  importCsvFile: document.getElementById("importCsvFile"),
  openExpenses: document.getElementById("openExpenses"),
  backToSettings: document.getElementById("backToSettings"),
  resetAll: document.getElementById("resetAll"),
  toast: document.getElementById("toast"),
  confirmOverlay: document.getElementById("confirmOverlay"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmOk: document.getElementById("confirmOk"),
};

let allExpenses = [];

let toastTimer = null;

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2200);
}

function openConfirmModal(message) {
  if (!els.confirmOverlay) {
    showToast(message);
    return;
  }
  if (els.confirmMessage) els.confirmMessage.textContent = message;
  els.confirmOverlay.classList.add("show");
  els.confirmOverlay.setAttribute("aria-hidden", "false");
  if (els.confirmOk) els.confirmOk.focus();
}

function closeConfirmModal() {
  if (!els.confirmOverlay) return;
  els.confirmOverlay.classList.remove("show");
  els.confirmOverlay.setAttribute("aria-hidden", "true");
}

if (els.confirmOverlay) {
  els.confirmOverlay.addEventListener("click", (ev) => {
    if (ev.target === els.confirmOverlay) closeConfirmModal();
  });
}

if (els.confirmOk) {
  els.confirmOk.addEventListener("click", () => closeConfirmModal());
}

document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape") return;
  if (!els.confirmOverlay) return;
  if (!els.confirmOverlay.classList.contains("show")) return;
  closeConfirmModal();
});

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
    const panel = els.panels[tab];
    if (panel) panel.classList.add("active");

    if (tab === "insights") refreshInsights();
  });
});

if (els.openExpenses) {
  els.openExpenses.addEventListener("click", () => {
    els.tabs.forEach(b => b.classList.remove("active"));
    const settingsTab = els.tabs.find(t => t.dataset.tab === "settings");
    if (settingsTab) settingsTab.classList.add("active");
    Object.values(els.panels).forEach(p => p.classList.remove("active"));
    if (els.panels.expenses) els.panels.expenses.classList.add("active");
  });
}

if (els.backToSettings) {
  els.backToSettings.addEventListener("click", () => {
    els.tabs.forEach(b => b.classList.remove("active"));
    const settingsTab = els.tabs.find(t => t.dataset.tab === "settings");
    if (settingsTab) settingsTab.classList.add("active");
    Object.values(els.panels).forEach(p => p.classList.remove("active"));
    if (els.panels.settings) els.panels.settings.classList.add("active");
  });
}

// ---------- INIT SELECTS ----------
refreshCategoryOptions();
refreshCardOptions();

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

function ensureCardExists(cardName) {
  const name = String(cardName || "").trim();
  if (!name) return;
  cfg.cards = Array.isArray(cfg.cards) ? cfg.cards : [];
  if (!cfg.cards.includes(name)) cfg.cards.push(name);
}

function refreshCardOptions({ keepSelection=true } = {}) {
  const prev = keepSelection ? els.card.value : "";
  const cards = Array.isArray(cfg.cards) ? cfg.cards : [];
  els.card.innerHTML = "";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "—";
  els.card.appendChild(blank);

  for (const cardName of cards) {
    const opt = document.createElement("option");
    opt.value = cardName;
    opt.textContent = cardName;
    els.card.appendChild(opt);
  }

  if (keepSelection) els.card.value = prev;
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

  setOptionsWithCustom(els.category, categoryNames, { customLabel: "Adicionar nova categoria…" });
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
  setOptionsWithCustom(els.subcategory, subs, { customLabel: "Adicionar nova subcategoria…" });

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
  els.deliveryFields.style.display = show ? "" : "none";
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
  const isDebit = els.paymentMethod.value === "debito";
  const needsCard = isCredit || isDebit;

  els.cardField.style.display = needsCard ? "" : "none";
  els.installmentsField.style.display = isCredit ? "" : "none";
  els.card.required = needsCard;

  if (!needsCard) els.card.value = "";
  if (!isCredit) els.installments.value = "1";
});

els.installments.addEventListener("change", () => {
  if (els.installments.value !== CUSTOM_OPTION_VALUE) return;
  const raw = prompt("Quantas parcelas? (ex: 18)")?.trim();
  if (!raw) {
    els.installments.value = "1";
    return;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    alert("Número de parcelas inválido.");
    els.installments.value = "1";
    return;
  }

  const val = String(Math.floor(n));
  let opt = Array.from(els.installments.options).find(o => o.value === val);
  if (!opt) {
    opt = document.createElement("option");
    opt.value = val;
    opt.textContent = `${val}x`;
    const customOpt = Array.from(els.installments.options).find(o => o.value === CUSTOM_OPTION_VALUE);
    els.installments.insertBefore(opt, customOpt || null);
  }
  els.installments.value = val;
});

if (els.addCardBtn) {
  els.addCardBtn.addEventListener("click", () => {
    const name = prompt("Nome do cartão (ex: Nubank, Itaú, Inter):")?.trim();
    if (!name) return;
    ensureCardExists(name);
    saveConfig(cfg);
    refreshCardOptions({ keepSelection: false });
    els.card.value = name;
  });
}

updateDeliveryFieldsVisibility();
els.paymentMethod.dispatchEvent(new Event("change"));

// ---------- FORM SUBMIT ----------
els.form.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  if (!String(els.amount.value || "").trim()) {
    alert("Você não cadastrou o valor.");
    els.amount.focus();
    return;
  }

  const isEditing = Boolean(els.editingId.value);
  const isCredit = els.paymentMethod.value === "credito";
  const isDebit = els.paymentMethod.value === "debito";
  const needsCard = isCredit || isDebit;

  if (needsCard && !els.card.value) {
    alert("Selecione um cartão (ou adicione um novo). ");
    return;
  }

  if (needsCard && els.card.value) {
    ensureCardExists(els.card.value);
    saveConfig(cfg);
    refreshCardOptions();
  }

  const payload = {
    date: els.date.value,
    amount: parseAmount(els.amount.value),
    category: els.category.value,
    subcategory: els.subcategory.value,
    kind: els.kind.value,
    deliveryProvider: isDeliverySelected() ? (els.deliveryProvider.value || "") : "",
    deliveryProviderOther: isDeliverySelected() && els.deliveryProvider.value === "outros" ? (els.deliveryProviderOther.value || "").trim() : "",
    paymentMethod: els.paymentMethod.value,
    card: needsCard ? (els.card.value || "") : "",
    installments: isCredit ? Number(els.installments.value || 1) : 1,
    fuelPricePerLiter: isFuelSelected() ? parseAmount(els.fuelPricePerLiter.value) : 0,
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

  openConfirmModal(isEditing ? "Gasto atualizado." : "Gasto salvo.");

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

// ---------- SETTINGS (BACKUP CSV) ----------
els.exportCsv.addEventListener("click", async () => {
  const data = await getAllExpenses();
  const csv = toCSV(data);
  downloadFile(`gastos-${todayISO()}.csv`, csv, "text/csv;charset=utf-8");
});

els.importCsv.addEventListener("click", () => els.importCsvFile.click());

els.importCsvFile.addEventListener("change", async () => {
  const file = els.importCsvFile.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error("CSV vazio ou inválido");

    const imported = [];
    for (const r of rows) {
      const id = (r.id || "").trim() || uid();
      const date = (r.date || "").trim();
      if (!date) continue;

      const amount = Number(String(r.amount ?? "").replaceAll(",", "."));
      const installmentsRaw = (r.installments ?? "").trim();
      const installments = installmentsRaw === "" ? undefined : Number(installmentsRaw);

      const fuelPriceRaw = (r.fuelPricePerLiter ?? "").trim();
      const fuelPricePerLiter = fuelPriceRaw === "" ? undefined : Number(String(fuelPriceRaw).replaceAll(",", "."));

      imported.push({
        id,
        date,
        amount: Number.isFinite(amount) ? amount : 0,
        category: (r.category || "").trim(),
        subcategory: (r.subcategory || "").trim(),
        kind: (r.kind || "").trim() || "compra",
        deliveryProvider: (r.deliveryProvider || "").trim(),
        deliveryProviderOther: (r.deliveryProviderOther || "").trim(),
        paymentMethod: (r.paymentMethod || "").trim() || "pix",
        card: (r.card || "").trim(),
        installments: Number.isFinite(installments) ? installments : undefined,
        fuelPricePerLiter: Number.isFinite(fuelPricePerLiter) ? fuelPricePerLiter : undefined,
        fuelType: (r.fuelType || "").trim(),
        priority: (r.priority || "").trim() || "importante",
        merchant: (r.merchant || "").trim(),
        description: (r.description || "").trim(),
        createdAt: normalizeCreatedAt(r.createdAt || toLocalISOString(new Date()))
      });
    }

    if (!imported.length) throw new Error("Nenhum registro válido encontrado no CSV");
    await upsertExpenses(imported);

    alert("Importação concluída!");
    els.importCsvFile.value = "";
    await reload();
  } catch (err) {
    console.error(err);
    alert("Falha ao importar CSV. Veja o console.");
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
updateInsightsRangeVisibility();

els.periodMode.addEventListener("change", () => {
  updateInsightsRangeVisibility();
  refreshInsights();
});

function updateInsightsRangeVisibility() {
  const isRange = els.periodMode.value === "range";
  if (els.insStartField) els.insStartField.style.display = isRange ? "" : "none";
  if (els.insEndField) els.insEndField.style.display = isRange ? "" : "none";
  if (!isRange) {
    els.insStart.value = "";
    els.insEnd.value = "";
  }
}

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
    daily: "Diária", weekly: "Semanal", monthly: "Mensal", yearly: "Anual", range: "Escolher período"
  })[mode] || "—";
  els.insightsPill.textContent = `Período: ${labelMode}${start || end ? ` (${start || "…"} → ${end || "…"})` : ""}`;
}

// ---------- LOAD ----------
async function reload() {
  allExpenses = await getAllExpenses();

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
  if ((e?.paymentMethod === "credito" || e?.paymentMethod === "debito") && e?.card) ensureCardExists(e.card);
  saveConfig(cfg);
  refreshCategoryOptions({ keepSelection: true });
  refreshCardOptions({ keepSelection: true });

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
  const isDebit = els.paymentMethod.value === "debito";
  const needsCard = isCredit || isDebit;
  els.cardField.style.display = needsCard ? "" : "none";
  els.installmentsField.style.display = isCredit ? "" : "none";
  els.card.required = needsCard;
  els.card.value = needsCard ? (e.card || "") : "";
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
