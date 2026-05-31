import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8080);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const clientToken = (process.env.BACKEND_CLIENT_TOKEN || "").trim();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, anthropic-version");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

function providerConfigured(envName) {
  return Boolean((process.env[envName] || "").trim());
}

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    service: "forge-managed-backend",
    authRequired: Boolean(clientToken),
    providers: {
      openai: providerConfigured("OPENAI_API_KEY"),
      anthropic: providerConfigured("ANTHROPIC_API_KEY"),
      gemini: providerConfigured("GEMINI_API_KEY"),
      deepseek: providerConfigured("DEEPSEEK_API_KEY"),
      xai: providerConfigured("XAI_API_KEY"),
    },
  });
});

function requireDesktopToken(req, res, next) {
  if (!clientToken) {
    return next();
  }
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== clientToken) {
    return res.status(401).json({ error: { message: "Unauthorized desktop client." } });
  }
  next();
}

app.use(requireDesktopToken);

function providerKeyOrThrow(envName) {
  const value = (process.env[envName] || "").trim();
  if (!value) {
    throw new Error(`Missing ${envName} on backend server.`);
  }
  return value;
}

async function proxyJson({
  res,
  url,
  body,
  headers = {},
}) {
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await upstream.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: { message: text || "Invalid upstream response" } };
  }
  return res.status(upstream.status).json(payload);
}

app.post("/openai/v1/chat/completions", async (req, res) => {
  try {
    const key = providerKeyOrThrow("OPENAI_API_KEY");
    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    return await proxyJson({
      res,
      url: `${base}/chat/completions`,
      body: req.body,
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: { message: String(error.message || error) } });
  }
});

app.post("/deepseek/v1/chat/completions", async (req, res) => {
  try {
    const key = providerKeyOrThrow("DEEPSEEK_API_KEY");
    const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/+$/, "");
    return await proxyJson({
      res,
      url: `${base}/chat/completions`,
      body: req.body,
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: { message: String(error.message || error) } });
  }
});

app.post("/xai/v1/chat/completions", async (req, res) => {
  try {
    const key = providerKeyOrThrow("XAI_API_KEY");
    const base = (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/+$/, "");
    return await proxyJson({
      res,
      url: `${base}/chat/completions`,
      body: req.body,
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: { message: String(error.message || error) } });
  }
});

app.post("/anthropic/v1/messages", async (req, res) => {
  try {
    const key = providerKeyOrThrow("ANTHROPIC_API_KEY");
    const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
    return await proxyJson({
      res,
      url: `${base}/v1/messages`,
      body: req.body,
      headers: {
        "x-api-key": key,
        "anthropic-version": req.header("anthropic-version") || "2023-06-01",
      },
    });
  } catch (error) {
    return res.status(500).json({ error: { message: String(error.message || error) } });
  }
});

app.post("/gemini/v1beta/models/:modelAction", async (req, res) => {
  try {
    const key = providerKeyOrThrow("GEMINI_API_KEY");
    const base = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    const modelAction = req.params.modelAction;
    const modelActionEncoded = encodeURIComponent(modelAction);
    const url = `${base}/models/${modelActionEncoded}?key=${encodeURIComponent(key)}`;
    return await proxyJson({
      res,
      url,
      body: req.body,
    });
  } catch (error) {
    return res.status(500).json({ error: { message: String(error.message || error) } });
  }
});

app.listen(port, () => {
  console.log(`forge-managed-backend listening on :${port}`);
});
