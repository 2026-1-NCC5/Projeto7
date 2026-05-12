import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logoEmpath from "@/assets/empathtech-logo.svg";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastro — EmpathTech" },
      {
        name: "description",
        content: "Crie sua conta na plataforma EmpathTech e participe das coletas.",
      },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: "", sobrenome: "", email: "", senha: "" });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await register(form.nome, form.sobrenome, form.email, form.senha);
      toast.success(`Cadastro realizado! Olá, ${u.nome}.`);
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <div className="bg-sidebar rounded-lg px-3 py-2">
            <img src={logoEmpath} alt="EmpathTech" className="h-6" />
          </div>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Já tenho conta
          </Link>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-md p-6 sm:p-8 gradient-card">
          <h1 className="text-3xl font-bold">Criar conta</h1>
          <p className="text-muted-foreground mt-1">
            Junte-se às Lideranças Empáticas e comece a coletar.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" required value={form.nome} onChange={set("nome")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sobrenome">Sobrenome</Label>
                <Input
                  id="sobrenome"
                  required
                  value={form.sobrenome}
                  onChange={set("sobrenome")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={set("email")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                required
                minLength={6}
                value={form.senha}
                onChange={set("senha")}
              />
              <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold gradient-warm text-secondary-foreground hover:opacity-90 shadow-warm"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
