import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  FileDown,
  Loader2,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/routes/index";
import { api, formatNumber, type DashboardGeral, type EventoResumo } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { exportarRankingEventoPDF } from "@/lib/pdf-export";

export const Route = createFileRoute("/eventos/")({
  head: () => ({
    meta: [
      { title: "Eventos — EmpathTech" },
      {
        name: "description",
        content: "Lista de todos os eventos de coleta — administre, abra rankings e exporte.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell>
        <ListaEventosPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

function ListaEventosPage() {
  const { user } = useAuth();
  const isAdmin = user?.cargo === "admin";
  const [dashboard, setDashboard] = useState<DashboardGeral | null>(null);
  const [resumo, setResumo] = useState<EventoResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.eventos.atualResumo();
        // Dashboard só está disponível para admin; não-admins veem apenas o evento atual.
        const d = isAdmin
          ? await api.eventos
              .dashboardGeral({ admin_id: user.id })
              .catch(() => ({ timeline: [], comparativo_eventos: [] } as DashboardGeral))
          : ({ timeline: [], comparativo_eventos: [] } as DashboardGeral);
        if (!alive) return;
        setDashboard(d);
        setResumo(r);
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, isAdmin, reloadKey]);

  const eventos = useMemo(() => {
    let lista = dashboard?.comparativo_eventos ?? [];
    // Para usuários não-admin (sem acesso ao dashboard global), pelo menos o
    // evento atual aparece na listagem.
    if (lista.length === 0 && resumo?.evento) {
      lista = [
        {
          evento_id: resumo.evento.id,
          nome: resumo.evento.nome,
          total_itens: Number(resumo.total_itens ?? 0),
        },
      ];
    }
    const norm = filtro.trim().toLowerCase();
    return norm ? lista.filter((e) => e.nome.toLowerCase().includes(norm)) : lista;
  }, [dashboard, filtro, resumo]);

  const exportarEvento = async (eventoId: number, nome: string) => {
    setExportingId(eventoId);
    try {
      const r = await api.eventos.rankingGrupos(eventoId);
      exportarRankingEventoPDF({
        eventoNome: nome,
        eventoId,
        ranking: r.ranking_grupos,
      });
      toast.success("PDF gerado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar PDF");
    } finally {
      setExportingId(null);
    }
  };

  const handleDeleteEvento = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.eventos.deletar(deleteTarget.id, { admin_id: user.id });
      toast.success(`Evento "${deleteTarget.nome}" excluído.`);
      setDeleteTarget(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir evento");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" /> Eventos
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Visualize todos os eventos com coletas, abra rankings e exporte relatórios."
              : "Acompanhe o evento ativo e revise rankings de eventos passados."}
          </p>
        </div>
        {isAdmin && (
          <Button asChild className="gradient-warm text-secondary-foreground shadow-warm">
            <Link to="/admin">
              <CalendarPlus className="h-4 w-4" /> Criar evento (no painel)
            </Link>
          </Button>
        )}
      </header>

      {/* Evento atual destaque */}
      {resumo?.evento && (
        <section className="rounded-2xl border border-success/30 bg-success/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-success text-success-foreground font-semibold uppercase tracking-wider w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-success-foreground animate-pulse" />
            Em andamento
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{resumo.evento.nome}</div>
            <div className="text-xs text-muted-foreground">
              {formatNumber(resumo.total_itens)} itens · {formatNumber(resumo.total_coletas)}{" "}
              coletas
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link
              to="/eventos/$eventoId"
              params={{ eventoId: String(resumo.evento.id) }}
            >
              Abrir <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </section>
      )}

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar evento por nome..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        </div>
      ) : eventos.length === 0 ? (
        <EmptyState
          title="Nenhum evento encontrado"
          message="Crie um evento no painel administrativo para começar."
        />
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {eventos.map((e, i) => {
            const ehAtual = resumo?.evento?.id === e.evento_id;
            return (
              <li
                key={e.evento_id}
                className={`rounded-2xl border p-4 flex flex-col gap-3 transition hover:shadow-md ${
                  ehAtual
                    ? "border-success/40 bg-success/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{e.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      ID #{e.evento_id} {ehAtual && " · em andamento"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-primary">
                      {formatNumber(e.total_itens)}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      itens
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link
                      to="/eventos/$eventoId"
                      params={{ eventoId: String(e.evento_id) }}
                    >
                      <TrendingUp className="h-3.5 w-3.5" /> Ranking
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    disabled={exportingId === e.evento_id}
                    onClick={() => exportarEvento(e.evento_id, e.nome)}
                  >
                    {exportingId === e.evento_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" />
                    )}{" "}
                    PDF
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTarget({ id: e.evento_id, nome: e.nome })}
                      aria-label={`Excluir evento ${e.nome}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Excluir evento permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O evento <strong>{deleteTarget?.nome}</strong> e todas as coletas
              vinculadas serão removidos. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(ev) => {
                ev.preventDefault();
                handleDeleteEvento();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
