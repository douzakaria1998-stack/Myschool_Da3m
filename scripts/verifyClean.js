const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test page script that simulates what happens in React
const testHtml = `<!DOCTYPE html>
<html>
<body>
<h1>Simulating /students page load</h1>
</body>
</html>`;
