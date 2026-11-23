# Europa 5 Grandes Ligas ZC – decisões (etapa 1)
Horários de Brasília.

## Clubes (FC27)
Premier League 20, LaLiga 20, Serie A 20, Bundesliga 18, Ligue 1 18 = 96 clubes, exatamente o total das três copas europeias (36 + 30 + 30). Nomes como no FC27 (ex.: "Lombardia FC", "Milano FC", "Bergamo Calcio" são os nomes licenciados do jogo). Elencos de 21 a 35 jogadores.

## Verba inicial (Robson 23/11/2026, mesma regra da Libertadores ZC 50 com escala ajustada)
- Over para a verba = média dos **18** maiores overs do elenco inicial FC27; desempate pela média dos 11 maiores. (O over exibido do time continua sendo a média dos 11 maiores.)
- O clube de maior over (PSG, 85,22) recebe € 0; cada ponto de over abaixo dele vale **+ € 32,5 mi**; arredonda para o múltiplo de € 25 mi mais próximo; teto € 500 mi.
- Por que € 32,5 mi e não € 55 mi como no ZC 50: aqui a faixa vai de 85,22 (PSG) a 69,83 (Paderborn); com € 55 mi por ponto, 48 dos 96 clubes bateriam no teto. Robson aprovou € 32,5 mi ("Europa 5 Ligas: aprova €32,5 mi por ponto").
- Exemplos: PSG 0, Real Madrid 0, Barça/Arsenal/City/Bayern 25 mi, Liverpool e Atlético 75 mi, Lombardia (Inter) 100 mi, Elversberg/Paderborn/Le Mans/Troyes 500 mi.
- Distribuição (€ mi (clubes)): 0 (2), 25 (4), 75 (2), 100 (1), 125 (2), 150 (4), 175 (3), 200 (8), 225 (6), 250 (5), 275 (9), 300 (7), 325 (10), 350 (10), 375 (4), 400 (6), 425 (8), 450 (1), 500 (4).
- Código: `budget.js` + `config/europa.json` → `budget` (top_n, tiebreak_n, per_point, step, max); calculada no `import.js` (build). Nova temporada mantém as verbas; resetar volta ao snapshot do início da temporada (snapshot da T1 atualizado para a tabela nova em 23/11, antes de qualquer gasto).

## Copas europeias – vagas (aprovadas pelo Robson em 23/11/2026)
- Champions: 7 por país (35). Europa League e Conference: 6 + 6 nas ligas de 20, 5 + 5 nas de 18 (28 + 28).
- Sobra 1 clube por liga (5 no total). Pelo over: o de maior over vai à Champions (36), os 2 seguintes à Europa League (30) e os 2 últimos à Conference (30).
- Temporada 1: ordem dentro de cada liga pelo over do time. Configuração em `config/europa.json` → `europe`.
- **Temporada 2 em diante (Robson 23/11/2026):**
  1. Vagas-base pela classificação final da liga da temporada anterior, com a mesma divisão por país (Champions 7; EL/Conference 6+6 nas ligas de 20, 5+5 nas de 18). As 5 sobras (últimos colocados) completam as vagas pelo over, como na temporada 1.
  2. Bônus de campeão (`champion_bonus`, nesta ordem): campeão da copa nacional de cada país → Champions; campeão da Europa League → Champions; campeão da Conference → Europa League.
  3. Quem sobe desloca o pior colocado da copa de cima (maior posição na liga; empate: menor over) um degrau para baixo, em cascata até a copa de onde o campeão saiu. Totais ficam 36/30/30 e os 96 clubes jogam alguma copa europeia. Campeões que subiram por bônus não são deslocados.
  4. Se o campeão já está nessa copa ou numa melhor pela liga, fica onde está e nada muda.
  5. Bônus da copa nacional valem a partir da temporada 2. Bônus de Europa League/Conference só quando essas copas existirem (etapa 2: `europa.js` → `FORMAT.champions`).
  Testes: `test/run.js` (unidade com cascata; E2E completo confere 36/30/30, 96 clubes e os campeões das copas nacionais na Champions).
- Formato das copas (fases, sorteio, datas): **etapa 2**. Ponto de encaixe: `europa.js` (`FORMAT`) e `comps.matchdays`.

## Data de início (Robson 23/11)
Livre: o admin escolhe no painel. Enquanto nenhum jogo for disputado, a data pode ser trocada (o calendário é refeito).

## Ainda não definidos (desligados nesta etapa)
Prêmios por jogo/posição (`prizes_per_match` = 0), janelas automáticas do mercado (o admin abre/fecha), escalação/tática escolhida pelo técnico (todos usam a IA da base), evolução de jogadores, empréstimos, bolão.

## Etapa 3 — visual, setas e calendário (23/11/2026)
- Cores derivadas da arte enviada pelo Robson (preto + prata), estrutura de abas igual ao Libertadores ZC.
- Setas de competição em Jogos/Tabela/Estatísticas percorrem ligas, copas europeias (stub até o formato existir) e chaveamentos das copas nacionais; mata-mata europeu entra no mesmo ciclo quando existir.
- Calendário montado a partir das partidas do banco + fases de copa pendentes (data prevista), atualizando automaticamente a cada avanço (poll de 30 s pela versão do estado).

## Peso do over na simulação (Robson 23/11/2026: "aumentar um pouco")
- Onde: `sim.js` → `expected()`. Antes: `xG = 1,3 × e^((ataque − defesa adversária)/16) × mando`.
- Agora: o expoente de cada time é separado em **nível do jogo** (média das duas vantagens, mantém a média de gols) e **vantagem relativa** (meia-diferença entre as duas). A vantagem relativa vira `0,58 × tanh(2,1 × v / 0,58)` (`TUNE` em `sim.js`): diferenças pequenas e médias de over pesam ~2x mais; diferenças grandes saturam, então o azarão continua vencendo ~10% com 10 de over a menos. `gain=1, cap=Infinity` reproduz exatamente o motor anterior.
- Medição (`node scripts/bench-over.js 20000`): pares reais de clubes do FC27 com diferença de over do time (média dos 11) ≈ 2, 5 e 10; ~20 mil jogos por faixa, metade com o forte em casa e metade fora; mesma semente antes e depois.

| Dif. de over | Antes V/E/D do mais forte | Depois V/E/D do mais forte | Gols/jogo antes → depois |
|---|---|---|---|
| +2 | 45,0 / 24,8 / 30,2 | 52,4 / 23,3 / 24,3 | 2,83 → 2,87 |
| +5 | 56,8 / 22,4 / 20,8 | 66,1 / 19,5 / 14,4 | 2,94 → 3,09 |
| +10 | 75,4 / 14,7 / 9,9 | 74,9 / 15,1 / 10,0 | 3,48 → 3,44 |

- Média de gols num turno completo das 5 ligas: 2,97 → 3,03.
- Com +10 o resultado praticamente não muda: aumentar o peso ali derrubaria a vitória do mais fraco abaixo de 10%, que foi o limite pedido.

## Cargos: admin, moderador, membro (Robson 23/11/2026)
- Guardados em `users.role` (`membro` | `moderador` | `admin`). Migração automática no `pg.sql`, sem perda: contas que já eram admin (`is_admin`) viram `admin`; `is_admin` continua espelhando `role='admin'`.
- **Admins fixos**: Robshow + `ADMIN_APELIDOS` (Render). São sempre admin e ninguém consegue rebaixá-los (403).
- **Administrador**: tudo (temporada, data de início, nova temporada, resetar, agenda automática, técnicos dos clubes, verbas, leilão, mercado) + promover/rebaixar qualquer usuário não fixo. Pode haver quantos admins quiser. A futura aba de criar campeonatos também será só de admin.
- **Moderador**: só simular a próxima data de jogos, abrir/fechar mercado, abrir/encerrar leilão e montar os lotes do leilão (busca na base FC27, pôr/remover lote sem lance). Não pode: data de início, nova temporada, resetar, agenda automática, técnicos, verbas, cargos.
- **Proteção no servidor**: `roles.js` → `guard(auth)('moderador'|'admin')` (middlewares `mod`/`admin` em `api.js`), 401 sem login e 403 sem cargo. `/api/me` devolve `role`, `fixed`, `mod`. Rota nova: `POST /api/admin/users/:id/role {role}` (só admin; registra no log).
- **Tela**: Central da liga aparece para moderador (só os botões dele) e admin; a seção "Usuários e cargos" (lista com seletor de cargo) só para admin.
- Teste: `python3 test/roles-e2e.py <url> <pin do admin>` confere 200/403 de cada papel em todas as rotas de admin/moderador.

## Campeonatos personalizados (aba "Criar campeonato", só admin)
- **Quem faz o quê:** criar, simular (próxima rodada / tudo), "nova temporada igual" e apagar = só **admin** (`need('admin')`; moderador e membro recebem 403). **Ver** (aba "Personalizados") = todos, inclusive sem login.
- **Separado da carreira:** tabelas próprias `custom_comps` (config + estado em JSONB) e `custom_matches` (apagar um campeonato apaga os jogos em cascata). Não mexe em elencos, verbas, calendário nem notícias da carreira (só registra "campeonato criado" no feed).
- **Times:** qualquer clube da base do FC 27 (685 masculinos), **elencos originais do FC 27** (transferências da carreira não valem aqui). "Sem Clube" fica fora. Femininos só se marcar "incluir clubes femininos". Over do clube = média dos 11 melhores. 2 a 64 times.
- **Formatos:** pontos corridos (turno único ou ida e volta); mata-mata (jogo único ou ida e volta; a **final é sempre jogo único**; se o nº de times não for potência de 2, os de menor over jogam uma **preliminar** e os melhores passam direto); grupos + mata-mata (potes por over, N classificados por grupo, grupos em turno único ou ida e volta). Empate em mata-mata: pênaltis (ida e volta: pelo agregado). Chaves sorteadas a cada fase.
- **Extras:** Copa (mata-mata em jogo único só entre os times, precisa de 4+); Competição internacional (tamanho 4/8/16/32: os X melhores por over do campeonato + os clubes de maior over do resto da base, mesmo gênero, elenco ≥16; mata-mata ou grupos de 4 + mata-mata).
- **Simulação:** mesmo motor (`sim.js`, mesmo peso do over), escalação automática da IA. Sem datas: cada clique em "Simular próxima rodada" joga uma rodada de cada parte (liga, copa e internacional andam juntas).
- **Fim de campeonato:** o admin escolhe **"Nova temporada igual"** (mesmos times e formato, temporada +1; a anterior fica guardada) ou **"Montar campeonato novo"** (abre o assistente). Na Central, quando a temporada principal termina, aparece também "Montar campeonato novo" ao lado de "Começar nova temporada" — **não apaga a carreira**.
- Escudos reais só para os 96 clubes das 5 ligas; os demais aparecem com as iniciais.
- Testes: `node test/run.js` (unidade: rodízio, plano) e `python3 test/custom-e2e.py <url> <pin>` (Premier 20 ida/volta + copa + internacional; MLS 4 mata-mata; misto de 6 ligas grupos+mata-mata; simular até o fim; nova temporada; 403 para membro/moderador; apaga tudo no fim).
