import { AuthSession, UserRole } from '../types/types';

function getValidBackendOrigin(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  try {
    const formatted = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `http://${raw}`;
    const url = new URL(formatted);
    if (url.hostname && url.hostname !== 'http' && url.hostname.includes('.')) {
      return url.origin;
    }
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return url.origin;
    }
  } catch {}
  return '';
}

const _backendOrigin = getValidBackendOrigin();
const API_BASE = _backendOrigin ? `${_backendOrigin}/api` : '/api';

export function resolveStoredToken(token?: string): string | undefined {
  if (token && token.trim()) return token.trim();
  try {
    const rawAuth = localStorage.getItem('od_auth_session') || localStorage.getItem('od_current_user');
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth);
      if (parsed.token) return parsed.token;
    }
  } catch {}
  return undefined;
}

export interface LoginApiResponse {
  success: boolean;
  message?: string;
  user?: {
    userId: string;
    identifier: string;
    name: string;
    email: string;
    role: UserRole;
    sub_role?: string;
    department: string;
    year?: string;
    section?: string;
    designation?: string;
    phone?: string;
    avatar?: string;
    token?: string;
  };
  role?: UserRole;
  dashboardUrl?: string;
  redirectUrl?: string;
  error?: string;
  token?: string;
}

export interface MeApiResponse {
  authenticated: boolean;
  user?: {
    userId: string;
    identifier: string;
    name: string;
    email: string;
    role: UserRole;
    sub_role?: string;
    department: string;
    year?: string;
    section?: string;
    designation?: string;
    phone?: string;
    avatar?: string;
  };
  role?: UserRole;
  dashboardUrl?: string;
  error?: string;
}

/**
 * Call Flask backend /api/auth/login
 * Validates credentials against SQLite database, detects user role, and returns target dashboard URL.
 */
export async function apiLogin(
  identifier: string,
  password: string,
  role?: UserRole
): Promise<LoginApiResponse> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: identifier.trim(),
        password: password.trim(),
        role: role,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Authentication failed. Invalid ID or Password.',
      };
    }

    return data as LoginApiResponse;
  } catch (err) {
    console.warn('Backend API connection failed:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please ensure Flask backend is running on port 5000.',
    };
  }
}

/**
 * Call Flask backend /api/auth/logout
 */
export async function apiLogout(): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return (await res.json()) || { success: true };
  } catch (err) {
    console.warn('Logout API error:', err);
    return { success: true };
  }
}

/**
 * Call Flask backend /api/auth/me to verify active session / token
 */
export async function apiGetMe(token?: string): Promise<MeApiResponse> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers,
    });
    const data = await res.json();
    return data as MeApiResponse;
  } catch {
    return { authenticated: false, error: 'Network error' };
  }
}

/**
 * Create a new OD Request via Flask backend POST /api/od-requests
 */
export async function apiCreateODRequest(
  payload: FormData | Record<string, any>,
  token?: string
): Promise<{ success: boolean; message?: string; requestId?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let body: any;
    if (payload instanceof FormData) {
      body = payload;
      // Do not set Content-Type header so browser sets multipart boundary automatically
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }

    const res = await fetch(`${API_BASE}/od-requests`, {
      method: 'POST',
      headers,
      body,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to submit OD request. Please check form inputs.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiCreateODRequest network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

/**
 * Retrieve all OD requests for the logged-in student via GET /api/od-requests/my
 */
export async function apiGetMyODRequests(
  token?: string
): Promise<{ success: boolean; requests: any[]; count?: number; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/od-requests/my`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        requests: [],
        error: data.error || 'Failed to fetch OD requests.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiGetMyODRequests network error:', err);
    return {
      success: false,
      requests: [],
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Retrieve a specific OD request by ID via GET /api/od-requests/<id>
 */
export async function apiGetODRequestById(
  requestId: string,
  token?: string
): Promise<{ success: boolean; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/od-requests/${requestId}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Request ${requestId} not found.`,
      };
    }

    return data;
  } catch (err) {
    console.warn('apiGetODRequestById network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Health check to verify Flask backend connection
 */
export async function apiCheckHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      return data.status === 'healthy';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Retrieve all OD requests assigned to the logged-in mentor via GET /api/mentor/od-requests
 */
export async function apiGetMentorODRequests(
  token?: string
): Promise<{
  success: boolean;
  requests: any[];
  pending: any[];
  history: any[];
  approved: any[];
  rejected: any[];
  count?: number;
  pendingCount?: number;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const res = await fetch(`${API_BASE}/mentor/od-requests`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        requests: [],
        pending: [],
        history: [],
        approved: [],
        rejected: [],
        error: data.error || 'Failed to fetch mentor OD requests.',
      };
    }

    return {
      success: true,
      requests: data.requests || [],
      pending: data.pending || [],
      history: data.history || [],
      approved: data.approved || [],
      rejected: data.rejected || [],
      count: data.count || 0,
      pendingCount: data.pendingCount || 0,
    };
  } catch (err) {
    console.warn('apiGetMentorODRequests network error:', err);
    return {
      success: false,
      requests: [],
      pending: [],
      history: [],
      approved: [],
      rejected: [],
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Retrieve specific request details for mentor review via GET /api/mentor/od-requests/<id>
 */
export async function apiGetMentorODRequestById(
  requestId: string,
  token?: string
): Promise<{ success: boolean; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/mentor/od-requests/${requestId}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Request ${requestId} not found.`,
      };
    }

    return data;
  } catch (err) {
    console.warn('apiGetMentorODRequestById network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Approve an OD request as mentor via POST /api/mentor/od-requests/<id>/approve
 */
export async function apiApproveODRequestByMentor(
  requestId: string,
  remarks?: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/mentor/od-requests/${requestId}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ remarks: remarks || '' }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to approve OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiApproveODRequestByMentor network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

/**
 * Reject an OD request as mentor via POST /api/mentor/od-requests/<id>/reject
 */
export async function apiRejectODRequestByMentor(
  requestId: string,
  reason: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/mentor/od-requests/${requestId}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: reason.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to reject OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiRejectODRequestByMentor network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}
/**
 * Retrieve all OD requests assigned to the logged-in Class Incharge via GET /api/class-incharge/od-requests
 */
export async function apiGetClassInchargeODRequests(
  token?: string
): Promise<{
  success: boolean;
  requests: any[];
  pending: any[];
  history: any[];
  approved: any[];
  rejected: any[];
  count?: number;
  pendingCount?: number;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const res = await fetch(`${API_BASE}/class-incharge/od-requests`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        requests: [],
        pending: [],
        history: [],
        approved: [],
        rejected: [],
        error: data.error || 'Failed to fetch Class Incharge OD requests.',
      };
    }

    return {
      success: true,
      requests: data.requests || [],
      pending: data.pending || [],
      history: data.history || [],
      approved: data.approved || [],
      rejected: data.rejected || [],
      count: data.count || 0,
      pendingCount: data.pendingCount || 0,
    };
  } catch (err) {
    console.warn('apiGetClassInchargeODRequests network error:', err);
    return {
      success: false,
      requests: [],
      pending: [],
      history: [],
      approved: [],
      rejected: [],
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Retrieve specific request details for Class Incharge review via GET /api/class-incharge/od-requests/<id>
 */
export async function apiGetClassInchargeODRequestById(
  requestId: string,
  token?: string
): Promise<{ success: boolean; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/class-incharge/od-requests/${requestId}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Request ${requestId} not found.`,
      };
    }

    return data;
  } catch (err) {
    console.warn('apiGetClassInchargeODRequestById network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Approve/endorse an OD request as Class Incharge via POST /api/class-incharge/od-requests/<id>/approve
 */
export async function apiApproveODRequestByClassIncharge(
  requestId: string,
  remarks?: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/class-incharge/od-requests/${requestId}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ remarks: remarks || '' }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to approve OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiApproveODRequestByClassIncharge network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

/**
 * Reject an OD request as Class Incharge via POST /api/class-incharge/od-requests/<id>/reject
 */
export async function apiRejectODRequestByClassIncharge(
  requestId: string,
  reason: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/class-incharge/od-requests/${requestId}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: reason.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to reject OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiRejectODRequestByClassIncharge network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

export interface HODExportFilters {
  eventName?: string;
  eventType?: string;
  status?: string;
  certificateStatus?: string;
  studentName?: string;
  studentRegisterNo?: string;
  year?: string;
  section?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

/**
 * Retrieve all OD requests assigned to the logged-in HOD via GET /api/hod/od-requests
 */
export async function apiGetHODODRequests(
  token?: string,
  filters?: HODExportFilters
): Promise<{
  success: boolean;
  requests: any[];
  all: any[];
  pending: any[];
  history: any[];
  approved: any[];
  rejected: any[];
  count?: number;
  pendingCount?: number;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const params = new URLSearchParams();
    if (filters) {
      if (filters.eventName) params.append('event_name', filters.eventName);
      if (filters.eventType && filters.eventType !== 'all') params.append('event_type', filters.eventType);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.certificateStatus && filters.certificateStatus !== 'all') params.append('certificate_status', filters.certificateStatus);
      if (filters.studentName) params.append('student_name', filters.studentName);
      if (filters.studentRegisterNo) params.append('student_reg_no', filters.studentRegisterNo);
      if (filters.year && filters.year !== 'all') params.append('year', filters.year);
      if (filters.section && filters.section !== 'all') params.append('section', filters.section);
      if (filters.fromDate) params.append('from_date', filters.fromDate);
      if (filters.toDate) params.append('to_date', filters.toDate);
      if (filters.search) params.append('search', filters.search);
    }

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/hod/od-requests${queryStr}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        requests: [],
        all: [],
        pending: [],
        history: [],
        approved: [],
        rejected: [],
        error: data.error || 'Failed to fetch HOD OD requests.',
      };
    }

    return {
      success: true,
      requests: data.requests || [],
      all: data.all || data.requests || [],
      pending: data.pending || [],
      history: data.history || [],
      approved: data.approved || [],
      rejected: data.rejected || [],
      count: data.count || 0,
      pendingCount: data.pendingCount || 0,
    };
  } catch (err) {
    console.warn('apiGetHODODRequests network error:', err);
    return {
      success: false,
      requests: [],
      all: [],
      pending: [],
      history: [],
      approved: [],
      rejected: [],
      error: 'Unable to reach backend server.',
    };
  }
}

/**
 * Approve an OD request as HOD via POST /api/hod/od-requests/<id>/approve
 */
export async function apiApproveODRequestByHOD(
  requestId: string,
  remarks?: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/hod/od-requests/${requestId}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ remarks: remarks || '' }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to approve OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiApproveODRequestByHOD network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

/**
 * Reject an OD request as HOD via POST /api/hod/od-requests/<id>/reject
 */
export async function apiRejectODRequestByHOD(
  requestId: string,
  reason: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/hod/od-requests/${requestId}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: reason.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to reject OD request.',
      };
    }

    return data;
  } catch (err) {
    console.warn('apiRejectODRequestByHOD network error:', err);
    return {
      success: false,
      error: 'Unable to reach backend server. Please verify Flask backend is running on port 5000.',
    };
  }
}

/**
 * Retrieve live department analytics for HOD via GET /api/hod/stats
 */
export async function apiGetHODStats(
  token?: string
): Promise<{ success: boolean; stats?: any; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const res = await fetch(`${API_BASE}/hod/stats`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to fetch HOD stats.' };
    }

    return data;
  } catch (err) {
    console.warn('apiGetHODStats network error:', err);
    return { success: false, error: 'Unable to reach backend server.' };
  }
}

/**
 * Download professionally styled Excel OD Report from backend GET /api/hod/od/export
 */
export async function apiExportHODODExcel(
  filters: HODExportFilters = {},
  token?: string
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters.eventName) params.append('event_name', filters.eventName);
    if (filters.eventType && filters.eventType !== 'all') params.append('event_type', filters.eventType);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.certificateStatus && filters.certificateStatus !== 'all') params.append('certificate_status', filters.certificateStatus);
    if (filters.studentName) params.append('student_name', filters.studentName);
    if (filters.studentRegisterNo) params.append('student_reg_no', filters.studentRegisterNo);
    if (filters.year && filters.year !== 'all') params.append('year', filters.year);
    if (filters.section && filters.section !== 'all') params.append('section', filters.section);
    if (filters.fromDate) params.append('from_date', filters.fromDate);
    if (filters.toDate) params.append('to_date', filters.toDate);
    if (filters.search) params.append('search', filters.search);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/hod/od/export?${params.toString()}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `Export failed with HTTP status ${res.status}`,
      };
    }

    // Extract filename from Content-Disposition header
    let filename = 'OD_Report.xlsx';
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    }

    // Create a blob and trigger download in browser
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true, filename };
  } catch (err: any) {
    console.error('Export Excel error:', err);
    return { success: false, error: err.message || 'Network error during Excel download.' };
  }
}

// ============================================================================
// ACADEMIC DATA UPLOAD & ATTENDANCE APIS (FOR CLASS INCHARGE)
// ============================================================================

export interface AcademicRowPreview {
  row_number: number;
  register_number: string;
  student_name: string;
  student_id: string | null;
  cat1: number | null;
  cat2: number | null;
  cat3: number | null;
  attendance: number | null;
  match_status: 'Matched' | 'Not Found';
  validation_status: 'Valid' | 'Error';
  errors?: string[];
  department?: string;
}

export interface AcademicUploadSummary {
  total_rows: number;
  matched_count: number;
  unmatched_count: number;
  invalid_count: number;
  can_confirm: boolean;
}

export interface AcademicValidationError {
  row: number;
  register_number: string;
  student_name: string;
  problem: string;
  correction: string;
}

export interface AcademicUploadPreviewResponse {
  success: boolean;
  preview_token?: string;
  file_name?: string;
  summary?: AcademicUploadSummary;
  rows?: AcademicRowPreview[];
  errors?: AcademicValidationError[];
  error?: string;
}

export interface AcademicConfirmResponse {
  success: boolean;
  message?: string;
  updated_count?: number;
  unmatched_count?: number;
  invalid_count?: number;
  history_id?: string;
  status?: string;
  error?: string;
}

export interface AcademicUploadHistoryItem {
  id: string;
  upload_date: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
  file_name: string;
  total_rows: number;
  successful_updates: number;
  unmatched_count: number;
  invalid_count: number;
  status: 'Completed' | 'Completed with warnings' | 'Failed';
  details?: AcademicRowPreview[];
  created_at: string;
}

export interface AcademicStudentItem {
  id: string;
  studentId?: string;
  student_id?: string;
  registerNumber: string;
  register_number?: string;
  rollNo?: string;
  name?: string;
  studentName?: string;
  student_name?: string;
  department: string;
  year?: string;
  section?: string;
  avatar?: string;
  attendancePercent?: number;
  attendancePercentage?: number;
  attendance_percentage?: number;
  cat1Average?: number | null;
  cat1Marks?: number | null;
  cat1_marks?: number | null;
  cat2Average?: number | null;
  cat2Marks?: number | null;
  cat2_marks?: number | null;
  cat3Average?: number | null;
  cat3Marks?: number | null;
  cat3_marks?: number | null;
  has_academic_data?: boolean;
  hasAcademicData?: boolean;
  remainingODDays?: number;
  remaining_od_days?: number;
  isEligible?: boolean;
  is_eligible?: boolean;
  eligibility?: {
    eligible?: boolean;
    is_eligible?: boolean;
    max_od_allowed_days?: number;
    max_od_allowed_percent?: number;
    od_used_days?: number;
    consumed_od_days?: number;
    remaining_od_days?: number;
    rejection_reason?: string | null;
  };
  lastUpdated?: string;
  last_updated?: string;
  updatedBy?: string;
  updated_by?: string;
}

/**
 * Download sample Excel template (.xlsx) for Academic Data Upload
 */
export async function apiDownloadAcademicTemplate(token?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/class-incharge/academic/template`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || `Download failed with HTTP ${res.status}` };
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_academic_data_template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to download Excel template.' };
  }
}

/**
 * Upload academic Excel spreadsheet and receive parsed preview with validation & student matching
 */
export async function apiUploadAcademicExcel(file: File, token?: string): Promise<AcademicUploadPreviewResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/class-incharge/academic/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Upload failed with HTTP ${res.status}`,
        summary: data.summary,
        rows: data.rows,
        errors: data.errors,
      };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during file upload.' };
  }
}

/**
 * Confirm previewed academic records and update database transactionally
 */
export async function apiConfirmAcademicUpdate(
  previewToken?: string,
  rows?: AcademicRowPreview[],
  token?: string
): Promise<AcademicConfirmResponse> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/class-incharge/academic/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        preview_token: previewToken,
        rows: rows,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Confirmation failed with HTTP ${res.status}`,
      };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during database update.' };
  }
}

/**
 * Retrieve past academic Excel upload audit history logs
 */
export async function apiGetAcademicUploadHistory(
  token?: string
): Promise<{ success: boolean; history?: AcademicUploadHistoryItem[]; count?: number; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/class-incharge/academic/upload-history`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to fetch upload history.' };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching upload history.' };
  }
}

/**
 * Retrieve section students with latest academic marks & attendance
 */
export async function apiGetAcademicStudents(
  token?: string
): Promise<{ success: boolean; students?: AcademicStudentItem[]; count?: number; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/class-incharge/academic/students`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to fetch academic students.' };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching students roster.' };
  }
}

/**
 * Retrieve currently authenticated student's academic record
 */
export async function apiGetMyAcademic(
  token?: string
): Promise<{
  success: boolean;
  academic?: any;
  attendance_percentage?: number;
  cat1_marks?: number | null;
  cat2_marks?: number | null;
  cat3_marks?: number | null;
  eligibility?: any;
  last_updated?: string;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/academic/me`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to fetch academic details.' };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching academic details.' };
  }
}

/**
 * Retrieve academic details for a specific student (Faculty / Class Incharge / HOD)
 * GET /api/students/<student_id>/academic
 */
export async function apiGetStudentAcademic(
  studentId: string,
  token?: string
): Promise<{
  success: boolean;
  academic?: {
    id: string;
    student_id: string;
    register_number: string;
    student_name: string;
    department: string;
    year: string;
    section: string;
    cat1_marks: number | null;
    cat2_marks: number | null;
    cat3_marks: number | null;
    attendance_percentage: number;
    updated_by: string;
    updated_at: string;
    eligibility?: {
      attendance_percentage: number;
      is_eligible: boolean;
      max_od_allowed_percent: number;
      max_od_allowed_days: number;
      consumed_od_days: number;
      remaining_od_days: number;
    };
  };
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/students/${encodeURIComponent(studentId)}/academic`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to fetch student academic details.' };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching student academic details.' };
  }
}

/**
 * Upload student OD participation certificate.
 * Enforces:
 * - Block if event has not ended yet
 * - Block if 24-hour certificate window expired
 */
export async function apiUploadCertificate(
  requestId: string,
  file: File,
  token?: string
): Promise<{ success: boolean; message?: string; certificateUrl?: string; request?: any; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('certificate', file);
    const headers: Record<string, string> = {};
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/od-requests/${encodeURIComponent(requestId)}/certificate`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to upload certificate.' };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error uploading certificate.' };
  }
}

/**
 * Verify or decline uploaded OD certificate by Mentor / Faculty.
 */
export async function apiVerifyCertificate(
  requestId: string,
  status: 'Verified' | 'Rejected',
  remarks?: string,
  token?: string
): Promise<{ success: boolean; message?: string; request?: any; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const activeToken = resolveStoredToken(token);
    if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

    const res = await fetch(`${API_BASE}/mentor/od-requests/${encodeURIComponent(requestId)}/verify-certificate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status, remarks: remarks || '' }),
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to verify certificate.' };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error verifying certificate.' };
  }
}
