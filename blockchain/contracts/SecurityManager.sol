// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SecurityManager
 * @dev Gestiona roles, permisos y auditoría de seguridad para el TFG.
 */
contract SecurityManager {
    address public owner;
    bool public systemPaused;

    // Roles definidos con Hashes (Estándar profesional)
    bytes32 public constant ROLE_PROFESOR = keccak256("ROLE_PROFESOR");
    bytes32 public constant ROLE_AUDITOR = keccak256("ROLE_AUDITOR");

    struct UserInfo {
        bool active;
        bytes32 role;
        uint256 lastAction;
    }

    mapping(address => UserInfo) public users;

    // --- EVENTOS DETALLADOS PARA EL SOC ---
    event SecurityAlert(address indexed intruder, string detail, uint256 severity);
    event RoleGranted(address indexed account, bytes32 indexed role, address indexed granter);
    event RoleRevoked(address indexed account, bytes32 indexed role, address indexed revoker);
    event EmergencyStop(address indexed admin, bool status);

    // --- MODIFICADORES ---
    modifier onlyOwner() {
        if (msg.sender != owner) {
            emit SecurityAlert(msg.sender, "UNAUTHORIZED_ADMIN_ACCESS", 3); // Severidad 3 (Alta)
            revert("SecurityManager: Caller is not the owner");
        }
        _;
    }

    modifier onlyRole(bytes32 _role) {
        require(!systemPaused, "SecurityManager: System is paused");
        if (users[msg.sender].role != _role && msg.sender != owner) {
            emit SecurityAlert(msg.sender, "UNAUTHORIZED_ROLE_ACCESS", 2); // Severidad 2 (Media)
            revert("SecurityManager: Missing required role");
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        users[msg.sender] = UserInfo(true, ROLE_PROFESOR, block.timestamp);
        emit RoleGranted(msg.sender, ROLE_PROFESOR, msg.sender);
    }

    // --- FUNCIONES DE GESTIÓN ---

    function grantRole(address _account, bytes32 _role) public onlyOwner {
        users[_account] = UserInfo(true, _role, block.timestamp);
        emit RoleGranted(_account, _role, msg.sender);
    }

    function revokeRole(address _account) public onlyOwner {
        bytes32 oldRole = users[_account].role;
        users[_account].active = false;
        users[_account].role = 0x0;
        emit RoleRevoked(_account, oldRole, msg.sender);
    }

    // "Panic Button" para tu SOC: Si el SOC detecta un ataque masivo, el Admin pausa todo
    function setEmergencyPause(bool _status) public onlyOwner {
        systemPaused = _status;
        emit EmergencyStop(msg.sender, _status);
    }

    function checkAccess(address _user, bytes32 _role) public view returns (bool) {
        return (users[_user].active && users[_user].role == _role);
    }
}
