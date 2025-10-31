import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Papa from 'papaparse';
import { CONTRACT_ADDRESS, CONTRACT_ABI, POLYGON_AMOY_RPC } from './config';

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
      background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '28px',
      boxShadow: '0 4px 15px rgba(72, 187, 120, 0.4)'
    }}>
      ✅
    </div>
    <div>
      <div style={{ 
        fontSize: '32px', 
        fontWeight: '800', 
        background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-1px'
      }}>
        TrustChain
      </div>
      <div style={{ fontSize: '11px', color: '#48bb78', fontWeight: '600', marginTop: '-4px' }}>
        Instant Verification
      </div>
    </div>
  </div>
);

function VerifierPortal() {
  // States
  const [scanning, setScanning] = useState(false);
  const [manualHash, setManualHash] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('single');
  const [bulkCsvData, setBulkCsvData] = useState([]);
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [processingBulk, setProcessingBulk] = useState(false);
  
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);

  // Initialize provider and contract
  const provider = new ethers.providers.JsonRpcProvider(POLYGON_AMOY_RPC);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  // Initialize QR Scanner
  useEffect(() => {
    if (scanning && !scannerInstanceRef.current) {
      try {
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { 
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          false
        );

        scanner.render(
          (decodedText) => {
            try {
              if (!decodedText || decodedText === 'undefined') return;
              
              const data = JSON.parse(decodedText);
              if (data.hash) {
                verifyCredentialOnBlockchain(data);
                scanner.clear();
                scannerInstanceRef.current = null;
                setScanning(false);
              }
            } catch (err) {
              console.log('Invalid QR:', err);
            }
          },
          () => {}
        );

        scannerInstanceRef.current = scanner;
      } catch (err) {
        setError('Camera initialization failed. Check permissions.');
      }
    }

    return () => {
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.clear().catch(console.error);
        scannerInstanceRef.current = null;
      }
    };
  }, [scanning]);

  // Verify credential on blockchain
  const verifyCredentialOnBlockchain = async (credentialData) => {
    try {
      setLoading(true);
      setError('');

      const hash = credentialData.hash;
      if (!hash || hash === 'undefined') {
        setError('Invalid credential hash');
        return;
      }

      const verification = await contract.verifyCredential(hash);

      const result = {
        hash: hash,
        exists: verification[0],
        isValid: verification[1],
        issuer: verification[2],
        holder: verification[3],
        credentialType: verification[4],
        issuedDate: new Date(verification[5].toNumber() * 1000).toLocaleString(),
        issuerName: verification[6],
        qrData: credentialData,
        timestamp: new Date().toLocaleString(),
        verificationId: Date.now()
      };

      setVerificationResult(result);
      setVerificationHistory(prev => [result, ...prev].slice(0, 50));
      
    } catch (err) {
      setError('Verification failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manual hash verification
  const verifyManualHash = async () => {
    if (!manualHash.trim()) {
      setError('Please enter a credential hash');
      return;
    }

    if (!manualHash.startsWith('0x')) {
      setError('Hash must start with 0x');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const verification = await contract.verifyCredential(manualHash);

      const result = {
        hash: manualHash,
        exists: verification[0],
        isValid: verification[1],
        issuer: verification[2],
        holder: verification[3],
        credentialType: verification[4],
        issuedDate: new Date(verification[5].toNumber() * 1000).toLocaleString(),
        issuerName: verification[6],
        timestamp: new Date().toLocaleString(),
        verificationId: Date.now()
      };

      setVerificationResult(result);
      setVerificationHistory(prev => [result, ...prev].slice(0, 50));
      
    } catch (err) {
      setError('Verification failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Bulk CSV upload
  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setBulkCsvData(results.data);
        setBulkResults([]);
        setError('');
      },
      error: (error) => setError('CSV parsing error: ' + error.message)
    });
  };

  // Bulk verify
  const processBulkVerification = async () => {
    if (bulkCsvData.length === 0) {
      setError('Please upload a CSV file first');
      return;
    }

    try {
      setProcessingBulk(true);
      setError('');
      setBulkProgress({ current: 0, total: bulkCsvData.length });
      const results = [];

      for (let i = 0; i < bulkCsvData.length; i++) {
        const item = bulkCsvData[i];
        
        try {
          const verification = await contract.verifyCredential(item.hash);
          
          results.push({
            hash: item.hash,
            name: item.name || 'N/A',
            exists: verification[0],
            isValid: verification[1],
            credentialType: verification[4],
            issuerName: verification[6],
            status: verification[0] && verification[1] ? 'Valid' : verification[0] ? 'Revoked' : 'Not Found'
          });
        } catch (error) {
          results.push({
            hash: item.hash,
            name: item.name || 'N/A',
            exists: false,
            isValid: false,
            status: 'Error',
            error: error.message
          });
        }

        setBulkProgress({ current: i + 1, total: bulkCsvData.length });
      }

      setBulkResults(results);
      alert(`✅ Bulk verification complete!\nValid: ${results.filter(r => r.status === 'Valid').length}\nRevoked: ${results.filter(r => r.status === 'Revoked').length}\nNot Found: ${results.filter(r => r.status === 'Not Found').length}`);

    } catch (error) {
      setError('Bulk verification failed: ' + error.message);
    } finally {
      setProcessingBulk(false);
    }
  };

  // Export bulk results
  const exportBulkResults = () => {
    const csvContent = [
      ['Name', 'Hash', 'Status', 'Credential Type', 'Issuer'],
      ...bulkResults.map(r => [
        r.name,
        r.hash,
        r.status,
        r.credentialType || 'N/A',
        r.issuerName || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-verification-${Date.now()}.csv`;
    a.click();
  };

  // Download certificate
  const downloadCertificate = (result) => {
    const certificate = `
CREDENTIAL VERIFICATION CERTIFICATE
====================================

Verification Status: ${result.isValid ? 'VERIFIED ✅' : result.exists ? 'REVOKED ⚠️' : 'NOT FOUND ❌'}
Exists on Blockchain: ${result.exists ? 'Yes' : 'No'}

Credential Details:
------------------
Type: ${result.credentialType || 'N/A'}
Issuer: ${result.issuerName || 'N/A'}
Issuer Address: ${result.issuer || 'N/A'}
Holder Address: ${result.holder || 'N/A'}
Issued Date: ${result.issuedDate || 'N/A'}

Verification Details:
--------------------
Verified On: ${result.timestamp}
Credential Hash: ${result.hash}
Blockchain: Polygon Amoy Testnet
Contract: ${CONTRACT_ADDRESS}

This certificate confirms that the above credential was verified
on the blockchain and its authenticity has been cryptographically proven.

Powered by TrustChain
Built on Polygon Network
    `;

    const blob = new Blob([certificate], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verification-${result.verificationId}.txt`;
    a.click();
  };

  // Export history
  const exportHistory = () => {
    if (verificationHistory.length === 0) {
      alert('No verification history to export');
      return;
    }

    const csvContent = [
      ['Timestamp', 'Credential Type', 'Issuer', 'Status', 'Hash'],
      ...verificationHistory.map(item => [
        item.timestamp,
        item.credentialType,
        item.issuerName,
        item.isValid ? 'Valid' : 'Revoked',
        item.hash
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verification-history-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <TrustChainLogo />
          <div style={styles.poweredBy}>
            <span style={styles.poweredByText}>Built on</span>
            <PolygonLogo />
          </div>
        </div>
        
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Credential Verifier Portal</h1>
          <p style={styles.subtitle}>Instant blockchain verification in 5 seconds</p>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={styles.errorClose}>✕</button>
        </div>
      )}

      <div style={styles.mainContent}>
        {/* Tabs */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setActiveTab('single')}
            style={{...styles.tab, ...(activeTab === 'single' && styles.tabActive)}}
          >
            <span style={styles.tabIcon}>🔍</span>
            Single Verify
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            style={{...styles.tab, ...(activeTab === 'bulk' && styles.tabActive)}}
          >
            <span style={styles.tabIcon}>📊</span>
            Bulk Verify
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{...styles.tab, ...(activeTab === 'history' && styles.tabActive)}}
          >
            <span style={styles.tabIcon}>📋</span>
            History ({verificationHistory.length})
          </button>
        </div>

        {/* Single Verification Tab */}
        {activeTab === 'single' && (
          <div style={styles.tabContent}>
            {/* QR Scanner */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>📷 QR Code Scanner</h3>
              <p style={styles.cardDesc}>Scan QR code from student's wallet for instant verification</p>
              
              <button
                onClick={() => {
                  setScanning(!scanning);
                  setError('');
                }}
                style={{
                  ...styles.primaryButton,
                  background: scanning ? '#f56565' : '#48bb78'
                }}
              >
                {scanning ? '❌ Stop Scanner' : '📸 Start QR Scanner'}
              </button>

              {scanning && (
                <div style={styles.scannerContainer}>
                  <div id="qr-reader" style={{ width: '100%', marginTop: '20px' }} />
                  <p style={styles.scannerInfo}>
                    Position QR code within the frame
                  </p>
                </div>
              )}
            </div>

            {/* Manual Hash Input */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🔍 Manual Hash Verification</h3>
              <p style={styles.cardDesc}>Enter credential hash to verify on blockchain</p>
              
              <input
                type="text"
                placeholder="Enter credential hash (0x...)"
                value={manualHash}
                onChange={(e) => {
                  setManualHash(e.target.value);
                  setError('');
                }}
                style={styles.input}
                onKeyPress={(e) => e.key === 'Enter' && verifyManualHash()}
              />
              <button
                onClick={verifyManualHash}
                disabled={loading}
                style={styles.primaryButton}
              >
                {loading ? '⏳ Verifying...' : '🔎 Verify Credential'}
              </button>
            </div>

            {/* Loading */}
            {loading && (
              <div style={styles.card}>
                <div style={styles.loadingContainer}>
                  <div style={styles.spinner}></div>
                  <p style={styles.loadingText}>Verifying on Polygon blockchain...</p>
                  <p style={styles.loadingSubtext}>This takes 5-10 seconds</p>
                </div>
              </div>
            )}

            {/* Verification Result */}
            {verificationResult && !loading && (
              <div style={{
                ...styles.card,
                ...styles.resultCard,
                borderColor: verificationResult.exists && verificationResult.isValid 
                  ? '#48bb78' 
                  : verificationResult.exists ? '#ed8936' : '#f56565'
              }}>
                <div style={styles.resultHeader}>
                  {verificationResult.exists && verificationResult.isValid ? (
                    <>
                      <div style={styles.resultIcon}>✅</div>
                      <h2 style={{...styles.resultTitle, color: '#48bb78'}}>VERIFIED</h2>
                    </>
                  ) : verificationResult.exists && !verificationResult.isValid ? (
                    <>
                      <div style={styles.resultIcon}>⚠️</div>
                      <h2 style={{...styles.resultTitle, color: '#ed8936'}}>REVOKED</h2>
                    </>
                  ) : (
                    <>
                      <div style={styles.resultIcon}>❌</div>
                      <h2 style={{...styles.resultTitle, color: '#f56565'}}>NOT FOUND</h2>
                    </>
                  )}
                </div>

                {verificationResult.exists ? (
                  <>
                    <div style={styles.resultDetails}>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Credential Type:</span>
                        <span style={styles.detailValue}>{verificationResult.credentialType}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Issued By:</span>
                        <span style={styles.detailValue}>{verificationResult.issuerName}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Issued Date:</span>
                        <span style={styles.detailValue}>{verificationResult.issuedDate}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Status:</span>
                        <span style={{
                          ...styles.detailValue,
                          color: verificationResult.isValid ? '#48bb78' : '#ed8936',
                          fontWeight: '700'
                        }}>
                          {verificationResult.isValid ? 'Valid ✓' : 'Revoked ✗'}
                        </span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Verified On:</span>
                        <span style={styles.detailValue}>{verificationResult.timestamp}</span>
                      </div>
                    </div>

                    <div style={styles.resultActions}>
                      <button
                        onClick={() => downloadCertificate(verificationResult)}
                        style={{...styles.actionButton, background: '#4299e1'}}
                      >
                        📥 Download Certificate
                      </button>
                      <button
                        onClick={() => window.open(`https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}`, '_blank')}
                        style={{...styles.actionButton, background: '#805ad5'}}
                      >
                        🔗 View on PolygonScan
                      </button>
                      <button
                        onClick={() => {
                          setVerificationResult(null);
                          setManualHash('');
                        }}
                        style={{...styles.actionButton, background: '#718096'}}
                      >
                        ✕ Clear
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={styles.notFound}>
                    <p style={styles.notFoundText}>This credential does not exist on the blockchain</p>
                    <p style={styles.notFoundSubtext}>The credential may be fake or the hash is incorrect</p>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>ℹ️ How to Verify</h3>
              <div style={styles.instructionsList}>
                <div style={styles.instructionItem}>
                  <span style={styles.instructionNumber}>1</span>
                  <span style={styles.instructionText}>Ask candidate to open TrustChain wallet</span>
                </div>
                <div style={styles.instructionItem}>
                  <span style={styles.instructionNumber}>2</span>
                  <span style={styles.instructionText}>Candidate generates QR code for credential</span>
                </div>
                <div style={styles.instructionItem}>
                  <span style={styles.instructionNumber}>3</span>
                  <span style={styles.instructionText}>Click "Start QR Scanner" and scan the code</span>
                </div>
                <div style={styles.instructionItem}>
                  <span style={styles.instructionNumber}>4</span>
                  <span style={styles.instructionText}>Get instant verification result (5-10 seconds)</span>
                </div>
                <div style={styles.instructionItem}>
                  <span style={styles.instructionNumber}>5</span>
                  <span style={styles.instructionText}>Download certificate for your records</span>
                </div>
              </div>

              <div style={styles.infoBox}>
                <div style={styles.infoItem}>
                  <span style={styles.infoIcon}>⚡</span>
                  <div>
                    <strong>Verification Time:</strong> 5-10 seconds
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoIcon}>🔒</span>
                  <div>
                    <strong>Security:</strong> Cryptographically verified on blockchain
                  </div>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoIcon}>💰</span>
                  <div>
                    <strong>Cost:</strong> Free on testnet
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Verification Tab */}
        {activeTab === 'bulk' && (
          <div style={styles.tabContent}>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>📊 Bulk Verification</h3>
              <p style={styles.cardDesc}>Upload CSV file with credential hashes to verify multiple credentials at once</p>
              
              <div style={styles.bulkUploadSection}>
                <div style={styles.formatInfo}>
                  <h4 style={styles.formatTitle}>CSV Format Required:</h4>
                  <code style={styles.formatCode}>name, hash</code>
                  <p style={styles.formatExample}>
                    Example:<br/>
                    John Doe, 0x1a2b3c4d...<br/>
                    Jane Smith, 0x5e6f7g8h...
                  </p>
                </div>

                <input
                  type="file"
                  accept=".csv"
                  onChange={handleBulkUpload}
                  style={styles.fileInput}
                />

                {bulkCsvData.length > 0 && (
                  <div style={styles.fileSuccess}>
                    ✅ {bulkCsvData.length} credentials loaded
                  </div>
                )}
              </div>

              {bulkCsvData.length > 0 && !processingBulk && bulkResults.length === 0 && (
                <button onClick={processBulkVerification} style={styles.primaryButton}>
                  🚀 Verify {bulkCsvData.length} Credentials
                </button>
              )}

              {processingBulk && (
                <div style={styles.progressSection}>
                  <div style={styles.progressInfo}>
                    <span style={styles.progressText}>
                      Verifying {bulkProgress.current} / {bulkProgress.total}
                    </span>
                    <span style={styles.progressPercentage}>
                      {((bulkProgress.current / bulkProgress.total) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={styles.progressBar}>
                    <div style={{
                      ...styles.progressFill,
                      width: `${(bulkProgress.current / bulkProgress.total) * 100}%`
                    }} />
                  </div>
                  <div style={styles.loadingContainer}>
                    <div style={styles.spinner}></div>
                    <p style={styles.loadingText}>Processing bulk verification...</p>
                  </div>
                </div>
              )}

              {bulkResults.length > 0 && !processingBulk && (
                <>
                  <div style={styles.bulkSummary}>
                    <div style={{...styles.summaryCard, ...styles.summaryValid}}>
                      <div style={styles.summaryIcon}>✅</div>
                      <div>
                        <div style={styles.summaryValue}>
                          {bulkResults.filter(r => r.status === 'Valid').length}
                        </div>
                        <div style={styles.summaryLabel}>Valid</div>
                      </div>
                    </div>
                    <div style={{...styles.summaryCard, ...styles.summaryRevoked}}>
                      <div style={styles.summaryIcon}>⚠️</div>
                      <div>
                        <div style={styles.summaryValue}>
                          {bulkResults.filter(r => r.status === 'Revoked').length}
                        </div>
                        <div style={styles.summaryLabel}>Revoked</div>
                      </div>
                    </div>
                    <div style={{...styles.summaryCard, ...styles.summaryNotFound}}>
                      <div style={styles.summaryIcon}>❌</div>
                      <div>
                        <div style={styles.summaryValue}>
                          {bulkResults.filter(r => r.status === 'Not Found' || r.status === 'Error').length}
                        </div>
                        <div style={styles.summaryLabel}>Not Found</div>
                      </div>
                    </div>
                  </div>

                  <button onClick={exportBulkResults} style={{...styles.actionButton, background: '#4299e1', width: '100%', marginBottom: '20px'}}>
                    📥 Export Results to CSV
                  </button>

                  <div style={styles.bulkResultsTable}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Name</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Credential Type</th>
                          <th style={styles.th}>Issuer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResults.map((result, idx) => (
                          <tr key={idx} style={{
                            background: result.status === 'Valid' ? '#f0fff4' : 
                                       result.status === 'Revoked' ? '#fffaf0' : '#fff5f5'
                          }}>
                            <td style={styles.td}>{result.name}</td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.statusBadge,
                                background: result.status === 'Valid' ? '#48bb78' :
                                           result.status === 'Revoked' ? '#ed8936' : '#f56565'
                              }}>
                                {result.status}
                              </span>
                            </td>
                            <td style={styles.td}>{result.credentialType || 'N/A'}</td>
                            <td style={styles.td}>{result.issuerName || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div style={styles.tabContent}>
            <div style={styles.card}>
              <div style={styles.historyHeader}>
                <h3 style={styles.cardTitle}>📋 Verification History ({verificationHistory.length})</h3>
                {verificationHistory.length > 0 && (
                  <div style={styles.historyActions}>
                    <button onClick={exportHistory} style={{...styles.actionButton, background: '#4299e1'}}>
                      📥 Export
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm('Clear all history?')) setVerificationHistory([]);
                      }} 
                      style={{...styles.actionButton, background: '#f56565'}}
                    >
                      🗑️ Clear
                    </button>
                  </div>
                )}
              </div>

              {verificationHistory.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>📋</div>
                  <p style={styles.emptyText}>No verification history yet</p>
                  <p style={styles.emptySubtext}>Start verifying credentials to see history here</p>
                </div>
              ) : (
                <div style={styles.historyList}>
                  {verificationHistory.map((item) => (
                    <div key={item.verificationId} style={styles.historyItem}>
                      <div style={styles.historyItemHeader}>
                        <span style={{
                          ...styles.historyStatus,
                          color: item.isValid ? '#48bb78' : '#f56565'
                        }}>
                          {item.isValid ? '✅' : '❌'}
                        </span>
                        <span style={styles.historyType}>{item.credentialType}</span>
                        <span style={styles.historyTime}>{item.timestamp}</span>
                      </div>
                      <div style={styles.historyDetails}>
                        <span>🏛️ {item.issuerName}</span>
                        <span style={styles.historyHash}>
                          {item.hash.slice(0, 10)}...{item.hash.slice(-8)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
      `}</style>
    </div>
  );
}

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(72, 187, 120, 0.1)',
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
  headerContent: {
    textAlign: 'center',
    padding: '30px 20px',
  },
  title: {
    fontSize: '42px',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
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
  mainContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '40px 20px',
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
    color: '#48bb78',
    opacity: 1,
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  },
  tabIcon: {
    fontSize: '20px',
  },
  tabContent: {
    animation: 'fadeIn 0.5s ease',
  },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    marginBottom: '30px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
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
  primaryButton: {
    background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
    color: 'white',
    border: 'none',
    padding: '18px 40px',
    fontSize: '18px',
    fontWeight: '700',
    borderRadius: '12px',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.3s',
    boxShadow: '0 4px 15px rgba(72, 187, 120, 0.4)',
  },
  input: {
    width: '100%',
    padding: '16px 20px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    marginBottom: '20px',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
  },
  scannerContainer: {
    marginTop: '30px',
  },
  scannerInfo: {
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
    borderTop: '4px solid #48bb78',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px',
  },
  loadingText: {
    fontSize: '18px',
    color: '#2d3748',
    fontWeight: '600',
    marginBottom: '10px',
  },
  loadingSubtext: {
    fontSize: '14px',
    color: '#718096',
  },
  resultCard: {
    borderLeft: '8px solid',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '30px',
    gap: '15px',
  },
  resultIcon: {
    fontSize: '60px',
  },
  resultTitle: {
    fontSize: '42px',
    margin: 0,
    fontWeight: '800',
  },
  resultDetails: {
    background: '#f7fafc',
    borderRadius: '12px',
    padding: '30px',
    marginBottom: '30px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderBottom: '1px solid #e2e8f0',
  },
  detailLabel: {
    fontWeight: '700',
    color: '#4a5568',
    fontSize: '16px',
  },
  detailValue: {
    color: '#2d3748',
    textAlign: 'right',
    fontSize: '16px',
    fontWeight: '600',
  },
  resultActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
  },
  actionButton: {
    border: 'none',
    padding: '16px 24px',
    fontSize: '16px',
    fontWeight: '700',
    borderRadius: '12px',
    cursor: 'pointer',
    color: 'white',
    transition: 'all 0.3s',
  },
  notFound: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  notFoundText: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#f56565',
    marginBottom: '15px',
  },
  notFoundSubtext: {
    fontSize: '16px',
    color: '#718096',
  },
  instructionsList: {
    marginBottom: '30px',
  },
  instructionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '20px',
    background: '#f7fafc',
    borderRadius: '12px',
    marginBottom: '12px',
  },
  instructionNumber: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: '800',
    flexShrink: 0,
  },
  instructionText: {
    fontSize: '16px',
    color: '#4a5568',
    fontWeight: '500',
  },
  infoBox: {
    background: '#f0fff4',
    border: '2px solid #48bb78',
    borderRadius: '12px',
    padding: '25px',
  },
  infoItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '15px',
    marginBottom: '15px',
    fontSize: '15px',
    color: '#2d3748',
  },
  infoIcon: {
    fontSize: '28px',
  },
  bulkUploadSection: {
    marginBottom: '30px',
  },
  formatInfo: {
    background: '#f7fafc',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  formatTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: '10px',
  },
  formatCode: {
    display: 'block',
    background: '#2d3748',
    color: '#48bb78',
    padding: '12px',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '14px',
    marginBottom: '10px',
  },
  formatExample: {
    fontSize: '14px',
    color: '#718096',
    lineHeight: '1.8',
  },
  fileInput: {
    marginBottom: '20px',
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
  progressSection: {
    marginTop: '30px',
  },
  progressInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  progressText: {
    fontSize: '18px',
    color: '#2d3748',
    fontWeight: '700',
  },
  progressPercentage: {
    fontSize: '24px',
    color: '#48bb78',
    fontWeight: '800',
  },
  progressBar: {
    width: '100%',
    height: '16px',
    background: '#e2e8f0',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '30px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #48bb78 0%, #38a169 100%)',
    transition: 'width 0.5s ease',
    borderRadius: '8px',
  },
  bulkSummary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '25px',
    borderRadius: '16px',
    border: '3px solid',
  },
  summaryValid: {
    borderColor: '#48bb78',
    background: '#f0fff4',
  },
  summaryRevoked: {
    borderColor: '#ed8936',
    background: '#fffaf0',
  },
  summaryNotFound: {
    borderColor: '#f56565',
    background: '#fff5f5',
  },
  summaryIcon: {
    fontSize: '48px',
  },
  summaryValue: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#2d3748',
  },
  summaryLabel: {
    fontSize: '14px',
    color: '#718096',
    fontWeight: '600',
  },
  bulkResultsTable: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
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
  statusBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '700',
    display: 'inline-block',
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  historyActions: {
    display: 'flex',
    gap: '12px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  emptyIcon: {
    fontSize: '80px',
    marginBottom: '20px',
  },
  emptyText: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#a0aec0',
    marginBottom: '10px',
  },
  emptySubtext: {
    fontSize: '16px',
    color: '#cbd5e0',
  },
  historyList: {
    maxHeight: '600px',
    overflowY: 'auto',
  },
  historyItem: {
    background: '#f7fafc',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '12px',
    borderLeft: '5px solid #48bb78',
    transition: 'all 0.3s',
    cursor: 'pointer',
  },
  historyItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  historyStatus: {
    fontSize: '28px',
  },
  historyType: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#2d3748',
    flex: 1,
    marginLeft: '15px',
  },
  historyTime: {
    fontSize: '13px',
    color: '#718096',
  },
  historyDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: '#718096',
    marginLeft: '43px',
  },
  historyHash: {
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  footer: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderTop: '1px solid rgba(72, 187, 120, 0.1)',
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
    color: '#48bb78',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '14px',
  },
};

export default VerifierPortal;