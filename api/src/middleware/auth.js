const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ erro: 'Token não enviado' });
  const token = header.split(' ')[1];
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET || 'segredo');
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido' });
  }
}

function perfil(...perfis) {
  return (req, res, next) => {
    if (!perfis.includes(req.usuario.perfil) && req.usuario.perfil !== 'admin_global') {
      return res.status(403).json({ erro: 'Sem permissão' });
    }
    next();
  };
}

module.exports = { auth, perfil };
