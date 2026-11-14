// Tela principal: lista de armas com busca, filtros combinados, ordenação e favoritas.
import { listar, filtrosAtivos, FILTROS_PADRAO, SEM_CATEGORIA, ROTULO_TIPO } from '../progresso.js';
import { esc, prefs, seloValidar } from '../ui.js';

const OPCOES_DLC = [['todas', 'Todas'], ['lancamento', 'Lançamento'], ['dlc', 'DLC'], ['indefinido', 'A definir']];
const OPCOES_ORDEM = [['nome', 'Nome'], ['categoria', 'Categoria'], ['progresso', '% Progresso']];
const OPCOES_PROGRESSO = [
  ['todas', 'Qualquer progresso'], ['nao_iniciada', 'Não iniciada'], ['andamento', 'Em andamento'],
  ['completa', 'Trilha completa'], ['sem-gold', 'Falta Gold'], ['sem-platinum', 'Falta Platinum'],
  ['sem-harmonic-break', 'Falta Harmonic Break'],
];

export function telaLista(app) {
  return (el) => {
    const f = { ...FILTROS_PADRAO, ...prefs.ler('filtros', {}) };
    let painelAberto = prefs.ler('filtros-aberto', false);

    const chipsCat = [
      ...app.dados.categorias.map((c) => [c.id, c.id]),
      [SEM_CATEGORIA, 'Sem categoria'],
    ];
    const seg = (nome, opcoes) => `<div class="segmentado" role="group" data-grupo="${nome}">${
      opcoes.map(([v, r]) => `<button type="button" data-valor="${v}" aria-pressed="${f[nome] === v}">${r}</button>`).join('')}</div>`;

    el.innerHTML = `
      <header class="topo">
        <div class="linha-busca">
          <input class="busca" type="search" placeholder="Buscar arma…" aria-label="Buscar arma"
                 autocomplete="off" enterkeyhint="search" value="${esc(f.busca)}">
          <button class="btn" type="button" data-acao="filtros" aria-expanded="${painelAberto}" aria-controls="painel-filtros">Filtros</button>
        </div>
        <div class="chips" role="group" aria-label="Tipo de arma">
          ${chipsCat.map(([v, r]) => `<button type="button" class="chip" data-cat="${esc(v)}" aria-pressed="${f.categorias.includes(v)}">${esc(r)}</button>`).join('')}
        </div>
        <div class="painel-filtros" id="painel-filtros" ${painelAberto ? '' : 'hidden'}>
          <div><p class="grupo-titulo">Lançamento / DLC</p>${seg('dlc', OPCOES_DLC)}</div>
          <div><p class="grupo-titulo">Progresso</p>
            <select class="seletor" data-campo="progresso" aria-label="Filtro de progresso">
              ${OPCOES_PROGRESSO.map(([v, r]) => `<option value="${v}" ${f.progresso === v ? 'selected' : ''}>${r}</option>`).join('')}
            </select></div>
          <div><p class="grupo-titulo">Ordenar por</p>${seg('ordem', OPCOES_ORDEM)}</div>
        </div>
        <div class="resumo-lista"><span data-contagem></span>
          <button type="button" class="link-btn" data-acao="limpar">Limpar filtros</button></div>
      </header>
      <ul class="lista" data-lista></ul>`;

    const $ = (s) => el.querySelector(s);
    const ul = $('[data-lista]');
    const btnFiltros = $('[data-acao="filtros"]');

    function card({ arma, resumo, favorita }) {
      const cat = arma.categoria
        ? esc(app.dados.categorias.find((c) => c.id === arma.categoria)?.nome ?? arma.categoria)
        : 'Sem categoria';
      const maior = resumo.maior
        ? `<span class="camo-maior ${resumo.maior.tipo}">${esc(resumo.maior.tipo === 'militar' || resumo.maior.tipo === 'especial'
          ? resumo.maior.nome : ROTULO_TIPO[resumo.maior.tipo] + (resumo.maior.modo ? ` ${resumo.maior.modo}` : ''))}</span>`
        : '';
      const pct = Math.round(resumo.pct * 100);
      return `<li class="card ${favorita ? 'favorita' : ''}">
        <a class="card-link" href="#/arma/${encodeURIComponent(arma.id)}">
          <div class="card-top"><span class="card-nome">${esc(arma.nome)}</span>
            ${arma.lancamento === false ? '<span class="selo dlc">DLC</span>' : ''}</div>
          <div class="card-sub"><span>${cat}</span>${arma.categoria_status === 'pendente' ? seloValidar() : ''}
            ${maior}</div>
          <div class="card-progresso">
            <div class="barra ${resumo.situacao === 'completa' ? 'completa' : ''}" role="progressbar"
                 aria-valuemin="0" aria-valuemax="${resumo.total}" aria-valuenow="${resumo.feitas}"
                 aria-label="Progresso da trilha"><span style="width:${pct}%"></span></div>
            <span class="contagem">${resumo.feitas}/${resumo.total}</span>
          </div>
        </a>
        <button type="button" class="fav" data-fav="${esc(arma.id)}" aria-pressed="${favorita}"
                aria-label="${favorita ? 'Remover dos favoritos' : 'Favoritar'} ${esc(arma.nome)}">${favorita ? '★' : '☆'}</button>
      </li>`;
    }

    function render() {
      prefs.gravar('filtros', f);
      const itens = listar(app.dados, app.estado, f);
      ul.innerHTML = itens.length
        ? itens.map(card).join('')
        : '<li class="vazio">Nenhuma arma com esses filtros.</li>';
      const n = filtrosAtivos(f);
      $('[data-contagem]').textContent = `${itens.length} de ${app.dados.armas.length} armas`;
      $('[data-acao="limpar"]').hidden = n === 0;
      const extras = (f.dlc !== 'todas') + (f.progresso !== 'todas') + (f.ordem !== 'nome');
      btnFiltros.textContent = extras ? `Filtros (${extras})` : 'Filtros';
      btnFiltros.classList.toggle('ativo', extras > 0);
    }

    // busca enquanto digita
    $('.busca').addEventListener('input', (e) => { f.busca = e.target.value; render(); });

    el.addEventListener('click', async (e) => {
      const alvo = e.target.closest('button');
      if (!alvo) return;
      if (alvo.dataset.cat !== undefined) {
        const v = alvo.dataset.cat;
        f.categorias = f.categorias.includes(v) ? f.categorias.filter((x) => x !== v) : [...f.categorias, v];
        alvo.setAttribute('aria-pressed', f.categorias.includes(v));
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
        Object.assign(f, { ...FILTROS_PADRAO, ordem: f.ordem, categorias: [] });
        $('.busca').value = '';
        $('[data-campo="progresso"]').value = 'todas';
        el.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
        el.querySelectorAll('[data-grupo="dlc"] button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.valor === 'todas'));
        render();
      }
    });

    $('[data-campo="progresso"]').addEventListener('change', (e) => { f.progresso = e.target.value; render(); });

    render();

    // volta à posição de rolagem ao retornar do detalhe
    const y = prefs.ler('lista-scroll', 0);
    requestAnimationFrame(() => scrollTo(0, y));
    return () => prefs.gravar('lista-scroll', scrollY);
  };
}
