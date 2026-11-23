// Cargos (Robson 23/11/2026): membro < moderador < admin. Guardados em users.role (Postgres).
// Admins fixos (Robshow + ADMIN_APELIDOS no Render, ver admins.js) são sempre admin e não podem ser rebaixados.
// Reuso: const need=require('./roles').guard(auth); app.post('/rota', need('moderador'), handler)
const ADM=require('./admins');
const ROLES=['membro','moderador','admin'],RANK={membro:0,moderador:1,admin:2};
const LABEL={membro:'Membro',moderador:'Moderador',admin:'Administrador'};
const isFixed=nick=>ADM().includes(String(nick||'').trim().toLowerCase());
// cargo efetivo de uma linha de users ({nick, role, is_admin})
function roleOf(u){if(!u)return null;if(isFixed(u.nick))return 'admin';return RANK[u.role]!=null?u.role:(u.is_admin?'admin':'membro');}
const can=(u,min)=>!!u&&RANK[u.role||roleOf(u)]>=RANK[min];
// middleware: exige login (auth) e cargo mínimo; responde 403 se o cargo não basta
const guard=auth=>min=>(r,s,n)=>auth(r,s,()=>can(r.user,min)?n():s.status(403).json({error:min==='admin'?'Só administradores':'Só moderadores ou administradores'}));
module.exports={ROLES,RANK,LABEL,isFixed,roleOf,can,guard};
