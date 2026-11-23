// Simulação em massa do peso do over com os elencos reais do FC27 (mesma escalação/tática da IA do jogo).
// Pares de clubes reais cuja diferença de over do time (média dos 11 maiores) cai em ~+2, ~+5 e ~+10;
// cada par joga ida (forte mandante) e volta (forte visitante). Uso: node scripts/bench-over.js [jogos por faixa=20000]
const D=require('better-sqlite3')(__dirname+'/../data/game.db',{readonly:true});const S=require('../sim'),TT=require('../tactics');
const N=+process.argv[2]||20000;if(process.env.GAIN)S.TUNE.gain=+process.env.GAIN;if(process.env.CAP)S.TUNE.cap=+process.env.CAP;let seed=20261123;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const clubs=D.prepare('SELECT id,name FROM clubs WHERE in_game=1').all().map(c=>{const sq=D.prepare('SELECT * FROM players WHERE club_id=?').all(c.id).map(r=>({...r,positions:JSON.parse(r.positions||'[]'),stats:JSON.parse(r.stats||'{}')}));
 const ai=TT.aiPlan(sq,c.id);const xi=TT.autoXI(sq,ai.formation);const o=sq.map(p=>p.overall).filter(x=>x).sort((a,b)=>b-a).slice(0,11);
 return {...c,over:o.reduce((a,b)=>a+b,0)/o.length,T:{club_id:c.id,xi,bench:sq.filter(p=>!xi.includes(p)),formation:ai.formation,tactics:ai.tactics,form:null}};});
const BANDS={'+2':[1.5,2.5],'+5':[4.5,5.5],'+10':[9,11]};const out={};
for(const [k,[lo,hi]] of Object.entries(BANDS)){const pairs=[];for(const a of clubs)for(const b of clubs){const d=a.over-b.over;if(d>=lo&&d<=hi)pairs.push([a,b]);}
 const acc={home:[0,0,0],away:[0,0,0],g:0,n:0,dd:0};const per=Math.max(1,Math.round(N/2/pairs.length));
 for(const [F,W] of pairs)for(let i=0;i<per;i++){let r=S.playMatch(F.T,W.T,rnd);acc.home[r.hg>r.ag?0:r.hg===r.ag?1:2]++;acc.g+=r.hg+r.ag;
  r=S.playMatch(W.T,F.T,rnd);acc.away[r.ag>r.hg?0:r.ag===r.hg?1:2]++;acc.g+=r.hg+r.ag;acc.n+=2;acc.dd+=2*(F.over-W.over);}
 const pc=a=>{const t=a[0]+a[1]+a[2];return a.map(x=>+(100*x/t).toFixed(1));};
 out[k]={'V/E/D forte (média ida+volta)':pc([0,1,2].map(i=>acc.home[i]+acc.away[i])),forte_mandante:pc(acc.home),forte_visitante:pc(acc.away),gols_por_jogo:+(acc.g/acc.n).toFixed(2),pares:pairs.length,jogos:acc.n,dif_media:+(acc.dd/acc.n).toFixed(2)};}
// gols por jogo num campeonato completo de cada liga (todos contra todos, 1 vez)
let g=0,n=0;for(const a of clubs)for(const b of clubs)if(a.id!==b.id&&D.prepare('SELECT league_id l FROM clubs WHERE id=?').get(a.id).l===D.prepare('SELECT league_id l FROM clubs WHERE id=?').get(b.id).l){const r=S.playMatch(a.T,b.T,rnd);g+=r.hg+r.ag;n++;}
out.liga_gols_por_jogo=+(g/n).toFixed(2);console.log(JSON.stringify(out));
