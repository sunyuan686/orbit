import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { db } from "../../db/index.js";
import { createAiRoutes } from "../../api/ai.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const AI_ATTACHMENTS_DIR = join(process.cwd(), "data", "ai-attachments");

const ai = createAiRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
  storage: {
    async save({ filename, body }) {
      mkdirSync(AI_ATTACHMENTS_DIR, { recursive: true });
      const filepath = join(AI_ATTACHMENTS_DIR, filename);
      if (!existsSync(filepath)) {
        writeFileSync(filepath, Buffer.from(body));
      }
      return `/ai-attachments/${filename}`;
    },
  },
  getEnv: () => ({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID,
    CF_API_TOKEN: process.env.CF_API_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
    LANGFUSE_ENV: process.env.LANGFUSE_ENV,
    LANGFUSE_PROJECT_ID: process.env.LANGFUSE_PROJECT_ID,
  }),
});

export { ai };
