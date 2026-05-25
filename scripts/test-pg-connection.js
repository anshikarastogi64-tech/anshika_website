/**
 * Test PostgreSQL Connection
 * Verify that RDS PostgreSQL is accessible and working
 */

require('dotenv').config();
const { query, getOne, getAll, close } = require('../lib/db-postgres');

async function testPostgreSQLConnection() {
  console.log('🧪 Testing PostgreSQL Connection...\n');

  console.log('Configuration:');
  console.log(`- Database URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`- Host: ${process.env.DB_HOST || 'Not set'}`);
  console.log(`- Database: ${process.env.DB_NAME || 'Not set'}`);
  console.log('');

  try {
    // Test 1: Basic connection
    console.log('🔌 Test 1: Basic connection...');
    const result = await query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('✅ Connection successful!');
    console.log(`   Time: ${result.rows[0].current_time}`);
    console.log(`   Version: ${result.rows[0].postgres_version}`);
    console.log('');

    // Test 2: Check database
    console.log('📊 Test 2: Check database info...');
    const dbInfo = await getOne(
      `SELECT
        current_database() as db_name,
        current_user as db_user,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port`
    );
    console.log('✅ Database info retrieved!');
    console.log(`   Database: ${dbInfo.db_name}`);
    console.log(`   User: ${dbInfo.db_user}`);
    console.log(`   Server: ${dbInfo.server_ip}:${dbInfo.server_port}`);
    console.log('');

    // Test 3: Create test table
    console.log('🛠️  Test 3: Create test table...');
    await query(`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Test table created!');
    console.log('');

    // Test 4: Insert data
    console.log('📝 Test 4: Insert test data...');
    const insertResult = await query(
      'INSERT INTO connection_test (message) VALUES ($1) RETURNING id, message, created_at',
      ['Hello from Anshika Website!']
    );
    console.log('✅ Data inserted!');
    console.log(`   ID: ${insertResult.rows[0].id}`);
    console.log(`   Message: ${insertResult.rows[0].message}`);
    console.log('');

    // Test 5: Query data
    console.log('🔍 Test 5: Query test data...');
    const rows = await getAll('SELECT * FROM connection_test ORDER BY id DESC LIMIT 5');
    console.log(`✅ Found ${rows.length} row(s)`);
    rows.forEach(row => {
      console.log(`   - [${row.id}] ${row.message} (${row.created_at})`);
    });
    console.log('');

    // Test 6: Update data
    console.log('✏️  Test 6: Update test data...');
    await query(
      'UPDATE connection_test SET message = $1 WHERE id = $2',
      ['Updated message', insertResult.rows[0].id]
    );
    console.log('✅ Data updated!');
    console.log('');

    // Test 7: Delete data
    console.log('🗑️  Test 7: Delete test data...');
    await query('DELETE FROM connection_test WHERE id = $1', [insertResult.rows[0].id]);
    console.log('✅ Data deleted!');
    console.log('');

    // Test 8: Drop test table
    console.log('🧹 Test 8: Cleanup...');
    await query('DROP TABLE IF EXISTS connection_test');
    console.log('✅ Test table dropped!');
    console.log('');

    console.log('🎉 All PostgreSQL tests passed!\n');
    console.log('Next steps:');
    console.log('1. Set USE_POSTGRES=true in .env (when ready to switch)');
    console.log('2. Run database migration: node scripts/migrate-database.js');
    console.log('3. Test application thoroughly');

  } catch (error) {
    console.error('❌ PostgreSQL test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check DATABASE_URL is correct in .env');
    console.error('2. Verify RDS instance is running');
    console.error('3. Check security group allows EC2 access');
    console.error('4. Confirm database user has proper permissions');
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  } finally {
    await close();
  }
}

testPostgreSQLConnection();
