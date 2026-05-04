import "./globals.css";

export const metadata = {
  title: "Hệ thống Quản lý Lịch",
  description: "Phần mềm tòa án",
  manifest: "/manifest.json",
  icons: {
    icon: '/icon-192x192.png',
    shortcut: '/icon-192x192.png',
    apple: '/icon-192x192.png', // Dòng này là "chân ái" cho iPhone nè
  },
};
export const viewport = {
  themeColor: "#b91c1c", 
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-slate-50 text-slate-800 antialiased">
        {children}
      </body>
    </html>
  );
}