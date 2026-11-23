// Verba inicial (regra aprovada pelo Robson em 23/11/2026, mesma da Libertadores ZC 50, escala ajustada):
// over para verba = média dos 18 maiores overs do elenco inicial FC27 (desempate: média dos 11 maiores).
// O clube de maior over recebe € 0; cada ponto de over abaixo dele vale + € 32,5 mi;
// arredondado para o múltiplo de € 25 mi mais próximo, com teto de € 500 mi. Parâmetros em config/europa.json -> budget.
function overN(ovs,n){const a=ovs.filter(x=>x!=null).map(Number).sort((x,y)=>y-x).slice(0,n);return a.length?a.reduce((s,x)=>s+x,0)/a.length:0;}
function budgetOf(over,top,{per_point=32.5e6,step=25e6,min=0,max=5e8}={}){const v=(top-over)*per_point;return Math.max(min,Math.min(max,Math.round(v/step)*step));}
// clubs: [{id, ovs:[overall dos jogadores]}] -> Map(id -> {over18, over11, budget}) ; ordem: over18 desc, desempate over11 desc
function budgets(clubs,cfg={}){const n=cfg.top_n||18,tb=cfg.tiebreak_n||11;
 const rows=clubs.map(c=>({id:c.id,over18:overN(c.ovs,n),over11:overN(c.ovs,tb)}));rows.sort((a,b)=>b.over18-a.over18||b.over11-a.over11);
 const top=rows.length?rows[0].over18:0;return new Map(rows.map((r,i)=>[r.id,{...r,rank:i+1,budget:budgetOf(r.over18,top,cfg)}]));}
module.exports={overN,budgetOf,budgets};
