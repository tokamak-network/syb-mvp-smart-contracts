import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Fetch All Network Data for Frontend
 * 
 * This script demonstrates how to query all nodes and edges
 * from the VouchMinimal contract for frontend visualization
 */

// Type guard for EventLog
function isEventLog(event: any): event is { args: any; blockNumber: number; transactionHash: string } {
  return event && typeof event === 'object' && 'args' in event;
}

interface GraphNode {
  id: string;
  address: string;
  rank: string;
  score: string;
  inCount: number;
  outCount: number;
  inNeighbors: string[];
  outNeighbors: string[];
  isSeed?: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
  id: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error("❌ Please provide CONTRACT_ADDRESS");
    process.exit(1);
  }

  const VouchMinimal = await ethers.getContractFactory("VouchMinimal");
  const contract = VouchMinimal.attach(contractAddress);

  console.log("🔍 Fetching all network data...\n");
  console.log(`📍 Contract Address: ${contractAddress}\n`);

  // ============================================
  // STEP 1: Get All Unique Addresses from Events
  // ============================================
  console.log("📊 Step 1: Fetching all addresses from events...");
  
  const vouchCreatedFilter = contract.filters.VouchCreated();
  const vouchRemovedFilter = contract.filters.VouchRemoved();
  
  const [vouchCreatedEvents, vouchRemovedEvents] = await Promise.all([
    contract.queryFilter(vouchCreatedFilter, 0, "latest"),
    contract.queryFilter(vouchRemovedFilter, 0, "latest"),
  ]);

  console.log(`   Found ${vouchCreatedEvents.length} VouchCreated events`);
  console.log(`   Found ${vouchRemovedEvents.length} VouchRemoved events`);

  // Collect all unique addresses
  const addressSet = new Set<string>();
  
  vouchCreatedEvents.forEach((event, index) => {
    if (isEventLog(event) && event.args) {
      addressSet.add(event.args.from.toLowerCase());
      addressSet.add(event.args.to.toLowerCase());
    } else {
      console.log(`   ⚠️  Event ${index} is not a valid EventLog`);
    }
  });

  const allAddresses = Array.from(addressSet);
  console.log(`✅ Found ${allAddresses.length} unique addresses from events\n`);
  
  // If no addresses found from events, try alternative discovery methods
  if (allAddresses.length === 0) {
    console.log("⚠️  No addresses found from events. Trying alternative discovery...\n");
    console.log("💡 Tip: If you just deployed, make sure vouches have been created.");
    console.log("   You can create vouches using:");
    console.log(`   CONTRACT_ADDRESS=${contractAddress} npm run setup:sepolia\n`);
    
    // Try to check if we can at least verify the contract is deployed
    try {
      const defaultRank = await contract.DEFAULT_RANK();
      console.log(`   Contract is deployed. DEFAULT_RANK: ${defaultRank.toString()}`);
    } catch (error: any) {
      console.log(`   ⚠️  Could not verify contract: ${error.message}`);
    }
  }

  // ============================================
  // STEP 2: Fetch Node Information for Each Address
  // ============================================
  console.log("📊 Step 2: Fetching node details...");
  
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>(); // Track edges to avoid duplicates
  
  // Identify seed nodes (from bootstrap events)
  const bootstrapFilter = contract.filters.BootstrapVouchCreated();
  const bootstrapEvents = await contract.queryFilter(bootstrapFilter, 0, "latest");
  const seedAddresses = new Set<string>();
  bootstrapEvents.forEach(event => {
    if (isEventLog(event) && event.args) {
      seedAddresses.add(event.args.from.toLowerCase());
      seedAddresses.add(event.args.to.toLowerCase());
    }
  });

  // Fetch data for each address
  for (let i = 0; i < allAddresses.length; i++) {
    const address = allAddresses[i];
    
    try {
      const nodeInfo = await contract.getNodeInfo(address);
      const connections = await contract.getConnections(address);
      
      nodes.push({
        id: address,
        address: address,
        rank: nodeInfo.rank.toString(),
        score: nodeInfo.score.toString(),
        inCount: Number(nodeInfo.inCount),
        outCount: Number(nodeInfo.outCount),
        inNeighbors: connections.inNeighbors.map((addr: string) => addr.toLowerCase()),
        outNeighbors: connections.outNeighbors.map((addr: string) => addr.toLowerCase()),
        isSeed: seedAddresses.has(address),
      });

      // Create edges from outgoing neighbors
      connections.outNeighbors.forEach((toAddress: string) => {
        const edgeId = `${address.toLowerCase()}-${toAddress.toLowerCase()}`;
        if (!edgeSet.has(edgeId)) {
          edges.push({
            from: address.toLowerCase(),
            to: toAddress.toLowerCase(),
            id: edgeId,
          });
          edgeSet.add(edgeId);
        }
      });

      if ((i + 1) % 10 === 0) {
        console.log(`   Processed ${i + 1}/${allAddresses.length} nodes...`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error fetching ${address}: ${error.message}`);
    }
  }

  console.log(`✅ Fetched ${nodes.length} nodes and ${edges.length} edges\n`);

  // ============================================
  // STEP 3: Build Graph Data Structure
  // ============================================
  const graphData: GraphData = {
    nodes,
    edges,
  };

  // ============================================
  // STEP 4: Display Summary
  // ============================================
  console.log("📈 Network Summary:");
  console.log("========================");
  console.log(`Total Nodes: ${nodes.length}`);
  console.log(`Total Edges: ${edges.length}`);
  console.log(`Seed Nodes: ${nodes.filter(n => n.isSeed).length}`);
  console.log(`\nTop 10 Nodes by Score:`);
  
  nodes
    .sort((a, b) => BigInt(b.score) > BigInt(a.score) ? 1 : -1)
    .slice(0, 10)
    .forEach((node, i) => {
      console.log(`  ${i + 1}. ${node.address.substring(0, 10)}...`);
      console.log(`     Rank: ${node.rank}, Score: ${node.score}`);
      console.log(`     Connections: ${node.inCount} in, ${node.outCount} out`);
    });

  // ============================================
  // STEP 5: Export Data for Frontend
  // ============================================
  console.log("\n💾 Graph Data Structure (for frontend):");
  console.log("================================\n");
  
  // Format for common visualization libraries
  const frontendData = {
    // For D3.js, vis.js, or similar
    nodes: nodes.map(node => ({
      id: node.id,
      label: node.address.substring(0, 10) + "...",
      address: node.address,
      rank: node.rank,
      score: node.score,
      inCount: node.inCount,
      outCount: node.outCount,
      isSeed: node.isSeed,
      // Visual properties
      size: Math.sqrt(Number(node.inCount) + Number(node.outCount)) * 5 + 10,
      color: node.isSeed ? "#FFD700" : "#4A90E2",
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      from: edge.from,
      to: edge.to,
    })),
    // Metadata
    metadata: {
      contractAddress: contractAddress,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      seedCount: nodes.filter(n => n.isSeed).length,
      exportedAt: new Date().toISOString(),
    },
    seeds: Array.from(seedAddresses),
    timeline: vouchCreatedEvents.map((event, index) => {
      if (isEventLog(event) && event.args) {
        return {
          index,
          from: event.args.from,
          to: event.args.to,
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
        };
      }
      return null;
    }).filter(Boolean),
  };

  console.log(JSON.stringify(frontendData, null, 2));
  console.log("\n");

  // ============================================
  // STEP 6: Save to File
  // ============================================
  const exportDir = path.join(__dirname, "..", "exports");
  
  // Create exports directory if it doesn't exist
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
    console.log(`📁 Created exports directory\n`);
  }
  
  const timestamp = Date.now();
  const filename = `network-graph-${timestamp}.json`;
  const filepath = path.join(exportDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(frontendData, null, 2));
  console.log(`💾 Saved network data to: exports/${filename}\n`);

  // ============================================
  // STEP 7: Export Example Frontend Code
  // ============================================
  console.log("💻 Example Frontend Usage:");
  console.log("================================\n");
  console.log(`// Use this data with visualization libraries:`);
  console.log(`// - D3.js: https://d3js.org/`);
  console.log(`// - vis.js: https://visjs.org/`);
  console.log(`// - react-force-graph: https://github.com/vasturiano/react-force-graph`);
  console.log(`// - cytoscape.js: https://js.cytoscape.org/`);
  console.log(`\n// Example with react-force-graph:`);
  console.log(`import ForceGraph2D from 'react-force-graph-2d';`);
  console.log(`\nconst graphData = ${JSON.stringify(frontendData, null, 2)};`);
  console.log(`\n<ForceGraph2D`);
  console.log(`  graphData={graphData}`);
  console.log(`  nodeLabel={node => \`\${node.address}\\nRank: \${node.rank}\\nScore: \${node.score}\`}`);
  console.log(`  nodeColor={node => node.isSeed ? "#FFD700" : "#4A90E2"}`);
  console.log(`  nodeVal={node => node.size}`); 
  console.log(`  linkDirectionalArrowLength={6}`); 
  console.log(`  linkDirectionalArrowRelPos={1}`); 
  console.log(`  onNodeClick={node => console.log("Clicked:", node.address)}`);
  console.log(`/>`);
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
