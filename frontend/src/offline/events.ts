// events.ts — tiny window events between the scanner and the sync provider.
export const JOURNAL_CHANGED_EVENT = 'at:journal-changed';

/** A record was just confirmed: the sync provider may send it right away if there is a network. */
export function notifyJournalChanged(): void {
  window.dispatchEvent(new Event(JOURNAL_CHANGED_EVENT));
}
