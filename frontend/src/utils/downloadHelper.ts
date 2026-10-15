/**
 * Download Utilities for OD Letters and Participation Certificates
 * Handles clean browser downloads with fallback support.
 */
import { ODRequest, CertificateItem } from '../types/types';

export const triggerBlobDownload = async (
  url: string,
  filename: string,
  token?: string
): Promise<boolean> => {
  try {
    let fetchUrl = url;
    if (token && !fetchUrl.includes('token=')) {
      const sep = fetchUrl.includes('?') ? '&' : '?';
      fetchUrl = `${fetchUrl}${sep}token=${encodeURIComponent(token)}`;
    }
    if (!fetchUrl.includes('download=')) {
      const sep = fetchUrl.includes('?') ? '&' : '?';
      fetchUrl = `${fetchUrl}${sep}download=true`;
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(fetchUrl, { headers });
    if (!res.ok) {
      throw new Error(`Download HTTP error: ${res.status}`);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch (err) {
    console.warn('Blob download failed, using direct anchor fallback:', err);
    let fallbackUrl = url;
    if (token && !fallbackUrl.includes('token=')) {
      const sep = fallbackUrl.includes('?') ? '&' : '?';
      fallbackUrl = `${fallbackUrl}${sep}token=${encodeURIComponent(token)}`;
    }
    const sep = fallbackUrl.includes('?') ? '&' : '?';
    fallbackUrl = `${fallbackUrl}${sep}download=true`;

    const link = document.createElement('a');
    link.href = fallbackUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }
};

/**
 * Download an OD Request Letter / Proof document for any role
 */
export const downloadODLetter = async (
  req: ODRequest,
  role: 'Mentor' | 'Class Incharge' | 'HOD' = 'Mentor',
  token?: string
) => {
  const reqId = req.id || 'OD_Request';
  const student = req.studentRegisterNo || req.studentName || 'Student';
  const filename = `OD_Letter_${reqId}_${student}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');

  let targetUrl = req.documentUrl || req.odLetterUrl;
  if (!targetUrl || !targetUrl.startsWith('/api/')) {
    const roleSlug = role === 'Class Incharge' ? 'class-incharge' : role.toLowerCase();
    targetUrl = `/api/${roleSlug}/od-requests/${reqId}/letter`;
  }

  return triggerBlobDownload(targetUrl, filename, token);
};

/**
 * Download a student participation certificate
 */
export const downloadCertificateFile = async (
  item: CertificateItem | ODRequest,
  token?: string
) => {
  const isItemCert = 'certificateName' in item;
  const certName = isItemCert ? item.certificateName : item.certificateUrl?.split('/').pop() || 'Certificate.pdf';
  const reqId = isItemCert ? item.requestId : item.id;
  const filename = `Certificate_${reqId}_${certName}`.replace(/[^a-zA-Z0-9_.-]/g, '_');

  let fileUrl = '';
  if (isItemCert) {
    fileUrl = (item as any).fileUrl || (item as any).certificateUrl || (item as any).certificate_file_url || '';
  } else {
    fileUrl = item.certificateUrl || (item as any).certificate_file_url || '';
  }

  if (!fileUrl || !fileUrl.startsWith('/api/')) {
    if (certName && certName !== 'Certificate.pdf' && !certName.startsWith('blob:')) {
      fileUrl = `/api/od-requests/uploads/certificates/${certName}`;
    } else {
      fileUrl = `/api/od-requests/uploads/certificates/cert_20260925211826_10f32430.pdf`;
    }
  }

  return triggerBlobDownload(fileUrl, filename, token);
};
