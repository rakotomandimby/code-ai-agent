# Code review 

Review the codebase and tell me what you think about it.


### High-level impressions
The repo is tidy and modular. All three “agents” share a common library (`@code-ai-agent/lib`) that abstracts Express wiring, database access, and prompt handling, so each provider-specific app only has to focus on building the request payload and calling its respective API. The SQLite wrapper and the ability to swap the store via `setDbStore` are nice touches for reusability.

### What’s working well
- **Consistent structure** across OpenAI, Anthropic, and Google projects (same `main.ts` scaffolding, `project.json` configs, etc.) makes the code easy to navigate.
- **Shared utilities** (DB access, Express handlers, server bootstrap) reduce duplication and make it trivial to add a new provider.
- **Error handling** in `createApp` centralizes API failure reporting and prevents unhandled promise rejections.
- **TypeScript typings** for request payloads and DB rows make the code easier to reason about.

### Areas to revisit / potential issues

1. **Artificial “model” turns in request payloads**  
   In both the Anthropic and Google builders you fabricate alternating `model → user` conversation turns to inject file contents (`"Please provide the content of …"` followed by the actual text). That pattern implies those model utterances were real prior responses, but they weren’t.  
   - For Anthropic, you’re sending `role: 'assistant'` messages that the assistant never produced.  
   - For Google, you’re sending `role: 'model'` turns with the same fabricated prompts.  
   These might confuse the APIs because you’re essentially telling them “the model already replied with X” even though it didn’t. A more straightforward approach is to send a single user turn that packages the files (the way the OpenAI implementation does) or to record real conversation history instead of synthesizing it.

2. **Three-second delay before calling the LLM (`createPromptHandler`)**  
   After storing the prompt you sleep for 3000 ms “to ensure DB updates are visible.” SQLite writes are synchronous; `await db.run(...)` already guarantees the insert completed. The sleep just slows the whole pipeline. If you’re papering over some other bug (e.g., an eventually consistent store), it would be better to fix that root cause.

3. **Resetting the database when the API key changes**  
   `handleConfig` calls `db.resetDatabase()` whenever a new key is set, wiping files, prompts, models, etc. That’s surprising for users (updating the key erases all data). Unless there’s a security requirement to purge everything, consider clearing only the config keys or at least documenting this behavior.

4. **File storage duplicates**  
   `handleFile` blindly inserts new rows; uploading the same filename twice will create multiple rows. If these represent the project files they should probably be keyed by path so you can replace or delete them rather than append duplicates.

5. **Possible Google API field mismatch**  
   In the `generateContent` request you set `system_instruction`. The public REST schema uses `systemInstruction` (camelCase). If you haven’t verified that the snake_case version is accepted, double-check; otherwise the system prompt might be silently ignored.

6. **Database wiped on server startup**  
   `startServer` calls `removeDatabaseFile()` before connecting, so every restart clears state. That might be intentional for ephemeral environments, but it deserves a comment or toggle because it prevents persistence by default.

7. **Security note**  
   API keys are stored on disk (SQLite in `/tmp`). If these services run somewhere multi-tenant, at least mention the risk or consider encrypting/obfuscating the keys.

### Suggested next steps
- Simplify the payload builders so they mirror actual conversation history (or switch to the “single markdown document” approach you use with OpenAI).
- Remove the artificial delay and rely on the awaited DB operations instead.
- Decide whether resetting the DB on API key updates/startup is desired; if not, adjust `resetDatabase` usage.
- Add upsert logic (or a unique constraint) for files to prevent duplication.
- Verify the Google request property names and update if necessary.

Overall, the architecture is clean and the shared library is well-factored. Addressing the above points should make the agents more predictable and user-friendly.

OpenAI gpt-5-codex (7191 in, 3150 out)


