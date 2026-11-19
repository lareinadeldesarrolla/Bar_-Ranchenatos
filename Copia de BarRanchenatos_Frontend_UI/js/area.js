
var AREAS = {
  admin: { nombre: "Administrador", inicio: "inicio.html", paginas: null }, // null: todas
  ventas: {
    nombre: "Ventas",
    inicio: "reservas.html",
    paginas: [
      "reservas.html",
      "eventos.html",
      "clientes.html",
      "reportes.html",
    ],
  },
  cajera: {
    nombre: "Cajera",
    inicio: "caja.html",
    paginas: ["caja.html", "pedidos.html", "mesas.html"],
  },
  mesas: {
    nombre: "Mesas",
    inicio: "mesas.html",
    paginas: ["mesas.html", "pedidos.html", "reservas.html"],
  },
  bar: {
    nombre: "Bar",
    inicio: "despacho.html?area=bar",
    paginas: ["despacho.html", "productos.html", "inventario.html"],
  },
  cocina: {
    nombre: "Cocina",
    inicio: "despacho.html?area=cocina",
    paginas: ["despacho.html", "productos.html", "inventario.html"],
  },
};

function areaElegida() {
  try {
    var a = sessionStorage.getItem("rn_area");
    return a === "cliente" || AREAS[a] ? a : "";
  } catch (e) {
    return "";
  }
}
function rutaRaiz(ruta) {
  return location.pathname.includes("/administracion/") ? "../" + ruta : ruta;
}

function elegirArea(clave) {
  try {
    sessionStorage.setItem("rn_area", clave);
  } catch (e) {}

  if (clave === "cliente") {
    location.href = rutaRaiz("clientes/ingreso.html");
    return;
  }

  location.href = rutaRaiz(AREAS[clave].inicio);
}

function cambiarArea() {
  try {
    sessionStorage.removeItem("rn_area");
  } catch (e) {}

  location.href = rutaRaiz("administracion/acceso.html");
}

function cambiarPersona() {
  try {
    sessionStorage.removeItem("rn_area");
    sessionStorage.removeItem("rn_persona");
  } catch (e) {}

  location.href = rutaRaiz("administracion/acceso.html");
}
function personaActual() {
  try {
    return sessionStorage.getItem("rn_persona") || "";
  } catch (e) {
    return "";
  }
}

// Protección de páginas según el área seleccionada
(function () {
  var pagina = location.pathname.split("/").pop() || "index.html";

  // Páginas que no necesitan protección
  if (
    pagina === "index.html" ||
    pagina === "acceso.html" ||
    pagina === "cliente.html" ||
    pagina === "facturacion.html"
  ) {
    return;
  }

  var a = areaElegida();

  if (!a || !personaActual()) {
    location.replace(rutaRaiz("index.html"));
    return;
  }

  if (a === "cliente") {
    location.replace(rutaRaiz("clientes/ingreso.html"));
    return;
  }

  var permitidas = AREAS[a].paginas;

  if (permitidas && permitidas.indexOf(pagina) === -1) {
    location.replace(rutaRaiz(AREAS[a].inicio));
  }
})();

// Bar y cocina ven Productos e Inventario, pero no los modifican
function soloVer() {
  var a = areaElegida();
  return a === "bar" || a === "cocina";
}

// Menú lateral: solo las pantallas permitidas para cada área
document.addEventListener("DOMContentLoaded", function () {
  var a = areaElegida();

  if (!a || a === "cliente") return;

  var permitidas = AREAS[a].paginas;

  if (permitidas) {
    [].forEach.call(
      document.querySelectorAll(".sidebar .nav li"),
      function (li) {
        var enlace = li.querySelector("a");
        var destino = enlace
          ? enlace.getAttribute("href").split("?")[0]
          : "";

        if (permitidas.indexOf(destino) === -1) {
          li.hidden = true;
        }
      }
    );

    [].forEach.call(
      document.querySelectorAll(".sidebar .nav-label"),
      function (et) {
        var lista = et.nextElementSibling;

        if (lista && !lista.querySelector("li:not([hidden])")) {
          et.hidden = true;
          lista.hidden = true;
        }
      }
    );

    // Organizar las pantallas según el orden del área
    var primera = null;

    permitidas.forEach(function (destino) {
      [].forEach.call(
        document.querySelectorAll(".sidebar .nav li"),
        function (li) {
          var enlace = li.querySelector("a");

          if (
            enlace &&
            enlace.getAttribute("href").split("?")[0] === destino &&
            !li.hidden
          ) {
            if (!primera) primera = li.parentNode;
            primera.appendChild(li);
          }
        }
      );
    });

    [].forEach.call(
      document.querySelectorAll(".sidebar .nav-label"),
      function (et) {
        et.hidden = true;
      }
    );

    [].forEach.call(
      document.querySelectorAll(".sidebar .nav"),
      function (ul) {
        ul.hidden = !ul.querySelector("li:not([hidden])");
      }
    );

    var despacho = document.querySelector(
      '.sidebar a[href="despacho.html"]'
    );

    if (despacho && (a === "bar" || a === "cocina")) {
      despacho.setAttribute("href", "despacho.html?area=" + a);
    }

    if (soloVer()) {
      document.body.classList.add("solo-ver");
    }
  } else {
    // El administrador ve todas las pantallas
    var d = document.querySelector(
      '.sidebar a[href="despacho.html"]'
    );

    if (d) {
      d.setAttribute("href", "despacho.html?area=bar");
    }
  }

  // Información de la persona y botón para cambiar de área
  var caja = document.querySelector(".sidebar .userbox");

  if (caja) {
    var nombre = caja.querySelector("strong");

    if (nombre) {
      nombre.textContent = personaActual();

      if (nombre.nextSibling && nombre.nextSibling.nodeType === 3) {
        nombre.nextSibling.textContent = "Área: " + AREAS[a].nombre;
      }
    }

    [].forEach.call(
      caja.querySelectorAll("#btn-tema, #btn-reiniciar"),
      function (x) {
        x.remove();
      }
    );

    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sm";
    b.textContent = "Cambiar de área";
    b.addEventListener("click", cambiarArea);

    caja.appendChild(b);
  }
});

// Alertas y notificaciones entre áreas
document.addEventListener("DOMContentLoaded", function () {
  var a = areaElegida();

  if (!a || a === "cliente" || typeof ESTADO === "undefined") {
    return;
  }

  var s = document.createElement("script");
  s.src = rutaRaiz("js/avisos.js");

  document.body.appendChild(s);
});