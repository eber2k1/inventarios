import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // /admin no tiene contenido propio: se redirige antes de renderizar
  // (un page.tsx que solo llama a redirect() rompe la validación de navegación instantánea)
  async redirects() {
    return [{ source: "/admin", destination: "/admin/dashboard", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
