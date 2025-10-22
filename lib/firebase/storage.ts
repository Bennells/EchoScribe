import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTask,
} from "firebase/storage";
import { storage } from "./config";

export { ref, uploadBytesResumable, getDownloadURL, deleteObject };

export type { UploadTask };

// Re-export storage for convenience
export { storage };
