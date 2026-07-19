import { lazy, Suspense, useState } from "react";
import { Sparkles, Bot } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Message } from "./AIChatBox";
import { trpc } from "@/lib/trpc";
import { formatAiOperationError, withReference } from "@/lib/ai-operation-error";

const AIChatBox = lazy(() =>
    import("./AIChatBox").then((module) => ({ default: module.AIChatBox }))
);

export function AiAssistantPanel() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hello! I am the MIYAR AI Assistant. You can ask me questions about your projects, benchmarks, and market intel, and I will query the database to find answers for you." }
    ]);

    const nlQueryMutation = trpc.autonomous.nlQuery.useMutation({
        onSuccess: (data) => {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.textOutput }
            ]);
        },
        onError: (err) => {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: withReference(formatAiOperationError(err, "I could not process that request. Please try again.")) }
            ]);
        }
    });

    const handleSendMessage = (content: string) => {
        setMessages((prev) => [...prev, { role: "user", content }]);
        nlQueryMutation.mutate({ query: content });
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 border border-border"
                    aria-label="Open MIYAR Intelligence"
                >
                    <Sparkles className="h-4 w-4 text-miyar-emerald" />
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full max-w-[400px] sm:max-w-[500px] p-0 flex flex-col border-l border-border bg-card">
                <SheetHeader className="p-4 border-b flex-row justify-between items-center bg-muted/30">
                    <SheetTitle className="flex items-center gap-2 text-lg">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                        </div>
                        MIYAR Intelligence
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-hidden p-4">
                    {open && (
                        <Suspense
                            fallback={(
                                <div className="flex h-full items-center justify-center text-sm text-muted-foreground" role="status">
                                    Loading MIYAR Intelligence…
                                </div>
                            )}
                        >
                            <AIChatBox
                                messages={messages}
                                onSendMessage={handleSendMessage}
                                isLoading={nlQueryMutation.isPending}
                                height="100%"
                                className="border-none shadow-none"
                                placeholder="Ask about your project scores, benchmarks, etc..."
                                suggestedPrompts={[
                                    "Show me projects with risk score > 60",
                                    "Which benchmarks have high area variance?",
                                    "What active alerts do I have right now?",
                                ]}
                            />
                        </Suspense>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
