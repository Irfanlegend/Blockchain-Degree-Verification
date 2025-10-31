export const CONTRACT_ADDRESS = "0xeE84602e54AdaA678aD8445940d81A1c3cb20cAb";

export const CONTRACT_ABI = [
  "function selfRegisterIssuer(string memory _name, string memory _did) public",
  "function issueCredential(bytes32 _credentialHash, address _holder, string memory _credentialType) public",
  "function batchIssueCredentials(bytes32[] memory _credentialHashes, address[] memory _holders, string[] memory _credentialTypes) public",
  "function verifyCredential(bytes32 _credentialHash) public view returns (bool, bool, address, address, string, uint256, string)",
  "function getIssuerInfo(address _issuerAddress) public view returns (string, string, bool, uint256)",
  "function getStats() public view returns (uint256, uint256)",
  "function issuers(address) public view returns (string, string, bool, uint256)"
];

export const POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";
export const AMOY_CHAIN_ID = 80002;