import { ethers } from "hardhat";

async function main() {
  // Get contract address from command line arguments
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    console.error("❌ Please provide CONTRACT_ADDRESS environment variable");
    console.log("Usage: CONTRACT_ADDRESS=0x... npx hardhat run scripts/interact-vouchminimal.ts --network <network>");
    process.exit(1);
  }

  console.log("Interacting with VouchMinimal contract...");
  console.log("Contract address:", contractAddress);

  const [signer] = await ethers.getSigners();
  console.log("Signer address:", signer.address);

  // Connect to deployed contract
  const VouchMinimal = await ethers.getContractFactory("VouchMinimal");
  const vouchMinimal = VouchMinimal.attach(contractAddress);

  // Display contract info
  console.log("\n📊 Contract Information:");
  console.log("========================");
  console.log("DEFAULT_RANK:", (await vouchMinimal.DEFAULT_RANK()).toString());
  console.log("R (weight window):", (await vouchMinimal.R()).toString());
  console.log("BONUS_OUT:", (await vouchMinimal.BONUS_OUT()).toString());
  console.log("BONUS_CAP:", (await vouchMinimal.BONUS_CAP()).toString());

  // Check signer's node info
  console.log("\n👤 Your Node Information:");
  console.log("========================");
  const nodeInfo = await vouchMinimal.getNodeInfo(signer.address);
  console.log("Rank:", nodeInfo.rank.toString());
  console.log("Score:", nodeInfo.score.toString());
  console.log("Incoming vouches:", nodeInfo.inCount.toString());
  console.log("Outgoing vouches:", nodeInfo.outCount.toString());

  const connections = await vouchMinimal.getConnections(signer.address);
  console.log("\nIncoming neighbors:", connections.inNeighbors);
  console.log("Outgoing neighbors:", connections.outNeighbors);

  // Example: Create a vouch (commented out for safety)
  /*
  const targetAddress = "0x..."; // Replace with actual address
  console.log("\n📝 Creating vouch for:", targetAddress);
  
  const tx = await vouchMinimal.vouch(targetAddress);
  console.log("Transaction hash:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("✅ Vouch created successfully!");
  console.log("Gas used:", receipt?.gasUsed.toString());

  // Display updated info
  const updatedNode = await vouchMinimal.getNodeInfo(targetAddress);
  console.log("\n📊 Target's Updated Info:");
  console.log("Rank:", updatedNode.rank.toString());
  console.log("Score:", updatedNode.score.toString());
  */
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

