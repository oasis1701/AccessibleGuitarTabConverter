import { describe, it, expect } from 'vitest';
import { mergeTabs } from '../mergeTabs.js';

function tab(id, dateModified, extra = {}) {
  return { id, name: `Tab ${id}`, dateModified, ...extra };
}

describe('mergeTabs', () => {
  it('keeps and pushes local tabs the cloud has never seen', () => {
    const { merged, toPush } = mergeTabs([tab('a', '2026-01-01')], [], []);
    expect(merged.map(t => t.id)).toEqual(['a']);
    expect(toPush.map(t => t.id)).toEqual(['a']);
  });

  it('adds cloud-only tabs to the merged list without pushing', () => {
    const { merged, toPush } = mergeTabs([], [tab('c', '2026-01-01')], []);
    expect(merged.map(t => t.id)).toEqual(['c']);
    expect(toPush).toEqual([]);
  });

  it('never loses either side when both have unique tabs', () => {
    const { merged } = mergeTabs(
      [tab('local', '2026-01-01')],
      [tab('cloud', '2026-01-02')],
      []
    );
    expect(merged.map(t => t.id).sort()).toEqual(['cloud', 'local']);
  });

  it('lets the newer copy win when both sides have the tab', () => {
    const localNewer = mergeTabs(
      [tab('a', '2026-02-01', { name: 'local' })],
      [tab('a', '2026-01-01', { name: 'cloud' })],
      ['a']
    );
    expect(localNewer.merged[0].name).toBe('local');
    expect(localNewer.toPush.map(t => t.id)).toEqual(['a']);

    const cloudNewer = mergeTabs(
      [tab('a', '2026-01-01', { name: 'local' })],
      [tab('a', '2026-02-01', { name: 'cloud' })],
      ['a']
    );
    expect(cloudNewer.merged[0].name).toBe('cloud');
    expect(cloudNewer.toPush).toEqual([]);
  });

  it('prefers the cloud copy on a timestamp tie', () => {
    const { merged, toPush } = mergeTabs(
      [tab('a', '2026-01-01', { name: 'local' })],
      [tab('a', '2026-01-01', { name: 'cloud' })],
      ['a']
    );
    expect(merged[0].name).toBe('cloud');
    expect(toPush).toEqual([]);
  });

  it('drops local tabs that were deleted on another device', () => {
    const { merged, toPush } = mergeTabs(
      [tab('deleted-remotely', '2026-01-01'), tab('never-synced', '2026-01-01')],
      [],
      ['deleted-remotely']
    );
    expect(merged.map(t => t.id)).toEqual(['never-synced']);
    expect(toPush.map(t => t.id)).toEqual(['never-synced']);
  });

  it('reports the ids the cloud will hold after pushing', () => {
    const { syncedIds } = mergeTabs(
      [tab('local-new', '2026-01-01')],
      [tab('cloud-old', '2026-01-01')],
      []
    );
    expect(syncedIds.sort()).toEqual(['cloud-old', 'local-new']);
  });

  it('is idempotent once the pushed tabs land in the cloud', () => {
    const local = [tab('a', '2026-01-01'), tab('b', '2026-02-01')];
    const cloud = [tab('b', '2026-01-15'), tab('c', '2026-01-20')];
    const first = mergeTabs(local, cloud, ['b', 'c']);

    // Simulate the queued push completing (as reconcile() does before it
    // persists syncedIds — on push failure the old ledger is kept).
    const cloudAfterPush = [
      ...cloud.filter(t => !first.toPush.some(p => p.id === t.id)),
      ...first.toPush
    ];

    const second = mergeTabs(first.merged, cloudAfterPush, first.syncedIds);
    expect(second.merged).toEqual(first.merged);
    expect(second.toPush).toEqual([]);
  });

  it('keeps never-synced tabs even if a stale ledger lists other ids', () => {
    // A failed push must not poison the ledger: ids only enter
    // previouslySyncedIds after a successful cloud write.
    const { merged } = mergeTabs(
      [tab('new-local', '2026-03-01')],
      [],
      ['some-other-tab']
    );
    expect(merged.map(t => t.id)).toEqual(['new-local']);
  });

  it('tolerates missing dates', () => {
    const { merged } = mergeTabs(
      [{ id: 'a', name: 'local' }],
      [{ id: 'a', name: 'cloud', dateModified: '2026-01-01' }],
      ['a']
    );
    expect(merged[0].name).toBe('cloud');
  });
});
