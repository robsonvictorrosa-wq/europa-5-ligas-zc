// Copas europeias (Champions 36, Europa League 30, Conference 30).
// ETAPA 1: só a CLASSIFICAÇÃO (vagas por país, aprovadas pelo Robson em 23/11/2026) está implementada; o FORMATO das copas é um stub.
// Para plugar o formato na etapa 2: implemente FORMAT.plan(comp, clubs) e FORMAT.nextMatches(comp, played) e marque FORMAT.ready=true.
const CFG=require('./config/europa.json').europe;
// leagues: [{id,key,name,clubs:[{id,name,overall}]}]; rankBy: 'over' (temporada 1) ou 'standings' (rankings: Map leagueId -> [clubIds em ordem])
function qualify(leagues,{rankBy='over',rankings=null,overOf=null}={}){const out={};for(const c of CFG.competitions)out[c.key]=[];const leftovers=[];
 const ov=c=>overOf?overOf(c.id):(+c.overall||0);
 for(const L of leagues){const q=CFG.quota_by_league_size[String(L.clubs.length)];if(!q)throw new Error(`Sem cota europeia para liga de ${L.clubs.length} clubes (${L.name})`);
  let order;if(rankBy==='standings'&&rankings?.get(L.id)){const byId=new Map(L.clubs.map(c=>[c.id,c]));order=rankings.get(L.id).map(id=>byId.get(id)).filter(Boolean);}
  else order=[...L.clubs].sort((a,b)=>ov(b)-ov(a)||a.name.localeCompare(b.name));
  let i=0;for(const c of CFG.competitions){for(let k=0;k<(q[c.key]||0);k++,i++)if(order[i])out[c.key].push({club_id:order[i].id,name:order[i].name,league_id:L.id,league:L.name,pos:i+1,via:'liga'});}
  for(;i<order.length;i++)leftovers.push({club:order[i],L,pos:i+1});}
 // sobras: ordenadas pelo over (config leftover_rank_by), preenchem as vagas restantes na ordem leftover_order
 leftovers.sort((a,b)=>ov(b.club)-ov(a.club)||a.club.name.localeCompare(b.club.name));
 leftovers.forEach((x,j)=>{const k=CFG.leftover_order[j];if(k)out[k].push({club_id:x.club.id,name:x.club.name,league_id:x.L.id,league:x.L.name,pos:x.pos,via:'sobra'});});
 for(const c of CFG.competitions)if(out[c.key].length!==c.size)console.warn(`Europa: ${c.key} com ${out[c.key].length} clubes (esperado ${c.size})`);
 return out;}
const FORMAT={ready:false,note:'Formato das copas europeias (fases, sorteio, datas) será definido na etapa 2.'};
module.exports={CFG,qualify,FORMAT,COMPS:CFG.competitions};
