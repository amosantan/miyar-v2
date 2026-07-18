import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { trpc as api } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/_core/hooks/useAuth";
import { enterAuthenticatedApp } from "@/lib/auth-navigation";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isRegister, setIsRegister] = useState(false);
    const { user, loading: sessionLoading } = useAuth();

    useEffect(() => {
        if (!sessionLoading && user) {
            enterAuthenticatedApp(window.location);
        }
    }, [sessionLoading, user]);

    const loginMutation = api.auth.login.useMutation({
        onSuccess: () => {
            enterAuthenticatedApp(window.location);
        },
        onError: (error) => {
            toast.error("Login failed", { description: error.message });
        },
    });

    const registerMutation = api.auth.register.useMutation({
        onSuccess: () => {
            toast.success("Account created", { description: "You are now logged in." });
            enterAuthenticatedApp(window.location);
        },
        onError: (error) => {
            toast.error("Registration failed", { description: error.message });
        },
    });

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isRegister) {
            registerMutation.mutate({ email, password });
        } else {
            loginMutation.mutate({ email, password });
        }
    };

    const isPending = loginMutation.isPending || registerMutation.isPending;

    if (sessionLoading || user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-background px-5 py-12">
            <div className="absolute right-5 top-5 flex gap-2"><ThemeToggle compact /><LanguageToggle compact /></div>
            <Card className="w-full max-w-md">
                <CardHeader>
                    <a href="/" className="mb-6 flex items-baseline gap-2"><span className="font-serif text-2xl">MIYAR</span><span className="text-xs text-muted-foreground">مِعيار</span></a>
                    <CardTitle className="font-serif text-3xl">{isRegister ? "Create your account" : "Welcome back"}</CardTitle>
                    <CardDescription>
                        {isRegister
                            ? "Create an account to start your first project decision."
                            : "Sign in to continue to your organization workspace."}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={onSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="m@example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button className="w-full" type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isRegister ? "Sign Up" : "Sign In"}
                        </Button>
                        <Button
                            type="button"
                            variant="link"
                            className="px-0 font-normal"
                            onClick={() => setIsRegister(!isRegister)}
                        >
                            {isRegister
                                ? "Already have an account? Sign in"
                                : "Don't have an account? Sign up"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
