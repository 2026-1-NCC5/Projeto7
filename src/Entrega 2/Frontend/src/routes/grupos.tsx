import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarCheck, Crown, Loader2, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { EmptyState, SkeletonList } from "@/routes/index";
import { api, type EventoResumo, type GrupoMeu } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/grupos")({
  head: () => ({
    meta: [
      { title: "Grupos — EmpathTech" },
      { name: "description", content: "Crie e gerencie grupos de coleta no evento ativo." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell>
        <GruposPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Replica a regra do backend (`getEventoAtivo`) para decidir se um evento
 * pode receber novas inscrições/grupos. O evento precisa:
 *  - estar com status 'ativo';
 *  - já ter começado (data_inicio <= agora);
 *  - não ter terminado (data_fim nulo ou >= agora).
 *
 * Datas são interpretadas como UTC para evitar divergência de fuso entre
 * o que o backend envia (ISO/UTC) e o relógio local do navegador.
 */
function avaliarElegibilidade(evento: EventoResumo["evento"]): {
  elegivel: boolean;
  motivo: string | null;
} {
  if (!evento) return { elegivel: false, motivo: "Nenhum evento ativo no momento." };
  if (evento.status !== "ativo") {
    return { elegivel: false, motivo: `Evento está com status "${evento.status}".` };
  }
  const agora = Date.now();
  const inicio = new Date(evento.data_inicio).getTime();
  if (Number.isFinite(inicio) && agora < inicio) {
    return {
      elegivel: false,
      motivo: `O evento começa em ${new Date(evento.data_inicio).toLocaleString("pt-BR")}.`,
    };
  }
  if (evento.data_fim) {
    const fim = new Date(evento.data_fim).getTime();
    if (Number.isFinite(fim) && agora > fim) {
      return {
        elegivel: false,
        motivo: `O evento terminou em ${new Date(evento.data_fim).toLocaleString("pt-BR")}.`,
      };
    }
  }
  return { elegivel: true, motivo: null };
}

function GruposPage() {
  const { user } = useAuth();
  const [resumo, setResumo] = useState<EventoResumo | null>(null);
  const [meusGrupos, setMeusGrupos] = useState<GrupoMeu[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [inscrevendoId, setInscrevendoId] = useState<number | null>(null);
  const [meusGruposNoEvento, setMeusGruposNoEvento] = useState<Set<number>>(new Set());
  const [deletarGrupoId, setDeletarGrupoId] = useState<number | null>(null);
  const [confirmaNome, setConfirmaNome] = useState("");
  const [deletarLoading, setDeletarLoading] = useState(false);

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [r, g] = await Promise.all([
        api.eventos.atualResumo(),
        api.grupos.meus(user.id),
      ]);
      setResumo(r);
      setMeusGrupos(g);
      // Quais dos meus grupos já estão no evento atual?
      if (r.evento) {
        try {
          const noEvento = await api.grupos.meus(user.id, r.evento.id);
          setMeusGruposNoEvento(new Set(noEvento.map((x) => x.id)));
        } catch {
          setMeusGruposNoEvento(new Set());
        }
      } else {
        setMeusGruposNoEvento(new Set());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const elegibilidade = avaliarElegibilidade(resumo?.evento ?? null);
  const eventoElegivel = elegibilidade.elegivel;

  const inscrever = async (grupoId: number) => {
    if (!user || !resumo?.evento) return;
    if (!eventoElegivel) {
      toast.error(elegibilidade.motivo ?? "Evento informado não está ativo.");
      return;
    }
    setInscrevendoId(grupoId);
    try {
      await api.grupos.entrarEvento(grupoId, {
        solicitante_id: user.id,
        evento_id: resumo.evento.id,
      });
      toast.success(`Grupo inscrito em "${resumo.evento.nome}"!`);
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao inscrever grupo");
    } finally {
      setInscrevendoId(null);
    }
  };

  const grupoParaDeletar = meusGrupos.find((g) => g.id === deletarGrupoId);
  const podeConfirmarDelete =
    !!grupoParaDeletar && confirmaNome.trim() === grupoParaDeletar.nome;

  const deletarGrupo = async () => {
    if (!user || !deletarGrupoId || !podeConfirmarDelete) return;
    setDeletarLoading(true);
    try {
      const r = await api.grupos.deletar(deletarGrupoId, { solicitante_id: user.id });
      toast.success(r.mensagem);
      setDeletarGrupoId(null);
      setConfirmaNome("");
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao deletar grupo");
    } finally {
      setDeletarLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" /> Grupos
          </h1>
          <p className="text-sm text-muted-foreground">
            Reúna até 10 pessoas. Quem cria o grupo é o líder.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              className="gradient-warm text-secondary-foreground shadow-warm hover:opacity-95"
              disabled={!eventoElegivel}
              title={!eventoElegivel ? elegibilidade.motivo ?? undefined : undefined}
            >
              <Plus className="h-4 w-4" /> Criar grupo
            </Button>
          </DialogTrigger>
          <CriarGrupoDialog
            eventoId={eventoElegivel ? resumo?.evento?.id : undefined}
            onCreated={() => {
              setOpen(false);
              carregar();
            }}
          />
        </Dialog>
      </header>

      {resumo?.evento && eventoElegivel ? (
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Evento ativo
          </div>
          <div className="font-semibold flex-1">{resumo.evento.nome}</div>
          {resumo.evento.local_evento && (
            <div className="text-sm text-muted-foreground">📍 {resumo.evento.local_evento}</div>
          )}
        </div>
      ) : resumo?.evento && !eventoElegivel ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 text-warning-foreground p-4 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{resumo.evento.nome}</div>
            <div className="opacity-90">
              {elegibilidade.motivo} Você poderá criar/inscrever grupos quando o
              evento estiver dentro da janela ativa.
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 text-warning-foreground p-4 text-sm">
          Nenhum evento ativo no momento. Você poderá criar grupos quando houver um evento.
        </div>
      )}

      <section>
        <h2 className="text-xl font-bold mb-3">Meus grupos</h2>
        {loading ? (
          <SkeletonList />
        ) : meusGrupos.length === 0 ? (
          <EmptyState
            title="Você ainda não tem grupos"
            message="Crie um grupo para começar a coletar."
          />
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {meusGrupos.map((g) => {
              const inscrito = meusGruposNoEvento.has(g.id);
              const podeInscrever = g.sou_lider && eventoElegivel && !inscrito;
              return (
                <li
                  key={g.id}
                  className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {g.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{g.nome}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {g.sou_lider ? (
                          <>
                            <Crown className="h-3 w-3 text-secondary" /> Você é líder
                          </>
                        ) : (
                          "Membro"
                        )}
                      </div>
                    </div>
                    {resumo?.evento && inscrito && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold whitespace-nowrap">
                        No evento
                      </span>
                    )}
                  </div>
                  {podeInscrever && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={inscrevendoId === g.id}
                      onClick={() => inscrever(g.id)}
                    >
                      {inscrevendoId === g.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CalendarCheck className="h-3.5 w-3.5" />
                      )}{" "}
                      Inscrever no evento atual
                    </Button>
                  )}
                  {g.sou_lider && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 self-start"
                      onClick={() => {
                        setDeletarGrupoId(g.id);
                        setConfirmaNome("");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Deletar grupo
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AlertDialog
        open={deletarGrupoId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletarGrupoId(null);
            setConfirmaNome("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Deletar grupo permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O grupo, seus membros e
              inscrições em eventos serão removidos. O histórico de coletas é
              mantido para relatórios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {grupoParaDeletar && (
            <div className="space-y-2">
              <Label htmlFor="confirm-nome" className="text-xs">
                Para confirmar, digite o nome do grupo:{" "}
                <span className="font-bold">{grupoParaDeletar.nome}</span>
              </Label>
              <Input
                id="confirm-nome"
                value={confirmaNome}
                onChange={(e) => setConfirmaNome(e.target.value)}
                placeholder={grupoParaDeletar.nome}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletarLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!podeConfirmarDelete || deletarLoading}
              onClick={(e) => {
                e.preventDefault();
                deletarGrupo();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletarLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sim, deletar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\s,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function CriarGrupoDialog({
  eventoId,
  onCreated,
}: {
  eventoId?: number;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [emailsRaw, setEmailsRaw] = useState("");
  const [loading, setLoading] = useState(false);

  const emails = parseEmails(emailsRaw);
  // inclui o próprio email automaticamente
  const allEmails = user ? Array.from(new Set([user.email.toLowerCase(), ...emails])) : emails;
  const invalid = allEmails.filter((e) => !EMAIL_RE.test(e));
  const ok = allEmails.length >= 3 && allEmails.length <= 10 && invalid.length === 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!ok) {
      toast.error("Verifique os emails: mínimo 3, máximo 10, todos válidos.");
      return;
    }
    setLoading(true);
    try {
      await api.grupos.criar({
        nome,
        descricao: descricao || undefined,
        criado_por: user.id,
        evento_id: eventoId,
        integrantes_emails: allEmails,
      });
      toast.success("Grupo criado e inscrito no evento!");
      setNome("");
      setDescricao("");
      setEmailsRaw("");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar grupo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" /> Criar grupo
        </DialogTitle>
        <DialogDescription>
          De 3 a 10 integrantes. Você entra automaticamente como líder.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome do grupo</Label>
          <Input
            id="nome"
            required
            maxLength={100}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Descrição (opcional)</Label>
          <Input id="desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emails">E-mails dos integrantes</Label>
          <Textarea
            id="emails"
            rows={4}
            placeholder="ana@ex.com, joao@ex.com&#10;maria@ex.com"
            value={emailsRaw}
            onChange={(e) => setEmailsRaw(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Separe por vírgula, ponto e vírgula ou quebra de linha. Seu e-mail é incluído
            automaticamente.
          </p>
        </div>

        {allEmails.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Integrantes ({allEmails.length}/10)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allEmails.map((e) => {
                const bad = !EMAIL_RE.test(e);
                const me = user && e === user.email.toLowerCase();
                return (
                  <span
                    key={e}
                    className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${
                      bad
                        ? "bg-destructive/15 text-destructive"
                        : me
                        ? "gradient-warm text-secondary-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {me && <Crown className="h-3 w-3" />}
                    {e}
                    {bad && <X className="h-3 w-3" />}
                  </span>
                );
              })}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Mínimo 3 · Máximo 10 ·{" "}
              {ok ? (
                <span className="text-success font-semibold">OK</span>
              ) : (
                <span className="text-destructive">Verifique os emails</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="submit"
            className="gradient-warm text-secondary-foreground shadow-warm"
            disabled={loading || !ok || !nome}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar grupo"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
