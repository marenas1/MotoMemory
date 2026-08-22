import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // TypeScript 5.9 exposes the compiler API used by this local project.
    // Keeping the API checker avoids a Next 16 CLI parsing issue on the
    // current Node runtime while `npm run typecheck` remains available too.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
