// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IDepositManager {
    function accStakedAccount(address account) external view returns (uint256 wtonAmount);
}

contract VouchMinimal is Ownable, ReentrancyGuard {
    // Deposit Manager for staking verification
    IDepositManager public depositManager;
    uint256 public minimumStake; // Minimum stake required to vouch (in WTON units)
    uint256 public constant DEFAULT_RANK = 6;      // rank if no IN neighbors
    uint256 public constant R = 5;                 // weight window: c_r = 2^(R - r) for r<=R
    uint256 public constant BONUS_OUT = 1;         // tiny per-outedge bonus
    uint256 public constant BONUS_CAP = 15;        // cap for outdegree bonus
    uint256 public constant MAX_SEEDVOUCHES = 5;   // first 5 vouches seed endpoints to rank=1
    uint256 public seedVouchCount = 0;             // counter for seed vouches

    struct Node {
        uint256 rank;         // 0 => DEFAULT_RANK
        uint256 score;        // sum over IN-weights + bonus(outdegree)
        uint256 outdegree;    // store only the count (no out-neighbor array)
        address[] inNeighbors;
        address[] outNeighbors; // Added to track outgoing vouches
    }

    mapping(address => Node) private nodes;
    mapping(address => mapping(address => bool)) public hasEdge; // u->v?
    
    // Events for graph updates
    event VouchCreated(address indexed from, address indexed to, uint256 toRank, uint256 fromScore, uint256 toScore);
    event VouchRemoved(address indexed from, address indexed to, uint256 toRank, uint256 fromScore, uint256 toScore);
    
    // Additional events for better tracking
    event NodeActivated(address indexed node, uint256 initialRank);
    event RankChanged(address indexed node, uint256 oldRank, uint256 newRank);
    event BootstrapVouchCreated(address indexed from, address indexed to, uint256 seedNumber);
    event BootstrapComplete();
    event DepositManagerUpdated(address indexed oldManager, address indexed newManager);
    event MinimumStakeUpdated(uint256 oldMinimum, uint256 newMinimum);

    // ---- constructor ----
    constructor(address _depositManager, uint256 _minimumStake) Ownable(msg.sender) {
        require(_depositManager != address(0), "Invalid deposit manager");
        depositManager = IDepositManager(_depositManager);
        minimumStake = _minimumStake;
        emit DepositManagerUpdated(address(0), _depositManager);
        emit MinimumStakeUpdated(0, _minimumStake);
    }

    // ---- admin functions ----
    function setDepositManager(address _depositManager) external onlyOwner {
        require(_depositManager != address(0), "Invalid deposit manager");
        address oldManager = address(depositManager);
        depositManager = IDepositManager(_depositManager);
        emit DepositManagerUpdated(oldManager, _depositManager);
    }

    function setMinimumStake(uint256 _minimumStake) external onlyOwner {
        uint256 oldMinimum = minimumStake;
        minimumStake = _minimumStake;
        emit MinimumStakeUpdated(oldMinimum, _minimumStake);
    }

    // ---- views ----
    function getRank(address a) external view returns (uint256) {
        uint256 r = nodes[a].rank;
        return r == 0 ? DEFAULT_RANK : r;
    }
    function getScore(address a) external view returns (uint256) {
        return nodes[a].score;
    }
    function getOutdegree(address a) external view returns (uint256) {
        return nodes[a].outdegree;
    }
    function getInCount(address a) external view returns (uint256) {
        return nodes[a].inNeighbors.length;
    }
    function getInNeighborAt(address a, uint256 i) external view returns (address) {
        return nodes[a].inNeighbors[i];
    }
    
    // ---- Enhanced getters for graph visualization ----
    function getNodeInfo(address a) external view returns (
        uint256 rank,
        uint256 score,
        uint256 inCount,
        uint256 outCount,
        address[] memory inNeighbors,
        address[] memory outNeighbors
    ) {
        Node storage node = nodes[a];
        rank = node.rank == 0 ? DEFAULT_RANK : node.rank;
        score = node.score;
        inCount = node.inNeighbors.length;
        outCount = node.outNeighbors.length;
        inNeighbors = node.inNeighbors;
        outNeighbors = node.outNeighbors;
    }
    
    function getNodeBasicInfo(address a) external view returns (
        uint256 rank,
        uint256 score,
        uint256 inCount,
        uint256 outCount
    ) {
        Node storage node = nodes[a];
        rank = node.rank == 0 ? DEFAULT_RANK : node.rank;
        score = node.score;
        inCount = node.inNeighbors.length;
        outCount = node.outNeighbors.length;
    }
    
    function getInNeighbors(address a) external view returns (address[] memory) {
        return nodes[a].inNeighbors;
    }
    
    function getOutNeighbors(address a) external view returns (address[] memory) {
        return nodes[a].outNeighbors;
    }
    
    function getConnections(address a) external view returns (
        address[] memory inNeighbors,
        address[] memory outNeighbors
    ) {
        inNeighbors = nodes[a].inNeighbors;
        outNeighbors = nodes[a].outNeighbors;
    }

    // ---- helper: check staking requirement ----
    function hasMinimumStake(address account) public view returns (bool) {
        uint256 stakedAmount = depositManager.accStakedAccount(account);
        return stakedAmount >= minimumStake;
    }

    function getStakedAmount(address account) external view returns (uint256) {
        return depositManager.accStakedAccount(account);
    }

    // ---- core: vouch (u -> v) ----
    function vouch(address to) external nonReentrant {
        address from = msg.sender;
        require(to != address(0), "zero");
        require(to != from, "self");
        require(!hasEdge[from][to], "exists");
        require(hasMinimumStake(from), "Insufficient stake to vouch");

        // create directed edge u->v
        hasEdge[from][to] = true;
        nodes[from].outdegree += 1;
        nodes[from].outNeighbors.push(to);    // Track outgoing vouch
        nodes[to].inNeighbors.push(from);

        if (seedVouchCount < MAX_SEEDVOUCHES) {
            // Check if nodes are being activated for the first time
            bool fromIsNew = nodes[from].rank == 0;
            bool toIsNew = nodes[to].rank == 0;
            
            // bootstrap: both endpoints start at rank 1, then compute scores
            nodes[from].rank = 1;
            nodes[to].rank   = 1;
            _recomputeScore(from);
            _recomputeScore(to);
            
            uint256 currentSeedCount = seedVouchCount;
            unchecked { seedVouchCount += 1; }
            
            // Emit activation events for new nodes
            if (fromIsNew) {
                emit NodeActivated(from, 1);
            }
            if (toIsNew) {
                emit NodeActivated(to, 1);
            }
            
            emit BootstrapVouchCreated(from, to, currentSeedCount);
            emit VouchCreated(
                from, 
                to, 
                nodes[to].rank, 
                nodes[from].score, 
                nodes[to].score
            );
            
            // Check if bootstrap phase is complete
            if (seedVouchCount == MAX_SEEDVOUCHES) {
                emit BootstrapComplete();
            }
            
            return;
        }

        // Check if nodes are being activated for the first time
        bool fromFirstTime = nodes[from].rank == 0 && nodes[from].inNeighbors.length == 0 && nodes[from].outdegree == 1;
        bool toFirstTime = nodes[to].rank == 0 && nodes[to].inNeighbors.length == 1 && nodes[to].outdegree == 0;
        
        // Store old rank before update
        uint256 oldRankTo = _rankOrDefault(to);
        
        // normal: update rank(v) from IN(v), then recompute scores of u & v only
        _recomputeRankOnly(to);
        _recomputeScore(from);
        _recomputeScore(to);
        
        uint256 newRankTo = _rankOrDefault(to);
        
        // Emit activation events for new nodes
        if (fromFirstTime) {
            emit NodeActivated(from, DEFAULT_RANK);
        }
        if (toFirstTime && nodes[to].rank != 0) {
            emit NodeActivated(to, newRankTo);
        }
        
        // Emit rank change if rank actually changed
        if (oldRankTo != newRankTo) {
            emit RankChanged(to, oldRankTo, newRankTo);
        }
        
        emit VouchCreated(
            from, 
            to, 
            newRankTo, 
            nodes[from].score, 
            nodes[to].score
        );
    }
    
    // ---- core: unvouch (u -x-> v) ----
    function unvouch(address to) external nonReentrant {
        address from = msg.sender;
        require(to != address(0), "zero");
        require(to != from, "self");
        require(hasEdge[from][to], "not exists");
        
        // remove directed edge u->v
        hasEdge[from][to] = false;
        nodes[from].outdegree -= 1;
        
        // Store old rank before update
        uint256 oldRankTo = _rankOrDefault(to);
        
        // Remove from outNeighbors of 'from'
        _removeFromArray(nodes[from].outNeighbors, to);
        
        // Remove from inNeighbors of 'to'
        _removeFromArray(nodes[to].inNeighbors, from);
        
        // recompute rank for 'to' (may increase after losing a vouch)
        _recomputeRankOnly(to);
        _recomputeScore(from);
        _recomputeScore(to);
        
        uint256 newRankTo = _rankOrDefault(to);
        
        // Emit rank change if rank actually changed
        if (oldRankTo != newRankTo) {
            emit RankChanged(to, oldRankTo, newRankTo);
        }
        
        emit VouchRemoved(
            from,
            to,
            newRankTo,
            nodes[from].score,
            nodes[to].score
        );
    }

    // ---- internals ----
    function _rankOrDefault(address a) internal view returns (uint256) {
        uint256 r = nodes[a].rank;
        return r == 0 ? DEFAULT_RANK : r;
    }

    // c_r computed on the fly: 2^(R - r) for r<=R; 0 otherwise or if r==DEFAULT_RANK
    function _w(uint256 r) internal pure returns (uint256) {
        if (r >= DEFAULT_RANK) return 0;
        if (r <= R) {
            unchecked { return uint256(1) << (R - r); }
        } else {
            return 0;
        }
    }

    // r[v] = 3*k + 1 - min(m,3), with k = min rank over IN(v), m = multiplicity of k
    function _recomputeRankOnly(address v) internal {
        address[] storage ins = nodes[v].inNeighbors;
        if (ins.length == 0) { nodes[v].rank = DEFAULT_RANK; return; }

        uint256 k = type(uint256).max;
        uint256 m = 0;
        unchecked {
            uint256 len = ins.length;
            for (uint256 i = 0; i < len; ++i) {
                uint256 ru = _rankOrDefault(ins[i]);
                if (ru < k) { k = ru; m = 1; }
                else if (ru == k && m < 3) { ++m; }
            }
            uint256 rv = 3 * k + 1 - m;
            nodes[v].rank = rv;
        }
    }

    // score[a] = sum_{u in IN(a)} c_{r[u]}  +  BONUS_OUT * min(BONUS_CAP, outdeg(a))
    function _recomputeScore(address a) internal {
        uint256 s = 0;
        address[] storage ins = nodes[a].inNeighbors;
        unchecked {
            uint256 lin = ins.length;
            for (uint256 i = 0; i < lin; ++i) {
                s += _w(_rankOrDefault(ins[i]));
            }
            uint256 outdeg = nodes[a].outdegree;
            if (outdeg > BONUS_CAP) outdeg = BONUS_CAP;
            s += BONUS_OUT * outdeg;
        }
        nodes[a].score = s;
    }
    
    // helper to remove an address from an array (swap-and-pop pattern)
    function _removeFromArray(address[] storage arr, address toRemove) internal {
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; ) {
            if (arr[i] == toRemove) {
                // swap with last element and pop
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
            unchecked { ++i; }
        }
    }
}
