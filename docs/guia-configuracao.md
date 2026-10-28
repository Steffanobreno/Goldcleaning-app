# Guia de configuração — Gold Cleaning App

Ordem sugerida: 1 → 2 → 3 → 4 → 5. Cada passo funciona sozinho.

> **E-mails automáticos começam DESLIGADOS** para as limpezas que a Amanda marca no app. Os pedidos
> que chegam pela página de agendamento sempre recebem os e-mails deles ("recebemos seu pedido",
> "confirmado"). Quando estiverem prontos: Settings → **Email messages** → **Turn automatic messages on**.

## 1. Banco de dados (Neon, conta nova)

1. Conta nova em **neon.tech** (plano Free, sem cartão), com o Gmail da empresa.
2. Projeto na região **AWS US East 2 (Ohio)**, só **Postgres** marcado.
3. Em **Connect**, deixe **Connection pooling** ligado e copie a *connection string* (começa com
   `postgresql://` e o endereço tem `-pooler`; o app está preparado para ela).
   **Não mande essa string por chat ou e-mail:** ela é a senha do banco. Ela só é colada no
   Netlify (passo 2).

## 2. Hospedagem (Netlify, conta nova)

1. Conta nova em **netlify.com** entrando com o GitHub (plano Free, sem cartão).
2. **Add new project → Import from Git** → repositório **Goldcleaning-app**.
   O Netlify reconhece o Next.js sozinho (o `netlify.toml` já está no projeto).
3. **Project configuration → Build & deploy → Branches**:
   **Production branch = `production`**, e desligue *Branch deploys* e *Deploy previews*.
   Cada publicação gasta créditos do plano Free; assim só publicamos quando juntamos mudanças.
4. **Project configuration → Environment variables** (Add a variable, uma por vez):
   - `DATABASE_URL` = a connection string do Neon (cole direto aqui)
   - `APP_URL` = o endereço do app, ex.: `https://goldcleaning-app.netlify.app`
   - `GMAIL_USER` = `bayareacserv@gmail.com`
   - `GMAIL_APP_PASSWORD` = a senha de app do Gmail (passo 3)
   - `CRON_SECRET` = uma senha longa qualquer (ex.: 40 letras e números aleatórios)
   - `SETUP_CODE` = um código só para criar o login da Amanda na primeira vez
5. **Deploys → Trigger deploy → Deploy project**.
6. Não precisa criar tabelas à mão: cada publicação primeiro cria ou atualiza as tabelas e, num
   banco novo, coloca os dados da Gold (preços, extras, horários, cidades, e-mails). Se a
   publicação falhar logo no começo, quase sempre é a `DATABASE_URL` colada errada.
7. Abra `APP_URL/login` → crie o login de dono com o `SETUP_CODE`.

Limites do Free: Netlify 300 créditos/mês (avisa por e-mail em 50%, 75% e 100%); Neon 100 horas
de processamento e 1 GB. O banco "dorme" depois de 5 minutos sem uso; o primeiro acesso depois
disso leva cerca de 1 segundo a mais.

## 3. E-mail automático (Gmail bayareacserv@gmail.com)

1. **myaccount.google.com** (conta bayareacserv) → Segurança → ative a **Verificação em duas etapas**.
2. Na busca da conta, procure **Senhas de app** → crie uma chamada "Gold app".
3. O Google mostra 16 letras: essa é a `GMAIL_APP_PASSWORD` (ele só mostra uma vez).
4. Coloque no Netlify (passo 2.4) e faça **Trigger deploy**.
5. No app: Settings → **Email messages** → confira o e-mail para avisos → **Send me a test email**.
   Chegou? Pronto. (Na primeira vez, olhe também o spam.)

Os e-mails saem com o nome **Gold Cleaning** em cima, o resumo da limpeza (data, endereço, preço)
e um botão para o cliente ver, confirmar ou cancelar. Limite do Gmail: ~500 e-mails por dia.

**Ligações e mensagens de texto** continuam pelo **Google Voice (650) 434-2080**, à mão. O app
não manda SMS. Atenção: os botões **Call** e **Text** do app abrem o telefone do próprio iPhone;
para usar o número da empresa, ligue ou mande mensagem pelo app do Google Voice.

## 4. E-mails de hora em hora (lembretes, "termine seu agendamento")

No GitHub do projeto → **Settings → Secrets and variables → Actions** → crie:
- `APP_URL` = o mesmo do Netlify
- `CRON_SECRET` = o mesmo do Netlify

O arquivo `.github/workflows/messages.yml` já chama o app de hora em hora (no minuto 7).

## 5. Preços, horários e cidades

- **Settings → Price list:** a tabela de cada limpeza (início para 1 quarto e 1 banheiro, mais
  cada quarto, banheiro e lavabo extra) por frequência, e os extras. Preço novo vale para os
  próximos agendamentos; os já marcados ficam como estão.
- **Settings → Online booking:** duração (3 horas; +1 hora para casas com mais de 3 quartos),
  aviso mínimo (24 h), até quantos dias à frente (60), cidades atendidas e os horários de
  início (manhã 9:00 e tarde 13:00, de segunda a sexta).
- Airbnb e escritório não têm preço online: chegam em **Requests → Quotes**. Depois de combinar
  o preço, **Make client and book** marca a limpeza com o preço combinado.

## 5b. Preço de uma casa e descontos

- **Preço de uma casa (cliente antigo, preço diferente):** Clients → o cliente → a casa → **Price for this home**.
  Em *Adjustment per visit* escreva `-20` para baixar $20 em cada limpeza, ou `15` para subir $15. Vale para
  todas as limpezas novas dessa casa, inclusive as que repetem. As já marcadas ficam como estão.
- **Descontos:** Settings → **Discounts**. Um desconto tem nome e vale uma porcentagem ou um valor em dólar.
  - **Com código** (ex.: `WELCOME10`): é um cupom que o cliente digita na página de agendamento. Marque
    *First-time clients only* para valer só para quem nunca fez limpeza com vocês. Dá para limitar por datas e
    por quantidade de usos.
  - **Sem código:** é um desconto seu. Dá para dar a **uma limpeza** (na hora de marcar ou em *Edit price*) ou a
    **uma casa**, para valer sempre (na mesma tela *Price for this home*).
- O cupom vale só na primeira limpeza de uma série que repete. O preço da casa e os descontos fixos da casa
  valem em todas.
- Pedido online de cliente antigo vem com o preço da tabela. Se a casa tem preço próprio, o pedido avisa:
  toque em **Edit price** e **Save** para aplicar.

## 6. Google Calendar (atualiza a cada 15 minutos)

Uma vez só, num computador, com a conta Google da empresa:

1. No app: Settings → **Google Calendar** → **Copy** no script.
2. **script.google.com** → **New project** → apague o que estiver lá → cole.
3. **Save** → escolha **setup** → **Run**.
4. O Google pede permissão: **Review permissions** → a conta da empresa → **Advanced** →
   **Go to Untitled project** → **Allow** (é um script de vocês, por isso o aviso).
5. Aparece a agenda **Peninsula Gold Cleaning** no Google Calendar, com todas as limpezas. Nova, mudada ou
   cancelada aparece em até 15 minutos, das 6h às 21h.

## 7. Página de agendamento no site

O botão "Book Now" do site abre `/book-now`, que mostra a página do app
`APP_URL/book?embed=1` (sem o cabeçalho e o rodapé do app, porque o site já tem os dele).
Isso é feito no repositório do site; o app já permite aparecer dentro de
peninsulagoldcleaning.com.

## 8. App na Tela de Início do iPhone + notificações

**Ícone na Tela de Início**
1. No **Safari**, abra `APP_URL/today` e faça login.
2. Toque em **Compartilhar** (quadrado com seta para cima).
3. **Adicionar à Tela de Início** (se não aparecer: **Editar Ações…** → adicione).
4. Nome: `Gold` → se aparecer **Abrir como App Web**, deixe ligado → **Adicionar**.
5. O ícone com o **G dourado** aparece na Tela de Início. Sempre abra por ele.

**Notificações** (iOS 16.4 ou mais novo; só pelo ícone da Tela de Início)
1. Abra o Gold pelo ícone → Settings → **Notifications**.
2. **Turn on notifications on this device** → **Permitir**.
3. **Send a test**: em segundos aparece o aviso.
4. Não apareceu? Ajustes do iPhone → **Notificações** → **Gold** → Permitir Notificações; confira
   também se um **Foco** (Não Perturbe, Sono) não está silenciando.

Chegam avisos de: pedido novo, pedido de orçamento, cancelamento pelo cliente e agendamento
abandonado.

## 9. Backup semanal no Google Drive

Uma vez só, num computador:

1. No app: Settings → **Backups** → **Copy** no script.
2. **script.google.com** com a conta Google da empresa → **New project** (outro, não o do
   Google Calendar) → cole.
3. Salve → **setup** → **Run** → dê a permissão.
4. No Google Drive aparece a pasta **Gold Cleaning backups** com 2 arquivos: tudo (JSON) e a lista
   de clientes (planilha). Todo domingo à noite salva de novo e guarda as últimas 12 semanas.

## 10. Trazer uma lista de clientes (se houver)

Settings → **Import clients** → arquivo `.csv` com as colunas *First name*, *Last name*, *email*,
*Primary contact* (telefone) e *address*; opcionais *Bedrooms*, *Bathrooms* e *Half baths*.
Cada cliente vem com uma casa no endereço dele. Importar de novo não duplica (o telefone é a chave).
