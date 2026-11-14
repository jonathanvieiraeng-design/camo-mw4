// Dados do jogo: carrega data/mw4.json e aplica por cima as edições feitas no app.
//
// Edições ficam em estado.edicoes, com chaves planas:
//   "arma:<armaId>"               → campos da arma (nome, categoria, categoria_status, lancamento)
//   "camo:<armaId>:<camoId>"      → campos de uma camo da trilha (nome, desafio, meta, status, nivel...)
//   "mastery:<modo>:<masteryId>"  → campos de uma camo Mastery
//   "divergence"                  → campos da Divergence
// Cada edição guarda `base` = valor que o mw4.json tinha quando você editou.
// Se um mw4.json novo mudar esse valor, a SUA edição continua valendo e o app
// lista um "conflito" (dado novo disponível) para você decidir.

export const URL_DADOS = new URL('../data/mw4.json', import.meta.url).href;

export async function carregarDados(url = URL_DADOS) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não consegui ler os dados do jogo (${r.status}).`);
  return r.json();
}

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const copia = (v) => (v === undefined ? undefined : structuredClone(v));

/** As 14 camos da trilha de uma arma, na ordem do jogo. */
export function trilha(arma) {
  return [...(arma.militares || []), ...(arma.especiais || []), ...(arma.completionist || [])];
}

/** Localiza o objeto alvo de uma chave de edição dentro dos dados. */
export function localizar(dados, chave) {
  const [tipo, a, b] = chave.split(':');
  if (tipo === 'arma') return dados.armas.find((x) => x.id === a);
  if (tipo === 'camo') {
    const arma = dados.armas.find((x) => x.id === a);
    return arma && trilha(arma).find((c) => c.id === b);
  }
  if (tipo === 'mastery') return (dados.mastery?.[a] || []).find((m) => m.id === b);
  if (tipo === 'divergence') return dados.divergence;
  return undefined;
}

/**
 * Monta os dados finais = mw4.json + armas novas + edições.
 * Não altera `bruto` nem `estado`. Retorna { dados, conflitos, avisos }.
 */
export function aplicarEdicoes(bruto, estado) {
  const dados = structuredClone(bruto);
  const conflitos = [];
  const avisos = [];
  const idsJson = new Set(bruto.armas.map((a) => a.id));

  for (const nova of estado.armas_novas || []) {
    if (idsJson.has(nova.id)) {
      avisos.push({ tipo: 'arma_nova_ja_existe', armaId: nova.id,
        texto: `A arma "${nova.nome}" que você adicionou agora já vem no arquivo de dados. Usando a versão do arquivo (com suas edições).` });
      continue;
    }
    dados.armas.push({ ...structuredClone(nova), adicionada_pelo_usuario: true });
  }

  for (const [chave, ed] of Object.entries(estado.edicoes || {})) {
    const alvo = localizar(dados, chave);
    if (!alvo) {
      avisos.push({ tipo: 'edicao_orfa', chave, texto: `Edição "${chave}" não encontrou o item correspondente nos dados.` });
      continue;
    }
    const original = localizar(bruto, chave); // undefined para armas novas
    for (const [campo, valor] of Object.entries(ed.campos || {})) {
      if (original && ed.base && campo in ed.base && !igual(original[campo], ed.base[campo]) && !igual(original[campo], valor)) {
        conflitos.push({ chave, campo, seu: copia(valor), novo: copia(original[campo]), antigo: copia(ed.base[campo]) });
      }
      alvo[campo] = copia(valor);
    }
  }
  return { dados, conflitos, avisos };
}

/**
 * Registra uma edição no estado (muta `estado`). `bruto` = mw4.json original.
 * Guarda o valor-base só na primeira vez que o campo é editado.
 */
export function registrarEdicao(estado, bruto, chave, campos) {
  const ed = (estado.edicoes[chave] ||= { campos: {}, base: {}, data: null });
  const original = localizar(bruto, chave);
  for (const [campo, valor] of Object.entries(campos)) {
    if (original && !(campo in ed.base)) ed.base[campo] = copia(original[campo]) ?? null;
    if (original && igual(original[campo], valor)) {
      // voltou ao valor do arquivo: a edição deixa de existir
      delete ed.campos[campo];
      delete ed.base[campo];
    } else {
      ed.campos[campo] = copia(valor);
    }
  }
  ed.data = new Date().toISOString().slice(0, 10);
  if (!Object.keys(ed.campos).length) delete estado.edicoes[chave];
  return estado;
}

/** Conflito: aceitar o dado novo do arquivo (descarta sua edição daquele campo). */
export function aceitarDadoNovo(estado, chave, campo) {
  const ed = estado.edicoes[chave];
  if (!ed) return estado;
  delete ed.campos[campo];
  delete ed.base[campo];
  if (!Object.keys(ed.campos).length) delete estado.edicoes[chave];
  return estado;
}

/** Conflito: manter a sua edição e parar de avisar (até o arquivo mudar de novo). */
export function manterMinhaEdicao(estado, bruto, chave, campo) {
  const ed = estado.edicoes[chave];
  const original = localizar(bruto, chave);
  if (ed && original) ed.base[campo] = copia(original[campo]) ?? null;
  return estado;
}

/** Ids de armas com progresso salvo que não existem mais nos dados (o progresso é mantido). */
export function progressoOrfao(estado, dados) {
  const ids = new Set(dados.armas.map((a) => a.id));
  return Object.keys(estado.armas).filter((id) => !ids.has(id));
}

/** Um item precisa do selo "a validar"? */
export function aValidar(item) {
  return item.status === 'pendente' || item.nome_status === 'pendente' ||
    item.nivel_status === 'pendente' || item.categoria_status === 'pendente';
}

/** Checagem de integridade do arquivo de dados. Retorna lista de problemas (vazia = ok). */
export function validarDados(d) {
  const p = [];
  if (!d || !Array.isArray(d.armas)) return ['Arquivo sem lista "armas".'];
  const cats = new Set((d.categorias || []).map((c) => c.id));
  const ids = new Set();
  for (const a of d.armas) {
    if (!a.id) p.push(`Arma sem id: ${a.nome}`);
    if (ids.has(a.id)) p.push(`Id de arma repetido: ${a.id}`);
    ids.add(a.id);
    if (a.categoria != null && !cats.has(a.categoria)) p.push(`${a.id}: categoria desconhecida "${a.categoria}"`);
    const t = trilha(a);
    const cids = new Set(t.map((c) => c.id));
    if (cids.size !== t.length) p.push(`${a.id}: id de camo repetido`);
    if ((a.militares || []).length !== 8) p.push(`${a.id}: esperava 8 Militares`);
    if ((a.especiais || []).length !== 3) p.push(`${a.id}: esperava 3 Especiais`);
    const comp = (a.completionist || []).map((c) => c.id).join(',');
    if (comp !== 'gold,platinum,harmonic-break') p.push(`${a.id}: completionist deve ser gold, platinum, harmonic-break`);
  }
  for (const [modo, lista] of Object.entries(d.mastery || {})) {
    const m = new Set(lista.map((x) => x.id));
    if (m.size !== lista.length) p.push(`Mastery ${modo}: id repetido`);
  }
  return p;
}

// ---------- editor ----------

export function slug(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'arma';
}

/**
 * Cria uma arma nova com a estrutura padrão (8 Militares + 3 Especiais + Gold/Platinum/Harmonic Break),
 * tudo pendente. O Gold usa o mesmo desafio/meta que a fonte dá para todas as armas.
 */
export function novaArma(dados, nome, categoria = null, lancamento = null) {
  const base = slug(nome);
  let id = base;
  for (let i = 2; dados.armas.some((a) => a.id === id); i++) id = `${base}-${i}`;
  const pend = (id, nome) => ({ id, nome, desafio: '', meta: null, status: 'pendente' });
  return {
    id, nome: nome.trim(), categoria: categoria || null,
    categoria_status: categoria ? 'confirmado' : 'pendente',
    lancamento,
    militares: Array.from({ length: 8 }, (_, i) => ({
      id: `militar-${i + 1}`, nome: `Militar ${i + 1}`, nome_status: 'pendente', nivel: null, nivel_status: 'pendente',
    })),
    especiais: [1, 2, 3].map((i) => ({ ...pend(`especial-${i}`, `Especial ${i}`), nome_status: 'pendente' })),
    completionist: [
      { id: 'gold', nome: 'Gold', desafio: 'Kills em uma única partida', meta: { MP: 15, DMZ: 100, WZ: 8 }, status: 'pendente' },
      pend('platinum', 'Platinum'),
      pend('harmonic-break', 'Harmonic Break'),
    ],
  };
}

/** Texto legível para uma chave de edição: "Han 86 › Especial 1". */
export function descreverChave(dados, chave) {
  const [tipo, a, b] = chave.split(':');
  if (tipo === 'arma') return dados.armas.find((x) => x.id === a)?.nome ?? a;
  if (tipo === 'camo') {
    const arma = dados.armas.find((x) => x.id === a);
    const camo = arma && trilha(arma).find((c) => c.id === b);
    return `${arma?.nome ?? a} › ${camo?.nome ?? b}`;
  }
  if (tipo === 'mastery') return `Mastery ${a} › ${(dados.mastery?.[a] || []).find((m) => m.id === b)?.nome ?? b}`;
  if (tipo === 'divergence') return 'Divergence';
  return chave;
}

/** Remove todas as edições de um item (ou de uma arma inteira, com prefixo "camo:<id>:" etc.). */
export function removerEdicoes(estado, filtro) {
  for (const k of Object.keys(estado.edicoes)) if (filtro(k)) delete estado.edicoes[k];
  return estado;
}
