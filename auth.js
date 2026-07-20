/* ============================================
   auth.js — Sistema de autenticação
   • Login com usuário + senha (armazenado localmente)
   • Login com conta GitHub (requer Netlify)
   • Gerenciamento de usuários (admin)
   • Senhas com SHA-256 + salt aleatório
   ============================================ */

/* ---------- Fallback de configuração ---------- */
if (typeof AUTH_CONFIG === 'undefined') {
  window.AUTH_CONFIG = { mode: 'simple', github: { clientId: '', allowedUsers: [] }, google: { clientId: '', allowedUsers: [] } };
}

/* ---------- Constantes ---------- */
const AUTH_STORE_KEY   = 'cgAuth_v1';
const SESSION_STORE_KEY = 'cgSession_v1';
const SESSION_DURATION  = 12 * 60 * 60 * 1000; // 12 horas

/* ---------- Criptografia ---------- */

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes = 16) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  // salt + separador + senha + domínio fixo → dificulta ataques de rainbow table
  return sha256(`${salt}::${password}::controle-gastos-app`);
}

/* ---------- Store de usuários (localStorage) ---------- */

function loadAuthStore() {
  try { return JSON.parse(localStorage.getItem(AUTH_STORE_KEY)) || { users: [], initialized: false }; }
  catch { return { users: [], initialized: false }; }
}

function saveAuthStore(store) {
  localStorage.setItem(AUTH_STORE_KEY, JSON.stringify(store));
}

function isFirstRun() { return !loadAuthStore().initialized; }

async function createUser(username, password, isAdmin = false) {
  const store = loadAuthStore();
  const salt  = randomHex(16);
  const hash  = await hashPassword(password, salt);
  const user  = {
    id:           randomHex(8),
    username:     username.trim().toLowerCase(),
    displayName:  username.trim(),
    passwordSalt: salt,
    passwordHash: hash,
    isAdmin,
    createdAt: Date.now(),
  };
  store.users.push(user);
  store.initialized = true;
  saveAuthStore(store);
  return user;
}

function removeUser(userId) {
  const store = loadAuthStore();
  store.users = store.users.filter(u => u.id !== userId);
  saveAuthStore(store);
}

async function changePassword(userId, newPassword) {
  const store = loadAuthStore();
  const user  = store.users.find(u => u.id === userId);
  if (!user) return false;
  user.passwordSalt = randomHex(16);
  user.passwordHash = await hashPassword(newPassword, user.passwordSalt);
  saveAuthStore(store);
  return true;
}

/* ---------- Sessão (sessionStorage — apaga ao fechar o app) ---------- */

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_STORE_KEY)); }
  catch { return null; }
}

function saveSession(sess) { sessionStorage.setItem(SESSION_STORE_KEY, JSON.stringify(sess)); }

function clearSession() { sessionStorage.removeItem(SESSION_STORE_KEY); }

function isSessionValid(sess) {
  return sess && sess.userId && sess.expiresAt && Date.now() < sess.expiresAt;
}

function buildSession(user, method = 'password', extra = {}) {
  const sess = {
    token:       randomHex(32),
    userId:      user.id,
    username:    user.username,
    displayName: user.displayName,
    isAdmin:     !!user.isAdmin,
    loginMethod: method,
    createdAt:   Date.now(),
    expiresAt:   Date.now() + SESSION_DURATION,
    ...extra,
  };
  saveSession(sess);
  return sess;
}

/* ---------- Estado da sessão atual ---------- */

let _session = null;

function getCurrentSession()  { return _session; }
function isAdmin()            { return !!(_session && _session.isAdmin); }

/* ---------- GitHub OAuth ---------- */

function isGitHubConfigured() {
  return !!(AUTH_CONFIG.github && AUTH_CONFIG.github.clientId);
}

function loginWithGitHub() {
  const state = randomHex(16);
  sessionStorage.setItem('gh_oauth_state', state);
  const p = new URLSearchParams({ client_id: AUTH_CONFIG.github.clientId, scope: 'read:user', state });
  window.location.href = `https://github.com/login/oauth/authorize?${p}`;
}

async function handleGitHubCallback() {
  const hash   = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const token  = params.get('gh_token');
  const user   = params.get('gh_user');
  const name   = params.get('gh_name');
  const avatar = params.get('gh_avatar');
  const error  = params.get('auth_error');

  // Limpa o hash da URL imediatamente
  history.replaceState(null, '', window.location.pathname + window.location.search);

  if (error) return { ok: false, error };
  if (!token || !user) return { ok: false };

  // Verifica lista de usuários permitidos
  const allowed = AUTH_CONFIG.github.allowedUsers || [];
  if (allowed.length > 0 && !allowed.includes(user.toLowerCase())) {
    return { ok: false, error: 'user_not_allowed' };
  }

  // Cria / atualiza entrada do usuário GitHub no store local
  const store = loadAuthStore();
  let entry   = store.users.find(u => u.githubUsername === user.toLowerCase());

  if (!entry) {
    entry = {
      id:              randomHex(8),
      username:        user.toLowerCase(),
      displayName:     name || user,
      githubUsername:  user.toLowerCase(),
      isAdmin:         store.users.length === 0, // primeiro login vira admin
      createdAt:       Date.now(),
    };
    store.users.push(entry);
    store.initialized = true;
  } else {
    entry.displayName = name || entry.displayName;
  }
  entry.githubToken  = token;
  entry.githubAvatar = avatar || '';
  saveAuthStore(store);

  _session = buildSession(entry, 'github', { githubUsername: user.toLowerCase(), githubAvatar: avatar || '' });
  return { ok: true };
}

/* ---------- Verificação de autenticação principal ---------- */

async function checkAuth() {
  // 1. Verificar callback do GitHub OAuth (hash na URL)
  const h = window.location.hash;
  if (h.includes('gh_token=') || h.includes('auth_error=')) {
    const result = await handleGitHubCallback();
    if (!result.ok) {
      renderLoginScreen(result.error || 'login_failed');
      return false;
    }
    updateUserUI();
    return true;
  }

  // 2. Verificar sessão existente
  const sess = loadSession();
  if (isSessionValid(sess)) {
    _session = sess;
    // Sessão Google → retoma o contexto (token + planilha) em segundo plano
    if (sess.loginMethod === 'google' && window.GoogleSync) {
      await GoogleSync.resume();
    }
    updateUserUI();
    return true;
  }

  // 3. Primeira execução (só no modo usuário/senha) → tela de criação do admin
  const pwdMode = AUTH_CONFIG.mode === 'simple' || AUTH_CONFIG.mode === 'both';
  if (pwdMode && isFirstRun()) {
    renderSetupScreen();
    return false;
  }

  // 4. Exibir tela de login
  renderLoginScreen();
  return false;
}

/* ---------- UI helpers ---------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

function overlay() { return document.getElementById('authOverlay'); }

function showOverlay(html) {
  const el = overlay();
  el.innerHTML = html;
  el.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function hideOverlay() {
  overlay().classList.remove('visible');
  document.body.style.overflow = '';
}

function logoHtml() {
  return `
    <div class="auth-logo">
      <div class="auth-logo-icon">
        <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="14" width="4" height="7" rx="1.5" fill="#E8C77E"/><rect x="10" y="9" width="4" height="12" rx="1.5" fill="#E8C77E"/><rect x="17" y="4" width="4" height="17" rx="1.5" fill="#E8C77E"/></svg>
      </div>
      <h1 class="auth-app-name">Controle de Gastos</h1>
      <p class="auth-app-sub">Seu controle financeiro pessoal</p>
    </div>`;
}

function errorMessages(code) {
  return ({
    user_not_allowed: 'Esta conta não tem permissão de acesso. Verifique a lista de usuários autorizados.',
    login_failed:     'Falha no login. Tente novamente.',
    server_error:     'Erro de comunicação. Tente novamente.',
    bad_verification_code: 'O código expirou. Inicie o login novamente.',
    access_denied:    'Permissão negada. É preciso autorizar o acesso à planilha para usar o app.',
    google_not_configured: 'O login com Google ainda não foi configurado (clientId vazio em auth-config.js).',
  })[code] || 'Erro ao fazer login. Tente novamente.';
}

function renderLoginScreen(errorCode = '') {
  const ghEnabled = isGitHubConfigured() &&
    (AUTH_CONFIG.mode === 'github' || AUTH_CONFIG.mode === 'both');
  const pwdEnabled = AUTH_CONFIG.mode === 'simple' || AUTH_CONFIG.mode === 'both';
  const googEnabled = AUTH_CONFIG.mode === 'google' &&
    !!(window.GoogleSync && GoogleSync.configured());

  showOverlay(`
    <div class="auth-card">
      ${logoHtml()}
      <div class="auth-error${errorCode ? ' show' : ''}" id="authErr">
        ${errorCode ? esc(errorMessages(errorCode)) : ''}
      </div>

      ${googEnabled ? `
        <button class="auth-btn-google" id="btnGoogle">
          <svg class="goog-icon" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Entrar com Google
        </button>
        <p class="auth-footer">Seus lançamentos ficam salvos em uma planilha<br>no seu próprio Google Drive.</p>
      ` : ''}

      ${ghEnabled ? `
        <button class="auth-btn-github" id="btnGitHub">
          <svg class="gh-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57
              0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695
              -.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99
              .105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225
              -.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405
              c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225
              0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3
              0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Entrar com GitHub
        </button>
        ${pwdEnabled ? '<div class="auth-divider"><span>ou</span></div>' : ''}
      ` : ''}

      ${pwdEnabled ? `
        <div class="auth-field">
          <label for="authUser">Usuário</label>
          <input type="text" id="authUser" autocomplete="username"
                 autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="seu usuário">
        </div>
        <div class="auth-field">
          <label for="authPass">Senha</label>
          <input type="password" id="authPass" autocomplete="current-password" placeholder="••••••••">
        </div>
        <button class="auth-btn-primary" id="btnLogin">Entrar</button>
      ` : ''}

      ${(!googEnabled && !ghEnabled && !pwdEnabled) ? `
        <div class="auth-error show" style="margin-top:4px">
          Login com Google selecionado, mas o <b>clientId</b> ainda não foi
          preenchido em <b>auth-config.js</b>. Siga o passo a passo do README para
          criar o ID do cliente no Google Cloud e cole-o lá.
        </div>` : ''}
      ${(googEnabled || !pwdEnabled) ? '' : '<p class="auth-footer">Seus dados ficam apenas neste dispositivo.<br>Nenhuma informação é enviada para servidores externos.</p>'}
    </div>`);

  if (googEnabled) {
    document.getElementById('btnGoogle').addEventListener('click', handleGoogleLogin);
  }
  if (ghEnabled) {
    document.getElementById('btnGitHub').addEventListener('click', loginWithGitHub);
  }
  if (pwdEnabled) {
    document.getElementById('btnLogin').addEventListener('click', handlePasswordLogin);
    document.getElementById('authPass').addEventListener('keydown', e => {
      if (e.key === 'Enter') handlePasswordLogin();
    });
  }
}

function renderSetupScreen() {
  showOverlay(`
    <div class="auth-card">
      ${logoHtml()}
      <span class="auth-setup-badge">Primeira vez</span>
      <p class="auth-setup-text">Crie sua conta de administrador para começar a usar o app.</p>
      <div class="auth-error" id="authErr"></div>
      <div class="auth-field">
        <label for="setupUser">Seu nome de usuário</label>
        <input type="text" id="setupUser" autocorrect="off" autocapitalize="none"
               spellcheck="false" placeholder="Ex.: jeferson">
      </div>
      <div class="auth-field">
        <label for="setupPass">Senha</label>
        <input type="password" id="setupPass" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
      </div>
      <div class="auth-field">
        <label for="setupConf">Confirmar senha</label>
        <input type="password" id="setupConf" autocomplete="new-password" placeholder="Repita a senha">
      </div>
      <button class="auth-btn-primary" id="btnSetup">Criar conta e entrar</button>
      <p class="auth-footer">Você poderá adicionar outros usuários depois nas configurações.</p>
    </div>`);

  document.getElementById('btnSetup').addEventListener('click', handleSetup);
  document.getElementById('setupConf').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSetup();
  });
}

/* ---------- Handlers de login ---------- */

function showAuthError(msg) {
  const el = document.getElementById('authErr');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

async function handlePasswordLogin() {
  const username = (document.getElementById('authUser').value || '').trim().toLowerCase();
  const password = (document.getElementById('authPass').value || '');
  const btn      = document.getElementById('btnLogin');

  if (!username || !password) { showAuthError('Preencha usuário e senha.'); return; }

  btn.disabled    = true;
  btn.textContent = 'Verificando…';

  try {
    const store = loadAuthStore();
    const user  = store.users.find(u => u.username === username && u.passwordHash);
    if (!user) throw new Error('invalid');

    const ok = (await hashPassword(password, user.passwordSalt)) === user.passwordHash;
    if (!ok) throw new Error('invalid');

    _session = buildSession(user, 'password');
    hideOverlay();
    updateUserUI();
    if (typeof window.onAuthSuccess === 'function') window.onAuthSuccess();
  } catch {
    btn.disabled    = false;
    btn.textContent = 'Entrar';
    showAuthError('Usuário ou senha incorretos.');
  }
}

async function handleGoogleLogin() {
  const btn = document.getElementById('btnGoogle');
  if (btn) { btn.disabled = true; btn.textContent = 'Conectando…'; }

  const result = await GoogleSync.signIn();
  if (!result.ok) {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar com Google'; }
    renderLoginScreen(result.error || 'login_failed');
    return;
  }

  const p = result.profile;
  const user = {
    id:          'google:' + p.sub,
    username:    p.email,
    displayName: p.name || p.email,
    isAdmin:     true,           // no modo Google cada pessoa administra a própria planilha
  };
  _session = buildSession(user, 'google', {
    googleEmail:  p.email,
    googleAvatar: p.picture || '',
  });

  // Garante a planilha e carrega os lançamentos do Drive antes de abrir o app
  await GoogleSync.afterLogin();

  hideOverlay();
  updateUserUI();
  if (typeof window.onAuthSuccess === 'function') window.onAuthSuccess();
}

async function handleSetup() {
  const username = (document.getElementById('setupUser').value || '').trim();
  const password = (document.getElementById('setupPass').value || '');
  const confirm  = (document.getElementById('setupConf').value || '');
  const btn      = document.getElementById('btnSetup');

  if (!username)           { showAuthError('Digite um nome de usuário.'); return; }
  if (password.length < 6) { showAuthError('A senha precisa ter ao menos 6 caracteres.'); return; }
  if (password !== confirm) { showAuthError('As senhas não coincidem.'); return; }

  btn.disabled    = true;
  btn.textContent = 'Criando conta…';

  const user = await createUser(username, password, true /* isAdmin */);
  _session   = buildSession(user, 'password');
  hideOverlay();
  updateUserUI();
  if (typeof window.onAuthSuccess === 'function') window.onAuthSuccess();
}

/* ---------- Atualizar UI com usuário logado ---------- */

function updateUserUI() {
  const s = _session;
  if (!s) return;

  const pill = document.getElementById('btnUserPill');
  const name = document.getElementById('pillName');
  if (!pill || !name) return;

  name.textContent = s.displayName || s.username;

  // Avatar: GitHub tem foto; login simples usa inicial
  const avatarEl = pill.querySelector('.avatar');
  if (avatarEl) {
    const photo = s.githubAvatar || s.googleAvatar;
    if (photo) {
      avatarEl.innerHTML = `<img src="${esc(photo)}" alt="${esc(s.displayName)}" loading="lazy" referrerpolicy="no-referrer">`;
    } else {
      avatarEl.textContent = (s.displayName || s.username).charAt(0).toUpperCase();
    }
  }

  pill.style.display = 'flex';
}

/* ---------- Painel de gerenciamento de usuários (admin) ---------- */

function renderUserPanel() {
  const store   = loadAuthStore();
  const session = _session;

  const usersHtml = store.users.length === 0
    ? '<p class="auth-empty">Nenhum usuário cadastrado.</p>'
    : store.users.map(u => `
        <div class="auth-user-row">
          <div class="auth-user-info">
            <span class="auth-user-name">${esc(u.displayName || u.username)}</span>
            <span class="auth-user-meta">
              ${u.githubUsername
                ? `GitHub: @${esc(u.githubUsername)}`
                : `@${esc(u.username)}`}${u.isAdmin ? ' · Admin' : ''}
            </span>
          </div>
          ${u.id !== session.userId
            ? `<button class="auth-btn-danger" data-remove="${esc(u.id)}">Remover</button>`
            : `<span class="auth-user-you">(você)</span>`}
        </div>`).join('');

  showOverlay(`
    <div class="auth-card">
      <div class="auth-admin-header">
        <button class="auth-back-btn" id="btnPanelBack">← Voltar</button>
        <h2>Usuários</h2>
      </div>

      <div id="userList">${usersHtml}</div>

      <div class="auth-add-user">
        <h3>Adicionar usuário</h3>
        <div class="auth-field">
          <label for="newUserN">Usuário</label>
          <input type="text" id="newUserN" autocorrect="off" autocapitalize="none" placeholder="nome_usuario">
        </div>
        <div class="auth-field">
          <label for="newUserP">Senha inicial</label>
          <input type="password" id="newUserP" placeholder="Mínimo 6 caracteres">
        </div>
        <button class="auth-btn-primary" id="btnAddUser">Adicionar</button>
      </div>

      <div class="auth-add-user" style="margin-top:12px">
        <h3>Alterar minha senha</h3>
        <div class="auth-field">
          <label for="myNewPass">Nova senha</label>
          <input type="password" id="myNewPass" placeholder="Mínimo 6 caracteres">
        </div>
        <button class="auth-btn-secondary" id="btnChgPass">Alterar senha</button>
      </div>

      <button class="auth-btn-logout" id="btnLogout">Sair da conta</button>
    </div>`);

  // Voltar ao app sem deslogar
  document.getElementById('btnPanelBack').addEventListener('click', () => {
    hideOverlay();
  });

  // Remover usuário
  document.getElementById('userList').addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const uid  = btn.dataset.remove;
    const user = loadAuthStore().users.find(u => u.id === uid);
    if (user && confirm(`Remover o usuário "${user.displayName || user.username}"?`)) {
      removeUser(uid);
      renderUserPanel();
    }
  });

  // Adicionar usuário
  document.getElementById('btnAddUser').addEventListener('click', async () => {
    const un = (document.getElementById('newUserN').value || '').trim().toLowerCase();
    const pw = (document.getElementById('newUserP').value || '');
    if (!un)          { alert('Informe um nome de usuário.'); return; }
    if (pw.length < 6) { alert('A senha precisa ter ao menos 6 caracteres.'); return; }
    if (loadAuthStore().users.find(u => u.username === un)) { alert('Usuário já existe.'); return; }
    await createUser(un, pw, false);
    showAppToast('✅ Usuário adicionado');
    renderUserPanel();
  });

  // Alterar minha senha
  document.getElementById('btnChgPass').addEventListener('click', async () => {
    const np = (document.getElementById('myNewPass').value || '');
    if (np.length < 6) { alert('A senha precisa ter ao menos 6 caracteres.'); return; }
    await changePassword(session.userId, np);
    document.getElementById('myNewPass').value = '';
    showAppToast('✅ Senha alterada com sucesso');
  });

  // Logout
  document.getElementById('btnLogout').addEventListener('click', () => {
    if (confirm('Deseja sair da conta?')) {
      if (window.GoogleSync) GoogleSync.signOut();
      clearSession();
      _session = null;
      checkAuth();
    }
  });
}

/* Toast — chama o do app principal se disponível */
function showAppToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hide');
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); t.classList.add('hide'); }, 2200);
}

/* ---------- API pública ---------- */
window.Auth = {
  checkAuth,
  getCurrentSession,
  isAdmin,
  clearSession: () => { if (window.GoogleSync) GoogleSync.signOut(); clearSession(); _session = null; },
  renderUserPanel,
};
