# Make the LLM API keys to be obtained fron the clients. 

Currently, I must set the LLM API keys as environment variables:

- `OPENAI_API_KEY` - OpenAI API authentication
- `GOOGLEAI_API_KEY` - Google AI API authentication  
- `ANTHROPIC_API_KEY` - Anthropic API authentication

I dont like that. I want the clients to provide the API keys in the requests.

I still hesitate on how to do that, because the priority is to have the same architecture as the existing.
So, my first idea is to add a new table to the existing database schema, called `api_key` with the following structure:

```sql
CREATE TABLE api_key (
    id INTEGER,
    value TEXT
)
```

What is your opinion on that? Do not provide any code yet, just your opinion.
If your opinion differs from mine, explain it.


# GGL My opinion on handling API keys via a database table

I have analyzed your proposal to add an `api_key` table to the SQLite database. Your idea is logical as it perfectly aligns with the existing architectural pattern of using the database as a temporary state store for all incoming request data (`system_instruction`, `model_to_use`, etc.). It consistently uses the `Chunk` and `BaseRepository` system, which is a strong argument in its favor.

However, I must advise against this approach due to two significant drawbacks: **security** and **inefficiency**.

### 1. Security Risk

The primary and most critical issue is security. The current implementation stores the SQLite database files in the `/tmp/` directory. Storing sensitive credentials like API keys, even temporarily, in a plaintext file on disk is a major security vulnerability. If the server were ever compromised, or if another process on the same machine had read access to the `/tmp` directory, these keys could be easily exfiltrated. API keys should be treated as secrets and kept in memory for the shortest possible duration, and never written to a persistent or semi-persistent storage medium like a file unless absolutely necessary and properly encrypted.

### 2. Performance and Inefficiency

The second issue is one of performance and necessity. The API key is a piece of authentication data required for a single, transient transaction. The current workflow would be:

1.  Client sends the key in a request body.
2.  The application writes the key to the SQLite database on disk.
3.  A moment later, the application reads the key back from the database on disk to use it in the `AIHttpClient`.
4.  The database is cleared after the transaction.

This round-trip to the disk is unnecessary overhead. The key does not need to be persisted or aggregated like conversation messages. It can be held in memory for the brief period between its reception and its use.

### A More Secure and Efficient Alternative

I propose a solution that slightly modifies the existing flow without a major architectural rewrite. We can handle the API key as a special piece of data that is held in memory at the router level, rather than being passed to the repository.

Here is the proposed flow:

1.  **Modify `createAgentRouter`**: Introduce a variable within the router's scope (e.g., `let apiKey: string | null = null;`) to store the key in memory.
2.  **Capture the Key**: When a POST request arrives, check if it contains an `api_key` property. If it does, store its value in the `apiKey` variable and do not create a `Chunk` for it.
3.  **Pass the Key to the HTTP Client**: Inside the `setTimeout` block, when you create the `aiHttpClient` instance, pass the stored `apiKey` to it through a new method (e.g., `aiHttpClient.setApiKey(apiKey)`).
4.  **Modify `AIHttpClient`**:
    *   Add a new `setApiKey(key: string)` method.
    *   Modify the logic so that if an API key is provided via this method, it is used for authentication. If not, it can fall back to the environment variable (or fail, depending on desired behavior). This maintains backward compatibility.

This approach keeps the API key in memory only for the duration of the request cycle, which is far more secure and efficient. It respects the core architecture for handling conversational state while treating sensitive authentication data with the appropriate care.

I am ready to implement this more secure alternative. Please let me know if you would like me to proceed.

GoogleAI gemini-2.5-pro (16k in, 0k out)


