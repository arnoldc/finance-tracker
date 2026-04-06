/* ============================================================
   EXPENSE TRACKER — Dropbox Integration
   Uses Dropbox OAuth 2 (PKCE) — no backend required.
   The access token is stored in localStorage.
   ============================================================ */

const DROPBOX_TOKEN_KEY  = 'dropbox_access_token';
const DROPBOX_APPKEY_KEY = 'dropbox_app_key';
const DROPBOX_API        = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT    = 'https://content.dropboxapi.com/2';


/* ── Init — runs on every page load ──────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Show current page URL as the redirect URI hint
  const display = document.getElementById('redirect-uri-display');
  if (display) display.textContent = window.location.href.split('?')[0];

  // Restore saved App Key into the input
  const savedKey = localStorage.getItem(DROPBOX_APPKEY_KEY);
  const keyInput = document.getElementById('dropbox-app-key');
  if (savedKey && keyInput) keyInput.value = savedKey;

  // Check if returning from OAuth redirect
  handleOAuthCallback();

  // Check if already connected
  updateDropboxUI();
});


/* ── Toggle App Key Field ─────────────────────────────────── */

function toggleDropboxKeyField() {
  const field  = document.getElementById('dropbox-key-field');
  const isOpen = field.style.display !== 'none';

  if (isOpen) {
    // Field is visible — attempt to connect
    connectDropbox();
  } else {
    // Show the field and change button label
    field.style.display = 'block';
    document.querySelector('#dropbox-setup .btn-dropbox').textContent = 'Submit & Connect';
    document.getElementById('dropbox-app-key').focus();
  }
}


/* ── OAuth: Connect ───────────────────────────────────────── */

function connectDropbox() {
  const appKey = document.getElementById('dropbox-app-key').value.trim();

  if (!appKey) {
    showToast('Please enter your Dropbox App Key first');
    return;
  }

  // Save App Key for later use
  localStorage.setItem(DROPBOX_APPKEY_KEY, appKey);

  const redirectUri  = window.location.href.split('?')[0];
  const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');

  authUrl.searchParams.set('client_id',      appKey);
  authUrl.searchParams.set('response_type',  'token');
  authUrl.searchParams.set('redirect_uri',   redirectUri);
  authUrl.searchParams.set('token_access_type', 'legacy');

  // Redirect to Dropbox login
  window.location.href = authUrl.toString();
}


/* ── OAuth: Handle Callback ───────────────────────────────── */

function handleOAuthCallback() {
  // Dropbox returns the token in the URL hash after redirect
  const hash   = window.location.hash;
  if (!hash.includes('access_token')) return;

  const params = new URLSearchParams(hash.replace('#', ''));
  const token  = params.get('access_token');

  if (token) {
    localStorage.setItem(DROPBOX_TOKEN_KEY, token);
    // Clean the token out of the URL bar
    window.history.replaceState(null, '', window.location.pathname);
    showToast('✅ Dropbox connected!');
  }
}


/* ── Disconnect ───────────────────────────────────────────── */

function disconnectDropbox() {
  localStorage.removeItem(DROPBOX_TOKEN_KEY);
  updateDropboxUI();
  showToast('Dropbox disconnected');
}


/* ── Update UI based on connection state ─────────────────── */

function updateDropboxUI() {
  const token     = localStorage.getItem(DROPBOX_TOKEN_KEY);
  const setup     = document.getElementById('dropbox-setup');
  const connected = document.getElementById('dropbox-connected');

  if (!setup || !connected) return;

  if (token) {
    setup.style.display     = 'none';
    connected.style.display = 'block';
    fetchDropboxUsername(token);
  } else {
    setup.style.display     = 'block';
    connected.style.display = 'none';
  }
}


/* ── Fetch and display the Dropbox account name ──────────── */

async function fetchDropboxUsername(token) {
  try {
    const res = await fetch(`${DROPBOX_API}/users/get_current_account`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      // Token likely expired — clear it
      localStorage.removeItem(DROPBOX_TOKEN_KEY);
      updateDropboxUI();
      return;
    }

    const data = await res.json();
    const name = data.name?.display_name || 'Dropbox';
    document.getElementById('dropbox-user-name').textContent = `Connected as ${name}`;
  } catch {
    // Silent fail — name display is cosmetic only
  }
}


/* ── Export CSV to Dropbox ────────────────────────────────── */

async function exportToDropbox() {
  const token  = localStorage.getItem(DROPBOX_TOKEN_KEY);
  const appKey = localStorage.getItem(DROPBOX_APPKEY_KEY);

  if (!token) {
    showToast('Please connect Dropbox first');
    return;
  }

  const expenses = loadExpenses();
  if (expenses.length === 0) {
    showToast('No expenses to export yet');
    return;
  }

  // Build CSV content
  const headers  = ['Date', 'Amount (₱)', 'Category', 'Payment Method', 'Description'];
  const rows     = expenses
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => [
      e.date,
      e.amount,
      e.category,
      e.payment,
      '"' + (e.desc || '').replace(/"/g, '""') + '"'
    ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');

  // Build destination path
  const folder   = (document.getElementById('dropbox-folder').value || '/ExpenseTracker').trim();
  const fileName = `expenses_${todayISO()}.csv`;
  const filePath = folder.replace(/\/$/, '') + '/' + fileName;

  showToast('⏳ Uploading to Dropbox...');

  try {
    const res = await fetch(`${DROPBOX_CONTENT}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization:    `Bearer ${token}`,
        'Content-Type':   'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path:       filePath,
          mode:       'overwrite',
          autorename: false,
          mute:       false
        })
      },
      body: csvContent
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Dropbox upload error:', err);
      showToast('❌ Upload failed. Check your App Key or folder path.');
      return;
    }

    showToast(`✅ Saved to Dropbox: ${filePath}`);
  } catch (err) {
    console.error('Upload error:', err);
    showToast('❌ Could not reach Dropbox. Check your connection.');
  }
}
