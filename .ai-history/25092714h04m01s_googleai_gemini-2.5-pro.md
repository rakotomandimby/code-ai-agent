# Improve `./code-ai-agent/googleai-agent/src/main.ts` to create and insert data in SQLite database

I want to enhance the existing Express server in `./code-ai-agent/googleai-agent/src/main.ts`.
I want that when the server receives a POST request on the `/` path and the body has a "type" field with value "api key",
then the server creates a new SQLite database (if it does not exist), 
create a "config" table with 3 columns (id, key, value),
then insert the recors ("api_key", <value of "text" field in the request body>) in that table,

Tell me the "npm install" command to issue and the full new content of the files I need to modify in order to have that.



# GGL Implement SQLite database integration for API key storage

I will enhance the `googleai-agent` service to store an API key in a SQLite database. The implementation will handle a `POST` request at the `/` endpoint. When the request body contains `{ "type": "api key", "text": "..." }`, the server will connect to a SQLite database, create a `config` table if it doesn't exist, and insert or update the API key.

First, you need to add the necessary dependencies to your project for handling SQLite databases. Open your terminal in the root of the monorepo (`./code-ai-agent/`) and run the following commands:

```bash
npm install sqlite sqlite3
npm install -D @types/sqlite3
```

This will install the `sqlite` promise-based wrapper, the `sqlite3` driver, and the corresponding type definitions for TypeScript.

Below is the list of files that I will modify to implement this feature.

### Modified Files

1.  `./code-ai-agent/googleai-agent/src/main.ts`

---

### `./code-ai-agent/googleai-agent/src/main.ts`

I have updated this file to include the logic for database initialization and handling the API key storage request. The server now uses the `express.json()` middleware to parse JSON request bodies. Before starting the server, it initializes a SQLite database connection and ensures the `config` table exists. The `POST /` route handler is updated to check for the specific request body and store the API key accordingly.

**Note:** This implementation assumes that the directory `googleai-agent/src/assets/` exists, as it is configured in your `project.json` to be copied to the build output. Please create this directory if it does not exist.

```typescript
import express from 'express';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

// --- Database Setup ---

// Define the path for the SQLite database file within the assets directory.
// This ensures it's copied to the 'dist' folder during the build process.
const dbPath = path.join(__dirname, 'assets', 'googleai-agent.db');
let db: Database;

/**
 * Initializes the SQLite database.
 * It opens a connection and creates the 'config' table if it doesn't exist.
 */
async function initializeDatabase() {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    console.log('Connected to the SQLite database.');

    // SQL statement to create the 'config' table.
    // 'key' is set to UNIQUE to prevent duplicate configuration keys.
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL
      )
    `;

    await db.exec(createTableSql);
    console.log('Table "config" is ready.');
  } catch (err) {
    console.error('Error initializing database:', err.message);
    // Exit the process with an error code if the database cannot be initialized.
    process.exit(1);
  }
}

// --- Express Server Setup ---

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 5000;

const app = express();

// Add middleware to parse JSON request bodies.
app.use(express.json());

/**
 * Route handler for POST requests to '/'.
 * It handles storing an API key when the request body matches the criteria.
 */
app.post('/', async (req, res) => {
  const { type, text } = req.body;

  // Check if the request is for storing an API key.
  if (type === 'api key') {
    if (!text) {
      return res
        .status(400)
        .json({ message: 'Missing "text" field for api key.' });
    }

    try {
      const key = 'api_key';
      const value = text;

      // Use 'INSERT ... ON CONFLICT' (UPSERT) to either insert a new api_key
      // or update the existing one.
      const upsertSql = `
        INSERT INTO config (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `;

      const result = await db.run(upsertSql, [key, value]);

      console.log(
        `API key stored/updated successfully. Rows affected: ${result.changes}`
      );
      return res.status(201).json({ message: 'API key stored successfully.' });
    } catch (err) {
      console.error('Error storing API key:', err.message);
      return res.status(500).json({ message: 'Failed to store API key.' });
    }
  }

  // Default response for other POST requests.
  res.json({ message: 'GoogleAI Agent is running' });
  console.log('Received a POST request at /');
});

/**
 * Main function to start the application.
 * It initializes the database and then starts the Express server.
 */
async function startServer() {
  await initializeDatabase();
  app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
  });
}

startServer();
```

GoogleAI gemini-2.5-pro (3k in, 1k out)


