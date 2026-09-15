const form = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const togglePassword = document.getElementById('togglePassword');
const message = document.getElementById('loginMessage');

function showMessage(text, type = 'error') {
  message.textContent = text;
  message.className = `auth-message ${type}`;
}

function clearMessage() {
  message.textContent = '';
  message.className = 'auth-message';
}

function setLoading(active) {
  loginButton.disabled = active;
  loginButton.classList.toggle('loading', active);
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
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.error?.message === 'string') return data.error.message;
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}

async function getFreshCsrfToken() {
  const response = await fetch(`/api/auth/csrf-token?t=${Date.now()}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Accept': 'application/json',
    },
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, 'Gagal menyiapkan token keamanan.')
    );
  }

  const token = data?.data?.csrfToken || data?.csrfToken;

  if (!token) {
    throw new Error('Token CSRF tidak tersedia dari server.');
  }

  return token;
}

async function sendLogin(username, password, csrfToken) {
  return fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ username, password }),
  });
}

async function login(username, password) {
  let csrfToken = await getFreshCsrfToken();
  let response = await sendLogin(username, password, csrfToken);

  // Session/token mungkin berubah. Ambil token baru dan retry sekali.
  if (response.status === 403) {
    console.warn('[Admin Login] CSRF ditolak, mencoba token baru...');

    csrfToken = await getFreshCsrfToken();
    response = await sendLogin(username, password, csrfToken);
  }

  return response;
}

togglePassword.addEventListener('click', () => {
  const visible = passwordInput.type === 'text';

  passwordInput.type = visible ? 'password' : 'text';

  const label = visible
    ? 'Tampilkan password'
    : 'Sembunyikan password';

  togglePassword.title = label;
  togglePassword.setAttribute('aria-label', label);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showMessage('Username dan password wajib diisi.');
    return;
  }

  setLoading(true);

  try {
    const response = await login(username, password);
    const data = await parseResponse(response);

    if (!response.ok || !data.success) {
      console.error('[Admin Login]', response.status, data);

      if (response.status === 401) {
        showMessage(
          getErrorMessage(data, 'Username atau password salah.')
        );

        passwordInput.value = '';
        passwordInput.focus();
        return;
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');

        showMessage(
          retryAfter
            ? `Terlalu banyak percobaan login. Coba lagi dalam ${retryAfter} detik.`
            : 'Terlalu banyak percobaan login. Tunggu beberapa saat lalu coba lagi.',
          'warning'
        );

        return;
      }

      if (response.status === 403) {
        showMessage(
          'Sesi keamanan tidak valid. Refresh halaman lalu coba kembali.'
        );
        return;
      }

      showMessage(
        getErrorMessage(
          data,
          `Login gagal (HTTP ${response.status}).`
        )
      );

      return;
    }

    window.location.replace('/admin/index.html');

  } catch (error) {
    console.error('[Admin Login]', error);

    showMessage(
      error.message ||
      'Tidak dapat terhubung ke server.'
    );
  } finally {
    setLoading(false);
  }
});

async function checkSetupStatus() {
  try {
    const response = await fetch('/api/auth/setup-status', {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) return false;

    const data = await parseResponse(response);

    if (data?.success && data?.data?.setupRequired === true) {
      window.location.replace('/admin/setup.html');
      return true;
    }
  } catch (error) {
    console.error('[Setup Status]', error);
  }

  return false;
}

async function checkSession() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) return;

    const data = await parseResponse(response);

    const authenticated =
      data?.authenticated === true ||
      data?.data?.authenticated === true ||
      Boolean(data?.data?.admin) ||
      Boolean(data?.data?.username);

    if (authenticated) {
      window.location.replace('/admin/index.html');
    }
  } catch (error) {
    console.error('[Admin Session]', error);
  }
}

async function initialize() {
  const redirected = await checkSetupStatus();

  if (!redirected) {
    await checkSession();
  }
}

initialize();