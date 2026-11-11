const mysql = require('mysql2/promise');
const { db } = require('../config');

// Brasil sem horário de verão desde 2019: offset fixo é seguro
const OFFSET = '-03:00';

const pool = mysql.createPool({
  ...db,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: OFFSET,
});

// Garante que NOW()/CURDATE() usem o horário de Brasília, independente do TZ do servidor MySQL
pool.on('connection', conn => {
  conn.query(`SET time_zone = '${OFFSET}'`);
});

module.exports = pool;
