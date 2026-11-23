// Campeonatos personalizados (Robson 23/11/2026): criados pelos admins na aba "Criar campeonato", rodam SEPARADOS da
// carreira principal (não mexem em verbas, elencos, temporada das 5 ligas). Elencos originais do FC27 (data/game.db),
// simulação com o mesmo motor (sim.js). Estado enxuto no Postgres: custom_comps (config + progresso em JSONB) e
// custom_matches (placar + gols [[jogador, clube]]).
const C=require('./comps'),S=require('./sim'),TT=require('./tactics');
module.exports=function Custom(G){
 const {q,tx,fail,uni}=G;
 // ---------- universo (todos os clubes do FC27, menos "Sem Clube") ----------
 const CLUBS=uni.prepare("SELECT id,name,fc27_league league,gender,n_players FROM clubs WHERE fc27_league IS NOT NULL AND name<>'Sem Clube'").all();
 const OV=new Map();{let cur=null,arr=[];const fl=()=>{if(cur!=null&&arr.length){const t=arr.slice(0,11);OV.set(cur,Math.round(t.reduce((a,b)=>a+b,0)/t.length*10)/10);}};
  for(const r of uni.prepare('SELECT club_id,overall FROM players WHERE overall IS NOT NULL ORDER BY club_id,overall DESC').iterate()){if(r.club_id!==cur){fl();cur=r.club_id;arr=[];}arr.push(r.overall);}fl();}
 const CL=new Map(CLUBS.map(c=>[c.id,{...c,over:OV.get(c.id)||0}]));
 const over=id=>CL.get(+id)?.over||0,cname=id=>CL.get(+id)?.name||('Clube '+id);
 const LEAGUES=(()=>{const m=new Map();for(const c of CL.values()){const k=c.league+'|'+c.gender;if(!m.has(k))m.set(k,{name:c.league,gender:c.gender,n:0,over:0});const x=m.get(k);x.n++;x.over+=c.over;}
  return [...m.values()].map(x=>({...x,over:Math.round(x.over/x.n*10)/10})).sort((a,b)=>b.over-a.over);})();
 const pstmt=uni.prepare('SELECT * FROM players WHERE club_id=?'),pname=uni.prepare('SELECT name FROM players WHERE id=?');
 const TEAM=new Map();// plano da IA por clube (cache limitado)
 function team(cid){cid=+cid;if(!TEAM.has(cid)){if(TEAM.size>160)TEAM.clear();const sq=pstmt.all(cid).map(r=>({...r,positions:JSON.parse(r.positions||'[]'),stats:JSON.parse(r.stats||'{}')})).filter(p=>p.overall).sort((a,b)=>b.overall-a.overall);
  const ai=TT.aiPlan(sq,cid);const xi=TT.autoXI(sq,ai.formation);TEAM.set(cid,{club_id:cid,xi,bench:sq.filter(p=>!xi.includes(p)),formation:ai.formation,tactics:ai.tactics,form:null});}return TEAM.get(cid);}
 // ---------- formatos ----------
 const rng=C.rng(Date.now()),shuffle=a=>C.shuffle(a,rng),byOver=a=>[...a].sort((x,y)=>over(y)-over(x)||x-y);
 function rr(ids,double){const a=[...ids];if(a.length%2)a.push(null);const n=a.length,R=[];const fixed=a[0];let rot=a.slice(1);
  for(let r=0;r<n-1;r++){const cur=[fixed,...rot],g=[];for(let i=0;i<n/2;i++){let h=cur[i],w=cur[n-1-i];if((i===0&&r%2)||(i>0&&(r+i)%2))[h,w]=[w,h];if(h!=null&&w!=null)g.push([h,w]);}R.push(g);rot=[rot[rot.length-1],...rot.slice(0,-1)];}
  return double?[...R,...R.map(g=>g.map(([h,w])=>[w,h]))]:R;}
 const KON={2:'Final',4:'Semifinal',8:'Quartas de final',16:'Oitavas de final',32:'16 avos de final',64:'32 avos de final'};
 const FMT_TXT=p=>p.type==='league'?`pontos corridos, ${p.double?'turno e returno':'turno único'}`:p.type==='ko'?`mata-mata, ${p.legs===2?'ida e volta (final em jogo único)':'jogo único'}`:`${p.groups} grupos (${p.double?'ida e volta':'turno único'}), ${p.adv} por grupo avançam ao mata-mata ${p.legs===2?'ida e volta':'em jogo único'}`;
 function validFormat(f,n){const t=f?.type;if(!['league','ko','groups'].includes(t))throw fail('Formato inválido');
  if(t==='league')return {type:t,double:!!f.double};
  if(t==='ko')return {type:t,legs:+f.legs===2?2:1};
  const g=Math.floor(+f.groups),adv=Math.floor(+f.adv||2);if(!(g>=2&&g<=16))throw fail('Grupos: de 2 a 16');if(n/g<3)throw fail(`Com ${n} times cabem no máximo ${Math.floor(n/3)} grupos (mínimo 3 por grupo)`);
  if(!(adv>=1&&adv<Math.floor(n/g)))throw fail('Classificados por grupo: pelo menos 1 e menos que o tamanho do grupo');return {type:t,groups:g,adv,double:!!f.double,legs:+f.legs===2?2:1};}
 // ---------- criação ----------
 function plan(body){const name=String(body?.name||'').trim();if(name.length<3||name.length>60)throw fail('Nome de 3 a 60 caracteres');
  const women=!!body.women;const ids=[...new Set((body.clubs||[]).map(Number))];
  for(const id of ids){const c=CL.get(id);if(!c)throw fail('Clube inválido: '+id);if(!women&&c.gender!=='M')throw fail(c.name+' é feminino: marque "incluir femininos"');}
  if(ids.length<2||ids.length>64)throw fail('Escolha de 2 a 64 clubes');
  const main={key:'main',name,...validFormat(body.format,ids.length),clubs:byOver(ids)};const parts=[main];
  if(body.cup&&ids.length>=4)parts.push({key:'cup',name:'Copa '+name,type:'ko',legs:1,clubs:byOver(ids)});
  if(body.intl?.enabled){const size=+body.intl.size;if(![4,8,16,32].includes(size))throw fail('Internacional: 4, 8, 16 ou 32 clubes');
   const from=Math.max(1,Math.min(+body.intl.from||Math.min(size/2,ids.length),ids.length,size));const inn=byOver(ids).slice(0,from);
   const gender=women?null:'M';const pool=[...CL.values()].filter(c=>!ids.includes(c.id)&&(!gender||c.gender===gender)&&c.n_players>=16).sort((a,b)=>b.over-a.over).slice(0,size-from).map(c=>c.id);
   const type=body.intl.type==='groups'&&size>=8?'groups':'ko';
   parts.push({key:'intl',name:String(body.intl.name||'Copa Continental ZC').slice(0,40),type,legs:1,double:false,groups:type==='groups'?size/4:0,adv:2,clubs:byOver([...inn,...pool]),from});}
  return {name,women,parts};}
 const ins=(c,comp,part,round,stage,pairs,tieBase=0,leg=1)=>pairs.length?c.query(`INSERT INTO custom_matches(comp_id,part,round,stage,tie,leg,home,away) SELECT $1,$2,$3,$4,t,$5,h,a FROM unnest($6::int[],$7::int[],$8::int[]) AS x(t,h,a)`,
  [comp,part,round,stage,leg,pairs.map((_,i)=>tieBase+i+1),pairs.map(p=>p[0]),pairs.map(p=>p[1])]):null;
 async function drawKo(c,id,p,st,alive){const n=alive.length;if(n<=1){st.done=true;st.champion=alive[0]??null;return;}
  const P=2**Math.floor(Math.log2(n));let play=alive,bye=[],stage=KON[n]||'Mata-mata';
  if(n>P){const s=byOver(alive),k=n-P;play=s.slice(n-2*k);bye=s.slice(0,n-2*k);stage='Preliminar';}
  const sh=shuffle(play),pairs=[];for(let i=0;i+1<sh.length;i+=2)pairs.push([sh[i],sh[i+1]]);
  const legs=p.legs===2&&play.length>2?2:1,r=st.round+1;await ins(c,id,p.key,r,stage+(legs===2?' · ida':''),pairs,0,1);
  if(legs===2)await ins(c,id,p.key,r+1,stage+' · volta',pairs.map(([a,b])=>[b,a]),0,2);
  st.round=r+legs-1;st.cur={from:r,legs,bye,stage};st.phase='ko';}
 async function initPart(c,id,p,st){st.round=0;st.done=false;st.champion=null;
  if(p.type==='league'){const R=rr(shuffle(p.clubs),p.double);for(let i=0;i<R.length;i++)await ins(c,id,p.key,i+1,'Rodada '+(i+1),R[i]);st.round=R.length;st.phase='league';}
  else if(p.type==='groups'){const g=p.groups,G2={},L='ABCDEFGHIJKLMNOP';const s=byOver(p.clubs);s.forEach((cid,i)=>{const row=Math.floor(i/g),k=row%2?g-1-i%g:i%g;(G2[L[k]]??=[]).push(cid);});
   st.groups=G2;let maxR=0;for(const [k,ids] of Object.entries(G2)){const R=rr(shuffle(ids),p.double);for(let i=0;i<R.length;i++)await ins(c,id,p.key,i+1,'Grupo '+k,R[i],i*100);maxR=Math.max(maxR,R.length);}st.round=maxR;st.phase='groups';}
  else await drawKo(c,id,p,st,[...p.clubs]);}
 async function create(body,uid,parent=null,season=1){const P=plan(body);return tx(async c=>{
  const [row]=(await c.query('INSERT INTO custom_comps(name,cfg,state,season,parent_id,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[P.name,JSON.stringify({...body,parts:P.parts,women:P.women}),'{}',season,parent,uid])).rows;
  const state={parts:{}};for(const p of P.parts){state.parts[p.key]={};await initPart(c,row.id,p,state.parts[p.key]);}
  await c.query('UPDATE custom_comps SET state=$2 WHERE id=$1',[row.id,JSON.stringify(state)]);return row.id;});}
 // ---------- simulação ----------
 const tieWinner=(ms)=>{if(ms.length===1){const m=ms[0];return m.hg>m.ag?m.home:m.ag>m.hg?m.away:(()=>{const [a,b]=m.pens.split('-').map(Number);return a>b?m.home:m.away;})();}
  const [l1,l2]=[ms.find(m=>m.leg===1),ms.find(m=>m.leg===2)];const A=l1.home,B=l1.away,ga=l1.hg+l2.ag,gb=l1.ag+l2.hg;if(ga!==gb)return ga>gb?A:B;const [h,a]=l2.pens.split('-').map(Number);return h>a?l2.home:l2.away;};
 async function advance(c,id,p,st){const ms=(await c.query('SELECT * FROM custom_matches WHERE comp_id=$1 AND part=$2',[id,p.key])).rows;
  if(ms.some(m=>!m.played))return;
  if(st.phase==='league'){const t=C.standings(ms,p.clubs,cname);st.done=true;st.champion=t[0].club_id;return;}
  if(st.phase==='groups'){const qual=[];for(const [k,ids] of Object.entries(st.groups)){const t=C.standings(ms.filter(m=>m.stage==='Grupo '+k),ids,cname);qual.push(...t.slice(0,p.adv).map(x=>x.club_id));}
   st.qualified=qual;return drawKo(c,id,p,st,qual);}
  const cur=ms.filter(m=>m.round>=st.cur.from&&m.round<st.cur.from+st.cur.legs);const ties={};cur.forEach(m=>(ties[m.tie]??=[]).push(m));
  const win=Object.values(ties).map(tieWinner);return drawKo(c,id,p,st,[...st.cur.bye,...win]);}
 async function next(id){return tx(async c=>{const [comp]=(await c.query('SELECT * FROM custom_comps WHERE id=$1 FOR UPDATE',[id])).rows;if(!comp)throw fail('Campeonato não encontrado',404);
  if(comp.status==='finished')return {finished:true,played:0};const st=comp.state;let played=0;
  for(const p of comp.cfg.parts){const ps=st.parts[p.key];if(ps.done)continue;
   const [{r}]=(await c.query('SELECT min(round) r FROM custom_matches WHERE comp_id=$1 AND part=$2 AND NOT played',[id,p.key])).rows;
   if(r!=null){const ms=(await c.query('SELECT * FROM custom_matches WHERE comp_id=$1 AND part=$2 AND round=$3 AND NOT played',[id,p.key,r])).rows;
    const ko=ps.phase==='ko';const leg1=ko?new Map((await c.query('SELECT * FROM custom_matches WHERE comp_id=$1 AND part=$2 AND leg=1 AND round=$3',[id,p.key,r-1])).rows.map(m=>[m.tie,m])):new Map();
    const out=ms.map(m=>{const x=S.playMatch(team(m.home),team(m.away));let pens=null;
     if(ko){let draw=x.hg===x.ag;if(m.leg===2){const l=leg1.get(m.tie);draw=l&&(l.hg+x.ag===l.ag+x.hg);}if(draw)pens=C.penalties().join('-');}
     const goals=(x.events||[]).filter(e=>e.scorer&&!e.og).map(e=>[e.scorer,e.club]);return [m.id,x.hg,x.ag,pens,JSON.stringify(goals)];});
    await c.query('UPDATE custom_matches m SET hg=x.hg,ag=x.ag,pens=x.pens,goals=x.g::jsonb,played=true FROM unnest($1::int[],$2::int[],$3::int[],$4::text[],$5::text[]) AS x(id,hg,ag,pens,g) WHERE m.id=x.id',
     [out.map(o=>o[0]),out.map(o=>o[1]),out.map(o=>o[2]),out.map(o=>o[3]),out.map(o=>o[4])]);played+=out.length;}
   await advance(c,id,p,ps);}
  const fin=comp.cfg.parts.every(p=>st.parts[p.key].done);
  await c.query(`UPDATE custom_comps SET state=$2,status=$3,finished_at=CASE WHEN $3='finished' THEN now() ELSE finished_at END WHERE id=$1`,[id,JSON.stringify(st),fin?'finished':'running']);
  return {played,finished:fin};});}
 async function all(id){let tot=0;for(let i=0;i<400;i++){const r=await next(id);tot+=r.played;if(r.finished)return {played:tot,finished:true};}return {played:tot,finished:false};}
 async function again(id,uid){const [comp]=await q('SELECT * FROM custom_comps WHERE id=$1',[id]);if(!comp)throw fail('Campeonato não encontrado',404);if(comp.status!=='finished')throw fail('O campeonato ainda não terminou');
  const {parts,...body}=comp.cfg;return create(body,uid,comp.id,comp.season+1);}
 // ---------- leitura ----------
 const named=m=>({...m,home_name:cname(m.home),away_name:cname(m.away),goals:undefined});
 async function list(){return (await q('SELECT id,name,season,status,cfg,state,created_at,finished_at FROM custom_comps ORDER BY id DESC')).map(c=>({id:c.id,name:c.name,season:c.season,status:c.status,created_at:c.created_at,
  n_clubs:c.cfg.parts[0].clubs.length,format:FMT_TXT(c.cfg.parts[0]),parts:c.cfg.parts.map(p=>p.name),champion:c.state.parts?.main?.champion?{id:c.state.parts.main.champion,name:cname(c.state.parts.main.champion)}:null}));}
 async function view(id){const [c]=await q('SELECT * FROM custom_comps WHERE id=$1',[id]);if(!c)throw fail('Campeonato não encontrado',404);
  const ms=await q('SELECT * FROM custom_matches WHERE comp_id=$1 ORDER BY part,round,tie,id',[id]);
  const parts=c.cfg.parts.map(p=>{const st=c.state.parts[p.key]||{};const pm=ms.filter(m=>m.part===p.key);const out={key:p.key,name:p.name,type:p.type,format:FMT_TXT(p),legs:p.legs,done:!!st.done,phase:st.phase,
   champion:st.champion?{id:st.champion,name:cname(st.champion)}:null,clubs:p.clubs.map(id=>({id,name:cname(id),over:over(id),league:CL.get(id)?.league})),matches:pm.map(named),from:p.from||null};
   if(p.type==='league')out.table=C.standings(pm,p.clubs,cname);
   if(p.type==='groups'&&st.groups)out.groups=Object.entries(st.groups).map(([k,ids])=>({name:'Grupo '+k,table:C.standings(pm.filter(m=>m.stage==='Grupo '+k),ids,cname)}));
   const sc={};for(const m of pm)for(const [pid,cid] of (m.goals||[])){const k=pid+':'+cid;(sc[k]??={id:pid,name:pname.get(pid)?.name||'?',club_id:cid,club:cname(cid),g:0}).g++;}
   out.scorers=Object.values(sc).sort((a,b)=>b.g-a.g||a.name.localeCompare(b.name)).slice(0,20);return out;});
  return {id:c.id,name:c.name,season:c.season,status:c.status,parent_id:c.parent_id,created_at:c.created_at,finished_at:c.finished_at,women:!!c.cfg.women,parts};}
 const clubs=({league,q:t,women})=>{t=String(t||'').trim().toLowerCase();return [...CL.values()].filter(c=>(women||c.gender==='M')&&(!league||c.league===league)&&(!t||c.name.toLowerCase().includes(t)))
  .sort((a,b)=>b.over-a.over).slice(0,league?80:60).map(c=>({id:c.id,name:c.name,league:c.league,gender:c.gender,over:c.over,n_players:c.n_players}));};
 const leagues=women=>LEAGUES.filter(l=>women||l.gender==='M');
 return {create,next,all,again,list,view,clubs,leagues,plan,rr,remove:id=>q('DELETE FROM custom_comps WHERE id=$1',[id])};};
