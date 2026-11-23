# Europa 5 Grandes Ligas ZC – decisões (etapa 1)
Horários de Brasília.

## Clubes (FC27)
Premier League 20, LaLiga 20, Serie A 20, Bundesliga 18, Ligue 1 18 = 96 clubes, exatamente o total das três copas europeias (36 + 30 + 30). Nomes como no FC27 (ex.: "Lombardia FC", "Milano FC", "Bergamo Calcio" são os nomes licenciados do jogo). Elencos de 21 a 35 jogadores.

## Verba inicial (Robson 23/11: maior over, menor verba)
Over do time = média dos 11 maiores overs do elenco (mesma regra da base).
`verba = 0 + (500 mi − 0) × (overMax − over) / (overMax − overMin)`, arredondada para múltiplos de € 50 mi.
overMax = PSG 87,8 → € 0; overMin = SC Paderborn 07 71,1 → € 500 mi. Mesma escala da Libertadores ZC (0 a 500 mi, degraus de 50 mi). Parâmetros em `config/europa.json` → `budget` (min, max, step).
Distribuição: € 0 (1 clube), 50 (5), 100 (3), 150 (5), 200 (8), 250 (13), 300 (19), 350 (18), 400 (15), 450 (5), 500 (4).

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
