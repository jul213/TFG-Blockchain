// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TFG_CyberShield_V2
 * @author Julio Javier - TFG
 * @dev Oráculo de Seguridad Inmutable con Control de Acceso Granular y Auditoría Forense.
 */
contract TFG_CyberShield_V2 {
    
    // Enum para optimizar almacenamiento (1 byte en EVM)
    enum Severity { INFO, LOW, MEDIUM, HIGH, CRITICAL }

    struct SecurityLog {
        uint128 timestamp;    // Optimización de slots (uint128 + enum + address caben en 1 slot de 32 bytes)
        Severity severity;
        address reporter;
        bytes32 incidentHash; // Hash de la evidencia (Prueba de integridad)
    }

    address public owner;
    uint256 public incidentCount;
    bool public systemLock;

    // Control de acceso para múltiples servidores/sensores
    mapping(address => bool) public authorizedReporters;
    mapping(uint256 => SecurityLog) private _auditTrail;

    // Eventos optimizados para indexación en Grafana
    event IncidentReported(
        uint256 indexed id,
        address indexed reporter,
        Severity indexed severity,
        string category,
        string rawData
    );

    event ReporterStatusChanged(address indexed reporter, bool status);
    event EmergencyShutdown(address indexed triggeredBy, bool status);

    // --- MODIFICADORES ---

    modifier onlyOwner() {
        require(msg.sender == owner, "UNAUTHORIZED: Not Owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedReporters[msg.sender] || msg.sender == owner, "UNAUTHORIZED: Not a Reporter");
        _;
    }

    modifier isNotLocked() {
        require(!systemLock, "CRITICAL: System is Locked");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedReporters[msg.sender] = true;
    }

    /**
     * @notice Registra un evento de seguridad con hash de integridad.
     * @param _severity Gravedad del incidente (0-4).
     * @param _category Ejemplo: "DDoS", "SQL Injection", "Unauthorized Login".
     * @param _evidence La evidencia completa (se emite en evento, no se guarda en storage para ahorrar gas).
     */
    function reportIncident(
        Severity _severity,
        string calldata _category,
        string calldata _evidence
    ) external onlyAuthorized isNotLocked {
        incidentCount++;

        // PERSISTENCIA FORENSE MÍNIMA (Gas Efficient)
        // Guardamos el hash de la evidencia para que sea legalmente vinculante
        _auditTrail[incidentCount] = SecurityLog({
            timestamp: uint128(block.timestamp),
            severity: _severity,
            reporter: msg.sender,
            incidentHash: keccak256(abi.encodePacked(_evidence))
        });

        // EMISIÓN DE LOG PARA EL SOC (Grafana lee esto)
        emit IncidentReported(incidentCount, msg.sender, _severity, _category, _evidence);
    }

    // --- FUNCIONES DE GESTIÓN (ADMIN) ---

    function toggleReporter(address _reporter, bool _status) external onlyOwner {
        authorizedReporters[_reporter] = _status;
        emit ReporterStatusChanged(_reporter, _status);
    }

    function emergencyLock() external onlyOwner {
        systemLock = !systemLock;
        emit EmergencyShutdown(msg.sender, systemLock);
    }

    // --- CONSULTAS (VIEW) ---

    function getIncident(uint256 _id) external view returns (
        uint256 timestamp,
        Severity severity,
        address reporter,
        bytes32 integrityHash
    ) {
        SecurityLog memory log = _auditTrail[_id];
        require(log.timestamp != 0, "Incident does not exist");
        return (log.timestamp, log.severity, log.reporter, log.incidentHash);
    }
}
