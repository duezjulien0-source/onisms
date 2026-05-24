import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents: désactivé car notre app est entièrement dynamique (auth + DB par requête)
};

export default nextConfig;
