import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import * as fs from "fs";

const SUPABASE_PROJECT_ID = "uwlivwobmlaadrsaqejx";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bGl2d29ibWxhYWRyc2FxZWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDU3MzUsImV4cCI6MjA4ODY4MTczNX0.uHMxtI7NbCzveumQyEI5czAT6DLQyzYgtpltOx6mVCc";

const resolveEnvDir = () => {
  const candidateDirs = [
    process.cwd(),
    typeof __dirname === "string" ? __dirname : undefined,
  ].filter(Boolean) as string[];

  for (const dir of candidateDirs) {
    if (fs.existsSync(path.resolve(dir, ".env"))) return dir;
  }

  return process.cwd();
};

const readEnvFiles = (mode: string) => {
  const envDir = resolveEnvDir();
  const candidates = [
    `.env`,
    `.env.local`,
    `.env.${mode}`,
    `.env.${mode}.local`,
  ];

  const env: Record<string, string> = {};

  for (const fileName of candidates) {
    try {
      const raw = fs.readFileSync(path.resolve(envDir, fileName), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "ENOENT"
      ) {
        continue;
      }
      throw err;
    }
  }

  return env;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = readEnvFiles(mode);
  const define: Record<string, string> = {};
  const appearsWrongProject =
    (fileEnv.VITE_SUPABASE_PROJECT_ID || "").includes("dtknywnttoslxthlqwsz") ||
    (fileEnv.VITE_SUPABASE_URL || "").includes("dtknywnttoslxthlqwsz");

  const resolvedSupabaseUrl =
    fileEnv.VITE_SUPABASE_URL && !appearsWrongProject ? fileEnv.VITE_SUPABASE_URL : SUPABASE_URL;
  const resolvedAnonKey =
    (fileEnv.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY) &&
    !appearsWrongProject
      ? (fileEnv.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY)!
      : SUPABASE_PUBLISHABLE_KEY;

  define["__SUPABASE_URL__"] = JSON.stringify(resolvedSupabaseUrl);
  define["__SUPABASE_ANON_KEY__"] = JSON.stringify(resolvedAnonKey);

  if (resolvedSupabaseUrl) {
    define["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(resolvedSupabaseUrl);
  }
  if (resolvedAnonKey) {
    define["import.meta.env.VITE_SUPABASE_ANON_KEY"] = JSON.stringify(resolvedAnonKey);
    define["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] = JSON.stringify(
      resolvedAnonKey
    );
  }
  define["import.meta.env.VITE_SUPABASE_PROJECT_ID"] = JSON.stringify(SUPABASE_PROJECT_ID);

  return {
    define,
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
  };
});
