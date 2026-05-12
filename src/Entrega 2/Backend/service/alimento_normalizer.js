const ALIMENTO_CATALOG = {
  acucar_1kg: {
    classe_modelo: "acucar_1kg",
    nome_padronizado: "acucar",
    nome_exibicao: "Açúcar 1 kg",
    tipo_alimento: "mantimento",
    unidade_medida: "kg",
    peso_unitario_g: 1000,
    volume_unitario_ml: null,
    valor_unitario_brl: 5.5,
    aliases: ["acucar", "açúcar", "sugar"],
  },
  arroz_1kg: {
    classe_modelo: "arroz_1kg",
    nome_padronizado: "arroz",
    nome_exibicao: "Arroz 1 kg",
    tipo_alimento: "grao",
    unidade_medida: "kg",
    peso_unitario_g: 1000,
    volume_unitario_ml: null,
    valor_unitario_brl: 4.5,
    aliases: ["arroz", "rice"],
  },
  arroz_5kg: {
    classe_modelo: "arroz_5kg",
    nome_padronizado: "arroz",
    nome_exibicao: "Arroz 5 kg",
    tipo_alimento: "grao",
    unidade_medida: "kg",
    peso_unitario_g: 5000,
    volume_unitario_ml: null,
    valor_unitario_brl: 17.5,
    aliases: ["arroz", "rice"],
  },
  cafe_250g: {
    classe_modelo: "cafe_250g",
    nome_padronizado: "cafe",
    nome_exibicao: "Café 250 g",
    tipo_alimento: "cafe",
    unidade_medida: "g",
    peso_unitario_g: 250,
    volume_unitario_ml: null,
    valor_unitario_brl: 15.5,
    aliases: ["cafe", "café", "coffee"],
  },
  cafe_500g: {
    classe_modelo: "cafe_500g",
    nome_padronizado: "cafe",
    nome_exibicao: "Café 500 g",
    tipo_alimento: "cafe",
    unidade_medida: "g",
    peso_unitario_g: 500,
    volume_unitario_ml: null,
    valor_unitario_brl: 31,
    aliases: ["cafe", "café", "coffee"],
  },
  feijao_1kg: {
    classe_modelo: "feijao_1kg",
    nome_padronizado: "feijao",
    nome_exibicao: "Feijão 1 kg",
    tipo_alimento: "grao",
    unidade_medida: "kg",
    peso_unitario_g: 1000,
    volume_unitario_ml: null,
    valor_unitario_brl: 8.5,
    aliases: ["feijao", "feijão", "beans", "bean"],
  },
  feijao_500g: {
    classe_modelo: "feijao_500g",
    nome_padronizado: "feijao",
    nome_exibicao: "Feijão 500 g",
    tipo_alimento: "grao",
    unidade_medida: "g",
    peso_unitario_g: 500,
    volume_unitario_ml: null,
    valor_unitario_brl: 5,
    aliases: ["feijao", "feijão", "beans", "bean"],
  },
  fuba_1kg: {
    classe_modelo: "fuba_1kg",
    nome_padronizado: "fuba",
    nome_exibicao: "Fubá 1 kg",
    tipo_alimento: "grao",
    unidade_medida: "kg",
    peso_unitario_g: 1000,
    volume_unitario_ml: null,
    valor_unitario_brl: 4.5,
    aliases: ["fuba", "fubá"],
  },
  fuba_500g: {
    classe_modelo: "fuba_500g",
    nome_padronizado: "fuba",
    nome_exibicao: "Fubá 500 g",
    tipo_alimento: "grao",
    unidade_medida: "g",
    peso_unitario_g: 500,
    volume_unitario_ml: null,
    valor_unitario_brl: 4.5,
    aliases: ["fuba", "fubá"],
  },
  leite_em_po_1kg: {
    classe_modelo: "leite_em_po_1kg",
    nome_padronizado: "leite_em_po",
    nome_exibicao: "Leite em pó 1 kg",
    tipo_alimento: "laticinio_seco",
    unidade_medida: "kg",
    peso_unitario_g: 1000,
    volume_unitario_ml: null,
    valor_unitario_brl: 42,
    aliases: ["leite_em_po", "leite em po", "milk powder"],
  },
  leite_em_po_400g: {
    classe_modelo: "leite_em_po_400g",
    nome_padronizado: "leite_em_po",
    nome_exibicao: "Leite em pó 400 g",
    tipo_alimento: "laticinio_seco",
    unidade_medida: "g",
    peso_unitario_g: 400,
    volume_unitario_ml: null,
    valor_unitario_brl: 17,
    aliases: ["leite_em_po", "leite em po", "milk powder"],
  },
  macarrao_500g: {
    classe_modelo: "macarrao_500g",
    nome_padronizado: "macarrao",
    nome_exibicao: "Macarrão 500 g",
    tipo_alimento: "massa",
    unidade_medida: "g",
    peso_unitario_g: 500,
    volume_unitario_ml: null,
    valor_unitario_brl: 4,
    aliases: ["macarrao", "macarrão", "pasta", "noodles", "noodle"],
  },
  molho_de_tomate_240g: {
    classe_modelo: "molho_de_tomate_240g",
    nome_padronizado: "molho_de_tomate",
    nome_exibicao: "Molho de tomate 240 g",
    tipo_alimento: "molho",
    unidade_medida: "g",
    peso_unitario_g: 240,
    volume_unitario_ml: null,
    valor_unitario_brl: 2.5,
    aliases: ["molho_de_tomate", "molho de tomate", "tomato sauce"],
  },
  oleo_900ml: {
    classe_modelo: "oleo_900ml",
    nome_padronizado: "oleo",
    nome_exibicao: "Óleo 900 ml",
    tipo_alimento: "oleo",
    unidade_medida: "ml",
    peso_unitario_g: null,
    volume_unitario_ml: 900,
    valor_unitario_brl: 7.5,
    aliases: ["oleo", "óleo", "oil"],
  },
  peixe_enlatado_120g: {
    classe_modelo: "peixe_enlatado_120g",
    nome_padronizado: "peixe_enlatado",
    nome_exibicao: "Peixe enlatado 120 g",
    tipo_alimento: "enlatado",
    unidade_medida: "g",
    peso_unitario_g: 120,
    volume_unitario_ml: null,
    valor_unitario_brl: 7,
    aliases: ["peixe_enlatado", "peixe enlatado", "canned fish"],
  },
};

const ALIMENTO_ALIASES = Object.fromEntries(
  Object.values(ALIMENTO_CATALOG).map((item) => [item.nome_padronizado, item.aliases]),
);

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getCatalogEntry(rawName) {
  const normalizedRaw = normalizeToken(rawName);
  if (!normalizedRaw) return null;

  if (ALIMENTO_CATALOG[normalizedRaw]) {
    return ALIMENTO_CATALOG[normalizedRaw];
  }

  for (const item of Object.values(ALIMENTO_CATALOG)) {
    if (normalizeToken(item.classe_modelo) === normalizedRaw) {
      return item;
    }
    if (normalizeToken(item.nome_padronizado) === normalizedRaw) {
      return item;
    }
    if (item.aliases.some((alias) => normalizeToken(alias) === normalizedRaw)) {
      return item;
    }
  }

  const baseName = normalizedRaw.replace(/_(\d+(?:g|kg|ml))$/i, "");
  const aliasMatch = Object.values(ALIMENTO_CATALOG).find((item) => {
    if (normalizeToken(item.nome_padronizado) === baseName) return true;
    return item.aliases.some((alias) => normalizeToken(alias) === baseName);
  });
  return aliasMatch || null;
}

function normalizeAlimentoName(rawName) {
  const entry = getCatalogEntry(rawName);
  if (entry) return entry.nome_padronizado;

  const normalizedRaw = normalizeToken(rawName);
  if (!normalizedRaw) return "";
  return normalizedRaw.replace(/_(\d+(?:g|kg|ml))$/i, "");
}

function getAlimentoDisplayName(rawName) {
  const entry = getCatalogEntry(rawName);
  return entry ? entry.nome_exibicao : normalizeToken(rawName);
}

function getAlimentoTipo(rawName) {
  const entry = getCatalogEntry(rawName);
  return entry ? entry.tipo_alimento : "desconhecido";
}

function getAlimentoUnitario(rawName) {
  const entry = getCatalogEntry(rawName);
  if (!entry) return null;
  return {
    peso_unitario_g: entry.peso_unitario_g,
    volume_unitario_ml: entry.volume_unitario_ml,
    valor_unitario_brl: entry.valor_unitario_brl,
    unidade_medida: entry.unidade_medida,
  };
}

function enrichDetection(detection) {
  const rawClass = detection?.class ?? detection?.classe_modelo ?? detection?.nome_padronizado ?? "";
  const entry = getCatalogEntry(rawClass);
  const normalizedClass = entry?.classe_modelo || normalizeToken(rawClass);
  const normalizedName = entry?.nome_padronizado || normalizeAlimentoName(rawClass);
  return {
    ...detection,
    class: String(detection?.class ?? normalizedClass),
    classe_modelo: normalizedClass,
    nome_padronizado: normalizedName,
    nome_exibicao: entry?.nome_exibicao ?? String(detection?.nome_exibicao ?? normalizedName),
    tipo_alimento: entry?.tipo_alimento ?? String(detection?.tipo_alimento ?? "desconhecido"),
    valor_unitario_brl: detection?.valor_unitario_brl ?? entry?.valor_unitario_brl ?? null,
    peso_unitario_g: detection?.peso_unitario_g ?? entry?.peso_unitario_g ?? null,
    volume_unitario_ml: detection?.volume_unitario_ml ?? entry?.volume_unitario_ml ?? null,
    aliases: entry?.aliases ?? [],
  };
}

module.exports = {
  ALIMENTO_CATALOG,
  ALIMENTO_ALIASES,
  normalizeToken,
  normalizeAlimentoName,
  getCatalogEntry,
  getAlimentoDisplayName,
  getAlimentoTipo,
  getAlimentoUnitario,
  enrichDetection,
};
