/* Eventos y promociones como widgets: eventos del bar, promociones (que se ofrecen al cobrar) y las notificaciones enviadas a clientes. */

var $ = function (id) { return document.getElementById(id); };
var vistaActual = 'eventos';
var estadoActual = 'todos';
var MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var VISTAS = [['eventos', 'Eventos'], ['promos', 'Promociones'], ['envios', 'Notificaciones']];
var TIPOS_PROMO = [['PORCENTAJE', 'Porcentaje de descuento'], ['NXM', 'Lleva N y paga M (2x1, 3x2)'], ['MONTO', 'Valor fijo menos por unidad'], ['PRECIO', 'Precio especial por unidad']];
var ESTADOS = {
  eventos: [['todos', 'Todos'], ['Próximo', 'Próximos'], ['En curso', 'En curso'], ['Finalizado', 'Finalizados']],
  promos: [['todos', 'Todas'], ['Activa', 'Activas'], ['Programada', 'Programadas'], ['Vencida', 'Vencidas'], ['Inactiva', 'Inactivas']],
  envios: [['todos', 'Todas'], ['Enviado', 'Enviadas'], ['Pendiente', 'Pendientes']]
};

function aviso(texto) { $('e-aviso').textContent = texto; }
function vacio(texto) { return '<div class="vacio-c"><p>' + texto + '</p></div>'; }
function fecha(iso) { var p = iso.slice(0, 10).split('-'); return Number(p[2]) + ' ' + MESES_C[Number(p[1]) - 1] + ' ' + p[0]; }
function fechaHora(s) { return fecha(s) + ' · ' + s.slice(11, 16); }
function hoy() { return ahoraTexto().slice(0, 10); }
function estadoEvento(e) {
  var ahora = ahoraTexto();
  return ahora < e.inicio ? 'Próximo' : (ahora <= e.fin ? 'En curso' : 'Finalizado');
}
function estadoPromo(p) {
  if (p.activa === false) return 'Inactiva';
  if (p.desde && hoy() < p.desde) return 'Programada';
  if (p.hasta && hoy() > p.hasta) return 'Vencida';
  return 'Activa';
}
function promosDe(nombreEvento) { return ESTADO.promociones.filter(function (p) { return p.evento === nombreEvento; }); }
function reservasDe(nombreEvento) { return ESTADO.reservas.filter(function (r) { return r.evento === nombreEvento && r.estado !== 'CANCELADA'; }); }

// ---------- Widgets ----------
function widget(clase, i, icono, cab, titulo, lineas, pie, resaltado) {
  return '<article class="widget ' + clase + (resaltado ? ' w-activa' : '') + '" data-i="' + i + '"><div class="w-cab"><img src="' + icono + '" alt=""><b>' + esc(cab).toUpperCase() + '</b></div>' +
    '<p class="w-valor">' + esc(titulo) + '</p>' + lineas.map(function (l) { return '<p class="w-sub">' + l + '</p>'; }).join('') + '<div class="w-pie"><span class="w-estado">' + esc(pie) + '</span></div></article>';
}

function widgetEvento(e) {
  var est = estadoEvento(e);
  return widget('w-evento', ESTADO.eventos.indexOf(e), 'icons/inicio/reserva.svg', est, e.nombre,
    [e.artista ? esc(e.artista) : 'Sin artista', fechaHora(e.inicio), 'Hasta ' + fechaHora(e.fin)], promosDe(e.nombre).length + ' promociones · ' + reservasDe(e.nombre).length + ' reservaciones', est === 'En curso');
}
function aQuien(p) {
  if (p.aplicaA === 'CATEGORIAS') return (p.categorias || []).join(', ') || 'Sin categorías';
  if (p.aplicaA === 'PRODUCTOS') return (p.productos || []).length + ((p.productos || []).length === 1 ? ' producto' : ' productos');
  return 'Toda la carta';
}
function cuando(p) {
  var t = [];
  if (p.dias && p.dias.length) t.push(p.dias.map(function (d) { return DIAS_SEMANA[d]; }).join(', '));
  if (p.horaDesde && p.horaHasta) t.push(p.horaDesde + ' a ' + p.horaHasta);
  if (p.soloEvento && p.evento) t.push('durante ' + p.evento);
  return t.length ? t.join(' · ') : 'Todos los días, a toda hora';
}
function segmentoDe(p) { var s = SEGMENTOS.filter(function (x) { return x[0] === (p.segmento || 'TODOS'); })[0]; return s ? s[1] : ''; }

function widgetPromo(p) {
  var est = estadoPromo(p);
  return '<article class="widget w-promo' + (est === 'Activa' ? ' w-activa' : (est === 'Programada' ? '' : ' w-gris')) + '" data-i="' + ESTADO.promociones.indexOf(p) + '"><div class="w-cab"><img src="icons/inicio/efectivo.svg" alt=""><b>' + est.toUpperCase() + '</b></div>' +
    '<p class="w-grande">' + esc(resumenPromo(p)) + '</p><p class="w-valor">' + esc(p.nombre) + '</p><p class="w-sub">' + esc(aQuien(p)) + '</p>' +
    '<p class="w-sub">' + esc(cuando(p)) + '</p><div class="w-pie"><span class="w-estado">' + esc(segmentoDe(p)) + '</span></div></article>';
}
function widgetEnvio(x, i) {
  return widget('w-envio', i, 'icons/inicio/listo.svg', x.tipo, x.cliente,
    [esc(x.canal) + ' · ' + fechaHora(x.fecha), x.promocion ? esc(x.promocion) : (x.evento ? esc(x.evento) : ''), x.reserva ? esc(x.reserva) : ''].filter(Boolean), x.estado, x.estado === 'Pendiente');
}

function pintar() {
  $('e-vistas').innerHTML = VISTAS.map(function (v) { return '<button type="button" class="chip-filtro" data-v="' + v[0] + '" aria-pressed="' + (vistaActual === v[0]) + '">' + v[1] + '</button>'; }).join('');
  $('e-estados').innerHTML = ESTADOS[vistaActual].map(function (e) { return '<button type="button" class="seg" data-v="' + e[0] + '" aria-pressed="' + (estadoActual === e[0]) + '">' + e[1] + '</button>'; }).join('');
  var texto = $('e-buscar').value.trim().toLowerCase();
  var coincide = function (s) { return !texto || s.toLowerCase().indexOf(texto) !== -1; };
  var h = '';
  if (vistaActual === 'eventos') {
    var ev = ESTADO.eventos.filter(function (e) { return (estadoActual === 'todos' || estadoEvento(e) === estadoActual) && coincide(e.nombre + ' ' + e.artista); }).sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
    h = ev.length ? '<div class="widgets">' + ev.map(widgetEvento).join('') + '</div>' : vacio(ESTADO.eventos.length ? 'Ningún evento coincide con estos filtros.' : 'Todavía no hay eventos. Crea el primero con "Nuevo evento".');
  } else if (vistaActual === 'promos') {
    var pr = ESTADO.promociones.filter(function (p) { return (estadoActual === 'todos' || estadoPromo(p) === estadoActual) && coincide(p.nombre + ' ' + (p.evento || '')); });
    h = pr.length ? '<div class="widgets">' + pr.map(widgetPromo).join('') + '</div>' : vacio(ESTADO.promociones.length ? 'Ninguna promoción coincide con estos filtros.' : 'Todavía no hay promociones. Crea la primera con "Nueva promoción".');
  } else {
    var en = ESTADO.envios.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return (estadoActual === 'todos' || o.x.estado === estadoActual) && coincide(o.x.cliente + ' ' + o.x.evento + ' ' + o.x.promocion); })
      .sort(function (a, b) { return a.x.fecha < b.x.fecha ? 1 : -1; });
    h = en.length ? '<div class="widgets">' + en.map(function (o) { return widgetEnvio(o.x, o.i); }).join('') + '</div>' : vacio('No hay notificaciones con estos filtros.');
  }
  $('e-lista').innerHTML = h;
}

$('e-vistas').addEventListener('click', function (e) { var b = e.target.closest('.chip-filtro'); if (b) { vistaActual = b.dataset.v; estadoActual = 'todos'; pintar(); } });
$('e-estados').addEventListener('click', function (e) { var b = e.target.closest('.seg'); if (b) { estadoActual = b.dataset.v; pintar(); } });
$('e-buscar').addEventListener('input', pintar);
$('e-lista').addEventListener('click', function (e) {
  var w = e.target.closest('.widget');
  if (!w) return;
  var i = Number(w.dataset.i);
  if (w.classList.contains('w-evento')) verEvento(ESTADO.eventos[i]);
  else if (w.classList.contains('w-promo')) verPromo(ESTADO.promociones[i]);
  else if (w.classList.contains('w-envio')) verEnvio(i);
});

// ---------- Detalles ----------
function dato(t, v) { return '<div><dt>' + t + '</dt><dd>' + v + '</dd></div>'; }

function verEvento(e) {
  var promos = promosDe(e.nombre), reservas = reservasDe(e.nombre);
  abrirVentana({ titulo: e.nombre, ancha: true, ayuda: e.descripcion ? esc(e.descripcion) : '',
    cuerpo: '<dl class="tk-datos">' + dato('Artista', e.artista ? esc(e.artista) : '—') + dato('Inicio', fechaHora(e.inicio)) + dato('Fin', fechaHora(e.fin)) + dato('Estado', estadoEvento(e)) + dato('Reservaciones', reservas.length) + '</dl>' +
      '<div><h3 class="tk-sub">Promociones del evento</h3>' + (promos.length ? '<ul class="tk-intentos">' + promos.map(function (p) { return '<li><span>' + p.pct + ' %</span><span>' + esc(p.nombre) + ' · ' + estadoPromo(p) + '</span></li>'; }).join('') + '</ul>' : '<p class="sin-pasos">Todavía no tiene promociones.</p>') + '</div>',
    botones: [
      { texto: 'Editar evento', primario: true, alClic: function (d) { d.close(); formularioEvento(e); } },
      { texto: 'Nueva promoción', alClic: function (d) { d.close(); formularioPromo(null, e.nombre); } },
      { texto: 'Eliminar evento', alClic: function (d) { d.close(); eliminarEvento(e); } }] });
}

function verPromo(p) {
  var est = estadoPromo(p);
  var cond = [['Qué descuenta', esc(resumenPromo(p)) + ' · ' + esc(TIPOS_PROMO.filter(function (t) { return t[0] === (p.tipo || 'PORCENTAJE'); })[0][1])], ['Productos', esc(aQuien(p))], ['Días y horas', esc(cuando(p))],
    ['Vigencia', p.desde && p.hasta ? fecha(p.desde) + ' al ' + fecha(p.hasta) : 'Sin fechas'], ['Clientes', esc(segmentoDe(p))], ['Cuenta mínima', p.minCompra ? pesos(p.minCompra) : 'Sin mínimo'],
    ['Tope por cuenta', p.tope ? p.tope + ' unidades' : 'Sin tope'], ['Evento', p.evento ? esc(p.evento) : 'Ninguno']];
  abrirVentana({ titulo: p.nombre, ancha: true, ayuda: p.condiciones ? esc(p.condiciones) : '',
    cuerpo: '<dl class="tk-datos">' + dato('Estado', est) + cond.map(function (c) { return dato(c[0], c[1]); }).join('') + '</dl>' +
      '<p class="sin-pasos">En la ventana de cobro solo se ofrece cuando aplica: si la cuenta tiene sus productos, es el día y la hora, y el cliente es del tipo indicado. El descuento solo toca esos productos y el impuesto se calcula sobre lo que realmente se cobra.</p>',
    botones: [
      { texto: 'Editar promoción', primario: true, alClic: function (d) { d.close(); formularioPromo(p); } },
      { texto: p.activa === false ? 'Activar' : 'Desactivar', alClic: function (d) { d.close(); p.activa = p.activa === false; guardar(); aviso(p.nombre + (p.activa ? ' vuelve a ofrecerse al cobrar.' : ' ya no se ofrece al cobrar.')); pintar(); } },
      { texto: 'Eliminar promoción', alClic: function (d) { d.close(); eliminarPromo(p); } }] });
}

function verEnvio(i) {
  var x = ESTADO.envios[i];
  abrirVentana({ titulo: x.tipo + ' · ' + x.cliente, ancha: true,
    cuerpo: '<dl class="tk-datos">' + dato('Canal', esc(x.canal)) + dato('Fecha', fechaHora(x.fecha)) + dato('Estado', esc(x.estado)) + dato('Promoción', x.promocion ? esc(x.promocion) : '—') + dato('Evento', x.evento ? esc(x.evento) : '—') + dato('Reserva', x.reserva ? esc(x.reserva) : '—') + '</dl>',
    botones: x.estado === 'Pendiente' ? [{ texto: 'Marcar como enviada', primario: true, alClic: function (d) { d.close(); x.estado = 'Enviado'; x.fecha = ahoraTexto(); guardar(); aviso('Notificación marcada como enviada a ' + x.cliente + '.'); pintar(); } }] : [] });
}

// ---------- Crear, editar y eliminar ----------
function formularioEvento(e) {
  var nuevo = !e;
  abrirFormulario({ titulo: nuevo ? 'Nuevo evento' : 'Editar evento', boton: 'Guardar', ancha: true,
    campos: [
      { id: 'nombre', etiqueta: 'Nombre', tipo: 'text', valor: nuevo ? '' : e.nombre, requerido: true, largo: 80 },
      { id: 'artista', etiqueta: 'Artista', tipo: 'text', valor: nuevo ? '' : e.artista, largo: 80 },
      { id: 'inicio', etiqueta: 'Inicio', tipo: 'datetime-local', valor: nuevo ? '' : e.inicio.replace(' ', 'T'), requerido: true },
      { id: 'fin', etiqueta: 'Fin', tipo: 'datetime-local', valor: nuevo ? '' : e.fin.replace(' ', 'T'), requerido: true },
      { id: 'descripcion', etiqueta: 'Descripción', tipo: 'text', valor: nuevo ? '' : e.descripcion, largo: 255, ancho: true }],
    alGuardar: function (v) {
      if (v.fin <= v.inicio) return 'El fin debe ser después del inicio.';
      if (ESTADO.eventos.some(function (x) { return x !== e && x.nombre.toLowerCase() === v.nombre.toLowerCase(); })) return 'Ya existe un evento con ese nombre.';
      var datos = { nombre: v.nombre, artista: v.artista, inicio: v.inicio.replace('T', ' '), fin: v.fin.replace('T', ' '), descripcion: v.descripcion };
      if (nuevo) { e = datos; ESTADO.eventos.push(e); }
      else {
        if (e.nombre !== v.nombre) {
          var viejo = e.nombre;
          ESTADO.promociones.forEach(function (p) { if (p.evento === viejo) p.evento = v.nombre; });
          ESTADO.reservas.forEach(function (r) { if (r.evento === viejo) r.evento = v.nombre; });
          ESTADO.envios.forEach(function (x) { if (x.evento === viejo) x.evento = v.nombre; });
        }
        Object.assign(e, datos);
      }
      guardar();
      aviso((nuevo ? 'Evento creado: ' : 'Evento guardado: ') + e.nombre + '.');
      vistaActual = 'eventos'; pintar();
    } });
}

function formularioPromo(p, evento) {
  var nuevo = !p;
  var v0 = p || { tipo: 'PORCENTAJE', pct: '', lleva: 2, paga: 1, monto: '', precioEspecial: '', aplicaA: 'TODO', categorias: [], productos: [], dias: [], horaDesde: '', horaHasta: '', segmento: 'TODOS', minCompra: '', tope: '', condiciones: '', activa: true, evento: evento || '', soloEvento: false, desde: hoy(), hasta: '', nombre: '' };
  var cats = []; ESTADO.productos.forEach(function (x) { if (cats.indexOf(x.cat) === -1) cats.push(x.cat); });
  var dlg = abrirFormulario({ titulo: nuevo ? 'Nueva promoción' : 'Editar promoción', boton: 'Guardar', ancha: true,
    ayuda: 'Define qué descuenta, a qué productos, cuándo y a qué clientes. Al cobrar solo se ofrece si todo se cumple.',
    campos: [
      { id: 'nombre', etiqueta: 'Nombre', tipo: 'text', valor: v0.nombre, requerido: true, largo: 80, ancho: true },
      { id: 'tipo', etiqueta: 'Qué descuenta', tipo: 'select', opciones: TIPOS_PROMO, valor: v0.tipo || 'PORCENTAJE', ancho: true },
      { id: 'pct', etiqueta: 'Descuento (%)', tipo: 'number', valor: v0.pct, min: 1, max: 100, step: 1 },
      { id: 'lleva', etiqueta: 'Lleva (unidades)', tipo: 'number', valor: v0.lleva || 2, min: 2, step: 1 },
      { id: 'paga', etiqueta: 'Paga (unidades)', tipo: 'number', valor: v0.paga || 1, min: 1, step: 1 },
      { id: 'monto', etiqueta: 'Menos por unidad ($)', tipo: 'number', valor: v0.monto, min: 1, step: 100 },
      { id: 'precioEspecial', etiqueta: 'Precio especial por unidad ($)', tipo: 'number', valor: v0.precioEspecial, min: 0, step: 100 },
      { id: 'aplicaA', etiqueta: 'A qué productos', tipo: 'chips', opciones: [['TODO', 'Toda la carta'], ['CATEGORIAS', 'Categorías'], ['PRODUCTOS', 'Productos']], valor: v0.aplicaA || 'TODO', ancho: true },
      { id: 'categorias', etiqueta: 'Categorías incluidas', tipo: 'multi', opciones: cats.map(function (c) { return [c, c]; }), valor: v0.categorias || [], ancho: true },
      { id: 'productos', etiqueta: 'Productos incluidos', tipo: 'multi', buscar: true, opciones: ESTADO.productos.map(function (x) { return [x.nombre, x.nombre]; }), valor: v0.productos || [], ancho: true },
      { id: 'dias', etiqueta: 'Días de la semana (sin marcar = todos)', tipo: 'multi', opciones: [1, 2, 3, 4, 5, 6, 0].map(function (d) { return [String(d), DIAS_SEMANA[d]]; }), valor: (v0.dias || []).map(String), ancho: true },
      { id: 'horaDesde', etiqueta: 'Desde la hora', tipo: 'time', valor: v0.horaDesde || '', ayuda: 'Déjalo vacío para todo el día.' },
      { id: 'horaHasta', etiqueta: 'Hasta la hora', tipo: 'time', valor: v0.horaHasta || '' },
      { id: 'desde', etiqueta: 'Vigente desde', tipo: 'date', valor: v0.desde || '', requerido: true },
      { id: 'hasta', etiqueta: 'Vigente hasta', tipo: 'date', valor: v0.hasta || '', requerido: true },
      { id: 'segmento', etiqueta: 'A qué clientes', tipo: 'select', opciones: SEGMENTOS, valor: v0.segmento || 'TODOS', ancho: true },
      { id: 'minCompra', etiqueta: 'Cuenta mínima ($)', tipo: 'number', valor: v0.minCompra || '', min: 0, step: 1000, ayuda: 'Vacío = sin mínimo.' },
      { id: 'tope', etiqueta: 'Máximo de unidades con descuento por cuenta', tipo: 'number', valor: v0.tope || '', min: 0, step: 1, ayuda: 'Vacío = sin tope.' },
      { id: 'evento', etiqueta: 'Evento asociado', tipo: 'select', opciones: [['', 'Ninguno']].concat(ESTADO.eventos.map(function (x) { return [x.nombre, x.nombre]; })), valor: v0.evento || '' },
      { id: 'soloEvento', etiqueta: 'Solo mientras dura el evento', tipo: 'check', valor: !!v0.soloEvento },
      { id: 'condiciones', etiqueta: 'Condiciones (texto para el cliente)', tipo: 'text', valor: v0.condiciones || '', largo: 255, ancho: true },
      { id: 'activa', etiqueta: 'Activa (se ofrece al cobrar)', tipo: 'check', valor: v0.activa !== false, ancho: true }],
    alCambiar: function (v, d) {
      var ver = function (id, si) { var c = d.querySelector('[data-campo="' + id + '"]'); if (c) c.hidden = !si; };
      ver('pct', v.tipo === 'PORCENTAJE'); ver('lleva', v.tipo === 'NXM'); ver('paga', v.tipo === 'NXM'); ver('monto', v.tipo === 'MONTO'); ver('precioEspecial', v.tipo === 'PRECIO');
      ver('categorias', v.aplicaA === 'CATEGORIAS'); ver('productos', v.aplicaA === 'PRODUCTOS'); ver('soloEvento', v.evento !== '');
    },
    alGuardar: function (v) {
      if (v.hasta < v.desde) return 'La vigencia no puede terminar antes de empezar.';
      if (v.tipo === 'PORCENTAJE' && !(v.pct >= 1 && v.pct <= 100)) return 'Escribe el porcentaje de descuento (de 1 a 100).';
      if (v.tipo === 'NXM' && !(v.lleva >= 2 && v.paga >= 1 && v.paga < v.lleva)) return 'En "lleva y paga", lo que paga debe ser menos de lo que lleva (por ejemplo lleva 2, paga 1).';
      if (v.tipo === 'MONTO' && !(v.monto > 0)) return 'Escribe cuánto se descuenta por unidad.';
      if (v.tipo === 'PRECIO' && v.precioEspecial === '') return 'Escribe el precio especial por unidad.';
      if (v.aplicaA === 'CATEGORIAS' && !v.categorias.length) return 'Marca al menos una categoría.';
      if (v.aplicaA === 'PRODUCTOS' && !v.productos.length) return 'Marca al menos un producto.';
      if ((v.horaDesde === '') !== (v.horaHasta === '')) return 'Escribe la hora de inicio y la de fin, o deja las dos vacías.';
      if (ESTADO.promociones.some(function (x) { return x !== p && x.nombre.toLowerCase() === v.nombre.toLowerCase(); })) return 'Ya existe una promoción con ese nombre.';
      var datos = { nombre: v.nombre, tipo: v.tipo, pct: Number(v.pct) || 0, lleva: Number(v.lleva) || 2, paga: Number(v.paga) || 1, monto: Number(v.monto) || 0, precioEspecial: Number(v.precioEspecial) || 0,
        aplicaA: v.aplicaA, categorias: v.aplicaA === 'CATEGORIAS' ? v.categorias : [], productos: v.aplicaA === 'PRODUCTOS' ? v.productos : [], dias: v.dias.map(Number), horaDesde: v.horaDesde, horaHasta: v.horaHasta,
        desde: v.desde, hasta: v.hasta, segmento: v.segmento, minCompra: Number(v.minCompra) || 0, tope: Number(v.tope) || 0, evento: v.evento, soloEvento: v.evento !== '' && v.soloEvento, condiciones: v.condiciones, activa: v.activa };
      if (nuevo) { p = datos; ESTADO.promociones.push(p); } else Object.assign(p, datos);
      guardar();
      aviso((nuevo ? 'Promoción creada: ' : 'Promoción guardada: ') + p.nombre + '.');
      vistaActual = 'promos'; pintar();
    } });
}

function eliminarEvento(e) {
  var n = promosDe(e.nombre).length;
  confirmarVentana({ titulo: 'Eliminar evento', texto: '¿Eliminar <b>' + esc(e.nombre) + '</b>?' + (n ? ' Sus ' + n + ' promociones quedan sin evento.' : '') + ' Las reservaciones anteriores conservan el nombre.', boton: 'Eliminar',
    alAceptar: function () {
      ESTADO.promociones.forEach(function (p) { if (p.evento === e.nombre) p.evento = ''; });
      ESTADO.eventos.splice(ESTADO.eventos.indexOf(e), 1);
      guardar(); aviso('Evento eliminado.'); pintar();
    } });
}

function eliminarPromo(p) {
  confirmarVentana({ titulo: 'Eliminar promoción', texto: '¿Eliminar <b>' + esc(p.nombre) + '</b>? Las ventas anteriores conservan su nombre.', boton: 'Eliminar',
    alAceptar: function () { ESTADO.promociones.splice(ESTADO.promociones.indexOf(p), 1); guardar(); aviso('Promoción eliminada.'); pintar(); } });
}

$('e-nuevo-evento').addEventListener('click', function () { formularioEvento(null); });
$('e-nueva-promo').addEventListener('click', function () { formularioPromo(null); });
pintar();
