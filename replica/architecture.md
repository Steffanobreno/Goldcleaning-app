# Architecture: (nome a definir em /replica-brand), recriação das funções de grooming móvel do MoeGo

Para um negócio de grooming móvel na Califórnia: uma van, o dono no celular, clientes
agendando pela web. Pagamentos Cash/Zelle/cheque/Venmo (só registro), contato só por SMS,
navegação pelo Google Maps. Objetivo nº 1: um MVP que permita **cancelar o MoeGo**.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web (dono + cliente) | Next.js 15 (App Router) + TypeScript | um só código para o painel do dono e a página de agendamento do cliente |
| app do dono | **PWA** (instalável na tela inicial do iPhone/Android) | sem App Store, sem segunda base de código; app nativo (Expo) só se faltar algo |
| styling | Tailwind + tokens do /replica-design | rápido, consistente, mobile-first |
| database | Postgres gerenciado (Supabase ou Neon) | backup diário, plano grátis cobre um negócio; em dev, Postgres local |
| acesso ao banco | postgres.js com SQL puro + tipos TypeScript à mão | o schema já é SQL; menos camadas; migrações são arquivos `.sql` |
| auth (dono) | login próprio: e-mail + senha (scrypt), sessão em cookie httpOnly com token guardado como hash | um dono só; não prende o app a um fornecedor; roda com qualquer Postgres |
| auth (cliente) | código SMS via **Twilio Verify** + cookie de sessão assinado | cliente não cria senha; mesmo fluxo do original |
| SMS | **Twilio Programmable Messaging** com número local (A2P 10DLC) | único canal com o cliente; webhooks de entrada e status; STOP/HELP automático |
| mapas | **Google Maps Platform**: Maps JavaScript, Places Autocomplete, Geocoding, Routes API (Compute Route Matrix + otimização de waypoints) | é o que o dono já usa; o botão Direções abre o próprio app Google Maps |
| pagamentos | nenhum provedor: registro manual (cash, zelle, check, venmo) | é como o negócio recebe; Stripe entra depois se precisar de cartão |
| e-mail | Resend (opcional, marco 3) | só para recibos/relatórios se o cliente quiser |
| jobs | Vercel Cron a cada 5 min → rota `/api/cron/*` | lembretes de SMS; sem servidor extra |
| arquivos | Supabase Storage (bucket privado, URLs assinadas) | fotos antes/depois, certificados de vacina |
| hosting | Vercel | deploy no `git push`, HTTPS, domínio próprio |

Uma base de dados, um app, sem microserviços.

## Schema

Tables: 29 (`replica/schema.sql`, testado em Postgres 16).
Access rules: **checagem no data layer**. Toda leitura/escrita passa por server actions/route
handlers do Next.js; cada query filtra por `business_id` do staff logado (helper único
`requireStaff()`), e no portal por `client_id` da sessão (`requireClient()`). RLS ligado em todas
as tabelas sem policies públicas, então a chave anon do Supabase não lê nada pelo navegador.

Decisões que importam:
- dinheiro em centavos `int` + `currency` (USD); horários `timestamptz` em UTC, exibidos em `America/Los_Angeles`
- **sem agendamento duplo**: exclusion constraint `no_double_booking` (staff + intervalo) para status ativos; testado
- nomes e preços de serviço **copiados** para `appointment_services` (o histórico não muda quando o preço muda)
- endereço/lat/lng **copiados** para `appointments` (cliente muda de casa, o histórico fica)
- `scheduled_messages unique (appointment_id, template_id)`: um lembrete nunca sai duas vezes
- `messages.twilio_sid unique`: webhook repetido do Twilio não duplica mensagem
- `clients unique (business_id, phone)`: telefone é a identidade do cliente (login por SMS, import, inbox)
- área atendida por ZIP code + dias da semana (mais simples que polígono; dá para trocar depois)

## API

Tudo é server action (`action`) ou route handler (`GET/POST /api/...`). "dono" = staff logado;
"cliente" = sessão do portal; "público" = sem login; "Twilio"/"cron" = assinatura/segredo verificados.

### F04/F05/F10 Agenda do dono

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /app/calendar?view=day\|week\|list&date= | agenda | dono | data, visão | agendamentos com pets, códigos, alertas | F04 |
| action createAppointment | cria (1+ pets, serviços), checa expediente e conflito | dono | client_id, pets[{pet_id, service_ids}], start_at, staff_id, notes | appointment | F04 |
| action suggestSlots | horários que cabem na rota do dia | dono | client_id, duração, intervalo de datas | [{start_at, drive_before, drive_after}] | F04 |
| action updateAppointment | edita/remarca (scope: this\|following\|series) | dono | id, campos, scope | appointment | F05 |
| action setAppointmentStatus | confirmar, a caminho, em andamento, concluído, cancelado, no-show | dono | id, status | appointment | F06 |
| action createSeries | gera até 100 ocorrências, devolve conflitos | dono | appointment base, freq, interval, ends_on\|occurrences, preview? | prévia ou série | F05 |
| action bookAgain | copia pets/serviços para nova data | dono | appointment_id, start_at | appointment | F10 |

### F06 Dia na van

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /app/today?date= | mapa + lista na ordem da rota, tempos entre paradas | dono | data | paradas, polyline, totais | F06 |
| action optimizeRoute | reordena o dia (Routes API, otimização de waypoints) e mostra antes/depois | dono | data, apply? | ordem sugerida, minutos economizados | F06 |
| action sendOnMyWay | SMS "a caminho, chego ~HH:MM" com ETA da Routes API a partir da posição atual | dono | appointment_id, lat, lng | message | F06 |
| (link) Direções | `https://www.google.com/maps/dir/?api=1&destination=lat,lng` abre o app Google Maps | dono | — | — | F06 |

### F08 Checkout

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action openInvoice | cria/abre fatura a partir do agendamento | dono | appointment_id | invoice + itens | F08 |
| action updateInvoice | itens extras, desconto, gorjeta | dono | invoice_id, items, discount, tip | invoice | F08 |
| action recordPayment | registra Cash/Zelle/cheque/Venmo (+ referência); fecha se quitado | dono | invoice_id, method, amount, tip, reference | payment, invoice | F08 |
| action reopenInvoice | só se ainda não fechado no fim do dia (guess) | dono | invoice_id | invoice | F08 |

### Clientes e pets

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /app/clients?q=&filter= | lista/busca | dono | texto, filtros | clientes | — |
| action upsertClient / upsertPet / addClientNote | CRUD; geocodifica endereço (Places/Geocoding) | dono | campos | registro | — |
| action upsertVaccine | data, validade, anexo | dono | campos + arquivo | vaccine | — |
| POST /api/import/csv | importa clientes+pets (export do MoeGo ou planilha), prévia antes de gravar, dedupe por telefone | dono | arquivo CSV, mapeamento de colunas | relatório: criados, mesclados, erros | migração |

### F07/F15 SMS

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /app/messages, /app/messages/[clientId] | inbox e conversa | dono | — | threads | F15 |
| action sendSms | envia texto livre; bloqueia se opt-out | dono | client_id, body | message | F15 |
| action upsertTemplate | edita templates e horário do lembrete | dono | trigger, body, offset_days, send_at_time | template | F13 |
| POST /api/twilio/inbound | SMS recebido: grava, liga ao cliente pelo telefone; Y/C confirma, N cancela (próximo agendamento com lembrete enviado); STOP/START atualiza opt-out | Twilio (assinatura) | form Twilio | TwiML vazio | F07 |
| POST /api/twilio/status | status de entrega | Twilio (assinatura) | MessageSid, status | 200 | F07 |

### F01/F02/F03/F11 Agendamento online e portal

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /book/[slug] | página do negócio, serviços | público | — | página | F01 |
| POST /api/portal/otp/start | envia código (Twilio Verify), rate limit por telefone e IP | público | phone | ok | F01 |
| POST /api/portal/otp/check | valida código; cria sessão; diz se é cliente novo | público | phone, code | sessão, is_new | F01 |
| action portalUpsertProfile / portalUpsertPet | dados, endereço (checa ZIP na área), pets, consentimento SMS | cliente | campos | perfil | F01 |
| GET /api/portal/slots | slots livres que cabem na rota e na área do dia | cliente | pet_ids, service_ids, mês | [{date, times[]}] | F01 |
| action portalRequestBooking | cria `requested` (ou `unconfirmed` se aprovação desligada); revalida slot dentro da transação | cliente | slot, pets, serviços, respostas | appointment | F01 |
| GET /app/requests | pedidos e fila de espera | dono | — | lista | F03 |
| action decideRequest | aceitar / recusar / fila → SMS automático | dono | id, decision | appointment | F03 |
| GET /portal, action portalCancel | meus agendamentos; cancelar até `cancellation_hours` | cliente | id | appointment | F11 |

### Configurações (F13)

`action updateBusiness`, `upsertService` (+ faixas de peso), `setWorkingHours`, `addTimeOff`,
`setRouteRules` (início/fim da van, limite de minutos/milhas), `upsertServiceArea` (ZIPs + dias),
`upsertPetCode`. Todos: dono.

### Webhooks e jobs

Webhooks in: Twilio inbound SMS, Twilio status callback (ambos verificam `X-Twilio-Signature`).
Webhooks out: nenhum.
Jobs:
- `GET /api/cron/reminders` a cada 5 min (Vercel Cron, header secreto): pega `scheduled_messages`
  pendentes com `send_at <= now()`, `select ... for update skip locked`, envia, marca `sent`.
  Pula se o agendamento foi cancelado ou o cliente fez opt-out.
- Ao criar/remarcar/cancelar agendamento: recalcula as linhas de `scheduled_messages` dele.
- `GET /api/cron/daily` às 06:00 PT: resumo do dia para o dono (opcional), vacinas vencendo.

## The parts that bite

- **time zones**: tudo salvo em UTC; slots gerados no fuso do negócio com `America/Los_Angeles`
  (Temporal/date-fns-tz). Testes nos dias de troca de horário (1º dom. de nov., 2º dom. de mar.).
  "Lembrete 1 dia antes às 10:00" é 10:00 hora local, não UTC.
- **SMS nos EUA (maior risco de prazo)**: número local precisa de **registro A2P 10DLC**
  (marca + campanha) na Twilio antes de enviar; aprovação leva de dias a semanas. Começar já.
  Consentimento TCPA gravado (`sms_consent_at`), STOP/HELP respeitados, mensagens só transacionais.
- **idempotência**: webhooks do Twilio chegam repetidos → `twilio_sid unique`; cron que roda
  duas vezes → `skip locked` + status; duplo clique no "agendar" → constraint de sobreposição.
- **races**: dois clientes no mesmo slot → `no_double_booking` no banco + revalidação na transação.
- **custo/limites do Google Maps**: cache de lat/lng no cliente e no agendamento; matriz de
  distância só entre as paradas do dia (poucas dezenas de elementos). Chave restrita por domínio
  e por API; alerta de cobrança no Google Cloud. Um negócio com uma van deve ficar no nível grátis/baixo.
- **Smart Scheduling**: para cada slot candidato, tempo de direção parada-anterior → novo → próxima
  (e saída/volta da van). Calcular com a matriz do dia, não uma chamada por slot.
- **Y/N ambíguo**: cliente com dois agendamentos futuros → aplica ao próximo que recebeu lembrete;
  qualquer outra resposta vai para o inbox, sem automação.
- **arquivos**: fotos redimensionadas no navegador antes do upload (iPhone manda 4–8 MB); limite 10 MB.
- **offline**: van em área sem sinal → o PWA guarda a agenda do dia em cache para leitura;
  escritas exigem conexão (MVP).
- **privacidade (CCPA)**: dados só do negócio; exportar e apagar cliente sob pedido; nenhum
  dado vendido/compartilhado. Política de privacidade e termos na página de agendamento.
- **impostos**: serviço de grooming normalmente não tem sales tax na Califórnia, produtos sim;
  `tax_cents` começa em 0. Confirmar com o contador.

## Build order

Cada marco termina usável no dia a dia.

1. **Vertical slice — "um dia de trabalho"**
   Login do dono → cadastrar serviço → cadastrar cliente + pet (endereço com autocomplete) →
   agendar → ver no calendário do dia e no mapa → Direções no Google Maps → concluir →
   registrar pagamento (Venmo) com gorjeta.
   Telas: S01, S04 (dia), S05, S06, S02/S03, S09–S11, S13, S18.
   Tabelas: businesses, staff, working_hours, clients, pets, services, appointments,
   appointment_pets, appointment_services, invoices, invoice_items, payments.
   Rotas: createAppointment, setAppointmentStatus, upsertClient/Pet, upsertService,
   openInvoice, recordPayment, /app/today.

2. **Must-haves para cancelar o MoeGo**
   - 2a agenda completa: semana/lista, recorrência (S07), agendar de novo, notas, códigos, vacinas (S12), folgas
   - 2b **importação CSV** dos dados do MoeGo (clientes, pets, próximos agendamentos)
   - 2c **SMS**: templates (S20), lembrete + Y/N, mensagens automáticas, "a caminho", inbox (S15), STOP
   - 2d rota: início/fim da van (S19), tempo entre paradas, otimizar ordem do dia
   - 2e **agendamento online** (S30–S35, S38–S39): login por SMS, cliente novo, slots que cabem
     na rota e na área por ZIP, aprovação do dono (S08), cancelamento pelo portal
   → aqui dá para **cancelar o MoeGo**.

3. **Should-haves**: contrato com assinatura online (S36), relatório de grooming com fotos
   (S14, S42), perguntas no booking, preço por faixa de peso, limite de pets por dia, fila de espera,
   dashboard (S16), arrastar no calendário, visão mês.

4. **Could-haves**: intake form (S41/S21), pacotes, cartão via Stripe (sinal, cartão salvo),
   pedido de avaliação no Google, filtro inteligente, relatório de gorjetas.

5. **Fixes do /replica-entrepreneur** (quando rodar) e as melhorias que o dono pedir ao testar a rota.

## O que o dono precisa providenciar (contas próprias, chaves só em `.env.local`)

| conta | para quê | quando |
| --- | --- | --- |
| Twilio + registro **A2P 10DLC** | SMS | **agora** (aprovação demora) |
| Google Cloud + chave Maps Platform com faturamento | mapa, endereços, rota | antes do marco 1 |
| Supabase ou Neon | banco (e arquivos no Supabase Storage) | marco 1 |
| Vercel | hospedagem | marco 1 |
| domínio (ex. `book.seunegocio.com`) | página de agendamento | marco 2e |
| export do MoeGo (clientes, pets, agendamentos) | migração | antes de cancelar |


## Mudança de 2026-10-18: custo zero

Pedido do dono: não gastar nada. Substituições feitas:

| antes | agora | por quê |
| --- | --- | --- |
| Twilio SMS + Verify | SMS enviados pelo iPhone do dono (Atalhos busca `/api/device/outbox`) | a linha AT&T já existe; Twilio custaria ~$5–15/mês |
| resposta Y/N por SMS | link `/a/<token>` com Confirmar / Cancelar | o app não lê as mensagens do iPhone |
| login do cliente por SMS | pedido sem login, casado pelo telefone, aprovado pelo dono | sem SMS pago; a aprovação segura abuso |
| Google Routes API | distância em linha reta entre centros de ZIP (dados públicos) | grátis, previsível, poucas falhas |
| Resend | Gmail da empresa com senha de app | grátis |
| Vercel Cron | GitHub Actions de hora em hora (ou cron da Hostinger) | grátis |
| Vercel | Netlify Free + Neon Free | Vercel grátis não permite uso comercial; o plano Premium da Hostinger não roda Node.js |
| sincronizar Google Calendar | feed ICS assinado no Google Calendar | grátis, sem OAuth; atualiza em poucas horas |
