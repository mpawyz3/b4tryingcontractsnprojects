import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Loader, Plus, FileText, DollarSign, Calendar, CheckCircle, Clock, AlertCircle,
  Filter, Search, TrendingUp, Bell, Send, FileCheck, AlertTriangle, MoreVertical,
  ChevronDown, Gavel, BarChart3, Eye, Trash2, Edit2
} from 'lucide-react';
import ContractCreationForm from '../components/ContractCreationForm';
import MilestoneCreationForm from '../components/MilestoneCreationForm';
import PhotoLockUploadForm from '../components/PhotoLockUploadForm';

interface Contract {
  id: string;
  contract_number: string;
  client_name: string;
  client_email?: string;
  client_contact_person?: string;
  contract_amount: number;
  currency_code: string;
  contract_start_date: string;
  contract_end_date: string;
  status: string;
  contract_document_url?: string;
  created_at?: string;
  updated_at?: string;
  milestones?: Milestone[];
}

interface Milestone {
  id: string;
  milestone_number: number;
  milestone_name: string;
  percentage_of_contract: number;
  amount_ugx: number;
  currency_code: string;
  description?: string;
  due_date: string;
  status: string;
  field_verification?: FieldVerification;
  videos?: any[];
}

interface FieldVerification {
  id: string;
  task_name: string;
  verification_status: string;
  photo_url?: string;
  photo_upload_timestamp: string;
}

interface FinancialSummary {
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  upcomingPayments: number;
  averageContractValue: number;
  activeContracts: number;
  completedContracts: number;
  contractsNearExpiry: number;
}

interface ContractAlert {
  contractId: string;
  contractNumber: string;
  type: 'expiry' | 'payment_due' | 'renewal' | 'milestone_overdue';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  daysUntilEvent: number;
}

export default function ContractsEnhanced() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractorId, setContractorId] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [contractAlerts, setContractAlerts] = useState<ContractAlert[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    sortBy: 'date',
    sortOrder: 'desc'
  });
  const [showAmendmentForm, setShowAmendmentForm] = useState(false);
  const [showLegalCaseForm, setShowLegalCaseForm] = useState(false);
  const [showInvoiceHistory, setShowInvoiceHistory] = useState(false);
  const [showFinalReport, setShowFinalReport] = useState(false);

  useEffect(() => {
    if (user) {
      fetchContractorAndContracts();
    }
  }, [user]);

  const fetchContractorAndContracts = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // Get contractor ID
      const { data: profileData, error: profileError } = await supabase
        .from('contractor_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setContractorId(profileData.id);

      // Get contracts
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('contractor_id', profileData.id)
        .order('contract_start_date', { ascending: false });

      if (contractsError) throw contractsError;

      // Fetch milestones and their verifications for each contract
      const contractsWithMilestones = await Promise.all(
        (contractsData || []).map(async (contract) => {
          const { data: milestonesData } = await supabase
            .from('contract_milestones')
            .select('*')
            .eq('contract_id', contract.id)
            .order('milestone_number', { ascending: true });

          const milestonesWithVerifications = await Promise.all(
            (milestonesData || []).map(async (milestone) => {
              const { data: verificationsData } = await supabase
                .from('field_verification')
                .select('*')
                .eq('milestone_id', milestone.id)
                .order('photo_upload_timestamp', { ascending: false })
                .limit(1);

              const { data: videosData } = await supabase
                .from('project_milestone_videos')
                .select('*')
                .eq('milestone_id', milestone.id)
                .order('created_at', { ascending: false });

              return {
                ...milestone,
                field_verification: verificationsData?.[0] || null,
                videos: videosData || []
              };
            })
          );

          return {
            ...contract,
            milestones: milestonesWithVerifications
          };
        })
      );

      setContracts(contractsWithMilestones);
      generateFinancialSummary(contractsWithMilestones);
      generateContractAlerts(contractsWithMilestones);
    } catch (err: any) {
      setError(err.message || 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  const generateFinancialSummary = (contractsList: Contract[]) => {
    const summary: FinancialSummary = {
      totalAmount: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      upcomingPayments: 0,
      averageContractValue: 0,
      activeContracts: 0,
      completedContracts: 0,
      contractsNearExpiry: 0
    };

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    contractsList.forEach(contract => {
      summary.totalAmount += contract.contract_amount;
      
      if (contract.status === 'active') {
        summary.activeContracts++;
      } else if (contract.status === 'completed') {
        summary.completedContracts++;
      }

      // Check expiry
      const endDate = new Date(contract.contract_end_date);
      if (endDate <= thirtyDaysFromNow && endDate > now && contract.status === 'active') {
        summary.contractsNearExpiry++;
      }

      // Calculate payments
      (contract.milestones || []).forEach(milestone => {
        if (milestone.status === 'paid') {
          summary.totalPaid += milestone.amount_ugx;
        } else if (milestone.status === 'invoiced' || milestone.status === 'pending') {
          summary.upcomingPayments += milestone.amount_ugx;
        }
      });
    });

    summary.totalOutstanding = summary.totalAmount - summary.totalPaid;
    summary.averageContractValue = contractsList.length > 0 ? summary.totalAmount / contractsList.length : 0;

    setFinancialSummary(summary);
  };

  const generateContractAlerts = (contractsList: Contract[]) => {
    const alerts: ContractAlert[] = [];
    const now = new Date();

    contractsList.forEach(contract => {
      const endDate = new Date(contract.contract_end_date);
      const daysUntilExpiry = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check for expiry
      if (daysUntilExpiry <= 30 && daysUntilExpiry > 0 && contract.status === 'active') {
        alerts.push({
          contractId: contract.id,
          contractNumber: contract.contract_number,
          type: 'expiry',
          message: `Contract expires in ${daysUntilExpiry} days`,
          severity: daysUntilExpiry <= 7 ? 'critical' : 'warning',
          daysUntilEvent: daysUntilExpiry
        });
      }

      // Check for overdue milestones
      (contract.milestones || []).forEach(milestone => {
        if (milestone.status !== 'paid' && milestone.status !== 'completed') {
          const dueDate = new Date(milestone.due_date);
          if (dueDate < now) {
            alerts.push({
              contractId: contract.id,
              contractNumber: contract.contract_number,
              type: 'milestone_overdue',
              message: `Milestone "${milestone.milestone_name}" is overdue`,
              severity: 'critical',
              daysUntilEvent: Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
            });
          }
        }
      });
    });

    setContractAlerts(alerts);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMilestoneStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'invoiced':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'photo_verified':
        return <FileCheck className="w-5 h-5 text-amber-600" />;
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const calculateContractProgress = (milestones: Milestone[]) => {
    if (!milestones.length) return 0;
    const paid = milestones.filter(m => m.status === 'paid').length;
    return (paid / milestones.length) * 100;
  };

  const filteredAndSortedContracts = () => {
    let filtered = contracts;

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.contract_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.client_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (filters.sortBy) {
        case 'date':
          aVal = new Date(a.contract_start_date).getTime();
          bVal = new Date(b.contract_start_date).getTime();
          break;
        case 'amount':
          aVal = a.contract_amount;
          bVal = b.contract_amount;
          break;
        case 'name':
          aVal = a.client_name.toLowerCase();
          bVal = b.client_name.toLowerCase();
          break;
        default:
          aVal = new Date(a.contract_start_date).getTime();
          bVal = new Date(b.contract_start_date).getTime();
      }

      return filters.sortOrder === 'asc' ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
    });

    return filtered;
  };

  // Show photo upload form
  if (showPhotoUpload && selectedMilestone && contractorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 pt-24">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setShowPhotoUpload(false)}
            className="mb-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
          >
            ← Back
          </button>
          <PhotoLockUploadForm
            milestoneId={selectedMilestone.id}
            contractorId={contractorId}
            onSuccess={() => {
              fetchContractorAndContracts().then(() => {
                setShowPhotoUpload(false);
              });
            }}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center pt-24">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your contracts...</p>
        </div>
      </div>
    );
  }

  if (showCreateForm && contractorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 pt-24">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setShowCreateForm(false)}
            className="mb-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
          >
            ← Back to Contracts
          </button>
          <ContractCreationForm
            contractorId={contractorId}
            onSuccess={() => {
              setShowCreateForm(false);
              fetchContractorAndContracts();
            }}
          />
        </div>
      </div>
    );
  }

  if (selectedContract && !showMilestoneForm && !showPhotoUpload) {
    const progress = calculateContractProgress(selectedContract.milestones || []);
    const totalPaid = (selectedContract.milestones || [])
      .filter(m => m.status === 'paid')
      .reduce((sum, m) => sum + (m.amount_ugx || 0), 0);
    const totalOutstanding = selectedContract.contract_amount - totalPaid;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 pt-24">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setSelectedContract(null)}
            className="mb-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
          >
            ← Back to Contracts
          </button>

          {/* Contract Header */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8 border-l-4 border-blue-600">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">{selectedContract.contract_number}</h1>
                <p className="text-gray-600">{selectedContract.client_name}</p>
                {selectedContract.client_email && (
                  <p className="text-sm text-gray-500">{selectedContract.client_email}</p>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-blue-600">
                  {selectedContract.currency_code} {selectedContract.contract_amount.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  {selectedContract.currency_code} {totalPaid.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Outstanding</p>
                <p className="text-2xl font-bold text-amber-600">
                  {selectedContract.currency_code} {totalOutstanding.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Status and Actions */}
            <div className="flex justify-between items-center">
              <span className={`inline-block px-4 py-2 rounded-full font-semibold border ${getStatusColor(selectedContract.status)}`}>
                {selectedContract.status.charAt(0).toUpperCase() + selectedContract.status.slice(1)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAmendmentForm(true)}
                  className="px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition"
                >
                  Propose Amendment
                </button>
                <button
                  onClick={() => setShowLegalCaseForm(true)}
                  className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition flex items-center gap-1"
                >
                  <Gavel className="w-4 h-4" /> Legal Support
                </button>
                <button
                  onClick={() => setShowInvoiceHistory(true)}
                  className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition flex items-center gap-1"
                >
                  <DollarSign className="w-4 h-4" /> Invoice History
                </button>
              </div>
            </div>
          </div>

          {/* Contract Progress */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-800">Contract Progress</h3>
              <span className="text-sm font-bold text-blue-600">{progress.toFixed(0)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-green-500 to-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600 mb-2">Start Date</p>
              <p className="text-2xl font-semibold text-gray-800">
                {new Date(selectedContract.contract_start_date).toLocaleDateString()}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600 mb-2">End Date</p>
              <p className="text-2xl font-semibold text-gray-800">
                {new Date(selectedContract.contract_end_date).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Milestones Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Milestones</h2>
              <button
                onClick={() => setShowMilestoneForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                Add Milestone
              </button>
            </div>

            {(selectedContract.milestones || []).length > 0 ? (
              <div className="space-y-4">
                {selectedContract.milestones?.map((milestone, idx) => (
                  <div key={milestone.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        {getMilestoneStatusIcon(milestone.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-800">#{milestone.milestone_number}: {milestone.milestone_name}</h4>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold px-3 py-1 rounded whitespace-nowrap ml-4 ${
                        milestone.status === 'paid' ? 'bg-green-100 text-green-800' :
                        milestone.status === 'invoiced' ? 'bg-blue-100 text-blue-800' :
                        milestone.status === 'photo_verified' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {milestone.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm mb-4 p-3 bg-white rounded">
                      <div>
                        <p className="text-gray-600 text-xs">Amount</p>
                        <p className="font-semibold text-gray-800">
                          {milestone.currency_code} {milestone.amount_ugx?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs">% of Contract</p>
                        <p className="font-semibold text-gray-800">{milestone.percentage_of_contract}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs">Due Date</p>
                        <p className="font-semibold text-gray-800">
                          {new Date(milestone.due_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs">Evidence</p>
                        <p className="font-semibold text-gray-800">
                          {milestone.field_verification ? '✓ Submitted' : 'Pending'}
                        </p>
                      </div>
                    </div>

                    {/* Field Verification Status */}
                    {milestone.field_verification && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                        <p className="text-sm font-semibold text-blue-900 mb-2">✓ Proof of Work Submitted</p>
                        <div className="space-y-1 text-xs text-blue-800">
                          <p><strong>Task:</strong> {milestone.field_verification.task_name}</p>
                          <p><strong>Status:</strong> <span className="capitalize font-semibold">{milestone.field_verification.verification_status}</span></p>
                          <p><strong>Submitted:</strong> {new Date(milestone.field_verification.photo_upload_timestamp).toLocaleString()}</p>
                          {milestone.field_verification.photo_url && (
                            <a
                              href={milestone.field_verification.photo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              📸 View Photo
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Video Evidence */}
                    {milestone.videos && milestone.videos.length > 0 && (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg mb-3">
                        <p className="text-sm font-semibold text-purple-900 mb-2">📹 Video Evidence ({milestone.videos.length})</p>
                        <div className="space-y-1">
                          {milestone.videos.map((video, vidIdx) => (
                            <a
                              key={vidIdx}
                              href={video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-purple-600 hover:underline block"
                            >
                              {video.title || `Video ${vidIdx + 1}`}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upload Button */}
                    {(!milestone.field_verification || milestone.field_verification.verification_status === 'rejected') && (
                      <button
                        onClick={() => {
                          setSelectedMilestone(milestone);
                          setShowPhotoUpload(true);
                        }}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                      >
                        {milestone.field_verification ? '📤 Resubmit Proof of Work' : '📤 Upload Proof of Work'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8">No milestones yet. Add one to get started.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showMilestoneForm && selectedContract && contractorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 pt-24">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setShowMilestoneForm(false)}
            className="mb-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
          >
            ← Back
          </button>
          <MilestoneCreationForm
            contractId={selectedContract.id}
            contractAmount={selectedContract.contract_amount}
            onSuccess={() => {
              setShowMilestoneForm(false);
              fetchContractorAndContracts();
            }}
          />
        </div>
      </div>
    );
  }

  // Main contracts list view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 pt-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Contracts</h1>
            <p className="text-gray-600 mt-2">Manage your contracts, milestones, and financial tracking</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:shadow-lg text-white rounded-lg font-semibold transition"
          >
            <Plus className="w-5 h-5" />
            New Contract
          </button>
        </div>

        {/* Alerts Section */}
        {contractAlerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {contractAlerts.slice(0, 3).map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-l-4 flex items-start gap-3 ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-300'
                    : alert.severity === 'warning'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-blue-50 border-blue-300'
                }`}
              >
                <Bell className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  alert.severity === 'critical' ? 'text-red-600' :
                  alert.severity === 'warning' ? 'text-amber-600' :
                  'text-blue-600'
                }`} />
                <div className="flex-1">
                  <p className={`font-semibold ${
                    alert.severity === 'critical' ? 'text-red-900' :
                    alert.severity === 'warning' ? 'text-amber-900' :
                    'text-blue-900'
                  }`}>
                    {alert.contractNumber}: {alert.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Financial Dashboard */}
        {financialSummary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-600">
              <p className="text-gray-600 text-sm mb-2">Total Contract Value</p>
              <p className="text-3xl font-bold text-blue-600">{financialSummary.totalAmount.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-2">{financialSummary.activeContracts} active</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-green-600">
              <p className="text-gray-600 text-sm mb-2">Amount Paid</p>
              <p className="text-3xl font-bold text-green-600">{financialSummary.totalPaid.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-2">{(financialSummary.totalPaid / financialSummary.totalAmount * 100).toFixed(1)}% complete</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-amber-600">
              <p className="text-gray-600 text-sm mb-2">Outstanding</p>
              <p className="text-3xl font-bold text-amber-600">{financialSummary.totalOutstanding.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-2">Due for payment</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-purple-600">
              <p className="text-gray-600 text-sm mb-2">Avg Contract Value</p>
              <p className="text-3xl font-bold text-purple-600">{financialSummary.averageContractValue.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-2">{contracts.length} contracts</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-red-600">
              <p className="text-gray-600 text-sm mb-2">Expiring Soon</p>
              <p className="text-3xl font-bold text-red-600">{financialSummary.contractsNearExpiry}</p>
              <p className="text-xs text-gray-500 mt-2">Within 30 days</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-6 bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contracts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="name">Client Name</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
              <select
                value={filters.sortOrder}
                onChange={(e) => setFilters({...filters, sortOrder: e.target.value as 'asc' | 'desc'})}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contracts Grid */}
        {filteredAndSortedContracts().length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedContracts().map((contract) => {
              const progress = calculateContractProgress(contract.milestones || []);
              const isExpiringSoon = new Date(contract.contract_end_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              
              return (
                <div
                  key={contract.id}
                  onClick={() => setSelectedContract(contract)}
                  className={`bg-white rounded-lg shadow-md hover:shadow-xl transition cursor-pointer p-6 border-l-4 ${
                    isExpiringSoon ? 'border-red-400' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800">{contract.contract_number}</h3>
                      <p className="text-gray-600 text-sm">{contract.client_name}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${getStatusColor(contract.status)}`}>
                      {contract.status}
                    </span>
                  </div>

                  {isExpiringSoon && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Expires soon
                    </div>
                  )}

                  <p className="text-2xl font-bold text-blue-600 mb-4">
                    {contract.currency_code} {contract.contract_amount.toLocaleString()}
                  </p>

                  <div className="mb-4">
                    <p className="text-xs text-gray-600 mb-1">Progress</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{progress.toFixed(0)}% • {contract.milestones?.length || 0} milestones</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(contract.contract_start_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {contract.milestones?.filter(m => m.status === 'paid').length || 0}/{contract.milestones?.length || 0}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 bg-white rounded-lg border-2 border-dashed border-gray-300 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Contracts Found</h3>
            <p className="text-gray-600 mb-6">
              {contracts.length === 0 ? 'Create your first contract to start tracking work' : 'No contracts match your filters'}
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              Create Contract
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
