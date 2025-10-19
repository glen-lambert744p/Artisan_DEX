# Artisan DEX: A Community-Governed NFT Exchange with Private Auctions

Artisan DEX is a pioneering NFT exchange designed to empower artists and collectors through community governance, all while utilizing **Zama's Fully Homomorphic Encryption (FHE) technology**. Our platform offers a unique environment where participants can engage in private, sealed-bid auctions, ensuring their confidentiality and protecting their personal data.

## The Challenge We Address

In the ever-evolving landscape of digital art and collectibles, traditional NFT marketplaces often expose users to privacy breaches during bidding processes. Artists and collectors face the fear of their bids being visible to competitors, which can lead to a distrustful environment and discourage active participation. Additionally, the decision-making processes regarding fees and auction parameters lack transparency, often sidelining the community's voice.

## How FHE Provides the Solution

Artisan DEX leverages **Zama's open-source libraries**, including **Concrete**, **TFHE-rs**, and the **zama-fhe SDK**, to deliver a solution that prioritizes user privacy. By employing Fully Homomorphic Encryption, we are able to conduct computations on encrypted data—meaning bids and other sensitive information remain sealed and secure, even during the auction process. This ensures that only the rightful winner of an auction can reveal their bid, fostering a trustworthy environment for all participants.

## Core Functionalities

Here’s what Artisan DEX brings to the table:

- **Decentralized Governance**: The core parameters of the DEX, such as fees and auction mechanics, are decided through community voting facilitated by FHE encryption.
- **Private Sealed-Bid Auctions**: Participants can engage in bidding without the worry of their offer being exposed to others.
- **NFT Fragmentation**: Allows for fractional ownership of high-value NFTs, making art more accessible to a broader audience.
- **Privacy-Preserving Ownership**: Users can hold NFTs while keeping their ownership details confidential.

## Technology Stack

Artisan DEX is built upon a robust technology stack:

- **Zama's FHE SDK**: Main component for confidential computing.
- **Solidity**: Smart contract language for Ethereum.
- **Node.js**: Server-side environment for application development.
- **Hardhat**: Development environment for compiling, deploying, and testing smart contracts.

## Directory Structure

Here’s a glimpse at the project structure:

```
Artisan_DEX/
├── contracts/
│   ├── Artisan_DEX.sol
├── scripts/
│   ├── deploy.js
│   ├── auction.js
├── tests/
│   ├── test_artisan_dex.js
├── package.json
├── README.md
```

## Installation Steps

To get started with Artisan DEX, ensure you have Node.js and Hardhat installed on your development environment. Follow these steps:

1. **Clone the repository** (do not use `git clone`).
2. Navigate to the project directory.
3. Run the following command to install dependencies, including Zama’s FHE libraries:
   ```bash
   npm install
   ```

## Build & Run Instructions

After installing the necessary dependencies, you can compile and test the project. Use the following commands:

- **Compile Contracts**:
   ```bash
   npx hardhat compile
   ```

- **Run Tests**:
   ```bash
   npx hardhat test
   ```

- **Deploy to Local Network**:
   ```bash
   npx hardhat run scripts/deploy.js
   ```

### Example of a Smart Contract Function

Here’s a code snippet demonstrating how bids are processed on Artisan DEX, ensuring privacy with FHE:

```solidity
pragma solidity ^0.8.0;

import "./Artisan_DEX.sol";

contract Auction {
    mapping(address => uint256) private bids;

    function placeBid(uint256 encryptedBid) public {
        // Store encrypted bid using FHE
        bids[msg.sender] = encryptedBid;
    }

    function revealBid() public view returns (uint256) {
        // Logic to decrypt and reveal the bid
        return bids[msg.sender]; // Placeholder for decryption logic
    }
}
```

## Acknowledgements

### Powered by Zama

Artisan DEX extends its heartfelt thanks to the Zama team. Their groundbreaking work and open-source tools are crucial in making confidential blockchain applications possible, enabling us to provide a secure and private NFT marketplace for artists and collectors alike.

---

Join us in revolutionizing the NFT landscape while preserving user privacy and enhancing community governance. Together, let’s build a more secure and inclusive world for digital art!
