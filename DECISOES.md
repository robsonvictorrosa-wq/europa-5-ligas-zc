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
