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
      "Alimentação": ["Mercado", "Restaurante", "Delivery", "Café"],
      "Transporte": ["Uber/99", "Combustível", "Estacionamento", "Ônibus/Metrô"],
      "Casa": ["Aluguel", "Condomínio", "Luz", "Água", "Internet", "Manutenção"],
      "Saúde": ["Farmácia", "Médico", "Exames", "Academia"],
      "Assinaturas": ["Streaming", "Apps", "Outros"],
      "Compras": ["Roupas", "Eletrônicos", "Presentes"],
      "Lazer": ["Cinema", "Viagem", "Jogos"],
      "Educação": ["Cursos", "Livros"],
      "Outros": ["Diversos"]
    },
    cards: ["Itaú", "Sam’s Clube", "Carrefour", "C&A", "Riachuello", "iFood"]
  };
}

export function loadConfig() {
  const raw = localStorage.getItem("gastos_config_v1");
  if (raw) {
    try {
      const cfg = JSON.parse(raw);
      // garante cartões novos sem quebrar configs antigas
      const defaults = getDefaultConfig();
      cfg.cards = Array.isArray(cfg.cards) ? cfg.cards : [];
      for (const c of defaults.cards) {
        if (!cfg.cards.includes(c)) cfg.cards.push(c);
      }
      // garante categories obj
      if (!cfg.categories || typeof cfg.categories !== "object") cfg.categories = defaults.categories;
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
