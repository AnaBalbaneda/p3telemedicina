const mysql = require('mysql');

const database = {
    host: 'localhost',
    user: 'tele2026', // Usuario por defecto en XAMPP
    password: '2026tele', 
    database: 'telemedicina2026'
};

const conexion = mysql.createConnection(database);

conexion.connect(function (err) {
    if (err) {
        console.error('Error en la conexión de la base de datos:', err);
        process.exit(1);
    }
    console.log('Conectado correctamente a la base de datos telemedicina2026');
});

module.exports = conexion;