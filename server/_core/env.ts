export const ENV = {
  // Database
  get DATABASE_URL() {
    return process.env.DATABASE_URL || "";
  },

  // App / Auth
  get cookieSecret() {
    return process.env.JWT_SECRET ?? "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get ownerOpenId() {
    return process.env.OWNER_OPEN_ID ?? "";
  },

  // Google Maps (optional — used by map.ts for geocoding & directions)
  get googleMapsApiKey() {
    return process.env.GOOGLE_MAPS_API_KEY ?? "";
  },
};
