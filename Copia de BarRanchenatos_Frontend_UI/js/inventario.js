/* Inventario como kardex: cada insumo es un widget y, al tocarlo, se abre su kardex (saldo inicial, entradas, salidas, saldo, costo promedio y valor).
   Las salidas por despacho las registra datos.js al despachar; aquí se registran compras, mermas, ajustes y salidas manuales. */

var $ = function (id) { return document.getElementById(id); };
var estadoActual = 'todos';
var categoriaActual = 'Todos';
var UNIDADES = ['Unidad', 'Botella', 'Litro', 'ml', 'kg', 'g'];
var ESTADOS_INSUMO = [['todos', 'Todos'], ['bajo', 'Stock bajo'], ['normal', 'Normal']];
var TIPOS_MOV = [['todos', 'Todos'], ['Entrada', 'Entradas'], ['Salida', 'Salidas'], ['Merma', 'Mermas'], ['Ajuste', 'Ajustes']];

function aviso(texto) { $('i-aviso').textContent = texto; }
function vacio(texto) { return '<div class="vacio-c"><p>' + texto + '</p></div>'; }
function num(n) { return Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 }); }
function precio(c) { return c >= 1 || c === 0 ? pesos(c) : '$ ' + String(c).replace('.', ','); }
function bajo(i) { return i.existencia < i.minimo; }
function insumoPor(nombre) { return buscarPor(ESTADO.insumos, 'nombre', nombre); }
function usadoEnRecetas(i) { return ESTADO.productos.filter(function (p) { return p.receta.some(function (r) { return r[0] === i.nombre; }); }); }
function fechaHtml(f) { var p = f.split(' '); return esc(p[0]) + '<small>' + esc(p[1] || '') + '</small>'; }

// ---------- Existencias ----------
function pasaFiltro(i) {
  if (categoriaActual !== 'Todos' && categoriaDeInsumo(i) !== categoriaActual) return false;
  var texto = $('i-buscar').value.trim().toLowerCase();
  if (texto && i.nombre.toLowerCase().indexOf(texto) === -1) return false;
  if (estadoActual === 'bajo') return bajo(i);
  if (estadoActual === 'normal') return !bajo(i);
  return true;
}

function widgetInsumo(i) {
  var nivel = i.minimo > 0 ? Math.min(100, Math.round(i.existencia / (i.minimo * 3) * 100)) : 100;
  return '<article class="widget w-insumo' + (bajo(i) ? ' w-activa' : '') + '" data-i="' + ESTADO.insumos.indexOf(i) + '">' + (i.foto ? '<div class="w-foto"><img src="' + esc(i.foto) + '" alt=""></div>' : '') +
    '<div class="w-cab"><img src="icons/inicio/inventario.svg" alt=""><b>' + esc(i.unidad).toUpperCase() + '</b></div>' +
    '<p class="w-valor">' + esc(i.nombre) + '</p>' +
    '<p class="w-existencia"><b>' + num(i.existencia) + '</b> <small>' + esc(i.unidad.toLowerCase()) + '</small></p>' +
    '<div class="nivel" role="img" aria-label="Nivel ' + nivel + '%"><span style="width:' + nivel + '%"></span></div>' +
    '<p class="w-sub">Mínimo ' + num(i.minimo) + ' · ' + precio(i.costo) + '</p>' +
    '<div class="w-pie"><span class="w-estado">' + (bajo(i) ? 'Stock bajo' : 'Normal') + '</span></div></article>';
}

function pintar() {
  $('i-estados').innerHTML = ESTADOS_INSUMO.map(function (e) {
    var n = e[0] === 'bajo' ? ' (' + insumosBajos().length + ')' : '';
    return '<button type="button" class="seg" data-v="' + e[0] + '" aria-pressed="' + (estadoActual === e[0]) + '">' + e[1] + n + '</button>';
  }).join('');
  var cats = categoriasDeInsumos();
  if (cats.indexOf(categoriaActual) === -1) categoriaActual = 'Todos';
  var conteo = function (c) { return ESTADO.insumos.filter(function (i) { return c === 'Todos' || categoriaDeInsumo(i) === c; }).length; };
  $('i-cats').innerHTML = ['Todos'].concat(cats).map(function (c) { return '<button type="button" class="chip-filtro" data-c="' + esc(c) + '" aria-pressed="' + (categoriaActual === c) + '">' + esc(c) + ' (' + conteo(c) + ')</button>'; }).join('');
  var lista = ESTADO.insumos.filter(pasaFiltro);
  if (!lista.length) { $('i-lista').innerHTML = vacio(ESTADO.insumos.length ? 'Ningún insumo coincide con estos filtros.' : 'Todavía no hay insumos. Crea el primero con "Nuevo insumo".'); return; }
  var h = '';
  categoriasDeInsumos().forEach(function (c) {
    var de = lista.filter(function (i) { return categoriaDeInsumo(i) === c; });
    if (de.length) h += '<h3 class="grupo-w">' + esc(c) + '<small>' + de.length + (de.length === 1 ? ' insumo' : ' insumos') + '</small></h3><div class="widgets">' + de.map(widgetInsumo).join('') + '</div>';
  });
  $('i-lista').innerHTML = h;
}


$('i-cats').addEventListener('click', function (e) { var b = e.target.closest('.chip-filtro'); if (b) { categoriaActual = b.dataset.c; pintar(); } });
$('i-estados').addEventListener('click', function (e) { var b = e.target.closest('.seg'); if (b) { estadoActual = b.dataset.v; pintar(); } });
$('i-buscar').addEventListener('input', pintar);
$('i-lista').addEventListener('click', function (e) {
  var w = e.target.closest('.w-insumo');
  if (w) verKardex(ESTADO.insumos[Number(w.dataset.i)]);
});

// ---------- Kardex de un insumo ----------
function celdaMov(x, t) {
  return '<span class="kx-dato" data-t="' + t + '">' + (x ? num(x.cant) + '<small>' + precio(x.costo) + ' c/u</small><small>' + pesos(x.valor) + '</small>' : '<i>—</i>') + '</span>';
}

var kardexFiltro = { tipo: 'todos', desde: '', hasta: '' };

// La tabla del kardex, dentro del periodo y del tipo elegidos. El saldo inicial es el que había al empezar el periodo.
function tablaKardex(i) {
  var k = kardexDe(i), f = kardexFiltro, te = 0, ve = 0, ts = 0, vs = 0;
  var ini = k.inicial, antes = k.filas.filter(function (x) { return f.desde && x.fecha.slice(0, 10) < f.desde; });
  if (antes.length) { var u = antes[antes.length - 1].saldo; ini = { cant: u.cant, costo: u.costo, valor: u.valor }; }
  var dentro = k.filas.filter(function (x) {
    var d = x.fecha.slice(0, 10);
    return (!f.desde || d >= f.desde) && (!f.hasta || d <= f.hasta) && (f.tipo === 'todos' || x.tipo === f.tipo);
  });
  var filas = dentro.map(function (x) {
    if (x.entra) { te += x.entra.cant; ve += x.entra.valor; }
    if (x.sale) { ts += x.sale.cant; vs += x.sale.valor; }
    return '<div class="kx-fila"><span class="kx-fecha">' + fechaHtml(x.fecha) + '</span><span class="kx-det"><b>' + esc(x.tipo) + '</b><small>' + esc(x.obs && x.obs !== '—' ? x.obs : '') + (x.quien ? ' · ' + esc(x.quien) : '') + '</small>' + (x.compra ? '<small>Comprado el ' + esc(x.compra) + '</small>' : '') + (x.vence ? '<small>Expira el ' + esc(x.vence) + '</small>' : '') + '</span>' +
      celdaMov(x.entra, 'Entra') + celdaMov(x.sale, 'Sale') +
      '<span class="kx-dato kx-saldo" data-t="Saldo">' + num(x.saldo.cant) + '<small>' + precio(x.saldo.costo) + ' c/u</small><small>' + pesos(x.saldo.valor) + '</small></span></div>';
  }).join('') || '<div class="kx-fila kx-vacio">No hay movimientos con estos filtros.</div>';
  var fin = dentro.length ? dentro[dentro.length - 1].saldo : ini;
  var inicial = '<div class="kx-fila kx-ini"><span class="kx-fecha"><i>—</i></span><span class="kx-det"><b>Saldo inicial</b><small>' + (f.desde ? 'Al empezar el periodo' : 'Lo que había antes del primer movimiento') + '</small></span><span class="kx-dato" data-t="Entra"><i>—</i></span><span class="kx-dato" data-t="Sale"><i>—</i></span>' +
    '<span class="kx-dato kx-saldo" data-t="Saldo">' + num(ini.cant) + '<small>' + precio(ini.costo) + ' c/u</small><small>' + pesos(ini.valor) + '</small></span></div>';
  var totales = '<div class="kx-fila kx-tot"><span class="kx-fecha"></span><span class="kx-det"><b>Totales</b></span><span class="kx-dato" data-t="Entra">' + num(te) + '<small>' + pesos(ve) + '</small></span><span class="kx-dato" data-t="Sale">' + num(ts) + '<small>' + pesos(vs) + '</small></span><span class="kx-dato" data-t="Saldo">' + num(fin.cant) + '<small>' + pesos(fin.valor) + '</small></span></div>';
  return '<div class="kx-cab"><span>Fecha</span><span>Detalle</span><span>Entra</span><span>Sale</span><span>Saldo</span></div>' + inicial + filas + totales;
}

function verKardex(i) {
  kardexFiltro = { tipo: 'todos', desde: '', hasta: '' };
  var usos = usadoEnRecetas(i), hoy = ahoraTexto().slice(0, 10);
  var vencen = kardexDe(i).filas.filter(function (x) { return x.vence && x.vence >= hoy; }).map(function (x) { return x.vence; }).sort();
  var dlg = abrirVentana({ titulo: 'Kardex · ' + i.nombre, ancha: true, ayuda: 'Costo promedio ponderado. Las salidas salen al costo promedio del momento.',
    cuerpo: (i.foto ? '<div class="prod-foto"><img src="' + esc(i.foto) + '" alt="' + esc(i.nombre) + '"></div>' : '') +
      '<dl class="tk-datos kx-datos"><div><dt>Existencia</dt><dd>' + num(i.existencia) + ' ' + esc(i.unidad.toLowerCase()) + '</dd></div><div><dt>Mínimo</dt><dd>' + num(i.minimo) + '</dd></div>' +
      '<div><dt>Costo promedio</dt><dd>' + precio(i.costo) + '</dd></div><div><dt>Valor</dt><dd>' + pesos(i.existencia * i.costo) + '</dd></div>' + (vencen.length ? '<div><dt>Próxima expiración</dt><dd>' + esc(vencen[0]) + '</dd></div>' : '') + '</dl>' +
      '<div class="kx-filtros"><div class="segmento" role="group" aria-label="Tipo de movimiento">' + TIPOS_MOV.map(function (t) { return '<button type="button" class="seg" data-tipo="' + t[0] + '" aria-pressed="' + (t[0] === 'todos') + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<label>Desde<input type="date" data-f="desde"></label><label>Hasta<input type="date" data-f="hasta"></label></div>' +
      '<div class="kdx" id="kx-tabla">' + tablaKardex(i) + '</div>' +
      (usos.length ? '<p class="sin-pasos">Lo usan: ' + usos.map(function (p) { return esc(p.nombre); }).join(', ') + '.</p>' : ''),
    botones: (soloVer() ? [] : [{ texto: 'Registrar movimiento', primario: true, alClic: function (d) { d.close(); formularioMovimiento(i); } }]).concat([
      { texto: 'Imprimir kardex', alClic: function () { document.body.classList.add('imprimiendo'); window.print(); } }]).concat(soloVer() ? [] : [
      { texto: 'Editar insumo', alClic: function (d) { d.close(); formularioInsumo(i); } },
      { texto: 'Eliminar insumo', alClic: function (d) { d.close(); eliminarInsumo(i); } }]) });
  var repintar = function () { dlg.querySelector('#kx-tabla').innerHTML = tablaKardex(i); };
  dlg.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tipo]');
    if (!b) return;
    kardexFiltro.tipo = b.dataset.tipo;
    [].forEach.call(dlg.querySelectorAll('[data-tipo]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    repintar();
  });
  dlg.addEventListener('change', function (e) {
    var c = e.target.closest('[data-f]');
    if (!c) return;
    kardexFiltro[c.dataset.f] = c.value;
    repintar();
  });
}
window.addEventListener('afterprint', function () { document.body.classList.remove('imprimiendo'); });

// ---------- Registrar movimiento ----------
function formularioMovimiento(ins) {
  var primero = ins || ESTADO.insumos[0];
  if (!primero) { aviso('Primero crea un insumo.'); return; }
  abrirFormulario({ titulo: 'Registrar movimiento', boton: 'Registrar', ancha: true,
    ayuda: 'Una entrada es una compra o devolución a la bodega; una salida, un gasto manual; una merma, lo que se daña; un ajuste deja la existencia en lo que contaste.',
    campos: [
      { id: 'insumo', etiqueta: 'Insumo', tipo: 'select', opciones: ESTADO.insumos.map(function (x) { return [x.nombre, x.nombre + ' (' + x.unidad.toLowerCase() + ')']; }), valor: primero.nombre, requerido: true, ancho: true },
      { id: 'tipo', etiqueta: 'Tipo', tipo: 'chips', opciones: [['ENTRADA', 'Entrada'], ['SALIDA', 'Salida'], ['MERMA', 'Merma'], ['AJUSTE', 'Ajuste']], valor: 'ENTRADA', ancho: true },
      { id: 'cant', etiqueta: 'Cantidad', tipo: 'number', min: 0, step: 0.01, requerido: true, ayuda: ' ' },
      { id: 'costo', etiqueta: 'Costo por unidad ($)', tipo: 'number', min: 0, step: 'any', ayuda: 'Si lo dejas vacío usa el costo promedio actual.' },
      { id: 'compra', etiqueta: 'Fecha de compra', tipo: 'date', valor: ahoraTexto().slice(0, 10) },
      { id: 'vence', etiqueta: 'Fecha de expiración', tipo: 'date', ayuda: 'Opcional. Para lo que se daña con el tiempo.' },
      { id: 'obs', etiqueta: 'Observación', tipo: 'text', largo: 120, ancho: true, placeholder: 'Proveedor, factura de compra, motivo…' }],
    alCambiar: function (v, dlg) {
      var x = insumoPor(v.insumo);
      var ayuda = dlg.querySelector('[data-campo="cant"] .ayuda-campo');
      var resta = v.tipo === 'SALIDA' || v.tipo === 'MERMA';
      dlg.querySelector('[data-campo="costo"]').hidden = v.tipo !== 'ENTRADA';
      dlg.querySelector('[data-campo="vence"]').hidden = v.tipo !== 'ENTRADA';
      dlg.querySelector('[data-campo="compra"]').hidden = v.tipo !== 'ENTRADA';
      if (ayuda && x) ayuda.textContent = resta ? 'Disponible: ' + num(x.existencia) + ' ' + x.unidad.toLowerCase() : (v.tipo === 'AJUSTE' ? 'Hay ' + num(x.existencia) + '. El ajuste deja la existencia en esta cantidad.' : 'Hay ' + num(x.existencia) + ' ' + x.unidad.toLowerCase());
    },
    alGuardar: function (v) {
      var x = insumoPor(v.insumo);
      if (!x) return 'Elige un insumo.';
      if (v.cant === '') return 'Falta la cantidad.';
      if (v.tipo === 'ENTRADA' && v.vence && v.compra && v.vence < v.compra) return 'La expiración no puede ser antes de la compra.';
      if (v.tipo !== 'AJUSTE' && v.cant <= 0) return 'La cantidad debe ser mayor que cero.';
      if ((v.tipo === 'SALIDA' || v.tipo === 'MERMA') && v.cant > x.existencia) return 'No hay tanto: solo quedan ' + num(x.existencia) + ' ' + x.unidad.toLowerCase() + '.';
      var copia = JSON.stringify([ESTADO.insumos, ESTADO.movimientos, ESTADO.alertas]);
      registrarMovimiento(x, v.tipo, v.cant, v.obs || '—', undefined, v.tipo === 'ENTRADA' ? v.costo : undefined, v.tipo === 'ENTRADA' ? v.vence : undefined, v.tipo === 'ENTRADA' ? v.compra : undefined);
      if (!guardar()) { var c = JSON.parse(copia); ESTADO.insumos = c[0]; ESTADO.movimientos = c[1]; ESTADO.alertas = c[2]; return 'No hay espacio en este navegador para guardar el movimiento.'; }
      aviso('Movimiento registrado en el kardex de ' + x.nombre + '. Ahora hay ' + num(x.existencia) + ' ' + x.unidad.toLowerCase() + '.');
      pintar();
    } });
}

// ---------- Crear, editar y eliminar insumos ----------
function formularioInsumo(ins) {
  var nuevo = !ins;
  var unidades = UNIDADES.slice();
  var cats = categoriasDeInsumos();
  CATEGORIAS_INSUMO.forEach(function (c) { if (cats.indexOf(c) === -1) cats.push(c); });
  if (!nuevo && unidades.indexOf(ins.unidad) === -1) unidades.push(ins.unidad);
  abrirFormulario({ titulo: nuevo ? 'Nuevo insumo' : 'Editar ' + ins.nombre, boton: 'Guardar', ancha: true,
    ayuda: nuevo ? 'La existencia inicial queda como saldo inicial del kardex.' : 'La existencia y el costo cambian con los movimientos del kardex, no se editan aquí.',
    campos: (nuevo ? [{ id: 'nombre', etiqueta: 'Nombre', tipo: 'text', requerido: true, largo: 80, ancho: true }] : []).concat([
      { id: 'cat', etiqueta: 'Categoría', tipo: 'select', opciones: cats.map(function (c) { return [c, c]; }), valor: nuevo ? (categoriaActual !== 'Todos' ? categoriaActual : cats[0]) : categoriaDeInsumo(ins) },
      { id: 'catNueva', etiqueta: 'O una categoría nueva', tipo: 'text', largo: 40, ayuda: 'Si la escribes, se usa en lugar de la de la lista.' },
      { id: 'unidad', etiqueta: 'Unidad de medida', tipo: 'select', opciones: unidades.map(function (u) { return [u, u]; }), valor: nuevo ? 'Unidad' : ins.unidad },
      { id: 'minimo', etiqueta: 'Nivel mínimo', tipo: 'number', valor: nuevo ? '' : ins.minimo, requerido: true, min: 0, step: 0.01 }],
      nuevo ? [{ id: 'existencia', etiqueta: 'Existencia inicial', tipo: 'number', requerido: true, min: 0, step: 0.01 }, { id: 'costo', etiqueta: 'Costo por unidad ($)', tipo: 'number', min: 0, step: 'any' }] : [],
      [{ id: 'foto', etiqueta: 'Imagen', tipo: 'imagen', valor: nuevo ? '' : (ins.foto || ''), ancho: true }]),
    alGuardar: function (v) {
      var cat = v.catNueva || v.cat;
      if (nuevo && ESTADO.insumos.some(function (x) { return x.nombre.toLowerCase() === v.nombre.toLowerCase(); })) return 'Ya existe un insumo con ese nombre.';
      var antes = nuevo ? null : JSON.stringify(ins);
      if (nuevo) { ins = { nombre: v.nombre, unidad: v.unidad, cat: cat, existencia: v.existencia, minimo: v.minimo, costo: v.costo === '' ? 0 : v.costo, foto: v.foto }; ESTADO.insumos.push(ins); }
      else { ins.cat = cat; ins.unidad = v.unidad; ins.minimo = v.minimo; ins.foto = v.foto; }
      if (!guardar()) {
        if (nuevo) ESTADO.insumos.pop(); else { Object.keys(ins).forEach(function (k) { delete ins[k]; }); Object.assign(ins, JSON.parse(antes)); }
        return 'No hay espacio en este navegador para guardar la imagen. Usa una más pequeña o quita otras imágenes.';
      }
      aviso((nuevo ? 'Insumo creado: ' : 'Insumo guardado: ') + ins.nombre + '.');
      pintar();
    } });
}

function eliminarInsumo(i) {
  var usos = usadoEnRecetas(i);
  if (usos.length) { aviso('No se puede eliminar ' + i.nombre + ': lo usan ' + usos.map(function (p) { return p.nombre; }).join(', ') + '. Quítalo primero de esas recetas.'); return; }
  confirmarVentana({ titulo: 'Eliminar insumo', texto: '¿Eliminar <b>' + esc(i.nombre) + '</b> y todo su kardex?', boton: 'Eliminar',
    alAceptar: function () {
      ESTADO.insumos.splice(ESTADO.insumos.indexOf(i), 1);
      ESTADO.movimientos = ESTADO.movimientos.filter(function (m) { return m.insumo !== i.nombre; });
      ESTADO.alertas = ESTADO.alertas.filter(function (a) { return a.insumo !== i.nombre; });
      guardar(); aviso('Insumo eliminado.'); pintar();
    } });
}

$('i-nuevo').addEventListener('click', function () { formularioInsumo(null); });
pintar();
