import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface ContractFormProps {
  contractorId: string;
  onSuccess?: (contractId: string) => void;
}

export default function ContractCreationForm({ contractorId, onSuccess }: ContractFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    contract_number: '',
    client_name: '',
    client_contact_person: '',
    client_email: '',
    contract_amount: '',
    currency_code: 'UGX',
    contract_start_date: '',
    contract_end_date: '',
    status: 'active',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.contract_number || !formData.client_name || !formData.contract_amount) {
        throw new Error('Please fill in all required fields');
      }

      // Calculate retention (5% of contract)
      const amount = parseFloat(formData.contract_amount);
      const retentionAmount = amount * 0.05;

      const { data, error: insertError } = await supabase
        .from('contracts')
        .insert({
          contractor_id: contractorId,
          contract_number: formData.contract_number,
          client_name: formData.client_name,
          client_contact_person: formData.client_contact_person,
          client_email: formData.client_email,
          contract_amount: amount,
          currency_code: formData.currency_code,
          contract_start_date: formData.contract_start_date,
          contract_end_date: formData.contract_end_date,
          retention_amount: retentionAmount,
          status: formData.status,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setSuccess(true);
      if (onSuccess && data) {
        setTimeout(() => onSuccess(data.id), 1500);
      }

      // Reset form
      setFormData({
        contract_number: '',
        client_name: '',
        client_contact_person: '',
        client_email: '',
        contract_amount: '',
        currency_code: 'UGX',
        contract_start_date: '',
        contract_end_date: '',
        status: 'active',
      });

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create contract');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New Contract</h3>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-700 font-semibold">Contract created successfully!</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract Number *</label>
            <input
              type="text"
              name="contract_number"
              value={formData.contract_number}
              onChange={handleChange}
              required
              placeholder="CTR-2024-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
            <input
              type="text"
              name="client_name"
              value={formData.client_name}
              onChange={handleChange}
              required
              placeholder="KCCA - Waste Management"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input
              type="text"
              name="client_contact_person"
              value={formData.client_contact_person}
              onChange={handleChange}
              placeholder="Ms. Sarah Nakayaga"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
            <input
              type="email"
              name="client_email"
              value={formData.client_email}
              onChange={handleChange}
              placeholder="sarah@kcca.go.ug"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contract Amount *</label>
            <input
              type="number"
              name="contract_amount"
              value={formData.contract_amount}
              onChange={handleChange}
              required
              placeholder="100000000"
              min="0"
              step="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              name="currency_code"
              value={formData.currency_code}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="UGX">Uganda (UGX)</option>
              <option value="KES">Kenya (KES)</option>
              <option value="NGN">Nigeria (NGN)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
            <input
              type="date"
              name="contract_start_date"
              value={formData.contract_start_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
            <input
              type="date"
              name="contract_end_date"
              value={formData.contract_end_date}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold py-2 rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Contract'
          )}
        </button>
      </div>
    </form>
  );
}
