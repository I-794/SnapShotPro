import { showNotification } from '../ui/notification.js';

let supabaseClient = null;
let currentUser = null;
const listeners = [];

export function onAuthChange(fn) { listeners.push(fn); }
function emit() { listeners.forEach(fn => fn(currentUser)); }

export function isConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function getUser() { return currentUser; }

export async function getClient() {
  if (supabaseClient) return supabaseClient;
  if (!isConfigured()) return null;
  const { createClient } = await import('@supabase/supabase-js');
  supabaseClient = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true } }
  );
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;
  supabaseClient.auth.onAuthStateChange((_event, sess) => {
    currentUser = sess?.user || null;
    renderAuthPill();
    emit();
  });
  return supabaseClient;
}

function openModal() {
  const m = document.getElementById('auth-modal');
  if (m) m.classList.add('visible');
}
function closeModal() {
  const m = document.getElementById('auth-modal');
  if (m) m.classList.remove('visible');
}

async function signUp() {
  const c = await getClient();
  if (!c) return;
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { showNotification('Enter email and password.', 'error'); return; }
  const { error } = await c.auth.signUp({ email, password });
  if (error) showNotification(error.message, 'error');
  else { showNotification('Check your email to confirm your account.', 'success'); closeModal(); }
}

async function signIn() {
  const c = await getClient();
  if (!c) return;
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { showNotification('Enter email and password.', 'error'); return; }
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) showNotification(error.message, 'error');
  else { showNotification('Signed in.', 'success'); closeModal(); }
}

async function signInWithProvider(provider) {
  const c = await getClient();
  if (!c) return;
  const { error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
  if (error) showNotification(error.message, 'error');
}

async function signOut() {
  const c = await getClient();
  if (!c) return;
  await c.auth.signOut();
  showNotification('Signed out.', 'success');
}

function renderAuthPill() {
  const pill = document.getElementById('auth-pill');
  if (!pill) return;
  if (!isConfigured()) {
    pill.innerHTML = '<button class="btn btn-secondary" disabled title="Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY">Cloud: off</button>';
    return;
  }
  if (currentUser) {
    const name = currentUser.email || currentUser.user_metadata?.full_name || 'You';
    pill.innerHTML = `
      <span class="account-pill" title="${name}">👤 ${name.split('@')[0]}</span>
      <button class="btn btn-secondary" id="auth-signout-btn" style="padding:6px 10px;">Sign out</button>
    `;
    document.getElementById('auth-signout-btn').addEventListener('click', signOut);
  } else {
    pill.innerHTML = '<button class="btn btn-secondary" id="auth-signin-btn">🔑 Sign in</button>';
    document.getElementById('auth-signin-btn').addEventListener('click', openModal);
  }
}

export async function bindAuth() {
  // Wire modal buttons (even if supabase isn't configured, so error message is clear)
  const signUpBtn = document.getElementById('auth-signup-btn');
  const signInBtn = document.getElementById('auth-signin-modal-btn');
  const googleBtn = document.getElementById('auth-google-btn');
  const githubBtn = document.getElementById('auth-github-btn');
  const closeBtn = document.getElementById('auth-modal-close');
  const overlay = document.getElementById('auth-modal');
  if (signUpBtn) signUpBtn.addEventListener('click', signUp);
  if (signInBtn) signInBtn.addEventListener('click', signIn);
  if (googleBtn) googleBtn.addEventListener('click', () => signInWithProvider('google'));
  if (githubBtn) githubBtn.addEventListener('click', () => signInWithProvider('github'));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  if (isConfigured()) {
    await getClient();
  }
  renderAuthPill();
}
