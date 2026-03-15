import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface MilestoneFormProps {
  contractId: string;
  contractAmount: number;
  onSuccess?: () => void;
}

export default function MilestoneCreationForm({ contractId, contractAmount, onSuccess }: MilestoneFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [totalPercentage, setTotalPercentage] = useState(0);

  const [formData, setFormData] = useState({
    milestone_name: '',
    percentage_of_contract: '',
    description: '',
    due_date: '',
  });

  // Fetch existing milestones
  useEffect(() => {
    fetchMilestones();
  }, [contractId]);

  const fetchMilestones = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('contract_milestones')
        .select('*')
        .eq('contract_id', contractId)
        .order('milestone_number', { ascending: true });

      if (fetchError) throw fetchError;

      setMilestones(data || []);
      const total = (data || []).reduce((sum, m) => sum + (m.percentage_of_contract || 0), 0);
      setTotalPercentage(total);
    } catch (err: any) {
      console.error('Error fetching milestones:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'percentage_of_contract' ? parseFloat(value) || '' : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const percentage = parseFloat(formData.percentage_of_contract as any);

      if (totalPercentage + percentage > 100) {
        throw new Error(`Total percentage (${totalPercentage + percentage}%) cannot exceed 100%`);
      }

      const amount = contractAmount * (percentage / 100);

      const { error: insertError } = await supabase
        .from('contract_milestones')
        .insert({
          contract_id: contractId,
          milestone_number: milestones.length + 1,
          milestone_name: formData.milestone_name,
          percentage_of_contract: percentage,
          amount_ugx: amount,
          currency_code: 'UGX',
          description: formData.description,
          due_date: formData.due_date,
          status: 'pending',
        });

      if (insertError) throw insertError;

      setSuccess(true);
      setFormData({
        milestone_name: '',
        percentage_of_contract: '',
        description: '',
        due_date: '',
      });

      setTimeout(() => {
        setSuccess(false);
        fetchMilestones();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to create milestone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Create Milestone</h3>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 font-semibold">Milestone created successfully!</p>
          </div>
        )}

        {/* Progress */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700">
            <span className="font-semibold">{totalPercentage}%</span> of contract allocated to milestones
          </p>
          <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(totalPercentage, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Milestone Name *</label>
            <input
              type="text"
              name="milestone_name"
              value={formData.milestone_name}
              onChange={handleChange}
              required
              placeholder="e.g., Mobilization & Setup"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Percentage of Contract * (Remaining: {100 - totalPercentage}%)
              </label>
              <input
                type="number"
                name="percentage_of_contract"
                value={formData.percentage_of_contract}
                onChange={handleChange}
                required
                min="1"
                max={100 - totalPercentage}
                step="0.5"
                placeholder="20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Milestone Amount</label>
              <input
                type="text"
                disabled
                value={
                  formData.percentage_of_contract
                    ? `UGX ${(contractAmount * (parseFloat(formData.percentage_of_contract as any) / 100)).toLocaleString()}`
                    : 'UGX 0'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
            <input
              type="date"
              name="due_date"
              value={formData.due_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe what needs to be delivered for this milestone..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || 100 - totalPercentage <= 0}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-2 rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Add Milestone'
            )}
          </button>
        </div>
      </form>

      {/* Milestones List */}
      {milestones.length > 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-4">Existing Milestones</h4>
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <div key={milestone.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-semibold text-gray-800">{milestone.milestone_name}</h5>
                  <span className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {milestone.percentage_of_contract}%
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{milestone.description}</p>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Amount: UGX {milestone.amount_ugx?.toLocaleString()}</span>
                  <span>Due: {new Date(milestone.due_date).toLocaleDateString()}</span>
                  <span className={`font-medium ${
                    milestone.status === 'pending' ? 'text-yellow-600' :
                    milestone.status === 'paid' ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
