export const AUTHENTICATED_ENTRY_PATH = "/dashboard";

type RedirectLocation = Pick<Location, "replace">;

export function enterAuthenticatedApp(location: RedirectLocation) {
  location.replace(AUTHENTICATED_ENTRY_PATH);
}

export function getPublicEntryPath(isAuthenticated: boolean) {
  return isAuthenticated ? AUTHENTICATED_ENTRY_PATH : "/login";
}
