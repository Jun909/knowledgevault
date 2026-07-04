export type Folder = {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
  created_at: string;
};

export type Note = {
  id: string;
  folder_id: string | null;
  title: string;
  position: number;
  created_by: string | null;
  last_edited_by: string | null;
  updated_at: string;
};

// Fetched per-note by NoteEditor only, since content can be large and
// doc_state is binary-ish — no need to load these for the sidebar list.
export type NoteContent = {
  content: unknown;
  doc_state: string | null;
};
