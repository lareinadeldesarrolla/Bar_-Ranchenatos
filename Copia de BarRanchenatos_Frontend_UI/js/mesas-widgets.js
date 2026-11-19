/* Mesas: widgets propios de esta pantalla, sobre el mismo tablero de Inicio.
   Las mesas se crean, editan e inactivan en su propia página (mesas-admin.html), solo en la memoria del navegador. */

var mesaElegida = null;

function mesaSeleccionada() {
  return mesaElegida === null
    ? null
    : buscarPor(ESTADO.mesas, "n", mesaElegida);
}

// Tocar una mesa (en el plano, las tarjetas o las fichas) la deja seleccionada
window.alTocarMesa = function (n) {
  mesaElegida = n;
  pintarTablero();
  abrirDetalle(n);
};

var NOMBRE_ESTADO = {
  Disponible: "Libre",
  Ocupada: "Ocupada",
  Reservada: "Reservada",
  Inactiva: "Inactiva",
  "Por limpiar": "Por limpiar",
};
var LEYENDA_ESTADO = {
  Disponible: "libre",
  Ocupada: "ocupada",
  Reservada: "reservada",
  Inactiva: "inactiva",
  "Por limpiar": "limpiar",
};

function estadoConPunto(m) {
  return (
    '<span class="est-txt"><i class="lg ' +
    LEYENDA_ESTADO[m.estado] +
    '"></i>' +
    NOMBRE_ESTADO[m.estado] +
    "</span>"
  );
}

// ---------- Filtros del encabezado: estado, puestos y zona ----------
var filtro = { estado: "", puestos: 0, zona: "" };
function pasaFiltro(m) {
  if (filtro.estado && m.estado !== filtro.estado) return false;
  if (filtro.puestos && m.capacidad !== filtro.puestos) return false;
  if (filtro.zona && claveZona(m.ubicacion) !== claveZona(filtro.zona))
    return false;
  return true;
}
function hayFiltro() {
  return !!(filtro.estado || filtro.puestos || filtro.zona);
}
function mesasFiltradas() {
  return ESTADO.mesas.filter(pasaFiltro);
}

// Mientras más mesas se ven, más pequeñas se dibujan (de 1 a 0,5 del tamaño normal)
function ajustarEscala(cantidad) {
  var e = cantidad <= 6 ? 1 : Math.max(0.5, 1 - (cantidad - 6) * 0.035);
  document
    .getElementById("tablero")
    .style.setProperty("--escala", e.toFixed(2));
}

// ---------- Plano del salón con sillas (el de Inicio): marca la mesa seleccionada y no enlaza a esta misma pantalla ----------
var opPlano = indicadorPorId("op_plano");
if (opPlano) {
  opPlano.enlace = null;
  opPlano.ancho = 12; // ocupa todo el ancho: ya no tiene un widget al lado
  var dibujarPlanoBase = opPlano.dibujar;
  opPlano.dibujar = function (estilo) {
    var sel = mesaSeleccionada();
    var todas = ESTADO.mesas;
    var visibles = todas.filter(pasaFiltro);
    ajustarEscala(visibles.length);
    if (!visibles.length)
      return '<p class="vacio">Ninguna mesa coincide con los filtros.</p>';
    var resumen = {};
    ESTADO.mesas = visibles; // el plano de Inicio dibuja solo las mesas que pasan el filtro
    var html;
    try {
      areasDeMesas().forEach(function (a) {
        resumen[esc(a.nombre)] = { n: a.mesas.length };
      });
      html = dibujarPlanoBase(estilo);
    } finally {
      ESTADO.mesas = todas;
    }
    return html
      .replace(
        /class="pl-mesa (est-[A-Z]+)" data-mesa="(\d+)"/g,
        function (todo, est, n) {
          return (
            'class="pl-mesa ' +
            est +
            (sel && sel.n === Number(n) ? " sel" : "") +
            '" data-mesa="' +
            n +
            '"'
          );
        },
      )
      .replace(
        /<div class="zona-pl"><h3>([^<]*)<\/h3>/g,
        function (todo, nombre) {
          var r = resumen[nombre];
          return (
            '<div class="zona-pl" style="--n:' +
            (r ? r.n : 1) +
            '"><h3>' +
            nombre +
            "</h3>"
          );
        },
      );
  };
}

// ============================================================
// ÁREAS DEL BAR (las mesas agrupadas por zona, con el filtro aplicado)
// ============================================================
function areasDeMesas(conFiltro) {
  var orden = [],
    mapa = {};
  zonasDelBar().forEach(function (z) {
    var k = claveZona(z);
    mapa[k] = { nombre: z, mesas: [] };
    orden.push(k);
  });
  (conFiltro ? mesasFiltradas() : ESTADO.mesas).forEach(function (m) {
    var k = claveZona(m.ubicacion) || "sin zona";
    if (!mapa[k]) {
      mapa[k] = { nombre: m.ubicacion || "Sin zona", mesas: [] };
      orden.push(k);
    }
    mapa[k].mesas.push(m);
  });
  var areas = orden.map(function (k) {
    return mapa[k];
  });
  return conFiltro && hayFiltro()
    ? areas.filter(function (a) {
        return a.mesas.length;
      })
    : areas;
}

// ============================================================
// MESA SELECCIONADA
// ============================================================
var seleccionUnir = [];

function listaDe(numeros) {
  return numeros
    .map(function (n) {
      return "Mesa " + n;
    })
    .join(", ");
}

function detalleHtml(m) {
  if (!m) return '<p class="vacio">Esa mesa ya no existe.</p>';
  var p = pedidoDeMesa(m.n);
  var r = proximaReserva(m.n);
  var datos =
    '<dl class="det-datos"><div><dt>Estado</dt><dd>' +
    estadoConPunto(m) +
    "</dd></div>" +
    "<div><dt>Zona</dt><dd>" +
    esc(m.ubicacion || "Sin zona") +
    "</dd></div>" +
    "<div><dt>Puestos</dt><dd>" +
    m.capacidad +
    "</dd></div>";
  var acciones = "";
  if (p) {
    var unidades = 0;
    p.lineas.forEach(function (l) {
      unidades += l.cant;
    });
    var pend = contarLineas(p, "Pendiente");
    datos +=
      "<div><dt>Pedido</dt><dd>N.º " +
      p.n +
      "</dd></div>" +
      "<div><dt>Abierto desde</dt><dd>" +
      esc(p.fecha.slice(11)) +
      "</dd></div>" +
      "<div><dt>Productos</dt><dd>" +
      unidades +
      (pend ? " · " + pend + " sin despachar" : "") +
      "</dd></div>";
    acciones =
      '<button type="button" class="btn btn-primary" data-cuenta="' +
      m.n +
      '">' +
      (pend ? "Ver cuenta" : "Cobrar") +
      '</button><a class="btn" href="pedidos.html?mesa=' +
      m.n +
      '">Nuevo pedido</a>' +
      '<button type="button" class="btn" data-act="trasladar" data-n="' +
      m.n +
      '">Trasladar</button>';
  } else if (m.estado === "Por limpiar") {
    acciones =
      '<button type="button" class="btn btn-primary" data-act="limpia" data-n="' +
      m.n +
      '">Marcar limpia</button>';
  } else if (m.estado !== "Inactiva") {
    acciones =
      '<a class="btn btn-primary" href="pedidos.html?mesa=' +
      m.n +
      '">Abrir pedido</a>';
  }
  if (m.estado === "Disponible" || m.estado === "Ocupada")
    acciones +=
      '<button type="button" class="btn" data-act="unir" data-n="' +
      m.n +
      '">Unir mesas</button>';
  if (m.unidas && m.unidas.length) {
    datos +=
      '<div class="ancho"><dt>Mesas unidas</dt><dd>Mesa ' +
      m.n +
      " + " +
      m.unidas.join(" + ") +
      "</dd></div>";
    acciones +=
      '<button type="button" class="btn" data-act="separar" data-n="' +
      m.n +
      '">Separar mesas</button>';
  }
  datos += "</dl>";
  var reserva = r
    ? '<p class="det-reserva">Reservación ' +
      esc(fechaCorta(r.fecha)) +
      " · " +
      esc(r.hora) +
      " · " +
      esc(r.cliente) +
      "</p>"
    : "";
  var total = p
    ? '<p class="det-total"><span>Cuenta</span><b>' +
      pesos(totalesDe(p, 0).total) +
      "</b></p>"
    : "";
  return (
    '<div class="det-mesa"><p class="det-nombre">Mesa ' +
    m.n +
    "</p>" +
    total +
    datos +
    reserva +
    '<div class="det-acciones">' +
    acciones +
    "</div></div>"
  );
}

// ---------- Trasladar la cuenta a otra mesa ----------
function mesasLibresParaTraslado(origen) {
  return ESTADO.mesas.filter(function (m) {
    return m.n !== origen && m.estado === "Disponible" && !pedidoDeMesa(m.n);
  });
}

function vistaTrasladar(origen) {
  var lista = mesasLibresParaTraslado(origen);
  var html =
    '<div class="det-mesa"><p class="det-nombre">Trasladar la Mesa ' +
    origen +
    '</p><p class="det-ayuda">Elige la mesa libre a la que pasa la cuenta.</p>';
  if (!lista.length) {
    html +=
      '<p class="vacio">No hay mesas libres para trasladar la cuenta.</p>';
  } else {
    html += '<div class="dest-grid">';
    lista.forEach(function (m) {
      html +=
        '<button type="button" class="dest-mesa" data-act="elegir-traslado" data-origen="' +
        origen +
        '" data-destino="' +
        m.n +
        '"><b>Mesa ' +
        m.n +
        "</b><small>" +
        plural(m.capacidad, "puesto", "puestos") +
        " · " +
        esc(m.ubicacion || "Sin zona") +
        "</small></button>";
    });
    html += "</div>";
  }
  return (
    html +
    '<div class="det-acciones"><button type="button" class="btn" data-act="volver" data-n="' +
    origen +
    '">← Volver</button></div></div>'
  );
}

function vistaConfirmarTraslado(origen, destino) {
  var po = pedidoDeMesa(origen);
  return (
    '<div class="det-mesa"><p class="det-nombre">Confirmar traslado</p><p class="det-ayuda">La cuenta de ' +
    pesos(totalesDe(po, 0).total) +
    " pasa de la Mesa " +
    origen +
    " a la Mesa " +
    destino +
    ". La Mesa " +
    origen +
    " queda libre.</p>" +
    '<div class="det-acciones"><button type="button" class="btn" data-act="volver" data-n="' +
    origen +
    '">Cancelar</button>' +
    '<button type="button" class="btn btn-primary" data-act="confirmar-traslado" data-origen="' +
    origen +
    '" data-destino="' +
    destino +
    '">Trasladar</button></div></div>'
  );
}

function trasladarCuenta(origen, destino) {
  var p = pedidoDeMesa(origen);
  p.mesa = destino;
  actualizarMesas();
  guardar();
}

// ---------- Unir mesas: dos o más de la misma zona, libres u ocupadas ----------
function candidatasUnion(origen) {
  var mo = buscarPor(ESTADO.mesas, "n", origen);
  return ESTADO.mesas.filter(function (m) {
    return (
      m.n !== origen &&
      (m.estado === "Disponible" || m.estado === "Ocupada") &&
      !(m.unidas && m.unidas.length) &&
      claveZona(m.ubicacion) === claveZona(mo.ubicacion) &&
      !proximaReserva(m.n)
    );
  });
}

function vistaUnir(origen) {
  var mo = buscarPor(ESTADO.mesas, "n", origen);
  var lista = candidatasUnion(origen);
  var puestosTotal = mo.capacidad;
  seleccionUnir.forEach(function (n) {
    puestosTotal += buscarPor(ESTADO.mesas, "n", n).capacidad;
  });
  var html =
    '<div class="det-mesa"><p class="det-nombre">Unir la Mesa ' +
    origen +
    '</p><p class="det-ayuda">Solo mesas de la misma zona (' +
    esc(mo.ubicacion || "Sin zona") +
    "). Toca todas las que quieras juntar: pueden estar libres u ocupadas y puedes elegir varias.</p>";
  if (!lista.length) {
    html +=
      '<p class="vacio">No hay otras mesas disponibles para unir en esta zona.</p>';
  } else {
    html += '<div class="dest-grid">';
    lista.forEach(function (m) {
      var p = pedidoDeMesa(m.n);
      var marcada = seleccionUnir.indexOf(m.n) !== -1;
      html +=
        '<button type="button" class="dest-mesa' +
        (marcada ? " marcada" : "") +
        '" aria-pressed="' +
        marcada +
        '" data-act="marcar" data-n="' +
        origen +
        '" data-otra="' +
        m.n +
        '"><b>Mesa ' +
        m.n +
        "</b><small>" +
        (p ? "Cuenta " + pesos(totalesDe(p, 0).total) : "Libre") +
        " · " +
        plural(m.capacidad, "puesto", "puestos") +
        "</small></button>";
    });
    html += "</div>";
    html +=
      '<p class="union-resumen">' +
      (seleccionUnir.length
        ? "Mesa " +
          origen +
          " + " +
          seleccionUnir.join(" + ") +
          " · " +
          plural(puestosTotal, "puesto", "puestos")
        : "Todavía no elegiste ninguna mesa.") +
      "</p>";
  }
  return (
    html +
    '<div class="det-acciones"><button type="button" class="btn" data-act="volver" data-n="' +
    origen +
    '">← Volver</button>' +
    '<button type="button" class="btn btn-primary" data-act="resumen-union" data-n="' +
    origen +
    '"' +
    (seleccionUnir.length ? "" : " disabled") +
    ">Continuar</button></div></div>"
  );
}

// La mesa que queda al frente: la que tiene la cuenta (si ninguna, la de origen)
function principalDeUnion(origen, otras) {
  var conCuenta = [origen].concat(otras).filter(function (n) {
    return !!pedidoDeMesa(n);
  });
  return pedidoDeMesa(origen) || !conCuenta.length ? origen : conCuenta[0];
}

function vistaConfirmarUnion(origen) {
  var grupo = [origen].concat(seleccionUnir);
  var principal = principalDeUnion(origen, seleccionUnir);
  var puestosTotal = 0,
    cuentas = 0,
    total = 0;
  grupo.forEach(function (n) {
    puestosTotal += buscarPor(ESTADO.mesas, "n", n).capacidad;
    var p = pedidoDeMesa(n);
    if (p) {
      cuentas += 1;
      total += totalesDe(p, 0).total;
    }
  });
  var texto =
    "Las " +
    grupo.length +
    " mesas (" +
    grupo.join(", ") +
    ") quedan unidas como la Mesa " +
    principal +
    ", con " +
    plural(puestosTotal, "puesto", "puestos") +
    ".";
  if (cuentas)
    texto +=
      (cuentas > 1
        ? " Las " + cuentas + " cuentas se juntan en una sola de "
        : " La cuenta de ") +
      pesos(total) +
      (cuentas > 1 ? "." : " queda en la Mesa " + principal + ".");
  return (
    '<div class="det-mesa"><p class="det-nombre">Confirmar unión</p><p class="det-ayuda">' +
    texto +
    " Se separan solas cuando empiece el siguiente turno, o antes si las separas tú.</p>" +
    '<div class="det-acciones"><button type="button" class="btn" data-act="unir" data-n="' +
    origen +
    '">← Cambiar</button>' +
    '<button type="button" class="btn btn-primary" data-act="confirmar-union" data-n="' +
    origen +
    '">Unir mesas</button></div></div>'
  );
}

function unirCuentas(origen, destino) {
  var po = pedidoDeMesa(origen),
    pd = pedidoDeMesa(destino);
  po.lineas.forEach(function (l) {
    var igual = pd.lineas.filter(function (x) {
      return (
        x.producto === l.producto &&
        x.precio === l.precio &&
        x.esp === l.esp &&
        x.despacho === l.despacho
      );
    })[0];
    if (igual) igual.cant += l.cant;
    else pd.lineas.push(l);
  });
  po.lineas = [];
  po.estado = "Anulado"; // su contenido ya está en la otra cuenta
  pd.estado = estadoDePedido(pd);
}

function unirMesas(origen, otras) {
  ESTADO.mesasUnidas = ESTADO.mesasUnidas || [];
  var principalN = principalDeUnion(origen, otras);
  var principal = buscarPor(ESTADO.mesas, "n", principalN);
  principal.unidas = principal.unidas || [];
  [origen].concat(otras).forEach(function (n) {
    if (n === principalN) return;
    var m = buscarPor(ESTADO.mesas, "n", n);
    if (pedidoDeMesa(n)) unirCuentas(n, principalN);
    ESTADO.mesas.splice(ESTADO.mesas.indexOf(m), 1);
    ESTADO.mesasUnidas.push({
      n: m.n,
      capacidad: m.capacidad,
      ubicacion: m.ubicacion,
      principal: principalN,
    });
    principal.capacidad += m.capacidad;
    principal.unidas.push(n);
  });
  principal.unidas.sort(function (a, b) {
    return a - b;
  });
  principal.unionTurno = idTurnoActual(); // se separan solas al empezar el siguiente turno
  actualizarMesas();
  guardar();
  return principalN;
}

function separarMesas(n) {
  var devueltas = separarMesasDe(n);
  actualizarMesas();
  guardar();
  return devueltas;
}

// Ventana emergente con el detalle de la mesa (la X va por fuera de la tarjeta)
var dlgDetalle = document.getElementById("dlg-detalle");
function pintarDetalle(n) {
  document.getElementById("d-cuerpo").innerHTML = detalleHtml(
    buscarPor(ESTADO.mesas, "n", n),
  );
}
function abrirDetalle(n) {
  seleccionUnir = [];
  pintarDetalle(n);
  if (!dlgDetalle.open) dlgDetalle.showModal();
}
function cerrarDetalle() {
  if (dlgDetalle.open) dlgDetalle.close();
}
dlgDetalle.addEventListener("close", function () {
  mesaElegida = null;
  pintarTablero();
});
document.getElementById("d-cerrar").addEventListener("click", cerrarDetalle);
dlgDetalle.addEventListener("click", function (e) {
  if (e.target === dlgDetalle) {
    cerrarDetalle();
    return;
  } // toque en el fondo oscuro
  var act = e.target.closest("[data-act]");
  if (act) {
    var cuerpo = document.getElementById("d-cuerpo");
    var a = act.dataset.act,
      n = Number(act.dataset.n);
    if (act.disabled) return;
    if (a === "trasladar") cuerpo.innerHTML = vistaTrasladar(n);
    if (a === "volver") {
      seleccionUnir = [];
      pintarDetalle(n);
    }
    if (a === "elegir-traslado")
      cuerpo.innerHTML = vistaConfirmarTraslado(
        Number(act.dataset.origen),
        Number(act.dataset.destino),
      );
    if (a === "confirmar-traslado") {
      var o = Number(act.dataset.origen),
        d = Number(act.dataset.destino);
      trasladarCuenta(o, d);
      toast("Cuenta trasladada de la Mesa " + o + " a la Mesa " + d);
      mesaElegida = d;
      pintarDetalle(d);
      pintarTablero();
    }
    if (a === "unir") cuerpo.innerHTML = vistaUnir(n);
    if (a === "marcar") {
      var otra = Number(act.dataset.otra),
        i = seleccionUnir.indexOf(otra);
      if (i === -1) seleccionUnir.push(otra);
      else seleccionUnir.splice(i, 1);
      seleccionUnir.sort(function (x, y) {
        return x - y;
      });
      cuerpo.innerHTML = vistaUnir(n);
    }
    if (a === "resumen-union") cuerpo.innerHTML = vistaConfirmarUnion(n);
    if (a === "confirmar-union") {
      var principal = unirMesas(n, seleccionUnir.slice());
      seleccionUnir = [];
      toast("Mesas unidas en la Mesa " + principal);
      pintarFiltros();
      mesaElegida = principal;
      pintarDetalle(principal);
      pintarTablero();
    }
    if (a === "limpia") {
      buscarPor(ESTADO.mesas, "n", n).estado = "Disponible";
      guardar();
      toast("Mesa " + n + " lista");
      cerrarDetalle();
      pintarFiltros();
      pintarTablero();
    }
    if (a === "separar") {
      var devueltas = separarMesas(n);
      toast("Mesas separadas: " + listaDe([n].concat(devueltas)));
      pintarFiltros();
      pintarDetalle(n);
      pintarTablero();
    }
    return;
  }
  var cuenta = e.target.closest("[data-cuenta]");
  if (cuenta) {
    var nc = Number(cuenta.dataset.cuenta);
    cerrarDetalle();
    abrirCuenta(nc);
  }
});

// ============================================================
// FILTROS DEL ENCABEZADO
// ============================================================
function chipFiltro(grupo, valor, texto, activo) {
  return (
    '<button type="button" class="chip-filtro" data-f="' +
    grupo +
    '" data-v="' +
    esc(String(valor)) +
    '" aria-pressed="' +
    activo +
    '">' +
    esc(texto) +
    "</button>"
  );
}

function pintarFiltros() {
  var caja = document.getElementById("filtros-mesas");
  if (!caja) return;
  var capacidades = [];
  ESTADO.mesas.forEach(function (m) {
    if (capacidades.indexOf(m.capacidad) === -1) capacidades.push(m.capacidad);
  });
  capacidades.sort(function (a, b) {
    return a - b;
  });
  if (filtro.puestos && capacidades.indexOf(filtro.puestos) === -1)
    filtro.puestos = 0;
  var zonas = zonasDelBar();
  if (
    filtro.zona &&
    !zonas.some(function (z) {
      return claveZona(z) === claveZona(filtro.zona);
    })
  )
    filtro.zona = "";
  var h =
    '<div class="filtro-grupo" role="group" aria-label="Estado"><span class="filtro-titulo">Estado</span>' +
    chipFiltro("estado", "", "Todas", !filtro.estado) +
    chipFiltro("estado", "Ocupada", "Ocupadas", filtro.estado === "Ocupada") +
    chipFiltro(
      "estado",
      "Disponible",
      "Libres",
      filtro.estado === "Disponible",
    ) +
    chipFiltro(
      "estado",
      "Reservada",
      "Reservadas",
      filtro.estado === "Reservada",
    ) +
    chipFiltro(
      "estado",
      "Por limpiar",
      "Por limpiar",
      filtro.estado === "Por limpiar",
    ) +
    "</div>";
  h +=
    '<div class="filtro-grupo" role="group" aria-label="Puestos"><span class="filtro-titulo">Puestos</span>' +
    chipFiltro("puestos", 0, "Todos", !filtro.puestos);
  capacidades.forEach(function (c) {
    h += chipFiltro("puestos", c, String(c), filtro.puestos === c);
  });
  h +=
    '</div><div class="filtro-grupo" role="group" aria-label="Zona"><span class="filtro-titulo">Zona</span>' +
    chipFiltro("zona", "", "Todas", !filtro.zona);
  zonas.forEach(function (z) {
    h += chipFiltro("zona", z, z, claveZona(filtro.zona) === claveZona(z));
  });
  caja.innerHTML = h + "</div>";
}

document.addEventListener("click", function (e) {
  var b = e.target.closest(".chip-filtro");
  if (!b) return;
  var g = b.dataset.f,
    v = b.dataset.v;
  if (g === "estado") filtro.estado = v;
  if (g === "puestos") filtro.puestos = Number(v);
  if (g === "zona") filtro.zona = v;
  pintarFiltros();
  pintarTablero();
});
pintarFiltros();
