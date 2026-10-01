/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["better-sqlite3"],
  // paralel doğrulama derlemeleri için: NEXT_DIST_DIR ile ayrılabiliyor
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
