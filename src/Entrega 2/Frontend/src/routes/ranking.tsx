import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpDown, Trophy, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { EmptyState, SkeletonList } from "@/routes/index";
import {
  api,
  formatNumber,
  type EventoResumo,
  type GrupoRanking,
  type UsuarioRanking,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAlimentoNome } from "@/lib/utils";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — EmpathTech" },
      { name: "description", content: "Ranking de grupos e usuários do evento ativo." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell>
        <RankingPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

type Order = "total_desc" | "total_asc" | "nome";

function RankingPage() {
  const [resumo, setResumo] = useState<EventoResumo | null>(null);
  const [grupos, setGrupos] = useState<GrupoRanking[]>([]);
  const [grupoSel, setGrupoSel] = useState<string>("");
  const [usuarios, setUsuarios] = useState<UsuarioRanking[]>([]);
  const [order, setOrder] = useState<Order>("total_desc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.eventos.atualResumo();
        if (!alive) return;
        setResumo(r);
        if (r.evento) {
          const g = await api.eventos.rankingGrupos(r.evento.id);
          if (!alive) return;
          setGrupos(g.ranking_grupos);
          if (g.ranking_grupos[0]) setGrupoSel(String(g.ranking_grupos[0].id));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!grupoSel || !resumo?.evento) return;
    let alive = true;
    (async () => {
      try {
        const r = await api.grupos.rankingUsuarios(Number(grupoSel), resumo.evento!.id);
        if (alive) setUsuarios(r.ranking_usuarios);
      } catch {
        if (alive) setUsuarios([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [grupoSel, resumo?.evento]);

  const sorted = [...grupos].sort((a, b) => {
    if (order === "total_asc") return a.total_itens - b.total_itens;
    if (order === "nome") return a.nome.localeCompare(b.nome);
    return b.total_itens - a.total_itens;
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-7 w-7 text-secondary" /> Ranking
          </h1>
          <p className="text-sm text-muted-foreground">
            {resumo?.evento ? resumo.evento.nome : "Sem evento ativo"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={order} onValueChange={(v) => setOrder(v as Order)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total_desc">Mais itens</SelectItem>
              <SelectItem value="total_asc">Menos itens</SelectItem>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {loading ? (
        <SkeletonList />
      ) : !resumo?.evento ? (
        <EmptyState title="Sem evento ativo" message="Aguarde a abertura de um evento." />
      ) : sorted.length === 0 ? (
        <EmptyState title="Sem grupos" message="Nenhum grupo coletou ainda." />
      ) : (
        <>
          <section className="grid lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-primary" /> Grupos
              </h2>
              <ol className="space-y-2">
                {sorted.map((g, idx) => (
                  <li key={g.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${idx === 0 ? "gradient-warm text-secondary-foreground" : "bg-accent text-accent-foreground"}`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{g.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        Top: {g.top3_itens.map((t) => formatAlimentoNome(t.nome)).join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="font-bold text-primary">{formatNumber(g.total_itens)}</div>
                  </li>
                ))}
              </ol>
              {resumo.evento && (
                <Link
                  to="/eventos/$eventoId"
                  params={{ eventoId: String(resumo.evento.id) }}
                  className="inline-block mt-3 text-sm font-semibold text-primary hover:underline"
                >
                  Ver detalhe completo →
                </Link>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="text-xl font-bold">Usuários do grupo</h2>
                <Select value={grupoSel} onValueChange={setGrupoSel}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {grupos.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {usuarios.length === 0 ? (
                <EmptyState title="Sem coletas" message="Ninguém coletou neste grupo ainda." />
              ) : (
                <ol className="space-y-2">
                  {usuarios.map((u, idx) => (
                    <li
                      key={u.id}
                      className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm bg-accent text-accent-foreground">
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">
                          {u.nome} {u.sobrenome}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Top: {u.top3_itens.map((t) => formatAlimentoNome(t.nome)).join(" · ") || "—"}
                        </div>
                      </div>
                      <div className="font-bold text-primary">
                        {formatNumber(u.total_itens)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
