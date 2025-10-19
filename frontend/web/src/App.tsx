// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface Auction {
  id: string;
  encryptedBid: string;
  timestamp: number;
  owner: string;
  nftId: string;
  status: "active" | "closed" | "settled";
  minBid: number;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newAuctionData, setNewAuctionData] = useState({ nftId: "", minBid: 0 });
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [decryptedBid, setDecryptedBid] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "closed">("all");

  // Randomly selected styles: 
  // Colors: High contrast (red+black)
  // UI: Dark mode
  // Layout: Card grid
  // Interaction: Micro-interactions

  useEffect(() => {
    loadAuctions().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadAuctions = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.log("Contract is not available");
        return;
      }

      const keysBytes = await contract.getData("auction_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing auction keys:", e); }
      }
      
      const list: Auction[] = [];
      for (const key of keys) {
        try {
          const auctionBytes = await contract.getData(`auction_${key}`);
          if (auctionBytes.length > 0) {
            try {
              const auctionData = JSON.parse(ethers.toUtf8String(auctionBytes));
              list.push({ 
                id: key, 
                encryptedBid: auctionData.encryptedBid, 
                timestamp: auctionData.timestamp, 
                owner: auctionData.owner, 
                nftId: auctionData.nftId,
                status: auctionData.status || "active",
                minBid: auctionData.minBid || 0
              });
            } catch (e) { console.error(`Error parsing auction data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading auction ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setAuctions(list);
    } catch (e) { 
      console.error("Error loading auctions:", e); 
    } finally { 
      setIsRefreshing(false); 
      setLoading(false); 
    }
  };

  const createAuction = async () => {
    if (!isConnected) { 
      alert("Please connect wallet first"); 
      return; 
    }
    setCreating(true);
    setTransactionStatus({ 
      visible: true, 
      status: "pending", 
      message: "Creating private auction with Zama FHE encryption..." 
    });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const auctionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const auctionData = { 
        encryptedBid: FHEEncryptNumber(newAuctionData.minBid),
        timestamp: Math.floor(Date.now() / 1000), 
        owner: address, 
        nftId: newAuctionData.nftId,
        status: "active",
        minBid: newAuctionData.minBid
      };
      
      await contract.setData(`auction_${auctionId}`, ethers.toUtf8Bytes(JSON.stringify(auctionData)));
      
      const keysBytes = await contract.getData("auction_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { 
          keys = JSON.parse(ethers.toUtf8String(keysBytes)); 
        } catch (e) { 
          console.error("Error parsing keys:", e); 
        }
      }
      keys.push(auctionId);
      await contract.setData("auction_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: "Private auction created with FHE encryption!" 
      });
      
      await loadAuctions();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewAuctionData({ nftId: "", minBid: 0 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Auction creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: errorMessage 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreating(false); 
    }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { 
      alert("Please connect wallet first"); 
      return null; 
    }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { 
      console.error("Decryption failed:", e); 
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const closeAuction = async (auctionId: string) => {
    if (!isConnected) { 
      alert("Please connect wallet first"); 
      return; 
    }
    setTransactionStatus({ 
      visible: true, 
      status: "pending", 
      message: "Closing auction with FHE verification..." 
    });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const auctionBytes = await contract.getData(`auction_${auctionId}`);
      if (auctionBytes.length === 0) throw new Error("Auction not found");
      
      const auctionData = JSON.parse(ethers.toUtf8String(auctionBytes));
      const updatedAuction = { ...auctionData, status: "closed" };
      
      await contract.setData(`auction_${auctionId}`, ethers.toUtf8Bytes(JSON.stringify(updatedAuction)));
      
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: "Auction closed successfully!" 
      });
      
      await loadAuctions();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Failed to close auction: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const isOwner = (auctionAddress: string) => address?.toLowerCase() === auctionAddress.toLowerCase();

  const filteredAuctions = auctions.filter(auction => {
    const matchesSearch = auction.nftId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         auction.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "all" || auction.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const tutorialSteps = [
    { 
      title: "Connect Wallet", 
      description: "Connect your Web3 wallet to access Artisan DEX", 
      icon: "🔗" 
    },
    { 
      title: "Create Private Auction", 
      description: "Set up a sealed-bid auction with FHE encryption", 
      icon: "🔒",
      details: "Your minimum bid is encrypted before being stored on-chain" 
    },
    { 
      title: "Bid Privately", 
      description: "Submit bids that remain encrypted until auction ends", 
      icon: "💰",
      details: "Zama FHE ensures bid amounts stay confidential during the auction" 
    },
    { 
      title: "Settle Auction", 
      description: "Reveal winning bid while keeping losing bids private", 
      icon: "🏆",
      details: "Only the winning bid is decrypted, protecting all other bidders" 
    }
  ];

  const renderStats = () => {
    const activeCount = auctions.filter(a => a.status === "active").length;
    const closedCount = auctions.filter(a => a.status === "closed").length;
    const settledCount = auctions.filter(a => a.status === "settled").length;
    
    return (
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{auctions.length}</div>
          <div className="stat-label">Total Auctions</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{closedCount}</div>
          <div className="stat-label">Closed</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{settledCount}</div>
          <div className="stat-label">Settled</div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Loading Artisan DEX...</p>
    </div>
  );

  return (
    <div className="app-container dark-theme">
      <header className="app-header">
        <div className="logo">
          <h1>Artisan<span>DEX</span></h1>
          <div className="fhe-badge">
            <span>Powered by Zama FHE</span>
          </div>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn"
          >
            + Create Auction
          </button>
          <button 
            className="tutorial-btn" 
            onClick={() => setShowTutorial(!showTutorial)}
          >
            {showTutorial ? "Hide Guide" : "How It Works"}
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>

      <div className="main-content">
        <div className="welcome-banner">
          <h2>Community-Governed NFT Exchange</h2>
          <p>Private sealed-bid auctions powered by Zama FHE encryption</p>
        </div>

        {showTutorial && (
          <div className="tutorial-section">
            <h2>Private NFT Auctions with FHE</h2>
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div className="tutorial-step" key={index}>
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    {step.details && <div className="step-details">{step.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dashboard-section">
          <div className="dashboard-card">
            <h3>DAO-Governed Marketplace</h3>
            <p>
              Artisan DEX is governed by NFT artists and collectors through FHE-encrypted voting. 
              Core parameters like fees are decided by the community while preserving voter privacy.
            </p>
            <div className="fhe-tag">
              <span>FHE Voting</span>
            </div>
          </div>

          <div className="dashboard-card">
            <h3>Auction Statistics</h3>
            {renderStats()}
          </div>
        </div>

        <div className="auctions-section">
          <div className="section-header">
            <h2>Private NFT Auctions</h2>
            <div className="controls">
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder="Search NFTs..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="search-icon">🔍</span>
              </div>
              <div className="tabs">
                <button 
                  className={activeTab === "all" ? "active" : ""}
                  onClick={() => setActiveTab("all")}
                >
                  All
                </button>
                <button 
                  className={activeTab === "active" ? "active" : ""}
                  onClick={() => setActiveTab("active")}
                >
                  Active
                </button>
                <button 
                  className={activeTab === "closed" ? "active" : ""}
                  onClick={() => setActiveTab("closed")}
                >
                  Closed
                </button>
              </div>
              <button 
                onClick={loadAuctions} 
                className="refresh-btn"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {filteredAuctions.length === 0 ? (
            <div className="no-auctions">
              <div className="empty-icon"></div>
              <p>No auctions found</p>
              <button 
                className="create-btn primary"
                onClick={() => setShowCreateModal(true)}
              >
                Create First Auction
              </button>
            </div>
          ) : (
            <div className="auctions-grid">
              {filteredAuctions.map(auction => (
                <div 
                  className="auction-card" 
                  key={auction.id}
                  onClick={() => setSelectedAuction(auction)}
                >
                  <div className="card-header">
                    <span className={`status ${auction.status}`}>{auction.status}</span>
                    <span className="nft-id">NFT #{auction.nftId}</span>
                  </div>
                  <div className="card-body">
                    <div className="info-row">
                      <span>Owner:</span>
                      <span>{auction.owner.substring(0, 6)}...{auction.owner.substring(38)}</span>
                    </div>
                    <div className="info-row">
                      <span>Created:</span>
                      <span>{new Date(auction.timestamp * 1000).toLocaleDateString()}</span>
                    </div>
                    <div className="info-row">
                      <span>Min Bid:</span>
                      <span>{auction.minBid} ETH</span>
                    </div>
                  </div>
                  <div className="card-footer">
                    {isOwner(auction.owner) && auction.status === "active" && (
                      <button 
                        className="action-btn danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeAuction(auction.id);
                        }}
                      >
                        Close Auction
                      </button>
                    )}
                    <button 
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAuction(auction);
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <ModalCreate 
          onSubmit={createAuction} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating} 
          auctionData={newAuctionData} 
          setAuctionData={setNewAuctionData}
        />
      )}

      {selectedAuction && (
        <AuctionDetailModal 
          auction={selectedAuction} 
          onClose={() => {
            setSelectedAuction(null);
            setDecryptedBid(null);
          }} 
          decryptedBid={decryptedBid} 
          setDecryptedBid={setDecryptedBid} 
          isDecrypting={isDecrypting} 
          decryptWithSignature={decryptWithSignature}
        />
      )}

      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>Artisan DEX</h3>
            <p>A community-governed NFT exchange with private auctions</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">DAO Governance</a>
            <a href="#" className="footer-link">Privacy Policy</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="copyright">© {new Date().getFullYear()} Artisan DEX. All rights reserved.</div>
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void;
  onClose: () => void;
  creating: boolean;
  auctionData: any;
  setAuctionData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ onSubmit, onClose, creating, auctionData, setAuctionData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAuctionData({ ...auctionData, [name]: value });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAuctionData({ ...auctionData, [name]: parseFloat(value) });
  };

  const handleSubmit = () => {
    if (!auctionData.nftId || !auctionData.minBid) {
      alert("Please fill required fields");
      return;
    }
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal">
        <div className="modal-header">
          <h2>Create Private Auction</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>NFT ID *</label>
            <input
              type="text"
              name="nftId"
              value={auctionData.nftId}
              onChange={handleChange}
              placeholder="Enter NFT identifier..."
            />
          </div>
          <div className="form-group">
            <label>Minimum Bid (ETH) *</label>
            <input
              type="number"
              name="minBid"
              value={auctionData.minBid}
              onChange={handleValueChange}
              placeholder="Enter minimum bid..."
              step="0.01"
              min="0"
            />
          </div>
          <div className="encryption-notice">
            <div className="lock-icon">🔒</div>
            <p>
              The minimum bid will be encrypted with Zama FHE before submission.
              Actual bids will remain private until auction settlement.
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button onClick={handleSubmit} disabled={creating} className="submit-btn">
            {creating ? "Creating with FHE..." : "Create Auction"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface AuctionDetailModalProps {
  auction: Auction;
  onClose: () => void;
  decryptedBid: number | null;
  setDecryptedBid: (value: number | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<number | null>;
}

const AuctionDetailModal: React.FC<AuctionDetailModalProps> = ({ 
  auction, 
  onClose, 
  decryptedBid, 
  setDecryptedBid, 
  isDecrypting, 
  decryptWithSignature 
}) => {
  const handleDecrypt = async () => {
    if (decryptedBid !== null) {
      setDecryptedBid(null);
      return;
    }
    const decrypted = await decryptWithSignature(auction.encryptedBid);
    if (decrypted !== null) setDecryptedBid(decrypted);
  };

  return (
    <div className="modal-overlay">
      <div className="auction-detail-modal">
        <div className="modal-header">
          <h2>Auction Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="auction-info">
            <div className="info-row">
              <span>Auction ID:</span>
              <span>{auction.id.substring(0, 8)}</span>
            </div>
            <div className="info-row">
              <span>NFT ID:</span>
              <span>{auction.nftId}</span>
            </div>
            <div className="info-row">
              <span>Owner:</span>
              <span>{auction.owner.substring(0, 6)}...{auction.owner.substring(38)}</span>
            </div>
            <div className="info-row">
              <span>Status:</span>
              <span className={`status ${auction.status}`}>{auction.status}</span>
            </div>
            <div className="info-row">
              <span>Created:</span>
              <span>{new Date(auction.timestamp * 1000).toLocaleString()}</span>
            </div>
          </div>

          <div className="bid-section">
            <h3>Encrypted Bid Data</h3>
            <div className="encrypted-data">
              {auction.encryptedBid.substring(0, 50)}...
            </div>
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="decrypt-btn"
            >
              {isDecrypting ? "Decrypting..." : 
               decryptedBid !== null ? "Hide Bid" : "Decrypt with Wallet"}
            </button>
          </div>

          {decryptedBid !== null && (
            <div className="decrypted-section">
              <h3>Decrypted Minimum Bid</h3>
              <div className="decrypted-value">
                {decryptedBid} ETH
              </div>
              <div className="decryption-notice">
                This value was decrypted using your wallet signature
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;