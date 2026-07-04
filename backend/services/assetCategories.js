// ==========================================================================
//  Catalogo de categorias de ativos disponiveis no Brasil.
//  `quote` define como obter cotacao automatica:
//    b3     -> Yahoo Finance com sufixo .SA (acoes, FIIs, ETFs, BDRs)
//    us     -> Yahoo Finance direto (acoes internacionais, REITs, ETFs EUA)
//    fx     -> AwesomeAPI moeda-BRL (USD, EUR, GBP...)
//    gold   -> AwesomeAPI XAU-BRL (onca troy)
//    manual -> sem cotacao; usuario atualiza o valor atual
// ==========================================================================

export const ASSET_CATEGORIES = {
  // ---- Bolsa Brasil (B3) ----
  acao_br:     { label: 'Acoes Brasil (B3)',        group: 'Bolsa Brasil',   quote: 'b3' },
  fii:         { label: 'Fundos Imobiliarios (FII)', group: 'Bolsa Brasil',  quote: 'b3' },
  etf_br:      { label: 'ETFs Brasil',              group: 'Bolsa Brasil',   quote: 'b3' },
  bdr:         { label: 'BDRs',                     group: 'Bolsa Brasil',   quote: 'b3' },

  // ---- Internacional ----
  acao_us:     { label: 'Acoes Internacionais',     group: 'Internacional',  quote: 'us' },
  reit:        { label: 'REITs',                    group: 'Internacional',  quote: 'us' },
  etf_us:      { label: 'ETFs Internacionais',      group: 'Internacional',  quote: 'us' },

  // ---- Moedas e metais ----
  moeda:       { label: 'Moeda Estrangeira',        group: 'Moedas e Metais', quote: 'fx' },
  ouro:        { label: 'Ouro (onca troy)',         group: 'Moedas e Metais', quote: 'gold' },

  // ---- Fundos e estruturados ----
  fundo:       { label: 'Fundo de Investimento',    group: 'Fundos',         quote: 'manual' },
  previdencia: { label: 'Previdencia (PGBL/VGBL)',  group: 'Fundos',         quote: 'manual' },
  coe:         { label: 'COE',                      group: 'Fundos',         quote: 'manual' },

  // ---- Ativos fisicos ----
  imovel:      { label: 'Imovel',                   group: 'Fisicos',        quote: 'manual' },
  terreno:     { label: 'Terreno',                  group: 'Fisicos',        quote: 'manual' },
  veiculo:     { label: 'Veiculo',                  group: 'Fisicos',        quote: 'manual' },
  gado:        { label: 'Gado / Agro',              group: 'Fisicos',        quote: 'manual' },
  arte:        { label: 'Arte / Colecionaveis',     group: 'Fisicos',        quote: 'manual' },
  joias:       { label: 'Joias / Metais Fisicos',   group: 'Fisicos',        quote: 'manual' },
  negocio:     { label: 'Participacao em Negocio',  group: 'Fisicos',        quote: 'manual' },
  consorcio:   { label: 'Consorcio',                group: 'Fisicos',        quote: 'manual' },
  outro:       { label: 'Outro',                    group: 'Fisicos',        quote: 'manual' },
};

export function categoryInfo(category) {
  return ASSET_CATEGORIES[category] || ASSET_CATEGORIES.outro;
}

/** Grupos usados na distribuicao do dashboard. */
export const ALLOCATION_GROUPS = [
  { key: 'bolsa_br', label: 'Bolsa Brasil', groups: ['Bolsa Brasil'] },
  { key: 'internacional', label: 'Internacional', groups: ['Internacional'] },
  { key: 'moedas', label: 'Moedas e Metais', groups: ['Moedas e Metais'] },
  { key: 'fundos', label: 'Fundos', groups: ['Fundos'] },
  { key: 'fisicos', label: 'Fisicos', groups: ['Fisicos'] },
];
