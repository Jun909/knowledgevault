export type Folder = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
};

export type Note = {
  id: string;
  folder_id: string | null;
  title: string;
  content: unknown;
  created_by: string | null;
  last_edited_by: string | null;
  updated_at: string;
};
