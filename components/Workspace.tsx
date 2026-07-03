"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Folder, Note } from "@/lib/types";
import Sidebar from "./Sidebar";

const NoteEditor = dynamic(() => import("./NoteEditor"), { ssr: false });

const supabase = createClient();

export default function Workspace({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [{ data: folderData }, { data: noteData }] = await Promise.all([
      supabase.from("folders").select("*").order("name"),
      supabase.from("notes").select("*").order("updated_at", { ascending: false }),
    ]);
    setFolders(folderData ?? []);
    setNotes(noteData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateFolder(parentId: string | null) {
    const name = prompt("Folder name")?.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("folders")
      .insert({ name, parent_id: parentId })
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
    setSelectedNoteId(null);
  }

  async function handleCreateNote(folderId: string | null) {
    const { data, error } = await supabase
      .from("notes")
      .insert({ folder_id: folderId, title: "Untitled", content: [], created_by: userId })
      .select()
      .single();
    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setSelectedNoteId(data.id);
    }
  }

  async function handleRenameNote(id: string, title: string) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
    await supabase.from("notes").update({ title }).eq("id", id);
  }

  async function handleDeleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
    await supabase.from("notes").delete().eq("id", id);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        folders={folders}
        notes={notes}
        selectedNoteId={selectedNoteId}
        onSelectNote={setSelectedNoteId}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onCreateNote={handleCreateNote}
        onRenameNote={handleRenameNote}
        onDeleteNote={handleDeleteNote}
      />
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-end border-b border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
          <span className="mr-3">{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </div>
        {selectedNote ? (
          <NoteEditor key={selectedNote.id} note={selectedNote} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
            Select or create a note
          </div>
        )}
      </div>
    </div>
  );
}
