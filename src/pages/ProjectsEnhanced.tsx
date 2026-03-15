import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjectsManagement, OngoingProject, CompletedProject } from '../hooks/useProjectsManagement';
import { supabase } from '../lib/supabase';
import {
  Clock, CheckCircle, AlertCircle, Loader, MessageCircle, TrendingUp,
  Calendar, DollarSign, User, Trophy, Zap, Film, Image, FileText, AlertTriangle,
  ChevronDown, Plus, X, Eye, Download, Share2, GripVertical, Timer
} from 'lucide-react';
import ProjectMilestoneVideoUpload from '../components/ProjectMilestoneVideoUpload';
import ProjectTeamChat from '../components/ProjectTeamChat';
import MilestoneProofOfWorkModal from '../components/MilestoneProofOfWorkModal';

interface ProjectSOPEvidence {
  id: string;
  milestone_id: string;
  type: 'photo' | 'video' | 'document';
  url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  uploaded_by: string;
  uploaded_at: string;
  evidence_type: string; // 'safety', 'process', 'measurement', 'specification'
}

interface ProjectTask {
  id: string;
  milestone_id: string;
  title: string;
  description?: string;
  assigned_to: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  completion_percentage: number;
}

export default function ProjectsEnhanced() {
  const { user } = useAuth();
  const { completedProjects, ongoingProjects, loading, error, refetch } = useProjectsManagement(user?.id || '');
  const [activeTab, setActiveTab] = useState<'ongoing' | 'completed'>('ongoing');
  const [selectedProject, setSelectedProject] = useState<OngoingProject | CompletedProject | null>(null);
  const [showMilestoneDetails, setShowMilestoneDetails] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showProofOfWorkModal, setShowProofOfWorkModal] = useState(false);
  const [showSOPGallery, setShowSOPGallery] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [chatContractId, setChatContractId] = useState<string>('');
  const [chatContractNumber, setChatContractNumber] = useState<string>('');
  const [selectedMilestoneForProof, setSelectedMilestoneForProof] = useState<{
    contractId: string;
    milestoneId: string;
    milestoneNumber: number;
    milestoneName: string;
  } | null>(null);
  const [sopEvidence, setSOPEvidence] = useState<ProjectSOPEvidence[]>([]);
  const [selectedSOPView, setSelectedSOPView] = useState<'grid' | 'timeline'>('grid');

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600 pt-24">Please sign in</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24">
        <div className="text-center space-y-4">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
          <p className="text-slate-600">Loading your projects...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const loadSOPEvidence = async (contractId: string) => {
    try {
      // Fetch from project_milestone_videos
      const { data: videos } = await supabase
        .from('project_milestone_videos')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false });

      // Fetch from field_verification (photos)
      const { data: photos } = await supabase
        .from('field_verification')
        .select('*')
        .order('photo_upload_timestamp', { ascending: false });

      const evidence: ProjectSOPEvidence[] = [
        ...(videos?.map(v => ({
          id: v.id,
          milestone_id: v.milestone_id,
          type: 'video' as const,
          url: v.url,
          thumbnail_url: v.thumbnail_url,
          title: v.title,
          description: v.description,
          uploaded_by: v.uploaded_by,
          uploaded_at: v.created_at,
          evidence_type: 'process'
        })) || []),
        ...(photos?.map(p => ({
          id: p.id,
          milestone_id: p.milestone_id,
          type: 'photo' as const,
          url: p.photo_url,
          thumbnail_url: p.photo_url,
          title: p.task_name,
          description: p.task_description,
          uploaded_by: p.contractor_id,
          uploaded_at: p.photo_upload_timestamp,
          evidence_type: p.gps_latitude ? 'verification' : 'documentation'
        })) || [])
      ];

      setSOPEvidence(evidence);
    } catch (err) {
      console.error('Failed to load SOP evidence:', err);
    }
  };

  // Ongoing Projects Tab
  const renderOngoingProjects = () => (
    <div className="space-y-6">
      {ongoingProjects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">No ongoing projects</p>
        </div>
      ) : (
        ongoingProjects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition"
          >
            {/* Project Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-transparent">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{project.client_name}</h3>
                  <p className="text-sm text-slate-600 mt-1">Contract #{project.contract_number}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">
                    {formatCurrency(project.contract_amount, project.currency_code)}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Contract Value</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Overall Progress</span>
                  <span className="text-sm font-bold text-blue-600">{project.progress_percentage}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${project.progress_percentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Start: {formatDate(project.contract_start_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>End: {formatDate(project.contract_end_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>{project.milestones.length} milestones</span>
                </div>
              </div>
            </div>

            {/* Milestones Grid */}
            <div className="p-6">
              <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Milestones
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            #{milestone.milestone_number}
                          </span>
                          <h5 className="font-semibold text-slate-900">{milestone.milestone_name}</h5>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{milestone.description}</p>
                      </div>
                      {milestone.status === 'completed' ? (
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                      ) : (
                        <Clock className="w-6 h-6 text-blue-600 flex-shrink-0" />
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>{milestone.percentage_of_contract}% of contract</span>
                        <span>{formatCurrency(milestone.amount_ugx, milestone.currency_code)}</span>
                      </div>
                      <div className="w-full bg-slate-300 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            milestone.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${milestone.status === 'completed' ? 100 : 65}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 mb-3">
                      Due: {formatDate(milestone.due_date)}
                    </div>

                    {/* Evidence Count */}
                    {milestone.videos && milestone.videos.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-blue-600 mb-3 p-2 bg-blue-50 rounded">
                        <Film className="w-4 h-4" />
                        <span>{milestone.videos.length} video{milestone.videos.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSelectedMilestoneForProof({
                          contractId: project.id,
                          milestoneId: milestone.id,
                          milestoneNumber: milestone.milestone_number,
                          milestoneName: milestone.milestone_name,
                        });
                        setShowProofOfWorkModal(true);
                      }}
                      className="w-full text-xs px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition font-medium"
                    >
                      Upload Evidence
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 grid grid-cols-4 gap-2">
              <button
                onClick={() => {
                  loadSOPEvidence(project.id);
                  setSelectedProject(project);
                  setShowSOPGallery(true);
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition font-medium text-sm"
                title="View SOP Evidence & Accountability Gallery"
              >
                <Image className="w-4 h-4" />
                <span className="hidden sm:inline">Gallery</span>
              </button>
              <button
                onClick={() => setShowCalendar(true)}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition font-medium text-sm"
                title="View Project Calendar"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Calendar</span>
              </button>
              <button
                onClick={() => {
                  setChatContractId(project.id);
                  setChatContractNumber(project.contract_number);
                  setShowChat(true);
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition font-medium text-sm"
                title="Team Chat"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Chat</span>
              </button>
              <button
                className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition font-medium text-sm"
                title="View Reports"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Reports</span>
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // SOP Gallery Modal
  if (showSOPGallery && selectedProject) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto pt-24">
        <div className="max-w-6xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-xl">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">SOP Compliance & Accountability Gallery</h2>
                <p className="text-slate-600 text-sm mt-1">{selectedProject.client_name} - Contract #{selectedProject.contract_number}</p>
              </div>
              <button
                onClick={() => setShowSOPGallery(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-6 h-6 text-slate-600" />
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex gap-4 p-6 border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setSelectedSOPView('grid')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedSOPView === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Grid View
              </button>
              <button
                onClick={() => setSelectedSOPView('timeline')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedSOPView === 'timeline'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Timeline
              </button>
            </div>

            {/* Evidence Content */}
            <div className="p-6">
              {sopEvidence.length === 0 ? (
                <div className="text-center py-12">
                  <Image className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No evidence uploaded yet</p>
                </div>
              ) : selectedSOPView === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {sopEvidence.map((item) => (
                    <div
                      key={item.id}
                      className="group relative bg-slate-100 rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer"
                    >
                      {item.type === 'video' ? (
                        <div className="aspect-video bg-slate-300 flex items-center justify-center">
                          <Film className="w-8 h-8 text-slate-500" />
                        </div>
                      ) : (
                        <img
                          src={item.thumbnail_url || item.url}
                          alt={item.title}
                          className="w-full aspect-square object-cover"
                        />
                      )}

                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition flex items-center justify-center gap-3">
                        <button className="opacity-0 group-hover:opacity-100 transition p-2 bg-white rounded-full hover:bg-slate-100">
                          <Eye className="w-5 h-5 text-slate-900" />
                        </button>
                        <button className="opacity-0 group-hover:opacity-100 transition p-2 bg-white rounded-full hover:bg-slate-100">
                          <Download className="w-5 h-5 text-slate-900" />
                        </button>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3 opacity-0 group-hover:opacity-100 transition">
                        <p className="text-white text-sm font-semibold truncate">{item.title}</p>
                        <p className="text-gray-300 text-xs">{formatDate(item.uploaded_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {sopEvidence.map((item, idx) => (
                    <div key={item.id} className="flex gap-4 pb-4 border-b border-slate-200 last:border-0">
                      <div className="w-20 h-20 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                        {item.type === 'video' ? (
                          <div className="w-full h-full flex items-center justify-center bg-slate-300">
                            <Film className="w-8 h-8 text-slate-500" />
                          </div>
                        ) : (
                          <img
                            src={item.thumbnail_url || item.url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-slate-900">{item.title}</h4>
                            <p className="text-sm text-slate-600">{item.description}</p>
                          </div>
                          <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {item.evidence_type}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-slate-600">
                          <span>{formatDate(item.uploaded_at)}</span>
                          <span>Type: {item.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <p className="text-sm text-slate-600">Total Evidence: {sopEvidence.length} items</p>
              <button
                onClick={() => setShowSOPGallery(false)}
                className="px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-900 rounded-lg transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Team Chat
  if (showChat) {
    return (
      <ProjectTeamChat
        contractId={chatContractId}
        contractNumber={chatContractNumber}
        onClose={() => setShowChat(false)}
      />
    );
  }

  // Proof of Work Modal
  if (showProofOfWorkModal && selectedMilestoneForProof) {
    return (
      <MilestoneProofOfWorkModal
        contractId={selectedMilestoneForProof.contractId}
        milestoneId={selectedMilestoneForProof.milestoneId}
        milestoneNumber={selectedMilestoneForProof.milestoneNumber}
        milestoneName={selectedMilestoneForProof.milestoneName}
        userId={user?.id || ''}
        userName={user?.name || 'User'}
        onSuccess={async () => {
          setShowProofOfWorkModal(false);
          setSelectedMilestoneForProof(null);
          await refetch();
        }}
        onClose={() => {
          setShowProofOfWorkModal(false);
          setSelectedMilestoneForProof(null);
        }}
      />
    );
  }

  // Completed Projects Tab
  const renderCompletedProjects = () => (
    <div className="space-y-6">
      {completedProjects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">No completed projects yet</p>
        </div>
      ) : (
        completedProjects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-lg border border-green-200 overflow-hidden hover:shadow-lg transition"
          >
            <div className="p-6 border-b border-green-100 bg-gradient-to-r from-green-50 to-transparent">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-6 h-6 text-green-600" />
                    <h3 className="text-xl font-bold text-slate-900">{project.client_name}</h3>
                  </div>
                  <p className="text-sm text-slate-600">Contract #{project.contract_number}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">
                    {formatCurrency(project.contract_amount, project.currency_code)}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Contract Value</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Started: {formatDate(project.contract_start_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Completed: {formatDate(project.completion_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  <span>100% Complete</span>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-slate-900 mb-3">Project Summary</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {project.summary || 'No summary provided'}
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-3">Key Achievements</h4>
                  {project.key_achievements && project.key_achievements.length > 0 ? (
                    <ul className="space-y-2">
                      {project.key_achievements.map((achievement, idx) => (
                        <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                          <span className="text-green-600 font-bold mt-0.5">✓</span>
                          <span>{achievement}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500 text-sm">No achievements recorded</p>
                  )}
                </div>
              </div>
            </div>

            {(project.rating || project.testimonial) && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 space-y-3">
                {project.rating && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">Client Rating:</span>
                    <div className="flex gap-1">
                      {Array(5).fill(0).map((_, i) => (
                        <span
                          key={i}
                          className={`text-lg ${i < Math.floor(project.rating || 0) ? 'text-yellow-400' : 'text-slate-300'}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {project.testimonial && (
                  <p className="text-sm text-slate-600 italic">"{project.testimonial}"</p>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Projects</h1>
          <p className="text-slate-600 text-lg">Manage your project milestones, team collaboration, and evidence tracking</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('ongoing')}
            className={`px-4 py-3 font-medium transition-colors relative ${
              activeTab === 'ongoing'
                ? 'text-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>Ongoing ({ongoingProjects.length})</span>
            </div>
            {activeTab === 'ongoing' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-3 font-medium transition-colors relative ${
              activeTab === 'completed'
                ? 'text-green-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Completed ({completedProjects.length})</span>
            </div>
            {activeTab === 'completed' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"></div>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'ongoing' && renderOngoingProjects()}
        {activeTab === 'completed' && renderCompletedProjects()}
      </div>
    </div>
  );
}
