// charts.js
import { formatBRL, weekKey, monthKey, yearKey, summarizeTopCategory } from "./utils.js";

let lineChart, pieChart, barChart;

export function initCharts() {
  const lineCtx = document.getElementById("lineChart");
  const pieCtx = document.getElementById("pieChart");
  const barCtx = document.getElementById("barChart");

  lineChart = new Chart(lineCtx, {
    type: "line",
    data: { labels: [], datasets: [{ label: "Gastos", data: [] }] },
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
    data: { labels: [], datasets: [{ label: "Total", data: [] }] },
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

  for (const e of expenses) {
    const k = bucket(e.date);
    series[k] = (series[k] || 0) + Number(e.amount || 0);

    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount || 0);

    const pm = e.paymentMethod === "credito" ? `Crédito${e.card ? ` (${e.card})` : ""}` :
               e.paymentMethod === "debito" ? "Débito" : "Pix";
    byPayment[pm] = (byPayment[pm] || 0) + Number(e.amount || 0);
  }

  const labels = Object.keys(series).sort();
  const values = labels.map(k => series[k]);

  const catLabels = Object.keys(byCategory).sort((a,b) => byCategory[b] - byCategory[a]);
  const catValues = catLabels.map(k => byCategory[k]);

  const payLabels = Object.keys(byPayment).sort((a,b) => byPayment[b] - byPayment[a]);
  const payValues = payLabels.map(k => byPayment[k]);

  const total = values.reduce((a,b) => a + b, 0);
  const days = estimateDays(expenses);
  const avg = days > 0 ? total / days : 0;

  return {
    line: { labels, values },
    pie: { labels: catLabels, values: catValues },
    bar: { labels: payLabels, values: payValues },
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
  pieChart.update();

  barChart.data.labels = ins.bar.labels;
  barChart.data.datasets[0].data = ins.bar.values;
  barChart.update();
}
