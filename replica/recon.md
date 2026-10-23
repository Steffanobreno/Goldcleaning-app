# Recon map: MoeGo – Pet Business Suite (iOS/Android app do dono + web do cliente)

Escopo: tudo o que um negócio de **grooming móvel com um dono/uma van** usa no MoeGo:
app do dono (agenda, mapa/rota, clientes e pets, checkout, mensagens, relatórios)
e portal web do cliente (agendamento online, perfil, pets, vacinas, contrato, cartão).
Ficam de fora os módulos de hotel/creche/adestramento, multi-unidade e varejo (ver "Fora do escopo").

Para: o próprio negócio do usuário (grooming móvel na **Califórnia, EUA**). Uso interno, não para revenda.
Data: 2026-10-17 (atualizado 2026-10-18)

Operação real (informada pelo usuário em 2026-10-18):
- pagamentos: **Cash, Zelle, cheque, Venmo** — registrados manualmente, sem processar cartão
- contato com o cliente: **só SMS**
- navegação/rota: **Google Maps**
- fuso America/Los_Angeles, moeda USD, inglês para o cliente
- objetivo: um MVP básico o quanto antes para cancelar a assinatura do MoeGo

> **Termos de uso.** Os Termos do MoeGo proíbem acessar os Serviços para
> "(i) build a competitive product or service; or (ii) copy any ideas, features,
> functions" e proíbem engenharia reversa. Por isso este mapa foi feito **só com
> fontes públicas** (central de ajuda, wiki, blog, páginas de marketing, reviews).
> A conta do usuário **não** foi usada e credenciais não devem ser compartilhadas.
> Funcionalidades em si (agenda, lembretes, rota) são padrões de mercado; o clone
> deve ser escrito do zero, com nome, textos e visual próprios.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | app store listing | https://apps.apple.com/us/app/moego-pet-business-suite/id1561621817 | Moement, Inc.; nota ~4.6; booking, leads, agenda, pagamentos, mensagens, KPI; seção móvel com rota e mapa. Não foi possível abrir a página diretamente (só via busca) |
| 2 | google play | https://play.google.com/store/apps/details?id=com.moement.moego.business | mesmo app |
| 3 | marketing – grooming móvel | https://www.moego.pet/mobile-grooming | limite de distância/tempo, sugestão de rota e horários, regras por van |
| 4 | marketing – agendamento online | https://www.moego.pet/online-booking | limites por horário/dia, regras por raça/porte/serviço, aprovação final do dono |
| 5 | marketing – portal do cliente | https://www.moego.pet/pet-parent-portal | |
| 6 | marketing – pagamentos | https://www.moego.pet/payment-pos | MoeGo Pay |
| 7 | FAQ | https://www.moego.pet/faq | área de atendimento, áreas por dia |
| 8 | help – Smart Scheduling | https://help.moego.pet/en/articles/13918120-mobile-grooming-how-to-use-smart-scheduling | limites de direção, local inicial/final, áreas por dia |
| 9 | help – booking online móvel | https://help.moego.pet/en/articles/11116739-online-booking-mobile-grooming-setup | |
| 10 | help – mapa (app) | https://help.moego.pet/en/articles/13979478-mobile-grooming-map-view-on-app | mapa é a tela inicial; cards; Contato/ETA; Direções; En Route |
| 11 | help – mapa (desktop) | https://help.moego.pet/en/articles/13977003-mobile-grooming-map-view-on-desktop | ordem numerada da rota |
| 12 | help – tempo/distância | https://help.moego.pet/en/articles/13979235-mobile-grooming-display-driving-time-distance | toggle no mapa/calendário; estimativa média |
| 13 | help – criar agendamento | https://help.moego.pet/en/articles/14008185-grooming-appointment-create-new | |
| 14 | help – repetir agendamento | https://help.moego.pet/en/articles/14039245-repeat-appointment | dias/semanas/meses, fim por nº ou data, máx 100, conflitos |
| 15 | help – agendar de novo | https://help.moego.pet/en/articles/14008181-appointment-book-again | copia pet/serviço |
| 16 | help – portal do cliente | https://help.moego.pet/en/articles/14075819-pet-parent-portal-overview | login por SMS (OTP); número desconhecido → fluxo de cliente novo |
| 17 | help – compartilhar portal | https://www.moego.pet/help/en/articles/14075822-share-pet-parent-portal-web-with-your-clients | |
| 18 | help – compliance booking/intake | https://help.moego.pet/en/articles/12913719-compliance-in-online-booking-and-intake-forms | consentimento de marketing |
| 19 | help – perguntas do booking | https://help.moego.pet/en/articles/12642776-online-booking-questions-setting | peso/pelagem só leitura, limite de peso |
| 20 | help – cartão salvo | https://help.moego.pet/en/articles/12839195-moego-pay-card-on-file | link por SMS; 3DS |
| 21 | wiki – pré-pagamento/sinal | https://wiki.moego.pet/moego-prepayment/ | valor retido, capturado ao aceitar; pré-autorização 24h antes |
| 22 | wiki – pagamentos no booking | https://wiki.moego.pet/online-booking-payments/ | regras por grupo de cliente |
| 23 | help – mensagens automáticas | https://help.moego.pet/en/articles/11394911-communication-set-up-auto-messages-reminders-and-replies | templates SMS/e-mail, variáveis, gatilhos |
| 24 | help – 3 tipos de lembrete | https://help.moego.pet/en/articles/11403244-communication-3-types-of-appointment-reminders | resposta Y/N; ligação 1/2 |
| 25 | help – perfil do pet | https://help.moego.pet/en/articles/14133911-pet-profile-overview | |
| 26 | help – FAQ pet | https://help.moego.pet/en/articles/14133919-pet-profile-faq | códigos ≤8 caracteres; vet por pet |
| 27 | help – vacinas | https://help.moego.pet/en/articles/14092060-how-to-manage-vaccine-records-on-a-pet-profile | data, validade, anexo, alerta |
| 28 | help – códigos de pet | https://help.moego.pet/en/articles/12845392-pet-codes | |
| 29 | help – notas | https://help.moego.pet/en/articles/14038274-manage-appointment-client-pet-notes | |
| 30 | help – filtro inteligente | https://help.moego.pet/en/articles/13172706-client-pet-list-smart-filter | |
| 31 | help – criar cliente | https://help.moego.pet/en/articles/14133607-how-to-create-a-client-profile | |
| 32 | help – fatura: ciclo | https://help.moego.pet/en/articles/13558659-smarter-invoice-payment-invoice-lifecycle | Estimate → Open → Closed |
| 33 | help – checkout (app) | https://help.moego.pet/en/articles/13557797-smarter-invoice-payment-take-payment-at-checkout-app | gorjeta |
| 34 | help – pacotes | https://help.moego.pet/en/articles/11381640-moego-package-beta-overview | créditos pré-pagos, validade |
| 35 | help – benefícios | https://help.moego.pet/en/articles/12708272-smarter-invoice-payment-stack-benefits | ordem pacote → assinatura → desconto → crédito → imposto |
| 36 | help – pagamento em lote | https://help.moego.pet/en/articles/13558882-smarter-invoice-payment-bulk-payment | |
| 37 | help – intake form | https://help.moego.pet/en/articles/11116728-setting-up-your-intake-forms | link público, contrato, cartão, fila de espera |
| 38 | wiki – relatório de grooming | https://wiki.moego.pet/grooming-report | fotos antes/depois, rascunho, prévia, link por SMS/e-mail |
| 39 | help – payroll | https://help.moego.pet/en/articles/11825456-moego-insights-payroll-report | comissão, gorjeta, horas |
| 40 | reviews/preços | https://groomboard.com/answers/how-much-does-moego-cost | US$49–159/mês por van; rota e waitlist a partir do Growth |
| 41 | review | https://petgroomerhub.com/blog/moego-review/ | calendário drag-and-drop, cores, visões dia/semana/mês/lista |
| 42 | termos | https://www.moego.pet/Html5/termsAndConditions.html | cláusula anti-concorrência (ver aviso acima) |

Screenshots: nenhuma salva. A página da App Store não abriu deste ambiente.
Se quiser, salve em `replica/screens/` prints **públicos** da App Store/Play
(só referência de layout, nunca vão para o clone).

## Core loop

O cliente agenda sozinho pelo link web um horário que **cabe na rota da van**;
o dono recebe, aceita, é lembrado, dirige até lá na ordem certa, faz o banho/tosa,
cobra com gorjeta e manda o relatório com fotos — e o próximo horário já fica marcado.

## Screens

### App do dono (mobile)

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Login | abrir o app | entrar | input, botão | vazio, erro |
| S02 | Mapa do dia (home) | tela inicial | ver paradas do dia no mapa | mapa, pins numerados, carrossel de cards, seletor de data, toggle tempo/distância | vazio (sem agenda), cheio, sem GPS |
| S03 | Card de parada / ações | toque num card do S02 | agir na parada | card de agendamento, botões Contato, Direções, En Route | hoje, não-hoje (sem En Route) |
| S04 | Calendário | aba Agenda | ver/arrastar agendamentos | visões dia/semana/mês/lista, blocos coloridos por status/serviço, alertas de vacina, códigos do pet | vazio, cheio, conflito |
| S05 | Novo agendamento | botão + no S04/S02 | criar | busca de cliente, seletor de pet, serviços/add-ons, data/hora, sugestões do Smart Scheduling, repetir | sem cliente, sem slot, conflito |
| S06 | Detalhe do agendamento | toque num bloco | ver/editar/mudar status | status, pets, serviços, notas, preço, histórico, botões confirmar/cancelar/check-in/checkout/agendar de novo | não confirmado, confirmado, em andamento, concluído, cancelado, no-show |
| S07 | Repetir agendamento | no S05/S06 | criar série | frequência, dia da semana, fim (nº/data), prévia com conflitos | conflito, limite 100 |
| S08 | Pedidos online / fila de espera | aba Pedidos | aceitar/recusar/espera | lista de pedidos, aceitar, recusar, mover p/ fila | vazio, com pedidos |
| S09 | Lista de clientes | aba Clientes | buscar | busca, filtro inteligente, lista | vazio, sem resultado |
| S10 | Perfil do cliente | toque na lista | dados do cliente | contato, endereço (mapa), pets, notas com autor/data, histórico, cartão salvo, preferências de mensagem | sem pets, sem cartão |
| S11 | Perfil do pet | toque no pet | dados do pet | abas Perfil (raça, idade, peso, pelagem, comportamento, vet, notas), Vacinas, Histórico; códigos | vacina vencida, sem vacina |
| S12 | Vacina | aba do S11 | registrar | data, validade, anexo foto/PDF, toggle alerta | vencida, a vencer |
| S13 | Checkout / fatura | S06 → Checkout | cobrar | itens, desconto, pacote/crédito, gorjeta, método (cartão, dinheiro, outro), recibo | estimativa, aberta, paga/fechada, saldo pendente |
| S14 | Relatório de grooming | S06 → Relatório | enviar ao cliente | fotos antes/depois, checklist de condição, comentários, prévia, enviar | rascunho, enviado |
| S15 | Mensagens (inbox) | aba Mensagens | conversar | lista de conversas, chat, templates, envio de ETA | vazio, não lidas, opt-out |
| S16 | Insights / relatórios | aba Insights | ver o negócio | KPIs (faturamento, nº atendimentos, ticket), payroll (comissão, gorjetas, horas) | período vazio |
| S17 | Configurações | menu | ajustar | negócio, serviços e preços, horário de trabalho, área de atendimento, regras de rota, booking online, mensagens automáticas, pagamentos, equipe | — |
| S18 | Serviços e preços | S17 | catálogo | serviço, duração, preço por porte/raça/peso, add-ons | vazio |
| S19 | Regras de rota / área | S17 | grooming móvel | local inicial/final, distância e tempo máximos, áreas por dia da semana | sem endereço |
| S20 | Templates de mensagem | S17 | automações | lembrete (enviar X dias antes às HH:MM), confirmação, cancelamento, agradecimento, variáveis | — |
| S21 | Intake forms (submissões) | menu | leads | lista Lida/Não lida/Adicionado, criar ou mesclar cliente, enviar p/ fila | vazio |

### Web do cliente (portal / agendamento online)

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S30 | Página do negócio / início | link do negócio | começar | logo, sobre, botão Agendar | — |
| S31 | Login por telefone | S30 | identificar | telefone, código SMS (OTP) | código errado, número novo → S32 |
| S32 | Cadastro de cliente novo | número não encontrado | novos dados | nome, e-mail, endereço (validação de área), consentimento marketing | fora da área |
| S33 | Pets do cliente | após login/cadastro | escolher/adicionar pet | lista de pets, formulário (raça, peso, pelagem), vacinas | peso acima do limite, vacina faltando |
| S34 | Escolher serviço | | escolher | serviços e add-ons com preço/duração, regras por raça/porte | serviço indisponível p/ o porte |
| S35 | Escolher data e hora | | escolher slot | calendário de dias, slots (filtrados por rota/área) | sem disponibilidade, dia fora da área |
| S36 | Perguntas e contrato | | compliance | perguntas personalizadas, contrato com assinatura | não assinado |
| S37 | Pagamento | se exigido | garantia | cartão salvo / sinal / pré-autorização | cartão recusado, 3DS |
| S38 | Pedido enviado | | confirmação | resumo, "aguardando aprovação" | aceito, recusado, fila |
| S39 | Portal: meus agendamentos | após login | gerenciar | próximos/passados, cancelar/remarcar, relatórios de grooming | vazio |
| S40 | Portal: perfil e pets | | atualizar | dados, endereço, pets, upload de vacina | — |
| S41 | Intake form público | link avulso | captar lead | perguntas, contrato, cartão | enviado |
| S42 | Relatório de grooming (link) | link SMS/e-mail | ver resultado | fotos antes/depois, comentários, botão reagendar/avaliar | — |

Total: 33 telas (21 dono + 12 cliente).

## Flows

```
F01 Cliente novo agenda online
    S30 -> S31 -> S32 -> S33 -> S34 -> S35 -> S36 -> S37 -> S38
    happy path clicks: ~12
    edge: endereço fora da área; nenhum slot cabe na rota; peso acima do limite;
          vacina vencida; cartão recusado/3DS; slot tomado durante o preenchimento

F02 Cliente recorrente agenda online
    S30 -> S31 -> S33 -> S34 -> S35 -> S38
    happy path clicks: ~7
    edge: pet novo no meio; mudou de endereço (re-checar área); contrato atualizado

F03 Dono aprova pedido online
    notificação -> S08 -> S06 (aceitar | recusar | fila de espera)
    happy path clicks: 2
    edge: sinal capturado só ao aceitar; recusa devolve o valor retido

F04 Dono cria agendamento por telefone/WhatsApp
    S04/S02 -> S05 (cliente, pet, serviço, sugestão de slot) -> salvar
    happy path clicks: ~6
    edge: cliente novo (criar inline); conflito; fora do horário de trabalho

F05 Agendamento recorrente
    S05/S06 -> S07 (a cada N semanas, até data) -> prévia -> salvar
    edge: conflitos na prévia; editar só este / este e próximos / toda a série

F06 Dia de trabalho na van
    S02 (rota do dia) -> S03 Contato -> Enviar ETA -> Direções (Maps/Waze) -> chegar
    -> S06 check-in -> serviço -> S14 relatório -> S13 checkout -> próxima parada
    edge: atraso (re-enviar ETA); cliente ausente (no-show); cancelamento no dia

F07 Lembrete e confirmação automática
    agendado -> lembrete X dias antes às HH:MM -> cliente responde S/N
    -> status confirmado | cancelado -> mensagem automática
    edge: cliente fez opt-out; resposta não reconhecida (vai pro inbox S15)

F08 Checkout com gorjeta
    S06 -> S13 (itens, desconto, pacote) -> gorjeta -> método -> recibo
    happy path clicks: ~4
    edge: pagamento parcial (saldo pendente); dinheiro/Pix; fatura fechada não edita

F09 Relatório de grooming
    S06 -> S14 (fotos antes/depois, condição, comentário) -> prévia -> enviar
    -> cliente abre S42 -> "agendar de novo"

F10 Agendar de novo
    S06 (concluído) -> Agendar de novo -> S05 pré-preenchido -> ajustar data -> salvar

F11 Cliente gerencia pelo portal
    S31 -> S39 -> cancelar/remarcar ; S40 -> subir vacina
    edge: janela mínima de cancelamento (guess)

F12 Lead pelo intake form
    S41 -> S21 -> criar/mesclar cliente -> fila de espera ou S05

F13 Configurar o negócio (primeira vez)
    S17 -> S18 serviços -> horário -> S19 rota/área -> booking online -> S20 templates -> pagamentos

F14 Ver o mês
    S16 -> período -> faturamento, atendimentos, gorjetas
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, icon | default, pressed, disabled, loading | todas |
| Input / textarea | texto, telefone (máscara BR), e-mail, moeda, número | default, focus, erro, disabled | S05, S10–S12, S17–S20, S31–S37 |
| OTP input | 6 dígitos | digitando, erro, reenviar (timer) | S01, S31 |
| Select / combobox | simples, busca (cliente, raça) | aberto, vazio, sem resultado | S05, S11, S33 |
| Date picker | dia, intervalo | dias desabilitados (fora da área) | S05, S07, S35 |
| Time slot grid | | disponível, selecionado, esgotado | S05, S35 |
| Calendar | dia, semana, mês, lista | arrastar, conflito, agora (linha) | S04 |
| Appointment block/card | calendário, mapa, lista | por status (cores), alerta vacina, códigos do pet | S02–S04, S08, S39 |
| Status badge | não confirmado, confirmado, a caminho, em andamento, concluído, cancelado, no-show | | S04, S06, S39 |
| Map + pins | numerados, pin "eu" (posição) | selecionado, sem GPS | S02, S10, S19 |
| Route list | paradas com tempo/distância entre elas | toggle on/off | S02 |
| Pet code chip | ≤ 8 caracteres, cor | | S03, S04, S11 |
| Pet card | | vacina ok/vencida | S10, S33 |
| Service item | com add-ons, preço por porte | selecionado | S05, S34, S18 |
| Line item / invoice table | serviço, add-on, desconto, gorjeta, total | estimativa, aberta, fechada | S13 |
| Tip selector | % presets, valor livre, sem gorjeta | | S13 |
| Photo uploader | antes/depois, múltiplas | enviando, erro | S12, S14, S40 |
| Signature pad | | vazio, assinado | S36, S41 |
| Card form | | validando, 3DS, recusado | S37, S41 |
| Chat bubble / thread | enviada, recebida, automática | enviando, falhou | S15 |
| Template editor | com inserção de variáveis | | S20 |
| Modal / bottom sheet | confirmação, ações | | S03, S06 |
| Toast | sucesso, erro | | todas |
| Empty state | por tela | | S02, S04, S08, S09, S15, S21, S39 |
| Tab bar (app) | Mapa, Agenda, Clientes, Mensagens, Mais | badge de não lidas | app |
| Stepper (web) | passos do booking | atual, feito | S31–S38 |
| KPI tile | valor, variação | | S16 |

## Inferred data model

```
Business      id, name, logo_url, phone, timezone, currency, booking_slug,
              mobile_grooming (bool), cancellation_policy
              evidence: S17, S30 · confidence: high

Staff         id, business_id, name, role (owner|groomer), color,
              commission_rate, hourly_rate
              evidence: S16 payroll, S04 cores · confidence: medium (1 pessoa hoje)

Van           id, business_id, name, staff_id
              evidence: "regras por van" (fonte 3) · confidence: medium

WorkingHours  id, staff_id, weekday, start_time, end_time
              evidence: conflito "non-working hours" (fonte 14) · confidence: high

RouteRule     id, staff_id, start_address, start_lat, start_lng,
              end_address?, end_lat?, end_lng?, max_drive_minutes, max_drive_km,
              smart_scheduling_enabled
              evidence: fonte 8 · confidence: high

ServiceArea   id, business_id, name, polygon | zip_codes, weekdays[], staff_id
              evidence: fonte 7, 8 ("Área X seg/qua/sex") · confidence: medium (forma do polígono é guess)

Client        id, business_id, first_name, last_name, phone, email, address,
              lat, lng, marketing_opt_in, sms_opt_out, email_opt_out,
              card_on_file_ref?, source (online|manual|intake), created_at
              evidence: S10, S32, fonte 18, 20 · confidence: high

ClientNote    id, client_id, staff_id, body, created_at
              evidence: fonte 29 · confidence: high

Pet           id, client_id, name, species, breed, birth_date|age, weight,
              coat_type, gender, fixed?, behavior, vet_name, vet_phone,
              notes, photo_url, deceased?
              evidence: S11, fonte 25, 26 · confidence: high

PetCode       id, business_id, label (≤8), color ; PetPetCode (pet_id, code_id)
              evidence: fonte 26, 28 · confidence: high

Vaccine       id, pet_id, name, given_on, expires_on, file_url, alert_enabled
              evidence: fonte 27 · confidence: high

Service       id, business_id, name, kind (service|addon), duration_min,
              base_price, active, online_bookable
              evidence: S18, S34 · confidence: high

ServicePrice  id, service_id, size|breed|weight_min..max|coat_type, price, duration_min
              evidence: "regras por raça, porte ou serviço" (fonte 4) · confidence: medium

Appointment   id, business_id, client_id, staff_id, start_at, end_at,
              status (requested|unconfirmed|confirmed|en_route|in_progress|
                      completed|cancelled|no_show|waitlist),
              source (online|manual), series_id?, address, lat, lng,
              drive_minutes_from_prev?, notes, created_at
              evidence: S04, S06, S08, fontes 13, 24 · confidence: high (nomes dos status: medium)

AppointmentPet  id, appointment_id, pet_id
AppointmentService id, appointment_pet_id, service_id, price, duration_min
              evidence: multi-pet por agendamento (S05, fonte 38 "for a specific pet") · confidence: medium

RecurringSeries id, rule (freq, interval, weekday), ends_on? , count?
              evidence: fonte 14 · confidence: high

BookingRequestAnswer id, appointment_id, question_id, answer
BookingQuestion id, business_id, label, type, required, applies_to (client|pet)
              evidence: fonte 19 · confidence: medium

Agreement     id, business_id, title, body, version, required_for (online|all)
AgreementSignature id, agreement_id, client_id, signed_at, signature_image_url
              evidence: S36, fonte 16, 37 · confidence: medium

Invoice       id, appointment_id?, client_id, status (estimate|open|closed),
              subtotal, discount, tax, tip, total, paid, balance
InvoiceItem   id, invoice_id, kind (service|addon|product|package|discount), description, amount
Payment       id, invoice_id, method (card|cash|pix|other), amount, tip, status,
              provider_ref, captured_at
              evidence: fontes 32, 33, 36 · confidence: high

Deposit       id, appointment_id, amount, status (held|captured|refunded), provider_ref
              evidence: fonte 21 · confidence: high

Package       id, business_id, name, price, valid_days, items (service_id, qty)
ClientPackage id, client_id, package_id, remaining (json), expires_on
              evidence: fonte 34 · confidence: medium

GroomingReport id, appointment_id, pet_id, status (draft|sent), before_photos[],
              after_photos[], condition_checklist (json), comment, sent_at, public_token
              evidence: fonte 38 · confidence: high

MessageTemplate id, business_id, trigger (reminder|confirmed|cancelled|booked|
              thank_you|report|eta), channel (sms|email|whatsapp?), offset_days,
              send_at_time, body
              evidence: fontes 23, 24 · confidence: high

Message       id, business_id, client_id, direction (in|out), channel, body,
              template_id?, status, created_at
              evidence: S15 · confidence: high

IntakeSubmission id, business_id, payload (json), status (unread|read|added), client_id?
              evidence: fonte 37 · confidence: high

LocationPing  id, staff_id, lat, lng, at   (só para "En Route"/ETA)
              evidence: fonte 10 · confidence: medium
```

Relationships: Business 1-n Staff, Staff 1-1 Van, Staff 1-1 RouteRule, Business 1-n ServiceArea;
Business 1-n Client, Client 1-n Pet, Pet 1-n Vaccine, Pet n-n PetCode;
Appointment n-1 Client, Appointment 1-n AppointmentPet 1-n AppointmentService n-1 Service;
Appointment n-1 RecurringSeries; Appointment 1-1 Invoice 1-n Payment; Appointment 0-1 Deposit;
Appointment 1-n GroomingReport (um por pet); Client 1-n Message; Client 1-n AgreementSignature.

## Feature matrix

See `features.csv`. 99 linhas. Must: 44, should: 23, could: 18, skip: 14. Dados do negócio em `business.md`.

## Out of scope (cannot or should not be cloned)

- **Marca, textos, logos, ícones, ilustrações e telas do MoeGo** — o clone tem identidade própria (`/replica-brand`).
- **Processamento de pagamento próprio (MoeGo Pay)** e terminais físicos — o negócio recebe em Cash/Zelle/cheque/Venmo; o clone só registra. Stripe fica como opção futura.
- **Número de telefone "branded" e infraestrutura de SMS/ligação** — usar Twilio com número próprio (registro A2P 10DLC).
- **App de cliente nas lojas (Pet Parent App)** — o cliente usa a versão web, como o usuário já faz.
- **Módulos de hotel, creche, adestramento/turmas, multi-unidade, varejo e gerente de conta** — não fazem parte de um negócio de grooming móvel.
- **Dados que ficam no MoeGo** — exportar clientes/pets/histórico pelo que o próprio MoeGo permitir (CSV/relatórios) e importar no clone; não extrair por scraping.

## Size

Telas 33, fluxos 14, entidades ~25.
Partes difíceis:
1. **Smart Scheduling** — calcular, para cada slot, o tempo de direção até a parada anterior e a próxima (API de rotas/matriz de distâncias), com áreas por dia e limites; e reordenar o dia.
2. **Pagamentos** — sinal retido e capturado ao aceitar, cartão salvo, gorjeta, Pix; estados da fatura.
3. **SMS bidirecional** — lembretes agendados, resposta Y/N que muda o status, STOP/HELP; nos EUA o número precisa de registro A2P 10DLC antes de enviar.

Outras: mapa com localização ao vivo (En Route/ETA), séries recorrentes com exceções,
upload de fotos/PDF, app instalável (PWA) para o dono.

Tamanho: **L** (um trimestre) para o escopo acima. Recomendação: construir em fatias —
1) agenda + clientes/pets + booking online simples (M);
2) rota/área + lembretes (M);
3) pagamentos, relatório de grooming, pacotes, relatórios (M).
Sem promessa de clone perfeito.
