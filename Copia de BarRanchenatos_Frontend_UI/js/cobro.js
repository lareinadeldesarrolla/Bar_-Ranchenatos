/* Cobro de un pedido: la misma ventana en Pedidos y en Caja.
   abrirCobro(pedido, alTerminar) registra la venta (con propina y comprobante) y, si se pide, emite el documento electrónico (js/facturacion.js).
   alTerminar(venta, mensaje) avisa a la pantalla que lo pidió. */

var ICONO_PAGO = { 'Efectivo': 'efectivo', 'Transferencia PSE': 'pse', 'Tarjeta débito/crédito': 'tarjeta', 'Nequi': 'nequi', 'Daviplata': 'nequi_daviplata' };

var cobroDialogo, cobroForm, cobroPedido, cobroAlTerminar, cobroRevisar;

function crearVentanaCobro() {
  cobroDialogo = document.createElement('dialog');
  cobroDialogo.className = 'dialogo dialogo-ancho';
  cobroDialogo.id = 'dlg-cobro';
  cobroDialogo.setAttribute('aria-labelledby', 'd-titulo');
  cobroDialogo.innerHTML =
    '<form id="form-cobro" novalidate>' +
      '<h2 id="d-titulo">Cobrar mesa</h2>' +
      '<div class="cobro-cols">' +
      '<section class="cobro-detalle" aria-label="Detalle del pedido"><h3>Detalle del pedido</h3><p class="hint" id="d-pedido"></p><ul class="d-lineas" id="d-lineas"></ul><dl class="d-resumen" id="d-resumen"></dl></section>' +
      '<div class="cobro-pago">' +
      '<div class="d-fila"><div class="field"><label for="id_cliente">Cliente</label><select id="id_cliente" name="id_cliente"></select></div>' +
      '<div class="field"><label for="id_promocion">Promoción</label><select id="id_promocion" name="id_promocion"></select></div></div>' +
      '<p class="hint" id="d-promo-info"></p>' +
      '<fieldset class="metodos"><legend>Propina voluntaria</legend><div id="d-propinas">' + [['0', 'Sin propina'], ['5', '5 %'], ['10', '10 %'], ['15', '15 %'], ['otro', 'Otro valor']].map(function (o) {
        return '<label class="opcion"><input type="radio" name="propina_pct" value="' + o[0] + '"' + (o[0] === '0' ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
      }).join('') + '</div><div class="field" id="campo-propina" hidden><label for="propina">Propina en pesos</label><input id="propina" name="propina" type="number" min="0" step="100" inputmode="numeric" placeholder="0"></div></fieldset>' +
      '<fieldset class="metodos"><legend>Método de pago</legend><div id="d-metodos"></div></fieldset>' +
      '<div class="field" id="campo-ref"><label for="referencia_pago">Número de transacción</label><input id="referencia_pago" name="referencia_pago" type="text" maxlength="60" disabled><p class="hint">Obligatorio en pagos electrónicos.</p></div>' +
      '<div class="field" id="campo-recibido"><label for="recibido">Efectivo recibido</label><input id="recibido" name="recibido" type="number" min="0" step="1" inputmode="numeric" disabled><p class="hint" id="d-cambio"></p></div>' +
      '<fieldset class="metodos"><legend>Comprobante</legend><div id="d-comprobantes"></div><p class="hint" id="d-comprobante-info"></p></fieldset>' +
      '<div id="d-adquirente" hidden>' +
        '<p class="hint" id="d-adq-ayuda"></p>' +
        '<div class="d-fila"><div class="field"><label for="adq_tipo">Tipo de documento</label><select id="adq_tipo" name="adq_tipo"></select></div>' +
        '<div class="field"><label for="adq_numero">Número</label><input id="adq_numero" name="adq_numero" type="text" inputmode="numeric" maxlength="15" autocomplete="off"></div></div>' +
        '<div class="d-buscar"><button type="button" class="btn btn-sm" id="d-adq-buscar">Buscar datos del cliente</button><span class="hint" id="d-adq-estado"></span></div>' +
        '<div class="d-fila"><div class="field"><label for="adq_nombre">Nombre o razón social</label><input id="adq_nombre" name="adq_nombre" type="text" maxlength="120"></div>' +
        '<div class="field"><label for="adq_correo">Correo para enviar la factura</label><input id="adq_correo" name="adq_correo" type="text" inputmode="email" maxlength="120" autocomplete="off"></div></div>' +
      '</div></div></div>' +
      '<div class="d-acciones"><button type="button" class="btn" id="d-cancelar">Cancelar</button><button type="submit" class="btn btn-primary">Confirmar cobro</button></div>' +
    '</form>';
  document.body.appendChild(cobroDialogo);
  cobroForm = cobroDialogo.querySelector('form');
  cobroForm.adq_tipo.innerHTML = TIPOS_DOCUMENTO.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('');

  reaccionar(cobroForm, ajustarCamposCobro);
  cobroRevisar = vigilar(cobroForm, function () {
    var rec = cobroForm.recibido;
    if (!rec.disabled && rec.value !== '' && Number(rec.value) < totalAPagar()) return 'El efectivo recibido no cubre el total';
    var tipo = comprobanteElegido();
    if (tipo !== 'TICKET') {
      var sin = motivoSinNumeracion(tipo);
      if (sin) return sin;
      if (tipo === 'FACTURA' && (!cobroForm.adq_numero.value.trim() || !cobroForm.adq_nombre.value.trim())) return 'La factura necesita el documento y el nombre del cliente';
    }
    return '';
  }, true);
  document.getElementById('d-cancelar').addEventListener('click', function () { cobroDialogo.close(); });
  document.getElementById('d-adq-buscar').addEventListener('click', buscarAdquirente);
  cobroForm.id_cliente.addEventListener('change', function () { llenarPromos(true); elegirComprobante(); cobroForm.dispatchEvent(new Event('input', { bubbles: true })); });
  cobroForm.addEventListener('submit', registrarCobro);
}

function clienteDeCobro() { return cobroForm.id_cliente.value; }

function promoDeCobro() {
  var v = cobroForm.id_promocion.value;
  return v === '' ? null : ESTADO.promociones[Number(v)];
}

var CODIGO_DOC_CLIENTE = { CC: '13', NIT: '31', CE: '22', PA: '41', TI: '12' };

// El comprobante se propone solo: POS para el consumidor final y factura para una empresa; con un cliente registrado se llenan sus datos
function elegirComprobante() {
  var nombre = clienteDeCobro(), cliente = nombre ? clienteDe(nombre) : null, pref = comprobantePorDefecto(nombre);
  [].forEach.call(cobroForm.querySelectorAll('input[name="comprobante"]'), function (r) { r.checked = r.value === pref; });
  if (cliente && cliente.numDoc && comprobantesPermitidos()[0] !== 'TICKET') {
    cobroForm.adq_tipo.value = CODIGO_DOC_CLIENTE[cliente.tipoDoc] || cobroForm.adq_tipo.value;
    cobroForm.adq_numero.value = cliente.numDoc;
    cobroForm.adq_nombre.value = (cliente.nombre + ' ' + (cliente.apellidos || '')).trim();
    cobroForm.adq_correo.value = cliente.correo || '';
  }
  document.getElementById('d-comprobante-info').textContent = comprobantesPermitidos()[0] !== 'TICKET'
    ? 'La empresa cobra ' + impuestosVigentes().map(function (i) { return i.nombre.toLowerCase(); }).join(' e ') + ': cada venta lleva documento equivalente POS o factura electrónica (si el cliente la pide).'
    : (!obligadoFE() ? 'No obligado a facturar: se entrega ' + tituloComprobante().toLowerCase() + '.' : (debeFacturar() ? 'Se entrega ' + tituloComprobante().toLowerCase() + ', que no es factura. Falta configurar la DIAN en Caja.' : 'No cobra impuestos: se entrega ' + tituloComprobante().toLowerCase() + '.'));
}

function descLineasCobro() {
  var promo = promoDeCobro(), r = promo && cobroPedido ? evaluarPromo(cobroPedido, promo, clienteDeCobro()) : null;
  return r && r.aplica ? r.descLineas : null;
}

function totalDeCobro() {
  if (!cobroPedido) return { subtotal: 0, descuento: 0, impuesto: 0, total: 0, detalle: [] };
  return totalesDe(cobroPedido, 0, descLineasCobro());
}

// Solo se ofrecen las promociones que aplican a esta cuenta ahora (productos, día, hora y tipo de cliente); se deja marcada la que más descuenta
function llenarPromos(automatica) {
  var lista = promosAplicables(cobroPedido, clienteDeCobro());
  cobroForm.id_promocion.innerHTML = '<option value="">Sin promoción</option>' + lista.map(function (x) { return '<option value="' + x.indice + '">' + esc(x.promo.nombre) + ' · −' + pesos(x.resultado.descuento) + '</option>'; }).join('');
  if (automatica && lista.length) cobroForm.id_promocion.value = String(lista[0].indice);
  document.getElementById('d-promo-info').textContent = lista.length ? (automatica ? 'Se marcó la promoción que más descuenta; puedes quitarla.' : '') : 'No hay promociones que apliquen a esta cuenta.';
}

// Lo que se cobra, línea por línea, con descuento, impuestos y propina
function pintarResumenCobro(t, propina, pagar, abono) {
  var fila = function (a, b, clase) { return '<div' + (clase ? ' class="' + clase + '"' : '') + '><dt>' + a + '</dt><dd>' + b + '</dd></div>'; };
  var h = fila('Subtotal', pesos(t.subtotal));
  if (t.descuento) h += fila('Descuento', '− ' + pesos(t.descuento));
  t.detalle.forEach(function (i) { h += fila(esc(i.nombre) + ' ' + i.porcentaje + ' %', pesos(i.valor)); });
  if (!t.detalle.length) h += fila('Impuestos', 'No se cobran');
  if (propina) h += fila('Propina voluntaria', pesos(propina));
  if (abono) h += fila('Abono de la reservación', '− ' + pesos(abono));
  document.getElementById('d-resumen').innerHTML = h + fila('Total a pagar', pesos(pagar), 'gran');
}

function pintarLineasCobro(p) {
  document.getElementById('d-pedido').textContent = 'Pedido ' + p.n + ' · ' + (p.cliente === '—' ? 'Sin cliente' : p.cliente) + ' · desde las ' + p.fecha.slice(11);
  document.getElementById('d-lineas').innerHTML = p.lineas.map(function (l) {
    return '<li><span class="n">' + l.cant + ' ×</span><span class="p">' + esc(l.producto) + (l.esp ? '<small>' + esc(l.esp) + '</small>' : '') + (claveImp(l) === 'EXENTO' ? '<small>Exento de IVA</small>' : (claveImp(l) === 'EXCLUIDO' ? '<small>Excluido de impuesto</small>' : '')) + '</span><span class="v">' + pesos(l.cant * l.precio) + '</span></li>';
  }).join('') || '<li class="vacio">Sin productos.</li>';
}

function propinaDeCobro() { return Math.max(0, Number(cobroForm.propina.value) || 0); }
// El abono que el cliente dejó al reservar se descuenta de lo que paga ahora
function abonoDeCobro() { return cobroPedido && cobroPedido.abono ? Math.min(cobroPedido.abono, totalDeCobro().total + propinaDeCobro()) : 0; }
function totalAPagar() { return totalDeCobro().total + propinaDeCobro() - abonoDeCobro(); }

function metodoElegido() {
  var marcado = cobroForm.querySelector('input[name="metodo"]:checked');
  return marcado ? ESTADO.metodos[Number(marcado.value)] : null;
}

function comprobanteElegido() {
  var marcado = cobroForm.querySelector('input[name="comprobante"]:checked');
  return marcado ? marcado.value : 'TICKET';
}

// Consulta los datos del cliente con el proveedor activo (en pruebas, la tabla de la guía de la DIAN)
function buscarAdquirente() {
  var estado = document.getElementById('d-adq-estado');
  var numero = cobroForm.adq_numero.value.trim();
  if (!numero) { estado.textContent = 'Escribe el número de documento.'; return; }
  estado.textContent = 'Buscando…';
  proveedorActual().adquirente(cobroForm.adq_tipo.value, numero).then(function (c) {
    if (!c) { estado.textContent = 'No se encontró: escribe los datos a mano.'; return; }
    cobroForm.adq_nombre.value = c.nombre || '';
    cobroForm.adq_correo.value = c.correo || '';
    estado.textContent = 'Datos encontrados.';
    cobroForm.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// La referencia aparece si el pago es electrónico, el efectivo calcula el cambio y los datos del cliente aparecen si hay comprobante
function ajustarCamposCobro() {
  // La propina sale de un porcentaje del total (con impuesto y promoción) o se escribe en pesos con "Otro valor"
  var pct = cobroForm.propina_pct.value;
  document.getElementById('campo-propina').hidden = pct !== 'otro';
  if (pct !== 'otro') cobroForm.propina.value = pct === '0' ? '' : Math.round(totalDeCobro().total * Number(pct) / 100 / 100) * 100;
  var m = metodoElegido();
  var ref = cobroForm.referencia_pago;
  var rec = cobroForm.recibido;
  ref.disabled = !(m && m.referencia);
  ref.required = !ref.disabled;
  if (ref.disabled) ref.value = '';
  rec.disabled = !(m && !m.referencia);
  rec.required = !rec.disabled;
  if (rec.disabled) rec.value = '';
  document.getElementById('campo-ref').hidden = ref.disabled;
  document.getElementById('campo-recibido').hidden = rec.disabled;
  var t = totalDeCobro(), propina = propinaDeCobro(), abono = abonoDeCobro(), pagar = t.total + propina - abono;
  pintarResumenCobro(t, propina, pagar, abono);
  rec.min = pagar;
  document.getElementById('d-cambio').textContent = rec.disabled ? '' : (rec.value === '' ? 'Escribe lo que entrega el cliente.' : (Number(rec.value) >= pagar ? 'Cambio a devolver: ' + pesos(Number(rec.value) - pagar) : 'Falta ' + pesos(pagar - Number(rec.value)) + ' para cubrir el total.'));
  var tipo = comprobanteElegido();
  document.getElementById('d-adquirente').hidden = tipo === 'TICKET';
  document.getElementById('d-adq-ayuda').textContent = tipo === 'FACTURA' ? 'La factura electrónica necesita los datos del cliente.' : 'Opcional: si no lo llenas, el documento sale a nombre de "Consumidor final".';
}

function abrirCobro(pedido, alTerminar) {
  cobroPedido = pedido;
  cobroAlTerminar = alTerminar;
  if (!cobroDialogo) crearVentanaCobro();
  var html = '';
  ESTADO.metodos.forEach(function (m, i) {
    if (m.activo === false) return;
    html += '<label class="opcion"><input type="radio" name="metodo" value="' + i + '" required data-etiqueta="método de pago"><span><img src="icons/inicio/' + (ICONO_PAGO[m.nombre] || 'transferencia') + '.svg" alt="">' + esc(m.nombre) + '</span></label>';
  });
  document.getElementById('d-metodos').innerHTML = html;
  var porDefecto = comprobantePorDefecto(pedido.cliente === '—' ? '' : pedido.cliente);
  document.getElementById('d-comprobantes').innerHTML = comprobantesPermitidos().map(function (c) {
    return '<label class="opcion"><input type="radio" name="comprobante" value="' + c + '"' + (c === porDefecto ? ' checked' : '') + '><span>' + NOMBRE_COMPROBANTE[c] + '</span></label>';
  }).join('');
  var nombres = ESTADO.clientes.map(function (c) { return (c.nombre + ' ' + (c.apellidos || '')).trim(); });
  if (pedido.cliente !== '—' && nombres.indexOf(pedido.cliente) === -1) nombres.push(pedido.cliente);
  cobroForm.id_cliente.innerHTML = '<option value="">Sin cliente</option>' + nombres.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
  cobroForm.reset();
  cobroForm.id_cliente.value = pedido.cliente === '—' ? '' : pedido.cliente;
  llenarPromos(true);
  elegirComprobante();
  pintarLineasCobro(pedido);
  document.getElementById('d-adq-estado').textContent = '';
  document.getElementById('d-titulo').textContent = 'Cobrar mesa ' + pedido.mesa;
  cobroDialogo.showModal();
  cobroRevisar();
}

function registrarCobro(e) {
  e.preventDefault();
  var p = cobroPedido;
  var m = metodoElegido();
  var t = totalDeCobro();
  var propina = propinaDeCobro();
  var tipo = comprobanteElegido();
  var promoSel = promoDeCobro(), promo = promoSel ? promoSel.nombre : '', cliente = clienteDeCobro();
  var turno = turnoAbierto();
  var n = 0;
  ESTADO.ventas.forEach(function (v) { n = Math.max(n, v.n); });
  n += 1;
  var venta = { n: n, turno: turno.id, pedido: p.n, mesa: p.mesa, cliente: cliente || 'Sin cliente', metodo: m.nombre, efectivo: !m.referencia, recibido: !m.referencia ? Number(cobroForm.recibido.value) : 0, abono: abonoDeCobro(),
    ref: cobroForm.referencia_pago.value.trim(), promo: promo, subtotal: t.subtotal, descuento: t.descuento, impuesto: t.impuesto, propina: propina, total: t.total,
    tarifas: t.detalle.map(function (i) { return { clave: i.clave, codigo: i.codigo, nombre: i.nombre, porcentaje: i.porcentaje, base: i.base, valor: i.valor }; }), descLineas: descLineasCobro(), fecha: ahoraTexto(), cajero: usuarioActual(), factura: 'Sin factura', comprobante: 'TICKET', documento: '' };
  var adquirente = cobroForm.adq_numero.value.trim() ? { tipoDoc: cobroForm.adq_tipo.value, numero: cobroForm.adq_numero.value.trim(), nombre: cobroForm.adq_nombre.value.trim(), correo: cobroForm.adq_correo.value.trim() } : null;
  if (adquirente && !adquirente.nombre) adquirente.nombre = 'Cliente';
  ESTADO.ventas.push(venta);
  if (p.reserva) { var rv = buscarPor(ESTADO.reservas, 'n', p.reserva); if (rv && rv.anticipo && rv.anticipo.estado === 'Pagado') rv.anticipo.estado = 'Aplicado'; }
  p.estado = 'Facturado';
  p.cliente = cliente || '—';
  p.venta = n;
  var cambio = !m.referencia ? ' Cambio devuelto: ' + pesos(Number(cobroForm.recibido.value) - (t.total + propina - venta.abono)) + '.' : '';
  var base = 'Venta ' + n + ' registrada por ' + pesos(t.total + propina) + (venta.abono ? ' (se aplicó el abono de ' + pesos(venta.abono) + ' de la reservación)' : '') + '.' + cambio + ' La mesa ' + p.mesa + ' quedó libre.';
  cobroDialogo.close();
  actualizarMesas();
  if (buscarPor(ESTADO.mesas, 'n', p.mesa).estado === 'Por limpiar') notificar(['mesas'], 'Mesa ' + p.mesa + ' por limpiar', 'mesas.html', 'aviso');
  guardar();
  if (tipo === 'TICKET') { cobroAlTerminar(venta, base + ' Comprobante de pago, sin documento electrónico.'); imprimirTicket(venta); return; }
  cobroAlTerminar(venta, base + ' Enviando el documento electrónico…');
  emitirDocumento(venta, tipo, adquirente || CONSUMIDOR_FINAL).then(function (doc) {
    cobroAlTerminar(venta, base + ' ' + NOMBRE_COMPROBANTE[tipo] + ' ' + doc.id + ': ' + (doc.estado === 'Aceptado' ? 'aceptado.' : doc.estado.toLowerCase() + '. Revísalo en Caja, Facturación.'));
    imprimirTicket(venta, doc);
  }, function (err) {
    cobroAlTerminar(venta, base + ' No se pudo emitir el documento: ' + err.message);
    imprimirTicket(venta);
  });
}
