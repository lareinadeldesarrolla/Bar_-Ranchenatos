
/* =========================================
   REGISTRO DE CLIENTES
   Bar Ranchenatos
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    const formulario = document.getElementById("form-registro");
    const mensaje = document.getElementById("mensaje-registro");

    if (!formulario) return;

    formulario.addEventListener("submit", function (event) {
        event.preventDefault();

        const nombre = document.getElementById("nombre").value.trim();
        const telefono = document.getElementById("telefono").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();

        if (!nombre || !telefono || !email) {
            mostrarMensaje("Completa todos los campos.", "error");
            return;
        }

        let clientes = JSON.parse(
            localStorage.getItem("clientesRanchenatos") || "[]"
        );

        const existe = clientes.some(cliente => cliente.email === email);

        if (existe) {
            mostrarMensaje("Este correo ya se encuentra registrado. Puedes ingresar.", "error");
            return;
        }

        clientes.push({
            nombre: nombre,
            telefono: telefono,
            email: email
        });

        localStorage.setItem("clientesRanchenatos", JSON.stringify(clientes));

        mostrarMensaje("¡Registro exitoso! Ahora puedes ingresar.", "exito");

        formulario.reset();

        setTimeout(function () {
            window.location.href = "ingreso.html";
        }, 1500);
    });

    function mostrarMensaje(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = "mensaje-cliente " + tipo;
    }

});
