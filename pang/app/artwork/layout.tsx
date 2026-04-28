export default function ArtworkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      {children}
    </div>
  );
}
