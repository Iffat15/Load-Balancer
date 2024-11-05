const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('It is server 1');
});

app.listen(3001, () => {
  console.log('Server 1 is running on port 3001');
});
