# 📊 Controle de Gastos

Aplicativo pessoal de controle financeiro mensal — funciona como atalho no iPhone (PWA).
Agora com **login (SSO) via conta Google** e **dados salvos em uma planilha no seu Google Drive**.

---

## ✨ Funcionalidades

- Lançamento rápido de despesas e receitas com teclado numérico próprio
- 10 categorias pré-configuradas + 24 sugestões + 6 de receitas
- Cartão de saldo com receitas, despesas e saldo líquido por mês
- Análise visual: Essencial / Pode reduzir / Atenção / Investimento
- Exportação Excel `.xlsx` com período configurável
- Backup/restauração de dados em JSON
- **Login com conta Google (SSO)** + gravação automática em planilha do Google Drive
- Login alternativo com usuário/senha ou conta GitHub (opcional)
- Modo escuro automático conforme o iPhone
- Funciona offline (PWA) — sincroniza com a planilha quando há internet

---

## 🏠 Onde publicar? GitHub Pages ou Netlify?

Resumo da recomendação para o seu caso (SSO Google + planilha no Drive):

**Use o GitHub Pages.** O login com Google roda inteiramente no navegador
(Google Identity Services), sem `client_secret` e sem backend. Ou seja, você
**não precisa mais do Netlify nem da função serverless** — ela só existia para
esconder o segredo do GitHub OAuth, que não é mais usado.

| Critério | GitHub Pages | Netlify |
|---|---|---|
| Custo | Grátis | Grátis |
| Backend necessário p/ Google | Não | Não |
| Repositório privado no plano free | ❌ (exige plano pago) | ✅ (deploy de repo privado no free) |
| Já configurado neste projeto | ✅ `.github/workflows/deploy.yml` | ✅ `netlify.toml` |

- Escolha **GitHub Pages** se estiver tudo bem o **repositório ser público**.
  Não há problema de segurança: o código não contém segredos (o *Client ID* do
  Google é público por natureza) e os dados financeiros ficam na **sua planilha
  do Google**, nunca no repositório.
- Escolha **Netlify** apenas se quiser manter o **código-fonte privado** — o
  plano gratuito do Netlify publica a partir de repositório privado.

> Os dois arquivos de deploy foram mantidos no projeto, então qualquer um dos
> caminhos funciona sem alterações.

---

## 🟢 Publicar com Login Google + planilha no Drive (recomendado)

### Passo 1 — Criar o projeto e ativar as APIs (grátis)

1. Acesse **https://console.cloud.google.com** e crie um projeto
2. **APIs e serviços → Biblioteca** e ative:
   - **Google Sheets API**
   - **Google Drive API**

### Passo 2 — Tela de permissão OAuth

1. **APIs e serviços → Tela de permissão OAuth**
2. Tipo de usuário: **Externo**
3. Preencha nome do app, e-mail de suporte e e-mail de contato
4. Em **Acesso a dados**, adicione o escopo `.../auth/drive.file`
   *(escopo **não sensível**: o app só acessa a planilha que ele mesmo cria —
   não exige verificação de segurança do Google)*
5. Em **Público-alvo**, clique em **Publicar app** ("Em produção").
   Como o escopo é não sensível, **qualquer conta Google entra direto**, sem o
   aviso de "app não verificado" e sem precisar cadastrar usuários de teste.

> **Importante:** essa configuração é feita **uma vez, por você (dono do app)**.
> Quem for usar o aplicativo **não cria nada** no Google — só clica em
> "Entrar com Google" e autoriza. Veja o passo a passo completo em **MANUAL-GOOGLE.md**.

### Passo 3 — Criar o ID do cliente OAuth

1. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**
2. Tipo: **Aplicativo da Web**
3. Em **Origens JavaScript autorizadas**, adicione a URL onde o app será publicado, **sem barra no final**:
   - GitHub Pages: `https://SEU_USUARIO.github.io`
   - (para testar no computador) `http://localhost:8000`
4. **Não** é preciso preencher "URI de redirecionamento" neste fluxo
5. Copie o **ID do cliente** gerado

### Passo 4 — Configurar o app

Abra `auth-config.js` e edite:

```javascript
const AUTH_CONFIG = {
  mode: 'google',
  google: {
    clientId: 'COLE_AQUI_SEU_CLIENT_ID.apps.googleusercontent.com',
    allowedUsers: [
      // 'seuemail@gmail.com',   // vazio = qualquer conta que você autorizar
    ],
  },
  // ...
};
```

### Passo 5 — Publicar no GitHub Pages

1. **github.com → New repository** → nome `controle-gastos` → **Public** → Create
2. Faça upload de todos os arquivos do projeto (inclusive `google-sync.js` e a pasta `.github/`)
3. **Settings → Pages → Source: GitHub Actions** → Configure "Static HTML" → Commit
4. Em ~2 min o site fica em `https://SEU_USUARIO.github.io/controle-gastos/`
5. Confirme que essa URL de origem está nas **Origens JavaScript autorizadas** (Passo 3)

### Passo 6 — Instalar no iPhone

Abra a URL no **Safari** → **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar**.
Na primeira abertura, toque em **Entrar com Google** e autorize o acesso à planilha.

### O que acontece com os dados

- No primeiro login, o app pergunta **onde salvar** (em "Meu Drive" ou numa pasta nova) e cria a planilha **"Controle de Gastos — Dados"** nesse local
- Aba **Lançamentos**: uma linha por lançamento (data, tipo, categoria, descrição, valor, classificação)
- Aba **_backup** (oculta): estado completo em JSON, para restauração fiel entre aparelhos
- Cada lançamento novo é gravado na planilha automaticamente
- Ao abrir em outro aparelho e logar com a **mesma conta Google**, os dados aparecem (os lançamentos são mesclados, sem perda)
- Você pode **mover a planilha** para qualquer pasta do Drive depois — o app continua encontrando e atualizando o arquivo

---

## 🔑 Opções de login alternativas (opcionais)

O app continua suportando os modos antigos — basta trocar `mode` em `auth-config.js`:

- `'simple'` → usuário e senha criados no próprio app (dados só no aparelho; funciona no GitHub Pages)
- `'github'` → login com conta GitHub (requer Netlify + a função `netlify/functions/github-callback.js` e as variáveis `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`)
- `'both'` → GitHub + usuário/senha

No modo `'google'` esses caminhos ficam desativados.

---

## 💾 Dados e privacidade

- No modo **Google**, os lançamentos ficam **na sua planilha do Google Drive** e também
  em cache local no aparelho (para funcionar offline). Nada passa por servidores de terceiros.
- Nos modos `simple`/`github`, os dados ficam **apenas no dispositivo** (localStorage), sem sincronização.
- Você pode exportar `.xlsx` e fazer backup `.json` a qualquer momento pelo botão ⬇️.

---

## 🗂️ Arquivos do projeto

```
controle-gastos/
├── index.html              ← estrutura HTML
├── style.css               ← visual (light/dark mode)
├── app.js                  ← lógica financeira (+ gatilho de sync)
├── auth-config.js          ← ← EDITE AQUI: modo de login e clientId do Google
├── auth.js                 ← sistema de autenticação (Google / GitHub / senha)
├── google-sync.js          ← ← NOVO: SSO Google + planilha no Google Drive
├── manifest.json           ← configuração PWA
├── service-worker.js       ← cache offline
├── xlsx.mini.min.js        ← exportação Excel
├── icon-180/192/512.png    ← ícones do app
├── netlify.toml            ← configuração Netlify (opcional)
├── .github/workflows/
│   └── deploy.yml          ← publicação automática no GitHub Pages
└── netlify/functions/
    └── github-callback.js  ← backend OAuth (só usado no modo GitHub via Netlify)
```

---

## ❓ Perguntas frequentes

**Preciso do Netlify agora?**
Não. Com o login Google (fluxo no navegador) não há segredo a esconder nem backend a rodar.
O GitHub Pages sozinho já cobre tudo. Mantenha o Netlify só se quiser o repositório privado.

**Cada usuário precisa criar as APIs do Google?**
Não. O cadastro (projeto, APIs e Client ID) é feito **uma vez, por você**. Os usuários
só clicam em "Entrar com Google" e autorizam. Detalhes no **MANUAL-GOOGLE.md**.

**Aparece "app não verificado" ao entrar.**
Isso só acontece se o app ficou "Em teste" no Google Cloud. Publicando o app
"Em produção" (Passo 2) com o escopo não sensível `drive.file`, o aviso não aparece
e qualquer conta Google entra direto.

**Onde ficam os dados se eu trocar de iPhone?**
Na sua planilha do Google Drive. Ao logar com a mesma conta no aparelho novo, tudo é recarregado.

**O login com Google não abre a planilha.**
Confira: (1) as APIs Sheets e Drive estão ativadas; (2) a URL do site está nas
"Origens JavaScript autorizadas"; (3) o `clientId` em `auth-config.js` está correto.
