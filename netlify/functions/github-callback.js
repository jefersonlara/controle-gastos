/* ============================================
   netlify/functions/github-callback.js
   Troca o código GitHub OAuth por um token de
   acesso e redireciona de volta para o app.

   Variáveis de ambiente necessárias no Netlify:
     GITHUB_CLIENT_ID     — ID do seu OAuth App
     GITHUB_CLIENT_SECRET — Secret do seu OAuth App
   ============================================ */

exports.handler = async function (event) {
  const { code, state } = event.queryStringParameters || {};

  if (!code) {
    return redirect('/#auth_error=missing_code');
  }

  const clientId     = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('GITHUB_CLIENT_ID ou GITHUB_CLIENT_SECRET não configurados.');
    return redirect('/#auth_error=server_config_error');
  }

  try {
    /* ---------- 1. Trocar code por access_token ---------- */
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error);
      return redirect(`/#auth_error=${encodeURIComponent(tokenData.error)}`);
    }

    /* ---------- 2. Buscar perfil do usuário ---------- */
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept':        'application/vnd.github.v3+json',
        'User-Agent':    'ControleDeGastos-App',
      },
    });

    if (!userRes.ok) {
      return redirect('/#auth_error=github_api_error');
    }

    const user = await userRes.json();

    /* ---------- 3. Redirecionar ao app com dados no hash ----------
     * O hash (#) não é enviado ao servidor — fica apenas no cliente.
     * O app lê esses valores, armazena em sessionStorage e limpa a URL. */
    const fragment = new URLSearchParams({
      gh_token:  tokenData.access_token,
      gh_user:   user.login.toLowerCase(),
      gh_name:   user.name || user.login,
      gh_avatar: user.avatar_url || '',
    }).toString();

    return redirect(`/#${fragment}`);

  } catch (err) {
    console.error('Erro no callback GitHub:', err);
    return redirect('/#auth_error=server_error');
  }
};

function redirect(location) {
  return { statusCode: 302, headers: { Location: location }, body: '' };
}
