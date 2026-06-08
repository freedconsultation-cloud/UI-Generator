// anon-work-tracker — persists an anonymous user's in-progress work in sessionStorage.
// When the user later signs in or signs up, this data is migrated into a real project
// so their work isn't lost.

// sessionStorage key that flags whether there is anonymous work to migrate
const STORAGE_KEY = "uigen_has_anon_work";

// sessionStorage key that holds the serialized messages and VFS snapshot
const DATA_KEY = "uigen_anon_data";

// Save the current chat messages and file system state for an anonymous session.
// Called by ChatProvider whenever a message is sent without a projectId.
export function setHasAnonWork(messages: any[], fileSystemData: any) {
  // sessionStorage is only available in the browser
  if (typeof window === "undefined") return;

  // Only persist if there is actual content — the VFS always has a root "/" node,
  // so > 1 entries means at least one real file has been created
  if (messages.length > 0 || Object.keys(fileSystemData).length > 1) {
    sessionStorage.setItem(STORAGE_KEY, "true");
    sessionStorage.setItem(DATA_KEY, JSON.stringify({ messages, fileSystemData }));
  }
}

// Returns true if the current session has unsaved anonymous work
export function getHasAnonWork(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STORAGE_KEY) === "true";
}

// Returns the full anonymous work payload (messages + file system data), or null if none
export function getAnonWorkData(): { messages: any[], fileSystemData: any } | null {
  if (typeof window === "undefined") return null;

  const data = sessionStorage.getItem(DATA_KEY);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Removes the anonymous work from sessionStorage after it has been migrated to a project
export function clearAnonWork() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(DATA_KEY);
}
