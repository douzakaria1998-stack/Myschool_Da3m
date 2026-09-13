import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '../context/AppContext';
import LayoutWrapper from '../components/LayoutWrapper';

export const metadata: Metadata = {
  title: 'مؤسسة دعم للدروس الخصوصية والتعليمية | Da3m Education',
  description: 'نظام متكامل لإدارة دروس الدعم، متابعة الحضور، تسوية مستحقات الأساتذة وسجل الديون والمدفوعات',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning>
        <AppProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </AppProvider>
      </body>
    </html>
  );
}
