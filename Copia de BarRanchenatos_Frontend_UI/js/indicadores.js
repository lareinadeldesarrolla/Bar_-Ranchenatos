/* Catálogo de indicadores de gerencia.
   Cada indicador sabe calcularse con los datos de datos.js y se puede ver como gráfico y como tabla.
   Tipos: kpi (una cifra), barras (columnas), hbarras (ranking horizontal), dona (partes de un total).
   datos() devuelve { columnas, filas, formatos, graficar } o, para un kpi, { valor, detalle }.
   En las filas, la primera columna es la etiqueta y la columna "graficar" es la cifra que se dibuja. */

var INDICADORES = [];

function indicador(id, grupo, titulo, ayuda, tipo, ancho, datos) {
  INDICADORES.push({ id: id, grupo: grupo, titulo: titulo, ayuda: ayuda, tipo: tipo, ancho: ancho, datos: datos });
}

// ---------- Ayudas de cálculo ----------
var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function sumar(lista, campo) {
  var s = 0;
  lista.forEach(function (x) { s += x[campo]; });
  return s;
}

function turnoMostrado() { return turnoAbierto() || ESTADO.turnos[ESTADO.turnos.length - 1]; }

function turnoPrevio() {
  var actual = turnoMostrado();
  var cerrados = ESTADO.turnos.filter(function (t) { return t.id !== actual.id && t.cierra !== '' && ventasDe(t).length > 0; });
  cerrados.sort(function (a, b) { return a.abre < b.abre ? 1 : -1; });
  return cerrados[0] || null;
}

function ventasDe(turno) {
  return turno ? ventasActivas().filter(function (v) { return v.turno === turno.id; }) : [];
}

function lineasDe(venta) {
  var p = buscarPor(ESTADO.pedidos, 'n', venta.pedido);
  return p ? p.lineas : [];
}

function costoDe(producto) {
  var costo = 0;
  producto.receta.forEach(function (r) {
    var insumo = buscarPor(ESTADO.insumos, 'nombre', r[0]);
    if (insumo) costo += insumo.costo * r[1];
  });
  return costo;
}

// Unidades e ingresos por producto, con todas las ventas registradas
function ventasPorProducto() {
  var datos = {};
  ESTADO.productos.forEach(function (p) {
    var costo = costoDe(p);
    datos[p.nombre] = { producto: p, unidades: 0, ingresos: 0, costo: costo, margen: p.precio - costo, margenPct: p.precio ? Math.round((p.precio - costo) / p.precio * 100) : 0 };
  });
  ventasActivas().forEach(function (v) {
    lineasDe(v).forEach(function (l) {
      if (datos[l.producto]) { datos[l.producto].unidades += l.cant; datos[l.producto].ingresos += l.cant * l.precio; }
    });
  });
  return Object.keys(datos).map(function (k) { return datos[k]; });
}

// Suma una cifra por grupo y devuelve [[etiqueta, total, cantidad], ...]
function agrupar(lista, clave, valor) {
  var grupos = {}, orden = [];
  lista.forEach(function (x) {
    var k = clave(x);
    if (!grupos[k]) { grupos[k] = [k, 0, 0]; orden.push(k); }
    grupos[k][1] += valor(x);
    grupos[k][2] += 1;
  });
  return orden.map(function (k) { return grupos[k]; });
}


// Agrupa por hora ordenando por fecha y hora. Si las ventas abarcan varios días, la etiqueta lleva el día (14/10 12h).
function agruparPorHora(lista, valor) {
  var ordenadas = lista.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  var dias = {};
  ordenadas.forEach(function (v) { dias[v.fecha.slice(0, 10)] = true; });
  var varios = Object.keys(dias).length > 1;
  return agrupar(ordenadas, function (v) { return v.fecha.slice(0, 13); }, valor).map(function (f) {
    var hh = f[0].slice(11, 13);
    return [varios ? f[0].slice(8, 10) + '/' + f[0].slice(5, 7) + ' ' + hh + 'h' : hh + ':00', f[1], f[2]];
  });
}

function porValor(filas, columna, descendente) {
  return filas.slice().sort(function (a, b) { return descendente ? b[columna] - a[columna] : a[columna] - b[columna]; });
}

function fechaTurno(t) { return Number(t.abre.slice(8, 10)) + ' ' + MESES_CORTOS[Number(t.abre.slice(5, 7)) - 1]; }
function n0(n) { return Math.round(n).toLocaleString('es-CO'); }
function pct(n) { return n + ' %'; }

// ============================================================
// VENTAS DEL TURNO
// ============================================================
indicador('ventas_turno', 'Ventas', 'Ventas del turno', 'Total vendido en el turno abierto y su diferencia con el turno anterior.', 'kpi', 3, function () {
  var actual = sumar(ventasDe(turnoMostrado()), 'total');
  var previo = turnoPrevio();
  var anterior = previo ? sumar(ventasDe(previo), 'total') : 0;
  var detalle = 'Sin ventas en el turno anterior para comparar';
  if (anterior > 0) {
    var dif = Math.round((actual - anterior) / anterior * 100);
    detalle = (dif >= 0 ? '▲ ' : '▼ ') + Math.abs(dif) + ' % frente al turno anterior (' + pesos(anterior) + ')';
  }
  return { valor: pesos(actual), detalle: detalle };
});

indicador('num_ventas', 'Ventas', 'Ventas realizadas', 'Cantidad de cuentas cobradas en el turno.', 'kpi', 3, function () {
  var v = ventasDe(turnoMostrado());
  return { valor: String(v.length), detalle: v.length ? 'Última a las ' + v[v.length - 1].fecha.slice(11) : 'Todavía no se ha cobrado ninguna' };
});

indicador('ticket', 'Ventas', 'Ticket promedio', 'Valor promedio de cada cuenta cobrada en el turno.', 'kpi', 3, function () {
  var v = ventasDe(turnoMostrado());
  var mayor = 0;
  v.forEach(function (x) { mayor = Math.max(mayor, x.total); });
  return { valor: v.length ? pesos(sumar(v, 'total') / v.length) : '—', detalle: v.length ? 'La cuenta más alta fue de ' + pesos(mayor) : 'Sin ventas todavía' };
});

indicador('descuentos', 'Ventas', 'Descuentos entregados', 'Valor descontado por promociones en el turno.', 'kpi', 3, function () {
  var v = ventasDe(turnoMostrado());
  var d = sumar(v, 'descuento');
  var subtotal = sumar(v, 'subtotal');
  return { valor: pesos(d), detalle: subtotal ? Math.round(d / subtotal * 1000) / 10 + ' % de lo vendido antes de impuestos' : 'Sin ventas todavía' };
});

indicador('impuestos', 'Ventas', 'Impuestos del turno', 'Impuesto cobrado en las ventas del turno.', 'kpi', 3, function () {
  var v = ventasDe(turnoMostrado());
  return { valor: pesos(sumar(v, 'impuesto')), detalle: 'Sobre ventas de ' + pesos(sumar(v, 'subtotal') - sumar(v, 'descuento')) };
});

indicador('ventas_hora', 'Ventas', 'Ventas por hora', 'Cuánto se vende en cada hora del turno: muestra cuándo se llena el bar.', 'barras', 6, function () {
  var filas = agruparPorHora(ventasDe(turnoMostrado()), function (v) { return v.total; });
  return { columnas: ['Hora', 'Ventas', 'Cuentas'], filas: filas, formatos: [null, pesos, null], graficar: 1 };
});

indicador('ventas_historial', 'Ventas', 'Ventas por turno', 'Total vendido en cada turno registrado, para comparar noches.', 'barras', 6, function () {
  var filas = ESTADO.turnos.slice().sort(function (a, b) { return a.abre < b.abre ? -1 : 1; }).map(function (t) {
    var v = ventasDe(t);
    return [fechaTurno(t), sumar(v, 'total'), v.length];
  });
  return { columnas: ['Turno', 'Ventas', 'Cuentas'], filas: filas.slice(-12), formatos: [null, pesos, null], graficar: 1 };
});

indicador('ticket_historial', 'Ventas', 'Ticket promedio por turno', 'Cuánto gasta en promedio cada cuenta, turno a turno.', 'barras', 6, function () {
  var filas = ESTADO.turnos.slice().sort(function (a, b) { return a.abre < b.abre ? -1 : 1; }).map(function (t) {
    var v = ventasDe(t);
    return [fechaTurno(t), v.length ? Math.round(sumar(v, 'total') / v.length) : 0, v.length];
  });
  return { columnas: ['Turno', 'Ticket promedio', 'Cuentas'], filas: filas.slice(-12), formatos: [null, pesos, null], graficar: 1 };
});

indicador('descuentos_historial', 'Ventas', 'Descuentos por turno', 'Valor descontado en cada turno.', 'barras', 6, function () {
  var filas = ESTADO.turnos.slice().sort(function (a, b) { return a.abre < b.abre ? -1 : 1; }).map(function (t) {
    return [fechaTurno(t), sumar(ventasDe(t), 'descuento'), ventasDe(t).filter(function (v) { return v.promo; }).length];
  });
  return { columnas: ['Turno', 'Descuentos', 'Cuentas con promoción'], filas: filas.slice(-12), formatos: [null, pesos, null], graficar: 1 };
});

indicador('ventas_mesa', 'Ventas', 'Ventas por mesa', 'Qué mesas generan más ingresos.', 'barras', 6, function () {
  var filas = porValor(agrupar(ventasActivas(), function (v) { return 'Mesa ' + v.mesa; }, function (v) { return v.total; }), 1, true);
  return { columnas: ['Mesa', 'Ventas', 'Cuentas'], filas: filas, formatos: [null, pesos, null], graficar: 1 };
});

indicador('ventas_canal', 'Ventas', 'Ventas por canal', 'Cuánto viene de pedidos tomados por el mesero y cuánto de la app.', 'dona', 4, function () {
  var filas = agrupar(ventasActivas(), function (v) { var p = buscarPor(ESTADO.pedidos, 'n', v.pedido); return p ? p.canal : 'Sin dato'; }, function (v) { return v.total; });
  return { columnas: ['Canal', 'Ventas', 'Cuentas'], filas: porValor(filas, 1, true), formatos: [null, pesos, null], graficar: 1 };
});

indicador('ventas_atendio', 'Ventas', 'Ventas por empleado', 'Cuánto cobró cada persona.', 'hbarras', 6, function () {
  var filas = porValor(agrupar(ventasActivas(), function (v) { return v.cajero; }, function (v) { return v.total; }), 1, true);
  return { columnas: ['Empleado', 'Ventas', 'Cuentas'], filas: filas, formatos: [null, pesos, null], graficar: 1 };
});

// ============================================================
// PRODUCTOS
// ============================================================
indicador('top_unidades', 'Productos', 'Productos más vendidos', 'Unidades vendidas por producto, de mayor a menor.', 'hbarras', 6, function () {
  var filas = porValor(ventasPorProducto().map(function (d) { return [d.producto.nombre, d.unidades, d.ingresos]; }), 1, true);
  return { columnas: ['Producto', 'Unidades', 'Ingresos'], filas: filas, formatos: [null, n0, pesos], graficar: 1 };
});

indicador('baja_venta', 'Productos', 'Productos de baja venta', 'Los productos que menos se venden, con las unidades que se pueden preparar hoy.', 'hbarras', 6, function () {
  var filas = porValor(ventasPorProducto().map(function (d) { return [d.producto.nombre, d.unidades, disponibleDe(d.producto)]; }), 1, false);
  return { columnas: ['Producto', 'Unidades vendidas', 'Se pueden preparar'], filas: filas, formatos: [null, n0, n0], graficar: 1 };
});

indicador('ingresos_producto', 'Productos', 'Ingresos por producto', 'Cuánto dinero aporta cada producto.', 'hbarras', 6, function () {
  var filas = porValor(ventasPorProducto().map(function (d) { return [d.producto.nombre, d.ingresos, d.unidades]; }), 1, true);
  return { columnas: ['Producto', 'Ingresos', 'Unidades'], filas: filas, formatos: [null, pesos, n0], graficar: 1 };
});

indicador('categoria', 'Productos', 'Ventas por categoría', 'Qué familia de productos pesa más en los ingresos.', 'dona', 4, function () {
  var filas = agrupar(ventasPorProducto(), function (d) { return d.producto.cat; }, function (d) { return d.ingresos; });
  return { columnas: ['Categoría', 'Ingresos', 'Productos'], filas: porValor(filas, 1, true), formatos: [null, pesos, null], graficar: 1 };
});

indicador('margen_producto', 'Productos', 'Ganancia por unidad', 'Precio de venta menos el costo de los insumos de su receta.', 'hbarras', 6, function () {
  var filas = porValor(ventasPorProducto().map(function (d) { return [d.producto.nombre, d.margen, d.margenPct]; }), 1, true);
  return { columnas: ['Producto', 'Ganancia por unidad', 'Margen'], filas: filas, formatos: [null, pesos, pct], graficar: 1 };
});

indicador('margen_pct', 'Productos', 'Margen por producto', 'Qué porcentaje del precio es ganancia.', 'hbarras', 6, function () {
  var filas = porValor(ventasPorProducto().map(function (d) { return [d.producto.nombre, d.margenPct, d.costo]; }), 1, true);
  return { columnas: ['Producto', 'Margen', 'Costo por unidad'], filas: filas, formatos: [null, pct, pesos], graficar: 1 };
});

indicador('utilidad_producto', 'Productos', 'Ganancia estimada por producto', 'Unidades vendidas por la ganancia de cada unidad.', 'hbarras', 6, function () {
  var filas = porValor(ventasPorProducto().map(function (d) { return [d.producto.nombre, d.unidades * d.margen, d.unidades]; }), 1, true);
  return { columnas: ['Producto', 'Ganancia estimada', 'Unidades'], filas: filas, formatos: [null, pesos, n0], graficar: 1 };
});

indicador('utilidad_total', 'Productos', 'Ganancia estimada', 'Ganancia total de lo vendido, descontando el costo de los insumos.', 'kpi', 3, function () {
  var datos = ventasPorProducto();
  var ganancia = 0, ingresos = 0;
  datos.forEach(function (d) { ganancia += d.unidades * d.margen; ingresos += d.ingresos; });
  return { valor: pesos(ganancia), detalle: ingresos ? 'Es el ' + Math.round(ganancia / ingresos * 100) + ' % de lo vendido antes de impuestos' : 'Sin ventas todavía' };
});

indicador('disponibilidad', 'Productos', 'Productos que se pueden preparar', 'Cuántas unidades de cada producto se pueden preparar con lo que hay en inventario.', 'hbarras', 6, function () {
  var filas = porValor(ESTADO.productos.map(function (p) { return [p.nombre, disponibleDe(p), p.cat]; }), 1, false);
  return { columnas: ['Producto', 'Se pueden preparar', 'Categoría'], filas: filas, formatos: [null, n0, null], graficar: 1 };
});

indicador('sin_ventas', 'Productos', 'Productos sin ventas', 'Productos de la carta que todavía no se han vendido.', 'tabla', 6, function () {
  var filas = ventasPorProducto().filter(function (d) { return d.unidades === 0; }).map(function (d) { return [d.producto.nombre, pesos(d.producto.precio), disponibleDe(d.producto)]; });
  return { columnas: ['Producto', 'Precio', 'Se pueden preparar'], filas: filas, formatos: [null, null, n0], graficar: -1 };
});

indicador('candidatos', 'Promociones', 'Productos para promocionar', 'Venden poco, dejan buen margen y se pueden preparar: son los mejores candidatos a una promoción.', 'tabla', 6, function () {
  var datos = ventasPorProducto();
  var maximo = 1;
  datos.forEach(function (d) { maximo = Math.max(maximo, d.unidades); });
  var filas = datos.map(function (d) {
    var disp = disponibleDe(d.producto);
    var puntaje = disp > 0 ? Math.round(d.margenPct * (1 - d.unidades / maximo)) : 0;
    return [d.producto.nombre, d.unidades, d.margenPct, disp, puntaje];
  }).filter(function (f) { return f[4] > 0; });
  filas = porValor(filas, 4, true).slice(0, 6).map(function (f) {
    return [f[0], f[1], f[2], f[3], f[4] >= 30 ? 'Promocionar' : 'Mirar'];
  });
  return { columnas: ['Producto', 'Vendidos', 'Margen', 'Se pueden preparar', 'Sugerencia'], filas: filas, formatos: [null, n0, pct, n0, null], graficar: -1 };
});

indicador('promos_uso', 'Promociones', 'Uso de promociones', 'Cuántas veces se aplicó cada promoción y cuánto se descontó.', 'barras', 6, function () {
  var filas = ESTADO.promociones.map(function (p) {
    var v = ventasActivas().filter(function (x) { return x.promo === p.nombre; });
    return [p.nombre, sumar(v, 'descuento'), v.length];
  });
  return { columnas: ['Promoción', 'Descuento entregado', 'Veces usada'], filas: filas, formatos: [null, pesos, null], graficar: 1 };
});

// ============================================================
// OPERACIÓN
// ============================================================
indicador('ocupacion', 'Servicio', 'Ocupación del salón', 'Porcentaje de mesas ocupadas en este momento.', 'kpi', 3, function () {
  var ocupadas = ESTADO.mesas.filter(function (m) { return m.estado === 'Ocupada'; }).length;
  return { valor: Math.round(ocupadas / ESTADO.mesas.length * 100) + ' %', detalle: ocupadas + ' de ' + ESTADO.mesas.length + ' mesas ocupadas' };
});

indicador('pedidos_curso', 'Servicio', 'Pedidos en curso', 'Pedidos abiertos que todavía no se han cobrado.', 'kpi', 3, function () {
  var abiertos = pedidosEnCurso();
  return { valor: String(abiertos.length), detalle: abiertos.length ? 'Por cobrar: ' + pesos(abiertos.reduce(function (s, p) { return s + totalesDe(p, 0).total; }, 0)) : 'No hay pedidos abiertos' };
});

indicador('productos_pedido', 'Servicio', 'Productos por pedido', 'Cuántos productos lleva en promedio cada pedido cobrado.', 'kpi', 3, function () {
  var cobrados = ESTADO.pedidos.filter(function (p) { return p.estado === 'Facturado'; });
  var unidades = 0;
  cobrados.forEach(function (p) { p.lineas.forEach(function (l) { unidades += l.cant; }); });
  return { valor: cobrados.length ? (Math.round(unidades / cobrados.length * 10) / 10).toLocaleString('es-CO') : '—', detalle: cobrados.length + ' pedidos cobrados' };
});

indicador('pedidos_estado', 'Servicio', 'Pedidos por estado', 'En qué punto está cada pedido.', 'dona', 4, function () {
  var filas = agrupar(ESTADO.pedidos, function (p) { return p.estado; }, function () { return 1; });
  return { columnas: ['Estado', 'Pedidos'], filas: porValor(filas, 1, true).map(function (f) { return [f[0], f[1]]; }), formatos: [null, n0], graficar: 1 };
});

indicador('mesas_estado', 'Servicio', 'Mesas por estado', 'Cuántas mesas hay libres, ocupadas o reservadas.', 'dona', 4, function () {
  var filas = agrupar(ESTADO.mesas, function (m) { return m.estado; }, function () { return 1; });
  return { columnas: ['Estado', 'Mesas'], filas: porValor(filas, 1, true).map(function (f) { return [f[0], f[1]]; }), formatos: [null, n0], graficar: 1 };
});

indicador('mesas_rotacion', 'Servicio', 'Cuentas por mesa', 'Cuántas veces se cobró cada mesa: muestra la rotación.', 'barras', 6, function () {
  var filas = ESTADO.mesas.map(function (m) { return ['Mesa ' + m.n, ventasActivas().filter(function (v) { return v.mesa === m.n; }).length, m.capacidad]; });
  return { columnas: ['Mesa', 'Cuentas cobradas', 'Capacidad'], filas: filas, formatos: [null, n0, n0], graficar: 1 };
});

// ============================================================
// MÁS INDICADORES DE VENTAS
// ============================================================
var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function diaSemana(v) { return DIAS[new Date(v.fecha.slice(0, 10) + 'T12:00:00').getDay()]; }
function turnoPorFecha() { return ESTADO.turnos.slice().sort(function (a, b) { return a.abre < b.abre ? -1 : 1; }); }
function ganancia(venta) {
  var g = 0;
  lineasDe(venta).forEach(function (l) {
    var p = buscarPor(ESTADO.productos, 'nombre', l.producto);
    if (p) g += l.cant * (p.precio - costoDe(p));
  });
  return g;
}

indicador('ventas_acum', 'Ventas', 'Ventas acumuladas', 'Todo lo vendido desde que hay registros.', 'kpi', 3, function () {
  return { valor: pesos(sumar(ventasActivas(), 'total')), detalle: ventasActivas().length + ' cuentas en ' + ESTADO.turnos.length + ' turnos' };
});

indicador('variacion', 'Ventas', 'Variación frente al turno anterior', 'Cuánto subieron o bajaron las ventas respecto al último turno con ventas.', 'kpi', 3, function () {
  var actual = sumar(ventasDe(turnoMostrado()), 'total');
  var previo = turnoPrevio();
  var anterior = previo ? sumar(ventasDe(previo), 'total') : 0;
  if (!anterior) return { valor: '—', detalle: 'No hay un turno anterior con ventas para comparar' };
  var dif = Math.round((actual - anterior) / anterior * 100);
  return { valor: (dif >= 0 ? '+' : '') + dif + ' %', detalle: pesos(actual) + ' frente a ' + pesos(anterior) };
});

indicador('cuenta_alta', 'Ventas', 'Cuenta más alta', 'La cuenta de mayor valor registrada.', 'kpi', 3, function () {
  var mejor = null;
  ventasActivas().forEach(function (v) { if (!mejor || v.total > mejor.total) mejor = v; });
  return mejor ? { valor: pesos(mejor.total), detalle: 'Mesa ' + mejor.mesa + ' · ' + mejor.fecha } : { valor: '—', detalle: 'Sin ventas todavía' };
});

indicador('cuenta_baja', 'Ventas', 'Cuenta más baja', 'La cuenta de menor valor registrada.', 'kpi', 3, function () {
  var menor = null;
  ventasActivas().forEach(function (v) { if (!menor || v.total < menor.total) menor = v; });
  return menor ? { valor: pesos(menor.total), detalle: 'Mesa ' + menor.mesa + ' · ' + menor.fecha } : { valor: '—', detalle: 'Sin ventas todavía' };
});

indicador('con_promo', 'Promociones', 'Cuentas con promoción', 'Qué porcentaje de las cuentas del turno usó una promoción.', 'kpi', 3, function () {
  var v = ventasDe(turnoMostrado());
  var con = v.filter(function (x) { return x.promo; }).length;
  return { valor: v.length ? Math.round(con / v.length * 100) + ' %' : '—', detalle: con + ' de ' + v.length + ' cuentas' };
});

indicador('hora_pico', 'Ventas', 'Hora pico', 'La hora en la que más se ha vendido.', 'kpi', 3, function () {
  var filas = porValor(agrupar(ventasActivas(), function (v) { return v.fecha.slice(11, 13) + ':00'; }, function (v) { return v.total; }), 1, true);
  return filas.length ? { valor: filas[0][0], detalle: pesos(filas[0][1]) + ' en ' + filas[0][2] + ' cuentas' } : { valor: '—', detalle: 'Sin ventas todavía' };
});

indicador('horas_pico', 'Ventas', 'Horas pico (todos los turnos)', 'Ventas sumadas por hora del día en todos los turnos: muestra cuándo se llena el bar.', 'barras', 6, function () {
  var filas = agrupar(ventasActivas(), function (v) { return v.fecha.slice(11, 13) + ':00'; }, function (v) { return v.total; });
  filas.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  return { columnas: ['Hora', 'Ventas', 'Cuentas'], filas: filas, formatos: [null, pesos, null], graficar: 1 };
});

indicador('dia_semana', 'Ventas', 'Ventas por día de la semana', 'Qué días se vende más.', 'barras', 6, function () {
  var filas = agrupar(ventasActivas(), diaSemana, function (v) { return v.total; });
  filas.sort(function (a, b) { return ((DIAS.indexOf(a[0]) + 6) % 7) - ((DIAS.indexOf(b[0]) + 6) % 7); });
  return { columnas: ['Día', 'Ventas', 'Cuentas'], filas: filas, formatos: [null, pesos, null], graficar: 1 };
});

indicador('rango_ticket', 'Ventas', 'Cuentas por rango de valor', 'Cuántas cuentas caen en cada rango de valor.', 'barras', 6, function () {
  var rangos = [['Menos de 20 mil', 0, 20000], ['20 a 50 mil', 20000, 50000], ['50 a 100 mil', 50000, 100000], ['Más de 100 mil', 100000, 1e12]];
  var filas = rangos.map(function (r) { return [r[0], ventasActivas().filter(function (v) { return v.total >= r[1] && v.total < r[2]; }).length]; });
  return { columnas: ['Rango', 'Cuentas'], filas: filas, formatos: [null, n0], graficar: 1 };
});

indicador('acumulado_hora', 'Ventas', 'Avance acumulado del turno', 'Cómo va creciendo el total vendido a lo largo del turno.', 'barras', 6, function () {
  var base = agruparPorHora(ventasDe(turnoMostrado()), function (v) { return v.total; });
  var suma = 0;
  var filas = base.map(function (f) { suma += f[1]; return [f[0], suma, f[1]]; });
  return { columnas: ['Hora', 'Acumulado', 'Vendido en la hora'], filas: filas, formatos: [null, pesos, pesos], graficar: 1 };
});

indicador('ganancia_historial', 'Productos', 'Ganancia estimada por turno', 'Ganancia (precio menos costo de receta) de lo vendido en cada turno.', 'barras', 6, function () {
  var filas = turnoPorFecha().map(function (t) {
    var g = 0;
    ventasDe(t).forEach(function (v) { g += ganancia(v); });
    return [fechaTurno(t), Math.round(g), ventasDe(t).length];
  });
  return { columnas: ['Turno', 'Ganancia estimada', 'Cuentas'], filas: filas.slice(-12), formatos: [null, pesos, null], graficar: 1 };
});

indicador('unidades_historial', 'Productos', 'Unidades vendidas por turno', 'Cuántos productos se vendieron en cada turno.', 'barras', 6, function () {
  var filas = turnoPorFecha().map(function (t) {
    var u = 0;
    ventasDe(t).forEach(function (v) { lineasDe(v).forEach(function (l) { u += l.cant; }); });
    return [fechaTurno(t), u, ventasDe(t).length];
  });
  return { columnas: ['Turno', 'Unidades', 'Cuentas'], filas: filas.slice(-12), formatos: [null, n0, null], graficar: 1 };
});

// ============================================================
// MÁS INDICADORES DE PRODUCTOS
// ============================================================
indicador('producto_estrella', 'Productos', 'Producto estrella', 'El producto que más unidades ha vendido.', 'kpi', 3, function () {
  var datos = porValor(ventasPorProducto().map(function (d) { return [d.producto.nombre, d.unidades, d.ingresos]; }), 1, true);
  return datos.length && datos[0][1] > 0 ? { valor: datos[0][0], detalle: n0(datos[0][1]) + ' unidades · ' + pesos(datos[0][2]) } : { valor: '—', detalle: 'Sin ventas todavía' };
});

indicador('producto_menor', 'Productos', 'Producto de menor venta', 'El producto de la carta que menos se ha vendido.', 'kpi', 3, function () {
  var datos = porValor(ventasPorProducto().map(function (d) { return [d.producto.nombre, d.unidades, disponibleDe(d.producto)]; }), 1, false);
  return datos.length ? { valor: datos[0][0], detalle: n0(datos[0][1]) + ' unidades · se pueden preparar ' + n0(datos[0][2]) } : { valor: '—', detalle: 'Sin productos' };
});

indicador('participacion', 'Productos', 'Participación en los ingresos', 'Qué parte de los ingresos aporta cada producto.', 'dona', 4, function () {
  var datos = ventasPorProducto();
  var total = 0;
  datos.forEach(function (d) { total += d.ingresos; });
  var filas = porValor(datos.map(function (d) { return [d.producto.nombre, d.ingresos, total ? Math.round(d.ingresos / total * 100) : 0]; }), 1, true);
  return { columnas: ['Producto', 'Ingresos', 'Participación'], filas: filas, formatos: [null, pesos, pct], graficar: 1 };
});

indicador('unidades_categoria', 'Productos', 'Unidades por categoría', 'Cuántas unidades se venden de cada familia de productos.', 'dona', 4, function () {
  var filas = agrupar(ventasPorProducto(), function (d) { return d.producto.cat; }, function (d) { return d.unidades; });
  return { columnas: ['Categoría', 'Unidades', 'Productos'], filas: porValor(filas, 1, true), formatos: [null, n0, null], graficar: 1 };
});

indicador('costo_vendido', 'Productos', 'Costo de lo vendido', 'Lo que costaron los insumos de todo lo vendido.', 'kpi', 3, function () {
  var costo = 0, ingresos = 0;
  ventasPorProducto().forEach(function (d) { costo += d.unidades * d.costo; ingresos += d.ingresos; });
  return { valor: pesos(costo), detalle: ingresos ? Math.round(costo / ingresos * 100) + ' % de lo vendido antes de impuestos' : 'Sin ventas todavía' };
});

indicador('margen_total', 'Productos', 'Margen total', 'Porcentaje de lo vendido que queda como ganancia.', 'kpi', 3, function () {
  var g = 0, ingresos = 0;
  ventasPorProducto().forEach(function (d) { g += d.unidades * d.margen; ingresos += d.ingresos; });
  return { valor: ingresos ? Math.round(g / ingresos * 100) + ' %' : '—', detalle: ingresos ? pesos(g) + ' de ' + pesos(ingresos) : 'Sin ventas todavía' };
});

indicador('costo_insumos', 'Productos', 'Costo de insumos consumidos', 'Cuánto costó cada insumo gastado en lo vendido.', 'hbarras', 6, function () {
  var gasto = {};
  ventasPorProducto().forEach(function (d) {
    d.producto.receta.forEach(function (r) {
      var insumo = buscarPor(ESTADO.insumos, 'nombre', r[0]);
      if (insumo) gasto[r[0]] = (gasto[r[0]] || 0) + d.unidades * r[1] * insumo.costo;
    });
  });
  var filas = porValor(Object.keys(gasto).map(function (k) { return [k, Math.round(gasto[k]), buscarPor(ESTADO.insumos, 'nombre', k).unidad]; }), 1, true);
  return { columnas: ['Insumo', 'Costo consumido', 'Unidad'], filas: filas, formatos: [null, pesos, null], graficar: 1 };
});

indicador('agotados', 'Productos', 'Productos agotados', 'Productos que ya no se pueden preparar con lo que hay.', 'kpi', 3, function () {
  var lista = ESTADO.productos.filter(function (p) { return disponibleDe(p) === 0; });
  return { valor: String(lista.length), detalle: lista.length ? lista.map(function (p) { return p.nombre; }).join(', ') : 'Todos se pueden preparar' };
});

indicador('por_agotarse', 'Productos', 'Productos por agotarse', 'Productos de los que se pueden preparar pocas unidades.', 'tabla', 6, function () {
  var filas = porValor(ESTADO.productos.map(function (p) { return [p.nombre, disponibleDe(p), p.cat]; }), 1, false).filter(function (f) { return f[1] <= 20; });
  return { columnas: ['Producto', 'Se pueden preparar', 'Categoría'], filas: filas, formatos: [null, n0, null], graficar: 1 };
});

indicador('carta_total', 'Productos', 'Productos en la carta', 'Cuántos productos se ofrecen.', 'kpi', 3, function () {
  var cats = {};
  ESTADO.productos.forEach(function (p) { cats[p.cat] = true; });
  return { valor: String(ESTADO.productos.length), detalle: Object.keys(cats).length + ' categorías' };
});

indicador('precio_prom', 'Productos', 'Precio promedio de la carta', 'Promedio de los precios de venta.', 'kpi', 3, function () {
  var precios = ESTADO.productos.map(function (p) { return p.precio; });
  var menor = Math.min.apply(null, precios), mayor = Math.max.apply(null, precios);
  return { valor: pesos(precios.reduce(function (a, b) { return a + b; }, 0) / precios.length), detalle: 'Desde ' + pesos(menor) + ' hasta ' + pesos(mayor) };
});

// ============================================================
// MÁS INDICADORES DE OPERACIÓN
// ============================================================
indicador('empleado_top', 'Servicio', 'Empleado destacado', 'Quien más ha cobrado.', 'kpi', 3, function () {
  var filas = porValor(agrupar(ventasActivas(), function (v) { return v.cajero; }, function (v) { return v.total; }), 1, true);
  return filas.length ? { valor: filas[0][0], detalle: pesos(filas[0][1]) + ' en ' + filas[0][2] + ' cuentas' } : { valor: '—', detalle: 'Sin ventas todavía' };
});

indicador('mejor_mesa', 'Servicio', 'Mesa más rentable', 'La mesa que más ha vendido.', 'kpi', 3, function () {
  var filas = porValor(agrupar(ventasActivas(), function (v) { return 'Mesa ' + v.mesa; }, function (v) { return v.total; }), 1, true);
  return filas.length ? { valor: filas[0][0], detalle: pesos(filas[0][1]) + ' en ' + filas[0][2] + ' cuentas' } : { valor: '—', detalle: 'Sin ventas todavía' };
});

indicador('ventas_puesto', 'Servicio', 'Ventas por puesto de cada mesa', 'Lo vendido por mesa dividido entre su capacidad: mide qué mesas se aprovechan mejor.', 'barras', 6, function () {
  var filas = ESTADO.mesas.map(function (m) {
    var total = sumar(ventasActivas().filter(function (v) { return v.mesa === m.n; }), 'total');
    return ['Mesa ' + m.n, Math.round(total / m.capacidad), m.capacidad];
  });
  return { columnas: ['Mesa', 'Venta por puesto', 'Capacidad'], filas: filas, formatos: [null, pesos, n0], graficar: 1 };
});

indicador('facturas_pend', 'Servicio', 'Facturas por transmitir', 'Ventas cuya factura electrónica aún no se ha enviado.', 'kpi', 3, function () {
  var p = ventasActivas().filter(function (v) { return v.factura === 'Pendiente'; });
  return { valor: String(p.length), detalle: p.length ? 'Por ' + pesos(sumar(p, 'total')) : 'Todas están transmitidas' };
});

indicador('facturas_ok', 'Servicio', 'Facturas aceptadas', 'Porcentaje de ventas con factura aceptada.', 'kpi', 3, function () {
  var ok = ventasActivas().filter(function (v) { return v.factura === 'Aceptada'; }).length;
  return { valor: ventasActivas().length ? Math.round(ok / ventasActivas().length * 100) + ' %' : '—', detalle: ok + ' de ' + ventasActivas().length + ' ventas' };
});

// ============================================================
// INVENTARIO (los insumos, para quien quiera verlos)
// ============================================================
indicador('valor_inventario', 'Inventario', 'Valor del inventario', 'Lo que valen los insumos que hay, a su costo.', 'kpi', 3, function () {
  var v = 0;
  ESTADO.insumos.forEach(function (i) { v += i.existencia * i.costo; });
  return { valor: pesos(v), detalle: ESTADO.insumos.length + ' insumos' };
});

indicador('insumos_bajo_n', 'Inventario', 'Insumos bajo el mínimo', 'Cuántos insumos están por debajo de su nivel mínimo.', 'kpi', 3, function () {
  var b = insumosBajos();
  return { valor: String(b.length), detalle: b.length ? b.map(function (i) { return i.nombre; }).join(', ') : 'Todo por encima del mínimo' };
});

indicador('insumos_bajo', 'Inventario', 'Detalle de insumos bajo el mínimo', 'Qué insumos faltan y cuánto.', 'tabla', 6, function () {
  var filas = insumosBajos().map(function (i) { return [i.nombre, i.existencia, i.minimo, Math.round((i.minimo - i.existencia) * 100) / 100]; });
  return { columnas: ['Insumo', 'Hay', 'Mínimo', 'Faltan'], filas: filas, formatos: [null, n0, n0, n0], graficar: 3 };
});

// ============================================================
// RESERVAS
// ============================================================
function hoyDelTurno() { return ahoraTexto().slice(0, 10); } // el día de hoy, según el reloj
function reservasVigentes() { return ESTADO.reservas.filter(function (r) { return r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA'; }); }
var TEXTO_RESERVA = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', CANCELADA: 'Cancelada', CUMPLIDA: 'Cumplida', NO_ASISTIO: 'No asistió' };
function corta(f) { return Number(f.slice(8, 10)) + ' ' + MESES_CORTOS[Number(f.slice(5, 7)) - 1]; }

indicador('reservas_total', 'Reservaciones', 'Reservaciones registradas', 'Cantidad de reservaciones y cuántas siguen pendientes.', 'kpi', 3, function () {
  var pend = ESTADO.reservas.filter(function (r) { return r.estado === 'PENDIENTE'; }).length;
  return { valor: String(ESTADO.reservas.length), detalle: pend + ' pendientes de confirmar' };
});

indicador('reservas_hoy', 'Reservaciones', 'Reservaciones de hoy', 'Reservaciones vigentes con fecha de hoy.', 'kpi', 3, function () {
  var hoy = reservasVigentes().filter(function (r) { return r.fecha === hoyDelTurno(); });
  return { valor: String(hoy.length), detalle: hoy.length ? hoy.slice(0, 3).map(function (r) { return r.hora + ' Mesa ' + r.mesa; }).join(' · ') + (hoy.length > 3 ? ' · y ' + (hoy.length - 3) + ' más' : '') : 'No hay reservaciones para hoy' };
});

indicador('reservas_proximas', 'Reservaciones', 'Reservaciones próximas', 'Reservaciones pendientes o confirmadas desde hoy en adelante.', 'kpi', 3, function () {
  var prox = reservasVigentes().filter(function (r) { return r.fecha >= hoyDelTurno(); });
  return { valor: String(prox.length), detalle: prox.length ? 'La próxima es el ' + corta(prox.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; })[0].fecha) : 'No hay reservaciones próximas' };
});

indicador('reservas_personas', 'Reservaciones', 'Personas esperadas', 'Personas que llegarán con las reservaciones vigentes.', 'kpi', 3, function () {
  var v = reservasVigentes().filter(function (r) { return r.fecha >= hoyDelTurno(); });
  return { valor: String(sumar(v, 'personas')), detalle: 'En ' + v.length + ' reservaciones' };
});

indicador('reservas_grupo', 'Reservaciones', 'Tamaño promedio del grupo', 'Cuántas personas lleva cada reservación en promedio.', 'kpi', 3, function () {
  var n = ESTADO.reservas.length;
  return { valor: n ? (Math.round(sumar(ESTADO.reservas, 'personas') / n * 10) / 10).toLocaleString('es-CO') : '—', detalle: 'Personas por reservación' };
});

indicador('reservas_cancel', 'Reservaciones', 'Reservaciones que no se cumplen', 'Porcentaje de reservaciones canceladas o en las que el cliente no asistió.', 'kpi', 3, function () {
  var n = ESTADO.reservas.length;
  var mal = ESTADO.reservas.filter(function (r) { return r.estado === 'CANCELADA' || r.estado === 'NO_ASISTIO'; }).length;
  return { valor: n ? Math.round(mal / n * 100) + ' %' : '—', detalle: mal + ' de ' + n + ' reservaciones' };
});

indicador('reservas_estado', 'Reservaciones', 'Reservaciones por estado', 'En qué estado está cada reservación.', 'dona', 4, function () {
  var filas = agrupar(ESTADO.reservas, function (r) { return TEXTO_RESERVA[r.estado]; }, function (r) { return 1; });
  return { columnas: ['Estado', 'Reservaciones'], filas: porValor(filas, 1, true).map(function (f) { return [f[0], f[1]]; }), formatos: [null, n0], graficar: 1 };
});

indicador('reservas_tipo', 'Reservaciones', 'Reservaciones de mesa y de evento', 'Cuántas reservaciones son para una mesa y cuántas para un evento.', 'dona', 4, function () {
  var filas = agrupar(ESTADO.reservas, function (r) { return r.tipo === 'EVENTO' ? 'Evento' : 'Mesa'; }, function (r) { return 1; });
  return { columnas: ['Tipo', 'Reservaciones'], filas: filas.map(function (f) { return [f[0], f[1]]; }), formatos: [null, n0], graficar: 1 };
});

indicador('reservas_dia', 'Reservaciones', 'Reservaciones por fecha', 'Cuántas reservaciones hay para cada día.', 'barras', 6, function () {
  var filas = agrupar(ESTADO.reservas.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }), function (r) { return corta(r.fecha); }, function (r) { return 1; });
  return { columnas: ['Fecha', 'Reservaciones', 'Personas'], filas: filas.map(function (f) { return [f[0], f[1], sumar(ESTADO.reservas.filter(function (r) { return corta(r.fecha) === f[0]; }), 'personas')]; }), formatos: [null, n0, n0], graficar: 1 };
});

indicador('reservas_hora', 'Reservaciones', 'Reservaciones por hora', 'A qué hora llegan más reservaciones.', 'barras', 6, function () {
  var filas = agrupar(ESTADO.reservas, function (r) { return r.hora; }, function () { return 1; });
  filas.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  return { columnas: ['Hora', 'Reservaciones'], filas: filas.map(function (f) { return [f[0], f[1]]; }), formatos: [null, n0], graficar: 1 };
});

indicador('reservas_mesa', 'Reservaciones', 'Reservaciones por mesa', 'Qué mesas se reservan más.', 'barras', 6, function () {
  var filas = porValor(agrupar(ESTADO.reservas, function (r) { return 'Mesa ' + r.mesa; }, function () { return 1; }), 1, true);
  return { columnas: ['Mesa', 'Reservaciones'], filas: filas.map(function (f) { return [f[0], f[1]]; }), formatos: [null, n0], graficar: 1 };
});

indicador('reservas_evento', 'Reservaciones', 'Reservaciones por evento', 'Qué eventos concentran más reservaciones.', 'hbarras', 6, function () {
  var filas = porValor(agrupar(ESTADO.reservas.filter(function (r) { return r.evento; }), function (r) { return r.evento; }, function (r) { return r.personas; }), 1, true);
  return { columnas: ['Evento', 'Personas', 'Reservaciones'], filas: filas, formatos: [null, n0, n0], graficar: 1 };
});

indicador('reservas_lista', 'Reservaciones', 'Próximas reservaciones', 'Detalle de las reservaciones vigentes, de la más cercana a la más lejana.', 'tabla', 6, function () {
  var filas = reservasVigentes().slice().sort(function (a, b) { return (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1; }).map(function (r) {
    return [corta(r.fecha) + ' ' + r.hora, r.cliente, 'Mesa ' + r.mesa, r.personas, TEXTO_RESERVA[r.estado]];
  });
  return { columnas: ['Cuándo', 'Cliente', 'Mesa', 'Personas', 'Estado'], filas: filas, formatos: [null, null, null, n0, null], graficar: 3 };
});

// ============================================================
// MESAS
// ============================================================
function minutosEnMesa(v) {
  var p = buscarPor(ESTADO.pedidos, 'n', v.pedido);
  if (!p) return null;
  var m = (new Date(v.fecha.replace(' ', 'T')) - new Date(p.fecha.replace(' ', 'T'))) / 60000;
  return m > 0 ? m : null;
}

indicador('capacidad_total', 'Mesas', 'Capacidad del salón', 'Personas que caben sentadas entre todas las mesas.', 'kpi', 3, function () {
  return { valor: String(sumar(ESTADO.mesas, 'capacidad')), detalle: ESTADO.mesas.length + ' mesas' };
});

indicador('mesas_libres', 'Mesas', 'Mesas libres', 'Mesas disponibles en este momento.', 'kpi', 3, function () {
  var libres = ESTADO.mesas.filter(function (m) { return m.estado === 'Disponible'; });
  return { valor: String(libres.length), detalle: libres.length ? 'Caben ' + sumar(libres, 'capacidad') + ' personas' : 'No hay mesas libres' };
});

indicador('mesas_zona', 'Mesas', 'Mesas por zona', 'Cuántas mesas hay en cada ubicación del salón.', 'dona', 4, function () {
  var filas = agrupar(ESTADO.mesas, function (m) { return m.ubicacion || 'Sin ubicación'; }, function () { return 1; });
  return { columnas: ['Zona', 'Mesas'], filas: porValor(filas, 1, true).map(function (f) { return [f[0], f[1]]; }), formatos: [null, n0], graficar: 1 };
});

indicador('ventas_zona', 'Mesas', 'Ventas por zona', 'Qué zona del salón vende más.', 'barras', 6, function () {
  var filas = agrupar(ventasActivas(), function (v) { var m = buscarPor(ESTADO.mesas, 'n', v.mesa); return m ? (m.ubicacion || 'Sin ubicación') : 'Sin dato'; }, function (v) { return v.total; });
  return { columnas: ['Zona', 'Ventas', 'Cuentas'], filas: porValor(filas, 1, true), formatos: [null, pesos, null], graficar: 1 };
});

indicador('tiempo_mesa', 'Mesas', 'Tiempo promedio en la mesa', 'Minutos que pasan entre abrir el pedido y cobrarlo.', 'kpi', 3, function () {
  var t = [];
  ventasActivas().forEach(function (v) { var m = minutosEnMesa(v); if (m) t.push(m); });
  if (!t.length) return { valor: '—', detalle: 'Sin ventas con tiempos registrados' };
  var prom = t.reduce(function (a, b) { return a + b; }, 0) / t.length;
  return { valor: Math.floor(prom / 60) ? Math.floor(prom / 60) + ' h ' + Math.round(prom % 60) + ' min' : Math.round(prom) + ' min', detalle: 'En ' + t.length + ' cuentas' };
});

indicador('tiempo_por_mesa', 'Mesas', 'Tiempo promedio por mesa', 'Minutos promedio que dura cada mesa ocupada.', 'hbarras', 6, function () {
  var por = {};
  ventasActivas().forEach(function (v) { var m = minutosEnMesa(v); if (m) { (por['Mesa ' + v.mesa] = por['Mesa ' + v.mesa] || []).push(m); } });
  var filas = porValor(Object.keys(por).map(function (k) { return [k, Math.round(por[k].reduce(function (a, b) { return a + b; }, 0) / por[k].length), por[k].length]; }), 1, true);
  return { columnas: ['Mesa', 'Minutos promedio', 'Cuentas'], filas: filas, formatos: [null, n0, n0], graficar: 1 };
});

indicador('mesas_tabla', 'Mesas', 'Estado de las mesas', 'Cada mesa con su zona, capacidad, estado y cuenta actual.', 'tabla', 6, function () {
  var filas = ESTADO.mesas.map(function (m) {
    var p = pedidoDeMesa(m.n);
    return ['Mesa ' + m.n, m.ubicacion || 'Sin dato', m.capacidad, m.estado, p ? totalesDe(p, 0).total : 0];
  });
  return { columnas: ['Mesa', 'Zona', 'Capacidad', 'Estado', 'Cuenta actual'], filas: filas, formatos: [null, null, n0, null, pesos], graficar: 4 };
});

// ============================================================
// COBRO
// ============================================================
indicador('cobros_metodo', 'Cobro', 'Cobros por método de pago', 'Cuánto dinero entra por cada forma de pago.', 'dona', 4, function () {
  var filas = agrupar(ventasActivas(), function (v) { return v.metodo; }, function (v) { return v.total; });
  return { columnas: ['Método', 'Cobrado', 'Cuentas'], filas: porValor(filas, 1, true), formatos: [null, pesos, null], graficar: 1 };
});

indicador('cobros_metodo_n', 'Cobro', 'Cuentas por método de pago', 'Cuántas cuentas se cobran con cada forma de pago.', 'barras', 6, function () {
  var filas = porValor(agrupar(ventasActivas(), function (v) { return v.metodo; }, function () { return 1; }), 1, true);
  return { columnas: ['Método', 'Cuentas', 'Cobrado'], filas: filas.map(function (f) { return [f[0], f[1], sumar(ventasActivas().filter(function (v) { return v.metodo === f[0]; }), 'total')]; }), formatos: [null, n0, pesos], graficar: 1 };
});

indicador('metodo_top', 'Cobro', 'Método de pago más usado', 'La forma de pago que más usan los clientes.', 'kpi', 3, function () {
  var filas = porValor(agrupar(ventasActivas(), function (v) { return v.metodo; }, function () { return 1; }), 1, true);
  return filas.length ? { valor: filas[0][0], detalle: filas[0][1] + ' de ' + ventasActivas().length + ' cuentas' } : { valor: '—', detalle: 'Sin ventas todavía' };
});

indicador('por_cobrar', 'Cobro', 'Valor por cobrar', 'Total de los pedidos abiertos que aún no se cobran.', 'kpi', 3, function () {
  var abiertos = pedidosEnCurso();
  return { valor: pesos(abiertos.reduce(function (s, p) { return s + totalesDe(p, 0).total; }, 0)), detalle: abiertos.length + ' pedidos abiertos' };
});

indicador('listos_cobrar', 'Cobro', 'Pedidos listos para cobrar', 'Pedidos con todos sus productos despachados.', 'kpi', 3, function () {
  var listos = pedidosEnCurso().filter(function (p) { return p.estado === 'Entregado'; });
  return { valor: String(listos.length), detalle: listos.length ? listos.map(function (p) { return 'Mesa ' + p.mesa; }).join(', ') : 'Ninguno por ahora' };
});

indicador('desc_promedio', 'Cobro', 'Descuento promedio por cuenta', 'Cuánto se descuenta en promedio en cada cuenta cobrada.', 'kpi', 3, function () {
  var n = ventasActivas().length;
  return { valor: n ? pesos(sumar(ventasActivas(), 'descuento') / n) : '—', detalle: n + ' cuentas' };
});

indicador('cobros_hora', 'Cobro', 'Cuentas cobradas por hora', 'Cuántas cuentas se cobran en cada hora del turno.', 'barras', 6, function () {
  var filas = agruparPorHora(ventasDe(turnoMostrado()), function () { return 1; });
  return { columnas: ['Hora', 'Cuentas'], filas: filas.map(function (f) { return [f[0], f[1]]; }), formatos: [null, n0], graficar: 1 };
});

indicador('cobros_cajero', 'Cobro', 'Cuentas cobradas por empleado', 'Cuántas cuentas cobró cada persona.', 'hbarras', 6, function () {
  var filas = porValor(agrupar(ventasActivas(), function (v) { return v.cajero; }, function () { return 1; }), 1, true);
  return { columnas: ['Empleado', 'Cuentas', 'Cobrado'], filas: filas.map(function (f) { return [f[0], f[1], sumar(ventasActivas().filter(function (v) { return v.cajero === f[0]; }), 'total')]; }), formatos: [null, n0, pesos], graficar: 1 };
});

indicador('cobros_lista', 'Cobro', 'Últimos cobros', 'Las ocho últimas cuentas cobradas.', 'tabla', 6, function () {
  var filas = ventasActivas().slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 8).map(function (v) {
    return ['Venta ' + v.n, 'Mesa ' + v.mesa, v.metodo, v.fecha.slice(11), v.total];
  });
  return { columnas: ['Cuenta', 'Mesa', 'Método', 'Hora', 'Total'], filas: filas, formatos: [null, null, null, null, pesos], graficar: 4 };
});

// ============================================================
// RENDIMIENTO ECONÓMICO (punto de equilibrio y rentabilidad)
// Los costos fijos y las metas los escribe el administrador en Personalizar > Datos económicos.
// ============================================================
function parametro(nombre, porDefecto) {
  var p = (typeof PREF !== 'undefined' && PREF.params) ? PREF.params : {};
  var v = Number(p[nombre]);
  return v > 0 ? v : porDefecto;
}

function economia() {
  var cf = parametro('costosFijos', 0), turnosMes = parametro('turnosMes', 26), horas = parametro('horasTurno', 6);
  var neto = 0, costoVar = 0, unidades = 0;
  ventasActivas().forEach(function (v) {
    neto += v.subtotal - v.descuento;
    lineasDe(v).forEach(function (l) {
      unidades += l.cant;
      var pr = buscarPor(ESTADO.productos, 'nombre', l.producto);
      if (pr) costoVar += l.cant * costoDe(pr);
    });
  });
  var contribucion = neto ? (neto - costoVar) / neto : 0;
  var turnosConVentas = ESTADO.turnos.filter(function (t) { return ventasDe(t).length > 0; }).length;
  var netoPorTurno = turnosConVentas ? neto / turnosConVentas : 0;
  var gananciaPorTurno = turnosConVentas ? (neto - costoVar) / turnosConVentas : 0;
  var cfTurno = cf / turnosMes;
  var eqTurno = contribucion > 0 ? cfTurno / contribucion : 0;
  var actual = ventasDe(turnoMostrado()), netoActual = 0, costoActual = 0;
  actual.forEach(function (v) {
    netoActual += v.subtotal - v.descuento;
    lineasDe(v).forEach(function (l) { var pr = buscarPor(ESTADO.productos, 'nombre', l.producto); if (pr) costoActual += l.cant * costoDe(pr); });
  });
  return { cf: cf, turnosMes: turnosMes, horas: horas, neto: neto, costoVar: costoVar, unidades: unidades, contribucion: contribucion, turnosConVentas: turnosConVentas,
           netoPorTurno: netoPorTurno, gananciaPorTurno: gananciaPorTurno, cfTurno: cfTurno, eqTurno: eqTurno, eqMes: eqTurno * turnosMes,
           ticketNeto: ventasActivas().length ? neto / ventasActivas().length : 0, precioUnidad: unidades ? neto / unidades : 0,
           netoActual: netoActual, gananciaActual: netoActual - costoActual, meta: parametro('metaTurno', 0), inversion: parametro('inversion', 0) };
}

var SIN_COSTOS = { valor: '—', detalle: 'Escribe los costos fijos en Personalizar > Datos económicos' };
var SIN_VENTAS = { valor: '—', detalle: 'Se calcula cuando haya ventas registradas' };
function conCostos(f) { return function () { var e = economia(); if (!e.cf) return SIN_COSTOS; if (!e.contribucion) return SIN_VENTAS; return f(e); }; }

indicador('eq_mes', 'Economía', 'Punto de equilibrio mensual', 'Ventas que se necesitan al mes para cubrir costos fijos y variables (costos fijos ÷ margen de contribución).', 'kpi', 3, conCostos(function (e) {
  return { valor: pesos(e.eqMes), detalle: 'Costos fijos de ' + pesos(e.cf) + ' con margen de contribución de ' + Math.round(e.contribucion * 100) + ' %' };
}));

indicador('eq_turno', 'Economía', 'Punto de equilibrio por turno', 'Ventas que debe tener cada turno para no perder.', 'kpi', 3, conCostos(function (e) {
  return { valor: pesos(e.eqTurno), detalle: 'Un mes de ' + e.turnosMes + ' turnos' };
}));

indicador('eq_hora', 'Economía', 'Equilibrio por hora', 'Ventas por hora de operación para llegar al equilibrio.', 'kpi', 3, conCostos(function (e) {
  return { valor: pesos(e.eqTurno / e.horas), detalle: 'Turnos de ' + e.horas + ' horas' };
}));

indicador('eq_cuentas', 'Economía', 'Cuentas para el equilibrio', 'Cuántas cuentas del valor promedio hay que cobrar por turno para cubrir los costos.', 'kpi', 3, conCostos(function (e) {
  return { valor: String(Math.ceil(e.eqTurno / e.ticketNeto)), detalle: 'Con una cuenta promedio de ' + pesos(e.ticketNeto) + ' antes de impuestos' };
}));

indicador('eq_unidades', 'Economía', 'Unidades para el equilibrio', 'Cuántos productos hay que vender por turno para cubrir los costos.', 'kpi', 3, conCostos(function (e) {
  return { valor: n0(Math.ceil(e.eqTurno / e.precioUnidad)), detalle: 'A un precio promedio de ' + pesos(e.precioUnidad) + ' por unidad' };
}));

indicador('eq_avance', 'Economía', 'Avance hacia el equilibrio del turno', 'Qué porcentaje del equilibrio llevan las ventas del turno.', 'kpi', 3, conCostos(function (e) {
  var p = Math.round(e.netoActual / e.eqTurno * 100);
  return { valor: p + ' %', detalle: p >= 100 ? 'Ya se cubrieron los costos del turno' : 'Faltan ' + pesos(e.eqTurno - e.netoActual) + ' para el equilibrio' };
}));

indicador('margen_seguridad', 'Economía', 'Margen de seguridad', 'Cuánto pueden caer las ventas antes de entrar en pérdida.', 'kpi', 3, conCostos(function (e) {
  if (!e.netoPorTurno) return SIN_VENTAS;
  var m = Math.round((e.netoPorTurno - e.eqTurno) / e.netoPorTurno * 100);
  return { valor: m + ' %', detalle: 'Ventas promedio de ' + pesos(e.netoPorTurno) + ' por turno frente a ' + pesos(e.eqTurno) + ' de equilibrio' };
}));

indicador('margen_contribucion', 'Economía', 'Margen de contribución', 'Parte de cada peso vendido que queda después de pagar los insumos.', 'kpi', 3, function () {
  var e = economia();
  return e.neto ? { valor: Math.round(e.contribucion * 100) + ' %', detalle: 'Por cada $ 100 vendidos quedan $ ' + Math.round(e.contribucion * 100) + ' para costos fijos y utilidad' } : SIN_VENTAS;
});

indicador('costo_por_100', 'Economía', 'Costo de insumos por cada $100', 'Cuánto cuestan los insumos de cada $ 100 vendidos.', 'kpi', 3, function () {
  var e = economia();
  return e.neto ? { valor: '$ ' + Math.round(e.costoVar / e.neto * 100), detalle: 'Costo de ventas de ' + pesos(e.costoVar) } : SIN_VENTAS;
});

indicador('costo_fijo_turno', 'Economía', 'Costo fijo por turno', 'Parte de los costos fijos que le toca a cada turno.', 'kpi', 3, function () {
  var e = economia();
  return e.cf ? { valor: pesos(e.cfTurno), detalle: pesos(e.cf) + ' al mes entre ' + e.turnosMes + ' turnos' } : SIN_COSTOS;
});

indicador('costo_fijo_pct', 'Economía', 'Peso de los costos fijos', 'Qué porcentaje de las ventas se va en costos fijos.', 'kpi', 3, conCostos(function (e) {
  if (!e.netoPorTurno) return SIN_VENTAS;
  return { valor: Math.round(e.cfTurno / e.netoPorTurno * 100) + ' %', detalle: pesos(e.cfTurno) + ' por turno sobre ' + pesos(e.netoPorTurno) + ' vendidos' };
}));

indicador('utilidad_turno', 'Economía', 'Utilidad del turno', 'Ganancia del turno después de insumos y costos fijos.', 'kpi', 3, conCostos(function (e) {
  var u = e.gananciaActual - e.cfTurno;
  return { valor: pesos(u), detalle: 'Ganancia de ' + pesos(e.gananciaActual) + ' menos ' + pesos(e.cfTurno) + ' de costos fijos' };
}));

indicador('margen_operativo', 'Economía', 'Margen operativo del turno', 'Porcentaje de las ventas del turno que queda como utilidad.', 'kpi', 3, conCostos(function (e) {
  if (!e.netoActual) return SIN_VENTAS;
  return { valor: Math.round((e.gananciaActual - e.cfTurno) / e.netoActual * 100) + ' %', detalle: 'Sobre ventas de ' + pesos(e.netoActual) };
}));

indicador('ventas_mes_proy', 'Economía', 'Ventas proyectadas del mes', 'Ventas promedio por turno multiplicadas por los turnos del mes.', 'kpi', 3, function () {
  var e = economia();
  return e.netoPorTurno ? { valor: pesos(e.netoPorTurno * e.turnosMes), detalle: pesos(e.netoPorTurno) + ' por turno × ' + e.turnosMes + ' turnos' } : SIN_VENTAS;
});

indicador('utilidad_mes_proy', 'Economía', 'Utilidad proyectada del mes', 'Ganancia promedio por turno por los turnos del mes, menos los costos fijos.', 'kpi', 3, conCostos(function (e) {
  if (!e.gananciaPorTurno) return SIN_VENTAS;
  return { valor: pesos(e.gananciaPorTurno * e.turnosMes - e.cf), detalle: 'Ganancia de ' + pesos(e.gananciaPorTurno * e.turnosMes) + ' menos ' + pesos(e.cf) + ' de costos fijos' };
}));

indicador('cumplimiento_meta', 'Economía', 'Cumplimiento de la meta del turno', 'Ventas del turno frente a la meta que escribas en Datos económicos.', 'kpi', 3, function () {
  var e = economia();
  if (!e.meta) return { valor: '—', detalle: 'Escribe la meta por turno en Personalizar > Datos económicos' };
  return { valor: Math.round(e.netoActual / e.meta * 100) + ' %', detalle: pesos(e.netoActual) + ' de ' + pesos(e.meta) };
});

indicador('payback', 'Economía', 'Recuperación de la inversión', 'Meses que tardaría en recuperarse la inversión con la utilidad proyectada.', 'kpi', 3, conCostos(function (e) {
  if (!e.inversion) return { valor: '—', detalle: 'Escribe la inversión inicial en Personalizar > Datos económicos' };
  var u = e.gananciaPorTurno * e.turnosMes - e.cf;
  return u > 0 ? { valor: (Math.round(e.inversion / u * 10) / 10).toLocaleString('es-CO') + ' meses', detalle: 'Inversión de ' + pesos(e.inversion) + ' con utilidad de ' + pesos(u) + ' al mes' } : { valor: '—', detalle: 'Con la utilidad actual no se recupera la inversión' };
}));

indicador('ganancia_cuenta', 'Economía', 'Ganancia por cuenta', 'Ganancia bruta promedio de cada cuenta cobrada.', 'kpi', 3, function () {
  var e = economia();
  return ventasActivas().length ? { valor: pesos((e.neto - e.costoVar) / ventasActivas().length), detalle: 'Después de pagar los insumos' } : SIN_VENTAS;
});

indicador('ganancia_hora', 'Economía', 'Ganancia por hora de operación', 'Ganancia bruta del turno dividida entre las horas del turno.', 'kpi', 3, function () {
  var e = economia();
  return e.netoActual ? { valor: pesos(e.gananciaActual / e.horas), detalle: 'Turnos de ' + e.horas + ' horas' } : SIN_VENTAS;
});

indicador('ventas_hora_op', 'Economía', 'Ventas por hora de operación', 'Ventas del turno divididas entre las horas del turno.', 'kpi', 3, function () {
  var e = economia();
  return e.netoActual ? { valor: pesos(e.netoActual / e.horas), detalle: 'Turnos de ' + e.horas + ' horas' } : SIN_VENTAS;
});

indicador('estructura_costos', 'Economía', 'Estructura de costos', 'Cómo se reparte lo vendido: insumos, costos fijos y utilidad.', 'dona', 4, function () {
  var e = economia();
  var fijos = e.cfTurno * e.turnosConVentas;
  var utilidad = Math.max(0, e.neto - e.costoVar - fijos);
  return { columnas: ['Concepto', 'Valor'], filas: [['Insumos', Math.round(e.costoVar)], ['Costos fijos', Math.round(fijos)], ['Utilidad', Math.round(utilidad)]], formatos: [null, pesos], graficar: 1 };
});

indicador('utilidad_historial', 'Economía', 'Utilidad por turno', 'Ganancia de cada turno después de insumos y costos fijos.', 'barras', 6, function () {
  var cfTurno = economia().cfTurno;
  var filas = turnoPorFecha().map(function (t) {
    var g = 0;
    ventasDe(t).forEach(function (v) { g += ganancia(v) - v.descuento; });
    return [fechaTurno(t), Math.round(g - (ventasDe(t).length ? cfTurno : 0)), Math.round(g)];
  });
  return { columnas: ['Turno', 'Utilidad', 'Ganancia antes de costos fijos'], filas: filas.slice(-12), formatos: [null, pesos, pesos], graficar: 1 };
});

indicador('eq_turnos', 'Economía', 'Ventas frente al equilibrio por turno', 'Para cada turno: lo vendido, el equilibrio y la diferencia.', 'tabla', 6, function () {
  var e = economia();
  var filas = turnoPorFecha().map(function (t) {
    var neto = 0;
    ventasDe(t).forEach(function (v) { neto += v.subtotal - v.descuento; });
    return [fechaTurno(t), neto, Math.round(e.eqTurno), Math.round(neto - e.eqTurno)];
  }).filter(function (f) { return f[1] > 0; });
  return { columnas: ['Turno', 'Ventas', 'Equilibrio', 'Diferencia'], filas: filas.slice(-10), formatos: [null, pesos, pesos, pesos], graficar: 1 };
});

// Cómo se agrupan en el selector (algunos indicadores de arriba pertenecen a estos grupos)
var GRUPO_DE = {
  ocupacion: 'Mesas', mesas_estado: 'Mesas', mesas_rotacion: 'Mesas', ventas_mesa: 'Mesas', ventas_puesto: 'Mesas', mejor_mesa: 'Mesas',
  num_ventas: 'Cobro', ticket: 'Cobro', descuentos: 'Cobro', impuestos: 'Cobro', cuenta_alta: 'Cobro', cuenta_baja: 'Cobro', ventas_atendio: 'Cobro', empleado_top: 'Cobro',
  facturas_pend: 'Cobro', facturas_ok: 'Cobro', pedidos_curso: 'Cobro', ticket_historial: 'Cobro', descuentos_historial: 'Cobro',
  utilidad_total: 'Economía', ganancia_historial: 'Economía', costo_vendido: 'Economía', margen_total: 'Economía'
};
INDICADORES.forEach(function (i) { if (GRUPO_DE[i.id]) i.grupo = GRUPO_DE[i.id]; });

// ============================================================
// CLIENTES
// ============================================================
function consumoClientes() {
  var ventas = ventasActivas();
  return ESTADO.clientes.map(function (c) {
    var nombre = (c.nombre + ' ' + (c.apellidos || '')).trim();
    var mias = ventas.filter(function (v) { return v.cliente === nombre; });
    var total = 0, ultima = '';
    mias.forEach(function (v) { total += v.total + (v.propina || 0); if (v.fecha > ultima) ultima = v.fecha; });
    var n = mias.length;
    return { c: c, nombre: nombre, n: n, total: total, ultima: ultima, nivel: !n ? 'Nuevo' : (n >= 6 || total >= 600000 ? 'VIP' : (n >= 3 ? 'Frecuente' : 'Ocasional')) };
  });
}

indicador('clientes_total', 'Clientes', 'Clientes registrados', 'Cuántos clientes hay en la base, entre personas y empresas.', 'kpi', 3, function () {
  var emp = ESTADO.clientes.filter(function (c) { return c.tipoDoc === 'NIT'; }).length;
  return { valor: String(ESTADO.clientes.length), detalle: (ESTADO.clientes.length - emp) + ' personas · ' + emp + ' empresas' };
});

indicador('clientes_frecuentes', 'Clientes', 'Clientes frecuentes', 'Clientes con tres o más compras.', 'kpi', 3, function () {
  var f = consumoClientes().filter(function (x) { return x.n >= 3; }).length;
  return { valor: String(f), detalle: ESTADO.clientes.length ? Math.round(f / ESTADO.clientes.length * 100) + ' % de la base' : 'Sin clientes' };
});

indicador('clientes_autorizados', 'Clientes', 'Clientes con datos autorizados', 'Cuántos clientes autorizaron el tratamiento de sus datos (Ley 1581 de 2012).', 'kpi', 3, function () {
  var a = ESTADO.clientes.filter(function (c) { return c.autoriza; }).length;
  return { valor: ESTADO.clientes.length ? Math.round(a / ESTADO.clientes.length * 100) + ' %' : '—', detalle: a + ' de ' + ESTADO.clientes.length };
});

indicador('clientes_nivel', 'Clientes', 'Clientes por nivel', 'Nuevos, ocasionales, frecuentes y VIP según sus compras.', 'dona', 6, function () {
  var cuenta = { Nuevo: 0, Ocasional: 0, Frecuente: 0, VIP: 0 };
  consumoClientes().forEach(function (x) { cuenta[x.nivel] += 1; });
  return { columnas: ['Nivel', 'Clientes'], filas: Object.keys(cuenta).map(function (k) { return [k, cuenta[k]]; }), formatos: [null, null], graficar: 1 };
});

indicador('clientes_tipo', 'Clientes', 'Personas y empresas', 'Cuántos clientes son personas y cuántos empresas.', 'dona', 6, function () {
  var emp = ESTADO.clientes.filter(function (c) { return c.tipoDoc === 'NIT'; }).length;
  return { columnas: ['Tipo', 'Clientes'], filas: [['Personas', ESTADO.clientes.length - emp], ['Empresas', emp]], formatos: [null, null], graficar: 1 };
});

indicador('clientes_top', 'Clientes', 'Clientes que más consumen', 'Los diez clientes con mayor consumo.', 'hbarras', 6, function () {
  var filas = consumoClientes().filter(function (x) { return x.total > 0; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 10).map(function (x) { return [x.nombre, x.total, x.n]; });
  return { columnas: ['Cliente', 'Consumo', 'Pedidos'], filas: filas, formatos: [null, pesos, null], graficar: 1 };
});

indicador('clientes_tabla', 'Clientes', 'Clientes y su consumo', 'Pedidos, consumo, ticket y última visita de cada cliente.', 'tabla', 12, function () {
  var filas = consumoClientes().sort(function (a, b) { return b.total - a.total; }).map(function (x) {
    return [x.nombre, x.c.tipoDoc === 'NIT' ? 'Empresa' : 'Persona', x.n, x.total, x.n ? Math.round(x.total / x.n) : 0, x.ultima ? x.ultima.slice(0, 10) : '—', x.nivel];
  });
  return { columnas: ['Cliente', 'Tipo', 'Pedidos', 'Consumo', 'Ticket promedio', 'Última visita', 'Nivel'], filas: filas, formatos: [null, null, null, pesos, pesos, null, null], graficar: 3 };
});

indicador('clientes_cumple', 'Clientes', 'Próximos cumpleaños', 'Clientes que cumplen años en los próximos treinta días: buena ocasión para una promoción.', 'tabla', 6, function () {
  var hoy = new Date(), h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()), filas = [];
  ESTADO.clientes.forEach(function (c) {
    if (!c.nacimiento) return;
    var n = c.nacimiento.split('-'), a = new Date(hoy.getFullYear(), Number(n[1]) - 1, Number(n[2]));
    if (a < h0) a = new Date(hoy.getFullYear() + 1, Number(n[1]) - 1, Number(n[2]));
    var d = Math.round((a - h0) / 86400000);
    if (d <= 30) filas.push([(c.nombre + ' ' + (c.apellidos || '')).trim(), Number(n[2]) + ' ' + MESES_CORTOS[Number(n[1]) - 1], d]);
  });
  return { columnas: ['Cliente', 'Cumple', 'Faltan (días)'], filas: filas.sort(function (a, b) { return a[2] - b[2]; }), formatos: [null, null, null], graficar: 2 };
});

indicador('clientes_registro', 'Clientes', 'Clientes nuevos por mes', 'Cuántos clientes se registraron cada mes.', 'barras', 6, function () {
  var meses = {};
  ESTADO.clientes.forEach(function (c) { var k = c.registro.slice(0, 7); meses[k] = (meses[k] || 0) + 1; });
  return { columnas: ['Mes', 'Clientes'], filas: Object.keys(meses).sort().map(function (k) { return [MESES_CORTOS[Number(k.slice(5)) - 1] + ' ' + k.slice(0, 4), meses[k]]; }), formatos: [null, null], graficar: 1 };
});

// ============================================================
// REPORTE DE VENTAS
// ============================================================
indicador('ventas_detalle', 'Ventas', 'Reporte de ventas', 'Cada venta con su subtotal, descuento, impuesto, propina y total.', 'tabla', 12, function () {
  var filas = ventasActivas().slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 40).map(function (v) {
    return ['Venta ' + v.n, v.fecha.slice(0, 16), 'Mesa ' + v.mesa, v.cliente, v.metodo, v.subtotal, v.descuento, v.impuesto, v.propina || 0, v.total + (v.propina || 0)];
  });
  return { columnas: ['Venta', 'Fecha', 'Mesa', 'Cliente', 'Método', 'Subtotal', 'Descuento', 'Impuesto', 'Propina', 'Total'], filas: filas, formatos: [null, null, null, null, null, pesos, pesos, pesos, pesos, pesos], graficar: 9 };
});

indicador('impuestos_tarifa', 'Ventas', 'Impuestos por tarifa', 'Lo que se cobró de cada impuesto y sobre qué base.', 'tabla', 6, function () {
  var mapa = {};
  ventasActivas().forEach(function (v) {
    (v.tarifas || []).forEach(function (t) {
      var k = t.nombre + ' ' + t.porcentaje + ' %';
      mapa[k] = mapa[k] || { base: 0, valor: 0 };
      mapa[k].base += t.base || 0; mapa[k].valor += t.valor !== undefined ? t.valor : v.impuesto;
    });
  });
  return { columnas: ['Impuesto', 'Base', 'Valor'], filas: Object.keys(mapa).map(function (k) { return [k, mapa[k].base, mapa[k].valor]; }), formatos: [null, pesos, pesos], graficar: 2 };
});

// ============================================================
// INVENTARIO (kardex)
// ============================================================
indicador('inv_categoria', 'Inventario', 'Valor del inventario por categoría', 'Cuánto dinero hay en cada categoría de insumos.', 'dona', 6, function () {
  var filas = porValor(agrupar(ESTADO.insumos, function (i) { return categoriaDeInsumo(i); }, function (i) { return Math.round(i.existencia * i.costo); }), 1, true);
  return { columnas: ['Categoría', 'Valor', 'Insumos'], filas: filas, formatos: [null, pesos, null], graficar: 1 };
});

indicador('inv_valor_top', 'Inventario', 'Insumos de mayor valor', 'Los diez insumos con más dinero en existencia.', 'hbarras', 6, function () {
  var filas = ESTADO.insumos.map(function (i) { return [i.nombre, Math.round(i.existencia * i.costo), i.existencia]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
  return { columnas: ['Insumo', 'Valor', 'Existencia'], filas: filas, formatos: [null, pesos, null], graficar: 1 };
});

indicador('inv_movimientos', 'Inventario', 'Movimientos del kardex', 'Entradas, salidas, mermas y ajustes registrados.', 'dona', 6, function () {
  var filas = agrupar(ESTADO.movimientos, function (m) { return m.tipo; }, function () { return 1; }).map(function (f) { return [f[0], f[1]]; });
  return { columnas: ['Tipo', 'Movimientos'], filas: filas, formatos: [null, null], graficar: 1 };
});

indicador('inv_vencimientos', 'Inventario', 'Próximas expiraciones', 'Compras con fecha de expiración, de la más cercana a la más lejana.', 'tabla', 6, function () {
  var hoy = new Date(), h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  var filas = ESTADO.movimientos.filter(function (m) { return m.vence; }).map(function (m) { return [m.insumo, m.vence, m.cant, Math.round((new Date(m.vence + 'T00:00:00') - h0) / 86400000)]; }).sort(function (a, b) { return a[3] - b[3]; });
  return { columnas: ['Insumo', 'Expira', 'Cantidad comprada', 'Faltan (días)'], filas: filas, formatos: [null, null, null, null], graficar: 3 };
});

function indicadorPorId(id) {
  for (var i = 0; i < INDICADORES.length; i++) if (INDICADORES[i].id === id) return INDICADORES[i];
  return null;
}
