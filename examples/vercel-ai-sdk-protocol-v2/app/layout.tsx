/**
 * @file layout.tsx
 * @description Minimal Next.js root layout for the snippet pack.
 */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
