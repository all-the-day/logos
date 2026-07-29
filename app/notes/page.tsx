import * as noteDb from "@/db/note";
import * as verseDb from "@/db/verse";
import NotesClient from "./NotesClient";

export default async function NotesPage() {
  const notes = await noteDb.getAllNotes();
  const books = await verseDb.getAllBooks();
  return (
    <NotesClient
      notes={JSON.parse(JSON.stringify(notes))}
      books={JSON.parse(JSON.stringify(books))}
    />
  );
}
