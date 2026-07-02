/**
 * @fileoverview Pure merge logic for reconciling local and cloud tab lists.
 *
 * Guarantees:
 * - A tab that has never reached the cloud is never lost: it stays in the
 *   merged list and is queued for pushing.
 * - A tab the cloud has seen before (its id is in previouslySyncedIds) but
 *   no longer contains was deleted on another device, so it is removed
 *   locally instead of being resurrected.
 * - When both sides have a tab, the newer dateModified wins; ties prefer
 *   the cloud copy.
 *
 * @module storage/mergeTabs
 */

/** Millisecond timestamp for a tab, falling back through its date fields. */
function modifiedTime(tab) {
  const value = tab.dateModified || tab.dateCreated;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Merge local and cloud tab lists.
 * @param {Array<Object>} localTabs - Tabs currently in local storage
 * @param {Array<Object>} cloudTabs - Tabs currently in Firestore
 * @param {Array<string>} [previouslySyncedIds] - Ids known to have been in
 *   the cloud at some earlier point (used to recognize remote deletions)
 * @returns {{merged: Array<Object>, toPush: Array<Object>, syncedIds: Array<string>}}
 *   merged: the list local storage should hold afterwards;
 *   toPush: local tabs the cloud is missing or has older copies of;
 *   syncedIds: ids that will be in the cloud after toPush is written
 */
export function mergeTabs(localTabs, cloudTabs, previouslySyncedIds = []) {
  const local = Array.isArray(localTabs) ? localTabs : [];
  const cloud = Array.isArray(cloudTabs) ? cloudTabs : [];
  const knownSynced = new Set(previouslySyncedIds);

  const cloudById = new Map(cloud.map(tab => [tab.id, tab]));
  const localIds = new Set(local.map(tab => tab.id));

  const merged = [];
  const toPush = [];

  for (const localTab of local) {
    const cloudTab = cloudById.get(localTab.id);

    if (cloudTab) {
      if (modifiedTime(localTab) > modifiedTime(cloudTab)) {
        merged.push(localTab);
        toPush.push(localTab);
      } else {
        merged.push(cloudTab);
      }
    } else if (knownSynced.has(localTab.id)) {
      // The cloud had this tab before and it is gone now: deleted remotely.
      continue;
    } else {
      merged.push(localTab);
      toPush.push(localTab);
    }
  }

  for (const cloudTab of cloud) {
    if (!localIds.has(cloudTab.id)) {
      merged.push(cloudTab);
    }
  }

  const syncedIds = [
    ...new Set([...cloudById.keys(), ...toPush.map(tab => tab.id)])
  ];

  return { merged, toPush, syncedIds };
}
