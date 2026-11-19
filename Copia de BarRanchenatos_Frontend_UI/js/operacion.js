/* Operación en Inicio: bloques para ver las mesas, atender las reservaciones, cobrar las cuentas y entrar rápido
   a otras pantallas. Se eligen, ordenan y configuran en "Personalizar", igual que los indicadores.
   Las reglas de cobro son las de Pedidos: no se cobra con productos sin despachar, ni con la caja cerrada,
   y el efectivo recibido debe cubrir el total. */

var ICONO_MESA_OP = { 'Disponible': 'mesa_disponible', 'Ocupada': 'mesa_ocupada', 'Reservada': 'mesa_reservada', 'Inactiva': 'mesa_limpieza', 'Por limpiar': 'mesa_limpieza' };
var CLASE_PEDIDO_OP = { 'Abierto': 'info', 'En preparación': 'warn', 'Entregado': 'ok' };

var dlgCuenta = document.getElementById('dlg-cuenta');
var mesaCuenta = null;

function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

// Registra un bloque de operación en el mismo catálogo de los indicadores
function operacion(id, titulo, ayuda, ancho, estilos, enlace, dibujar) {
  INDICADORES.push({ id: id, grupo: 'Operación', titulo: titulo, ayuda: ayuda, tipo: 'operacion', ancho: ancho, estilos: estilos, enlace: enlace, dibujar: dibujar });
}

// ============================================================
// BLOQUE: MESAS
// ============================================================
function proximaReserva(n) {
  var lista = ESTADO.reservas.filter(function (r) { return r.mesa === n && (r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA') && r.fecha >= hoyDelTurno(); });
  lista.sort(function (a, b) { return (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1; });
  return lista[0] || null;
}

function datosMesa(m) {
  var p = pedidoDeMesa(m.n);
  if (p) {
    var pend = contarLineas(p, 'Pendiente');
    return { p: p, total: totalesDe(p, 0).total, texto: 'Pedido ' + p.n + ' · ' + (pend ? plural(pend, 'producto sin despachar', 'productos sin despachar') : 'todo despachado'), accion: pend ? 'Ver cuenta' : 'Cobrar' };
  }
  var r = proximaReserva(m.n);
  return { p: null, total: 0, texto: r ? 'Reservación ' + fechaCorta(r.fecha) + ' ' + r.hora : 'Sin cuenta abierta', accion: 'Abrir pedido' };
}

function dibujarMesas(estilo) {
  var html = '';
  if (estilo === 'lista') {
    html = '<div class="mesas-lista">';
    ESTADO.mesas.forEach(function (m) {
      var d = datosMesa(m);
      html += '<button type="button" class="mesa-fila est-' + m.estado.toUpperCase().replace(/ /g, '') + '" data-mesa="' + m.n + '"><img src="icons/inicio/' + ICONO_MESA_OP[m.estado] + '.svg" alt=""><b>Mesa ' + m.n + '</b><span class="zona">' + esc(m.ubicacion || '') + ' · ' + plural(m.capacidad, 'persona', 'personas') + '</span>' +
        '<span class="est">' + (d.p ? pesos(d.total) : (m.estado === 'Disponible' ? 'Libre' : m.estado)) + '</span><span class="accion">' + d.accion + ' →</span></button>';
    });
    return html + '</div>';
  }
  if (estilo === 'compacta') {
    html = '<div class="mesas-chip">';
    ESTADO.mesas.forEach(function (m) {
      var d = datosMesa(m);
      html += '<button type="button" class="mesa-mini est-' + m.estado.toUpperCase().replace(/ /g, '') + '" data-mesa="' + m.n + '"><img src="icons/inicio/' + ICONO_MESA_OP[m.estado] + '.svg" alt=""><span><b>Mesa ' + m.n + '</b><small>' + (d.p ? pesos(d.total) : (m.estado === 'Disponible' ? 'Libre' : m.estado)) + '</small></span></button>';
    });
    return html + '</div>';
  }
  html = '<div class="mesas-op">';
  ESTADO.mesas.forEach(function (m) {
    var d = datosMesa(m);
    html += '<button type="button" class="mesa-op est-' + m.estado.toUpperCase().replace(/ /g, '') + '" data-mesa="' + m.n + '"><img src="icons/inicio/' + ICONO_MESA_OP[m.estado] + '.svg" alt=""><span class="nom"><b>Mesa ' + m.n + '</b><small>' + plural(m.capacidad, 'persona', 'personas') + (m.ubicacion ? ' · ' + esc(m.ubicacion) : '') + '</small></span>' +
      '<span class="info"><b class="cuenta' + (d.p ? '' : ' libre') + '">' + (d.p ? pesos(d.total) : (m.estado === 'Disponible' ? 'Libre' : m.estado)) + '</b><small>' + d.texto + '</small></span><span class="accion">' + d.accion + '</span></button>';
  });
  return html + '</div>';
}

operacion('op_mesas', 'Mesas', 'Estado de cada mesa; al tocarla se abre su cuenta o su pedido.', 8,
  [['tarjetas', 'Tarjetas'], ['compacta', 'Compactas'], ['lista', 'Lista']], { texto: 'Ver mesas', ir: 'mesas.html' }, dibujarMesas);

// ============================================================
// BLOQUES: MESAS LIBRES, OCUPADAS Y RESERVADAS (se ven en gráfico)
// ============================================================
function detalleMesaCorto(m) {
  if (m.estado === 'Ocupada' && pedidoDeMesa(m.n)) return pesos(totalesDe(pedidoDeMesa(m.n), 0).total);
  if (m.estado === 'Reservada') { var r = proximaReserva(m.n); return r ? 'Llega ' + r.hora : 'Reservada'; }
  return plural(m.capacidad, 'persona', 'personas');
}

function dibujarPorEstado(estado, adjetivo) {
  return function (estilo) {
    var lista = ESTADO.mesas.filter(function (m) { return m.estado === estado; });
    var total = ESTADO.mesas.length;
    var porcentaje = total ? Math.round(lista.length / total * 100) : 0;
    var cabeza = '<div class="est-cifra"><div class="bloque">' + lista.length + '<span> de ' + total + ' mesas</span></div><span class="est-barra" role="img" aria-label="' + porcentaje + ' % de las mesas"><i style="width:' + porcentaje + '%"></i></span></div>';
    if (estilo === 'cifra') return cabeza + '<p class="est-nombres">' + (lista.length ? lista.map(function (m) { return 'Mesa ' + m.n; }).join(' · ') : 'Ninguna por ahora') + '</p>';
    var fichas = '';
    lista.forEach(function (m) {
      fichas += '<button type="button" class="mesa-pic est-' + m.estado.toUpperCase().replace(/ /g, '') + '" data-mesa="' + m.n + '"><img src="icons/inicio/' + ICONO_MESA_OP[m.estado] + '.svg" alt=""><b>Mesa ' + m.n + '</b><small>' + detalleMesaCorto(m) + '</small></button>';
    });
    return cabeza + (fichas ? '<div class="mesas-pic">' + fichas + '</div>' : '<p class="vacio">No hay mesas ' + adjetivo + ' en este momento.</p>');
  };
}

var ESTILOS_ESTADO = [['mesas', 'Mesas dibujadas'], ['cifra', 'Solo la cifra']];
operacion('op_libres', 'Mesas libres', 'Mesas disponibles ahora para sentar clientes.', 4, ESTILOS_ESTADO, { texto: 'Ver mesas', ir: 'mesas.html' }, dibujarPorEstado('Disponible', 'libres'));
operacion('op_ocupadas', 'Mesas ocupadas', 'Mesas con una cuenta abierta; al tocar una se abre para cobrar.', 4, ESTILOS_ESTADO, { texto: 'Ver pedidos', ir: 'pedidos.html' }, dibujarPorEstado('Ocupada', 'ocupadas'));
operacion('op_reservadas', 'Mesas reservadas', 'Mesas apartadas para una reservación.', 4, ESTILOS_ESTADO, { texto: 'Ver reservaciones', ir: 'reservas.html' }, dibujarPorEstado('Reservada', 'reservadas'));

// ============================================================
// BLOQUE: PLANO DEL SALÓN (cada mesa dibujada con sus sillas)
// ============================================================
function dibujarMesaSvg(m) {
  var cap = m.capacidad, arriba = Math.ceil(cap / 2), abajo = cap - arriba;
  var ancho = Math.max(44, 14 + cap * 10), W = ancho + 28, H = 84;
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-hidden="true"><rect class="m" x="14" y="22" width="' + ancho + '" height="40" rx="9"/>';
  for (var i = 0; i < arriba; i++) svg += '<circle class="s" cx="' + (14 + ancho * (i + 0.5) / arriba).toFixed(1) + '" cy="11" r="6"/>';
  for (var k = 0; k < abajo; k++) svg += '<circle class="s" cx="' + (14 + ancho * (k + 0.5) / abajo).toFixed(1) + '" cy="73" r="6"/>';
  return svg + '<text class="n" x="' + (W / 2) + '" y="48">' + m.n + '</text></svg>';
}

function dibujarPlano() {
  var zonas = {}, orden = [];
  ESTADO.mesas.forEach(function (m) {
    var z = m.ubicacion || 'Sin zona';
    if (!zonas[z]) { zonas[z] = []; orden.push(z); }
    zonas[z].push(m);
  });
  var html = '<div class="plano-sal">';
  orden.forEach(function (z) {
    html += '<div class="zona-pl"><h3>' + esc(z) + '</h3><div class="zona-mesas-pl">';
    zonas[z].forEach(function (m) {
      html += '<button type="button" class="pl-mesa est-' + m.estado.toUpperCase().replace(/ /g, '') + '" data-mesa="' + m.n + '" title="Mesa ' + m.n + ' · ' + plural(m.capacidad, 'persona', 'personas') + ' · ' + m.estado + '" aria-label="Mesa ' + m.n + ', ' + m.estado + '">' + dibujarMesaSvg(m) + '<small>' + detalleMesaCorto(m) + '</small></button>';
    });
    html += '</div></div>';
  });
  var libres = ESTADO.mesas.filter(function (m) { return m.estado === 'Disponible'; }).length;
  var ocupadas = ESTADO.mesas.filter(function (m) { return m.estado === 'Ocupada'; }).length;
  var reservadas = ESTADO.mesas.filter(function (m) { return m.estado === 'Reservada'; }).length;
  return html + '</div><div class="leyenda-pl"><span><i class="lg libre"></i>Libre · ' + libres + '</span><span><i class="lg ocupada"></i>Ocupada · ' + ocupadas + '</span><span><i class="lg reservada"></i>Reservada · ' + reservadas + '</span></div>';
}

operacion('op_plano', 'Plano del salón', 'Todas las mesas dibujadas con sus sillas y su estado: libre, ocupada o reservada.', 8, [['plano', 'Plano con sillas']], { texto: 'Ver mesas', ir: 'mesas.html' }, dibujarPlano);

// ============================================================
// BLOQUE: RESERVAS
// ============================================================
var ICO_RELOJ = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
var ICO_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.3 4.3L18.5 8"/></svg>';
var DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

var ICO_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/></svg>';
var TEXTO_RESERVA_DIA = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', CANCELADA: 'Cancelada', NO_ASISTIO: 'No asistió', CUMPLIDA: 'Atendida' };

// Las reservaciones del día: primero las vigentes y después las canceladas, las que no asistieron y las atendidas.
// Ninguna desaparece: si alguien cancela y luego llega, se puede reactivar.
function reservasDeHoy() {
  var hoy = hoyDelTurno();
  var porHora = function (a, b) { return a.hora < b.hora ? -1 : 1; };
  var delDia = ESTADO.reservas.filter(function (r) { return r.fecha === hoy; });
  var vigentes = delDia.filter(function (r) { return r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA'; }).sort(porHora);
  var otras = delDia.filter(function (r) { return r.estado !== 'PENDIENTE' && r.estado !== 'CONFIRMADA'; }).sort(porHora);
  return { hoy: hoy, vigentes: vigentes, otras: otras, total: delDia.length };
}

function textoDelDia(f) {
  var d = new Date(f + 'T12:00:00');
  return 'Hoy · ' + DIAS_LARGOS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES_LARGOS[d.getMonth()];
}

function botonesDeReservacion(r) {
  var b = function (accion, texto, clase) { return '<button type="button" data-ra="' + accion + '" data-rn="' + r.n + '"' + (clase ? ' class="' + clase + '"' : '') + '>' + texto + '</button>'; };
  if (r.estado === 'PENDIENTE') return b('confirmar', 'Confirmar') + b('cancelar', 'Cancelar', 'peligro');
  if (r.estado === 'CONFIRMADA') return b('llego', 'Llegó') + b('noasistio', 'No asistió') + b('cancelar', 'Cancelar', 'peligro');
  if (r.estado === 'CUMPLIDA') return '<a class="ver-pedido" href="pedidos.html?mesa=' + r.mesa + '">Ver pedido de la mesa</a>';
  return b('llego', 'Llegó') + b('reactivar', 'Reactivar');   // cancelada o no asistió: todavía puede llegar
}

function dibujarReservas(estilo) {
  var v = reservasDeHoy();
  var visibles = v.vigentes.slice(0, 5).concat(v.otras.slice(0, 3));
  var resto = v.total - visibles.length;
  var html = '<div class="res-dia"><span>' + textoDelDia(v.hoy) + '</span><span>' + plural(v.total, 'reservación', 'reservaciones') + '</span></div>';
  if (!visibles.length) return html + '<p class="vacio">No hay reservaciones para hoy.</p>';
  visibles.forEach(function (r) {
    var vigente = r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA';
    var clase = { PENDIENTE: 'espera', CONFIRMADA: 'ok', CANCELADA: 'cancel', NO_ASISTIO: 'cancel', CUMPLIDA: 'hecha' }[r.estado];
    var icono = r.estado === 'PENDIENTE' ? ICO_RELOJ : (r.estado === 'CANCELADA' || r.estado === 'NO_ASISTIO' ? ICO_X : ICO_CHECK);
    html += '<div class="res' + (vigente ? '' : ' inactiva') + (r.estado === 'CANCELADA' ? ' cancelada' : '') + '"><span class="hora">' + r.hora + '</span><span class="cuerpo-res"><b class="nom">' + esc(r.cliente) + '</b>' +
      '<span class="meta"><span class="dato" title="Mesa ' + r.mesa + '"><img src="icons/inicio/mesas.svg" alt="">Mesa ' + r.mesa + '</span><span class="dato" title="' + plural(r.personas, 'persona', 'personas') + '"><img src="icons/inicio/usuario.svg" alt="">' + r.personas + '</span>' +
      (r.tipo === 'EVENTO' ? '<span class="dato evento">' + esc(r.evento) + '</span>' : '') + (vigente ? '' : '<span class="dato estado-txt">' + TEXTO_RESERVA_DIA[r.estado] + '</span>') + '</span>' +
      (estilo !== 'agenda' ? '<span class="botones">' + botonesDeReservacion(r) + '</span>' : '') + '</span>' +
      '<span class="est ' + clase + '" role="img" aria-label="' + TEXTO_RESERVA_DIA[r.estado] + '" title="' + TEXTO_RESERVA_DIA[r.estado] + '">' + icono + '</span></div>';
  });
  if (resto > 0) html += '<p class="mas-lista"><a href="reservas.html">Ver ' + plural(resto, 'reservación más', 'reservaciones más') + ' de hoy</a></p>';
  return '<div class="res-lista">' + html + '</div>';
}

operacion('op_reservas', 'Reservaciones', 'Reservaciones del día pendientes o confirmadas, con botones para confirmar, marcar la llegada o cancelar.', 4,
  [['acciones', 'Con botones'], ['agenda', 'Solo agenda']], { texto: 'Nueva reservación', ir: 'reservas.html', boton: true }, dibujarReservas);

// ============================================================
// BLOQUE: CUENTAS POR COBRAR
// ============================================================
function dibujarCuentas(estilo) {
  var abiertos = pedidosEnCurso();
  if (!abiertos.length) return '<p class="vacio">No hay cuentas abiertas.</p>';
  var html = estilo === 'tarjetas' ? '<div class="cuentas-tarj">' : '<div class="cuentas-lista">';
  var restoCuentas = Math.max(0, abiertos.length - 6);
  abiertos.slice(0, 6).forEach(function (p) {
    var pend = contarLineas(p, 'Pendiente');
    var total = totalesDe(p, 0).total;
    var listo = pend === 0;
    html += '<button type="button" class="cuenta-fila' + (listo ? ' lista' : '') + '" data-cuenta="' + p.mesa + '"><span class="mesa-n">Mesa ' + p.mesa + '</span><span class="det">Pedido ' + p.n + ' · ' + (listo ? 'todo despachado' : plural(pend, 'producto pendiente', 'productos pendientes')) +
      '</span><b class="total">' + pesos(total) + '</b><span class="accion">' + (listo ? 'Cobrar' : 'Ver cuenta') + ' →</span></button>';
  });
  html += '</div>';
  if (restoCuentas) html += '<p class="mas-lista"><a href="pedidos.html">Ver ' + plural(restoCuentas, 'cuenta más', 'cuentas más') + '</a></p>';
  return html;
}

operacion('op_cobro', 'Cuentas por cobrar', 'Pedidos abiertos con su total; al tocar uno se abre para despachar y cobrar.', 4,
  [['lista', 'Lista'], ['tarjetas', 'Tarjetas']], { texto: 'Ver pedidos', ir: 'pedidos.html' }, dibujarCuentas);

// ============================================================
// BLOQUE: ACCESOS RÁPIDOS
// ============================================================
var ACCESOS = [['pedidos.html', 'nuevo_pedido', 'Nuevo pedido'], ['reservas.html', 'reserva', 'Nueva reservación'], ['caja.html', 'efectivo', 'Caja'], ['inventario.html', 'inventario', 'Inventario'], ['reportes.html', 'reportes', 'Reportes']];

function dibujarAccesos(estilo) {
  var html = '<div class="accesos ' + (estilo === 'botones' ? 'accesos-botones' : 'accesos-iconos') + '">';
  ACCESOS.forEach(function (a) {
    html += '<a href="' + a[0] + '">' + (estilo === 'botones' ? '' : '<img src="icons/inicio/' + a[1] + '.svg" alt="">') + '<span>' + a[2] + '</span></a>';
  });
  return html + '</div>';
}

operacion('op_accesos', 'Accesos rápidos', 'Atajos a las pantallas que más se usan.', 12,
  [['iconos', 'Con íconos'], ['botones', 'Botones']], null, dibujarAccesos);

// ============================================================
// Acciones sobre los bloques (se atienden desde el tablero)
// ============================================================
document.getElementById('tablero').addEventListener('click', function (e) {
  var mesa = e.target.closest('[data-mesa]');
  if (mesa) {
    var n = Number(mesa.dataset.mesa);
    if (window.alTocarMesa) window.alTocarMesa(n); // en la pantalla Mesas se elige la mesa en vez de abrir su cuenta
    else if (pedidoDeMesa(n)) abrirCuenta(n);
    else window.location.href = 'pedidos.html?mesa=' + n;
    return;
  }
  var cuenta = e.target.closest('[data-cuenta]');
  if (cuenta) { abrirCuenta(Number(cuenta.dataset.cuenta)); return; }
  var b = e.target.closest('button[data-ra]');
  if (!b) return;
  var r = buscarPor(ESTADO.reservas, 'n', Number(b.dataset.rn));
  var accion = b.dataset.ra;
  if (accion === 'confirmar') { r.estado = 'CONFIRMADA'; toast('Reservación de ' + r.cliente + ' confirmada'); }
  if (accion === 'cancelar') { r.estado = 'CANCELADA'; toast('Reservación de ' + r.cliente + ' cancelada'); }
  if (accion === 'reactivar') { r.estado = 'PENDIENTE'; toast('Reservación de ' + r.cliente + ' reactivada'); }
  if (accion === 'noasistio') { r.estado = 'NO_ASISTIO'; toast(r.cliente + ' no asistió'); }
  if (accion === 'llego') {
    r.estado = 'CUMPLIDA';
    guardar();
    window.location.href = 'pedidos.html?mesa=' + r.mesa; // el cliente llegó: se abre su pedido en la mesa
    return;
  }
  guardar();
  pintarTablero();
});

// ============================================================
// Cuenta y cobro de una mesa (ventana)
// ============================================================
var mesaDeCuenta = function () { return mesaCuenta === null ? null : pedidoDeMesa(mesaCuenta); };

function pintarLineasCuenta() {
  var p = mesaDeCuenta();
  var html = '', pend = 0;
  p.lineas.forEach(function (l) {
    var listo = l.despacho === 'Despachado';
    if (!listo) pend++;
    html += '<li><span class="n">' + l.cant + ' ×</span><span class="p">' + esc(l.producto) + (l.esp ? '<small>' + esc(l.esp) + '</small>' : '') + '</span><span class="v">' + pesos(l.cant * l.precio) + '</span>' +
      '<span class="e ' + (listo ? 'listo' : 'espera') + '">' + (listo ? 'Despachado' : 'Pendiente') + '</span></li>';
  });
  document.getElementById('c-lineas').innerHTML = html;
  document.getElementById('c-despachar').hidden = pend === 0;
  return pend;
}

// Total y motivo por el que todavía no se puede cobrar (el cobro en sí es la ventana compartida de js/cobro.js)
function pintarTotalesCuenta() {
  var p = mesaDeCuenta();
  var t = totalesDe(p, 0);
  document.getElementById('c-total').textContent = pesos(t.total);
  document.getElementById('c-desglose').textContent = 'Subtotal ' + pesos(t.subtotal) + ' · Impuestos ' + pesos(t.impuesto);
  var motivo = !turnoAbierto() ? 'La caja está cerrada: ábrela en Caja para cobrar' : (contarLineas(p, 'Por confirmar') > 0 ? 'Confirma el pedido en Pedidos antes de cobrar' : (contarLineas(p, 'Pendiente') > 0 ? 'Despacha los productos pendientes antes de cobrar' : ''));
  document.getElementById('c-cobrar').disabled = motivo !== '';
  document.getElementById('c-motivo').textContent = motivo;
}

function abrirCuenta(n) {
  mesaCuenta = n;
  var p = pedidoDeMesa(n);
  document.getElementById('c-titulo').textContent = 'Mesa ' + n + ' · Pedido ' + p.n;
  var estado = document.getElementById('c-estado');
  estado.textContent = p.estado;
  estado.className = 'badge badge-' + CLASE_PEDIDO_OP[p.estado];
  document.getElementById('c-abrir').href = 'pedidos.html?mesa=' + n;
  pintarLineasCuenta();
  pintarTotalesCuenta();
  dlgCuenta.showModal();
}

document.getElementById('c-despachar').addEventListener('click', function () {
  var p = mesaDeCuenta();
  p.lineas.forEach(function (l, i) { if (l.despacho !== 'Despachado') despacharLinea(p, i); });
  p.estado = estadoDePedido(p);
  guardar();
  pintarLineasCuenta();
  pintarTotalesCuenta();
  document.getElementById('c-estado').textContent = p.estado;
  document.getElementById('c-estado').className = 'badge badge-' + CLASE_PEDIDO_OP[p.estado];
  pintarTablero();
  toast('Despachado. El inventario descontó lo que indica cada receta.');
});

document.getElementById('c-cerrar').addEventListener('click', function () { dlgCuenta.close(); });

// (Mesas trae su propia ventana de cuenta y no tiene este botón)
var botonCobrarCuenta = document.getElementById('c-cobrar');
if (botonCobrarCuenta) botonCobrarCuenta.addEventListener('click', function () {
  var p = mesaDeCuenta();
  dlgCuenta.close();
  mesaCuenta = null;
  abrirCobro(p, function (venta, mensaje) { pintarTablero(); toast(mensaje); });
});

// Si otra pestaña cambia los datos, esta se actualiza
window.addEventListener('storage', function (e) {
  if (e.key === CLAVE) { cargar(); pintarTablero(); }
});
