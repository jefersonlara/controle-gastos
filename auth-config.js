/* ============================================
   auth-config.js — Configuração de acesso
   Edite este arquivo para controlar quem pode
   usar o app e como o login funciona.
   ============================================ */

const AUTH_CONFIG = {
  /*
   * Modo de autenticação:
   *  'simple'  → usuário + senha (funciona no GitHub Pages, dados só no aparelho)
   *  'github'  → login com conta GitHub (requer Netlify + função OAuth)
   *  'google'  → login com conta Google + dados salvos numa planilha no Google Drive
   *  'both'    → GitHub + usuário/senha
   *
   * Para o recurso pedido (SSO Google + planilha no Drive) use:  mode: 'google'
   */
  mode: 'google',

  /*
   * Configuração do Google (necessária quando mode = 'google')
   *
   * IMPORTANTE: esta configuração é feita UMA ÚNICA VEZ, por VOCÊ (dono do app).
   * Quem for usar o aplicativo NÃO precisa criar nada no Google Cloud — só clica
   * em "Entrar com Google" e autoriza. O mesmo Client ID vale para todos.
   *
   * Como obter o Client ID (grátis):
   * 1. Acesse https://console.cloud.google.com → crie um projeto
   * 2. "APIs e serviços" → "Biblioteca" → ative (uma vez):
   *      • Google Sheets API
   *      • Google Drive API
   * 3. "APIs e serviços" → "Tela de permissão OAuth":
   *      • Tipo de usuário: Externo
   *      • Preencha nome do app, e-mail de suporte e de contato
   *      • Em "Acesso a dados" adicione o escopo:  .../auth/drive.file  (NÃO sensível)
   *      • Em "Público-alvo", clique em PUBLICAR o app ("Em produção").
   *        Como o escopo é não sensível, NÃO é preciso verificação: qualquer
   *        conta Google consegue entrar direto, sem aviso de "app não verificado"
   *        e sem a lista de usuários de teste.
   * 4. "Credenciais" → "Criar credenciais" → "ID do cliente OAuth":
   *      • Tipo: Aplicativo da Web
   *      • Origens JavaScript autorizadas: a URL onde o app é publicado
   *        Ex.: https://SEU_USUARIO.github.io   (sem barra no final)
   *        (adicione também http://localhost:8000 para testar localmente)
   *      • NÃO é preciso "URI de redirecionamento" neste fluxo
   * 5. Copie o "ID do cliente" e cole em clientId abaixo
   */
  google: {
    clientId: '768397606454-qifkpvgcit2ial75a4g4a8gmrphuu9ui.apps.googleusercontent.com',   // Ex.: '123456789-abcdef.apps.googleusercontent.com'

    /* E-mails Google com permissão de acesso (em minúsculas).
     * Lista vazia = qualquer conta Google que você autorizar na
     * tela de consentimento pode entrar. Preencha para restringir: */
    allowedUsers: [
      // 'jeferson@lara.solutions',
    ],
  },

  /*
   * Configuração do GitHub OAuth (só para mode 'github' ou 'both')
   */
  github: {
    clientId: '',
    allowedUsers: [],
  },
};
