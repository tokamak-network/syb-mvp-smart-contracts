import { ethers } from "hardhat";

/**
 * Sepolia Network Setup Script
 * 
 * This script:
 * 1. Creates new wallets
 * 2. Shows funding instructions
 * 3. Creates vouches between wallets to bootstrap the network
 * 4. Displays the network graph
 */

interface WalletInfo {
  address: string;
  privateKey: string;
  balance: string;
}

async function main() {
  console.log("🚀 Sepolia Network Setup Script");
  console.log("================================\n");

  // Get contract address from environment
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error("❌ Please provide CONTRACT_ADDRESS environment variable");
    console.log("Usage: CONTRACT_ADDRESS=0x... npx hardhat run scripts/setup-sepolia-network.ts --network sepolia");
    process.exit(1);
  }

  const network = await ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name}`);
  console.log(`📋 Chain ID: ${network.chainId}`);
  console.log(`📍 Contract: ${contractAddress}\n`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log("👤 Deployer Account:");
  console.log(`   Address: ${deployer.address}`);
  console.log(`   Balance: ${ethers.formatEther(deployerBalance)} ETH\n`);

  // ============================================
  // STEP 1: Create New Wallets
  // ============================================
  console.log("🔑 Creating 5 new wallets...\n");
  
  const wallets: WalletInfo[] = [];
  for (let i = 0; i < 5; i++) {
    const wallet = ethers.Wallet.createRandom();
    const balance = await ethers.provider.getBalance(wallet.address);
    
    wallets.push({
      address: wallet.address,
      privateKey: wallet.privateKey,
      balance: ethers.formatEther(balance),
    });
    
    console.log(`Wallet ${i + 1}:`);
    console.log(`   Address: ${wallet.address}`);
    console.log(`   Private Key: ${wallet.privateKey}`);
    console.log(`   Current Balance: ${ethers.formatEther(balance)} ETH`);
    console.log("");
  }

  // ============================================
  // STEP 2: Funding Instructions
  // ============================================
  console.log("💰 Funding Instructions:");
  console.log("================================\n");
  
  if (network.name === "sepolia") {
    console.log("To fund these wallets on Sepolia:");
    console.log("1. Use a Sepolia faucet:");
    console.log("   - https://sepoliafaucet.com/");
    console.log("   - https://faucet.quicknode.com/ethereum/sepolia");
    console.log("   - https://sepolia-faucet.pk910.de/\n");
    
    console.log("2. Or send ETH from deployer:");
    const totalNeeded = ethers.parseEther("0.01"); // 0.01 ETH per wallet
    const totalNeededForAll = totalNeeded * BigInt(wallets.length);
    
    if (deployerBalance >= totalNeededForAll) {
      console.log(`   Deployer has enough balance to fund all wallets (${ethers.formatEther(totalNeededForAll)} ETH needed)`);
      console.log("\n   Funding wallets now...\n");
      
      // Fund each wallet
      for (let i = 0; i < wallets.length; i++) {
        const tx = await deployer.sendTransaction({
          to: wallets[i].address,
          value: totalNeeded,
        });
        console.log(`   Funding wallet ${i + 1}... tx: ${tx.hash}`);
        await tx.wait();
      }
      console.log("\n✅ All wallets funded!\n");
    } else {
      console.log(`   ⚠️  Deployer balance insufficient (need ${ethers.formatEther(totalNeededForAll)} ETH)`);
      console.log("   Please fund wallets manually using a faucet.\n");
    }
  } else {
    console.log("⚠️  Not on Sepolia network. Skipping funding instructions.");
    console.log("   Please fund wallets manually if needed.\n");
  }

  // ============================================
  // STEP 3: Connect to Contract
  // ============================================
  console.log("📝 Connecting to VouchMinimal contract...\n");
  
  const VouchMinimal = await ethers.getContractFactory("VouchMinimal");
  const vouchMinimal = VouchMinimal.attach(contractAddress);

  // Display contract constants
  console.log("📊 Contract Constants:");
  console.log(`   DEFAULT_RANK: ${(await vouchMinimal.DEFAULT_RANK()).toString()}`);
  console.log(`   R: ${(await vouchMinimal.R()).toString()}`);
  console.log(`   BONUS_OUT: ${(await vouchMinimal.BONUS_OUT()).toString()}`);
  console.log(`   BONUS_CAP: ${(await vouchMinimal.BONUS_CAP()).toString()}\n`);

  // ============================================
  // STEP 4: Create Vouches (Bootstrap Network)
  // ============================================
  console.log("🔗 Creating vouches to bootstrap the network...\n");
  
  // Connect wallets to provider
  const connectedWallets = wallets.map(w => 
    new ethers.Wallet(w.privateKey, ethers.provider)
  );

  // Create vouches in a chain pattern: wallet0 -> wallet1 -> wallet2 -> wallet3 -> wallet4
  // Also create some cross-vouches for a richer network
  const vouchPattern = [
    { from: 0, to: 1 }, // wallet0 vouches for wallet1
    { from: 1, to: 2 }, // wallet1 vouches for wallet2
    { from: 2, to: 3 }, // wallet2 vouches for wallet3
    { from: 3, to: 4 }, // wallet3 vouches for wallet4
    { from: 0, to: 2 }, // wallet0 vouches for wallet2 (cross-vouch)
    { from: 1, to: 4 }, // wallet1 vouches for wallet4 (cross-vouch)
  ];

  console.log("Vouch Pattern:");
  vouchPattern.forEach((v, i) => {
    console.log(`   ${i + 1}. Wallet ${v.from} → Wallet ${v.to}`);
  });
  console.log("");

  // Check if wallets have balance before creating vouches
  let vouchesCreated = 0;
  let vouchesFailed = 0;

  for (const vouch of vouchPattern) {
    const fromWallet = connectedWallets[vouch.from];
    const toAddress = wallets[vouch.to].address;
    
    const balance = await ethers.provider.getBalance(fromWallet.address);
    
    if (balance < ethers.parseEther("0.0001")) {
      console.log(`⚠️  Skipping vouch ${vouch.from} → ${vouch.to} (insufficient balance)`);
      vouchesFailed++;
      continue;
    }

    try {
      const contractWithSigner = vouchMinimal.connect(fromWallet);
      console.log(`Creating vouch: Wallet ${vouch.from} → Wallet ${vouch.to}...`);
      
      const tx = await contractWithSigner.vouch(toAddress);
      console.log(`   Transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`   ✅ Success! Gas used: ${receipt?.gasUsed.toString()}`);
      
      // Get updated ranks
      const fromRank = await vouchMinimal.getRank(fromWallet.address);
      const toRank = await vouchMinimal.getRank(toAddress);
      
      console.log(`   From rank: ${fromRank.toString()}, To rank: ${toRank.toString()}\n`);
      
      vouchesCreated++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      vouchesFailed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Vouches created: ${vouchesCreated}`);
  console.log(`   ❌ Vouches failed: ${vouchesFailed}\n`);

  // ============================================
  // STEP 5: Display Network Graph
  // ============================================
  console.log("🌐 Network Graph:");
  console.log("================================\n");

  for (let i = 0; i < wallets.length; i++) {
    const address = wallets[i].address;
    
    try {
      const nodeInfo = await vouchMinimal.getNodeInfo(address);
      const connections = await vouchMinimal.getConnections(address);
      
      console.log(`Wallet ${i} (${address.substring(0, 10)}...):`);
      console.log(`   Rank: ${nodeInfo.rank.toString()}`);
      console.log(`   Score: ${nodeInfo.score.toString()}`);
      console.log(`   Incoming vouches: ${nodeInfo.inCount}`);
      console.log(`   Outgoing vouches: ${nodeInfo.outCount}`);
      
      if (connections.inNeighbors.length > 0) {
        console.log(`   Vouched by: ${connections.inNeighbors.map((addr: string) => {
          const idx = wallets.findIndex(w => w.address.toLowerCase() === addr.toLowerCase());
          return idx >= 0 ? `Wallet ${idx}` : addr.substring(0, 8);
        }).join(", ")}`);
      }
      
      if (connections.outNeighbors.length > 0) {
        console.log(`   Vouches for: ${connections.outNeighbors.map((addr: string) => {
          const idx = wallets.findIndex(w => w.address.toLowerCase() === addr.toLowerCase());
          return idx >= 0 ? `Wallet ${idx}` : addr.substring(0, 8);
        }).join(", ")}`);
      }
      
      console.log("");
    } catch (error: any) {
      console.log(`   ⚠️  Error fetching info: ${error.message}\n`);
    }
  }

  // ============================================
  // STEP 6: Export Wallet Info (to console only, not file)
  // ============================================
  console.log("💾 Wallet Information:");
  console.log("================================\n");
  console.log("⚠️  SECURITY WARNING: Private keys are shown below. Copy them securely and DO NOT commit to git!\n");
  
  const walletExport = wallets.map((w, i) => ({
    id: i,
    address: w.address,
    privateKey: w.privateKey,
  }));

  console.log(JSON.stringify(walletExport, null, 2));
  console.log("\n⚠️  SECURITY REMINDER:");
  console.log("   - Never commit private keys to git");
  console.log("   - Store keys securely (password manager, encrypted storage)");
  console.log("   - If these wallets have funds, consider moving them immediately");
  console.log("   - This file was NOT saved to disk for security\n");

  // ============================================
  // STEP 7: Next Steps
  // ============================================
  console.log("📋 Next Steps:");
  console.log("================================\n");
  console.log("1. Save the wallet information above");
  console.log("2. Continue creating vouches:");
  console.log(`   CONTRACT_ADDRESS=${contractAddress} npx hardhat run scripts/interact-vouchminimal.ts --network sepolia`);
  console.log("\n3. Query the full network:");
  console.log(`   CONTRACT_ADDRESS=${contractAddress} npm run query:network -- --network sepolia`);
  console.log("\n4. Create more vouches using:");
  console.log("   - The interact-vouchminimal.ts script");
  console.log("   - Your frontend application");
  console.log("   - Direct contract calls\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
