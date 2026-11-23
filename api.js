// Rotas HTTP (contas apelido+PIN, ligas, clubes, mercado entre qualquer liga, leilão, painel do admin)
const crypto=require('crypto'),AR=require('./auction-rules'),ADM=require('./admins'),RL=require('./roles');
module.exports=(app,G,SE)=>{const {q,tx,fail,ready,X,CFG}=G;
 const wrap=f=>(r,s)=>f(r,s).catch(e=>{if(!e.expose)console.error(e);s.status(e.status||500).json({error:e.expose?e.message:'Erro interno'})});
 // ---------- contas (mesmo esquema da base: scrypt assíncrono + token em cookie/Bearer) ----------
 let SQ=Promise.resolve();const hash=(p,salt=crypto.randomBytes(16).toString('hex'))=>{const r=SQ.then(()=>new Promise((ok,ko)=>crypto.scrypt(p,salt,32,(e,k)=>e?ko(e):ok(salt+':'+k.toString('hex')))));SQ=r.catch(()=>{});return r;};
 const check=async(p,h)=>{const [s]=h.split(':');const x=Buffer.from(await hash(p,s));const y=Buffer.from(h);return x.length===y.length&&crypto.timingSafeEqual(x,y);};
 const tokenOf=r=>(r.headers.authorization||'').replace('Bearer ','')||(r.headers.cookie||'').match(/e5_token=([a-f0-9]+)/)?.[1];
 const isAdm=u=>RL.roleOf(u)==='admin';
 const who=async r=>{await ready;const t=tokenOf(r);if(!t)return null;const [u]=await q('SELECT u.id,u.nick,u.is_admin,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=$1',[t]);if(!u)return null;u.role=RL.roleOf(u);u.fixed=RL.isFixed(u.nick);u.admin=u.role==='admin';u.mod=RL.can(u,'moderador');u.club_id=[...G.ST.clubs].find(([,c])=>c.manager_id===u.id)?.[0]||null;return u;};
 const auth=(r,s,n)=>who(r).then(u=>{if(!u)return s.status(401).json({error:'Faça login'});r.user=u;n();}).catch(e=>s.status(500).json({error:'Erro interno'}));
 // cargos: need('moderador') / need('admin') checam no servidor (roles.js); reusar nas próximas rotas (ex.: aba de campeonatos = admin)
 const need=RL.guard(auth),admin=need('admin'),mod=need('moderador');
 const login=async(s,uid)=>{const t=crypto.randomBytes(24).toString('hex');await q('INSERT INTO sessions(token,user_id) VALUES($1,$2)',[t,uid]);s.setHeader('Set-Cookie',`e5_token=${t}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=31536000`);return t;};
 // conta do admin padrão (Robshow) criada na subida com ADMIN_PIN; apelidos de admin não podem ser cadastrados pela tela
 ready.then(async()=>{const pin=process.env.ADMIN_PIN;if(!pin)return console.warn('ADMIN_PIN ausente: conta Robshow não criada automaticamente');
  for(const nick of ['Robshow']){const [u]=await q('SELECT id FROM users WHERE lower(nick)=lower($1)',[nick]);if(!u){await q('INSERT INTO users(nick,pass_hash,is_admin,role) VALUES($1,$2,true,$3)',[nick,await hash(String(pin)),'admin']);console.log('Conta admin criada:',nick);}}}).catch(e=>console.error('admin seed',e.message));
 app.post('/api/auth/register',wrap(async(r,s)=>{await ready;const {nick,pin}=r.body||{};
  if(!/^[\wÀ-ú .-]{3,20}$/.test(nick||''))throw fail('Apelido de 3 a 20 caracteres');if(!pin||String(pin).length<4)throw fail('PIN com pelo menos 4 caracteres');
  if(ADM().includes(nick.trim().toLowerCase()))throw fail('Apelido reservado',409);
  if((await q('SELECT 1 FROM users WHERE lower(nick)=lower($1)',[nick.trim()])).length)throw fail('Apelido já existe',409);
  const [u]=await q('INSERT INTO users(nick,pass_hash) VALUES($1,$2) RETURNING id,nick',[nick.trim(),await hash(String(pin))]);s.json({user:u,token:await login(s,u.id)});}));
 app.post('/api/auth/login',wrap(async(r,s)=>{await ready;const {nick,pin}=r.body||{};const [u]=await q('SELECT * FROM users WHERE lower(nick)=lower($1)',[String(nick||'').trim()]);
  if(!u||!(await check(String(pin||''),u.pass_hash)))throw fail('Apelido ou PIN inválido',401);s.json({user:{id:u.id,nick:u.nick},token:await login(s,u.id)});}));
 app.post('/api/auth/logout',wrap(async(r,s)=>{await q('DELETE FROM sessions WHERE token=$1',[tokenOf(r)||'']);s.setHeader('Set-Cookie','e5_token=; Path=/; Max-Age=0');s.json({ok:1});}));
 app.get('/api/me',auth,wrap(async(r,s)=>{const u=r.user;let fin=null;if(u.club_id)fin=await G.finances(G.pool,u.club_id);s.json({user:{id:u.id,nick:u.nick,admin:u.admin,role:u.role,fixed:u.fixed,mod:u.mod},club_id:u.club_id,club:u.club_id?G.clubName(u.club_id):null,finances:fin});}));
 // ---------- leitura ----------
 const mgrNick=async()=>new Map((await q('SELECT id,nick FROM users')).map(u=>[u.id,u.nick]));
 app.get('/api/state',wrap(async(r,s)=>{await ready;await G.load();const g=G.ST.g;const md=SE.MD();const nx=(await q('SELECT md,min(kickoff) k FROM matches WHERE season=$1 AND NOT played GROUP BY md ORDER BY md LIMIT 1',[g.season]))[0];
  s.json({name:CFG.name,season:g.season,status:g.status,start_date:g.start_date,auto:g.auto,market_open:g.market_open,auction_open:g.auction_open,version:g.version,matchdays:md.length,next:nx?{md:nx.md,kickoff:nx.k,...md[nx.md-1]}:null,slots:CFG.calendar.slots});}));
 app.get('/api/leagues',wrap(async(r,s)=>{await ready;s.json(G.LEAGUES.map(l=>({id:l.id,key:l.key,name:l.name,country:l.country,cup:l.cup_name,n_clubs:l.n_clubs})));}));
 const clubRow=(c,N)=>{const st=G.ST.clubs.get(c.id)||{};return {id:c.id,name:c.name,league_id:c.league_id,league:G.LG.get(c.league_id)?.name,overall:G.teamOver(c.id),fc27_overall:c.overall,budget:st.budget,initial_budget:c.budget,manager:st.manager_id?N.get(st.manager_id)||null:null,n_players:G.sqSize(c.id)};};
 app.get('/api/leagues/:id',wrap(async(r,s)=>{await ready;await G.load();const l=G.LG.get(+r.params.id);if(!l)throw fail('Liga não encontrada',404);const N=await mgrNick();const g=G.ST.g;
  const clubs=G.CLUBS.filter(c=>c.league_id===l.id).map(c=>clubRow(c,N)).sort((a,b)=>b.overall-a.overall);
  const ms=await q("SELECT id,round,md,kickoff,home,away,hg,ag,played FROM matches WHERE season=$1 AND comp='league' AND league_id=$2 ORDER BY round,id",[g.season,l.id]);
  const table=G.C.standings(ms,clubs.map(c=>c.id),G.clubName);s.json({league:l,clubs,table,fixtures:ms.map(m=>({...m,home_name:G.clubName(m.home),away_name:G.clubName(m.away)}))});}));
 app.get('/api/cups/:id',wrap(async(r,s)=>{await ready;const l=G.LG.get(+r.params.id);if(!l)throw fail('Liga não encontrada',404);
  const ms=await q("SELECT id,stage,tie,md,kickoff,home,away,hg,ag,pens,winner,played,neutral FROM matches WHERE season=$1 AND comp='cup' AND league_id=$2 ORDER BY round,tie",[G.ST.g.season,l.id]);
  s.json({league:l,cup:l.cup_name,stages:CFG.cup.rounds,matches:ms.map(m=>({...m,home_name:G.clubName(m.home),away_name:G.clubName(m.away),winner_name:m.winner?G.clubName(m.winner):null}))});}));
 app.get('/api/europe',wrap(async(r,s)=>{await ready;s.json(await G.europe(+r.query.season||G.ST.g.season));}));
 app.get('/api/clubs/:id',wrap(async(r,s)=>{await ready;await G.load();const c=G.CL.get(+r.params.id);if(!c)throw fail('Clube não encontrado',404);const N=await mgrNick();
  const ms=await q('SELECT id,comp,stage,round,md,kickoff,home,away,hg,ag,pens,winner,played FROM matches WHERE season=$1 AND (home=$2 OR away=$2) ORDER BY md',[G.ST.g.season,c.id]);
  const eu=(await q('SELECT comp FROM euro_slots WHERE season=$1 AND club_id=$2',[G.ST.g.season,c.id]))[0];
  const cupMs=ms.filter(m=>m.comp==='cup');const out=cupMs.some(m=>m.played&&m.winner!=null&&m.winner!==c.id)||cupMs.some(m=>m.played&&m.pens==null&&m.hg!==m.ag&&((m.home===c.id&&m.hg<m.ag)||(m.away===c.id&&m.ag<m.hg)));
  const pending=[];if(!out&&G.ST.g.start_date){const drawn=new Set((await q("SELECT DISTINCT stage FROM matches WHERE season=$1 AND comp='cup' AND league_id=$2",[G.ST.g.season,c.league_id])).map(x=>x.stage));
   for(const x of SE.MD().filter(x=>x.kind==='cup'&&!drawn.has(x.stage)))pending.push({stage:x.stage,name:x.name,md:x.md,kickoff:G.C.kickoff(G.ST.g.start_date,x.md)});}
  s.json({...clubRow(c,N),europe:eu?.comp||null,cup_out:out,pending_cup:pending,squad:G.squad(c.id).map(G.pub),matches:ms.map(m=>({...m,home_name:G.clubName(m.home),away_name:G.clubName(m.away)}))});}));
 // competições para as setas de troca (ligas, copas nacionais, copas europeias)
 app.get('/api/comps',wrap(async(r,s)=>{await ready;s.json([...G.LEAGUES.map(l=>({key:'L'+l.id,type:'league',id:l.id,name:l.name,country:l.country})),...G.EU.COMPS.map(c=>({key:'E'+c.key,type:'europe',id:c.key,name:c.name,size:c.size})),...G.LEAGUES.map(l=>({key:'C'+l.id,type:'cup',id:l.id,name:l.cup_name,country:l.country}))]);}));
 // estatísticas por competição (gols, assistências, notas) a partir dos jogos disputados
 app.get('/api/stats',wrap(async(r,s)=>{await ready;const k=String(r.query.comp||'');const season=G.ST.g.season;let ms=[];
  if(/^L\d+$/.test(k))ms=await q("SELECT home,away,hg,ag,details FROM matches WHERE season=$1 AND comp='league' AND league_id=$2 AND played",[season,+k.slice(1)]);
  else if(/^C\d+$/.test(k))ms=await q("SELECT home,away,hg,ag,details FROM matches WHERE season=$1 AND comp='cup' AND league_id=$2 AND played",[season,+k.slice(1)]);
  const P=new Map(),T=new Map();const pp=(id,club)=>{let x=P.get(id);if(!x){const p=G.rec(id);x={id,name:p?.name||'?',pos:p?.primary_position,club_id:club,club:G.clubName(club),g:0,a:0,j:0,rs:0,rn:0,motm:0};P.set(id,x);}return x;};
  const tt=id=>{let x=T.get(id);if(!x){x={club_id:id,name:G.clubName(id),gp:0,gc:0,cs:0,j:0};T.set(id,x);}return x;};
  for(const m of ms){const d=m.details||{};for(const e of d.events||[])if(!e.og&&e.scorer_id){pp(e.scorer_id,e.club).g++;if(e.assist_id)pp(e.assist_id,e.club).a++;}
   for(const [id,club,rt,min] of d.pl||[]){const x=pp(id,club);x.j++;if(rt!=null){x.rs+=rt;x.rn++;}}if(d.motm?.id)P.get(d.motm.id)&&P.get(d.motm.id).motm++;
   const h=tt(m.home),a=tt(m.away);h.j++;a.j++;h.gp+=m.hg;h.gc+=m.ag;a.gp+=m.ag;a.gc+=m.hg;if(!m.ag)h.cs++;if(!m.hg)a.cs++;}
  const L=[...P.values()].map(x=>({...x,nota:x.rn?Math.round(x.rs/x.rn*100)/100:null}));const minJ=Math.max(1,Math.floor(ms.length/(T.size||1)*0.4));
  s.json({comp:k,matches:ms.length,scorers:L.filter(x=>x.g).sort((a,b)=>b.g-a.g||b.a-a.a).slice(0,20),assists:L.filter(x=>x.a).sort((a,b)=>b.a-a.a||b.g-a.g).slice(0,20),
   ratings:L.filter(x=>x.nota!=null&&x.j>=minJ).sort((a,b)=>b.nota-a.nota).slice(0,20),motm:L.filter(x=>x.motm).sort((a,b)=>b.motm-a.motm).slice(0,10),
   attack:[...T.values()].sort((a,b)=>b.gp-a.gp).slice(0,10),defense:[...T.values()].sort((a,b)=>a.gc-b.gc).slice(0,10)});}));
 app.get('/api/players/:id',wrap(async(r,s)=>{await ready;const p=G.rec(r.params.id);if(!p)throw fail('Jogador não encontrado',404);s.json(G.pub(p));}));
 app.get('/api/matches/:id',wrap(async(r,s)=>{const [m]=await q('SELECT * FROM matches WHERE id=$1',[+r.params.id]);if(!m)throw fail('Jogo não encontrado',404);s.json({...m,home_name:G.clubName(m.home),away_name:G.clubName(m.away)});}));
 app.get('/api/transfers',wrap(async(r,s)=>{const t=await q('SELECT * FROM transfers ORDER BY id DESC LIMIT 100');s.json(t.map(x=>({...x,player:G.rec(x.player_id)?.name,from:G.clubName(x.from_club),to:G.clubName(x.to_club)})));}));
 app.get('/api/log',wrap(async(r,s)=>s.json(await q('SELECT l.id,l.season,l.text,l.at,u.nick FROM log l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 150'))));
 // ---------- técnicos ----------
 app.post('/api/clubs/:id/claim',auth,wrap(async(r,s)=>{const cid=+r.params.id;if(!G.isGame(cid))throw fail('Clube inválido');if(r.user.club_id)throw fail('Você já comanda um clube');
  await tx(async c=>{const x=await c.query('UPDATE club_state SET manager_id=$2 WHERE club_id=$1 AND manager_id IS NULL',[cid,r.user.id]);if(!x.rowCount)throw fail('Clube já tem técnico',409);await G.log(c,`🧑‍💼 ${r.user.nick} assumiu o ${G.clubName(cid)}.`,r.user.id);await G.bump(c);});await G.load();s.json({ok:1});}));
 app.post('/api/me/leave',auth,wrap(async(r,s)=>{if(!r.user.club_id)throw fail('Você não comanda clube');await tx(async c=>{await c.query('UPDATE club_state SET manager_id=NULL WHERE club_id=$1',[r.user.club_id]);await c.query("UPDATE offers SET status='cancelled',msg='Técnico saiu',updated_at=now() WHERE buyer_club=$1 AND status IN ('pending','countered')",[r.user.club_id]);await G.log(c,`👋 ${r.user.nick} deixou o ${G.clubName(r.user.club_id)}.`,r.user.id);});await G.load();s.json({ok:1});}));
 app.post('/api/admin/clubs/:id/manager',admin,wrap(async(r,s)=>{const cid=+r.params.id;const nick=String(r.body?.nick||'').trim();await tx(async c=>{let uid=null;if(nick){const [u]=(await c.query('SELECT id FROM users WHERE lower(nick)=lower($1)',[nick])).rows;if(!u)throw fail('Apelido não encontrado');uid=u.id;await c.query('UPDATE club_state SET manager_id=NULL WHERE manager_id=$1',[uid]);}
  await c.query('UPDATE club_state SET manager_id=$2 WHERE club_id=$1',[cid,uid]);await G.log(c,`🛠️ Admin definiu o técnico do ${G.clubName(cid)}: ${nick||'nenhum'}.`,r.user.id);});await G.load();s.json({ok:1});}));
 // ---------- mercado (transferências entre qualquer uma das 5 ligas) ----------
 const inLot=async(c,pid)=>(await c.query("SELECT 1 FROM auction_lots WHERE player_id=$1 AND status IN ('pending','open')",[pid])).rows.length>0;
 app.get('/api/market/search',wrap(async(r,s)=>{await ready;await G.load();const Q=r.query;const t=String(Q.q||'').trim().toLowerCase();const out=[];
  for(const c of G.CLUBS){if(Q.league&&c.league_id!==+Q.league)continue;if(Q.club&&c.id!==+Q.club)continue;for(const p of G.squad(c.id)){
   if(t&&!(p.name.toLowerCase().includes(t)||String(p.nationality).toLowerCase().includes(t)))continue;if(Q.pos&&p.primary_position!==Q.pos)continue;
   if(Q.minOvr&&p.overall<+Q.minOvr)continue;if(Q.maxOvr&&p.overall>+Q.maxOvr)continue;if(Q.maxAge&&p.age>+Q.maxAge)continue;out.push(p);}}
  out.sort((a,b)=>b.overall-a.overall||b.potential-a.potential);s.json(out.slice(0,150).map(p=>({...G.pub(p),stats:undefined,league:G.LG.get(G.CL.get(G.clubOf(p.id))?.league_id)?.name})));}));
 // decisão do clube vendedor sem técnico: regras da base (rules.js, CRITERIOS_MERCADO.md)
 async function botDecision(c,p,seller,buyer,fee){const sq=G.squad(seller);const imp=X.importance(p,sq);
  const fails=(await c.query("SELECT count(*)::int n FROM offers WHERE buyer_club=$1 AND player_id=$2 AND status='rejected' AND season=$3",[buyer,p.id,G.ST.g.season])).rows[0].n;
  const bc=G.CL.get(buyer),sc=G.CL.get(seller);const [rc]=(await c.query('SELECT budget FROM club_state WHERE club_id=$1',[seller])).rows;
  return X.clubDecision(p,{fee,swapValue:0,loan:false},{imp,season:2026+G.ST.g.season,day:0,days:4,fails,rival:sc.league_id===bc.league_id,sellerBudget:+rc.budget,clause:p.release_clause,sellerSquad:sq.length,biggerSeller:G.teamOver(seller)>G.teamOver(buyer)+5,salt:'e5'});}
 const checkBuy=async(c,buyer,p,fee,excludeOffer)=>{if(!G.ST.g.market_open)throw fail('Mercado fechado');if(G.sqSize(buyer)>=CFG.squad.max)throw fail(`Elenco cheio (máx. ${CFG.squad.max})`);
  const f=await G.finances(c,buyer);let res=f.reserved;if(excludeOffer)res-=excludeOffer;if(f.budget-res<fee)throw fail(`Verba insuficiente: disponível ${X.fmt(f.budget-res)}`);};
 app.post('/api/offers',auth,wrap(async(r,s)=>{const buyer=r.user.club_id;if(!buyer)throw fail('Assuma um clube primeiro');const p=G.rec(r.body?.player_id);if(!p)throw fail('Jogador não encontrado');
  const fee=Math.round(+r.body?.fee||0);if(!(fee>0))throw fail('Valor inválido');const seller=G.clubOf(p.id);if(!G.isGame(seller))throw fail('Só jogadores dos 96 clubes do jogo (os demais entram pelo leilão)');if(seller===buyer)throw fail('O jogador já é do seu clube');
  const out=await tx(async c=>{if(await inLot(c,p.id))throw fail('Jogador está no leilão');if((await c.query("SELECT 1 FROM offers WHERE buyer_club=$1 AND player_id=$2 AND status IN ('pending','countered')",[buyer,p.id])).rows.length)throw fail('Você já tem uma proposta aberta por ele');
   await checkBuy(c,buyer,p,fee);if(G.sqSize(seller)<=CFG.squad.min)throw fail(`O ${G.clubName(seller)} ficaria com menos de ${CFG.squad.min} jogadores`);
   const sm=G.ST.clubs.get(seller)?.manager_id;
   if(sm){const [o]=(await c.query("INSERT INTO offers(season,player_id,buyer_club,seller_club,buyer_user,fee,status,msg) VALUES($1,$2,$3,$4,$5,$6,'pending','Aguardando o técnico do clube vendedor') RETURNING *",[G.ST.g.season,p.id,buyer,seller,r.user.id,fee])).rows;await G.bump(c);return {offer:o,msg:'Proposta enviada ao técnico do '+G.clubName(seller)};}
   const d=await botDecision(c,p,seller,buyer,fee);
   if(d.d==='accept'){await G.move(c,{pid:p.id,from:seller,to:buyer,fee,kind:'transferência'});const [o]=(await c.query("INSERT INTO offers(season,player_id,buyer_club,seller_club,buyer_user,fee,status,msg) VALUES($1,$2,$3,$4,$5,$6,'accepted',$7) RETURNING *",[G.ST.g.season,p.id,buyer,seller,r.user.id,fee,d.msg])).rows;
    await G.log(c,`✍️ ${p.name}: ${G.clubName(seller)} → ${G.clubName(buyer)} por ${X.fmt(fee)}.`,r.user.id);await G.bump(c);return {offer:o,msg:d.msg,done:true};}
   const st=d.d==='counter'?'countered':'rejected';const [o]=(await c.query("INSERT INTO offers(season,player_id,buyer_club,seller_club,buyer_user,fee,counter_fee,status,msg) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",[G.ST.g.season,p.id,buyer,seller,r.user.id,fee,d.counter||null,st,d.msg])).rows;return {offer:o,msg:d.msg};});
  await G.load();s.json(out);}));
 app.get('/api/offers',auth,wrap(async(r,s)=>{const cid=r.user.club_id;if(!cid)return s.json({sent:[],received:[]});const os=await q('SELECT * FROM offers WHERE (buyer_club=$1 OR seller_club=$1) AND season=$2 ORDER BY id DESC LIMIT 100',[cid,G.ST.g.season]);
  const f=o=>({...o,player:G.rec(o.player_id)?.name,buyer:G.clubName(o.buyer_club),seller:G.clubName(o.seller_club)});s.json({sent:os.filter(o=>o.buyer_club===cid).map(f),received:os.filter(o=>o.seller_club===cid).map(f)});}));
 app.post('/api/offers/:id/:act',auth,wrap(async(r,s)=>{const act=r.params.act;if(!['accept','reject','cancel'].includes(act))throw fail('Ação inválida');const cid=r.user.club_id;
  const out=await tx(async c=>{const [o]=(await c.query('SELECT * FROM offers WHERE id=$1 FOR UPDATE',[+r.params.id])).rows;if(!o)throw fail('Proposta não encontrada',404);const p=G.rec(o.player_id);
   if(act==='cancel'){if(o.buyer_club!==cid||!['pending','countered'].includes(o.status))throw fail('Não dá para cancelar');await c.query("UPDATE offers SET status='cancelled',updated_at=now() WHERE id=$1",[o.id]);return {msg:'Proposta cancelada'};}
   let fee;if(o.status==='pending'&&o.seller_club===cid)fee=+o.fee;else if(o.status==='countered'&&o.buyer_club===cid)fee=+o.counter_fee;else throw fail('Você não pode responder esta proposta');
   if(act==='reject'){await c.query("UPDATE offers SET status='rejected',msg=$2,updated_at=now() WHERE id=$1",[o.id,o.seller_club===cid?'Recusada pelo técnico':'Contraproposta recusada']);return {msg:'Proposta recusada'};}
   if(G.clubOf(o.player_id)!==o.seller_club)throw fail('O jogador não está mais no clube');if(await inLot(c,o.player_id))throw fail('Jogador está no leilão');
   await checkBuy(c,o.buyer_club,p,fee,o.status==='countered'?+o.counter_fee:+o.fee);if(G.sqSize(o.seller_club)<=CFG.squad.min)throw fail(`O vendedor ficaria com menos de ${CFG.squad.min} jogadores`);
   await G.move(c,{pid:o.player_id,from:o.seller_club,to:o.buyer_club,fee,kind:'transferência'});await c.query("UPDATE offers SET status='accepted',fee=$2,updated_at=now() WHERE id=$1",[o.id,fee]);
   await G.log(c,`✍️ ${p.name}: ${G.clubName(o.seller_club)} → ${G.clubName(o.buyer_club)} por ${X.fmt(fee)}.`,r.user.id);await G.bump(c);return {msg:'Transferência concluída',done:true};});
  await G.load();s.json(out);}));
 // ---------- leilão ----------
 const lotsView=async(where,args)=>{const ls=await q(`SELECT l.*,(SELECT json_agg(json_build_object('club_id',b.club_id,'amount',b.amount,'at',b.at) ORDER BY b.amount DESC,b.id) FROM auction_bids b WHERE b.lot_id=l.id) bids FROM auction_lots l WHERE ${where} ORDER BY l.id`,args);
  return ls.map(l=>{const p=G.rec(l.player_id);const top=l.bids?.[0];return {id:l.id,status:l.status,min_bid:+l.min_bid,from_club:l.from_club,from:G.clubName(l.from_club),player:G.pub(p)&&{...G.pub(p),stats:undefined},top:top?{club_id:top.club_id,club:G.clubName(top.club_id),amount:+top.amount}:null,n_bids:l.bids?.length||0,winner:l.winner_club?G.clubName(l.winner_club):null,winner_club:l.winner_club||null,price:l.price&&+l.price};});};
 app.get('/api/auction',wrap(async(r,s)=>{await ready;await G.load();s.json({open:G.ST.g.auction_open,season:G.ST.g.season,lots:await lotsView("l.season=$1 AND l.status IN ('pending','open','sold','unsold')",[G.ST.g.season]),rules:CFG.auction});}));
 app.post('/api/auction/:lot/bid',auth,wrap(async(r,s)=>{const cid=r.user.club_id;if(!cid)throw fail('Assuma um clube primeiro');const amount=Math.round(+r.body?.amount||0);
  await tx(async c=>{await c.query('SELECT 1 FROM game_state WHERE id=1 FOR UPDATE');const [l]=(await c.query('SELECT * FROM auction_lots WHERE id=$1',[+r.params.lot])).rows;if(!l||l.status!=='open')throw fail('Lote não está aberto');
   if(l.from_club===cid)throw fail('O jogador é do seu clube');
   const tops=(await c.query("SELECT l.id,x.club_id,x.amount FROM auction_lots l JOIN LATERAL (SELECT club_id,amount FROM auction_bids WHERE lot_id=l.id ORDER BY amount DESC,id LIMIT 1) x ON true WHERE l.status='open'")).rows;
   const mine=tops.find(t=>t.club_id===cid&&t.id!==l.id),here=tops.find(t=>t.id===l.id);
   const ok=AR.canBid({sameLotLeader:here?.club_id===cid,otherLotLeader:!!mine,otherPlayerName:mine&&G.rec((await c.query('SELECT player_id FROM auction_lots WHERE id=$1',[mine.id])).rows[0].player_id)?.name});if(!ok.ok)throw fail(ok.error);
   const minNext=here?+here.amount+CFG.auction.min_increment:+l.min_bid;if(amount<minNext)throw fail(`Lance mínimo: ${X.fmt(minNext)}`);
   if(G.sqSize(cid)>=CFG.squad.max)throw fail(`Elenco cheio (máx. ${CFG.squad.max})`);const f=await G.finances(c,cid);if(f.available<amount)throw fail(`Verba insuficiente: disponível ${X.fmt(f.available)}`);
   await c.query('INSERT INTO auction_bids(lot_id,club_id,user_id,amount) VALUES($1,$2,$3,$4)',[l.id,cid,r.user.id,amount]);await G.bump(c);});s.json({ok:1});}));
 // ---------- admin: leilão com jogadores de toda a base FC27 ----------
 app.get('/api/admin/fc27',mod,wrap(async(r,s)=>{await G.load();const Q=r.query;const w=[],a=[];
  if(Q.q){w.push('p.name LIKE ?');a.push('%'+Q.q+'%');}if(Q.club){w.push('c.name LIKE ?');a.push('%'+Q.club+'%');}if(Q.pos){w.push('p.primary_position=?');a.push(Q.pos);}
  if(Q.minOvr){w.push('p.overall>=?');a.push(+Q.minOvr);}if(Q.maxOvr){w.push('p.overall<=?');a.push(+Q.maxOvr);}if(Q.women!=='1')w.push("p.gender='Homem'");
  const rows=G.uni.prepare(`SELECT p.id FROM players p LEFT JOIN clubs c ON c.id=p.club_id ${w.length?'WHERE '+w.join(' AND '):''} ORDER BY p.overall DESC LIMIT 100`).all(...a);
  const lots=new Set((await q("SELECT player_id FROM auction_lots WHERE status IN ('pending','open')")).map(x=>x.player_id));const N=await mgrNick();
  s.json(rows.map(x=>{const p=G.pub(G.rec(x.id));const cid=G.clubOf(x.id);const m=G.ST.clubs.get(cid)?.manager_id;return {...p,stats:undefined,in_game:G.isGame(cid),manager:m?N.get(m):null,in_lot:lots.has(x.id),suggested_min:Math.max(CFG.auction.min_bid_floor,Math.round(p.market_value*CFG.auction.min_bid_pct/1e5)*1e5)};}));}));
 app.post('/api/admin/auction/lots',mod,wrap(async(r,s)=>{const p=G.rec(r.body?.player_id);if(!p)throw fail('Jogador não encontrado');
  const min=Math.round(+r.body?.min_bid||Math.max(CFG.auction.min_bid_floor,Math.round(p.market_value*CFG.auction.min_bid_pct/1e5)*1e5));if(!(min>0))throw fail('Lance mínimo inválido');
  await tx(async c=>{if(await inLot(c,p.id))throw fail('Jogador já está em um lote');const from=G.clubOf(p.id);const st=G.ST.g.auction_open?'open':'pending';
   await c.query('INSERT INTO auction_lots(season,player_id,from_club,min_bid,status,created_by) VALUES($1,$2,$3,$4,$5,$6)',[G.ST.g.season,p.id,from,min,st,r.user.id]);
   await c.query("UPDATE offers SET status='expired',msg='Jogador foi para o leilão',updated_at=now() WHERE player_id=$1 AND status IN ('pending','countered')",[p.id]);
   await G.log(c,`🔨 ${p.name} (${G.clubName(from)}) entrou no leilão${st==='open'?' aberto':' (próximo leilão)'} · lance mínimo ${X.fmt(min)}.`,r.user.id);await G.bump(c);});s.json({ok:1});}));
 app.delete('/api/admin/auction/lots/:id',mod,wrap(async(r,s)=>{await tx(async c=>{const [l]=(await c.query('SELECT * FROM auction_lots WHERE id=$1 FOR UPDATE',[+r.params.id])).rows;if(!l||!['pending','open'].includes(l.status))throw fail('Lote não pode ser removido');
  if((await c.query('SELECT 1 FROM auction_bids WHERE lot_id=$1',[l.id])).rows.length)throw fail('Lote com lance não pode ser removido');await c.query("UPDATE auction_lots SET status='removed' WHERE id=$1",[l.id]);await G.log(c,`🗑️ Lote de ${G.rec(l.player_id)?.name} removido.`,r.user.id);await G.bump(c);});s.json({ok:1});}));
 app.post('/api/admin/auction/open',mod,wrap(async(r,s)=>{await tx(async c=>{const n=(await c.query("UPDATE auction_lots SET status='open' WHERE status='pending' AND season=$1",[G.ST.g.season])).rowCount;if(!n&&!(await c.query("SELECT 1 FROM auction_lots WHERE status='open'")).rows.length)throw fail('Nenhum lote para abrir');
  await c.query('UPDATE game_state SET auction_open=true WHERE id=1');await G.log(c,`🔔 Leilão aberto (${n} lotes).`,r.user.id);await G.bump(c);});await G.load();s.json({ok:1});}));
 app.post('/api/admin/auction/close',mod,wrap(async(r,s)=>{const res=await tx(async c=>{const ls=(await c.query("SELECT * FROM auction_lots WHERE status='open' FOR UPDATE")).rows;const sold=[];
  for(const l of ls){const bids=(await c.query('SELECT * FROM auction_bids WHERE lot_id=$1 ORDER BY amount DESC,id',[l.id])).rows;const p=G.rec(l.player_id);let done=false;
   for(const b of bids){const [cb]=(await c.query('SELECT budget FROM club_state WHERE club_id=$1',[b.club_id])).rows;if(+cb.budget<+b.amount)continue;
    await G.move(c,{pid:l.player_id,from:l.from_club,to:b.club_id,fee:+b.amount,kind:'leilão'});await c.query("UPDATE auction_lots SET status='sold',winner_club=$2,price=$3 WHERE id=$1",[l.id,b.club_id,b.amount]);sold.push(`${p.name} → ${G.clubName(b.club_id)} (${X.fmt(+b.amount)})`);done=true;break;}
   if(!done)await c.query("UPDATE auction_lots SET status='unsold' WHERE id=$1",[l.id]);}
  await c.query('UPDATE game_state SET auction_open=false WHERE id=1');await G.log(c,`🔨 Leilão encerrado. ${sold.length?'Arrematados: '+sold.join('; '):'Nenhum lote arrematado'}.`,r.user.id);await G.bump(c);return {sold};});await G.load();s.json(res);}));
 // ---------- admin: mercado e temporada ----------
 const confirmWord=(r,w)=>{if(String(r.body?.confirm||'').trim().toUpperCase()!==w)throw fail(`Digite ${w} para confirmar`);};
 app.post('/api/admin/market',mod,wrap(async(r,s)=>{const open=!!r.body?.open;await q('UPDATE game_state SET market_open=$1,version=version+1 WHERE id=1',[open]);await G.log(null,open?'🟢 Mercado aberto pela administração.':'🔴 Mercado fechado pela administração.',r.user.id);await G.load();s.json({ok:1});}));
 app.post('/api/admin/season/auto',admin,wrap(async(r,s)=>{const on=!!r.body?.on;await q('UPDATE game_state SET auto=$1,version=version+1 WHERE id=1',[on]);await G.log(null,on?'⏱️ Agenda automática LIGADA (jogos nos horários do calendário).':'⏸️ Agenda automática desligada.',r.user.id);await G.load();s.json({ok:1});}));
 app.post('/api/admin/season/schedule',admin,wrap(async(r,s)=>{await G.load();if(!['pre','running'].includes(G.ST.g.status))throw fail('Temporada encerrada: use Começar nova temporada');await tx(c=>SE.schedule(c,r.body?.start_date,r.user.id));await G.load();s.json({ok:1});}));
 app.post('/api/admin/season/next',mod,wrap(async(r,s)=>{const x=await SE.next(r.user.id);s.json(x||{finished:true});}));
 app.post('/api/admin/season/new',admin,wrap(async(r,s)=>{confirmWord(r,'NOVA TEMPORADA');await SE.newSeason(r.user.id,r.body?.start_date||null);s.json({ok:1});}));
 app.post('/api/admin/season/reset',admin,wrap(async(r,s)=>{confirmWord(r,'RESETAR');await SE.reset(r.user.id,r.body?.start_date||null);s.json({ok:1});}));
 app.get('/api/admin/users',admin,wrap(async(r,s)=>s.json((await q('SELECT id,nick,is_admin,role,created_at FROM users ORDER BY id')).map(u=>({id:u.id,nick:u.nick,created_at:u.created_at,role:RL.roleOf(u),fixed:RL.isFixed(u.nick),admin:isAdm(u),club:(cid=>cid?G.clubName(cid):null)([...G.ST.clubs].find(([,c])=>c.manager_id===u.id)?.[0])})))));
 // ---------- campeonatos personalizados (custom.js): ver é público; criar/simular/apagar só admin ----------
 const CU=require('./custom')(G);
 app.get('/api/custom',wrap(async(r,s)=>{await ready;s.json(await CU.list());}));
 app.get('/api/custom/:id',wrap(async(r,s)=>{await ready;s.json(await CU.view(+r.params.id));}));
 app.get('/api/admin/custom/leagues',admin,wrap(async(r,s)=>s.json(CU.leagues(r.query.women==='1'))));
 app.get('/api/admin/custom/clubs',admin,wrap(async(r,s)=>s.json(CU.clubs({league:r.query.league,q:r.query.q,women:r.query.women==='1'}))));
 app.post('/api/admin/custom/preview',admin,wrap(async(r,s)=>{const P=CU.plan(r.body);s.json(P.parts.map(p=>({key:p.key,name:p.name,type:p.type,n:p.clubs.length,from:p.from||null})));}));
 app.post('/api/admin/custom',admin,wrap(async(r,s)=>{await ready;const id=await CU.create(r.body,r.user.id);await G.log(null,`🏆 Campeonato personalizado criado: ${String(r.body.name).slice(0,60)} (por ${r.user.nick}).`,r.user.id);s.json({id});}));
 app.post('/api/admin/custom/:id/next',admin,wrap(async(r,s)=>s.json(await CU.next(+r.params.id))));
 app.post('/api/admin/custom/:id/all',admin,wrap(async(r,s)=>s.json(await CU.all(+r.params.id))));
 app.post('/api/admin/custom/:id/again',admin,wrap(async(r,s)=>s.json({id:await CU.again(+r.params.id,r.user.id)})));
 app.delete('/api/admin/custom/:id',admin,wrap(async(r,s)=>{await CU.remove(+r.params.id);s.json({ok:1});}));
 // cargos: só admin promove/rebaixa (membro/moderador/admin); admins fixos (Robshow + ADMIN_APELIDOS) não mudam
 app.post('/api/admin/users/:id/role',admin,wrap(async(r,s)=>{const role=String(r.body?.role||'');if(!RL.ROLES.includes(role))throw fail('Cargo inválido (membro, moderador ou admin)');
  const [u]=await q('SELECT id,nick,role,is_admin FROM users WHERE id=$1',[+r.params.id]);if(!u)throw fail('Usuário não encontrado',404);
  if(RL.isFixed(u.nick))throw fail('Administrador fixo: não pode mudar de cargo',403);
  await q('UPDATE users SET role=$2,is_admin=$3 WHERE id=$1',[u.id,role,role==='admin']);
  await G.log(null,`👤 ${u.nick} agora é ${RL.LABEL[role].toLowerCase()} (por ${r.user.nick}).`,r.user.id);s.json({id:u.id,nick:u.nick,role});}));
};
