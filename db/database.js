const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'where2',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return rows && rows.length > 0 && rows[0].ok === 1;
  } catch (error) {
    console.warn('Database unavailable:', error.message);
    return false;
  }
}

async function query(sql, params = []) {
  return pool.execute(sql, params);
}

module.exports = {
  pool,
  query,
  testConnection,
};
