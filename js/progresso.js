// Resumo de progresso por arma + filtros e ordenação da lista. Funções puras (testáveis).
import { trilha } from './data.js';

export const SEM_CATEGORIA = '__sem';

export const ROTULO_TIPO = {
  militar: 'Militar', especial: 'Especial', gold: 'Gold', platinum: 'Platinum',
  'harmonic-break': 'Harmonic Break', mastery: 'Mastery',
};

export const chaveMastery = (modo, id) => `mastery-${modo}-${id}`;

export function tipoCamo(arma, camo) {
  if ((arma.militares || []).includes(camo)) return 'militar';
  if ((arma.especiais || []).includes(camo)) return 'especial';
  return camo.id; // gold | platinum | harmonic-break
}

/** Resumo de uma arma: quantas camos da trilha, maior camo obtida, situação. */
export function resumoArma(arma, estado, dados) {
  const p = estado.armas[arma.id];
  const camos = p?.camos || {};
  const t = trilha(arma);
  let feitas = 0;
  let maior = null;
  for (const c of t) {
    if (camos[c.id]?.ok) { feitas++; maior = { tipo: tipoCamo(arma, c), nome: c.nome }; }
  }
  let masteryFeitas = 0;
  let maiorMastery = -1;
  for (const [modo, lista] of Object.entries(dados.mastery || {})) {
    lista.forEach((m, i) => {
      if (camos[chaveMastery(modo, m.id)]?.ok) {
        masteryFeitas++;
        if (i > maiorMastery) { maiorMastery = i; maior = { tipo: 'mastery', nome: m.nome, modo }; }
      }
    });
  }
  const ok = (id) => !!camos[id]?.ok;
  const total = t.length;
  let situacao = 'andamento';
  if (feitas === total) situacao = 'completa';
  else if (feitas === 0 && masteryFeitas === 0 && !(p?.nivel > 0)) situacao = 'nao_iniciada';
  return {
    feitas, total, pct: total ? feitas / total : 0, maior, situacao, masteryFeitas,
    gold: ok('gold'), platinum: ok('platinum'), harmonic: ok('harmonic-break'),
  };
}

export const FILTROS_PADRAO = Object.freeze({
  busca: '', categorias: [], dlc: 'todas', progresso: 'todas', ordem: 'nome',
});

/** "KG-7 Vulcan" → "kg7vulcan" (ignora acento, caixa e pontuação). */
export function normalizarBusca(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function passaProgresso(r, f) {
  switch (f) {
    case 'nao_iniciada': case 'andamento': case 'completa': return r.situacao === f;
    case 'sem-gold': return !r.gold;
    case 'sem-platinum': return !r.platinum;
    case 'sem-harmonic-break': return !r.harmonic;
    default: return true;
  }
}

function passaDlc(arma, f) {
  if (f === 'lancamento') return arma.lancamento === true;
  if (f === 'dlc') return arma.lancamento === false;
  if (f === 'indefinido') return arma.lancamento == null;
  return true;
}

/**
 * Aplica todos os filtros combinados, ordena e fixa favoritas no topo.
 * Retorna [{ arma, resumo, favorita }].
 */
export function listar(dados, estado, filtros) {
  const f = { ...FILTROS_PADRAO, ...filtros };
  const termo = normalizarBusca(f.busca);
  const cats = new Set(f.categorias);
  const favs = new Set(estado.favoritas);
  const ordemCat = new Map((dados.categorias || []).map((c, i) => [c.id, i]));

  const itens = dados.armas
    .filter((a) => !termo || normalizarBusca(a.nome).includes(termo))
    .filter((a) => !cats.size || cats.has(a.categoria ?? SEM_CATEGORIA))
    .filter((a) => passaDlc(a, f.dlc))
    .map((a) => ({ arma: a, resumo: resumoArma(a, estado, dados), favorita: favs.has(a.id) }))
    .filter((x) => passaProgresso(x.resumo, f.progresso));

  const porNome = (a, b) => a.arma.nome.localeCompare(b.arma.nome, 'pt-BR', { sensitivity: 'base', numeric: true });
  const cmp = {
    nome: porNome,
    categoria: (a, b) => (ordemCat.get(a.arma.categoria) ?? 999) - (ordemCat.get(b.arma.categoria) ?? 999) || porNome(a, b),
    progresso: (a, b) => b.resumo.pct - a.resumo.pct || porNome(a, b),
  }[f.ordem] || porNome;

  return itens.sort((a, b) => (b.favorita - a.favorita) || cmp(a, b));
}

/** Quantos filtros estão ativos (para o contador no botão "Filtros"). */
export function filtrosAtivos(filtros) {
  const f = { ...FILTROS_PADRAO, ...filtros };
  return (f.busca ? 1 : 0) + (f.categorias.length ? 1 : 0) + (f.dlc !== 'todas' ? 1 : 0) + (f.progresso !== 'todas' ? 1 : 0);
}
