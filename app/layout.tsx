import "./globals.css";

export const metadata = {
  title: "Hệ thống Quản lý Lịch",
  description: "Phần mềm tòa án",
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