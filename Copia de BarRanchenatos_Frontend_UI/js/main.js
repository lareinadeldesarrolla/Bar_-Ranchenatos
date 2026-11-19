/* Bar Ranchenatos - JavaScript del frontend (corto a propósito).
   1. Menú en celular   2. Modo claro/oscuro   3. Validación de formularios
   4. Agregar filas a las tablas   5. Buscador   6. Reserva, cliente y caja   7. Poka-yoke
   (pedidos.js maneja el pedido y el cobro; flujo.js pinta las demás páginas con los datos de datos.js) */

// 1. Menú en celular
var botonMenu = document.getElementById('btn-menu');
var barra = document.getElementById('sidebar');
if (botonMenu && barra) {
  function menu(abrir) {
    barra.classList.toggle('open', abrir);
    botonMenu.setAttribute('aria-expanded', abrir);
    document.body.classList.toggle('menu-abierto', abrir);
  }
  botonMenu.addEventListener('click', function () { menu(!barra.classList.contains('open')); });

  // Formas de cerrarlo: botón, tocar fuera, Escape o elegir una opción
  var cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.className = 'cerrar-menu';
  cerrar.setAttribute('aria-label', 'Ocultar el menú');
  cerrar.innerHTML = '<span class="x-cel">✕</span><svg class="x-pc" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  cerrar.addEventListener('click', function () {
    if (window.innerWidth > 860) ocultarMenu(!document.body.classList.contains('menu-oculto')); else menu(false);
  });

  // En pantalla grande el menú también se puede ocultar (se recuerda en el navegador)
  function ocultarMenu(oculto) {
    document.body.classList.toggle('menu-oculto', oculto);
    cerrar.setAttribute('aria-label', oculto ? 'Mostrar el menú completo' : 'Ocultar el menú');
    try { localStorage.setItem('rn_menu_oculto', oculto ? '1' : '0'); } catch (e) { }
    window.dispatchEvent(new Event('resize'));
  }
  var enlaces = barra.querySelectorAll('.nav a');
  for (var k = 0; k < enlaces.length; k++) enlaces[k].title = enlaces[k].textContent.trim();
  try { if (localStorage.getItem('rn_menu_oculto') === '1') { document.body.classList.add('menu-oculto'); } } catch (e) { }
  barra.insertBefore(cerrar, barra.firstChild);
  var fondo = document.createElement('div');
  fondo.className = 'menu-fondo';
  fondo.addEventListener('click', function () { menu(false); });
  barra.parentNode.insertBefore(fondo, barra);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') menu(false); });
  barra.addEventListener('click', function (e) { if (e.target.closest('a')) menu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 860) menu(false); });
}

// 2. Modo claro / oscuro (se recuerda en el navegador)
if (localStorage.getItem('tema')) {
  document.documentElement.setAttribute('data-theme', localStorage.getItem('tema'));
}
var botonTema = document.getElementById('btn-tema');
if (botonTema) {
  botonTema.addEventListener('click', function () {
    var nuevo = document.documentElement.getAttribute('data-theme') === 'oscuro' ? 'claro' : 'oscuro';
    document.documentElement.setAttribute('data-theme', nuevo);
    localStorage.setItem('tema', nuevo);
  });
}

// 3. Validación: muestra el error debajo del campo y devuelve true si todo está bien
function mostrarError(campo, texto) {
  var caja = campo.closest('.field');
  if (!caja) return;
  var viejo = caja.querySelector('.field-error');
  if (viejo) viejo.remove();
  campo.removeAttribute('aria-invalid');
  if (texto) {
    var p = document.createElement('p');
    p.className = 'field-error';
    p.textContent = texto;
    caja.appendChild(p);
    campo.setAttribute('aria-invalid', 'true');
  }
}

function validar(form) {
  var primero = null;
  var campos = form.querySelectorAll('input, select, textarea');
  for (var i = 0; i < campos.length; i++) {
    var c = campos[i];
    if (c.type === 'checkbox') continue;
    var error = '';
    if (c.required && c.value.trim() === '') {
      error = 'Este campo es obligatorio.';
    } else if (c.pattern && c.value !== '' && !new RegExp('^(?:' + c.pattern + ')$').test(c.value)) {
      error = c.dataset.msg || 'El formato no es válido.';
    } else if (c.type === 'number' && c.value !== '' && (Number(c.value) < Number(c.min || -Infinity) || Number(c.value) > Number(c.max || Infinity))) {
      error = 'Escribe un valor entre ' + c.min + ' y ' + (c.max || 'el máximo permitido') + '.';
    }
    mostrarError(c, error);
    if (error && !primero) primero = c;
  }
  if (primero) primero.focus();
  return !primero;
}

function avisar(form, texto, tipo) {
  var caja = form.parentNode.querySelector('.msg');
  caja.textContent = texto;
  caja.className = 'msg msg-' + tipo;
}

function pesos(n) { return '$ ' + Math.round(n).toLocaleString('es-CO'); }

function esc(texto) {
  return String(texto).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}

// Botón del menú: vuelve a los datos de ejemplo (borra lo que se hizo en el navegador)
var botonReiniciar = document.getElementById('btn-reiniciar');
if (botonReiniciar) {
  botonReiniciar.addEventListener('click', function () {
    if (confirm('Se borran los pedidos, ventas y movimientos hechos en este navegador y vuelven los datos de ejemplo. ¿Continuar?')) {
      reiniciarDatos();
      location.reload();
    }
  });
}

// Cada celda lleva el nombre de su columna: en el celular la tabla se muestra como tarjetas y las usa
function etiquetarTablas() {
  var tablas = document.querySelectorAll('main table');
  for (var a = 0; a < tablas.length; a++) {
    var cabezas = tablas[a].querySelectorAll('thead th');
    var filas = tablas[a].querySelectorAll('tbody tr');
    for (var b = 0; b < filas.length; b++) {
      for (var c = 0; c < filas[b].cells.length && c < cabezas.length; c++) {
        filas[b].cells[c].setAttribute('data-label', cabezas[c].textContent);
      }
    }
  }
}

// 4. Formularios de registro: validan y agregan la fila a la tabla indicada.
//    data-cols = una celda por columna. "campo" muestra el campo, "=texto" es un texto fijo,
//    "a&b" junta dos valores en una línea y "a+b" pone el segundo en gris debajo del primero.
function textoDeCampo(form, nombre) {
  if (nombre.charAt(0) === '=') return nombre.slice(1);
  var campo = form.elements[nombre];
  var v = campo.tagName === 'SELECT' ? campo.options[campo.selectedIndex].text : campo.value;
  if (nombre === 'id_mesa') v = v.split(' ·')[0];
  if (nombre === 'numero_personas') v = v + ' personas';
  if (nombre === 'id_evento') v = campo.value === '' ? 'Reserva de mesa' : 'Evento · ' + v;
  if (nombre === 'id_empleado') v = campo.value === '' ? 'Desde la app' : v;
  if (nombre === 'comprobante_pago') v = v === '' ? 'Sin comprobante de pago' : v;
  if (nombre === 'activo') v = campo.value === '1' ? 'En uso' : 'Fuera de uso';
  if (nombre === 'fecha' || nombre === 'fecha_nacimiento' || nombre === 'fecha_ingreso') v = v === '' ? 'Sin dato' : fechaCorta(v);
  return v === '' ? 'Sin dato' : v;
}

function fechaCorta(iso) {
  var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var p = iso.split('-');
  return Number(p[2]) + ' ' + meses[Number(p[1]) - 1];
}

var formularios = document.querySelectorAll('form[data-tabla]');
for (var f = 0; f < formularios.length; f++) {
  formularios[f].addEventListener('submit', function (e) {
    e.preventDefault();
    var form = this;
    if (!validar(form)) return;
    var cols = form.dataset.cols.split(',');
    var fila = document.createElement('tr');
    for (var i = 0; i < cols.length; i++) {
      var lineas = cols[i].split('+');
      var td = document.createElement('td');
      for (var j = 0; j < lineas.length; j++) {
        var partes = lineas[j].split('&');
        var texto = [];
        for (var k = 0; k < partes.length; k++) {
          var v = textoDeCampo(form, partes[k]);
          if (v !== 'Sin dato' || partes.length === 1) texto.push(v);
        }
        if (j === 0) {
          td.appendChild(document.createTextNode(texto.join(' ')));
        } else {
          var pequeno = document.createElement('small');
          pequeno.textContent = texto.join(' ');
          td.appendChild(pequeno);
        }
      }
      fila.appendChild(td);
    }
    if (form.id === 'form-reserva') {
      fila.dataset.fecha = form.fecha.value;
      fila.dataset.hora = form.hora.value;
      fila.dataset.mesa = form.id_mesa.options[form.id_mesa.selectedIndex].text.split(' ·')[0];
    }
    document.querySelector('#' + form.dataset.tabla + ' tbody').appendChild(fila);
    etiquetarTablas();
    avisar(form, 'Registro guardado.', 'ok');
    form.reset();
  });
}

// 5. Buscador: oculta las filas que no coinciden
var buscador = document.getElementById('buscador');
if (buscador) {
  buscador.addEventListener('input', function () {
    var filas = document.querySelectorAll('table.filtrable tbody tr');
    for (var i = 0; i < filas.length; i++) {
      var coincide = filas[i].textContent.toLowerCase().indexOf(buscador.value.toLowerCase()) !== -1;
      filas[i].classList.toggle('hide-row', !coincide);
    }
  });
}

// Filtros rápidos de una tabla (botones con data-filtro): escriben en el buscador
var chipsFiltro = document.querySelectorAll('.chip[data-filtro]');
for (var cf = 0; cf < chipsFiltro.length; cf++) {
  chipsFiltro[cf].addEventListener('click', function () {
    for (var z = 0; z < chipsFiltro.length; z++) chipsFiltro[z].setAttribute('aria-pressed', 'false');
    this.setAttribute('aria-pressed', 'true');
    buscador.value = this.dataset.filtro;
    buscador.dispatchEvent(new Event('input'));
  });
}

// 6a. Reserva: la mesa debe tener capacidad y la fecha no puede ser pasada
//     (se revisa antes de guardar la fila)
var formReserva = document.getElementById('form-reserva');
if (formReserva) {
  formReserva.addEventListener('submit', function (e) {
    var mesa = formReserva.id_mesa;
    var capacidad = Number(mesa.options[mesa.selectedIndex].dataset.capacidad);
    if (validar(formReserva)) {
      if (Number(formReserva.numero_personas.value) > capacidad) {
        mostrarError(formReserva.numero_personas, 'Esa mesa solo admite ' + capacidad + ' personas.');
        e.stopImmediatePropagation(); e.preventDefault();
      } else if (formReserva.fecha.value < new Date().toISOString().slice(0, 10)) {
        mostrarError(formReserva.fecha, 'La fecha no puede ser anterior a hoy.');
        e.stopImmediatePropagation(); e.preventDefault();
      }
    }
  }, true);
}

// ============================================================
// 7. Poka-yoke: el sistema evita el error antes de que ocurra
//    - el botón de guardar se bloquea y explica qué falta
//    - las opciones que no sirven se deshabilitan antes de elegirlas
//    - los campos solo aceptan lo válido y lo que depende de otra cosa se calcula en vivo
// ============================================================
function etiquetaDe(campo) {
  if (campo.dataset.etiqueta) return campo.dataset.etiqueta;
  var l = document.querySelector('label[for="' + campo.id + '"]');
  return l ? l.textContent.replace('*', '').trim().toLowerCase() : campo.name;
}

// Bloquea el botón de enviar mientras algo falte y escribe el motivo a su lado
// sinGenerico: no escribe el aviso general de campos que faltan (el botón sigue bloqueado); los motivos específicos sí se escriben
function vigilar(form, motivoExtra, sinGenerico) {
  var boton = form.querySelector('button[type="submit"]');
  var aviso = document.createElement('p');
  aviso.className = 'hint poka';
  aviso.setAttribute('role', 'status');
  boton.parentNode.insertBefore(aviso, boton);
  form.dataset.vigilado = '1';
  function revisar() {
    var motivo = '', general = false;
    var campos = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < campos.length; i++) {
      if (!campos[i].disabled && !campos[i].checkValidity()) { motivo = 'Falta o está mal: ' + etiquetaDe(campos[i]); general = true; break; }
    }
    if (!motivo && motivoExtra) motivo = motivoExtra();
    boton.disabled = motivo !== '';
    aviso.textContent = general && sinGenerico ? (motivoExtra ? motivoExtra() : '') : motivo;
  }
  form.addEventListener('input', revisar);
  form.addEventListener('change', revisar);
  form.addEventListener('reset', function () { setTimeout(revisar, 0); });
  revisar();
  return revisar;
}

// Ejecuta una función ahora, cada vez que cambie el formulario y después de limpiarlo
function reaccionar(form, fn) {
  form.addEventListener('input', fn);
  form.addEventListener('change', fn);
  form.addEventListener('reset', function () { setTimeout(fn, 0); });
  fn();
}

function soloDigitos(campo, largo) {
  campo.setAttribute('inputmode', 'numeric');
  campo.addEventListener('input', function () { campo.value = campo.value.replace(/\D/g, '').slice(0, largo || 20); });
}

function ayudaDebajo(campo) {
  var p = document.createElement('p');
  p.className = 'hint';
  campo.parentNode.appendChild(p);
  return p;
}

var hoyISO = new Date().toISOString().slice(0, 10);

// Reservas: solo se pueden elegir mesas donde caben las personas, no se puede reservar el pasado
// ni una mesa ya ocupada a esa hora, y el evento solo se pide si la reserva es de evento
if (formReserva) {
  formReserva.fecha.min = hoyISO;
  var selMesa = formReserva.id_mesa;
  var textosMesa = [];
  for (var im = 0; im < selMesa.options.length; im++) textosMesa.push(selMesa.options[im].text);
  reaccionar(formReserva, function () {
    var n = Number(formReserva.numero_personas.value) || 0;
    for (var i = 1; i < selMesa.options.length; i++) {
      var cabe = Number(selMesa.options[i].dataset.capacidad) >= n;
      selMesa.options[i].disabled = !cabe;
      selMesa.options[i].text = textosMesa[i] + (cabe ? '' : ' (no cabe)');
    }
    if (selMesa.selectedIndex > 0 && selMesa.options[selMesa.selectedIndex].disabled) selMesa.selectedIndex = 0;
    var esEvento = formReserva.tipo.value === 'EVENTO';
    formReserva.id_evento.disabled = !esEvento;
    formReserva.id_evento.required = esEvento;
    formReserva.comprobante_pago.disabled = !esEvento;
    if (!esEvento) { formReserva.id_evento.value = ''; formReserva.comprobante_pago.value = ''; }
  });
  vigilar(formReserva, function () {
    var mesa = selMesa.options[selMesa.selectedIndex].text.split(' ·')[0];
    var filas = document.querySelectorAll('#t-reservas tbody tr');
    for (var i = 0; i < filas.length; i++) {
      var d = filas[i].dataset;
      if (d.fecha === formReserva.fecha.value && d.hora === formReserva.hora.value && d.mesa === mesa) {
        return 'La ' + mesa.toLowerCase() + ' ya está reservada a esa fecha y hora';
      }
    }
    return '';
  });
}

// Mesas: no se puede repetir el número de una mesa
var formMesa = document.getElementById('form-mesa');
if (formMesa) {
  vigilar(formMesa, function () {
    var filas = document.querySelectorAll('#t-mesas tbody tr');
    for (var i = 0; i < filas.length; i++) {
      if (filas[i].cells[0].textContent.trim() === formMesa.numero.value) return 'Ya existe la mesa ' + formMesa.numero.value;
    }
    return '';
  });
}

// Empleados: contraseña con reglas a la vista mientras se escribe, usuario siempre en minúscula
var formEmpleado = document.getElementById('form-empleado');
if (formEmpleado) {
  soloDigitos(formEmpleado.telefono, 10);
  soloDigitos(formEmpleado.numero_documento, 20);
  formEmpleado.usuario.addEventListener('input', function () {
    formEmpleado.usuario.value = formEmpleado.usuario.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
  });
  var reglasClave = ayudaDebajo(formEmpleado.contrasena);
  reaccionar(formEmpleado, function () {
    var v = formEmpleado.contrasena.value;
    reglasClave.textContent = (v.length >= 8 ? '✓' : '✗') + ' 8 caracteres o más · ' + (/[A-Z]/.test(v) ? '✓' : '✗') + ' una mayúscula · ' + (/[0-9]/.test(v) ? '✓' : '✗') + ' un número';
  });
  formEmpleado.fecha_ingreso.max = hoyISO;
}

// Todos los demás formularios de registro también bloquean el botón mientras falte algo
for (var fv = 0; fv < formularios.length; fv++) {
  if (!formularios[fv].dataset.vigilado) vigilar(formularios[fv]);
}

etiquetarTablas();
