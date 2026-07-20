# 📘 Manual — Login com Google + Planilha no Google Drive

Este manual explica, do zero, como ligar o **login com conta Google** e a
**gravação dos dados numa planilha no Google Drive** do usuário.

---

## 1. Entenda antes de começar (leitura de 1 minuto)

**Quem configura isto é só você, o dono do aplicativo — e apenas uma vez.**

As pessoas que vão *usar* o app **não precisam criar nada** no Google, não
precisam do Google Cloud e não precisam de conhecimento técnico. Elas apenas
abrem o app, tocam em **"Entrar com Google"** e autorizam. Só isso.

Pense assim: é como qualquer site com botão "Entrar com Google". O dono do site
registrou o app **uma vez**; os milhões de visitantes só clicam e entram. Aqui é
igual — você registra uma vez, e o mesmo cadastro serve para todos os usuários.

Por que precisa de um cadastro no Google? Porque para o app poder **criar e
gravar uma planilha no Drive de alguém**, o Google exige que o app seja
identificado por um **ID do cliente (Client ID)**. Isso é uma regra da
plataforma do Google e não existe forma de contornar — mas, repetindo, é um
cadastro **único, seu, feito uma vez**.

> **Existe um jeito mais simples, sem Client ID?** Não para o que você quer.
> Guardar os dados na planilha do Drive **da conta logada** obriga a usar o login
> Google + APIs do Google, e isso sempre exige um Client ID. O que dá para
> simplificar (e este manual já faz) é **a experiência do usuário**: publicando o
> app "em produção", ele entra direto, sem avisos e sem cadastros.

---

## 2. Criar o cadastro no Google (uma vez, ~10 min)

### 2.1 Criar o projeto e ligar as APIs

1. Acesse **https://console.cloud.google.com** e faça login com a **sua** conta Google
2. No topo, clique no seletor de projeto → **Novo projeto** → dê um nome (ex.: `Controle de Gastos`) → **Criar**
3. Com o projeto selecionado, vá em **APIs e serviços → Biblioteca** e ative estas duas (uma de cada vez): busque, abra e clique em **Ativar**:
   - **Google Sheets API**
   - **Google Drive API**

> Isto liga as APIs **para o seu projeto**. Nenhum usuário precisa repetir este passo.

### 2.2 Configurar a tela de permissão (consentimento)

1. Vá em **APIs e serviços → Tela de permissão OAuth**
2. **Tipo de usuário: Externo** → **Criar**
3. Preencha:
   - **Nome do app:** `Controle de Gastos`
   - **E-mail de suporte do usuário:** seu e-mail
   - **Informações de contato do desenvolvedor:** seu e-mail
4. Em **Acesso a dados** (ou "Escopos"), clique em **Adicionar ou remover escopos**, procure e marque:
   - `.../auth/drive.file` — *"Ver e gerenciar apenas os arquivos do Drive que você abrir ou criar com este app"*
   - (o `openid`, `email` e `profile` costumam vir por padrão — pode manter)
   - **Salvar**

   > Esse escopo `drive.file` é **não sensível**: o app só enxerga a planilha que
   > ele mesmo cria — nunca o resto do seu Drive. Por isso **não exige o processo
   > de verificação** do Google.

### 2.3 Publicar o app (este é o passo que deixa tudo simples)

1. Ainda na **Tela de permissão OAuth**, vá em **Público-alvo**
2. Se o status estiver **"Em teste"**, clique em **Publicar app** → confirme (**Em produção**)

   > **Por que publicar?** No modo "Em teste", só e-mails que você cadastrar
   > manualmente entram, aparece um aviso de "app não verificado", e a permissão
   > **expira a cada 7 dias**. Publicando "em produção" com o escopo não sensível
   > `drive.file`, **qualquer conta Google entra direto**, sem aviso e sem lista de
   > usuários — que é exatamente o que você quer para pessoas leigas.

### 2.4 Criar o ID do cliente (Client ID)

1. Vá em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**
2. **Tipo de aplicativo: Aplicativo da Web**
3. **Nome:** `Controle de Gastos Web`
4. Em **Origens JavaScript autorizadas**, clique em **Adicionar URI** e informe a URL onde o app vai rodar, **sem barra no final**:
   - Produção (GitHub Pages): `https://SEU_USUARIO.github.io`
   - Para testar no computador (opcional): `http://localhost:8000`
   - **Não** preencha "URIs de redirecionamento" — este fluxo não usa
5. **Criar** → copie o **ID do cliente** (algo como `1234...-abcd.apps.googleusercontent.com`)

---

## 3. Colocar o Client ID no app

Abra o arquivo **`auth-config.js`** e edite:

```javascript
const AUTH_CONFIG = {
  mode: 'google',
  google: {
    clientId: 'COLE_AQUI_SEU_CLIENT_ID.apps.googleusercontent.com',
    allowedUsers: [
      // Deixe vazio para permitir qualquer conta Google que autorizar.
      // Ou restrinja a e-mails específicos:
      // 'voce@gmail.com',
      // 'esposa@gmail.com',
    ],
  },
  // ...resto do arquivo permanece igual...
};
```

- **`allowedUsers` vazio** = qualquer pessoa que entrar com Google e autorizar usa o app (cada uma com a sua própria planilha, no seu próprio Drive).
- **`allowedUsers` preenchido** = só os e-mails da lista conseguem entrar.

---

## 4. Publicar no GitHub Pages

1. **github.com → New repository** → nome `controle-gastos` → **Public** → **Create**
2. Faça upload de **todos** os arquivos do projeto (incluindo `google-sync.js` e a pasta `.github/`)
3. **Settings → Pages → Source: GitHub Actions** → em "Static HTML" clique **Configure** → **Commit**
4. Em ~2 minutos o app estará em `https://SEU_USUARIO.github.io/controle-gastos/`
5. Confira que essa URL de origem (`https://SEU_USUARIO.github.io`) está nas **Origens JavaScript autorizadas** do passo 2.4

---

## 5. Como o usuário usa (a experiência dele)

1. Abre o link no **Safari** (iPhone) e adiciona à tela de início (**Compartilhar → Adicionar à Tela de Início**)
2. Abre o app e toca em **Entrar com Google**
3. Escolhe a conta e **autoriza** o acesso (só na primeira vez)
4. **Na primeira vez**, o app pergunta **onde salvar a planilha** no Drive:
   - **Em "Meu Drive"** (página inicial do Drive), ou
   - **Em uma pasta nova** com o nome que ele escolher (ex.: `Finanças`)
5. Pronto: cada lançamento é gravado automaticamente na planilha
   **"Controle de Gastos — Dados"** no Drive **dele**.

Nada de criar projeto, ativar API ou copiar chave. Só entrar e autorizar.

> **Mover a planilha depois:** o usuário pode arrastar a planilha para qualquer
> outra pasta do Drive quando quiser — o app continua encontrando e atualizando o
> arquivo normalmente (ele é localizado por um identificador interno, não pela pasta).

---

## 6. O que fica salvo na planilha

Arquivo **"Controle de Gastos — Dados"** com duas abas:

- **Lançamentos** — uma linha por lançamento, legível:
  `Data · Tipo · Categoria · Descrição · Valor · Classificação · ID · Criado em`
- **_backup** (oculta) — o estado completo em JSON, para restaurar tudo com
  fidelidade (categorias personalizadas, etc.) ao abrir em outro aparelho.

Ao entrar com a **mesma conta** em outro celular, os dados são recarregados e
**mesclados sem perder nada**.

---

## 7. Perguntas frequentes

**Cada usuário precisa criar o Sheets API / Drive API?**
Não. Isso é feito **uma vez, por você**, no seu projeto do Google Cloud. O
usuário só entra com a conta dele e autoriza.

**Vai aparecer "o Google não verificou este app"?**
Se você **publicou o app "em produção"** (passo 2.3) e usa só o escopo não
sensível `drive.file`, o aviso **não aparece**. Se você deixou "em teste", aí sim
aparece e só e-mails cadastrados entram — por isso recomendamos publicar.

**Os dados de um usuário aparecem para outro?**
Não. Cada pessoa entra com a própria conta e o app cria a planilha **no Drive
dela**. Ninguém vê os dados de ninguém.

**Preciso pagar alguma coisa?**
Não. Google Cloud (para este uso), as APIs Sheets/Drive e o GitHub Pages são
gratuitos nesse volume.

**O login não abre a planilha.**
Confira: (1) as APIs **Sheets** e **Drive** estão ativadas no projeto; (2) a URL
do site está nas **Origens JavaScript autorizadas**; (3) o **clientId** em
`auth-config.js` está correto e sem espaços.

**Quero restringir quem entra.**
Preencha `allowedUsers` em `auth-config.js` com os e-mails permitidos.
