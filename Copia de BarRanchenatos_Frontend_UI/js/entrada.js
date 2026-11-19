var AREA_TEXTO = {
  mesas: [
    "mesa_ocupada",
    "Mesas",
    "Tomar pedidos, ver las mesas y las reservaciones",
  ],
  bar: ["en_preparacion", "Bar", "Preparar y despachar las bebidas"],
  cocina: ["listo", "Cocina", "Preparar y despachar la comida"],
  cajera: ["efectivo", "Cajera", "Cobrar y cerrar la caja"],
  ventas: ["reportes", "Ventas", "Reservaciones, eventos y clientes"],
  admin: ["usuario", "Administrador", "Todo el sistema"],
};
var ORDEN_AREAS = ["mesas", "bar", "cocina", "cajera", "ventas", "admin"];
var $ = function (id) {
  return document.getElementById(id);
};

function tarjeta(clave, icono, titulo, texto, extra) {
  return (
    '<button type="button" class="area-card' +
    (extra || "") +
    '" data-clave="' +
    esc(clave) +
    '"><img src="icons/inicio/' +
    icono +
    '.svg" alt=""><b>' +
    esc(titulo) +
    "</b><span>" +
    esc(texto) +
    "</span></button>"
  );
}
function esc(t) {
  return String(t).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function pasoPersona() {
  $("en-titulo").textContent = "¿Quién eres?";
  $("en-ayuda").textContent =
    "Demostración frontend: elige un usuario de ejemplo. No autentica ni protege datos reales.";
  var activos = ESTADO.empleados.filter(function (e) {
    return e.activo;
  });
  $("en-lista").innerHTML =
    activos
      .map(function (e) {
        return tarjeta(
          "p:" + e.nombre + " " + e.apellidos,
          "usuario",
          (e.nombre + " " + e.apellidos).trim(),
          e.rol,
        );
      })
      .join("") +
    tarjeta(
      "cliente",
      "nuevo_pedido",
      "Cliente",
      "Ver la carta, pedir y reservar",
      " area-cliente",
    );
  $("en-pie").innerHTML = "";
}

// Paso 2: dónde vas a trabajar hoy (solo lo que tu rol permite)
function pasoArea(persona) {
  var emp = empleadoPorNombre(persona);
  if (!emp) {
    cambiarPersona();
    return;
  }
  var permitidas = ORDEN_AREAS.filter(function (a) {
    return areasPermitidas(emp).indexOf(a) !== -1;
  });
  if (permitidas.length === 1 && !areasSolicitables(emp).length) {
    elegirArea(permitidas[0]);
    return;
  }
  $("en-titulo").textContent = "¿Dónde vas a trabajar hoy?";
  $("en-ayuda").textContent = persona;
  $("en-lista").innerHTML = permitidas
    .map(function (a) {
      return tarjeta(
        "a:" + a,
        AREA_TEXTO[a][0],
        AREA_TEXTO[a][1],
        AREA_TEXTO[a][2],
      );
    })
    .join("");
  var pedir = areasSolicitables(emp);
  $("en-pie").innerHTML =
    (pedir.length
      ? '<button type="button" class="btn" data-pedir>Pedir otra área</button>'
      : "") + '<button type="button" class="btn" data-otra>No soy yo</button>';
}

function pedirArea(persona, emp) {
  var pedir = areasSolicitables(emp);
  $("en-titulo").textContent = "Pedir otra área";
  $("en-ayuda").textContent = "El administrador lo aprueba.";
  $("en-lista").innerHTML = pedir
    .map(function (a) {
      return tarjeta(
        "s:" + a,
        AREA_TEXTO[a][0],
        AREA_TEXTO[a][1],
        AREA_TEXTO[a][2],
      );
    })
    .join("");
  $("en-pie").innerHTML =
    '<button type="button" class="btn" data-volver>Regresar</button>';
}

function enviarSolicitud(persona, area) {
  var ya = ESTADO.solicitudesArea.some(function (s) {
    return s.persona === persona && s.area === area && s.estado === "Pendiente";
  });
  if (!ya) {
    var n = 0;
    ESTADO.solicitudesArea.forEach(function (s) {
      n = Math.max(n, s.n);
    });
    ESTADO.solicitudesArea.push({
      n: n + 1,
      persona: persona,
      area: area,
      fecha: ahoraTexto(),
      estado: "Pendiente",
    });
    notificar(
      ["admin"],
      persona + " pide trabajar en " + AREA_TEXTO[area][1],
      "usuarios.html",
      "aviso",
    );
    guardar();
  }
  $("en-titulo").textContent = "Solicitud enviada";
  $("en-ayuda").textContent = AREA_TEXTO[area][1];
  $("en-lista").innerHTML = "";
  $("en-pie").innerHTML =
    '<button type="button" class="btn" data-volver>Regresar</button>';
}

$("en-lista").addEventListener("click", function (e) {
  var b = e.target.closest("[data-clave]");
  if (!b) return;
  var c = b.dataset.clave,
    persona = personaActual();
  if (c === "cliente") {
    elegirArea("cliente");
    return;
  }
  if (c.indexOf("p:") === 0) {
    try {
      sessionStorage.setItem("rn_persona", c.slice(2));
    } catch (x) {
      /* sin sesión */
    }
    pasoArea(c.slice(2));
    return;
  }
  if (c.indexOf("a:") === 0) {
    elegirArea(c.slice(2));
    return;
  }
  if (c.indexOf("s:") === 0) enviarSolicitud(persona, c.slice(2));
});
$("en-pie").addEventListener("click", function (e) {
  var persona = personaActual();
  if (e.target.closest("[data-otra]")) {
    cambiarPersona();
    return;
  }
  if (e.target.closest("[data-pedir]")) {
    pedirArea(persona, empleadoPorNombre(persona));
    return;
  }
  if (e.target.closest("[data-volver]")) pasoArea(persona);
});

if (personaActual()) pasoArea(personaActual());
else pasoPersona();
