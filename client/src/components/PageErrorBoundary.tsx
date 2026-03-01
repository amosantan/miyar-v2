import { Component, ReactNode } from "react";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
    children: ReactNode;
    /** Label shown in the "Go back" button (default: "Go Back") */
    backLabel?: string;
    /** URL to navigate to on "Go back" (default: browser history back) */
    backHref?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * In-page error boundary that shows a friendly error card instead of
 * crashing the entire app. Designed for wrapping project sub-pages and
 * other routes that may fail due to data issues.
 */
export class PageErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    private handleBack = () => {
        if (this.props.backHref) {
            window.location.href = this.props.backHref;
        } else {
            window.history.back();
        }
    };

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-[60vh] p-6">
                    <Card className="max-w-lg w-full border-destructive/30">
                        <CardContent className="pt-8 pb-6 flex flex-col items-center text-center">
                            <div className="rounded-full bg-destructive/10 p-4 mb-4">
                                <AlertTriangle className="h-8 w-8 text-destructive" />
                            </div>

                            <h2 className="text-xl font-semibold mb-2">
                                Something went wrong
                            </h2>
                            <p className="text-sm text-muted-foreground mb-4">
                                This page encountered an error. The issue has been noted and
                                you can try again or go back.
                            </p>

                            {this.state.error && (
                                <div className="w-full rounded-md bg-muted/50 p-3 mb-6 text-left">
                                    <p className="text-xs font-mono text-muted-foreground break-all">
                                        {this.state.error.message}
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={this.handleBack}
                                    className="gap-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    {this.props.backLabel || "Go Back"}
                                </Button>
                                <Button onClick={this.handleRetry} className="gap-2">
                                    <RotateCcw className="h-4 w-4" />
                                    Try Again
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
