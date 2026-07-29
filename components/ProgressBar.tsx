"use client";

interface ProgressBarProps {
  mastered: number;
  learning: number;
  newCount: number;
  total: number;
}

export default function ProgressBar({
  mastered,
  learning,
  newCount,
  total,
}: ProgressBarProps) {
  if (total === 0) return null;

  const masteredPct = (mastered / total) * 100;
  const learningPct = (learning / total) * 100;
  const newPct = (newCount / total) * 100;

  return (
    <div className="w-full">
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {masteredPct > 0 && (
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${masteredPct}%` }}
          />
        )}
        {learningPct > 0 && (
          <div
            className="bg-orange-400 transition-all"
            style={{ width: `${learningPct}%` }}
          />
        )}
        {newPct > 0 && (
          <div
            className="bg-blue-200 transition-all"
            style={{ width: `${newPct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          已掌握 {mastered}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          学习中 {learning}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-200 inline-block" />
          新 {newCount}
        </span>
      </div>
    </div>
  );
}
