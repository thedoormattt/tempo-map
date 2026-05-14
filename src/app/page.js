import BPMAnalyser from "@/components/BPMAnalyser";

export default function Home() {
  console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);
  return <BPMAnalyser />;
}
