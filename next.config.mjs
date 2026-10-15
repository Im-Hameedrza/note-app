/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Keep integration tests separate from an already running development server.
  distDir: process.env.AUTH_TEST_BUILD === "1" ? ".next-auth-tests" : ".next",
};

export default nextConfig;