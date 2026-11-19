/* Despacho: lo que el bar y la cocina tienen pendiente de preparar, por mesa. Al despachar un producto se descuenta su receta del inventario. */

var $ = function (id) {
  return document.getElementById(id);
};
var AREAS_DESPACHO = [
  ["bar", "Bar"],
  ["cocina", "Cocina"],
];
var pedida = (/[?&]area=(\w+)/.exec(location.search) || [])[1];
var miArea = areaElegida();
var area = pedida === "cocina" ? "cocina" : "bar";
if (miArea === "bar" || miArea === "cocina") area = miArea; // el bar y la cocina solo ven lo suyo

function pendientes(a) {
  var lista = [];
  pedidosEnCurso().forEach(function (p) {
    var lineas = [];
    p.lineas.forEach(function (l, i) {
      if (l.despacho === "Pendiente" && areaDelProducto(l.producto) === a)
        lineas.push({ i: i, l: l });
    });
    if (lineas.length) lista.push({ p: p, lineas: lineas });
  });
  return lista.sort(function (x, y) {
    return x.p.fecha < y.p.fecha ? -1 : 1;
  });
}

function aviso(texto) {
  $("d-aviso").textContent = texto;
}

function preparacionDe(nombre) {
  var prod = buscarPor(ESTADO.productos, "nombre", nombre);
  if (!prod || prod.tipo !== "PREPARADO") return "";
  var pasos = (prod.preparacion || "").split("\n").filter(function (x) {
    return x.trim();
  });
  if (!pasos.length) return "";
  return (
    '<details class="dp-prep"><summary>Cómo se prepara</summary><ol>' +
    pasos
      .map(function (x) {
        return "<li>" + esc(x) + "</li>";
      })
      .join("") +
    "</ol></details>"
  );
}

function pintar() {
  var puedeCambiar = miArea === "admin";
  $("d-areas").hidden = !puedeCambiar;
  if (puedeCambiar)
    $("d-areas").innerHTML = AREAS_DESPACHO.map(function (a) {
      var n = pendientes(a[0]).reduce(function (s, x) {
        return s + x.lineas.length;
      }, 0);
      return (
        '<button type="button" class="chip-filtro" data-area="' +
        a[0] +
        '" aria-pressed="' +
        (area === a[0]) +
        '">' +
        a[1] +
        (n ? " (" + n + ")" : "") +
        "</button>"
      );
    }).join("");
  $("d-titulo").textContent =
    "Despacho · " + (area === "cocina" ? "Cocina" : "Bar");
  var lista = pendientes(area);
  if (!lista.length) {
    $("d-lista").innerHTML =
      '<div class="vacio-c"><p>' +
      (area === "cocina" &&
      !ESTADO.productos.some(function (p) {
        return p.area === "COCINA";
      })
        ? "No hay productos de cocina en la carta. Márcalos en Productos y recetas, en Editar datos."
        : "Nada pendiente por ahora. Los pedidos nuevos aparecen aquí solos.") +
      "</p></div>";
    return;
  }
  var h = '<div class="widgets">';
  lista.forEach(function (x) {
    h +=
      '<article class="widget w-pedido"><div class="w-cab"><img src="icons/inicio/mesa_ocupada.svg" alt=""><b>MESA ' +
      x.p.mesa +
      '</b></div><p class="w-sub">Pedido ' +
      x.p.n +
      " · desde las " +
      x.p.fecha.slice(11) +
      '</p><ul class="dp-lineas">';
    x.lineas.forEach(function (y) {
      h +=
        '<li><div class="dp-fila"><span class="dp-nombre"><b>' +
        y.l.cant +
        " ×</b> " +
        esc(y.l.producto) +
        (y.l.esp ? "<small>" + esc(y.l.esp) + "</small>" : "") +
        "</span>" +
        '<button type="button" class="btn-fila btn-fila-ppal" data-despachar="' +
        x.p.n +
        ":" +
        y.i +
        '">Despachar</button></div>' +
        preparacionDe(y.l.producto) +
        "</li>";
    });
    h +=
      "</ul>" +
      (x.lineas.length > 1
        ? '<div class="w-pie"><button type="button" class="btn-fila" data-todo="' +
          x.p.n +
          '">Despachar todo (' +
          x.lineas.length +
          ")</button></div>"
        : "") +
      "</article>";
  });
  $("d-lista").innerHTML = h + "</div>";
}

function despachar(n, indices) {
  var p = buscarPor(ESTADO.pedidos, "n", n);
  var listos = [];
  indices.forEach(function (i) {
    if (p.lineas[i] && p.lineas[i].despacho === "Pendiente") {
      listos.push(p.lineas[i].cant + " × " + p.lineas[i].producto);
      despacharLinea(p, i);
    }
  });
  p.estado = estadoDePedido(p);
  // al mesero le llega el aviso para que lo entregue
  if (listos.length)
    notificar(
      ["mesas"],
      "Mesa " +
        p.mesa +
        " · " +
        (area === "cocina" ? "Cocina" : "Bar") +
        " despachó: " +
        listos.join(", ") +
        (p.estado === "Entregado" ? ". Pedido completo." : "."),
      "pedidos.html?mesa=" + p.mesa,
      "listo",
      p.mesero && p.mesero !== "—" ? [p.mesero] : [],
    );
  actualizarMesas();
  guardar();
  aviso(
    "Despachado en la mesa " +
      p.mesa +
      ". El inventario descontó lo que indica cada receta.",
  );
  pintar();
}

$("d-lista").addEventListener("click", function (e) {
  var uno = e.target.closest("[data-despachar]");
  if (uno) {
    var par = uno.dataset.despachar.split(":");
    despachar(Number(par[0]), [Number(par[1])]);
    return;
  }
  var todo = e.target.closest("[data-todo]");
  if (todo) {
    var n = Number(todo.dataset.todo);
    despachar(
      n,
      pendientes(area)
        .filter(function (x) {
          return x.p.n === n;
        })[0]
        .lineas.map(function (y) {
          return y.i;
        }),
    );
  }
});
$("d-areas").addEventListener("click", function (e) {
  var b = e.target.closest("[data-area]");
  if (b) {
    area = b.dataset.area;
    aviso("");
    pintar();
  }
});

window.alLlegarAviso = function () {
  cargar();
  pintar();
};

// Si otra pestaña cambia los pedidos, o cada medio minuto, se actualiza sola
window.addEventListener("storage", function (e) {
  if (e.key === CLAVE) {
    cargar();
    pintar();
  }
});
setInterval(function () {
  cargar();
  pintar();
}, 30000);

pintar();
