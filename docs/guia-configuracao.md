# Guia de configuração — tudo grátis

Ordem sugerida: 1 → 2 → 3 → 4 → 5. Cada passo funciona sozinho; o app já roda sem eles.

> **Mensagens automáticas começam DESLIGADAS.** Enquanto você ainda usa o app antigo, deixe assim
> (senão o cliente recebe tudo em dobro). No dia da troca: Settings → Texts and email →
> **Turn automatic messages on**, e desligue os lembretes no app antigo.

## 1. Banco de dados grátis (Neon)

1. Crie uma conta em neon.tech com o Gmail da Woofers (plano Free, sem cartão).
2. Crie um projeto (região **US West**). Copie a "connection string" (começa com `postgres://`).
3. Essa string vira `DATABASE_URL` no servidor (passo 2).

## 2. Hospedagem grátis (Netlify)

O plano **Premium** da Hostinger não roda apps Node.js (só o Business e acima). Por isso o app
fica no **Netlify (plano Free, permite uso comercial)**; a Hostinger continua com os seus sites.

1. Crie uma conta em netlify.com com o GitHub (plano Free, sem cartão).
2. **Add new site → Import from Git** → repositório `Duperpower`.
   O Netlify reconhece o Next.js sozinho (o arquivo `netlify.toml` já está no projeto).
   **Importante:** em *Build & deploy → Branches*, coloque **Production branch = `production`** e
   desligue *Branch deploys* e *Deploy previews*. Cada publicação gasta 15 dos 300 créditos do mês;
   assim só publicamos quando juntamos as mudanças (umas 4 por mês), e as melhorias do dia a dia
   não gastam créditos.
3. **Site configuration → Environment variables**: `DATABASE_URL`, `APP_URL`
   (ex.: `https://woofersdogspa.netlify.app`), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CRON_SECRET`.
4. Domínio: **Domain management → Add a domain** → `app.woofersdogspa.com`. O Netlify mostra um
   registro **CNAME**; crie esse registro onde o domínio `woofersdogspa.com` é gerenciado
   (Hostinger → Domínios → DNS, ou no Lovable, se o domínio estiver lá).
5. Uma vez só, crie as tabelas e os seus dados: `npm run db:migrate` e `npm run db:seed`
   (eu rodo daqui com a `DATABASE_URL`).
6. Abra `https://woofersdogspa.netlify.app` → crie o seu login de dono.

Limite do plano Free: 300 créditos por mês, com corte: se acabar, o app pausa até o mês seguinte.
Conta estimada para o seu volume (~75 visitas/mês): 4 publicações = 60, acessos e páginas ≈ 10–30,
tráfego ≈ 10–20 → **~100 de 300**. O Netlify avisa por e-mail em 50%, 75% e 100%; se chegar perto,
o plano Personal ($9/mês, 1.000 créditos) resolve na hora, sem mudar nada no app.

Banco (Neon Free): 100 horas de processamento por mês e 1 GB. O banco "dorme" depois de 5 min sem
uso; o primeiro acesso depois disso demora cerca de 1 segundo a mais. Uso estimado: ~15–25 horas.

**Antes de cancelar o MoeGo:** use os dois juntos por 2 a 4 semanas (mensagens automáticas do app
novo desligadas). Se algo falhar, o MoeGo ainda está lá. Só cancele depois de ver o uso real.

No iPhone: abra o app no Safari → Compartilhar → **Adicionar à Tela de Início** (passo a passo na seção 10).

## 3. E-mail automático (Gmail da Woofers)

1. myaccount.google.com (conta Gmail da Woofers) → Segurança → ative a **Verificação em duas etapas**.
2. Na busca da conta, procure **Senhas de app** → crie uma chamada "Woofers app".
3. O Google mostra 16 letras: essa é a senha de app (anote, ele só mostra uma vez).
4. No Netlify: **Site configuration → Environment variables → Add a variable**, duas vezes:
   - `GMAIL_USER` = o Gmail da Woofers (ex.: woofersdogspa@gmail.com)
   - `GMAIL_APP_PASSWORD` = as 16 letras, sem espaços
5. **Deploys → Trigger deploy → Deploy project** (a variável só vale depois do deploy).
6. No app: Settings → Texts and email → coloque o seu e-mail → **Send me a test email**.
   Chegou? Está pronto. (Na primeira vez, olhe também o spam.)

Os e-mails saem com o logo da Woofers e um botão "See my appointment" para o cliente ver,
confirmar ou cancelar. Eles só saem sozinhos depois de ligar **Turn automatic messages on**.
Limite do Gmail: ~500 e-mails por dia.

## 4. SMS automático pelo seu iPhone (linha AT&T)

No app: Settings → Texts and email → **Copy** no "Link for the Shortcut".

No iPhone, app **Atalhos** (Shortcuts):

1. Aba **Automação** → **+** → **Hora do Dia** → **10:00**, **Diariamente** →
   marque **Executar Imediatamente** → Avançar → **Nova Automação em Branco**.
2. Adicione **Obter Conteúdo do URL** → cole o link.
3. Adicione **Obter Valor do Dicionário** → Chave: `messages`.
4. Adicione **Repetir com Cada** (cada item do Valor do Dicionário).
5. Dentro do Repetir:
   - **Obter Valor do Dicionário** → Chave `body` → do **Item Repetido**;
   - **Obter Valor do Dicionário** → Chave `phone` → do **Item Repetido**;
   - **Enviar Mensagem** → Mensagem = o `body`, Destinatário = o `phone`.
     Toque na setinha da ação e **desligue "Mostrar ao Executar"** (senão ele pede para tocar em Enviar).
6. Salve. Repita a mesma automação em outros horários do dia (por exemplo **8:00, 10:00, 12:00,
   14:00, 16:00 e 18:00**): o texto ao cliente sai na próxima rodada depois que ele agenda.
   Dica: em vez de montar tudo de novo, abra a automação pronta e use **Duplicar** (segure o dedo nela).

**Teste:** no app, Settings → Texts and email → **Send test** (vem com o seu número preenchido).
Depois, no Atalhos, abra a automação e toque em ▶︎. Em alguns segundos chega no seu iPhone a
mensagem "Test from Woofers Dog Spa…". A tela do app mostra também quantos textos estão
esperando e quando o iPhone buscou pela última vez.
Se não houver nada para enviar, o atalho termina sem mandar nada.
Cada texto sai **uma vez só**; o app marca como "Sent from iPhone".

Respostas dos clientes chegam no seu Mensagens normal. Para confirmar ou cancelar, o texto
leva um link: o cliente toca e o app muda o status sozinho.

Se um cliente pedir para não receber textos: abra o cliente → Edit → desmarque
"Client agreed to receive text messages".

## 5. Google Calendar (atualiza a cada 15 minutos)

Uma vez só, num computador, com a conta Google da Woofers:

1. No app: Settings → **Google Calendar** → **Copy** no script.
2. Abra **script.google.com** → **New project** → apague o que estiver lá → cole.
3. **Save** (disquete). Na barra de cima escolha **setup** → **Run**.
4. O Google pede permissão: **Review permissions** → conta da Woofers → **Advanced** →
   **Go to Untitled project** → **Allow** (é um script seu, por isso o aviso de "não verificado").
5. Pronto: aparece a agenda "Woofers Dog Spa" no Google Calendar, com todas as visitas.
   Visita nova, mudada ou cancelada aparece em até 15 minutos, das 6h às 21h
   (à noite ele para, para o banco de dados grátis poder "dormir").

Se usar isso, não use também o link de assinatura (as visitas apareceriam duas vezes), e
desligue a sincronização do MoeGo com o Google quando parar de usar o MoeGo.

## 6. Botão "Book Now" no site (Lovable)

Cole isto no Lovable (troque o endereço pelo do seu app):

> Change every "Book Now" / "Book" button on the site so it opens
> https://woofersdogspa.netlify.app/book in the same tab. Keep the current button styles.

Se preferir a página dentro do site:

> Create a page at /book that shows only this, full width, no extra padding:
> `<iframe src="https://woofersdogspa.netlify.app/book?embed=1" title="Book a visit" style="width:100%;min-height:1400px;border:0"></iframe>`
> and make every "Book Now" button link to /book.

(O `?embed=1` esconde o cabeçalho e o rodapé da página de agendamento, porque o site já tem os dele.)

## 7. Lembretes de hora em hora (opcional, grátis)

Para os e-mails saírem mesmo com o celular desligado: no GitHub do projeto → Settings →
Secrets and variables → Actions → crie `APP_URL` e `CRON_SECRET` (o mesmo do servidor).
O arquivo `.github/workflows/messages.yml` já chama o app de hora em hora.

## 8. Trazer os clientes do app antigo

Settings → **Import clients** → escolha o arquivo `.csv` exportado → **Import clients**.
Vêm os clientes, os pets (com raça e frequência) e a próxima visita de cada um.
Pode importar de novo um export mais novo: quem já existe (mesmo telefone) não é duplicado.
Depois confira: o tamanho de cada pet (para o preço certo) e os serviços das visitas importadas.

## 9. Contrato de serviço

Settings → **Service agreement**. O seu texto já está lá (sem a seção 9, e com o
cancelamento: grátis até 48 h antes, depois 50% do serviço). Ao agendar online, o cliente digita o nome e assina com o dedo
(a assinatura aparece na ficha do cliente). No link de confirmação ele assina digitando o nome. Vale por um ano. Mudança importante? Marque "ask every client to sign again".

## 10. App na Tela de Início do iPhone + notificações

**Ícone na Tela de Início**
1. Abra o **Safari** (bússola azul) e entre em `https://woofersdogspa.netlify.app/today`. Faça login.
2. Toque no botão **Compartilhar** (quadrado com seta para cima, embaixo no meio).
3. Role e toque em **Adicionar à Tela de Início**. Se não aparecer: **Editar Ações…** → adicione.
4. Nome: `Woofers` → se aparecer **Abrir como App Web**, deixe ligado → **Adicionar**.
5. O ícone com o cachorrinho aparece na Tela de Início. Sempre abra por ele (tela cheia, sem barra do Safari).
   Se tinha um ícone antigo (endereço celebrated-stroopwafel…), apague: segure → Remover App → Remover da Tela de Início.

**Notificações** (iPhone com iOS 16.4 ou mais novo; só funciona pelo ícone da Tela de Início)
1. Abra o Woofers pelo ícone → ☰ ou aba Settings → **Notifications**.
2. **Turn on notifications on this device** → o iPhone pergunta → **Permitir**.
3. **Send a test**: em segundos aparece "Notifications are on…".
4. Se não aparecer: Ajustes do iPhone → **Notificações** → **Woofers** → Permitir Notificações ligado,
   Tela Bloqueada / Central / Faixas marcados, Sons ligado. Confira também se um **Foco** (Não Perturbe,
   Sono, Trabalho) não está silenciando: Ajustes → Foco → (o foco) → Apps → adicionar Woofers.

## 11. Backup semanal no Google Drive

Uma vez só, no iPad (Safari em "Solicitar Site para Computador") ou num computador:

1. No app: Settings → **Backups** → **Copy** no script.
2. Abra **script.google.com** com a conta Google da Woofers → **New project** (um projeto novo, não o do
   Google Calendar) → apague o que estiver lá → cole.
3. Salve (disquete) → escolha **setup** → **Run** → dê a permissão (Advanced → Go to Untitled project → Allow).
4. No Google Drive aparece a pasta **Woofers backups** com 2 arquivos: tudo (JSON) e a lista de clientes
   (planilha). Todo domingo à noite ele salva de novo e guarda as últimas 12 semanas.

Em Settings → Backups aparece "Working. Last backup: …". Se passar de 8 dias sem backup, aparece um aviso.
