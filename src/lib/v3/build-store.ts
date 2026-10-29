import { deleteSavedBuild, getSavedBuild, getSavedBuilds, saveCurrentBuild } from "@/lib/apiClient";
import {
  deleteLocalSavedBuild,
  getLocalSavedBuild,
  getLocalSavedBuilds,
  saveLocalBuild,
} from "@/lib/v3/local-builds";

/**
 * Where My Builds lives. The first deployment keeps builds in the browser (production builds, or
 * `VITE_BUILD_STORAGE=local`); dev and the E2E suite keep the server endpoints.
 */
export const buildsInBrowser =
  import.meta.env.PROD || import.meta.env.VITE_BUILD_STORAGE === "local";

export const savedBuilds = buildsInBrowser
  ? {
      list: getLocalSavedBuilds,
      save: saveLocalBuild,
      get: getLocalSavedBuild,
      remove: deleteLocalSavedBuild,
    }
  : { list: getSavedBuilds, save: saveCurrentBuild, get: getSavedBuild, remove: deleteSavedBuild };
