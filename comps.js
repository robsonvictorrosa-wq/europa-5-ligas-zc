// Competições nacionais: liga (turno e returno) e copa nacional (mata-mata em jogo único) + calendário.
const {leagueSchedule}=require('./leaguesched');const CFG=require('./config/europa.json');
// Liga: turno pelo método de Berger da base (leaguesched.js: mando alternado, nunca 3 seguidos, metade de maior over joga 1 a menos em casa no turno)
// e returno espelhado (mandos invertidos) => cada clube 19/17 em casa e 19/17 fora.
function leagueRounds(clubIds,strength,seed){const t=leagueSchedule(clubIds,strength,seed);return CFG.league.double_round_robin?[...t,...t.map(g=>g.map(([a,b])=>[b,a]))]:t;}
const rng=seed=>{let s=seed>>>0||1;return()=>((s=(s*1664525+1013904223)>>>0)/2**32);};
const shuffle=(a,r)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
// Copa: quantos jogam a preliminar para chegar a 16 (20 -> 8 jogam; 18 -> 4 jogam). Os de menor over jogam.
function cupPrelim(clubIds,strength){const n=clubIds.length;const target=16;if(n<=target)return {play:[],bye:[...clubIds]};
 const k=(n-target)*2;const s=[...clubIds].sort((a,b)=>(strength.get(b)||0)-(strength.get(a)||0)||a-b);return {play:s.slice(n-k),bye:s.slice(0,n-k)};}
// sorteio de pares (jogo único; mando de quem sai primeiro no sorteio)
function drawPairs(ids,seed){const s=shuffle(ids,rng(seed));const out=[];for(let i=0;i+1<s.length;i+=2)out.push([s[i],s[i+1]]);return out;}
function penalties(r=Math.random){let a=0,b=0;for(let i=0;i<5;i++){if(r()<.75)a++;if(a>b+(5-i))break;if(r()<.75)b++;if(b>a+(4-i)||a>b+(4-i))break;}
 while(a===b){const x=r()<.75,y=r()<.75;a+=x;b+=y;}return [a,b];}
// Calendário: sequência de "datas de jogos" (matchdays). Rodada r da liga = matchday; fases da copa entram depois da rodada configurada.
// maxRounds = maior número de rodadas entre as ligas (38).
function matchdays(maxRounds){const md=[];const cup=CFG.cup.rounds;for(let r=1;r<=maxRounds;r++){md.push({kind:'league',round:r});for(const c of cup)if(c.after_league_round===r)md.push({kind:'cup',stage:c.stage,name:c.name});}
 for(const c of cup)if(c.after_league_round>maxRounds)md.push({kind:'cup',stage:c.stage,name:c.name});return md.map((x,i)=>({...x,md:i+1}));}
// data/hora (ISO com fuso de Brasília) do matchday i (1..), a partir da data de início (YYYY-MM-DD) escolhida pelo admin
function kickoff(startDate,i){const sl=CFG.calendar.slots;const day=Math.floor((i-1)/sl.length),t=sl[(i-1)%sl.length];const d=new Date(startDate+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+day);
 return d.toISOString().slice(0,10)+'T'+t+':00'+CFG.calendar.timezone_offset;}
const CUP_STAGES=CFG.cup.rounds.map(r=>r.stage),CUP_NAME=Object.fromEntries(CFG.cup.rounds.map(r=>[r.stage,r.name]));
function standings(matches,clubIds,nameOf=id=>String(id)){const T={};clubIds.forEach(id=>T[id]={club_id:id,name:nameOf(id),j:0,v:0,e:0,d:0,gp:0,gc:0,pts:0,form:[]});
 for(const m of [...matches].filter(m=>m.played).sort((a,b)=>a.round-b.round))for(const [id,f,g] of [[m.home,m.hg,m.ag],[m.away,m.ag,m.hg]]){const t=T[id];if(!t)continue;t.j++;t.gp+=f;t.gc+=g;if(f>g){t.v++;t.pts+=3;t.form.push('V')}else if(f===g){t.e++;t.pts++;t.form.push('E')}else{t.d++;t.form.push('D')}}
 return Object.values(T).map(t=>({...t,sg:t.gp-t.gc,form:t.form.slice(-5)})).sort((a,b)=>b.pts-a.pts||b.v-a.v||b.sg-a.sg||b.gp-a.gp||a.name.localeCompare(b.name)).map((t,i)=>({...t,pos:i+1}));}
module.exports={leagueRounds,cupPrelim,drawPairs,penalties,matchdays,kickoff,CUP_STAGES,CUP_NAME,standings,rng,shuffle};
