# When using `o1` or `o3` or `o4` model series, only the first line of the instruction is included in the message.

OpenAI models do not support "system instructions" in the same way as "gpt-x" models do.
So, in the code, I decided to to put the system instructions before the prompt.

The problem is that the system instructions are not included fully included in the prompt, only the first line is included:

Tell me why does this happen?



# This is disabled answer (0k in, 0k out)

Gemini models are disabled
