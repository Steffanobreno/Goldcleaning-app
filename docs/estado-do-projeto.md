# Estado do projeto Gold Cleaning (para retomar rápido)

Atualizado em 01/11/2026.

## Onde está cada coisa
- **Site:** repositório `Steffanobreno/peninsulagoldcleaning` (Vite + React). Publica pelo Lovable, que puxa a `main`. Domínio peninsulagoldcleaning.com.
- **App (agendamento do cliente + painel da Amanda):** repositório `Steffanobreno/Goldcleaning-app` (Next.js 16), ramo `main` para trabalho e **`production` é o que o Netlify publica** em goldcleaning-app.netlify.app. Banco no Neon. Tabelas e dados são criados no deploy (migrações em `db/migrations`).
- **Página do cliente:** `/book`. O site abre essa página dentro de `/book-now` (iframe). A raiz do app manda quem não é da equipe para `/book`; login da equipe em `/login`.
- **Origem do código:** copiado do Woofers (`Steffanobreno/duperpower`, `production` em 22/10, commit `0208d81`). A lista de novidades do Woofers para trazer está em `docs/novidades-woofers.md`.

## Regras que valem sempre
- Falar em português. Valores para copiar vão em texto simples, nunca em imagem.
- **Nunca** escrever o número particular da Amanda em lugar nenhum (site, e-mail, fotos, documentos, mensagens de commit). Se aparecer numa foto, cobrir antes de usar. O número da empresa é (650) 434-2080 (Google Voice).
- Pagamento só depois da limpeza: Cash, Zelle ou Venmo, sem links nem usuários no site. Nada é cobrado online. Sem menção a entrada ou 50%.
- Comunicação com o cliente **só por e-mail**; ligação e mensagem de texto são feitas à mão.
- Não falar de máquina de pressão nem de organização de despensa como serviço do site (o cliente pergunta por e-mail).
- A string de conexão do banco (Neon) nunca vai em conversa, e `.env.local` nunca entra no Git.
- Publicar o app (empurrar para `production`) e juntar PR do site só com autorização de quem pediu.
- Endereço postal dos e-mails: 1201 Monte Diablo Ave, San Mateo, CA 94401.

## Preços (tabela única, igual no app e em `src/data/pricing.ts` do site)
Regular: 1 quarto/1 banho a partir de $191 (uma vez), $152.80 (semanal), $163 (a cada 2 semanas), $183 (a cada 4 semanas); cada quarto extra +$25 ($20 recorrente), banho extra +$42 ($33.60), lavabo +$15 ($12). Deep e Move: a partir de $331. Extras: forno $40, geladeira $45, armários $65, rodapés $50, janelas por dentro $50, piso da garagem $55 etc. Airbnb e escritório: sob orçamento. Mudou um preço no app? Atualizar o site também.

## Regras de agendamento
Segunda a sexta, 9:00 (manhã) e 13:00 (tarde); 3 h (4 h com mais de 3 quartos); pedido online fica "requested" até a Amanda aceitar; aceitar cria a série que repete.

## Já feito (resumo)
Agendamento do cliente com preço ao vivo; cotações com fotos (Airbnb e escritório); recuperação de agendamento abandonado; e-mails com logo, recibo de agradecimento e botões; marketing por e-mail; Google Calendar por script (a cada 15 min); backup semanal no Drive; relatórios; **preço por casa e descontos/cupons** (Settings → Discounts); site com calculadora, página de pagamentos, preços, blog (11 posts), galeria com fotos reais, faixa de avaliações do Google, favicon e imagem de compartilhamento.

## Pendências conhecidas
- Google Calendar: ainda não conectou na conta do Gmail da empresa (ver caixa de ajuda em Settings → Google Calendar).
- E-mails automáticos das limpezas marcadas pela Amanda começam desligados (Settings → Email messages).
- Número de avaliações do Google no site (hoje 11): confirmar o número real.
- Fotos de apartamento e escritório (ainda de banco de imagem); fotos de antes e depois novas.
- Novidades do Woofers já trazidas (migrações 0021–0030): aceite automático + QR, bloqueio com PIN, repetir em datas escolhidas, agenda 1 ano à frente, recibo PDF/e-mail/link, relatórios PDF e Excel, 2º lembrete + janela de chegada, dias fechados e feriados, etiquetas e "como nos achou", lista de espera, fotos da limpeza, modo offline, deslizar com o dedo (agenda, hoje, calendário), busca A–Z de clientes, Resend opcional, idiomas es/pt/zh/vi (traduções minhas, precisam de revisão de falante nativo).
- Ainda não trazido: equipe com logins/folha de pagamento (mudança grande), recursos do Google Maps (precisam de chave), aparência da agenda, planejador de reagendamento, logo enviado pelo painel, formulário /intake.

## Testes
`npm run test:unit` e `sh scripts/e2e-all.sh` (12 suítes, todas passando em 01/11; precisa de Postgres local na porta 5499, servidor `npm run dev` e o coletor `tests/e2e/mail-catcher.py`). Os testes de agendamento precisam de dias livres no mês: no fim do mês podem falhar sem ser defeito.
