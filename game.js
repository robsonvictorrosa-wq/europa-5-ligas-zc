// Núcleo do jogo: universo FC27 (SQLite, só leitura) + estado (Postgres). Uma única "liga" (mundo) com os 96 clubes.
const {Pool}=require('pg'),fs=require('fs');
const CFG=require('./config/europa.json'),VAL=require('./value'),S=require('./sim'),TT=require('./tactics'),X=require('./rules');
const C=require('./comps'),EU=require('./europa');
module.exports=function Game(uni,url){
 const ssl=(()=>{const h=new URL(url).hostname;return process.env.PGSSL==='0'||(!process.env.PGSSL&&(!h.includes('.')||h==='localhost'))?false:{rejectUnauthorized:false};})();
 const pool=new Pool({max:8,idleTimeoutMillis:30000,connectionString:url,ssl});pool.on('error',e=>console.error('pg pool:',e.message));
 const q=(s,a)=>pool.query(s,a).then(r=>r.rows);
 const fail=(m,st=400)=>Object.assign(new Error(m),{status:st,expose:true});
 const tx=async f=>{const c=await pool.connect();try{await c.query('BEGIN');const r=await f(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}};
 // ---------- universo ----------
 const LEAGUES=uni.prepare('SELECT * FROM leagues WHERE in_game=1 ORDER BY id').all();
 const LG=new Map(LEAGUES.map(l=>[l.id,l]));
 const CLUBS=uni.prepare('SELECT * FROM clubs WHERE in_game=1 ORDER BY id').all();const CL=new Map(CLUBS.map(c=>[c.id,c]));
 const isGame=id=>CL.has(+id);
 const clubName=id=>CL.get(+id)?.name||uni.prepare('SELECT name FROM clubs WHERE id=?').get(id)?.name||(id?'Clube '+id:'Sem clube');
 const today=()=>new Date(Date.now()-3*3600e3).toISOString().slice(0,10);
 const ageFrom=(bd,fallback)=>{if(!bd)return fallback;const [y,m,d]=bd.split('-').map(Number);const [ty,tm,td]=today().split('-').map(Number);return ty-y-((tm<m||(tm===m&&td<d))?1:0);};
 const PC=new Map();// cache de jogadores (parse)
 const prow=uni.prepare('SELECT * FROM players WHERE id=?');
 function rec(id){id=+id;if(PC.has(id))return PC.get(id);const r=prow.get(id);if(!r)return null;const p={...r,positions:JSON.parse(r.positions||'[]'),stats:JSON.parse(r.stats||'{}'),base_club_id:r.club_id};p.age=ageFrom(r.birth_date,r.age);VAL.fix(p);p.market_value=VAL(p);PC.set(id,p);return p;}
 const BASE=uni.prepare('SELECT id,club_id FROM players WHERE club_id IN (SELECT id FROM clubs WHERE in_game=1)').all();
 // ---------- estado em memória (recarregado após cada mudança) ----------
 let ST={g:null,clubs:new Map(),pclub:new Map(),squads:new Map(),ver:0};const PLAN=new Map();
 async function load(){const [g]=await q('SELECT *,to_char(start_date,\'YYYY-MM-DD\') sd FROM game_state WHERE id=1');const cs=await q('SELECT * FROM club_state');const ps=await q('SELECT * FROM player_state');
  const pclub=new Map(BASE.map(r=>[r.id,r.club_id]));for(const r of ps){if(r.club_id==null)pclub.delete(r.player_id);else pclub.set(r.player_id,r.club_id);}
  const squads=new Map(CLUBS.map(c=>[c.id,[]]));for(const [pid,cid] of pclub)if(squads.has(cid))squads.get(cid).push(pid);
  ST={g:{...g,start_date:g.sd},clubs:new Map(cs.map(r=>[r.club_id,{budget:+r.budget,manager_id:r.manager_id}])),pclub,squads,ver:ST.ver+1};PLAN.clear();return ST;}
 const clubOf=pid=>ST.pclub.has(+pid)?ST.pclub.get(+pid):(rec(pid)?.club_id??null);
 const squad=cid=>(ST.squads.get(+cid)||[]).map(id=>({...rec(id),club_id:+cid})).filter(p=>p.id).sort((a,b)=>b.overall-a.overall);
 const teamOver=cid=>{const s=squad(cid).slice(0,11);return s.length?Math.round(s.reduce((a,p)=>a+p.overall,0)/s.length*10)/10:0;};
 const pub=p=>p&&({id:p.id,name:p.name,nationality:p.nationality,age:p.age,birth_date:p.birth_date,primary_position:p.primary_position,positions:p.positions,overall:p.overall,potential:p.potential,market_value:p.market_value,height_cm:p.height_cm,preferred_foot:p.preferred_foot,gender:p.gender,club_id:clubOf(p.id),club:clubName(clubOf(p.id)),fc27_club:clubName(p.base_club_id),stats:p.stats});
 const log=(c,text,uid=null)=>(c||pool).query('INSERT INTO log(season,text,user_id) VALUES($1,$2,$3)',[ST.g?.season||1,text,uid]);
 const bump=c=>c.query('UPDATE game_state SET version=version+1 WHERE id=1');
 // ---------- boot ----------
 const ready=(async()=>{await pool.query(fs.readFileSync(__dirname+'/pg.sql','utf8'));
  const n=(await q('SELECT count(*)::int n FROM club_state'))[0].n;
  if(!n){await pool.query('INSERT INTO club_state(club_id,budget) SELECT * FROM unnest($1::int[],$2::bigint[]) ON CONFLICT DO NOTHING',[CLUBS.map(c=>c.id),CLUBS.map(c=>c.budget)]);await log(null,'Jogo criado: 96 clubes das 5 grandes ligas (FC27).');console.log('club_state criado (96 clubes)');}
  await load();
  if(!(await q('SELECT 1 FROM euro_slots WHERE season=$1',[ST.g.season])).length)await tx(c=>saveEuro(c,ST.g.season,'over'));
  if(!(await q('SELECT 1 FROM snapshots WHERE season=$1',[ST.g.season])).length)await tx(c=>snapshot(c,ST.g.season));
  console.log('Postgres OK · temporada',ST.g.season,ST.g.status);})();
 // ---------- copas europeias (classificação) ----------
 function leaguesWithClubs(){return LEAGUES.map(l=>({id:l.id,key:l.key,name:l.name,clubs:CLUBS.filter(c=>c.league_id===l.id).map(c=>({id:c.id,name:c.name,overall:c.overall}))}));}
 async function saveEuro(c,season,rankBy){let rankings=null,champions=null;
  if(rankBy==='standings'){rankings=new Map();for(const l of LEAGUES){const ms=(await c.query("SELECT * FROM matches WHERE season=$1 AND comp='league' AND league_id=$2",[season-1,l.id])).rows;const ids=CLUBS.filter(x=>x.league_id===l.id).map(x=>x.id);rankings.set(l.id,C.standings(ms,ids,clubName).map(t=>t.club_id));}}
  // bônus de campeão (temporada 2+): campeões da copa nacional da temporada anterior + campeões europeus (quando as copas existirem)
  if(season>=(CFG.europe.champion_bonus_from_season||2)&&(CFG.europe.champion_bonus||[]).length){const cups=(await c.query("SELECT winner FROM matches WHERE season=$1 AND comp='cup' AND stage='final' AND winner IS NOT NULL",[season-1])).rows.map(r=>r.winner);
   const eu=await EU.FORMAT.champions(c,season-1)||{};champions={national_cup:cups,UEL:eu.UEL??null,UECL:eu.UECL??null};}
  const Q=EU.qualify(leaguesWithClubs(),{rankBy,rankings,overOf:id=>teamOver(id),champions});
  await c.query('DELETE FROM euro_slots WHERE season=$1',[season]);
  for(const k of EU.TIERS)for(const x of Q[k])await c.query('INSERT INTO euro_slots VALUES($1,$2,$3,$4,$5,$6)',[season,k,x.club_id,x.league_id,x.pos,x.via]);
  return Q;}
 async function europe(season=ST.g.season){const rows=await q('SELECT * FROM euro_slots WHERE season=$1',[season]);
  return {season,format:EU.FORMAT,rule:CFG._doc_europe,rule_next:CFG.europe._doc_next,competitions:EU.COMPS.map(c=>({...c,clubs:rows.filter(r=>r.comp===c.key).map(r=>({club_id:r.club_id,name:clubName(r.club_id),league:LG.get(r.league_id)?.name,pos:r.pos,via:r.via,over:teamOver(r.club_id)})).sort((a,b)=>b.over-a.over)}))};}
 // ---------- snapshot / reset ----------
 async function snapshot(c,season){const cs=(await c.query('SELECT club_id,budget FROM club_state')).rows;const ps=(await c.query('SELECT * FROM player_state')).rows;
  const lots=(await c.query('SELECT * FROM auction_lots WHERE season=$1',[season])).rows;const bids=(await c.query('SELECT b.* FROM auction_bids b JOIN auction_lots l ON l.id=b.lot_id WHERE l.season=$1',[season])).rows;
  const offers=(await c.query("SELECT * FROM offers WHERE season=$1",[season])).rows;
  await c.query('INSERT INTO snapshots(season,data) VALUES($1,$2) ON CONFLICT(season) DO UPDATE SET data=$2,at=now()',[season,JSON.stringify({cs,ps,lots,bids,offers})]);}
 // ---------- dinheiro ----------
 async function reserved(c,cid){const o=(await c.query("SELECT coalesce(sum(CASE WHEN status='countered' THEN counter_fee ELSE fee END),0)::bigint s FROM offers WHERE buyer_club=$1 AND status IN ('pending','countered')",[cid])).rows[0].s;
  const b=(await c.query("SELECT coalesce(sum(x.amount),0)::bigint s FROM auction_lots l JOIN LATERAL (SELECT club_id,amount FROM auction_bids WHERE lot_id=l.id ORDER BY amount DESC,id LIMIT 1) x ON true WHERE l.status='open' AND x.club_id=$1",[cid])).rows[0].s;return +o + +b;}
 async function finances(c,cid){const [r]=(await c.query('SELECT budget FROM club_state WHERE club_id=$1',[cid])).rows;const res=await reserved(c,cid);return {budget:+r.budget,reserved:res,available:+r.budget-res};}
 // transferência (dentro de tx): move jogador, paga, registra
 async function move(c,{pid,from,to,fee=0,kind}){await c.query('INSERT INTO player_state(player_id,club_id) VALUES($1,$2) ON CONFLICT(player_id) DO UPDATE SET club_id=$2',[pid,to]);
  if(fee){if(isGame(to))await c.query('UPDATE club_state SET budget=budget-$2 WHERE club_id=$1',[to,fee]);if(isGame(from))await c.query('UPDATE club_state SET budget=budget+$2 WHERE club_id=$1',[from,fee]);}
  await c.query('INSERT INTO transfers(season,player_id,from_club,to_club,fee,kind) VALUES($1,$2,$3,$4,$5,$6)',[ST.g.season,pid,from,to,fee,kind]);
  await c.query("UPDATE offers SET status='expired',msg='Jogador mudou de clube',updated_at=now() WHERE player_id=$1 AND status IN ('pending','countered')",[pid]);}
 const sqSize=cid=>(ST.squads.get(+cid)||[]).length;
 return {uni,pool,q,tx,fail,ready,load,get ST(){return ST},LEAGUES,LG,CLUBS,CL,isGame,clubName,rec,pub,clubOf,squad,teamOver,log,bump,europe,saveEuro,snapshot,reserved,finances,move,sqSize,today,CFG,C,EU,S,TT,X,VAL,PLAN};
};
