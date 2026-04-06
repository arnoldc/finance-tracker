/* ============================================================
   EXPENSE TRACKER — Receipt Scanner
   Uses the device camera + Tesseract.js OCR to detect
   the total amount on a receipt and fill in the form.
   ============================================================ */

let videoStream = null;


/* ── Open Scanner ─────────────────────────────────────────── */

async function openScanner() {
  const overlay = document.getElementById('scanner-overlay');
  const video   = document.getElementById('scanner-video');
  const status  = document.getElementById('scanner-status');

  // Reset status
  status.textContent = 'Point camera at your receipt';
  overlay.classList.add('open');

  try {
    // Request rear camera on mobile
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }
    });
    video.srcObject = videoStream;
    video.play();
  } catch (err) {
    status.textContent = '⚠️ Camera access denied. Please allow camera permission.';
    console.error('Camera error:', err);
  }
}


/* ── Close Scanner ────────────────────────────────────────── */

function closeScanner() {
  const overlay = document.getElementById('scanner-overlay');
  const video   = document.getElementById('scanner-video');

  // Stop camera stream
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }

  video.srcObject = null;
  overlay.classList.remove('open');
}


/* ── Capture & Scan ───────────────────────────────────────── */

async function captureAndScan() {
  const video   = document.getElementById('scanner-video');
  const canvas  = document.getElementById('scanner-canvas');
  const status  = document.getElementById('scanner-status');
  const captBtn = document.getElementById('capture-btn');

  if (!videoStream) return;

  // Snapshot the current video frame onto the canvas
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  // Update UI while processing
  captBtn.disabled     = true;
  status.textContent   = '🔍 Reading receipt...';

  try {
    // Run OCR via Tesseract.js (loaded from CDN in HTML)
    const result = await Tesseract.recognize(canvas, 'eng', {
      logger: () => {} // Suppress verbose logs
    });

    const detectedText = result.data.text;
    const amount       = extractAmount(detectedText);

    if (amount) {
      // Fill the amount field and close scanner
      document.getElementById('inp-amount').value = amount;
      closeScanner();
      showToast(`✅ Amount detected: $${amount}`);
    } else {
      status.textContent = '❌ No amount found. Try again or adjust angle.';
      captBtn.disabled = false;
    }
  } catch (err) {
    status.textContent = '⚠️ Scan failed. Please try again.';
    captBtn.disabled   = false;
    console.error('OCR error:', err);
  }
}


/* ── Extract Amount from OCR Text ────────────────────────── */

function extractAmount(text) {
  // Clean up the raw OCR text
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

  // Keywords that typically appear near the total on a receipt
  const totalKeywords = ['total', 'amount due', 'grand total', 'total due', 'balance due', 'amount'];

  // First pass: look for lines that contain a total keyword + a number
  for (const line of lines) {
    const lower = line.toLowerCase();
    const isTotalLine = totalKeywords.some(keyword => lower.includes(keyword));

    if (isTotalLine) {
      const match = line.match(/[\d,]+\.\d{2}/);
      if (match) return parseFloat(match[0].replace(',', ''));
    }
  }

  // Second pass: collect all dollar-like numbers in the text
  const allAmounts = [];
  const numberPattern = /\$?\s*(\d{1,6}[,.]?\d{0,3})\.\d{2}/g;
  let match;

  while ((match = numberPattern.exec(text)) !== null) {
    const value = parseFloat(match[0].replace(/[$,\s]/g, ''));
    if (!isNaN(value) && value > 0) allAmounts.push(value);
  }

  // Fallback: return the largest number found (usually the total)
  if (allAmounts.length > 0) {
    return Math.max(...allAmounts).toFixed(2);
  }

  return null;
}
