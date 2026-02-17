import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div className="text-6xl font-bold text-primary/20">404</div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Page Not Found</h1>
          <p className="text-sm text-muted-foreground mt-2">The page you're looking for doesn't exist.</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Button>
      </div>
    </div>
  );
}
