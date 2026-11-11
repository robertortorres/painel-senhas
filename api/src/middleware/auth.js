const jwt = require('jsonwebtoken');
const db = require('../models/db');
const { jwtSecret } = require('../config');
const { erro, inteiroPositivo } = require('../lib/http');

// Valida o token e recarrega o usuário do banco: desativação e troca de perfil valem na hora
async function auth(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) return res.status(401).json({ erro: 'Token não enviado' });
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
  const [[usuario]] = await db.query(
    'SELECT id, nome, login, perfil, unidade_id FROM usuarios WHERE id = ? AND ativo = 1', [payload.id]);
  if (!usuario) return res.status(401).json({ erro: 'Usuário inativo ou inexistente' });
  req.usuario = usuario;
  next();
}

function perfil(...perfis) {
  return (req, res, next) => {
    if (req.usuario.perfil !== 'admin_global' && !perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Sem permissão' });
    }
    next();
  };
}

const ehGlobal = req => req.usuario.perfil === 'admin_global';

// Unidade que a requisição pode acessar. admin_global escolhe; os demais ficam presos à própria.
function unidadeDaRequisicao(req, informada) {
  const temInformada = informada !== undefined && informada !== null && informada !== '';
  if (ehGlobal(req)) {
    return inteiroPositivo(temInformada ? informada : req.usuario.unidade_id, 'unidade_id');
  }
  if (!req.usuario.unidade_id) throw erro(403, 'Usuário sem unidade vinculada');
  if (temInformada && Number(informada) !== Number(req.usuario.unidade_id)) {
    throw erro(403, 'Sem acesso a esta unidade');
  }
  return Number(req.usuario.unidade_id);
}

// Para recursos buscados por id: responde 404 se for de outra unidade
function garantirUnidade(req, unidadeId) {
  if (!ehGlobal(req) && Number(unidadeId) !== Number(req.usuario.unidade_id)) {
    throw erro(404, 'Não encontrado');
  }
}

module.exports = { auth, perfil, ehGlobal, unidadeDaRequisicao, garantirUnidade };
