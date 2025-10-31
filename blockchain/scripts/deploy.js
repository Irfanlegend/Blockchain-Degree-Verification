const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying CredentialRegistry to Polygon Mumbai...\n");
  
  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await deployer.getBalance();
  console.log("💰 Account balance:", hre.ethers.utils.formatEther(balance), "MATIC\n");
  
  if (balance.lt(hre.ethers.utils.parseEther("0.1"))) {
    console.log("⚠️  WARNING: Low balance! Get testnet MATIC from https://faucet.polygon.technology\n");
  }
  
  // Deploy contract
  console.log("⏳ Deploying contract...");
  const CredentialRegistry = await hre.ethers.getContractFactory("CredentialRegistry");
  const registry = await CredentialRegistry.deploy();
  
  await registry.deployed();
  
  console.log("✅ CredentialRegistry deployed successfully!\n");
  console.log("📍 Contract Address:", registry.address);
  console.log("🔗 View on Explorer:", `https://mumbai.polygonscan.com/address/${registry.address}`);
  console.log("\n🔥 IMPORTANT: Save this address! You'll need it for frontend apps.\n");
  
  // Verify deployer is registered as issuer
  const issuerInfo = await registry.getIssuerInfo(deployer.address);
  console.log("👤 Auto-registered as issuer:");
  console.log("   Name:", issuerInfo[0]);
  console.log("   DID:", issuerInfo[1]);
  console.log("   Authorized:", issuerInfo[2]);
  
  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    contractAddress: registry.address,
    deployer: deployer.address,
    network: "Polygon Mumbai",
    timestamp: new Date().toISOString(),
    explorerUrl: `https://amoy.polygonscan.com/address/${registry.address}`
  };
  
  fs.writeFileSync(
    'deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n📄 Deployment info saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });