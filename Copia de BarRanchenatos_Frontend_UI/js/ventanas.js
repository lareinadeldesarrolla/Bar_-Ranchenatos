/* Ventanas emergentes reutilizables (con la X por fuera): formulario armado a partir de una lista de campos y confirmación.
   abrirFormulario({ titulo, ayuda, campos, boton, alGuardar }) — alGuardar(valores) devuelve un texto de error para dejarla abierta, o nada para cerrarla. */

var X_CERRAR =
  '<button type="button" class="cerrar-x" data-cerrar aria-label="Cerrar" title="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';

function vistaImagen(url) {
  return url
    ? '<img src="' + esc(url) + '" alt="">'
    : "<span>Sin imagen</span>";
}

function campoHtml(c, n) {
  var id = "vf_" + n + "_" + c.id;
  var req = c.requerido ? " required" : "";
  var attrs =
    (c.min !== undefined ? ' min="' + c.min + '"' : "") +
    (c.max !== undefined ? ' max="' + c.max + '"' : "") +
    (c.step ? ' step="' + c.step + '"' : "") +
    (c.placeholder ? ' placeholder="' + esc(c.placeholder) + '"' : "") +
    (c.largo ? ' maxlength="' + c.largo + '"' : "");
  var cuerpo;
  if (c.tipo === "select") {
    cuerpo =
      '<select id="' +
      id +
      '" name="' +
      c.id +
      '"' +
      req +
      ">" +
      c.opciones
        .map(function (o) {
          return (
            '<option value="' +
            esc(o[0]) +
            '"' +
            (String(o[0]) === String(c.valor) ? " selected" : "") +
            ">" +
            esc(o[1]) +
            "</option>"
          );
        })
        .join("") +
      "</select>";
  } else if (c.tipo === "chips") {
    cuerpo =
      '<div class="chips-res" role="radiogroup" data-chips="' +
      c.id +
      '">' +
      c.opciones
        .map(function (o) {
          return (
            '<button type="button" class="chip-res" role="radio" data-v="' +
            esc(o[0]) +
            '" aria-pressed="' +
            (String(o[0]) === String(c.valor)) +
            '">' +
            esc(o[1]) +
            "</button>"
          );
        })
        .join("") +
      "</div>";
  } else if (c.tipo === "multi") {
    cuerpo =
      (c.buscar
        ? '<input type="search" class="multi-buscar" data-multi-buscar placeholder="Buscar" autocomplete="off">'
        : "") +
      '<div class="chips-res multi-lista" data-multi="' +
      c.id +
      '">' +
      c.opciones
        .map(function (o) {
          return (
            '<button type="button" class="chip-res" data-v="' +
            esc(o[0]) +
            '" aria-pressed="' +
            ((c.valor || []).indexOf(o[0]) !== -1) +
            '">' +
            esc(o[1]) +
            "</button>"
          );
        })
        .join("") +
      "</div>";
  } else if (c.tipo === "imagen") {
    cuerpo =
      '<div class="campo-imagen" data-imagen="' +
      c.id +
      '" data-valor="' +
      esc(c.valor || "") +
      '" data-heredada="' +
      esc(c.heredada || "") +
      '"><div class="img-prev">' +
      vistaImagen(c.valor || c.heredada) +
      "</div>" +
      '<div class="img-acc"><label class="btn btn-sm">Elegir imagen<input type="file" accept="image/*" hidden></label><button type="button" class="btn btn-sm" data-quitar-img>Quitar</button></div></div>';
  } else if (c.tipo === "check") {
    cuerpo =
      '<label class="campo-check"><input type="checkbox" id="' +
      id +
      '" name="' +
      c.id +
      '"' +
      (c.valor ? " checked" : "") +
      "> " +
      esc(c.etiqueta) +
      "</label>";
  } else if (c.tipo === "textarea") {
    cuerpo =
      '<textarea id="' +
      id +
      '" name="' +
      c.id +
      '" rows="3"' +
      req +
      attrs +
      ">" +
      esc(c.valor || "") +
      "</textarea>";
  } else {
    cuerpo =
      '<input id="' +
      id +
      '" name="' +
      c.id +
      '" type="' +
      (c.tipo || "text") +
      '" value="' +
      esc(c.valor == null ? "" : c.valor) +
      '"' +
      req +
      attrs +
      ' autocomplete="off"' +
      (c.tipo === "number" ? ' inputmode="decimal"' : "") +
      ">";
  }
  var etiqueta =
    c.tipo === "check"
      ? ""
      : '<label for="' + id + '">' + esc(c.etiqueta) + "</label>";
  return (
    '<div class="campo' +
    (c.ancho ? " campo-ancho" : "") +
    '" data-campo="' +
    c.id +
    '">' +
    etiqueta +
    cuerpo +
    (c.ayuda ? '<p class="ayuda-campo">' + esc(c.ayuda) + "</p>" : "") +
    "</div>"
  );
}

var ventanasAbiertas = 0;
function abrirFormulario(op) {
  var n = ++ventanasAbiertas;
  var dlg = document.createElement("dialog");
  dlg.className = "dlg-res " + (op.ancha ? "dlg-ancha" : "dlg-chico");
  dlg.innerHTML =
    X_CERRAR +
    '<form class="form-res" novalidate><h2>' +
    esc(op.titulo) +
    "</h2>" +
    (op.ayuda ? '<p class="ayuda-res">' + op.ayuda + "</p>" : "") +
    '<div class="grid-res">' +
    op.campos
      .map(function (c) {
        return campoHtml(c, n);
      })
      .join("") +
    '</div><p class="f-error" role="alert"></p>' +
    '<div class="acciones-res"><button type="button" class="btn" data-cerrar>Cancelar</button><button type="submit" class="btn btn-primary">' +
    esc(op.boton || "Guardar") +
    "</button></div></form>";
  document.body.appendChild(dlg);
  var form = dlg.querySelector("form"),
    error = dlg.querySelector(".f-error");
  var cerrar = function () {
    if (dlg.open) dlg.close();
  };
  dlg.addEventListener("close", function () {
    dlg.remove();
  });
  dlg.addEventListener("click", function (e) {
    if (e.target === dlg || e.target.closest("[data-cerrar]")) {
      cerrar();
      return;
    }
    var quitar = e.target.closest("[data-quitar-img]");
    if (quitar) {
      var ci = quitar.closest(".campo-imagen");
      ci.dataset.valor = "";
      ci.querySelector(".img-prev").innerHTML = vistaImagen(
        ci.dataset.heredada,
      );
      return;
    }
    var chip = e.target.closest(".chip-res");
    if (chip) {
      if (chip.parentNode.hasAttribute("data-multi"))
        chip.setAttribute(
          "aria-pressed",
          chip.getAttribute("aria-pressed") === "true" ? "false" : "true",
        );
      else
        [].forEach.call(
          chip.parentNode.querySelectorAll(".chip-res"),
          function (b) {
            b.setAttribute("aria-pressed", b === chip ? "true" : "false");
          },
        );
      if (op.alCambiar) op.alCambiar(valores(), dlg);
    }
  });
  form.addEventListener("input", function (e) {
    if (e.target.matches("[data-multi-buscar]")) {
      var q = e.target.value.trim().toLowerCase();
      [].forEach.call(
        e.target.parentNode.querySelectorAll(".multi-lista .chip-res"),
        function (b) {
          b.hidden = q !== "" && b.textContent.toLowerCase().indexOf(q) === -1;
        },
      );
      return;
    }
    if (op.alCambiar) op.alCambiar(valores(), dlg);
  });
  dlg.addEventListener("change", function (e) {
    var cont = e.target.closest(".campo-imagen");
    if (!cont || e.target.type !== "file") return;
    error.textContent = "";
    leerImagen(e.target.files[0]).then(
      function (url) {
        cont.dataset.valor = url;
        cont.querySelector(".img-prev").innerHTML = vistaImagen(url);
      },
      function (err) {
        error.textContent = err.message;
      },
    );
    e.target.value = "";
  });
  function valores() {
    var v = {};
    op.campos.forEach(function (c) {
      if (c.tipo === "imagen")
        v[c.id] = form.querySelector(
          '[data-imagen="' + c.id + '"]',
        ).dataset.valor;
      else if (c.tipo === "chips") {
        var m = form.querySelector(
          '[data-chips="' + c.id + '"] [aria-pressed="true"]',
        );
        v[c.id] = m ? m.dataset.v : "";
      } else if (c.tipo === "multi")
        v[c.id] = [].map.call(
          form.querySelectorAll(
            '[data-multi="' + c.id + '"] [aria-pressed="true"]',
          ),
          function (b) {
            return b.dataset.v;
          },
        );
      else if (c.tipo === "check") v[c.id] = form.elements[c.id].checked;
      else {
        var x = form.elements[c.id].value.trim();
        v[c.id] = c.tipo === "number" ? (x === "" ? "" : Number(x)) : x;
      }
    });
    return v;
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = valores();
    for (var i = 0; i < op.campos.length; i++) {
      var c = op.campos[i];
      if (c.requerido && (v[c.id] === "" || v[c.id] === undefined)) {
        error.textContent = "Falta: " + c.etiqueta.toLowerCase() + ".";
        form.elements[c.id].focus();
        return;
      }
      if (
        c.tipo === "number" &&
        v[c.id] !== "" &&
        ((c.min !== undefined && v[c.id] < c.min) ||
          (c.max !== undefined && v[c.id] > c.max))
      ) {
        error.textContent =
          c.etiqueta +
          " debe estar entre " +
          (c.min !== undefined ? c.min : "…") +
          " y " +
          (c.max !== undefined ? c.max : "…") +
          ".";
        form.elements[c.id].focus();
        return;
      }
    }
    var r = op.alGuardar(v, dlg);
    Promise.resolve(r).then(function (msg) {
      if (msg) error.textContent = msg;
      else cerrar();
    });
  });
  dlg.showModal();
  var primero = form.querySelector(
    "input:not([type=checkbox]), select, textarea",
  );
  if (primero && !op.sinFoco) primero.focus();
  if (op.alCambiar) op.alCambiar(valores(), dlg);
  return dlg;
}

function confirmarVentana(op) {
  var dlg = document.createElement("dialog");
  dlg.className = "dlg-res dlg-chico";
  dlg.innerHTML =
    X_CERRAR +
    '<div class="form-res"><h2>' +
    esc(op.titulo) +
    '</h2><p class="ayuda-res">' +
    op.texto +
    '</p><div class="acciones-res"><button type="button" class="btn" data-cerrar>' +
    esc(op.cancelar || "Volver") +
    '</button><button type="button" class="btn btn-primary" data-ok>' +
    esc(op.boton || "Aceptar") +
    "</button></div></div>";
  document.body.appendChild(dlg);
  dlg.addEventListener("close", function () {
    dlg.remove();
  });
  dlg.addEventListener("click", function (e) {
    if (e.target === dlg || e.target.closest("[data-cerrar]")) dlg.close();
    else if (e.target.closest("[data-ok]")) {
      dlg.close();
      op.alAceptar();
    }
  });
  dlg.showModal();
}

// Ventana de información con botones: abrirVentana({ titulo, ayuda, cuerpo, botones: [{ texto, primario, alClic(dlg) }], ancha })
function abrirVentana(op) {
  var dlg = document.createElement("dialog");
  dlg.className = "dlg-res " + (op.ancha ? "dlg-ancha" : "dlg-chico");
  dlg.innerHTML =
    X_CERRAR +
    '<div class="form-res"><h2>' +
    esc(op.titulo) +
    "</h2>" +
    (op.ayuda ? '<p class="ayuda-res">' + op.ayuda + "</p>" : "") +
    (op.cuerpo || "") +
    '<div class="acciones-res acciones-ventana">' +
    (op.botones || [])
      .map(function (b, i) {
        return (
          '<button type="button" class="btn' +
          (b.primario ? " btn-primary" : "") +
          '" data-b="' +
          i +
          '">' +
          esc(b.texto) +
          "</button>"
        );
      })
      .join("") +
    "</div></div>";
  document.body.appendChild(dlg);
  dlg.addEventListener("close", function () {
    dlg.remove();
  });
  dlg.addEventListener("click", function (e) {
    if (e.target === dlg || e.target.closest("[data-cerrar]")) {
      dlg.close();
      return;
    }
    var b = e.target.closest("[data-b]");
    if (b) op.botones[Number(b.dataset.b)].alClic(dlg);
  });
  dlg.showModal();
  return dlg;
}
