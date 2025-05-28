const { Pool, Client } = require("pg");
const dotenv = require("dotenv");
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const dbName = databaseUrl.split('/').pop().split('?')[0];

// Connect to default "postgres" DB to create the app DB if needed
const adminClient = new Client({
  connectionString: databaseUrl.replace(dbName, "postgres")
});

// Pool for your actual app DB
const dbPool = new Pool({
  connectionString: databaseUrl
});

const ensureDatabase = async () => {
  try {
    await adminClient.connect();

    const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = $1`;
    const result = await adminClient.query(checkDbQuery, [dbName]);

    if (result.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${dbName}`);
      console.log(` Database "${dbName}" has been created.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error(" Failed to ensure database:", err);
  } finally {
    await adminClient.end();
  }
};

const initializeSchema = async () => {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS contact (
      id SERIAL PRIMARY KEY,
      phoneNumber VARCHAR(20),
      email VARCHAR(255),
      linkedId INTEGER REFERENCES contact(id) ON DELETE SET NULL,
      linkPrecedence VARCHAR(10) CHECK (linkPrecedence IN ('primary', 'secondary')) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deletedAt TIMESTAMP NULL
    );
  `;

  try {
    await dbPool.query(createTableSQL);
    console.log(" Schema initialized successfully.");
  } catch (err) {
    console.error(" Failed to create schema:", err);
  }
};

module.exports = {
  dbPool,
  ensureDatabase,
  initializeSchema
};