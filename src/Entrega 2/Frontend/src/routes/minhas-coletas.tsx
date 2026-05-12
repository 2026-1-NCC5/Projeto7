import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, ChevronRight, Crown, History, Package, Trophy } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { EmptyState, SkeletonList } from "@/routes/index";
import {
  api,
  formatNumber,
  type EventoResumo,
  type GrupoMeu,
  type UsuarioRanking,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAlimentoNome } from "@/lib/utils";

export const Route = createFileRoute("/minhas-coletas")({
  head: () => ({
    meta: [
      { title: "Minhas coletas — EmpathTech" },
      {
        name: "description",
        content: "Veja seu histórico de coletas e desempenho dentro dos seus grupos.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell>
        <MinhasColetasPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

type GrupoComStats = GrupoMeu & {
  posicao: number;
  total: number;
  top3: { nome: string; quantidade: number }[];
  totalGrupos: number;
};

function MinhasColetasPage() {
  const { user } = useAuth();
  const [resumo, setResumo] = useState<EventoResumo | null>(null);
  const [grupos, setGrupos] = useState<GrupoComStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [meuTotal, setMeuTotal] = useState(0);
  const [meuTop, setMeuTop] = useState<{ nome: string; quantidade: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.eventos.atualResumo();
        if (!alive) return;
        setResumo(r);

        const meus = await api.grupos.meus(user.id);
        if (!alive) return;

        if (!r.evento) {
          setGrupos(meus.map((g) => ({ ...g, posicao: 0, total: 0, top3: [], totalGrupos: 0 })));
          setLoading(false);
          return;
        }

        const enriquecidos: GrupoComStats[] = [];
        let totalUser = 0;
        const agregadoTop = new Map<string, number>();

        for (const g of meus) {
          try {
            const ranking = await api.grupos.rankingUsuarios(g.id, r.evento.id);
            const minhaLinha = ranking.ranking_usuarios.find(
              (u: UsuarioRanking) => u.id === user.id,
            );
            const posicao = minhaLinha
              ? ranking.ranking_usuarios.findIndex((u: UsuarioRanking) => u.id === user.id) + 1
              : 0;
            enriquecidos.push({
              ...g,
              posicao,
              total: Number(minhaLinha?.total_itens ?? 0),
              top3: minhaLinha?.top3_itens ?? [],
              totalGrupos: ranking.ranking_usuarios.length,
            });
            if (minhaLinha) {
              totalUser += Number(minhaLinha.total_itens);
              minhaLinha.top3_itens.forEach((t) => {
                const nome = formatAlimentoNome(t.nome);
                if (!nome) return;
                agregadoTop.set(
                  nome,
                  (agregadoTop.get(nome) ?? 0) + Number(t.quantidade),
                );
              });
            }
          } catch {
            enriquecidos.push({
              ...g,
              posicao: 0,
              total: 0,
              top3: [],
              totalGrupos: 0,
            });
          }
        }

        if (!alive) return;
        setGrupos(enriquecidos.sort((a, b) => b.total - a.total));
        setMeuTotal(totalUser);
        setMeuTop(
          Array.from(agregadoTop.entries())
            .map(([nome, quantidade]) => ({ nome, quantidade }))
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, 5),
        );
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-7 w-7 text-primary" /> Minhas coletas
          </h1>
          <p className="text-sm text-muted-foreground">
            Seu desempenho no evento ativo, separado por grupo.
          </p>
        </div>
      </header>

      {/* Resumo */}
      {resumo?.evento ? (
        <section className="rounded-2xl gradient-hero text-sidebar-foreground p-6 grid sm:grid-cols-3 gap-4 relative overflow-hidden">
          <div className="absolute -top-16 -right-20 w-64 h-64 rounded-full bg-secondary/20 blur-3xl" />
          <div className="sm:col-span-2 relative z-10">
            <div className="text-xs uppercase tracking-widest text-sidebar-foreground/70">
              Evento ativo
            </div>
            <div className="font-bold text-2xl">{resumo.evento.nome}</div>
            {resumo.evento.local_evento && (
              <p className="text-sidebar-foreground/80 text-sm mt-1">
                📍 {resumo.evento.local_evento}
              </p>
            )}
          </div>
          <div className="relative z-10">
            <div className="text-xs uppercase tracking-widest text-sidebar-foreground/70">
              Você coletou
            </div>
            <div className="text-4xl font-bold leading-none mt-1">
              {formatNumber(meuTotal)}
            </div>
            <div className="text-xs text-sidebar-foreground/70 mt-1">itens no total</div>
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 text-warning-foreground p-4 text-sm">
          Nenhum evento ativo. Suas coletas anteriores aparecem assim que houver um evento em
          andamento.
        </div>
      )}

      {/* Top alimentos do usuário */}
      {meuTop.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Package className="h-5 w-5 text-primary" /> Seus alimentos mais coletados
          </h2>
          <div className="flex flex-wrap gap-2">
            {meuTop.map((t) => (
              <span
                key={t.nome}
                className="text-sm px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold"
              >
                {formatAlimentoNome(t.nome)} · {formatNumber(t.quantidade)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Grupos */}
      <section>
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" /> Por grupo
        </h2>
        {loading ? (
          <SkeletonList />
        ) : grupos.length === 0 ? (
          <EmptyState
            title="Você ainda não tem grupos"
            message="Cadastre um grupo para começar a coletar."
          />
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {grupos.map((g) => (
              <li
                key={g.id}
                className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${
                      g.posicao === 1
                        ? "gradient-warm text-secondary-foreground shadow-warm"
                        : g.posicao > 0 && g.posicao <= 3
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {g.posicao > 0 ? `#${g.posicao}` : "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate flex items-center gap-1">
                      {g.nome}
                      {g.sou_lider && (
                        <Crown className="h-3.5 w-3.5 text-secondary" aria-label="Líder" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {g.posicao > 0
                        ? `${g.posicao}º de ${g.totalGrupos} no grupo`
                        : "Sem coletas suas"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-primary">
                      {formatNumber(g.total)}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      itens
                    </div>
                  </div>
                </div>
                {g.top3.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {g.top3.map((t, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-secondary/30 text-secondary-foreground font-medium"
                      >
                        {formatAlimentoNome(t.nome)} · {formatNumber(t.quantidade)}
                      </span>
                    ))}
                  </div>
                )}
                {resumo?.evento && (
                  <Link
                    to="/eventos/$eventoId"
                    params={{ eventoId: String(resumo.evento.id) }}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 self-start"
                  >
                    Ver ranking completo <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
        <Award className="h-8 w-8 mx-auto text-secondary mb-2" />
        <div className="font-semibold">Quer subir no ranking?</div>
        <p className="text-sm text-muted-foreground mb-3">
          Inicie uma nova coleta agora pela câmera.
        </p>
        <Link
          to="/coleta"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-95 transition"
        >
          Iniciar coleta
        </Link>
      </div>
    </div>
  );
}
