var conexion = require("./conexion_mysql.js");
var express = require("express");
var cors = require("cors");
var app = express();
const jwt = require('jwt-simple');
const secreto = 'clave_secreta_telemedicina_ua';


app.use(cors());
app.use(express.json());
app.use(express.static('cliente_rest'));


app.post('/api/gestores/login', function(req, res) {
    var login = req.body.login;
    var password = req.body.password;

    conexion.query(
        'SELECT id FROM gestores WHERE usuario = ? AND password = ?',
        [login, password],
        function(err, rows) {
            if (err) {
                return res.status(500).json("Error en base de datos");
            }
            if (rows.length > 0) {
                var idGestor = rows[0].id;
                var token = jwt.encode(idGestor, secreto); // Creamos el token
                // IMPORTANTE: Devolver un objeto con id y token
                res.status(200).json({ id: idGestor, token: token });
            } else {
                res.status(401).json("Credenciales incorrectas");
            }
        }
    );
});


app.post("/api/gestores", function (req, res) {
    var gestor = req.body; 
    
    var sql = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES('" + gestor.nombre + "','" + gestor.apellidos + "','" + gestor.usuario + "','" + gestor.password + "')";
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el insert", err);
            if (err.code === 'ER_DUP_ENTRY') {
                res.status(400).json({error: "Usuario ya existe"});
            } else {
                res.status(500).json("Error al realizar la insercion");
            }
        } else {
            console.log("Gestor insertado:", resultado);
            res.status(201).json(resultado.insertId); 
        }
    });
});

// Middleware JWT: Todas las rutas debajo de esta línea requieren ?token=...
app.use('/api', function(req, res, next) {
    var token = req.query.token;
    if (!token) {
        return res.status(401).json("Falta el token");
    }
    try {
        var decoded = jwt.decode(token, secreto);
        next(); // Token correcto, dejamos pasar a la ruta
    } catch (err) {
        return res.status(403).json("Token no válido");
    }
});


app.put("/api/gestores/:id", function (req, res) {
    var idGestor = req.params.id;
    var gestor = req.body;
    
    var sql = "UPDATE gestores SET nombre = '" + gestor.nombre + "', apellidos = '" + gestor.apellidos + "', usuario = '" + gestor.usuario + "', password = '" + gestor.password + "' WHERE id = " + idGestor;
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el update", err);
            if (err.code === 'ER_DUP_ENTRY') {
                res.status(400).json({error: "Usuario ya existe"});
            } else {
                res.status(500).json("Error al realizar la actualización");
            }
        } else {
            console.log("Gestor actualizado:", resultado);
            res.status(200).json("Gestor actualizado");
        }
    });
});

app.get("/api/gestores/:id", function (req, res) {
    var idGestor = req.params.id;
    var sql = "SELECT id, nombre, apellidos, usuario FROM gestores WHERE id = " + idGestor;
    
    conexion.query(sql, function (err, gestores) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (gestores.length === 1) {
                console.log("Gestor:", gestores[0]);
                res.status(200).json(gestores[0]);
            } else {
                console.log("No se ha encontrado el gestor con id:", idGestor);
                res.status(404).json("No se ha encontrado el gestor");
            }
        }
    });
});


app.get("/api/sanitarios/:id", function (req, res) {
    var idSanitario = req.params.id;
    var sql = "SELECT id, nombre, apellidos, usuario FROM sanitarios WHERE id = " + idSanitario;
    
    conexion.query(sql, function (err, sanitarios) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (sanitarios.length === 1) {
                console.log("Sanitario:", sanitarios[0]);
                res.status(200).json(sanitarios[0]);
            } else {
                console.log("No se ha encontrado el sanitario con id:", idSanitario);
                res.status(404).json("No se ha encontrado el sanitario");
            }
        }
    });
});


app.get("/api/ubicaciones", function (req, res) {
    var sql = "SELECT * FROM ubicaciones";
    conexion.query(sql, function (err, ubicaciones) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            console.log("Ubicaciones:", ubicaciones);
            res.json(ubicaciones); // Devuelve todo el array
        }
    });
});

app.get("/api/categorias", function (req, res) {
    var sql = "SELECT * FROM categorias";
    conexion.query(sql, function (err, categorias) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            console.log("Categorias:", categorias);
            res.json(categorias);
        }
    });
});

app.get("/api/modelos", function (req, res) {
    var sql = "SELECT * FROM modelos";
    conexion.query(sql, function (err, modelos) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            console.log("Modelos:", modelos);
            res.json(modelos);
        }
    });
});


app.get("/api/recursos", function (req, res) {
    var sql = "SELECT r.* FROM recursos r";
    var hasWhere = false;

    if (req.query.categoria && req.query.categoria !== 'Todos') {
        sql += " JOIN modelos m ON r.modelo = m.id WHERE m.categoria = " + req.query.categoria;
        hasWhere = true; 
    }

    if (req.query.modelo && req.query.modelo !== 'Todos') {
        if (hasWhere) {
            sql += " AND r.modelo = " + req.query.modelo;
        } else {
            sql += " WHERE r.modelo = " + req.query.modelo;
            hasWhere = true;
        }
    }

    if (req.query.ubicacion && req.query.ubicacion !== 'Todos') {
        if (hasWhere) {
            sql += " AND r.ubicacion = " + req.query.ubicacion;
        } else {
            sql += " WHERE r.ubicacion = " + req.query.ubicacion;
            hasWhere = true;
        }
    }

    if (req.query.estado && req.query.estado !== 'Todos') {
        if (hasWhere) {
            sql += " AND r.estado = " + req.query.estado;
        } else {
            sql += " WHERE r.estado = " + req.query.estado;
            hasWhere = true;
        }
    }

    conexion.query(sql, function (err, recursos) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            console.log("Recursos filtrados:", recursos);
            res.json(recursos); 
        }
    });
});


app.get("/api/recursos/:id", function (req, res) {
    var idRecurso = req.params.id;
    var sql = "SELECT * FROM recursos WHERE id = " + idRecurso;
    
    conexion.query(sql, function (err, recursos) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (recursos.length === 1) {
                console.log("Recurso:", recursos[0]);
                res.status(200).json(recursos[0]);
            } else {
                console.log("No se ha encontrado el recurso con id:", idRecurso);
                res.status(404).json("No se ha encontrado el recurso");
            }
        }
    });
});

app.post("/api/recursos", function (req, res) {
    var recurso = req.body;
    var sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES(" + recurso.modelo + "," + recurso.ubicacion + ",'" + recurso.numero_serie + "'," + recurso.estado + ")";
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el insert", err);
            res.status(500).json("Error al realizar la insercion");
        } else {
            console.log("Recurso insertado:", resultado);
            res.status(201).json(resultado.insertId);
        }
    });
});

app.put("/api/recursos/:id", function (req, res) {
    var idRecurso = req.params.id;
    var recurso = req.body;
    var sql = "UPDATE recursos SET modelo = " + recurso.modelo + ", ubicacion = " + recurso.ubicacion + ", numero_serie = '" + recurso.numero_serie + "', estado = " + recurso.estado + " WHERE id = " + idRecurso;
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el update", err);
            res.status(500).json("Error al realizar la actualización");
        } else {
            if (resultado.affectedRows === 0) {
                console.log("No se ha encontrado el recurso con id:", idRecurso);
                res.status(404).json("No se ha encontrado el recurso");
            } else {
                console.log("Recurso actualizado:", resultado);
                res.status(200).json("Recurso actualizado");
            }
        }
    });
});

app.delete("/api/recursos/:id", function (req, res) {
    var idRecurso = req.params.id;
    var sql = "DELETE FROM recursos WHERE id = " + idRecurso;
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el delete", err);
            res.status(500).json("Error al realizar el borrado");
        } else {
            if (resultado.affectedRows === 0) {
                console.log("No se ha encontrado el recurso con id:", idRecurso);
                res.status(404).json("No se ha encontrado el recurso");
            } else {
                console.log("Recurso borrado:", resultado);
                res.status(200).json("Recurso eliminado");
            }
        }
    });
});

app.get("/api/recursos/:id/reservas", function (req, res) {
    var idRecurso = req.params.id;
    var sql = "SELECT r.*, CONCAT(s.nombre, ' ', s.apellidos) AS nombreSanitario FROM reservas r JOIN sanitarios s ON r.sanitario = s.id WHERE r.recurso = " + idRecurso;
    
    conexion.query(sql, function (err, reservas) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (reservas.length === 0) {
                var sqlRecurso = "SELECT id FROM recursos WHERE id = " + idRecurso;
                conexion.query(sqlRecurso, function(err2, recursos){
                    if (err2) {
                        console.log("Error al realizar la select", err2);
                        res.status(500).json("Error al realizar la consulta");
                    } else if (recursos.length === 0) {
                        console.log("No se ha encontrado el recurso con id:", idRecurso);
                        res.status(404).json("No se ha encontrado el recurso");
                    } else {
                        console.log("Reservas (vacio):", reservas);
                        res.json(reservas);
                    }
                });
            } else {
                console.log("Reservas:", reservas);
                res.json(reservas);
            }
        }
    });
});


app.get("/api/recursos/:id/resenyas", function (req, res) {
    var idRecurso = req.params.id;
    var sql = "SELECT r.*, CONCAT(s.nombre, ' ', s.apellidos) AS nombreSanitario FROM resenyas r JOIN sanitarios s ON r.sanitario = s.id WHERE r.recurso = " + idRecurso;
    
    conexion.query(sql, function (err, resenyas) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (resenyas.length === 0) {
                var sqlRecurso = "SELECT id FROM recursos WHERE id = " + idRecurso;
                conexion.query(sqlRecurso, function(err2, recursos){
                    if (err2) {
                        console.log("Error al realizar la select", err2);
                        res.status(500).json("Error al realizar la consulta");
                    } else if (recursos.length === 0) {
                        console.log("No se ha encontrado el recurso con id:", idRecurso);
                        res.status(404).json("No se ha encontrado el recurso");
                    } else {
                        console.log("Reseñas (vacio):", resenyas);
                        res.json(resenyas); 
                    }
                });
            } else {
                console.log("Reseñas:", resenyas);
                res.json(resenyas);
            }
        }
    });
});

//EJERCICIO EXAMEN
//CREAR UNA CALIBRACION
app.post("/api/calibraciones", function(req,res){
    var calibracion = req.body;
    var sql = "INSERT INTO calibraciones (fecha, superado, observaciones, recurso) VALUES (NOW()," + calibracion.superado + ",'"+ calibracion.observaciones + "'," + calibracion.recurso + ")";

    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el insert", err);
            res.status(500).json("Error al realizar la insercion");
        } else {
            console.log("Calibracion insertada:", resultado);
            res.status(201).json(resultado.insertId);
        }
    });
});

app.listen(3000, function () {
    console.log("Servidor REST de Telemedicina en el puerto 3000");
});
