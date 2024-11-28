import express from 'express';
import dotenv from 'dotenv';
import router from './routes';

// Initialize dotenv
dotenv.config();

// Create a new express application instance
const app: express.Application = express();
const port: string | number = process.env.PORT || 4000;

// Middleware to parse JSON bodies
app.use(express.json());

// Use the router
app.use(router);

// Start the server
app.listen(port, () => {
  console.log(`[server]: ChatGPT agent is running at http://0.0.0.0:${port}`);
});
