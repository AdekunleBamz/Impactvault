import React, { useState } from 'react';
import { Leaf, TrendingUp, Globe, Wallet, ArrowUpRight, Check, Zap, Users, DollarSign, AlertCircle, ExternalLink, LogOut, X } from 'lucide-react';

const CONFIG = {
  CONTRACT_ADDRESS: "0x3C35fA01acF439cCD32FfB7D8A738D50b8160348",
  CUSD_ADDRESS: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  CEUR_ADDRESS: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  CELO_RPC: "https://forno.celo.org",
  CHAIN_ID: 42220,
  CHAIN_ID_HEX: "0xa4ec",
  EXPLORER: "https://celoscan.io"
};

const ImpactVault = () => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState({ cUSD: 0, cEUR: 0, CELO: 0 });
  const [activeTab, setActiveTab] = useState('projects');
  const [selectedProject, setSelectedProject] = useState(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [projects, setProjects] = useState([]);
  const [userStakes, setUserStakes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);

  const connectMetaMask = async () => {
    setError('');
    setLoading(true);
    setShowWalletModal(false);
    try {
      if (!window.ethereum) throw new Error('MetaMask not installed');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== CONFIG.CHAIN_ID_HEX) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.CHAIN_ID_HEX }]
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: CONFIG.CHAIN_ID_HEX,
                chainName: 'Celo Mainnet',
                nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
                rpcUrls: [CONFIG.CELO_RPC],
                blockExplorerUrls: [CONFIG.EXPLORER]
              }]
            });
          } else throw switchError;
        }
      }
      setAddress(accounts[0]);
      setConnected(true);
      await loadBalances(accounts[0]);
      await loadProjects();
      await loadUserStakes(accounts[0]);
    } catch (err) {
      setError(err.code === 4001 ? 'Connection rejected' : err.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setConnected(false);
    setAddress('');
    setBalance({ cUSD: 0, cEUR: 0, CELO: 0 });
    setUserStakes([]);
    setError('');
  };

  const loadBalances = async (addr) => {
    try {
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const celoBalance = await provider.getBalance(addr);
      const cUsdContract = new window.ethers.Contract(CONFIG.CUSD_ADDRESS, ['function balanceOf(address) view returns (uint256)'], provider);
      const cUsdBalance = await cUsdContract.balanceOf(addr);
      const cEurContract = new window.ethers.Contract(CONFIG.CEUR_ADDRESS, ['function balanceOf(address) view returns (uint256)'], provider);
      const cEurBalance = await cEurContract.balanceOf(addr);
      setBalance({
        CELO: parseFloat(window.ethers.utils.formatEther(celoBalance)).toFixed(2),
        cUSD: parseFloat(window.ethers.utils.formatEther(cUsdBalance)).toFixed(2),
        cEUR: parseFloat(window.ethers.utils.formatEther(cEurBalance)).toFixed(2)
      });
    } catch (err) {
      console.error('Error loading balances:', err);
    }
  };

  const loadProjects = async () => {
    console.log('🔍 Starting to load projects...');
    console.log('Contract address:', CONFIG.CONTRACT_ADDRESS);
    try {
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const contract = new window.ethers.Contract(CONFIG.CONTRACT_ADDRESS, [
        'function projectCount() view returns (uint256)',
        'function getProject(uint256) view returns (string,uint256,uint256,uint256,address,bool)',
        'function getProjectMeta(uint256) view returns (string,string,string,uint8)',
        'function getProjectImpact(uint256) view returns (string,string,uint256)'
      ], provider);
      const count = await contract.projectCount();
      console.log('✅ Project count:', count.toNumber());
      const projectsData = [];
      for (let i = 1; i <= count.toNumber(); i++) {
        const basic = await contract.getProject(i);
        const meta = await contract.getProjectMeta(i);
        const impact = await contract.getProjectImpact(i);
        projectsData.push({
          id: i,
          name: basic[0],
          target: parseFloat(window.ethers.utils.formatEther(basic[1])),
          funded: parseFloat(window.ethers.utils.formatEther(basic[2])),
          apy: (basic[3].toNumber() / 100).toFixed(1),
          currency: basic[4].toLowerCase() === CONFIG.CUSD_ADDRESS.toLowerCase() ? 'cUSD' : 'cEUR',
          active: basic[5],
          category: meta[0],
          location: meta[1],
          description: meta[2],
          risk: ['', 'Low', 'Medium', 'High'][meta[3]],
          verifier: impact[0],
          impactMetric: impact[1],
          carbonCredits: impact[2].toNumber()
        });
      }
      setProjects(projectsData);
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  };

  const loadUserStakes = async (addr) => {
    try {
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const contract = new window.ethers.Contract(CONFIG.CONTRACT_ADDRESS, [
        'function getUserProjects(address) view returns (uint256[])',
        'function getUserStake(address,uint256) view returns (uint256,uint256,uint256)',
        'function getProject(uint256) view returns (string,uint256,uint256,uint256,address,bool)'
      ], provider);
      const projectIds = await contract.getUserProjects(addr);
      const stakesData = [];
      for (let i = 0; i < projectIds.length; i++) {
        const projectId = projectIds[i].toNumber();
        const stake = await contract.getUserStake(addr, projectId);
        const project = await contract.getProject(projectId);
        stakesData.push({
          projectId,
          projectName: project[0],
          amount: parseFloat(window.ethers.utils.formatEther(stake[0])),
          pendingRewards: parseFloat(window.ethers.utils.formatEther(stake[1])),
          totalClaimed: parseFloat(window.ethers.utils.formatEther(stake[2])),
          apy: (project[3].toNumber() / 100).toFixed(1),
          currency: project[4].toLowerCase() === CONFIG.CUSD_ADDRESS.toLowerCase() ? 'cUSD' : 'cEUR'
        });
      }
      setUserStakes(stakesData);
    } catch (err) {
      console.error('Error loading stakes:', err);
    }
  };

  const stakeInProject = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setLoading(true);
    setError('');
    setTxHash('');
    try {
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const amount = window.ethers.utils.parseEther(stakeAmount);
      const tokenAddress = selectedProject.currency === 'cUSD' ? CONFIG.CUSD_ADDRESS : CONFIG.CEUR_ADDRESS;
      const tokenContract = new window.ethers.Contract(tokenAddress, ['function approve(address,uint256) returns (bool)'], signer);
      const approveTx = await tokenContract.approve(CONFIG.CONTRACT_ADDRESS, amount);
      await approveTx.wait();
      const contract = new window.ethers.Contract(CONFIG.CONTRACT_ADDRESS, ['function stake(uint256,uint256)'], signer);
      const tx = await contract.stake(selectedProject.id, amount);
      setTxHash(tx.hash);
      await tx.wait();
      await loadBalances(address);
      await loadProjects();
      await loadUserStakes(address);
      setStakeAmount('');
      setSelectedProject(null);
    } catch (err) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const claimRewards = async (projectId) => {
    setLoading(true);
    setError('');
    setTxHash('');
    try {
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new window.ethers.Contract(CONFIG.CONTRACT_ADDRESS, ['function claimRewards(uint256)'], signer);
      const tx = await contract.claimRewards(projectId);
      setTxHash(tx.hash);
      await tx.wait();
      await loadBalances(address);
      await loadUserStakes(address);
    } catch (err) {
      setError(err.message || 'Claim failed');
    } finally {
      setLoading(false);
    }
  };

  const withdrawStake = async (projectId) => {
    if (!window.confirm('Withdraw and claim all rewards?')) return;
    setLoading(true);
    setError('');
    setTxHash('');
    try {
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new window.ethers.Contract(CONFIG.CONTRACT_ADDRESS, ['function withdraw(uint256)'], signer);
      const tx = await contract.withdraw(projectId);
      setTxHash(tx.hash);
      await tx.wait();
      await loadBalances(address);
      await loadProjects();
      await loadUserStakes(address);
    } catch (err) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk) => {
    switch(risk) {
      case 'Low': return 'text-green-400';
      case 'Medium': return 'text-yellow-400';
      case 'High': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  const totalStaked = userStakes.reduce((sum, stake) => sum + stake.amount, 0);
  const totalEarned = userStakes.reduce((sum, stake) => sum + stake.pendingRewards + stake.totalClaimed, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 pt-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-3 rounded-xl">
              <Leaf className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">ImpactVault</h1>
              <p className="text-green-400 text-sm">Regenerative Finance on Celo</p>
            </div>
          </div>
          {!connected ? (
            <button onClick={() => setShowWalletModal(true)} disabled={loading} className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50">
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="bg-gray-800/50 backdrop-blur-sm px-6 py-3 rounded-xl border border-green-500/30">
                <div className="text-xs text-gray-400 mb-1">Connected</div>
                <div className="font-mono text-sm">{address.slice(0, 6)}...{address.slice(-4)}</div>
              </div>
              <button onClick={disconnectWallet} className="bg-gray-800/50 p-3 rounded-xl border border-gray-700 hover:border-red-500/50 transition-all">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-200">{error}</span>
          </div>
        )}
        {txHash && (
          <div className="bg-green-500/20 border border-green-500 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-400" />
              <span className="text-green-200">Transaction submitted!</span>
            </div>
            <a href={`${CONFIG.EXPLORER}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-400 hover:text-green-300">
              View <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
        {connected ? (
          <>
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm p-6 rounded-2xl border border-green-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">cUSD</span>
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-3xl font-bold">${balance.cUSD}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm p-6 rounded-2xl border border-blue-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">cEUR</span>
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold">€{balance.cEUR}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm p-6 rounded-2xl border border-purple-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">CELO</span>
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-3xl font-bold">{balance.CELO}</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm p-6 rounded-2xl border border-yellow-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Earned</span>
                  <Zap className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-3xl font-bold text-yellow-400">+${totalEarned.toFixed(4)}</div>
              </div>
            </div>
            <div className="flex gap-4 mb-6 border-b border-gray-700">
              <button onClick={() => setActiveTab('projects')} className={`px-6 py-3 font-semibold transition-all ${activeTab === 'projects' ? 'border-b-2 border-green-400 text-green-400' : 'text-gray-400 hover:text-white'}`}>
                Projects
              </button>
              <button onClick={() => setActiveTab('portfolio')} className={`px-6 py-3 font-semibold transition-all ${activeTab === 'portfolio' ? 'border-b-2 border-green-400 text-green-400' : 'text-gray-400 hover:text-white'}`}>
                Portfolio ({userStakes.length})
              </button>
            </div>
            {activeTab === 'projects' && (
              <div className="grid md:grid-cols-2 gap-6">
                {projects.length === 0 ? (
                  <div className="col-span-2 bg-gray-800/50 rounded-2xl border border-gray-700 p-12 text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-400 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading projects...</p>
                  </div>
                ) : (
                  projects.filter(p => p.active).map(project => {
                    const fundedPercent = (project.funded / project.target * 100).toFixed(0);
                    return (
                      <div key={project.id} className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6 hover:border-green-500/50 transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold mb-1">{project.name}</h3>
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                              <span className="flex items-center gap-1"><Globe className="w-4 h-4" />{project.location}</span>
                              <span className={getRiskColor(project.risk)}>{project.risk} Risk</span>
                            </div>
                          </div>
                          <div className="bg-green-500/20 px-3 py-1 rounded-lg">
                            <div className="text-green-400 font-bold">{project.apy}%</div>
                            <div className="text-xs text-gray-400">APY</div>
                          </div>
                        </div>
                        <p className="text-gray-300 text-sm mb-4">{project.description}</p>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-gray-700/50 p-3 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1">Impact</div>
                            <div className="font-semibold text-green-400">{project.impactMetric}</div>
                          </div>
                          <div className="bg-gray-700/50 p-3 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1">Carbon</div>
                            <div className="font-semibold text-blue-400">{project.carbonCredits} tCO2e</div>
                          </div>
                        </div>
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">Progress</span>
                            <span className="text-green-400 font-semibold">{fundedPercent}%</span>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400" style={{ width: `${Math.min(fundedPercent, 100)}%` }} />
                          </div>
                        </div>
                        <button onClick={() => setSelectedProject(project)} disabled={loading} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50">
                          Stake {project.currency} <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {activeTab === 'portfolio' && (
              <div className="space-y-6">
                {userStakes.length === 0 ? (
                  <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-12 text-center">
                    <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">No Active Stakes</h3>
                    <p className="text-gray-400">Start investing to see your portfolio</p>
                  </div>
                ) : (
                  userStakes.map((stake, idx) => (
                    <div key={idx} className="bg-gradient-to-br from-gray-800/80 to-gray-800/50 rounded-2xl border border-green-500/30 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-xl font-bold">{stake.projectName}</h3>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{stake.amount.toFixed(2)} {stake.currency}</div>
                          <div className="text-green-400 text-sm">APY: {stake.apy}%</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-gray-400 text-sm mb-1">Pending</div>
                          <div className="text-2xl font-bold text-yellow-400">+{stake.pendingRewards.toFixed(4)}</div>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-gray-400 text-sm mb-1">Claimed</div>
                          <div className="text-2xl font-bold text-green-400">{stake.totalClaimed.toFixed(4)}</div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => claimRewards(stake.projectId)} disabled={loading || stake.pendingRewards < 0.001} className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 py-3 rounded-xl font-semibold hover:from-yellow-600 hover:to-orange-600 transition-all disabled:opacity-50">
                          Claim
                        </button>
                        <button onClick={() => withdrawStake(stake.projectId)} disabled={loading} className="flex-1 bg-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all disabled:opacity-50">
                          Withdraw
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <Wallet className="w-20 h-20 text-green-400 mx-auto mb-6 opacity-50" />
            <h2 className="text-3xl font-bold mb-4">Connect Your Celo Wallet</h2>
            <p className="text-gray-400 text-lg">Start investing in verified impact projects</p>
          </div>
        )}
        <footer className="mt-16 pt-8 border-t border-gray-700">
          <div className="flex items-center justify-center gap-6 text-gray-400 text-sm">
            <span>Created by</span>
            <a href="https://warpcast.com/Bamzzz" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400">@Bamzzz</a>
            <span>•</span>
            <a href="https://twitter.com/hrh_mckay" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">@hrh_mckay</a>
          </div>
          <div className="text-center mt-4 text-gray-500 text-sm">Built with ❤️ on Celo</div>
        </footer>
      </div>
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl border border-green-500/30 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Connect Wallet</h3>
              <button onClick={() => setShowWalletModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <button onClick={connectMetaMask} disabled={loading} className="w-full flex items-center gap-4 p-4 bg-gray-700/50 hover:bg-gray-700 rounded-xl transition-all disabled:opacity-50 border border-gray-600 hover:border-green-500">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-2xl">🦊</div>
              <div className="text-left flex-1">
                <div className="font-semibold text-lg">MetaMask</div>
                <div className="text-sm text-gray-400">Connect with MetaMask</div>
              </div>
            </button>
          </div>
        </div>
      )}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl border border-green-500/30 max-w-lg w-full p-6">
            <h3 className="text-2xl font-bold mb-4">Stake in {selectedProject.name}</h3>
            <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">APY</div>
                  <div className="text-xl font-bold text-green-400">{selectedProject.apy}%</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Risk</div>
                  <div className={`text-xl font-bold ${getRiskColor(selectedProject.risk)}`}>{selectedProject.risk}</div>
                </div>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-gray-400 text-sm mb-2">Amount ({selectedProject.currency})</label>
              <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} placeholder="0.00" className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-xl font-semibold focus:border-green-500 focus:outline-none" />
              <div className="text-xs text-gray-400 mt-2">
                Available: {selectedProject.currency === 'cUSD' ? balance.cUSD : balance.cEUR} {selectedProject.currency}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setSelectedProject(null); setStakeAmount(''); }} disabled={loading} className="flex-1 bg-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-all disabled:opacity-50">
                Cancel
              </button>
              <button onClick={stakeInProject} disabled={loading || !stakeAmount || parseFloat(stakeAmount) <= 0} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50">
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpactVault;
