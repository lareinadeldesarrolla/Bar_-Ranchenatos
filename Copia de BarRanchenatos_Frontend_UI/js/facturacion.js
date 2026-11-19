/* Interfaz de facturación demostrativa.
   Esta copia no transmite documentos ni calcula códigos fiscales válidos.
   La integración real y las credenciales pertenecen a un backend. */

var TIPOS_DOCUMENTO = [['13', 'Cédula de ciudadanía'], ['31', 'NIT'], ['22', 'Cédula de extranjería'], ['41', 'Pasaporte'], ['12', 'Tarjeta de identidad'], ['11', 'Registro civil'],
  ['21', 'Tarjeta de extranjería'], ['42', 'Documento de identificación extranjero'], ['47', 'PEP (Permiso Especial de Permanencia)'], ['48', 'PPT (Permiso Protección Temporal)'], ['50', 'NIT de otro país'], ['91', 'NUIP']];
var CONSUMIDOR_FINAL = { tipoDoc: '13', numero: '222222222222', nombre: 'Consumidor final', correo: '' };
var NOMBRE_COMPROBANTE = { TICKET: tituloComprobante(), POS: 'Documento equivalente POS', FACTURA: 'Factura electrónica', NC: 'Nota crédito' };
var CODIGO_DOCUMENTO = { FACTURA: '01', POS: '20', NC: '91' }; // códigos del anexo técnico; confirma con tu proveedor si cambian
var MOTIVOS_NOTA = [['1', 'Devolución parcial de productos'], ['2', 'Anulación de la factura'], ['3', 'Rebaja o descuento'], ['4', 'Ajuste de precio'], ['5', 'Otro motivo']];

function cfgFE() { return ESTADO.facturacion; }

// ---------- Numeración autorizada ----------
function resolucionDe(tipo) {
  var lista = cfgFE().resoluciones.filter(function (r) { return r.tipo === tipo; });
  return lista[0] || null;
}

// Estado de un rango: sirve para avisar antes de que se agote o venza
function estadoResolucion(r) {
  var hoy = ahoraTexto().slice(0, 10);
  var quedan = r.hasta - r.actual + 1;
  if (r.vigenciaHasta && hoy > r.vigenciaHasta) return { clave: 'vencida', texto: 'Vencida', ok: false };
  if (quedan <= 0) return { clave: 'agotada', texto: 'Agotada', ok: false };
  if (!r.resolucion) return { clave: 'pruebas', texto: 'Sin resolución (solo pruebas)', ok: cfgFE().ambiente === '2' };
  if (quedan <= Math.max(20, Math.round((r.hasta - r.desde + 1) * 0.1))) return { clave: 'poco', texto: 'Quedan ' + quedan + ' números', ok: true };
  return { clave: 'ok', texto: 'Vigente · quedan ' + quedan, ok: true };
}

function motivoSinNumeracion(tipo) {
  var nombre = NOMBRE_COMPROBANTE[tipo].charAt(0).toLowerCase() + NOMBRE_COMPROBANTE[tipo].slice(1);
  var r = resolucionDe(tipo);
  if (!r) return 'No hay numeración configurada para ' + nombre + '.';
  var e = estadoResolucion(r);
  if (e.clave === 'pruebas' && !e.ok) return 'En producción, ' + nombre + ' necesita el número de resolución: cárgalo en Datos de facturación.';
  if (!e.ok) return 'La numeración de ' + nombre + ' está ' + e.texto.toLowerCase() + '. Cárgala en Datos de facturación.';
  if (cfgFE().ambiente === '1' && tipo === 'FACTURA' && !r.claveTecnica) return 'En producción la factura necesita la clave técnica de la resolución.';
  return '';
}

// ---------- Armar el documento ----------
function dosDec(n) { return (Math.round(n * 100) / 100).toFixed(2); }

// Líneas con su descuento repartido y sus impuestos; las diferencias de redondeo se absorben en la última línea.
// Los impuestos son los que se cobraron en esa venta (v.tarifas); las ventas anteriores a esta opción usaban el impoconsumo del 8 %.
function lineasDeVenta(v) {
  var p = buscarPor(ESTADO.pedidos, 'n', v.pedido);
  var fd = v.subtotal ? v.descuento / v.subtotal : 0;
  var tarifas = v.tarifas || [{ codigo: '04', nombre: 'Impoconsumo', porcentaje: 8 }];
  var porClave = !tarifas.some(function (t) { return !t.clave; }); // las ventas anteriores no guardaron la clase de impuesto de cada línea
  var lineas = (p ? p.lineas : []).map(function (l, i) {
    var bruto = l.cant * l.precio;
    var desc = v.descLineas ? Math.min(bruto, v.descLineas[i] || 0) : Math.round(bruto * fd);
    var base = bruto - desc, clave = claveImp(l), imps;
    if (porClave) {
      var t = buscarPor(tarifas, 'clave', clave);
      imps = t ? [{ codigo: t.codigo, nombre: t.nombre, porcentaje: t.porcentaje, valor: Math.round(base * t.porcentaje / 100) }] : (clave === 'EXENTO' ? [{ codigo: '01', nombre: 'IVA', porcentaje: 0, valor: 0 }] : []);
    } else imps = l.iva > 0 ? tarifas.map(function (x) { return { codigo: x.codigo, nombre: x.nombre, porcentaje: x.porcentaje, valor: Math.round(base * x.porcentaje / 100) }; }) : [];
    return { n: i + 1, codigo: 'P' + (ESTADO.productos.indexOf(buscarPor(ESTADO.productos, 'nombre', l.producto)) + 1), descripcion: l.producto, cantidad: l.cant, unidad: '94', precioUnitario: l.precio,
      descuento: desc, base: base, impuestos: imps, total: 0 };
  });
  var suma = 0, ultima = null;
  lineas.forEach(function (l) { l.impuestos.forEach(function (t) { suma += t.valor; }); if (l.impuestos.length && l.impuestos[0].valor > 0) ultima = l; });
  if (ultima && suma !== v.impuesto) ultima.impuestos[0].valor += v.impuesto - suma;
  lineas.forEach(function (l) { var t = 0; l.impuestos.forEach(function (x) { t += x.valor; }); l.total = l.base + t; });
  return lineas;
}

function impuestosPorTarifa(lineas) {
  var mapa = {};
  lineas.forEach(function (l) {
    l.impuestos.forEach(function (t) {
      var k = t.codigo + '-' + t.porcentaje;
      if (!mapa[k]) mapa[k] = { codigo: t.codigo, nombre: t.nombre, porcentaje: t.porcentaje, base: 0, valor: 0 };
      mapa[k].base += l.base;
      mapa[k].valor += t.valor;
    });
  });
  return Object.keys(mapa).map(function (k) { return mapa[k]; });
}

// Documento en el formato común del sistema; cada proveedor lo traduce al suyo
function armarPayload(doc) {
  var v = buscarPor(ESTADO.ventas, 'n', doc.venta);
  var e = cfgFE().emisor;
  var f = doc.fecha;
  var lineas = lineasDeVenta(v);
  var base = 0;
  lineas.forEach(function (l) { if (l.impuestos.length) base += l.base; });
  var original = doc.ref ? documentoDe(doc.ref) : null;
  var factor = doc.tipo === 'NC' && v.total ? doc.total / v.total : 1;
  var escalar = function (n) { return Math.round(n * factor); };
  return {
    tipoDocumento: CODIGO_DOCUMENTO[doc.tipo], tipo: doc.tipo, ambiente: doc.ambiente, numero: doc.id, prefijo: doc.prefijo, consecutivo: doc.consecutivo,
    fechaEmision: f.slice(0, 10), horaEmision: f.slice(11) + ':00-05:00', moneda: 'COP', formaPago: '1', medioPago: cfgFE().mediosPago[v.metodo] || 'ZZZ',
    emisor: { nit: e.nit, dv: e.dv, razonSocial: e.razonSocial, nombreComercial: e.nombreComercial, tipoPersona: e.tipoPersona, responsabilidades: e.responsabilidades, ciiu: e.ciiu,
      direccion: e.direccion, municipio: e.municipio, departamento: e.departamento, codigoMunicipio: e.codigoMunicipio, telefono: e.telefono, correo: e.correo },
    adquirente: doc.adquirente,
    referencia: original ? { numero: original.id, cufe: original.cufe, fecha: original.fecha.slice(0, 10), motivo: doc.motivo } : null,
    lineas: lineas.map(function (l) { return { n: l.n, codigo: l.codigo, descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad, precioUnitario: l.precioUnitario,
      descuento: escalar(l.descuento), base: escalar(l.base), impuestos: l.impuestos.map(function (t) { return { codigo: t.codigo, nombre: t.nombre, porcentaje: t.porcentaje, valor: escalar(t.valor) }; }), total: escalar(l.total) }; }),
    impuestos: impuestosPorTarifa(lineas).map(function (t) { return { codigo: t.codigo, nombre: t.nombre, porcentaje: t.porcentaje, base: escalar(t.base), valor: escalar(t.valor) }; }),
    totales: { subtotal: escalar(v.subtotal), descuentos: escalar(v.descuento), baseImponible: escalar(base), impuestos: escalar(v.impuesto), propina: v.propina || 0, total: doc.tipo === 'NC' ? doc.total : v.total, pagado: doc.tipo === 'NC' ? doc.total : v.total + (v.propina || 0) },
    cufe: doc.cufe
  };
}

// Huella visual de demostración. No es CUFE/CUDE fiscal: la generación válida
// y cualquier firma requieren el servicio del proveedor desde un backend.
function textoParaCodigo(payload, doc) {
  var e = cfgFE();
  var valor = function (codigo) { var t = payload.impuestos.filter(function (i) { return i.codigo === codigo; })[0]; return dosDec(t ? t.valor : 0); };
  return payload.numero + payload.fechaEmision + payload.horaEmision + dosDec(payload.totales.baseImponible) + '01' + valor('01') + '04' + valor('04') + '03' + valor('03') +
    dosDec(payload.totales.total) + e.emisor.nit + payload.adquirente.numero + 'DEMO-NO-VALIDO' + e.ambiente;
}

function calcularCodigo(payload, doc) {
  return sha384(textoParaCodigo(payload, doc));
}

// SHA-384: usa el del navegador cuando existe (páginas seguras) y, si no, una versión propia (el celular abre la página por http)
function sha384(texto) {
  var bytes = new TextEncoder().encode(texto);
  if (window.crypto && crypto.subtle) {
    return crypto.subtle.digest('SHA-384', bytes).then(function (b) { return hex(new Uint8Array(b)); });
  }
  return Promise.resolve(hex(sha384Propio(bytes)));
}

function hex(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16); return s; }

var SHA = (function () {
  var M = (1n << 64n) - 1n;
  function raiz(n, k) { // raíz entera por Newton
    var x = 1n << (BigInt(n.toString(2).length) / BigInt(k) + 1n);
    for (;;) { var y = ((BigInt(k) - 1n) * x + n / (x ** (BigInt(k) - 1n))) / BigInt(k); if (y >= x) return x; x = y; }
  }
  var primos = [];
  for (var c = 2; primos.length < 80; c++) { var primo = true; for (var d = 2; d * d <= c; d++) if (c % d === 0) { primo = false; break; } if (primo) primos.push(c); }
  return {
    K: primos.map(function (p) { return raiz(BigInt(p) << 192n, 3) & M; }), // 64 bits de la raíz cúbica de cada primo
    H: primos.slice(8, 16).map(function (p) { return raiz(BigInt(p) << 128n, 2) & M; }), // raíces cuadradas de los primos 9.º a 16.º (SHA-384)
    M: M
  };
})();

function sha384Propio(bytes) {
  var M = SHA.M, K = SHA.K, H = SHA.H.slice();
  var rot = function (x, n) { return ((x >> n) | (x << (64n - n))) & M; };
  var largo = bytes.length;
  var total = Math.ceil((largo + 17) / 128) * 128;
  var m = new Uint8Array(total);
  m.set(bytes); m[largo] = 0x80;
  var bits = BigInt(largo) * 8n;
  for (var i = 0; i < 16; i++) m[total - 1 - i] = Number((bits >> BigInt(8 * i)) & 0xffn);
  for (var o = 0; o < total; o += 128) {
    var w = [];
    for (var t = 0; t < 16; t++) { var x = 0n; for (var b = 0; b < 8; b++) x = (x << 8n) | BigInt(m[o + t * 8 + b]); w.push(x); }
    for (t = 16; t < 80; t++) {
      var s0 = rot(w[t - 15], 1n) ^ rot(w[t - 15], 8n) ^ (w[t - 15] >> 7n);
      var s1 = rot(w[t - 2], 19n) ^ rot(w[t - 2], 61n) ^ (w[t - 2] >> 6n);
      w.push((w[t - 16] + s0 + w[t - 7] + s1) & M);
    }
    var a = H[0], bb = H[1], cc = H[2], dd = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (t = 0; t < 80; t++) {
      var S1 = rot(e, 14n) ^ rot(e, 18n) ^ rot(e, 41n);
      var ch = (e & f) ^ (~e & M & g);
      var t1 = (h + S1 + ch + K[t] + w[t]) & M;
      var S0 = rot(a, 28n) ^ rot(a, 34n) ^ rot(a, 39n);
      var maj = (a & bb) ^ (a & cc) ^ (bb & cc);
      var t2 = (S0 + maj) & M;
      h = g; g = f; f = e; e = (dd + t1) & M; dd = cc; cc = bb; bb = a; a = (t1 + t2) & M;
    }
    H = [H[0] + a, H[1] + bb, H[2] + cc, H[3] + dd, H[4] + e, H[5] + f, H[6] + g, H[7] + h].map(function (x) { return x & M; });
  }
  var salida = [];
  for (i = 0; i < 6; i++) for (var j = 7; j >= 0; j--) salida.push(Number((H[i] >> BigInt(8 * j)) & 0xffn));
  return salida;
}

// XML del documento (estructura UBL 2.1 resumida, sin firma): sirve para revisarlo y para entregárselo a un proveedor que lo firme
function xmlDe(payload) {
  var x = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var raiz = payload.tipo === 'NC' ? 'CreditNote' : 'Invoice';
  var a = payload.adquirente, e = payload.emisor;
  var s = '<?xml version="1.0" encoding="UTF-8"?>\n<' + raiz + ' xmlns="urn:oasis:names:specification:ubl:schema:xsd:' + raiz + '-2">\n' +
    '  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>\n  <cbc:ProfileExecutionID>' + x(payload.ambiente) + '</cbc:ProfileExecutionID>\n' +
    '  <cbc:ID>' + x(payload.numero) + '</cbc:ID>\n  <cbc:UUID schemeName="' + (payload.tipo === 'FACTURA' ? 'CUFE-SHA384' : 'CUDE-SHA384') + '">' + x(payload.cufe) + '</cbc:UUID>\n' +
    '  <cbc:IssueDate>' + payload.fechaEmision + '</cbc:IssueDate>\n  <cbc:IssueTime>' + payload.horaEmision + '</cbc:IssueTime>\n  <cbc:InvoiceTypeCode>' + payload.tipoDocumento + '</cbc:InvoiceTypeCode>\n' +
    '  <cbc:DocumentCurrencyCode>' + payload.moneda + '</cbc:DocumentCurrencyCode>\n  <cbc:LineCountNumeric>' + payload.lineas.length + '</cbc:LineCountNumeric>\n';
  if (payload.referencia) s += '  <cac:BillingReference><cbc:ID>' + x(payload.referencia.numero) + '</cbc:ID><cbc:UUID>' + x(payload.referencia.cufe) + '</cbc:UUID><cbc:Description>' + x(payload.referencia.motivo) + '</cbc:Description></cac:BillingReference>\n';
  s += '  <cac:AccountingSupplierParty><cbc:RegistrationName>' + x(e.razonSocial) + '</cbc:RegistrationName><cbc:CompanyID>' + x(e.nit) + (e.dv ? '-' + x(e.dv) : '') + '</cbc:CompanyID></cac:AccountingSupplierParty>\n' +
    '  <cac:AccountingCustomerParty><cbc:RegistrationName>' + x(a.nombre) + '</cbc:RegistrationName><cbc:CompanyID schemeName="' + x(a.tipoDoc) + '">' + x(a.numero) + '</cbc:CompanyID><cbc:ElectronicMail>' + x(a.correo) + '</cbc:ElectronicMail></cac:AccountingCustomerParty>\n' +
    '  <cac:PaymentMeans><cbc:PaymentMeansCode>' + x(payload.medioPago) + '</cbc:PaymentMeansCode></cac:PaymentMeans>\n';
  payload.impuestos.forEach(function (t) {
    s += '  <cac:TaxTotal><cbc:TaxAmount>' + dosDec(t.valor) + '</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount>' + dosDec(t.base) + '</cbc:TaxableAmount><cbc:Percent>' + dosDec(t.porcentaje) + '</cbc:Percent><cbc:ID>' + t.codigo + '</cbc:ID></cac:TaxSubtotal></cac:TaxTotal>\n';
  });
  s += '  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount>' + dosDec(payload.totales.baseImponible) + '</cbc:LineExtensionAmount><cbc:TaxInclusiveAmount>' + dosDec(payload.totales.total) + '</cbc:TaxInclusiveAmount><cbc:PayableAmount>' + dosDec(payload.totales.total) + '</cbc:PayableAmount></cac:LegalMonetaryTotal>\n';
  payload.lineas.forEach(function (l) {
    s += '  <cac:' + raiz + 'Line><cbc:ID>' + l.n + '</cbc:ID><cbc:' + (payload.tipo === 'NC' ? 'Credited' : 'Invoiced') + 'Quantity unitCode="' + l.unidad + '">' + l.cantidad + '</cbc:' + (payload.tipo === 'NC' ? 'Credited' : 'Invoiced') + 'Quantity><cbc:LineExtensionAmount>' + dosDec(l.base) + '</cbc:LineExtensionAmount><cac:Item><cbc:Description>' + x(l.descripcion) + '</cbc:Description></cac:Item><cac:Price><cbc:PriceAmount>' + dosDec(l.precioUnitario) + '</cbc:PriceAmount></cac:Price></cac:' + raiz + 'Line>\n';
  });
  return s + '</' + raiz + '>\n<!-- Documento sin firma electrónica: lo firma el proveedor con el certificado digital de la empresa -->\n';
}

// ---------- Proveedores (quien entrega el documento a la DIAN) ----------
var PROVEEDORES = {};
function registrarProveedor(clave, nombre, impl) { impl.nombre = nombre; PROVEEDORES[clave] = impl; }
function proveedorActual() { return PROVEEDORES[cfgFE().proveedor] || PROVEEDORES.simulado; }

function porRuta(obj, ruta) { return String(ruta || '').split('.').reduce(function (a, k) { return a == null || k === '' ? a : a[k]; }, obj); }

// Simulación: valida lo básico y acepta; la consulta de adquirentes usa la tabla de pruebas de la guía de la DIAN
var TABLA_PRUEBA = { '11': 'Registro civil', '12': 'Tarjeta de identidad', '13': 'Cédula de ciudadanía', '21': 'Tarjeta de extranjería', '22': 'Cédula de extranjería', '31': 'NIT', '41': 'Pasaporte', '42': 'Documento de identificación extranjero', '50': 'NIT de otro país', '91': 'NUIP *' };
registrarProveedor('simulado', 'Simulación (sin conexión real con la DIAN)', {
  enviar: function (payload) {
    var a = payload.adquirente;
    if (payload.tipo === 'FACTURA' && (!a.nombre || !a.numero)) return Promise.resolve({ ok: false, estado: 'Rechazado', mensaje: 'Falta el nombre o el documento del adquirente.' });
    if (!cfgFE().emisor.nit && cfgFE().ambiente === '1') return Promise.resolve({ ok: false, estado: 'Rechazado', mensaje: 'Falta el NIT del emisor.' });
    return Promise.resolve({ ok: true, estado: 'Aceptado', mensaje: 'Aceptado por simulación local; no enviado ni validado por la DIAN.', id: 'SIM-' + payload.numero, cufe: payload.cufe });
  },
  consultar: function (doc) { return Promise.resolve({ ok: true, estado: doc.estado, mensaje: 'Simulación: estado local.' }); },
  adquirente: function (tipoDoc, numero) {
    var m = new RegExp('^' + tipoDoc + '9999(\\d{1,2})$').exec(numero);
    if (m && TABLA_PRUEBA[tipoDoc] && Number(m[1]) >= 1 && Number(m[1]) <= 10) {
      return Promise.resolve({ nombre: 'Nombre ' + TABLA_PRUEBA[tipoDoc] + ' ' + m[1], correo: 'Mail_' + TABLA_PRUEBA[tipoDoc] + '_' + m[1] + '@mail.com' });
    }
    var c = ESTADO.clientesFE.filter(function (x) { return x.tipoDoc === tipoDoc && x.numero === numero; })[0];
    return Promise.resolve(c ? { nombre: c.nombre, correo: c.correo } : null);
  },
  probar: function () { return Promise.resolve({ ok: true, mensaje: 'Simulación activa: todo se queda en este navegador.' }); }
});

// API REST genérica: método y ruta de cada operación y los nombres de los campos de la respuesta se configuran en Caja, Datos de facturación
// Esta entrega es solo frontend. Las llamadas autenticadas a proveedores externos
// deben implementarse en un backend; el navegador no recibe ni almacena credenciales.
registrarProveedor('api', 'API (requiere backend; no conectada)', {
  enviar: function () { return Promise.resolve({ ok: false, estado: 'Error', mensaje: 'La conexión con el proveedor requiere un backend y no está habilitada en esta versión frontend.' }); },
  consultar: function () { return Promise.resolve({ ok: false, estado: 'Error', mensaje: 'La consulta requiere un backend.' }); },
  adquirente: function () { return Promise.resolve(null); },
  probar: function () { return Promise.resolve({ ok: false, mensaje: 'No hay backend conectado en esta versión frontend.' }); }
});

// Crea un documento de demostración y lo entrega al proveedor simulado.
function emitirDocumento(venta, tipo, adquirente, extra) {
  var motivo = motivoSinNumeracion(tipo);
  if (motivo) return Promise.reject(new Error(motivo));
  var r = resolucionDe(tipo);
  var doc = { id: r.prefijo + r.actual, tipo: tipo, prefijo: r.prefijo, consecutivo: r.actual, venta: venta.n, ref: extra && extra.ref || '', fecha: ahoraTexto(), estado: 'Enviando', cufe: '', ambiente: cfgFE().ambiente,
    adquirente: adquirente || CONSUMIDOR_FINAL, total: extra && extra.total || venta.total, motivo: extra && extra.motivo || '', intentos: [] };
  r.actual += 1;
  ESTADO.documentos.push(doc);
  if (tipo !== 'NC') { venta.comprobante = tipo; venta.documento = doc.id; }
  guardar();
  return calcularCodigo(armarPayload(doc), doc).then(function (codigo) { doc.cufe = codigo; return enviarDocumento(doc); });
}

function enviarDocumento(doc) {
  var venta = buscarPor(ESTADO.ventas, 'n', doc.venta);
  doc.estado = 'Enviando';
  return proveedorActual().enviar(armarPayload(doc)).then(function (res) {
    doc.intentos.push({ n: doc.intentos.length + 1, fecha: ahoraTexto(), estado: res.estado, detalle: res.mensaje });
    doc.estado = res.estado;
    if (res.id) doc.idProveedor = res.id;
    if (res.cufe) doc.cufe = res.cufe;
    if (doc.tipo !== 'NC') venta.factura = res.estado === 'Aceptado' ? 'Aceptada' : res.estado === 'Rechazado' ? 'Rechazada' : 'Pendiente';
    guardar();
    return doc;
  });
}

// Reintenta los documentos que no quedaron aceptados (sin conexión o con error)
function reenviarPendientes() {
  var lista = ESTADO.documentos.filter(function (d) { return d.estado === 'Error' || d.estado === 'Por reenviar'; });
  return lista.reduce(function (p, d) { return p.then(function () { return enviarDocumento(d); }); }, Promise.resolve()).then(function () { return lista.length; });
}

// Lo que todavía se puede acreditar de una factura (no se puede devolver más de lo vendido)
function saldoAcreditable(doc) {
  var usado = 0;
  ESTADO.documentos.forEach(function (n) { if (n.tipo === 'NC' && n.ref === doc.id && n.estado !== 'Rechazado') usado += n.total; });
  return doc.total - usado;
}

function emitirNotaCredito(doc, motivo, valor) {
  var venta = buscarPor(ESTADO.ventas, 'n', doc.venta);
  return emitirDocumento(venta, 'NC', doc.adquirente, { ref: doc.id, total: valor, motivo: motivo }).then(function (nota) {
    if (nota.estado === 'Aceptado' && saldoAcreditable(doc) <= 0) venta.anulada = { fecha: ahoraTexto(), motivo: 'Nota crédito ' + nota.id, quien: usuarioActual() };
    guardar();
    return nota;
  });
}

// El comprobante sale solo:
// - Con la DIAN configurada (datos del emisor y numeración vigente) y una empresa que cobra impoconsumo o IVA, cada venta lleva documento equivalente POS o factura electrónica (Res. DIAN 165 de 2023).
// - En cualquier otro caso (la empresa no cobra impuestos, o aún no tiene la DIAN lista) se entrega un "comprobante de pago": no es factura ni recibo.
function debeFacturar() { return obligadoFE() && (impuestosVigentes().length > 0 || esResponsableDeIva()); }

function dianConfigurada() {
  var e = cfgFE().emisor;
  return !!(e.nit && String(e.nit).trim()) && motivoSinNumeracion('POS') === '';
}

function textoPerfilFacturacion() {
  if (!obligadoFE()) return 'No obligado a facturar: ' + tituloComprobante().toLowerCase();
  if (!debeFacturar()) return 'No sujeto de impuestos: ' + tituloComprobante().toLowerCase();
  var imp = impuestosVigentes().map(function (i) { return i.nombre.toLowerCase() + ' ' + i.tarifa + ' %'; }).join(' e ') || 'IVA';
  return dianConfigurada() ? 'Sujeto de ' + imp + ': documento equivalente POS o factura electrónica' : 'Sujeto de ' + imp + ', DIAN sin configurar: comprobante de pago';
}

function comprobantesPermitidos() {
  if (!debeFacturar() || !dianConfigurada()) return ['TICKET'];
  var l = ['POS', 'FACTURA'].filter(function (t) { return motivoSinNumeracion(t) === ''; });
  return l.length ? l : ['TICKET'];
}

// POS para el consumidor final; factura electrónica si el cliente es una empresa (NIT)
function comprobantePorDefecto(nombreCliente) {
  var permitidos = comprobantesPermitidos();
  if (permitidos[0] === 'TICKET') return 'TICKET';
  var c = nombreCliente ? clienteDe(nombreCliente) : null;
  return c && c.tipoDoc === 'NIT' && permitidos.indexOf('FACTURA') !== -1 ? 'FACTURA' : permitidos[0];
}

function completarConfiguracion() {
  var base = estadoInicial().facturacion;
  var c = ESTADO.facturacion;
  Object.keys(base).forEach(function (k) {
    if (c[k] === undefined) c[k] = base[k];
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) Object.keys(base[k]).forEach(function (k2) { if (c[k][k2] === undefined) c[k][k2] = base[k][k2]; });
  });
  if (!ESTADO.clientesFE) ESTADO.clientesFE = [];
}
completarConfiguracion();
