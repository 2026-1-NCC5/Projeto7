// Utilitário para exportação de relatórios em PDF.
// Usa jsPDF + autotable. Visual minimalista, branding EmpathTech / EmpathTech.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatDuration,
  formatNumber,
  type DashboardGeral,
  type EventoResumo,
  type GrupoRanking,
} from "@/lib/api";
import { formatAlimentoNome } from "@/lib/utils";

const BRAND_PRIMARY: [number, number, number] = [30, 77, 82]; // teal escuro
const BRAND_ACCENT: [number, number, number] = [228, 153, 76];
const TEXT_MUTED: [number, number, number] = [110, 120, 125];

function header(doc: jsPDF, titulo: string, subtitulo?: string) {
  doc.setFillColor(...BRAND_PRIMARY);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("EmpathTech", 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 20);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, 14, 42);
  if (subtitulo) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.text(subtitulo, 14, 49);
  }
  doc.setTextColor(20, 20, 20);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      `Página ${i} de ${pages} · EmpathTech · Lideranças Empáticas`,
      w / 2,
      h - 8,
      { align: "center" },
    );
  }
}

export function exportarDashboardPDF(args: {
  dashboard: DashboardGeral;
  resumo: EventoResumo | null;
  granularity: "day" | "week" | "month";
}) {
  const { dashboard, resumo, granularity } = args;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  header(
    doc,
    "Dashboard administrativo",
    `Granularidade: ${
      granularity === "day" ? "diária" : granularity === "week" ? "semanal" : "mensal"
    }`,
  );

  // Métricas resumidas
  const totalItens = dashboard.timeline.reduce(
    (a, b) => a + Number(b.total_itens || 0),
    0,
  );
  const totalColetas = dashboard.timeline.reduce(
    (a, b) => a + Number(b.total_coletas || 0),
    0,
  );
  const media = totalColetas > 0 ? totalItens / totalColetas : 0;

  autoTable(doc, {
    startY: 56,
    head: [["Métrica", "Valor"]],
    body: [
      ["Total de coletas", formatNumber(totalColetas)],
      ["Total de itens", formatNumber(totalItens)],
      ["Média itens/coleta", media.toFixed(2)],
      [
        "Evento ativo",
        resumo?.evento ? `${resumo.evento.nome} (${resumo.evento.status})` : "Nenhum",
      ],
      [
        "Tempo do evento ativo",
        resumo?.evento ? formatDuration(resumo.duracao_segundos) : "—",
      ],
    ],
    headStyles: { fillColor: BRAND_PRIMARY, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 3 },
  });

  // Timeline
  if (dashboard.timeline.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Período", "Coletas", "Itens"]],
      body: dashboard.timeline.map((t) => [
        new Date(t.periodo).toLocaleDateString("pt-BR"),
        formatNumber(t.total_coletas),
        formatNumber(t.total_itens),
      ]),
      headStyles: { fillColor: BRAND_PRIMARY, textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      didDrawPage: () => header(doc, "Dashboard administrativo"),
    });
  }

  // Comparativo eventos
  if (dashboard.comparativo_eventos.length > 0) {
    const startY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("Comparativo entre eventos", 14, startY);

    autoTable(doc, {
      startY: startY + 4,
      head: [["#", "Evento", "Total de itens"]],
      body: dashboard.comparativo_eventos.map((e, i) => [
        String(i + 1),
        e.nome,
        formatNumber(e.total_itens),
      ]),
      headStyles: { fillColor: BRAND_ACCENT, textColor: 255 },
      styles: { fontSize: 10, cellPadding: 3 },
    });
  }

  footer(doc);
  doc.save(`dashboard-empathtech-${Date.now()}.pdf`);
}

export function exportarRankingEventoPDF(args: {
  eventoNome: string;
  eventoId: number;
  ranking: GrupoRanking[];
}) {
  const { eventoNome, eventoId, ranking } = args;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  header(doc, `Relatório do evento: ${eventoNome}`, `ID #${eventoId}`);

  const totalItens = ranking.reduce((a, b) => a + Number(b.total_itens || 0), 0);

  autoTable(doc, {
    startY: 56,
    head: [["Resumo", "Valor"]],
    body: [
      ["Grupos participantes", String(ranking.length)],
      ["Total de itens coletados", formatNumber(totalItens)],
      ["Líder do evento", ranking[0]?.nome ?? "—"],
    ],
    headStyles: { fillColor: BRAND_PRIMARY, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 3 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Posição", "Grupo", "Itens", "Top 3 alimentos"]],
    body: ranking.map((g, idx) => [
      `#${idx + 1}`,
      g.nome,
      formatNumber(g.total_itens),
      g.top3_itens
        .map((t) => `${formatAlimentoNome(t.nome)} (${formatNumber(t.quantidade)})`)
        .join(", ") || "—",
    ]),
    headStyles: { fillColor: BRAND_PRIMARY, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 50 },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: "auto" },
    },
  });

  footer(doc);
  doc.save(`evento-${eventoId}-${Date.now()}.pdf`);
}
