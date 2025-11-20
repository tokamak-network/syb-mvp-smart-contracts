import { ethers, run, network } from "hardhat";

async function main() {
  console.log("Starting VouchMinimal deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Configuration
  // DepositManager contract address on your network
  const DEPOSIT_MANAGER_ADDRESS = process.env.DEPOSIT_MANAGER_ADDRESS || "0x90ffcc7F168DceDBEF1Cb6c6eB00cA73F922956F";
  // Minimum stake required (default: 0 for no minimum requirement)
  const MINIMUM_STAKE = process.env.MINIMUM_STAKE || "0";

  console.log("\n📋 Configuration:");
  console.log("DepositManager Address:", DEPOSIT_MANAGER_ADDRESS);
  console.log("Minimum Stake Required:", MINIMUM_STAKE, "WTON");

  // Deploy VouchMinimal
  console.log("\nDeploying VouchMinimal contract...");
  const VouchMinimal = await ethers.getContractFactory("VouchMinimal");
  const vouchMinimal = await VouchMinimal.deploy(DEPOSIT_MANAGER_ADDRESS, MINIMUM_STAKE);
  
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
      constructorArguments: [DEPOSIT_MANAGER_ADDRESS, MINIMUM_STAKE],
    });
    console.log("✅ Contract verified successfully!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract is already verified!");
    } else if (error.message.includes("does not have bytecode")) {
      console.log("⚠️  Verification skipped - contract not yet indexed by block explorer");
      console.log("   Please wait a minute and verify manually:");
      console.log(`   npx hardhat verify --network ${network.name} ${address} ${DEPOSIT_MANAGER_ADDRESS} ${MINIMUM_STAKE}`);
    } else {
      console.log("⚠️  Verification failed:", error.message);
      console.log("\n   You can verify manually with:");
      console.log(`   npx hardhat verify --network ${network.name} ${address} ${DEPOSIT_MANAGER_ADDRESS} ${MINIMUM_STAKE}`);
    }
  }

  console.log("\n🎉 Deployment and verification complete!");
  console.log("\n📋 Next Steps:");
  console.log("1. Interact with your contract:");
  console.log(`   CONTRACT_ADDRESS=${address} npx hardhat run scripts/interact-vouchminimal.ts --network ${network.name}`);
  console.log("\n2. Query the network:");
  console.log(`   CONTRACT_ADDRESS=${address} npm run query:network -- --network ${network.name}`);
  console.log("\n⚠️  Important Notes:");
  console.log("• VouchMinimal uses a bootstrap mechanism - the first 5 vouches automatically seed the network.");
  console.log("• Users must have staked tokens in the DepositManager to vouch.");
  console.log(`• Minimum stake required: ${MINIMUM_STAKE} WTON`);
  console.log(`• DepositManager: ${DEPOSIT_MANAGER_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

