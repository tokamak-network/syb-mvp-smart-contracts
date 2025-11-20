# VouchMinimal - Minimal Vouch Network Contract

A minimal, gas-efficient smart contract for building reputation networks through vouching relationships on Ethereum and L2 networks.

## Overview

VouchMinimal implements a trust network where addresses can vouch for each other, creating a directed graph of trust relationships. The contract computes reputation ranks and scores based on incoming vouches, enabling decentralized reputation systems.

### Key Features

- **Minimal & Gas-Efficient**: Optimized for low gas costs
- **Vouch & Unvouch**: Create and remove trust relationships
- **Staking Requirement**: Integrates with Tokamak DepositManager to require token staking before vouching
- **Bootstrap Mechanism**: First 5 vouches automatically seed the network
- **Rank Calculation**: Computes reputation ranks based on incoming vouches
- **Score System**: Weighted scoring system with configurable parameters
- **Graph Visualization**: Full network querying for frontend visualization
- **Event Tracking**: Comprehensive events for real-time updates

## Staking Requirement

VouchMinimal integrates with the **Tokamak DepositManager** contract to enforce staking requirements for vouching. Users must have staked tokens before they can vouch for others.

### How It Works

1. **DepositManager Integration**: The contract connects to Tokamak's DepositManager at `0x90ffcc7F168DceDBEF1Cb6c6eB00cA73F922956F`
2. **Minimum Stake**: Configurable minimum stake requirement (set during deployment)
3. **Stake Verification**: Before allowing a vouch, the contract checks `accStakedAccount(address)` on the DepositManager
4. **Flexible Configuration**: Contract owner can update the minimum stake requirement or DepositManager address

### Configuration

Set these environment variables before deployment:

```bash
# DepositManager contract address
DEPOSIT_MANAGER_ADDRESS=0x90ffcc7F168DceDBEF1Cb6c6eB00cA73F922956F

# Minimum stake required (in WTON units, 1 WTON = 1e27)
# Set to 0 to disable staking requirement
MINIMUM_STAKE=0
```

### Benefits

- **Sybil Resistance**: Requires economic commitment to participate
- **Quality Control**: Only stakers can vouch, improving trust network quality
- **Tokamak Ecosystem**: Leverages existing Tokamak staking infrastructure

## Contract Details

- **Contract Name**: `VouchMinimal`
- **Solidity Version**: `^0.8.24`
- **Network Support**: Ethereum, Arbitrum, Base, and their testnets
- **External Dependencies**: Tokamak DepositManager (for staking verification)

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

- `vouch(address to)` - Create a vouch from msg.sender to target address (requires minimum stake)
- `unvouch(address to)` - Remove a vouch from msg.sender to target address

### Admin Functions (Owner Only)

- `setDepositManager(address)` - Update the DepositManager contract address
- `setMinimumStake(uint256)` - Update the minimum stake requirement
- `transferOwnership(address)` - Transfer contract ownership (inherited from OpenZeppelin Ownable)
- `renounceOwnership()` - Renounce ownership, leaving the contract without an owner (inherited from OpenZeppelin Ownable)

### View Functions

- `getNodeInfo(address)` - Get complete node information (rank, score, neighbors)
- `getNodeBasicInfo(address)` - Get basic metrics only (gas-efficient)
- `getConnections(address)` - Get incoming and outgoing neighbors
- `getInNeighbors(address)` - Get addresses that vouch for this address
- `getOutNeighbors(address)` - Get addresses this address vouches for
- `getRank(address)` - Get reputation rank
- `getScore(address)` - Get reputation score
- `hasEdge(address from, address to)` - Check if a vouch exists
- `hasMinimumStake(address)` - Check if an address has the minimum required stake
- `getStakedAmount(address)` - Get the staked amount for an address from DepositManager
- `depositManager()` - Get the current DepositManager contract address
- `minimumStake()` - Get the current minimum stake requirement
- `owner()` - Get the contract owner address

### Events

- `VouchCreated` - Emitted when a vouch is created
- `VouchRemoved` - Emitted when a vouch is removed
- `NodeActivated` - Emitted when a new address joins the network
- `RankChanged` - Emitted when a node's rank changes
- `BootstrapVouchCreated` - Emitted during bootstrap phase
- `BootstrapComplete` - Emitted when bootstrap phase completes
- `DepositManagerUpdated` - Emitted when DepositManager address is updated
- `MinimumStakeUpdated` - Emitted when minimum stake requirement is updated

## Network Data Export

Export network data for analysis:
```bash
CONTRACT_ADDRESS=0x... npm run fetch:network -- --network sepolia
```

This creates `exports/network-graph-{timestamp}.json` with all nodes and edges from the contract.

## Contract Constants

- `DEFAULT_RANK`: `6` - Rank assigned to nodes with no incoming vouches
- `R`: `5` - Weight window parameter
- `BONUS_OUT`: `1` - Per-outgoing-edge bonus
- `BONUS_CAP`: `15` - Maximum bonus cap for outdegree
- `MAX_SEEDVOUCHES`: `5` - Number of bootstrap vouches

## Bootstrap Mechanism

The first 5 vouches automatically seed the network:
- Both endpoints receive rank 1
- This bootstraps the reputation system
- After 5 vouches, normal rank calculation takes over
- **Note**: Bootstrap vouches still require staking if minimum stake is set

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
# Wallet
PRIVATE_KEY=your_private_key

# Network RPCs
SEPOLIA_RPC_URL=https://...
BASE_SEPOLIA_RPC_URL=https://...
ARBITRUM_SEPOLIA_RPC_URL=https://...

# Block Explorer API Keys
ETHERSCAN_API_KEY=your_key
BASESCAN_API_KEY=your_key
ARBISCAN_API_KEY=your_key

# VouchMinimal Configuration
DEPOSIT_MANAGER_ADDRESS=0x90ffcc7F168DceDBEF1Cb6c6eB00cA73F922956F
MINIMUM_STAKE=0  # Set minimum stake requirement in WTON units
```

## Testing

```bash
npm test
```

## Security

- **OpenZeppelin Integration**: Uses battle-tested OpenZeppelin contracts for security
  - `Ownable` for access control
  - `ReentrancyGuard` for reentrancy protection on vouch/unvouch functions
- Input validation on all functions
- Gas optimizations for efficiency
- Tested edge cases
- Protected against reentrancy attacks

## License

This project is licensed under the terms specified in the LICENSE file.

Built with ❤️ by the SYB Tokamak Network team
