import { TransferForm } from "@/components/dashboard/transfer-form";

interface TransferPageProps {
  searchParams?: {
    intent?: string;
  };
}

export default function TransferPage({ searchParams }: TransferPageProps) {
  return <TransferForm intent={searchParams?.intent} />;
}
