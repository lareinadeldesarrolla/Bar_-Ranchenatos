/* Usuarios y roles: empleados del bar (widgets o tabla, con lo que han atendido y cobrado) y los roles con sus módulos.
   Todo se puede crear, editar, activar, desactivar y eliminar. */

var $ = function (id) {
  return document.getElementById(id);
};
var vistaActual = "empleados";
var formaActual = "widgets";
var estadoActual = "activos";
var rolActual = "Todos";
var orden = { clave: "nombre", dir: 1 };
var MESES_C = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];
var ESTADOS = [
  ["todos", "Todos"],
  ["activos", "Activos"],
  ["inactivos", "Inactivos"],
];
var ORDENES = [
  ["nombre", "Nombre"],
  ["rol", "Rol"],
  ["antiguedad", "Antigüedad"],
  ["actividad", "Más actividad"],
];
var TIPOS_DOC = ["CC", "CE", "TI", "PA", "PPT"];
var AREAS_OPC = [
  ["admin", "Administrador"],
  ["cajera", "Cajera"],
  ["mesas", "Mesas"],
  ["ventas", "Ventas"],
  ["bar", "Bar"],
  ["cocina", "Cocina"],
];
var MODULOS = [
  ["pedidos", "Pedidos"],
  ["mesas", "Mesas"],
  ["reservas", "Reservaciones"],
  ["despacho", "Despacho"],
  ["caja", "Caja"],
  ["productos", "Productos y recetas"],
  ["inventario", "Inventario"],
  ["eventos", "Eventos y promociones"],
  ["clientes", "Clientes"],
  ["reportes", "Reportes"],
  ["usuarios", "Usuarios y roles"],
];

function aviso(texto) {
  $("u-aviso").textContent = texto;
}
function vacio(texto) {
  return '<div class="vacio-c"><p>' + texto + "</p></div>";
}
function fecha(iso) {
  var p = iso.slice(0, 10).split("-");
  return Number(p[2]) + " " + MESES_C[Number(p[1]) - 1] + " " + p[0];
}
function nombreDe(e) {
  return (e.nombre + " " + e.apellidos).trim();
}
function rolPor(nombre) {
  return buscarPor(ESTADO.roles, "nombre", nombre);
}
function activosConRol(nombre) {
  return ESTADO.empleados.filter(function (e) {
    return e.rol === nombre && e.activo;
  });
}

// Cuánto lleva en el bar y qué ha hecho: pedidos tomados y cobros realizados
function antiguedad(e) {
  var meses = Math.max(
    0,
    Math.floor(
      (new Date() - new Date(e.ingreso + "T00:00:00")) / 86400000 / 30.44,
    ),
  );
  var a = Math.floor(meses / 12),
    m = meses % 12;
  return meses < 1
    ? "Menos de un mes"
    : a
      ? a +
        (a === 1 ? " año" : " años") +
        (m ? " y " + m + (m === 1 ? " mes" : " meses") : "")
      : m + (m === 1 ? " mes" : " meses");
}

function metricasDe(e) {
  var nombre = nombreDe(e);
  var pedidos = ESTADO.pedidos.filter(function (p) {
    return p.mesero === nombre;
  });
  var cobros = ESTADO.ventas.filter(function (v) {
    return v.cajero === nombre && !v.anulada;
  });
  var vendido = 0;
  cobros.forEach(function (v) {
    vendido += v.total + (v.propina || 0);
  });
  var turnos = ESTADO.turnos.filter(function (t) {
    return t.cajero === nombre;
  }).length;
  return {
    pedidos: pedidos.length,
    cobros: cobros.length,
    vendido: vendido,
    turnos: turnos,
    actividad: pedidos.length + cobros.length + turnos,
  };
}

// ---------- Filtros y orden ----------
function pasaFiltro(e) {
  var texto = $("u-buscar").value.trim().toLowerCase();
  if (estadoActual === "activos" && !e.activo) return false;
  if (estadoActual === "inactivos" && e.activo) return false;
  if (rolActual !== "Todos" && e.rol !== rolActual) return false;
  return (
    !texto ||
    (
      nombreDe(e) +
      " " +
      e.usuario +
      " " +
      e.numDoc +
      " " +
      e.telefono +
      " " +
      (e.correo || "")
    )
      .toLowerCase()
      .indexOf(texto) !== -1
  );
}

var VALOR_ORDEN = {
  nombre: function (x) {
    return nombreDe(x.e).toLowerCase();
  },
  rol: function (x) {
    return x.e.rol.toLowerCase();
  },
  antiguedad: function (x) {
    return x.e.ingreso;
  },
  actividad: function (x) {
    return x.m.actividad;
  },
};

function listaFiltrada() {
  return ESTADO.empleados
    .filter(pasaFiltro)
    .map(function (e) {
      return { e: e, m: metricasDe(e) };
    })
    .sort(function (a, b) {
      var f = VALOR_ORDEN[orden.clave],
        x = f(a),
        y = f(b);
      return (
        (x < y
          ? -1
          : x > y
            ? 1
            : nombreDe(a.e).localeCompare(nombreDe(b.e), "es")) * orden.dir
      );
    });
}

function widgetEmpleado(x) {
  var e = x.e,
    m = x.m;
  return (
    '<article class="widget w-empleado' +
    (e.activo ? "" : " w-apagada") +
    '" data-i="' +
    ESTADO.empleados.indexOf(e) +
    '"><div class="w-cab"><img src="icons/inicio/usuario.svg" alt=""><b>' +
    esc(e.rol).toUpperCase() +
    "</b></div>" +
    '<p class="w-valor">' +
    esc(nombreDe(e)) +
    '</p><p class="w-sub">@' +
    esc(e.usuario) +
    '</p><p class="w-sub">' +
    esc(e.tipoDoc) +
    " " +
    esc(e.numDoc) +
    "</p>" +
    '<div class="c-mini"><span><b>' +
    m.pedidos +
    "</b>pedidos</span><span><b>" +
    pesos(m.vendido) +
    "</b>cobrado</span></div>" +
    '<p class="w-sub">En el bar desde ' +
    fecha(e.ingreso) +
    '</p><p class="w-sub">' +
    antiguedad(e) +
    '</p><div class="w-pie"><span class="w-estado">' +
    (e.activo ? "Activo" : "Inactivo") +
    "</span></div></article>"
  );
}

var COLUMNAS = [
  ["nombre", "Empleado"],
  [null, "Contacto"],
  ["rol", "Rol"],
  ["antiguedad", "Ingreso"],
  [null, "Pedidos"],
  [null, "Cobrado"],
  [null, "Estado"],
];

function tablaEmpleados(lista) {
  var cab = COLUMNAS.map(function (col) {
    if (!col[0]) return "<span>" + col[1] + "</span>";
    var activa = orden.clave === col[0];
    return (
      '<button type="button" class="tg-ord" data-ord="' +
      col[0] +
      '" aria-sort="' +
      (activa ? (orden.dir === 1 ? "ascending" : "descending") : "none") +
      '">' +
      col[1] +
      "<i>" +
      (activa ? (orden.dir === 1 ? "▲" : "▼") : "") +
      "</i></button>"
    );
  }).join("");
  return (
    '<div class="tg tg-emp"><div class="tg-cab">' +
    cab +
    "</div>" +
    lista
      .map(function (x) {
        var e = x.e,
          m = x.m;
        return (
          '<div class="tg-fila" data-i="' +
          ESTADO.empleados.indexOf(e) +
          '"><span class="tg-nombre"><b>' +
          esc(nombreDe(e)) +
          "</b><small>@" +
          esc(e.usuario) +
          " · " +
          esc(e.tipoDoc) +
          " " +
          esc(e.numDoc) +
          "</small></span>" +
          '<span class="tg-dato" data-t="Contacto">' +
          esc(e.telefono) +
          "<small>" +
          esc(e.correo || "Sin correo") +
          '</small></span><span class="tg-dato" data-t="Rol">' +
          esc(e.rol) +
          "</span>" +
          '<span class="tg-dato" data-t="Ingreso">' +
          fecha(e.ingreso) +
          "<small>" +
          antiguedad(e) +
          '</small></span><span class="tg-dato tg-num" data-t="Pedidos">' +
          m.pedidos +
          '</span><span class="tg-dato tg-num" data-t="Cobrado">' +
          pesos(m.vendido) +
          "</span>" +
          '<span class="tg-dato" data-t="Estado"><em class="tg-nivel ' +
          (e.activo ? "tg-frecuente" : "tg-nuevo") +
          '">' +
          (e.activo ? "Activo" : "Inactivo") +
          "</em></span></div>"
        );
      })
      .join("") +
    "</div>"
  );
}

// ---------- Roles ----------
function widgetRol(r) {
  var n = ESTADO.empleados.filter(function (e) {
    return e.rol === r.nombre;
  }).length;
  return (
    '<article class="widget w-rol" data-r="' +
    ESTADO.roles.indexOf(r) +
    '"><div class="w-cab"><img src="icons/inicio/usuario.svg" alt=""><b>' +
    n +
    (n === 1 ? " EMPLEADO" : " EMPLEADOS") +
    "</b></div>" +
    '<p class="w-valor">' +
    esc(r.nombre) +
    '</p><p class="w-sub">' +
    esc(r.descripcion) +
    '</p><p class="w-sub">' +
    r.modulos.length +
    " de " +
    MODULOS.length +
    ' módulos</p><p class="w-sub">' +
    (r.cobra ? "Cobra al entregar" : "No cobra: lo hace la caja") +
    '</p><div class="w-pie"><span class="w-estado">' +
    activosConRol(r.nombre).length +
    " activos</span></div></article>"
  );
}

function pendientesArea() {
  return ESTADO.solicitudesArea.filter(function (s) {
    return s.estado === "Pendiente";
  });
}

function widgetSolicitud(s) {
  return (
    '<article class="widget w-solicitud"><div class="w-cab"><img src="icons/inicio/usuario.svg" alt=""><b>SOLICITUD</b></div><p class="w-valor">' +
    esc(s.persona) +
    '</p><p class="w-sub">Pide trabajar en ' +
    esc(
      AREAS_OPC.filter(function (a) {
        return a[0] === s.area;
      })[0][1],
    ) +
    '</p><p class="w-sub">' +
    esc(s.fecha) +
    "</p>" +
    '<div class="w-pie"><button type="button" class="btn-fila btn-fila-ppal" data-sol="' +
    s.n +
    ':ok">Aprobar</button><button type="button" class="btn-fila" data-sol="' +
    s.n +
    ':no">Rechazar</button></div></article>'
  );
}

function pintar() {
  var np = pendientesArea().length;
  $("u-vistas").innerHTML = [
    ["empleados", "Empleados (" + ESTADO.empleados.length + ")"],
    ["roles", "Roles y permisos (" + ESTADO.roles.length + ")"],
    ["solicitudes", "Solicitudes" + (np ? " (" + np + ")" : "")],
  ]
    .map(function (t) {
      return (
        '<button type="button" class="chip-filtro" data-v="' +
        t[0] +
        '" aria-pressed="' +
        (vistaActual === t[0]) +
        '">' +
        t[1] +
        "</button>"
      );
    })
    .join("");
  var emp = vistaActual === "empleados";
  $("u-forma").hidden = !emp;
  $("u-barra").hidden = !emp;
  $("u-roles-chips").hidden = !emp;
  $("u-nuevo").hidden = vistaActual !== "empleados";
  $("u-nuevo-rol").hidden = vistaActual !== "roles";
  if (vistaActual === "solicitudes") {
    $("u-lista").innerHTML = np
      ? '<div class="widgets">' +
        pendientesArea().map(widgetSolicitud).join("") +
        "</div>"
      : vacio("No hay solicitudes.");
    return;
  }
  if (!emp) {
    $("u-lista").innerHTML = ESTADO.roles.length
      ? '<div class="widgets">' +
        ESTADO.roles.map(widgetRol).join("") +
        "</div>"
      : vacio('Todavía no hay roles. Crea el primero con "Nuevo rol".');
    return;
  }
  $("u-forma").innerHTML = [
    ["widgets", "Widgets"],
    ["tabla", "Tabla"],
  ]
    .map(function (t) {
      return (
        '<button type="button" class="seg" data-v="' +
        t[0] +
        '" aria-pressed="' +
        (formaActual === t[0]) +
        '">' +
        t[1] +
        "</button>"
      );
    })
    .join("");
  $("u-estados").innerHTML = ESTADOS.map(function (e) {
    var n = ESTADO.empleados.filter(function (x) {
      return e[0] === "todos" || (e[0] === "activos") === x.activo;
    }).length;
    return (
      '<button type="button" class="seg" data-v="' +
      e[0] +
      '" aria-pressed="' +
      (estadoActual === e[0]) +
      '">' +
      e[1] +
      " (" +
      n +
      ")</button>"
    );
  }).join("");
  $("u-orden").innerHTML = ORDENES.map(function (o) {
    return (
      '<option value="' +
      o[0] +
      '"' +
      (orden.clave === o[0] ? " selected" : "") +
      ">" +
      o[1] +
      "</option>"
    );
  }).join("");
  var nombresRol = ESTADO.roles.map(function (r) {
    return r.nombre;
  });
  if (rolActual !== "Todos" && nombresRol.indexOf(rolActual) === -1)
    rolActual = "Todos";
  $("u-roles-chips").innerHTML = ["Todos"]
    .concat(nombresRol)
    .map(function (r) {
      var n = ESTADO.empleados.filter(function (x) {
        return r === "Todos" || x.rol === r;
      }).length;
      return (
        '<button type="button" class="chip-filtro" data-r="' +
        esc(r) +
        '" aria-pressed="' +
        (rolActual === r) +
        '">' +
        esc(r) +
        " (" +
        n +
        ")</button>"
      );
    })
    .join("");
  var lista = listaFiltrada();
  if (!lista.length) {
    $("u-lista").innerHTML = vacio(
      ESTADO.empleados.length
        ? "Ningún empleado coincide con estos filtros."
        : 'Todavía no hay empleados. Crea el primero con "Nuevo empleado".',
    );
    return;
  }
  $("u-lista").innerHTML =
    formaActual === "tabla"
      ? tablaEmpleados(lista)
      : '<div class="widgets">' + lista.map(widgetEmpleado).join("") + "</div>";
}

$("u-vistas").addEventListener("click", function (e) {
  var b = e.target.closest(".chip-filtro");
  if (b) {
    vistaActual = b.dataset.v;
    pintar();
  }
});
$("u-forma").addEventListener("click", function (e) {
  var b = e.target.closest(".seg");
  if (b) {
    formaActual = b.dataset.v;
    pintar();
  }
});
$("u-estados").addEventListener("click", function (e) {
  var b = e.target.closest(".seg");
  if (b) {
    estadoActual = b.dataset.v;
    pintar();
  }
});
$("u-roles-chips").addEventListener("click", function (e) {
  var b = e.target.closest(".chip-filtro");
  if (b) {
    rolActual = b.dataset.r;
    pintar();
  }
});
$("u-orden").addEventListener("change", function () {
  orden = {
    clave: this.value,
    dir: this.value === "actividad" || this.value === "antiguedad" ? -1 : 1,
  };
  pintar();
});
$("u-buscar").addEventListener("input", pintar);
$("u-lista").addEventListener("click", function (e) {
  var o = e.target.closest("[data-ord]");
  if (o) {
    orden = {
      clave: o.dataset.ord,
      dir: orden.clave === o.dataset.ord ? -orden.dir : 1,
    };
    pintar();
    return;
  }
  var sol = e.target.closest("[data-sol]");
  if (sol) {
    resolverSolicitud(sol.dataset.sol);
    return;
  }
  var r = e.target.closest(".w-rol");
  if (r) {
    verRol(ESTADO.roles[Number(r.dataset.r)]);
    return;
  }
  var f = e.target.closest("[data-i]");
  if (f) verEmpleado(ESTADO.empleados[Number(f.dataset.i)]);
});

// ---------- Solicitudes de otra área ----------
function resolverSolicitud(clave) {
  var p = clave.split(":"),
    s = buscarPor(ESTADO.solicitudesArea, "n", Number(p[0])),
    emp = s ? empleadoPorNombre(s.persona) : null;
  if (!s || !emp) return;
  var nombreArea = AREAS_OPC.filter(function (a) {
    return a[0] === s.area;
  })[0][1];
  if (p[1] === "ok") {
    emp.areasExtra = (emp.areasExtra || []).concat(s.area);
    s.estado = "Aprobada";
  } else s.estado = "Rechazada";
  notificar(
    [],
    "Tu solicitud para trabajar en " +
      nombreArea +
      " fue " +
      (p[1] === "ok" ? "aprobada" : "rechazada"),
    "",
    "aviso",
    [s.persona],
  );
  guardar();
  aviso(
    s.persona +
      ": " +
      nombreArea +
      (p[1] === "ok" ? " aprobada." : " rechazada."),
  );
  pintar();
}

// ---------- Detalle del empleado ----------
function dato(t, v) {
  return "<div><dt>" + t + "</dt><dd>" + v + "</dd></div>";
}

function verEmpleado(e) {
  var m = metricasDe(e),
    rol = rolPor(e.rol),
    nombre = nombreDe(e);
  abrirVentana({
    titulo: nombre,
    ancha: true,
    ayuda:
      esc(e.rol) + " · @" + esc(e.usuario) + (e.activo ? "" : " · inactivo"),
    cuerpo:
      '<h3 class="tk-sub">Actividad</h3><dl class="tk-datos">' +
      dato("Pedidos tomados", m.pedidos) +
      dato("Cobros realizados", m.cobros) +
      dato("Total cobrado", pesos(m.vendido)) +
      dato("Turnos de caja", m.turnos) +
      "</dl>" +
      '<h3 class="tk-sub">Datos</h3><dl class="tk-datos">' +
      dato("Documento", esc(e.tipoDoc) + " " + esc(e.numDoc)) +
      dato("Teléfono", esc(e.telefono)) +
      dato("Correo", e.correo ? esc(e.correo) : "—") +
      dato("Ingreso", fecha(e.ingreso)) +
      dato("Antigüedad", antiguedad(e)) +
      dato("Estado", e.activo ? "Activo" : "Inactivo") +
      "</dl>" +
      '<div><h3 class="tk-sub">Lo que puede hacer (' +
      esc(e.rol) +
      ')</h3><p class="sin-pasos">' +
      (rol
        ? esc(rol.descripcion) +
          ". Módulos: " +
          rol.modulos
            .map(function (k) {
              return MODULOS.filter(function (x) {
                return x[0] === k;
              })[0][1];
            })
            .join(", ") +
          "."
        : "El rol ya no existe.") +
      "</p></div>" +
      (e.notas
        ? '<div><h3 class="tk-sub">Notas</h3><p class="sin-pasos">' +
          esc(e.notas) +
          "</p></div>"
        : ""),
    botones: [
      {
        texto: "Editar empleado",
        primario: true,
        alClic: function (d) {
          d.close();
          formularioEmpleado(e);
        },
      },
      {
        texto: e.activo ? "Desactivar" : "Activar",
        alClic: function (d) {
          d.close();
          cambiarEstado(e);
        },
      },
      {
        texto: "Eliminar empleado",
        alClic: function (d) {
          d.close();
          eliminarEmpleado(e);
        },
      },
    ],
  });
}

// El último administrador activo y el usuario que está usando el sistema no se pueden dejar sin acceso
function motivoProtegido(e) {
  if (
    e.rol === "Administrador" &&
    e.activo &&
    activosConRol("Administrador").length === 1
  )
    return "Debe quedar al menos un administrador activo.";
  if (nombreDe(e) === usuarioActual())
    return nombreDe(e) + " es quien está usando el sistema.";
  return "";
}

function cambiarEstado(e) {
  if (e.activo && motivoProtegido(e)) {
    aviso("No se puede desactivar: " + motivoProtegido(e));
    return;
  }
  e.activo = !e.activo;
  guardar();
  aviso(
    nombreDe(e) +
      (e.activo
        ? " vuelve a estar activo."
        : " quedó inactivo: conserva su historial pero ya no cuenta como personal."),
  );
  pintar();
}

function eliminarEmpleado(e) {
  var motivo = motivoProtegido(e);
  if (motivo) {
    aviso("No se puede eliminar: " + motivo);
    return;
  }
  confirmarVentana({
    titulo: "Eliminar empleado",
    texto:
      "¿Eliminar a <b>" +
      esc(nombreDe(e)) +
      "</b>? Sus pedidos y cobros anteriores conservan su nombre. Si solo se fue del bar, mejor desactívalo.",
    boton: "Eliminar",
    alAceptar: function () {
      ESTADO.empleados.splice(ESTADO.empleados.indexOf(e), 1);
      guardar();
      aviso("Empleado eliminado.");
      pintar();
    },
  });
}

// ---------- Crear y editar empleados ----------
function formularioEmpleado(e) {
  var nuevo = !e;
  abrirFormulario({
    titulo: nuevo ? "Nuevo empleado" : "Editar empleado",
    boton: "Guardar",
    ancha: true,
    campos: [
      {
        id: "nombre",
        etiqueta: "Nombres",
        tipo: "text",
        valor: nuevo ? "" : e.nombre,
        requerido: true,
        largo: 60,
      },
      {
        id: "apellidos",
        etiqueta: "Apellidos",
        tipo: "text",
        valor: nuevo ? "" : e.apellidos,
        requerido: true,
        largo: 60,
      },
      {
        id: "tipoDoc",
        etiqueta: "Tipo de documento",
        tipo: "select",
        opciones: TIPOS_DOC.map(function (t) {
          return [t, t];
        }),
        valor: nuevo ? "CC" : e.tipoDoc,
      },
      {
        id: "numDoc",
        etiqueta: "Número de documento",
        tipo: "text",
        valor: nuevo ? "" : e.numDoc,
        requerido: true,
        largo: 20,
      },
      {
        id: "telefono",
        etiqueta: "Teléfono",
        tipo: "tel",
        valor: nuevo ? "" : e.telefono,
        requerido: true,
        largo: 10,
        placeholder: "3001234567",
      },
      {
        id: "correo",
        etiqueta: "Correo",
        tipo: "text",
        valor: nuevo ? "" : e.correo,
        largo: 100,
      },
      {
        id: "usuario",
        etiqueta: "Usuario",
        tipo: "text",
        valor: nuevo ? "" : e.usuario,
        requerido: true,
        largo: 30,
        ayuda: "De 4 a 30 caracteres: minúsculas, números o guion bajo.",
      },
      {
        id: "rol",
        etiqueta: "Rol",
        tipo: "select",
        opciones: ESTADO.roles.map(function (r) {
          return [r.nombre, r.nombre];
        }),
        valor: nuevo
          ? rolActual !== "Todos"
            ? rolActual
            : ESTADO.roles[ESTADO.roles.length - 1].nombre
          : e.rol,
      },
      {
        id: "ingreso",
        etiqueta: "Fecha de ingreso",
        tipo: "date",
        valor: nuevo ? ahoraTexto().slice(0, 10) : e.ingreso,
        requerido: true,
      },
      {
        id: "areasExtra",
        etiqueta: "Áreas adicionales",
        tipo: "multi",
        opciones: AREAS_OPC,
        valor: nuevo ? [] : e.areasExtra || [],
        ancho: true,
      },
      {
        id: "activo",
        etiqueta: "Activo (cuenta como personal del bar)",
        tipo: "check",
        valor: nuevo ? true : e.activo,
      },
      {
        id: "notas",
        etiqueta: "Notas",
        tipo: "text",
        valor: nuevo ? "" : e.notas,
        largo: 160,
        ancho: true,
        placeholder: "Horario, contacto de emergencia, observaciones…",
      },
    ],
    alGuardar: function (v) {
      v.usuario = v.usuario.toLowerCase();
      if (!/^3[0-9]{9}$/.test(v.telefono))
        return "Escribe un celular de 10 dígitos que empiece por 3.";
      if (!/^[0-9]{5,20}$/.test(v.numDoc))
        return "El documento lleva solo números, de 5 a 20 dígitos.";
      if (v.correo && !/^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(v.correo))
        return "Escribe un correo válido, por ejemplo nombre@dominio.co.";
      if (!/^[a-z0-9_]{4,30}$/.test(v.usuario))
        return "El usuario lleva de 4 a 30 caracteres: minúsculas, números o guion bajo.";
      if (v.ingreso > ahoraTexto().slice(0, 10))
        return "La fecha de ingreso no puede ser futura.";
      if (
        ESTADO.empleados.some(function (x) {
          return x !== e && x.usuario === v.usuario;
        })
      )
        return "Ya hay un empleado con ese usuario.";
      if (
        ESTADO.empleados.some(function (x) {
          return x !== e && x.tipoDoc === v.tipoDoc && x.numDoc === v.numDoc;
        })
      )
        return "Ya hay un empleado con ese documento.";
      var datos = {
        nombre: v.nombre,
        apellidos: v.apellidos,
        usuario: v.usuario,
        rol: v.rol,
        tipoDoc: v.tipoDoc,
        numDoc: v.numDoc,
        telefono: v.telefono,
        correo: v.correo,
        ingreso: v.ingreso,
        activo: v.activo,
        areasExtra: v.areasExtra,
        notas: v.notas,
      };
      if (nuevo) {
        e = datos;
        ESTADO.empleados.push(e);
      } else {
        var antes = nombreDe(e),
          despues = (v.nombre + " " + v.apellidos).trim();
        var pierdeAcceso =
          e.rol === "Administrador" &&
          (v.rol !== "Administrador" || !v.activo) &&
          e.activo &&
          activosConRol("Administrador").length === 1;
        if (pierdeAcceso)
          return "Debe quedar al menos un administrador activo.";
        if (antes !== despues) {
          ESTADO.pedidos.forEach(function (p) {
            if (p.mesero === antes) p.mesero = despues;
          });
          ESTADO.ventas.forEach(function (x) {
            if (x.cajero === antes) x.cajero = despues;
          });
          ESTADO.turnos.forEach(function (t) {
            if (t.cajero === antes) t.cajero = despues;
          });
          if (ESTADO.usuario === antes) ESTADO.usuario = despues;
        }
        Object.assign(e, datos);
      }
      guardar();
      aviso(
        (nuevo ? "Empleado creado: " : "Empleado guardado: ") +
          nombreDe(e) +
          ".",
      );
      vistaActual = "empleados";
      pintar();
    },
  });
}

// ---------- Roles ----------
function verRol(r) {
  var emp = ESTADO.empleados.filter(function (e) {
    return e.rol === r.nombre;
  });
  abrirVentana({
    titulo: r.nombre,
    ancha: true,
    ayuda: esc(r.descripcion),
    cuerpo:
      '<h3 class="tk-sub">Cobro</h3><p class="sin-pasos">' +
      (r.cobra
        ? "Puede cobrar al entregar el pedido: en Pedidos le aparece Entregado · Cobrar."
        : "No cobra: cuando el pedido se entrega, el cobro lo hace la caja.") +
      '</p><h3 class="tk-sub">Módulos que puede usar</h3><p class="sin-pasos">' +
      (r.modulos
        .map(function (k) {
          return MODULOS.filter(function (x) {
            return x[0] === k;
          })[0][1];
        })
        .join(" · ") || "Ninguno") +
      "</p>" +
      '<div><h3 class="tk-sub">Empleados con este rol (' +
      emp.length +
      ")</h3>" +
      (emp.length
        ? '<ul class="tk-intentos">' +
          emp
            .map(function (e) {
              return (
                "<li><span>" +
                (e.activo ? "Activo" : "Inactivo") +
                "</span><span>" +
                esc(nombreDe(e)) +
                " · @" +
                esc(e.usuario) +
                "</span></li>"
              );
            })
            .join("") +
          "</ul>"
        : '<p class="sin-pasos">Nadie tiene este rol todavía.</p>') +
      "</div>",
    botones: [
      {
        texto: "Editar rol",
        primario: true,
        alClic: function (d) {
          d.close();
          formularioRol(r);
        },
      },
      {
        texto: "Ver empleados",
        alClic: function (d) {
          d.close();
          vistaActual = "empleados";
          rolActual = r.nombre;
          estadoActual = "todos";
          pintar();
        },
      },
      {
        texto: "Eliminar rol",
        alClic: function (d) {
          d.close();
          eliminarRol(r);
        },
      },
    ],
  });
}

function formularioRol(r) {
  var nuevo = !r;
  abrirFormulario({
    titulo: nuevo ? "Nuevo rol" : "Editar rol",
    boton: "Guardar",
    ancha: true,
    campos: [
      {
        id: "nombre",
        etiqueta: "Nombre del rol",
        tipo: "text",
        valor: nuevo ? "" : r.nombre,
        requerido: true,
        largo: 40,
      },
      {
        id: "descripcion",
        etiqueta: "Qué puede hacer",
        tipo: "text",
        valor: nuevo ? "" : r.descripcion,
        requerido: true,
        largo: 160,
        ancho: true,
      },
      {
        id: "modulos",
        etiqueta: "Módulos que puede usar",
        tipo: "multi",
        opciones: MODULOS,
        valor: nuevo ? [] : r.modulos,
        ancho: true,
      },
      {
        id: "areas",
        etiqueta: "Áreas donde trabaja",
        tipo: "multi",
        opciones: AREAS_OPC,
        valor: nuevo ? [] : r.areas || AREAS_DEL_ROL[r.nombre] || [],
        ancho: true,
      },
      {
        id: "solicitables",
        etiqueta: "Áreas que puede pedir",
        tipo: "multi",
        opciones: AREAS_OPC,
        valor: nuevo
          ? []
          : r.solicitables || AREAS_SOLICITABLES[r.nombre] || [],
        ancho: true,
      },
      {
        id: "cobra",
        etiqueta: "Puede cobrar al entregar el pedido",
        tipo: "check",
        valor: nuevo ? false : !!r.cobra,
        ancho: true,
      },
    ],
    alGuardar: function (v) {
      if (
        ESTADO.roles.some(function (x) {
          return x !== r && x.nombre.toLowerCase() === v.nombre.toLowerCase();
        })
      )
        return "Ya existe un rol con ese nombre.";
      if (!v.modulos.length) return "Marca al menos un módulo.";
      if (!v.areas.length) return "Marca al menos un área de trabajo.";
      if (
        !nuevo &&
        r.nombre === "Administrador" &&
        v.modulos.indexOf("usuarios") === -1
      )
        return "El administrador debe poder entrar a Usuarios y roles.";
      if (nuevo) {
        r = {
          nombre: v.nombre,
          cobra: v.cobra,
          areas: v.areas,
          solicitables: v.solicitables,
          descripcion: v.descripcion,
          modulos: v.modulos,
        };
        ESTADO.roles.push(r);
      } else {
        if (r.nombre !== v.nombre)
          ESTADO.empleados.forEach(function (e) {
            if (e.rol === r.nombre) e.rol = v.nombre;
          });
        r.nombre = v.nombre;
        r.descripcion = v.descripcion;
        r.modulos = v.modulos;
        r.cobra = v.cobra;
        r.areas = v.areas;
        r.solicitables = v.solicitables;
      }
      guardar();
      aviso((nuevo ? "Rol creado: " : "Rol guardado: ") + r.nombre + ".");
      vistaActual = "roles";
      pintar();
    },
  });
}

function eliminarRol(r) {
  var n = ESTADO.empleados.filter(function (e) {
    return e.rol === r.nombre;
  }).length;
  if (n) {
    aviso(
      "No se puede eliminar " +
        r.nombre +
        ": " +
        n +
        (n === 1 ? " empleado lo tiene." : " empleados lo tienen.") +
        " Cámbiales el rol primero.",
    );
    return;
  }
  if (r.nombre === "Administrador") {
    aviso("El rol Administrador no se puede eliminar.");
    return;
  }
  confirmarVentana({
    titulo: "Eliminar rol",
    texto: "¿Eliminar el rol <b>" + esc(r.nombre) + "</b>?",
    boton: "Eliminar",
    alAceptar: function () {
      ESTADO.roles.splice(ESTADO.roles.indexOf(r), 1);
      guardar();
      aviso("Rol eliminado.");
      pintar();
    },
  });
}

$("u-nuevo").addEventListener("click", function () {
  formularioEmpleado(null);
});
$("u-nuevo-rol").addEventListener("click", function () {
  formularioRol(null);
});
pintar();
