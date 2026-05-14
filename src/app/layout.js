import "./globals.css";

export const metadata = {
  title: "Tempo Map — BPM Analyser",
  description:
    "Visualise how the tempo of a song changes over time. Drop any audio file for an instant BPM curve — all processing happens in your browser.",
  openGraph: {
    title: "Tempo Map",
    description: "See how BPM changes throughout a song.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
