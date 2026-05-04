// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Sistema de Certificación de Notas Inmutables
 * @dev Contrato para el registro y verificación de calificaciones académicas en Blockchain (TFG)
 */
contract Notas {
    // El administrador será la cuenta que despliega el contrato
    address public administrador;

    struct Certificado {
        string estudiante;
        string asignatura;
        uint256 nota;
        uint256 fecha;
        address emisor; // Registra la billetera del profesor que puso la nota
        bool existe;    // Bandera de seguridad para comprobaciones
    }

    // Mapeo principal para guardar los certificados
    mapping(bytes32 => Certificado) private certificados;
    
    // Control de acceso: Solo profesores autorizados pueden emitir notas
    mapping(address => bool) public profesoresAutorizados;

    // --- EVENTOS ---
    // Claves para que el Backend y el Frontend sepan al instante que se ha guardado
    event CertificadoEmitido(
        bytes32 indexed hashId,
        string estudiante,
        string asignatura,
        uint256 nota,
        uint256 fecha,
        address emisor
    );

    // --- MODIFICADORES ---
    modifier soloProfesor() {
        require(profesoresAutorizados[msg.sender] || msg.sender == administrador, "Acceso denegado: Solo el administrador o profesores autorizados");
        _;
    }

    // --- CONSTRUCTOR ---
    constructor() {
        administrador = msg.sender;
        profesoresAutorizados[msg.sender] = true; // El que despliega tiene permisos por defecto
    }

    // --- FUNCIONES PRINCIPALES ---

    /**
     * @dev Registra una nueva calificación en la blockchain.
     */
    function emitirCertificado(string memory _estudiante, string memory _asignatura, uint256 _nota) public soloProfesor returns (bytes32) {
        // 1. Validaciones de seguridad (Evita que se guarden datos vacíos o notas imposibles)
        require(bytes(_estudiante).length > 0, "El nombre del estudiante no puede estar vacio");
        require(bytes(_asignatura).length > 0, "La asignatura no puede estar vacia");
        require(_nota <= 10, "La nota no puede ser mayor a 10"); 

        // 2. Generación de un Hash Único e Irrepetible
        bytes32 hashId = keccak256(abi.encodePacked(_estudiante, _asignatura, _nota, block.timestamp, msg.sender));

        // 3. Almacenamiento Inmutable
        certificados[hashId] = Certificado({
            estudiante: _estudiante,
            asignatura: _asignatura,
            nota: _nota,
            fecha: block.timestamp,
            emisor: msg.sender,
            existe: true
        });

        // 4. Emitimos el evento para la web
        emit CertificadoEmitido(hashId, _estudiante, _asignatura, _nota, block.timestamp, msg.sender);

        return hashId;
    }

    /**
     * @dev Recupera los datos de un certificado para el código QR y validación pública.
     */
    function verificarCertificado(bytes32 _hashId) public view returns (string memory, string memory, uint256, uint256, address) {
        require(certificados[_hashId].existe, "Error: El certificado no existe o el hash es invalido");
        
        Certificado memory cert = certificados[_hashId];
        return (cert.estudiante, cert.asignatura, cert.nota, cert.fecha, cert.emisor);
    }
}
