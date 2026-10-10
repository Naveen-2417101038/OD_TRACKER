import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getODRequests, syncODRequestsFromBackend
} from '../data/mockData';
import { ODRequest } from '../types/types';
import { Card } from '../components/Card';
import { Timeline } from '../components/Timeline';
import { StatusBadge } from '../components/StatusBadge';
import { 
  Search, Calendar, MapPin, Clock, Building, 
  FileText, Shield, UserCheck, CheckCircle2, XCircle
} from 'lucide-react';
import { useToast } from '../components/Toast';

export const ODRequests: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<ODRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ODRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

  const loadRequests = () => {
    const allReqs = getODRequests();
    setRequests(allReqs);

    if (id) {
      const match = allReqs.find((r) => r.id === id);
      if (match) {
        setSelectedRequest(match);
      } else {
        if (allReqs.length > 0) {
          setSelectedRequest(allReqs[0]);
          navigate(`/student/requests/${allReqs[0].id}`, { replace: true });
        }
      }
    } else if (allReqs.length > 0 && !selectedRequest) {
      setSelectedRequest(allReqs[0]);
      navigate(`/student/requests/${allReqs[0].id}`, { replace: true });
    }
  };

  useEffect(() => {
    loadRequests();
    syncODRequestsFromBackend().then((backendReqs) => {
      if (backendReqs && backendReqs.length > 0) {
        setRequests(backendReqs);
        const currentSelectedId = selectedRequest?.id || id;
        const match = currentSelectedId ? backendReqs.find(r => r.id === currentSelectedId) : backendReqs[0];
        if (match) {
          setSelectedRequest(match);
          if (!id) {
            navigate(`/student/requests/${match.id}`, { replace: true });
          }
        }
      }
    });
    
    const handleUpdate = () => {
      const allReqs = getODRequests();
      setRequests(allReqs);
      
      const currentSelectedId = selectedRequest?.id || id;
      if (currentSelectedId) {
        const refreshedSelected = allReqs.find((r) => r.id === currentSelectedId);
        if (refreshedSelected) {
          setSelectedRequest(refreshedSelected);
        }
      }
    };
    
    window.addEventListener('odStateUpdated', handleUpdate);
    return () => window.removeEventListener('odStateUpdated', handleUpdate);
  }, [id]);

  const handleSelectRequest = (req: ODRequest) => {
    setSelectedRequest(req);
    navigate(`/student/requests/${req.id}`);
  };

  const filteredRequests = requests.filter((req) => {
    const matchesSearch = 
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.eventOrganizer.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = false;
    if (statusFilter === 'All') {
      matchesStatus = true;
    } else if (statusFilter === 'Pending') {
      matchesStatus = 
        req.status === 'Pending' || 
        req.status === 'Mentor Approved' || 
        req.status === 'Class Incharge Approved' || 
        req.status === 'HOD Approved - Certificate Pending' || 
        req.status === 'Certificate Submitted';
    } else if (statusFilter === 'Approved') {
      matchesStatus = 
        req.status === 'Approved' || 
        req.status === 'HOD Approved' || 
        req.status === 'HOD Approved - Certificate Pending' || 
        req.status === 'Certificate Submitted' ||
        req.status === 'Class Incharge Approved' ||
        req.status === 'Mentor Approved';
    } else if (statusFilter === 'Rejected') {
      matchesStatus = 
        req.status === 'Rejected' || 
        req.status === 'Mentor Rejected' || 
        req.status === 'Class Incharge Rejected' || 
        req.status === 'HOD Rejected';
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-primary-600 p-2 rounded-xl text-white">
          <UserCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Track OD Requests</h1>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Real-time status of academic approvals</p>
        </div>
      </div>

      {/* Split Pane Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Pane: Requests List */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-4 md:p-4 space-y-4">
            
            {/* Search Bar */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, Event, Organizer"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
            </div>

            {/* Quick Status Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/20">
              {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    statusFilter === tab 
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

          </Card>

          {/* Scrollable Requests List */}
          <div className="space-y-3 max-h-[500px] lg:max-h-[600px] overflow-y-auto pr-1">
            {filteredRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white border border-slate-200 rounded-2xl p-6 font-semibold">
                No OD requests match your search filter.
              </div>
            ) : (
              filteredRequests.map((req) => {
                const isSelected = selectedRequest?.id === req.id;
                return (
                  <div
                    key={req.id}
                    onClick={() => handleSelectRequest(req)}
                    className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer shadow-xs hover:translate-y-[-1px] ${
                      isSelected 
                        ? 'border-primary-500 ring-2 ring-primary-500/10' 
                        : 'border-slate-200/85 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-primary-600">{req.id}</span>
                        <h4 className="font-bold text-xs text-slate-800 mt-1 line-clamp-1">{req.eventName}</h4>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{req.eventOrganizer}</p>
                      </div>
                      <StatusBadge status={req.status} size="sm" />
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-500 font-medium">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(req.eventDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      </div>
                      <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-600">
                        {req.approvalStage}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Selected Request Details & Stepper */}
        <div className="lg:col-span-8">
          {selectedRequest ? (
            <div className="space-y-6">
              <Card className="space-y-6">
                
                {/* Event Top Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-100">
                        {selectedRequest.id}
                      </span>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {selectedRequest.eventType}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mt-2 leading-tight">
                      {selectedRequest.eventName}
                    </h3>
                  </div>
                  <div className="self-start sm:self-auto">
                    <StatusBadge status={selectedRequest.status} />
                  </div>
                </div>

                {/* Key Meta Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-700 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-white border border-slate-200/80 p-2 rounded-xl text-slate-500 shadow-xs shrink-0">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Organizer</p>
                      <p className="text-slate-800 mt-0.5">{selectedRequest.eventOrganizer}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-white border border-slate-200/80 p-2 rounded-xl text-slate-500 shadow-xs shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Venue</p>
                      <p className="text-slate-800 mt-0.5">{selectedRequest.venue}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-white border border-slate-200/80 p-2 rounded-xl text-slate-500 shadow-xs shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date</p>
                      <p className="text-slate-800 mt-0.5">
                        {new Date(selectedRequest.eventDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-white border border-slate-200/80 p-2 rounded-xl text-slate-500 shadow-xs shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Timing</p>
                      <p className="text-slate-800 mt-0.5">{selectedRequest.fromTime} to {selectedRequest.toTime}</p>
                    </div>
                  </div>
                </div>

                {/* Reason & Description */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reason for applying</h5>
                    <p className="text-sm text-slate-700 font-semibold">{selectedRequest.reason}</p>
                  </div>
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event description</h5>
                    <p className="text-xs text-slate-600 leading-normal font-medium bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                      {selectedRequest.description}
                    </p>
                  </div>
                </div>

                {/* Supporting Document Details */}
                {selectedRequest.documentUrl && (
                  <div className="flex items-center justify-between p-3 border border-primary-100 bg-primary-50/20 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary-100 p-2 rounded-xl text-primary-700">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{selectedRequest.documentUrl}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Uploaded supporting document</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => showToast('Previewing attached document proof.', 'info')}
                      className="text-xs font-bold text-primary-600 hover:text-primary-800 hover:underline px-3 py-1 bg-white border border-primary-200 rounded-lg shadow-xs"
                    >
                      View File
                    </button>
                  </div>
                )}

              </Card>

              {/* Approval Timeline Section */}
              <Card>
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                  <Shield className="w-5 h-5 text-primary-600" />
                  <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider">OD Approval Progress</h4>
                </div>
                
                <Timeline stages={selectedRequest.stages} />

                {/* Rejection Alert Comment */}
                {(selectedRequest.status === 'Rejected' || selectedRequest.status === 'Mentor Rejected' || (selectedRequest.status as string).includes('Rejected')) && (
                  <div className="mt-6 p-4 border border-rose-200 bg-rose-50 rounded-2xl flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-xs text-rose-800 uppercase tracking-wider">Rejection Feedback / Remarks</h5>
                      <p className="text-xs text-rose-700 font-medium mt-1 leading-normal">
                        {selectedRequest.rejectionReason || 
                         selectedRequest.remarks ||
                         selectedRequest.stages?.mentor?.feedback || 
                         selectedRequest.stages?.classIncharge?.feedback || 
                         selectedRequest.stages?.hod?.feedback || 
                         'Your request has been declined. Please consult your Faculty Mentor.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Mentor Approved Alert Comment */}
                {selectedRequest.status === 'Mentor Approved' && (
                  <div className="mt-6 p-4 border border-indigo-200 bg-indigo-50/70 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-xs text-indigo-900 uppercase tracking-wider">Status: Mentor Recommended & Forwarded</h5>
                      <p className="text-xs text-indigo-800 font-medium mt-1 leading-normal">
                        {selectedRequest.stages?.mentor?.feedback || selectedRequest.remarks || 'Your request has been recommended by Mentor and forwarded to Class Incharge for endorsement.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Class Incharge Approved Alert Comment */}
                {selectedRequest.status === 'Class Incharge Approved' && (
                  <div className="mt-6 p-4 border border-teal-200 bg-teal-50/80 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-xs text-teal-900 uppercase tracking-wider">Status: Class Incharge Endorsed & Forwarded</h5>
                      <p className="text-xs text-teal-800 font-medium mt-1 leading-normal">
                        {selectedRequest.stages?.classIncharge?.feedback || selectedRequest.remarks || 'Your request has been endorsed by Class Incharge and forwarded to HOD for final sanction.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* HOD Approved - Certificate Pending Comment */}
                {(selectedRequest.status === 'HOD Approved - Certificate Pending' || selectedRequest.status === 'HOD Approved') && (
                  <div className="mt-6 p-4 border border-amber-300 bg-amber-50 rounded-2xl flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                    <div className="space-y-1.5 w-full">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h5 className="font-bold text-xs text-amber-900 uppercase tracking-wider">
                          Status: HOD Approved — Mandatory Certificate Pending
                        </h5>
                        <button
                          onClick={() => navigate('/student/certificates')}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all"
                        >
                          Go to Certificate Upload →
                        </button>
                      </div>
                      <p className="text-xs text-amber-800 font-medium leading-normal">
                        Executive sanction has been granted by HOD. The student must attend the event and upload the completion certificate within 24 hours after the event ends.
                      </p>
                      <div className="flex flex-wrap gap-4 pt-1 text-[11px] font-semibold text-amber-900">
                        {selectedRequest.eventEndDatetime && (
                          <span>Event Ends: <strong>{selectedRequest.eventEndDatetime}</strong></span>
                        )}
                        {selectedRequest.certificateDeadline && (
                          <span>Certificate Deadline: <strong>{selectedRequest.certificateDeadline}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Certificate Submitted Alert Comment */}
                {selectedRequest.status === 'Certificate Submitted' && (
                  <div className="mt-6 p-4 border border-blue-200 bg-blue-50/80 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="font-bold text-xs text-blue-900 uppercase tracking-wider">
                        Status: Certificate Submitted — Verification Pending
                      </h5>
                      <p className="text-xs text-blue-800 font-medium leading-normal">
                        Your participation certificate has been uploaded on time within the 24-hour deadline. It is currently awaiting verification by your Faculty Mentor.
                      </p>
                      {selectedRequest.certificateSubmittedAt && (
                        <p className="text-[10px] text-blue-600 font-bold">
                          Submitted at: {selectedRequest.certificateSubmittedAt}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Final Approved Alert Comment */}
                {selectedRequest.status === 'Approved' && (
                  <div className="mt-6 p-4 border border-emerald-200 bg-emerald-50 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-xs text-emerald-800 uppercase tracking-wider">Status: Fully Approved & Completed</h5>
                      <p className="text-xs text-emerald-700 font-medium mt-1 leading-normal">
                        Your OD has been fully approved and participation certificate verified. Academic compensatory attendance has been credited to your official record.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card className="text-center py-24 text-slate-400 font-semibold flex flex-col items-center justify-center space-y-3">
              <Shield className="w-12 h-12 text-slate-300 animate-pulse" />
              <p className="text-sm">Select an On-Duty request to track its status.</p>
              <p className="text-xs text-slate-400 font-medium">Click on a card from the left panel.</p>
            </Card>
          )}
        </div>

      </div>

    </div>
  );
};
