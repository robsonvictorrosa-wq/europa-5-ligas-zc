// Gera data/game.db (universo FC27 somente leitura) a partir de data/fc27.json.gz.
// Times do jogo: os 96 clubes das 5 grandes ligas (config/europa.json). Elencos estritamente do FC27 (nenhum jogador inventado).
// Os demais jogadores do FC27 ficam na base para a busca do leilão (admin).
const fs=require('fs'),D=require('better-sqlite3'),zlib=require('zlib');
const CFG=require('./config/europa.json'),VAL=require('./value'),B=require('./budget');
const src=JSON.parse(zlib.gunzipSync(fs.readFileSync(__dirname+'/data/fc27.json.gz')).toString('utf8'));
const out=__dirname+'/data/game.db';if(fs.existsSync(out))fs.unlinkSync(out);
const db=new D(out);db.exec(fs.readFileSync(__dirname+'/schema.sql','utf8'));
const money=s=>{if(!s)return null;s=String(s).replace(/[\s\u00a0€]/g,'').replace(',','.');s=s.replace(/mil/i,'K');const m=s.match(/^([\d.]+)([KMB]?)/i);if(!m)return null;return Math.round(parseFloat(m[1])*({K:1e3,M:1e6,B:1e9}[m[2].toUpperCase()]||1));};
const P=src.players;for(const p of P)if(p.name)p.name=p.name.replace(/\s*\*+\s*$/,'').replace(/\*/g,''); // marcador de emprestado no FC27
const GAME=new Map(CFG.leagues.map(l=>[l.fc27,l]));
const insL=db.prepare('INSERT INTO leagues(key,name,fc27_name,country,cup_name,in_game) VALUES(?,?,?,?,?,?)');
const LID={};for(const l of CFG.leagues)LID[l.fc27]=insL.run(l.key,l.name,l.fc27,l.country,l.cup,1).lastInsertRowid;
const OTHER=insL.run('OUT','Outros clubes (FC27)',null,'Vários',null,0).lastInsertRowid;
const insC=db.prepare('INSERT INTO clubs(name,league_id,fc27_league,in_game,gender) VALUES(?,?,?,?,?)');
const insP=db.prepare(`INSERT INTO players(id,name,nationality,club_id,positions,primary_position,overall,potential,age,birth_date,height_cm,weight_kg,preferred_foot,weak_foot,skill_moves,gender,market_value,wage,release_clause,contract_end,stats) VALUES(@id,@name,@nationality,@club_id,@positions,@primary_position,@overall,@potential,@age,@birth_date,@height_cm,@weight_kg,@preferred_foot,@weak_foot,@skill_moves,@gender,@mv,@wg,@rc,@contract_end,@stats)`);
const CID={};
db.transaction(()=>{for(const p of P){let cid=null;
  if(p.club){const g=p.gender==='Mulher'?'F':'M';const game=g==='M'&&GAME.has(p.league);const k=p.club+'|'+g+'|'+(game?p.league:'');
   cid=CID[k]??=insC.run(p.club,game?LID[p.league]:OTHER,p.league||null,game?1:0,g).lastInsertRowid;}
  if((+p.age||0)>VAL.FROZEN_AGE||p.potential==null||p.potential<p.overall)p.potential=p.overall;
  insP.run({...p,birth_date:p.birth_date||null,club_id:cid,positions:JSON.stringify(p.positions||[]),mv:VAL(p),wg:money(p.wage_display),rc:money(p.release_clause_display),stats:JSON.stringify(p.stats||{})});}})();
db.exec(`UPDATE clubs SET n_players=(SELECT count(*) FROM players WHERE club_id=clubs.id),
 squad_value=(SELECT coalesce(sum(market_value),0) FROM players WHERE club_id=clubs.id),
 overall=(SELECT round(avg(overall),1) FROM (SELECT overall FROM players WHERE club_id=clubs.id AND overall IS NOT NULL ORDER BY overall DESC LIMIT 11))`);
// verba inicial: maior over = menor verba (budget.js)
const game=db.prepare('SELECT id,overall FROM clubs WHERE in_game=1').all();const bud=B.budgets(game,CFG.budget);
const up=db.prepare('UPDATE clubs SET budget=? WHERE id=?');db.transaction(()=>{for(const c of game)up.run(bud.get(c.id),c.id);})();
db.exec('UPDATE leagues SET n_clubs=(SELECT count(*) FROM clubs WHERE league_id=leagues.id)');
db.prepare('INSERT INTO meta VALUES(?,?)').run('fc27_source',JSON.stringify(src.metadata||{}));
const ls=db.prepare('SELECT l.name,l.n_clubs,min(c.n_players) mn,max(c.n_players) mx FROM leagues l JOIN clubs c ON c.league_id=l.id WHERE l.in_game=1 GROUP BY l.id').all();
console.log('Import FC27:',P.length,'jogadores;',game.length,'clubes no jogo');for(const l of ls)console.log(' ',l.name,l.n_clubs,'clubes, elencos',l.mn,'-',l.mx);
if(game.length!==96)throw new Error('Esperados 96 clubes, encontrados '+game.length);
db.close();
