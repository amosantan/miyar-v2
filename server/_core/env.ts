export const ENV = {
  // Database
  DATABASE_URL:
    process.env.DATABASE_URL || "",

  // App / Auth
  cookieSecret: process.env.JWT_SECRET ?? "",
  isProduction: process.env.NODE_ENV === "production",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",

  // Google Maps (optional — used by map.ts for geocoding & directions)
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
};
