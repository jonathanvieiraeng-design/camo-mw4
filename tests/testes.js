import { carregarDados, aplicarEdicoes, registrarEdicao, aceitarDadoNovo, manterMinhaEdicao,
  progressoOrfao, validarDados, trilha, aValidar, novaArma, descreverChave, removerEdicoes } from '../js/data.js';
import { criarStore, estadoVazio, montarBackup, lerBackup, semProgresso } from '../js/store.js';
import { listar, resumoArma, chaveMastery, SEM_CATEGORIA } from '../js/progresso.js';
import { marcar, desmarcar, situacao, definirNivel, proximaMilitar, ajustarContador, definirModo,
  situacaoDivergence, alternarDivergence } from '../js/rules.js';
import { estatisticas, proximosPassos } from '../js/stats.js';

const resultados = [];
async function teste(nome, fn) {
  try { await fn(); resultados.push({ nome, ok: true }); }
  catch (e) { resultados.push({ nome, ok: false, erro: e.message }); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'falhou'); }
function igual(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`${msg || 'diferente'}: ${ja} ≠ ${jb}`);
}

const bruto = await carregarDados();

// ---------------- dados ----------------
await teste('Arquivo de dados íntegro (validarDados)', () => igual(validarDados(bruto), []));
await teste('35 armas cadastradas', () => igual(bruto.armas.length, 35));
await teste('Soma dos totais por categoria = 35', () =>
  igual(bruto.categorias.reduce((s, c) => s + c.total_fonte, 0), 35));
await teste('Cada arma tem 14 camos na trilha', () =>
  ok(bruto.armas.every((a) => trilha(a).length === 14)));
await teste('6 armas com categoria confirmada, 29 com categoria null/pendente', () => {
  igual(bruto.armas.filter((a) => a.categoria_status === 'confirmado').map((a) => a.nome),
    ['KG-7 Vulcan', 'Rezi 12', 'ISO Nightshade', 'FiNN LMG', 'MAR-9', 'SANG 9mm']);
  ok(bruto.armas.filter((a) => a.categoria === null && a.categoria_status === 'pendente').length === 29);
});
await teste('lancamento = null em todas (2 DLC ainda não identificadas)', () =>
  ok(bruto.armas.every((a) => a.lancamento === null)));
await teste('Armas pendentes não têm desafio inventado', () => {
  for (const a of bruto.armas.filter((x) => x.categoria === null)) {
    for (const c of [...a.especiais, a.completionist[1], a.completionist[2]]) {
      ok(c.desafio === '' && c.meta === null && c.status === 'pendente', `${a.id}/${c.id}`);
    }
    ok(a.militares.every((m) => m.nivel === null && m.nivel_status === 'pendente'), `${a.id} níveis`);
  }
});
await teste('Gold 15/100/8 em todas; pendente nas 29', () => {
  for (const a of bruto.armas) {
    igual(a.completionist[0].meta, { MP: 15, DMZ: 100, WZ: 8 }, a.id);
    ok((a.categoria === null) === (a.completionist[0].status === 'pendente'), a.id);
  }
});
await teste('Níveis Militares da KG-7 conferem com o documento', () =>
  igual(bruto.armas[0].militares.map((m) => m.nivel), [13, 22, 31, 38, 47, 54, 61, 69]));
await teste('Mastery: 3 MP + 3 WZ confirmadas, 3 DMZ pendentes', () => {
  ok(bruto.mastery.MP.every((m) => m.status === 'confirmado') && bruto.mastery.MP.length === 3);
  ok(bruto.mastery.WZ.every((m) => m.status === 'confirmado') && bruto.mastery.WZ.length === 3);
  ok(bruto.mastery.DMZ.every((m) => m.status === 'pendente' && m.desafio === '') && bruto.mastery.DMZ.length === 3);
});
await teste('Selo "a validar": Platinum da FiNN e Snakeskin da SANG', () => {
  const finn = bruto.armas.find((a) => a.id === 'finn-lmg');
  const sang = bruto.armas.find((a) => a.id === 'sang-9mm');
  ok(aValidar(finn.completionist[1]) && finn.completionist[1].desafio_modo.WZ === '');
  ok(aValidar(sang.especiais[1]) && sang.especiais[1].desafio_modo.WZ === '');
  ok(!aValidar(bruto.armas[0].especiais[0]), 'Treeline não deveria estar a validar');
});

// ---------------- edições ----------------
await teste('Editar categoria aplica nos dados sem alterar o arquivo original', () => {
  const e = estadoVazio();
  registrarEdicao(e, bruto, 'arma:han-86', { categoria: 'SMG', categoria_status: 'confirmado' });
  const { dados, conflitos } = aplicarEdicoes(bruto, e);
  igual(dados.armas.find((a) => a.id === 'han-86').categoria, 'SMG');
  igual(bruto.armas.find((a) => a.id === 'han-86').categoria, null, 'original mudou');
  igual(conflitos, []);
});
await teste('Renomear camo não perde progresso (ligado por id)', () => {
  const e = estadoVazio();
  e.armas['kg-7-vulcan'] = { nivel: 31, camos: { 'militar-1': { ok: true } } };
  registrarEdicao(e, bruto, 'camo:kg-7-vulcan:militar-1', { nome: 'Woodland', nome_status: 'confirmado' });
  const { dados } = aplicarEdicoes(bruto, e);
  igual(dados.armas[0].militares[0].nome, 'Woodland');
  ok(e.armas['kg-7-vulcan'].camos['militar-1'].ok);
});
await teste('Voltar ao valor do arquivo remove a edição', () => {
  const e = estadoVazio();
  registrarEdicao(e, bruto, 'arma:pila', { categoria: 'AR' });
  registrarEdicao(e, bruto, 'arma:pila', { categoria: null });
  igual(e.edicoes, {});
});
await teste('JSON novo muda campo editado → sua edição vale + conflito listado', () => {
  const e = estadoVazio();
  registrarEdicao(e, bruto, 'arma:han-86', { categoria: 'SMG' });
  const novo = structuredClone(bruto);
  novo.armas.find((a) => a.id === 'han-86').categoria = 'AR';
  const r = aplicarEdicoes(novo, e);
  igual(r.dados.armas.find((a) => a.id === 'han-86').categoria, 'SMG');
  igual(r.conflitos, [{ chave: 'arma:han-86', campo: 'categoria', seu: 'SMG', novo: 'AR', antigo: null }]);
  manterMinhaEdicao(e, novo, 'arma:han-86', 'categoria');
  igual(aplicarEdicoes(novo, e).conflitos, [], 'manter deveria silenciar');
  aceitarDadoNovo(e, 'arma:han-86', 'categoria');
  igual(aplicarEdicoes(novo, e).dados.armas.find((a) => a.id === 'han-86').categoria, 'AR');
});
await teste('JSON novo que confirma o mesmo valor da sua edição não gera conflito', () => {
  const e = estadoVazio();
  registrarEdicao(e, bruto, 'arma:han-86', { categoria: 'SMG' });
  const novo = structuredClone(bruto);
  novo.armas.find((a) => a.id === 'han-86').categoria = 'SMG';
  igual(aplicarEdicoes(novo, e).conflitos, []);
});
await teste('Arma adicionada pelo app aparece; se o JSON passar a ter, usa a do JSON', () => {
  const e = estadoVazio();
  const nova = structuredClone(bruto.armas[10]);
  nova.id = 'arma-teste'; nova.nome = 'Arma Teste';
  e.armas_novas.push(nova);
  igual(aplicarEdicoes(bruto, e).dados.armas.length, 36);
  const novo = structuredClone(bruto); novo.armas.push(structuredClone(nova));
  const r = aplicarEdicoes(novo, e);
  igual(r.dados.armas.length, 36);
  igual(r.avisos[0].tipo, 'arma_nova_ja_existe');
});
await teste('Arma removida do JSON: progresso é mantido e sinalizado', () => {
  const e = estadoVazio();
  e.armas['pila'] = { nivel: 10, camos: {} };
  const novo = structuredClone(bruto); novo.armas = novo.armas.filter((a) => a.id !== 'pila');
  igual(progressoOrfao(e, novo), ['pila']);
  ok(e.armas.pila, 'progresso sumiu');
});

// ---------------- persistência ----------------
const NOME_TESTE = 'camo-tracker-mw4-TESTE';
await teste('Salvar e carregar (roundtrip)', async () => {
  const s = await criarStore(NOME_TESTE);
  const e = estadoVazio();
  e.armas['rezi-12'] = { nivel: 26, camos: { 'struck-oil': { ok: true, contador: null, modo: 'MP', data: '2026-11-14' } } };
  e.favoritas = ['rezi-12'];
  await s.salvar(e);
  igual(await s.carregar(), e);
  await s.zerar(); await s.fechar();
});
await teste('Critério 6: export → apagar → import restaura 100%', async () => {
  const s = await criarStore(NOME_TESTE);
  const e = estadoVazio();
  e.armas['mar-9'] = { nivel: 45, camos: { mangrove: { ok: true, contador: null, modo: 'DMZ', data: '2026-11-14' },
    'fungal-grid': { ok: false, contador: 40, modo: null, data: null } } };
  e.conta.divergence = { ok: false };
  e.config.modo_livre = true;
  registrarEdicao(e, bruto, 'arma:oden', { categoria: 'AR' });
  await s.salvar(e);
  const texto = JSON.stringify(montarBackup(await s.carregar(), bruto.versao_dados));
  await s.zerar();
  igual(await s.carregar(), estadoVazio(), 'zerar não apagou');
  await s.salvar(lerBackup(texto));
  igual(await s.carregar(), e);
  await s.zerar(); await s.fechar();
});
await teste('Gravações rápidas seguidas ficam na ordem certa', async () => {
  const s = await criarStore(NOME_TESTE);
  for (let i = 1; i <= 20; i++) { const e = estadoVazio(); e.armas.x = { nivel: i, camos: {} }; s.salvar(e); }
  await s.salvar((() => { const e = estadoVazio(); e.armas.x = { nivel: 99, camos: {} }; return e; })());
  igual((await s.carregar()).armas.x.nivel, 99);
  await s.zerar(); await s.fechar();
});
await teste('Backup inválido é recusado com mensagem clara', () => {
  for (const [entrada, trecho] of [['{oops', 'JSON válido'], ['{"app":"outro"}', 'não é um backup'],
    [JSON.stringify({ app: 'camo-tracker-mw4', tipo: 'backup', estado: { schema_progresso: 99 } }), 'versão mais nova']]) {
    let msg = '';
    try { lerBackup(entrada); } catch (err) { msg = err.message; }
    ok(msg.includes(trecho), `esperava "${trecho}", veio "${msg}"`);
  }
});
await teste('Progresso corrompido é normalizado sem quebrar', () => {
  const e = lerBackup({ app: 'camo-tracker-mw4', tipo: 'backup', estado: { armas: { a: null, b: { nivel: 3 } }, favoritas: 'x' } });
  igual(e.armas.a, { nivel: null, camos: {} });
  igual(e.armas.b, { nivel: 3, camos: {} });
  igual(e.favoritas, []);
});

// ---------------- lista: resumo, filtros, ordenação ----------------
{
  const marcar = (e, armaId, n) => {
    const a = bruto.armas.find((x) => x.id === armaId);
    e.armas[armaId] = { nivel: null, camos: Object.fromEntries(trilha(a).slice(0, n).map((c) => [c.id, { ok: true }])) };
  };
  const ex = estadoVazio();
  marcar(ex, 'kg-7-vulcan', 14);  // completa
  marcar(ex, 'rezi-12', 12);      // tem Gold, falta Platinum
  marcar(ex, 'iso-nightshade', 3);
  ex.favoritas = ['sang-9mm'];
  const nomes = (f) => listar(bruto, ex, f).map((x) => x.arma.id);

  await teste('Resumo: 14/14 = completa, maior camo = Harmonic Break', () => {
    const r = resumoArma(bruto.armas[0], ex, bruto);
    igual([r.feitas, r.total, r.situacao, r.maior.tipo], [14, 14, 'completa', 'harmonic-break']);
  });
  await teste('Resumo: nível > 0 sem camos conta como "em andamento"', () => {
    const e = estadoVazio(); e.armas.pila = { nivel: 5, camos: {} };
    igual(resumoArma(bruto.armas.find((a) => a.id === 'pila'), e, bruto).situacao, 'andamento');
  });
  await teste('Resumo: Mastery conta como maior camo', () => {
    const e = structuredClone(ex);
    e.armas['kg-7-vulcan'].camos[chaveMastery('WZ', 'parallax')] = { ok: true };
    igual(resumoArma(bruto.armas[0], e, bruto).maior, { tipo: 'mastery', nome: 'Parallax', modo: 'WZ' });
  });
  await teste('Busca ignora caixa, acento e pontuação ("kg7" acha KG-7)', () => {
    igual(nomes({ busca: 'kg7' }), ['kg-7-vulcan']);
    igual(nomes({ busca: '  .50 ' }).includes('50-gs'), true);
  });
  await teste('Filtro por tipo (vários chips) + "Sem categoria"', () => {
    igual(nomes({ categorias: ['Sniper', 'Shotgun'] }).sort(), ['kg-7-vulcan', 'rezi-12']);
    igual(nomes({ categorias: [SEM_CATEGORIA] }).length, 29);
  });
  await teste('Filtro DLC: null fica em "A definir"', () => {
    igual(nomes({ dlc: 'lancamento' }), []);
    igual(nomes({ dlc: 'indefinido' }).length, 35);
    const d = structuredClone(bruto); d.armas[1].lancamento = false; d.armas[0].lancamento = true;
    igual(listar(d, ex, { dlc: 'dlc' }).map((x) => x.arma.id), ['rezi-12']);
  });
  await teste('Filtro de progresso', () => {
    igual(nomes({ progresso: 'completa' }), ['kg-7-vulcan']);
    igual(nomes({ progresso: 'andamento' }).sort(), ['iso-nightshade', 'rezi-12']);
    igual(nomes({ progresso: 'nao_iniciada' }).length, 32);
    igual(nomes({ progresso: 'sem-platinum', categorias: ['Shotgun', 'Sniper'] }), ['rezi-12']);
    igual(nomes({ progresso: 'sem-gold' }).length, 33);
  });
  await teste('Filtros combinados (busca + tipo + progresso)', () => {
    igual(nomes({ busca: 'iso', categorias: ['SMG'], progresso: 'andamento' }), ['iso-nightshade']);
    igual(nomes({ busca: 'iso', categorias: ['SMG'], progresso: 'completa' }), []);
  });
  await teste('Ordenação + favoritas no topo', () => {
    const porProg = nomes({ ordem: 'progresso' });
    igual(porProg.slice(0, 4), ['sang-9mm', 'kg-7-vulcan', 'rezi-12', 'iso-nightshade']);
    const porNome = nomes({ ordem: 'nome' });
    igual(porNome[0], 'sang-9mm');
    igual(porNome[1], '50-gs');
    const porCat = nomes({ ordem: 'categoria' });
    igual(porCat.slice(0, 2), ['sang-9mm', 'iso-nightshade']); // fav, depois SMG (AR não tem confirmada)
    igual(porCat.at(-1) !== undefined && bruto.armas.find((a) => a.id === porCat.at(-1)).categoria, null);
  });
}

// ---------------- regras de progressão (critérios 3 e 4) ----------------
{
  const arma = (id) => bruto.armas.find((a) => a.id === id);
  const kg7 = arma('kg-7-vulcan');
  const ok_ = (e, id, k) => !!e.armas[id]?.camos[k]?.ok;
  const marcarTrilha = (e, id, ate) => marcar(bruto, e, arma(id), ate, 'x');
  // dados com categorias completas p/ testar Platinum de verdade
  const comCats = structuredClone(bruto);
  comCats.armas.find((a) => a.id === 'pila').categoria = 'Sniper';
  comCats.armas.find((a) => a.id === 'oden').categoria = 'Sniper';
  const A = (id) => comCats.armas.find((a) => a.id === id);

  await teste('Marcar Especial 2 marca as 8 Militares + Especial 1 (cascata)', () => {
    const e = estadoVazio();
    const r = marcarTrilha(e, 'kg-7-vulcan', 'spidersilk');
    igual(r.marcadas.length, 10);
    ok(ok_(e, 'kg-7-vulcan', 'militar-8') && ok_(e, 'kg-7-vulcan', 'treeline') && !ok_(e, 'kg-7-vulcan', 'tension'));
  });
  await teste('Marcar Gold não depende de nada externo e marca as 11 anteriores', () => {
    const e = estadoVazio();
    igual(marcarTrilha(e, 'rezi-12', 'gold').marcadas.length, 12);
  });
  await teste('Desmarcar mexe só naquela camo', () => {
    const e = estadoVazio();
    marcarTrilha(e, 'rezi-12', 'gold');
    desmarcar(e, arma('rezi-12'), 'militar-3');
    ok(!ok_(e, 'rezi-12', 'militar-3') && ok_(e, 'rezi-12', 'militar-4') && ok_(e, 'rezi-12', 'gold'));
  });
  await teste('Platinum: bloqueado listando armas da categoria sem Gold', () => {
    const e = estadoVazio();
    marcar(comCats, e, A('kg-7-vulcan'), 'gold');
    const s = situacao(comCats, e, A('kg-7-vulcan'), 'platinum');
    ok(s.bloqueada);
    igual(s.motivos, ['Faltam Gold em: PILA, Oden']);
    const r = marcar(comCats, e, A('kg-7-vulcan'), 'platinum');
    ok(!r.ok && !ok_(e, 'kg-7-vulcan', 'platinum'), 'não deveria marcar');
  });
  await teste('Platinum: libera quando todas da categoria têm Gold', () => {
    const e = estadoVazio();
    for (const id of ['pila', 'oden']) marcar(comCats, e, A(id), 'gold');
    // o Gold da própria arma vem pela cascata
    ok(!situacao(comCats, e, A('kg-7-vulcan'), 'platinum').bloqueada);
    ok(marcar(comCats, e, A('kg-7-vulcan'), 'harmonic-break').ok);
    ok(ok_(e, 'kg-7-vulcan', 'platinum') && ok_(e, 'kg-7-vulcan', 'gold'));
  });
  await teste('Platinum: categoria incompleta e arma sem categoria', () => {
    const e = estadoVazio();
    igual(situacao(bruto, e, kg7, 'platinum').motivos, ['Faltam 2 armas Sniper sem categoria definida']);
    igual(situacao(bruto, e, arma('pila'), 'platinum').motivos, ['Defina a categoria desta arma para calcular o Platinum.']);
  });
  await teste('Harmonic Break segue a trava do Platinum', () => {
    const e = estadoVazio();
    ok(situacao(bruto, e, kg7, 'harmonic-break').bloqueada);
  });
  await teste('Mastery MP: precisa de Harmonic Break em 33 armas', () => {
    const d = structuredClone(comCats);
    d.regras.platinum_requer = null; // isola a regra das 33
    const e = estadoVazio();
    const k = chaveMastery('MP', 'mercurial-drift');
    const s = situacao(d, e, d.armas[0], k);
    ok(s.bloqueada);
    igual(s.motivos, ['Faltam Harmonic Break em 32 outras armas (hoje: 0/33)']);
    d.armas.slice(1, 33).forEach((a) => marcar(d, e, a, 'harmonic-break'));
    ok(!situacao(d, e, d.armas[0], k).bloqueada, 'com 32 outras + a própria deveria liberar');
  });
  await teste('Marcar Mastery 3 marca as Mastery anteriores do modo + trilha toda, sem tocar outros modos', () => {
    const d = structuredClone(bruto); d.regras.platinum_requer = null; d.regras.mastery_hb_minimo.MP = 0;
    const e = estadoVazio();
    const r = marcar(d, e, d.armas[0], chaveMastery('MP', 'orion-reforged'));
    igual(r.marcadas.length, 17);
    ok(ok_(e, 'kg-7-vulcan', chaveMastery('MP', 'mercurial-drift')));
    ok(!ok_(e, 'kg-7-vulcan', chaveMastery('WZ', 'parallax')));
  });
  await teste('Mastery DMZ: sem trava, com aviso de regra a validar', () => {
    const d = structuredClone(bruto); d.regras.platinum_requer = null;
    const s = situacao(d, estadoVazio(), d.armas[0], chaveMastery('DMZ', 'chiral'));
    ok(!s.bloqueada && s.regraPendente);
  });
  await teste('Modo livre desliga as travas (cascata continua)', () => {
    const e = estadoVazio(); e.config.modo_livre = true;
    const r = marcar(bruto, e, kg7, chaveMastery('WZ', 'empyros'));
    ok(r.ok);
    igual(r.marcadas.length, 17);
  });
  await teste('Nível da arma marca as Militares liberadas e nunca desmarca', () => {
    const e = estadoVazio();
    igual(definirNivel(e, kg7, 31), ['militar-1', 'militar-2', 'militar-3']);
    igual(proximaMilitar(e, kg7).nivel, 38);
    definirNivel(e, kg7, 5);
    ok(ok_(e, 'kg-7-vulcan', 'militar-3') && e.armas['kg-7-vulcan'].nivel === 5);
    igual(definirNivel(e, arma('pila'), 99), [], 'níveis pendentes não marcam nada');
  });
  await teste('Contador e modo não se perdem ao marcar/desmarcar', () => {
    const e = estadoVazio();
    ajustarContador(e, kg7, 'treeline', 5); ajustarContador(e, kg7, 'treeline', -7);
    igual(e.armas['kg-7-vulcan'].camos.treeline.contador, 0);
    ajustarContador(e, kg7, 'treeline', 4); definirModo(e, kg7, 'treeline', 'DMZ');
    marcar(bruto, e, kg7, 'treeline'); desmarcar(e, kg7, 'treeline');
    igual(e.armas['kg-7-vulcan'].camos.treeline, { ok: false, contador: 4, modo: 'DMZ', data: null });
  });
  await teste('Divergence: Harmonic Break em 33 armas', () => {
    const e = estadoVazio();
    igual(situacaoDivergence(bruto, e).motivos, ['Harmonic Break em 0/33 armas']);
  });
}

// ---------------- painel ----------------
{
  const d = structuredClone(bruto);
  d.armas.find((a) => a.id === 'pila').categoria = 'Sniper';
  const A = (id) => d.armas.find((a) => a.id === id);
  const e = estadoVazio();
  marcar(d, e, A('kg-7-vulcan'), 'gold');
  marcar(d, e, A('pila'), 'gold');
  marcar(d, e, A('rezi-12'), 'brushstroke'); // Rezi: 10/14, sem Gold
  marcar(d, e, A('mar-9'), 'militar-2');

  await teste('Painel: contadores Gold/Platinum/HB sobre 35', () => {
    const s = estatisticas(d, e);
    igual([s.total, s.gold, s.platinum, s.harmonic, s.trilhasCompletas], [35, 2, 0, 0, 0]);
    igual(s.semCategoria, 28);
  });
  await teste('Painel: "Sniper: 2/3 com Gold → falta 1 para Platinum"', () => {
    const sn = estatisticas(d, e).categorias.find((c) => c.id === 'Sniper');
    igual(sn.texto, '2/3 com Gold → falta 1 para Platinum (1 sem categoria definida)');
    const sh = estatisticas(d, e).categorias.find((c) => c.id === 'Shotgun');
    igual(sh.texto, '0/2 com Gold → falta 2 para Platinum (1 sem categoria definida)');
  });
  await teste('Painel: Mastery por modo e Divergence', () => {
    const s = estatisticas(d, e);
    igual(s.mastery.MP.map((m) => m.feitas), [0, 0, 0]);
    ok(s.divergence.bloqueada && !s.divergence.feita);
    const e2 = structuredClone(e); e2.config.modo_livre = true;
    ok(alternarDivergence(d, e2).ok && estatisticas(d, e2).divergence.feita);
    ok(!alternarDivergence(d, e).ok, 'sem modo livre deveria travar');
  });
  await teste('Próximos passos: mais perto primeiro', () => {
    const p = proximosPassos(d, e);
    igual(p.map((x) => [x.arma.id, x.texto]), [
      ['kg-7-vulcan', 'Platinum: Falta 1 arma Sniper sem categoria definida'],
      ['pila', 'Platinum: Falta 1 arma Sniper sem categoria definida'],
      ['rezi-12', 'Faltam 2 camos para o Gold'],
      ['mar-9', 'Faltam 10 camos para o Gold'],
    ]);
  });
}

// ---------------- editor e configurações ----------------
await teste('Nova arma: estrutura completa, id único, tudo pendente', () => {
  const a = novaArma(bruto, 'KG-7 Vulcan', 'Sniper', false);
  igual(a.id, 'kg-7-vulcan-2');
  igual(trilha(a).length, 14);
  igual(validarDados({ ...bruto, armas: [...bruto.armas, a] }), []);
  ok(a.especiais.every(aValidar) && a.completionist.every(aValidar) && a.categoria_status === 'confirmado');
});
await teste('Nova arma entra na lista, é editável e pode ser removida sem perder progresso', () => {
  const e = estadoVazio();
  const a = novaArma(bruto, 'Arma Nova', null, null);
  e.armas_novas.push(a);
  registrarEdicao(e, bruto, `camo:${a.id}:especial-1`, { nome: 'Tigre', desafio: 'Headshots', status: 'confirmado' });
  e.armas[a.id] = { nivel: 3, camos: { 'militar-1': { ok: true } } };
  const d = aplicarEdicoes(bruto, e).dados;
  igual(d.armas.at(-1).especiais[0].nome, 'Tigre');
  igual(descreverChave(d, `camo:${a.id}:especial-1`), 'Arma Nova › Tigre');
  e.armas_novas = [];
  removerEdicoes(e, (k) => k.startsWith(`camo:${a.id}:`));
  igual(e.edicoes, {});
  igual(progressoOrfao(e, aplicarEdicoes(bruto, e).dados), [a.id]);
});
await teste('Editar meta e desafio por modo', () => {
  const e = estadoVazio();
  registrarEdicao(e, bruto, 'camo:finn-lmg:platinum', { desafio_modo: { MP: 'Kills sem morrer, 15x', DMZ: 'Kills sem tomar dano', WZ: 'Longshot kills' }, status: 'confirmado' });
  registrarEdicao(e, bruto, 'camo:pila:especial-2', { meta: { MP: 10, DMZ: null, WZ: 5 } });
  const d = aplicarEdicoes(bruto, e).dados;
  const finn = d.armas.find((a) => a.id === 'finn-lmg').completionist[1];
  ok(!aValidar(finn) && finn.desafio_modo.WZ === 'Longshot kills');
  igual(d.armas.find((a) => a.id === 'pila').especiais[1].meta, { MP: 10, DMZ: null, WZ: 5 });
});
await teste('Editar categoria libera o cálculo do Platinum', () => {
  const e = estadoVazio();
  for (const id of ['pila', 'oden']) registrarEdicao(e, bruto, `arma:${id}`, { categoria: 'Sniper', categoria_status: 'confirmado' });
  const d = aplicarEdicoes(bruto, e).dados;
  const kg = d.armas.find((a) => a.id === 'kg-7-vulcan');
  igual(situacao(d, e, kg, 'platinum').motivos, ['Faltam Gold em: PILA, Oden']);
});
await teste('Zerar progresso mantém edições, armas novas e modo livre', () => {
  const e = estadoVazio();
  e.armas.x = { nivel: 3, camos: { a: { ok: true } } }; e.favoritas = ['x']; e.conta.divergence = { ok: true };
  e.config.modo_livre = true;
  registrarEdicao(e, bruto, 'arma:pila', { categoria: 'AR' });
  e.armas_novas.push(novaArma(bruto, 'Nova'));
  const z = semProgresso(e);
  igual([z.armas, z.favoritas, z.conta.divergence], [{}, [], null]);
  ok(z.config.modo_livre && z.edicoes['arma:pila'] && z.armas_novas.length === 1);
});

// ---------------- saída ----------------
const falhas = resultados.filter((r) => !r.ok);
window.RESULTADO_TESTES = { total: resultados.length, falhas };
const el = document.getElementById('saida');
el.innerHTML = `<h2 class="${falhas.length ? 'ruim' : 'bom'}">${resultados.length - falhas.length}/${resultados.length} passaram</h2>` +
  resultados.map((r) => `<div class="${r.ok ? 'bom' : 'ruim'}">${r.ok ? '✔' : '✘'} ${r.nome}${r.ok ? '' : `<br><small>${r.erro}</small>`}</div>`).join('');
