const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('It is server 3');
});

app.listen(3003, () => {
  console.log('Server 3 is running on port 3003');
});
