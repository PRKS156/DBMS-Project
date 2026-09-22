async function testLogin() {
  const res = await fetch('https://emergency-backend-3ppk.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'prakhargawali@gmail.com', password: 'password123' }) // I'll just see what it returns for admin to be safe
  });
  
  if (res.status === 401) {
     const res2 = await fetch('https://emergency-backend-3ppk.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@vit.edu', password: 'admin' }) 
      });
      const data2 = await res2.json();
      console.log(data2);
  } else {
      const data = await res.json();
      console.log(data);
  }
}
testLogin();
