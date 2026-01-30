export interface ShieldedNote {
    amount: string;
    secret: string;
    nullifier: string;
    commitment: string;
    index?: number;
}

const STORAGE_KEY = 'shadow_shielded_notes';

export function saveNote(note: ShieldedNote) {
    if (typeof window === 'undefined') return;
    const existing = loadNotes();
    existing.push(note);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function loadNotes(): ShieldedNote[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as ShieldedNote[];
    } catch {
        return [];
    }
}
