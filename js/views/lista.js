// Tela principal: progressão de maestria, busca, filtros, categorias e cards de armas com as 14 camos.
import { listar, filtrosAtivos, FILTROS_PADRAO, SEM_CATEGORIA, chaveMastery } from '../progresso.js';
import { esc, prefs, seloValidar } from '../ui.js';
import { estatisticas } from '../stats.js';
import { situacao, marcar, desmarcar, feita, proximaMilitar } from '../rules.js';
import { barraTopo, MODOS, modoAtivo, ICONE, amostra, anel, desafioNoModo, metaNoModo, criarToast } from '../visual.js';

const OPCOES_DLC = [['todas', 'Todas'], ['lancamento', 'Lançamento'], ['dlc', 'DLC'], ['indefinido', 'A definir']];
const OPCOES_ORDEM = [['nome', 'Nome'], ['categoria', 'Categoria'], ['progresso', '% Progresso']];
const OPCOES_PROGRESSO = [
  ['todas', 'Qualquer progresso'], ['nao_iniciada', 'Não iniciada'], ['andamento', 'Em andamento'],
  ['completa', 'Trilha completa'], ['sem-gold', 'Falta Gold'], ['sem-platinum', 'Falta Platinum'],
  ['sem-harmonic-break', 'Falta Harmonic Break'],
];

/** Próxima camo da trilha ainda não feita (a que você deve buscar agora). */
export function proximaCamo(app, arma) {
  const militar = (arma.militares || []).find((m) => !feita(app.estado, arma.id, m.id));
  if (militar) return { tipo: 'militar', camo: militar };
  for (const c of arma.especiais || []) if (!feita(app.estado, arma.id, c.id)) return { tipo: 'especial', camo: c };
  for (const c of arma.completionist || []) if (!feita(app.estado, arma.id, c.id)) return { tipo: c.id, camo: c };
  return null;
}

export function telaLista(app) {
  return (el) => {
    const f = { ...FILTROS_PADRAO, ...prefs.ler('filtros', {}) };
    let painelAberto = prefs.ler('filtros-aberto', false);
    const modo = modoAtivo();
    const info = MODOS[modo];

    const nomeCat = (id) => app.dados.categorias.find((c) => c.id === id)?.nome ?? id;
    const seg = (nome, opcoes) => `<div class="segmentado" role="group" data-grupo="${nome}">${
      opcoes.map(([v, r]) => `<button type="button" data-valor="${v}" aria-pressed="${f[nome] === v}">${r}</button>`).join('')}</div>`;

    el.innerHTML = `
      ${barraTopo()}
      <section class="hero hero-${modo}">
        <div class="hero-fundo" aria-hidden="true"></div>
        <h1 class="hero-tit">${info.titulo[0] ? esc(info.titulo[0]) : ''}${info.titulo[1] ? `<em>${esc(info.titulo[1])}</em>` : ''}</h1>
        <p class="hero-sub">${esc(info.nome)} — acompanhe o progresso até a camuflagem de maestria <b>Divergence</b>.</p>
        <div class="hero-selos"><span class="pill cheia">MW4</span><span class="pill">${app.dados.armas.length} armas</span>
          <span class="pill">dados v${esc(app.dados.versao_dados)}</span></div>
      </section>
      <section class="progressao" data-progressao></section>
      <div class="barra-filtros" data-barra>
        <div class="linha-busca">
          <label class="busca-campo">${ICONE.busca}
            <input class="busca" type="search" placeholder="Pesquisar armas…" aria-label="Pesquisar armas"
                   autocomplete="off" enterkeyhint="search" value="${esc(f.busca)}"></label>
          <button class="icone-btn grande" type="button" data-acao="filtros" aria-expanded="${painelAberto}"
            aria-controls="painel-filtros" aria-label="Filtros">${ICONE.filtro}<span class="bolinha" data-bolinha hidden></span></button>
        </div>
        <div class="chips" role="group" aria-label="Tipo de arma">
          <button type="button" class="chip" data-cat-todas aria-pressed="${!f.categorias.length}">Todos</button>
          ${app.dados.categorias.map((c) => `<button type="button" class="chip" data-cat="${esc(c.id)}" aria-pressed="${f.categorias.includes(c.id)}">${esc(c.id)}</button>`).join('')}
          ${app.dados.armas.some((a) => !a.categoria) ? `<button type="button" class="chip" data-cat="${SEM_CATEGORIA}" aria-pressed="${f.categorias.includes(SEM_CATEGORIA)}">Sem categoria</button>` : ''}
        </div>
        <div class="painel-filtros" id="painel-filtros" ${painelAberto ? '' : 'hidden'}>
          <div><p class="grupo-titulo">Progresso</p>
            <select class="seletor" data-campo="progresso" aria-label="Filtro de progresso">
              ${OPCOES_PROGRESSO.map(([v, r]) => `<option value="${v}" ${f.progresso === v ? 'selected' : ''}>${r}</option>`).join('')}
            </select></div>
          <div><p class="grupo-titulo">Ordenar por</p>${seg('ordem', OPCOES_ORDEM)}</div>
          <div><p class="grupo-titulo">Lançamento / DLC</p>${seg('dlc', OPCOES_DLC)}</div>
          <button type="button" class="link-btn" data-acao="limpar">Limpar filtros</button>
        </div>
      </div>
      <div class="lista-armas" data-lista></div>`;

    const $ = (s) => el.querySelector(s);
    const toast = criarToast(el);

    // ---------- progressão (cards do topo) ----------
    function progressao() {
      const s = estatisticas(app.dados, app.estado);
      const dv = s.divergence;
      const pct = dv.min ? Math.min(1, s.harmonic / dv.min) : 0;
      const mastery = s.mastery[modo] || [];
      const total = s.total;
      const card = (cls, tit, desc, n, max, filtro) => `<button type="button" class="prog-card ${cls}" data-filtro-prog="${filtro}">
          <span class="prog-tit">${tit}</span><span class="prog-desc">${desc}</span>
          <span class="prog-num"><b>${String(n).padStart(2, '0')}</b> / ${max}</span>
          <span class="prog-barra"><span style="width:${Math.round((n / (max || 1)) * 100)}%"></span></span></button>`;
      $('[data-progressao]').innerHTML = `
        <div class="prog-grade">
          <a class="prog-card divergence ${dv.feita ? 'obtida' : ''}" href="#/painel">
            <span class="prog-selos"><span class="pill cheia mini">FINAL</span>
              <span class="pill mini escura">${dv.feita ? `${ICONE.check} OBTIDA` : dv.bloqueada ? `${ICONE.cadeado} BLOQUEADA` : 'LIBERADA'}</span></span>
            <span class="prog-tit">Divergence</span>
            <span class="prog-desc">Libera após Harmonic Break em ${dv.min ?? '?'} armas</span>
            <span class="prog-rodape">${anel(dv.feita ? 1 : pct, { tam: 58, espessura: 6, texto: `${Math.round((dv.feita ? 1 : pct) * 100)}<small>%</small>` })}
              <span class="prog-legenda">PROGRESSO<br>TOTAL</span></span>
          </a>
          ${card('gold', 'Gold', 'Militares + Especiais + desafio Gold', s.gold, total, 'sem-gold')}
          ${card('platinum', 'Platinum', 'Gold em todas as armas da classe', s.platinum, total, 'sem-platinum')}
          ${card('harmonic', 'Harmonic Break', `Platinum em ${app.dados.regras?.harmonic_platinum_minimo ?? 33} armas`, s.harmonic, total, 'sem-harmonic-break')}
        </div>
        ${mastery.length ? `<div class="mastery-faixa">
          <span class="mastery-rot">Mastery ${modo}</span>
          ${mastery.map((m) => `<span class="mastery-chip"><i class="sw sw-mastery mini" style="--h:${(m.nome.length * 47) % 360}"></i>
            ${esc(m.nome)} <b>${m.feitas}/${total}</b></span>`).join('')}
        </div>` : ''}`;
    }

    // ---------- card de arma ----------
    function linhaCamos(arma) {
      const prox = proximaCamo(app, arma);
      const sw = (tipo, c, i) => {
        const s = situacao(app.dados, app.estado, arma, c.id);
        const meta = metaNoModo(c, modo);
        const des = desafioNoModo(c, modo);
        const titulo = tipo === 'militar'
          ? `${c.nome} — nível ${c.nivel ?? '?'}`
          : `${c.nome}${des ? ` — ${des}` : ''}${meta != null ? ` (${meta} no ${modo})` : ''}`;
        return amostra({ tipo, indice: i, nome: c.nome, chave: c.id, armaId: arma.id, feita: s.feita,
          bloqueada: s.bloqueada, proxima: prox?.camo === c, titulo });
      };
      return `<div class="sw-grade">
        ${arma.militares.map((m, i) => sw('militar', m, i)).join('')}
        ${arma.especiais.map((c, i) => sw('especial', c, i)).join('')}
        <span class="sw-sep" aria-hidden="true"></span>
        ${arma.completionist.map((c) => sw(c.id, c, 0)).join('')}
      </div>`;
    }

    function textoProxima(arma) {
      const p = proximaCamo(app, arma);
      if (!p) {
        const nM = (app.dados.mastery[modo] || []).filter((m) => feita(app.estado, arma.id, chaveMastery(modo, m.id))).length;
        return `<span class="prox ok">${ICONE.check} Trilha completa · Mastery ${modo} ${nM}/${(app.dados.mastery[modo] || []).length}</span>`;
      }
      if (p.tipo === 'militar') {
        const nivel = app.estado.armas[arma.id]?.nivel;
        const pm = proximaMilitar(app.estado, arma);
        return `<span class="prox"><b>Próxima:</b> ${esc(p.camo.nome)} · nível ${pm?.nivel ?? p.camo.nivel ?? '?'}${nivel ? ` <span class="num">(você: ${nivel})</span>` : ''}</span>`;
      }
      const s = situacao(app.dados, app.estado, arma, p.camo.id);
      const des = desafioNoModo(p.camo, modo);
      const meta = metaNoModo(p.camo, modo);
      const cont = app.estado.armas[arma.id]?.camos[p.camo.id]?.contador;
      return `<span class="prox ${s.bloqueada ? 'trava' : ''}">${s.bloqueada ? ICONE.cadeado : '<b>Próxima:</b>'} ${esc(p.camo.nome)}
        ${des ? `· ${esc(des)}` : ''}${meta != null ? ` <span class="meta-num">${cont != null ? `${cont}/` : ''}${meta}</span>` : ''}</span>`;
    }

    function card({ arma, resumo, favorita }) {
      const pct = Math.round(resumo.pct * 100);
      return `<article class="arma-card ${favorita ? 'favorita' : ''} ${resumo.situacao}" data-arma-card="${esc(arma.id)}">
        <div class="arma-topo">
          <a class="arma-link" href="#/arma/${encodeURIComponent(arma.id)}">
            <span class="arma-nome">${esc(arma.nome)}</span>
            <span class="arma-sub">${esc(arma.categoria ? nomeCat(arma.categoria) : 'Sem categoria')}
              ${arma.categoria_status === 'pendente' ? seloValidar() : ''}${arma.lancamento === false ? '<span class="selo dlc">DLC</span>' : ''}
              ${ICONE.seta}</span>
          </a>
          ${anel(resumo.pct, { tam: 44, espessura: 4, texto: `${resumo.feitas}`, cls: resumo.situacao === 'completa' ? 'completo' : '' })}
          <button type="button" class="icone-btn fav" data-fav="${esc(arma.id)}" aria-pressed="${favorita}"
            aria-label="${favorita ? 'Remover dos favoritos' : 'Favoritar'} ${esc(arma.nome)}">${favorita ? ICONE.estrelaCheia : ICONE.estrela}</button>
        </div>
        ${linhaCamos(arma)}
        <div class="arma-rodape">${textoProxima(arma)}<span class="num">${pct}%</span></div>
      </article>`;
    }

    function render() {
      prefs.gravar('filtros', f);
      progressao();
      const itens = listar(app.dados, app.estado, f);
      const lista = $('[data-lista]');
      if (!itens.length) {
        lista.innerHTML = '<p class="vazio">Nenhuma arma com esses filtros.</p>';
      } else if (f.ordem === 'categoria' || f.categorias.length === 1) {
        const grupos = new Map();
        for (const x of itens) {
          const k = x.favorita && f.ordem !== 'categoria' ? '★' : (x.arma.categoria ?? SEM_CATEGORIA);
          if (!grupos.has(k)) grupos.set(k, []);
          grupos.get(k).push(x);
        }
        lista.innerHTML = [...grupos].map(([k, xs]) => `<section class="grupo">
          <h2 class="grupo-cab"><span>${k === '★' ? 'Favoritas' : k === SEM_CATEGORIA ? 'Sem categoria' : esc(k === 'Marksman' ? 'Marksman' : k)}</span>
            <small>${xs.length} arma${xs.length > 1 ? 's' : ''}</small></h2>
          ${xs.map(card).join('')}</section>`).join('');
      } else {
        lista.innerHTML = `<section class="grupo"><h2 class="grupo-cab"><span>Armas</span>
          <small>${itens.length} de ${app.dados.armas.length}</small></h2>${itens.map(card).join('')}</section>`;
      }
      const extras = (f.dlc !== 'todas') + (f.progresso !== 'todas') + (f.ordem !== 'nome');
      const b = $('[data-bolinha]');
      b.hidden = !extras;
      b.textContent = extras || '';
      $('[data-acao="filtros"]').classList.toggle('ativo', extras > 0);
      $('[data-acao="limpar"]').hidden = filtrosAtivos(f) === 0 && f.ordem === 'nome';
      el.querySelectorAll('[data-filtro-prog]').forEach((x) => x.classList.toggle('sel', f.progresso === x.dataset.filtroProg));
    }

    function sincronizarChips() {
      el.querySelectorAll('[data-cat]').forEach((c) => c.setAttribute('aria-pressed', f.categorias.includes(c.dataset.cat)));
      $('[data-cat-todas]').setAttribute('aria-pressed', !f.categorias.length);
    }

    $('.busca').addEventListener('input', (e) => { f.busca = e.target.value; render(); });

    el.addEventListener('click', async (e) => {
      const alvo = e.target.closest('button');
      if (!alvo || !el.contains(alvo)) return;
      if (alvo.dataset.acao === 'sw') {
        const arma = app.dados.armas.find((a) => a.id === alvo.dataset.arma);
        const chave = alvo.dataset.chave;
        const s = situacao(app.dados, app.estado, arma, chave);
        if (s.bloqueada) { toast.mostrar(`Bloqueada — ${s.motivos.join(' · ')}`); return; }
        const antes = structuredClone(app.estado.armas[arma.id] || { nivel: null, camos: {} });
        const desfazer = { rotulo: 'Desfazer', fn: async () => { app.estado.armas[arma.id] = antes; render(); await app.salvar(); } };
        if (s.feita) {
          desmarcar(app.estado, arma, chave);
          toast.mostrar(`${arma.nome}: desmarcou ${alvo.getAttribute('aria-label')}`, desfazer);
        } else {
          const r = marcar(app.dados, app.estado, arma, chave);
          toast.mostrar(r.marcadas.length > 1
            ? `${arma.nome}: marcou ${r.marcadas.length} camos (inclui as anteriores)`
            : `${arma.nome}: ${alvo.getAttribute('aria-label')} ✓`, desfazer);
        }
        render();
        el.querySelector(`[data-arma-card="${CSS.escape(arma.id)}"] [data-chave="${CSS.escape(chave)}"]`)?.classList.add('pulso');
        await app.salvar();
      } else if (alvo.dataset.filtroProg) {
        f.progresso = f.progresso === alvo.dataset.filtroProg ? 'todas' : alvo.dataset.filtroProg;
        $('[data-campo="progresso"]').value = f.progresso;
        render();
        $('[data-barra]').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (alvo.hasAttribute('data-cat-todas')) {
        f.categorias = [];
        sincronizarChips();
        render();
      } else if (alvo.dataset.cat !== undefined) {
        const v = alvo.dataset.cat;
        f.categorias = f.categorias.includes(v) ? f.categorias.filter((x) => x !== v) : [...f.categorias, v];
        sincronizarChips();
        render();
      } else if (alvo.closest('.segmentado')) {
        const grupo = alvo.closest('.segmentado');
        f[grupo.dataset.grupo] = alvo.dataset.valor;
        grupo.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === alvo));
        render();
      } else if (alvo.dataset.fav) {
        const id = alvo.dataset.fav;
        const favs = app.estado.favoritas;
        app.estado.favoritas = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
        render();
        await app.salvar();
      } else if (alvo.dataset.acao === 'filtros') {
        painelAberto = !painelAberto;
        $('#painel-filtros').hidden = !painelAberto;
        alvo.setAttribute('aria-expanded', painelAberto);
        prefs.gravar('filtros-aberto', painelAberto);
      } else if (alvo.dataset.acao === 'limpar') {
        Object.assign(f, { ...FILTROS_PADRAO, categorias: [] });
        $('.busca').value = '';
        $('[data-campo="progresso"]').value = 'todas';
        sincronizarChips();
        el.querySelectorAll('.segmentado').forEach((g) => g.querySelectorAll('button').forEach((b) =>
          b.setAttribute('aria-pressed', b.dataset.valor === FILTROS_PADRAO[g.dataset.grupo])));
        render();
      }
    });

    $('[data-campo="progresso"]').addEventListener('change', (e) => { f.progresso = e.target.value; render(); });

    render();

    // volta à posição de rolagem ao retornar do detalhe
    const y = prefs.ler('lista-scroll', 0);
    requestAnimationFrame(() => scrollTo(0, y));
    return () => { toast.limpar(); prefs.gravar('lista-scroll', scrollY); };
  };
}
