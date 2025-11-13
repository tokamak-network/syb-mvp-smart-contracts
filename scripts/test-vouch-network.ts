import { ethers } from "hardhat";

/**
 * Comprehensive Vouch Network Test Script
 * 
 * This script:
 * 1. Creates 50 wallets
 * 2. Funds them (if deployer has balance)
 * 3. Creates vouches in multiple patterns
 * 4. Tests unvouching
 * 5. Performs multiple rounds of vouch/unvouch operations
 * 6. Displays network statistics
 */

interface WalletInfo {
  address: string;
  privateKey: string;
  balance: string;
}

interface TestStats {
  totalWallets: number;
  vouchesCreated: number;
  vouchesRemoved: number;
  roundsCompleted: number;
  errors: number;
}

async function main() {
  console.log("🧪 VouchMinimal Network Test Script");
  console.log("====================================\n");

  // Get contract address from environment
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error("❌ Please provide CONTRACT_ADDRESS environment variable");
    console.log("Usage: CONTRACT_ADDRESS=0x... npx hardhat run scripts/test-vouch-network.ts --network <network>");
    process.exit(1);
  }

  const network = await ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name}`);
  console.log(`📍 Contract: ${contractAddress}\n`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log("👤 Deployer Account:");
  console.log(`   Address: ${deployer.address}`);
  console.log(`   Balance: ${ethers.formatEther(deployerBalance)} ETH\n`);

  // Connect to contract
  const VouchMinimal = await ethers.getContractFactory("VouchMinimal");
  const contract = VouchMinimal.attach(contractAddress) as any;

  // ============================================
  // STEP 1: Create 50 Wallets
  // ============================================
  console.log("🔑 Creating 50 wallets...\n");
  
  const wallets: WalletInfo[] = [];
  for (let i = 0; i < 50; i++) {
    const wallet = ethers.Wallet.createRandom();
    const balance = await ethers.provider.getBalance(wallet.address);
    
    wallets.push({
      address: wallet.address,
      privateKey: wallet.privateKey,
      balance: ethers.formatEther(balance),
    });
  }
  
  console.log(`✅ Created ${wallets.length} wallets\n`);

  // ============================================
  // STEP 2: Fund Wallets
  // ============================================
  console.log("💰 Funding wallets...\n");
  
  const fundingAmount = ethers.parseEther("0.01"); // 0.01 ETH per wallet
  const totalNeeded = fundingAmount * BigInt(wallets.length);
  
  let fundedCount = 0;
  
  if (deployerBalance >= totalNeeded) {
    console.log(`   Funding ${wallets.length} wallets with ${ethers.formatEther(fundingAmount)} ETH each...`);
    
    for (let i = 0; i < wallets.length; i++) {
      try {
        const tx = await deployer.sendTransaction({
          to: wallets[i].address,
          value: fundingAmount,
        });
        await tx.wait();
        fundedCount++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`   Funded ${i + 1}/${wallets.length} wallets...`);
        }
      } catch (error: any) {
        console.log(`   ⚠️  Failed to fund wallet ${i}: ${error.message}`);
      }
    }
    
    console.log(`✅ Funded ${fundedCount}/${wallets.length} wallets\n`);
  } else {
    console.log(`⚠️  Insufficient balance to fund all wallets`);
    console.log(`   Need: ${ethers.formatEther(totalNeeded)} ETH`);
    console.log(`   Have: ${ethers.formatEther(deployerBalance)} ETH`);
    console.log(`   Please fund wallets manually or use a faucet\n`);
  }

  // Connect wallets to provider
  const connectedWallets = wallets.map(w => 
    new ethers.Wallet(w.privateKey, ethers.provider)
  );

  // ============================================
  // STEP 3: Create Initial Vouches (Chain Pattern)
  // ============================================
  console.log("🔗 Creating initial vouches (chain pattern)...\n");
  
  const stats: TestStats = {
    totalWallets: wallets.length,
    vouchesCreated: 0,
    vouchesRemoved: 0,
    roundsCompleted: 0,
    errors: 0,
  };

  // Create a chain: wallet0 -> wallet1 -> wallet2 -> ... -> wallet49
  for (let i = 0; i < wallets.length - 1; i++) {
    const fromWallet = connectedWallets[i];
    const toAddress = wallets[i + 1].address;
    
    const balance = await ethers.provider.getBalance(fromWallet.address);
    if (balance < ethers.parseEther("0.0001")) {
      console.log(`   ⚠️  Skipping wallet ${i} (insufficient balance)`);
      stats.errors++;
      continue;
    }

    try {
      const contractWithSigner = contract.connect(fromWallet);
      const tx = await contractWithSigner.vouch(toAddress);
      await tx.wait();
      stats.vouchesCreated++;
      
      if ((i + 1) % 10 === 0) {
        console.log(`   Created ${i + 1} vouches...`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.log(`   ❌ Error creating vouch ${i} -> ${i + 1}: ${error.message}`);
      stats.errors++;
    }
  }
  
  console.log(`✅ Initial vouches created: ${stats.vouchesCreated}\n`);

  // ============================================
  // STEP 4: Create Additional Vouches (Random Pattern)
  // ============================================
  console.log("🔗 Creating additional vouches (random pattern)...\n");
  
  const additionalVouches = 50; // Create 50 more random vouches
  
  for (let i = 0; i < additionalVouches; i++) {
    const fromIdx = Math.floor(Math.random() * wallets.length);
    const toIdx = Math.floor(Math.random() * wallets.length);
    
    // Don't vouch to self
    if (fromIdx === toIdx) continue;
    
    const fromWallet = connectedWallets[fromIdx];
    const toAddress = wallets[toIdx].address;
    
    const balance = await ethers.provider.getBalance(fromWallet.address);
    if (balance < ethers.parseEther("0.0001")) {
      continue;
    }

    try {
      const contractWithSigner = contract.connect(fromWallet);
      
      // Check if vouch already exists
      const exists = await contract.hasEdge(fromWallet.address, toAddress);
      if (exists) continue;
      
      const tx = await contractWithSigner.vouch(toAddress);
      await tx.wait();
      stats.vouchesCreated++;
      
      if ((i + 1) % 10 === 0) {
        console.log(`   Created ${i + 1} additional vouches...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      // Ignore "already exists" errors
      if (!error.message.includes("exists")) {
        stats.errors++;
      }
    }
  }
  
  console.log(`✅ Additional vouches created\n`);

  // ============================================
  // STEP 5: Test Multiple Rounds of Vouch/Unvouch
  // ============================================
  console.log("🔄 Testing multiple rounds of vouch/unvouch...\n");
  
  const rounds = 5; // Number of test rounds
  
  for (let round = 1; round <= rounds; round++) {
    console.log(`📊 Round ${round}/${rounds}:`);
    
    // Select random wallets for this round
    const testPairs = 10; // Test 10 pairs per round
    
    // UNVOUCH Phase
    console.log(`   Unvouching phase...`);
    let unvouchCount = 0;
    
    for (let i = 0; i < testPairs; i++) {
      const fromIdx = Math.floor(Math.random() * wallets.length);
      const toIdx = Math.floor(Math.random() * wallets.length);
      
      if (fromIdx === toIdx) continue;
      
      const fromWallet = connectedWallets[fromIdx];
      const toAddress = wallets[toIdx].address;
      
      const balance = await ethers.provider.getBalance(fromWallet.address);
      if (balance < ethers.parseEther("0.0001")) continue;

      try {
        const contractWithSigner = contract.connect(fromWallet);
        
        // Check if vouch exists
        const exists = await contract.hasEdge(fromWallet.address, toAddress);
        if (!exists) continue;
        
        const tx = await contractWithSigner.unvouch(toAddress);
        await tx.wait();
        stats.vouchesRemoved++;
        unvouchCount++;
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        stats.errors++;
      }
    }
    
    console.log(`     ✅ Removed ${unvouchCount} vouches`);
    
    // VOUCH Phase
    console.log(`   Vouching phase...`);
    let vouchCount = 0;
    
    for (let i = 0; i < testPairs; i++) {
      const fromIdx = Math.floor(Math.random() * wallets.length);
      const toIdx = Math.floor(Math.random() * wallets.length);
      
      if (fromIdx === toIdx) continue;
      
      const fromWallet = connectedWallets[fromIdx];
      const toAddress = wallets[toIdx].address;
      
      const balance = await ethers.provider.getBalance(fromWallet.address);
      if (balance < ethers.parseEther("0.0001")) continue;

      try {
        const contractWithSigner = contract.connect(fromWallet);
        
        // Check if vouch already exists
        const exists = await contract.hasEdge(fromWallet.address, toAddress);
        if (exists) continue;
        
        const tx = await contractWithSigner.vouch(toAddress);
        await tx.wait();
        stats.vouchesCreated++;
        vouchCount++;
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        if (!error.message.includes("exists")) {
          stats.errors++;
        }
      }
    }
    
    console.log(`     ✅ Created ${vouchCount} vouches`);
    stats.roundsCompleted++;
    console.log("");
  }

  // ============================================
  // STEP 6: Display Network Statistics
  // ============================================
  console.log("📈 Network Statistics:");
  console.log("================================\n");
  
  console.log(`Total Wallets: ${stats.totalWallets}`);
  console.log(`Vouches Created: ${stats.vouchesCreated}`);
  console.log(`Vouches Removed: ${stats.vouchesRemoved}`);
  console.log(`Net Vouches: ${stats.vouchesCreated - stats.vouchesRemoved}`);
  console.log(`Test Rounds Completed: ${stats.roundsCompleted}`);
  console.log(`Errors: ${stats.errors}\n`);

  // Get network stats from contract
  console.log("📊 Contract Network Stats:");
  console.log("================================\n");
  
  try {
    // Count total vouches from events
    const vouchEvents = await contract.queryFilter(contract.filters.VouchCreated(), 0, "latest");
    const unvouchEvents = await contract.queryFilter(contract.filters.VouchRemoved(), 0, "latest");
    
    console.log(`Total VouchCreated Events: ${vouchEvents.length}`);
    console.log(`Total VouchRemoved Events: ${unvouchEvents.length}`);
    
    // Sample some node stats
    const sampleSize = Math.min(10, wallets.length);
    console.log(`\nSample Node Stats (first ${sampleSize} wallets):`);
    
    for (let i = 0; i < sampleSize; i++) {
      try {
        const nodeInfo = await contract.getNodeInfo(wallets[i].address);
        const connections = await contract.getConnections(wallets[i].address);
        
        console.log(`\n  Wallet ${i} (${wallets[i].address.substring(0, 10)}...):`);
        console.log(`    Rank: ${nodeInfo.rank.toString()}`);
        console.log(`    Score: ${nodeInfo.score.toString()}`);
        console.log(`    Incoming: ${nodeInfo.inCount}`);
        console.log(`    Outgoing: ${nodeInfo.outCount}`);
        console.log(`    Total Connections: ${connections.inNeighbors.length + connections.outNeighbors.length}`);
      } catch (error: any) {
        console.log(`    ⚠️  Error fetching node info: ${error.message}`);
      }
    }
  } catch (error: any) {
    console.log(`⚠️  Error fetching network stats: ${error.message}`);
  }

  console.log("\n✅ Test Complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

