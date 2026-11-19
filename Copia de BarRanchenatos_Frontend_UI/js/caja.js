/* Caja: cobrar, tickets, caja menor y turno. Las categorías se registran con registrarVista();
   Facturación, Métodos de pago y Datos de facturación viven en caja-facturacion.js.
   Usa los datos de datos.js: lo que se cobra aquí o en Pedidos aparece en las dos. */

var $ = function (id) { return document.getElementById(id); };
var MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
var CUANDO = [['turno', 'Este turno'], ['hoy', 'Hoy'], ['todos', 'Todos']];
var DENOMINACIONES = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

var VISTAS = [];   // { clave, titulo, orden, pintor, contador }
var ACCIONES = {}; // data-ca="nombre" en un botón o tarjeta llama a ACCIONES.nombre(elemento)
var vista = 'cobrar';
var cuando = 'turno';

function registrarVista(v) { VISTAS.push(v); VISTAS.sort(function (a, b) { return a.orden - b.orden; }); }
function aviso(texto) { $('c-aviso').textContent = texto; }
function diaLargo(texto) { return Number(texto.slice(8, 10)) + ' de ' + MESES_LARGO[Number(texto.slice(5, 7)) - 1]; }
function ventaPor(n) { return buscarPor(ESTADO.ventas, 'n', n); }
function nombreCliente(p) { return p.cliente === '—' ? 'Sin cliente' : p.cliente; }
function vacio(texto, boton) { return '<div class="vacio-c"><p>' + texto + '</p>' + (boton || '') + '</div>'; }
function barraInfo(texto, botones) { return '<div class="barra-c"><p>' + texto + '</p><span class="barra-botones">' + (botones || '') + '</span></div>'; }
function boton(accion, texto, extra, clase) { return '<button type="button" class="btn ' + (clase || '') + '" data-ca="' + accion + '"' + (extra || '') + '>' + texto + '</button>'; }
function btnFila(accion, texto, dato, ppal) { return '<button type="button" class="btn-fila' + (ppal ? ' btn-fila-ppal' : '') + '" data-ca="' + accion + '"' + (dato !== undefined ? ' data-d="' + dato + '"' : '') + '>' + texto + '</button>'; }
function copiar(texto, mensaje) {
  var listo = function () { aviso(mensaje); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(listo, listo); else listo();
}

// Ventana de impresión con el estilo básico de un comprobante
function imprimirHtml(titulo, cuerpo) {
  var w = window.open('', '_blank');
  if (!w) { aviso('El navegador bloqueó la ventana de impresión: permítela e inténtalo de nuevo.'); return; }
  w.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>' + esc(titulo) + '</title><style>body{font:13px/1.45 Inter,Arial,sans-serif;max-width:380px;margin:1rem auto;color:#121E42}h1{font-size:16px;text-align:center;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:1rem 0 .3rem;border-bottom:1px dashed #121E42}p{margin:.15rem 0}.c{text-align:center}.f{display:flex;justify-content:space-between;gap:1rem}.g{font-weight:700;font-size:15px;border-top:1px dashed #121E42;margin-top:.4rem;padding-top:.3rem}.m{font-size:10px;word-break:break-all;color:#555}</style></head><body>' + cuerpo + '</body></html>');
  w.document.close();
  w.focus();
  setTimeout(function () { w.print(); }, 300);
}
function filaImp(a, b, clase) { return '<div class="f' + (clase ? ' ' + clase : '') + '"><span>' + a + '</span><span>' + b + '</span></div>'; }

// ---------- Categorías ----------
function chip(grupo, valor, texto, activo) {
  return '<button type="button" class="chip-filtro chip-cat" data-g="' + grupo + '" data-v="' + valor + '" aria-pressed="' + activo + '">' + esc(texto) + '</button>';
}

function visibles() { return VISTAS.filter(function (v) { return !v.visible || v.visible(); }); }

function pintarCategorias() {
  $('c-cats').innerHTML = visibles().map(function (v) {
    var n = v.contador ? v.contador() : 0;
    return chip('ver', v.clave, v.titulo + (n ? ' (' + n + ')' : ''), vista === v.clave);
  }).join('');
  var f = vistaActual().filtros;
  $('c-sub').hidden = !f;
  if (f) $('c-sub').innerHTML = f();
  var t = turnoAbierto();
  $('c-estado-caja').textContent = t ? 'Caja abierta desde las ' + t.abre.slice(11) : 'Caja cerrada';
}

function vistaActual() { return visibles().filter(function (x) { return x.clave === vista; })[0] || visibles()[0]; }

function pintarTodo() {
  pintarCategorias();
  $('c-lista').innerHTML = vistaActual().pintor();
}

function irA(clave) {
  vista = clave;
  aviso('');
  try { history.replaceState(null, '', 'caja.html?ver=' + vista); } catch (x) { /* abierto desde un archivo */ }
  pintarTodo();
}

$('c-cats').addEventListener('click', function (e) { var b = e.target.closest('.chip-filtro'); if (b) irA(b.dataset.v); });
$('c-sub').addEventListener('click', function (e) { var b = e.target.closest('.chip-filtro'); if (b) { vistaActual().alFiltrar(b.dataset.g, b.dataset.v); pintarTodo(); } });
$('c-estado-caja').addEventListener('click', function () { irA('turno'); });
$('c-lista').addEventListener('click', function (e) {
  var el = e.target.closest('[data-ca]');
  if (el && ACCIONES[el.dataset.ca]) ACCIONES[el.dataset.ca](el);
});

// ---------- Por cobrar ----------
function motivoSinCobrar(p) {
  if (!turnoAbierto()) return 'Abre la caja para cobrar';
  if (!p.lineas.length) return 'Todavía no tiene productos';
  if (contarLineas(p, 'Por confirmar') > 0) return 'Sin confirmar';
  if (contarLineas(p, 'Pendiente') > 0) return 'Faltan productos por despachar';
  return '';
}

// Azul: ya cobrado. Gris: pendiente de cobro. Blanco: pedido por confirmar.
function vistaCobrar() {
  var lista = pedidosEnCurso();
  var turno = turnoAbierto();
  var cobradas = turno ? ventasDelTurno(turno).filter(function (v) { return !v.anulada; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }) : [];
  var cerrada = turno ? '' : barraInfo('La caja está cerrada: ábrela en Turno para poder cobrar.', boton('abrir-caja', 'Abrir caja'));
  if (!lista.length && !cobradas.length) return cerrada + vacio('No hay cuentas por cobrar.', '<a class="btn" href="pedidos.html">Ir a Pedidos</a>');
  var h = cerrada + '<div class="widgets">';
  lista.forEach(function (p) {
    var motivo = motivoSinCobrar(p), sinConfirmar = contarLineas(p, 'Por confirmar') > 0;
    var listos = contarLineas(p, 'Despachado');
    h += '<article class="widget w-cuenta' + (sinConfirmar ? '' : ' w-gris') + '">' +
      '<div class="w-cab"><img src="icons/inicio/mesa_ocupada.svg" alt=""><b>MESA ' + p.mesa + '</b></div>' +
      '<p class="w-valor">' + pesos(totalesDe(p, 0).total) + '</p>' +
      '<p class="w-sub">Pedido ' + p.n + ' · ' + esc(nombreCliente(p)) + '</p>' +
      '<p class="w-sub">' + listos + ' de ' + p.lineas.length + (p.lineas.length === 1 ? ' producto listo' : ' productos listos') + '</p>' +
      '<div class="w-pie">' + (motivo ? '<span class="w-sub motivo">' + motivo + '</span><a class="btn-fila" href="pedidos.html?mesa=' + p.mesa + '">Ir al pedido</a>' : btnFila('cobrar', 'Cobrar', p.n, true)) + '</div></article>';
  });
  cobradas.forEach(function (v) {
    h += '<article class="widget w-cuenta w-activa" data-ca="ticket" data-d="' + v.n + '">' +
      '<div class="w-cab"><img src="icons/inicio/mesa_ocupada.svg" alt=""><b>MESA ' + v.mesa + '</b></div>' +
      '<p class="w-valor">' + pesos(v.total + (v.propina || 0)) + '</p>' +
      '<p class="w-sub">' + esc(v.cliente) + ' · ' + esc(v.metodo) + '</p>' +
      '<div class="w-pie"><span class="w-estado">Cobrado a las ' + v.fecha.slice(11) + '</span></div></article>';
  });
  return h + '</div>';
}

ACCIONES.cobrar = function (el) {
  var p = buscarPor(ESTADO.pedidos, 'n', Number(el.dataset.d));
  if (p && !motivoSinCobrar(p)) abrirCobro(p, function (venta, mensaje) { aviso(mensaje); pintarTodo(); });
};

// ---------- Comprobantes de pago ----------
function pasaCuando(v) {
  if (cuando === 'turno') return v.turno === idTurnoActual();
  if (cuando === 'hoy') return v.fecha.slice(0, 10) === ahoraTexto().slice(0, 10);
  return true;
}

function etiquetaComprobante(v) {
  if (v.anulada) return 'Anulada';
  if (!v.documento) return 'Comprobante de pago';
  var d = documentoDe(v.documento);
  return (d ? NOMBRE_COMPROBANTE[d.tipo] + ' ' + d.id : 'Documento') + (d && d.estado !== 'Aceptado' ? ' · ' + d.estado.toLowerCase() : '');
}

function widgetVenta(v) {
  var d = v.documento ? documentoDe(v.documento) : null;
  var clase = v.anulada ? ' w-apagada' : (d && d.estado !== 'Aceptado' ? ' w-punteada' : '');
  return '<article class="widget w-venta' + clase + '" data-ca="ticket" data-d="' + v.n + '">' +
    '<div class="w-cab"><img src="icons/inicio/factura.svg" alt=""><b>COMPROBANTE ' + v.n + '</b></div>' +
    '<p class="w-valor">' + pesos(v.total + (v.propina || 0)) + '</p>' +
    '<p class="w-sub">' + esc(v.cliente) + ' · Mesa ' + v.mesa + '</p>' +
    '<p class="w-sub">' + esc(v.metodo) + ' · ' + v.fecha.slice(11) + '</p>' +
    '<div class="w-pie"><span class="w-estado">' + etiquetaComprobante(v) + '</span></div></article>';
}

function vistaTickets() {
  var lista = ESTADO.ventas.filter(pasaCuando).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
  if (!lista.length) return vacio('No hay comprobantes ' + (cuando === 'turno' ? 'en este turno' : cuando === 'hoy' ? 'de hoy' : 'registrados') + '.');
  var h = '', dia = '', abierto = false;
  lista.forEach(function (v) {
    if (v.fecha.slice(0, 10) !== dia) {
      dia = v.fecha.slice(0, 10);
      if (abierto) h += '</div>';
      h += '<h3 class="grupo-w">' + diaLargo(dia) + '</h3><div class="widgets">';
      abierto = true;
    }
    h += widgetVenta(v);
  });
  return h + '</div>';
}

function textoTicket(v) {
  var p = buscarPor(ESTADO.pedidos, 'n', v.pedido);
  var t = ESTADO.facturacion.emisor.nombreComercial + ' · Comprobante de pago N° ' + v.n + '\n' + v.fecha + ' · Mesa ' + v.mesa + ' · ' + v.cliente + '\n';
  if (p) p.lineas.forEach(function (l) { t += l.cant + ' x ' + l.producto + '  ' + pesos(l.cant * l.precio) + '\n'; });
  t += 'Subtotal ' + pesos(v.subtotal) + (v.descuento ? '\nDescuento -' + pesos(v.descuento) : '') + '\nImpuesto ' + pesos(v.impuesto) + (v.propina ? '\nPropina ' + pesos(v.propina) : '') + '\nTOTAL ' + pesos(v.total + (v.propina || 0)) + '\nPago: ' + v.metodo + (v.ref ? ' (' + v.ref + ')' : '');
  return t;
}

var ventaAbierta = 0;
function ticketHtml(v) {
  var d = v.documento ? documentoDe(v.documento) : null;
  var puede = comprobantesPermitidos()[0] !== 'TICKET';
  var acciones = '';
  if (!v.anulada && !d && puede) acciones += '<button type="button" class="btn btn-primary" data-tk="facturar">Generar factura o documento</button>';
  if (d) acciones += '<button type="button" class="btn btn-primary" data-tk="documento">Ver ' + NOMBRE_COMPROBANTE[d.tipo].toLowerCase() + ' ' + d.id + '</button>';
  acciones += '<button type="button" class="btn' + (acciones ? '' : ' btn-primary') + '" data-tk="imprimir">Imprimir</button><button type="button" class="btn" data-tk="copiar">Copiar comprobante</button>';
  if (!v.anulada && !d) acciones += '<button type="button" class="btn btn-peligro" data-tk="anular">Anular venta</button>';
  var nota = !d && !puede ? '<p class="tk-nota">Es un comprobante de pago, no una factura. Para emitir factura electrónica o documento equivalente configura la DIAN en Datos de facturación.</p>' : '';
  var dato = function (t, x) { return '<div><dt>' + t + '</dt><dd>' + x + '</dd></div>'; };
  return '<div class="tk"><header class="tk-cab"><h2>' + (d ? 'Venta N° ' : 'Comprobante de pago N° ') + v.n + '</h2><p>' + diaLargo(v.fecha) + ', ' + v.fecha.slice(11) + ' · Mesa ' + v.mesa + ' · ' + esc(v.cliente) + '</p>' + (v.anulada ? '<span class="est-res"><i class="pt canc"></i>Anulada: ' + esc(v.anulada.motivo) + '</span>' : '') + '</header>' +
    '<div class="tk-cols"><section class="tk-papel"><div class="ticket-58">' + htmlTicket(v, d) + '</div></section>' +
    '<section class="tk-lado"><dl class="tk-datos tk-resumen"><div class="tk-gran"><dt>Total pagado</dt><dd>' + pesos(v.total + (v.propina || 0)) + '</dd></div>' + dato('Método de pago', esc(v.metodo)) + (v.ref ? dato('Referencia', esc(v.ref)) : '') +
    (v.promo ? dato('Promoción', esc(v.promo)) : '') + dato('Atendió', esc(v.cajero)) + dato('Comprobante', etiquetaComprobante(v)) + '</dl>' + nota +
    '<div class="tk-botones">' + acciones + '</div></section></div></div>';
}

function abrirTicket(n) {
  ventaAbierta = n;
  $('t-cuerpo').innerHTML = ticketHtml(ventaPor(n));
  if (!$('dlg-ticket').open) $('dlg-ticket').showModal();
}
ACCIONES.ticket = function (el) { abrirTicket(Number(el.dataset.d)); };

$('dlg-ticket').addEventListener('click', function (e) {
  if (e.target === $('dlg-ticket')) { $('dlg-ticket').close(); return; }
  var b = e.target.closest('[data-tk]');
  if (!b) return;
  var v = ventaPor(ventaAbierta);
  var accion = b.dataset.tk;
  if (accion === 'copiar') { copiar(textoTicket(v), 'Comprobante ' + v.n + ' copiado: pégalo donde se lo envíes al cliente.'); $('dlg-ticket').close(); }
  if (accion === 'imprimir') imprimirTicket(v, v.documento ? documentoDe(v.documento) : null);
  if (accion === 'documento') { $('dlg-ticket').close(); verDocumento(v.documento); }
  if (accion === 'facturar') { $('dlg-ticket').close(); formularioFacturar(v); }
  if (accion === 'anular') { $('dlg-ticket').close(); anularVenta(v); }
});
$('t-cerrar').addEventListener('click', function () { $('dlg-ticket').close(); });

function anularVenta(v) {
  abrirFormulario({ titulo: 'Anular venta ' + v.n, ayuda: 'La venta deja de contar en la caja y en los reportes. Queda registrada con su motivo.', boton: 'Anular venta',
    campos: [{ id: 'motivo', etiqueta: 'Motivo', tipo: 'text', requerido: true, largo: 120, ancho: true, placeholder: 'Error de digitación, el cliente no pagó…' }],
    alGuardar: function (val) {
      v.anulada = { fecha: ahoraTexto(), motivo: val.motivo, quien: usuarioActual() };
      guardar();
      aviso('Venta ' + v.n + ' anulada.');
      pintarTodo();
    } });
}

// ---------- Caja menor: dinero que entra o sale del cajón fuera de las ventas ----------
var TIPOS_MOV = [['EGRESO', 'Gasto o pago'], ['RETIRO', 'Retiro de efectivo'], ['INGRESO', 'Ingreso de efectivo']];
var CONCEPTOS_MOV = { EGRESO: ['Compra de insumos', 'Pago a proveedor', 'Pago de servicios', 'Propinas entregadas', 'Otro gasto'], RETIRO: ['Retiro a caja fuerte', 'Consignación al banco'], INGRESO: ['Base adicional', 'Otro ingreso'] };

function vistaMovimientos() {
  var t = turnoAbierto();
  var h = barraInfo(t ? 'Gastos, retiros e ingresos de efectivo fuera de las ventas. Cuentan para el efectivo que debe haber en el cajón.' : 'Abre la caja para registrar movimientos.', t ? boton('mov-nuevo', '+ Registrar movimiento', '', 'btn-primary') : '');
  var lista = ESTADO.movimientosCaja.filter(function (m) { return !t || m.turno === t.id; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
  if (!lista.length) return h + vacio('No hay movimientos de caja menor ' + (t ? 'en este turno' : 'registrados') + '.');
  h += '<div class="widgets">';
  lista.forEach(function (m) {
    h += '<article class="widget w-mov' + (m.tipo === 'INGRESO' ? '' : ' w-gris') + '"><div class="w-cab"><img src="icons/inicio/efectivo.svg" alt=""><b>' + esc(m.concepto).toUpperCase() + '</b></div>' +
      '<p class="w-valor">' + (m.tipo === 'INGRESO' ? '+ ' : '− ') + pesos(m.valor) + '</p><p class="w-sub">' + esc(m.detalle || TIPOS_MOV.filter(function (x) { return x[0] === m.tipo; })[0][1]) + '</p>' +
      '<p class="w-sub">' + m.fecha.slice(11) + ' · ' + esc(m.quien) + (m.soporte ? ' · ' + esc(m.soporte) : '') + '</p></article>';
  });
  return h + '</div>';
}

ACCIONES['mov-nuevo'] = function () {
  var t = turnoAbierto();
  if (!t) { aviso('Abre la caja para registrar movimientos.'); return; }
  abrirFormulario({ titulo: 'Registrar movimiento', boton: 'Registrar',
    campos: [
      { id: 'tipo', etiqueta: 'Tipo', tipo: 'chips', opciones: TIPOS_MOV, valor: 'EGRESO', ancho: true },
      { id: 'concepto', etiqueta: 'Concepto', tipo: 'select', opciones: CONCEPTOS_MOV.EGRESO.map(function (c) { return [c, c]; }), ancho: true },
      { id: 'valor', etiqueta: 'Valor ($)', tipo: 'number', requerido: true, min: 1, step: 100 },
      { id: 'soporte', etiqueta: 'Recibo o soporte (opcional)', tipo: 'text', largo: 40 },
      { id: 'detalle', etiqueta: 'Detalle (opcional)', tipo: 'text', largo: 120, ancho: true }],
    alCambiar: function (val, dlg) {
      var sel = dlg.querySelector('select[name="concepto"]');
      var lista = CONCEPTOS_MOV[val.tipo];
      if (sel.dataset.tipo !== val.tipo) { sel.dataset.tipo = val.tipo; sel.innerHTML = lista.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join(''); }
    },
    alGuardar: function (val) {
      if (val.tipo !== 'INGRESO' && val.valor > efectivoEsperado(t)) return 'Solo hay ' + pesos(efectivoEsperado(t)) + ' en el cajón.';
      ESTADO.movimientosCaja.push({ n: ESTADO.movimientosCaja.length + 1, turno: t.id, tipo: val.tipo, concepto: val.concepto, valor: val.valor, soporte: val.soporte, detalle: val.detalle, fecha: ahoraTexto(), quien: usuarioActual() });
      guardar();
      aviso('Movimiento registrado: ' + val.concepto + ' por ' + pesos(val.valor) + '.');
      pintarTodo();
    } });
};

// ---------- Turno ----------
function resumenTurno(t) {
  var r = { ventas: ventasDelTurno(t), anuladas: ESTADO.ventas.filter(function (v) { return v.turno === t.id && v.anulada; }), porMetodo: {}, impuestos: {}, subtotal: 0, descuentos: 0, impuesto: 0, propinas: 0, total: 0, efectivo: 0, notas: 0 };
  r.ventas.forEach(function (v) {
    r.subtotal += v.subtotal; r.descuentos += v.descuento; r.impuesto += v.impuesto; r.propinas += v.propina || 0; r.total += v.total;
    r.porMetodo[v.metodo] = (r.porMetodo[v.metodo] || 0) + v.total + (v.propina || 0);
    if (v.efectivo) r.efectivo += v.total + (v.propina || 0);
    impuestosPorTarifa(lineasDeVenta(v)).forEach(function (x) { var k = x.nombre + ' ' + x.porcentaje + ' %'; r.impuestos[k] = r.impuestos[k] || { base: 0, valor: 0 }; r.impuestos[k].base += x.base; r.impuestos[k].valor += x.valor; });
  });
  var ids = ESTADO.ventas.filter(function (v) { return v.turno === t.id; }).map(function (v) { return v.n; });
  r.docs = ESTADO.documentos.filter(function (d) { return ids.indexOf(d.venta) !== -1; });
  r.docs.filter(function (d) { return d.tipo === 'NC' && d.estado === 'Aceptado'; }).forEach(function (d) { r.notas += d.total; });
  r.movs = movimientosDelTurno(t);
  r.ingresos = 0; r.salidas = 0;
  r.movs.forEach(function (m) { if (m.tipo === 'INGRESO') r.ingresos += m.valor; else r.salidas += m.valor; });
  return r;
}

function lineasInforme(t, r) {
  var h = [['Base inicial', pesos(t.base)], ['Ventas (' + r.ventas.length + ')', pesos(r.total)], ['Propinas', pesos(r.propinas)]];
  Object.keys(r.porMetodo).forEach(function (m) { h.push(['· ' + m, pesos(r.porMetodo[m])]); });
  Object.keys(r.impuestos).forEach(function (k) { h.push(['Base ' + k, pesos(r.impuestos[k].base)]); h.push(['Impuesto ' + k, pesos(r.impuestos[k].valor)]); });
  h.push(['Descuentos', pesos(r.descuentos)]);
  if (r.anuladas.length) h.push(['Ventas anuladas', String(r.anuladas.length)]);
  if (r.notas) h.push(['Notas crédito aceptadas', pesos(r.notas)]);
  h.push(['Ingresos de efectivo', pesos(r.ingresos)], ['Gastos y retiros', pesos(r.salidas)]);
  h.push(['Efectivo que debe haber', pesos(efectivoEsperado(t))]);
  if (t.cierra) h.push(['Efectivo contado', pesos(t.contado)], ['Observaciones', esc(t.obs)]);
  return h;
}

function vistaTurno() {
  var t = turnoAbierto();
  var h = '<div class="widgets">';
  if (t) {
    var r = resumenTurno(t);
    h += '<article class="widget w-activa w-turno"><div class="w-cab"><img src="icons/inicio/efectivo.svg" alt=""><b>TURNO EN CURSO</b></div>' +
      '<p class="w-sub">Abierto el ' + diaLargo(t.abre) + ' a las ' + t.abre.slice(11) + ' por ' + esc(t.cajero) + '</p>' +
      '<dl class="w-lista"><div><dt>Base inicial</dt><dd>' + pesos(t.base) + '</dd></div><div><dt>Ventas en efectivo</dt><dd>' + pesos(r.efectivo) + '</dd></div>' +
      '<div><dt>Pagos electrónicos</dt><dd>' + pesos(r.total + r.propinas - r.efectivo) + '</dd></div><div><dt>Ingresos y gastos</dt><dd>' + pesos(r.ingresos - r.salidas) + '</dd></div>' +
      '<div class="gran"><dt>Debe haber en caja</dt><dd>' + pesos(efectivoEsperado(t)) + '</dd></div></dl>' +
      '<div class="w-pie">' + btnFila('informe', 'Ver informe', t.id) + btnFila('cerrar-caja', 'Cerrar caja', undefined, true) + '</div></article>';
  } else {
    h += '<article class="widget w-apagada w-turno"><div class="w-cab"><img src="icons/inicio/efectivo.svg" alt=""><b>CAJA CERRADA</b></div>' +
      '<p class="w-sub">No hay turno abierto. Mientras tanto no se puede cobrar.</p><div class="w-pie">' + btnFila('abrir-caja', 'Abrir caja', undefined, true) + '</div></article>';
  }
  h += '</div>';
  var cerrados = ESTADO.turnos.filter(function (x) { return x.cierra; }).reverse();
  if (cerrados.length) {
    h += '<h3 class="grupo-w">Turnos anteriores</h3><div class="widgets">';
    cerrados.forEach(function (x) {
      h += '<article class="widget w-turno" data-ca="informe" data-d="' + x.id + '"><div class="w-cab"><b>' + esc(x.cajero).toUpperCase() + '</b></div>' +
        '<p class="w-sub">' + diaLargo(x.abre) + ', ' + x.abre.slice(11) + ' a ' + x.cierra.slice(11) + '</p>' +
        '<dl class="w-lista"><div><dt>Base inicial</dt><dd>' + pesos(x.base) + '</dd></div><div><dt>Sistema</dt><dd>' + pesos(x.sistema) + '</dd></div><div><dt>Contado</dt><dd>' + pesos(x.contado) + '</dd></div></dl>' +
        '<div class="w-pie"><span class="w-estado">' + (x.contado === x.sistema ? 'Sin novedades' : esc(x.obs)) + '</span></div></article>';
    });
    h += '</div>';
  }
  return h;
}

ACCIONES['abrir-caja'] = function () {
  abrirFormulario({ titulo: 'Abrir caja', ayuda: 'Mientras no haya una caja abierta no se puede cobrar.', boton: 'Abrir caja',
    campos: [{ id: 'base', etiqueta: 'Base inicial ($)', tipo: 'number', requerido: true, min: 0, step: 1000, ayuda: 'Efectivo con el que empieza el cajón.', ancho: true }],
    alGuardar: function (val) {
      var id = 0;
      ESTADO.turnos.forEach(function (x) { id = Math.max(id, x.id); });
      ESTADO.turnos.push({ id: id + 1, cajero: usuarioActual(), abre: ahoraTexto(), cierra: '', base: val.base, sistema: 0, contado: 0, obs: '' });
      guardar();
      aviso('Caja abierta con una base de ' + pesos(val.base) + '.');
      pintarTodo();
    } });
};

// Cierre con conteo por denominación; si no cuadra, se explica y no se cierra
ACCIONES['cerrar-caja'] = function () {
  var t = turnoAbierto();
  if (!t) return;
  var abiertos = pedidosEnCurso().length;
  if (abiertos) { aviso('Hay ' + abiertos + (abiertos === 1 ? ' pedido abierto' : ' pedidos abiertos') + ': cóbralos o anúlalos antes de cerrar.'); return; }
  var esperado = efectivoEsperado(t);
  var suma = function (val) { var s = Number(val.otros) || 0; DENOMINACIONES.forEach(function (d) { s += (Number(val['d' + d]) || 0) * d; }); return s; };
  abrirFormulario({ titulo: 'Cerrar caja', ayuda: ' ', boton: 'Cerrar caja', ancha: true,
    campos: DENOMINACIONES.map(function (d) { return { id: 'd' + d, etiqueta: (d >= 1000 ? 'Billetes de ' : 'Monedas de ') + pesos(d).replace('$ ', '$'), tipo: 'number', min: 0, step: 1, placeholder: '0' }; })
      .concat([{ id: 'otros', etiqueta: 'Otros: monedas sueltas o vales ($)', tipo: 'number', min: 0, step: 1, placeholder: '0' }, { id: 'obs', etiqueta: 'Observaciones', tipo: 'text', largo: 255, ancho: true, ayuda: 'Obligatorias si hay diferencia.' }]),
    alCambiar: function (val, dlg) {
      var contado = suma(val), dif = contado - esperado;
      dlg.querySelector('.ayuda-res').innerHTML = 'Debe haber <b>' + pesos(esperado) + '</b> · contado <b>' + pesos(contado) + '</b> · ' + (dif === 0 ? 'cuadra' : 'diferencia de <b>' + pesos(dif) + '</b>');
    },
    alGuardar: function (val) {
      var contado = suma(val), dif = contado - esperado;
      if (dif !== 0) return val.obs ? 'Descuadre de ' + pesos(dif) + ': la caja no se puede cerrar. Cuenta de nuevo e inténtalo otra vez.' : 'Hay una diferencia de ' + pesos(dif) + '. Explica el motivo en observaciones y cuenta de nuevo.';
      t.cierra = ahoraTexto();
      t.sistema = esperado;
      t.contado = contado;
      t.obs = val.obs || 'Sin novedades';
      guardar();
      aviso('Caja cerrada. El informe del turno queda en Turno.');
      pintarTodo();
    } });
};

ACCIONES.informe = function (el) {
  var t = buscarPor(ESTADO.turnos, 'id', Number(el.dataset.d));
  var filas = lineasInforme(t, resumenTurno(t));
  abrirVentana({ titulo: 'Informe del turno', ayuda: esc(t.cajero) + ' · ' + diaLargo(t.abre) + ', ' + t.abre.slice(11) + (t.cierra ? ' a ' + t.cierra.slice(11) : ' · en curso'),
    cuerpo: '<dl class="tk-totales informe">' + filas.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>'; }).join('') + '</dl>',
    botones: [{ texto: 'Imprimir', primario: true, alClic: function () {
      imprimirHtml('Informe del turno', '<h1>' + esc(ESTADO.facturacion.emisor.nombreComercial) + '</h1><p class="c">Informe del turno · ' + esc(t.cajero) + '</p><p class="c">' + t.abre + (t.cierra ? ' a ' + t.cierra : '') + '</p><h2>Resumen</h2>' + filas.map(function (f) { return filaImp(f[0], f[1]); }).join(''));
    } }] });
};

// ---------- Por cobrar y las que se agregan desde otros archivos ----------
registrarVista({ clave: 'cobrar', titulo: 'Por cobrar', orden: 1, pintor: vistaCobrar, contador: function () { return pedidosEnCurso().length; } });
registrarVista({ clave: 'tickets', titulo: 'Comprobantes', orden: 2, pintor: vistaTickets,
  filtros: function () { return CUANDO.map(function (x) { return chip('cuando', x[0], x[1], cuando === x[0]); }).join(''); }, alFiltrar: function (g, v) { cuando = v; } });
registrarVista({ clave: 'movimientos', titulo: 'Caja menor', orden: 4, pintor: vistaMovimientos });
registrarVista({ clave: 'turno', titulo: 'Turno', orden: 5, pintor: vistaTurno });
