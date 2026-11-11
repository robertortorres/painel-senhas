const bcrypt = require('bcryptjs');
const db = require('../models/db');
const { adminSenhaInicial } = require('../config');

// Cria o admin só quando o banco não tem nenhum usuário (primeira instalação)
module.exports = async function bootstrapAdmin() {
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM usuarios');
  if (Number(total) > 0) return;
  if (adminSenhaInicial.length < 8) {
    console.warn('[bootstrap] Nenhum usuário cadastrado. Defina ADMIN_SENHA_INICIAL (mín. 8 caracteres) no .env e reinicie a API.');
    return;
  }
  const [[unidade]] = await db.query('SELECT id FROM unidades ORDER BY id LIMIT 1');
  const hash = await bcrypt.hash(adminSenhaInicial, 10);
  await db.query(
    "INSERT INTO usuarios (unidade_id, nome, login, senha_hash, perfil) VALUES (?, 'Administrador', 'admin', ?, 'admin_global')",
    [unidade ? unidade.id : null, hash]);
  console.log('[bootstrap] Usuário "admin" criado com a senha de ADMIN_SENHA_INICIAL. Troque após o primeiro acesso.');
};
