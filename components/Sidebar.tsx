"use client";

import { useState } from "react";
import { positionBetween } from "@/lib/position";
import type { Folder, Note } from "@/lib/types";

type Handlers = {
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveFolder: (id: string, parentId: string | null, position: number) => void;
  onCreateNote: (folderId: string | null) => void;
  onRenameNote: (id: string, title: string) => void;
  onDeleteNote: (id: string) => void;
  onMoveNote: (id: string, folderId: string | null, position: number) => void;
};

type Props = Handlers & {
  folders: Folder[];
  notes: Note[];
};

type DropZone = "before" | "after" | "inside";

type DndBundle = {
  dragging: { kind: "folder" | "note"; id: string } | null;
  dropTarget: { id: string; zone: DropZone } | null;
  onDragStart: (e: React.DragEvent, kind: "folder" | "note", id: string) => void;
  onDragEnd: () => void;
  onFolderDragOver: (e: React.DragEvent, target: Folder) => void;
  onFolderDrop: (e: React.DragEvent, target: Folder) => void;
  onNoteDragOver: (e: React.DragEvent, target: Note) => void;
  onNoteDrop: (e: React.DragEvent, target: Note) => void;
  onDragLeave: (id: string) => void;
};

function isDescendant(folders: Folder[], ancestorId: string, nodeId: string): boolean {
  let current = folders.find((f) => f.id === nodeId);
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true;
    current = folders.find((f) => f.id === current!.parent_id);
  }
  return false;
}

function getDropZone(e: React.DragEvent, allowInside: boolean): DropZone {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = (e.clientY - rect.top) / rect.height;
  if (allowInside) {
    if (ratio < 0.25) return "before";
    if (ratio > 0.75) return "after";
    return "inside";
  }
  return ratio < 0.5 ? "before" : "after";
}

export default function Sidebar({ folders, notes, ...handlers }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dragging, setDragging] = useState<{ kind: "folder" | "note"; id: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: DropZone } | null>(null);

  const rootFolders = folders.filter((f) => f.parent_id === null).sort((a, b) => a.position - b.position);
  const rootNotes = notes.filter((n) => n.folder_id === null).sort((a, b) => a.position - b.position);

  const selectNoteAndClose = (id: string) => {
    handlers.onSelectNote(id);
    setMobileOpen(false);
  };

  function moveFolderRelative(draggedId: string, target: Folder, zone: DropZone) {
    if (draggedId === target.id) return;
    if (zone === "inside") {
      if (isDescendant(folders, draggedId, target.id)) return;
      const siblings = folders
        .filter((f) => f.parent_id === target.id && f.id !== draggedId)
        .sort((a, b) => a.position - b.position);
      handlers.onMoveFolder(draggedId, target.id, positionBetween(siblings.at(-1)?.position ?? null, null));
      return;
    }
    const newParentId = target.parent_id;
    if (newParentId != null && (newParentId === draggedId || isDescendant(folders, draggedId, newParentId))) return;
    const siblings = folders
      .filter((f) => f.parent_id === newParentId && f.id !== draggedId)
      .sort((a, b) => a.position - b.position);
    const index = siblings.findIndex((f) => f.id === target.id);
    const position =
      zone === "before"
        ? positionBetween(siblings[index - 1]?.position ?? null, target.position)
        : positionBetween(target.position, siblings[index + 1]?.position ?? null);
    handlers.onMoveFolder(draggedId, newParentId, position);
  }

  function moveNoteIntoFolder(draggedId: string, folderId: string) {
    const siblings = notes.filter((n) => n.folder_id === folderId).sort((a, b) => a.position - b.position);
    handlers.onMoveNote(draggedId, folderId, positionBetween(siblings.at(-1)?.position ?? null, null));
  }

  function moveNoteRelative(draggedId: string, target: Note, zone: "before" | "after") {
    if (draggedId === target.id) return;
    const newFolderId = target.folder_id;
    const siblings = notes
      .filter((n) => n.folder_id === newFolderId && n.id !== draggedId)
      .sort((a, b) => a.position - b.position);
    const index = siblings.findIndex((n) => n.id === target.id);
    const position =
      zone === "before"
        ? positionBetween(siblings[index - 1]?.position ?? null, target.position)
        : positionBetween(target.position, siblings[index + 1]?.position ?? null);
    handlers.onMoveNote(draggedId, newFolderId, position);
  }

  function moveToRoot() {
    if (!dragging) return;
    if (dragging.kind === "folder") {
      const siblings = folders.filter((f) => f.parent_id === null && f.id !== dragging.id).sort((a, b) => a.position - b.position);
      handlers.onMoveFolder(dragging.id, null, positionBetween(siblings.at(-1)?.position ?? null, null));
    } else {
      const siblings = notes.filter((n) => n.folder_id === null && n.id !== dragging.id).sort((a, b) => a.position - b.position);
      handlers.onMoveNote(dragging.id, null, positionBetween(siblings.at(-1)?.position ?? null, null));
    }
  }

  const dnd: DndBundle = {
    dragging,
    dropTarget,
    onDragStart: (e, kind, id) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      setDragging({ kind, id });
    },
    onDragEnd: () => {
      setDragging(null);
      setDropTarget(null);
    },
    onFolderDragOver: (e, target) => {
      if (!dragging) return;
      e.preventDefault();
      e.stopPropagation();
      const zone = dragging.kind === "note" ? "inside" : getDropZone(e, true);
      setDropTarget({ id: target.id, zone });
    },
    onFolderDrop: (e, target) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragging) {
        if (dragging.kind === "note") {
          moveNoteIntoFolder(dragging.id, target.id);
        } else {
          moveFolderRelative(dragging.id, target, getDropZone(e, true));
        }
      }
      setDragging(null);
      setDropTarget(null);
    },
    onNoteDragOver: (e, target) => {
      if (!dragging || dragging.kind !== "note") return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget({ id: target.id, zone: getDropZone(e, false) });
    },
    onNoteDrop: (e, target) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragging?.kind === "note") {
        moveNoteRelative(dragging.id, target, getDropZone(e, false) as "before" | "after");
      }
      setDragging(null);
      setDropTarget(null);
    },
    onDragLeave: (id) => {
      setDropTarget((prev) => (prev?.id === id ? null : prev));
    },
  };

  return (
    <>
      {!mobileOpen && (
        <button
          title="Open sidebar"
          onClick={() => setMobileOpen(true)}
          className="fixed left-3 top-3 z-30 rounded-lg bg-zinc-50 p-2 text-lg leading-none text-zinc-600 shadow-md shadow-zinc-900/10 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:shadow-black/20 dark:hover:bg-zinc-800 sm:hidden"
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
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-200/70 bg-zinc-50 transition-transform duration-200 dark:border-zinc-800/70 dark:bg-zinc-950 sm:static sm:z-auto sm:shrink-0 sm:translate-x-0 sm:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "sm:w-10" : "sm:w-72"}`}
      >
        {collapsed ? (
          <div className="hidden sm:flex sm:flex-col sm:items-center sm:py-3">
            <button
              title="Expand sidebar"
              onClick={() => setCollapsed(false)}
              className="rounded-md px-1 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
            >
              »
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-zinc-200/70 p-3 dark:border-zinc-800/70">
              <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500"
                >
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                Notes
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlers.onCreateFolder(null)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
                >
                  + Folder
                </button>
                <button
                  title="Collapse sidebar"
                  onClick={() => setCollapsed(true)}
                  className="hidden rounded-md px-1.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100 sm:inline-flex"
                >
                  «
                </button>
                <button
                  title="Close sidebar"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-1.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100 sm:hidden"
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto p-2"
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                moveToRoot();
                setDragging(null);
                setDropTarget(null);
              }}
            >
              {rootFolders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  folders={folders}
                  notes={notes}
                  dnd={dnd}
                  {...handlers}
                  onSelectNote={selectNoteAndClose}
                />
              ))}
              {rootNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  depth={0}
                  dnd={dnd}
                  {...handlers}
                  onSelectNote={selectNoteAndClose}
                />
              ))}
              <button
                onClick={() => handlers.onCreateNote(null)}
                className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
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
  dnd,
  ...handlers
}: Handlers & { folder: Folder; depth: number; folders: Folder[]; notes: Note[]; dnd: DndBundle }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);

  const children = folders.filter((f) => f.parent_id === folder.id).sort((a, b) => a.position - b.position);
  const childNotes = notes.filter((n) => n.folder_id === folder.id).sort((a, b) => a.position - b.position);

  function saveName() {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== folder.name) {
      handlers.onRenameFolder(folder.id, trimmed);
    } else {
      setName(folder.name);
    }
  }

  const isDragging = dnd.dragging?.kind === "folder" && dnd.dragging.id === folder.id;
  const drop = dnd.dropTarget?.id === folder.id ? dnd.dropTarget.zone : null;

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div
        draggable={!editing}
        onDragStart={(e) => dnd.onDragStart(e, "folder", folder.id)}
        onDragEnd={dnd.onDragEnd}
        onDragOver={(e) => dnd.onFolderDragOver(e, folder)}
        onDragLeave={() => dnd.onDragLeave(folder.id)}
        onDrop={(e) => dnd.onFolderDrop(e, folder)}
        className={`group flex items-center gap-1 rounded-md px-1 py-1 transition-colors hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70 ${
          isDragging ? "opacity-40" : ""
        } ${drop === "inside" ? "bg-blue-100 dark:bg-blue-900/40" : ""} ${
          drop === "before" ? "border-t-2 border-blue-500" : ""
        } ${drop === "after" ? "border-b-2 border-blue-500" : ""}`}
      >
        <button
          onClick={() => setOpen(!open)}
          className="w-4 shrink-0 text-xs text-zinc-400 dark:text-zinc-500"
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
            className="flex-1 rounded-md border border-zinc-300 bg-white px-1 text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-50"
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            className="flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200"
          >
            📁 {folder.name}
          </span>
        )}
        <div className="flex shrink-0 gap-1.5 sm:hidden sm:group-hover:flex">
          <button
            title="New note"
            onClick={() => handlers.onCreateNote(folder.id)}
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            📝
          </button>
          <button
            title="New subfolder"
            onClick={() => handlers.onCreateFolder(folder.id)}
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
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
            className="text-xs text-zinc-400 transition-colors hover:text-red-600 dark:text-zinc-500"
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
              dnd={dnd}
              {...handlers}
            />
          ))}
          {childNotes.map((note) => (
            <NoteRow key={note.id} note={note} depth={depth + 1} dnd={dnd} {...handlers} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteRow({
  note,
  depth,
  dnd,
  selectedNoteId,
  onSelectNote,
  onRenameNote,
  onDeleteNote,
}: Handlers & { note: Note; depth: number; dnd: DndBundle }) {
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
  const isDragging = dnd.dragging?.kind === "note" && dnd.dragging.id === note.id;
  const drop = dnd.dropTarget?.id === note.id ? dnd.dropTarget.zone : null;

  return (
    <div
      draggable={!editing}
      onDragStart={(e) => dnd.onDragStart(e, "note", note.id)}
      onDragEnd={dnd.onDragEnd}
      onDragOver={(e) => dnd.onNoteDragOver(e, note)}
      onDragLeave={() => dnd.onDragLeave(note.id)}
      onDrop={(e) => dnd.onNoteDrop(e, note)}
      style={{ paddingLeft: depth * 12 + 16 }}
      className={`group flex items-center gap-1 rounded-md px-1 py-1 transition-colors ${
        selected
          ? "bg-zinc-200/80 shadow-[inset_2px_0_0_0_theme(colors.zinc.900)] dark:bg-zinc-800/80 dark:shadow-[inset_2px_0_0_0_theme(colors.zinc.50)]"
          : "hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70"
      } ${isDragging ? "opacity-40" : ""} ${drop === "before" ? "border-t-2 border-blue-500" : ""} ${
        drop === "after" ? "border-b-2 border-blue-500" : ""
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
          className="flex-1 rounded-md border border-zinc-300 bg-white px-1 text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-50"
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
        className="block shrink-0 text-xs text-zinc-400 transition-colors hover:text-red-600 dark:text-zinc-500 sm:hidden sm:group-hover:block"
      >
        🗑
      </button>
    </div>
  );
}
