/* ============================================================
   EXPENSE TRACKER — JavaScript
   ============================================================ */

const STORAGE_KEY = 'expense_tracker_v1';


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
    renderExpenseList();
  }

  if (tabName === 'export') {
    renderExportSummary();
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
        <div class="expense-amount">$${parseFloat(expense.amount).toFixed(2)}</div>
        <button class="delete-btn" onclick="deleteExpense(${expense.id})">✕ delete</button>
      </div>
    </div>`;
}


/* ── Update Summary Stats ─────────────────────────────────── */

function updateStats() {
  const all     = loadExpenses();
  const today   = todayISO();

  const totalAll    = all.reduce((sum, e) => sum + e.amount, 0);
  const totalToday  = all.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);

  document.getElementById('stat-total').textContent = '$' + totalAll.toFixed(2);
  document.getElementById('stat-today').textContent = '$' + totalToday.toFixed(2);
  document.getElementById('stat-count').textContent = all.length;
}


/* ── Render Export Summary ────────────────────────────────── */

function renderExportSummary() {
  const expenses = loadExpenses();
  const total    = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Tally by category
  const byCategory = {};
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });

  const categoryLines = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `<div>${cat}: <strong>$${amt.toFixed(2)}</strong></div>`)
    .join('');

  document.getElementById('export-summary').innerHTML = `
    <div>Total entries: <strong>${expenses.length}</strong></div>
    <div>Grand total: <strong>$${total.toFixed(2)}</strong></div>
    <hr>
    ${categoryLines || '<em style="color:#a0aec0">No data yet</em>'}
  `;
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


/* ── Clear All Data ───────────────────────────────────────── */

function clearAll() {
  const confirmed = confirm('Clear all expense data? This cannot be undone.');
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  renderExpenseList();
  renderExportSummary();
  showToast('All data cleared');
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
