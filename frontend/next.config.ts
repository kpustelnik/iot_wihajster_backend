import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  // Note: This is only an example. If you use Pages Router,
  // use something else that works, such as "service-worker/index.ts".
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

const nextConfig: NextConfig = {
  allowedDevOrigins: ['wihajster-front.ivk.pl'],
  output: 'export',
  basePath: '/iot_wihajster_backend'
};

export default withSerwist(nextConfig);
