const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
export default {
  output: "export",          // статичний експорт у папку out/ (без Node-сервера)
  trailingSlash: true,
  images: { unoptimized: true },
  assetPrefix: isProd ? "." : undefined, // відносні шляхи, щоб out/index.html відкривався через file://
};
