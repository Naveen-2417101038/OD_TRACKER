export type UserRole = 'Student' | 'Mentor' | 'Class Incharge' | 'HOD';

export type FacultyRole = 'Mentor' | 'Class Incharge' | 'HOD';

export type FacultyDesignation = 'Professor' | 'Associate Professor' | 'Assistant Professor' | 'Professor & HOD' | 'HOD';

export interface AuthSession {
  userId: string;
  name: string;
  role: UserRole;
  email: string;
  department: string;
  token?: string;
  avatar?: string;
  section?: string;
  year?: string;
  loginTime: string;
}

export interface Faculty {
  faculty_id: string;
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: FacultyDesignation;
  role: FacultyRole;
  assigned_section: string;
  password?: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  avatar?: string;
}

export interface Student {
  name: string;
  registerNumber: string;
  department: string;
  year: string;
  section: string;
  email: string;
  phone: string;
  mentor: string;
  mentorId?: string;
  classIncharge: string;
  classInchargeId?: string;
  profilePhoto: string;
  attendancePercent?: number;
  cgpa?: number;
}

export interface ClassStudentInfo {
  id?: string;
  registerNumber: string;
  name: string;
  rollNo: string;
  section: string;
  department?: string;
  year?: string;
  attendancePercent: number;
  totalODsTaken: number;
  cat1Average: number;
  cat2Average: number;
  cat3Average?: number;
  mentorId?: string;
  mentorName: string;
  avatar?: string;
  hasPendingOD?: boolean;
}

export type EventType = 'Hackathon' | 'Symposium' | 'Workshop' | 'Sports' | 'Cultural Event' | 'Internship' | 'Competition' | 'Seminar' | 'Other';

export type ApprovalStatus = 'Approved' | 'Pending' | 'Rejected' | 'Unreached';

export interface ApprovalStageDetail {
  status: ApprovalStatus;
  date?: string;
  time?: string;
  faculty_id?: string;
  faculty_name?: string;
  faculty_designation?: string;
  faculty_role?: string;
  feedback?: string;
}

export interface ODRequestStages {
  submitted: ApprovalStageDetail;
  mentor: ApprovalStageDetail;
  classIncharge: ApprovalStageDetail;
  hod: ApprovalStageDetail;
}

export type CertificateVerificationStatus = 'Not Uploaded' | 'Pending Verification' | 'Verified' | 'Rejected';

export type ODStatus = 
  | 'Pending' 
  | 'Mentor Approved' 
  | 'Mentor Rejected' 
  | 'Class Incharge Approved' 
  | 'Class Incharge Rejected' 
  | 'HOD Approved' 
  | 'HOD Rejected' 
  | 'Approved' 
  | 'Rejected';

export interface ODRequest {
  id: string;
  studentId?: string;
  studentName?: string;
  studentRegisterNo?: string;
  studentDepartment?: string;
  studentYear?: string;
  studentSection?: string;
  studentPhone?: string;
  studentEmail?: string;
  eventName: string;
  eventType: EventType;
  eventOrganizer: string;
  venue: string;
  eventDate: string;
  fromDate?: string;
  toDate?: string;
  numberOfDays?: number;
  fromTime: string;
  toTime: string;
  reason: string;
  description: string;
  documentUrl: string | null;
  odLetterUrl?: string | null;
  certificateStatus?: CertificateVerificationStatus;
  verifiedByFacultyId?: string;
  verifiedByFacultyName?: string;
  verifiedAt?: string;
  status: ODStatus;
  approvalStage: 'OD Submitted' | 'Mentor' | 'Class Incharge' | 'HOD' | 'Approved' | 'Rejected' | string;
  currentStage?: 'Mentor' | 'Class Incharge' | 'HOD' | 'Approved' | 'Rejected' | string;
  stages: ODRequestStages;
  rejectionReason?: string;
  remarks?: string;
  rejectedByFacultyId?: string;
  rejectedByFacultyName?: string;
  rejectedAt?: string;
  createdAt: string;
  impactedSubjects?: {
    subjectCode: string;
    subjectName: string;
    facultyName: string;
    periods: number;
  }[];
}

export interface CertificateItem {
  id: string;
  requestId: string;
  eventName: string;
  certificateName: string;
  uploadDate: string;
  status: 'Pending Verification' | 'Verified' | 'Rejected';
  verifiedBy?: string;
  verifiedDate?: string;
  fileUrl: string;
  studentName?: string;
  studentRegNo?: string;
}

export interface AttendanceSubject {
  id: string;
  subjectCode?: string;
  subjectName: string;
  facultyName?: string;
  attendancePercent: number;
  totalClasses: number;
  attended: number;
  absent: number;
  odApproved: number;
}

export interface CATMarksEntry {
  id: string;
  subjectCode?: string;
  subjectName: string;
  cat1: number | null;
  cat2: number | null;
  cat3?: number | null;
  average: number;
}

export interface NotificationItem {
  id: string;
  recipientType?: 'student' | 'faculty';
  recipientId?: string;
  recipientRole?: UserRole;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  relatedRequestId?: string;
}
