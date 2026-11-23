// Temporada: calendário (data de início escolhida pelo admin), simulação por data de jogos, copa nacional, nova temporada e reset.
module.exports=G=>{const {q,tx,fail,C,S,TT,CFG,LEAGUES,CLUBS,clubName,log,bump,squad}=G;
 const clubsOf=lid=>CLUBS.filter(c=>c.league_id===lid).map(c=>c.id);
 const strength=()=>new Map(CLUBS.map(c=>[c.id,G.teamOver(c.id)]));
 const maxRounds=()=>Math.max(...LEAGUES.map(l=>{const n=clubsOf(l.id).length;return CFG.league.double_round_robin?2*(n-1):n-1;}));
 const MD=()=>C.matchdays(maxRounds());
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!isNaN(Date.parse(d+'T12:00:00Z'));
 // gera a liga de cada país + a fase preliminar da copa (as demais fases são sorteadas quando a anterior termina)
 async function schedule(c,startDate,uid){const g=G.ST.g;if(!validDate(startDate))throw fail('Escolha a data de início (AAAA-MM-DD)');
  const played=(await c.query('SELECT count(*)::int n FROM matches WHERE season=$1 AND played',[g.season])).rows[0].n;
  if(played)throw fail('Já há jogos disputados nesta temporada: para mudar a data, resete a temporada.');
  await c.query('DELETE FROM matches WHERE season=$1',[g.season]);const md=MD();const st=strength();const seed=Date.now()%1e9;
  const mdOfLeague=new Map(md.filter(x=>x.kind==='league').map(x=>[x.round,x.md])),mdOfCup=new Map(md.filter(x=>x.kind==='cup').map(x=>[x.stage,x.md]));
  for(const l of LEAGUES){const R=C.leagueRounds(clubsOf(l.id),st,seed+l.id);
   for(let r=0;r<R.length;r++)for(const [h,a] of R[r]){const m=mdOfLeague.get(r+1);await c.query("INSERT INTO matches(season,comp,league_id,round,md,stage,kickoff,home,away) VALUES($1,'league',$2,$3,$4,'league',$5,$6,$7)",[g.season,l.id,r+1,m,C.kickoff(startDate,m),h,a]);}
   const pre=C.cupPrelim(clubsOf(l.id),st);const m=mdOfCup.get('prelim');
   for(const [i,[h,a]] of C.drawPairs(pre.play,seed+l.id*7).entries())await c.query("INSERT INTO matches(season,comp,league_id,round,md,stage,tie,kickoff,home,away) VALUES($1,'cup',$2,1,$3,'prelim',$4,$5,$6,$7)",[g.season,l.id,m,i,C.kickoff(startDate,m),h,a]);}
  await c.query("UPDATE game_state SET start_date=$1,status='running' WHERE id=1",[startDate]);await bump(c);
  await log(c,`📅 Calendário da temporada ${g.season} gerado: início em ${startDate.split('-').reverse().join('/')} (${md.length} datas de jogos, ${CFG.calendar.slots.join(' e ')}).`,uid);}
 // monta o time para o motor (escalação automática; táticas da IA da base)
 function team(cid,neutral){let P=G.PLAN.get(cid);if(!P){const sq=squad(cid);const ai=TT.aiPlan(sq,cid);const xi=TT.autoXI(sq,ai.formation);P={sq,xi,bench:sq.filter(p=>!xi.includes(p)),...ai};G.PLAN.set(cid,P);}
  return {club_id:cid,xi:P.xi,bench:P.bench,formation:P.formation,tactics:P.tactics,form:null,neutral:!!neutral};}
 const summary=(r,m)=>({events:r.events.map(e=>({min:e.min,club:e.club,scorer:e.scorer_name,assist:e.assist_name,og:!!e.og,kind:e.kind||null})),xg:r.xg,motm:r.motm?{id:r.motm,name:(G.rec(r.motm)||{}).name}:null,formations:{home:r.tac.home.formation,away:r.tac.away.formation},lineups:r.lineups});
 async function play(c,m){const r=S.playMatch(team(m.home,m.neutral),team(m.away,m.neutral));let winner=null,pens=null;
  if(m.comp==='cup'){if(r.hg!==r.ag)winner=r.hg>r.ag?m.home:m.away;else{const p=C.penalties();pens=p.join('-');winner=p[0]>p[1]?m.home:m.away;}}
  await c.query('UPDATE matches SET hg=$2,ag=$3,winner=$4,pens=$5,played=true,details=$6 WHERE id=$1',[m.id,r.hg,r.ag,winner,pens,JSON.stringify(summary(r,m))]);
  const pz=CFG.prizes_per_match||{};const pay=async(cid,v)=>v&&G.isGame(cid)&&c.query('UPDATE club_state SET budget=budget+$2 WHERE club_id=$1',[cid,v]);
  if(r.hg>r.ag)await pay(m.home,pz.win);else if(r.ag>r.hg)await pay(m.away,pz.win);else{await pay(m.home,pz.draw);await pay(m.away,pz.draw);}
  return {...m,hg:r.hg,ag:r.ag,winner,pens};}
 // sorteia a fase da copa que vai ser jogada (se ainda não existe)
 async function drawCup(c,stage,mdNo){const g=G.ST.g;const ix=C.CUP_STAGES.indexOf(stage);if(ix<=0)return;const prev=C.CUP_STAGES[ix-1];
  for(const l of LEAGUES){const ex=(await c.query("SELECT 1 FROM matches WHERE season=$1 AND comp='cup' AND league_id=$2 AND stage=$3",[g.season,l.id,stage])).rows;if(ex.length)continue;
   const pm=(await c.query("SELECT * FROM matches WHERE season=$1 AND comp='cup' AND league_id=$2 AND stage=$3",[g.season,l.id,prev])).rows;if(pm.some(m=>!m.played))throw fail('Fase anterior da copa ainda não terminou');
   let alive=pm.map(m=>m.winner);if(prev==='prelim'){const inPre=new Set(pm.flatMap(m=>[m.home,m.away]));alive=[...clubsOf(l.id).filter(id=>!inPre.has(id)),...alive];}
   const pairs=C.drawPairs(alive,Date.now()%1e9+l.id);
   for(const [i,[h,a]] of pairs.entries())await c.query("INSERT INTO matches(season,comp,league_id,round,md,stage,tie,kickoff,home,away,neutral) VALUES($1,'cup',$2,$3,$4,$5,$6,$7,$8,$9,$10)",[g.season,l.id,ix+1,mdNo,stage,i,C.kickoff(g.start_date,mdNo),h,a,stage==='final']);}}
 // simula a próxima data de jogos (todas as ligas ou a fase da copa)
 let busy=false;
 async function next(uid,{due=false}={}){if(busy)throw fail('Simulação em andamento, aguarde',409);busy=true;try{await G.load();const g=G.ST.g;if(g.status==='finished')return null;if(g.status!=='running')throw fail('A temporada não está em andamento');
  const md=MD();const done=(await q('SELECT coalesce(max(md),0)::int n FROM matches WHERE season=$1 AND played',[g.season]))[0].n;
  let cur=null;for(const x of md){const pend=(await q('SELECT count(*)::int n FROM matches WHERE season=$1 AND md=$2 AND NOT played',[g.season,x.md]))[0].n;const any=(await q('SELECT count(*)::int n FROM matches WHERE season=$1 AND md=$2',[g.season,x.md]))[0].n;if(x.md<done)continue;if(pend||(!any&&x.kind==='cup'))  {cur=x;break;}}
  if(!cur){await finish(uid);return null;}
  if(due&&Date.parse(C.kickoff(g.start_date,cur.md))>Date.now())return null;
  const res=await tx(async c=>{if(cur.kind==='cup')await drawCup(c,cur.stage,cur.md);
   const ms=(await c.query('SELECT * FROM matches WHERE season=$1 AND md=$2 AND NOT played ORDER BY league_id,id',[g.season,cur.md])).rows;const out=[];global.__act='simulação md '+cur.md;
   for(const m of ms){out.push(await play(c,m));await new Promise(r=>setImmediate(r));}global.__act='idle';
   const label=cur.kind==='league'?`Rodada ${cur.round} das ligas`:`${cur.name} das copas nacionais`;
   await log(c,`⚽ ${label} disputada (${out.length} jogos).`+(cur.kind==='cup'&&cur.stage==='final'?' Campeões: '+out.map(m=>`${clubName(m.winner)} (${G.LG.get(m.league_id).cup_name})`).join(', ')+'.':''),uid);await bump(c);return {md:cur,matches:out.length};});
  const left=(await q('SELECT count(*)::int n FROM matches WHERE season=$1 AND NOT played',[g.season]))[0].n;const lastMd=md[md.length-1].md;
  if(!left&&res.md.md>=lastMd)await finish(uid);
  await G.load();return res;}finally{busy=false;global.__act='idle';}}
 async function finish(uid){const g=G.ST.g;if(g.status==='finished')return;
  await tx(async c=>{const champs=[];for(const l of LEAGUES){const ms=(await c.query("SELECT * FROM matches WHERE season=$1 AND comp='league' AND league_id=$2",[g.season,l.id])).rows;const t=C.standings(ms,clubsOf(l.id),clubName);champs.push(`${t[0].name} (${l.name})`);}
   await c.query("UPDATE game_state SET status='finished' WHERE id=1");await log(c,`🏆 Temporada ${g.season} encerrada. Campeões das ligas: ${champs.join(', ')}.`,uid);await bump(c);});await G.load();}
 // agenda automática: joga as datas vencidas (o serviço free dorme; ao acordar, recupera as atrasadas)
 setInterval(async()=>{try{await G.ready;await G.load();if(!G.ST.g.auto||G.ST.g.status!=='running')return;for(let i=0;i<6;i++){const r=await next(null,{due:true});if(!r)break;}}catch(e){if(e.status!==409)console.error('agenda',e.message)}},60000).unref();
 // ---------- nova temporada ----------
 async function newSeason(uid,startDate){await G.load();const g=G.ST.g;if(g.status!=='finished')throw fail('A nova temporada só começa depois da última data de jogos');if(startDate&&!validDate(startDate))throw fail('Data inválida');
  const prev=g.season;await tx(async c=>{const s=prev+1;await c.query("UPDATE offers SET status='expired',msg='Fim da temporada',updated_at=now() WHERE status IN ('pending','countered')");
   await c.query("UPDATE auction_lots SET status='removed' WHERE status IN ('pending','open') AND NOT EXISTS(SELECT 1 FROM auction_bids b WHERE b.lot_id=auction_lots.id)");
   await c.query("UPDATE game_state SET season=$1,status='pre',start_date=NULL,auction_open=false WHERE id=1",[s]);G.ST.g.season=s;
   await G.saveEuro(c,s,CFG.europe.next_seasons_rank_by);await G.snapshot(c,s);
   await log(c,`🆕 Temporada ${s} começou (pré-temporada). Elencos, verbas e técnicos mantidos; vagas europeias pela ${CFG.europe.next_seasons_rank_by==='standings'?'classificação da temporada '+prev:'over'}.`,uid);await bump(c);
   if(startDate){G.ST.g.season=s;await schedule(c,startDate,uid);}});await G.load();}
 // ---------- resetar a temporada atual (volta ao snapshot do início) ----------
 async function reset(uid,startDate){await G.load();const g=G.ST.g;if(startDate&&!validDate(startDate))throw fail('Data inválida');
  const [sn]=await q('SELECT data FROM snapshots WHERE season=$1',[g.season]);if(!sn)throw fail('Snapshot do início da temporada não encontrado');const D=sn.data;
  await tx(async c=>{await c.query('DELETE FROM matches WHERE season=$1',[g.season]);await c.query('DELETE FROM transfers WHERE season=$1',[g.season]);await c.query('DELETE FROM offers WHERE season=$1',[g.season]);
   await c.query('DELETE FROM auction_lots WHERE season=$1',[g.season]);
   for(const x of D.cs)await c.query('UPDATE club_state SET budget=$2 WHERE club_id=$1',[x.club_id,x.budget]);
   await c.query('DELETE FROM player_state');for(const x of D.ps)await c.query('INSERT INTO player_state VALUES($1,$2)',[x.player_id,x.club_id]);
   for(const l of D.lots)await c.query('INSERT INTO auction_lots(id,season,player_id,from_club,min_bid,status,winner_club,price,created_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[l.id,l.season,l.player_id,l.from_club,l.min_bid,l.status,l.winner_club,l.price,l.created_by,l.created_at]);
   for(const b of D.bids)await c.query('INSERT INTO auction_bids(id,lot_id,club_id,user_id,amount,at) VALUES($1,$2,$3,$4,$5,$6)',[b.id,b.lot_id,b.club_id,b.user_id,b.amount,b.at]);
   for(const o of D.offers)await c.query('INSERT INTO offers(id,season,player_id,buyer_club,seller_club,buyer_user,fee,counter_fee,status,msg,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[o.id,o.season,o.player_id,o.buyer_club,o.seller_club,o.buyer_user,o.fee,o.counter_fee,o.status,o.msg,o.created_at,o.updated_at]);
   await c.query("UPDATE game_state SET status='pre',start_date=NULL,auction_open=false WHERE id=1");
   await log(c,`♻️ Temporada ${g.season} resetada para o início (elencos, verbas, leilões e propostas do snapshot; jogos apagados). Contas e técnicos mantidos.`,uid);await bump(c);
   if(startDate){await G.load();await schedule(c,startDate,uid);}});await G.load();}
 return {schedule,next,newSeason,reset,MD,clubsOf};};
