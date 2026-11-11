require('dotenv').config();

function obrigatoria(nome) {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`[config] Variável de ambiente ${nome} não definida. Abortando.`);
    process.exit(1);
  }
  return valor;
}

const jwtSecret = obrigatoria('JWT_SECRET');
if (jwtSecret.length < 32) {
  console.error('[config] JWT_SECRET precisa ter pelo menos 32 caracteres. Abortando.');
  process.exit(1);
}

const inteiro = (v, padrao) => {
  const n = parseInt(v, 10);
  return Number.isInteger(n) ? n : padrao;
};

module.exports = {
  port: inteiro(process.env.PORT, 3001),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  trustProxy: inteiro(process.env.TRUST_PROXY, 1),
  db: {
    host: process.env.DB_HOST || 'mysqldb',
    port: inteiro(process.env.DB_PORT, 3306),
    database: process.env.DB_NAME || 'clinicasga',
    user: process.env.DB_USER || 'sgaapp',
    password: obrigatoria('DB_PASS'),
  },
  // 0 = prioritário sempre antes dos normais; N = 1 prioritário a cada N normais
  prioridadeACada: Math.max(0, inteiro(process.env.PRIORIDADE_A_CADA, 0)),
  limiteSenhasPorMinuto: Math.max(1, inteiro(process.env.LIMITE_SENHAS_MINUTO, 30)),
  adminSenhaInicial: process.env.ADMIN_SENHA_INICIAL || '',
};
