/**
 * PostgreSQL Database Connection
 * Replaces SQLite with PostgreSQL for better scalability
 */

const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // OR individual parameters:
  // host: process.env.DB_HOST,
  // port: process.env.DB_PORT,
  // database: process.env.DB_NAME,
  // user: process.env.DB_USER,
  // password: process.env.DB_PASSWORD,

  // Connection pool settings
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error if connection takes > 2 seconds

  // SSL settings for RDS
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL error:', err);
  process.exit(-1);
});

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 100) {
      console.warn(`⚠️  Slow query (${duration}ms):`, text.substring(0, 100));
    }

    return result;
  } catch (error) {
    console.error('❌ Database query error:', error);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Get a single row
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>}
 */
async function getOne(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

/**
 * Get all rows
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
async function getAll(text, params) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Execute a query (INSERT, UPDATE, DELETE)
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>}
 */
async function run(text, params) {
  return await query(text, params);
}

/**
 * Begin transaction
 * @returns {Promise<Object>} - Transaction client
 */
async function beginTransaction() {
  const client = await pool.connect();
  await client.query('BEGIN');
  return client;
}

/**
 * Commit transaction
 * @param {Object} client - Transaction client
 */
async function commitTransaction(client) {
  await client.query('COMMIT');
  client.release();
}

/**
 * Rollback transaction
 * @param {Object} client - Transaction client
 */
async function rollbackTransaction(client) {
  await client.query('ROLLBACK');
  client.release();
}

/**
 * Close all connections (for graceful shutdown)
 */
async function close() {
  await pool.end();
  console.log('🔌 PostgreSQL connection pool closed');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await close();
  process.exit(0);
});

module.exports = {
  query,
  getOne,
  getAll,
  run,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  close,
  pool, // Export pool for advanced usage
};
