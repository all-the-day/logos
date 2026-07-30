"use client";

interface BookSelectorProps {
  books: Array<{ id: number; name: string; imported?: boolean }>;
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

  const renderSelect = (list: typeof books, label: string, ntFilter: boolean) => (
    <div>
      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
        {label}
      </label>
      <select
        className="w-full px-3 py-2 border rounded-md bg-background text-sm"
        value={selectedId && (ntFilter ? selectedId > 39 : selectedId <= 39) ? selectedId : ""}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v) onSelect(v);
        }}
      >
        <option value="" disabled>选择{label}书卷...</option>
        {list.map((book) => (
          <option key={book.id} value={book.id}>
            {book.name}{book.imported ? "" : ""}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground mt-1">
        {list.filter((b) => b.imported).length}/{list.length} 已缓存
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {renderSelect(nt, "新约", true)}
      {renderSelect(ot, "旧约", false)}

      {selectedId && (
        <p className="text-xs text-muted-foreground">
          已选：{books.find((b) => b.id === selectedId)?.name}
          {!books.find((b) => b.id === selectedId)?.imported && "（首次将自动导入）"}
        </p>
      )}
    </div>
  );
}
