import { ethers, run, network } from "hardhat";

async function main() {
  console.log("Starting VouchMinimal deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy VouchMinimal
  console.log("\nDeploying VouchMinimal contract...");
  const VouchMinimal = await ethers.getContractFactory("VouchMinimal");
  const vouchMinimal = await VouchMinimal.deploy();
  
  await vouchMinimal.waitForDeployment();
  const address = await vouchMinimal.getAddress();

  console.log("✅ VouchMinimal deployed to:", address);

  // Save deployment info
  const networkName = (await ethers.provider.getNetwork()).name;
  const chainId = (await ethers.provider.getNetwork()).chainId;
  
  console.log("\n📝 Deployment Summary:");
  console.log("========================");
  console.log("Contract: VouchMinimal");
  console.log("Address:", address);
  console.log("Network:", networkName);
  console.log("Chain ID:", chainId);
  console.log("Deployer:", deployer.address);
  console.log("Block Number:", await ethers.provider.getBlockNumber());
  console.log("========================");

  // Skip verification for localhost/hardhat networks
  if (network.name === "localhost" || network.name === "hardhat") {
    console.log("\n⚠️  Local network detected - skipping verification");
    console.log("Deployment complete!");
    return;
  }

  // Wait for block confirmations before verification
  console.log("\n⏳ Waiting for block confirmations before verification...");
  const confirmations = chainId === 1n ? 6 : 5; // More confirmations for mainnet
  await vouchMinimal.deploymentTransaction()?.wait(Number(confirmations));
  console.log(`✅ Waited for ${confirmations} confirmations`);

  // Automatic verification
  console.log("\n🔍 Starting automatic verification...");
  console.log("This may take a minute...");
  
  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    console.log("✅ Contract verified successfully!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract is already verified!");
    } else if (error.message.includes("does not have bytecode")) {
      console.log("⚠️  Verification skipped - contract not yet indexed by block explorer");
      console.log("   Please wait a minute and verify manually:");
      console.log(`   npx hardhat verify --network ${network.name} ${address}`);
    } else {
      console.log("⚠️  Verification failed:", error.message);
      console.log("\n   You can verify manually with:");
      console.log(`   npx hardhat verify --network ${network.name} ${address}`);
    }
  }

  console.log("\n🎉 Deployment and verification complete!");
  console.log("\n📋 Next Steps:");
  console.log("1. Interact with your contract:");
  console.log(`   CONTRACT_ADDRESS=${address} npx hardhat run scripts/interact-vouchminimal.ts --network ${network.name}`);
  console.log("\n2. Query the network:");
  console.log(`   CONTRACT_ADDRESS=${address} npm run query:network -- --network ${network.name}`);
  console.log("\nNote: VouchMinimal uses a bootstrap mechanism - the first 4 vouches automatically seed the network.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

