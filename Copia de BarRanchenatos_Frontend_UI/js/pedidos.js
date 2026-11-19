/* Pedidos: elegir mesa, tocar productos, despachar y cobrar.
   Usa los datos de datos.js, así lo que se hace aquí aparece en Caja, Facturación, Inventario y Reportes. */

var mesaActual = 1;
// Quien atiende las mesas toma el pedido y no despacha: eso lo hacen el bar y la cocina. Cobra solo si el rol Mesero tiene activado cobrar al entregar; si no, cobra la caja
if (areaElegida() === 'mesas') { document.body.classList.add('sin-despacho'); if (!meseroCobra()) document.body.classList.add('sin-cobro'); }

// El pedido llega a la cocina y al bar solo cuando quien lo toma lo confirma ("Confirmar y enviar")
function confirmarPedido() {
  var p = pedidoActual();
  if (!p) return;
  var por = { bar: [], cocina: [] }, n = 0;
  p.lineas.forEach(function (l) {
    if (l.despacho !== 'Por confirmar') return;
    l.despacho = 'Pendiente';
    por[areaDelProducto(l.producto)].push(l.cant + ' × ' + l.producto + (l.esp ? ' (' + l.esp + ')' : ''));
    n++;
  });
  if (!n) return;
  ['bar', 'cocina'].forEach(function (a) {
    if (por[a].length) notificar([a], 'Mesa ' + mesaActual + ' (' + (usuarioActual() || 'mesero') + '): ' + por[a].join(', '), 'despacho.html?area=' + a, 'comanda');
  });
  p.estado = estadoDePedido(p);
  guardar();
  aviso('Pedido enviado: ' + (por.bar.length ? 'llegó al bar' : '') + (por.bar.length && por.cocina.length ? ' y ' : '') + (por.cocina.length ? 'llegó a la cocina' : '') + '.', 'ok');
  refrescar();
}
var pedidaEnUrl = /mesa=(\d+)/.exec(location.search); // viene de Mesas: pedidos.html?mesa=3
if (pedidaEnUrl) mesaActual = Number(pedidaEnUrl[1]);
var categoria = 'Todos';
var notaAbierta = -1;
var ICONO_MESA = { 'Disponible': 'mesa_disponible', 'Ocupada': 'mesa_ocupada', 'Reservada': 'mesa_reservada', 'Inactiva': 'mesa_limpieza', 'Por limpiar': 'mesa_limpieza' };
var CLASE = { 'Por confirmar': 'info', 'Pendiente': 'warn', 'En preparación': 'warn', 'Despachado': 'ok', 'Abierto': 'info', 'Entregado': 'ok', 'Facturado': 'mute', 'Anulado': 'bad' };

var cajaMesas = document.getElementById('mesas');
var cajaProductos = document.getElementById('productos');
var cajaChips = document.getElementById('chips');
var listaLineas = document.getElementById('lineas');
var botonCobrar = document.getElementById('btn-cobrar');
var botonTodo = document.getElementById('btn-despachar-todo');
var botonEnviar = document.getElementById('btn-enviar');

function pedidoActual() { return pedidoDeMesa(mesaActual); }

function pintarMesas() {
  var html = '';
  for (var i = 0; i < ESTADO.mesas.length; i++) {
    var m = ESTADO.mesas[i];
    var p = pedidoDeMesa(m.n);
    var valor = p ? pesos(totalesDe(p, 0).total) : (m.estado === 'Disponible' ? 'Libre' : m.estado);
    html += '<button type="button" class="mesa est-' + m.estado.toUpperCase() + (m.n === mesaActual ? ' sel' : '') + '" data-n="' + m.n + '"><span class="m-cab"><img src="icons/inicio/' + ICONO_MESA[m.estado] + '.svg" alt=""><b>Mesa ' + m.n + '</b></span>' +
      '<span class="m-valor' + (p ? '' : ' libre') + '">' + valor + '</span><span class="m-accion">' + (p ? 'Ver cuenta' : 'Abrir pedido') + '</span></button>';
  }
  cajaMesas.innerHTML = html;
}

function pintarChips() {
  var cats = ['Todos'];
  for (var i = 0; i < ESTADO.productos.length; i++) if (ESTADO.productos[i].activo !== false && cats.indexOf(ESTADO.productos[i].cat) === -1) cats.push(ESTADO.productos[i].cat);
  var html = '';
  for (var c = 0; c < cats.length; c++) html += '<button type="button" class="chip" data-cat="' + esc(cats[c]) + '" aria-pressed="' + (cats[c] === categoria) + '">' + esc(cats[c]) + '</button>';
  cajaChips.innerHTML = html;
}

var ICONO_FOTO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4.5 17l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5"/></svg>';

// Unidades de ese producto que siguen sin enviar (las que se pueden sumar o restar desde la tarjeta)
function cantidadPendiente(p, nombre) {
  var n = 0;
  if (p) p.lineas.forEach(function (l) { if (l.producto === nombre && l.despacho === 'Por confirmar' && l.esp === '') n += l.cant; });
  return n;
}

function pintarProductos() {
  var texto = document.getElementById('buscar-producto').value.toLowerCase();
  var p = pedidoActual();
  var html = '';
  for (var i = 0; i < ESTADO.productos.length; i++) {
    var prod = ESTADO.productos[i];
    if (prod.activo === false) continue; // fuera de la carta
    if (categoria !== 'Todos' && prod.cat !== categoria) continue;
    if (prod.nombre.toLowerCase().indexOf(texto) === -1) continue;
    var quedan = disponibleDe(prod);
    var qty = cantidadPendiente(p, prod.nombre);
    var enPedido = 0;
    if (p) p.lineas.forEach(function (l) { if (l.producto === prod.nombre) enPedido += l.cant; });
    var yaServido = enPedido - qty;
    var aviso = quedan === 0 ? '<em class="agotado">Agotado</em>' : (quedan <= 10 ? '<em class="pocas">Quedan ' + quedan + '</em>' : (yaServido > 0 && !qty ? '<em>Ya en el pedido: ' + yaServido + '</em>' : ''));
    var imagen = fotoDe(prod);
    var foto = imagen ? '<img class="foto" src="' + esc(imagen) + '" alt="' + esc(prod.nombre) + '">'
      : '<div class="foto sin" role="img" aria-label="Falta la foto de ' + esc(prod.nombre) + '">' + ICONO_FOTO + '</div>';
    var control = '<div class="paso-prod"><button type="button" data-d="-1" aria-label="Quitar una unidad de ' + esc(prod.nombre) + '"' + (qty ? '' : ' disabled') + '>−</button><span>' + qty + '</span><button type="button" data-d="1" aria-label="Agregar una unidad de ' + esc(prod.nombre) + '"' + (quedan === 0 ? ' disabled' : '') + '>+</button></div>';
    html += '<div class="producto' + (enPedido ? ' en-pedido' : '') + '" data-i="' + i + '" role="button" tabindex="0"' + (quedan === 0 ? ' aria-disabled="true"' : '') + '>' + foto +
      '<b>' + esc(prod.nombre) + '</b>' + aviso + '<div class="pie-prod"><span class="precio">' + pesos(prod.precio) + '</span>' + control + '</div></div>';
  }
  cajaProductos.innerHTML = html || '<p class="hint">Ningún producto coincide con la búsqueda.</p>';
}

function pintarTicket() {
  var p = pedidoActual();
  document.getElementById('titulo-pedido').textContent = 'Mesa ' + mesaActual;
  if (p) {
    document.getElementById('sub-pedido').textContent = 'Pedido ' + p.n + ' · ' + (p.cliente === '—' ? 'Sin cliente' : p.cliente) + ' · ' + p.canal;
  } else {
    document.getElementById('sub-pedido').textContent = 'Sin pedido. Toca un producto para abrir uno.';
  }
  var html = '';
  var lineas = p ? p.lineas : [];
  var pendientes = 0, porConfirmar = 0;
  for (var i = 0; i < lineas.length; i++) {
    var l = lineas[i];
    var pend = l.despacho === 'Pendiente', borrador = l.despacho === 'Por confirmar';
    if (pend) pendientes++;
    if (borrador) porConfirmar++;
    var cantidad = borrador
      ? '<button type="button" class="paso" data-accion="menos" aria-label="Quitar una unidad">−</button><span class="cant">' + l.cant +
        '</span><button type="button" class="paso" data-accion="mas" aria-label="Agregar una unidad">+</button>'
      : '<span class="cant fija">× ' + l.cant + '</span>';
    var acciones = borrador ? '<button type="button" class="enlace" data-accion="nota">Agregar nota</button>' : (pend ? '<button type="button" class="enlace" data-accion="despachar">Despachar</button>' : '');
    var nota = notaAbierta === i
      ? '<input class="nota" type="text" maxlength="200" value="' + esc(l.esp) + '" placeholder="Ej. con sal y limón" aria-label="Nota del producto">'
      : (l.esp ? '<span class="l-nota">' + esc(l.esp) + '</span>' : '');
    html += '<li class="linea" data-i="' + i + '"><div class="l-top"><span class="l-nombre">' + esc(l.producto) + '</span><span class="l-valor">' + pesos(l.cant * l.precio) + '</span></div>' +
      '<div class="l-sub">' + (borrador ? '' : '<span class="badge badge-' + CLASE[l.despacho] + '">' + l.despacho + '</span>') + '<span>' + pesos(l.precio) + ' c/u</span></div>' + nota +
      '<div class="l-acc"><span class="cantidad">' + cantidad + '</span><span class="acciones">' + acciones + '</span></div></li>';
  }
  listaLineas.innerHTML = html || '<li class="vacio">Nada pedido todavía</li>';
  if (notaAbierta !== -1) { var campo = listaLineas.querySelector('.nota'); if (campo) campo.focus(); }

  var t = p ? totalesDe(p, 0) : { subtotal: 0, impuesto: 0, total: 0 };
  document.getElementById('subtotal').textContent = pesos(t.subtotal);
  document.getElementById('impuesto').textContent = pesos(t.impuesto);
  document.getElementById('total').textContent = pesos(t.total);
  botonEnviar.hidden = !porConfirmar;
  botonEnviar.textContent = 'Confirmar pedido (' + porConfirmar + ')';
  botonTodo.hidden = pendientes < 2;
  botonTodo.textContent = 'Despachar todo (' + pendientes + ')';

  // Poka-yoke: el cobro solo se habilita cuando se puede cobrar, y dice por qué no
  var motivo = '';
  if (!turnoAbierto()) motivo = 'La caja está cerrada: ábrela en Caja para cobrar.';
  else if (!p || p.lineas.length === 0) motivo = 'Agrega al menos un producto.';
  else if (porConfirmar > 0) motivo = 'Confirma el pedido para enviarlo a la cocina y al bar.';
  else if (pendientes > 0) motivo = areaElegida() === 'mesas' ? 'El bar y la cocina todavía lo están preparando.' : 'Despacha los productos pendientes antes de cobrar.';
  botonCobrar.disabled = motivo !== '';
  botonCobrar.textContent = p && p.lineas.length ? (areaElegida() === 'mesas' && !pendientes ? 'Entregado · Cobrar ' : 'Cobrar ') + pesos(t.total) : 'Cobrar';
  document.getElementById('motivo-cobro').textContent = motivo;

  var unidades = 0;
  for (var u = 0; u < lineas.length; u++) unidades += lineas[u].cant;
  document.getElementById('canasta-mesa').textContent = 'Mesa ' + mesaActual;
  document.getElementById('barra-mesa-txt').textContent = 'Pedido mesa ' + mesaActual;
  document.getElementById('canasta-total').textContent = pesos(t.total);
  document.getElementById('canasta-n').textContent = unidades;
}

function refrescar() {
  var p = pedidoActual();
  if (p) p.estado = estadoDePedido(p);
  actualizarMesas();
  guardar();
  pintarMesas();
  pintarProductos();
  pintarTicket();
}

function aviso(texto, tipo) {
  var caja = document.getElementById('msg-pedido');
  caja.textContent = texto;
  caja.className = 'msg msg-' + tipo;
}

// Mesas, categorías y buscador
cajaMesas.addEventListener('click', function (e) {
  var b = e.target.closest('.mesa');
  if (!b) return;
  mesaActual = Number(b.dataset.n);
  notaAbierta = -1;
  aviso('', 'ok');
  refrescar();
});
cajaChips.addEventListener('click', function (e) {
  var b = e.target.closest('.chip');
  if (!b) return;
  categoria = b.dataset.cat;
  pintarChips();
  pintarProductos();
});
document.getElementById('buscar-producto').addEventListener('input', pintarProductos);

// Sumar o restar un producto desde su tarjeta. Tocar la tarjeta suma una unidad; el pedido se abre si la mesa no tiene uno.
// Al llegar a 0 se pregunta antes de eliminar el producto del pedido
var dlgQuitar = document.getElementById('dlg-quitar');
var alConfirmarQuitar = null;
function pedirQuitar(nombre, alConfirmar) {
  document.getElementById('q-texto').textContent = '¿Quitar ' + nombre + ' del pedido?';
  alConfirmarQuitar = alConfirmar;
  dlgQuitar.showModal();
}
document.getElementById('q-cancelar').addEventListener('click', function () { alConfirmarQuitar = null; dlgQuitar.close(); });
document.getElementById('q-si').addEventListener('click', function () {
  var hacer = alConfirmarQuitar;
  alConfirmarQuitar = null;
  dlgQuitar.close();
  if (hacer) hacer();
});

function cambiarCantidad(i, d) {
  var prod = ESTADO.productos[i];
  var p = pedidoActual();
  if (d > 0) {
    if (disponibleDe(prod) < 1) { aviso('No queda más ' + prod.nombre + ' en inventario.', 'err'); return; }
    if (!p) {
      var siguiente = 0;
      for (var k = 0; k < ESTADO.pedidos.length; k++) siguiente = Math.max(siguiente, ESTADO.pedidos[k].n);
      p = { n: siguiente + 1, mesa: mesaActual, mesero: usuarioActual(), cliente: '—', canal: 'Mesero', fecha: ahoraTexto(), estado: 'Abierto', venta: 0, lineas: [] };
      ESTADO.pedidos.push(p);
    }
    var igual = null;
    for (var j2 = 0; j2 < p.lineas.length; j2++) {
      if (p.lineas[j2].producto === prod.nombre && p.lineas[j2].esp === '' && p.lineas[j2].despacho === 'Por confirmar') igual = p.lineas[j2];
    }
    if (igual) igual.cant += 1;
    else p.lineas.push({ producto: prod.nombre, cant: 1, precio: prod.precio, iva: prod.iva, imp: claveImp(prod), esp: '', despacho: 'Por confirmar' });
  } else if (p) {
    for (var m = 0; m < p.lineas.length; m++) {
      var l = p.lineas[m];
      if (l.producto === prod.nombre && l.despacho === 'Por confirmar' && l.esp === '') {
        if (l.cant === 1) {
          pedirQuitar(prod.nombre, function () {
            var q = pedidoActual();
            for (var n2 = 0; n2 < q.lineas.length; n2++) {
              if (q.lineas[n2].producto === prod.nombre && q.lineas[n2].despacho === 'Por confirmar' && q.lineas[n2].esp === '') { q.lineas.splice(n2, 1); break; }
            }
            if (q.lineas.length === 0) q.estado = 'Anulado';
            aviso('', 'ok');
            refrescar();
          });
          return;
        }
        l.cant -= 1;
        break;
      }
    }
    if (p.lineas.length === 0) p.estado = 'Anulado';
  }
  aviso('', 'ok');
  refrescar();
}

cajaProductos.addEventListener('click', function (e) {
  var tarjeta = e.target.closest('.producto');
  if (!tarjeta) return;
  var boton = e.target.closest('[data-d]');
  var d = boton ? Number(boton.dataset.d) : 1;
  if (tarjeta.getAttribute('aria-disabled') === 'true' && d > 0) return;   // agotado: solo se puede restar
  cambiarCantidad(Number(tarjeta.dataset.i), d);
});
cajaProductos.addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('producto')) { e.preventDefault(); e.target.click(); }
});

// Acciones de cada línea del ticket
listaLineas.addEventListener('click', function (e) {
  var b = e.target.closest('button[data-accion]');
  if (!b) return;
  var p = pedidoActual();
  var i = Number(b.closest('.linea').dataset.i);
  var l = p.lineas[i];
  var accion = b.dataset.accion;
  if (accion === 'mas') {
    var prod = buscarPor(ESTADO.productos, 'nombre', l.producto);
    if (disponibleDe(prod) < 1) { aviso('No queda más ' + l.producto + ' en inventario.', 'err'); return; }
    l.cant += 1;
  }
  if (accion === 'menos') {
    if (l.cant > 1) l.cant -= 1;
    else {
      pedirQuitar(l.producto, function () {
        var q = pedidoActual();
        q.lineas.splice(i, 1);
        if (q.lineas.length === 0) q.estado = 'Anulado';
        notaAbierta = -1;
        refrescar();
      });
      return;
    }
  }
  if (accion === 'nota') notaAbierta = notaAbierta === i ? -1 : i;
  if (accion === 'despachar') {
    despacharLinea(p, i);
    aviso('Despachado: ' + l.producto + ' × ' + l.cant + '. El inventario descontó lo que indica su receta.', 'ok');
  }
  refrescar();
});
listaLineas.addEventListener('change', function (e) {
  if (!e.target.classList.contains('nota')) return;
  pedidoActual().lineas[notaAbierta].esp = e.target.value.trim();
  notaAbierta = -1;
  refrescar();
});

// Antes de enviar, el pedido se lee con el cliente: se muestra lo que falta por enviar
botonEnviar.addEventListener('click', function () {
  var p = pedidoActual();
  var nuevos = p ? p.lineas.filter(function (l) { return l.despacho === 'Por confirmar'; }) : [];
  if (!nuevos.length) return;
  var total = 0;
  nuevos.forEach(function (l) { total += l.cant * l.precio; });
  document.getElementById('cf-mesa').textContent = 'Mesa ' + mesaActual + (p.cliente && p.cliente !== '—' ? ' · ' + p.cliente : '');
  document.getElementById('cf-lista').innerHTML = nuevos.map(function (l) { return '<li><span><b>' + l.cant + ' ×</b> ' + esc(l.producto) + (l.esp ? '<small>' + esc(l.esp) + '</small>' : '') + '</span><span>' + pesos(l.cant * l.precio) + '</span></li>'; }).join('');
  document.getElementById('cf-total').textContent = 'Total: ' + pesos(total);
  document.getElementById('dlg-confirmar').showModal();
});
document.getElementById('cf-volver').addEventListener('click', function () { document.getElementById('dlg-confirmar').close(); });
document.getElementById('cf-enviar').addEventListener('click', function () { document.getElementById('dlg-confirmar').close(); confirmarPedido(); });
botonTodo.addEventListener('click', function () {
  var p = pedidoActual();
  for (var i = 0; i < p.lineas.length; i++) if (p.lineas[i].despacho === 'Pendiente') despacharLinea(p, i);
  aviso('Todo despachado. El inventario descontó las recetas.', 'ok');
  refrescar();
});

// ---------- Cobro: la ventana es la misma de Caja (js/cobro.js) ----------
botonCobrar.addEventListener('click', function () {
  abrirCobro(pedidoActual(), function (venta, mensaje) { refrescar(); aviso(mensaje, 'ok'); });
});

pintarChips();
refrescar();

/* Al bajar la carta, el buscador sube al encabezado (el título pasa a "Pedido mesa N") y las categorías quedan fijas arriba de la carta */
var cartaEl = document.querySelector('.carta');
var buscadorEl = document.querySelector('#barra-in .search');
var tituloEnc = document.querySelector('.encabezado .intro');
var enEncabezado = false;
var FLECHA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
var barraEl = document.getElementById('carta-barra');
var hueco = document.createElement('div');
hueco.setAttribute('aria-hidden', 'true');

function ubicarBarra() {
  var antes = enEncabezado;
  // en pantalla grande el nombre de la mesa y el buscador van siempre en el encabezado
  enEncabezado = window.innerWidth > 960;
  document.body.classList.toggle('barra-arriba', enEncabezado);
  barraEl.style.top = '';
  if (enEncabezado) {
    var btnTitulo = tituloEnc.querySelector('.titulo-mesa');
    if (!btnTitulo) {
      tituloEnc.innerHTML = '<button type="button" class="titulo-mesa" aria-haspopup="listbox"><span></span>' + FLECHA + '</button>';
      btnTitulo = tituloEnc.querySelector('.titulo-mesa');
    }
    btnTitulo.firstChild.textContent = 'Pedido mesa ' + mesaActual;
  } else if (tituloEnc.querySelector('.titulo-mesa')) { tituloEnc.textContent = 'Pedidos'; cerrarListaMesas(); }
  if (enEncabezado) {
    var enc = document.querySelector('.encabezado').getBoundingClientRect();
    var tit = tituloEnc.getBoundingClientRect();
    var izq = tit.right + 24;
    var der = enc.right - 16;
    buscadorEl.style.top = (enc.top + (enc.height - 42) / 2) + 'px';
    buscadorEl.style.left = izq + 'px';
    buscadorEl.style.width = Math.min(320, Math.max(180, der - izq)) + 'px';
  } else {
    buscadorEl.style.top = buscadorEl.style.left = buscadorEl.style.width = '';
  }
}
cartaEl.addEventListener('scroll', ubicarBarra);
window.addEventListener('resize', ubicarBarra);
var refrescarBase = refrescar;
refrescar = function () { refrescarBase(); ubicarBarra(); };
window.addEventListener('load', ubicarBarra);
ubicarBarra();

/* Pantallas angostas: el ticket es un panel que se despliega desde la canasta */
function abrirTicket(abrir) {
  document.body.classList.toggle('ticket-abierto', abrir);
  document.getElementById('btn-canasta').setAttribute('aria-expanded', abrir ? 'true' : 'false');
}
document.getElementById('btn-canasta').addEventListener('click', function () { abrirTicket(true); });
document.getElementById('cerrar-ticket').addEventListener('click', function () { abrirTicket(false); });
document.getElementById('otro-producto').addEventListener('click', function () { abrirTicket(false); });
document.getElementById('ticket-fondo').addEventListener('click', function () { abrirTicket(false); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('ticket-abierto')) abrirTicket(false); });
window.addEventListener('resize', function () { if (window.innerWidth > 960) abrirTicket(false); });


/* Lista de mesas: se abre desde el nombre "Pedido mesa N" */
var listaMesas = document.getElementById('lista-mesas');
var anclaLista = null;

function cerrarListaMesas() {
  listaMesas.hidden = true;
  if (anclaLista) anclaLista.setAttribute('aria-expanded', 'false');
  anclaLista = null;
}

function abrirListaMesas(ancla) {
  var html = '';
  for (var i = 0; i < ESTADO.mesas.length; i++) {
    var m = ESTADO.mesas[i];
    var p = pedidoDeMesa(m.n);
    var valor = p ? pesos(totalesDe(p, 0).total) : (m.estado === 'Disponible' ? 'Libre' : m.estado);
    html += '<button type="button" role="option" class="item-mesa est-' + m.estado.toUpperCase() + (m.n === mesaActual ? ' sel' : '') + '" data-n="' + m.n + '" aria-selected="' + (m.n === mesaActual) + '">' +
      '<span class="im-cab"><img src="icons/inicio/' + ICONO_MESA[m.estado] + '.svg" alt=""><b>MESA ' + m.n + '</b></span>' +
      '<span class="im-valor' + (p ? '' : ' libre') + '">' + valor + '</span><span class="im-sub">' + m.capacidad + ' puestos</span></button>';
  }
  listaMesas.innerHTML = html;
  listaMesas.hidden = false;
  var r = ancla.getBoundingClientRect();
  var ancho = Math.min(420, window.innerWidth - 16);
  listaMesas.style.width = ancho + 'px';
  listaMesas.style.left = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)) + 'px';
  listaMesas.style.top = (r.bottom + 6) + 'px';
  anclaLista = ancla;
  ancla.setAttribute('aria-expanded', 'true');
}

document.addEventListener('click', function (e) {
  var titulo = e.target.closest('.titulo-mesa');
  if (titulo) {
    if (anclaLista === titulo) cerrarListaMesas(); else abrirListaMesas(titulo);
    return;
  }
  var item = e.target.closest('.item-mesa');
  if (item) {
    cajaMesas.querySelector('.mesa[data-n="' + item.dataset.n + '"]').click();
    cerrarListaMesas();
    return;
  }
  if (!listaMesas.hidden && !e.target.closest('#lista-mesas')) cerrarListaMesas();
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarListaMesas(); });
cartaEl.addEventListener('scroll', cerrarListaMesas);
