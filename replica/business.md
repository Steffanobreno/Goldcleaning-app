# Woofers Dog Spa — dados do negócio (seed do app)

Fonte: o próprio dono (prints da configuração dele, 2026-10-18) e woofersdogspa.com.
Sem dados de clientes aqui. Prints do app antigo não ficam no repositório.

## Negócio

- Nome: Woofers Dog Spa — grooming móvel, San Francisco Bay Area, desde 2017
- Site: https://woofersdogspa.com · e-mail: contact@woofersdogspa.com
- Telefone do negócio: **(650) 480-0599** (linha AT&T no iPhone do dono; os SMS saem dele)
- Link de review do Google: https://g.page/r/CQs7lH-SjO5jEAE/review
- Fuso: America/Los_Angeles · moeda: USD
- Pagamentos: Cash, Zelle, cheque, Venmo · contato: só SMS · navegação: Google Maps

## Horário (editável no app)

Segunda a sábado, 07:00–19:00. Domingo fechado.

## Serviços (editáveis no app)

Tamanho = altura do pet: Small ≤ 12", Medium 12"–16", Large 16"–20", X-Large 20"+.

| categoria | serviço | tamanho | duração | preço |
| --- | --- | --- | --- | --- |
| Haircut + Bath | Full Haircut Service - Small (12" or less) | small | 120 min | $129 |
| Haircut + Bath | Full Haircut Service - Medium (12"-16") | medium | 120 min | $149 |
| Haircut + Bath | Full Haircut Service - Large (16"-20") | large | 120 min | $179 |
| Haircut + Bath | Full Haircut Service - X-Large (20" or up) | xlarge | 180 min | $199 |
| Bath | Bath - Small (12" or less) | small | 120 min | $99 |
| Bath | Bath - Medium (12"-16") | medium | 120 min | $109 |
| Bath | Bath - Large (16"-20") | large | 120 min | $129 |
| Bath | Bath - X-Large (20" or up) | xlarge | 120 min | $149 |

Add-ons:

| add-on | duração | preço |
| --- | --- | --- |
| Nail (included all packs) | 0 | $0 |
| Dematting or Shave Down Fee | 0 | $45 |
| De-Shedding | 0 | $45 |
| Nail painting | 0 | $15 |
| Sensitive Care Shampoo | 0 | $20 |
| Flea Treatment Bath | 0 | $20 |
| Hypoallergenic Fragrance Free Shampoo | 0 | $15 |
| Skunk Off | 180 min | $280 |

Confirmado pelo dono: não há mais add-ons nem "Service Charges".

## Mensagens SMS (textos do dono)

| quando | texto |
| --- | --- |
| ao agendar | From {storeName}, {customerName}, your appointment is booked for {date} {time}. |
| 1º lembrete: 2 dias antes, 10:00, só se não confirmado | From {storeName}, {customerName}, your next appointment is coming at {date} {time}. Please reply Y to confirm or N to cancel. *(final do texto cortado no print — confirmar)* |
| reagendar: na data esperada pela frequência do pet, 10:00 | From {storeName}, Hello {customerName}, it has been almost {days} days since {petName} last service. Would you like to book a new appointment? Book online: woofersdogspa.com or text us (650) 627-6745 |
| pedir avaliação: 30 min após o checkout | Hi! 😊🐾 It was a pleasure taking care of your pet today! We hope you loved your experience with Woofers Dog Spa. If you have a moment, your review truly means a lot to us 💙 👉 Leave your review here: https://g.page/r/CQs7lH-SjO5jEAE/review Thank you so much for your trust, and we hope to see you again soon! 🚐✨ |
| resposta à nota 5 | We are so excited that you liked our service! It would be great if you could share your great experience with us to: {Yelp}, {Facebook}, {Google} |
| resposta à nota < 5 | We are sorry that you are not 100% happy with us! Please let us know anything that we could improve so that we could do much better next time for you! Thank you! |

## Áreas atendidas (do site; o site lista cidades, não ZIPs)

- San Francisco
- San Mateo County: Redwood City, San Mateo, Menlo Park, Burlingame, Daly City, South San Francisco,
  Brisbane, Pacifica, Half Moon Bay, Moss Beach, Montara, El Granada, Millbrae, San Bruno,
  Hillsborough, Foster City
- Santa Clara County: Palo Alto, Mountain View, Sunnyvale, Cupertino, Campbell, Los Gatos, Saratoga, San Jose
- Alameda County: Oakland, Berkeley, Alameda, Piedmont, Emeryville, San Leandro, Newark, Fremont,
  Union City, Hayward
- Contra Costa: El Cerrito, Richmond, Albany, Kensington
- Marin: Mill Valley, San Rafael, Ross

O site diz 59–62 cidades; esta lista é parcial. O dono atende a área toda, todos os dias.
Regra de rota do dono: num dia que já tem clientes, os próximos ficam a no máximo **25 milhas / 45 min**
dos que já estão marcados. A van sai de San Mateo (privado, não mostrar ao cliente).

## O que os prints mostraram que o app antigo faz (funções a ter)

- notificações: pedido online, **booking abandonado** (18), formulário, contrato assinado (3),
  review recebido, pagamentos, agendamentos, **agendamentos não pagos** (4)
- página de agendamento: compartilhar link, **QR code**, ver site, ligar/desligar
- dashboard do mês: agendamentos, pets, clientes, concluídos, receita recebida, receita esperada,
  top clientes por gasto, clientes recorrentes
- Google Calendar sync, trava de segurança (PIN)
- volume atual: ~74 agendamentos e ~67 clientes por mês

## Decisões de custo (2026-10-18): nada pago

- SMS: sai do iPhone do dono (linha AT&T) por automação do app Atalhos; sem Twilio
- E-mail: Gmail da empresa (senha de app), grátis
- Google Calendar: assinatura de calendário por link (ICS), grátis
- Hospedagem: Hostinger do dono (se o plano rodar Node.js) + Postgres grátis (Neon)
- Distância: centro do ZIP code (dados públicos), sem API paga

## Configurações do app antigo (prints de 2026-10-18)

- Preferências: EUA, America/Los_Angeles, USD, MM/DD/YYYY, 12 horas, libras, milhas (o app novo já usa isso)
- Van: Ford Transit 2019. Regra de direção no app antigo: **20 milhas / 40 min**; o dono disse 25 mi / 45 min
  → o app novo usa **25 milhas** (editável em Settings → Online booking)
- Google Calendar do dono: conta Google da empresa (o endereço fica fora do repositório)
- Redes: facebook.com/woofersdogspa, instagram.com/woofersdogspa (Yelp vazio)
- Calendário do app antigo mostrava 7:00–21:00 e avisava o dono 60 min antes de cada visita
  (o feed do Google Calendar não leva alarmes; use a notificação padrão do próprio Google Calendar)
- **Contrato de serviço**: transcrito em `scripts/agreement.ts`. Pagamentos aceitos incluem **Bitcoin**;
  cancelamento: o cliente pode cancelar a qualquer momento; grátis com 48 h ou mais, depois **50% do serviço**.
  Seção 9 (Latch-Key) removida a pedido do dono.
- Lista de clientes: export de 390 clientes (não fica no repositório). 1 telefone inválido
  ("65065656565") e 3 visitas futuras que se sobrepõem a outras precisam ser ajustados à mão.

## Decisões do dono (2026-10-18, depois do import)

- Hostinger é **Premium** (sem Node.js) → app no **Netlify Free** + banco no **Neon Free**
- Visitas sobrepostas são de propósito (o dono ajusta quando termina antes) → o app só avisa; o site não deixa o cliente marcar por cima
- O cliente entra pelo **telefone**: o app reconhece, mostra os pets e usa o endereço salvo; não pede os dados de novo
- Histórico de serviços antigos não precisa vir; só clientes, telefone, endereço, pets e raça
- Sem tempo de direção entre visitas: o tempo do serviço já inclui o deslocamento (visitas uma atrás da outra)
- Vacinas: dispensável (tirado das telas)
- Foto do pet: o cliente coloca ao cadastrar; o dono também pode trocar
- Lembrete de reagendar vai por SMS pelo iPhone (Atalhos) e por e-mail
