# VouchMinimal - Minimal Vouch Network Contract

A minimal, gas-efficient smart contract for building reputation networks through vouching relationships on Ethereum and L2 networks.

## Overview

VouchMinimal implements a trust network where addresses can vouch for each other, creating a directed graph of trust relationships. The contract computes reputation ranks and scores based on incoming vouches, enabling decentralized reputation systems.

### Key Features

- **Minimal & Gas-Efficient**: Optimized for low gas costs
- **Vouch & Unvouch**: Create and remove trust relationships
- **Bootstrap Mechanism**: First 4 vouches automatically seed the network
- **Rank Calculation**: Computes reputation ranks based on incoming vouches
- **Score System**: Weighted scoring system with configurable parameters
- **Graph Visualization**: Full network querying for frontend visualization
- **Event Tracking**: Comprehensive events for real-time updates

## Contract Details

- **Contract Name**: `VouchMinimal`
- **Solidity Version**: `^0.8.24`
- **Network Support**: Ethereum, Arbitrum, Base, and their testnets

## Quick Start

### Prerequisites

- Node.js and npm installed
- Hardhat installed
- Environment variables configured (see `env.example`)

### Installation

```bash
npm install
```

### Compile

```bash
npm run compile
```

### Deploy

**Localhost:**
```bash
npm run deploy:localhost
```

**Sepolia Testnet:**
```bash
npm run deploy:sepolia
```

**Base Sepolia:**
```bash
npm run deploy:base-sepolia
```

**Arbitrum Sepolia:**
```bash
npm run deploy:arbitrum-sepolia
```

## Available Scripts

### Deployment

- `npm run deploy:localhost` - Deploy to local Hardhat network
- `npm run deploy:sepolia` - Deploy to Sepolia testnet
- `npm run deploy:base-sepolia` - Deploy to Base Sepolia
- `npm run deploy:arbitrum-sepolia` - Deploy to Arbitrum Sepolia
- `npm run deploy:mainnet` - Deploy to Ethereum mainnet
- `npm run deploy:base` - Deploy to Base mainnet
- `npm run deploy:arbitrum` - Deploy to Arbitrum One

### Network Setup

- `npm run setup:sepolia` - Create wallets, fund them, and bootstrap the network on Sepolia

### Network Querying

- `npm run fetch:network` - Fetch all network data for frontend visualization
- `npm run query:network` - Query and display network statistics

### Other

- `npm run compile` - Compile contracts
- `npm test` - Run tests

## Usage Examples

### Deploy Contract

```bash
CONTRACT_ADDRESS=0x... npm run deploy:sepolia
```

### Setup Network on Sepolia

This script creates wallets, funds them, and creates initial vouches:

```bash
CONTRACT_ADDRESS=0xYourContractAddress npm run setup:sepolia
```

### Interact with Contract

```bash
CONTRACT_ADDRESS=0x... npx hardhat run scripts/interact-vouchminimal.ts --network sepolia
```

### Query Network Data

```bash
CONTRACT_ADDRESS=0x... npm run query:network -- --network sepolia
```

### Fetch Network Data for Frontend

```bash
CONTRACT_ADDRESS=0x... npm run fetch:network -- --network sepolia
```

This creates a JSON file in `exports/` folder with all nodes and edges for visualization.

## Contract Functions

### Core Functions

- `vouch(address to)` - Create a vouch from msg.sender to target address
- `unvouch(address to)` - Remove a vouch from msg.sender to target address

### View Functions

- `getNodeInfo(address)` - Get complete node information (rank, score, neighbors)
- `getNodeBasicInfo(address)` - Get basic metrics only (gas-efficient)
- `getConnections(address)` - Get incoming and outgoing neighbors
- `getInNeighbors(address)` - Get addresses that vouch for this address
- `getOutNeighbors(address)` - Get addresses this address vouches for
- `getRank(address)` - Get reputation rank
- `getScore(address)` - Get reputation score
- `hasEdge(address from, address to)` - Check if a vouch exists

### Events

- `VouchCreated` - Emitted when a vouch is created
- `VouchRemoved` - Emitted when a vouch is removed
- `NodeActivated` - Emitted when a new address joins the network
- `RankChanged` - Emitted when a node's rank changes
- `BootstrapVouchCreated` - Emitted during bootstrap phase
- `BootstrapComplete` - Emitted when bootstrap phase completes

## Network Data Export

Export network data for analysis:
```bash
CONTRACT_ADDRESS=0x... npm run fetch:network -- --network sepolia
```

This creates `exports/network-graph-{timestamp}.json` with all nodes and edges from the contract.

## Contract Constants

- `DEFAULT_RANK`: `10^24` - Rank assigned to nodes with no incoming vouches
- `R`: `64` - Weight window parameter
- `BONUS_OUT`: `2^59` - Per-outgoing-edge bonus
- `BONUS_CAP`: `15` - Maximum bonus cap for outdegree

## Bootstrap Mechanism

The first 4 vouches automatically seed the network:
- Both endpoints receive rank 1
- This bootstraps the reputation system
- After 4 vouches, normal rank calculation takes over

## Development

### File Structure

```
contracts/
  └── VouchMinimal.sol     # Main contract

scripts/
  ├── deploy-vouchminimal.ts      # Deployment script
  ├── interact-vouchminimal.ts    # Interaction examples
  ├── verify-vouchminimal.ts      # Verification script
  ├── setup-sepolia-network.ts    # Network setup script
  ├── fetch-network-data.ts       # Network data export
  └── query-network.ts            # Network query script

exports/                          # Generated network data (gitignored)
```

### Environment Variables

Copy `env.example` to `.env` and fill in:

```bash
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=https://...
ETHERSCAN_API_KEY=your_key
# ... other network URLs and API keys
```

## Testing

```bash
npm test
```

## Security

- No external dependencies
- Input validation on all functions
- Gas optimizations for efficiency
- Tested edge cases

## License

This project is licensed under the terms specified in the LICENSE file.

Built with ❤️ by the SYB Tokamak Network team
