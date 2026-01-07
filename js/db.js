// db.js
export const db = new Dexie("gastos_db");

db.version(1).stores({
  expenses: "id,date,amount,category,subcategory,paymentMethod,card,priority,description,merchant,createdAt"
});

db.version(2).stores({
  expenses: "id,date,amount,category,subcategory,paymentMethod,card,installments,priority,description,merchant,createdAt"
});

db.version(3).stores({
  expenses: "id,date,amount,category,subcategory,paymentMethod,card,installments,fuelPricePerLiter,fuelType,priority,description,merchant,createdAt"
});

db.version(4).stores({
  expenses: "id,date,amount,category,subcategory,kind,deliveryProvider,deliveryProviderOther,paymentMethod,card,installments,fuelPricePerLiter,fuelType,priority,description,merchant,createdAt"
});

// seed minimal config stored in localStorage (V2 pode virar tabela)
export function getDefaultConfig() {
  return {
    categories: {
      "Moradia": ["Aluguel", "Condomínio", "Luz", "Água", "Internet", "Manutenção", "Outros"],
      "Mercado": ["Supermercado", "Padaria", "Açougue", "Hortifruti", "Outros"],
      "Alimentação": ["Restaurante", "Delivery", "Café", "Outros"],
      "Transporte": ["Uber/99", "Combustível", "Estacionamento", "Ônibus/Metrô", "Outros"],
      "Saúde": ["Farmácia", "Médico", "Exames", "Academia", "Outros"],
      "Compras": ["Roupas", "Eletrônicos", "Presentes", "Outros"],
      "Lazer": ["Cinema", "Viagem", "Jogos", "Outros"],
      "Assinaturas": ["Streaming", "Apps", "Outros"],
      "Educação": ["Cursos", "Livros", "Outros"],
      "Outros": ["Outros"]
    },
    cards: []
  };
}

export function loadConfig() {
  const raw = localStorage.getItem("gastos_config_v1");
  if (raw) {
    try {
      const cfg = JSON.parse(raw);
      cfg.cards = Array.isArray(cfg.cards) ? cfg.cards : [];
      // garante categories obj
      if (!cfg.categories || typeof cfg.categories !== "object") cfg.categories = getDefaultConfig().categories;
      localStorage.setItem("gastos_config_v1", JSON.stringify(cfg));
      return cfg;
    } catch {}
  }
  const cfg = getDefaultConfig();
  localStorage.setItem("gastos_config_v1", JSON.stringify(cfg));
  return cfg;
}

export function saveConfig(cfg) {
  localStorage.setItem("gastos_config_v1", JSON.stringify(cfg));
}

export async function addExpense(expense) {
  await db.expenses.add(expense);
}

export async function updateExpense(id, patch) {
  await db.expenses.update(id, patch);
}

export async function deleteExpense(id) {
  await db.expenses.delete(id);
}

export async function getAllExpenses() {
  return await db.expenses.orderBy("date").reverse().toArray();
}

export async function getExpenseById(id) {
  return await db.expenses.get(id);
}

export async function upsertExpenses(expenses) {
  await db.expenses.bulkPut(expenses);
}

export async function clearAll() {
  await db.expenses.clear();
}
