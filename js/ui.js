// Utilitários de interface.

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto para HTML (nomes podem vir do editor do usuário). */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAPA[c]);

export const seloValidar = () => '<span class="selo validar">a validar</span>';

/** Preferências de tela (filtros etc.). Só conveniência: falha silenciosa. */
export const prefs = {
  ler(chave, padrao) {
    try { const t = localStorage.getItem(`camo-mw4:${chave}`); return t ? JSON.parse(t) : padrao; }
    catch { return padrao; }
  },
  gravar(chave, valor) {
    try { localStorage.setItem(`camo-mw4:${chave}`, JSON.stringify(valor)); } catch { /* ignora */ }
  },
};
