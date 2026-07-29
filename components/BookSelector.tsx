"use client";

interface BookSelectorProps {
  books: Array<{ id: number; name: string }>;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function BookSelector({
  books,
  selectedId,
  onSelect,
}: BookSelectorProps) {
  // Group books by testament
  const ot = books.filter((b) => b.id <= 39);
  const nt = books.filter((b) => b.id > 39);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          新约
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {nt.map((book) => (
            <button
              key={book.id}
              onClick={() => onSelect(book.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedId === book.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              {book.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          旧约
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {ot.map((book) => (
            <button
              key={book.id}
              onClick={() => onSelect(book.id)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedId === book.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              {book.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
