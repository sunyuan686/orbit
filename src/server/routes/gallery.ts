import { db } from "../../db/index.js";
import { createGalleryRoutes } from "../../api/gallery.js";
import {
  deleteLocalGalleryObject,
  listLocalGalleryObjects,
} from "../../lib/gallery-local-storage.js";

export const gallery = createGalleryRoutes(() => db, {
  listObjects: async () => listLocalGalleryObjects(),
  deleteObject: async (_c, storageKey) => deleteLocalGalleryObject(storageKey),
});
