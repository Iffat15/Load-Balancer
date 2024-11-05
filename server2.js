const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('It is server 2');
});

app.listen(3002, () => {
  console.log('Server 2 is running on port 3002');
});
