/* Reservaciones: crear, editar, confirmar, anticipos, llegada, cancelación y no asistencia.
   Todo se guarda solo en la memoria del navegador (es la simulación del frontend). Las demás pantallas
   (Inicio, Mesas) leen estas reservaciones de datos.js. */

var NOMBRE_ESTADO = {
  PENDIENTE: "Pendiente",
  CONFIRMADA: "Confirmada",
  CUMPLIDA: "Llegó",
  CANCELADA: "Cancelada",
  NO_ASISTIO: "No asistió",
};
var PUNTO_ESTADO = {
  PENDIENTE: "pend",
  CONFIRMADA: "conf",
  CUMPLIDA: "lleg",
  CANCELADA: "canc",
  NO_ASISTIO: "canc",
};
var DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
var MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
var MINUTOS_ENTRE_RESERVAS = 120; // una mesa no se reserva dos veces dentro de este tiempo

var filtro = { estado: "", cuando: "proximas", tipo: "" };
var reservaAbierta = 0; // número de la reservación que se ve en el detalle
var reservaEnEdicion = 0; // 0 = nueva
var tipoElegido = "MESA";
var metodoElegido = "";
var destinoAnticipo = 0;
var destinoCancelar = 0;

function $(id) {
  return document.getElementById(id);
}
function aviso(texto) {
  $("r-aviso").textContent = texto;
}

function hoyISO() {
  var h = new Date();
  return (
    h.getFullYear() +
    "-" +
    ("0" + (h.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + h.getDate()).slice(-2)
  );
}
function ahoraTextoRes() {
  return (
    hoyISO() +
    " " +
    ("0" + new Date().getHours()).slice(-2) +
    ":" +
    ("0" + new Date().getMinutes()).slice(-2)
  );
}
function partesFecha(iso) {
  var p = iso.split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function fechaCorta(iso) {
  var d = partesFecha(iso);
  return d.getDate() + " " + MESES[d.getMonth()].slice(0, 3);
}
function fechaLarga(iso) {
  var d = partesFecha(iso);
  var diff = Math.round((d - partesFecha(hoyISO())) / 86400000);
  var base =
    DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()];
  return (
    (diff === 0
      ? "Hoy · "
      : diff === 1
        ? "Mañana · "
        : diff === -1
          ? "Ayer · "
          : "") + base
  );
}
function minutos(hora) {
  var p = hora.split(":");
  return Number(p[0]) * 60 + Number(p[1]);
}
function esVigente(r) {
  return r.estado === "PENDIENTE" || r.estado === "CONFIRMADA";
}
function mesaDe(n) {
  return buscarPor(ESTADO.mesas, "n", n);
}
function anticipoDe(r) {
  return (
    r.anticipo || { monto: 0, metodo: "", ref: "", estado: "Sin anticipo" }
  );
}
function registrar(r, texto) {
  r.historial = r.historial || [];
  r.historial.push({ t: ahoraTextoRes(), texto: texto });
}

// ============================================================
// FILTROS
// ============================================================
function chip(grupo, valor, texto, activo) {
  return (
    '<button type="button" class="chip-filtro" data-f="' +
    grupo +
    '" data-v="' +
    esc(valor) +
    '" aria-pressed="' +
    activo +
    '">' +
    esc(texto) +
    "</button>"
  );
}
function pintarFiltros() {
  var e = [
    ["", "Todas"],
    ["PENDIENTE", "Pendientes"],
    ["CONFIRMADA", "Confirmadas"],
    ["CUMPLIDA", "Llegaron"],
    ["CANCELADA", "Canceladas"],
    ["NO_ASISTIO", "No asistieron"],
  ];
  var c = [
    ["hoy", "Hoy"],
    ["proximas", "Próximas"],
    ["pasadas", "Pasadas"],
    ["todas", "Todas"],
  ];
  var h =
    '<div class="filtro-grupo" role="group" aria-label="Cuándo"><span class="filtro-titulo">Cuándo</span>';
  c.forEach(function (x) {
    h += chip("cuando", x[0], x[1], filtro.cuando === x[0]);
  });
  h +=
    '</div><div class="filtro-grupo" role="group" aria-label="Estado"><span class="filtro-titulo">Estado</span>';
  e.forEach(function (x) {
    h += chip("estado", x[0], x[1], filtro.estado === x[0]);
  });
  $("r-filtros").innerHTML = h + "</div>";
}
$("r-filtros").addEventListener("click", function (e) {
  var b = e.target.closest(".chip-filtro");
  if (!b) return;
  filtro[b.dataset.f] = b.dataset.v;
  pintarFiltros();
  pintarLista();
});

function pasaFiltro(r) {
  var hoy = hoyISO();
  if (filtro.estado && r.estado !== filtro.estado) return false;
  if (filtro.tipo && r.tipo !== filtro.tipo) return false;
  if (filtro.cuando === "hoy" && r.fecha !== hoy) return false;
  if (filtro.cuando === "proximas" && r.fecha < hoy) return false;
  if (filtro.cuando === "pasadas" && r.fecha >= hoy) return false;
  return true;
}

// ============================================================
// INDICADORES Y LISTA
// ============================================================
function accionPrincipal(r) {
  if (r.estado === "PENDIENTE")
    return (
      '<button type="button" class="btn-fila btn-fila-ppal" data-ra="confirmar" data-n="' +
      r.n +
      '">Confirmar</button>'
    );
  if (r.estado === "CONFIRMADA" && r.fecha === hoyISO())
    return (
      '<button type="button" class="btn-fila btn-fila-ppal" data-ra="llego" data-n="' +
      r.n +
      '">Llegó</button>'
    );
  return "";
}

var CLASE_W = {
  PENDIENTE: "w-punteada",
  CONFIRMADA: "w-activa",
  CUMPLIDA: "w-celeste",
  CANCELADA: "w-apagada",
  NO_ASISTIO: "w-apagada",
};
function pintarLista() {
  var lista = ESTADO.reservas.filter(pasaFiltro).sort(function (a, b) {
    return a.fecha + a.hora < b.fecha + b.hora ? -1 : 1;
  });
  var h = "",
    dia = "",
    abierto = false;
  lista.forEach(function (r) {
    if (r.fecha !== dia) {
      dia = r.fecha;
      if (abierto) h += "</div>";
      h +=
        '<h3 class="grupo-w">' +
        esc(fechaLarga(dia)) +
        '</h3><div class="widgets">';
      abierto = true;
    }
    var m = mesaDe(r.mesa);
    var a = anticipoDe(r);
    var ant =
      a.estado === "Sin anticipo"
        ? r.tipo === "EVENTO"
          ? "Falta el anticipo"
          : "Sin anticipo"
        : "Anticipo " + pesos(a.monto) + " · " + a.estado;
    h +=
      '<article class="widget ' +
      CLASE_W[r.estado] +
      '" data-n="' +
      r.n +
      '">' +
      '<div class="w-cab"><img src="icons/inicio/reserva.svg" alt=""><b>' +
      esc(r.hora) +
      "</b></div>" +
      '<p class="w-valor">' +
      esc(r.cliente) +
      "</p>" +
      '<p class="w-sub">' +
      (r.tipo === "EVENTO"
        ? "Evento" + (r.evento ? " · " + esc(r.evento) : "")
        : "Mesa " +
          r.mesa +
          (m && m.ubicacion ? " · " + esc(m.ubicacion) : "")) +
      "</p>" +
      '<p class="w-sub">' +
      (r.tipo === "EVENTO" ? "Mesa " + r.mesa + " · " : "") +
      r.personas +
      (r.personas === 1 ? " persona" : " personas") +
      "</p>" +
      '<p class="w-sub">' +
      esc(ant) +
      "</p>" +
      '<div class="w-pie">' +
      accionPrincipal(r) +
      '<span class="w-estado">' +
      NOMBRE_ESTADO[r.estado] +
      "</span></div></article>";
  });
  if (abierto) h += "</div>";
  $("r-tabla").innerHTML =
    h || '<p class="vacio-w">No hay reservaciones con estos filtros.</p>';
}

function pintarTodo() {
  pintarLista();
}

// ============================================================
// ACCIONES SOBRE UNA RESERVACIÓN
// ============================================================
function confirmar(r) {
  if (r.tipo === "EVENTO" && anticipoDe(r).estado !== "Pagado") {
    aviso(
      "Los eventos se confirman con anticipo: registra el anticipo de " +
        r.cliente +
        " antes de confirmar.",
    );
    return false;
  }
  r.estado = "CONFIRMADA";
  registrar(r, "Reservación confirmada");
  guardar();
  aviso("Reservación de " + r.cliente + " confirmada.");
  return true;
}

// El pedido que el cliente armó al reservar pasa a la mesa cuando llega; su abono se descuenta al cobrar
function pedidoDeReserva(r) {
  var n = 0;
  ESTADO.pedidos.forEach(function (p) {
    n = Math.max(n, p.n);
  });
  var a = anticipoDe(r);
  var p = {
    n: n + 1,
    mesa: r.mesa,
    mesero: "—",
    cliente: r.cliente,
    canal: "App",
    fecha: ahoraTexto(),
    estado: "Abierto",
    venta: 0,
    reserva: r.n,
    abono: a.estado === "Pagado" ? a.monto : 0,
    lineas: r.preorden.lineas.map(function (l) {
      return {
        producto: l.producto,
        cant: l.cant,
        precio: l.precio,
        iva: l.iva,
        imp: l.imp,
        esp: "",
        despacho: "Por confirmar",
      };
    }),
  };
  ESTADO.pedidos.push(p);
  actualizarMesas();
  return p;
}

function llego(r) {
  var m = mesaDe(r.mesa);
  if (!m || m.estado === "Inactiva") {
    aviso(
      "La mesa " +
        r.mesa +
        " no está disponible. Cámbiala editando la reservación.",
    );
    return;
  }
  r.estado = "CUMPLIDA";
  registrar(r, "El cliente llegó");
  notificar(
    ["mesas"],
    "Llegó la reservación de " + r.cliente + ": mesa " + r.mesa,
    "pedidos.html?mesa=" + r.mesa,
    "aviso",
  );
  var nuevo =
    r.preorden && r.preorden.lineas.length && !pedidoDeMesa(r.mesa)
      ? pedidoDeReserva(r)
      : null;
  if (nuevo)
    registrar(
      r,
      "Se abrió el pedido " + nuevo.n + " con lo que pidió por adelantado",
    );
  guardar();
  window.location.href = "pedidos.html?mesa=" + r.mesa; // se abre el pedido en su mesa
}

function noAsistio(r) {
  r.estado = "NO_ASISTIO";
  var a = anticipoDe(r);
  if (a.estado === "Pagado") {
    a.retenido = Math.round((a.monto * POLITICA_RESERVA.penalizacion) / 100);
    a.porDevolver = a.monto - a.retenido;
    a.devuelto = 0;
    a.estado = "Retenido";
    r.anticipo = a;
    registrar(
      r,
      "No asistió: se retiene el " +
        POLITICA_RESERVA.penalizacion +
        " % del abono (" +
        pesos(a.retenido) +
        ") y quedan " +
        pesos(a.porDevolver) +
        " por devolver",
    );
  } else registrar(r, "No asistió");
  guardar();
  aviso(r.cliente + " no asistió.");
}

function reactivar(r) {
  var c = choque(r);
  if (c) {
    aviso(
      "No se puede reactivar: la Mesa " +
        r.mesa +
        " ya está reservada a las " +
        c.hora +
        " (" +
        c.cliente +
        ").",
    );
    return false;
  }
  r.estado = "PENDIENTE";
  var a = anticipoDe(r);
  if (a.estado === "Devuelto" || a.estado === "Retenido") {
    r.anticipo = { monto: 0, metodo: "", ref: "", estado: "Sin anticipo" };
  }
  registrar(r, "Reservación reactivada");
  guardar();
  aviso("Reservación de " + r.cliente + " reactivada.");
  return true;
}

// Otra reservación vigente de la misma mesa, el mismo día y con menos de 2 horas de diferencia
function choque(r) {
  return (
    ESTADO.reservas.filter(function (x) {
      return (
        x.n !== r.n &&
        esVigente(x) &&
        x.mesa === r.mesa &&
        x.fecha === r.fecha &&
        Math.abs(minutos(x.hora) - minutos(r.hora)) < MINUTOS_ENTRE_RESERVAS
      );
    })[0] || null
  );
}


// VENTANA DE DETALLE

var dlgDetalle = $("dlg-detalle");

function detalleHtml(r) {
  var m = mesaDe(r.mesa);
  var a = anticipoDe(r);
  var vigente = esVigente(r);
  var hoy = vigente && r.fecha === hoyISO();
  var quien =
    '<header class="det-cab"><p class="det-sup">Reservación N.º ' +
    r.n +
    "</p><h2>" +
    esc(r.cliente) +
    "</h2>" +
    '<span class="est-res"><i class="pt ' +
    PUNTO_ESTADO[r.estado] +
    '"></i>' +
    NOMBRE_ESTADO[r.estado] +
    "</span></header>";
  var cuando =
    '<div class="det-cuando"><b>' +
    esc(r.hora) +
    "</b><span>" +
    esc(fechaLarga(r.fecha)) +
    "</span></div>";
  var datos =
    '<dl class="det-datos">' +
    "<div><dt>Mesa</dt><dd>Mesa " +
    r.mesa +
    (m && m.ubicacion ? " · " + esc(m.ubicacion) : "") +
    "</dd></div>" +
    "<div><dt>Personas</dt><dd>" +
    r.personas +
    "</dd></div>" +
    "<div><dt>Tipo</dt><dd>" +
    (r.tipo === "EVENTO"
      ? "Evento" + (r.evento ? " · " + esc(r.evento) : "")
      : "Mesa") +
    "</dd></div>" +
    "<div><dt>Anticipo</dt><dd>" +
    (a.estado === "Sin anticipo"
      ? r.tipo === "EVENTO"
        ? "Falta registrarlo"
        : "No registrado"
      : pesos(a.monto) +
        "<small>" +
        esc(a.estado) +
        (a.metodo ? " · " + esc(a.metodo) : "") +
        (a.ref ? " · " + esc(a.ref) : "") +
        "</small>" +
        (a.retenido !== undefined
          ? "<small>Penalización " +
            pesos(a.retenido) +
            (a.porDevolver
              ? " · por devolver " + pesos(a.porDevolver)
              : " · resto devuelto") +
            "</small>"
          : "")) +
    "</dd></div>" +
    (r.preorden
      ? '<div class="ancho"><dt>Pedido anticipado</dt><dd>' +
        r.preorden.lineas
          .map(function (l) {
            return l.cant + " × " + esc(l.producto);
          })
          .join(", ") +
        "<small>Total " +
        pesos(r.preorden.total) +
        " · abono mínimo " +
        pesos(
          Math.ceil((r.preorden.total * POLITICA_RESERVA.abonoMinimo) / 100),
        ) +
        "</small></dd></div>"
      : "") +
    (r.telefono
      ? "<div><dt>Teléfono</dt><dd>" + esc(r.telefono) + "</dd></div>"
      : "") +
    (r.obs
      ? '<div class="ancho"><dt>Observaciones</dt><dd>' +
        esc(r.obs) +
        "</dd></div>"
      : "") +
    "</dl>";
  var btn = function (clave, texto, clase) {
    return (
      '<button type="button" class="btn' +
      (clase ? " " + clase : "") +
      '" data-da="' +
      clave +
      '">' +
      texto +
      "</button>"
    );
  };
  var prin = "",
    sec = "",
    baja = "";
  if (r.estado === "PENDIENTE")
    prin += btn("confirmar", "Confirmar reservación", "btn-primary");
  if (hoy)
    prin += btn(
      "llego",
      "Llegó",
      r.estado === "CONFIRMADA" ? "btn-primary" : "",
    );
  if (vigente && (a.estado === "Sin anticipo" || a.estado === "Pendiente"))
    sec += btn("anticipo", "Registrar anticipo");
  if (vigente) sec += btn("editar", "Editar");
  if (!vigente && r.estado !== "CUMPLIDA") sec += btn("reactivar", "Reactivar");
  if (a.estado === "Retenido" && r.estado !== "CUMPLIDA" && a.porDevolver !== 0)
    sec += btn(
      "devolver",
      a.porDevolver
        ? "Devolver " + pesos(a.porDevolver) + " al cliente"
        : "Devolver anticipo",
    );
  if (vigente)
    baja =
      btn("noasistio", "No asistió") + btn("cancelar", "Cancelar reservación");
  var hist = (r.historial || [])
    .slice()
    .reverse()
    .map(function (h) {
      return (
        "<li><span>" + esc(h.t.slice(5)) + "</span>" + esc(h.texto) + "</li>"
      );
    })
    .join("");
  return (
    '<div class="det-res">' +
    quien +
    cuando +
    datos +
    '<div class="det-botones">' +
    (prin ? '<div class="det-prin">' + prin + "</div>" : "") +
    '<div class="det-sec">' +
    sec +
    "</div>" +
    (baja ? '<div class="det-baja">' + baja + "</div>" : "") +
    "</div>" +
    (hist
      ? '<details class="det-hist"><summary>Historial (' +
        (r.historial || []).length +
        ")</summary><ul>" +
        hist +
        "</ul></details>"
      : "") +
    "</div>"
  );
}

function abrirDetalle(n) {
  reservaAbierta = n;
  $("d-cuerpo").innerHTML = detalleHtml(buscarPor(ESTADO.reservas, "n", n));
  if (!dlgDetalle.open) dlgDetalle.showModal();
}
function refrescarDetalle() {
  if (dlgDetalle.open)
    $("d-cuerpo").innerHTML = detalleHtml(
      buscarPor(ESTADO.reservas, "n", reservaAbierta),
    );
}
function cerrar(dlg) {
  if (dlg.open) dlg.close();
}

$("d-cerrar").addEventListener("click", function () {
  cerrar(dlgDetalle);
});
dlgDetalle.addEventListener("click", function (e) {
  if (e.target === dlgDetalle) {
    cerrar(dlgDetalle);
    return;
  }
  var b = e.target.closest("[data-da]");
  if (!b) return;
  var r = buscarPor(ESTADO.reservas, "n", reservaAbierta);
  var a = b.dataset.da;
  if (a === "confirmar") {
    if (confirmar(r)) {
      pintarTodo();
      refrescarDetalle();
    } else cerrar(dlgDetalle);
    return;
  }
  if (a === "llego") {
    llego(r);
    return;
  }
  if (a === "noasistio") {
    noAsistio(r);
    pintarTodo();
    refrescarDetalle();
    return;
  }
  if (a === "reactivar") {
    if (reactivar(r)) {
      pintarTodo();
      refrescarDetalle();
    } else cerrar(dlgDetalle);
    return;
  }
  if (a === "devolver") {
    if (r.anticipo.retenido !== undefined) {
      r.anticipo.devuelto = r.anticipo.porDevolver;
      r.anticipo.porDevolver = 0;
      registrar(
        r,
        "Se devolvieron " +
          pesos(r.anticipo.devuelto) +
          " del abono al cliente",
      );
    } else {
      r.anticipo.estado = "Devuelto";
      registrar(r, "Anticipo devuelto al cliente");
    }
    guardar();
    pintarTodo();
    refrescarDetalle();
    aviso("Anticipo devuelto.");
    return;
  }
  if (a === "editar") {
    cerrar(dlgDetalle);
    abrirFormulario(r.n);
    return;
  }
  if (a === "anticipo") {
    cerrar(dlgDetalle);
    abrirAnticipo(r.n);
    return;
  }
  if (a === "cancelar") {
    cerrar(dlgDetalle);
    abrirCancelar(r.n);
    return;
  }
});


$("r-tabla").addEventListener("click", function (e) {
  var b = e.target.closest("button[data-ra]");
  var fila = e.target.closest(".widget");
  if (b) {
    var r = buscarPor(ESTADO.reservas, "n", Number(b.dataset.n));
    if (b.dataset.ra === "ver") abrirDetalle(r.n);
    if (b.dataset.ra === "confirmar") {
      if (confirmar(r)) pintarTodo();
      else abrirDetalle(r.n);
    }
    if (b.dataset.ra === "llego") llego(r);
    return;
  }
  if (fila) abrirDetalle(Number(fila.dataset.n));
});




var dlgForm = $("dlg-form");
var formRes = $("form-res");

function pintarMesas(elegida) {
  var h = "";
  ESTADO.mesas
    .filter(function (m) {
      return m.estado !== "Inactiva";
    })
    .forEach(function (m) {
      h +=
        '<option value="' +
        m.n +
        '">Mesa ' +
        m.n +
        " · " +
        m.capacidad +
        " puestos · " +
        esc(m.ubicacion || "Sin zona") +
        "</option>";
    });
  $("f_mesa").innerHTML = h || '<option value="">No hay mesas activas</option>';
  if (elegida) $("f_mesa").value = String(elegida);
}

function pintarTipo() {
  [].forEach.call($("f-tipo").querySelectorAll(".chip-res"), function (b) {
    b.setAttribute(
      "aria-pressed",
      b.dataset.tipo === tipoElegido ? "true" : "false",
    );
  });
  $("f-campo-evento").hidden = tipoElegido !== "EVENTO";
}
$("f-tipo").addEventListener("click", function (e) {
  var b = e.target.closest(".chip-res");
  if (!b) return;
  tipoElegido = b.dataset.tipo;
  pintarTipo();
});


var pedidoForm = {}; 
function lineasDePedidoForm() {
  return Object.keys(pedidoForm).map(function (k) {
    var p = buscarPor(ESTADO.productos, "nombre", k);
    return {
      producto: k,
      cant: pedidoForm[k],
      precio: p.precio,
      iva: p.iva,
      imp: claveImp(p),
    };
  });
}
function resumenPedidoForm() {
  var lineas = lineasDePedidoForm();
  if (!lineas.length) {
    $("f-pedido-resumen").innerHTML = "";
    $("f-pedido-abrir").textContent = "Agregar pedido";
    return;
  }
  var t = totalesDe({ lineas: lineas }, 0),
    n = 0;
  lineas.forEach(function (l) {
    n += l.cant;
  });
  $("f-pedido-resumen").innerHTML =
    "<b>Pedido:</b> " +
    n +
    (n === 1 ? " producto" : " productos") +
    " · " +
    pesos(t.total) +
    "<small>Abono mínimo " +
    POLITICA_RESERVA.abonoMinimo +
    " %: " +
    pesos(
      Math.ceil((t.total * POLITICA_RESERVA.abonoMinimo) / 100 / 100) * 100,
    ) +
    "</small>";
  $("f-pedido-abrir").textContent = "Cambiar pedido";
}
function pintarListaPedido() {
  var q = $("pd-buscar").value.trim().toLowerCase(),
    cat = "";
  var h = "";
  ESTADO.productos
    .filter(function (p) {
      return (
        p.activo !== false && (!q || p.nombre.toLowerCase().indexOf(q) !== -1)
      );
    })
    .forEach(function (p) {
      if (p.cat !== cat) {
        cat = p.cat;
        h += '<h3 class="grupo-w">' + esc(cat) + "</h3>";
      }
      var n = pedidoForm[p.nombre] || 0;
      h +=
        '<div class="pd-fila" data-p="' +
        esc(p.nombre) +
        '"><span>' +
        esc(p.nombre) +
        "<small>" +
        pesos(p.precio) +
        '</small></span><span class="pd-cant"><button type="button" data-d="-1" aria-label="Quitar uno"' +
        (n ? "" : " disabled") +
        ">−</button><b>" +
        n +
        '</b><button type="button" data-d="1" aria-label="Agregar uno">+</button></span></div>';
    });
  $("pd-lista").innerHTML =
    h || '<p class="pd-vacio">No hay productos con esa búsqueda.</p>';
  var lineas = lineasDePedidoForm();
  $("pd-total").textContent = lineas.length
    ? "Total: " + pesos(totalesDe({ lineas: lineas }, 0).total)
    : "";
}
$("f-pedido-abrir").addEventListener("click", function () {
  $("pd-buscar").value = "";
  pintarListaPedido();
  $("dlg-pedido").showModal();
});
$("pd-buscar").addEventListener("input", pintarListaPedido);
$("pd-lista").addEventListener("click", function (e) {
  var b = e.target.closest(".pd-cant button");
  if (!b) return;
  var nombre = b.closest(".pd-fila").dataset.p,
    n = Math.max(0, (pedidoForm[nombre] || 0) + Number(b.dataset.d));
  if (n) pedidoForm[nombre] = n;
  else delete pedidoForm[nombre];
  var y = $("pd-lista").scrollTop;
  pintarListaPedido();
  $("pd-lista").scrollTop = y;
});
$("pd-quitar").addEventListener("click", function () {
  pedidoForm = {};
  resumenPedidoForm();
  $("dlg-pedido").close();
});
$("pd-listo").addEventListener("click", function () {
  resumenPedidoForm();
  $("dlg-pedido").close();
});
$("pd-cerrar").addEventListener("click", function () {
  $("dlg-pedido").close();
});

function abrirFormulario(n) {
  reservaEnEdicion = n;
  var r = n ? buscarPor(ESTADO.reservas, "n", n) : null;
  $("f-titulo").textContent = r
    ? "Editar reservación N.º " + r.n
    : "Nueva reservación";
  $("f-guardar").textContent = r ? "Guardar cambios" : "Guardar reservación";
  tipoElegido = r ? r.tipo : "MESA";
  var conocidos = [];
  ESTADO.reservas.forEach(function (x) {
    if (conocidos.indexOf(x.cliente) === -1) conocidos.push(x.cliente);
  });
  ["María Benavides", "Jorge Pantoja", "Eventos Nariño S.A.S."].forEach(
    function (c) {
      if (conocidos.indexOf(c) === -1) conocidos.push(c);
    },
  );
  $("f-clientes").innerHTML = conocidos
    .map(function (c) {
      return '<option value="' + esc(c) + '">';
    })
    .join("");
  pintarMesas(r ? r.mesa : 0);
  formRes.cliente.value = r ? r.cliente : "";
  formRes.telefono.value = r ? r.telefono || "" : "";
  formRes.fecha.value = r ? r.fecha : hoyISO();
  formRes.fecha.min = r ? "" : hoyISO();
  formRes.hora.value = r ? r.hora : "21:00";
  formRes.personas.value = r ? r.personas : 2;
  formRes.evento.value = r ? r.evento || "" : "";
  formRes.obs.value = r ? r.obs || "" : "";
  pedidoForm = {};
  if (r && r.preorden)
    r.preorden.lineas.forEach(function (l) {
      pedidoForm[l.producto] = l.cant;
    });
  resumenPedidoForm();
  pintarTipo();
  $("f-error").textContent = "";
  formRes.dispatchEvent(new Event("input")); // la validación general de la app revisa los valores nuevos
  dlgForm.showModal();
  formRes.cliente.focus();
}

$("r-nueva").addEventListener("click", function () {
  abrirFormulario(0);
});
$("f-cerrar").addEventListener("click", function () {
  cerrar(dlgForm);
});
$("f-cancelar").addEventListener("click", function () {
  cerrar(dlgForm);
});
dlgForm.addEventListener("click", function (e) {
  if (e.target === dlgForm) cerrar(dlgForm);
});

// El pedido de la reservación guardado, o nada si no se agregó
function pedidoPendiente() {
  var lineas = lineasDePedidoForm();
  return lineas.length
    ? { lineas: lineas, total: totalesDe({ lineas: lineas }, 0).total }
    : undefined;
}

function error(texto, campo) {
  $("f-error").textContent = texto;
  if (campo) campo.focus();
}

formRes.addEventListener("submit", function (e) {
  e.preventDefault();
  var cliente = formRes.cliente.value.trim();
  var fecha = formRes.fecha.value,
    hora = formRes.hora.value;
  var personas = Number(formRes.personas.value);
  var mesa = Number(formRes.mesa.value);
  var m = mesaDe(mesa);
  if (!cliente) return error("Escribe el nombre del cliente.", formRes.cliente);
  if (!fecha) return error("Elige la fecha.", formRes.fecha);
  if (!reservaEnEdicion && fecha < hoyISO())
    return error(
      "La fecha ya pasó: elige hoy o un día próximo.",
      formRes.fecha,
    );
  if (!hora) return error("Elige la hora.", formRes.hora);
  if (!(personas >= 1 && personas <= 30) || personas !== Math.floor(personas))
    return error(
      "Las personas deben ser un número entero entre 1 y 30.",
      formRes.personas,
    );
  if (!m) return error("Elige una mesa.", formRes.mesa);
  if (personas > m.capacidad)
    return error(
      "La Mesa " +
        mesa +
        " tiene " +
        m.capacidad +
        " puestos y son " +
        personas +
        " personas. Elige otra mesa o júntalas en la pantalla Mesas.",
      formRes.mesa,
    );
  var evento = tipoElegido === "EVENTO" ? formRes.evento.value.trim() : "";
  if (tipoElegido === "EVENTO" && !evento)
    return error("Escribe el nombre del evento.", formRes.evento);
  var borrador = { n: reservaEnEdicion, mesa: mesa, fecha: fecha, hora: hora };
  var c = choque(borrador);
  if (c)
    return error(
      "La Mesa " +
        mesa +
        " ya está reservada ese día a las " +
        c.hora +
        " (" +
        c.cliente +
        "). Deja al menos 2 horas o elige otra mesa.",
      formRes.mesa,
    );
  var texto;
  if (reservaEnEdicion) {
    var r = buscarPor(ESTADO.reservas, "n", reservaEnEdicion);
    var cambios = [];
    if (r.fecha !== fecha || r.hora !== hora)
      cambios.push("horario " + fechaCorta(fecha) + " " + hora);
    if (r.mesa !== mesa) cambios.push("Mesa " + mesa);
    if (r.personas !== personas) cambios.push(personas + " personas");
    r.cliente = cliente;
    r.telefono = formRes.telefono.value.trim();
    r.fecha = fecha;
    r.hora = hora;
    r.personas = personas;
    r.mesa = mesa;
    r.tipo = tipoElegido;
    r.evento = evento;
    r.obs = formRes.obs.value.trim();
    r.preorden = pedidoPendiente();
    registrar(
      r,
      "Reservación editada" + (cambios.length ? ": " + cambios.join(", ") : ""),
    );
    texto = "Reservación de " + cliente + " actualizada.";
  } else {
    var n = 0;
    ESTADO.reservas.forEach(function (x) {
      n = Math.max(n, x.n);
    });
    var nueva = {
      n: n + 1,
      fecha: fecha,
      hora: hora,
      mesa: mesa,
      personas: personas,
      cliente: cliente,
      telefono: formRes.telefono.value.trim(),
      tipo: tipoElegido,
      evento: evento,
      empleado: usuarioActual(),
      comprobante: "",
      obs: formRes.obs.value.trim(),
      estado: "PENDIENTE",
      anticipo: { monto: 0, metodo: "", ref: "", estado: "Sin anticipo" },
      preorden: pedidoPendiente(),
      historial: [],
    };
    registrar(nueva, "Reservación creada por " + usuarioActual());
    ESTADO.reservas.push(nueva);
    texto =
      "Reservación de " +
      cliente +
      " creada" +
      (tipoElegido === "EVENTO"
        ? ": registra el anticipo para poder confirmarla."
        : ". Confírmala con el cliente.");
  }
  guardar();
  cerrar(dlgForm);
  pintarTodo();
  aviso(texto);
});


// ANTICIPO

var dlgAnticipo = $("dlg-anticipo");
var formAnticipo = $("form-anticipo");

function pintarMetodos() {
  $("a-metodos").innerHTML = ESTADO.metodos
    .map(function (m) {
      return (
        '<button type="button" class="chip-res" role="radio" data-m="' +
        esc(m.nombre) +
        '" aria-pressed="' +
        (m.nombre === metodoElegido) +
        '">' +
        esc(m.nombre) +
        "</button>"
      );
    })
    .join("");
  var m = buscarPor(ESTADO.metodos, "nombre", metodoElegido);
  $("a-campo-ref").hidden = !m || !m.referencia;
}
$("a-metodos").addEventListener("click", function (e) {
  var b = e.target.closest(".chip-res");
  if (!b) return;
  metodoElegido = b.dataset.m;
  pintarMetodos();
});

function abrirAnticipo(n) {
  destinoAnticipo = n;
  var r = buscarPor(ESTADO.reservas, "n", n);
  var a = anticipoDe(r);
  $("a-ayuda").textContent =
    "Reservación de " +
    r.cliente +
    " · " +
    fechaCorta(r.fecha) +
    " " +
    r.hora +
    " · Mesa " +
    r.mesa +
    (r.tipo === "EVENTO" ? ". Los eventos se confirman con anticipo." : ".");
  formAnticipo.monto.value = a.monto || "";
  metodoElegido = a.metodo || ESTADO.metodos[0].nombre;
  formAnticipo.ref.value = a.ref || "";
  pintarMetodos();
  $("a-error").textContent = "";
  formAnticipo.dispatchEvent(new Event("input"));
  dlgAnticipo.showModal();
  formAnticipo.monto.focus();
}
$("a-cerrar").addEventListener("click", function () {
  cerrar(dlgAnticipo);
});
$("a-cancelar").addEventListener("click", function () {
  cerrar(dlgAnticipo);
});
dlgAnticipo.addEventListener("click", function (e) {
  if (e.target === dlgAnticipo) cerrar(dlgAnticipo);
});

formAnticipo.addEventListener("submit", function (e) {
  e.preventDefault();
  var r = buscarPor(ESTADO.reservas, "n", destinoAnticipo);
  var monto = Number(formAnticipo.monto.value);
  var m = buscarPor(ESTADO.metodos, "nombre", metodoElegido);
  if (!(monto >= 1000)) {
    $("a-error").textContent = "Escribe el valor del anticipo (desde $ 1.000).";
    formAnticipo.monto.focus();
    return;
  }
  if (m && m.referencia && !formAnticipo.ref.value.trim()) {
    $("a-error").textContent =
      "Escribe el número de transacción o el nombre del comprobante.";
    formAnticipo.ref.focus();
    return;
  }
  r.anticipo = {
    monto: monto,
    metodo: metodoElegido,
    ref: formAnticipo.ref.value.trim(),
    estado: "Pagado",
  };
  registrar(
    r,
    "Anticipo de " + pesos(monto) + " recibido (" + metodoElegido + ")",
  );
  guardar();
  cerrar(dlgAnticipo);
  pintarTodo();
  aviso(
    "Anticipo de " +
      pesos(monto) +
      " registrado para " +
      r.cliente +
      (r.estado === "PENDIENTE"
        ? ". Ya puedes confirmar la reservación."
        : "."),
  );
});


// CANCELAR

var dlgCancelar = $("dlg-cancelar");
var decisionAnticipo = "Devuelto";

function abrirCancelar(n) {
  destinoCancelar = n;
  var r = buscarPor(ESTADO.reservas, "n", n);
  var a = anticipoDe(r);
  $("c-ayuda").textContent =
    "Reservación de " +
    r.cliente +
    " · " +
    fechaCorta(r.fecha) +
    " " +
    r.hora +
    " · Mesa " +
    r.mesa +
    ".";
  $("c_motivo").value = "";
  $("c-campo-ant").hidden = a.estado !== "Pagado";
  decisionAnticipo = "Devuelto";
  [].forEach.call($("c-ant").querySelectorAll(".chip-res"), function (b) {
    b.setAttribute(
      "aria-pressed",
      b.dataset.ant === decisionAnticipo ? "true" : "false",
    );
  });
  dlgCancelar.showModal();
}
$("c-ant").addEventListener("click", function (e) {
  var b = e.target.closest(".chip-res");
  if (!b) return;
  decisionAnticipo = b.dataset.ant;
  [].forEach.call($("c-ant").querySelectorAll(".chip-res"), function (x) {
    x.setAttribute(
      "aria-pressed",
      x.dataset.ant === decisionAnticipo ? "true" : "false",
    );
  });
});
$("c-cerrar").addEventListener("click", function () {
  cerrar(dlgCancelar);
});
$("c-no").addEventListener("click", function () {
  cerrar(dlgCancelar);
});
dlgCancelar.addEventListener("click", function (e) {
  if (e.target === dlgCancelar) cerrar(dlgCancelar);
});

$("form-cancelar").addEventListener("submit", function (e) {
  e.preventDefault();
  var r = buscarPor(ESTADO.reservas, "n", destinoCancelar);
  var a = anticipoDe(r);
  var motivo = $("c_motivo").value.trim();
  r.estado = "CANCELADA";
  if (a.estado === "Pagado") {
    a.estado = decisionAnticipo;
    r.anticipo = a;
  }
  registrar(
    r,
    "Reservación cancelada" +
      (motivo ? ": " + motivo : "") +
      (a.estado === "Devuelto"
        ? " · anticipo devuelto"
        : a.estado === "Retenido"
          ? " · anticipo retenido"
          : ""),
  );
  guardar();
  cerrar(dlgCancelar);
  pintarTodo();
  aviso(
    "Reservación de " +
      r.cliente +
      " cancelada. Sigue en la lista para que no se pierda el registro.",
  );
});


pintarFiltros();
pintarTodo();
