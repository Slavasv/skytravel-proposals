import type { NextConfig } from "next";

// Уникальный идентификатор сборки. Меняется на каждом деплое.
// В dev — фиксированный 'dev', чтобы локально ничего не мешало.
// На Vercel берём SHA коммита; если он недоступен — метку времени сборки
// (next.config выполняется заново на каждой сборке, значит значение уникально).
const BUILD_ID =
  process.env.NODE_ENV === "development"
    ? "dev"
    : process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

const nextConfig: NextConfig = {
  typedRoutes: false,
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
  env: {
    // Вшивается и в клиент, и в сервер этой сборки — по нему ловим расхождение версий.
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
};

export default nextConfig;
