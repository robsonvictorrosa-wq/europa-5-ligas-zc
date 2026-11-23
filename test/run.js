// Testes: unidade (sempre) + E2E se E2E_BASE estiver definido (servidor com Postgres descartável).
// Uso: node test/run.js   |   E2E_BASE=http://localhost:3150 E2E_ADMIN_PIN=... node test/run.js
const assert=require('assert');const C=require('../comps'),EU=require('../europa'),B=require('../budget');
// --- unidade ---
{const ids=[...Array(20).keys()].map(i=>i+1),st=new Map(ids.map(i=>[i,100-i]));const R=C.leagueRounds(ids,st,1);assert.equal(R.length,38);
 const pairs=new Set(R.flat().map(([a,b])=>a+'-'+b));assert.equal(pairs.size,380);for(const id of ids)assert.equal(R.flat().filter(([a])=>a===id).length,19);
 const R18=C.leagueRounds(ids.slice(0,18),st,2);assert.equal(R18.length,34);
 assert.equal(C.cupPrelim(ids,st).play.length,8);assert.equal(C.cupPrelim(ids.slice(0,18),st).play.length,4);}
{const mk=(id,n)=>({id,name:'L'+id,clubs:[...Array(n).keys()].map(i=>({id:id*100+i,name:'c'+id+'_'+i,overall:90-i-id*0.1}))});
 const Q=EU.qualify([mk(1,20),mk(2,20),mk(3,20),mk(4,18),mk(5,18)]);assert.equal(Q.UCL.length,36);assert.equal(Q.UEL.length,30);assert.equal(Q.UECL.length,30);
 const all=[...Q.UCL,...Q.UEL,...Q.UECL].map(x=>x.club_id);assert.equal(new Set(all).size,96);
 assert.equal(Q.UCL.filter(x=>x.via==='sobra').length,1);assert.equal(Q.UEL.filter(x=>x.via==='sobra').length,2);assert.equal(Q.UECL.filter(x=>x.via==='sobra').length,2);}
{const m=B.budgets([{id:1,overall:88},{id:2,overall:71},{id:3,overall:80}],{min:0,max:5e8,step:5e7});assert.equal(m.get(1),0);assert.equal(m.get(2),5e8);assert.ok(m.get(3)>0&&m.get(3)<5e8);}
{const mk=(id,n)=>({id,name:'L'+id,clubs:[...Array(n).keys()].map(i=>({id:id*100+i,name:'c'+id+'_'+i,overall:90-i-id*0.1}))});const Ls=[mk(1,20),mk(2,20),mk(3,20),mk(4,18),mk(5,18)];
 const rk=new Map(Ls.map(L=>[L.id,L.clubs.map(c=>c.id).reverse()])); // classificação invertida em relação ao over
 const cnt=Q=>['UCL','UEL','UECL'].map(k=>Q[k].length).join('/');const tier=(Q,id)=>['UCL','UEL','UECL'].find(k=>Q[k].some(x=>x.club_id===id));
 const base=EU.qualify(Ls,{rankBy:'standings',rankings:rk});assert.equal(cnt(base),'36/30/30');assert.equal(tier(base,119),'UCL');assert.equal(tier(base,100),'UCL'); // 100 = último (sobra de maior over)
 // campeões: copa nacional da liga 1 = 105 (UECL pela liga), liga 2 = 219 (já UCL pela liga), UEL campeão = 310 (UEL) e UECL campeão = 405 (UECL)
 const Q=EU.qualify(Ls,{rankBy:'standings',rankings:rk,champions:{national_cup:[105,219],UEL:310,UECL:405}});assert.equal(cnt(Q),'36/30/30');
 assert.equal(tier(Q,105),'UCL');assert.equal(tier(Q,219),'UCL');assert.equal(tier(Q,310),'UCL');assert.equal(tier(Q,405),'UEL');
 assert.equal(new Set(['UCL','UEL','UECL'].flatMap(k=>Q[k].map(x=>x.club_id))).size,96);
 assert.ok(Q._moves.find(m=>m.club_id===219).kept);}
console.log('unidade OK');
// --- E2E ---
(async()=>{const BASE=process.env.E2E_BASE;if(!BASE)return;const PIN=process.env.E2E_ADMIN_PIN;
 const call=async(m,u,b,t)=>{const r=await fetch(BASE+u,{method:m,headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{})},body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(m+' '+u+' '+r.status+' '+JSON.stringify(j));return j;};
 const nick='teste'+Date.now()%1e6;const reg=await call('POST','/api/auth/register',{nick,pin:'9999'});const T=reg.token;
 const lg=await call('GET','/api/leagues');assert.equal(lg.length,5);let tot=0;for(const l of lg){const d=await call('GET','/api/leagues/'+l.id);tot+=d.clubs.length;for(const c of d.clubs)assert.ok(c.n_players>=16,c.name);}assert.equal(tot,96);
 const eng=await call('GET','/api/leagues/'+lg[0].id);const weak=eng.clubs[eng.clubs.length-1];const club=await call('GET','/api/clubs/'+weak.id);assert.ok(club.squad.length>=16);
 await call('POST','/api/clubs/'+weak.id+'/claim',{},T);const me=await call('GET','/api/me',null,T);assert.equal(me.club_id,weak.id);
 // compra de um jogador de outra liga (bot): oferta alta
 const ita=await call('GET','/api/leagues/'+lg[2].id);const tgt=(await call('GET','/api/clubs/'+ita.clubs[10].id)).squad.slice(-1)[0];
 const of=await call('POST','/api/offers',{player_id:tgt.id,fee:tgt.market_value*3},T);console.log('oferta:',of.msg);
 const AT=(await call('POST','/api/auth/login',{nick:'Robshow',pin:PIN})).token;const am=await call('GET','/api/me',null,AT);assert.ok(am.user.admin);
 const found=await call('GET','/api/admin/fc27?q=Ronaldo',null,AT);assert.ok(found.length>0);const out=found.find(p=>!p.in_game&&!p.in_lot)||found[0];
 await call('POST','/api/admin/auction/lots',{player_id:out.id,min_bid:1e6},AT);await call('POST','/api/admin/auction/open',{},AT);
 const au=await call('GET','/api/auction');const lot=au.lots.find(l=>l.player.id===out.id&&l.status==='open');assert.ok(lot);
 await call('POST','/api/auction/'+lot.id+'/bid',{amount:2e6},T);const cl=await call('POST','/api/admin/auction/close',{},AT);assert.equal(cl.sold.length,1);
 assert.ok((await call('GET','/api/clubs/'+weak.id)).squad.some(p=>p.id===out.id));
 await call('POST','/api/admin/season/schedule',{start_date:'2027-01-10'},AT);const st=await call('GET','/api/state');assert.equal(st.status,'running');
 const fx=(await call('GET','/api/leagues/'+lg[3].id)).fixtures;assert.equal(fx.length,18*17);
 for(let i=0;i<6;i++)await call('POST','/api/admin/season/next',{},AT);
 const t1=(await call('GET','/api/leagues/'+lg[0].id)).table;assert.ok(t1.every(t=>t.j===5),'5 rodadas');
 const cup=await call('GET','/api/cups/'+lg[0].id);assert.equal(cup.matches.filter(m=>m.stage==='prelim'&&m.played).length,4);
 const eu=await call('GET','/api/europe');assert.deepEqual(eu.competitions.map(c=>c.clubs.length),[36,30,30]);
 if(process.env.E2E_FULL){let n=0;while(n++<60){const r=await call('POST','/api/admin/season/next',{},AT);if(r.finished)break;}const s2=await call('GET','/api/state');assert.equal(s2.status,'finished');
  const champs=[];for(const l of lg){const c2=await call('GET','/api/cups/'+l.id);const f=c2.matches.find(m=>m.stage==='final'&&m.winner);assert.ok(f);champs.push(f.winner);}await call('POST','/api/admin/season/new',{confirm:'NOVA TEMPORADA',start_date:'2027-03-01'},AT);
  const s3=await call('GET','/api/state');assert.equal(s3.season,2);assert.equal(s3.status,'running');const e2=await call('GET','/api/europe');assert.deepEqual(e2.competitions.map(c=>c.clubs.length),[36,30,30]);
  assert.equal(new Set(e2.competitions.flatMap(c=>c.clubs.map(x=>x.club_id))).size,96);const ucl=new Set(e2.competitions[0].clubs.map(x=>x.club_id));
  for(const id of champs)assert.ok(ucl.has(id),'campeão da copa nacional na Champions: '+id);
  console.log('Europa T2:',e2.competitions.map(c=>c.key+' '+c.clubs.filter(x=>x.via!=='liga').map(x=>x.name+' ['+x.via+']').join(', ')).join(' | '));}
 await call('POST','/api/admin/season/reset',{confirm:'RESETAR'},AT);const s4=await call('GET','/api/state');assert.equal(s4.status,'pre');
 if(!process.env.E2E_FULL)assert.ok(!(await call('GET','/api/clubs/'+weak.id)).squad.some(p=>p.id===out.id),'reset devolve o leiloado');
 console.log('E2E OK');})().catch(e=>{console.error('FALHOU',e);process.exit(1);});
