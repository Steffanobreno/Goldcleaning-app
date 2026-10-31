# Novidades do app Woofers para trazer ao Gold Cleaning

Varredura feita em 31/10/2026: o Woofers (repositório `duperpower`, ramo `master`) tem **46 commits novos**
desde o ponto em que o Gold foi copiado (`0208d81`, 22/10). São 252 arquivos e 17 migrações novas.
O Gold já mudou muito (casas no lugar de pets, preços por quarto e banho, e-mail só, descontos), então
nada vem por "copiar e colar": cada item é reescrito para limpeza.

Legenda: **Valor** para o Gold (alto, médio, baixo) · **Esforço** (P pequeno ≈ 1 sessão curta, M médio, G grande).
"Precisa de" = coisa externa (chave, domínio, dinheiro) que só vocês podem providenciar.

## A. Já temos (do nosso jeito)
| Woofers | No Gold |
|---|---|
| Preço próprio do pet (`e49622a`) | Preço por casa e descontos (feito) |
| Campo "Apartment or unit" no agendamento online | Já existe na página /book |

## B. Alto valor, esforço pequeno ou médio (começar por aqui)
| # | Novidade (commit) | Como fica no Gold | Valor | Esforço | Precisa de |
|---|---|---|---|---|---|
| 1 | **Agendamento online aceito sozinho** e QR code para cartaz (`cdd69e6`) | Chave "aceitar pedidos online automaticamente" e um QR do link /book para panfleto e cartão | Alto | P | nada |
| 2 | **Terminar a ordem de qualquer etapa; mudar preço e serviço no checkout e depois** (`97e1733`, `fa4d33e`) | A Amanda fecha uma limpeza mesmo esquecendo "a caminho" ou "check-in" e pode somar extras na hora | Alto | M | nada |
| 3 | **Recibo por e-mail, link e PDF** quando a ordem termina (`d997686`) | Nosso e-mail de agradecimento ganha recibo em PDF com o logo | Alto | M | nada |
| 4 | **Relatórios em PDF e CSV (Excel)** por período (`845b1ac`) | Reports exporta para a contabilidade | Alto | M | nada |
| 5 | **Visita agendada sem confirmação do dono; toque sem querer não perde a visita** (`7d55a8d`) | Menos cliques para a Amanda e proteção contra cancelar sem querer | Alto | P | nada |
| 6 | **Bloqueio do app com PIN** (`aab0ca8`) | PIN ao reabrir o app; 5 erros saem da conta | Médio-alto | P | nada |
| 7 | **Repetir a visita em datas escolhidas no calendário** (`4ce2e97`) | Além de "a cada N semanas" | Médio | P | nada |
| 8 | **Online aberto até 1 ano à frente** (`667bf9f`) | Só trocar o limite (hoje 60 dias) | Médio | P | nada |
| 9 | **Telas mais rápidas, deslizar para trocar a data, índice A–Z de clientes** (`114dd99`) | Mais fluido no celular | Médio | M | nada |

## C. Alto valor, esforço maior
| # | Novidade (commits) | Como fica no Gold | Valor | Esforço | Precisa de |
|---|---|---|---|---|---|
| 10 | **Páginas do cliente em 7 idiomas** (`14a258c`): agendamento, link da visita e recibo em espanhol, português, vietnamita, chinês, coreano e tagalo | Muito útil na Bay Area: o cliente escolhe o idioma | Alto | M-G | revisão dos textos por falante nativo |
| 11 | **Equipe: login para cada faxineira, funções e permissões, folha de pagamento, bater ponto** (`68aff08`) | "Cleaners" no lugar de "groomers"; cada uma vê só a agenda dela; horas para pagamento | Alto se tiver funcionárias | G | decisão: quantas pessoas terão login |
| 12 | **Funciona com sinal fraco ou sem sinal** (`c77baef`, `13b94b1`) | Telas salvas, visitas do dia salvas a partir do Today, aviso offline | Alto no campo | M | nada |
| 13 | **E-mail pelo Resend, do seu domínio** (`1b0c4a1`) | Sai de um endereço do domínio da empresa com recibo e calendário em anexo; sem o limite de ~500 do Gmail; cai menos no spam | Alto | P-M | domínio e registros DNS (SPF/DKIM) no Resend (plano grátis 3.000/mês) |
| 14 | **Mensagens: 2º lembrete, janela de chegada, chave do recibo** (`e882c4a`) | SMS fica de fora (decisão sua: só e-mail) | Médio | P | nada |
| 15 | **Lista de espera** (`08e11e1`): clientes que querem um dia cheio; cancelou, aparece no Today com Text e Book | Bom para encher agenda | Médio | M | nada |
| 16 | **Cadastro de cliente: etiquetas e origem (referral)** (`2146b62`) | Só a parte de etiquetas e de onde veio o cliente; raças e vacinas ficam de fora | Médio | P | nada |
| 17 | **Configurações em grupos com busca, perfil do negócio com logo, dias fechados e feriados** (`870c25e`) | Mais fácil de achar as coisas; feriados bloqueiam o online | Médio | M | nada |

## D. Mapas e rotas (valor alto para dias cheios, mas tem custo)
| # | Novidade (commits) | Como fica no Gold | Precisa de |
|---|---|---|---|
| 18 | **Google Maps**: sugestão de endereço ao digitar, geocodificação, tempo de carro (`603d862`) | Endereço certo na hora de agendar; tempo de deslocamento entre limpezas | Chave da API do Google Maps (tem uso grátis mensal, depois é cobrado) |
| 19 | **Today como mapa**, rota desenhada, melhor ordem do dia, abrir no Maps (`574591a`, `4f3afc6`, `f220c41`) | Amanda vê o dia no mapa | A mesma chave |
| 20 | **"A caminho"**: manda a hora de chegada pelo local do celular e marca a visita (`88841bf`) | Sai por e-mail (não SMS) | A mesma chave |
| 21 | **Áreas atendidas por CEP e dia da semana; van e ponto de partida por equipe** (`9910130`) | Cada equipe atende certas cidades em certos dias | Equipes (item 11) |

## E. Adaptar com mudança de conceito
| # | Novidade | Versão cleaning |
|---|---|---|
| 22 | **Histórico de tosa** (lâmina, comprimento, nota e foto por visita; "igual da última vez") (`8246a81`) | **Histórico da limpeza**: notas da equipe, fotos antes e depois por visita, checklist e "repetir como da última vez" na página da casa |
| 23 | **Contrato (agreement) em todas as opções de agendamento; link para assinar por texto ou e-mail** (`7213c0e`) | Termo de serviço assinado pelo cliente, enviado por e-mail |
| 24 | **Aparência do calendário** (o que cada visita mostra, cores por status, por tosador ou por serviço) (`7081712`) | Cor por equipe ou por tipo de limpeza |
| 25 | **Reagendar dentro da visita**, com semana e horários livres (`3de1c9f`) | Igual |
| 26 | **Navy e dourado em todo o app** (`63089bc`) | Conferir o que o Woofers mudou na aparência e o que o Gold já tem |

## F. Não serve para o Gold
Opções de pet (raça, pelagem, comportamento, vacinas, códigos de pet), contas para publicar nas lojas de apps
(Capacitor), venda do app para outros negócios, troca de Node.js. Ficam de fora.

## Ordem sugerida
1. **Lote 1 (rápido, sem custo):** itens 1, 5, 6, 7, 8 + recibo PDF (3) + exportar relatórios (4).
2. **Lote 2:** terminar a ordem de qualquer etapa (2), 2º lembrete (14), etiquetas (16), configurações com busca e feriados (17).
3. **Lote 3 (decisão de vocês):** idiomas (10), e-mail pelo Resend (13), funcionárias com login (11).
4. **Lote 4 (precisa da chave do Google Maps):** itens 18 a 21.
5. **Depois:** offline (12), lista de espera (15), histórico da limpeza (22), contrato (23).

Cada lote entra com testes e só vai para o ar (ramo `production`) com a autorização de quem pediu.
