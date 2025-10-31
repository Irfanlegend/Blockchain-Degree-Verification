import React, { useState } from 'react';
import Papa from 'papaparse';
import { ethers } from 'ethers';

function BatchOperations({ contract, universityName }) {
  const [selectedOperation, setSelectedOperation] = useState('issue');
  const [csvData, setCsvData] = useState([]);
  const [batchSize, setBatchSize] = useState(50);
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState({ success: [], failed: [] });
  const [showResults, setShowResults] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        setResults({ success: [], failed: [] });
        setShowResults(false);
      }
    });
  };

  const processBatch = async () => {
    if (csvData.length === 0) {
      alert('Please upload a CSV file first!');
      return;
    }

    try {
      setProcessing(true);
      setProgress({ current: 0, total: csvData.length, percentage: 0 });
      const successList = [];
      const failedList = [];

      if (selectedOperation === 'issue') {
        // Issue credentials in batches
        for (let i = 0; i < csvData.length; i += batchSize) {
          const batch = csvData.slice(i, i + batchSize);
          
          try {
            const hashes = [];
            const holders = [];
            const types = [];

            for (let student of batch) {
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
            }

            const tx = await contract.batchIssueCredentials(hashes, holders, types);
            await tx.wait();

            batch.forEach((student, idx) => {
              successList.push({
                name: student.name,
                hash: hashes[idx],
                status: 'success'
              });
            });

          } catch (error) {
            batch.forEach(student => {
              failedList.push({
                name: student.name,
                error: error.message,
                status: 'failed'
              });
            });
          }

          setProgress({
            current: Math.min(i + batchSize, csvData.length),
            total: csvData.length,
            percentage: Math.min(((i + batchSize) / csvData.length) * 100, 100)
          });
        }

      } else if (selectedOperation === 'revoke') {
        // Revoke credentials one by one
        for (let i = 0; i < csvData.length; i++) {
          const item = csvData[i];
          
          try {
            const tx = await contract.revokeCredential(item.hash);
            await tx.wait();
            successList.push({
              hash: item.hash,
              status: 'revoked'
            });
          } catch (error) {
            failedList.push({
              hash: item.hash,
              error: error.message,
              status: 'failed'
            });
          }

          setProgress({
            current: i + 1,
            total: csvData.length,
            percentage: ((i + 1) / csvData.length) * 100
          });
        }
      }

      setResults({ success: successList, failed: failedList });
      setShowResults(true);
      alert(`✅ Batch operation complete!\nSuccess: ${successList.length}\nFailed: ${failedList.length}`);

    } catch (error) {
      console.error('Batch operation error:', error);
      alert('Error: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const exportResults = () => {
    const csvContent = [
      ['Name/Hash', 'Status', 'Hash/Error'],
      ...results.success.map(r => [r.name || r.hash, 'Success', r.hash || '']),
      ...results.failed.map(r => [r.name || r.hash, 'Failed', r.error])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-results-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>⚙️ Batch Operations</h2>
        <p style={styles.subtitle}>Process multiple credentials efficiently</p>
      </div>

      {/* Operation Selector */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Select Operation</h3>
        <div style={styles.operationGrid}>
          <div
            style={{
              ...styles.operationCard,
              ...(selectedOperation === 'issue' && styles.operationCardActive)
            }}
            onClick={() => setSelectedOperation('issue')}
          >
            <div style={styles.operationIcon}>📜</div>
            <h4 style={styles.operationTitle}>Bulk Issue</h4>
            <p style={styles.operationDesc}>Issue multiple credentials at once</p>
          </div>

          <div
            style={{
              ...styles.operationCard,
              ...(selectedOperation === 'revoke' && styles.operationCardActive)
            }}
            onClick={() => setSelectedOperation('revoke')}
          >
            <div style={styles.operationIcon}>🚫</div>
            <h4 style={styles.operationTitle}>Bulk Revoke</h4>
            <p style={styles.operationDesc}>Revoke multiple credentials</p>
          </div>

          <div
            style={{
              ...styles.operationCard,
              ...(selectedOperation === 'verify' && styles.operationCardActive)
            }}
            onClick={() => setSelectedOperation('verify')}
          >
            <div style={styles.operationIcon}>✅</div>
            <h4 style={styles.operationTitle}>Bulk Verify</h4>
            <p style={styles.operationDesc}>Check status of multiple credentials</p>
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Upload CSV File</h3>
        <p style={styles.info}>
          {selectedOperation === 'issue' 
            ? 'Format: name, degree, year, rollNo, walletAddress'
            : 'Format: hash (one hash per line)'
          }
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          style={styles.fileInput}
        />
        {csvData.length > 0 && (
          <div style={styles.fileInfo}>
            <span>✅ {csvData.length} records loaded</span>
          </div>
        )}
      </div>

      {/* Batch Settings */}
      {csvData.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Batch Settings</h3>
          <div style={styles.settingsGrid}>
            <div style={styles.settingItem}>
              <label style={styles.settingLabel}>Batch Size</label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                style={styles.settingSelect}
              >
                <option value={10}>10 records/batch (Safer)</option>
                <option value={25}>25 records/batch</option>
                <option value={50}>50 records/batch (Default)</option>
                <option value={100}>100 records/batch (Faster)</option>
              </select>
              <p style={styles.settingHelp}>
                Smaller batches = more reliable, larger batches = faster
              </p>
            </div>

            <div style={styles.settingItem}>
              <label style={styles.settingLabel}>Estimated Time</label>
              <div style={styles.estimatedTime}>
                <div style={styles.estimatedIcon}>⏱️</div>
                <div>
                  <div style={styles.estimatedValue}>
                    {Math.ceil((csvData.length / batchSize) * 0.5)} minutes
                  </div>
                  <div style={styles.estimatedDesc}>
                    {Math.ceil(csvData.length / batchSize)} transactions
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.settingItem}>
              <label style={styles.settingLabel}>Total Gas Cost (Est.)</label>
              <div style={styles.estimatedTime}>
                <div style={styles.estimatedIcon}>⛽</div>
                <div>
                  <div style={styles.estimatedValue}>
                    ~{(csvData.length * 0.001).toFixed(3)} MATIC
                  </div>
                  <div style={styles.estimatedDesc}>
                    ${(csvData.length * 0.001 * 0.5).toFixed(2)} USD approx
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={processBatch}
            disabled={processing}
            style={{...styles.button, ...styles.startButton}}
          >
            {processing ? '⏳ Processing...' : `🚀 Start ${selectedOperation.toUpperCase()} Operation`}
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      {processing && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Processing...</h3>
          <div style={styles.progressContainer}>
            <div style={styles.progressInfo}>
              <span style={styles.progressText}>
                {progress.current} / {progress.total} records
              </span>
              <span style={styles.progressPercentage}>
                {progress.percentage.toFixed(1)}%
              </span>
            </div>
            <div style={styles.progressBar}>
              <div 
                style={{
                  ...styles.progressBarFill,
                  width: `${progress.percentage}%`
                }}
              />
            </div>
            <div style={styles.progressSpinner}>
              <div style={styles.spinner}></div>
              <p style={styles.processingText}>Please don't close this window...</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {showResults && !processing && (
        <div style={styles.card}>
          <div style={styles.resultsHeader}>
            <h3 style={styles.cardTitle}>📊 Operation Results</h3>
            <button onClick={exportResults} style={{...styles.button, ...styles.exportButton}}>
              📥 Export Results
            </button>
          </div>

          <div style={styles.resultsGrid}>
            <div style={{...styles.resultCard, ...styles.resultCardSuccess}}>
              <div style={styles.resultIcon}>✅</div>
              <div style={styles.resultContent}>
                <div style={styles.resultValue}>{results.success.length}</div>
                <div style={styles.resultLabel}>Successful</div>
              </div>
            </div>

            <div style={{...styles.resultCard, ...styles.resultCardFailed}}>
              <div style={styles.resultIcon}>❌</div>
              <div style={styles.resultContent}>
                <div style={styles.resultValue}>{results.failed.length}</div>
                <div style={styles.resultLabel}>Failed</div>
              </div>
            </div>

            <div style={{...styles.resultCard, ...styles.resultCardTotal}}>
              <div style={styles.resultIcon}>📊</div>
              <div style={styles.resultContent}>
                <div style={styles.resultValue}>{csvData.length}</div>
                <div style={styles.resultLabel}>Total Processed</div>
              </div>
            </div>
          </div>

          {/* Success List */}
          {results.success.length > 0 && (
            <div style={styles.resultsList}>
              <h4 style={styles.resultsListTitle}>✅ Successful Operations ({results.success.length})</h4>
              <div style={styles.resultsTable}>
                {results.success.slice(0, 10).map((item, idx) => (
                  <div key={idx} style={styles.resultsRow}>
                    <span style={styles.resultsName}>{item.name || 'Hash'}</span>
                    <span style={styles.resultsHash}>
                      {item.hash ? `${item.hash.slice(0, 10)}...${item.hash.slice(-8)}` : item.status}
                    </span>
                    <span style={styles.resultsStatus}>✅</span>
                  </div>
                ))}
                {results.success.length > 10 && (
                  <p style={styles.moreResults}>...and {results.success.length - 10} more</p>
                )}
              </div>
            </div>
          )}

          {/* Failed List */}
          {results.failed.length > 0 && (
            <div style={styles.resultsList}>
              <h4 style={{...styles.resultsListTitle, color: '#f56565'}}>
                ❌ Failed Operations ({results.failed.length})
              </h4>
              <div style={styles.resultsTable}>
                {results.failed.map((item, idx) => (
                  <div key={idx} style={styles.resultsRow}>
                    <span style={styles.resultsName}>{item.name || item.hash?.slice(0, 20)}</span>
                    <span style={styles.resultsError}>{item.error}</span>
                    <span style={styles.resultsStatus}>❌</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Tips */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>💡 Quick Tips</h3>
        <div style={styles.tipsList}>
          <div style={styles.tipItem}>
            <span style={styles.tipIcon}>⚡</span>
            <span style={styles.tipText}>Use smaller batch sizes for better reliability</span>
          </div>
          <div style={styles.tipItem}>
            <span style={styles.tipIcon}>💰</span>
            <span style={styles.tipText}>Ensure sufficient MATIC balance before starting</span>
          </div>
          <div style={styles.tipItem}>
            <span style={styles.tipIcon}>🔄</span>
            <span style={styles.tipText}>Failed transactions can be retried individually</span>
          </div>
          <div style={styles.tipItem}>
            <span style={styles.tipIcon}>📊</span>
            <span style={styles.tipText}>Export results for record keeping and retry</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '32px',
    color: '#2d3748',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontSize: '16px',
    color: '#718096',
    margin: 0,
  },
  card: {
    background: 'white',
    borderRadius: '15px',
    padding: '25px',
    marginBottom: '20px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '20px',
  },
  operationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
  },
  operationCard: {
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s',
    background: 'white',
  },
  operationCardActive: {
    border: '2px solid #667eea',
    background: '#f0f4ff',
    transform: 'scale(1.05)',
  },
  operationIcon: {
    fontSize: '48px',
    marginBottom: '10px',
  },
  operationTitle: {
    fontSize: '18px',
    color: '#2d3748',
    margin: '0 0 8px 0',
  },
  operationDesc: {
    fontSize: '14px',
    color: '#718096',
    margin: 0,
  },
  info: {
    color: '#718096',
    fontSize: '14px',
    marginBottom: '15px',
  },
  fileInput: {
    marginBottom: '15px',
  },
  fileInfo: {
    background: '#f0fff4',
    border: '1px solid #48bb78',
    borderRadius: '8px',
    padding: '12px',
    color: '#22543d',
    fontSize: '14px',
  },
  settingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '20px',
  },
  settingItem: {
    padding: '15px',
    background: '#f7fafc',
    borderRadius: '8px',
  },
  settingLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#4a5568',
    marginBottom: '8px',
    display: 'block',
  },
  settingSelect: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    marginBottom: '8px',
  },
  settingHelp: {
    fontSize: '12px',
    color: '#a0aec0',
    margin: 0,
  },
  estimatedTime: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  estimatedIcon: {
    fontSize: '32px',
  },
  estimatedValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2d3748',
  },
  estimatedDesc: {
    fontSize: '12px',
    color: '#718096',
  },
  button: {
    border: 'none',
    padding: '15px 30px',
    fontSize: '16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    color: 'white',
    transition: 'all 0.3s',
  },
  startButton: {
    width: '100%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontSize: '18px',
    padding: '18px',
  },
  exportButton: {
    background: '#4299e1',
    width: 'auto',
  },
  progressContainer: {
    padding: '20px 0',
  },
  progressInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  progressText: {
    fontSize: '16px',
    color: '#4a5568',
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: '20px',
    color: '#667eea',
    fontWeight: 'bold',
  },
  progressBar: {
    width: '100%',
    height: '24px',
    background: '#e2e8f0',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '20px',
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #667eea 0%, #48bb78 100%)',
    transition: 'width 0.5s ease',
    borderRadius: '12px',
  },
  progressSpinner: {
    textAlign: 'center',
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 15px',
  },
  processingText: {
    color: '#718096',
    fontSize: '14px',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '15px',
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginBottom: '30px',
  },
  resultCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '20px',
    borderRadius: '12px',
    border: '2px solid',
  },
  resultCardSuccess: {
    borderColor: '#48bb78',
    background: '#f0fff4',
  },
  resultCardFailed: {
    borderColor: '#f56565',
    background: '#fff5f5',
  },
  resultCardTotal: {
    borderColor: '#4299e1',
    background: '#ebf8ff',
  },
  resultIcon: {
    fontSize: '40px',
  },
  resultContent: {
    flex: 1,
  },
  resultValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2d3748',
  },
  resultLabel: {
    fontSize: '14px',
    color: '#718096',
  },
  resultsList: {
    marginTop: '20px',
  },
  resultsListTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '15px',
  },
  resultsTable: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  resultsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 15px',
    borderBottom: '1px solid #e2e8f0',
    background: 'white',
  },
  resultsName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2d3748',
    flex: 1,
  },
  resultsHash: {
    fontSize: '12px',
    color: '#718096',
    fontFamily: 'monospace',
    flex: 2,
    textAlign: 'center',
  },
  resultsError: {
    fontSize: '12px',
    color: '#f56565',
    flex: 2,
    textAlign: 'center',
  },
  resultsStatus: {
    fontSize: '20px',
  },
  moreResults: {
    textAlign: 'center',
    padding: '15px',
    color: '#718096',
    fontSize: '14px',
    background: '#f7fafc',
  },
  tipsList: {
    display: 'grid',
    gap: '12px',
  },
  tipItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: '#f7fafc',
    borderRadius: '8px',
  },
  tipIcon: {
    fontSize: '24px',
  },
  tipText: {
    fontSize: '14px',
    color: '#4a5568',
  },
};

export default BatchOperations;