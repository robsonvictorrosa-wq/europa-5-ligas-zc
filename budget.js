// Verba inicial (Robson 23/11/2026): maior over = menor verba. Linear entre o maior e o menor over dos 96 clubes,
// na escala da Libertadores ZC (padrão 0 a € 500 mi, degraus de € 50 mi; config/europa.json -> budget).
// verba = min + (max - min) * (overMax - over) / (overMax - overMin), arredondada para o múltiplo de step mais próximo.
function budgetOf(over,{overMax,overMin},{min=0,max=5e8,step=5e7}={}){if(overMax===overMin)return min;
 const v=min+(max-min)*(overMax-over)/(overMax-overMin);return Math.max(min,Math.min(max,Math.round(v/step)*step));}
function budgets(clubs,cfg){const ov=clubs.map(c=>+c.overall||0);const r={overMax:Math.max(...ov),overMin:Math.min(...ov)};return new Map(clubs.map(c=>[c.id,budgetOf(+c.overall||0,r,cfg)]));}
module.exports={budgetOf,budgets};
