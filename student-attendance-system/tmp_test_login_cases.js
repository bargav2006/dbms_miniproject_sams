const http = require('http');

const cases = [
  { username: 'asha_rao', password: 'password123', role: 'teacher', label: 'teacher-username' },
  { username: '1', password: 'password123', role: 'teacher', label: 'teacher-id' },
  { username: 'aarav_101', password: 'password123', role: 'student', label: 'student-username' },
  { username: '1', password: 'password123', role: 'student', label: 'student-id' },
];

const runCase = (c) => new Promise((resolve) => {
  const data = JSON.stringify({ username: c.username, password: c.password, role: c.role });
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log(`\nCase: ${c.label}`);
      console.log('Status:', res.statusCode);
      try { console.log('Body:', JSON.parse(body)); } catch (e) { console.log('Body:', body); }
      resolve();
    });
  });
  req.on('error', (e) => { console.error('Request error:', e.message); resolve(); });
  req.write(data);
  req.end();
});

(async () => {
  for (const c of cases) {
    await runCase(c);
  }
  console.log('\nAll tests completed');
})();
