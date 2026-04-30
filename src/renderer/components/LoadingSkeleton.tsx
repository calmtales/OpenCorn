const shimmer = {
  background:
    "linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-elevated) 50%, var(--bg-tertiary) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
  borderRadius: "var(--radius-sm)",
};

export function SceneCardSkeleton() {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <div style={{ ...shimmer, width: "100%", aspectRatio: "16/9" }} />
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column" as const, gap: 6 }}>
        <div style={{ ...shimmer, width: "60%", height: 12 }} />
        <div style={{ ...shimmer, width: "100%", height: 10 }} />
        <div style={{ ...shimmer, width: "80%", height: 10 }} />
      </div>
    </div>
  );
}

export function StoryboardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, padding: 4 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SceneCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HistoryItemSkeleton() {
  return (
    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column" as const, gap: 6, borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ ...shimmer, width: "70%", height: 12 }} />
      <div style={{ ...shimmer, width: "40%", height: 10 }} />
    </div>
  );
}

export function HistoryListSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <HistoryItemSkeleton key={i} />
      ))}
    </>
  );
}

export function PlayerSkeleton() {
  return (
    <div style={{ width: "100%", aspectRatio: "16/9", ...shimmer }} />
  );
}

export function SettingsRowSkeleton() {
  return (
    <div style={{ padding: "8px 0", display: "flex", flexDirection: "column" as const, gap: 6 }}>
      <div style={{ ...shimmer, width: "30%", height: 10 }} />
      <div style={{ ...shimmer, width: "100%", height: 32 }} />
    </div>
  );
}
