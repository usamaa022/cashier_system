// app/transport/page.js
import ProtectedRoute from "@/components/ProtectedRoute";
import TransportPageContent from "./TransportPageContent";

export default function TransportPage() {
  return (
    <ProtectedRoute>
      <TransportPageContent />
    </ProtectedRoute>
  );
}
