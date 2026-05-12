import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpDown, Award, Camera, Crown, Loader2, LogOut, Package, Plus, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { EmptyState, SkeletonList } from "@/routes/index";
import {
  api,
  formatNumber,
  type GrupoRanking,
  type GrupoMeu,
  type TopItem,
  type UsuarioRanking,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAlimentoNome } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
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

export const Route = createFileRoute("/eventos/$eventoId")({
  head: ({ params }) => ({
    meta: [
      { title: `Evento #${params.eventoId} — EmpathTech` },
      { name: "description", content: "Detalhes do evento, ranking de grupos e usuários." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell>
        <EventoDetalhe />
      </AppShell>
    </ProtectedRoute>
  ),
});

type Order = "total_desc" | "total_asc" | "nome";

function EventoDetalhe() {
  const { eventoId } = Route.useParams();
  const evtId = Number(eventoId);
  const { user } = useAuth();

  const [grupos, setGrupos] = useState<GrupoRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>("total_desc");

  const [grupoSelecionado, setGrupoSelecionado] = useState<string>("");
  const [usuarios, setUsuarios] = useState<UsuarioRanking[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [meusGruposNoEvento, setMeusGruposNoEvento] = useState<GrupoMeu[]>([]);
  const [meusGruposGerais, setMeusGruposGerais] = useState<GrupoMeu[]>([]);
  const [grupoParaInscrever, setGrupoParaInscrever] = useState<string>("");
  const [inscrevendo, setInscrevendo] = useState(false);
  const [reloadGrupos, setReloadGrupos] = useState(0);
  const [sairGrupoId, setSairGrupoId] = useState<number | null>(null);
  const [sairLoading, setSairLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const g = await api.eventos.rankingGrupos(evtId);
        if (!alive) return;
        setGrupos(g.ranking_grupos);
        if (g.ranking_grupos[0]) {
          setGrupoSelecionado(String(g.ranking_grupos[0].id));
        }
      } catch (e) {
        if (alive) setErro(e instanceof Error ? e.message : "Erro");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [evtId]);

  // Verifica se o usuário tem grupos inscritos NESTE evento.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const [doEvento, todos] = await Promise.all([
          api.grupos.meus(user.id, evtId),
          api.grupos.meus(user.id),
        ]);
        if (!alive) return;
        setMeusGruposNoEvento(doEvento);
        setMeusGruposGerais(todos);
      } catch {
        if (alive) {
          setMeusGruposNoEvento([]);
          setMeusGruposGerais([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, evtId, reloadGrupos]);

  useEffect(() => {
    if (!grupoSelecionado) return;
    let alive = true;
    (async () => {
      try {
        setLoadingUsuarios(true);
        const r = await api.grupos.rankingUsuarios(Number(grupoSelecionado), evtId);
        if (alive) setUsuarios(r.ranking_usuarios);
      } catch {
        if (alive) setUsuarios([]);
      } finally {
        if (alive) setLoadingUsuarios(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [grupoSelecionado, evtId]);

  const sorted = [...grupos].sort((a, b) => {
    if (order === "total_asc") return a.total_itens - b.total_itens;
    if (order === "nome") return a.nome.localeCompare(b.nome);
    return b.total_itens - a.total_itens;
  });

  // Agrega itens mais coletados a partir do top3 de cada grupo.
  const topItensEvento: TopItem[] = (() => {
    const map = new Map<string, number>();
    for (const g of grupos) {
      for (const t of g.top3_itens || []) {
        const nome = formatAlimentoNome(t.nome);
        if (!nome) continue;
        map.set(nome, (map.get(nome) ?? 0) + Number(t.quantidade || 0));
      }
    }
    return Array.from(map.entries())
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  })();
  const maxItem = topItensEvento[0]?.quantidade || 1;

  // Grupos do usuário que ainda não foram inscritos neste evento.
  const idsNoEvento = new Set(meusGruposNoEvento.map((g) => g.id));
  const gruposDisponiveisParaInscrever = Array.from(
    new Map(
      meusGruposGerais
        .filter((g) => !idsNoEvento.has(g.id) && g.sou_lider)
        .map((g) => [g.id, g] as const),
    ).values(),
  );

  const inscreverGrupo = async () => {
    if (!user || !grupoParaInscrever) return;
    try {
      setInscrevendo(true);
      await api.grupos.entrarEvento(Number(grupoParaInscrever), {
        solicitante_id: user.id,
        evento_id: evtId,
      });
      toast.success("Grupo inscrito no evento com sucesso!");
      setGrupoParaInscrever("");
      setReloadGrupos((n) => n + 1);
      // Recarrega ranking de grupos do evento.
      const g = await api.eventos.rankingGrupos(evtId);
      setGrupos(g.ranking_grupos);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao inscrever grupo");
    } finally {
      setInscrevendo(false);
    }
  };

  const grupoParaSair = meusGruposNoEvento.find((g) => g.id === sairGrupoId);

  const sairDoEvento = async () => {
    if (!user || !sairGrupoId) return;
    setSairLoading(true);
    try {
      await api.grupos.sairEvento(sairGrupoId, {
        solicitante_id: user.id,
        evento_id: evtId,
      });
      toast.success("Grupo removido do evento.");
      setSairGrupoId(null);
      setReloadGrupos((n) => n + 1);
      const g = await api.eventos.rankingGrupos(evtId);
      setGrupos(g.ranking_grupos);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sair do evento");
    } finally {
      setSairLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao início
      </Link>

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Ranking do evento
          </h1>
          <p className="text-sm text-muted-foreground">
            Grupos ordenados pelo total de itens coletados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meusGruposNoEvento.length > 0 ? (
            <Button
              asChild
              className="gradient-warm text-secondary-foreground shadow-warm"
              size="sm"
            >
              <Link to="/coleta" search={{ eventoId: evtId }}>
                <Camera className="h-4 w-4" /> Coletar neste evento
              </Link>
            </Button>
          ) : null}
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={order} onValueChange={(v) => setOrder(v as Order)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total_desc">Mais itens primeiro</SelectItem>
              <SelectItem value="total_asc">Menos itens primeiro</SelectItem>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Card de inscrição de grupo no evento */}
      {user && (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          {meusGruposNoEvento.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex-1">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Você participa deste evento
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {meusGruposNoEvento.length === 1
                    ? "1 grupo seu inscrito."
                    : `${meusGruposNoEvento.length} grupos seus inscritos.`}
                </p>
              </div>
              {gruposDisponiveisParaInscrever.length > 0 && (
                <InscreverGrupoControl
                  grupos={gruposDisponiveisParaInscrever}
                  value={grupoParaInscrever}
                  onChange={setGrupoParaInscrever}
                  onSubmit={inscreverGrupo}
                  loading={inscrevendo}
                />
              )}
              </div>
              <ul className="flex flex-wrap gap-2">
                {meusGruposNoEvento.map((g) => (
                  <li
                    key={g.id}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs"
                  >
                    <span className="font-medium">{g.nome}</span>
                    {g.sou_lider && (
                      <>
                        <span className="text-[10px] text-secondary font-bold uppercase">
                          Líder
                        </span>
                        <button
                          type="button"
                          onClick={() => setSairGrupoId(g.id)}
                          className="inline-flex items-center gap-1 text-destructive hover:underline"
                        >
                          <LogOut className="h-3 w-3" /> Sair
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : gruposDisponiveisParaInscrever.length > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Inscreva seu grupo neste evento
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Apenas líderes podem inscrever um grupo. Após inscrever, vocês poderão
                  coletar.
                </p>
              </div>
              <InscreverGrupoControl
                grupos={gruposDisponiveisParaInscrever}
                value={grupoParaInscrever}
                onChange={setGrupoParaInscrever}
                onSubmit={inscreverGrupo}
                loading={inscrevendo}
              />
            </div>
          ) : meusGruposGerais.length === 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold">Você ainda não tem grupos</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Crie um grupo para participar deste evento.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/grupos">
                  <Plus className="h-4 w-4" /> Criar grupo
                </Link>
              </Button>
            </div>
          ) : (
            <div>
              <h3 className="font-semibold">Sem grupos elegíveis</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Apenas líderes podem inscrever um grupo neste evento. Peça ao líder do
                seu grupo para realizar a inscrição.
              </p>
            </div>
          )}
        </section>
      )}

      <AlertDialog
        open={sairGrupoId !== null}
        onOpenChange={(open) => {
          if (!open) setSairGrupoId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover grupo do evento?</AlertDialogTitle>
            <AlertDialogDescription>
              {grupoParaSair
                ? `O grupo "${grupoParaSair.nome}" será removido deste evento. As coletas já feitas serão mantidas no histórico. Você poderá se inscrever novamente depois.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sairLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                sairDoEvento();
              }}
              disabled={sairLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {sairLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, sair"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {erro && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive p-4 text-sm">
          {erro}
        </div>
      )}

      {loading ? (
        <SkeletonList />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="Nenhum grupo participando"
          message="Crie um grupo na aba Grupos para começar."
        />
      ) : (
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
          {/* Principais itens coletados */}
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 h-fit">
            <h2 className="font-bold flex items-center gap-2 mb-1">
              <Package className="h-5 w-5 text-primary" />
              Principais itens coletados
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Soma estimada a partir do top de cada grupo.
            </p>
            {topItensEvento.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem itens ainda.</div>
            ) : (
              <ol className="space-y-2.5">
                {topItensEvento.map((t, i) => (
                  <li key={t.nome} className="space-y-1">
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                          {i + 1}
                        </span>
                        <span className="truncate font-medium">{t.nome}</span>
                      </span>
                      <span className="font-bold text-primary shrink-0">
                        {formatNumber(t.quantidade)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full gradient-warm rounded-full"
                        style={{ width: `${(t.quantidade / maxItem) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Ranking de grupos */}
          <section>
            <h2 className="font-bold flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-primary" />
              Grupos do evento
            </h2>
            <ol className="space-y-3">
              {sorted.map((g, idx) => (
            <li
              key={g.id}
              className="bg-card rounded-2xl border border-border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-xl text-lg font-bold shrink-0 ${
                  order === "total_desc" && idx === 0
                    ? "gradient-warm text-secondary-foreground"
                    : "bg-accent text-accent-foreground"
                }`}
              >
                {order === "total_desc" && idx === 0 ? (
                  <Crown className="h-5 w-5" />
                ) : (
                  `#${idx + 1}`
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{g.nome}</div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {g.top3_itens.length === 0 && (
                    <span className="text-xs text-muted-foreground">Sem itens ainda</span>
                  )}
                  {g.top3_itens.map((t, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium"
                    >
                      {formatAlimentoNome(t.nome)} · {formatNumber(t.quantidade)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {formatNumber(g.total_itens)}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  itens
                </div>
              </div>
            </li>
              ))}
            </ol>
          </section>
        </div>
      )}

      {/* Ranking de usuários */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              Ranking dentro do grupo
            </h2>
            <p className="text-sm text-muted-foreground">
              Quem mais coletou no grupo selecionado.
            </p>
          </div>
          {grupos.length > 0 && (
            <Select value={grupoSelecionado} onValueChange={setGrupoSelecionado}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                {grupos.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {loadingUsuarios ? (
          <SkeletonList />
        ) : usuarios.length === 0 ? (
          <EmptyState
            title="Sem coletas neste grupo"
            message="Assim que alguém coletar, o ranking aparecerá."
          />
        ) : (
          <ol className="space-y-3">
            {usuarios.map((u, idx) => (
              <li
                key={u.id}
                className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent text-accent-foreground font-bold text-sm">
                  #{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {u.nome} {u.sobrenome}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {u.top3_itens.map((t, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-secondary/30 text-secondary-foreground font-medium"
                      >
                        {formatAlimentoNome(t.nome)} · {formatNumber(t.quantidade)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-xl font-bold text-primary">
                  {formatNumber(u.total_itens)}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function InscreverGrupoControl({
  grupos,
  value,
  onChange,
  onSubmit,
  loading,
}: {
  grupos: GrupoMeu[];
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder="Escolha um grupo" />
        </SelectTrigger>
        <SelectContent>
          {grupos.map((g) => (
            <SelectItem key={g.id} value={String(g.id)}>
              {g.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={onSubmit}
        disabled={!value || loading}
        size="sm"
        className="gradient-warm text-secondary-foreground shadow-warm"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Inscrever grupo
      </Button>
    </div>
  );
}
