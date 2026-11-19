/* Caja: Facturación (documentos electrónicos, notas crédito, reenvíos), Métodos de pago y Datos de facturación (emisor, numeración, conexión con la API).
   La lógica de la DIAN está en facturacion.js; aquí solo están las pantallas. */

var filtroDoc = 'todos';
var FILTROS_DOC = [['todos', 'Todos'], ['Aceptado', 'Aceptados'], ['revisar', 'Por revisar'], ['NC', 'Notas crédito']];
var MEDIOS_DIAN = [['10', '10 · Efectivo'], ['42', '42 · Consignación bancaria'], ['45', '45 · Transferencia crédito bancario'], ['47', '47 · Transferencia débito bancaria'], ['48', '48 · Tarjeta crédito'], ['49', '49 · Tarjeta débito'], ['ZZZ', 'ZZZ · Otro acuerdo']];

function porReenviar() { return ESTADO.documentos.filter(function (d) { return d.estado === 'Error' || d.estado === 'Por reenviar'; }); }
function ventasSinDocumento() { return ESTADO.ventas.filter(function (v) { return !v.anulada && !v.documento; }); }
function nombreAmbiente(a) { return a === '1' ? 'Producción' : 'Habilitación (pruebas)'; }

// ---------- Facturación ----------
function pasaFiltroDoc(d) {
  if (filtroDoc === 'todos') return true;
  if (filtroDoc === 'NC') return d.tipo === 'NC';
  if (filtroDoc === 'revisar') return d.estado !== 'Aceptado';
  return d.estado === filtroDoc;
}

function vistaFacturacion() {
  var f = cfgFE(), rev = porReenviar().length, sin = ventasSinDocumento().length;
  var h = barraInfo('<b>' + esc(textoPerfilFacturacion()) + '</b> · ' + nombreAmbiente(f.ambiente) + ' · ' + esc(proveedorActual().nombre) + (sin ? ' · ' + sin + (sin === 1 ? ' venta sin documento' : ' ventas sin documento') : ''),
    boton('fe-reenviar', 'Reenviar pendientes' + (rev ? ' (' + rev + ')' : ''), rev ? '' : ' disabled') + boton('fe-facturar', 'Generar documento', sin ? '' : ' disabled', 'btn-primary'));
  var lista = ESTADO.documentos.filter(pasaFiltroDoc).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
  if (!lista.length) return h + vacio('No hay documentos ' + (filtroDoc === 'todos' ? 'todavía. Se crean al cobrar con factura o documento POS.' : 'con este filtro.'));
  var dia = '', abierto = false;
  lista.forEach(function (d) {
    if (d.fecha.slice(0, 10) !== dia) {
      dia = d.fecha.slice(0, 10);
      if (abierto) h += '</div>';
      h += '<h3 class="grupo-w">' + diaLargo(dia) + '</h3><div class="widgets">';
      abierto = true;
    }
    var nc = d.tipo === 'NC';
    h += '<article class="widget w-doc' + (d.estado === 'Aceptado' ? '' : ' w-punteada') + (nc ? ' w-gris' : '') + '" data-ca="doc" data-d="' + d.id + '">' +
      '<div class="w-cab"><img src="icons/inicio/factura.svg" alt=""><b>' + esc(d.id) + '</b></div>' +
      '<p class="w-valor">' + (nc ? '− ' : '') + pesos(d.total) + '</p>' +
      '<p class="w-sub">' + esc(d.adquirente.nombre || 'Consumidor final') + '</p>' +
      '<p class="w-sub">' + NOMBRE_COMPROBANTE[d.tipo] + ' · ' + d.fecha.slice(11) + '</p>' +
      '<div class="w-pie"><span class="w-estado">' + d.estado + ' · simulación</span></div></article>';
  });
  return h + '</div>';
}

ACCIONES['fe-reenviar'] = function () {
  aviso('Reenviando…');
  reenviarPendientes().then(function (n) { aviso(n + (n === 1 ? ' documento reenviado.' : ' documentos reenviados.') + ' Revisa su estado.'); pintarTodo(); });
};

ACCIONES['fe-facturar'] = function () {
  var lista = ventasSinDocumento();
  if (!lista.length) return;
  abrirFormulario({ titulo: 'Generar documento', ayuda: 'Elige la venta que quieres facturar o convertir en documento POS.', boton: 'Continuar',
    campos: [{ id: 'venta', etiqueta: 'Venta', tipo: 'select', ancho: true, opciones: lista.map(function (v) { return [v.n, 'Comprobante ' + v.n + ' · ' + v.cliente + ' · ' + pesos(v.total) + ' · ' + v.fecha.slice(5, 16)]; }) }],
    alGuardar: function (val) { setTimeout(function () { formularioFacturar(ventaPor(Number(val.venta))); }, 0); } });
};

ACCIONES.doc = function (el) { verDocumento(el.dataset.d); };

// Datos del cliente y tipo de documento para una venta que ya se cobró
function formularioFacturar(v) {
  var anterior = '';
  abrirFormulario({ titulo: 'Documento para el comprobante ' + v.n, ayuda: 'Total ' + pesos(v.total) + '. El cliente puede pedir la factura el mismo día del consumo.', boton: 'Generar y enviar', ancha: true,
    campos: [
      { id: 'tipo', etiqueta: 'Qué generar', tipo: 'chips', opciones: [['FACTURA', 'Factura electrónica'], ['POS', 'Documento equivalente POS']], valor: 'FACTURA', ancho: true },
      { id: 'tipoDoc', etiqueta: 'Tipo de documento', tipo: 'select', opciones: TIPOS_DOCUMENTO },
      { id: 'numero', etiqueta: 'Número de documento', tipo: 'text', largo: 15, ayuda: 'Si está en la base de la DIAN (en pruebas, la tabla de la guía), el nombre y el correo se completan solos.' },
      { id: 'nombre', etiqueta: 'Nombre o razón social', tipo: 'text', largo: 120 },
      { id: 'correo', etiqueta: 'Correo', tipo: 'text', largo: 120 }],
    alCambiar: function (val, dlg) {
      var clave = val.tipoDoc + '|' + val.numero;
      if (val.numero.length < 5 || clave === anterior) return;
      anterior = clave;
      proveedorActual().adquirente(val.tipoDoc, val.numero).then(function (c) {
        if (!c) return;
        var n = dlg.querySelector('[name="nombre"]'), m = dlg.querySelector('[name="correo"]');
        if (!n.value) n.value = c.nombre || '';
        if (!m.value) m.value = c.correo || '';
      });
    },
    alGuardar: function (val) {
      if (val.tipo === 'FACTURA' && (!val.numero || !val.nombre)) return 'La factura necesita el documento y el nombre del cliente.';
      var adq = val.numero ? { tipoDoc: val.tipoDoc, numero: val.numero, nombre: val.nombre || 'Cliente', correo: val.correo } : CONSUMIDOR_FINAL;
      return emitirDocumento(v, val.tipo, adq).then(function (doc) {
        aviso(NOMBRE_COMPROBANTE[val.tipo] + ' ' + doc.id + ': ' + (doc.estado === 'Aceptado' ? 'aceptado.' : doc.estado.toLowerCase() + '. Revísalo en Facturación.'));
        irA('facturacion');
        return '';
      }, function (err) { return err.message; });
    } });
}

function formularioNota(doc) {
  var venta = ventaPor(doc.venta), saldo = saldoAcreditable(doc);
  if (saldo <= 0) { aviso('Esta factura ya fue acreditada por completo.'); return; }
  abrirFormulario({ titulo: 'Nota crédito sobre ' + doc.id, ayuda: 'Se puede acreditar hasta ' + pesos(saldo) + '. Corrige la factura sin borrarla.', boton: 'Emitir nota crédito',
    campos: [
      { id: 'motivo', etiqueta: 'Motivo', tipo: 'select', opciones: MOTIVOS_NOTA, ancho: true },
      { id: 'valor', etiqueta: 'Valor a acreditar ($)', tipo: 'number', requerido: true, min: 1, max: saldo, step: 1, valor: saldo, ayuda: 'La anulación acredita el total.' },
      { id: 'efectivo', etiqueta: 'Devolví el dinero en efectivo', tipo: 'check', ancho: true }],
    alGuardar: function (val) {
      var valor = val.motivo === '2' ? saldo : val.valor;
      var t = turnoAbierto();
      if (val.efectivo && (!t || valor > efectivoEsperado(t))) return t ? 'Solo hay ' + pesos(efectivoEsperado(t)) + ' en el cajón.' : 'Abre la caja para registrar la devolución en efectivo.';
      return emitirNotaCredito(doc, MOTIVOS_NOTA.filter(function (m) { return m[0] === val.motivo; })[0][1], valor).then(function (nota) {
        if (val.efectivo && nota.estado === 'Aceptado') ESTADO.movimientosCaja.push({ n: ESTADO.movimientosCaja.length + 1, turno: t.id, tipo: 'EGRESO', concepto: 'Devolución al cliente', valor: valor, soporte: nota.id, detalle: 'Nota crédito sobre ' + doc.id, fecha: ahoraTexto(), quien: usuarioActual() });
        guardar();
        aviso('Nota crédito ' + nota.id + ': ' + nota.estado.toLowerCase() + '.');
        irA('facturacion');
        return '';
      }, function (err) { return err.message; });
    } });
}

function descargarXml(doc) {
  var blob = new Blob([xmlDe(armarPayload(doc))], { type: 'application/xml' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = doc.id + '.xml';
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}

function representacionGrafica(doc) {
  var p = armarPayload(doc), a = p.adquirente;
  var cuerpo = '<h1>' + esc(p.emisor.razonSocial) + '</h1><p class="c">NIT ' + esc(p.emisor.nit || '—') + (p.emisor.dv ? '-' + esc(p.emisor.dv) : '') + ' · ' + esc(p.emisor.municipio) + '</p><p class="c"><b>' + NOMBRE_COMPROBANTE[doc.tipo].toUpperCase() + ' ' + esc(doc.id) + '</b></p><p class="c">' + doc.fecha + (doc.ambiente === '2' ? ' · AMBIENTE DE PRUEBAS' : '') + '</p>' +
    '<h2>Adquirente</h2><p>' + esc(a.nombre || 'Consumidor final') + '</p><p>' + (TIPOS_DOCUMENTO.filter(function (t) { return t[0] === a.tipoDoc; })[0] || ['', 'Doc.'])[1] + ' ' + esc(a.numero) + '</p><h2>Detalle</h2>';
  p.lineas.forEach(function (l) { cuerpo += filaImp(l.cantidad + ' × ' + esc(l.descripcion), pesos(l.base)); });
  cuerpo += '<h2>Totales</h2>' + filaImp('Subtotal', pesos(p.totales.subtotal)) + (p.totales.descuentos ? filaImp('Descuentos', '− ' + pesos(p.totales.descuentos)) : '');
  p.impuestos.forEach(function (t) { cuerpo += filaImp(t.nombre + ' ' + t.porcentaje + ' % sobre ' + pesos(t.base), pesos(t.valor)); });
  cuerpo += filaImp('TOTAL', pesos(p.totales.total), 'g') + '<p class="m">Código demostrativo (no CUFE/CUDE): ' + esc(doc.cufe) + '</p><p class="c m">Simulación local. No se envió a la DIAN; no tiene validez fiscal.</p>';
  imprimirHtml(doc.id, cuerpo);
}

function verDocumento(id) {
  var doc = documentoDe(id);
  if (!doc) return;
  var v = ventaPor(doc.venta), a = doc.adquirente;
  var tipoDoc = (TIPOS_DOCUMENTO.filter(function (t) { return t[0] === a.tipoDoc; })[0] || ['', 'Documento'])[1];
  var intentos = doc.intentos.length ? doc.intentos.map(function (i) { return '<li><span>' + i.fecha.slice(5, 16) + '</span><span>' + esc(i.estado) + ' · ' + esc(i.detalle) + '</span></li>'; }).join('') : '<li><span>—</span><span>Todavía sin envíos.</span></li>';
  var notas = ESTADO.documentos.filter(function (n) { return n.tipo === 'NC' && n.ref === doc.id; });
  var pendiente = doc.estado === 'Error' || doc.estado === 'Por reenviar';
  var botones = [];
  if (pendiente || doc.estado === 'Rechazado') botones.push({ texto: pendiente ? 'Reenviar' : 'Volver a enviar', primario: true, alClic: function (d) { d.close(); enviarDocumento(doc).then(function () { aviso(doc.id + ': ' + doc.estado.toLowerCase() + '.'); pintarTodo(); }); } });
  botones.push({ texto: 'Consultar estado', alClic: function (d) { d.close(); proveedorActual().consultar(doc).then(function (r) { aviso(doc.id + ': ' + (r.mensaje || r.estado)); }); } });
  botones.push({ texto: 'Ver XML', alClic: function () { abrirVentana({ titulo: 'XML de demostración ' + doc.id, ancha: true, ayuda: 'Ejemplo sin firma electrónica ni validez fiscal. La transmisión real requiere un backend y un proveedor.', cuerpo: '<pre class="codigo">' + esc(xmlDe(armarPayload(doc))) + '</pre>',
    botones: [{ texto: 'Descargar XML', primario: true, alClic: function () { descargarXml(doc); } }] }); } });
  botones.push({ texto: 'Imprimir / PDF', alClic: function () { representacionGrafica(doc); } });
  botones.push({ texto: 'Enviar por correo', alClic: function (d) { d.close(); aviso(a.correo ? 'Simulación: se enviaría ' + doc.id + ' a ' + a.correo + '.' : 'El cliente no tiene correo registrado.'); } });
  if (doc.tipo !== 'NC' && doc.estado === 'Aceptado' && saldoAcreditable(doc) > 0) botones.push({ texto: 'Nota crédito', alClic: function (d) { d.close(); formularioNota(doc); } });
  abrirVentana({ titulo: NOMBRE_COMPROBANTE[doc.tipo] + ' ' + doc.id, ancha: true,
    ayuda: '<span class="est-res"><i class="pt ' + (doc.estado === 'Aceptado' ? 'conf' : 'pend') + '"></i>' + doc.estado + ' · simulación local, sin envío DIAN</span>',
    cuerpo: '<dl class="tk-datos"><div><dt>Fecha</dt><dd>' + doc.fecha + '</dd></div><div><dt>Cliente</dt><dd>' + esc(a.nombre || 'Consumidor final') + '</dd></div><div><dt>' + esc(tipoDoc) + '</dt><dd>' + esc(a.numero) + '</dd></div>' +
      '<div><dt>Correo</dt><dd>' + esc(a.correo || '—') + '</dd></div><div><dt>Medio de pago</dt><dd>' + esc(v ? v.metodo : '—') + ' (' + esc(v ? (cfgFE().mediosPago[v.metodo] || 'ZZZ') : '') + ')</dd></div>' +
      '<div><dt>Total</dt><dd>' + (doc.tipo === 'NC' ? '− ' : '') + pesos(doc.total) + '</dd></div>' + (doc.ref ? '<div><dt>Afecta a</dt><dd>' + esc(doc.ref) + '</dd></div><div><dt>Motivo</dt><dd>' + esc(doc.motivo) + '</dd></div>' : '') +
      (v ? '<div><dt>Venta</dt><dd><button type="button" class="enlace" data-ver-ticket="' + v.n + '">Comprobante ' + v.n + '</button></dd></div>' : '') + '</dl>' +
      '<div class="cufe"><span>' + (doc.tipo === 'FACTURA' ? 'CUFE' : 'CUDE') + '</span><code>' + esc(doc.cufe || 'Aún sin calcular') + '</code><button type="button" class="enlace" data-copiar-cufe>Copiar</button></div>' +
      (notas.length ? '<h3 class="tk-sub">Notas crédito</h3><ul class="tk-intentos">' + notas.map(function (n) { return '<li><span>' + esc(n.id) + '</span><span>' + pesos(n.total) + ' · ' + n.estado + ' · ' + esc(n.motivo) + '</span></li>'; }).join('') + '</ul>' : '') +
      '<h3 class="tk-sub">Envíos al proveedor</h3><ul class="tk-intentos">' + intentos + '</ul>',
    botones: botones }).addEventListener('click', function (e) {
      if (e.target.closest('[data-copiar-cufe]')) copiar(doc.cufe, 'Código copiado.');
      var t = e.target.closest('[data-ver-ticket]');
      if (t) { e.currentTarget.close(); vista = 'tickets'; pintarTodo(); abrirTicket(Number(t.dataset.verTicket)); }
    });
}

// ---------- Datos de facturación (configuración) ----------

function widgetConfig(titulo, filas, botones, clase) {
  return '<article class="widget w-config' + (clase || '') + '"><div class="w-cab"><b>' + esc(titulo).toUpperCase() + '</b></div><dl class="w-lista">' +
    filas.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>'; }).join('') + '</dl><div class="w-pie">' + botones + '</div></article>';
}

function seccion(titulo) { return '<h3 class="grupo-w">' + esc(titulo) + '</h3>'; }

function vistaConfiguracion() {
  var f = cfgFE(), e = f.emisor, obligado = e.obligado;
  var h = '<div class="widgets">' + widgetConfig('¿Facturas electrónicamente?', [['Respuesta', obligado === undefined ? 'Sin responder' : (obligado ? 'Sí, está obligado' : 'No está obligado')], ['Sale', esc(textoPerfilFacturacion())]],
    btnFila('cfg-obligado', obligado === undefined ? 'Responder' : 'Cambiar', undefined, obligado === undefined), obligado === undefined ? ' w-punteada' : '') + '</div>';
  if (obligado === false) {
    h += seccion('Tu negocio y el comprobante');
    h += '<div class="widgets">' + widgetConfig('Negocio', [['Nombre comercial', esc(e.nombreComercial)], ['Propietario', esc(e.razonSocial)], ['Documento', esc(e.nit ? (e.docTipo || 'CC') + ' ' + e.nit : 'Sin registrar')], ['Dirección', esc(e.direccion || 'Sin registrar')], ['Teléfono', esc(e.telefono || 'Sin registrar')]], btnFila('cfg-negocio', 'Editar'), e.nit ? '' : ' w-punteada');
    h += widgetConfig('Comprobante', [['Título', esc(tituloComprobante())], ['Próximo número', 'N.º ' + ('00' + siguienteVenta()).slice(-3)], ['Leyenda', esc(leyendaComprobante() || 'Sin leyenda')]], btnFila('cfg-comprobante', 'Editar')) + '</div>';
    return h;
  }
  h += seccion('Datos del emisor');
  h += '<div class="widgets">' + widgetConfig('Emisor', [['Razón social', esc(e.razonSocial)], ['NIT', esc(e.nit ? e.nit + (e.dv ? '-' + e.dv : '') : 'Sin registrar')], ['Municipio', esc(e.municipio + ', ' + e.departamento)], ['Actividad (CIIU)', esc(e.ciiu)]], btnFila('cfg-emisor', 'Editar'), e.nit ? '' : ' w-punteada');
  h += widgetConfig('Impuestos', f.impuestos.map(function (i) { return [esc(i.nombre) + ' ' + i.tarifa + ' %', impuestoCobrable(i.clave) ? 'Se cobra' : 'No se cobra']; }), btnFila('cfg-impuestos', 'Editar')) + '</div>';
  h += seccion('Numeración autorizada') + '<div class="widgets">';
  ESTADO.facturacion.resoluciones.forEach(function (r, i) {
    var est = estadoResolucion(r);
    h += widgetConfig('Numeración · ' + NOMBRE_COMPROBANTE[r.tipo], [['Prefijo y rango', esc(r.prefijo) + ' ' + r.desde + ' a ' + r.hasta], ['Próximo número', esc(r.prefijo) + r.actual], ['Resolución', esc(r.resolucion || 'Sin resolución')], ['Vigencia', r.vigenciaHasta ? esc(r.vigenciaDesde + ' a ' + r.vigenciaHasta) : 'Sin fechas'], ['Estado', esc(est.texto)]],
      btnFila('cfg-numeracion', 'Editar', i), est.ok && est.clave !== 'poco' ? '' : ' w-punteada');
  });
  h += '</div>' + seccion('Facturación de demostración') + '<div class="widgets">';
  h += widgetConfig('Cómo se envía', [['Ambiente', nombreAmbiente(f.ambiente)], ['Proveedor', esc(proveedorActual().nombre)]], btnFila('cfg-modo', 'Editar'));
  h += widgetConfig('Conexión con proveedor', [['Estado', 'Requiere backend; no conectada'], ['Credenciales', 'No se solicitan ni guardan en el navegador']],
    btnFila('api-formato', 'Ver formato') + btnFila('api-guia', 'Ver requisitos del backend'));
  h += widgetConfig('Guía de conexión', [['Qué es', 'Cómo conectar la API de un proveedor de facturación'], ['Incluye', 'Pasos, formato de envío y advertencias']], btnFila('api-guia', 'Leer guía', undefined, true));
  return h + '</div>';
}

function siguienteVenta() { var n = 0; ESTADO.ventas.forEach(function (v) { n = Math.max(n, v.n); }); return n + 1; }

ACCIONES['cfg-obligado'] = function () {
  var e = cfgFE().emisor;
  abrirFormulario({ titulo: '¿Está obligado a facturar electrónicamente?', boton: 'Guardar',
    campos: [{ id: 'obligado', etiqueta: 'Respuesta', tipo: 'chips', opciones: [['si', 'Sí, estoy obligado'], ['no', 'No estoy obligado']], valor: e.obligado === false ? 'no' : (e.obligado ? 'si' : ''), ancho: true }],
    alGuardar: function (v) {
      if (!v.obligado) return 'Elige una respuesta.';
      e.obligado = v.obligado === 'si';
      NOMBRE_COMPROBANTE.TICKET = tituloComprobante();
      guardarConfig(e.obligado ? 'Factura electrónica: configura el emisor, la numeración y la conexión con la DIAN.' : 'Sin factura: se entrega ' + tituloComprobante().toLowerCase() + ' con la leyenda de no obligado.');
    } });
};

ACCIONES['cfg-negocio'] = function () {
  var e = cfgFE().emisor;
  abrirFormulario({ titulo: 'Tu negocio', boton: 'Guardar', ancha: true,
    campos: [
      { id: 'nombreComercial', etiqueta: 'Nombre comercial', tipo: 'text', valor: e.nombreComercial, requerido: true, largo: 60 },
      { id: 'razonSocial', etiqueta: 'Propietario', tipo: 'text', valor: e.razonSocial, requerido: true, largo: 80 },
      { id: 'docTipo', etiqueta: 'Tipo de documento', tipo: 'select', opciones: [['CC', 'Cédula'], ['CE', 'Cédula de extranjería'], ['NIT', 'NIT']], valor: e.docTipo || 'CC' },
      { id: 'nit', etiqueta: 'Número de documento', tipo: 'text', valor: e.nit, requerido: true, largo: 15 },
      { id: 'direccion', etiqueta: 'Dirección', tipo: 'text', valor: e.direccion, largo: 80 },
      { id: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', valor: e.telefono, largo: 15 }],
    alGuardar: function (v) {
      if (!/^[0-9A-Za-z]{5,15}$/.test(v.nit)) return 'El documento lleva de 5 a 15 letras o números, sin puntos.';
      Object.assign(e, { nombreComercial: v.nombreComercial, razonSocial: v.razonSocial, docTipo: v.docTipo, nit: v.nit, direccion: v.direccion, telefono: v.telefono });
      guardarConfig('Datos del negocio guardados.');
    } });
};

ACCIONES['cfg-comprobante'] = function () {
  var e = cfgFE().emisor;
  abrirFormulario({ titulo: 'Comprobante', boton: 'Guardar', ancha: true,
    campos: [
      { id: 'titulo', etiqueta: 'Título del documento', tipo: 'select', opciones: ['Comprobante de pago', 'Comprobante de venta interno', 'Cuenta de mesa', 'Estado de cuenta'].map(function (t) { return [t, t]; }), valor: tituloComprobante(), ancho: true, ayuda: 'Nunca lleva la palabra factura.' },
      { id: 'leyenda', etiqueta: 'Leyenda al final', tipo: 'text', valor: leyendaComprobante(), largo: 160, ancho: true }],
    alGuardar: function (v) {
      if (/factura/i.test(v.leyenda.replace(/no obligado a facturar/gi, ''))) return 'La leyenda no puede decir factura.';
      e.tituloComprobante = v.titulo; e.leyenda = v.leyenda;
      NOMBRE_COMPROBANTE.TICKET = v.titulo;
      guardarConfig('Comprobante guardado.');
    } });
};

// ---------- Métodos de pago ----------
function vistaMetodos() {
  var f = cfgFE();
  var h = barraInfo('Los habilitados aparecen al cobrar. El código DIAN es el medio de pago que va en el documento electrónico.', boton('metodo-nuevo', '+ Nuevo método')) + '<div class="widgets">';
  ESTADO.metodos.forEach(function (m, i) {
    var activo = m.activo !== false;
    h += '<article class="widget w-metodo' + (activo ? '' : ' w-apagada') + '"><div class="w-cab"><img src="icons/inicio/' + (ICONO_PAGO[m.nombre] || 'transferencia') + '.svg" alt=""><b>' + esc(m.nombre).toUpperCase() + '</b></div>' +
      '<p class="w-sub">' + (m.referencia ? 'Pide número de transacción' : 'No pide número de transacción') + '</p><p class="w-sub">Código DIAN ' + esc(f.mediosPago[m.nombre] || 'ZZZ') + '</p>' +
      '<div class="w-pie">' + btnFila('metodo-cambiar', activo ? 'Inhabilitar' : 'Habilitar', i) + '</div></article>';
  });
  return h + '</div>';
}

function guardarConfig(texto) { guardar(); aviso(texto); pintarTodo(); }

ACCIONES['cfg-modo'] = function () {
  var f = cfgFE();
  abrirFormulario({ titulo: 'Cómo se factura', ayuda: 'Modo de demostración. La emisión electrónica real requiere backend y no está habilitada en esta versión frontend.', boton: 'Guardar',
    campos: [
      { id: 'proveedor', etiqueta: 'Proveedor de demostración', tipo: 'chips', opciones: [['simulado', PROVEEDORES.simulado.nombre]], valor: 'simulado', ancho: true }],
    alGuardar: function () { f.ambiente = '2'; f.proveedor = 'simulado'; guardarConfig('Configuración de demostración guardada. La emisión real requiere backend.'); } });
};

ACCIONES['cfg-impuestos'] = function () {
  var lista = cfgFE().impuestos, responsable = esResponsableDeIva();
  var TEXTOS = {
    INC8: ['Cobrar impoconsumo (Impuesto Nacional al Consumo)', 'Es del 8 % sobre el servicio de comidas y bebidas en restaurantes, bares, tabernas y discotecas (Estatuto Tributario, art. 512-1). Reemplaza al IVA en esos productos. Las personas naturales con ingresos menores a 3.500 UVT y un solo establecimiento no están obligadas: pregunta al contador.'],
    IVA19: ['Cobrar IVA, tarifa general', 'Es del 19 % (art. 468). Solo lo cobra una empresa responsable de IVA; en un bar con impoconsumo no se usa para la carta.'],
    IVA5: ['Cobrar IVA, tarifa del 5 %', 'Es del 5 % (art. 468-1) y aplica solo a los bienes que la ley señala. Solo lo cobra una empresa responsable de IVA.']
  };
  var campos = [];
  lista.forEach(function (i) {
    var iva = i.codigo === '01', t = TEXTOS[i.clave] || ['Cobrar ' + i.nombre, ''];
    campos.push({ id: i.clave + '_activo', etiqueta: t[0], tipo: 'check', valor: i.activo && (!iva || responsable), ancho: true });
    campos.push({ id: i.clave + '_tarifa', etiqueta: 'Tarifa (%)', tipo: 'number', valor: i.tarifa, min: 0, max: 100, step: 0.5, ayuda: t[1] + (iva && !responsable ? ' Ahora la empresa figura como NO responsable de IVA (Datos del emisor, Régimen), por eso no se cobra.' : ''), ancho: true });
  });
  abrirFormulario({ titulo: 'Impuestos que se cobran', boton: 'Guardar', ancha: true,
    ayuda: 'Cada producto lleva su propia clase de impuesto (Productos y recetas, Editar datos): impoconsumo, IVA 19 %, IVA 5 %, exento o excluido. Aquí se define cuáles puede cobrar la empresa y a qué tarifa. Los cambios valen para las ventas nuevas.',
    campos: campos,
    alGuardar: function (val) {
      lista.forEach(function (i) {
        var iva = i.codigo === '01';
        i.activo = val[i.clave + '_activo'] && (!iva || responsable);
        if (val[i.clave + '_tarifa'] !== '') i.tarifa = val[i.clave + '_tarifa'];
      });
      guardarConfig('Impuestos guardados: ' + lista.map(function (i) { return i.nombre + ' ' + i.tarifa + ' %' + (impuestoCobrable(i.clave) ? '' : ' (no se cobra)'); }).join(' · ') + '.');
    } });
};

function regimenes(actual) {
  var l = [['No responsable de IVA', 'No responsable de IVA'], ['Responsable de IVA', 'Responsable de IVA (O-48)'], ['Régimen simple de tributación', 'Régimen simple de tributación (SIMPLE)']];
  if (!buscarPor(l.map(function (x) { return { k: x[0] }; }), 'k', actual)) l.push([actual, actual]);
  return l;
}

ACCIONES['cfg-emisor'] = function () {
  var e = cfgFE().emisor;
  var campo = function (id, etiqueta, extra) { return Object.assign({ id: id, etiqueta: etiqueta, tipo: 'text', valor: e[id], largo: 120 }, extra || {}); };
  abrirFormulario({ titulo: 'Datos del emisor', ayuda: 'Los mismos que están en el RUT de la empresa.', boton: 'Guardar', ancha: true,
    campos: [campo('razonSocial', 'Razón social o nombre', { requerido: true }), campo('nombreComercial', 'Nombre comercial'), campo('nit', 'NIT (sin dígito de verificación)', { largo: 12 }), campo('dv', 'Dígito de verificación', { largo: 1 }),
      campo('tipoPersona', 'Tipo de persona', { tipo: 'select', opciones: [['1', 'Persona jurídica'], ['2', 'Persona natural']] }), campo('responsabilidades', 'Responsabilidad fiscal (RUT)', { largo: 40 }),
      campo('regimen', 'Régimen', { tipo: 'select', opciones: regimenes(e.regimen), ayuda: 'Define si la empresa cobra IVA. Un bar que cobra impoconsumo normalmente figura como no responsable de IVA (RUT, responsabilidad R-99-PN).' }), campo('ciiu', 'Actividad económica (CIIU)', { largo: 6 }), campo('direccion', 'Dirección'), campo('municipio', 'Municipio'), campo('departamento', 'Departamento'),
      campo('codigoMunicipio', 'Código DANE del municipio', { largo: 5 }), campo('telefono', 'Teléfono', { largo: 20 }), campo('correo', 'Correo de la empresa', { tipo: 'email' })],
    alGuardar: function (val) {
      if (val.nit && !/^\d{5,12}$/.test(val.nit)) return 'El NIT debe tener entre 5 y 12 números, sin puntos ni guiones.';
      Object.keys(val).forEach(function (k) { e[k] = val[k]; });
      guardarConfig('Datos del emisor guardados.');
    } });
};

ACCIONES['cfg-numeracion'] = function (el) {
  var r = cfgFE().resoluciones[Number(el.dataset.d)];
  var campo = function (id, etiqueta, extra) { return Object.assign({ id: id, etiqueta: etiqueta, tipo: 'text', valor: r[id] }, extra || {}); };
  abrirFormulario({ titulo: 'Numeración · ' + NOMBRE_COMPROBANTE[r.tipo], ayuda: 'Datos de la resolución de numeración que autorizó la DIAN. En habilitación puedes usar el rango de pruebas.', boton: 'Guardar', ancha: true,
    campos: [campo('prefijo', 'Prefijo', { largo: 6, requerido: true }), campo('resolucion', 'Número de resolución', { largo: 20 }), campo('desde', 'Desde', { tipo: 'number', min: 1, requerido: true }), campo('hasta', 'Hasta', { tipo: 'number', min: 1, requerido: true }),
      campo('actual', 'Próximo número', { tipo: 'number', min: 1, requerido: true }), campo('fechaResolucion', 'Fecha de la resolución', { tipo: 'date' }), campo('vigenciaDesde', 'Vigente desde', { tipo: 'date' }), campo('vigenciaHasta', 'Vigente hasta', { tipo: 'date' })],
    alGuardar: function (val) {
      if (val.hasta < val.desde) return 'El rango final no puede ser menor que el inicial.';
      if (val.actual < val.desde) return 'El próximo número no puede ser menor que el inicio del rango.';
      Object.keys(val).forEach(function (k) { r[k] = val[k]; });
      guardarConfig('Numeración de ' + NOMBRE_COMPROBANTE[r.tipo].toLowerCase() + ' guardada.');
    } });
};

ACCIONES['api-formato'] = function () {
  var v = ESTADO.ventas.filter(function (x) { return !x.anulada; })[0];
  if (!v) { aviso('Todavía no hay ventas para mostrar un ejemplo.'); return; }
  var doc = { id: 'RAN0', tipo: 'FACTURA', prefijo: 'RAN', consecutivo: 0, venta: v.n, ref: '', fecha: v.fecha, estado: 'Enviando', cufe: '(se calcula al emitir)', ambiente: cfgFE().ambiente, adquirente: CONSUMIDOR_FINAL, total: v.total, motivo: '', intentos: [] };
  abrirVentana({ titulo: 'Formato de envío', ancha: true,
    ayuda: 'Ejemplo JSON para ilustrar la interfaz. No se envía a ningún proveedor y no genera un documento fiscal válido.',
    cuerpo: '<pre class="codigo">' + esc(JSON.stringify(armarPayload(doc), null, 2)) + '</pre><h3 class="tk-sub">Rutas configuradas</h3><ul class="tk-intentos">' +
      Object.keys(cfgFE().api.rutas).map(function (k) { return '<li><span>' + k + '</span><span>' + esc(cfgFE().api.rutas[k]) + '</span></li>'; }).join('') + '</ul>',
    botones: [{ texto: 'Copiar JSON', primario: true, alClic: function () { copiar(JSON.stringify(armarPayload(doc), null, 2), 'JSON copiado.'); } }] });
};

// ---------- Guía de conexión (el mismo contenido del LEEME.txt) ----------
var GUIA_API = '<div class="guia">' +
  '<h3>Estado de esta versión</h3><p>Esta entrega contiene solo frontend. La emisión que aparece en pantalla es una simulación local; no transmite documentos a la DIAN ni a un proveedor. Los códigos mostrados son datos de demostración y no tienen validez fiscal.</p>' +
  '<h3>Qué requiere una versión conectada</h3><ol>' +
  '<li>Un backend autenticado que reciba la solicitud del frontend.</li>' +
  '<li>El backend debe validar permisos, importes, consecutivos y datos de la venta.</li>' +
  '<li>El backend debe conservar los tokens, PIN y certificados fuera del navegador.</li>' +
  '<li>El backend se comunica con el proveedor tecnológico, firma cuando corresponda y devuelve al frontend el estado del documento.</li></ol>' +
  '<p>No ingreses credenciales reales en esta versión. El campo de conexión directa y la llamada desde el navegador se retiraron.</p></div>';

ACCIONES['api-guia'] = function () {
  abrirVentana({ titulo: 'Guía de conexión con una API', ancha: true, cuerpo: GUIA_API });
};

ACCIONES['metodo-nuevo'] = function () {
  abrirFormulario({ titulo: 'Nuevo método de pago', boton: 'Guardar método',
    campos: [{ id: 'nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, largo: 30, ancho: true },
      { id: 'referencia', etiqueta: '¿Pide número de transacción?', tipo: 'chips', opciones: [['1', 'Sí'], ['0', 'No (efectivo)']], valor: '1', ancho: true },
      { id: 'medio', etiqueta: 'Código del medio de pago en la DIAN', tipo: 'select', opciones: MEDIOS_DIAN, valor: '47', ancho: true }],
    alGuardar: function (val) {
      if (ESTADO.metodos.some(function (m) { return m.nombre.toLowerCase() === val.nombre.toLowerCase(); })) return 'Ya existe un método con ese nombre.';
      ESTADO.metodos.push({ nombre: val.nombre, referencia: val.referencia === '1', activo: true });
      cfgFE().mediosPago[val.nombre] = val.medio;
      guardarConfig('Método "' + val.nombre + '" agregado.');
    } });
};

ACCIONES['metodo-cambiar'] = function (el) {
  var m = ESTADO.metodos[Number(el.dataset.d)];
  if (m.activo !== false && ESTADO.metodos.filter(function (x) { return x.activo !== false; }).length === 1) { aviso('Debe quedar al menos un método habilitado para poder cobrar.'); return; }
  m.activo = m.activo === false;
  guardarConfig(m.nombre + (m.activo ? ' habilitado.' : ' inhabilitado: ya no aparece al cobrar.'));
};

registrarVista({ clave: 'facturacion', titulo: 'Facturación', orden: 3, visible: obligadoFE, pintor: vistaFacturacion, contador: function () { return porReenviar().length; },
  filtros: function () { return FILTROS_DOC.map(function (x) { return chip('doc', x[0], x[1], filtroDoc === x[0]); }).join(''); }, alFiltrar: function (g, v) { filtroDoc = v; } });
registrarVista({ clave: 'metodos', titulo: 'Métodos de pago', orden: 6, pintor: vistaMetodos });
registrarVista({ clave: 'configuracion', titulo: 'Datos de facturación', orden: 7, pintor: vistaConfiguracion });

// Pantalla inicial: la categoría pedida en la dirección (caja.html?ver=facturacion) o la primera
var pedida = (/[?&]ver=(\w+)/.exec(location.search) || [])[1];
if (pedida === 'facturas') pedida = 'facturacion'; // enlace de la antigua página de Facturación
vista = VISTAS.some(function (x) { return x.clave === pedida; }) ? pedida : 'cobrar';
pintarTodo();
