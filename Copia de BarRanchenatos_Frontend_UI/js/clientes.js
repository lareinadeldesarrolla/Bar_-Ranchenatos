/* Clientes: personas y empresas por separado, en widgets o en tabla, con lo que consumen y cada cuánto vienen.
   Las métricas salen de las ventas, los pedidos y las reservaciones de cada cliente. */

var $ = function (id) {
  return document.getElementById(id);
};
var tipoActual = "personas";
var vistaActual = "widgets";
var estadoActual = "todos";
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
  ["si", "Autorizados"],
  ["no", "Sin autorizar"],
];
var ORDENES = [
  ["nombre", "Nombre"],
  ["consumo", "Más consumo"],
  ["pedidos", "Más pedidos"],
  ["ticket", "Ticket promedio"],
  ["reciente", "Visita más reciente"],
];
var TIPOS_DOC = ["CC", "CE", "TI", "PA", "PPT", "NIT"];
var DIA = 86400000;

function aviso(texto) {
  $("c-aviso").textContent = texto;
}
function vacio(texto) {
  return '<div class="vacio-c"><p>' + texto + "</p></div>";
}
function fecha(iso) {
  var p = iso.slice(0, 10).split("-");
  return Number(p[2]) + " " + MESES_C[Number(p[1]) - 1] + " " + p[0];
}
function aDate(texto) {
  return new Date(texto.replace(" ", "T"));
}
function nombreDe(c) {
  return (c.nombre + " " + (c.apellidos || "")).trim();
}
function documentoDe(c) {
  return c.tipoDoc ? c.tipoDoc + " " + c.numDoc : "Sin documento";
}
function esEmpresa(c) {
  return c.tipoDoc === "NIT";
}

function hace(texto) {
  var d = Math.floor((new Date() - aDate(texto)) / DIA);
  return d <= 0
    ? "hoy"
    : d === 1
      ? "ayer"
      : d < 60
        ? "hace " + d + " días"
        : "hace " + Math.round(d / 30) + " meses";
}

// Lo que ha hecho el cliente: pedidos cobrados, total consumido, ticket promedio, visitas, producto preferido, promociones y reservaciones
function metricasDe(c) {
  var nombre = nombreDe(c);
  var ventas = ESTADO.ventas
    .filter(function (v) {
      return v.cliente === nombre && !v.anulada;
    })
    .sort(function (a, b) {
      return a.fecha < b.fecha ? -1 : 1;
    });
  var m = {
    ventas: ventas,
    n: ventas.length,
    total: 0,
    promedio: 0,
    primera: "",
    ultima: "",
    cada: 0,
    favorito: "",
    promos: 0,
    reservas: ESTADO.reservas.filter(function (r) {
      return r.cliente === nombre && r.estado !== "CANCELADA";
    }).length,
  };
  var productos = {};
  ventas.forEach(function (v) {
    m.total += v.total + (v.propina || 0);
    if (v.promo) m.promos += 1;
    var p = buscarPor(ESTADO.pedidos, "n", v.pedido);
    if (p)
      p.lineas.forEach(function (l) {
        productos[l.producto] = (productos[l.producto] || 0) + l.cant;
      });
  });
  if (m.n) {
    m.promedio = Math.round(m.total / m.n);
    m.primera = ventas[0].fecha;
    m.ultima = ventas[m.n - 1].fecha;
    if (m.n > 1)
      m.cada = Math.max(
        1,
        Math.round((aDate(m.ultima) - aDate(m.primera)) / DIA / (m.n - 1)),
      );
  }
  var mejor = 0;
  Object.keys(productos).forEach(function (k) {
    if (productos[k] > mejor) {
      mejor = productos[k];
      m.favorito = k;
    }
  });
  m.nivel = !m.n
    ? "Nuevo"
    : m.n >= 6 || m.total >= 600000
      ? "VIP"
      : m.n >= 3
        ? "Frecuente"
        : "Ocasional";
  m.frecuencia = !m.n
    ? "Sin visitas"
    : m.n === 1
      ? "Una visita"
      : "Cada " + m.cada + (m.cada === 1 ? " día" : " días");
  return m;
}

function proximoCumple(c) {
  if (!c.nacimiento) return "";
  var n = c.nacimiento.split("-"),
    hoy = new Date(),
    a = new Date(hoy.getFullYear(), Number(n[1]) - 1, Number(n[2]));
  var h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (a < h0)
    a = new Date(hoy.getFullYear() + 1, Number(n[1]) - 1, Number(n[2]));
  var d = Math.round((a - h0) / DIA);
  return d === 0 ? "hoy" : "en " + d + (d === 1 ? " día" : " días");
}

// ---------- Filtros y orden ----------
function pasaFiltro(c) {
  var texto = $("c-buscar").value.trim().toLowerCase();
  if (esEmpresa(c) !== (tipoActual === "empresas")) return false;
  if (estadoActual === "si" && !c.autoriza) return false;
  if (estadoActual === "no" && c.autoriza) return false;
  return (
    !texto ||
    (nombreDe(c) + " " + c.numDoc + " " + c.telefono + " " + (c.correo || ""))
      .toLowerCase()
      .indexOf(texto) !== -1
  );
}

var VALOR_ORDEN = {
  nombre: function (x) {
    return nombreDe(x.c).toLowerCase();
  },
  consumo: function (x) {
    return x.m.total;
  },
  pedidos: function (x) {
    return x.m.n;
  },
  ticket: function (x) {
    return x.m.promedio;
  },
  reciente: function (x) {
    return x.m.ultima;
  },
};

function listaFiltrada() {
  return ESTADO.clientes
    .filter(pasaFiltro)
    .map(function (c) {
      return { c: c, m: metricasDe(c) };
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
            : nombreDe(a.c).localeCompare(nombreDe(b.c), "es")) * orden.dir
      );
    });
}

// ---------- Widgets y tabla ----------
function widgetCliente(x) {
  var c = x.c,
    m = x.m;
  return (
    '<article class="widget w-cliente' +
    (c.autoriza ? "" : " w-gris") +
    (m.nivel === "VIP" ? " w-activa" : "") +
    '" data-i="' +
    ESTADO.clientes.indexOf(c) +
    '"><div class="w-cab"><img src="icons/inicio/usuario.svg" alt=""><b>' +
    m.nivel.toUpperCase() +
    "</b></div>" +
    '<p class="w-valor">' +
    esc(nombreDe(c)) +
    '</p><p class="w-sub">' +
    esc(documentoDe(c)) +
    "</p>" +
    '<p class="w-grande">' +
    pesos(m.total) +
    '</p><p class="w-sub">consumido</p>' +
    '<div class="c-mini"><span><b>' +
    m.n +
    "</b>pedidos</span><span><b>" +
    pesos(m.promedio) +
    "</b>ticket</span></div>" +
    '<p class="w-sub">' +
    (m.n ? "Última visita " + hace(m.ultima) : "Aún no ha comprado") +
    '</p><p class="w-sub">' +
    esc(m.frecuencia) +
    "</p>" +
    '<div class="w-pie"><span class="w-estado">' +
    (c.autoriza ? "Datos autorizados" : "Sin autorizar") +
    "</span></div></article>"
  );
}

var COLUMNAS = [
  ["nombre", "Cliente"],
  [null, "Contacto"],
  ["pedidos", "Pedidos"],
  ["consumo", "Total consumido"],
  ["ticket", "Ticket promedio"],
  ["reciente", "Última visita"],
  [null, "Frecuencia"],
  [null, "Nivel"],
];

function tablaClientes(lista) {
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
    '<div class="tg"><div class="tg-cab">' +
    cab +
    "</div>" +
    lista
      .map(function (x) {
        var c = x.c,
          m = x.m;
        return (
          '<div class="tg-fila" data-i="' +
          ESTADO.clientes.indexOf(c) +
          '"><span class="tg-nombre"><b>' +
          esc(nombreDe(c)) +
          "</b><small>" +
          esc(documentoDe(c)) +
          (c.autoriza ? "" : " · sin autorizar") +
          "</small></span>" +
          '<span class="tg-dato" data-t="Contacto">' +
          esc(c.telefono) +
          "<small>" +
          esc(c.correo || "Sin correo") +
          "</small></span>" +
          '<span class="tg-dato tg-num" data-t="Pedidos">' +
          m.n +
          '</span><span class="tg-dato tg-num" data-t="Total consumido">' +
          pesos(m.total) +
          '</span><span class="tg-dato tg-num" data-t="Ticket promedio">' +
          (m.n ? pesos(m.promedio) : "—") +
          "</span>" +
          '<span class="tg-dato" data-t="Última visita">' +
          (m.n
            ? fecha(m.ultima) + "<small>" + hace(m.ultima) + "</small>"
            : "—") +
          '</span><span class="tg-dato" data-t="Frecuencia">' +
          esc(m.frecuencia) +
          "</span>" +
          '<span class="tg-dato" data-t="Nivel"><em class="tg-nivel tg-' +
          m.nivel.toLowerCase() +
          '">' +
          m.nivel +
          "</em></span></div>"
        );
      })
      .join("") +
    "</div>"
  );
}

function pintar() {
  var personas = ESTADO.clientes.filter(function (c) {
      return !esEmpresa(c);
    }).length,
    empresas = ESTADO.clientes.length - personas;
  $("c-tipos").innerHTML = [
    ["personas", "Personas (" + personas + ")"],
    ["empresas", "Empresas (" + empresas + ")"],
  ]
    .map(function (t) {
      return (
        '<button type="button" class="chip-filtro" data-v="' +
        t[0] +
        '" aria-pressed="' +
        (tipoActual === t[0]) +
        '">' +
        t[1] +
        "</button>"
      );
    })
    .join("");
  $("c-vista").innerHTML = [
    ["widgets", "Widgets"],
    ["tabla", "Tabla"],
  ]
    .map(function (t) {
      return (
        '<button type="button" class="seg" data-v="' +
        t[0] +
        '" aria-pressed="' +
        (vistaActual === t[0]) +
        '">' +
        t[1] +
        "</button>"
      );
    })
    .join("");
  $("c-estados").innerHTML = ESTADOS.map(function (e) {
    return (
      '<button type="button" class="seg" data-v="' +
      e[0] +
      '" aria-pressed="' +
      (estadoActual === e[0]) +
      '">' +
      e[1] +
      "</button>"
    );
  }).join("");
  $("c-orden").innerHTML = ORDENES.map(function (o) {
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
  var lista = listaFiltrada();
  if (!lista.length) {
    $("c-lista").innerHTML = vacio(
      ESTADO.clientes.length
        ? "Ningún cliente coincide con estos filtros."
        : 'Todavía no hay clientes. Crea el primero con "Agregar cliente".',
    );
    return;
  }
  $("c-lista").innerHTML =
    vistaActual === "tabla"
      ? tablaClientes(lista)
      : '<div class="widgets">' + lista.map(widgetCliente).join("") + "</div>";
}

$("c-tipos").addEventListener("click", function (e) {
  var b = e.target.closest(".chip-filtro");
  if (b) {
    tipoActual = b.dataset.v;
    pintar();
  }
});
$("c-vista").addEventListener("click", function (e) {
  var b = e.target.closest(".seg");
  if (b) {
    vistaActual = b.dataset.v;
    pintar();
  }
});
$("c-estados").addEventListener("click", function (e) {
  var b = e.target.closest(".seg");
  if (b) {
    estadoActual = b.dataset.v;
    pintar();
  }
});
$("c-orden").addEventListener("change", function () {
  orden = { clave: this.value, dir: this.value === "nombre" ? 1 : -1 };
  pintar();
});
$("c-buscar").addEventListener("input", pintar);
$("c-lista").addEventListener("click", function (e) {
  var o = e.target.closest("[data-ord]");
  if (o) {
    orden = {
      clave: o.dataset.ord,
      dir:
        orden.clave === o.dataset.ord
          ? -orden.dir
          : o.dataset.ord === "nombre"
            ? 1
            : -1,
    };
    pintar();
    return;
  }
  var f = e.target.closest("[data-i]");
  if (f) verCliente(ESTADO.clientes[Number(f.dataset.i)]);
});

// ---------- Detalle ----------
function dato(t, v) {
  return "<div><dt>" + t + "</dt><dd>" + v + "</dd></div>";
}

function verCliente(c) {
  var nombre = nombreDe(c),
    m = metricasDe(c),
    cumple = proximoCumple(c);
  var historial = m.ventas
    .slice()
    .reverse()
    .slice(0, 6)
    .map(function (v) {
      return (
        "<li><span>" +
        fecha(v.fecha) +
        "</span><span>Venta " +
        v.n +
        " · Mesa " +
        v.mesa +
        " · " +
        pesos(v.total + (v.propina || 0)) +
        (v.promo ? " · " + esc(v.promo) : "") +
        "</span></li>"
      );
    })
    .join("");
  abrirVentana({
    titulo: nombre,
    ancha: true,
    ayuda:
      (esEmpresa(c) ? "Empresa" : "Persona") +
      " · nivel " +
      m.nivel.toLowerCase() +
      " · cliente desde " +
      fecha(c.registro),
    cuerpo:
      '<h3 class="tk-sub">Lo que consume</h3><dl class="tk-datos">' +
      dato("Pedidos", m.n) +
      dato("Total consumido", pesos(m.total)) +
      dato("Ticket promedio", m.n ? pesos(m.promedio) : "—") +
      dato("Frecuencia", esc(m.frecuencia)) +
      dato("Primera visita", m.n ? fecha(m.primera) : "—") +
      dato(
        "Última visita",
        m.n ? fecha(m.ultima) + " (" + hace(m.ultima) + ")" : "—",
      ) +
      dato("Producto preferido", m.favorito ? esc(m.favorito) : "—") +
      dato("Promociones usadas", m.promos) +
      dato("Reservaciones", m.reservas) +
      "</dl>" +
      '<h3 class="tk-sub">Datos</h3><dl class="tk-datos">' +
      dato("Documento", esc(documentoDe(c))) +
      dato("Teléfono", esc(c.telefono)) +
      dato("Correo", c.correo ? esc(c.correo) : "—") +
      dato(
        "Nacimiento",
        c.nacimiento
          ? fecha(c.nacimiento) + (cumple ? " · cumple " + cumple : "")
          : "—",
      ) +
      dato(
        "Tratamiento de datos",
        c.autoriza ? "Autorizado" : "Sin autorizar",
      ) +
      "</dl>" +
      '<div><h3 class="tk-sub">Últimas compras</h3>' +
      (historial
        ? '<ul class="tk-intentos">' + historial + "</ul>"
        : '<p class="sin-pasos">Todavía no tiene compras.</p>') +
      "</div>",
    botones: [
      {
        texto: "Editar cliente",
        primario: true,
        alClic: function (d) {
          d.close();
          formularioCliente(c);
        },
      },
      {
        texto: c.autoriza ? "Retirar autorización" : "Registrar autorización",
        alClic: function (d) {
          d.close();
          c.autoriza = !c.autoriza;
          guardar();
          aviso(
            nombre +
              (c.autoriza
                ? " autorizó el tratamiento de sus datos."
                : " retiró la autorización del tratamiento de sus datos."),
          );
          pintar();
        },
      },
      {
        texto: "Eliminar cliente",
        alClic: function (d) {
          d.close();
          eliminarCliente(c);
        },
      },
    ],
  });
}

// ---------- Crear, editar y eliminar ----------
function formularioCliente(c) {
  var nuevo = !c;
  abrirFormulario({
    titulo: nuevo ? "Agregar cliente" : "Editar cliente",
    boton: "Guardar",
    ancha: true,
    campos: [
      {
        id: "nombre",
        etiqueta: "Nombres o razón social",
        tipo: "text",
        valor: nuevo ? "" : c.nombre,
        requerido: true,
        largo: 60,
      },
      {
        id: "apellidos",
        etiqueta: "Apellidos",
        tipo: "text",
        valor: nuevo ? "" : c.apellidos,
        largo: 60,
      },
      {
        id: "tipoDoc",
        etiqueta: "Tipo de documento",
        tipo: "select",
        opciones: [["", "Sin documento"]].concat(
          TIPOS_DOC.map(function (t) {
            return [t, t];
          }),
        ),
        valor: nuevo ? (tipoActual === "empresas" ? "NIT" : "") : c.tipoDoc,
      },
      {
        id: "numDoc",
        etiqueta: "Número de documento",
        tipo: "text",
        valor: nuevo ? "" : c.numDoc,
        largo: 20,
      },
      {
        id: "telefono",
        etiqueta: "Teléfono",
        tipo: "tel",
        valor: nuevo ? "" : c.telefono,
        requerido: true,
        largo: 10,
        placeholder: "3001234567",
      },
      {
        id: "correo",
        etiqueta: "Correo",
        tipo: "text",
        valor: nuevo ? "" : c.correo,
        largo: 100,
      },
      {
        id: "nacimiento",
        etiqueta: "Fecha de nacimiento",
        tipo: "date",
        valor: nuevo ? "" : c.nacimiento,
      },
      {
        id: "autoriza",
        etiqueta:
          "El cliente autoriza el tratamiento de sus datos personales (Ley 1581 de 2012)",
        tipo: "check",
        valor: nuevo ? false : c.autoriza,
        ancho: true,
      },
    ],
    alGuardar: function (v) {
      if (!/^3[0-9]{9}$/.test(v.telefono))
        return "Escribe un celular de 10 dígitos que empiece por 3.";
      if ((v.tipoDoc === "") !== (v.numDoc === ""))
        return "El tipo y el número de documento se escriben juntos.";
      if (v.numDoc && !/^[0-9A-Za-z]{5,20}$/.test(v.numDoc))
        return "El documento lleva de 5 a 20 letras o números, sin puntos.";
      if (v.correo && !/^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(v.correo))
        return "Escribe un correo válido, por ejemplo nombre@dominio.co.";
      if (v.nacimiento && v.nacimiento > ahoraTexto().slice(0, 10))
        return "La fecha de nacimiento no puede ser futura.";
      if (nuevo && !v.autoriza)
        return "El cliente debe autorizar el tratamiento de sus datos para registrarse.";
      var datos = {
        nombre: v.nombre,
        apellidos: v.apellidos,
        tipoDoc: v.tipoDoc,
        numDoc: v.numDoc,
        telefono: v.telefono,
        correo: v.correo,
        nacimiento: v.nacimiento,
        autoriza: v.autoriza,
      };
      if (
        ESTADO.clientes.some(function (x) {
          return (
            x !== c &&
            v.numDoc &&
            x.tipoDoc === v.tipoDoc &&
            x.numDoc === v.numDoc
          );
        })
      )
        return "Ya hay un cliente con ese documento.";
      if (nuevo) {
        c = datos;
        c.registro = ahoraTexto();
        ESTADO.clientes.push(c);
      } else {
        var antes = nombreDe(c),
          despues = (v.nombre + " " + v.apellidos).trim();
        if (antes !== despues) {
          ESTADO.reservas.forEach(function (r) {
            if (r.cliente === antes) r.cliente = despues;
          });
          ESTADO.pedidos.forEach(function (p) {
            if (p.cliente === antes) p.cliente = despues;
          });
          ESTADO.ventas.forEach(function (x) {
            if (x.cliente === antes) x.cliente = despues;
          });
          ESTADO.envios.forEach(function (x) {
            if (x.cliente === antes) x.cliente = despues;
          });
        }
        Object.assign(c, datos);
      }
      guardar();
      tipoActual = esEmpresa(c) ? "empresas" : "personas";
      aviso(
        (nuevo ? "Cliente agregado: " : "Cliente guardado: ") +
          nombreDe(c) +
          ".",
      );
      pintar();
    },
  });
}

function eliminarCliente(c) {
  confirmarVentana({
    titulo: "Eliminar cliente",
    texto:
      "¿Eliminar a <b>" +
      esc(nombreDe(c)) +
      "</b>? Sus reservaciones y compras anteriores conservan el nombre.",
    boton: "Eliminar",
    alAceptar: function () {
      ESTADO.clientes.splice(ESTADO.clientes.indexOf(c), 1);
      guardar();
      aviso("Cliente eliminado.");
      pintar();
    },
  });
}

$("c-nuevo").addEventListener("click", function () {
  formularioCliente(null);
});
pintar();
