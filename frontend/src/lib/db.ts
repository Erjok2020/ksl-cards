/**
 * IndexedDB storage: queued progress events (sequence diagram, flow 2) and
 * the record of which modules are downloaded for offline use.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DownloadRecord, QueuedProgressEvent, QueuedQuizAttempt } from "../types";

interface KslDB extends DBSchema {
  progressQueue: {
    key: string;
    value: QueuedProgressEvent;
    indexes: { by_user: number };
  };
  downloads: {
    key: string;
    value: DownloadRecord;
  };
  quizQueue: {
    key: string;
    value: QueuedQuizAttempt;
    indexes: { by_user: number };
  };
}

let dbPromise: Promise<IDBPDatabase<KslDB>> | null = null;

export function db() {
  dbPromise ??= openDB<KslDB>("ksl-cards", 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const queue = database.createObjectStore("progressQueue", { keyPath: "client_event_id" });
        queue.createIndex("by_user", "user_id");
        database.createObjectStore("downloads", { keyPath: "module" });
      }
      if (oldVersion < 2) {
        // Lesson check results waiting to sync.
        const quiz = database.createObjectStore("quizQueue", { keyPath: "client_event_id" });
        quiz.createIndex("by_user", "user_id");
      }
    },
  });
  return dbPromise;
}
