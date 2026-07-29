export default function Loading() {
  return (
    <div className="max-w-lg mx-auto p-8 text-center pt-20 space-y-6">
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-32 bg-muted rounded mx-auto" />
        <div className="h-4 w-48 bg-muted rounded mx-auto" />
        <div className="h-32 w-full max-w-sm bg-muted rounded mx-auto mt-8" />
        <div className="h-32 w-full max-w-sm bg-muted rounded mx-auto" />
      </div>
    </div>
  );
}
