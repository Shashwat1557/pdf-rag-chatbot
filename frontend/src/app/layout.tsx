import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocChat — chat with your PDFs',
  description: 'Upload PDFs and ask questions with cited, page-referenced answers. Powered by a local RAG pipeline with OpenAI embeddings and Groq LLM.',
  applicationName: 'DocChat',
  keywords: ['PDF', 'RAG', 'chatbot', 'AI', 'document intelligence'],
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
