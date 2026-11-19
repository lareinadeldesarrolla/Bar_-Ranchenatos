/* Productos y recetas: la carta del bar como widgets, con su receta (los insumos que descuenta cada producto), costo y margen.
   Usa los datos de datos.js: lo que se cambia aquí aparece en Pedidos y en Inventario. */

var $ = function (id) { return document.getElementById(id); };
var categoriaActual = 'Todos';
var estadoActual = 'todos';
var ESTADOS_PRODUCTO = [['todos', 'Todos'], ['carta', 'En carta'], ['fuera', 'Fuera de carta'], ['conreceta', 'Con receta'], ['sinreceta', 'Sin receta']];

function aviso(texto) { $('p-aviso').textContent = texto; }
function vacio(texto) { return '<div class="vacio-c"><p>' + texto + '</p></div>'; }
function insumoPor(nombre) { return buscarPor(ESTADO.insumos, 'nombre', nombre); }
function enCarta(p) { return p.activo !== false; }
function preparado(p) { return p.tipo === 'PREPARADO'; }

// Categorías: las que usan los productos (una nueva se crea desde "Nuevo producto")
function categorias() {
  var lista = [];
  ESTADO.productos.forEach(function (p) { if (p.cat && lista.indexOf(p.cat) === -1) lista.push(p.cat); });
  return lista;
}

function costoDe(p) {
  var costo = 0;
  p.receta.forEach(function (r) { var i = insumoPor(r[0]); costo += (i ? i.costo : 0) * r[1]; });
  return costo;
}


function textoUnidad(i, cant) {
  var u = i ? i.unidad.toLowerCase() : '';
  if (cant !== 1 && u === 'unidad') u = 'unidades';
  else if (cant !== 1 && /^[a-záéíóú]{4,}$/.test(u)) u += 's';
  return cant + ' ' + u;
}

// ---------- Lista ----------
function chip(grupo, valor, texto, activo) {
  return '<button type="button" class="chip-filtro" data-g="' + grupo + '" data-v="' + esc(valor) + '" aria-pressed="' + activo + '">' + esc(texto) + '</button>';
}

function pasaFiltro(p) {
  var texto = $('p-buscar').value.trim().toLowerCase();
  if (categoriaActual !== 'Todos' && p.cat !== categoriaActual) return false;
  if (texto && p.nombre.toLowerCase().indexOf(texto) === -1) return false;
  if (estadoActual === 'carta') return enCarta(p);
  if (estadoActual === 'fuera') return !enCarta(p);
  if (estadoActual === 'conreceta') return preparado(p);
  if (estadoActual === 'sinreceta') return !preparado(p);
  return true;
}

function widgetProducto(p) {
  var i = ESTADO.productos.indexOf(p);
  var rec = preparado(p)
    ? 'Receta · ' + p.receta.length + (p.receta.length === 1 ? ' insumo' : ' insumos') + (p.receta.length ? ' · alcanza para ' + disponibleDe(p) : ' · sin insumos todavía')
    : (p.receta.length ? 'Reventa · alcanza para ' + disponibleDe(p) : 'Reventa · sin inventario vinculado');
  var foto = fotoDe(p);
  return '<article class="widget w-producto' + (enCarta(p) ? '' : ' w-apagada') + '" data-i="' + i + '">' + (foto ? '<div class="w-foto"><img src="' + esc(foto) + '" alt=""></div>' : '') +
    '<div class="w-cab"><img src="icons/inicio/inventario.svg" alt=""><b>' + esc(p.cat).toUpperCase() + '</b></div>' +
    '<p class="w-valor">' + esc(p.nombre) + '</p><p class="w-sub">' + pesos(p.precio) + ' · ' + etiquetaImp(claveImp(p)) + '</p><p class="w-sub">' + rec + '</p>' +
    '<div class="w-pie"><span class="w-estado">' + (enCarta(p) ? 'En la carta' : 'Fuera de la carta') + '</span></div></article>';
}

function pintar() {
  var conteo = function (c) { return ESTADO.productos.filter(function (p) { return c === 'Todos' || p.cat === c; }).length; };
  $('p-cats').innerHTML = ['Todos'].concat(categorias()).map(function (c) { return chip('cat', c, c + ' (' + conteo(c) + ')', categoriaActual === c); }).join('');
  $('p-estados').innerHTML = ESTADOS_PRODUCTO.map(function (e) { return '<button type="button" class="seg" data-v="' + e[0] + '" aria-pressed="' + (estadoActual === e[0]) + '">' + e[1] + '</button>'; }).join('');
  var lista = ESTADO.productos.filter(pasaFiltro);
  if (!lista.length) { $('p-lista').innerHTML = vacio(ESTADO.productos.length ? 'Ningún producto coincide con estos filtros.' : 'Todavía no hay productos. Crea el primero con "Nuevo producto".'); return; }
  var h = '';
  if (categoriaActual !== 'Todos') h = '<div class="widgets">' + lista.map(widgetProducto).join('') + '</div>';
  else categorias().forEach(function (c) {
    var de = lista.filter(function (p) { return p.cat === c; });
    if (de.length) h += '<h3 class="grupo-w">' + esc(c) + '<small>' + de.length + (de.length === 1 ? ' producto' : ' productos') + '</small></h3><div class="widgets">' + de.map(widgetProducto).join('') + '</div>';
  });
  $('p-lista').innerHTML = h;
}

$('p-cats').addEventListener('click', function (e) { var b = e.target.closest('.chip-filtro'); if (b) { categoriaActual = b.dataset.v; pintar(); } });
$('p-estados').addEventListener('click', function (e) { var b = e.target.closest('.seg'); if (b) { estadoActual = b.dataset.v; pintar(); } });
$('p-buscar').addEventListener('input', pintar);
$('p-lista').addEventListener('click', function (e) { var w = e.target.closest('.w-producto'); if (w) verProducto(ESTADO.productos[Number(w.dataset.i)]); });

// ---------- Detalle ----------
function verProducto(p) {
  var costo = costoDe(p), tiene = p.receta.length > 0, prep = preparado(p);
  var margen = p.precio - costo;
  var filas = tiene ? p.receta.map(function (r) {
    var i = insumoPor(r[0]);
    return '<div class="rt-fila"><span class="rt-nombre">' + esc(r[0]) + '</span><span class="rt-dato" data-t="Descuenta">' + textoUnidad(i, r[1]) + '</span><span class="rt-dato" data-t="Costo">' + pesos((i ? i.costo : 0) * r[1]) + '</span>' +
      '<span class="rt-dato" data-t="En inventario">' + (i ? textoUnidad(i, i.existencia) : '—') + '</span></div>';
  }).join('') : '<p class="sin-pasos">' + (prep ? 'Todavía no tiene insumos.' : 'Sin inventario vinculado: no descuenta existencias al despacharlo.') + '</p>';
  filas = tiene ? '<div class="rec-tabla"><div class="rt-cab"><span>Insumo</span><span>Descuenta</span><span>Costo</span><span>En inventario</span></div>' + filas + '</div>' : filas;
  var pasos = (p.preparacion || '').split('\n').filter(function (x) { return x.trim(); });
  var preparacion = !prep ? '' : '<div><h3 class="tk-sub">Preparación</h3>' + (pasos.length ? '<ol class="pasos">' + pasos.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '<p class="sin-pasos">Sin indicaciones de preparación. Agrégalas en Editar receta.</p>') + '</div>';
  abrirVentana({ titulo: p.nombre, ancha: true, ayuda: enCarta(p) ? '' : 'Fuera de la carta',
    cuerpo: (fotoDe(p) ? '<div class="prod-foto"><img src="' + esc(fotoDe(p)) + '" alt="' + esc(p.nombre) + '"></div>' : '') + '<dl class="tk-datos"><div><dt>Precio</dt><dd>' + pesos(p.precio) + '</dd></div><div><dt>Impuesto</dt><dd>' + esc(etiquetaImp(claveImp(p))) + '</dd></div>' +
      '<div><dt>' + (prep ? 'Costo de la receta' : 'Costo') + '</dt><dd>' + (tiene ? pesos(costo) : '—') + '</dd></div><div><dt>Margen</dt><dd>' + (tiene && p.precio ? pesos(margen) + ' (' + Math.round(margen / p.precio * 100) + ' %)' : '—') + '</dd></div>' +
      '<div><dt>Alcanza para</dt><dd>' + (tiene ? disponibleDe(p) + ' unidades' : '—') + '</dd></div></dl>' +
      '<div class="prod-cols' + (prep ? '' : ' una') + '"><div>' + (prep ? '<h3 class="tk-sub">Receta</h3>' : '') + filas + '</div>' + preparacion + '</div>',
    botones: soloVer() ? [] : [
      { texto: 'Editar datos', primario: true, alClic: function (d) { d.close(); formularioProducto(p); } },
      { texto: prep ? 'Editar receta' : 'Editar inventario', alClic: function (d) { d.close(); editarReceta(p); } },
      { texto: enCarta(p) ? 'Sacar de la carta' : 'Poner en la carta', alClic: function (d) { d.close(); p.activo = !enCarta(p); guardar(); aviso(p.nombre + (enCarta(p) ? ' vuelve a la carta.' : ' ya no aparece en Pedidos.')); pintar(); } },
      { texto: 'Eliminar producto', alClic: function (d) { d.close(); eliminarProducto(p); } }] });
}

function eliminarProducto(p) {
  var usado = pedidosEnCurso().some(function (x) { return x.lineas.some(function (l) { return l.producto === p.nombre; }); });
  if (usado) { aviso('No se puede eliminar: está en un pedido abierto. Sácalo de la carta o cobra primero esos pedidos.'); return; }
  confirmarVentana({ titulo: 'Eliminar producto', texto: '¿Eliminar <b>' + esc(p.nombre) + '</b>? Las ventas anteriores conservan su nombre. Si solo quieres que no se venda, mejor sácalo de la carta.', boton: 'Eliminar',
    alAceptar: function () { ESTADO.productos.splice(ESTADO.productos.indexOf(p), 1); guardar(); aviso('Producto eliminado.'); pintar(); } });
}

// ---------- Crear y editar ----------
// Solo las clases de impuesto que la empresa puede cobrar, más la que ya tenga el producto
function opcionesImpuesto(actual) {
  return IMPUESTOS_PRODUCTO.filter(function (o) {
    var c = o[0];
    return c === actual || c === 'EXCLUIDO' || ((c === 'EXENTO') ? esResponsableDeIva() : impuestoCobrable(c));
  }).map(function (o) { return [o[0], o[0] === actual && !(o[0] === 'EXCLUIDO' || o[0] === 'EXENTO' || impuestoCobrable(o[0])) ? o[1] + ' (no se cobra hoy)' : o[1]]; });
}
function tarifaNominal(clave) { var e = entradaCatalogo(clave); return e ? e.tarifa : 0; }

function formularioProducto(p) {
  var nuevo = !p;
  var cats = categorias();
  abrirFormulario({ titulo: nuevo ? 'Nuevo producto' : 'Editar producto', boton: 'Guardar', ancha: true,
    campos: [
      { id: 'nombre', etiqueta: 'Nombre', tipo: 'text', valor: nuevo ? '' : p.nombre, requerido: true, largo: 80, ancho: true },
      { id: 'cat', etiqueta: 'Categoría', tipo: 'select', opciones: cats.map(function (c) { return [c, c]; }), valor: nuevo ? (categoriaActual !== 'Todos' ? categoriaActual : cats[0]) : p.cat },
      { id: 'catNueva', etiqueta: 'O una categoría nueva', tipo: 'text', largo: 40, ayuda: 'Si la escribes, se usa en lugar de la de la lista.' },
      { id: 'precio', etiqueta: 'Precio ($)', tipo: 'number', valor: nuevo ? '' : p.precio, requerido: true, min: 1, step: 100 },
      { id: 'tipo', etiqueta: 'Tipo de producto', tipo: 'chips', opciones: [['REVENTA', 'Reventa: se vende tal cual'], ['PREPARADO', 'Preparado: lleva receta']], valor: nuevo ? 'REVENTA' : (p.tipo || 'REVENTA'), ancho: true, ayuda: 'Una botella, una cerveza o una gaseosa es reventa: solo descuenta inventario. Una michelada o un cóctel es preparado: lleva receta y preparación.' },
      { id: 'area', etiqueta: 'Se despacha en', tipo: 'chips', opciones: [['BAR', 'Bar'], ['COCINA', 'Restaurante']], valor: nuevo ? 'BAR' : (p.area || 'BAR'), ayuda: 'Define en qué pantalla de Despacho aparece al pedirlo.' },
      { id: 'imp', etiqueta: 'Impuesto del producto', tipo: 'select', opciones: opcionesImpuesto(nuevo ? '' : claveImp(p)), valor: nuevo ? (impuestoCobrable('INC8') ? 'INC8' : 'EXCLUIDO') : claveImp(p), ancho: true, ayuda: 'Un producto lleva una sola clase de impuesto. El impoconsumo (8 %) es el de restaurantes y bares y no se suma al IVA. IVA y exento solo si la empresa es responsable de IVA (Caja, Datos de facturación). Las tarifas se configuran allí.' },
      { id: 'foto', etiqueta: 'Imagen', tipo: 'imagen', valor: nuevo ? '' : (p.foto || ''), heredada: nuevo ? '' : fotoDe({ tipo: p.tipo, receta: p.receta }), ancho: true },
      { id: 'activo', etiqueta: 'Está en la carta (se puede vender)', tipo: 'check', valor: nuevo ? true : enCarta(p), ancho: true }],
    alGuardar: function (v) {
      var cat = v.catNueva || v.cat;
      if (!cat) return 'Elige o escribe una categoría.';
      var repetido = ESTADO.productos.some(function (x) { return x !== p && x.nombre.toLowerCase() === v.nombre.toLowerCase(); });
      if (repetido) return 'Ya existe un producto con ese nombre.';
      var antes = nuevo ? null : JSON.parse(JSON.stringify(p));
      var pedidosAntes = nuevo ? null : JSON.stringify(ESTADO.pedidos);
      if (nuevo) {
        p = { nombre: v.nombre, cat: cat, precio: v.precio, iva: tarifaNominal(v.imp), imp: v.imp, receta: [], tipo: v.tipo, area: v.area, preparacion: '', foto: v.foto, activo: v.activo };
        ESTADO.productos.push(p);
      } else {
        if (p.nombre !== v.nombre) ESTADO.pedidos.forEach(function (x) { x.lineas.forEach(function (l) { if (l.producto === p.nombre) l.producto = v.nombre; }); });
        p.nombre = v.nombre; p.cat = cat; p.precio = v.precio; p.tipo = v.tipo; p.area = v.area; p.imp = v.imp; p.iva = tarifaNominal(v.imp); p.foto = v.foto; p.activo = v.activo;
      }
      if (!guardar()) { // no cabe: se deshace el cambio
        if (nuevo) ESTADO.productos.pop(); else { Object.keys(p).forEach(function (k) { delete p[k]; }); Object.assign(p, antes); ESTADO.pedidos = JSON.parse(pedidosAntes); }
        return 'No hay espacio en este navegador para guardar la imagen. Usa una más pequeña o quita otras imágenes.';
      }
      aviso((nuevo ? 'Producto creado: ' : 'Producto guardado: ') + p.nombre + '.' + (nuevo ? (v.tipo === 'PREPARADO' ? ' Agrégale su receta y su preparación.' : ' Vincúlale su insumo para que descuente inventario.') : ''));
      pintar();
      if (nuevo) setTimeout(function () { verProducto(p); }, 0);
    } });
}

$('p-nuevo').addEventListener('click', function () { formularioProducto(null); });
// Receta: una fila por insumo (cuál y cuánto descuenta cada unidad vendida)
function editarReceta(p) {
  var opciones = ESTADO.insumos.map(function (i) { return '<option value="' + esc(i.nombre) + '">' + esc(i.nombre) + ' (' + esc(i.unidad.toLowerCase()) + ')</option>'; }).join('');
  var fila = function (r) {
    return '<div class="rec-fila"><select aria-label="Insumo">' + opciones.replace('value="' + esc(r ? r[0] : '') + '"', 'value="' + esc(r ? r[0] : '') + '" selected') + '</select>' +
      '<input type="number" min="0.001" step="0.001" inputmode="decimal" aria-label="Cantidad por unidad" placeholder="Cantidad" value="' + (r ? r[1] : '') + '"><button type="button" class="btn-fila" data-quitar aria-label="Quitar insumo">Quitar</button></div>';
  };
  if (!ESTADO.insumos.length) { aviso('Primero crea insumos en Inventario para armar una receta.'); return; }
  var prep = preparado(p);
  var dlg = abrirVentana({ titulo: (prep ? 'Receta de ' : 'Inventario de ') + p.nombre, ancha: true, ayuda: prep ? 'Cada unidad vendida descuenta estos insumos del inventario. Abajo van las indicaciones para prepararlo.' : 'Elige el insumo que se descuenta cuando se vende y cuánto (media botella es 0,5). Sin filas, no descuenta inventario.',
    cuerpo: '<div class="rec-filas" id="rec-filas">' + p.receta.map(fila).join('') + '</div><button type="button" class="btn" data-agregar>+ Agregar insumo</button>' +
      (!prep ? '' : '<div class="campo campo-ancho"><label for="rec-prep">Indicaciones de preparación</label><textarea id="rec-prep" rows="5" placeholder="Un paso por línea">' + esc(p.preparacion || '') + '</textarea><p class="ayuda-campo">Escribe un paso por línea: así se ven numerados en el detalle del producto.</p></div>') + '<p class="f-error" role="alert"></p>',
    botones: [{ texto: 'Guardar', primario: true, alClic: function (d) {
      var receta = [], error = '';
      [].forEach.call(d.querySelectorAll('.rec-fila'), function (f) {
        var nombre = f.querySelector('select').value, cant = Number(f.querySelector('input').value);
        if (!(cant > 0)) { error = 'Escribe la cantidad de cada insumo (mayor que cero).'; return; }
        if (receta.some(function (r) { return r[0] === nombre; })) { error = 'Un insumo está repetido: ' + nombre + '.'; return; }
        receta.push([nombre, cant]);
      });
      if (error) { d.querySelector('.f-error').textContent = error; return; }
      p.receta = receta;
      if (prep) p.preparacion = d.querySelector('#rec-prep').value.trim();
      guardar();
      d.close();
      aviso((prep ? 'Receta de ' : 'Inventario de ') + p.nombre + ' guardado: ' + (receta.length ? receta.length + (receta.length === 1 ? ' insumo.' : ' insumos.') : 'sin insumos.'));
      pintar();
    } }] });
  dlg.addEventListener('click', function (e) {
    if (e.target.closest('[data-agregar]')) dlg.querySelector('#rec-filas').insertAdjacentHTML('beforeend', fila(null));
    var q = e.target.closest('[data-quitar]');
    if (q) q.closest('.rec-fila').remove();
  });
}

pintar();
