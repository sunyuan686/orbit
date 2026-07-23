import { db } from "../../db/index.js";
import { createGalleryRoutes } from "../../api/gallery.js";
import { deleteLocalGalleryObject } from "../../lib/gallery-local-storage.js";

export const gallery = createGalleryRoutes(() => db, {
  deleteObject: async (_c, storageKey) => deleteLocalGalleryObject(storageKey),
});
