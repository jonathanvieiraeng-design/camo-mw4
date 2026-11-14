// Persistência local do progresso do usuário.
// Tudo fica num único registro (o volume é pequeno): IndexedDB quando disponível,
// localStorage como reserva e memória como último recurso (ex.: aba anônima restrita).

export const SCHEMA_PROGRESSO = 1;
export const APP_ID = 'camo-tracker-mw4';
const STORE = 'estado';
const CHAVE = 'principal';

export function estadoVazio() {
  return {
    schema_progresso: SCHEMA_PROGRESSO,
    armas: {},            // { [armaId]: { nivel, camos: { [camoId]: { ok, contador, modo, data } } } }
    conta: { divergence: null },
    favoritas: [],
    config: { modo_livre: false },
    edicoes: {},          // { [chave]: { campos, base, data } } — ver data.js
    armas_novas: [],      // armas adicionadas pelo editor do app
  };
}

const ehObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Completa campos ausentes e aplica migrações de versões antigas do progresso. */
export function normalizar(bruto) {
  const base = estadoVazio();
  if (!ehObj(bruto)) return base;
  const e = { ...base, ...bruto };
  // Migrações futuras: if (e.schema_progresso < 2) { ... }
  e.schema_progresso = SCHEMA_PROGRESSO;
  if (!ehObj(e.armas)) e.armas = {};
  for (const [id, p] of Object.entries(e.armas)) {
    if (!ehObj(p)) { e.armas[id] = { nivel: null, camos: {} }; continue; }
    if (!('nivel' in p)) p.nivel = null;
    if (!ehObj(p.camos)) p.camos = {};
  }
  e.conta = ehObj(e.conta) ? { ...base.conta, ...e.conta } : base.conta;
  e.favoritas = Array.isArray(e.favoritas) ? [...new Set(e.favoritas.filter((x) => typeof x === 'string'))] : [];
  e.config = ehObj(e.config) ? { ...base.config, ...e.config } : base.config;
  e.edicoes = ehObj(e.edicoes) ? e.edicoes : {};
  e.armas_novas = Array.isArray(e.armas_novas) ? e.armas_novas : [];
  return e;
}

// ---------- backends ----------

function backendIndexedDB(nomeDb) {
  let dbp = null;
  const abrir = () => {
    if (!dbp) {
      dbp = new Promise((ok, falha) => {
        const req = indexedDB.open(nomeDb, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => ok(req.result);
        req.onerror = () => falha(req.error);
        req.onblocked = () => falha(new Error('Banco bloqueado por outra aba.'));
      });
    }
    return dbp;
  };
  const tx = async (modo, fn) => {
    const db = await abrir();
    return new Promise((ok, falha) => {
      const t = db.transaction(STORE, modo);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => ok(r && r.result);
      t.onerror = () => falha(t.error);
      t.onabort = () => falha(t.error || new Error('Transação abortada.'));
    });
  };
  return {
    tipo: 'IndexedDB',
    testar: async () => { await abrir(); },
    ler: () => tx('readonly', (s) => s.get(CHAVE)),
    gravar: (v) => tx('readwrite', (s) => s.put(v, CHAVE)),
    apagar: () => tx('readwrite', (s) => s.delete(CHAVE)),
    fechar: async () => { if (dbp) (await dbp).close(); dbp = null; },
  };
}

function backendLocalStorage(nomeDb) {
  const k = `${nomeDb}:${CHAVE}`;
  return {
    tipo: 'localStorage',
    testar: async () => { localStorage.setItem(k + ':teste', '1'); localStorage.removeItem(k + ':teste'); },
    ler: async () => { const t = localStorage.getItem(k); return t ? JSON.parse(t) : undefined; },
    gravar: async (v) => localStorage.setItem(k, JSON.stringify(v)),
    apagar: async () => localStorage.removeItem(k),
    fechar: async () => {},
  };
}

function backendMemoria() {
  let v;
  return {
    tipo: 'memória (não salva!)',
    testar: async () => {},
    ler: async () => (v === undefined ? undefined : structuredClone(v)),
    gravar: async (x) => { v = structuredClone(x); },
    apagar: async () => { v = undefined; },
    fechar: async () => {},
  };
}

/**
 * Cria o armazenamento. `nomeDb` diferente permite testes sem tocar nos dados reais.
 */
export async function criarStore(nomeDb = APP_ID) {
  const candidatos = [];
  try { if (typeof indexedDB !== 'undefined') candidatos.push(backendIndexedDB(nomeDb)); } catch {}
  try { if (typeof localStorage !== 'undefined') candidatos.push(backendLocalStorage(nomeDb)); } catch {}
  candidatos.push(backendMemoria());

  let be;
  for (const c of candidatos) {
    try { await c.testar(); be = c; break; } catch { /* tenta o próximo */ }
  }

  let fila = Promise.resolve();
  const emFila = (fn) => (fila = fila.then(fn, fn)); // gravações em ordem, sem corrida

  return {
    tipo: be.tipo,

    async carregar() {
      return normalizar(await be.ler());
    },

    salvar(estado) {
      const copia = structuredClone(normalizar(estado));
      return emFila(() => be.gravar(copia));
    },

    zerar() {
      return emFila(() => be.apagar());
    },

    fechar: () => be.fechar(),
  };
}

/** Pede ao navegador para não apagar os dados sozinho. Retorna true/false/null (sem suporte). */
export async function pedirPersistencia() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}

// ---------- backup ----------

export function montarBackup(estado, versaoDados) {
  return {
    app: APP_ID,
    tipo: 'backup',
    exportado_em: new Date().toISOString(),
    versao_dados: versaoDados ?? null,
    estado: normalizar(structuredClone(estado)),
  };
}

/** Valida um backup (objeto ou texto JSON) e devolve o estado. Lança Error com mensagem em PT. */
export function lerBackup(entrada) {
  let obj = entrada;
  if (typeof entrada === 'string') {
    try { obj = JSON.parse(entrada); } catch { throw new Error('O arquivo não é um JSON válido.'); }
  }
  if (!ehObj(obj) || obj.app !== APP_ID || obj.tipo !== 'backup' || !ehObj(obj.estado)) {
    throw new Error('Este arquivo não é um backup do Rastreador de Camuflagens.');
  }
  if ((obj.estado.schema_progresso ?? 0) > SCHEMA_PROGRESSO) {
    throw new Error('Backup feito numa versão mais nova do app. Atualize o app antes de importar.');
  }
  return normalizar(obj.estado);
}

export function baixarBackup(estado, versaoDados) {
  const texto = JSON.stringify(montarBackup(estado, versaoDados), null, 2);
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `camo-mw4-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Estado sem progresso, mas mantendo edições do editor, armas novas e configurações. */
export function semProgresso(estado) {
  const e = estadoVazio();
  e.edicoes = structuredClone(estado.edicoes || {});
  e.armas_novas = structuredClone(estado.armas_novas || []);
  e.config = structuredClone(estado.config || e.config);
  return e;
}
