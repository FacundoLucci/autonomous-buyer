declare const process: { env: { CONVEX_SITE_URL: string } };

export default {
  providers: [
    { domain: process.env.CONVEX_SITE_URL, applicationID: "convex" },
    {
      type: "customJwt" as const,
      issuer: `${process.env.CONVEX_SITE_URL}/auth`,
      applicationID: "convex",
      algorithm: "RS256" as const,
      jwks: `${process.env.CONVEX_SITE_URL}/auth/.well-known/jwks.json`,
    },
  ],
};
