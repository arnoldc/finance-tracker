/* ============================================================
   EXPENSE TRACKER — Dropbox Integration
   Uses the official Dropbox JS SDK (loaded via CDN in index.html)
   with OAuth 2 implicit token flow. No backend required.
   ============================================================ */

const DROPBOX_TOKEN_KEY  = 'dropbox_access_token';
const DROPBOX_APPKEY_KEY = 'dropbox_app_key';


/* ── Init — runs on every page load ──────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Show current page URL as the redirect URI hint
  const display = document.getElementById('redirect-uri-display');
  if (display) display.textContent = window.location.href.split('?')[0];

  // Restore saved App Key into the input
  const savedKey = localStorage.getItem(DROPBOX_APPKEY_KEY);
  const keyInput = document.getElementById('dropbox-app-key');
  if (savedKey && keyInput) keyInput.value = savedKey;

  // Check if returning from Dropbox OAuth redirect
  handleOAuthCallback();

  // Refresh UI based on current connection state
  updateDropboxUI();
});


/* ── Toggle App Key Field ─────────────────────────────────── */

function toggleDropboxKeyField() {
  const field  = document.getElementById('dropbox-key-field');
  const isOpen = field.style.display !== 'none';

  if (isOpen) {
    connectDropbox();
  } else {
    field.style.display = 'block';
    document.querySelector('#dropbox-setup .btn-dropbox').textContent = 'Submit & Connect';
    document.getElementById('dropbox-app-key').focus();
  }
}


/* ── OAuth: Start Authorization Flow ─────────────────────── */

function connectDropbox() {
  const appKey = document.getElementById('dropbox-app-key').value.trim();

  if (!appKey) {
    showToast('Please enter your Dropbox App Key first');
    return;
  }

  localStorage.setItem(DROPBOX_APPKEY_KEY, appKey);

  // Build the Dropbox OAuth URL using the SDK's DropboxAuth helper
  const dbxAuth = new Dropbox.DropboxAuth({ clientId: appKey });

  dbxAuth.getAuthenticationUrl(
    window.location.href.split('?')[0],  // redirect URI
    null,                                 // state
    'token'                               // implicit flow — returns token in hash
  ).then(authUrl => {
    window.location.href = authUrl;
  });
}


/* ── OAuth: Handle Redirect Callback ─────────────────────── */

function handleOAuthCallback() {
  const hash = window.location.hash;
  if (!hash.includes('access_token')) return;

  const params = new URLSearchParams(hash.replace('#', ''));
  const token  = params.get('access_token');

  if (token) {
    localStorage.setItem(DROPBOX_TOKEN_KEY, token);
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


/* ── Update UI: connected vs setup state ─────────────────── */

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


/* ── Fetch Dropbox account name for display ──────────────── */

async function fetchDropboxUsername(token) {
  try {
    const dbx  = new Dropbox.Dropbox({ accessToken: token });
    const res  = await dbx.usersGetCurrentAccount();
    const name = res.result?.name?.display_name || 'Dropbox';
    document.getElementById('dropbox-user-name').textContent = `Connected as ${name}`;
  } catch (err) {
    // Token expired or revoked — reset to setup state
    if (err.status === 401) {
      localStorage.removeItem(DROPBOX_TOKEN_KEY);
      updateDropboxUI();
    }
  }
}


/* ── Export CSV directly to Dropbox ──────────────────────── */

async function exportToDropbox() {
  const token = localStorage.getItem(DROPBOX_TOKEN_KEY);

  if (!token) {
    showToast('Please connect Dropbox first');
    return;
  }

  const expenses = loadExpenses();
  if (expenses.length === 0) {
    showToast('No expenses to export yet');
    return;
  }

  // Build CSV
  const headers = ['Date', 'Amount (₱)', 'Category', 'Payment Method', 'Description'];
  const rows    = expenses
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => [
      e.date,
      e.amount,
      e.category,
      e.payment,
      '"' + (e.desc || '').replace(/"/g, '""') + '"'
    ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');

  // Build file path — ensure it always starts with /
  const rawFolder = (document.getElementById('dropbox-folder').value || 'ExpenseTracker').trim();
  const folder    = '/' + rawFolder.replace(/^\/+/, '').replace(/\/+$/, '');
  const fileName  = `expenses_${todayISO()}.csv`;
  const filePath  = folder + '/' + fileName;

  showToast('⏳ Uploading to Dropbox...');

  try {
    // Use raw fetch for the upload — the SDK's filesUpload has issues
    // in browser environments. The raw API is straightforward and reliable.
    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization':   `Bearer ${token}`,
        'Content-Type':    'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path:       filePath,
          mode:       { '.tag': 'overwrite' },
          autorename: false,
          mute:       false
        })
      },
      body: new Blob([csvContent], { type: 'application/octet-stream' })
    });

    if (response.ok) {
      showToast(`✅ Saved to Dropbox: ${filePath}`);
      return;
    }

    // Handle known HTTP error codes
    const errorText = await response.text();
    console.error('Dropbox error:', response.status, errorText);

    if (response.status === 401) {
      localStorage.removeItem(DROPBOX_TOKEN_KEY);
      updateDropboxUI();
      showToast('❌ Session expired. Please reconnect Dropbox.');
    } else if (response.status === 409) {
      showToast('❌ Folder not found. Check the folder name and try again.');
    } else {
      showToast(`❌ Upload failed (${response.status}). Check console for details.`);
    }

  } catch (err) {
    console.error('Network error:', err);
    showToast('❌ Could not reach Dropbox. Check your connection.');
  }
}
