const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST || 'mysqldb',
  port:     process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'clinicasga',
  user:     process.env.DB_USER || 'sgaapp',
  password: process.env.DB_PASS || 'SGA_App_P4ssW0rd',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '-03:00'
});

module.exports = pool;
