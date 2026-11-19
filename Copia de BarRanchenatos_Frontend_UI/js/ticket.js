/* Comprobante de pago impreso de Ranchenatos: papel térmico de 58 mm, del largo que necesite el detalle.
   imprimirTicket(venta, documento) — documento es el electrónico si se emitió (factura o documento equivalente POS).
   Sin documento electrónico se llama "Comprobante de pago": no es factura ni recibo. */

var NOMBRE_DOCUMENTO_TICKET = { FACTURA: 'Factura electrónica de venta', POS: 'Documento equivalente POS' };

// El comprobante en HTML: sirve para imprimir y para la vista previa de Caja
function htmlTicket(v, doc) {
  var e = ESTADO.facturacion.emisor;
  var p = buscarPor(ESTADO.pedidos, 'n', v.pedido);
  var fila = function (a, b, clase) { return '<div class="ti-f' + (clase ? ' ' + clase : '') + '"><span>' + a + '</span><span>' + b + '</span></div>'; };
  var lineas = p ? p.lineas.map(function (l) {
    return '<div class="ti-l"><span class="ti-p">' + l.cant + ' × ' + esc(l.producto) + '<small>' + l.cant + ' × ' + pesos(l.precio) + (l.esp ? ' · ' + esc(l.esp) : '') + '</small></span><span class="ti-v">' + pesos(l.cant * l.precio) + '</span></div>';
  }).join('') : '';
  var impuestos = v.tarifas && v.tarifas.length && v.tarifas[0].valor !== undefined ? v.tarifas.map(function (t) { return fila(esc(t.nombre) + ' ' + t.porcentaje + ' %', pesos(t.valor)); }).join('')
    : (v.impuesto ? fila(v.tarifas && v.tarifas.length ? esc(v.tarifas.map(function (t) { return t.nombre + ' ' + t.porcentaje + ' %'; }).join(' + ')) : 'Impuestos', pesos(v.impuesto)) : '');
  var total = v.total + (v.propina || 0);
  var abono = v.abono || 0;
  var recibido = v.efectivo && v.recibido ? fila('Recibido', pesos(v.recibido)) + fila('Cambio', pesos(Math.max(0, v.recibido - (total - abono)))) : '';
  var titulo = doc ? (NOMBRE_DOCUMENTO_TICKET[doc.tipo] || 'Documento electrónico') : tituloComprobante();
  var numero = doc ? doc.id : 'N° ' + (v.n < 100 ? ('00' + v.n).slice(-3) : v.n);
  var datosEmisor = [e.razonSocial, e.nit ? (obligadoFE() ? 'NIT ' : (e.docTipo || 'CC') + ' ') + e.nit + (obligadoFE() && e.dv ? '-' + e.dv : '') : '', e.direccion, e.telefono ? 'Tel. ' + e.telefono : '', e.municipio ? e.municipio + (e.departamento ? ', ' + e.departamento : '') : '']
    .filter(Boolean).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
  return '<div class="ti-cab"><img class="ti-logo" src="assets/ranchenatos_isotipo.svg" alt=""><h1>' + esc((e.nombreComercial || 'Ranchenatos').toUpperCase()) + '</h1><p class="ti-lema">Bar · Música · Buena compañía</p>' + datosEmisor + '</div>' +
    '<div class="ti-linea"></div>' +
    '<div class="ti-doc"><b>' + esc(titulo) + '</b><span>' + esc(numero) + '</span></div>' +
    fila('Fecha', esc(v.fecha)) + fila('Mesa', v.mesa) + fila('Atendió', esc(v.cajero)) + fila('Cliente', esc(v.cliente)) +
    '<div class="ti-linea"></div><div class="ti-l ti-th"><span class="ti-p">Detalle</span><span class="ti-v">Valor</span></div>' + lineas +
    '<div class="ti-linea"></div>' +
    fila('Subtotal', pesos(v.subtotal)) + (v.descuento ? fila('Descuento' + (v.promo ? '<small>' + esc(v.promo) + '</small>' : ''), '-' + pesos(v.descuento)) : '') + impuestos + (v.propina ? fila('Propina voluntaria', pesos(v.propina)) : '') +
    '<div class="ti-total"><span>TOTAL</span><span>' + pesos(total) + '</span></div>' +
    (abono ? fila('Abono de la reservación', '-' + pesos(abono)) + fila('<b>Pagado hoy</b>', '<b>' + pesos(total - abono) + '</b>') : '') +
    fila('Pagó con', esc(v.metodo)) + (v.ref ? fila('Referencia', esc(v.ref)) : '') + recibido +
    (doc && doc.cufe ? '<div class="ti-linea"></div><p class="ti-cufe">' + (doc.tipo === 'FACTURA' ? 'CUFE' : 'CUDE') + ': ' + esc(doc.cufe.slice(0, 48)) + '…</p>' : '') +
    '<div class="ti-linea"></div><div class="ti-pie"><b>¡Gracias por visitarnos!</b><p>Vuelve pronto a Ranchenatos</p>' + (doc ? '' : '<p class="ti-nofiscal">' + esc(obligadoFE() ? 'Este comprobante no es una factura.' : leyendaComprobante()) + '</p>') + '</div>';
}

function armarTicket(v, doc) {
  var caja = document.getElementById('ticket-imp');
  if (!caja) { caja = document.createElement('div'); caja.id = 'ticket-imp'; caja.className = 'ticket-58'; document.body.appendChild(caja); }
  caja.innerHTML = htmlTicket(v, doc);
  return caja;
}

function imprimirTicket(v, doc) {
  var caja = armarTicket(v, doc);
  var logo = caja.querySelector('.ti-logo');
  var imprimir = function () {
    document.body.classList.add('imprimiendo-ticket');
    window.print();
  };
  if (logo && !logo.complete) { logo.onload = imprimir; logo.onerror = imprimir; } else imprimir();
}
window.addEventListener('afterprint', function () { document.body.classList.remove('imprimiendo-ticket'); });
