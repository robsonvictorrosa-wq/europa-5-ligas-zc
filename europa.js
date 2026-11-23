// Copas europeias (Champions 36, Europa League 30, Conference 30).
// Classificação: temporada 1 pelo over; temporada 2+ pela classificação da liga + bônus de campeão (config/europa.json -> europe).
// O FORMATO das copas é um stub (etapa 2): implemente FORMAT.plan/nextMatches e FORMAT.champions(season) -> {UCL,UEL,UECL} (club_id ou null).
const CFG=require('./config/europa.json').europe;
const TIERS=CFG.competitions.map(c=>c.key); // ['UCL','UEL','UECL'] (0 = mais alta)
// leagues: [{id,name,clubs:[{id,name,overall}]}]; rankBy: 'over' | 'standings' (rankings: Map leagueId -> [clubIds em ordem]);
// champions (temporada 2+): {national_cup:[clubIds], UEL:clubId|null, UECL:clubId|null}
function qualify(leagues,{rankBy='over',rankings=null,overOf=null,champions=null}={}){const out={};for(const k of TIERS)out[k]=[];const leftovers=[];
 const ov=c=>overOf?overOf(c.id):(+c.overall||0);const OV=new Map();
 for(const L of leagues){const q=CFG.quota_by_league_size[String(L.clubs.length)];if(!q)throw new Error(`Sem cota europeia para liga de ${L.clubs.length} clubes (${L.name})`);
  let order;if(rankBy==='standings'&&rankings?.get(L.id)){const byId=new Map(L.clubs.map(c=>[c.id,c]));order=rankings.get(L.id).map(id=>byId.get(id)).filter(Boolean);}
  else order=[...L.clubs].sort((a,b)=>ov(b)-ov(a)||a.name.localeCompare(b.name));
  for(const c of order)OV.set(c.id,ov(c));
  let i=0;for(const k of TIERS){for(let n=0;n<(q[k]||0);n++,i++)if(order[i])out[k].push({club_id:order[i].id,name:order[i].name,league_id:L.id,league:L.name,pos:i+1,via:'liga'});}
  for(;i<order.length;i++)leftovers.push({club:order[i],L,pos:i+1});}
 // sobras (1 por liga): pelo over, nas vagas restantes (leftover_order)
 leftovers.sort((a,b)=>ov(b.club)-ov(a.club)||a.club.name.localeCompare(b.club.name));
 leftovers.forEach((x,j)=>{const k=CFG.leftover_order[j];if(k)out[k].push({club_id:x.club.id,name:x.club.name,league_id:x.L.id,league:x.L.name,pos:x.pos,via:'sobra'});});
 if(champions)applyBonuses(out,champions,OV);
 for(const c of CFG.competitions)if(out[c.key].length!==c.size)console.warn(`Europa: ${c.key} com ${out[c.key].length} clubes (esperado ${c.size})`);
 return out;}
// Bônus de campeão: sobe o campeão para a copa-alvo; o pior colocado (posição na liga desc, depois over asc) de cada copa entre o alvo e a origem
// desce um degrau (cascata), mantendo os tamanhos. Campeões já colocados por bônus não são deslocados. Campeão que já está no alvo ou acima: nada muda.
const VIA={national_cup:'campeão da copa nacional',UEL:'campeão da Europa League',UECL:'campeão da Conference'};
function applyBonuses(out,champions,OV){const tierOf=id=>TIERS.findIndex(k=>out[k].some(x=>x.club_id===id));const prot=new Set();const moves=[];
 for(const b of CFG.champion_bonus||[]){const ids=[].concat(champions[b.from]??[]).filter(x=>x!=null);const to=TIERS.indexOf(b.to);
  for(const id of ids){const from=tierOf(id);if(from<0||from<=to){if(from>=0)moves.push({club_id:id,bonus:b.from,kept:true});continue;}
   const e=out[TIERS[from]].splice(out[TIERS[from]].findIndex(x=>x.club_id===id),1)[0];out[TIERS[to]].push({...e,via:VIA[b.from]});prot.add(id);moves.push({club_id:id,bonus:b.from,from:TIERS[from],to:b.to});
   for(let k=to;k<from;k++){const cand=out[TIERS[k]].filter(x=>!prot.has(x.club_id)).sort((a,b)=>b.pos-a.pos||(OV.get(a.club_id)||0)-(OV.get(b.club_id)||0)||a.name.localeCompare(b.name))[0];
    if(!cand)break;out[TIERS[k]].splice(out[TIERS[k]].indexOf(cand),1);out[TIERS[k+1]].push({...cand,via:'deslocado ('+TIERS[k]+'→'+TIERS[k+1]+')'});}}}
 out._moves=moves;return out;}
const FORMAT={ready:false,note:'Formato das copas europeias (fases, sorteio, datas) será definido na etapa 2.',
 champions:async(/*c,season*/)=>({UEL:null,UECL:null})}; // etapa 2: devolver os campeões da temporada
module.exports={CFG,qualify,applyBonuses,FORMAT,COMPS:CFG.competitions,TIERS};
