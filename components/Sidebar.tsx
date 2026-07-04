"use client";

import { useState } from "react";
import type { Folder, Note } from "@/lib/types";

type Handlers = {
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onCreateNote: (folderId: string | null) => void;
  onRenameNote: (id: string, title: string) => void;
  onDeleteNote: (id: string) => void;
};

type Props = Handlers & {
  folders: Folder[];
  notes: Note[];
};

export default function Sidebar({ folders, notes, ...handlers }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rootFolders = folders.filter((f) => f.parent_id === null);
  const rootNotes = notes.filter((n) => n.folder_id === null);

  const selectNoteAndClose = (id: string) => {
    handlers.onSelectNote(id);
    setMobileOpen(false);
  };

  return (
    <>
      {!mobileOpen && (
        <button
          title="Open sidebar"
          onClick={() => setMobileOpen(true)}
          className="fixed left-3 top-3 z-30 rounded bg-zinc-50 p-2 text-lg leading-none text-zinc-600 shadow dark:bg-zinc-900 dark:text-zinc-400 sm:hidden"
        >
          ☰
        </button>
      )}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 sm:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-200 bg-zinc-50 transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-950 sm:static sm:z-auto sm:shrink-0 sm:translate-x-0 sm:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "sm:w-10" : "sm:w-72"}`}
      >
        {collapsed ? (
          <div className="hidden sm:flex sm:flex-col sm:items-center sm:py-3">
            <button
              title="Expand sidebar"
              onClick={() => setCollapsed(false)}
              className="rounded px-1 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              »
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Notes
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlers.onCreateFolder(null)}
                  className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  + Folder
                </button>
                <button
                  title="Collapse sidebar"
                  onClick={() => setCollapsed(true)}
                  className="hidden rounded px-1 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:inline-flex"
                >
                  «
                </button>
                <button
                  title="Close sidebar"
                  onClick={() => setMobileOpen(false)}
                  className="rounded px-1 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:hidden"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {rootFolders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  folders={folders}
                  notes={notes}
                  {...handlers}
                  onSelectNote={selectNoteAndClose}
                />
              ))}
              {rootNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  depth={0}
                  {...handlers}
                  onSelectNote={selectNoteAndClose}
                />
              ))}
              <button
                onClick={() => handlers.onCreateNote(null)}
                className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              >
                + New note
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function FolderNode({
  folder,
  depth,
  folders,
  notes,
  ...handlers
}: Handlers & { folder: Folder; depth: number; folders: Folder[]; notes: Note[] }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);

  const children = folders.filter((f) => f.parent_id === folder.id);
  const childNotes = notes.filter((n) => n.folder_id === folder.id);

  function saveName() {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== folder.name) {
      handlers.onRenameFolder(folder.id, trimmed);
    } else {
      setName(folder.name);
    }
  }

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div className="group flex items-center gap-1 rounded px-1 py-1 hover:bg-zinc-200 dark:hover:bg-zinc-800">
        <button
          onClick={() => setOpen(!open)}
          className="w-4 shrink-0 text-xs text-zinc-500"
        >
          {open ? "▾" : "▸"}
        </button>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setName(folder.name);
                setEditing(false);
              }
            }}
            className="flex-1 rounded border border-zinc-300 bg-white px-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            className="flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200"
          >
            📁 {folder.name}
          </span>
        )}
        <div className="flex shrink-0 gap-1 sm:hidden sm:group-hover:flex">
          <button
            title="New note"
            onClick={() => handlers.onCreateNote(folder.id)}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            📝
          </button>
          <button
            title="New subfolder"
            onClick={() => handlers.onCreateFolder(folder.id)}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            📁+
          </button>
          <button
            title="Delete folder"
            onClick={() => {
              if (confirm(`Delete "${folder.name}" and everything inside it?`)) {
                handlers.onDeleteFolder(folder.id);
              }
            }}
            className="text-xs text-zinc-500 hover:text-red-600"
          >
            🗑
          </button>
        </div>
      </div>
      {open && (
        <div>
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              folders={folders}
              notes={notes}
              {...handlers}
            />
          ))}
          {childNotes.map((note) => (
            <NoteRow key={note.id} note={note} depth={depth + 1} {...handlers} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteRow({
  note,
  depth,
  selectedNoteId,
  onSelectNote,
  onRenameNote,
  onDeleteNote,
}: Handlers & { note: Note; depth: number }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);

  function saveTitle() {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== note.title) {
      onRenameNote(note.id, trimmed);
    } else {
      setTitle(note.title);
    }
  }

  const selected = note.id === selectedNoteId;

  return (
    <div
      style={{ paddingLeft: depth * 12 + 16 }}
      className={`group flex items-center gap-1 rounded px-1 py-1 ${
        selected ? "bg-zinc-200 dark:bg-zinc-800" : "hover:bg-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle();
            if (e.key === "Escape") {
              setTitle(note.title);
              setEditing(false);
            }
          }}
          className="flex-1 rounded border border-zinc-300 bg-white px-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      ) : (
        <button
          onClick={() => onSelectNote(note.id)}
          onDoubleClick={() => setEditing(true)}
          className="flex-1 truncate text-left text-sm text-zinc-700 dark:text-zinc-300"
        >
          📄 {note.title}
        </button>
      )}
      <button
        title="Delete note"
        onClick={() => {
          if (confirm(`Delete "${note.title}"?`)) onDeleteNote(note.id);
        }}
        className="block shrink-0 text-xs text-zinc-500 hover:text-red-600 sm:hidden sm:group-hover:block"
      >
        🗑
      </button>
    </div>
  );
}
