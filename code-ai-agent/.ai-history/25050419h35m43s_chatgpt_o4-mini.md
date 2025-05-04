# When using `o1` or `o3` or `o4` model series, only the first line of the instruction is included in the message.

OpenAI models do not support "system instructions" in the same way as "gpt-x" models do.
So, in the code, I decided to to put the system instructions before the prompt.

The problem is that the system instructions are not included fully included in the prompt, only the first line is included:

Tell me why does this happen?



# This is o4-mini answer (13k in, 6k out)

You’ve discovered that nothing mysterious is wrong with OpenAI – it’s your own body‐building logic that throws away everything after the first line whenever you turn on the “o1/o3/o4” path.  Here’s a blow‐by‐blow:

1) In your router you do this in order:
   ```ts
   agentBody.setModelToUse(modelToUse)
   agentBody.setMultiTurnChat(multiTurnText)
   agentBody.setSystemInstruction(systemInstruction)
   ```
2) In ChatGPTBody.setMultiTurnChat you have code that, for o1/o3/o4, will only prepend the system instruction _inside_ the very last message, and it reads it out of `this.systemInstruction` at that moment.  But you haven’t called setSystemInstruction yet, so it’s still an empty string.  
3) Then you call setSystemInstruction, but your implementation only does an `unshift` when the model does _not_ start with “o1/o3/o4” – so for o1/o3/o4 you never add a real system‐role message at all.  

The net result is:  
• when you inspect your JSON you only ever see the tiny bit you injected into the last message (in your case it happens to be only one line), and the rest is lost.  

Fixes (pick one or more):  
A) Swap the two calls in the router so you set the system instruction first, then build the chat:  
```ts
agentBody.setSystemInstruction(systemInstruction)
agentBody.setMultiTurnChat(multiTurnText)
```  
B) Simplest of all – don’t do that fancy “inject into the last message” hack for o1/o3/o4.  Instead, always unshift a true `{role: 'system', content: …}` message at the front of your chunks array.  The Chat Completions API _does_ honor a “system” role – you just need to supply it.  
C) If you really want to keep the custom code path, move your prepend logic into the `setSystemInstruction` method (so that it fires even on o1/o3/o4), or cache the instruction before you ever build your chunks.  

Once you do one of those, the entire multi‐line system prompt will travel up to OpenAI instead of getting chopped off after the first line.

