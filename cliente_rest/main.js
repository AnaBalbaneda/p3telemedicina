let estadoApp = {
    usuarioId: null,
    maestros: { cat: [], mod: [], ubi: [] }
};

var wsConexion = null;   
var nombreGestor = "";  
var tokenGlobal = ""; // Variable global donde guardamos el token JWT

document.addEventListener('DOMContentLoaded', () => {
    navegar('login-view');
});

function navegar(vistaId) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(vistaId).style.display = 'block';
}

// INICIAR SESIÓN (LOGIN)
function handleLogin() {
    const u = document.getElementById('login-u').value;
    const p = document.getElementById('login-p').value;
    
    rest.post('/api/gestores/login', { login: u, password: p }, function(status, response) {
        if (status === 200) {
            // Soportamos tanto si el servidor devuelve { id, token } como si devuelve solo el id
            if (typeof response === 'object' && response !== null) {
                estadoApp.usuarioId = response.id;
                tokenGlobal = response.token;
            } else {
                estadoApp.usuarioId = response;
            }
            cargarMaestrosYEntrar();
        } else {
            alert("Credenciales incorrectas");
        }
    });
}

function logout() {
    tokenGlobal = "";
    if (wsConexion !== null) wsConexion.close();
    location.reload(); 
}

function cargarMaestrosYEntrar() {
    rest.get('/api/categorias?token=' + tokenGlobal, function(statusCat, resCat) {
        if (statusCat === 200) estadoApp.maestros.cat = resCat;
        
        rest.get('/api/modelos?token=' + tokenGlobal, function(statusMod, resMod) {
            if (statusMod === 200) estadoApp.maestros.mod = resMod;
            
            rest.get('/api/ubicaciones?token=' + tokenGlobal, function(statusUbi, resUbi) {
                if (statusUbi === 200) estadoApp.maestros.ubi = resUbi;
                
                cargarComboFiltros(); 
                navegar('home-view');
                cargarTablaRecursos(); 
                cargarRankingMinisterio();

                rest.get('/api/gestores/' + estadoApp.usuarioId + '?token=' + tokenGlobal, function(statusGestor, resGestor) {
                    if (statusGestor === 200) {
                        nombreGestor = resGestor.nombre + " " + resGestor.apellidos;
                        document.getElementById('welcome-user').innerText = `Bienvenido ${resGestor.nombre} ${resGestor.apellidos}`;
                        conectarWS();
                    }
                });
            });
        });
    });
}

// FUNCIONES WEBSOCKET

function conectarWS() {
    wsConexion = new WebSocket("ws://localhost:4444", "hospital-avisos");

    wsConexion.addEventListener("open", function () {
        wsConexion.send(JSON.stringify({
            operacion: "conectar",
            id: estadoApp.usuarioId,
            tipo: "gestor",
            nombre: nombreGestor
        }));
    });

    wsConexion.addEventListener("message", function (event) {
        var msg = JSON.parse(event.data);
        if (msg.operacion === "aviso") {
            recibirAviso(msg);
        }
    });
}

function recibirAviso(msg) {
    var tbody = document.getElementById('tbody-avisos');
    var fila = document.createElement('tr');

    var colorFondo = '#ffffff';
    if (msg.color === 'azul')  colorFondo = '#9bc9f9';
    if (msg.color === 'verde') colorFondo = '#89e89f';

    fila.style.backgroundColor = colorFondo;
    fila.innerHTML = '<td>' + new Date(msg.fecha).toLocaleString() + '</td>' +
                     '<td>' + msg.origen + '</td>' +
                     '<td>' + msg.texto + '</td>';
    tbody.appendChild(fila);
}

// FIN FUNCIONES WEBSOCKET

function cargarComboFiltros() {
    llenarSelect('filtro-cat', estadoApp.maestros.cat, true);
    llenarSelect('filtro-mod', estadoApp.maestros.mod, true);
    llenarSelect('filtro-ubi', estadoApp.maestros.ubi, true);
}

function llenarSelect(idDom, datos, opcionTodos = false) {
    const sel = document.getElementById(idDom);
    if(opcionTodos){
        sel.innerHTML = '<option value="Todos">Todos</option>';
    } else {
        sel.innerHTML = '';
    }
    datos.forEach(d => {
        sel.innerHTML += `<option value="${d.id}">${d.nombre}</option>`;
    });
}

function actualizarModelos(modo) {
    let idCat, idMod, incluyeTodos;

    if (modo === 'filtro') {
        idCat = 'filtro-cat';
        idMod = 'filtro-mod';
        incluyeTodos = true; 
    } else {
        idCat = 'form-cat';
        idMod = 'form-mod';
        incluyeTodos = false; 
    }

    const idCatElegida = document.getElementById(idCat).value;

    if (idCatElegida === "Todos") {
        llenarSelect(idMod, estadoApp.maestros.mod, incluyeTodos);
    } else {
        const modelosFiltrados = estadoApp.maestros.mod.filter(m => m.categoria == idCatElegida);
        llenarSelect(idMod, modelosFiltrados, incluyeTodos);
    }
}

// LISTADO DE RECURSOS
function cargarTablaRecursos() {
    const categoria = document.getElementById('filtro-cat').value;
    const modelo = document.getElementById('filtro-mod').value;
    const ubicacion = document.getElementById('filtro-ubi').value;
    const estado = document.getElementById('filtro-est').value;

    // Construimos la URL de filtros incluyendo siempre el token
    let queryParams = [];
    if (categoria !== "Todos") queryParams.push("categoria=" + categoria);
    if (modelo !== "Todos" && modelo !== "") queryParams.push("modelo=" + modelo);
    if (ubicacion !== "Todos") queryParams.push("ubicacion=" + ubicacion);
    if (estado !== "Todos") queryParams.push("estado=" + estado);
    queryParams.push("token=" + tokenGlobal);

    let url = '/api/recursos?' + queryParams.join('&');

    rest.get(url, function(status, recursos) {
        if (status === 200) {
            const tbody = document.getElementById('tabla-recursos');
            tbody.innerHTML = '';

            recursos.forEach(r => {
                const modeloObj = estadoApp.maestros.mod.find(m => m.id == r.modelo);
                const modNombre = modeloObj ? modeloObj.nombre : '-';
                const catNombre = modeloObj ? (estadoApp.maestros.cat.find(c => c.id == modeloObj.categoria)?.nombre || '-') : '-';
                const ubiNombre = estadoApp.maestros.ubi.find(u => u.id == r.ubicacion)?.nombre || '-';
                
                let estTexto = "";
                if (r.estado === 0) estTexto = "Operativo";
                else if (r.estado === 1) estTexto = "Baja";
                else if (r.estado === 2) estTexto = "Mantenimiento";

                tbody.innerHTML += `
                    <tr>
                        <td>${r.numero_serie}</td>
                        <td>${catNombre}</td>
                        <td>${modNombre}</td>
                        <td>${ubiNombre}</td>
                        <td>${estTexto}</td>
                        <td>
                            <button onclick="verDetalle(${r.id})">Abrir</button>
                            <button onclick="borrar(${r.id})">X</button>
                        </td>
                    </tr>
                `;
            });
        }
    });
}

function borrar(id) {
    if (confirm("¿Estás seguro de eliminar este recurso?")) {
        rest.delete('/api/recursos/' + id + '?token=' + tokenGlobal, function(status) {
            if (status === 200) {
                cargarTablaRecursos();
            }
        });
    }
}

function nuevoRecurso() {
    document.getElementById('form-id').value = ""; 
    document.getElementById('form-serie').value = "";
    
    llenarSelect('form-cat', estadoApp.maestros.cat);
    llenarSelect('form-ubi', estadoApp.maestros.ubi);
    actualizarModelos('formulario');
    document.getElementById('form-est').value = 0;

    document.getElementById('panel-historial').style.display = 'none';
    navegar('detalle-view');
}

function verDetalle(id) {
    rest.get('/api/recursos/' + id + '?token=' + tokenGlobal, function(status, r) {
        if (status === 200 && r) {
            llenarSelect('form-cat', estadoApp.maestros.cat);
            llenarSelect('form-mod', estadoApp.maestros.mod);
            llenarSelect('form-ubi', estadoApp.maestros.ubi);

            document.getElementById('form-id').value = r.id;
            document.getElementById('form-serie').value = r.numero_serie;
            
            const modeloObj = estadoApp.maestros.mod.find(m => m.id == r.modelo);
            if(modeloObj) {
                document.getElementById('form-cat').value = modeloObj.categoria;
                actualizarModelos('formulario');
            }
            
            document.getElementById('form-mod').value = r.modelo;
            document.getElementById('form-ubi').value = r.ubicacion;
            document.getElementById('form-est').value = r.estado;

            document.getElementById('panel-historial').style.display = 'block';
            
            pintarReservas(id, function() {
                pintarResenyas(id, function() {
                    navegar('detalle-view');
                });
            });
        }
    });
}

function guardar() {
    const id = document.getElementById('form-id').value;
    const datos = {
        modelo: parseInt(document.getElementById('form-mod').value),
        ubicacion: parseInt(document.getElementById('form-ubi').value),
        numero_serie: document.getElementById('form-serie').value,
        estado: parseInt(document.getElementById('form-est').value)
    };
    
    if (id) {
        rest.put('/api/recursos/' + id + '?token=' + tokenGlobal, datos, function(status) {
            if (status === 200) {
                alert("Guardado correctamente");
                cargarTablaRecursos();
                navegar('home-view');
            } else alert("Error al guardar");
        });
    } else {
        rest.post('/api/recursos?token=' + tokenGlobal, datos, function(status, nuevoRecursoId) {
            if (status === 201) {
                
                var modeloObj = estadoApp.maestros.mod.find(m => m.id == datos.modelo);
                var catObj = estadoApp.maestros.cat.find(c => c.id == modeloObj.categoria);
                
                // Enviamos el aviso al servidor WS
                if (wsConexion !== null && wsConexion.readyState === WebSocket.OPEN) {
                    wsConexion.send(JSON.stringify({
                        operacion: "crearRecurso",
                        idRecurso: nuevoRecursoId, 
                        nombreCategoria: catObj.nombre,
                        nombreModelo: modeloObj.nombre,
                        codigoRecurso: datos.numero_serie
                    }));
                }
                alert("Guardado correctamente");
                cargarTablaRecursos();
                navegar('home-view');
            } else alert("Error al guardar");
        });
    }
}

function pintarReservas(idRecurso, callback) {
    rest.get(`/api/recursos/${idRecurso}/reservas?token=${tokenGlobal}`, function(status, reservas) {
        if (status === 200) {
            const tbody = document.getElementById('tabla-reservas');
            tbody.innerHTML = '';

            reservas.forEach(res => {
                let claseColor = 'fila-blanca';
                const fInicio = res.fecha_inicio ? new Date(res.fecha_inicio) : null;
                const fFin = res.fecha_fin ? new Date(res.fecha_fin) : null;
                const ahora = new Date(); 

                if (!fInicio) {
                    claseColor = 'fila-verde'; 
                } else if (!fFin) {
                    const horaLimite = new Date(fInicio.getTime() + (res.horas_estimadas * 60 * 60 * 1000));
                    if (ahora > horaLimite) claseColor = 'fila-roja'; 
                    else claseColor = 'fila-azul';
                } 

                tbody.innerHTML += `
                    <tr class="${claseColor}">
                        <td>${res.nombreSanitario} </td>
                        <td>${res.horas_estimadas}h</td>
                        <td>${new Date(res.fecha_peticion).toLocaleString()}</td>
                        <td>${fInicio ? fInicio.toLocaleString() : 'Pendiente'}</td>
                        <td>${fFin ? fFin.toLocaleString() : 'En curso'}</td>
                    </tr>
                `;
            });
        }
        if(callback) callback();
    });
}

function pintarResenyas(idRecurso, callback) {
    rest.get(`/api/recursos/${idRecurso}/resenyas?token=${tokenGlobal}`, function(status, resenyas) {
        if (status === 200) {
            const tbody = document.getElementById('tabla-resenyas');
            tbody.innerHTML = '';

            resenyas.forEach(r => {
                tbody.innerHTML += `
                    <tr>
                        <td>${new Date(r.fecha).toLocaleDateString()}</td>
                        <td>${r.nombreSanitario}</td>
                        <td>${r.valor}</td>
                        <td>${r.descripcion}</td>
                    </tr>
                `;
            });
        }
        if(callback) callback();
    });
}

// --- FUNCIONES DEL GESTOR (REGISTRO Y EDICIÓN) ---

function mostrarRegistro() {
    document.getElementById('gestor-id').value = "";
    document.getElementById('gestor-n').value = "";
    document.getElementById('gestor-a').value = "";
    document.getElementById('gestor-u').value = "";
    document.getElementById('gestor-p').value = "";
    navegar('gestor-view');
}

function mostrarEdicion() {
    rest.get('/api/gestores/' + estadoApp.usuarioId + '?token=' + tokenGlobal, function(status, gestor) {
        if (status === 200 && gestor) {
            document.getElementById('gestor-id').value = gestor.id;
            document.getElementById('gestor-n').value = gestor.nombre;
            document.getElementById('gestor-a').value = gestor.apellidos;
            document.getElementById('gestor-u').value = gestor.usuario;
            document.getElementById('gestor-p').value = ""; 
            navegar('gestor-view');
        }
    });
}

function guardarGestor() {
    const id = document.getElementById('gestor-id').value;
    const datos = {
        nombre: document.getElementById('gestor-n').value,
        apellidos: document.getElementById('gestor-a').value,
        usuario: document.getElementById('gestor-u').value,
        password: document.getElementById('gestor-p').value
    };

    if (id) {
        rest.put('/api/gestores/' + id + '?token=' + tokenGlobal, datos, function(status) {
            if(status === 200) {
                alert("Datos guardados correctamente");
                document.getElementById('welcome-user').innerText = `Bienvenido ${datos.nombre} ${datos.apellidos}`;
                navegar('home-view');
            } else alert("Error: Revisa los datos (Quizás el usuario ya existe)");
        });
    } else {
        // En el registro también pasamos ?token= por si la ruta está debajo del middleware, y si está encima lo ignora sin dar error
        rest.post('/api/gestores?token=' + tokenGlobal, datos, function(status) {
            if(status === 201) {
                alert("Gestor registrado correctamente");
                navegar('login-view');
            } else alert("Error: Revisa los datos (Quizás el usuario ya existe)");
        });
    }
}

function cancelarGestor() {
    const id = document.getElementById('gestor-id').value;
    if (id) navegar('home-view'); 
    else navegar('login-view');
}

// EJERCICIO EXAMEN - CREAR UNA NUEVA CALIBRACIÓN
function crearCalibracion(){
    var recursoAct = document.getElementById('form-id').value;
    var superadoMetido = document.getElementById('ind-superado').value;
    var observacionMetido = document.getElementById('ind-observ').value;
    
    var datos = {
        superado: superadoMetido,
        observaciones: observacionMetido,
        recurso: recursoAct
    };

    rest.post('/api/calibraciones?token=' + tokenGlobal, datos, function(status) {
        if(status === 201) {
            alert("Calibracion registrada correctamente");
        } else alert("Error: Revisa los datos");
    });
}

// ==========================================
// PRÁCTICA 3 - MINISTERIO DE SANIDAD
// ==========================================

// Tu código asignado: 1 = Alergología
const MI_ID_AREA = 1;

// Diccionario oficial de Áreas Médicas según el PDF de la práctica
const AREAS_MEDICAS = {
    1: "Alergología",
    2: "Anestesiología",
    3: "Cardiología",
    4: "Cirugía General",
    5: "Dermatología",
    6: "Aparato Digestivo",
    7: "Endocrinología",
    8: "Ginecología",
    9: "Hematología",
    10: "Medicina Interna",
    11: "Neumología",
    12: "Neurología",
    13: "Oftalmología",
    14: "Oncología",
    15: "Pediatría",
    16: "Psiquiatría",
    17: "Traumatología",
    18: "Urología"
};

// Función auxiliar para convertir fechas a formato "YYYY-MM-DD" o devolver null
function formatearFechaYMD(fecha) {
    if (!fecha) return null;
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return null;
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}

// 1. FUNCIÓN PARA RECOPILAR LAS RESERVAS DEL HOSPITAL
function enviarReservasMinisterio() {
    rest.get('/api/recursos?token=' + tokenGlobal, function(status, recursos) {
        if (status !== 200 || !recursos) {
            alert("Error al obtener los recursos del hospital");
            return;
        }

        if (recursos.length === 0) {
            hacerPostMinisterio([]);
            return;
        }

        let listaReservas = [];
        let recursosProcesados = 0;

        recursos.forEach(r => {
            const modeloObj = estadoApp.maestros.mod.find(m => m.id == r.modelo);
            const catNombre = modeloObj 
                ? (estadoApp.maestros.cat.find(c => c.id == modeloObj.categoria)?.nombre || '-') 
                : '-';

            rest.get(`/api/recursos/${r.id}/reservas?token=${tokenGlobal}`, function(statusRes, reservas) {
                if (statusRes === 200 && Array.isArray(reservas)) {
                    reservas.forEach(res => {
                        let nombreSan = "";
                        let apellidosSan = "";

                        if (res.nombre && res.apellidos) {
                            nombreSan = res.nombre.replace(/^(Dr\.|Dra\.|Dr|Dra)\s+/i, "").trim();
                            apellidosSan = res.apellidos.trim();
                        } else if (res.nombreSanitario) {
                            // Quitamos "Dr.", "Dra.", "Dr" o "Dra" del principio
                            const limpio = res.nombreSanitario.trim().replace(/^(Dr\.|Dra\.|Dr|Dra)\s+/i, "").trim();
                            const partes = limpio.split(/\s+/);
                            nombreSan = partes[0] || "";
                            apellidosSan = partes.slice(1).join(" ") || "";
                        }

                        listaReservas.push({
                            "nombre": nombreSan,
                            "apellidos": apellidosSan,
                            "categoría": catNombre,
                            "horas_estimadas": res.horas_estimadas,
                            "fec_pet": formatearFechaYMD(res.fecha_peticion),
                            "fec_ini": res.fecha_inicio ? formatearFechaYMD(res.fecha_inicio) : null,
                            "fecha_fin": res.fecha_fin ? formatearFechaYMD(res.fecha_fin) : null
                        });
                    });
                }

                recursosProcesados++;

                if (recursosProcesados === recursos.length) {
                    hacerPostMinisterio(listaReservas);
                }
            });
        });
    });
}

// Función auxiliar que realiza el POST al servidor externo del Ministerio
function hacerPostMinisterio(arrayDatosReservas) {
    const objetoEnvio = {
        id_area: Number(MI_ID_AREA), // 1 = Alergología
        fecha: formatearFechaYMD(new Date()), // Formato YYYY-MM-DD
        datos: arrayDatosReservas
    };

    rest.post('https://undefined.ua.es/telemedicina/api/datos', objetoEnvio, function(status, response) {
        if (status === 200 || status === 201) {
            alert("Se han enviado " + arrayDatosReservas.length + " reservas correctamente al Ministerio de Sanidad");
            cargarRankingMinisterio();
        } else {
            alert("Error al enviar las reservas al Ministerio (Status: " + status + ")");
        }
    });
}

// 2. FUNCIÓN PARA HACER EL GET AL MINISTERIO Y PINTAR LA TABLA DE RANKING
function cargarRankingMinisterio() {
    rest.get('https://undefined.ua.es/telemedicina/api/datos', function(status, resultados) {
        if (status === 200 && resultados) {
            if (typeof resultados === "string") {
                try { resultados = JSON.parse(resultados); } catch (e) {}
            }

            const listaEnvios = Array.isArray(resultados) 
                ? resultados 
                : (resultados.datos || resultados.data || []);

            let conteoPorArea = {};

            for (let i = 0; i < listaEnvios.length; i++) {
                let envio = listaEnvios[i];
                if (!envio) continue;

                let idArea = Number(envio.id_area);
                let datosEnvio = envio.datos;

                if (typeof datosEnvio === "string") {
                    try { datosEnvio = JSON.parse(datosEnvio); } catch (e) { datosEnvio = []; }
                }

                if (AREAS_MEDICAS[idArea]) {
                    if (!conteoPorArea[idArea]) {
                        conteoPorArea[idArea] = 0;
                    }
                    if (Array.isArray(datosEnvio)) {
                        conteoPorArea[idArea] += datosEnvio.length;
                    }
                }
            }

            let listaRanking = [];
            for (let idArea in conteoPorArea) {
                listaRanking.push({
                    id_area: Number(idArea),
                    nombreArea: AREAS_MEDICAS[idArea],
                    totalReservas: conteoPorArea[idArea]
                });
            }

            listaRanking.sort((a, b) => b.totalReservas - a.totalReservas);

            const tbody = document.getElementById('tabla-ranking-ministerio');
            if (!tbody) return;

            tbody.innerHTML = '';
            listaRanking.forEach((item, index) => {
                tbody.innerHTML += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.nombreArea}</td>
                        <td>${item.totalReservas}</td>
                    </tr>
                `;
            });
        }
    });
}