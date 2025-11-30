import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PP - Sistema de Gestión de Servidores",
  description: "Sistema de gestión de servidores con Ansible",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
