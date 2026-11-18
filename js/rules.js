// Regras de progressão (seção 4). Funções puras: recebem dados + estado e mutam só o estado passado.
//
// Como as travas funcionam:
//  • Pré-requisitos DENTRO da mesma arma (ex.: Gold precisa das 8 Militares + 3 Especiais) não travam,
//    porque marcar uma camo marca automaticamente as anteriores (cascata).
//  • Travam só os pré-requisitos EXTERNOS, que dependem de outras armas:
//      Platinum        → Gold em todas as armas da mesma categoria (regras.platinum_requer)
//      Harmonic Break  → as mesmas faltas do Platinum (regras.harmonic_requer = "platinum")
//      Mastery do modo → Harmonic Break em N armas (regras.mastery_hb_minimo[modo])
//  • Modo livre (estado.config.modo_livre) desliga todas as travas. A cascata continua.

import { trilha } from './data.js';
import { chaveMastery } from './progresso.js';

export const hoje = () => new Date().toISOString().slice(0, 10);

const progArma = (estado, armaId) => (estado.armas[armaId] ||= { nivel: null, camos: {} });
export const feita = (estado, armaId, chave) => !!estado.armas[armaId]?.camos[chave]?.ok;

/** Todas as chaves de camo de uma arma, na ordem: trilha (14) e depois Mastery por modo. */
export function ordemChaves(dados, arma) {
  const t = trilha(arma).map((c) => c.id);
  const m = {};
  for (const [modo, lista] of Object.entries(dados.mastery || {})) m[modo] = lista.map((x) => chaveMastery(modo, x.id));
  return { trilha: t, mastery: m };
}

/** Chaves que devem ser marcadas junto com `chave` (as anteriores da mesma arma). */
export function anteriores(dados, arma, chave) {
  const { trilha: t, mastery } = ordemChaves(dados, arma);
  const i = t.indexOf(chave);
  if (i >= 0) return t.slice(0, i);
  for (const lista of Object.values(mastery)) {
    const j = lista.indexOf(chave);
    if (j >= 0) return [...t, ...(dados.regras?.mastery_sequencial === false ? [] : lista.slice(0, j))];
  }
  return [];
}

/** Quantas armas têm Harmonic Break (opcionalmente ignorando uma). */
export function contarHB(dados, estado, excetoId = null) {
  return dados.armas.filter((a) => a.id !== excetoId && feita(estado, a.id, 'harmonic-break')).length;
}

/** O que falta, fora desta arma, para liberar o Platinum dela. */
export function faltasPlatinum(dados, estado, arma) {
  if (dados.regras?.platinum_requer !== 'gold_em_toda_categoria') return [];
  if (!arma.categoria) return ['Defina a categoria desta arma para calcular o Platinum.'];
  const cat = (dados.categorias || []).find((c) => c.id === arma.categoria);
  const outras = dados.armas.filter((a) => a.categoria === arma.categoria && a.id !== arma.id);
  const semGold = outras.filter((a) => !feita(estado, a.id, 'gold')).map((a) => a.nome);
  const m = [];
  if (semGold.length) m.push(`Faltam Gold em: ${semGold.join(', ')}`);
  const naoCadastradas = (cat?.total_fonte ?? 0) - (outras.length + 1);
  if (naoCadastradas > 0) {
    m.push(`${naoCadastradas > 1 ? "Faltam" : "Falta"} ${naoCadastradas} arma${naoCadastradas > 1 ? 's' : ''} ${cat.nome} sem categoria definida`);
  }
  return m;
}

/** Quantas armas têm Platinum (opcionalmente ignorando uma). */
export function contarPlatinum(dados, estado, excetoId = null) {
  return dados.armas.filter((a) => a.id !== excetoId && feita(estado, a.id, 'platinum')).length;
}

function faltasHarmonic(dados, estado, arma) {
  const m = dados.regras?.harmonic_requer === 'platinum' ? faltasPlatinum(dados, estado, arma) : [];
  const min = dados.regras?.harmonic_platinum_minimo;
  if (min != null) {
    // esta arma ganha o Platinum pela cascata, então conta como 1
    const total = contarPlatinum(dados, estado, arma.id) + 1;
    if (total < min) m.push(`Faltam Platinum em ${min - total} outras armas (hoje: ${contarPlatinum(dados, estado)}/${min})`);
  }
  return m;
}

/**
 * Situação de uma camo: { feita, bloqueada, motivos[], regraPendente }.
 * `chave` = id da camo da trilha ou chaveMastery(modo, id).
 */
export function situacao(dados, estado, arma, chave) {
  const r = { feita: feita(estado, arma.id, chave), bloqueada: false, motivos: [], regraPendente: null };
  let motivos = [];
  if (chave === 'platinum') motivos = faltasPlatinum(dados, estado, arma);
  else if (chave === 'harmonic-break') motivos = faltasHarmonic(dados, estado, arma);
  else if (chave.startsWith('mastery-')) {
    const modo = chave.split('-')[1];
    motivos = [...faltasHarmonic(dados, estado, arma)];
    const min = dados.regras?.mastery_hb_minimo?.[modo];
    if (min == null) {
      r.regraPendente = 'Pré-requisito desta Mastery ainda a validar.';
    } else {
      // esta arma ganha o Harmonic Break pela cascata, então conta como 1
      const total = contarHB(dados, estado, arma.id) + 1;
      if (total < min) {
        motivos.push(`Faltam Harmonic Break em ${min - total} outras armas (hoje: ${contarHB(dados, estado)}/${min})`);
      }
    }
    if (dados.regras?.mastery_hb_minimo_status?.[modo] === 'pendente' && !r.regraPendente) {
      r.regraPendente = 'Pré-requisito desta Mastery ainda a validar.';
    }
  }
  r.motivos = motivos;
  r.bloqueada = !r.feita && motivos.length > 0 && !estado.config?.modo_livre;
  return r;
}

/**
 * Marca uma camo e as anteriores da mesma arma.
 * Retorna { ok, motivos, marcadas[] } — se bloqueada, nada muda.
 */
export function marcar(dados, estado, arma, chave, data = hoje()) {
  const s = situacao(dados, estado, arma, chave);
  if (s.bloqueada) return { ok: false, motivos: s.motivos, marcadas: [] };
  const p = progArma(estado, arma.id);
  const marcadas = [];
  for (const k of [...anteriores(dados, arma, chave), chave]) {
    const c = p.camos[k];
    if (c?.ok) continue;
    p.camos[k] = { ok: true, contador: c?.contador ?? null, modo: c?.modo ?? null, data };
    marcadas.push(k);
  }
  return { ok: true, motivos: [], marcadas };
}

/** Desmarca só esta camo (as outras ficam como estão). Mantém contador e modo. */
export function desmarcar(estado, arma, chave) {
  const c = estado.armas[arma.id]?.camos[chave];
  if (c) { c.ok = false; c.data = null; }
}

/** Define o nível da arma e marca as Militares já liberadas por ele. Nunca desmarca. */
export function definirNivel(estado, arma, nivel, data = hoje()) {
  const p = progArma(estado, arma.id);
  const n = Number.isFinite(nivel) && nivel > 0 ? Math.floor(nivel) : null;
  p.nivel = n;
  const marcadas = [];
  if (n == null) return marcadas;
  for (const m of arma.militares || []) {
    if (m.nivel != null && m.nivel <= n && !p.camos[m.id]?.ok) {
      p.camos[m.id] = { ok: true, contador: p.camos[m.id]?.contador ?? null, modo: p.camos[m.id]?.modo ?? null, data };
      marcadas.push(m.id);
    }
  }
  return marcadas;
}

/** Próxima Militar ainda não obtida que tem nível conhecido. */
export function proximaMilitar(estado, arma) {
  return (arma.militares || []).find((m) => m.nivel != null && !feita(estado, arma.id, m.id)) || null;
}

/** Contador parcial: soma `delta` (mínimo 0). `null` some com o contador. */
export function ajustarContador(estado, arma, chave, delta) {
  const p = progArma(estado, arma.id);
  const c = (p.camos[chave] ||= { ok: false, contador: null, modo: null, data: null });
  c.contador = delta === null ? null : Math.max(0, (c.contador || 0) + delta);
  return c.contador;
}

/** Modo em que você está fazendo/fez a camo (só registro; define a meta exibida no contador). */
export function definirModo(estado, arma, chave, modo) {
  const p = progArma(estado, arma.id);
  const c = (p.camos[chave] ||= { ok: false, contador: null, modo: null, data: null });
  c.modo = c.modo === modo ? null : modo;
  return c.modo;
}

/** Divergence (da conta): liberada com Harmonic Break em N armas. */
export function situacaoDivergence(dados, estado) {
  const min = dados.regras?.divergence_hb_minimo;
  const total = contarHB(dados, estado);
  const motivos = min != null && total < min ? [`Harmonic Break em ${total}/${min} armas`] : [];
  return {
    feita: !!estado.conta?.divergence?.ok,
    bloqueada: motivos.length > 0 && !estado.config?.modo_livre && !estado.conta?.divergence?.ok,
    motivos, total, min,
  };
}

/** Marca/desmarca a Divergence (da conta). Retorna { ok, motivos }. */
export function alternarDivergence(dados, estado, data = hoje()) {
  const s = situacaoDivergence(dados, estado);
  if (s.feita) { estado.conta.divergence = { ok: false, data: null }; return { ok: true, motivos: [] }; }
  if (s.bloqueada) return { ok: false, motivos: s.motivos };
  estado.conta.divergence = { ok: true, data };
  return { ok: true, motivos: [] };
}
