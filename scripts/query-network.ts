import { ethers } from "hardhat";

/**
 * Query and display the VouchMinimal network graph
 * This script demonstrates how to build zoom-out and zoom-in views
 */

// Type guard for EventLog
function isEventLog(event: any): event is { args: any; blockNumber: number; transactionHash: string } {
  return event && typeof event === 'object' && 'args' in event;
}

interface NodeData {
  address: string;
  rank: string;
  score: string;
  inCount: number;
  outCount: number;
  inNeighbors: string[];
  outNeighbors: string[];
  isSeed?: boolean;
}

interface VouchEvent {
  from: string;
  to: string;
  timestamp: number;
  rankTo: string;
  scoreFrom: string;
  scoreTo: string;
  blockNumber: number;
  txHash: string;
}

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    console.error("❌ Please provide CONTRACT_ADDRESS environment variable");
    console.log("Usage: CONTRACT_ADDRESS=0x... npx hardhat run scripts/query-network.ts --network <network>");
    process.exit(1);
  }

  console.log("🔍 Querying VouchMinimal Network...");
  console.log("Contract:", contractAddress);
  console.log("");

  const VouchMinimal = await ethers.getContractFactory("VouchMinimal");
  const vouchMinimal = VouchMinimal.attach(contractAddress);

  // ============================================
  // STEP 1: Get All Network Events (Zoom-Out Data)
  // ============================================
  console.log("📊 Fetching all vouching events...");
  
  const vouchFilter = vouchMinimal.filters.VouchCreated();
  const vouchEvents = await vouchMinimal.queryFilter(vouchFilter, 0, "latest");
  
  const bootstrapFilter = vouchMinimal.filters.BootstrapVouchCreated();
  const bootstrapEvents = await vouchMinimal.queryFilter(bootstrapFilter, 0, "latest");
  
  const seeds: string[] = [];
  // Extract seed addresses from bootstrap events (first 4 vouches)
  for (const event of bootstrapEvents) {
    if (isEventLog(event) && event.args) {
      if (event.args.from && !seeds.includes(event.args.from)) {
        seeds.push(event.args.from);
      }
      if (event.args.to && !seeds.includes(event.args.to)) {
        seeds.push(event.args.to);
      }
    }
  }
  
  console.log(`✅ Found ${vouchEvents.length} vouches`);
  console.log(`✅ Found ${seeds.length} seed accounts from bootstrap phase`);
  console.log("");

  // ============================================
  // Build Network Graph
  // ============================================
  const allAddresses = new Set<string>();
  const vouches: VouchEvent[] = [];

  for (const event of vouchEvents) {
    if (isEventLog(event) && event.args) {
      const from = event.args.from;
      const to = event.args.to;
      const rankTo = event.args.toRank;
      const scoreFrom = event.args.fromScore;
      const scoreTo = event.args.toScore;

      allAddresses.add(from);
      allAddresses.add(to);

      vouches.push({
        from,
        to,
        timestamp: event.blockNumber ? 0 : 0, // Use block number as proxy if timestamp not available
        rankTo: rankTo.toString(),
        scoreFrom: scoreFrom.toString(),
        scoreTo: scoreTo.toString(),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
      });
    }
  }

  console.log("🌐 Network Overview:");
  console.log("========================");
  console.log(`Total Addresses: ${allAddresses.size}`);
  console.log(`Total Vouches: ${vouches.length}`);
  console.log(`Seed Accounts: ${seeds.length}`);
  console.log("");

  // ============================================
  // STEP 2: Get Detailed Node Information
  // ============================================
  console.log("👥 Fetching detailed node information...");
  
  const nodes: Map<string, NodeData> = new Map();

  for (const address of allAddresses) {
    const nodeInfo = await vouchMinimal.getNodeInfo(address);
    const connections = await vouchMinimal.getConnections(address);

    nodes.set(address, {
      address,
      rank: nodeInfo.rank.toString(),
      score: nodeInfo.score.toString(),
      inCount: Number(nodeInfo.inCount),
      outCount: Number(nodeInfo.outCount),
      inNeighbors: connections.inNeighbors,
      outNeighbors: connections.outNeighbors,
      isSeed: seeds.includes(address),
    });
  }

  console.log("✅ Loaded data for all nodes");
  console.log("");

  // ============================================
  // STEP 3: Display Network Statistics
  // ============================================
  console.log("📈 Network Statistics:");
  console.log("========================");

  // Top nodes by score
  const sortedByScore = Array.from(nodes.values())
    .sort((a, b) => BigInt(b.score) > BigInt(a.score) ? 1 : -1)
    .slice(0, 10);

  console.log("\n🏆 Top 10 Nodes by Score:");
  sortedByScore.forEach((node, i) => {
    console.log(`${i + 1}. ${node.address}`);
    console.log(`   Score: ${node.score}, Rank: ${node.rank}`);
    console.log(`   In: ${node.inCount}, Out: ${node.outCount} ${node.isSeed ? '⭐ SEED' : ''}`);
  });

  // Top nodes by rank (lower is better)
  const sortedByRank = Array.from(nodes.values())
    .sort((a, b) => BigInt(a.rank) > BigInt(b.rank) ? 1 : -1)
    .slice(0, 10);

  console.log("\n🎖️ Top 10 Nodes by Rank (Lower = Better):");
  sortedByRank.forEach((node, i) => {
    console.log(`${i + 1}. ${node.address}`);
    console.log(`   Rank: ${node.rank}, Score: ${node.score}`);
    console.log(`   In: ${node.inCount}, Out: ${node.outCount} ${node.isSeed ? '⭐ SEED' : ''}`);
  });

  // ============================================
  // STEP 4: Timeline of Network Growth
  // ============================================
  console.log("\n⏰ Network Growth Timeline (First 10 vouches):");
  console.log("========================");

  vouches.slice(0, 10).forEach((vouch, i) => {
    const date = new Date(vouch.timestamp * 1000);
    console.log(`${i + 1}. ${date.toISOString()}`);
    console.log(`   ${vouch.from.substring(0, 8)}... → ${vouch.to.substring(0, 8)}...`);
    console.log(`   Block: ${vouch.blockNumber}, Tx: ${vouch.txHash.substring(0, 10)}...`);
  });

  // ============================================
  // STEP 5: Zoom-In Example (Specific Address)
  // ============================================
  const focusAddress = process.env.FOCUS_ADDRESS || Array.from(allAddresses)[0];
  
  if (focusAddress && nodes.has(focusAddress)) {
    console.log("\n🔍 Zoom-In View:");
    console.log("========================");
    console.log(`Address: ${focusAddress}`);
    
    const node = nodes.get(focusAddress)!;
    console.log(`Rank: ${node.rank}`);
    console.log(`Score: ${node.score}`);
    console.log(`Is Seed: ${node.isSeed ? 'Yes ⭐' : 'No'}`);
    console.log("");

    console.log(`Incoming Vouches (${node.inCount}):`);
    node.inNeighbors.forEach((addr, i) => {
      const neighbor = nodes.get(addr);
      console.log(`  ${i + 1}. ${addr}`);
      if (neighbor) {
        console.log(`     Rank: ${neighbor.rank}, Score: ${neighbor.score}`);
      }
    });

    console.log("");
    console.log(`Outgoing Vouches (${node.outCount}):`);
    node.outNeighbors.forEach((addr, i) => {
      const neighbor = nodes.get(addr);
      console.log(`  ${i + 1}. ${addr}`);
      if (neighbor) {
        console.log(`     Rank: ${neighbor.rank}, Score: ${neighbor.score}`);
      }
    });
  }

  // ============================================
  // STEP 6: Export Data for Visualization
  // ============================================
  console.log("\n💾 Exporting data for visualization...");
  
  const graphData = {
    metadata: {
      contractAddress,
      totalNodes: allAddresses.size,
      totalEdges: vouches.length,
      seedCount: seeds.length,
      exportedAt: new Date().toISOString(),
    },
    nodes: Array.from(nodes.values()),
    edges: vouches.map(v => ({
      source: v.from,
      target: v.to,
      timestamp: v.timestamp,
    })),
    seeds: seeds,
    timeline: vouches,
  };

  // Save to file
  const fs = require("fs");
  const outputPath = `./network-graph-${Date.now()}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(graphData, null, 2));
  
  console.log(`✅ Graph data exported to: ${outputPath}`);
  console.log("");
  console.log("📊 You can now:");
  console.log("1. Import this JSON into D3.js, Cytoscape.js, or other graph visualization tools");
  console.log("2. Use it to build interactive network explorer");
  console.log("3. Create timeline animations");
  console.log("");
  console.log("🎨 See NETWORK_VISUALIZATION_GUIDE.md for visualization examples!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

