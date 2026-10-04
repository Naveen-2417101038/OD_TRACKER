import React, { useState, useEffect } from 'react';
import { getCertificates, uploadCertificate, getODRequests, simulateVerifyCertificate } from '../data/mockData';
import { CertificateItem, ODRequest } from '../types/types';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { 
  Award, Upload, ShieldCheck, ShieldAlert, FileText, CheckCircle, 
  Trash2, X, PlusCircle, ArrowUpCircle, Eye, EyeOff
} from 'lucide-react';
import { useToast } from '../components/Toast';

export const Certificates: React.FC = () => {
  const { showToast } = useToast();
  
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [requests, setRequests] = useState<ODRequest[]>([]);
  
  const [selectedReqId, setSelectedReqId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadData = () => {
    setCertificates(getCertificates());
    // Only show approved/pending requests for which a certificate can be uploaded
    setRequests(getODRequests().filter(r => r.status !== 'Rejected'));
  };

  useEffect(() => {
    loadData();
    
    // Listen for simulator events
    window.addEventListener('odStateUpdated', loadData);
    return () => window.removeEventListener('odStateUpdated', loadData);
  }, []);

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqId) {
      showToast('Please select a valid OD Request.', 'error');
      return;
    }
    if (!file) {
      showToast('Please select a certificate file.', 'error');
      return;
    }

    setIsUploading(true);

    setTimeout(() => {
      setIsUploading(false);
      const req = requests.find(r => r.id === selectedReqId);
      if (req) {
        uploadCertificate(selectedReqId, req.eventName, file.name);
        showToast('Certificate uploaded successfully. Pending verification.', 'success');
        
        // Clear state
        setSelectedReqId('');
        setFile(null);
        setShowUploadModal(false);
        loadData();
        
        // Refresh simulator
        if ((window as any).refreshSimulator) {
          (window as any).refreshSimulator();
        }
      }
    }, 1500);
  };

  const handleSimulateVerify = (id: string, status: 'Verified' | 'Rejected') => {
    simulateVerifyCertificate(id, status);
    loadData();
    showToast(`Simulated certificate status change to ${status}.`, 'info');
  };

  const handleReplaceFile = (cert: CertificateItem) => {
    showToast(`Replacing certificate file "${cert.certificateName}" initialized.`, 'info');
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary-600 p-2 rounded-xl text-white">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">OD Certificates</h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Verification status of uploaded event participation certificates</p>
          </div>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow-lg shadow-primary-200 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Upload Certificate</span>
        </button>
      </div>

      {/* Safety Banner */}
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs leading-normal">
          <strong className="font-bold">Administrative Rule:</strong> Uploaded certificates are <strong className="font-bold">NOT automatically trusted</strong> by the college portal. Academic Record Officers will verify the validity of your uploaded documents. Approved OD counts remain tentative until verified.
        </div>
      </div>

      {/* Certificates List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {certificates.length === 0 ? (
          <div className="col-span-full text-center py-16 text-slate-400 font-semibold bg-white border border-slate-200 rounded-3xl p-6">
            No certificates uploaded yet.
          </div>
        ) : (
          certificates.map((cert) => {
            return (
              <Card key={cert.id} className="hover:border-slate-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-primary-600 font-bold bg-primary-50 px-2 py-0.5 rounded border border-primary-100">
                      {cert.requestId}
                    </span>
                    <StatusBadge status={cert.status} size="sm" />
                  </div>

                  <h3 className="font-bold text-sm text-slate-800 mt-3 line-clamp-1">{cert.eventName}</h3>
                  
                  {/* File name box */}
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200/50 rounded-xl flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-600 font-semibold truncate">{cert.certificateName}</span>
                  </div>

                  <p className="text-[10px] text-slate-400 font-semibold mt-2.5">
                    Uploaded: {new Date(cert.uploadDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="mt-5 border-t border-slate-100 pt-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => showToast('Opening certificate PDF reader simulator.', 'info')}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg py-1.5 text-xs font-bold transition-all shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => handleReplaceFile(cert)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg py-1.5 text-xs font-bold transition-all shadow-sm"
                    >
                      <span>Replace</span>
                    </button>
                  </div>

                  {/* Simulator action links inside card for easy demo */}
                  {cert.status === 'Pending Verification' && (
                    <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2 text-[10px] text-slate-400 font-semibold bg-amber-50/50 p-2 rounded border border-amber-100">
                      <span>Simulate Approval:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSimulateVerify(cert.id, 'Verified')}
                          className="text-emerald-600 hover:text-emerald-800 hover:underline font-bold"
                        >
                          Verify ✓
                        </button>
                        <button
                          onClick={() => handleSimulateVerify(cert.id, 'Rejected')}
                          className="text-rose-600 hover:text-rose-800 hover:underline font-bold"
                        >
                          Reject ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Upload Certificate Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowUploadModal(false)} />
          
          <Card className="w-full max-w-md relative z-10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Upload Certificate</h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              
              {/* Dropdown to select OD request */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select OD Request</label>
                <select
                  value={selectedReqId}
                  onChange={(e) => setSelectedReqId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                >
                  <option value="">Choose Pending/Approved OD</option>
                  {requests.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.id} - {req.eventName} ({req.eventDate})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select file */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Upload PDF / image</label>
                <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col items-center justify-center text-center">
                  {file ? (
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary-600" />
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">{file.name}</span>
                      <button type="button" onClick={() => setFile(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-1 text-xs">Clear</button>
                    </div>
                  ) : (
                    <label className="cursor-pointer text-xs font-bold text-primary-600 hover:underline">
                      Choose Certificate File
                      <input
                        type="file"
                        className="hidden"
                        required
                        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                        accept="application/pdf,image/*"
                      />
                    </label>
                  )}
                  <p className="text-[9px] text-slate-400 mt-1">PDF or image format, up to 5MB</p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-primary-200 flex items-center gap-1.5"
                >
                  {isUploading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </Card>
        </div>
      )}

    </div>
  );
};
