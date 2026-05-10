// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AuditTrail
 * @dev Registro mínimo de trazabilidad administrativa para operaciones sensibles.
 */
contract AuditTrail {
    address public owner;

    struct AuditEntry {
        string action;
        string subject;
        string outcome;
        string metadata;
        address actor;
        uint256 timestamp;
    }

    AuditEntry[] private entries;

    event ActionRecorded(
        uint256 indexed entryId,
        string action,
        string subject,
        string outcome,
        address indexed actor,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "AuditTrail: only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function recordAction(
        string memory action,
        string memory subject,
        string memory outcome,
        string memory metadata
    ) public onlyOwner returns (uint256) {
        entries.push(AuditEntry({
            action: action,
            subject: subject,
            outcome: outcome,
            metadata: metadata,
            actor: msg.sender,
            timestamp: block.timestamp
        }));

        uint256 entryId = entries.length - 1;
        emit ActionRecorded(entryId, action, subject, outcome, msg.sender, block.timestamp);
        return entryId;
    }

    function totalEntries() public view returns (uint256) {
        return entries.length;
    }

    function getEntry(uint256 index) public view returns (
        string memory action,
        string memory subject,
        string memory outcome,
        string memory metadata,
        address actor,
        uint256 timestamp
    ) {
        require(index < entries.length, "AuditTrail: index out of bounds");
        AuditEntry memory entry = entries[index];
        return (
            entry.action,
            entry.subject,
            entry.outcome,
            entry.metadata,
            entry.actor,
            entry.timestamp
        );
    }
}
