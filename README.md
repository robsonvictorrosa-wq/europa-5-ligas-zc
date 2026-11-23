# Europa 5 Grandes Ligas ZC
Modo carreira multiplayer com as 5 grandes ligas da Europa e elencos do FC27. Interface em português.
Cópia adaptada da Libertadores ZC 50 clubes (`robsonvictorrosa-wq/libertadores-zc-50`), sem nenhuma ligação com o repositório, o serviço ou o banco de lá.

- **96 clubes** de `data/fc27.json.gz` (fctoolshub, 15/10/2026): Premier League (20), LaLiga (20), Serie A (20), Bundesliga (18), Ligue 1 (18). Elencos estritamente do FC27, nenhum jogador inventado. Os outros ~19 mil jogadores do FC27 ficam na base só para a busca do leilão (admin).
- **Contas** por apelido + PIN (scrypt). Admin padrão: **Robshow** (`admins.js`; outros via `ADMIN_APELIDOS`). Apelidos de admin são reservados; a conta Robshow é criada na 1ª subida com o PIN da variável `ADMIN_PIN`.
- **Técnicos**: cada conta assume 1 clube sem técnico (Liga → Clubes → Assumir). Clubes sem técnico são da IA.
- **Liga de cada país**: turno e returno (38 rodadas nas ligas de 20, 34 nas de 18). Turno pelo método de Berger da base (`leaguesched.js`), returno espelhado.
- **Copa nacional** de cada país, só com os clubes da liga: jogo único, pênaltis no empate, final em campo neutro. Fase preliminar com os clubes de menor over para chegar a 16 (20 clubes: 8 jogam; 18: 4 jogam), depois oitavas, quartas, semi e final, sorteadas fase a fase.
- **Calendário**: 43 datas de jogos (38 rodadas + 5 fases da copa), 2 por dia (12:00 e 19:00 de Brasília). **A data de início é livre: o admin escolhe no painel** (sem data fixa). Simulação manual pelo painel ou agenda automática (liga/desliga no painel).
- **Mercado**: propostas por qualquer jogador dos 96 clubes, entre qualquer liga. Clube da IA decide na hora com as regras da base (`rules.js`, `CRITERIOS_MERCADO.md`: aceita, contraproposta ou recusa); clube com técnico aceita/recusa. Verba reservada por propostas abertas e lances líderes. Elenco entre 16 e 32.
- **Leilão**: admin busca em toda a base FC27, põe o jogador no leilão aberto ou no próximo, abre e encerra. Lance não pode ser retirado; cada clube leva no máximo 1 por leilão (`auction-rules.js`); o clube de origem (se for do jogo) recebe o valor. Lote sem lance pode ser removido.
- **Painel do admin**: gerar calendário / mudar data de início, simular próxima data, agenda automática, abrir/fechar mercado, leilão, **Começar nova temporada** e **Resetar temporada** (dupla confirmação, checagem de admin no servidor, log).
- **Copas europeias** (Champions 36, Europa League 30, Conference 30): a classificação já é calculada e mostrada (aba Europa); o formato é um stub para a etapa 2 (`europa.js`, `FORMAT`). Detalhes em `DECISOES.md`.
- Motor de jogo da base (`sim.js`, `tactics.js`; escalação e tática automáticas da IA para todos os clubes nesta etapa). Valor de mercado da base (`value.js`).

Stack: Node 20 + Express, SQLite somente leitura (universo FC27, gerado por `node import.js` no build) e Postgres (`DATABASE_URL`, Neon grátis próprio). Deploy: `render.yaml` (web Free, sem keep-awake).

Local (Node 20): `npm ci && node import.js && DATABASE_URL=postgres://... PGSSL=0 ADMIN_PIN=... node server.js`
Testes: `node test/run.js` (unidade) · E2E com servidor e Postgres descartáveis: `E2E_BASE=http://localhost:3150 E2E_ADMIN_PIN=... node test/run.js` (`E2E_FULL=1` joga a temporada inteira, cria a temporada 2 e reseta).

Arquivos: `server.js` (boot) · `game.js` (universo + estado) · `season.js` (calendário, simulação, copa, nova temporada, reset) · `api.js` (rotas) · `comps.js` (liga, copa, calendário) · `europa.js` (vagas europeias + stub) · `budget.js` (verba inicial) · `config/europa.json` (todas as regras configuráveis) · `public/` (interface).

## Visual e navegação (etapa 3)
- Paleta preto/prata/branco tirada da arte "ZC Super Modo Carreira League" (`public/logo-arte.jpg`, `logo-mark.png`).
- Mesma estrutura de abas do Libertadores ZC: Menu, Campeonato, Mercado, Jogos, Tabela, Estatísticas, Calendário, Leilão, Clubes e verbas, Central da liga (admin).
- Em Jogos, Tabela e Estatísticas as setas ‹ › alternam a competição: 5 ligas → Champions/Europa/Conference → chaveamento das 5 copas nacionais (`GET /api/comps`, `GET /api/stats?comp=`).
- Aba Calendário (`#/calendario/<clube>/<AAAA-MM>`): grade mensal Dom–Sáb com adversário, Casa/Fora, competição e placar (V/E/D); começa no seu clube, com seletor de time. Gerada dos jogos reais: fases de copa ainda não sorteadas aparecem como "A sortear" e somem se o time for eliminado; a página recarrega sozinha quando a liga avança.

## Escudos
- Escudos reais dos 96 clubes em `public/crests/<club_id>.png` (128 px, servidos pelo próprio site, sem hotlink), baixados uma vez da imagem do infobox de cada clube na Wikipedia com `python3 scripts/fetch-crests.py [ids...]`. Os nomes genéricos do FC27 usam o escudo do clube real: Lombardia FC = Inter, Milano FC = Milan, Bergamo Calcio = Atalanta.
- `public/crests/index.js` lista os ids com escudo; qualquer clube fora da lista (ex.: jogador de clube de fora do jogo no leilão) ou imagem que falhar cai num escudo neutro com as iniciais.
- Aparecem em tabelas, jogos, estatísticas, chaveamentos, Europa, mercado, leilão, página do clube, lista de clubes e calendário.
