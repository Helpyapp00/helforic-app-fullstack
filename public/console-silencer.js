// Silenciador global de console (frontend).
// Por padrão, desliga logs verbosos para evitar "vazamento" de informações no console.
// Para reativar: localStorage.setItem('DEBUG', '1') e recarregue a página.
(function () {
  try {
    const enabled = localStorage.getItem('DEBUG') === '1';
    if (enabled) return;

    const noop = function () {};
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
  } catch (_) {
    // Se algo falhar, não quebra a aplicação.
  }
})();

