pragma solidity ^0.8.24;
import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract ArtisanDexFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public providers;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    mapping(uint256 => bool) public batchClosed;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event Paused(address account);
    event Unpaused(address account);
    event CooldownSecondsSet(uint256 oldCooldown, uint256 newCooldown);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event BidSubmitted(address indexed bidder, uint256 indexed batchId, bytes32 indexed nftId);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 winningBidValue, address winningBidder);

    error NotOwner();
    error NotProvider();
    error PausedError();
    error CooldownActive();
    error BatchClosedError();
    error ReplayError();
    error StateMismatchError();
    error InvalidBatchError();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!providers[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        currentBatchId = 1; // Start with batch 1
        cooldownSeconds = 60; // Default cooldown
    }

    function transferOwnership(address newOwner) public onlyOwner {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function addProvider(address provider) public onlyOwner {
        providers[provider] = true;
        emit ProviderAdded(provider);
    }

    function removeProvider(address provider) public onlyOwner {
        providers[provider] = false;
        emit ProviderRemoved(provider);
    }

    function pause() public onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() public onlyOwner {
        if (!paused) revert PausedError(); // Cannot unpause if not paused
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setCooldownSeconds(uint256 newCooldown) public onlyOwner {
        uint256 oldCooldown = cooldownSeconds;
        cooldownSeconds = newCooldown;
        emit CooldownSecondsSet(oldCooldown, newCooldown);
    }

    function openNewBatch() public onlyOwner {
        currentBatchId++;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch(uint256 batchId) public onlyOwner {
        if (batchId != currentBatchId) revert InvalidBatchError(); // Can only close the current batch
        batchClosed[batchId] = true;
        emit BatchClosed(batchId);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _initIfNeeded() internal {
        if (!FHE.isInitialized()) {
            FHE.initialize();
        }
    }

    function _requireInitialized() internal view {
        if (!FHE.isInitialized()) revert("FHE not initialized");
    }

    function submitEncryptedBid(
        uint256 batchId,
        bytes32 nftId,
        euint32 encryptedBidValue
    ) external onlyProvider whenNotPaused {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        if (batchClosed[batchId]) {
            revert BatchClosedError();
        }

        // Store encrypted bid (example: mapping (batchId => mapping (nftId => mapping (address => euint32)))
        // For this example, we'll just emit an event. Actual storage would be more complex.
        emit BidSubmitted(msg.sender, batchId, nftId);

        lastSubmissionTime[msg.sender] = block.timestamp;
    }

    function requestAuctionResultDecryption(uint256 batchId) external onlyProvider whenNotPaused {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        if (!batchClosed[batchId]) {
            revert("Batch not closed yet");
        }

        // For this example, we'll assume we have a way to get the winning bid ciphertexts.
        // In a real DEX, this would involve iterating over bids for the batchId.
        // Here, we'll use dummy ciphertexts.
        euint32 dummyWinningBidValue = FHE.asEuint32(0);
        euint32 dummyWinningBidderAddressPart1 = FHE.asEuint32(0); // Address split into two euint32
        euint32 dummyWinningBidderAddressPart2 = FHE.asEuint32(0);

        bytes32[] memory cts = new bytes32[](3);
        cts[0] = FHE.toBytes32(dummyWinningBidValue);
        cts[1] = FHE.toBytes32(dummyWinningBidderAddressPart1);
        cts[2] = FHE.toBytes32(dummyWinningBidderAddressPart2);

        bytes32 stateHash = _hashCiphertexts(cts);
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);

        decryptionContexts[requestId] = DecryptionContext({
            batchId: batchId,
            stateHash: stateHash,
            processed: false
        });

        emit DecryptionRequested(requestId, batchId);
        lastDecryptionRequestTime[msg.sender] = block.timestamp;
    }

    function myCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        DecryptionContext storage context = decryptionContexts[requestId];

        // Replay Guard
        if (context.processed) {
            revert ReplayError();
        }

        // State Verification
        // Rebuild cts array in the exact same order as in requestAuctionResultDecryption
        // For this example, we use dummy ciphertexts again.
        euint32 dummyWinningBidValue = FHE.asEuint32(0);
        euint32 dummyWinningBidderAddressPart1 = FHE.asEuint32(0);
        euint32 dummyWinningBidderAddressPart2 = FHE.asEuint32(0);

        bytes32[] memory cts = new bytes32[](3);
        cts[0] = FHE.toBytes32(dummyWinningBidValue);
        cts[1] = FHE.toBytes32(dummyWinningBidderAddressPart1);
        cts[2] = FHE.toBytes32(dummyWinningBidderAddressPart2);

        bytes32 currentHash = _hashCiphertexts(cts);
        if (currentHash != context.stateHash) {
            revert StateMismatchError();
        }

        // Proof Verification
        FHE.checkSignatures(requestId, cleartexts, proof);

        // Decode & Finalize
        // cleartexts is abi.encodePacked of the plaintext values in order
        // For this example: winningBidValue (uint32), winningBidderAddressPart1 (uint32), winningBidderAddressPart2 (uint32)
        // Total length should be 12 bytes (3 * 4 bytes)
        if (cleartexts.length != 12) revert("Invalid cleartexts length");

        uint32 winningBidValueUint32;
        uint32 bidderPart1;
        uint32 bidderPart2;
        assembly {
            winningBidValueUint32 := mload(add(cleartexts, 0x00))
            bidderPart1 := mload(add(cleartexts, 0x04))
            bidderPart2 := mload(add(cleartexts, 0x08))
        }

        // Reconstruct address from two uint32 parts
        address winningBidder = address(uint160((uint256(bidderPart1) << 32) | bidderPart2));

        context.processed = true;
        emit DecryptionCompleted(requestId, context.batchId, winningBidValueUint32, winningBidder);
    }
}