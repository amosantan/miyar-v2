import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { api } from "@/_core/trpc";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isRegister, setIsRegister] = useState(false);
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const loginMutation = api.auth.login.useMutation({
        onSuccess: () => {
            setLocation("/");
            window.location.reload();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const registerMutation = api.auth.register.useMutation({
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Account created successfully. You are now logged in.",
            });
            setLocation("/");
            window.location.reload();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
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

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">{isRegister ? "Create Account" : "Login"}</CardTitle>
                    <CardDescription>
                        {isRegister
                            ? "Enter your email and password to create an account."
                            : "Enter your email and password to access your account."}
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
