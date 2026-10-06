const form = document.getElementById('setupForm');
const alertBox = document.getElementById('alertBox');
const submitBtn = document.getElementById('submitBtn');

function showAlert(message, success = false) {
  const safeMessage =
    typeof message === 'string'
      ? message
      : getErrorMessage(message);

  alertBox.textContent = safeMessage;
  alertBox.className = `alert ${success ? 'alert-success' : 'alert-error'}`;
}

function clearAlert() {
  alertBox.textContent = '';
  alertBox.className = 'alert';
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function getErrorMessage(data, fallback = 'Terjadi kesalahan.') {
  if (!data) return fallback;

  if (typeof data === 'string') return data;

  if (typeof data.error === 'string') {
    return data.error;
  }

  if (data.error && typeof data.error === 'object') {
    if (typeof data.error.message === 'string') {
      return data.error.message;
    }

    if (typeof data.error.code === 'string') {
      return data.error.code;
    }
  }

  if (typeof data.message === 'string') {
    return data.message;
  }

  if (data.message && typeof data.message === 'object') {
    if (typeof data.message.message === 'string') {
      return data.message.message;
    }

    try {
      return JSON.stringify(data.message);
    } catch {
      return fallback;
    }
  }

  try {
    return JSON.stringify(data);
  } catch {
    return fallback;
  }
}

async function checkSetupStatus() {
  try {
    const response = await fetch('/api/auth/setup-status', {
      credentials: 'same-origin',
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      console.error('[Setup status]', response.status, data);
      return;
    }

    if (data.success && data.data?.setupRequired === false) {
      showAlert(
        'Administrator sudah terdaftar. Setup telah dikunci. Mengalihkan ke login...'
      );

      form.style.display = 'none';

      setTimeout(() => {
        window.location.replace('/admin/login.html');
      }, 1800);
    }
  } catch (error) {
    console.error('[Setup status]', error);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAlert();

  const setupToken = document.getElementById('setupToken').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!setupToken) {
    showAlert('Setup token wajib diisi.');
    return;
  }

  if (!/^[a-z0-9.-]{3,50}$/.test(username)) {
    showAlert(
      'Username harus 3–50 karakter dan hanya boleh berisi huruf kecil, angka, titik, atau strip.'
    );
    return;
  }

  if (password !== confirmPassword) {
    showAlert('Konfirmasi password tidak cocok.');
    return;
  }

  const passwordBytes = new TextEncoder().encode(password).length;

  if (passwordBytes < 12) {
    showAlert('Password minimal 12 byte UTF-8.');
    return;
  }

  if (passwordBytes > 72) {
    showAlert('Password maksimal 72 byte UTF-8.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses...';

  try {
    const response = await fetch('/api/auth/setup', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Setup-Token': setupToken,
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await parseResponse(response);

    if (!response.ok || !data.success) {
      console.error('[Setup]', response.status, data);

      if (response.status === 429) {
        showAlert(
          'Terlalu banyak percobaan setup. Tunggu beberapa saat sampai rate limit berakhir, lalu coba lagi.'
        );
        return;
      }

      if (response.status === 403) {
        showAlert(
          getErrorMessage(data, 'Setup token tidak valid.')
        );
        return;
      }

      if (response.status === 409) {
        showAlert(
          getErrorMessage(data, 'Administrator sudah pernah dibuat.')
        );
        return;
      }

      showAlert(
        getErrorMessage(
          data,
          `Setup gagal (HTTP ${response.status}).`
        )
      );

      return;
    }

    showAlert(
      'Administrator berhasil didaftarkan. Mengalihkan ke halaman login...',
      true
    );

    form.reset();

    setTimeout(() => {
      window.location.replace('/admin/login.html');
    }, 1500);
  } catch (error) {
    console.error('[Setup request]', error);

    showAlert(
      'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.'
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Daftarkan Administrator';
  }
});

checkSetupStatus();
