// Apelidos administradores: padrão Robshow + variável ADMIN_APELIDOS no Render (separados por vírgula, sem diferenciar maiúsculas).
// Apelidos de admin são reservados: não podem ser cadastrados pela tela; a conta Robshow é criada na subida com o PIN da variável ADMIN_PIN.
const DEFAULT='Robshow';
module.exports=()=>[...new Set((DEFAULT+','+(process.env.ADMIN_APELIDOS||'')).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))];
