// charts.js
import { formatBRL, weekKey, monthKey, yearKey, summarizeTopCategory } from "./utils.js";

let lineChart, pieChart, barChart, deliveryChart, kindChart;

const PALETTE = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7",
  "#06b6d4", "#f97316", "#84cc16", "#14b8a6", "#e11d48",
  "#0ea5e9", "#8b5cf6", "#10b981", "#f43f5e", "#6366f1"
];

function colorsFor(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(PALETTE[i % PALETTE.length]);
  return out;
}

export function initCharts() {
  const lineCtx = document.getElementById("lineChart");
  const pieCtx = document.getElementById("pieChart");
  const barCtx = document.getElementById("barChart");
  const deliveryCtx = document.getElementById("deliveryChart");
  const kindCtx = document.getElementById("kindChart");

  lineChart = new Chart(lineCtx, {
    type: "line",
    data: { labels: [], datasets: [{
      label: "Gastos",
      data: [],
      borderColor: "#3b82f6",
      backgroundColor: "rgba(59,130,246,0.18)",
      tension: 0.25,
      fill: true,
      pointRadius: 2
    }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: {
            callback: (v) => formatBRL(v)
          }
        }
      }
    }
  });

  pieChart = new Chart(pieCtx, {
    type: "doughnut",
    data: { labels: [], datasets: [{ data: [] }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });

  barChart = new Chart(barCtx, {
    type: "bar",
    data: { labels: [], datasets: [{ label: "Total", data: [], backgroundColor: "#22c55e" }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { callback: (v) => formatBRL(v) }
        }
      }
    }
  });

  deliveryChart = new Chart(deliveryCtx, {
    type: "doughnut",
    data: { labels: [], datasets: [{ data: [] }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });

  kindChart = new Chart(kindCtx, {
    type: "doughnut",
    data: { labels: [], datasets: [{ data: [] }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
}

export function buildInsights(expenses, mode) {
  const bucket = (dateISO) => {
    if (mode === "weekly") return weekKey(dateISO);
    if (mode === "monthly") return monthKey(dateISO);
    if (mode === "yearly") return yearKey(dateISO);
    return dateISO; // daily
  };

  const series = {};
  const byCategory = {};
  const byPayment = {};
  const byDelivery = {};
  const byKind = {};

  for (const e of expenses) {
    const k = bucket(e.date);
    series[k] = (series[k] || 0) + Number(e.amount || 0);

    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount || 0);

    const pm = e.paymentMethod === "credito" ? `Crédito${e.card ? ` (${e.card})` : ""}` :
               e.paymentMethod === "debito" ? "Débito" : "Pix";
    byPayment[pm] = (byPayment[pm] || 0) + Number(e.amount || 0);

    const knd = e.kind === "conta" ? "Conta" : (e.kind === "doacao" ? "Doação" : "Compra");
    byKind[knd] = (byKind[knd] || 0) + Number(e.amount || 0);

    if (e.subcategory === "Delivery") {
      const prov = e.deliveryProvider === "ifood" ? "iFood" :
                   e.deliveryProvider === "99" ? "99" :
                   e.deliveryProvider === "outros" ? (e.deliveryProviderOther || "Outros") :
                   (e.deliveryProvider || "(não informado)");
      byDelivery[prov] = (byDelivery[prov] || 0) + Number(e.amount || 0);
    }
  }

  const labels = Object.keys(series).sort();
  const values = labels.map(k => series[k]);

  const catLabels = Object.keys(byCategory).sort((a,b) => byCategory[b] - byCategory[a]);
  const catValues = catLabels.map(k => byCategory[k]);

  const payLabels = Object.keys(byPayment).sort((a,b) => byPayment[b] - byPayment[a]);
  const payValues = payLabels.map(k => byPayment[k]);

  const deliveryLabels = Object.keys(byDelivery).sort((a,b) => byDelivery[b] - byDelivery[a]);
  const deliveryValues = deliveryLabels.map(k => byDelivery[k]);

  const kindLabels = Object.keys(byKind).sort((a,b) => byKind[b] - byKind[a]);
  const kindValues = kindLabels.map(k => byKind[k]);

  const total = values.reduce((a,b) => a + b, 0);
  const days = estimateDays(expenses);
  const avg = days > 0 ? total / days : 0;

  return {
    line: { labels, values },
    pie: { labels: catLabels, values: catValues },
    bar: { labels: payLabels, values: payValues },
    delivery: { labels: deliveryLabels, values: deliveryValues },
    kind: { labels: kindLabels, values: kindValues },
    stats: {
      total,
      avg,
      topCategory: summarizeTopCategory(byCategory)
    }
  };
}

function estimateDays(expenses) {
  if (!expenses.length) return 0;
  const dates = expenses.map(e => e.date).sort();
  const start = new Date(dates[dates.length - 1] + "T00:00:00"); // min? (lista pode estar filtrada)
  const end = new Date(dates[0] + "T00:00:00"); // max
  const diff = Math.abs(end - start);
  const days = Math.floor(diff / 86400000) + 1;
  return days;
}

export function renderCharts(ins) {
  lineChart.data.labels = ins.line.labels;
  lineChart.data.datasets[0].data = ins.line.values;
  lineChart.update();

  pieChart.data.labels = ins.pie.labels;
  pieChart.data.datasets[0].data = ins.pie.values;
  pieChart.data.datasets[0].backgroundColor = colorsFor(ins.pie.labels.length);
  pieChart.update();

  barChart.data.labels = ins.bar.labels;
  barChart.data.datasets[0].data = ins.bar.values;
  barChart.data.datasets[0].backgroundColor = colorsFor(ins.bar.labels.length);
  barChart.update();

  deliveryChart.data.labels = ins.delivery.labels;
  deliveryChart.data.datasets[0].data = ins.delivery.values;
  deliveryChart.data.datasets[0].backgroundColor = colorsFor(ins.delivery.labels.length);
  deliveryChart.update();

  kindChart.data.labels = ins.kind.labels;
  kindChart.data.datasets[0].data = ins.kind.values;
  kindChart.data.datasets[0].backgroundColor = colorsFor(ins.kind.labels.length);
  kindChart.update();
}
