// Números do Painel geral. Funções puras.
import { trilha } from './data.js';
import { chaveMastery, resumoArma } from './progresso.js';
import { feita, faltasPlatinum, situacaoDivergence } from './rules.js';

export function estatisticas(dados, estado) {
  const armas = dados.armas;
  const conta = (k) => armas.filter((a) => feita(estado, a.id, k)).length;

  const mastery = {};
  for (const [modo, lista] of Object.entries(dados.mastery || {})) {
    mastery[modo] = lista.map((m) => ({ id: m.id, nome: m.nome, feitas: conta(chaveMastery(modo, m.id)) }));
  }

  const categorias = (dados.categorias || []).map((c) => {
    const daCat = armas.filter((a) => a.categoria === c.id);
    const comGold = daCat.filter((a) => feita(estado, a.id, 'gold')).length;
    const total = Math.max(c.total_fonte ?? 0, daCat.length);
    const semCategoria = total - daCat.length;       // armas da fonte ainda não identificadas
    const faltamGold = daCat.length - comGold;
    const falta = faltamGold + semCategoria;
    return {
      id: c.id, nome: c.nome, total, cadastradas: daCat.length, comGold, semCategoria, faltamGold,
      platinumLiberado: falta === 0 && total > 0,
      texto: falta === 0 && total > 0
        ? `${comGold}/${total} com Gold → Platinum liberado`
        : `${comGold}/${total} com Gold → falta ${falta} para Platinum` +
          (semCategoria ? ` (${semCategoria} sem categoria definida)` : ''),
    };
  });

  return {
    total: armas.length,
    gold: conta('gold'),
    platinum: conta('platinum'),
    harmonic: conta('harmonic-break'),
    trilhasCompletas: armas.filter((a) => trilha(a).every((c) => feita(estado, a.id, c.id))).length,
    semCategoria: armas.filter((a) => !a.categoria).length,
    divergence: situacaoDivergence(dados, estado),
    mastery,
    categorias,
  };
}

/**
 * Armas mais perto de liberar a próxima etapa (Gold → Platinum → Harmonic Break).
 * Só considera armas já começadas. Retorna [{ arma, etapa, texto, distancia }].
 */
export function proximosPassos(dados, estado, limite = 6) {
  const itens = [];
  for (const arma of dados.armas) {
    const r = resumoArma(arma, estado, dados);
    if (r.situacao === 'nao_iniciada' || r.harmonic) continue;
    if (!r.gold) {
      const ate = [...arma.militares, ...arma.especiais, arma.completionist[0]];
      const n = ate.filter((c) => !feita(estado, arma.id, c.id)).length;
      itens.push({ arma, etapa: 'gold', distancia: n, pct: r.pct,
        texto: n === 1 ? 'Falta só o Gold' : `Faltam ${n} camos para o Gold` });
    } else if (!r.platinum) {
      const faltas = faltasPlatinum(dados, estado, arma);
      if (!arma.categoria) {
        itens.push({ arma, etapa: 'platinum', distancia: 99, pct: r.pct, texto: 'Platinum: defina a categoria desta arma' });
        continue;
      }
      const outras = dados.armas.filter((a) => a.categoria === arma.categoria && a.id !== arma.id && !feita(estado, a.id, 'gold')).length;
      const cat = dados.categorias.find((c) => c.id === arma.categoria);
      const semCat = Math.max(0, (cat?.total_fonte ?? 0) - dados.armas.filter((a) => a.categoria === arma.categoria).length);
      const n = outras + semCat;
      itens.push({ arma, etapa: 'platinum', distancia: n, pct: r.pct,
        texto: faltas.length ? `Platinum: ${faltas.join(' · ')}` : 'Platinum liberado' });
    } else {
      itens.push({ arma, etapa: 'harmonic-break', distancia: 0, pct: r.pct, texto: 'Harmonic Break liberado' });
    }
  }
  return itens
    .sort((a, b) => a.distancia - b.distancia || b.pct - a.pct || a.arma.nome.localeCompare(b.arma.nome))
    .slice(0, limite);
}
