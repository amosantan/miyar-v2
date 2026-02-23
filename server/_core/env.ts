export const ENV = {
  // Database
  databaseUrl: process.env.DATABASE_URL ?? "",

  // App / Auth
  cookieSecret: process.env.JWT_SECRET ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
