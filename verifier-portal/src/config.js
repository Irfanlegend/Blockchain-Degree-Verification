// 🔥 REPLACE WITH YOUR DEPLOYED CONTRACT ADDRESS!
export const CONTRACT_ADDRESS = "0xeE84602e54AdaA678aD8445940d81A1c3cb20cAb";

export const CONTRACT_ABI = [
  "function verifyCredential(bytes32 _credentialHash) public view returns (bool, bool, address, address, string, uint256, string)",
  "function isCredentialValid(bytes32 _credentialHash) public view returns (bool)"
];

export const POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";