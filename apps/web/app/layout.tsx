import './../styles/globals.css';
import type { Metadata } from 'next';
import { AmplifyProvider } from '@/components/amplify-provider';

export const metadata: Metadata = { title: 'LifeOS', description: 'Personal life dashboard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans">
        <AmplifyProvider>{children}</AmplifyProvider>
      </body>
    </html>
  );
}
