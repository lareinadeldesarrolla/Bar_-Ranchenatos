/* Reportes: las vistas (cuadro de mando integral, ventas, inventario, clientes y todos los indicadores) las pinta tablero.js con el catálogo de Inicio.
   Aquí van la barra de vistas y los estados de cuenta (clientes, caja y cuentas por cobrar). */

var $ = function (id) { return document.getElementById(id); };
var MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var cuenta = { tipo: 'clientes', cliente: '', turno: '' };

function fecha(texto) { return Number(texto.slice(8, 10)) + ' ' + MESES_C[Number(texto.slice(5, 7)) - 1] + ' ' + texto.slice(0, 4) + (texto.length > 10 ? ' ' + texto.slice(11, 16) : ''); }
function nombreDe(c) { return (c.nombre + ' ' + (c.apellidos || '')).trim(); }

// ---------- Barra de vistas ----------
function pintarVistas() {
  $('r-vistas').innerHTML = VISTAS.map(function (v) { return '<button type="button" class="chip-filtro" data-v="' + v.clave + '" aria-pressed="' + (vistaActiva === v) + '">' + esc(v.titulo) + '</button>'; }).join('');
}
$('r-vistas').addEventListener('click', function (e) {
  var b = e.target.closest('.chip-filtro');
  if (!b) return;
  seleccionarVista(b.dataset.v);
  pintarVistas();
});
$('r-como').addEventListener('click', function (e) { var b = e.target.closest('[data-como]'); if (b) verTodosComo(b.dataset.como); });
$('btn-imprimir').addEventListener('click', function () { window.print(); });

window.alCambiarVista = function (v) {
  $('estado-cuenta').hidden = !v.propia;
  $('r-como').hidden = !!v.propia;
  if (v.propia) pintarCuenta();
};

// ---------- Tabla de los estados de cuenta ----------
// columnas: [[título, ancho, derecha?]]; filas: [[celdas]]; total: [celdas] o null
function tabla(columnas, filas, total) {
  var cols = columnas.map(function (c) { return 'minmax(0, ' + c[1] + 'fr)'; }).join(' ');
  var cab = columnas.map(function (c) { return '<span' + (c[2] ? ' class="tg-der"' : '') + '>' + c[0] + '</span>'; }).join('');
  var fila = function (celdas, clase) {
    return '<div class="tg-fila ' + clase + '" style="--cols:' + cols + '">' + celdas.map(function (x, i) { return '<span class="tg-dato' + (columnas[i][2] ? ' tg-num' : '') + '" data-t="' + esc(columnas[i][0]) + '">' + x + '</span>'; }).join('') + '</div>';
  };
  return '<div class="tg"><div class="tg-cab" style="--cols:' + cols + '">' + cab + '</div>' + (filas.length ? filas.map(function (f) { return fila(f, 'tg-sin'); }).join('') : '<div class="tg-fila tg-sin" style="--cols:1fr"><span>No hay movimientos.</span></div>') + (total ? fila(total, 'tg-tot') : '') + '</div>';
}

// ---------- Estado de cuenta de un cliente ----------
// Cargos: lo que consumió y lo que está por cobrar. Abonos: lo que pagó y los abonos de reservaciones. Saldo: cargos menos abonos (positivo = debe, negativo = a favor).
function movimientosCliente(nombre) {
  var m = [];
  ESTADO.ventas.filter(function (v) { return v.cliente === nombre && !v.anulada; }).forEach(function (v) {
    var tot = v.total + (v.propina || 0), p = buscarPor(ESTADO.pedidos, 'n', v.pedido);
    var prods = p ? p.lineas.map(function (l) { return l.cant + ' × ' + l.producto; }).join(', ') : 'Consumo';
    m.push({ fecha: v.fecha, doc: 'Venta ' + v.n, det: 'Mesa ' + v.mesa + ' · ' + prods + (v.promo ? ' · ' + v.promo : ''), cargo: tot, abono: 0 });
    var pagado = tot - (v.abono || 0); // lo que pagó ese día; el abono ya entró cuando reservó
    m.push({ fecha: v.fecha, doc: 'Pago venta ' + v.n, det: v.metodo + (v.ref ? ' · ' + v.ref : ''), cargo: 0, abono: pagado });
  });
  ESTADO.reservas.filter(function (r) { return r.cliente === nombre && r.anticipo && r.anticipo.monto > 0; }).forEach(function (r) {
    var a = r.anticipo, f = r.fecha + ' ' + r.hora;
    m.push({ fecha: f, doc: 'Reserva ' + r.n, det: 'Abono recibido (' + (a.metodo || 'sin método') + ')', cargo: 0, abono: a.monto });
    if (r.estado === 'CUMPLIDA' && a.estado === 'Aplicado') return;
    if (a.estado === 'Retenido' && a.retenido) {
      m.push({ fecha: f, doc: 'Reserva ' + r.n, det: 'Penalización por no asistir (' + Math.round(a.retenido / a.monto * 100) + ' % del abono)', cargo: a.retenido, abono: 0 });
      if (a.devuelto) m.push({ fecha: f, doc: 'Reserva ' + r.n, det: 'Devolución del resto del abono', cargo: a.devuelto, abono: 0 });
    } else if (a.estado === 'Retenido') m.push({ fecha: f, doc: 'Reserva ' + r.n, det: 'Abono retenido', cargo: a.monto, abono: 0 });
    else if (a.estado === 'Devuelto') m.push({ fecha: f, doc: 'Reserva ' + r.n, det: 'Abono devuelto al cliente', cargo: a.monto, abono: 0 });
  });
  pedidosEnCurso().filter(function (p) { return p.cliente === nombre; }).forEach(function (p) {
    m.push({ fecha: p.fecha, doc: 'Pedido ' + p.n, det: 'Mesa ' + p.mesa + ' · por cobrar', cargo: totalesDe(p, 0).total, abono: 0 });
  });
  return m.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
}

function cuentaCliente() {
    var todos = ESTADO.clientes.map(nombreDe);
  // También quien reservó o compró sin estar en la base de clientes
  ESTADO.reservas.map(function (r) { return r.cliente; }).concat(ESTADO.ventas.map(function (v) { return v.cliente; })).forEach(function (n) { if (n && n !== 'Sin cliente' && n !== '—' && todos.indexOf(n) === -1) todos.push(n); });
  todos.sort(function (a, b) { return a.localeCompare(b, 'es'); });
  var nombres = todos.filter(function (n) { return movimientosCliente(n).length; });
  if (!cuenta.cliente || todos.indexOf(cuenta.cliente) === -1) cuenta.cliente = nombres[0] || todos[0] || '';
  var h = '<div class="ec-barra"><label>Cliente <select id="ec-cliente">' + todos.map(function (n) { return '<option' + (n === cuenta.cliente ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label></div>';
  if (!cuenta.cliente) return h + '<p class="sin-datos">Todavía no hay clientes.</p>';
  var c = clienteDe(cuenta.cliente), mov = movimientosCliente(cuenta.cliente), cargos = 0, abonos = 0, saldo = 0;
  var filas = mov.map(function (x) {
    cargos += x.cargo; abonos += x.abono; saldo += x.cargo - x.abono;
    return [fecha(x.fecha), esc(x.doc), esc(x.det), x.cargo ? pesos(x.cargo) : '—', x.abono ? pesos(x.abono) : '—', pesos(saldo)];
  });
  h += '<div class="ec-cab"><h3>Estado de cuenta · ' + esc(cuenta.cliente) + '</h3><p>' + (c ? esc(c.tipoDoc ? c.tipoDoc + ' ' + c.numDoc : 'Sin documento') + ' · ' + esc(c.telefono) + (c.correo ? ' · ' + esc(c.correo) : '') : 'Cliente sin ficha') + ' · al ' + fecha(ahoraTexto()) + '</p></div>';
  h += '<dl class="ec-saldo"><div><dt>Cargos</dt><dd>' + pesos(cargos) + '</dd></div><div><dt>Abonos y pagos</dt><dd>' + pesos(abonos) + '</dd></div><div class="ec-fuerte"><dt>' + (saldo > 0 ? 'Saldo por pagar' : (saldo < 0 ? 'Saldo a favor del cliente' : 'Saldo')) + '</dt><dd>' + pesos(Math.abs(saldo)) + '</dd></div></dl>';
  return h + tabla([['Fecha', 1.1], ['Documento', 1], ['Detalle', 2.6], ['Cargos', .9, true], ['Abonos', .9, true], ['Saldo', .9, true]], filas, ['', '', '<b>Totales</b>', pesos(cargos), pesos(abonos), pesos(saldo)]);
}

// ---------- Estado de cuenta de la caja (por turno) ----------
function cuentaCaja() {
  if (!ESTADO.turnos.length) return '<p class="sin-datos">Todavía no hay turnos de caja.</p>';
  var ids = ESTADO.turnos.map(function (t) { return String(t.id); });
  if (ids.indexOf(cuenta.turno) === -1) cuenta.turno = String(turnoMostrado().id);
  var t = buscarPor(ESTADO.turnos, 'id', Number(cuenta.turno));
  var ventas = ventasDelTurno(t), movs = movimientosDelTurno(t);
  var porMetodo = agrupar(ventas, function (v) { return v.metodo + (v.efectivo ? '|e' : '|o'); }, function (v) { return v.total + (v.propina || 0) - (v.efectivo ? (v.abono || 0) : 0); });
  var filas = [['Base con que abrió la caja', 'Entra', pesos(t.base)]], entra = t.base, sale = 0;
  porMetodo.forEach(function (f) {
    var partes = f[0].split('|'), efe = partes[1] === 'e';
    filas.push(['Ventas en ' + esc(partes[0].toLowerCase()) + ' (' + f[2] + (f[2] === 1 ? ' cuenta' : ' cuentas') + ')', efe ? 'Entra' : 'Informativo', pesos(f[1])]);
    if (efe) entra += f[1];
  });
  movs.forEach(function (m) {
    var ing = m.tipo === 'INGRESO';
    filas.push([esc(m.concepto) + (m.detalle ? ' · ' + esc(m.detalle) : ''), ing ? 'Entra' : 'Sale', (ing ? '' : '− ') + pesos(m.valor)]);
    if (ing) entra += m.valor; else sale += m.valor;
  });
  var esperado = efectivoEsperado(t);
  var cerrado = t.cierra !== '';
  var h = '<div class="ec-barra"><label>Turno <select id="ec-turno">' + ESTADO.turnos.map(function (x) { return '<option value="' + x.id + '"' + (String(x.id) === cuenta.turno ? ' selected' : '') + '>Turno ' + x.id + ' · ' + esc(x.cajero) + ' · ' + fecha(x.abre) + '</option>'; }).join('') + '</select></label></div>';
  h += '<div class="ec-cab"><h3>Estado de cuenta de la caja · turno ' + t.id + '</h3><p>' + esc(t.cajero) + ' · abrió ' + fecha(t.abre) + (cerrado ? ' · cerró ' + fecha(t.cierra) : ' · abierto') + '</p></div>';
  h += '<dl class="ec-saldo"><div><dt>Entra al cajón</dt><dd>' + pesos(entra) + '</dd></div><div><dt>Sale del cajón</dt><dd>' + pesos(sale) + '</dd></div><div class="ec-fuerte"><dt>Efectivo esperado</dt><dd>' + pesos(esperado) + '</dd></div>' +
    (cerrado ? '<div><dt>Contado al cerrar</dt><dd>' + pesos(t.contado) + '</dd></div><div><dt>Diferencia</dt><dd>' + pesos(t.contado - esperado) + '</dd></div>' : '') + '</dl>';
  return h + tabla([['Concepto', 3], ['Movimiento', 1], ['Valor', 1, true]], filas, ['<b>Efectivo esperado en el cajón</b>', '', pesos(esperado)]);
}

// ---------- Cuentas por cobrar ----------
function cuentaPorCobrar() {
  var abiertos = pedidosEnCurso(), total = 0;
  var filas = abiertos.map(function (p) {
    var t = totalesDe(p, 0).total - (p.abono || 0);
    total += t;
    return ['Pedido ' + p.n, 'Mesa ' + p.mesa, esc(p.cliente === '—' ? 'Sin cliente' : p.cliente), fecha(p.fecha), esc(p.estado), p.abono ? pesos(p.abono) : '—', pesos(t)];
  });
  return '<div class="ec-cab"><h3>Cuentas por cobrar</h3><p>Pedidos abiertos que todavía no se cobran · al ' + fecha(ahoraTexto()) + '</p></div>' +
    '<dl class="ec-saldo"><div><dt>Pedidos abiertos</dt><dd>' + abiertos.length + '</dd></div><div class="ec-fuerte"><dt>Por cobrar</dt><dd>' + pesos(total) + '</dd></div></dl>' +
    tabla([['Pedido', 1], ['Mesa', .8], ['Cliente', 1.6], ['Desde', 1.2], ['Estado', 1], ['Abono', .9, true], ['Por cobrar', 1, true]], filas, ['<b>Total</b>', '', '', '', '', '', pesos(total)]);
}

function pintarCuenta() {
  var tipos = [['clientes', 'De un cliente'], ['caja', 'De la caja'], ['cobrar', 'Por cobrar']];
  var cuerpo = cuenta.tipo === 'clientes' ? cuentaCliente() : (cuenta.tipo === 'caja' ? cuentaCaja() : cuentaPorCobrar());
  $('estado-cuenta').innerHTML = '<div class="segmento ec-tipos" role="group" aria-label="Qué estado de cuenta">' + tipos.map(function (t) { return '<button type="button" class="seg" data-t="' + t[0] + '" aria-pressed="' + (cuenta.tipo === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' + cuerpo;
}

$('estado-cuenta').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b && b.classList.contains('seg')) { cuenta.tipo = b.dataset.t; pintarCuenta(); } });
$('estado-cuenta').addEventListener('change', function (e) {
  if (e.target.id === 'ec-cliente') cuenta.cliente = e.target.value;
  if (e.target.id === 'ec-turno') cuenta.turno = e.target.value;
  pintarCuenta();
});

pintarVistas();
