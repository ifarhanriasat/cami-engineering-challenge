const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type RequestStatus = 'open' | 'in_progress' | 'resolved';

export const CLASSIFICATION_CATEGORIES = ['billing', 'sales', 'support', 'unknown'] as const;
export type ClassificationCategory = (typeof CLASSIFICATION_CATEGORIES)[number];

export type RequestListItem = {
  id: string;
  message: string;
  status: RequestStatus;
  category: string | null;
  confidence: number | null;
  noteCount: number;
  latestNotePreview: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Surface the API's validation message (Nest returns string | string[]) when there is one. */
async function failure(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json();
    const detail = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    if (detail) return new Error(`${fallback}: ${detail}`);
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return new Error(`${fallback} (${res.status})`);
}

export async function fetchRequests(): Promise<RequestListItem[]> {
  const res = await fetch(`${API_URL}/requests`);
  if (!res.ok) {
    throw await failure(res, 'Failed to load requests');
  }
  return res.json();
}

export type CreatedRequest = {
  id: string;
  message: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
};

export async function createRequest(message: string): Promise<CreatedRequest> {
  const res = await fetch(`${API_URL}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    throw await failure(res, 'Failed to create request');
  }
  return res.json();
}

export async function updateRequestStatus(id: string, status: RequestStatus): Promise<CreatedRequest> {
  const res = await fetch(`${API_URL}/requests/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw await failure(res, 'Failed to update status');
  }
  return res.json();
}

export type ClassifyResult = {
  category: ClassificationCategory;
  confidence: number;
  requestId: string | null;
};

export async function classifyMessage(message: string, requestId?: string): Promise<ClassifyResult> {
  const res = await fetch(`${API_URL}/requests/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, requestId }),
  });
  if (!res.ok) {
    throw await failure(res, 'Failed to classify');
  }
  return res.json();
}

export type HistoryItem = {
  id: string;
  requestId: string | null;
  message: string;
  category: ClassificationCategory;
  confidence: number;
  provider: string;
  createdAt: string;
};

export async function fetchHistory(category?: ClassificationCategory): Promise<{ items: HistoryItem[] }> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`${API_URL}/requests/history${qs}`);
  if (!res.ok) {
    throw await failure(res, 'Failed to load history');
  }
  return res.json();
}
