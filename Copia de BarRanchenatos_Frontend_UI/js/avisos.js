/* Avisos entre áreas: alerta con sonido para el bar y la cocina cuando llega un pedido, notificación al mesero cuando lo despachan y a la caja
   cuando el cliente pide desde la app. Los avisos viven en el navegador (ESTADO.avisos): cualquier pestaña de este navegador los recibe al momento. */

(function () {
  var area = areaElegida();
  window.__pestana = window.__pestana || String(Math.random());
  var mia = window.__pestana;
  var visto = 0;                       // el último aviso que esta pestaña ya mostró
  var leidoClave = 'rn_avisos_leido_' + area;
  var ctx = null;

  function leidoHasta() { try { return Number(localStorage.getItem(leidoClave)) || 0; } catch (e) { return 0; } }
  function sonidoActivo() { try { return localStorage.getItem('rn_sonido') !== '0'; } catch (e) { return true; } }

  // Siempre se leen del almacenamiento: así llegan los que creó otra pestaña
  function todos() {
    try { var e = JSON.parse(localStorage.getItem(CLAVE)); return (e && e.avisos) || []; } catch (x) { return []; }
  }
  // Un aviso con personas es solo de ellas (y del administrador); sin personas, es de todos los que trabajan en esa área
  function paraMi(a) {
    if (area === 'admin') return true;
    if (a.personas && a.personas.length) return a.personas.indexOf(usuarioActual()) !== -1;
    return (a.para || []).indexOf(area) !== -1;
  }
  function mios() { return todos().filter(paraMi); }
  function noLeidos() { var h = leidoHasta(); return mios().filter(function (a) { return a.id > h; }); }

  // ---------- Sonido (sin archivos: lo genera el navegador) ----------
  function desbloquear() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  }
  ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, desbloquear, { once: true }); });

  function tono(frecuencia, inicio, duracion) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = frecuencia;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
    g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + inicio + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracion);
    o.connect(g); g.connect(ctx.destination);
    o.start(ctx.currentTime + inicio); o.stop(ctx.currentTime + inicio + duracion + 0.05);
  }

  // comanda nueva: tres pitidos seguidos; pedido listo: dos tonos; el resto: uno
  function sonar(tipo) {
    if (!sonidoActivo()) return;
    desbloquear();
    if (ctx) {
      try {
        if (tipo === 'comanda') { tono(880, 0, 0.16); tono(880, 0.24, 0.16); tono(1175, 0.48, 0.3); }
        else if (tipo === 'listo') { tono(659, 0, 0.18); tono(988, 0.22, 0.32); }
        else tono(784, 0, 0.25);
      } catch (e) { /* sin sonido */ }
    }
    if (navigator.vibrate) navigator.vibrate(tipo === 'comanda' ? [250, 120, 250] : 200);
  }

  // ---------- Avisos en pantalla ----------
  var caja = document.createElement('div');
  caja.className = 'avisos-caja';
  caja.setAttribute('role', 'status');
  caja.setAttribute('aria-live', 'polite');
  document.body.appendChild(caja);

  function mostrar(a) {
    var urgente = a.tipo === 'comanda';
    var t = document.createElement('div');
    t.className = 'aviso-toast aviso-' + (a.tipo || 'aviso');
    t.innerHTML = '<span class="aviso-cuerpo"><b>' + (a.tipo === 'comanda' ? 'Pedido nuevo' : (a.tipo === 'listo' ? 'Pedido listo' : (a.tipo === 'cliente' ? 'Pedido del cliente' : 'Aviso'))) + '</b>' + esc(a.texto) + '</span>' +
      (a.enlace ? '<a class="btn btn-sm" href="' + esc(a.enlace) + '">Ver</a>' : '') + '<button type="button" class="aviso-x" aria-label="Cerrar">×</button>';
    t.addEventListener('click', function (e) { if (e.target.closest('.aviso-x')) t.remove(); });
    caja.appendChild(t);
    if (!urgente) setTimeout(function () { t.remove(); }, 9000);
    while (caja.children.length > 4) caja.firstChild.remove();
  }

  // ---------- Campana y lista ----------
  var campanas = [];
  var LUNA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>';
  var SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  // Campana y modo claro u oscuro, arriba a la derecha de cada pantalla
  function crearUtilidades() {
    var cab = document.querySelector('.encabezado') || document.querySelector('.cl-cab');
    var caja = document.createElement('div');
    caja.className = 'utilidades';
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'campana'; b.setAttribute('aria-label', 'Avisos');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v4L6 17z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><i class="campana-n" hidden></i>';
    b.addEventListener('click', abrirLista);
    var t = document.createElement('button');
    t.type = 'button'; t.className = 'campana tema-btn'; t.setAttribute('aria-label', 'Modo claro u oscuro');
    function iconoTema() { t.innerHTML = document.documentElement.getAttribute('data-theme') === 'oscuro' ? SOL : LUNA; }
    t.addEventListener('click', function () {
      var nuevo = document.documentElement.getAttribute('data-theme') === 'oscuro' ? 'claro' : 'oscuro';
      document.documentElement.setAttribute('data-theme', nuevo);
      try { localStorage.setItem('tema', nuevo); } catch (e) { /* sin memoria */ }
      iconoTema();
    });
    iconoTema();
    caja.appendChild(b); caja.appendChild(t);
    if (cab) cab.appendChild(caja); else { caja.classList.add('flotante'); document.body.appendChild(caja); }
    campanas.push(b);
  }
  function pintarCampanas() {
    var n = noLeidos().length;
    campanas.forEach(function (b) { var i = b.querySelector('.campana-n'); i.hidden = !n; i.textContent = n > 9 ? '9+' : n; b.classList.toggle('con-avisos', n > 0); });
  }

  var dlg = document.createElement('dialog');
  dlg.className = 'dlg-res dlg-chico';
  dlg.id = 'dlg-avisos';
  document.body.appendChild(dlg);

  function abrirLista() {
    var lista = mios().slice(-20).reverse(), h = leidoHasta();
    dlg.innerHTML = '<button type="button" class="cerrar-x" data-cerrar aria-label="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="form-res"><h2>Avisos</h2>' +
      (lista.length ? '<ul class="avisos-lista">' + lista.map(function (a) {
        return '<li class="' + (a.id > h ? 'nuevo' : '') + '"><span>' + esc(a.fecha.slice(11)) + '</span><span>' + esc(a.texto) + (a.enlace ? ' <a href="' + esc(a.enlace) + '">Ver</a>' : '') + '</span></li>';
      }).join('') + '</ul>' : '<p class="ayuda-res">Todavía no hay avisos.</p>') +
      '<label class="campo-check"><input type="checkbox" id="av-sonido"' + (sonidoActivo() ? ' checked' : '') + '> Sonido de las alertas</label>' +
      '<div class="acciones-res"><button type="button" class="btn" id="av-probar">Probar sonido</button><button type="button" class="btn btn-primary" id="av-leidos">Marcar como leídos</button></div></div>';
    dlg.showModal();
  }
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg || e.target.closest('[data-cerrar]')) { dlg.close(); return; }
    if (e.target.id === 'av-probar') sonar('comanda');
    if (e.target.id === 'av-leidos') { var m = mios(); try { localStorage.setItem(leidoClave, String(m.length ? m[m.length - 1].id : 0)); } catch (x) { /* sin memoria */ } pintarCampanas(); dlg.close(); }
  });
  dlg.addEventListener('change', function (e) { if (e.target.id === 'av-sonido') { try { localStorage.setItem('rn_sonido', e.target.checked ? '1' : '0'); } catch (x) { /* sin memoria */ } } });

  // ---------- Revisar si llegó algo ----------
  function revisar() {
    var nuevos = todos().filter(function (a) { return a.id > visto; });
    if (!nuevos.length) return;
    visto = nuevos[nuevos.length - 1].id;
    var paraAqui = nuevos.filter(function (a) { return paraMi(a) && a.de !== mia; });
    paraAqui.forEach(mostrar);
    if (paraAqui.length) sonar(paraAqui.some(function (a) { return a.tipo === 'comanda'; }) ? 'comanda' : (paraAqui.some(function (a) { return a.tipo === 'listo'; }) ? 'listo' : 'aviso'));
    pintarCampanas();
    if (window.alLlegarAviso) window.alLlegarAviso(paraAqui);
  }

  var viejos = todos();
  visto = viejos.length ? viejos[viejos.length - 1].id : 0;
  crearUtilidades();
  pintarCampanas();
  window.addEventListener('storage', function (e) { if (e.key === CLAVE) revisar(); });
  setInterval(revisar, 3000);

  var css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = 'css/avisos.css';
  document.head.appendChild(css);
})();
