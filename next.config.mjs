/** @type {import('next').NextConfig} */
const nextConfig = {
  // Azure Static Web Apps serves this as plain files. The API lives in /api.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
