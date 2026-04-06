/* ============================================================
   EXPENSE TRACKER — JavaScript
   ============================================================ */

const STORAGE_KEY = 'expense_tracker_v1';
const CURRENCY    = '₱';
const APP_STORAGE_KEYS = [
  STORAGE_KEY,
  'dropbox_access_token',
  'dropbox_app_key',
  'tip_dismissed',
];


/* ── Tip Banner ────────────────────────────────────────── */

function dismissTip() {
  const banner = document.getElementById('tip-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('tip_dismissed', '1');
}

(function initTip() {
  if (localStorage.getItem('tip_dismissed') === '1') {
    document.addEventListener('DOMContentLoaded', () => {
      const banner = document.getElementById('tip-banner');
      if (banner) banner.style.display = 'none';
    });
  }
})();

// Category colors — used by expense cards and the pie chart
const CATEGORY_COLORS = {
  Food:          '#EC8F8D',
  Transport:     '#44A194',
  Bills:         '#537D96',
  Health:        '#76c4b8',
  Entertainment: '#d4a49e',
  Shopping:      '#e0b4a0',
  Service:       '#7fb3a8',
  Loans:         '#c4a96a',
  Other:         '#b8b0a0',
};


/* ── Storage Helpers ──────────────────────────────────────── */

function loadExpenses() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function saveExpenses(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}


/* ── Date Helper ──────────────────────────────────────────── */

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(isoDate) {
  return new Date(isoDate + 'T00:00').toLocaleDateString('default', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}


/* ── Tab Navigation ───────────────────────────────────────── */

function showTab(tabName, clickedBtn) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });

  // Deactivate all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show the selected section
  document.getElementById('tab-' + tabName).classList.add('active');

  // Activate the clicked button
  clickedBtn.classList.add('active');

  // Run tab-specific setup
  if (tabName === 'list') {
    populateMonthFilter();
    populateChartMonthFilter();
    renderExpenseList();
    renderPieChart();
  }

  if (tabName === 'export') {
    updateDropboxUI();
  }
}


/* ── Add Expense ──────────────────────────────────────────── */

function addExpense() {
  const date     = document.getElementById('inp-date').value;
  const amount   = parseFloat(document.getElementById('inp-amount').value);
  const category = document.getElementById('inp-category').value;
  const payment  = document.getElementById('inp-payment').value;
  const desc     = document.getElementById('inp-desc').value.trim();

  // Validation
  if (!date)              return showToast('Please select a date');
  if (!amount || amount <= 0) return showToast('Please enter a valid amount');
  if (!category)          return showToast('Please select a category');

  // Build and store new entry
  const expenses = loadExpenses();
  expenses.push({ id: Date.now(), date, amount, category, payment, desc });
  saveExpenses(expenses);

  // Reset form fields (keep date as today)
  document.getElementById('inp-amount').value   = '';
  document.getElementById('inp-category').value = '';
  document.getElementById('inp-desc').value     = '';
  document.getElementById('inp-date').value     = todayISO();

  showToast('✅ Expense saved!');
}


/* ── Edit Expense Amount ──────────────────────────────────── */

function editExpenseAmount(id) {
  const expenses = loadExpenses();
  const expense  = expenses.find(e => e.id === id);
  if (!expense) return;

  const amountEl = document.getElementById('amount-' + id);
  if (!amountEl) return;

  // Replace the amount text with an inline input
  const current = parseFloat(expense.amount).toFixed(2);
  amountEl.innerHTML = `
    <input type="number" class="edit-amount-input" id="edit-input-${id}"
           value="${current}" min="0" step="0.01" inputmode="decimal" />
    <div class="edit-amount-actions">
      <button class="edit-save-btn" onclick="saveEditedAmount(${id})">✓</button>
      <button class="edit-cancel-btn" onclick="cancelEditAmount(${id}, ${current})">✕</button>
    </div>`;
  document.getElementById('edit-input-' + id).focus();
}

function saveEditedAmount(id) {
  const input = document.getElementById('edit-input-' + id);
  const newAmount = parseFloat(input.value);
  if (!newAmount || newAmount <= 0) return showToast('Enter a valid amount');

  const expenses = loadExpenses();
  const expense  = expenses.find(e => e.id === id);
  if (!expense) return;

  expense.amount = newAmount;
  saveExpenses(expenses);
  renderExpenseList();
  updateStats();
  showToast('✅ Amount updated — refresh the page to see changes everywhere');
}

function cancelEditAmount(id, original) {
  const amountEl = document.getElementById('amount-' + id);
  if (amountEl) amountEl.textContent = CURRENCY + parseFloat(original).toFixed(2);
}


/* ── Delete Expense ───────────────────────────────────────── */

function deleteExpense(id) {
  const updated = loadExpenses().filter(expense => expense.id !== id);
  saveExpenses(updated);
  populateMonthFilter();
  renderExpenseList();
  showToast('Deleted');
}


/* ── Populate Month Filter Dropdown ──────────────────────── */

function populateMonthFilter() {
  const expenses = loadExpenses();
  const months = [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse();

  const select = document.getElementById('filter-month');
  const currentValue = select.value;

  select.innerHTML = '<option value="">All months</option>';

  months.forEach(month => {
    const [year, mo] = month.split('-');
    const label = new Date(year, mo - 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric'
    });
    const option = document.createElement('option');
    option.value = month;
    option.textContent = label;
    if (currentValue === month) option.selected = true;
    select.appendChild(option);
  });
}


/* ── Render Expense List ──────────────────────────────────── */

function renderExpenseList() {
  const catFilter   = document.getElementById('filter-cat').value;
  const monthFilter = document.getElementById('filter-month').value;

  let expenses = loadExpenses();

  // Apply filters
  if (catFilter)   expenses = expenses.filter(e => e.category === catFilter);
  if (monthFilter) expenses = expenses.filter(e => e.date.startsWith(monthFilter));

  // Update summary stats (always use unfiltered data)
  updateStats();

  const listContainer = document.getElementById('expense-list');

  if (expenses.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No expenses found.<br>Tap <strong>Add</strong> to log one!</p>
      </div>`;
    return;
  }

  // Sort by date descending, then by id descending
  const sorted = [...expenses].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.id - a.id;
  });

  listContainer.innerHTML = sorted.map(expense => buildExpenseCard(expense)).join('');
}


/* ── Build a Single Expense Card HTML ────────────────────── */

function buildExpenseCard(expense) {
  const dateLabel = formatDate(expense.date);
  const noteHTML  = expense.desc
    ? `<div class="expense-note">${expense.desc}</div>`
    : '';

  return `
    <div class="expense-item" data-category="${expense.category}">
      <div class="expense-info">
        <div class="expense-category">${expense.category}</div>
        <div class="expense-meta">${dateLabel} · ${expense.payment}</div>
        ${noteHTML}
      </div>
      <div class="expense-right">
        <div class="expense-amount" id="amount-${expense.id}">${CURRENCY}${parseFloat(expense.amount).toFixed(2)}</div>
        <div class="expense-actions">
          <button class="edit-btn" onclick="editExpenseAmount(${expense.id})">✎ edit</button>
          <button class="delete-btn" onclick="deleteExpense(${expense.id})">✕ delete</button>
        </div>
      </div>
    </div>`;
}


/* ── Update Summary Stats ─────────────────────────────────── */

function updateStats() {
  const all     = loadExpenses();
  const today   = todayISO();

  const totalAll    = all.reduce((sum, e) => sum + e.amount, 0);
  const totalToday  = all.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);

  document.getElementById('stat-total').textContent = CURRENCY + totalAll.toFixed(2);
  document.getElementById('stat-today').textContent = CURRENCY + totalToday.toFixed(2);
  document.getElementById('stat-count').textContent = all.length;
}


/* ── Export to CSV ────────────────────────────────────────── */

function exportCSV() {
  const expenses = loadExpenses();

  if (expenses.length === 0) {
    return showToast('No data to export yet!');
  }

  const headers = ['Date', 'Amount', 'Category', 'Payment Method', 'Description'];

  const rows = expenses
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => [
      e.date,
      e.amount,
      e.category,
      e.payment,
      '"' + (e.desc || '').replace(/"/g, '""') + '"'
    ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href     = url;
  link.download = `expenses_${todayISO()}.csv`;
  link.click();

  URL.revokeObjectURL(url);
  showToast('✅ CSV downloaded!');
}


/* ── Import CSV ───────────────────────────────────────────── */

function importCSV(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const result = importCSVText(e.target.result);
    input.value = '';
    if (result.added > 0) {
      showToast(`✅ Imported ${result.added} expense${result.added > 1 ? 's' : ''}`);
    } else {
      showToast(result.error || 'No new expenses found (all duplicates or empty)');
    }
  };

  reader.readAsText(file);
}

/* Shared CSV text importer — used by file import and Dropbox import */
function importCSVText(text) {
  text = (text || '').trim();
  const lines = text.split(/\r?\n/);

  if (lines.length < 2) {
    return { added: 0, error: 'CSV file is empty or has no data rows' };
  }

  const dataLines = lines.slice(1);
  const existing  = loadExpenses();
  let added = 0;

  dataLines.forEach(line => {
    const cols = parseCSVLine(line);
    if (cols.length < 4) return;

    const date     = (cols[0] || '').trim();
    const amount   = parseFloat(cols[1]);
    const category = (cols[2] || '').trim();
    const payment  = (cols[3] || '').trim();
    const desc     = (cols[4] || '').trim();

    if (!date || !amount || amount <= 0 || !category) return;

    const isDuplicate = existing.some(ex =>
      ex.date === date &&
      ex.amount === amount &&
      ex.category === category &&
      (ex.desc || '') === desc
    );

    if (!isDuplicate) {
      existing.push({ id: Date.now() + added, date, amount, category, payment: payment || 'Cash', desc });
      added++;
    }
  });

  saveExpenses(existing);
  return { added };
}

/* Parse a single CSV line, respecting quoted fields */
function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cols.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  cols.push(current);
  return cols;
}


/* ── Clear All Data ───────────────────────────────────────── */

function clearAll() {
  const confirmed = confirm('Clear all app data (expenses + Dropbox connection)? This cannot be undone.');
  if (!confirmed) return;

  APP_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  renderExpenseList();

  // Keep export tab in sync if it is currently visible.
  if (typeof updateDropboxUI === 'function') updateDropboxUI();

  showToast('App data cleared');
}


/* ── Pie Chart ────────────────────────────────────────────── */

let pieChartInstance = null;

function populateChartMonthFilter() {
  const expenses = loadExpenses();
  const months   = [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse();

  const select      = document.getElementById('chart-month');
  const currentValue = select.value;

  select.innerHTML = '<option value="">This month</option>';

  months.forEach(month => {
    const [year, mo] = month.split('-');
    const label = new Date(year, mo - 1).toLocaleString('default', {
      month: 'long', year: 'numeric'
    });
    const option = document.createElement('option');
    option.value       = month;
    option.textContent = label;
    if (currentValue === month) option.selected = true;
    select.appendChild(option);
  });
}

function renderPieChart() {
  const selectedMonth = document.getElementById('chart-month').value;
  const currentMonth  = todayISO().slice(0, 7);
  const filterMonth   = selectedMonth || currentMonth;

  const expenses = loadExpenses().filter(e => e.date.startsWith(filterMonth));

  // Tally by category
  const totals = {};
  expenses.forEach(e => {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  });

  const labels     = Object.keys(totals);
  const data       = Object.values(totals);
  const colors     = labels.map(cat => CATEGORY_COLORS[cat] || '#a0aec0');
  const grandTotal = data.reduce((s, v) => s + v, 0);

  // Destroy previous chart instance before redrawing
  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  const canvas = document.getElementById('pie-chart');
  const legend = document.getElementById('chart-legend');

  if (labels.length === 0) {
    canvas.style.display = 'none';
    legend.innerHTML = '<p class="chart-empty">No expenses for this month yet.</p>';
    return;
  }

  canvas.style.display = 'block';

  pieChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 8,
      }]
    },
    options: {
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = ((ctx.parsed / grandTotal) * 100).toFixed(1);
              return ` ${CURRENCY}${ctx.parsed.toLocaleString('en-PH', { minimumFractionDigits: 2 })}  (${pct}%)`;
            }
          }
        }
      }
    }
  });

  // Custom legend
  legend.innerHTML = labels.map((cat, i) => {
    const pct = ((data[i] / grandTotal) * 100).toFixed(1);
    return `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span class="legend-label">${cat}</span>
        <span class="legend-amount">${CURRENCY}${data[i].toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        <span class="legend-pct">${pct}%</span>
      </div>`;
  }).join('');
}


/* ── Toast Notification ───────────────────────────────────── */

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}


/* ── Init on Page Load ────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('inp-date').value = todayISO();
  populateMonthFilter();
});
