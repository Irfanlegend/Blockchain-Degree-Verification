import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Clipboard
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, POLYGON_AMOY_RPC, AMOY_CHAIN_ID } from './src/config';

export default function App() {
  const [account, setAccount] = useState('');
  const [credentials, setCredentials] = useState([]);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [shareOption, setShareOption] = useState(null); // 'qr' or 'hash'

  const provider = new ethers.providers.JsonRpcProvider(POLYGON_AMOY_RPC);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  // Connect MetaMask
  const connectMetaMask = async () => {
    try {
      setIsConnecting(true);

      if (typeof window === 'undefined' || !window.ethereum) {
        Alert.alert(
          'MetaMask Not Found',
          'Please open this app in MetaMask browser or install MetaMask extension',
          [
            {
              text: 'Open in MetaMask',
              onPress: () => {
                const url = window.location.href;
                Linking.openURL(`https://metamask.app.link/dapp/${url.replace('https://', '')}`);
              }
            },
            { text: 'Cancel' }
          ]
        );
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
          } else {
            throw switchError;
          }
        }
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
      Alert.alert('✅ Connected!', `Address: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      loadMyCredentials(accounts[0]);

    } catch (error) {
      Alert.alert('Connection Error', error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount('');
    setCredentials([]);
    Alert.alert('Disconnected', 'Wallet disconnected successfully');
  };

  // Load credentials
  const loadMyCredentials = async (address) => {
    try {
      setLoading(true);
      const hashes = await contract.getHolderCredentials(address);
      
      if (hashes.length === 0) {
        Alert.alert('No Credentials', 'No credentials found for your wallet. Ask your university to issue credentials to this address.');
        setCredentials([]);
        return;
      }

      const credList = [];
      for (let hash of hashes) {
        const details = await contract.verifyCredential(hash);
        credList.push({
          hash: hash,
          exists: details[0],
          isValid: details[1],
          issuer: details[2],
          holder: details[3],
          credentialType: details[4],
          issuedDate: new Date(details[5].toNumber() * 1000).toLocaleDateString(),
          issuerName: details[6]
        });
      }
      
      setCredentials(credList);
      Alert.alert('✅ Loaded!', `Found ${credList.length} credentials`);
    } catch (error) {
      Alert.alert('Error', 'Failed to load credentials: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Copy hash to clipboard
  const copyHashToClipboard = (hash) => {
    Clipboard.setString(hash);
    Alert.alert('✅ Copied!', 'Credential hash copied to clipboard');
  };

  // Copy address to clipboard
  const copyAddressToClipboard = () => {
    Clipboard.setString(account);
    Alert.alert('✅ Copied!', 'Wallet address copied to clipboard');
  };

  // Listen for account changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          setAccount('');
          setCredentials([]);
        } else {
          setAccount(accounts[0]);
          loadMyCredentials(accounts[0]);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>🎓</Text>
            </View>
            <View>
              <Text style={styles.logoText}>TrustChain</Text>
              <Text style={styles.logoSubtext}>Student Wallet</Text>
            </View>
          </View>
          
          {account && (
            <TouchableOpacity onPress={disconnectWallet} style={styles.disconnectBtn}>
              <Text style={styles.disconnectText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.headerTitle}>My Credentials Wallet</Text>
        <Text style={styles.headerSubtitle}>Blockchain-Verified Degrees</Text>
        
        <View style={styles.polygonBadge}>
          <Text style={styles.polygonText}>Built on </Text>
          <Text style={styles.polygonLogo}>Polygon</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!account ? (
          <View style={styles.connectSection}>
            <View style={styles.connectCard}>
              <View style={styles.connectIcon}>
                <Text style={styles.connectIconEmoji}>🦊</Text>
              </View>
              <Text style={styles.connectTitle}>Connect Your Wallet</Text>
              <Text style={styles.connectDesc}>
                Connect MetaMask to view your blockchain-verified credentials
              </Text>
              
              <TouchableOpacity 
                style={styles.connectButton}
                onPress={connectMetaMask}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Text style={styles.buttonIcon}>🔐</Text>
                    <Text style={styles.buttonText}>Connect MetaMask</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.features}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>⚡</Text>
                  <Text style={styles.featureText}>Instant Access</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🔒</Text>
                  <Text style={styles.featureText}>Secure</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🌐</Text>
                  <Text style={styles.featureText}>Decentralized</Text>
                </View>
              </View>

              <Text style={styles.helpText}>
                💡 Your wallet address will be used to receive credentials
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Account Card */}
            <View style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <Text style={styles.accountLabel}>✅ Connected Wallet</Text>
                <View style={styles.connectedDot} />
              </View>
              <TouchableOpacity onPress={copyAddressToClipboard}>
                <Text style={styles.accountAddress}>
                  {account.slice(0, 6)}...{account.slice(-4)}
                </Text>
              </TouchableOpacity>
              <Text style={styles.copyHint}>Tap address to copy</Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={() => loadMyCredentials(account)}
                disabled={loading}
              >
                <Text style={styles.refreshButtonText}>
                  {loading ? '⏳ Loading...' : '🔄 Refresh Credentials'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Credentials List */}
            <Text style={styles.sectionTitle}>
              My Credentials ({credentials.length})
            </Text>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={styles.loadingText}>Loading credentials...</Text>
              </View>
            ) : credentials.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📜</Text>
                <Text style={styles.emptyText}>No credentials yet</Text>
                <Text style={styles.emptySubtext}>
                  Share your wallet address with your university:
                </Text>
                <TouchableOpacity onPress={copyAddressToClipboard}>
                  <Text style={styles.addressText}>{account}</Text>
                </TouchableOpacity>
                <Text style={styles.copyHint}>Tap address to copy</Text>
              </View>
            ) : (
              credentials.map((cred, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.credentialCard,
                    !cred.isValid && styles.revokedCard
                  ]}
                  onPress={() => {
                    setSelectedCredential(cred);
                    setShareOption(null);
                  }}
                >
                  <View style={styles.credentialHeader}>
                    <Text style={styles.credentialType}>
                      {cred.credentialType}
                    </Text>
                    {cred.isValid ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>✅ Valid</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, styles.revokedBadge]}>
                        <Text style={styles.badgeText}>❌ Revoked</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={styles.credentialInfo}>🏛️ {cred.issuerName}</Text>
                  <Text style={styles.credentialInfo}>📅 Issued: {cred.issuedDate}</Text>
                  <Text style={styles.credentialHash}>
                    Hash: {cred.hash.slice(0, 8)}...{cred.hash.slice(-6)}
                  </Text>
                  
                  <TouchableOpacity 
                    style={styles.shareButton}
                    onPress={() => {
                      setSelectedCredential(cred);
                      setShareOption(null);
                    }}
                  >
                    <Text style={styles.shareButtonText}>📱 Share Credential</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Share Options Modal */}
      <Modal
        visible={selectedCredential !== null && shareOption === null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedCredential(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Credential</Text>
              <TouchableOpacity onPress={() => setSelectedCredential(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedCredential && (
              <>
                <Text style={styles.modalSubtitle}>{selectedCredential.credentialType}</Text>
                <Text style={styles.modalInfo}>{selectedCredential.issuerName}</Text>
                <Text style={styles.modalDate}>Issued: {selectedCredential.issuedDate}</Text>

                <View style={styles.credentialStatus}>
                  <Text style={[
                    styles.statusText,
                    selectedCredential.isValid ? styles.validStatus : styles.revokedStatus
                  ]}>
                    {selectedCredential.isValid ? '✅ Valid Credential' : '❌ Revoked Credential'}
                  </Text>
                </View>

                <View style={styles.shareOptions}>
                  <TouchableOpacity
                    style={styles.shareOptionCard}
                    onPress={() => setShareOption('qr')}
                  >
                    <Text style={styles.shareOptionIcon}>📱</Text>
                    <Text style={styles.shareOptionTitle}>QR Code</Text>
                    <Text style={styles.shareOptionDesc}>Show QR for scanning</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.shareOptionCard}
                    onPress={() => setShareOption('hash')}
                  >
                    <Text style={styles.shareOptionIcon}>🔗</Text>
                    <Text style={styles.shareOptionTitle}>Copy Hash</Text>
                    <Text style={styles.shareOptionDesc}>Share hash directly</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedCredential(null)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={shareOption === 'qr'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShareOption(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scan to Verify</Text>
              <TouchableOpacity onPress={() => setShareOption(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedCredential && (
              <>
                <Text style={styles.modalSubtitle}>{selectedCredential.credentialType}</Text>
                <Text style={styles.modalInfo}>{selectedCredential.issuerName}</Text>
                
                <View style={styles.qrContainer}>
                  <QRCode
                    value={JSON.stringify({
                      hash: selectedCredential.hash,
                      credentialType: selectedCredential.credentialType,
                      issuerName: selectedCredential.issuerName,
                      issuedDate: selectedCredential.issuedDate,
                      isValid: selectedCredential.isValid,
                      holder: selectedCredential.holder
                    })}
                    size={250}
                    backgroundColor="white"
                    color="#667eea"
                  />
                </View>

                <View style={styles.hashContainer}>
                  <Text style={styles.hashLabel}>Credential Hash:</Text>
                  <Text style={styles.hashText}>
                    {selectedCredential.hash.slice(0, 12)}...{selectedCredential.hash.slice(-10)}
                  </Text>
                  <TouchableOpacity
                    style={styles.copyHashButton}
                    onPress={() => copyHashToClipboard(selectedCredential.hash)}
                  >
                    <Text style={styles.copyHashText}>📋 Copy Hash</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShareOption(null)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Hash Share Modal */}
      <Modal
        visible={shareOption === 'hash'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShareOption(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Credential Hash</Text>
              <TouchableOpacity onPress={() => setShareOption(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedCredential && (
              <>
                <Text style={styles.modalSubtitle}>{selectedCredential.credentialType}</Text>
                <Text style={styles.modalInfo}>{selectedCredential.issuerName}</Text>

                <View style={styles.hashDisplayCard}>
                  <Text style={styles.hashDisplayLabel}>Full Hash:</Text>
                  <Text style={styles.hashDisplayText}>{selectedCredential.hash}</Text>
                </View>

                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => {
                    copyHashToClipboard(selectedCredential.hash);
                    setShareOption(null);
                  }}
                >
                  <Text style={styles.copyButtonText}>📋 Copy Hash to Clipboard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShareOption(null)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}
        </Text>
        <View style={styles.footerPolygon}>
          <Text style={styles.footerPolygonText}>Powered by </Text>
          <Text style={styles.footerPolygonLogo}>Polygon</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
  header: {
    backgroundColor: '#667eea',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 28,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.5,
  },
  logoSubtext: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginTop: -2,
  },
  disconnectBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    marginBottom: 5,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 15,
  },
  polygonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
  },
  polygonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  polygonLogo: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  connectSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  connectCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 40,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  connectIcon: {
    width: 100,
    height: 100,
    backgroundColor: '#f0f4ff',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  connectIconEmoji: {
    fontSize: 50,
  },
  connectTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2d3748',
    marginBottom: 12,
    textAlign: 'center',
  },
  connectDesc: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  connectButton: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 14,
    width: '100%',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 30,
    paddingTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  featureItem: {
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 13,
    color: '#4a5568',
    fontWeight: '600',
  },
  helpText: {
    fontSize: 13,
    color: '#a0aec0',
    textAlign: 'center',
    marginTop: 20,
  },
  accountCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  accountLabel: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '600',
  },
  connectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#48bb78',
  },
  accountAddress: {
    fontSize: 22,
    fontWeight: '800',
    color: '#667eea',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  copyHint: {
    fontSize: 12,
    color: '#a0aec0',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  refreshButton: {
    backgroundColor: '#48bb78',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 15,
    color: '#2d3748',
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#718096',
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 50,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#a0aec0',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#cbd5e0',
    textAlign: 'center',
    marginBottom: 15,
  },
  addressText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
    textAlign: 'center',
  },
  credentialCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderLeftWidth: 6,
    borderLeftColor: '#667eea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  revokedCard: {
    borderLeftColor: '#f56565',
    opacity: 0.7,
  },
  credentialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  credentialType: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2d3748',
    flex: 1,
  },
  badge: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  revokedBadge: {
    backgroundColor: '#f56565',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  credentialInfo: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 6,
  },
  credentialHash: {
    fontSize: 12,
    color: '#a0aec0',
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  shareButton: {
    backgroundColor: '#667eea',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2d3748',
  },
  modalClose: {
    fontSize: 28,
    color: '#718096',
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4a5568',
    marginBottom: 5,
  },
  modalInfo: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 5,
  },
  modalDate: {
    fontSize: 13,
    color: '#a0aec0',
    marginBottom: 15,
  },
  credentialStatus: {
    marginBottom: 25,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    padding: 8,
    borderRadius: 8,
    textAlign: 'center',
  },
  validStatus: {
    backgroundColor: '#f0fff4',
    color: '#38a169',
  },
  revokedStatus: {
    backgroundColor: '#fff5f5',
    color: '#e53e3e',
  },
  shareOptions: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  shareOptionCard: {
    flex: 1,
    backgroundColor: '#f7fafc',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  shareOptionIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  shareOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 5,
  },
  shareOptionDesc: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
  },
  qrContainer: {
    padding: 25,
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#e2e8f0',
  },
  hashContainer: {
    backgroundColor: '#f7fafc',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  hashLabel: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '600',
    marginBottom: 8,
  },
  hashText: {
    fontSize: 14,
    color: '#2d3748',
    fontFamily: 'monospace',
    marginBottom: 15,
  },
  copyHashButton: {
    backgroundColor: '#667eea',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyHashText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  hashDisplayCard: {
    backgroundColor: '#f7fafc',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  hashDisplayLabel: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '600',
    marginBottom: 8,
  },
  hashDisplayText: {
    fontSize: 12,
    color: '#2d3748',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  copyButton: {
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  copyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: '#e2e8f0',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: 'white',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#718096',
    fontFamily: 'monospace',
  },
  footerPolygon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerPolygonText: {
    fontSize: 12,
    color: '#718096',
  },
  footerPolygonLogo: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '800',
  },
});