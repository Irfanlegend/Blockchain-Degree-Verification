import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Papa from 'papaparse';
import { CONTRACT_ADDRESS, CONTRACT_ABI, AMOY_CHAIN_ID } from './config';
import Dashboard from './Dashboard';
import BatchOperations from './BatchOperations';

// SVG Logos
const PolygonLogo = () => (
  <svg width="120" height="30" viewBox="0 0 120 30" fill="none">
    <path d="M15 5L20 8V14L15 17L10 14V8L15 5Z" fill="#8247E5"/>
    <text x="30" y="20" fontSize="16" fontWeight="bold" fill="#8247E5">Polygon</text>
  </svg>
);

const TrustChainLogo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <div style={{
      width: '50px',
      height: '50px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '28px',
      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
    }}>
      🎓
    </div>
    <div>
      <div style={{ 
        fontSize: '32px', 
        fontWeight: '800', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-1px'
      }}>
        TrustChain
      </div>
      <div style={{ fontSize: '11px', color: '#8247E5', fontWeight: '600', marginTop: '-4px' }}>
        Blockchain Credentials
      </div>
    </div>
  </div>
);

function UniversityPortal() {
  // States
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [universityName, setUniversityName] = useState('');
  const [csvData, setCsvData] = useState([]);
  const [issuedCount, setIssuedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalCredentials: 0, totalIssuers: 0 });
  const [issuedCredentials, setIssuedCredentials] = useState([]);
  const [showHashModal, setShowHashModal] = useState(false);
  const [searchHash, setSearchHash] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('issue');
  const [isConnecting, setIsConnecting] = useState(false);

  // Connect Wallet
  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      setError('');

      if (!window.ethereum) {
        setError('MetaMask not installed');
        window.open('https://metamask.io/download/', '_blank');
        return;
      }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });

      if (parseInt(chainId, 16) !== AMOY_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x13882' }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x13882',
                chainName: 'Polygon Amoy Testnet',
                nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                rpcUrls: ['https://rpc-amoy.polygon.technology'],
                blockExplorerUrls: ['https://amoy.polygonscan.com/'],
              }],
            });
          }
        }
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setContract(contractInstance);

      await checkIssuerStatus(contractInstance, accounts[0]);
      await loadStats(contractInstance);
    } catch (error) {
      setError('Connection failed: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect Wallet
  const disconnectWallet = () => {
    setAccount('');
    setContract(null);
    setIsRegistered(false);
    setUniversityName('');
    setCsvData([]);
    setActiveTab('issue');
  };

  // Check Issuer Status
  const checkIssuerStatus = async (contractInstance, address) => {
    try {
      const issuerInfo = await contractInstance.getIssuerInfo(address);
      if (issuerInfo[2]) {
        setIsRegistered(true);
        setUniversityName(issuerInfo[0]);
      }
    } catch (error) {
      console.error('Error checking issuer:', error);
    }
  };

  // Load Stats
  const loadStats = async (contractInstance) => {
    try {
      const stats = await contractInstance.getStats();
      setStats({
        totalCredentials: stats[0].toNumber(),
        totalIssuers: stats[1].toNumber()
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Register as Issuer
  const registerAsIssuer = async () => {
    if (!universityName.trim()) {
      setError('Please enter university name');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const did = `did:polygon:${account.slice(0, 10)}`;
      const tx = await contract.selfRegisterIssuer(universityName, did);
      await tx.wait();
      setIsRegistered(true);
      await loadStats(contract);
    } catch (error) {
      setError('Registration failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle CSV Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        setIssuedCredentials([]);
      },
      error: (error) => setError('CSV parsing error: ' + error.message)
    });
  };

  // Issue Credentials
  const issueCredentials = async () => {
    if (csvData.length === 0) {
      setError('Upload CSV first');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setIssuedCount(0);

      const hashes = [];
      const holders = [];
      const types = [];
      const credentialDetails = [];

      for (let student of csvData) {
        const credentialData = {
          name: student.name,
          degree: student.degree,
          year: student.year,
          rollNo: student.rollNo,
          university: universityName,
          issuedDate: new Date().toISOString()
        };

        const hash = ethers.utils.id(JSON.stringify(credentialData));
        const holderAddress = student.walletAddress && ethers.utils.isAddress(student.walletAddress)
          ? student.walletAddress
          : ethers.constants.AddressZero;

        hashes.push(hash);
        holders.push(holderAddress);
        types.push(student.degree || 'Degree');

        credentialDetails.push({
          hash,
          name: student.name,
          degree: student.degree,
          year: student.year,
          rollNo: student.rollNo,
          walletAddress: holderAddress,
          issuedDate: new Date().toISOString()
        });
      }

      const batchSize = 50;
      for (let i = 0; i < hashes.length; i += batchSize) {
        const batchHashes = hashes.slice(i, i + batchSize);
        const batchHolders = holders.slice(i, i + batchSize);
        const batchTypes = types.slice(i, i + batchSize);

        const tx = await contract.batchIssueCredentials(batchHashes, batchHolders, batchTypes);
        await tx.wait();
        setIssuedCount(i + batchHashes.length);
      }

      setIssuedCredentials(credentialDetails);
      setShowHashModal(true);
      await loadStats(contract);
    } catch (error) {
      setError('Issuance failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Export Hashes
  const exportHashesToCSV = () => {
    const csvContent = [
      ['Name', 'Degree', 'Year', 'Roll No', 'Wallet Address', 'Credential Hash', 'Issued Date'],
      ...issuedCredentials.map(c => [c.name, c.degree, c.year, c.rollNo, c.walletAddress, c.hash, new Date(c.issuedDate).toLocaleString()])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credentials-${Date.now()}.csv`;
    a.click();
  };

  // Copy Hash
  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    alert('Hash copied!');
  };

  // Search Credential
  const searchCredential = async () => {
    if (!searchHash.trim()) {
      setError('Enter credential hash');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await contract.verifyCredential(searchHash);
      
      if (!result[0]) {
        setError('Credential not found');
        setSearchResult(null);
        return;
      }

      setSearchResult({
        hash: searchHash,
        exists: result[0],
        isValid: result[1],
        issuer: result[2],
        holder: result[3],
        credentialType: result[4],
        issuedDate: new Date(result[5].toNumber() * 1000).toLocaleString(),
        issuerName: result[6]
      });
    } catch (error) {
      setError('Search failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Revoke Credential
  const revokeCredential = async () => {
    if (!searchResult) return;

    if (!window.confirm(`Revoke this credential?\n\n${searchResult.credentialType}\n\nThis cannot be undone!`)) return;

    try {
      setRevoking(true);
      const tx = await contract.revokeCredential(searchResult.hash);
      await tx.wait();
      alert('✅ Credential revoked');
      await searchCredential();
    } catch (error) {
      setError('Revocation failed: ' + error.message);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <TrustChainLogo />
          <div style={styles.headerRight}>
            <div style={styles.poweredBy}>
              <span style={styles.poweredByText}>Built on</span>
              <PolygonLogo />
            </div>
            {account && (
              <div style={styles.accountBadge}>
                <div style={styles.accountDot}></div>
                <span style={styles.accountText}>{account.slice(0, 6)}...{account.slice(-4)}</span>
                <button onClick={disconnectWallet} style={styles.disconnectBtn}>✕</button>
              </div>
            )}
          </div>
        </div>
        
        <div style={styles.headerContent}>
          <h1 style={styles.title}>University Credential Portal</h1>
          <p style={styles.subtitle}>Issue tamper-proof blockchain credentials in seconds</p>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={styles.errorClose}>✕</button>
        </div>
      )}

      {/* Connect Wallet */}
      {!account ? (
        <div style={styles.connectSection}>
          <div style={styles.connectCard}>
            <div style={styles.connectIcon}>🦊</div>
            <h2 style={styles.connectTitle}>Connect Your Wallet</h2>
            <p style={styles.connectDesc}>Connect MetaMask to start issuing blockchain-verified credentials</p>
            
            {isConnecting ? (
              <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Connecting to Polygon Amoy...</p>
              </div>
            ) : (
              <button onClick={connectWallet} style={styles.connectButton}>
                <span style={styles.buttonIcon}>🔐</span>
                Connect MetaMask
              </button>
            )}
            
            <div style={styles.connectFeatures}>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>⚡</span>
                <span>Instant issuance</span>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>🔒</span>
                <span>Tamper-proof</span>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>🌐</span>
                <span>Decentralized</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.mainContent}>
          {/* Registration */}
          {!isRegistered && (
            <div style={styles.registerCard}>
              <h2 style={styles.cardTitle}>🏛️ Register Your University</h2>
              <p style={styles.cardDesc}>Register once to start issuing credentials</p>
              
              {loading ? (
                <div style={styles.loadingContainer}>
                  <div style={styles.spinner}></div>
                  <p>Registering on blockchain...</p>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Enter University Name (e.g., IIT Delhi)"
                    value={universityName}
                    onChange={(e) => setUniversityName(e.target.value)}
                    style={styles.input}
                  />
                  <button onClick={registerAsIssuer} style={styles.primaryButton}>
                    📝 Register University
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tabs */}
          {isRegistered && (
            <>
              <div style={styles.tabContainer}>
                <button
                  onClick={() => setActiveTab('issue')}
                  style={{...styles.tab, ...(activeTab === 'issue' && styles.tabActive)}}
                >
                  <span style={styles.tabIcon}>📤</span>
                  Issue
                </button>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  style={{...styles.tab, ...(activeTab === 'dashboard' && styles.tabActive)}}
                >
                  <span style={styles.tabIcon}>📊</span>
                  Analytics
                </button>
                <button
                  onClick={() => setActiveTab('batch')}
                  style={{...styles.tab, ...(activeTab === 'batch' && styles.tabActive)}}
                >
                  <span style={styles.tabIcon}>⚙️</span>
                  Batch Operations
                </button>
                <button
                  onClick={() => setActiveTab('revoke')}
                  style={{...styles.tab, ...(activeTab === 'revoke' && styles.tabActive)}}
                >
                  <span style={styles.tabIcon}>🚫</span>
                  Revoke
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'issue' && (
                <div style={styles.tabContent}>
                  {/* Stats */}
                  <div style={styles.statsGrid}>
                    <div style={styles.statCard}>
                      <div style={styles.statIcon}>📜</div>
                      <div>
                        <div style={styles.statValue}>{stats.totalCredentials}</div>
                        <div style={styles.statLabel}>Total Issued</div>
                      </div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={styles.statIcon}>🏛️</div>
                      <div>
                        <div style={styles.statValue}>{stats.totalIssuers}</div>
                        <div style={styles.statLabel}>Universities</div>
                      </div>
                    </div>
                  </div>

                  {/* CSV Upload */}
                  <div style={styles.card}>
                    <h3 style={styles.cardTitle}>📤 Upload Student Data</h3>
                    <p style={styles.cardDesc}>CSV Format: name, degree, year, rollNo, walletAddress</p>
                    <input type="file" accept=".csv" onChange={handleFileUpload} style={styles.fileInput} />
                    {csvData.length > 0 && (
                      <div style={styles.fileSuccess}>
                        ✅ {csvData.length} records loaded
                      </div>
                    )}
                  </div>

                  {/* CSV Preview */}
                  {csvData.length > 0 && (
                    <div style={styles.card}>
                      <h3 style={styles.cardTitle}>📊 Preview</h3>
                      <div style={styles.tableContainer}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Name</th>
                              <th style={styles.th}>Degree</th>
                              <th style={styles.th}>Year</th>
                              <th style={styles.th}>Roll No</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvData.slice(0, 5).map((s, i) => (
                              <tr key={i}>
                                <td style={styles.td}>{s.name}</td>
                                <td style={styles.td}>{s.degree}</td>
                                <td style={styles.td}>{s.year}</td>
                                <td style={styles.td}>{s.rollNo}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {csvData.length > 5 && <p style={styles.moreText}>...and {csvData.length - 5} more</p>}
                      </div>

                      {loading ? (
                        <div style={styles.loadingContainer}>
                          <div style={styles.spinner}></div>
                          <p>Issuing {issuedCount}/{csvData.length} credentials...</p>
                          <div style={styles.progressBar}>
                            <div style={{...styles.progressFill, width: `${(issuedCount/csvData.length)*100}%`}} />
                          </div>
                        </div>
                      ) : (
                        <button onClick={issueCredentials} style={styles.primaryButton}>
                          🚀 Issue {csvData.length} Credentials
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'dashboard' && <Dashboard contract={contract} account={account} />}
              {activeTab === 'batch' && <BatchOperations contract={contract} universityName={universityName} />}
              
              {activeTab === 'revoke' && (
                <div style={styles.tabContent}>
                  <div style={styles.card}>
                    <h3 style={styles.cardTitle}>🚫 Revoke Credential</h3>
                    <p style={styles.cardDesc}>Search by hash to revoke</p>
                    
                    <div style={styles.searchContainer}>
                      <input
                        type="text"
                        placeholder="Enter credential hash (0x...)"
                        value={searchHash}
                        onChange={(e) => setSearchHash(e.target.value)}
                        style={{...styles.input, flex: 1}}
                      />
                      <button onClick={searchCredential} disabled={loading} style={styles.searchButton}>
                        {loading ? '⏳' : '🔍'} Search
                      </button>
                    </div>

                    {searchResult && (
                      <div style={{...styles.resultCard, borderColor: searchResult.isValid ? '#48bb78' : '#f56565'}}>
                        <h4 style={{color: searchResult.isValid ? '#48bb78' : '#f56565'}}>
                          {searchResult.isValid ? '✅ VALID' : '❌ REVOKED'}
                        </h4>
                        <p><strong>Type:</strong> {searchResult.credentialType}</p>
                        <p><strong>Issued:</strong> {searchResult.issuedDate}</p>
                        <p><strong>Hash:</strong> {searchResult.hash.slice(0, 20)}...</p>
                        {searchResult.isValid && (
                          <button onClick={revokeCredential} disabled={revoking} style={styles.revokeButton}>
                            {revoking ? '⏳ Revoking...' : '🚫 REVOKE'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Hash Modal */}
      {showHashModal && (
        <div style={styles.modalOverlay} onClick={() => setShowHashModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>✅ Credentials Issued!</h2>
              <button onClick={() => setShowHashModal(false)} style={styles.modalClose}>✕</button>
            </div>
            <p style={styles.modalDesc}>Share these hashes with students</p>
            
            <button onClick={exportHashesToCSV} style={styles.exportButton}>
              📥 Export All Hashes
            </button>

            <div style={styles.hashList}>
              {issuedCredentials.map((c, i) => (
                <div key={i} style={styles.hashItem}>
                  <div>
                    <strong>{c.name}</strong>
                    <div style={styles.hashValue}>{c.hash}</div>
                  </div>
                  <button onClick={() => copyHash(c.hash)} style={styles.copyButton}>
                    📋
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div>
            <p style={styles.footerText}>Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}</p>
            <a href={`https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={styles.footerLink}>
              View on PolygonScan →
            </a>
          </div>
          <div style={styles.poweredBy}>
            <span style={styles.poweredByText}>Powered by</span>
            <PolygonLogo />
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 30px rgba(102, 126, 234, 0.3);
        }
      `}</style>
    </div>
  );
}

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(102, 126, 234, 0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 40px',
    flexWrap: 'wrap',
    gap: '20px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  poweredBy: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  poweredByText: {
    fontSize: '12px',
    color: '#718096',
    fontWeight: '500',
  },
  accountBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#f0f4ff',
    padding: '10px 16px',
    borderRadius: '12px',
    border: '2px solid #667eea',
  },
  accountDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#48bb78',
    animation: 'pulse 2s infinite',
  },
  accountText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#667eea',
    fontFamily: 'monospace',
  },
  disconnectBtn: {
    background: 'transparent',
    border: 'none',
    color: '#718096',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
  },
  headerContent: {
    textAlign: 'center',
    padding: '30px 20px',
  },
  title: {
    fontSize: '42px',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 10px 0',
    letterSpacing: '-1px',
  },
  subtitle: {
    fontSize: '18px',
    color: '#718096',
    margin: 0,
    fontWeight: '500',
  },
  errorBanner: {
    background: '#f56565',
    color: 'white',
    padding: '15px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorClose: {
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '20px',
    cursor: 'pointer',
  },
  connectSection: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '70vh',
    padding: '40px 20px',
  },
  connectCard: {
    background: 'white',
    borderRadius: '24px',
    padding: '60px',
    maxWidth: '500px',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    animation: 'fadeIn 0.5s ease',
  },
  connectIcon: {
    fontSize: '80px',
    marginBottom: '20px',
  },
  connectTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: '15px',
  },
  connectDesc: {
    fontSize: '16px',
    color: '#718096',
    marginBottom: '40px',
    lineHeight: '1.6',
  },
  connectButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '18px 40px',
    fontSize: '18px',
    fontWeight: '700',
    borderRadius: '12px',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    transition: 'all 0.3s',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
  },
  buttonIcon: {
    fontSize: '24px',
  },
  connectFeatures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginTop: '40px',
    paddingTop: '40px',
    borderTop: '1px solid #e2e8f0',
  },
  feature: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#4a5568',
    fontWeight: '500',
  },
  featureIcon: {
    fontSize: '28px',
  },
  mainContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  registerCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '50px',
    maxWidth: '600px',
    margin: '0 auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    animation: 'fadeIn 0.5s ease',
  },
  cardTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: '10px',
  },
  cardDesc: {
    fontSize: '16px',
    color: '#718096',
    marginBottom: '30px',
  },
  input: {
    width: '100%',
    padding: '16px 20px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    marginBottom: '20px',
    boxSizing: 'border-box',
    transition: 'all 0.3s',
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '18px 40px',
    fontSize: '18px',
    fontWeight: '700',
    borderRadius: '12px',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.3s',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
  },
  tabContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '40px',
    background: 'rgba(255, 255, 255, 0.1)',
    padding: '12px',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tab: {
    background: 'transparent',
    border: 'none',
    color: 'white',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: '600',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    opacity: 0.7,
  },
  tabActive: {
    background: 'white',
    color: '#667eea',
    opacity: 1,
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  },
  tabIcon: {
    fontSize: '20px',
  },
  tabContent: {
    animation: 'fadeIn 0.5s ease',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginBottom: '30px',
  },
  statCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    transition: 'all 0.3s',
    cursor: 'pointer',
    border: '2px solid transparent',
    className: 'stat-card',
  },
  statIcon: {
    fontSize: '48px',
  },
  statValue: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#2d3748',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#718096',
    fontWeight: '600',
  },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    marginBottom: '30px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
  },
  fileInput: {
    marginTop: '15px',
    marginBottom: '15px',
  },
  fileSuccess: {
    background: '#f0fff4',
    border: '2px solid #48bb78',
    borderRadius: '12px',
    padding: '15px',
    color: '#22543d',
    fontWeight: '600',
    marginTop: '15px',
  },
  tableContainer: {
    overflowX: 'auto',
    marginBottom: '30px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '16px',
    textAlign: 'left',
    fontWeight: '700',
    fontSize: '14px',
  },
  td: {
    padding: '16px',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '14px',
    color: '#4a5568',
  },
  moreText: {
    textAlign: 'center',
    color: '#718096',
    marginTop: '15px',
    fontSize: '14px',
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '40px',
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px',
  },
  progressBar: {
    width: '100%',
    height: '12px',
    background: '#e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden',
    marginTop: '20px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #667eea 0%, #48bb78 100%)',
    transition: 'width 0.5s ease',
    borderRadius: '6px',
  },
  searchContainer: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  searchButton: {
    background: '#4299e1',
    color: 'white',
    border: 'none',
    padding: '16px 30px',
    fontSize: '16px',
    fontWeight: '700',
    borderRadius: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  resultCard: {
    marginTop: '30px',
    padding: '30px',
    borderRadius: '16px',
    border: '3px solid',
    background: '#f7fafc',
  },
  revokeButton: {
    background: '#f56565',
    color: 'white',
    border: 'none',
    padding: '14px 30px',
    fontSize: '16px',
    fontWeight: '700',
    borderRadius: '12px',
    cursor: 'pointer',
    marginTop: '20px',
    width: '100%',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    background: 'white',
    borderRadius: '24px',
    padding: '40px',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    fontSize: '32px',
    cursor: 'pointer',
    color: '#718096',
  },
  modalDesc: {
    color: '#718096',
    marginBottom: '30px',
    fontSize: '16px',
  },
  exportButton: {
    background: '#4299e1',
    color: 'white',
    border: 'none',
    padding: '16px 30px',
    fontSize: '16px',
    fontWeight: '700',
    borderRadius: '12px',
    cursor: 'pointer',
    width: '100%',
    marginBottom: '30px',
  },
  hashList: {
    maxHeight: '400px',
    overflowY: 'auto',
  },
  hashItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    background: '#f7fafc',
    borderRadius: '12px',
    marginBottom: '12px',
    border: '1px solid #e2e8f0',
  },
  hashValue: {
    fontSize: '12px',
    color: '#718096',
    fontFamily: 'monospace',
    marginTop: '8px',
    wordBreak: 'break-all',
  },
  copyButton: {
    background: '#667eea',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '18px',
  },
  footer: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderTop: '1px solid rgba(102, 126, 234, 0.1)',
    padding: '30px 40px',
    marginTop: '60px',
  },
  footerContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px',
  },
  footerText: {
    fontSize: '14px',
    color: '#718096',
    margin: '0 0 8px 0',
    fontFamily: 'monospace',
  },
  footerLink: {
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '14px',
  },
};

export default UniversityPortal;
