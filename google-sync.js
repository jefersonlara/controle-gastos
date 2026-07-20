/* ============================================================
   google-sync.js — Login Google (SSO) + gravação em planilha
   no Google Drive da conta logada.

   • Autenticação 100% no navegador (Google Identity Services).
     Não usa client_secret nem backend — pode rodar no GitHub
     Pages ou no Netlify como site estático.

   • Escopo usado: openid email profile + drive.file
     'drive.file' é um escopo NÃO SENSÍVEL: o app só enxerga e
     gerencia a planilha que ele mesmo cria. Não requer o
     processo de verificação/avaliação de segurança do Google.

   • Os lançamentos ficam numa planilha chamada
     "Controle de Gastos — Dados" no Drive do usuário:
       - aba "Lançamentos"  → uma linha por lançamento (legível)
       - aba "_backup"      → estado completo em JSON (fiel)
   ============================================================ */

(function () {
  'use strict';

  const SPREADSHEET_NAME = 'Controle de Gastos — Dados';
  const SHEET_ENTRIES    = 'Lançamentos';
  const SHEET_BACKUP     = '_backup';
  const APP_MARKER       = 'controleGastosApp';           // marca no Drive p/ reencontrar o arquivo
  const SPREADSHEET_ID_KEY = 'cgSheetId_v1';              // guarda o id localmente
  const FOLDER_ID_KEY    = 'cgSheetFolder_v1';           // guarda a pasta escolhida
  const STATE_KEY        = 'controleGastos_v1';           // MESMA chave usada pelo app.js
  const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';

  const HEADER = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Classificação', 'ID', 'Criado em'];

  let _clientId   = '';
  let _tokenClient = null;
  let _gisReady    = null;      // Promise do carregamento do script GIS
  let _token       = '';
  let _tokenExp    = 0;
  let _profile     = null;      // { sub, email, name, picture }
  let _spreadsheetId = localStorage.getItem(SPREADSHEET_ID_KEY) || '';
  let _folderId    = localStorage.getItem(FOLDER_ID_KEY) || '';   // pasta escolhida pelo usuário ('' = raiz)
  let _syncTimer   = null;
  let _busy        = false;

  /* ---------- utilidades ---------- */

  function configured() {
    return !!(window.AUTH_CONFIG && AUTH_CONFIG.google && AUTH_CONFIG.google.clientId);
  }

  function loadLocalState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)); } catch { return null; }
  }
  function saveLocalState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function toast(msg) {
    if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hide'); t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); t.classList.add('hide'); }, 2200);
  }

  /* ---------- carregamento do Google Identity Services ---------- */

  function loadGis() {
    if (_gisReady) return _gisReady;
    _gisReady = new Promise((resolve, reject) => {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Falha ao carregar o Google Identity Services.'));
      document.head.appendChild(s);
    });
    return _gisReady;
  }

  async function ensureTokenClient() {
    await loadGis();
    if (_tokenClient) return;
    _clientId = AUTH_CONFIG.google.clientId;
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: _clientId,
      scope: SCOPES,
      callback: () => {},        // definido dinamicamente em requestToken()
    });
  }

  // Solicita um access_token. prompt='' tenta silenciosamente; '' também
  // abre o popup na primeira vez (quando ainda não há consentimento).
  function requestToken(prompt) {
    return new Promise(async (resolve, reject) => {
      await ensureTokenClient();
      _tokenClient.callback = (resp) => {
        if (resp && resp.error) return reject(resp);
        _token = resp.access_token;
        _tokenExp = Date.now() + Math.max(0, (resp.expires_in || 3600) - 60) * 1000;
        resolve(_token);
      };
      try {
        _tokenClient.requestAccessToken({ prompt: prompt || '' });
      } catch (e) { reject(e); }
    });
  }

  async function getToken(interactive) {
    if (_token && Date.now() < _tokenExp) return _token;
    // token expirado ou inexistente → renova
    return requestToken(interactive ? '' : '');
  }

  /* ---------- chamadas REST autenticadas ---------- */

  async function api(url, opts = {}, interactive = false) {
    const token = await getToken(interactive);
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) {
      // token expirou entre a checagem e a chamada → renova uma vez
      _token = ''; _tokenExp = 0;
      const t2 = await getToken(interactive);
      const res2 = await fetch(url, {
        ...opts,
        headers: {
          'Authorization': `Bearer ${t2}`,
          'Content-Type': 'application/json',
          ...(opts.headers || {}),
        },
      });
      if (!res2.ok) throw new Error(`HTTP ${res2.status} em ${url}`);
      return res2.status === 204 ? null : res2.json();
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return res.status === 204 ? null : res.json();
  }

  /* ---------- identidade (SSO) ---------- */

  async function fetchProfile() {
    _profile = await api('https://www.googleapis.com/oauth2/v3/userinfo', {}, true);
    return _profile;
  }

  /* ---------- planilha: encontrar / criar ---------- */

  async function findSpreadsheet() {
    const q = encodeURIComponent(
      `appProperties has { key='${APP_MARKER}' and value='1' } and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
    );
    const data = await api(
      `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`
    );
    if (data.files && data.files.length) return data.files[0].id;
    return '';
  }

  // Cria uma pasta no Drive do usuário e devolve o id.
  async function createFolder(name) {
    const folder = await api('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        appProperties: { [APP_MARKER]: '1' },
      }),
    });
    return folder.id;
  }

  async function createSpreadsheet() {
    const created = await api('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      body: JSON.stringify({
        properties: { title: SPREADSHEET_NAME },
        sheets: [
          { properties: { title: SHEET_ENTRIES } },
          { properties: { title: SHEET_BACKUP, hidden: true } },
        ],
      }),
    });
    const id = created.spreadsheetId;
    // marca o arquivo no Drive p/ reencontrá-lo depois
    await api(`https://www.googleapis.com/drive/v3/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ appProperties: { [APP_MARKER]: '1' } }),
    });
    // move para a pasta escolhida pelo usuário (se houver)
    if (_folderId) {
      try {
        await api(
          `https://www.googleapis.com/drive/v3/files/${id}?addParents=${encodeURIComponent(_folderId)}&removeParents=root`,
          { method: 'PATCH', body: '{}' }
        );
      } catch (e) { console.warn('Não foi possível mover para a pasta escolhida; ficará em Meu Drive.', e); }
    }
    // cabeçalho da aba de lançamentos
    await api(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(SHEET_ENTRIES + '!A1')}?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ values: [HEADER] }) }
    );
    return id;
  }

  async function ensureSpreadsheet() {
    if (_spreadsheetId) {
      // confirma que o id salvo ainda é válido
      try {
        await api(`https://sheets.googleapis.com/v4/spreadsheets/${_spreadsheetId}?fields=spreadsheetId`);
        return _spreadsheetId;
      } catch { _spreadsheetId = ''; }
    }
    // já existe uma planilha deste app no Drive? (usuário voltando / outro aparelho)
    const existing = await findSpreadsheet();
    if (existing) {
      _spreadsheetId = existing;
      localStorage.setItem(SPREADSHEET_ID_KEY, _spreadsheetId);
      return _spreadsheetId;
    }
    // primeira vez para esta conta → pergunta onde salvar, depois cria
    await chooseLocation();
    _spreadsheetId = await createSpreadsheet();
    localStorage.setItem(SPREADSHEET_ID_KEY, _spreadsheetId);
    return _spreadsheetId;
  }

  /* ---------- escolha da pasta de destino (só na 1ª criação) ---------- */

  // Mostra um cartão perguntando onde salvar a planilha e resolve quando o
  // usuário decide. Define _folderId ('' = Meu Drive; ou o id de uma pasta nova).
  function chooseLocation() {
    return new Promise((resolve) => {
      const ov = document.getElementById('authOverlay');
      // Se não houver overlay disponível, cai no padrão (Meu Drive) sem travar.
      if (!ov) { _folderId = ''; resolve(); return; }

      const wasVisible = ov.classList.contains('visible');
      ov.classList.add('visible');
      document.body.style.overflow = 'hidden';

      ov.innerHTML = `
        <div class="auth-card">
          <div class="auth-logo">
            <div class="auth-logo-icon">
              <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="14" width="4" height="7" rx="1.5" fill="#E8C77E"/><rect x="10" y="9" width="4" height="12" rx="1.5" fill="#E8C77E"/><rect x="17" y="4" width="4" height="17" rx="1.5" fill="#E8C77E"/></svg>
            </div>
            <h1 class="auth-app-name">Onde salvar seus dados?</h1>
            <p class="auth-app-sub">Escolha onde a planilha ficará no seu Google Drive.<br>Você só faz isso uma vez.</p>
          </div>

          <label class="loc-opt loc-selected" data-opt="root">
            <input type="radio" name="locOpt" value="root" checked>
            <span><b>Em "Meu Drive"</b><br><small>A planilha fica na página inicial do Drive.</small></span>
          </label>

          <label class="loc-opt" data-opt="folder">
            <input type="radio" name="locOpt" value="folder">
            <span><b>Em uma pasta nova</b><br><small>O app cria uma pasta com o nome que você escolher.</small></span>
          </label>

          <div class="auth-field" id="locFolderField" style="display:none">
            <label for="locFolderName">Nome da pasta</label>
            <input type="text" id="locFolderName" placeholder="Ex.: Finanças" maxlength="60"
                   autocomplete="off" autocorrect="off" spellcheck="false" value="Controle de Gastos">
          </div>

          <div class="auth-error" id="locErr"></div>
          <button class="auth-btn-primary" id="locConfirm">Continuar</button>
          <p class="auth-footer">Depois, você pode mover a planilha para qualquer<br>pasta do Drive normalmente — o app continua funcionando.</p>
        </div>`;

      const opts   = ov.querySelectorAll('.loc-opt');
      const field  = ov.querySelector('#locFolderField');
      const nameEl = ov.querySelector('#locFolderName');
      const errEl  = ov.querySelector('#locErr');
      const btn    = ov.querySelector('#locConfirm');

      opts.forEach(o => o.addEventListener('click', () => {
        opts.forEach(x => x.classList.remove('loc-selected'));
        o.classList.add('loc-selected');
        o.querySelector('input').checked = true;
        field.style.display = (o.dataset.opt === 'folder') ? 'block' : 'none';
      }));

      btn.addEventListener('click', async () => {
        const opt = ov.querySelector('input[name="locOpt"]:checked').value;
        btn.disabled = true; btn.textContent = 'Preparando…';
        try {
          if (opt === 'folder') {
            const nm = (nameEl.value || '').trim();
            if (!nm) { throw new Error('empty_name'); }
            _folderId = await createFolder(nm);
          } else {
            _folderId = '';
          }
          localStorage.setItem(FOLDER_ID_KEY, _folderId);
          if (!wasVisible) { ov.classList.remove('visible'); document.body.style.overflow = ''; }
          resolve();
        } catch (e) {
          btn.disabled = false; btn.textContent = 'Continuar';
          errEl.textContent = (e && e.message === 'empty_name')
            ? 'Digite um nome para a pasta.'
            : 'Não foi possível criar a pasta agora. Tente novamente ou escolha "Meu Drive".';
          errEl.classList.add('show');
        }
      });
    });
  }

  /* ---------- leitura / escrita ---------- */

  async function readBackupState() {
    const range = encodeURIComponent(`${SHEET_BACKUP}!A1`);
    let data;
    try {
      data = await api(`https://sheets.googleapis.com/v4/spreadsheets/${_spreadsheetId}/values/${range}`);
    } catch { return null; }
    const cell = data && data.values && data.values[0] && data.values[0][0];
    if (!cell) return null;
    try { return JSON.parse(cell); } catch { return null; }
  }

  function catName(state, id) {
    const c = (state.categories || []).find(c => c.id === id);
    return c ? `${c.icon || ''} ${c.name}`.trim() : id;
  }

  function entriesToRows(state) {
    const classLabels = { essencial: 'Essencial', reduzir: 'Pode reduzir', atencao: 'Atenção', investimento: 'Investimento' };
    return (state.entries || [])
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map(e => [
        e.date,
        e.type === 'income' ? 'Receita' : 'Despesa',
        catName(state, e.catId),
        e.desc || '',
        e.amount,
        e.classification ? (classLabels[e.classification] || e.classification) : '',
        e.id,
        e.createdAt ? new Date(e.createdAt).toISOString() : '',
      ]);
  }

  async function writeAll(state) {
    const id = _spreadsheetId;
    // limpa a área de dados antiga (mantém o cabeçalho na linha 1)
    await api(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(SHEET_ENTRIES + '!A2:H')}:clear`,
      { method: 'POST', body: '{}' }
    );
    const rows = entriesToRows(state);
    const requests = [
      { range: `${SHEET_ENTRIES}!A1`, values: [HEADER] },
      { range: `${SHEET_BACKUP}!A1`,  values: [[JSON.stringify(state)]] },
    ];
    if (rows.length) requests.push({ range: `${SHEET_ENTRIES}!A2`, values: rows });

    await api(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data: requests }),
    });
  }

  /* ---------- merge (une dados locais + remotos, sem perder nada) ---------- */

  function mergeById(localArr, remoteArr, key) {
    const map = new Map();
    (remoteArr || []).forEach(x => { if (x && x[key] != null) map.set(x[key], x); });
    (localArr || []).forEach(x => { if (x && x[key] != null) map.set(x[key], x); }); // local vence em empate
    return Array.from(map.values());
  }

  function mergeStates(local, remote) {
    if (!remote) return local;
    if (!local)  return remote;
    return {
      entries:    mergeById(local.entries,    remote.entries,    'id'),
      categories: mergeById(local.categories,  remote.categories, 'id'),
      viewMonth:  local.viewMonth || remote.viewMonth,
    };
  }

  /* ---------- API pública ---------- */

  // Chamado pelo botão "Entrar com Google". Faz o SSO e devolve o perfil.
  async function signIn() {
    if (!configured()) return { ok: false, error: 'google_not_configured' };
    try {
      await getToken(true);          // dispara o popup de consentimento na 1ª vez
      const p = await fetchProfile();
      const email = (p.email || '').toLowerCase();

      // controle de acesso opcional
      const allowed = (AUTH_CONFIG.google.allowedUsers || []).map(x => String(x).toLowerCase());
      if (allowed.length && !allowed.includes(email)) {
        _token = ''; _tokenExp = 0; _profile = null;
        return { ok: false, error: 'user_not_allowed' };
      }
      return { ok: true, profile: { sub: p.sub, email, name: p.name || email, picture: p.picture || '' } };
    } catch (e) {
      console.error('Google signIn falhou:', e);
      const code = e && e.error === 'access_denied' ? 'access_denied' : 'login_failed';
      return { ok: false, error: code };
    }
  }

  // Após o login: garante a planilha, puxa o remoto e mescla com o local.
  async function afterLogin() {
    if (!configured()) return;
    try {
      await ensureSpreadsheet();
      const remote = await readBackupState();
      const local  = loadLocalState();
      const merged = mergeStates(local, remote);
      if (merged) saveLocalState(merged);
      // devolve tudo mesclado para a nuvem (garante consistência entre dispositivos)
      if (merged) await writeAll(merged);
    } catch (e) {
      console.error('Sincronização inicial falhou:', e);
      toast('⚠️ Não foi possível ler a planilha agora. Os dados ficam salvos no aparelho.');
    }
  }

  // A sessão atual é do tipo Google? (não depende de _profile estar em memória,
  // que pode se perder ao reabrir o PWA)
  function sessionIsGoogle() {
    const sess = window.Auth && Auth.getCurrentSession && Auth.getCurrentSession();
    return !!(sess && sess.loginMethod === 'google');
  }

  // Agenda um envio (debounce) — chamado pelo app a cada saveState().
  function scheduleSync(state) {
    if (!configured() || !sessionIsGoogle()) return;
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => pushNow(state), 1200);
  }

  async function pushNow(state) {
    if (_busy) { scheduleSync(state); return; }
    _busy = true;
    try {
      await ensureSpreadsheet();
      await writeAll(state || loadLocalState());
    } catch (e) {
      console.error('Envio para a planilha falhou:', e);
      toast('⚠️ Sem conexão com o Google — salvo no aparelho e envio depois.');
    } finally {
      _busy = false;
    }
  }

  // Sessão Google ativa? (perfil carregado nesta sessão de navegador)
  function isActive() { return !!_profile; }

  // Restaura o contexto Google ao reabrir o app com sessão válida.
  async function resume() {
    if (!configured()) return;
    try {
      await fetchProfile();     // renova token silenciosamente e recarrega o perfil
      await afterLogin();
    } catch (e) {
      console.warn('Não foi possível retomar a sessão Google silenciosamente.', e);
    }
  }

  function signOut() {
    try {
      if (_token && window.google && google.accounts && google.accounts.oauth2) {
        google.accounts.oauth2.revoke(_token, () => {});
      }
    } catch {}
    _token = ''; _tokenExp = 0; _profile = null;
    // limpa referências da planilha/pasta (a próxima conta a logar recomeça limpo)
    _spreadsheetId = ''; _folderId = '';
    localStorage.removeItem(SPREADSHEET_ID_KEY);
    localStorage.removeItem(FOLDER_ID_KEY);
  }

  window.GoogleSync = {
    configured, signIn, afterLogin, resume, scheduleSync, pushNow, signOut, isActive,
    getProfile: () => _profile,
    spreadsheetId: () => _spreadsheetId,
  };
})();
