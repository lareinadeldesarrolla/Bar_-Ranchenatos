/* Tablero de Inicio: muestra los indicadores que el administrador eligió, en el orden que eligió.
   Para cada uno se escoge en "Personalizar" si se ve como gráfico o como tabla, con qué estilo y de qué tamaño.
   Todo se guarda en el navegador (localStorage). */

// Otra pantalla (por ejemplo Mesas) puede usar este mismo tablero con su propio catálogo, orden inicial y memoria
var PAGINA = window.PAGINA_TABLERO || {};
var CLAVE_TABLERO = PAGINA.clave || 'rn_inicio_v4';
var ORDEN_INICIAL = PAGINA.orden || ['ventas_turno', 'ticket', 'utilidad_total', 'pedidos_curso', 'op_plano', 'op_reservas', 'ventas_hora', 'top_unidades', 'baja_venta', 'candidatos'];
if (PAGINA.solo) INDICADORES = INDICADORES.filter(function (i) { return PAGINA.solo.indexOf(i.id) !== -1; });
var PREF = { orden: ORDEN_INICIAL.slice(), config: {}, params: {} };
// Una pantalla con varias vistas (Reportes) tiene un tablero por vista, cada uno con su orden y su memoria; las cifras económicas se comparten
var VISTAS = PAGINA.vistas || null;
var vistaActiva = VISTAS ? VISTAS[0] : null;
if (vistaActiva) { CLAVE_TABLERO = PAGINA.clave + '_' + vistaActiva.clave; ORDEN_INICIAL = vistaActiva.orden || []; PREF.orden = ORDEN_INICIAL.slice(); }
var COLORES = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];

var ESTILOS_GRAFICO = [['columnas', 'Columnas'], ['ranking', 'Barras horizontales'], ['linea', 'Línea'], ['area', 'Área'], ['puntos', 'Puntos'], ['dona', 'Dona'], ['torta', 'Torta'], ['apilada', 'Barra 100 %'], ['bloques', 'Bloques']];
var ESTILOS_TABLA = [['clasica', 'Clásica'], ['cebra', 'Filas alternadas'], ['compacta', 'Compacta'], ['minimal', 'Sin líneas'], ['ranking', 'Con posición'], ['barras', 'Barras en la celda'], ['calor', 'Mapa de calor'], ['tarjetas', 'Tarjetas']];
var ESTILOS_KPI = [['bloque', 'Bloque gris'], ['marino', 'Azul marino'], ['limpio', 'Limpio']];
var TAMANOS = [[4, 'Pequeño'], [6, 'Mediano'], [8, 'Grande'], [12, 'Ancho completo']];
var TAMANOS_KPI = [[3, 'Normal'], [6, 'Ancho']];
var GRAFICO_DE = { barras: 'columnas', hbarras: 'ranking', dona: 'dona' };

function cargarPreferencias(params) {
  PREF = { orden: ORDEN_INICIAL.slice(), config: {}, params: {} };
  try {
    var guardado = localStorage.getItem(CLAVE_TABLERO);
    if (guardado) PREF = JSON.parse(guardado);
  } catch (e) { /* sin preferencias guardadas */ }
  PREF.config = PREF.config || {};
  PREF.params = params || PREF.params || {};
  // Una pantalla fija (Mesas) siempre muestra el orden que define su página, no uno guardado
  if (PAGINA.fijo) PREF.orden = ORDEN_INICIAL.slice();
}
cargarPreferencias();

function guardarPreferencias() {
  try { localStorage.setItem(CLAVE_TABLERO, JSON.stringify(PREF)); } catch (e) { /* sin memoria del navegador */ }
}

// Aviso breve abajo de la pantalla
function toast(texto) {
  var caja = document.getElementById('toasts');
  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'toasts';
    caja.className = 'toasts';
    caja.setAttribute('role', 'status');
    document.body.appendChild(caja);
  }
  var aviso = document.createElement('div');
  aviso.className = 'toast';
  aviso.textContent = texto;
  caja.appendChild(aviso);
  setTimeout(function () { aviso.remove(); }, 3500);
}

// Configuración de un indicador: lo guardado más lo que trae por defecto
function configDe(ind) {
  var c = PREF.config[ind.id] || {};
  return {
    vista: ind.tipo === 'tabla' ? 'tabla' : (c.vista || 'grafico'),
    grafico: c.grafico || GRAFICO_DE[ind.tipo] || 'columnas',
    tabla: c.tabla || 'clasica',
    kpi: c.kpi || 'bloque',
    estilo: c.estilo || (ind.estilos ? ind.estilos[0][0] : ''),
    ancho: c.ancho || ind.ancho
  };
}

function cambiarConfig(id, campo, valor) {
  PREF.config[id] = PREF.config[id] || {};
  PREF.config[id][campo] = valor;
  guardarPreferencias();
}

// ---------- Formato ----------
function celda(valor, formato) { return typeof valor === 'number' && formato ? formato(valor) : String(valor); }

function corto(n, esPesos) {
  var texto;
  if (n >= 1000000) texto = (Math.round(n / 100000) / 10).toLocaleString('es-CO') + ' M';
  else if (n >= 1000) texto = Math.round(n / 1000).toLocaleString('es-CO') + ' mil';
  else texto = Math.round(n).toLocaleString('es-CO');
  return (esPesos ? '$ ' : '') + texto;
}

function hayDatos(d) {
  if (!d.filas.length || d.graficar < 0) return false;
  var algo = false;
  d.filas.forEach(function (f) { if (f[d.graficar] > 0) algo = true; });
  return algo;
}

function valorCorto(d, v) { return d.formatos[d.graficar] === pesos ? corto(v, true) : celda(v, d.formatos[d.graficar]); }

// ---------- Gráficos (SVG y HTML, sin librerías) ----------
function ejeBase(W, H, izq, der, abajo) {
  return '<line x1="' + izq + '" y1="' + (H - abajo) + '" x2="' + (W - der) + '" y2="' + (H - abajo) + '" class="eje"/>';
}

function graficoColumnas(d) {
  var W = 360, H = 190, izq = 10, der = 10, arriba = 22, abajo = 34;
  var n = d.filas.length, maximo = 1;
  d.filas.forEach(function (f) { maximo = Math.max(maximo, f[d.graficar]); });
  var paso = (W - izq - der) / n, ancho = Math.min(46, paso * 0.62);
  var svg = '<svg class="g-barras" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gráfico de columnas">' + ejeBase(W, H, izq, der, abajo);
  d.filas.forEach(function (f, i) {
    var alto = (H - abajo - arriba) * f[d.graficar] / maximo;
    var x = izq + paso * i + (paso - ancho) / 2, y = H - abajo - alto;
    svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + ancho.toFixed(1) + '" height="' + Math.max(alto, 1).toFixed(1) + '" rx="4" class="barra"/>';
    svg += '<text x="' + (x + ancho / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" class="valor">' + valorCorto(d, f[d.graficar]) + '</text>';
    svg += '<text x="' + (x + ancho / 2).toFixed(1) + '" y="' + (H - abajo + 15) + '" class="etiqueta">' + esc(String(f[0]).slice(0, 9)) + '</text>';
  });
  return svg + '</svg>';
}

// Línea, área y puntos comparten el mismo trazado
function graficoLinea(d, modo) {
  var W = 360, H = 190, izq = 16, der = 16, arriba = 24, abajo = 34;
  var n = d.filas.length, maximo = 1;
  d.filas.forEach(function (f) { maximo = Math.max(maximo, f[d.graficar]); });
  var xs = [], ys = [];
  d.filas.forEach(function (f, i) {
    xs.push(n === 1 ? W / 2 : izq + (W - izq - der) * i / (n - 1));
    ys.push(H - abajo - (H - abajo - arriba) * f[d.graficar] / maximo);
  });
  var svg = '<svg class="g-linea" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gráfico de ' + modo + '">' + ejeBase(W, H, izq, der, abajo);
  if (modo === 'puntos') {
    xs.forEach(function (x, i) { svg += '<line x1="' + x.toFixed(1) + '" y1="' + (H - abajo) + '" x2="' + x.toFixed(1) + '" y2="' + ys[i].toFixed(1) + '" class="tallo"/>'; });
  } else if (n > 1) {
    var puntos = xs.map(function (x, i) { return x.toFixed(1) + ',' + ys[i].toFixed(1); }).join(' ');
    if (modo === 'area') svg += '<polygon points="' + xs[0].toFixed(1) + ',' + (H - abajo) + ' ' + puntos + ' ' + xs[n - 1].toFixed(1) + ',' + (H - abajo) + '" class="area"/>';
    svg += '<polyline points="' + puntos + '" class="linea"/>';
  }
  d.filas.forEach(function (f, i) {
    svg += '<circle cx="' + xs[i].toFixed(1) + '" cy="' + ys[i].toFixed(1) + '" r="' + (modo === 'puntos' ? 5 : 3.6) + '" class="punto"/>';
    svg += '<text x="' + xs[i].toFixed(1) + '" y="' + (ys[i] - 9).toFixed(1) + '" class="valor">' + valorCorto(d, f[d.graficar]) + '</text>';
    svg += '<text x="' + xs[i].toFixed(1) + '" y="' + (H - abajo + 15) + '" class="etiqueta">' + esc(String(f[0]).slice(0, 9)) + '</text>';
  });
  return svg + '</svg>';
}

function graficoRanking(d) {
  var maximo = 1, html = '<div class="g-horiz">';
  d.filas.forEach(function (f) { maximo = Math.max(maximo, f[d.graficar]); });
  d.filas.slice(0, 8).forEach(function (f) {
    html += '<div class="hfila"><span class="hnombre" title="' + esc(f[0]) + '">' + esc(f[0]) + '</span><span class="hpista"><i style="width:' + Math.max(f[d.graficar] / maximo * 100, 1.5) + '%"></i></span><b>' +
      celda(f[d.graficar], d.formatos[d.graficar]) + '</b></div>';
  });
  return html + '</div>';
}

function leyenda(d, total) {
  var html = '<ul class="g-leyenda">';
  d.filas.forEach(function (f, i) {
    html += '<li><i class="' + COLORES[i % COLORES.length] + '"></i><span title="' + esc(f[0]) + '">' + esc(f[0]) + '</span><b>' + (total ? Math.round(f[d.graficar] / total * 100) : 0) + ' %</b></li>';
  });
  return html + '</ul>';
}

function sumaGrafica(d) {
  var total = 0;
  d.filas.forEach(function (f) { total += f[d.graficar]; });
  return total;
}

// Dona y torta: círculos con trazo discontinuo
function graficoCircular(d, hueco) {
  var total = sumaGrafica(d), r = hueco ? 38 : 25, grosor = hueco ? 18 : 52, c = 2 * Math.PI * r, acumulado = 0;
  var svg = '<svg class="g-dona" viewBox="0 0 100 100" role="img" aria-label="Gráfico circular"><g transform="rotate(-90 50 50)">';
  d.filas.forEach(function (f, i) {
    var largo = c * f[d.graficar] / total;
    svg += '<circle cx="50" cy="50" r="' + r + '" style="stroke-width:' + grosor + '" class="seg ' + COLORES[i % COLORES.length] + '" stroke-dasharray="' + largo.toFixed(2) + ' ' + (c - largo).toFixed(2) + '" stroke-dashoffset="' + (-acumulado).toFixed(2) + '"/>';
    acumulado += largo;
  });
  svg += '</g>';
  if (hueco) svg += '<text x="50" y="52" class="centro">' + (d.formatos[d.graficar] === pesos ? corto(total, true) : n0(total)) + '</text>';
  return '<div class="g-dona-caja">' + svg + '</svg>' + leyenda(d, total) + '</div>';
}

function graficoApilada(d) {
  var total = sumaGrafica(d), barra = '<div class="barra-apilada" role="img" aria-label="Barra de proporciones">';
  d.filas.forEach(function (f, i) { barra += '<i class="' + COLORES[i % COLORES.length] + '" style="flex:' + f[d.graficar] + '" title="' + esc(f[0]) + '"></i>'; });
  return '<div class="g-apilada">' + barra + '</div>' + leyenda(d, total) + '</div>';
}

function graficoBloques(d) {
  var html = '<div class="g-bloques">';
  d.filas.forEach(function (f, i) {
    html += '<div class="' + COLORES[i % COLORES.length] + '" style="flex:' + Math.max(f[d.graficar], 0.0001) + ' 1 7.5rem"><span title="' + esc(f[0]) + '">' + esc(f[0]) + '</span><b>' + celda(f[d.graficar], d.formatos[d.graficar]) + '</b></div>';
  });
  return html + '</div>';
}

function dibujarGrafico(d, estilo) {
  if (estilo === 'columnas') return graficoColumnas(d);
  if (estilo === 'linea' || estilo === 'area' || estilo === 'puntos') return graficoLinea(d, estilo);
  if (estilo === 'ranking') return graficoRanking(d);
  if (estilo === 'dona') return graficoCircular(d, true);
  if (estilo === 'torta') return graficoCircular(d, false);
  if (estilo === 'apilada') return graficoApilada(d);
  return graficoBloques(d);
}

// ---------- Tablas ----------
function columnaNumerica(d) {
  if (d.graficar >= 0) return d.graficar;
  for (var i = 1; i < d.columnas.length; i++) if (d.filas.length && typeof d.filas[0][i] === 'number') return i;
  return -1;
}

function tablaIndicador(d, estilo) {
  if (estilo === 'tarjetas') {
    var t = '<div class="t-tarjetas">';
    d.filas.forEach(function (f) {
      t += '<div class="t-tarjeta"><b>' + esc(f[0]) + '</b><dl>';
      for (var i = 1; i < f.length; i++) t += '<div><dt>' + esc(d.columnas[i]) + '</dt><dd>' + esc(celda(f[i], d.formatos[i])) + '</dd></div>';
      t += '</dl></div>';
    });
    return t + '</div>';
  }
  var col = columnaNumerica(d), maximos = [];
  d.columnas.forEach(function (c, i) {
    var m = 0;
    d.filas.forEach(function (f) { if (typeof f[i] === 'number') m = Math.max(m, Math.abs(f[i])); });
    maximos.push(m);
  });
  var conPosicion = estilo === 'ranking';
  var html = '<div class="ind-tabla t-' + estilo + '"><table><thead><tr>' + (conPosicion ? '<th class="pos">#</th>' : '');
  d.columnas.forEach(function (c, i) { html += '<th' + (d.filas.length && typeof d.filas[0][i] === 'number' ? ' class="num"' : '') + '>' + esc(c) + '</th>'; });
  html += '</tr></thead><tbody>';
  d.filas.forEach(function (f, k) {
    html += '<tr>' + (conPosicion ? '<td class="pos"><span class="p' + (k < 3 ? ' top' : '') + '">' + (k + 1) + '</span></td>' : '');
    f.forEach(function (v, i) {
      var texto = esc(celda(v, d.formatos[i])), extra = '', clase = typeof v === 'number' ? 'num' : '';
      if (typeof v === 'number' && estilo === 'barras' && i === col && maximos[i]) {
        texto = '<span class="cb"><span class="cb-pista"><i style="width:' + Math.max(Math.abs(v) / maximos[i] * 100, 1.5) + '%"></i></span><b>' + texto + '</b></span>';
        clase += ' con-barra';
      }
      if (typeof v === 'number' && estilo === 'calor' && i > 0 && maximos[i]) extra = ' style="background:rgba(var(--calor),' + (0.06 + 0.34 * Math.abs(v) / maximos[i]).toFixed(2) + ')"';
      html += '<td' + (clase ? ' class="' + clase + '"' : '') + ' data-label="' + esc(d.columnas[i]) + '"' + extra + '>' + texto + '</td>';
    });
    html += '</tr>';
  });
  return html + '</tbody></table></div>';
}

// ---------- Tarjeta de cada indicador ----------
function agarre(titulo) {
  return '<button type="button" class="agarre" aria-label="Mover ' + esc(titulo) + '" title="Arrastra para mover. Con el teclado, usa las flechas."><span></span></button>';
}

// Cambiar entre gráfico y tabla, y de estilo, desde la propia tarjeta (Reportes)
function barraRapida(ind, cfg) {
  if (!PAGINA.barraRapida) return '';
  var estilos = cfg.vista === 'tabla' ? ESTILOS_TABLA : ESTILOS_GRAFICO, actual = cfg.vista === 'tabla' ? cfg.tabla : cfg.grafico;
  return '<div class="vista-rapida">' + (ind.tipo !== 'tabla' ? '<div class="segmento seg-mini" role="group" aria-label="Ver como"><button type="button" class="seg" data-rv="grafico" aria-pressed="' + (cfg.vista !== 'tabla') + '">Gráfico</button><button type="button" class="seg" data-rv="tabla" aria-pressed="' + (cfg.vista === 'tabla') + '">Tabla</button></div>' : '') +
    '<select data-re aria-label="Estilo">' + opciones(estilos, actual) + '</select></div>';
}

function tarjeta(ind) {
  var cfg = configDe(ind);
  var estilo = 'style="--ancho:' + cfg.ancho + '"';
  if (ind.tipo === 'operacion') {
    var enlace = ind.enlace ? '<a' + (ind.enlace.boton ? ' class="enlace-btn"' : '') + ' href="' + ind.enlace.ir + '">' + esc(ind.enlace.texto) + '</a>' : '';
    return '<article class="ind op op-' + ind.id + '" ' + estilo + ' data-id="' + ind.id + '"><header><h2 title="' + esc(ind.ayuda) + '">' + esc(ind.titulo) + '</h2>' + enlace + agarre(ind.titulo) + '</header><div class="cuerpo-op">' + ind.dibujar(cfg.estilo) + '</div></article>';
  }
  var d = ind.datos();
  if (ind.tipo === 'kpi') {
    return '<article class="ind kpi k-' + cfg.kpi + '" ' + estilo + ' data-id="' + ind.id + '"><header><h2 title="' + esc(ind.ayuda) + '">' + esc(ind.titulo) + '</h2>' + agarre(ind.titulo) + '</header><div class="bloque">' + esc(d.valor) + '</div><p class="detalle">' + esc(d.detalle) + '</p></article>';
  }
  var html = '<article class="ind ' + ind.tipo + '" ' + estilo + ' data-id="' + ind.id + '"><header><h2 title="' + esc(ind.ayuda) + '">' + esc(ind.titulo) + '</h2>' + agarre(ind.titulo) + '</header>' + barraRapida(ind, cfg) + '<div class="cuerpo">';
  if (!d.filas.length || (cfg.vista === 'grafico' && !hayDatos(d))) {
    html += '<p class="sin-datos">Todavía no hay datos. Se llena con la operación.</p>';
  } else if (cfg.vista === 'tabla') {
    html += tablaIndicador(d, cfg.tabla);
  } else {
    html += dibujarGrafico(d, cfg.grafico);
  }
  return html + '</div></article>';
}

function pintarTablero() {
  var caja = document.getElementById('tablero');
  var posicion = caja.scrollTop;
  var html = '';
  PREF.orden.forEach(function (id) {
    if (id.charAt(0) === '#') { var t = id.slice(1).split('|'); html += '<header class="seccion-t" data-id="' + esc(id) + '"><h2>' + esc(t[0]) + '</h2>' + (t[1] ? '<p>' + esc(t[1]) + '</p>' : '') + '</header>'; return; }
    var ind = indicadorPorId(id);
    if (ind) html += tarjeta(ind);
  });
  caja.innerHTML = html || '<p class="sin-datos grande">No hay nada en pantalla. Pulsa <b>Personalizar</b> para elegir mesas, reservas e indicadores.</p>';
  caja.scrollTop = posicion;
  ajustarTablas();
}

// Si una tabla no cabe en su bloque: primero se compacta y, si aun así no cabe, se apila con la etiqueta de cada dato
function ajustarTablas() {
  Array.prototype.forEach.call(document.querySelectorAll('.ind-tabla'), function (caja) {
    caja.classList.remove('ajuste1', 'ajuste2');
    if (caja.scrollWidth <= caja.clientWidth + 1) return;
    caja.classList.add('ajuste1');
    if (caja.scrollWidth > caja.clientWidth + 1) { caja.classList.remove('ajuste1'); caja.classList.add('ajuste2'); }
  });
}

// Cambios rápidos de la tarjeta: gráfico o tabla, y estilo
document.getElementById('tablero').addEventListener('click', function (e) {
  var b = e.target.closest('[data-rv]');
  if (!b) return;
  cambiarConfig(b.closest('.ind').dataset.id, 'vista', b.dataset.rv);
  pintarTablero();
});
document.getElementById('tablero').addEventListener('change', function (e) {
  var sel = e.target.closest('[data-re]');
  if (!sel) return;
  var id = sel.closest('.ind').dataset.id, cfg = configDe(indicadorPorId(id));
  cambiarConfig(id, cfg.vista === 'tabla' ? 'tabla' : 'grafico', sel.value);
  pintarTablero();
});

// Todos los indicadores de la vista como gráficos o como tablas (los kpi y los que solo son tabla no cambian)
function verTodosComo(vista) {
  PREF.orden.forEach(function (id) {
    var ind = indicadorPorId(id);
    if (ind && ind.tipo !== 'kpi' && ind.tipo !== 'tabla' && ind.tipo !== 'operacion') cambiarConfig(id, 'vista', vista);
  });
  pintarTablero();
}

// ---------- Mover los widgets: arrastrando (ratón o dedo) o con las flechas del teclado ----------
var arrastre = null;
var vistaTablero = document.getElementById('tablero');
var movimientoReducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function posicionesActuales() {
  var mapa = [];
  Array.prototype.forEach.call(vistaTablero.querySelectorAll('.ind'), function (c) { mapa.push([c, c.getBoundingClientRect()]); });
  return mapa;
}

// Los demás widgets se deslizan a su nuevo lugar en vez de saltar
function animarCambio(antes) {
  if (movimientoReducido) return;
  antes.forEach(function (par) {
    var c = par[0], a = par[1], b = c.getBoundingClientRect();
    var dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) return;
    c.style.transition = 'none';
    c.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    requestAnimationFrame(function () { c.style.transition = 'transform .18s ease'; c.style.transform = ''; });
  });
}

vistaTablero.addEventListener('pointerdown', function (e) {
  var g = e.target.closest('.agarre');
  if (!g || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  var tarjetaMovida = g.closest('.ind');
  arrastre = { card: tarjetaMovida };
  tarjetaMovida.classList.add('moviendo');
  document.body.classList.add('arrastrando');
});

window.addEventListener('pointermove', function (e) {
  if (!arrastre) return;
  var movida = arrastre.card;
  movida.style.pointerEvents = 'none';
  var bajo = document.elementFromPoint(e.clientX, e.clientY);
  movida.style.pointerEvents = '';
  var objetivo = bajo && bajo.closest ? bajo.closest('.ind') : null;
  if (objetivo && objetivo !== movida && objetivo.parentNode === vistaTablero) {
    var r = objetivo.getBoundingClientRect(), m = movida.getBoundingClientRect();
    var mismaFila = Math.abs((r.top + r.height / 2) - (m.top + m.height / 2)) < Math.min(r.height, m.height) / 2;
    var antes = mismaFila ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
    var previas = posicionesActuales();
    vistaTablero.insertBefore(movida, antes ? objetivo : objetivo.nextSibling);
    animarCambio(previas);
  }
  var caja = vistaTablero.getBoundingClientRect();
  if (e.clientY < caja.top + 50) vistaTablero.scrollTop -= 14;
  else if (e.clientY > caja.bottom - 50) vistaTablero.scrollTop += 14;
});

function terminarArrastre() {
  if (!arrastre) return;
  arrastre.card.classList.remove('moviendo');
  document.body.classList.remove('arrastrando');
  PREF.orden = Array.prototype.map.call(vistaTablero.querySelectorAll('.ind, .seccion-t'), function (c) { return c.dataset.id; });
  guardarPreferencias();
  arrastre = null;
}
window.addEventListener('pointerup', terminarArrastre);
window.addEventListener('pointercancel', terminarArrastre);

vistaTablero.addEventListener('keydown', function (e) {
  var g = e.target.closest ? e.target.closest('.agarre') : null;
  if (!g) return;
  var paso = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
  if (!paso) return;
  e.preventDefault();
  var id = g.closest('.ind').dataset.id, i = PREF.orden.indexOf(id), j = i + paso;
  if (j < 0 || j >= PREF.orden.length) return;
  var previas = posicionesActuales();
  PREF.orden.splice(j, 0, PREF.orden.splice(i, 1)[0]);
  guardarPreferencias();
  pintarTablero();
  animarCambio(previas);
  var nuevo = vistaTablero.querySelector('.ind[data-id="' + id + '"] .agarre');
  if (nuevo) nuevo.focus();
});

var temporizadorAjuste = null;
function reajustarSiCambiaElAncho() {
  clearTimeout(temporizadorAjuste);
  temporizadorAjuste = setTimeout(ajustarTablas, 80);
}
if (window.ResizeObserver) new ResizeObserver(reajustarSiCambiaElAncho).observe(document.getElementById('tablero'));
else window.addEventListener('resize', reajustarSiCambiaElAncho);

// ---------- Personalizar: elegir, ordenar y configurar ----------
var dlgPersonalizar = document.getElementById('dlg-personalizar');
var filtroGrupo = '', filtroTexto = '', filtroTipo = PAGINA.soloIndicadores ? 'indicadores' : 'operacion';

function opciones(lista, actual) {
  return lista.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(actual) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
}

function filaVisible(ind, i, n) {
  var cfg = configDe(ind);
  var fila = '<li data-id="' + ind.id + '"><div class="v-cab"><span class="num">' + (i + 1) + '</span><span class="nom"><b>' + esc(ind.titulo) + '</b><small>' + esc(ind.grupo) + '</small></span>' +
    '<button type="button" data-a="subir" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" data-a="bajar" aria-label="Bajar"' + (i === n - 1 ? ' disabled' : '') + '>↓</button>' +
    '<button type="button" data-a="quitar" class="quitar" aria-label="Quitar de la pantalla">Quitar</button></div><div class="v-opc">';
  if (ind.tipo === 'operacion') {
    fila += '<label>Estilo<select data-c="estilo">' + opciones(ind.estilos, cfg.estilo) + '</select></label><label>Tamaño<select data-c="ancho">' + opciones(TAMANOS, cfg.ancho) + '</select></label>';
  } else if (ind.tipo === 'kpi') {
    fila += '<label>Estilo<select data-c="kpi">' + opciones(ESTILOS_KPI, cfg.kpi) + '</select></label><label>Tamaño<select data-c="ancho">' + opciones(TAMANOS_KPI, cfg.ancho) + '</select></label>';
  } else {
    if (ind.tipo !== 'tabla') fila += '<label>Ver como<select data-c="vista">' + opciones([['grafico', 'Gráfico'], ['tabla', 'Tabla']], cfg.vista) + '</select></label>';
    fila += '<label>Estilo<select data-c="' + (cfg.vista === 'tabla' ? 'tabla' : 'grafico') + '">' + opciones(cfg.vista === 'tabla' ? ESTILOS_TABLA : ESTILOS_GRAFICO, cfg.vista === 'tabla' ? cfg.tabla : cfg.grafico) + '</select></label>';
    fila += '<label>Tamaño<select data-c="ancho">' + opciones(TAMANOS, cfg.ancho) + '</select></label>';
  }
  return fila + '</div></li>';
}

// ¿El indicador o bloque es del grupo que se está configurando (operación o indicadores)?
function delTipoActual(id) {
  var ind = indicadorPorId(id);
  return !!ind && (ind.tipo === 'operacion') === (filtroTipo === 'operacion');
}

function pintarPersonalizar() {
  document.getElementById('p-filtros').hidden = filtroTipo === 'operacion';
  var vis = '';
  var ids = PREF.orden.filter(delTipoActual);
  ids.forEach(function (id, i) { vis += filaVisible(indicadorPorId(id), i, ids.length); });
  document.getElementById('p-visibles').innerHTML = vis || '<li class="vacio">No hay ' + (filtroTipo === 'operacion' ? 'ningún bloque de operación' : 'ningún indicador') + ' en pantalla.</li>';
  pintarDisponibles();
}

function pintarDisponibles() {
  var grupos = {}, ordenGrupos = [], disp = '';
  INDICADORES.forEach(function (ind) {
    if (PREF.orden.indexOf(ind.id) !== -1) return;
    if ((ind.tipo === 'operacion') !== (filtroTipo === 'operacion')) return;
    if (filtroGrupo && ind.grupo !== filtroGrupo) return;
    if (filtroTexto && (ind.titulo + ' ' + ind.ayuda).toLowerCase().indexOf(filtroTexto) === -1) return;
    if (!grupos[ind.grupo]) { grupos[ind.grupo] = []; ordenGrupos.push(ind.grupo); }
    grupos[ind.grupo].push(ind);
  });
  ordenGrupos.forEach(function (g) {
    disp += '<h4>' + esc(g) + '</h4>';
    grupos[g].forEach(function (ind) {
      disp += '<button type="button" class="agregar" data-a="agregar" data-id="' + ind.id + '"><span><b>' + esc(ind.titulo) + '</b><small>' + esc(ind.ayuda) + '</small></span><i>+ Agregar</i></button>';
    });
  });
  document.getElementById('p-disponibles').innerHTML = disp || '<p class="vacio">No hay indicadores que coincidan.</p>';
}

function prepararFiltros() {
  var grupos = [];
  INDICADORES.forEach(function (i) { if (i.tipo !== 'operacion' && grupos.indexOf(i.grupo) === -1) grupos.push(i.grupo); });
  document.getElementById('p-grupo').innerHTML = '<option value="">Todos los grupos</option>' + grupos.map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('');
}

function cambiarOrden() {
  guardarPreferencias();
  pintarPersonalizar();
  pintarTablero();
}

dlgPersonalizar.addEventListener('click', function (e) {
  var b = e.target.closest('[data-a]');
  if (!b) return;
  var li = b.closest('li');
  var id = li ? li.dataset.id : b.dataset.id;
  var i = PREF.orden.indexOf(id);
  if (b.dataset.a === 'subir') {
    for (var j = i - 1; j >= 0; j--) if (delTipoActual(PREF.orden[j])) { PREF.orden.splice(j, 0, PREF.orden.splice(i, 1)[0]); cambiarOrden(); break; }
  }
  if (b.dataset.a === 'bajar') {
    for (var k = i + 1; k < PREF.orden.length; k++) if (delTipoActual(PREF.orden[k])) { PREF.orden.splice(k, 0, PREF.orden.splice(i, 1)[0]); cambiarOrden(); break; }
  }
  if (b.dataset.a === 'quitar') { PREF.orden.splice(i, 1); cambiarOrden(); }
  if (b.dataset.a === 'agregar') { PREF.orden.push(id); cambiarOrden(); }
});

// Cambios de vista, estilo y tamaño de un indicador
dlgPersonalizar.addEventListener('change', function (e) {
  var s = e.target;
  if (s.dataset.c) {
    var id = s.closest('li').dataset.id;
    cambiarConfig(id, s.dataset.c, s.dataset.c === 'ancho' ? Number(s.value) : s.value);
    if (s.dataset.c === 'vista') pintarPersonalizar();
    pintarTablero();
  }
});

if (document.querySelector('.p-tipo')) document.querySelector('.p-tipo').addEventListener('click', function (e) {
  var b = e.target.closest('[data-tipo]');
  if (!b) return;
  filtroTipo = b.dataset.tipo;
  Array.prototype.forEach.call(this.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
  pintarPersonalizar();
});
document.getElementById('p-grupo').addEventListener('change', function (e) { filtroGrupo = e.target.value; pintarDisponibles(); });
document.getElementById('p-buscar').addEventListener('input', function (e) { filtroTexto = e.target.value.toLowerCase(); pintarDisponibles(); });

// Datos económicos para el punto de equilibrio y la rentabilidad
var CAMPOS_ECONOMICOS = ['costosFijos', 'turnosMes', 'horasTurno', 'metaTurno', 'inversion'];
function pintarParametros() {
  CAMPOS_ECONOMICOS.forEach(function (c) { document.getElementById('par-' + c).value = PREF.params[c] || ''; });
}
document.getElementById('p-params').addEventListener('input', function (e) {
  var campo = e.target.id.replace('par-', '');
  PREF.params[campo] = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
  guardarPreferencias();
  pintarTablero();
});

// Cambiar de vista (Reportes): se guarda la actual, se carga la otra y se avisa a la página por si la vista es suya
function seleccionarVista(clave) {
  var v = VISTAS.filter(function (x) { return x.clave === clave; })[0];
  if (!v) return;
  guardarPreferencias();
  var params = PREF.params;
  vistaActiva = v;
  CLAVE_TABLERO = PAGINA.clave + '_' + v.clave;
  ORDEN_INICIAL = v.orden || [];
  cargarPreferencias(params);
  var boton = document.getElementById('btn-personalizar');
  if (boton) boton.hidden = !!v.propia;
  vistaTablero.hidden = !!v.propia;
  if (window.alCambiarVista) window.alCambiarVista(v);
  if (!v.propia) pintarTablero();
}

var botonPersonalizar = document.getElementById('btn-personalizar'); // Mesas no lo muestra
if (botonPersonalizar) botonPersonalizar.addEventListener('click', function () { pintarPersonalizar(); pintarParametros(); dlgPersonalizar.showModal(); });
document.getElementById('p-cerrar').addEventListener('click', function () { dlgPersonalizar.close(); });
document.getElementById('p-restablecer').addEventListener('click', function () {
  PREF.orden = ORDEN_INICIAL.slice();
  PREF.config = {};
  cambiarOrden();
});

// ---------- Ventas de ejemplo para probar los indicadores ----------
var semilla = 7;
function azar() { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; }

function elegirPonderado(lista) {
  var total = 0;
  lista.forEach(function (x) { total += x[1]; });
  var punto = azar() * total;
  for (var i = 0; i < lista.length; i++) { punto -= lista[i][1]; if (punto <= 0) return lista[i][0]; }
  return lista[0][0];
}

function dos(n) { return (n < 10 ? '0' : '') + n; }

function restarMinutos(fecha, minutos) {
  var d = new Date(new Date(fecha.replace(' ', 'T')).getTime() - minutos * 60000);
  return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()) + ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes());
}

function cargarVentasEjemplo() {
  quitarVentasEjemplo();
  semilla = 7;
  var pesosProducto = [['Cerveza Club Colombia', 10], ['Michelada Club Colombia', 5], ['Coca-Cola', 4], ['Aguardiente Nariño (botella)', 2]];
  var cajeros = [['Laura Martínez', 5], ['Paola Rosero', 4], ['Carlos Ranchenatos', 2]];
  var canales = [['Mesero', 7], ['App', 3]];
  var pedidoN = 0, ventaN = 0;
  ESTADO.pedidos.forEach(function (p) { pedidoN = Math.max(pedidoN, p.n); });
  ESTADO.ventas.forEach(function (v) { ventaN = Math.max(ventaN, v.n); });
  var actual = turnoAbierto();
  var jornadas = [{ id: 101, dia: '2026-10-09', ventas: 16 }, { id: 102, dia: '2026-10-10', ventas: 22 }, { id: 103, dia: '2026-10-11', ventas: 19 }, { id: actual.id, dia: '2026-10-13', ventas: 9, abierta: true }];
  jornadas.forEach(function (j) {
    if (!j.abierta) ESTADO.turnos.unshift({ id: j.id, cajero: 'Laura Martínez', abre: j.dia + ' 18:00', cierra: j.dia + ' 23:50', base: 200000, sistema: 0, contado: 0, obs: 'Datos de ejemplo', ejemplo: true });
    for (var k = 0; k < j.ventas; k++) {
      var lineas = [], n = 1 + Math.floor(azar() * 4);
      for (var m = 0; m < n; m++) {
        var nombre = elegirPonderado(pesosProducto), prod = buscarPor(ESTADO.productos, 'nombre', nombre), cant = 1 + Math.floor(azar() * 3);
        var igual = null;
        lineas.forEach(function (l) { if (l.producto === nombre) igual = l; });
        if (igual) igual.cant += cant;
        else lineas.push({ producto: nombre, cant: nombre.indexOf('Aguardiente') === 0 ? 1 : cant, precio: prod.precio, iva: prod.iva, imp: claveImp(prod), esp: '', despacho: 'Despachado' });
      }
      var hora = 19 + Math.floor(azar() * 5), minuto = Math.floor(azar() * 60), mesa = 1 + Math.floor(azar() * 5);
      var fecha = j.dia + ' ' + dos(hora) + ':' + dos(minuto);
      var usaPromo = azar() < 0.18;
      var t = totalesDe({ lineas: lineas }, usaPromo ? 10 : 0);
      var metodo = ESTADO.metodos[Math.floor(azar() * ESTADO.metodos.length)];
      pedidoN++; ventaN++;
      ESTADO.pedidos.push({ n: pedidoN, mesa: mesa, mesero: elegirPonderado(cajeros), cliente: '—', canal: elegirPonderado(canales), fecha: restarMinutos(fecha, 35 + Math.floor(azar() * 80)), estado: 'Facturado', venta: ventaN, lineas: lineas, ejemplo: true });
      ESTADO.ventas.push({ n: ventaN, turno: j.id, pedido: pedidoN, mesa: mesa, cliente: 'Sin cliente', metodo: metodo.nombre, efectivo: !metodo.referencia, ref: '', promo: usaPromo ? ESTADO.promociones[0].nombre : '',
        subtotal: t.subtotal, descuento: t.descuento, impuesto: t.impuesto, total: t.total, fecha: fecha, cajero: elegirPonderado(cajeros), factura: azar() < 0.9 ? 'Aceptada' : 'Pendiente', ejemplo: true });
    }
  });
  var clientes = ['Camila Ortiz', 'Andrés Mora', 'Luisa Pantoja', 'Diego Burbano', 'Sofía Narváez', 'Julián Erazo'];
  var estados = [['CONFIRMADA', 5], ['PENDIENTE', 3], ['CUMPLIDA', 4], ['CANCELADA', 1], ['NO_ASISTIO', 1]];
  var reservaN = 0;
  ESTADO.reservas.forEach(function (r) { reservaN = Math.max(reservaN, r.n); });
  for (var r = 0; r < 12; r++) {
    reservaN++;
    var esEvento = azar() < 0.3;
    ESTADO.reservas.push({ n: reservaN, fecha: '2026-10-' + dos(9 + Math.floor(azar() * 12)), hora: ['19:00', '20:00', '21:00', '22:00'][Math.floor(azar() * 4)], mesa: 1 + Math.floor(azar() * 5),
      personas: 2 + Math.floor(azar() * 6), cliente: clientes[Math.floor(azar() * clientes.length)], tipo: esEvento ? 'EVENTO' : 'MESA', evento: esEvento ? ['Noche Ranchera', 'Viernes Vallenato'][Math.floor(azar() * 2)] : '',
      empleado: '', comprobante: '', obs: '', estado: elegirPonderado(estados), ejemplo: true });
  }
  if (!PREF.params.costosFijos) PREF.params = { costosFijos: 12000000, turnosMes: 26, horasTurno: 6, metaTurno: 1500000, inversion: 90000000 };
  guardar();
  guardarPreferencias();
}

function quitarVentasEjemplo() {
  ESTADO.ventas = ESTADO.ventas.filter(function (v) { return !v.ejemplo; });
  ESTADO.pedidos = ESTADO.pedidos.filter(function (p) { return !p.ejemplo; });
  ESTADO.turnos = ESTADO.turnos.filter(function (t) { return !t.ejemplo; });
  ESTADO.reservas = ESTADO.reservas.filter(function (r) { return !r.ejemplo; });
  guardar();
}

document.getElementById('p-ejemplo').addEventListener('click', function () { cargarVentasEjemplo(); pintarParametros(); pintarTablero(); toast('Se cargaron ventas y reservas de ejemplo, y datos económicos de muestra'); });
document.getElementById('p-sin-ejemplo').addEventListener('click', function () { quitarVentasEjemplo(); pintarTablero(); toast('Se quitaron los datos de ejemplo'); });

prepararFiltros();
pintarTablero();
