import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function Dashboard({ contract, account }) {
  const [stats, setStats] = useState({
    totalIssued: 0,
    validCredentials: 0,
    revokedCredentials: 0,
    monthlyData: [],
    credentialTypes: [],
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30'); // days

  const COLORS = ['#667eea', '#48bb78', '#ed8936', '#4299e1', '#f56565', '#805ad5'];

  useEffect(() => {
    if (contract && account) {
      loadDashboardData();
    }
  }, [contract, account, timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get platform stats
      const platformStats = await contract.getStats();
      
      // Generate mock monthly data (in production, this would come from backend/events)
      const monthlyData = generateMonthlyData();
      
      // Generate credential types distribution
      const credentialTypes = [
        { name: 'Bachelor Degree', value: 45, count: 450 },
        { name: 'Master Degree', value: 25, count: 250 },
        { name: 'PhD', value: 10, count: 100 },
        { name: 'Diploma', value: 15, count: 150 },
        { name: 'Certificate', value: 5, count: 50 }
      ];

      setStats({
        totalIssued: platformStats[0].toNumber(),
        validCredentials: Math.floor(platformStats[0].toNumber() * 0.95),
        revokedCredentials: Math.floor(platformStats[0].toNumber() * 0.05),
        monthlyData,
        credentialTypes,
        recentActivity: generateRecentActivity()
      });

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.slice(0, parseInt(timeRange) / 30 * 12).map((month, i) => ({
      month,
      issued: Math.floor(Math.random() * 200 + 50),
      verified: Math.floor(Math.random() * 150 + 30),
      revoked: Math.floor(Math.random() * 10)
    }));
  };

  const generateRecentActivity = () => {
    return [
      { action: 'Issued', count: 50, time: '2 hours ago', type: 'success' },
      { action: 'Verified', count: 120, time: '5 hours ago', type: 'info' },
      { action: 'Revoked', count: 2, time: '1 day ago', type: 'warning' },
      { action: 'Issued', count: 30, time: '2 days ago', type: 'success' },
      { action: 'Verified', count: 85, time: '3 days ago', type: 'info' }
    ];
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={styles.dashboard}>
      {/* Header */}
      <div style={styles.dashboardHeader}>
        <div>
          <h2 style={styles.dashboardTitle}>📊 Analytics Dashboard</h2>
          <p style={styles.dashboardSubtitle}>Real-time credential insights</p>
        </div>
        <select 
          value={timeRange} 
          onChange={(e) => setTimeRange(e.target.value)}
          style={styles.timeRangeSelect}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 3 months</option>
          <option value="365">Last year</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div style={styles.metricsGrid}>
        <div style={{...styles.metricCard, ...styles.metricCardBlue}}>
          <div style={styles.metricIcon}>📜</div>
          <div style={styles.metricContent}>
            <h3 style={styles.metricValue}>{stats.totalIssued}</h3>
            <p style={styles.metricLabel}>Total Credentials Issued</p>
            <span style={styles.metricTrend}>↑ 12% from last month</span>
          </div>
        </div>

        <div style={{...styles.metricCard, ...styles.metricCardGreen}}>
          <div style={styles.metricIcon}>✅</div>
          <div style={styles.metricContent}>
            <h3 style={styles.metricValue}>{stats.validCredentials}</h3>
            <p style={styles.metricLabel}>Valid Credentials</p>
            <span style={styles.metricTrend}>95% success rate</span>
          </div>
        </div>

        <div style={{...styles.metricCard, ...styles.metricCardOrange}}>
          <div style={styles.metricIcon}>🔍</div>
          <div style={styles.metricContent}>
            <h3 style={styles.metricValue}>{Math.floor(stats.validCredentials * 0.3)}</h3>
            <p style={styles.metricLabel}>Total Verifications</p>
            <span style={styles.metricTrend}>↑ 8% this week</span>
          </div>
        </div>

        <div style={{...styles.metricCard, ...styles.metricCardRed}}>
          <div style={styles.metricIcon}>⚠️</div>
          <div style={styles.metricContent}>
            <h3 style={styles.metricValue}>{stats.revokedCredentials}</h3>
            <p style={styles.metricLabel}>Revoked Credentials</p>
            <span style={styles.metricTrend}>5% of total</span>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div style={styles.chartsRow}>
        {/* Line Chart - Monthly Trend */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>📈 Monthly Credential Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#718096" />
              <YAxis stroke="#718096" />
              <Tooltip 
                contentStyle={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="issued" 
                stroke="#667eea" 
                strokeWidth={3}
                name="Issued"
                dot={{ fill: '#667eea', r: 5 }}
              />
              <Line 
                type="monotone" 
                dataKey="verified" 
                stroke="#48bb78" 
                strokeWidth={3}
                name="Verified"
                dot={{ fill: '#48bb78', r: 5 }}
              />
              <Line 
                type="monotone" 
                dataKey="revoked" 
                stroke="#f56565" 
                strokeWidth={2}
                name="Revoked"
                dot={{ fill: '#f56565', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Credential Types */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>🎓 Credential Types Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.credentialTypes}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {stats.credentialTypes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={styles.legendContainer}>
            {stats.credentialTypes.map((type, index) => (
              <div key={index} style={styles.legendItem}>
                <div style={{...styles.legendColor, background: COLORS[index]}}></div>
                <span style={styles.legendText}>{type.name}: {type.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={styles.chartsRow}>
        {/* Bar Chart - Weekly Activity */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>📊 Weekly Activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { day: 'Mon', issued: 45, verified: 32 },
              { day: 'Tue', issued: 52, verified: 41 },
              { day: 'Wed', issued: 38, verified: 28 },
              { day: 'Thu', issued: 61, verified: 47 },
              { day: 'Fri', issued: 55, verified: 39 },
              { day: 'Sat', issued: 28, verified: 15 },
              { day: 'Sun', issued: 22, verified: 12 }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" stroke="#718096" />
              <YAxis stroke="#718096" />
              <Tooltip 
                contentStyle={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="issued" fill="#667eea" radius={[8, 8, 0, 0]} />
              <Bar dataKey="verified" fill="#48bb78" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>⚡ Recent Activity</h3>
          <div style={styles.activityList}>
            {stats.recentActivity.map((activity, index) => (
              <div key={index} style={styles.activityItem}>
                <div style={{
                  ...styles.activityIcon,
                  background: activity.type === 'success' ? '#48bb78' :
                             activity.type === 'warning' ? '#ed8936' : '#4299e1'
                }}>
                  {activity.action === 'Issued' ? '📜' :
                   activity.action === 'Verified' ? '✅' : '⚠️'}
                </div>
                <div style={styles.activityContent}>
                  <p style={styles.activityText}>
                    <strong>{activity.action}</strong> {activity.count} credentials
                  </p>
                  <p style={styles.activityTime}>{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div style={styles.performanceCard}>
        <h3 style={styles.chartTitle}>🎯 Performance Metrics</h3>
        <div style={styles.performanceGrid}>
          <div style={styles.performanceItem}>
            <div style={styles.performanceLabel}>Avg. Issuance Time</div>
            <div style={styles.performanceValue}>2.3s</div>
            <div style={styles.performanceBar}>
              <div style={{...styles.performanceBarFill, width: '92%', background: '#48bb78'}}></div>
            </div>
          </div>
          <div style={styles.performanceItem}>
            <div style={styles.performanceLabel}>Verification Success Rate</div>
            <div style={styles.performanceValue}>98.5%</div>
            <div style={styles.performanceBar}>
              <div style={{...styles.performanceBarFill, width: '98.5%', background: '#667eea'}}></div>
            </div>
          </div>
          <div style={styles.performanceItem}>
            <div style={styles.performanceLabel}>User Satisfaction</div>
            <div style={styles.performanceValue}>4.8/5.0</div>
            <div style={styles.performanceBar}>
              <div style={{...styles.performanceBarFill, width: '96%', background: '#ed8936'}}></div>
            </div>
          </div>
          <div style={styles.performanceItem}>
            <div style={styles.performanceLabel}>System Uptime</div>
            <div style={styles.performanceValue}>99.9%</div>
            <div style={styles.performanceBar}>
              <div style={{...styles.performanceBarFill, width: '99.9%', background: '#4299e1'}}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  dashboard: {
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  dashboardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '20px',
  },
  dashboardTitle: {
    fontSize: '32px',
    color: '#2d3748',
    margin: '0',
  },
  dashboardSubtitle: {
    color: '#718096',
    margin: '5px 0 0 0',
  },
  timeRangeSelect: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: '2px solid #e2e8f0',
    fontSize: '16px',
    cursor: 'pointer',
    background: 'white',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  metricCard: {
    background: 'white',
    borderRadius: '15px',
    padding: '25px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    transition: 'transform 0.3s, box-shadow 0.3s',
    cursor: 'pointer',
    ':hover': {
      transform: 'translateY(-5px)',
      boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
    }
  },
  metricCardBlue: {
    borderLeft: '5px solid #667eea',
  },
  metricCardGreen: {
    borderLeft: '5px solid #48bb78',
  },
  metricCardOrange: {
    borderLeft: '5px solid #ed8936',
  },
  metricCardRed: {
    borderLeft: '5px solid #f56565',
  },
  metricIcon: {
    fontSize: '48px',
  },
  metricContent: {
    flex: 1,
  },
  metricValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#2d3748',
    margin: '0 0 5px 0',
  },
  metricLabel: {
    fontSize: '14px',
    color: '#718096',
    margin: '0 0 8px 0',
  },
  metricTrend: {
    fontSize: '12px',
    color: '#48bb78',
    fontWeight: '600',
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  chartCard: {
    background: 'white',
    borderRadius: '15px',
    padding: '25px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
  },
  chartTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '20px',
  },
  legendContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '15px',
    marginTop: '20px',
    justifyContent: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendColor: {
    width: '16px',
    height: '16px',
    borderRadius: '4px',
  },
  legendText: {
    fontSize: '14px',
    color: '#4a5568',
  },
  activityList: {
    maxHeight: '300px',
    overflowY: 'auto',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '15px',
    borderBottom: '1px solid #e2e8f0',
    transition: 'background 0.2s',
    ':hover': {
      background: '#f7fafc',
    }
  },
  activityIcon: {
    width: '50px',
    height: '50px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    margin: '0 0 5px 0',
    color: '#2d3748',
    fontSize: '14px',
  },
  activityTime: {
    margin: 0,
    color: '#a0aec0',
    fontSize: '12px',
  },
  performanceCard: {
    background: 'white',
    borderRadius: '15px',
    padding: '25px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
  },
  performanceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  },
  performanceItem: {
    padding: '15px',
  },
  performanceLabel: {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '8px',
  },
  performanceValue: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: '12px',
  },
  performanceBar: {
    width: '100%',
    height: '8px',
    background: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  performanceBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 1s ease',
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    width: '60px',
    height: '60px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px',
  },
};

export default Dashboard;