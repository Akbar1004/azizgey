const json = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

const get = (url) => fetch(url).then(json);
const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json);

export const api = {
  bootstrap: (studentId = 'aziz') => get(`/api/bootstrap?studentId=${studentId}`),
  teacherOverview: () => get('/api/teacher/overview'),
  teacherSubmission: (id) => get(`/api/teacher/submissions/${id}`),
  approve: (id, body) => post(`/api/teacher/submissions/${id}/approve`, body),
  flag: (id, body) => post(`/api/teacher/submissions/${id}/flag`, body),
  sets: () => get('/api/teacher/sets'),
  generate: (body) => post('/api/teacher/generate', body),
  publish: (body) => post('/api/teacher/publish', body),
  student: (id) => get(`/api/student/${id}`),
  analyze: (id, body) => post(`/api/student/${id}/analyze`, body),
  tutor: (body) => post('/api/tutor', body),
  submit: (body) => post('/api/submissions', body),
  defenseQuestion: (id) => get(`/api/submissions/${id}/defense-question`),
  defense: (id, body) => post(`/api/submissions/${id}/defense`, body),
  enroll: (body) => post('/api/voiceprint/enroll', body),
  compare: (body) => post('/api/voiceprint/compare', body),
  mentorState: (studentId) => get(`/api/mentor/state?studentId=${studentId}`),
  mentorTurn: (body) => post('/api/mentor/turn', body),
  leaderboard: () => get('/api/leaderboard'),
  rewards: (studentId) => get(`/api/rewards/${studentId}`),
  redeem: (body) => post('/api/rewards/redeem', body),
  parents: () => get('/api/parents'),
  parentReport: (id) => get(`/api/parents/${id}/report`),
  sendReport: (id) => post(`/api/parents/${id}/send`, {}),
  prompts: () => get('/api/prompts'),
  audit: () => get('/api/audit'),
};
