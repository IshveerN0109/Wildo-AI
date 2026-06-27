import { Card, CardContent } from "@/components/ui/card";
import { Brain, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="h-full w-full flex items-center justify-center animate-in fade-in duration-500">
      <Card className="w-full max-w-md mx-4 bg-card border-none shadow-sm">
        <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
          <div className="p-4 bg-muted rounded-full mb-6">
            <Brain className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <h1 className="text-3xl font-bold font-serif text-foreground mb-2">404 - Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/">
            <Button variant="default">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
