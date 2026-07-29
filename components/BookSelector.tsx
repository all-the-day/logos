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
  const ot = books.filter((b) => b.id <= 39);
  const nt = books.filter((b) => b.id > 39);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
          新约
        </label>
        <select
          className="w-full px-3 py-2 border rounded-md bg-background text-sm"
          value={selectedId && selectedId > 39 ? selectedId : ""}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v) onSelect(v);
          }}
        >
          <option value="" disabled>选择新约书卷...</option>
          {nt.map((book) => (
            <option key={book.id} value={book.id}>
              {book.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
          旧约
        </label>
        <select
          className="w-full px-3 py-2 border rounded-md bg-background text-sm"
          value={selectedId && selectedId <= 39 ? selectedId : ""}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v) onSelect(v);
          }}
        >
          <option value="" disabled>选择旧约书卷...</option>
          {ot.map((book) => (
            <option key={book.id} value={book.id}>
              {book.name}
            </option>
          ))}
        </select>
      </div>

      {selectedId && (
        <p className="text-xs text-muted-foreground">
          已选：{books.find((b) => b.id === selectedId)?.name}
        </p>
      )}
    </div>
  );
}
