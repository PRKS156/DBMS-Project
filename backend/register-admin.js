async function registerUser() {
  try {
    const res = await fetch('https://emergency-backend-3ppk.onrender.com/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@vit.edu',
        password: 'password123',
        role: 'ADMIN'
      })
    });
    const data = await res.json();
    console.log('✅ User registered successfully:', data);
  } catch (error) {
    console.error('❌ Failed to register:', error);
  }
}

registerUser();
