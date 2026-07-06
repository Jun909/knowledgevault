"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { positionBetween } from "@/lib/position";
import type { Folder, Note } from "@/lib/types";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";

// The realtime row for a note includes columns (content, doc_state) that the
// sidebar's Note type deliberately excludes — narrow to just what we keep in state.
function toNoteSummary(row: Note & { content?: unknown; doc_state?: string | null }): Note {
  return {
    id: row.id,
    folder_id: row.folder_id,
    title: row.title,
    position: row.position,
    created_by: row.created_by,
    last_edited_by: row.last_edited_by,
    updated_at: row.updated_at,
  };
}

const NOTE_COLUMNS = "id, folder_id, title, position, created_by, last_edited_by, updated_at";

const NoteEditor = dynamic(() => import("./NoteEditor"), { ssr: false });

const supabase = createClient();

export default function Workspace({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    searchParams.get("note")
  );
  const [loading, setLoading] = useState(true);

  const selectNote = useCallback(
    (id: string | null) => {
      setSelectedNoteId(id);
      const params = new URLSearchParams(searchParams.toString());
      if (id) {
        params.set("note", id);
      } else {
        params.delete("note");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const loadData = useCallback(async () => {
    const [{ data: folderData }, { data: noteData }] = await Promise.all([
      supabase.from("folders").select("*").order("position"),
      supabase.from("notes").select(NOTE_COLUMNS).order("position"),
    ]);
    setFolders(folderData ?? []);
    setNotes(noteData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Kept fresh after every render so the realtime subscription below (which
  // mounts once) can always act on the latest selection without resubscribing.
  const selectedNoteIdRef = useRef(selectedNoteId);
  const selectNoteRef = useRef(selectNote);
  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
    selectNoteRef.current = selectNote;
  });

  useEffect(() => {
    const channel = supabase
      .channel("workspace-changes")
      .on<Folder>(
        "postgres_changes",
        { event: "*", schema: "public", table: "folders" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = payload.old.id;
            setFolders((prev) => prev.filter((f) => f.id !== id));
          } else {
            const folder = payload.new;
            setFolders((prev) =>
              prev.some((f) => f.id === folder.id)
                ? prev.map((f) => (f.id === folder.id ? folder : f))
                : [...prev, folder]
            );
          }
        }
      )
      .on<Note & { content?: unknown; doc_state?: string | null }>(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = payload.old.id;
            setNotes((prev) => prev.filter((n) => n.id !== id));
            if (selectedNoteIdRef.current === id) selectNoteRef.current(null);
          } else {
            const note = toNoteSummary(payload.new);
            setNotes((prev) =>
              prev.some((n) => n.id === note.id)
                ? prev.map((n) => (n.id === note.id ? note : n))
                : [note, ...prev]
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleCreateFolder(parentId: string | null) {
    const name = prompt("Folder name")?.trim();
    if (!name) return;
    const siblings = folders.filter((f) => f.parent_id === parentId);
    const position = positionBetween(
      siblings.length ? Math.max(...siblings.map((f) => f.position)) : null,
      null
    );
    const { data, error } = await supabase
      .from("folders")
      .insert({ name, parent_id: parentId, position })
      .select()
      .single();
    if (!error && data) setFolders((prev) => [...prev, data]);
  }

  async function handleRenameFolder(id: string, name: string) {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    await supabase.from("folders").update({ name }).eq("id", id);
  }

  async function handleDeleteFolder(id: string) {
    await supabase.from("folders").delete().eq("id", id);
    // Refetch: DB cascade may have removed nested subfolders/notes too.
    loadData();
    selectNote(null);
  }

  async function handleMoveFolder(id: string, parentId: string | null, position: number) {
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, parent_id: parentId, position } : f))
    );
    await supabase.from("folders").update({ parent_id: parentId, position }).eq("id", id);
  }

  async function handleCreateNote(folderId: string | null) {
    const siblings = notes.filter((n) => n.folder_id === folderId);
    const position = positionBetween(
      siblings.length ? Math.max(...siblings.map((n) => n.position)) : null,
      null
    );
    const { data, error } = await supabase
      .from("notes")
      .insert({ folder_id: folderId, title: "Untitled", content: [], created_by: userId, position })
      .select(NOTE_COLUMNS)
      .single();
    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      selectNote(data.id);
    }
  }

  async function handleRenameNote(id: string, title: string) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
    await supabase.from("notes").update({ title }).eq("id", id);
  }

  async function handleDeleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteId === id) selectNote(null);
    await supabase.from("notes").delete().eq("id", id);
  }

  async function handleMoveNote(id: string, folderId: string | null, position: number) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, folder_id: folderId, position } : n))
    );
    await supabase.from("notes").update({ folder_id: folderId, position }).eq("id", id);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  useEffect(() => {
    if (!loading && selectedNoteId && !selectedNote) {
      // Stale/bookmarked link to a note that no longer exists: strip it from the URL.
      router.replace(pathname, { scroll: false });
    }
  }, [loading, selectedNoteId, selectedNote, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-400 dark:bg-zinc-950 dark:text-zinc-600">
        <span className="animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        folders={folders}
        notes={notes}
        selectedNoteId={selectedNoteId}
        onSelectNote={selectNote}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onMoveFolder={handleMoveFolder}
        onCreateNote={handleCreateNote}
        onRenameNote={handleRenameNote}
        onDeleteNote={handleDeleteNote}
        onMoveNote={handleMoveNote}
      />
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-end gap-2 border-b border-zinc-200/70 bg-zinc-50/80 px-4 py-2 backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <ThemeToggle />
          <span className="px-1 text-xs text-zinc-500 dark:text-zinc-400">{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </div>
        {selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            userEmail={userEmail}
            onTitleChange={(title) =>
              setNotes((prev) =>
                prev.map((n) => (n.id === selectedNote.id ? { ...n, title } : n))
              )
            }
            onSaved={({ lastEditedBy, updatedAt }) =>
              setNotes((prev) =>
                prev.map((n) =>
                  n.id === selectedNote.id
                    ? { ...n, last_edited_by: lastEditedBy, updated_at: updatedAt }
                    : n
                )
              )
            }
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-zinc-400 dark:text-zinc-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 opacity-60"
            >
              <path d="M9 2H15a2 2 0 0 1 2 2v16l-5-3-5 3V4a2 2 0 0 1 2-2Z" />
            </svg>
            Select or create a note
          </div>
        )}
      </div>
    </div>
  );
}
