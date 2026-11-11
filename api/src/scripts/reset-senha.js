// Uso: docker compose exec api node src/scripts/reset-senha.js <login>
// A nova senha é lida da variável NOVA_SENHA ou digitada no terminal (não fica no histórico do shell)
const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../models/db');

function perguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(texto, r => { rl.close(); resolve(r); }));
}

(async () => {
  const login = process.argv[2];
  if (!login) {
    console.error('Uso: node src/scripts/reset-senha.js <login>');
    process.exit(1);
  }
  const senha = process.env.NOVA_SENHA || await perguntar(`Nova senha para "${login}": `);
  if (senha.length < 8) {
    console.error('A senha precisa ter pelo menos 8 caracteres.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(senha, 10);
  const [r] = await db.query('UPDATE usuarios SET senha_hash = ?, ativo = 1 WHERE login = ?', [hash, login]);
  console.log(r.affectedRows ? `Senha de "${login}" atualizada.` : `Usuário "${login}" não encontrado.`);
  await db.end();
  process.exit(r.affectedRows ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(1); });
