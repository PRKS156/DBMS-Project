async function testApi() {
  const res = await fetch('https://emergency-backend-3ppk.onrender.com/api/alerts/doctor/1');
  const data = await res.text();
  console.log(res.status);
  console.log(data);
}
testApi();
