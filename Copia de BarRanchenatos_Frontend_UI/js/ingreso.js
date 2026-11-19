

document.addEventListener("DOMContentLoaded", function () {

    const formulario = document.getElementById("form-ingreso");
    const email = document.getElementById("email");
    const contrasena = document.getElementById("contrasena");
    const mensaje = document.getElementById("mensaje-ingreso");

    if (!formulario) return;

    formulario.addEventListener("submit", function (event) {
        event.preventDefault();

        const correo = email.value.trim().toLowerCase();
        const clave = contrasena.value.trim();

        if (!correo || !clave) {
            mostrarMensaje("Completa el correo y la contraseña.", "error");
            return;
        }

        const clientes = JSON.parse(
            localStorage.getItem("clientesRanchenatos") || "[]"
        );

        const cliente = clientes.find(
            usuario => usuario.email === correo
        );

        if (!cliente) {
            mostrarMensaje(
                "Este correo no está registrado. Por favor, regístrate.",
                "error"
            );
            return;
        }


        sessionStorage.setItem(
            "clienteActivoRanchenatos",
            JSON.stringify({
                nombre: cliente.nombre,
                email: cliente.email
            })
        );

        mostrarMensaje("¡Bienvenido! Ingresando...", "exito");

        setTimeout(function () {
            window.location.href = "carta.html";
        }, 1000);
    });

    function mostrarMensaje(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = "mensaje-cliente " + tipo;
    }

});
