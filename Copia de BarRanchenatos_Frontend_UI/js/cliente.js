/* Vista del cliente: la carta del bar y una solicitud de reservación. No necesita contraseña ni muestra nada interno. */

var $ = function (id) {
  return document.getElementById(id);
};
var vistaCliente = "carta";
var catCliente = "Todos";
var MINUTOS_ENTRE_RESERVAS = 120;
var carrito = {}; // nombre del producto -> cantidad (el pedido que arma el cliente desde la carta)
var abonoPct = POLITICA_RESERVA.abonoMinimo; // 30, 50, 100 o 0 (otro valor)
var metodoAbono = "";

$("cl-salir").addEventListener("click", cambiarArea);

// ---------- Pestañas ----------
function pintarTabs() {
  var n = unidadesPedido();
  $("cl-tabs").innerHTML = [
    ["carta", "Carta"],
    ["ahora", "Pedir ahora" + (n ? " (" + n + ")" : "")],
    ["reservar", "Reservar y pedir" + (n ? " (" + n + ")" : "")],
  ]
    .map(function (t) {
      return (
        '<button type="button" class="chip-filtro chip-cat" data-v="' +
        t[0] +
        '" aria-pressed="' +
        (vistaCliente === t[0]) +
        '">' +
        t[1] +
        "</button>"
      );
    })
    .join("");
  $("cl-carta").hidden = vistaCliente !== "carta";
  $("cl-ahora").hidden = vistaCliente !== "ahora";
  $("cl-reservar").hidden = vistaCliente !== "reservar";
  pintarBarraPedido();
  if (vistaCliente === "reservar") pintarPedido();
  if (vistaCliente === "ahora") pintarAhora();
}
$("cl-tabs").addEventListener("click", function (e) {
  var b = e.target.closest("[data-v]");
  if (b) {
    vistaCliente = b.dataset.v;
    pintarTabs();
  }
});

// ---------- Pedido anticipado (carrito) ----------
function productoPor(nombre) {
  return buscarPor(ESTADO.productos, "nombre", nombre);
}
function unidadesPedido() {
  var n = 0;
  Object.keys(carrito).forEach(function (k) {
    n += carrito[k];
  });
  return n;
}
function pedidoArmado() {
  return {
    lineas: Object.keys(carrito).map(function (k) {
      var p = productoPor(k);
      return {
        producto: k,
        cant: carrito[k],
        precio: p.precio,
        iva: p.iva,
        imp: claveImp(p),
      };
    }),
  };
}
function totalPedido() {
  return unidadesPedido() ? totalesDe(pedidoArmado(), 0) : null;
}
function abonoMinimo() {
  var t = totalPedido();
  return t
    ? Math.ceil((t.total * POLITICA_RESERVA.abonoMinimo) / 100 / 100) * 100
    : 0;
}

function selectorCantidad(p) {
  var n = carrito[p.nombre] || 0;
  return (
    '<div class="cl-cant" data-p="' +
    esc(p.nombre) +
    '"><button type="button" data-d="-1" aria-label="Quitar uno"' +
    (n ? "" : " disabled") +
    ">−</button><b>" +
    n +
    '</b><button type="button" data-d="1" aria-label="Agregar uno">+</button></div>'
  );
}

function cambiarCantidad(nombre, d) {
  var p = productoPor(nombre);
  var n = Math.max(0, (carrito[nombre] || 0) + d);
  if (d > 0 && p.receta.length && n > disponibleDe(p)) {
    n = carrito[nombre] || 0;
  }
  if (n) carrito[nombre] = n;
  else delete carrito[nombre];
}

function pintarBarraPedido() {
  var n = unidadesPedido(),
    t = totalPedido();
  $("cl-barra-pedido").hidden = !n || vistaCliente !== "carta";
  if (n)
    $("cl-barra-pedido").innerHTML =
      "<span><b>" +
      n +
      (n === 1 ? " producto" : " productos") +
      "</b> · " +
      pesos(t.total) +
      '</span><button type="button" class="btn btn-primary" id="cl-ir-ahora">Pedir ahora</button><button type="button" class="btn" id="cl-ir-reservar">Reservar y abonar</button>';
}
$("cl-barra-pedido").addEventListener("click", function (e) {
  var destino = e.target.closest("#cl-ir-reservar")
    ? "reservar"
    : e.target.closest("#cl-ir-ahora")
      ? "ahora"
      : "";
  if (destino) {
    vistaCliente = destino;
    pintarTabs();
    window.scrollTo(0, 0);
  }
});

$("cl-lista").addEventListener("click", function (e) {
  var b = e.target.closest(".cl-cant button");
  if (!b) return;
  cambiarCantidad(b.closest(".cl-cant").dataset.p, Number(b.dataset.d));
  var y = window.scrollY;
  pintarCarta();
  pintarTabs();
  window.scrollTo(0, y);
});

// La lista del pedido con su total, igual en "Pedir ahora" y en "Reservar y pedir"
function listaPedidoHtml(t) {
  return (
    '<h3 class="cl-sub">Tu pedido</h3><ul class="cl-lineas">' +
    Object.keys(carrito)
      .map(function (k) {
        var p = productoPor(k);
        return (
          '<li data-p="' +
          esc(k) +
          '"><span>' +
          esc(k) +
          '</span><span class="cl-cant"><button type="button" data-d="-1" aria-label="Quitar uno">−</button><b>' +
          carrito[k] +
          '</b><button type="button" data-d="1" aria-label="Agregar uno">+</button></span><b class="cl-v">' +
          pesos(carrito[k] * p.precio) +
          "</b></li>"
        );
      })
      .join("") +
    '</ul><dl class="cl-totales"><div><dt>Subtotal</dt><dd>' +
    pesos(t.subtotal) +
    "</dd></div>" +
    t.detalle
      .map(function (i) {
        return (
          "<div><dt>" +
          esc(i.nombre) +
          " " +
          i.porcentaje +
          " %</dt><dd>" +
          pesos(i.valor) +
          "</dd></div>"
        );
      })
      .join("") +
    '<div class="cl-gran"><dt>Total del pedido</dt><dd>' +
    pesos(t.total) +
    "</dd></div></dl>"
  );
}

// El pedido dentro del formulario de reserva, con su total y el abono
function pintarPedido() {
  var t = totalPedido();
  if (!t) {
    $("cl-pedido").innerHTML =
      '<p class="cl-ayuda">¿Quieres dejar tu pedido listo? Agrégalo desde la <button type="button" class="enlace" id="cl-ver-carta">carta</button> y asegúralo con un abono del ' +
      POLITICA_RESERVA.abonoMinimo +
      " % o más. Si solo reservas, no necesitas abonar.</p>";
    $("cl-abono").hidden = true;
    return;
  }
  $("cl-pedido").innerHTML = listaPedidoHtml(t);
  $("cl-abono").hidden = false;
  var min = abonoMinimo();
  $("cl-abono-ayuda").textContent =
    "El abono mínimo es del " +
    POLITICA_RESERVA.abonoMinimo +
    " % de tu pedido (" +
    pesos(min) +
    "). Puedes abonar más; lo que abones se descuenta de tu cuenta cuando llegues.";
  $("cl-abono-pct").innerHTML = [
    [POLITICA_RESERVA.abonoMinimo, POLITICA_RESERVA.abonoMinimo + " %"],
    [50, "50 %"],
    [100, "100 %"],
    [0, "Otro valor"],
  ]
    .map(function (o) {
      var v = o[0]
        ? Math.max(min, Math.ceil((t.total * o[0]) / 100 / 100) * 100)
        : 0;
      return (
        '<button type="button" class="chip-res" role="radio" data-pct="' +
        o[0] +
        '" aria-pressed="' +
        (abonoPct === o[0]) +
        '">' +
        o[1] +
        (o[0] ? " · " + pesos(Math.min(v, t.total)) : "") +
        "</button>"
      );
    })
    .join("");
  $("cl-abono-otro").hidden = abonoPct !== 0;
  $("cl_abono_valor").min = min;
  $("cl_abono_valor").max = t.total;
  var metodos = ESTADO.metodos.filter(function (m) {
    return m.referencia && m.activo !== false;
  });
  if (
    !metodoAbono ||
    !metodos.some(function (m) {
      return m.nombre === metodoAbono;
    })
  )
    metodoAbono = metodos[0] ? metodos[0].nombre : "";
  $("cl-abono-metodos").innerHTML = metodos
    .map(function (m) {
      return (
        '<button type="button" class="chip-res" role="radio" data-m="' +
        esc(m.nombre) +
        '" aria-pressed="' +
        (metodoAbono === m.nombre) +
        '">' +
        esc(m.nombre) +
        "</button>"
      );
    })
    .join("");
  actualizarPolitica();
}

function abonoElegido() {
  var t = totalPedido();
  if (!t) return 0;
  if (abonoPct === 0) return Math.round(Number($("cl_abono_valor").value) || 0);
  return Math.min(
    t.total,
    Math.max(abonoMinimo(), Math.ceil((t.total * abonoPct) / 100 / 100) * 100),
  );
}

function actualizarPolitica() {
  var a = abonoElegido(),
    pen = Math.round((a * POLITICA_RESERVA.penalizacion) / 100);
  $("cl-politica").innerHTML =
    "Abonas <b>" +
    pesos(a) +
    "</b>. Si no asistes, retenemos el " +
    POLITICA_RESERVA.penalizacion +
    " % del abono (<b>" +
    pesos(pen) +
    "</b>) y te devolvemos el resto (" +
    pesos(a - pen) +
    "). Si cancelas con tiempo, avísanos y lo hablamos.";
}

$("cl-reservar").addEventListener("click", function (e) {
  if (e.target.closest("#cl-ver-carta")) {
    vistaCliente = "carta";
    pintarTabs();
    return;
  }
  var c = e.target.closest(".cl-lineas .cl-cant button");
  if (c) {
    cambiarCantidad(c.closest("li").dataset.p, Number(c.dataset.d));
    pintarTabs();
    pintarCarta();
    return;
  }
  var pct = e.target.closest("[data-pct]");
  if (pct) {
    abonoPct = Number(pct.dataset.pct);
    pintarPedido();
    return;
  }
  var m = e.target.closest("[data-m]");
  if (m) {
    metodoAbono = m.dataset.m;
    pintarPedido();
  }
});
$("cl_abono_valor").addEventListener("input", actualizarPolitica);

// ---------- Pedir ahora (el cliente ya está en el bar) ----------
function pintarAhora() {
  var t = totalPedido(),
    actual = $("ah_mesa").value;
  $("ah_mesa").innerHTML =
    '<option value="">Elige tu mesa</option>' +
    ESTADO.mesas
      .filter(function (m) {
        return m.estado !== "Inactiva";
      })
      .map(function (m) {
        return (
          '<option value="' +
          m.n +
          '"' +
          (String(m.n) === actual ? " selected" : "") +
          ">Mesa " +
          m.n +
          (m.ubicacion ? " · " + esc(m.ubicacion) : "") +
          "</option>"
        );
      })
      .join("");
  $("cl-ahora-pedido").innerHTML = t
    ? listaPedidoHtml(t)
    : '<p class="cl-ayuda">Todavía no has elegido nada. Agrega productos desde la <button type="button" class="enlace" id="cl-ahora-carta">carta</button>.</p>';
  $("cl-ahora-enviar").disabled = !t;
}
$("cl-ahora").addEventListener("click", function (e) {
  if (e.target.closest("#cl-ahora-carta")) {
    vistaCliente = "carta";
    pintarTabs();
    return;
  }
  var c = e.target.closest(".cl-lineas .cl-cant button");
  if (c) {
    cambiarCantidad(c.closest("li").dataset.p, Number(c.dataset.d));
    pintarTabs();
    pintarCarta();
  }
});

$("cl-ahora-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var error = function (t) {
    $("cl-ahora-error").textContent = t;
  };
  error("");
  var mesa = Number($("ah_mesa").value);
  if (!mesa) return error("Elige la mesa donde estás.");
  if (!unidadesPedido()) return error("Agrega al menos un producto.");
  var lineas = pedidoArmado().lineas;
  for (var i = 0; i < lineas.length; i++) {
    var p = productoPor(lineas[i].producto);
    if (p.receta.length && disponibleDe(p) < lineas[i].cant)
      return error(
        "Ya no queda suficiente " + lineas[i].producto + ". Ajusta tu pedido.",
      );
  }
  var pedido = pedidoDeMesa(mesa);
  if (!pedido) {
    var n = 0;
    ESTADO.pedidos.forEach(function (x) {
      n = Math.max(n, x.n);
    });
    pedido = {
      n: n + 1,
      mesa: mesa,
      mesero: "—",
      cliente: $("ah_nombre").value.trim() || "—",
      canal: "App",
      fecha: ahoraTexto(),
      estado: "Abierto",
      venta: 0,
      lineas: [],
    };
    ESTADO.pedidos.push(pedido);
  }
  lineas.forEach(function (l) {
    var igual = pedido.lineas.filter(function (x) {
      return (
        x.producto === l.producto && x.despacho === "Pendiente" && x.esp === ""
      );
    })[0];
    if (igual) igual.cant += l.cant;
    else
      pedido.lineas.push({
        producto: l.producto,
        cant: l.cant,
        precio: l.precio,
        iva: l.iva,
        imp: l.imp,
        esp: "",
        despacho: "Pendiente",
      });
  });
  pedido.estado = estadoDePedido(pedido);
  actualizarMesas();
  var quien = $("ah_nombre").value.trim();
  ["bar", "cocina"].forEach(function (a) {
    var de = lineas.filter(function (l) {
      return areaDelProducto(l.producto) === a;
    });
    if (de.length)
      notificar(
        [a],
        "Mesa " +
          mesa +
          " (app" +
          (quien ? ", " + quien : "") +
          "): " +
          de
            .map(function (l) {
              return l.cant + " × " + l.producto;
            })
            .join(", "),
        "despacho.html?area=" + a,
        "comanda",
      );
  });
  notificar(
    ["mesas", "cajera"],
    "Pedido de la app en la mesa " +
      mesa +
      (quien ? " (" + quien + ")" : "") +
      ": " +
      lineas
        .map(function (l) {
          return l.cant + " × " + l.producto;
        })
        .join(", "),
    "pedidos.html?mesa=" + mesa,
    "cliente",
  );
  if (!guardar())
    return error(
      "No se pudo enviar el pedido en este navegador. Inténtalo de nuevo.",
    );
  var total = totalPedido().total;
  carrito = {};
  pintarCarta();
  pintarTabs();
  $("cl-ahora-form").hidden = true;
  $("cl-ahora-listo").hidden = false;
  $("cl-ahora-listo").innerHTML =
    "<h2>¡Pedido enviado!</h2><p>Tu pedido de <b>" +
    pesos(total) +
    "</b> ya está en la barra y la cocina. Te lo llevan a la <b>mesa " +
    mesa +
    '</b>.</p><p>Lo pagas al final, con el mesero o en la caja.</p><button type="button" class="btn" id="cl-ahora-otro">Pedir algo más</button>';
});
// Llamar al mesero o pedir la cuenta desde la mesa
function avisarMesa(que) {
  var mesa = Number($("ah_mesa").value),
    error = $("cl-ahora-error");
  if (!mesa) {
    error.textContent = "Elige tu mesa.";
    return;
  }
  error.textContent = "";
  var p = pedidoDeMesa(mesa),
    mesero = p && p.mesero && p.mesero !== "—" ? [p.mesero] : [];
  if (que === "cuenta") {
    notificar(
      ["mesas"],
      "La mesa " + mesa + " pide la cuenta",
      "mesas.html",
      "aviso",
      mesero,
    );
    notificar(
      ["cajera"],
      "La mesa " + mesa + " pide la cuenta",
      "caja.html",
      "aviso",
    );
  } else
    notificar(
      ["mesas"],
      "La mesa " + mesa + " llama al mesero",
      "pedidos.html?mesa=" + mesa,
      "aviso",
      mesero,
    );
  guardar();
  $("cl-ahora-aviso").textContent =
    que === "cuenta"
      ? "Ya avisamos a caja. Enseguida te la llevan."
      : "Ya avisamos al mesero.";
}
$("cl-llamar").addEventListener("click", function () {
  avisarMesa("mesero");
});
$("cl-cuenta").addEventListener("click", function () {
  avisarMesa("cuenta");
});

$("cl-ahora-listo").addEventListener("click", function (e) {
  if (!e.target.closest("#cl-ahora-otro")) return;
  $("cl-ahora-form").hidden = false;
  $("cl-ahora-listo").hidden = true;
  vistaCliente = "carta";
  pintarTabs();
});

// ---------- Carta ----------
function enCarta() {
  return ESTADO.productos.filter(function (p) {
    return p.activo !== false;
  });
}

function pintarCarta() {
  var texto = $("cl-buscar").value.trim().toLowerCase();
  var cats = [];
  enCarta().forEach(function (p) {
    if (cats.indexOf(p.cat) === -1) cats.push(p.cat);
  });
  $("cl-cats").innerHTML = ["Todos"]
    .concat(cats)
    .map(function (c) {
      return (
        '<button type="button" class="chip-filtro" data-cat="' +
        esc(c) +
        '" aria-pressed="' +
        (catCliente === c) +
        '">' +
        esc(c) +
        "</button>"
      );
    })
    .join("");
  var lista = enCarta().filter(function (p) {
    return (
      (catCliente === "Todos" || p.cat === catCliente) &&
      (!texto || p.nombre.toLowerCase().indexOf(texto) !== -1)
    );
  });
  if (!lista.length) {
    $("cl-lista").innerHTML =
      '<p class="cl-vacio">No encontramos productos con esa búsqueda.</p>';
    return;
  }
  var h = "";
  cats.forEach(function (c) {
    var de = lista.filter(function (p) {
      return p.cat === c;
    });
    if (!de.length) return;
    h +=
      '<h3 class="grupo-w">' +
      esc(c) +
      '</h3><div class="widgets">' +
      de
        .map(function (p) {
          var foto = fotoDe(p);
          var agotado = p.receta.length && disponibleDe(p) === 0;
          return (
            '<article class="widget w-carta' +
            (agotado ? " w-apagada" : "") +
            '">' +
            (foto
              ? '<div class="w-foto"><img src="' +
                esc(foto) +
                '" alt="' +
                esc(p.nombre) +
                '"></div>'
              : "") +
            '<p class="w-valor">' +
            esc(p.nombre) +
            '</p><p class="w-sub cl-precio">' +
            pesos(p.precio) +
            "</p>" +
            (agotado
              ? '<p class="w-estado">Agotado por hoy</p>'
              : selectorCantidad(p)) +
            "</article>"
          );
        })
        .join("") +
      "</div>";
  });
  $("cl-lista").innerHTML = h;
  var usados = [];
  ESTADO.productos.forEach(function (p) {
    var k = claveImp(p);
    if (p.activo !== false && impuestoCobrable(k) && usados.indexOf(k) === -1)
      usados.push(k);
  });
  $("cl-nota").textContent = usados.length
    ? "Los precios no incluyen " +
      usados
        .map(function (k) {
          return etiquetaImp(k).toLowerCase();
        })
        .join(" ni ") +
      ", que se agrega en la cuenta (los productos exentos o excluidos no lo llevan)."
    : "";
}
$("cl-cats").addEventListener("click", function (e) {
  var b = e.target.closest("[data-cat]");
  if (b) {
    catCliente = b.dataset.cat;
    pintarCarta();
  }
});
$("cl-buscar").addEventListener("input", pintarCarta);

// ---------- Reservar ----------
function hoyLocal() {
  var d = new Date();
  var dos = function (n) {
    return (n < 10 ? "0" : "") + n;
  };
  return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate());
}
function minutos(hora) {
  var p = hora.split(":");
  return Number(p[0]) * 60 + Number(p[1]);
}
function vigente(r) {
  return r.estado === "PENDIENTE" || r.estado === "CONFIRMADA";
}

// La mesa libre más justa para esas personas: activa, con puestos suficientes y sin otra reservación cerca de esa hora
function mesaLibre(fecha, hora, personas) {
  var libres = ESTADO.mesas.filter(function (m) {
    if (m.estado === "Inactiva" || m.capacidad < personas) return false;
    return !ESTADO.reservas.some(function (r) {
      return (
        vigente(r) &&
        r.mesa === m.n &&
        r.fecha === fecha &&
        Math.abs(minutos(r.hora) - minutos(hora)) < MINUTOS_ENTRE_RESERVAS
      );
    });
  });
  libres.sort(function (a, b) {
    return a.capacidad - b.capacidad || a.n - b.n;
  });
  return libres[0] || null;
}

function textoFecha(iso) {
  var meses = [
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
  var p = iso.split("-");
  return Number(p[2]) + " de " + meses[Number(p[1]) - 1];
}

var form = $("cl-form");
form.fecha.min = hoyLocal();
form.fecha.value = hoyLocal();

form.addEventListener("submit", function (e) {
  e.preventDefault();
  var error = function (t, campo) {
    $("cl-error").textContent = t;
    if (campo) campo.focus();
  };
  error("");
  var nombre = form.nombre.value.trim(),
    tel = form.telefono.value.replace(/\D/g, ""),
    personas = Number(form.personas.value),
    fecha = form.fecha.value,
    hora = form.hora.value;
  if (!nombre) return error("Escribe tu nombre.", form.nombre);
  if (tel.length < 7)
    return error(
      "Escribe un teléfono para poder confirmarte la reservación.",
      form.telefono,
    );
  if (!(personas >= 1 && personas <= 30))
    return error("Las personas deben ser entre 1 y 30.", form.personas);
  if (!fecha || fecha < hoyLocal())
    return error("Elige una fecha de hoy en adelante.", form.fecha);
  if (!hora) return error("Elige la hora.", form.hora);
  if (fecha === hoyLocal()) {
    var ahora = new Date();
    if (minutos(hora) <= ahora.getHours() * 60 + ahora.getMinutes())
      return error("Esa hora ya pasó. Elige una hora más tarde.", form.hora);
  }
  var t = totalPedido(),
    abono = 0;
  if (t) {
    abono = abonoElegido();
    if (abono < abonoMinimo())
      return error(
        "El abono mínimo es del " +
          POLITICA_RESERVA.abonoMinimo +
          " % de tu pedido: " +
          pesos(abonoMinimo()) +
          ".",
        $("cl_abono_valor"),
      );
    if (abono > t.total)
      return error(
        "El abono no puede ser mayor que el total del pedido (" +
          pesos(t.total) +
          ").",
        $("cl_abono_valor"),
      );
    if (!metodoAbono) return error("Elige cómo pagas el abono.");
    if (!$("cl_abono_ref").value.trim())
      return error(
        "Escribe el número de transacción de tu abono para que podamos verificarlo.",
        $("cl_abono_ref"),
      );
    if (!$("cl_acepta").checked)
      return error(
        "Para continuar acepta la política de abono y penalización.",
      );
  }
  var mesa = mesaLibre(fecha, hora, personas);
  if (!mesa)
    return error(
      "No hay mesa disponible a esa hora para " +
        personas +
        (personas === 1 ? " persona" : " personas") +
        ". Prueba otra hora u otro día.",
    );
  var n = 0;
  ESTADO.reservas.forEach(function (r) {
    n = Math.max(n, r.n);
  });
  ESTADO.reservas.push({
    n: n + 1,
    fecha: fecha,
    hora: hora,
    mesa: mesa.n,
    personas: personas,
    cliente: nombre,
    telefono: tel,
    tipo: "MESA",
    evento: "",
    empleado: "",
    comprobante: "",
    obs: form.obs.value.trim(),
    estado: "PENDIENTE",
    anticipo: t
      ? {
          monto: abono,
          metodo: metodoAbono,
          ref: $("cl_abono_ref").value.trim(),
          estado: "Pendiente",
        }
      : { monto: 0, metodo: "", ref: "", estado: "Sin anticipo" },
    preorden: t ? { lineas: pedidoArmado().lineas, total: t.total } : undefined,
    historial: [
      {
        t: ahoraTexto(),
        texto:
          "Solicitada por el cliente desde la vista de clientes" +
          (t
            ? " con pedido anticipado de " +
              pesos(t.total) +
              " y abono de " +
              pesos(abono) +
              " por verificar"
            : ""),
      },
    ],
  });
  notificar(
    ["ventas"],
    "Nueva reservación de " +
      nombre +
      ": " +
      textoFecha(fecha) +
      " " +
      hora +
      ", " +
      personas +
      (personas === 1 ? " persona" : " personas") +
      ", mesa " +
      mesa.n +
      (t ? ", pedido y abono por verificar" : ""),
    "reservas.html",
    "aviso",
  );
  if (!guardar()) {
    ESTADO.reservas.pop();
    return error(
      "No se pudo guardar la solicitud en este navegador. Inténtalo de nuevo.",
    );
  }
  carrito = {};
  abonoPct = POLITICA_RESERVA.abonoMinimo;
  $("cl_abono_ref").value = "";
  $("cl_acepta").checked = false;
  pintarCarta();
  pintarTabs();
  form.hidden = true;
  $("cl-listo").hidden = false;
  $("cl-listo").innerHTML =
    "<h2>¡Listo, " +
    esc(nombre.split(" ")[0]) +
    "!</h2><p>Recibimos tu solicitud para el <b>" +
    textoFecha(fecha) +
    "</b> a las <b>" +
    esc(hora) +
    "</b>, para <b>" +
    personas +
    (personas === 1 ? " persona" : " personas") +
    "</b>.</p>" +
    (t
      ? "<p>Dejaste un pedido de <b>" +
        pesos(t.total) +
        "</b> y un abono de <b>" +
        pesos(abono) +
        "</b> (pendiente de verificar). Si no asistes, retenemos el " +
        POLITICA_RESERVA.penalizacion +
        " % del abono.</p>"
      : "") +
    "<p>Te confirmamos por teléfono al <b>" +
    esc(form.telefono.value.trim()) +
    '</b>. Hasta que te confirmemos, la reservación queda pendiente.</p><button type="button" class="btn" id="cl-otra">Hacer otra reservación</button>';
});
$("cl-listo").addEventListener("click", function (e) {
  if (!e.target.closest("#cl-otra")) return;
  form.reset();
  form.fecha.value = hoyLocal();
  form.personas.value = 2;
  form.hora.value = "20:00";
  form.hidden = false;
  $("cl-listo").hidden = true;
  $("cl-error").textContent = "";
  pintarPedido();
});

pintarTabs();
pintarCarta();
