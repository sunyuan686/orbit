import { db } from "../../db/index.js";
import { createAiRoutes } from "../../api/ai.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const ai = createAiRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
  getEnv: () => ({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID,
    CF_API_TOKEN: process.env.CF_API_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
  }),
});

export { ai };
