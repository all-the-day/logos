import type { Metadata } from "next";
import { redirect } from "next/navigation";
import * as noteDb from "@/db/note";
import * as verseDb from "@/db/verse";
import { requireUser } from "@/lib/auth";
import NotesClient from "./NotesClient";

export const metadata: Metadata = {
  title: "笔记 - Logos",
};

export default async function NotesPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const notes = await noteDb.getAllNotes(user.id);
  const books = await verseDb.getAllBooks();
  return (
    <NotesClient
      notes={JSON.parse(JSON.stringify(notes))}
      books={JSON.parse(JSON.stringify(books))}
    />
  );
}
