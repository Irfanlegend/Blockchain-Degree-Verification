// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CredentialRegistry
 * @dev Stores and verifies educational credentials on Polygon blockchain
 * @notice Based on W3C Verifiable Credentials Data Model 2.0
 * Reference: https://www.w3.org/TR/2025/REC-vc-data-model-2.0-20250515/
 */
contract CredentialRegistry {
    
    // ========== DATA STRUCTURES ==========
    
    struct Credential {
        bytes32 credentialHash;      // SHA-256 hash of credential data
        address issuer;              // University wallet address
        address holder;              // Student wallet address (optional)
        uint256 issuedDate;         // Unix timestamp
        string credentialType;       // e.g., "BachelorDegree", "MasterDegree"
        bool isValid;               // Can be revoked by issuer
        string issuerDID;           // Decentralized Identifier of issuer
    }
    
    struct Issuer {
        string name;                // University name
        string did;                 // Decentralized Identifier
        bool isAuthorized;         // Authorization status
        uint256 registeredDate;    // When issuer was registered
    }
    
    // ========== STATE VARIABLES ==========
    
    mapping(bytes32 => Credential) public credentials;
    mapping(address => Issuer) public issuers;
    mapping(address => bytes32[]) public holderCredentials; // Student's all credentials
    
    address public admin;
    uint256 public totalCredentialsIssued;
    uint256 public totalIssuers;
    
    // ========== EVENTS ==========
    
    event IssuerRegistered(address indexed issuerAddress, string name, string did);
    event CredentialIssued(
        bytes32 indexed credentialHash,
        address indexed issuer,
        address indexed holder,
        string credentialType
    );
    event CredentialRevoked(bytes32 indexed credentialHash, address indexed issuer);
    event CredentialVerified(bytes32 indexed credentialHash, bool isValid);
    
    // ========== MODIFIERS ==========
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier onlyAuthorizedIssuer() {
        require(issuers[msg.sender].isAuthorized, "Not an authorized issuer");
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    
    constructor() {
        admin = msg.sender;
        
        // Auto-authorize deployer as first issuer
        issuers[msg.sender] = Issuer({
            name: "Admin University",
            did: "did:polygon:admin",
            isAuthorized: true,
            registeredDate: block.timestamp
        });
        totalIssuers = 1;
    }
    
    // ========== ISSUER MANAGEMENT ==========
    
    /**
     * @dev Register a new university/issuer
     * @param _issuerAddress Wallet address of university
     * @param _name University name
     * @param _did Decentralized Identifier (DID)
     */
    function registerIssuer(
        address _issuerAddress,
        string memory _name,
        string memory _did
    ) public onlyAdmin {
        require(!issuers[_issuerAddress].isAuthorized, "Issuer already registered");
        
        issuers[_issuerAddress] = Issuer({
            name: _name,
            did: _did,
            isAuthorized: true,
            registeredDate: block.timestamp
        });
        
        totalIssuers++;
        emit IssuerRegistered(_issuerAddress, _name, _did);
    }
    
    /**
     * @dev Authorize yourself as issuer (for testing)
     */
    function selfRegisterIssuer(string memory _name, string memory _did) public {
        require(!issuers[msg.sender].isAuthorized, "Already registered");
        
        issuers[msg.sender] = Issuer({
            name: _name,
            did: _did,
            isAuthorized: true,
            registeredDate: block.timestamp
        });
        
        totalIssuers++;
        emit IssuerRegistered(msg.sender, _name, _did);
    }
    
    /**
     * @dev Revoke issuer authorization
     */
    function revokeIssuer(address _issuerAddress) public onlyAdmin {
        require(issuers[_issuerAddress].isAuthorized, "Issuer not found");
        issuers[_issuerAddress].isAuthorized = false;
    }
    
    // ========== CREDENTIAL ISSUANCE ==========
    
    /**
     * @dev Issue a single credential
     * @param _credentialHash SHA-256 hash of credential data
     * @param _holder Student wallet address (use address(0) if unknown)
     * @param _credentialType Type of credential (e.g., "BachelorDegree")
     */
    function issueCredential(
        bytes32 _credentialHash,
        address _holder,
        string memory _credentialType
    ) public onlyAuthorizedIssuer {
        require(credentials[_credentialHash].issuedDate == 0, "Credential already exists");
        
        credentials[_credentialHash] = Credential({
            credentialHash: _credentialHash,
            issuer: msg.sender,
            holder: _holder,
            issuedDate: block.timestamp,
            credentialType: _credentialType,
            isValid: true,
            issuerDID: issuers[msg.sender].did
        });
        
        // Add to holder's credential list if holder address provided
        if (_holder != address(0)) {
            holderCredentials[_holder].push(_credentialHash);
        }
        
        totalCredentialsIssued++;
        emit CredentialIssued(_credentialHash, msg.sender, _holder, _credentialType);
    }
    
    /**
     * @dev Batch issue multiple credentials (for CSV upload)
     * @param _credentialHashes Array of credential hashes
     * @param _holders Array of holder addresses
     * @param _credentialTypes Array of credential types
     */
    function batchIssueCredentials(
        bytes32[] memory _credentialHashes,
        address[] memory _holders,
        string[] memory _credentialTypes
    ) public onlyAuthorizedIssuer {
        require(
            _credentialHashes.length == _holders.length &&
            _holders.length == _credentialTypes.length,
            "Array lengths must match"
        );
        
        for (uint256 i = 0; i < _credentialHashes.length; i++) {
            if (credentials[_credentialHashes[i]].issuedDate == 0) {
                issueCredential(_credentialHashes[i], _holders[i], _credentialTypes[i]);
            }
        }
    }
    
    // ========== CREDENTIAL VERIFICATION ==========
    
    /**
     * @dev Verify a credential's authenticity
     * @param _credentialHash Hash of credential to verify
     * @return exists Whether credential exists on blockchain
     * @return isValid Whether credential is still valid (not revoked)
     * @return issuer Address of issuing university
     * @return holder Address of credential holder
     * @return credentialType Type of credential
     * @return issuedDate When credential was issued
     * @return issuerName Name of issuing university
     */
    function verifyCredential(bytes32 _credentialHash) 
        public 
        view 
        returns (
            bool exists,
            bool isValid,
            address issuer,
            address holder,
            string memory credentialType,
            uint256 issuedDate,
            string memory issuerName
        ) 
    {
        Credential memory cred = credentials[_credentialHash];
        
        exists = cred.issuedDate != 0;
        isValid = cred.isValid;
        issuer = cred.issuer;
        holder = cred.holder;
        credentialType = cred.credentialType;
        issuedDate = cred.issuedDate;
        issuerName = issuers[cred.issuer].name;
        
        return (exists, isValid, issuer, holder, credentialType, issuedDate, issuerName);
    }
    
    /**
     * @dev Quick validity check
     */
    function isCredentialValid(bytes32 _credentialHash) public view returns (bool) {
        return credentials[_credentialHash].issuedDate != 0 && 
               credentials[_credentialHash].isValid;
    }
    
    // ========== CREDENTIAL REVOCATION ==========
    
    /**
     * @dev Revoke a credential (only by issuer)
     * @param _credentialHash Hash of credential to revoke
     */
    function revokeCredential(bytes32 _credentialHash) public {
        require(credentials[_credentialHash].issuer == msg.sender, "Only issuer can revoke");
        require(credentials[_credentialHash].isValid, "Credential already revoked");
        
        credentials[_credentialHash].isValid = false;
        emit CredentialRevoked(_credentialHash, msg.sender);
    }
    
    // ========== QUERY FUNCTIONS ==========
    
    /**
     * @dev Get all credentials for a holder
     */
    function getHolderCredentials(address _holder) public view returns (bytes32[] memory) {
        return holderCredentials[_holder];
    }
    
    /**
     * @dev Get issuer details
     */
    function getIssuerInfo(address _issuerAddress) 
        public 
        view 
        returns (
            string memory name,
            string memory did,
            bool isAuthorized,
            uint256 registeredDate
        ) 
    {
        Issuer memory issuer = issuers[_issuerAddress];
        return (issuer.name, issuer.did, issuer.isAuthorized, issuer.registeredDate);
    }
    
    /**
     * @dev Get platform statistics
     */
    function getStats() 
        public 
        view 
        returns (
            uint256 _totalCredentials,
            uint256 _totalIssuers
        ) 
    {
        return (totalCredentialsIssued, totalIssuers);
    }
}