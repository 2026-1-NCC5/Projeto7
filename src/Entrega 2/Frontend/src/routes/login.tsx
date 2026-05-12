import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logoEmpath from "@/assets/empathtech-logo.svg";
import logoLE from "@/assets/lideranca-empatica.svg";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — EmpathTech" },
      {
        name: "description",
        content: "Entre na plataforma de coleta inteligente de alimentos EmpathTech.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, senha);
      toast.success(`Bem-vindo(a), ${u.nome}!`);
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand pane */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-sidebar-foreground gradient-hero overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary-glow/30 blur-3xl" />
        <div className="relative z-10">
          <img src={logoEmpath} alt="EmpathTech" className="h-8" />
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-5xl font-bold leading-tight">
            Tecnologia <span className="text-gradient-warm">empática</span>
            <br /> para alimentar o impacto.
          </h1>
          <p className="text-base text-sidebar-foreground/80 max-w-md">
            ​
          </p>
          <div className="flex items-center gap-3 pt-4">
            <span className="text-xs uppercase tracking-widest text-sidebar-foreground/60">
              Parceiro
            </span>
            <img src={logoLE} alt="Lideranças Empáticas" className="h-12 w-12 rounded-lg" />
            <span className="text-sm font-medium">Lideranças Empáticas</span>
          </div>
        </div>
      </div>

      {/* Form pane */}
      <div className="flex flex-col justify-center p-6 sm:p-12">
        <div className="lg:hidden mb-8 flex items-center justify-between">
          <div className="bg-sidebar rounded-lg px-3 py-2">
            <img src={logoEmpath} alt="EmpathTech" className="h-6" />
          </div>
          <img src={logoLE} alt="Lideranças Empáticas" className="h-10 w-10 rounded-lg" />
        </div>

        <div className="w-full max-w-md mx-auto">
          <h2 className="text-3xl font-bold">Entrar</h2>
          <p className="text-muted-foreground mt-2">
            Acesse sua conta para iniciar uma coleta ou acompanhar o ranking.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold gradient-warm text-secondary-foreground hover:opacity-90 shadow-warm"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="text-primary font-semibold hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
